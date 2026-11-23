import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentId, AgentRunKind, Approval, ProjectProfile, ProjectStats, Task, TaskPriority, TaskReview, ToolCallRecord } from '@pixel/shared';
import { AGENTS, AGENT_IDS, TASK_STATUSES, WORKER_IDS } from '@pixel/shared';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { Hub } from '../events/hub.js';
import { runAgent, type RunOptions, type RunResult } from '../agents/runner.js';
import { isWritable } from '../agents/guard.js';
import type { KnowledgeService, RoutingPlan } from '../knowledge/service.js';
import type { CitationCheck, KnowledgeHit, Skill } from '@pixel/shared';
import {
  directorReviewPrompt,
  directorSystemPrompt,
  workerSystemPrompt,
  workerTaskPrompt,
} from '../agents/prompts.js';
import fs from 'node:fs';
import path from 'node:path';
import { countFiles, fileTree, initWorkspace, snapshot, workspaceRoot } from '../workspace/workspace.js';
import { HttpError, errorMessage, log, nowIso, truncate } from '../util.js';

const STUDIO_TOOL_NAMES = [
  'mcp__studio__get_project_status',
  'mcp__studio__create_task',
  'mcp__studio__add_milestone',
  'mcp__studio__request_approval',
  'mcp__studio__cancel_task',
];
const REVIEW_TOOL = 'mcp__studio__review_task';

type ReviewDecision = { decision: 'approve' | 'revise'; feedback: string };

export interface PreparedKnowledge {
  tools: string[];
  skill: Skill | null;
  skillHow: string;
  hits: KnowledgeHit[];
  query: string;
  /** Full Knowledge Router v2 decision (engine, version, disciplines, genre, reasons, clarification). */
  plan: RoutingPlan;
}

/** A tiny FIFO mutex: the Director is one person and handles one conversation/review at a time. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

/**
 * The studio orchestrator: owns the task lifecycle
 *   queued → in_progress → in_review → (revision ↺) → [awaiting_approval] → done
 * and runs the Director + specialists as Claude Agent SDK sessions.
 */
export class Studio {
  private running = new Map<string, { agentId: AgentId; abort: AbortController }>();
  private director = new Mutex();
  private kickScheduled = false;

  constructor(
    private store: Store,
    private hub: Hub,
    /** Injected so tests can drive the lifecycle without calling the model. */
    private runner: typeof runAgent = runAgent,
    private isLive: () => boolean = () => config.aiMode === 'live',
    /** Studio knowledge library; optional so lifecycle tests can run without it. */
    public knowledge: KnowledgeService | null = null,
  ) {}

  get live() {
    return this.isLive();
  }

  // ---------------------------------------------------------------------------
  // Boot / recovery
  // ---------------------------------------------------------------------------
  recover() {
    // Runs in flight when the server stopped never reported a cost.
    const interrupted = this.store.interruptRunningRuns();
    if (interrupted) log.warn(`${interrupted} agent run(s) were interrupted by a restart; their cost is unavailable`);
    // Agent processes do not survive a restart: re-queue interrupted work.
    for (const t of this.store.tasksInStatus('in_progress')) {
      this.store.updateTask(t.id, { status: 'queued', error: 'Interrupted by server restart; re-queued.' });
    }
    for (const a of AGENT_IDS) this.store.setAgentState({ agentId: a, status: 'idle', activity: '', currentTaskId: null, projectId: null });
    this.repairFileAttribution();
    // Deliverables that were waiting for the Director's review get reviewed again.
    for (const t of this.store.tasksInStatus('in_review')) this.enqueueReview(t.id);
    this.kick();
  }

  /**
   * Choose the skill and retrieve references for a run. Tool packs (Unity, Unreal, Phaser, web) load only when
   * the task or project targets that stack; only packs assigned to the agent's department are searched.
   */
  prepareKnowledge(p: {
    agentId: AgentId;
    projectId: string | null;
    taskText: string;
    /** @deprecated kept for callers; the router reads profile, brief and genre from the project itself. */
    projectText?: string;
    skillId?: string | null;
    defaultSkillId?: string;
  }): PreparedKnowledge | undefined {
    const k = this.knowledge;
    if (!k) return undefined;
    const project = p.projectId ? this.store.getProject(p.projectId) : null;
    const plan = k.route({
      agentId: p.agentId,
      projectId: p.projectId,
      taskText: p.taskText,
      profile: project?.profile ?? {},
      briefText: project ? project.brief : (p.projectText ?? ''),
      genreText: project ? `${project.genre}\n${project.brief}` : (p.projectText ?? ''),
      skillId: p.skillId,
      defaultSkillId: p.defaultSkillId,
    });
    if (p.skillId && plan.skill?.id !== p.skillId) log.warn(`skill ${p.skillId} is not available to ${p.agentId}; selected ${plan.skill?.id ?? 'none'}`);
    return { tools: plan.tools, skill: plan.skill, skillHow: plan.skillHow, hits: plan.hits, query: plan.query, plan };
  }

  /** Owner edits the structured project profile; tasks waiting for an engine answer are re-queued. */
  updateProfile(projectId: string, profile: ProjectProfile) {
    const project = this.store.updateProject(projectId, { profile });
    this.hub.broadcast({ kind: 'project_updated', project });
    let requeued = 0;
    for (const t of this.store.listTasks(projectId))
      if (t.status === 'needs_clarification') {
        this.pushTask(this.store.updateTask(t.id, { status: 'queued', error: '' }));
        requeued++;
      }
    if (requeued) {
      const m = this.store.addChat({ projectId, role: 'system', agentId: null, content: `Project profile updated; ${requeued} task(s) waiting for clarification were re-queued.` });
      this.hub.broadcast({ kind: 'chat_message', message: m }, projectId);
      this.kick();
    }
    return project;
  }

  taskRouting(taskId: string) {
    this.store.getTask(taskId);
    return this.knowledge ? this.knowledge.routing({ taskId }) : [];
  }

  /** The router refused to pick an engine: park the task and ask the owner instead of guessing. */
  private requestClarification(task: Task, plan: RoutingPlan) {
    this.knowledge?.recordRouting({ runId: null, projectId: task.projectId, taskId: task.id, agentId: task.assignee }, plan);
    const t = this.pushTask(this.store.updateTask(task.id, { status: 'needs_clarification', error: plan.clarification ?? 'Clarification required' }));
    const m = this.store.addChat({
      projectId: t.projectId,
      role: 'director',
      agentId: 'director',
      content: `Before ${AGENTS[t.assignee].name} can start "${t.title}" I need one answer from you:\n\n${plan.clarification}\n\nSet the engine (and version) under **Project → Edit → Project profile**; the task restarts automatically.`,
    });
    this.hub.broadcast({ kind: 'chat_message', message: m }, t.projectId);
    this.hub.emit('approval_required', {
      projectId: t.projectId,
      agentId: t.assignee,
      taskId: t.id,
      message: `"${t.title}" is waiting: which engine should it target?`,
      data: { clarification: plan.clarification },
    });
  }

  /** Validate a skill requested for a task: it must exist, be enabled and belong to the assignee's role. */
  private checkSkill(skillId: string | null | undefined, assignee: AgentId) {
    if (!skillId) return null;
    if (!this.knowledge) throw new HttpError(400, 'The knowledge library is not loaded');
    const s = this.knowledge.skill(skillId);
    if (!s) throw new HttpError(400, `Unknown skill ${skillId}`);
    if (s.role !== assignee) throw new HttpError(400, `Skill ${skillId} belongs to the ${AGENTS[s.role].title}, not the ${AGENTS[assignee].title}`);
    if (!s.enabled) throw new HttpError(400, `Skill ${skillId} is disabled by the owner`);
    return s.id;
  }

  /**
   * Earlier builds attributed every file that changed in the workspace during a run to that run, which
   * mislabels files written concurrently by other agents. An assignee can only ever write inside its own
   * folders (enforced by the guard), so drop any task file outside them. Idempotent.
   */
  repairFileAttribution() {
    let fixed = 0;
    for (const p of this.store.listProjects()) {
      for (const t of this.store.listTasks(p.id)) {
        const keep = t.files.filter((f) => isWritable(f, AGENTS[t.assignee].writableDirs));
        if (keep.length === t.files.length) continue;
        log.warn(`[repair] ${t.id}: removed files written by other agents: ${t.files.filter((f) => !keep.includes(f)).join(', ')}`);
        this.store.updateTask(t.id, { files: keep });
        fixed++;
      }
    }
    return fixed;
  }

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  createProject(input: { name: string; genre: string; brief: string; repoUrl: string; profile?: ProjectProfile }) {
    const project = this.store.createProject(input);
    initWorkspace(project);
    this.store.addChat({
      projectId: project.id,
      role: 'director',
      agentId: 'director',
      content: `Welcome to ${project.name}! I've set up the workspace with your brief in docs/BRIEF.md. Tell me what you'd like the team to build first — for example "Draft the GDD and a visual style guide" — and I'll plan and delegate it.`,
    });
    this.hub.broadcast({ kind: 'project_updated', project });
    return project;
  }

  stats(projectId: string): ProjectStats {
    const tasks = this.store.listTasks(projectId).filter((t) => t.status !== 'cancelled');
    const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as ProjectStats['byStatus'];
    const byAgent = Object.fromEntries(AGENT_IDS.map((a) => [a, { total: 0, done: 0 }])) as ProjectStats['byAgent'];
    for (const t of this.store.listTasks(projectId)) byStatus[t.status]++;
    for (const t of tasks) {
      byAgent[t.assignee].total++;
      if (t.status === 'done') byAgent[t.assignee].done++;
    }
    const done = byStatus.done;
    const usage = this.store.usageSummary(projectId);
    return {
      totalTasks: tasks.length,
      doneTasks: done,
      activeTasks: byStatus.in_progress + byStatus.in_review + byStatus.revision,
      failedTasks: byStatus.failed,
      pendingApprovals: this.store.listApprovals(projectId).filter((a) => a.status === 'pending').length,
      fileCount: countFiles(fileTree(projectId)),
      costUsd: usage.knownCostUsd,
      usage,
      progress: tasks.length ? done / tasks.length : 0,
      byStatus,
      byAgent,
    };
  }

  // ---------------------------------------------------------------------------
  // Agent runs: every Agent SDK session is persisted with its usage
  // ---------------------------------------------------------------------------
  private async tracked(kind: AgentRunKind, opts: RunOptions, know?: PreparedKnowledge): Promise<RunResult & { runId: string }> {
    const run = this.store.startRun({ projectId: opts.projectId, taskId: opts.taskId, agentId: opts.agentId, kind });
    if (this.knowledge && know) {
      // Record what was injected, and mount the read-only knowledge tools bound to this run.
      const ctx = { agentId: opts.agentId, projectId: opts.projectId, taskId: opts.taskId, runId: run.id, tools: know.tools, engineVersion: know.plan.engine.version };
      this.knowledge.recordRouting({ runId: run.id, projectId: opts.projectId, taskId: opts.taskId, agentId: opts.agentId }, know.plan);
      if (know.skill) this.knowledge.recordSkill(ctx, know.skill, know.skillHow);
      for (const sk of know.plan.supporting) this.knowledge.recordSkill(ctx, sk, 'supporting skill (discipline match)');
      for (const h of know.hits) this.knowledge.record(ctx, 'auto', h, know.query);
      const k = this.knowledge.agentServer(ctx);
      opts = {
        ...opts,
        prompt: `${opts.prompt}\n\n---\n\n${this.knowledge.renderPlan(know.plan)}`,
        mcpServers: { ...(opts.mcpServers ?? {}), knowledge: k.server },
        mcpTools: [...(opts.mcpTools ?? []), ...k.toolNames],
      };
    }
    let res: RunResult;
    try {
      res = await this.runner({
        ...opts,
        onSession: (sessionId) => {
          this.store.setRunSession(run.id, sessionId);
          opts.onSession?.(sessionId);
        },
        onToolCall: (c) =>
          this.store.addToolCall({
            runId: run.id,
            projectId: opts.projectId,
            taskId: opts.taskId,
            agentId: opts.agentId,
            ...c,
          }),
        onToolResult: (toolUseId, outcome) => this.store.setToolOutcome(toolUseId, outcome),
      });
    } catch (e) {
      this.store.finishRun(run.id, { sessionId: null, status: 'error', costUsd: null, error: errorMessage(e) });
      this.hub.broadcast({ kind: 'usage_updated', projectId: opts.projectId, taskId: opts.taskId }, opts.projectId);
      throw e;
    }
    // The SDK's total_cost_usd is cumulative for a resumed session; record this run's own share.
    let costUsd: number | null = null;
    if (res.costAvailable) {
      const resumed = !!opts.resume && res.sessionId === opts.resume;
      const prior = resumed && res.sessionId ? this.store.priorReportedSessionCost(res.sessionId, run.id) : 0;
      costUsd = res.costUsd >= prior ? res.costUsd - prior : res.costUsd;
    }
    this.store.finishRun(run.id, {
      sessionId: res.sessionId,
      status: res.ok ? 'ok' : res.aborted ? 'cancelled' : 'error',
      costUsd,
      reportedCostUsd: res.costAvailable ? res.costUsd : null,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
      cacheReadTokens: res.usage?.cacheReadTokens,
      cacheCreationTokens: res.usage?.cacheCreationTokens,
      numTurns: res.costAvailable ? res.turns : null,
      durationMs: res.durationMs,
      model: res.model,
      error: res.ok ? '' : res.error,
    });
    this.hub.broadcast({ kind: 'usage_updated', projectId: opts.projectId, taskId: opts.taskId }, opts.projectId);
    return { ...res, runId: run.id };
  }

  private review(input: Omit<TaskReview, 'id' | 'createdAt' | 'projectId'> & { projectId?: string }) {
    const projectId = input.projectId ?? this.store.getTask(input.taskId).projectId;
    return this.store.addReview({ ...input, projectId });
  }

  taskHistory(taskId: string) {
    this.store.getTask(taskId);
    return { reviews: this.store.listReviews(taskId), runs: this.store.listRuns({ taskId }) };
  }

  /** Enabled specialist skills, listed for the Director when delegating. */
  skillCatalogText(): string {
    if (!this.knowledge) return '';
    return WORKER_IDS.map((id) => {
      const skills = this.knowledge!.skillsFor(id);
      return `- ${id}: ${skills.length ? skills.map((s) => `${s.id} (${s.summary})`).join('; ') : '(no enabled skills)'}`;
    }).join('\n');
  }

  taskKnowledge(taskId: string) {
    this.store.getTask(taskId);
    return this.knowledge ? this.knowledge.usage({ taskId }) : [];
  }

  toolCalls(projectId: string, decision?: ToolCallRecord['decision']) {
    this.store.getProject(projectId);
    return this.store.listToolCalls({ projectId, decision });
  }

  usage(projectId: string) {
    this.store.getProject(projectId);
    return { summary: this.store.usageSummary(projectId), runs: this.store.listRuns({ projectId }) };
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  private pushTask(task: Task) {
    this.hub.broadcast({ kind: 'task_updated', task }, task.projectId);
    return task;
  }

  createTask(input: {
    projectId: string;
    title: string;
    description: string;
    assignee: AgentId;
    priority?: TaskPriority;
    milestoneId?: string | null;
    requiresApproval?: boolean;
    dependsOn?: string[];
    skillId?: string | null;
    createdBy: AgentId | 'user';
  }): Task {
    this.store.getProject(input.projectId);
    if (input.assignee === 'director') throw new HttpError(400, 'Tasks must be assigned to a specialist, not the Director');
    input = { ...input, skillId: this.checkSkill(input.skillId, input.assignee) };
    if (input.milestoneId) this.store.getMilestone(input.milestoneId);
    const dependsOn = Array.from(new Set(input.dependsOn ?? []));
    for (const id of dependsOn) {
      const dep = this.store.findTask(id);
      if (!dep) throw new HttpError(400, `Dependency ${id} does not exist`);
      if (dep.projectId !== input.projectId) throw new HttpError(400, `Dependency ${id} belongs to another project`);
      if (dep.status === 'cancelled') throw new HttpError(400, `Dependency ${id} is cancelled and can never complete`);
    }
    // A new task cannot be part of a cycle: its prerequisites already exist and nothing depends on it yet.
    const task = this.pushTask(this.store.createTask({ ...input, dependsOn }));
    const waiting = this.store.unmetDependencies(task.id);
    const creator = input.createdBy === 'user' ? null : input.createdBy;
    this.hub.emit('task_created', {
      projectId: task.projectId,
      agentId: creator,
      taskId: task.id,
      message: `${creator ? AGENTS[creator].name : 'You'} created "${task.title}"`,
      data: { title: task.title, assignee: task.assignee, priority: task.priority },
      status: creator === 'director' ? 'meeting' : undefined,
    });
    this.hub.emit('task_assigned', {
      projectId: task.projectId,
      agentId: task.assignee,
      taskId: task.id,
      message: `${AGENTS[task.assignee].name} was assigned "${task.title}"${
        waiting.length ? ` (waiting on ${waiting.map((w) => `"${w.title}"`).join(', ')})` : ''
      }`,
      data: { title: task.title, waitingOn: waiting.map((w) => w.id) },
    });
    // The briefing is short: the assignee goes back to idle until the scheduler starts the task.
    setTimeout(() => {
      const st = this.hub.current(task.assignee);
      if (st?.status === 'meeting' && !this.isAgentBusy(task.assignee))
        this.hub.setAgent(task.assignee, { status: 'idle', activity: 'Task queued', currentTaskId: null });
    }, 4000);
    this.kick();
    return task;
  }

  updateTask(id: string, patch: Parameters<Store['updateTask']>[1]) {
    const cur = this.store.getTask(id);
    if (patch.assignee && patch.assignee === 'director') throw new HttpError(400, 'Cannot assign tasks to the Director');
    if (this.running.has(id) && (patch.assignee || patch.description))
      throw new HttpError(409, 'Task is running; cancel it before changing its assignee or description');
    const task = this.pushTask(this.store.updateTask(id, patch));
    if (patch.status === 'queued' && cur.status !== 'queued') this.kick();
    return task;
  }

  deleteTask(id: string) {
    const t = this.store.getTask(id);
    this.cancelTask(id, 'Deleted');
    this.store.deleteTask(id);
    this.hub.broadcast({ kind: 'task_deleted', taskId: id, projectId: t.projectId }, t.projectId);
  }

  cancelTask(id: string, reason = 'Cancelled by owner') {
    const run = this.running.get(id);
    run?.abort.abort();
    const t = this.store.getTask(id);
    if (t.status === 'done' || t.status === 'cancelled') return t;
    for (const a of this.store.listApprovals(t.projectId))
      if (a.taskId === id && a.status === 'pending')
        this.hub.broadcast({ kind: 'approval_updated', approval: this.store.resolveApproval(a.id, 'rejected', reason) }, t.projectId);
    return this.pushTask(this.store.updateTask(id, { status: 'cancelled', error: reason }));
  }

  retryTask(id: string) {
    const t = this.store.getTask(id);
    if (!['failed', 'cancelled'].includes(t.status)) throw new HttpError(409, `Task is ${t.status}; only failed or cancelled tasks can be retried`);
    // Keep the error: the next run tells the agent why the last attempt stopped (it is cleared when the run starts).
    const task = this.pushTask(this.store.updateTask(id, { status: 'queued' }));
    this.kick();
    return task;
  }

  isAgentBusy(agentId: AgentId) {
    for (const r of this.running.values()) if (r.agentId === agentId) return true;
    return false;
  }

  /** Start as many queued tasks as the concurrency limit allows (one task per agent). */
  kick() {
    if (this.kickScheduled) return;
    this.kickScheduled = true;
    queueMicrotask(() => {
      this.kickScheduled = false;
      if (!this.live || !config.autoRun) return;
      for (const agentId of WORKER_IDS) {
        if (this.running.size >= config.maxConcurrentAgents) return;
        if (this.isAgentBusy(agentId)) continue;
        const task = this.store.nextTaskFor(agentId);
        if (task) void this.runTask(task);
      }
    });
  }

  /** Manually start a queued task (used when AUTO_RUN_TASKS=false). */
  startTask(id: string) {
    if (!this.live) throw new HttpError(503, config.aiReason);
    const t = this.store.getTask(id);
    if (!['queued', 'revision'].includes(t.status)) throw new HttpError(409, `Task is ${t.status}`);
    if (this.isAgentBusy(t.assignee)) throw new HttpError(409, `${AGENTS[t.assignee].name} is busy with another task`);
    const waiting = this.store.unmetDependencies(t.id);
    if (waiting.length)
      throw new HttpError(409, `Waiting on prerequisite task(s): ${waiting.map((w) => `"${w.title}"`).join(', ')}`);
    void this.runTask(t);
    return this.store.getTask(id);
  }

  private async runTask(task: Task) {
    const abort = new AbortController();
    this.running.set(task.id, { agentId: task.assignee, abort });
    const agentId = task.assignee;
    try {
      const project = this.store.getProject(task.projectId);
      const milestones = this.store.listMilestones(task.projectId);
      const previous = task.error && task.status !== 'needs_clarification' ? { error: task.error, files: task.files } : undefined;
      const know = this.prepareKnowledge({
        agentId,
        projectId: task.projectId,
        taskText: `${task.title}\n${task.description}${task.feedback && task.revisionCount ? `\n${task.feedback}` : ''}`,
        skillId: task.skillId,
      });
      if (know?.plan.clarification) {
        this.requestClarification(task, know.plan);
        return;
      }
      task = this.pushTask(
        this.store.updateTask(task.id, { status: 'in_progress', startedAt: task.startedAt ?? nowIso(), error: '' }),
      );
      this.hub.emit('task_started', {
        projectId: task.projectId,
        agentId,
        taskId: task.id,
        message: `${AGENTS[agentId].name} started "${task.title}"${task.revisionCount ? ` (revision ${task.revisionCount})` : ''}`,
        data: { title: task.title, revision: task.revisionCount },
      });

      const resume = task.revisionCount > 0 ? this.store.getTaskSession(task.id) : null;
      const res = await this.tracked('task', {
        agentId,
        projectId: task.projectId,
        taskId: task.id,
        prompt: workerTaskPrompt(
          task,
          task.dependsOn.map((id) => this.store.findTask(id)).filter((t): t is Task => !!t),
          previous,
        ),
        systemPrompt: workerSystemPrompt(agentId, project, milestones, AGENTS[agentId].writableDirs),
        resume,
        abort,
        effort: agentId === 'programmer' ? 'high' : 'medium',
      }, know);
      if (res.sessionId) this.store.setTaskSession(task.id, res.sessionId);

      const current = this.store.findTask(task.id);
      if (!current || current.status === 'cancelled') {
        this.hub.emit('agent_idle', { projectId: task.projectId, agentId, message: `${AGENTS[agentId].name} stopped (task cancelled)` });
        return;
      }
      const files = Array.from(new Set([...current.files, ...res.files]));
      const costUsd = this.costOf(current);

      if (!res.ok) {
        this.failTask(current.id, res.error || 'Unknown error', { files, costUsd, result: res.text });
        return;
      }

      this.checkCitations(current, res.runId, res.files.length ? res.files : files, res.text);
      task = this.pushTask(
        this.store.updateTask(task.id, { status: 'in_review', result: res.text, files, costUsd, error: '' }),
      );
      // Report back to the Director (visible in the Director chat).
      const report = this.store.addChat({
        projectId: task.projectId,
        role: 'agent',
        agentId,
        content: `**Report on "${task.title}"**\n\n${truncate(res.text, 3000)}`,
      });
      this.hub.broadcast({ kind: 'chat_message', message: report }, task.projectId);
      this.hub.emit('agent_idle', {
        projectId: task.projectId,
        agentId,
        taskId: task.id,
        message: `${AGENTS[agentId].name} handed "${task.title}" to the Director for review`,
      });
      if (config.autoReview) this.enqueueReview(task.id);
      else this.finalize(task.id, 'Auto-review disabled');
    } catch (e) {
      log.error('runTask failed', e);
      this.failTask(task.id, errorMessage(e));
    } finally {
      this.running.delete(task.id);
      this.kick();
    }
  }

  /** Automatic citation check over the run's deliverables and report (Phase 1.1). Never blocks the run itself. */
  private checkCitations(task: Task, runId: string, files: string[], report: string): CitationCheck | null {
    if (!this.knowledge) return null;
    try {
      const root = workspaceRoot(task.projectId);
      const texts = [{ name: '(agent report)', text: report }];
      for (const f of files) {
        const abs = path.resolve(root, f);
        if (!abs.startsWith(root + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        if (fs.statSync(abs).size > 400_000 || !/\.(md|txt|json|ya?ml|cs|cpp|h|hpp|js|ts|mjs|html|ini|csv)$/i.test(f)) continue;
        texts.push({ name: f, text: fs.readFileSync(abs, 'utf8') });
      }
      return this.knowledge.checkCitations({ runId, projectId: task.projectId, taskId: task.id, agentId: task.assignee }, texts);
    } catch (e) {
      log.warn('citation check failed', e);
      return null;
    }
  }

  /** Latest citation check of the assignee's own work on this task. */
  latestCitationCheck(taskId: string): CitationCheck | null {
    const t = this.store.findTask(taskId);
    if (!this.knowledge || !t) return null;
    return this.knowledge.citationChecks({ taskId }).filter((c) => c.agentId === t.assignee).at(-1) ?? null;
  }

  citationChecks(taskId: string) {
    return this.knowledge ? this.knowledge.citationChecks({ taskId }) : [];
  }

  private failTask(id: string, error: string, extra: Partial<Task> = {}) {
    const t = this.pushTask(this.store.updateTask(id, { ...extra, status: 'failed', error }));
    this.hub.emit('task_failed', {
      projectId: t.projectId,
      agentId: t.assignee,
      taskId: t.id,
      message: `"${t.title}" failed: ${truncate(error, 160)}`,
      data: { error },
    });
  }

  /** Deliverable accepted by the Director → owner sign-off if required, otherwise done. */
  private finalize(id: string, note: string) {
    const t = this.store.getTask(id);
    if (t.requiresApproval) {
      const approval = this.store.createApproval({
        projectId: t.projectId,
        taskId: t.id,
        title: `Sign off: ${t.title}`,
        details: `${AGENTS[t.assignee].name} delivered this task and the Director approved it.\n\nDirector's note: ${note}\n\nFiles:\n${t.files.map((f) => `- ${f}`).join('\n') || '- (none)'}\n\nAgent report:\n${t.result}`,
        requestedBy: 'director',
      });
      this.pushTask(this.store.updateTask(id, { status: 'awaiting_approval' }));
      this.hub.broadcast({ kind: 'approval_updated', approval }, t.projectId);
      this.hub.emit('approval_required', {
        projectId: t.projectId,
        agentId: t.assignee,
        taskId: t.id,
        message: `"${t.title}" needs your sign-off`,
        data: { approvalId: approval.id },
      });
      return;
    }
    this.complete(id);
  }

  /** Known spend for a task: pre-v2 aggregate (if any) plus every tracked run since. */
  private costOf(t: Task) {
    return this.store.taskKnownCost(t.id);
  }

  private complete(id: string) {
    // Review notes and owner comments live in task_reviews; the task record is not overwritten.
    const t = this.pushTask(this.store.updateTask(id, { status: 'done', completedAt: nowIso() }));
    this.hub.emit('task_completed', {
      projectId: t.projectId,
      agentId: t.assignee,
      taskId: t.id,
      message: `${AGENTS[t.assignee].name} completed "${t.title}"`,
      data: { files: t.files },
    });
    // Unblock anything that was waiting on this task.
    if (this.store.dependents(t.id).length) this.kick();
  }

  private sendBack(id: string, feedback: string, from: string) {
    const t = this.store.getTask(id);
    const task = this.pushTask(
      this.store.updateTask(id, { status: 'revision', revisionCount: t.revisionCount + 1, feedback }),
    );
    this.hub.emit('task_assigned', {
      projectId: task.projectId,
      agentId: task.assignee,
      taskId: task.id,
      message: `${from} requested a revision of "${task.title}"`,
      data: { feedback, revision: task.revisionCount },
    });
    this.kick();
  }

  // ---------------------------------------------------------------------------
  // Approvals
  // ---------------------------------------------------------------------------
  requestApproval(input: { projectId: string; title: string; details: string; requestedBy: AgentId; taskId?: string | null }) {
    const approval = this.store.createApproval({ ...input, taskId: input.taskId ?? null });
    this.hub.broadcast({ kind: 'approval_updated', approval }, input.projectId);
    this.hub.emit('approval_required', {
      projectId: input.projectId,
      agentId: input.requestedBy,
      taskId: input.taskId ?? null,
      message: `${AGENTS[input.requestedBy].name} needs your decision: ${input.title}`,
      data: { approvalId: approval.id },
    });
    return approval;
  }

  resolveApproval(id: string, decision: 'approved' | 'rejected', response: string): Approval {
    const before = this.store.getApproval(id);
    if (before.status !== 'pending') throw new HttpError(409, 'Approval already resolved');
    const approval = this.store.resolveApproval(id, decision, response);
    this.hub.broadcast({ kind: 'approval_updated', approval }, approval.projectId);

    if (approval.taskId) {
      const t = this.store.findTask(approval.taskId);
      if (t) {
        this.review({
          projectId: t.projectId,
          taskId: t.id,
          reviewer: 'owner',
          decision,
          feedback: response,
          revision: t.revisionCount,
          runId: null,
          approvalId: approval.id,
        });
      }
      if (t && t.status === 'awaiting_approval') {
        if (decision === 'approved') this.complete(t.id);
        else this.sendBack(t.id, response || 'The owner rejected this deliverable. Please revise.', 'The owner');
      }
    } else {
      this.hub.setAgent(approval.requestedBy, { status: 'idle', activity: '' });
    }

    const verdict = decision === 'approved' ? 'APPROVED' : 'REJECTED';
    const note = `[Owner decision] ${verdict}: "${approval.title}"${response ? `\nOwner's comment: ${response}` : ''}`;
    const msg = this.store.addChat({ projectId: approval.projectId, role: 'system', agentId: null, content: note });
    this.hub.broadcast({ kind: 'chat_message', message: msg }, approval.projectId);
    // Let the Director react to decisions that are not plain task sign-offs.
    if (!approval.taskId && this.live) void this.directorTurn(approval.projectId, note, false);
    return approval;
  }

  // ---------------------------------------------------------------------------
  // Director
  // ---------------------------------------------------------------------------
  private studioServer(projectId: string, review?: { taskId: string; out: { decision?: ReviewDecision } }) {
    const workerEnum = z.enum(WORKER_IDS as [AgentId, ...AgentId[]]);
    const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
    const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

    const tools = [
      tool('get_project_status', 'Get milestones, all tasks (status, assignee, result summary) and pending approvals for this project.', {}, async () => {
        const tasks = this.store.listTasks(projectId).map((t) => ({
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          status: t.status,
          priority: t.priority,
          milestone_id: t.milestoneId,
          revisions: t.revisionCount,
          files: t.files,
          depends_on: t.dependsOn,
          waiting_on: this.store.unmetDependencies(t.id).map((d) => d.id),
          result: truncate(t.result, 600),
          error: t.error || undefined,
        }));
        const status = {
          milestones: this.store.listMilestones(projectId),
          tasks,
          pending_approvals: this.store.listApprovals(projectId).filter((a) => a.status === 'pending').map((a) => ({ id: a.id, title: a.title })),
          project_profile: this.store.getProject(projectId).profile,
          tasks_needing_clarification: this.store.listTasks(projectId).filter((t) => t.status === 'needs_clarification').map((t) => ({ id: t.id, question: t.error })),
          workspace_files: [...snapshot(projectId).keys()].sort(),
          stats: this.stats(projectId),
        };
        return ok(JSON.stringify(status, null, 2));
      }),
      tool(
        'create_task',
        'Create a task and delegate it to a specialist. The description must be self-contained with acceptance criteria and the files to read/produce.',
        {
          title: z.string().min(3).max(120),
          description: z.string().min(10),
          assignee: workerEnum,
          priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
          milestone_id: z.string().optional(),
          requires_approval: z.boolean().default(false).describe('Owner must sign off the deliverable before it is done'),
          skill: z
            .string()
            .optional()
            .describe('Id of an enabled skill of the assignee (see the skills list in your instructions); omit to let the studio choose'),
          depends_on: z
            .array(z.string())
            .default([])
            .describe('Task ids that must be done (incl. owner sign-off) before this task may start'),
        },
        async (a) => {
          try {
            const t = this.createTask({
              projectId,
              title: a.title,
              description: a.description,
              assignee: a.assignee,
              priority: a.priority,
              milestoneId: a.milestone_id ?? null,
              requiresApproval: a.requires_approval,
              dependsOn: a.depends_on,
              skillId: a.skill ?? null,
              createdBy: 'director',
            });
            const waiting = this.store.unmetDependencies(t.id);
            return ok(
              waiting.length
                ? `Created ${t.id} for ${AGENTS[t.assignee].name}. It will start automatically once ${waiting.map((w) => w.id).join(', ')} are done.`
                : `Created ${t.id} for ${AGENTS[t.assignee].name}. It will start automatically.`,
            );
          } catch (e) {
            return fail(errorMessage(e));
          }
        },
      ),
      tool(
        'add_milestone',
        'Add a project milestone.',
        { title: z.string().min(2), description: z.string().default(''), due_date: z.string().optional().describe('YYYY-MM-DD') },
        async (a) => {
          const m = this.store.createMilestone({ projectId, title: a.title, description: a.description, dueDate: a.due_date ?? null });
          this.hub.broadcast({ kind: 'milestone_updated', milestone: m }, projectId);
          return ok(`Created milestone ${m.id}: ${m.title}`);
        },
      ),
      tool(
        'request_approval',
        'Ask the studio owner (human) to approve an important decision. The owner answers asynchronously in the approval queue.',
        { title: z.string().min(3).max(140), details: z.string().min(10).describe('Context, options considered and your recommendation') },
        async (a) => {
          const ap = this.requestApproval({ projectId, title: a.title, details: a.details, requestedBy: 'director' });
          return ok(`Approval ${ap.id} sent to the owner. You will be told the decision in a later message.`);
        },
      ),
      tool('cancel_task', 'Cancel a task that is no longer needed.', { task_id: z.string(), reason: z.string() }, async (a) => {
        try {
          const t = this.store.getTask(a.task_id);
          if (t.projectId !== projectId) return fail('Task belongs to another project');
          this.cancelTask(a.task_id, a.reason);
          return ok(`Cancelled ${a.task_id}`);
        } catch (e) {
          return fail(errorMessage(e));
        }
      }),
    ];
    if (review) {
      tools.push(
        tool(
          'review_task',
          'Record your review decision for the deliverable under review.',
          {
            task_id: z.string(),
            decision: z.enum(['approve', 'revise']),
            feedback: z.string().describe('Short verdict when approving; specific actionable changes when revising'),
          },
          async (a) => {
            if (a.task_id !== review.taskId) return fail(`You are reviewing ${review.taskId}, not ${a.task_id}`);
            review.out.decision = { decision: a.decision, feedback: a.feedback };
            return ok(`Recorded: ${a.decision}`);
          },
        ) as unknown as (typeof tools)[number],
      );
    }
    return createSdkMcpServer({ name: 'studio', version: '1.0.0', tools });
  }

  /** User → Director conversation. */
  async chat(projectId: string, content: string) {
    this.store.getProject(projectId);
    const msg = this.store.addChat({ projectId, role: 'user', agentId: null, content });
    this.hub.broadcast({ kind: 'chat_message', message: msg }, projectId);
    if (!this.live) {
      const sys = this.store.addChat({
        projectId,
        role: 'system',
        agentId: null,
        content: `The AI team is offline: ${config.aiReason} Your message was saved. You can still create tasks manually on the task board; they will run once AI is enabled.`,
      });
      this.hub.broadcast({ kind: 'chat_message', message: sys }, projectId);
      return msg;
    }
    void this.directorTurn(projectId, content, true);
    return msg;
  }

  private directorTurn(projectId: string, prompt: string, fromUser: boolean) {
    return this.director.run(async () => {
      const project = this.store.getProject(projectId);
      this.hub.broadcast({ kind: 'director_typing', projectId, typing: true }, projectId);
      this.hub.emit('agent_working', {
        projectId,
        agentId: 'director',
        message: fromUser ? 'Reading your instructions' : 'Considering the owner decision',
        status: 'reading',
      });
      try {
        const know = this.prepareKnowledge({
          agentId: 'director',
          projectId,
          taskText: prompt,
          projectText: `${project.genre}\n${project.brief}`,
          defaultSkillId: 'plan-project',
        });
        const run = (resume: string | null) =>
          this.tracked('planning', {
            agentId: 'director',
            projectId,
            taskId: null,
            prompt,
            systemPrompt: directorSystemPrompt(project, this.store.listMilestones(projectId), this.skillCatalogText()),
            resume,
            mcpServers: { studio: this.studioServer(projectId) },
            mcpTools: STUDIO_TOOL_NAMES,
            effort: 'high',
          }, know);
        const session = this.store.getDirectorSession(projectId);
        let res = await run(session);
        if (!res.ok && session && !res.aborted) {
          log.warn('Director resume failed, starting a fresh session:', res.error);
          res = await run(null);
        }
        if (res.sessionId) this.store.setDirectorSession(projectId, res.sessionId);
        const reply = res.ok
          ? res.text || '(The Director finished without a message.)'
          : `I ran into a problem: ${res.error}`;
        const m = this.store.addChat({ projectId, role: res.ok ? 'director' : 'system', agentId: res.ok ? 'director' : null, content: reply });
        this.hub.broadcast({ kind: 'chat_message', message: m }, projectId);
        if (!res.ok)
          this.hub.emit('task_failed', { projectId, agentId: 'director', message: `Director error: ${truncate(res.error, 140)}`, data: { error: res.error } });
      } finally {
        this.hub.broadcast({ kind: 'director_typing', projectId, typing: false }, projectId);
        const st = this.hub.current('director');
        if (st && st.status !== 'error') this.hub.emit('agent_idle', { projectId, agentId: 'director', message: 'Ada is available' });
      }
    });
  }

  private enqueueReview(taskId: string) {
    if (!this.live) return;
    void this.director.run(async () => {
      const task = this.store.findTask(taskId);
      if (!task || task.status !== 'in_review') return;
      const project = this.store.getProject(task.projectId);
      this.hub.emit('agent_working', {
        projectId: task.projectId,
        agentId: 'director',
        taskId,
        message: `Reviewing "${task.title}" by ${AGENTS[task.assignee].name}`,
        status: 'reading',
      });
      const out: { decision?: ReviewDecision } = {};
      const know = this.prepareKnowledge({
        agentId: 'director',
        projectId: task.projectId,
        taskText: `Review ${AGENTS[task.assignee].title} deliverable: ${task.title}\n${task.description}`,
        projectText: `${project.genre}\n${project.brief}`,
        defaultSkillId: 'review-deliverable',
      });
      const res = await this.tracked('review', {
        agentId: 'director',
        projectId: task.projectId,
        taskId,
        prompt: directorReviewPrompt(task, task.result, task.files, this.latestCitationCheck(taskId)),
        systemPrompt: directorSystemPrompt(project, this.store.listMilestones(task.projectId), this.skillCatalogText()),
        mcpServers: { studio: this.studioServer(task.projectId, { taskId, out }) },
        mcpTools: [...STUDIO_TOOL_NAMES, REVIEW_TOOL],
        effort: 'medium',
        thinkingStatus: 'reading',
      }, know);
      const fresh = this.store.findTask(taskId);
      if (!fresh || fresh.status !== 'in_review') return;
      this.pushTask(this.store.updateTask(taskId, { costUsd: this.costOf(fresh) }));

      if (!res.ok && !out.decision) {
        // Review infrastructure failed: don't block the pipeline on it; escalate to the owner instead.
        this.review({
          projectId: fresh.projectId,
          taskId,
          reviewer: 'director',
          decision: 'escalated',
          feedback: `Director review failed: ${res.error}`,
          revision: fresh.revisionCount,
          runId: res.runId,
          approvalId: null,
        });
        this.finalizeWithOwner(taskId, `The Director could not complete the review (${truncate(res.error, 200)}). Please check the deliverable.`);
        return;
      }
      let decision = out.decision ?? { decision: 'approve' as const, feedback: truncate(res.text, 500) || 'Approved.' };
      // Server-side enforcement: an approval cannot stand while the automatic citation check fails.
      const cite = this.latestCitationCheck(taskId);
      if (decision.decision === 'approve' && cite && (cite.status === 'missing' || cite.status === 'invalid'))
        decision = {
          decision: 'revise',
          feedback: `${decision.feedback}\n\nCitation check failed (automatic, enforced by the studio): ${cite.summary} Cite every reference you relied on as [K:<ref>] using the exact ref ids you were given, remove invalid citations, or state [K:none] if you relied on none.`,
        };
      this.review({
        projectId: fresh.projectId,
        taskId,
        reviewer: 'director',
        decision: decision.decision,
        feedback: decision.feedback,
        revision: fresh.revisionCount,
        runId: res.runId,
        approvalId: null,
      });
      const msg = this.store.addChat({
        projectId: task.projectId,
        role: 'director',
        agentId: 'director',
        content: `**Review of "${task.title}"** — ${decision.decision === 'approve' ? '✅ approved' : '🔁 revision requested'}\n\n${decision.feedback}`,
      });
      this.hub.broadcast({ kind: 'chat_message', message: msg }, task.projectId);

      if (decision.decision === 'approve') {
        this.finalize(taskId, decision.feedback);
      } else if (fresh.revisionCount >= config.maxRevisions) {
        this.finalizeWithOwner(
          taskId,
          `After ${fresh.revisionCount} revisions the Director still requests changes:\n\n${decision.feedback}\n\nApprove to accept as-is, or reject with guidance for another revision.`,
        );
      } else {
        this.sendBack(taskId, decision.feedback, 'Ada (Director)');
      }
      this.hub.emit('agent_idle', { projectId: task.projectId, agentId: 'director', message: 'Review finished' });
    });
  }

  /** Escalate a deliverable to the owner regardless of requiresApproval. */
  private finalizeWithOwner(taskId: string, details: string) {
    const t = this.store.getTask(taskId);
    const approval = this.store.createApproval({ projectId: t.projectId, taskId, title: `Decision needed: ${t.title}`, details, requestedBy: 'director' });
    this.pushTask(this.store.updateTask(taskId, { status: 'awaiting_approval' }));
    this.hub.broadcast({ kind: 'approval_updated', approval }, t.projectId);
    this.hub.emit('approval_required', {
      projectId: t.projectId,
      agentId: t.assignee,
      taskId,
      message: `"${t.title}" needs your decision`,
      data: { approvalId: approval.id },
    });
  }

  runningTasks() {
    return [...this.running.entries()].map(([taskId, r]) => ({ taskId, agentId: r.agentId }));
  }
}
