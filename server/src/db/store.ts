import type {
  AgentEvent,
  AgentId,
  AgentRun,
  AgentRunKind,
  CostStatus,
  TaskReview,
  ToolCallRecord,
  UsageSummary,
  AgentState,
  Approval,
  ChatMessage,
  Milestone,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
} from '@pixel/shared';
import { AGENT_IDS } from '@pixel/shared';
import type { Db } from './db.js';
import { HttpError, newId, nowIso } from '../util.js';

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const sn = (v: unknown) => (v === null || v === undefined ? null : String(v));

const toProject = (r: Row): Project => ({
  id: s(r.id),
  name: s(r.name),
  genre: s(r.genre),
  brief: s(r.brief),
  repoUrl: s(r.repo_url),
  status: s(r.status) as Project['status'],
  createdAt: s(r.created_at),
  updatedAt: s(r.updated_at),
});

const toMilestone = (r: Row): Milestone => ({
  id: s(r.id),
  projectId: s(r.project_id),
  title: s(r.title),
  description: s(r.description),
  dueDate: sn(r.due_date),
  status: s(r.status) as Milestone['status'],
  order: Number(r.order_idx),
});

const toTask = (r: Row): Task => ({
  id: s(r.id),
  projectId: s(r.project_id),
  milestoneId: sn(r.milestone_id),
  title: s(r.title),
  description: s(r.description),
  assignee: s(r.assignee) as AgentId,
  status: s(r.status) as TaskStatus,
  priority: s(r.priority) as TaskPriority,
  requiresApproval: Number(r.requires_approval) === 1,
  revisionCount: Number(r.revision_count),
  feedback: s(r.feedback),
  result: s(r.result),
  files: JSON.parse(s(r.files) || '[]') as string[],
  error: s(r.error),
  costUsd: Number(r.cost_usd),
  dependsOn: s(r.deps) ? s(r.deps).split(',') : [],
  createdBy: s(r.created_by) as Task['createdBy'],
  createdAt: s(r.created_at),
  updatedAt: s(r.updated_at),
  startedAt: sn(r.started_at),
  completedAt: sn(r.completed_at),
});

const toApproval = (r: Row): Approval => ({
  id: s(r.id),
  projectId: s(r.project_id),
  taskId: sn(r.task_id),
  title: s(r.title),
  details: s(r.details),
  requestedBy: s(r.requested_by) as AgentId,
  status: s(r.status) as Approval['status'],
  response: s(r.response),
  createdAt: s(r.created_at),
  resolvedAt: sn(r.resolved_at),
});

const toChat = (r: Row): ChatMessage => ({
  id: s(r.id),
  projectId: s(r.project_id),
  role: s(r.role) as ChatMessage['role'],
  agentId: sn(r.agent_id) as AgentId | null,
  content: s(r.content),
  createdAt: s(r.created_at),
});

const toEvent = (r: Row): AgentEvent => ({
  id: s(r.id),
  type: s(r.type) as AgentEvent['type'],
  projectId: sn(r.project_id),
  agentId: sn(r.agent_id) as AgentId | null,
  taskId: sn(r.task_id),
  message: s(r.message),
  data: JSON.parse(s(r.data) || '{}'),
  createdAt: s(r.created_at),
});

const toAgentState = (r: Row): AgentState => ({
  agentId: s(r.agent_id) as AgentId,
  status: s(r.status) as AgentState['status'],
  currentTaskId: sn(r.current_task_id),
  projectId: sn(r.project_id),
  activity: s(r.activity),
  updatedAt: s(r.updated_at),
});

const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const toRun = (r: Row): AgentRun => ({
  id: s(r.id),
  projectId: s(r.project_id),
  taskId: sn(r.task_id),
  agentId: s(r.agent_id) as AgentId,
  kind: s(r.kind) as AgentRunKind,
  sessionId: sn(r.session_id),
  status: s(r.status) as AgentRun['status'],
  costUsd: nn(r.cost_usd),
  reportedCostUsd: nn(r.reported_cost_usd),
  costStatus: s(r.cost_status) as CostStatus,
  inputTokens: nn(r.input_tokens),
  outputTokens: nn(r.output_tokens),
  cacheReadTokens: nn(r.cache_read_tokens),
  cacheCreationTokens: nn(r.cache_creation_tokens),
  numTurns: nn(r.num_turns),
  durationMs: nn(r.duration_ms),
  model: sn(r.model),
  error: s(r.error),
  startedAt: s(r.started_at),
  finishedAt: sn(r.finished_at),
});

const toReview = (r: Row): TaskReview => ({
  id: s(r.id),
  projectId: s(r.project_id),
  taskId: s(r.task_id),
  reviewer: s(r.reviewer) as TaskReview['reviewer'],
  decision: s(r.decision) as TaskReview['decision'],
  feedback: s(r.feedback),
  revision: nn(r.revision),
  runId: sn(r.run_id),
  approvalId: sn(r.approval_id),
  createdAt: s(r.created_at),
});

export interface RunOutcome {
  sessionId: string | null;
  status: Exclude<AgentRun['status'], 'running'>;
  /** null when the SDK did not report a cost for this run. */
  costUsd: number | null;
  /** Raw SDK total_cost_usd (cumulative for a resumed session). */
  reportedCostUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  numTurns?: number | null;
  durationMs?: number | null;
  model?: string | null;
  error?: string;
}

const DEPS = (alias: string) =>
  `(SELECT group_concat(d.depends_on, ',') FROM task_dependencies d WHERE d.task_id = ${alias}.id) AS deps`;
const TASK_COLS = `tasks.*, ${DEPS('tasks')}`;
const TASK_COLS_T = `t.*, ${DEPS('t')}`;

const toToolCall = (r: Row): ToolCallRecord => ({
  id: s(r.id),
  runId: sn(r.run_id),
  projectId: s(r.project_id),
  taskId: sn(r.task_id),
  agentId: s(r.agent_id) as AgentId,
  toolUseId: sn(r.tool_use_id),
  tool: s(r.tool),
  path: sn(r.path),
  detail: s(r.detail),
  decision: s(r.decision) as ToolCallRecord['decision'],
  reason: s(r.reason),
  outcome: sn(r.outcome) as ToolCallRecord['outcome'],
  createdAt: s(r.created_at),
});

const PRIORITY_ORDER = `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

export interface NewTask {
  projectId: string;
  title: string;
  description: string;
  assignee: AgentId;
  priority?: TaskPriority;
  milestoneId?: string | null;
  requiresApproval?: boolean;
  dependsOn?: string[];
  createdBy: AgentId | 'user';
}

/** Typed persistence API over SQLite. All writes are synchronous and durable. */
export class Store {
  constructor(private db: Db) {
    const ins = db.prepare(
      `INSERT OR IGNORE INTO agent_state (agent_id, status, activity, updated_at) VALUES (?, 'idle', '', ?)`,
    );
    for (const id of AGENT_IDS) ins.run(id, nowIso());
  }

  // -- projects -------------------------------------------------------------
  listProjects(): Project[] {
    return (this.db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all() as Row[]).map(toProject);
  }
  getProject(id: string): Project {
    const r = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Project ${id} not found`);
    return toProject(r);
  }
  createProject(p: { name: string; genre: string; brief: string; repoUrl: string }): Project {
    const id = newId('prj');
    const t = nowIso();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, genre, brief, repo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, p.name, p.genre, p.brief, p.repoUrl, t, t);
    return this.getProject(id);
  }
  updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'genre' | 'brief' | 'repoUrl' | 'status'>>): Project {
    const cur = this.getProject(id);
    const n = { ...cur, ...patch };
    this.db
      .prepare(`UPDATE projects SET name=?, genre=?, brief=?, repo_url=?, status=?, updated_at=? WHERE id=?`)
      .run(n.name, n.genre, n.brief, n.repoUrl, n.status, nowIso(), id);
    return this.getProject(id);
  }
  deleteProject(id: string) {
    this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
    this.db.prepare(`DELETE FROM events WHERE project_id = ?`).run(id);
  }
  getDirectorSession(projectId: string): string | null {
    const r = this.db.prepare(`SELECT director_session_id FROM projects WHERE id = ?`).get(projectId) as Row | undefined;
    return sn(r?.director_session_id);
  }
  setDirectorSession(projectId: string, sessionId: string | null) {
    this.db.prepare(`UPDATE projects SET director_session_id = ? WHERE id = ?`).run(sessionId, projectId);
  }

  // -- milestones -----------------------------------------------------------
  listMilestones(projectId: string): Milestone[] {
    return (
      this.db.prepare(`SELECT * FROM milestones WHERE project_id = ? ORDER BY order_idx, rowid`).all(projectId) as Row[]
    ).map(toMilestone);
  }
  getMilestone(id: string): Milestone {
    const r = this.db.prepare(`SELECT * FROM milestones WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Milestone ${id} not found`);
    return toMilestone(r);
  }
  createMilestone(m: { projectId: string; title: string; description?: string; dueDate?: string | null }): Milestone {
    const id = newId('ms');
    const order = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM milestones WHERE project_id = ?`).get(m.projectId) as Row
    ).n as number;
    this.db
      .prepare(
        `INSERT INTO milestones (id, project_id, title, description, due_date, order_idx) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, m.projectId, m.title, m.description ?? '', m.dueDate ?? null, order);
    return this.getMilestone(id);
  }
  updateMilestone(id: string, patch: Partial<Pick<Milestone, 'title' | 'description' | 'dueDate' | 'status'>>) {
    const n = { ...this.getMilestone(id), ...patch };
    this.db
      .prepare(`UPDATE milestones SET title=?, description=?, due_date=?, status=? WHERE id=?`)
      .run(n.title, n.description, n.dueDate, n.status, id);
    return this.getMilestone(id);
  }
  deleteMilestone(id: string) {
    this.db.prepare(`DELETE FROM milestones WHERE id = ?`).run(id);
  }

  // -- tasks ----------------------------------------------------------------
  listTasks(projectId: string): Task[] {
    return (
      this.db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE project_id = ? ORDER BY created_at`).all(projectId) as Row[]
    ).map(toTask);
  }
  tasksForAgent(agentId: AgentId, limit = 50): Task[] {
    return (
      this.db
        .prepare(`SELECT ${TASK_COLS} FROM tasks WHERE assignee = ? ORDER BY updated_at DESC LIMIT ?`)
        .all(agentId, limit) as Row[]
    ).map(toTask);
  }
  getTask(id: string): Task {
    const r = this.db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Task ${id} not found`);
    return toTask(r);
  }
  findTask(id: string): Task | null {
    const r = this.db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`).get(id) as Row | undefined;
    return r ? toTask(r) : null;
  }
  createTask(t: NewTask): Task {
    const id = newId('task');
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, milestone_id, title, description, assignee, priority, requires_approval, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        t.projectId,
        t.milestoneId ?? null,
        t.title,
        t.description,
        t.assignee,
        t.priority ?? 'medium',
        t.requiresApproval ? 1 : 0,
        t.createdBy,
        ts,
        ts,
      );
    const dep = this.db.prepare(`INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)`);
    for (const d of t.dependsOn ?? []) dep.run(id, d);
    return this.getTask(id);
  }
  updateTask(
    id: string,
    patch: Partial<
      Pick<
        Task,
        | 'title'
        | 'description'
        | 'assignee'
        | 'status'
        | 'priority'
        | 'requiresApproval'
        | 'revisionCount'
        | 'feedback'
        | 'result'
        | 'files'
        | 'error'
        | 'costUsd'
        | 'startedAt'
        | 'completedAt'
        | 'milestoneId'
      >
    >,
  ): Task {
    const n = { ...this.getTask(id), ...patch };
    this.db
      .prepare(
        `UPDATE tasks SET title=?, description=?, assignee=?, status=?, priority=?, requires_approval=?, revision_count=?,
           feedback=?, result=?, files=?, error=?, cost_usd=?, started_at=?, completed_at=?, milestone_id=?, updated_at=? WHERE id=?`,
      )
      .run(
        n.title,
        n.description,
        n.assignee,
        n.status,
        n.priority,
        n.requiresApproval ? 1 : 0,
        n.revisionCount,
        n.feedback,
        n.result,
        JSON.stringify(n.files),
        n.error,
        n.costUsd,
        n.startedAt,
        n.completedAt,
        n.milestoneId,
        nowIso(),
        id,
      );
    return this.getTask(id);
  }
  deleteTask(id: string) {
    this.db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  }
  getTaskSession(id: string): string | null {
    return sn((this.db.prepare(`SELECT session_id FROM tasks WHERE id = ?`).get(id) as Row | undefined)?.session_id);
  }
  setTaskSession(id: string, sessionId: string | null) {
    this.db.prepare(`UPDATE tasks SET session_id = ? WHERE id = ?`).run(sessionId, id);
  }
  /** Next runnable task for an agent: queued or sent back for revision, highest priority first. */
  nextTaskFor(agentId: AgentId): Task | null {
    const r = this.db
      .prepare(
        `SELECT ${TASK_COLS_T} FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.assignee = ? AND t.status IN ('queued','revision') AND p.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM task_dependencies d JOIN tasks dt ON dt.id = d.depends_on
                           WHERE d.task_id = t.id AND dt.status != 'done')
         ORDER BY ${PRIORITY_ORDER}, t.created_at LIMIT 1`,
      )
      .get(agentId) as Row | undefined;
    return r ? toTask(r) : null;
  }
  tasksInStatus(status: TaskStatus): Task[] {
    return (this.db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE status = ? ORDER BY updated_at`).all(status) as Row[]).map(
      toTask,
    );
  }

  // -- approvals ------------------------------------------------------------
  listApprovals(projectId: string): Approval[] {
    return (
      this.db.prepare(`SELECT * FROM approvals WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Row[]
    ).map(toApproval);
  }
  getApproval(id: string): Approval {
    const r = this.db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Approval ${id} not found`);
    return toApproval(r);
  }
  createApproval(a: { projectId: string; taskId: string | null; title: string; details: string; requestedBy: AgentId }) {
    const id = newId('apr');
    this.db
      .prepare(
        `INSERT INTO approvals (id, project_id, task_id, title, details, requested_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, a.projectId, a.taskId, a.title, a.details, a.requestedBy, nowIso());
    return this.getApproval(id);
  }
  resolveApproval(id: string, status: 'approved' | 'rejected', response: string): Approval {
    this.db
      .prepare(`UPDATE approvals SET status=?, response=?, resolved_at=? WHERE id=? AND status='pending'`)
      .run(status, response, nowIso(), id);
    return this.getApproval(id);
  }
  pendingApprovalForTask(taskId: string): Approval | null {
    const r = this.db
      .prepare(`SELECT * FROM approvals WHERE task_id = ? AND status = 'pending' LIMIT 1`)
      .get(taskId) as Row | undefined;
    return r ? toApproval(r) : null;
  }

  // -- chat -----------------------------------------------------------------
  listChat(projectId: string, limit = 200): ChatMessage[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM (SELECT *, rowid AS rid FROM chat_messages WHERE project_id = ? ORDER BY created_at DESC, rid DESC LIMIT ?) ORDER BY created_at, rid`,
        )
        .all(projectId, limit) as Row[]
    ).map(toChat);
  }
  addChat(m: { projectId: string; role: ChatMessage['role']; agentId: AgentId | null; content: string }): ChatMessage {
    const id = newId('msg');
    this.db
      .prepare(`INSERT INTO chat_messages (id, project_id, role, agent_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, m.projectId, m.role, m.agentId, m.content, nowIso());
    return toChat(this.db.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(id) as Row);
  }

  // -- events ---------------------------------------------------------------
  addEvent(e: AgentEvent) {
    this.db
      .prepare(
        `INSERT INTO events (id, project_id, agent_id, task_id, type, message, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.id, e.projectId, e.agentId, e.taskId, e.type, e.message, JSON.stringify(e.data), e.createdAt);
  }
  listEvents(opts: { projectId?: string; agentId?: AgentId; limit?: number }): AgentEvent[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.projectId) (where.push('project_id = ?'), args.push(opts.projectId));
    if (opts.agentId) (where.push('agent_id = ?'), args.push(opts.agentId));
    args.push(opts.limit ?? 200);
    const sql = `SELECT * FROM (SELECT *, rowid AS rid FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC, rid DESC LIMIT ?) ORDER BY created_at, rid`;
    return (this.db.prepare(sql).all(...args) as Row[]).map(toEvent);
  }

  // -- agent runs (sessions + usage) ----------------------------------------
  /** Record a run as soon as it starts, so its session survives a crash mid-run. */
  startRun(r: { projectId: string; taskId: string | null; agentId: AgentId; kind: AgentRunKind }): AgentRun {
    const id = newId('run');
    this.db
      .prepare(`INSERT INTO agent_runs (id, project_id, task_id, agent_id, kind, started_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, r.projectId, r.taskId, r.agentId, r.kind, nowIso());
    return this.getRun(id);
  }
  setRunSession(id: string, sessionId: string) {
    this.db.prepare(`UPDATE agent_runs SET session_id = ? WHERE id = ?`).run(sessionId, id);
  }
  finishRun(id: string, o: RunOutcome): AgentRun {
    const cur = this.getRun(id);
    this.db
      .prepare(
        `UPDATE agent_runs SET session_id=?, status=?, cost_usd=?, reported_cost_usd=?, cost_status=?, input_tokens=?, output_tokens=?,
           cache_read_tokens=?, cache_creation_tokens=?, num_turns=?, duration_ms=?, model=?, error=?, finished_at=? WHERE id=?`,
      )
      .run(
        o.sessionId ?? cur.sessionId,
        o.status,
        o.costUsd,
        o.reportedCostUsd ?? o.costUsd,
        o.costUsd === null ? 'unavailable' : 'actual',
        o.inputTokens ?? null,
        o.outputTokens ?? null,
        o.cacheReadTokens ?? null,
        o.cacheCreationTokens ?? null,
        o.numTurns ?? null,
        o.durationMs ?? null,
        o.model ?? null,
        o.error ?? '',
        nowIso(),
        id,
      );
    return this.getRun(id);
  }
  /** Highest cumulative cost the SDK has reported for a session in earlier runs. */
  priorReportedSessionCost(sessionId: string, excludeRunId: string): number {
    const r = this.db
      .prepare(
        `SELECT MAX(reported_cost_usd) AS c FROM agent_runs
         WHERE session_id = ? AND id != ? AND cost_status = 'actual' AND reported_cost_usd IS NOT NULL`,
      )
      .get(sessionId, excludeRunId) as Row;
    return r.c === null || r.c === undefined ? 0 : Number(r.c);
  }

  /** Runs that were in flight when the server stopped: their cost was never reported. */
  interruptRunningRuns(): number {
    const r = this.db
      .prepare(
        `UPDATE agent_runs SET status='interrupted', cost_status='unavailable', cost_usd=NULL,
           error='Server stopped before the run finished', finished_at=? WHERE status='running'`,
      )
      .run(nowIso());
    return Number(r.changes);
  }
  getRun(id: string): AgentRun {
    const r = this.db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Run ${id} not found`);
    return toRun(r);
  }
  listRuns(f: { projectId?: string; taskId?: string }): AgentRun[] {
    const where: string[] = [];
    const args: string[] = [];
    if (f.projectId) (where.push('project_id = ?'), args.push(f.projectId));
    if (f.taskId) (where.push('task_id = ?'), args.push(f.taskId));
    return (
      this.db
        .prepare(`SELECT * FROM agent_runs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY started_at, rowid`)
        .all(...args) as Row[]
    ).map(toRun);
  }
  /** Known spend for a task: its own runs and the Director's reviews of it. */
  taskKnownCost(taskId: string): number {
    const r = this.db
      .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS c FROM agent_runs WHERE task_id = ? AND cost_usd IS NOT NULL`)
      .get(taskId) as Row;
    return Number(r.c);
  }
  usageSummary(projectId: string): UsageSummary {
    const runs = this.listRuns({ projectId });
    const out: UsageSummary = {
      knownCostUsd: 0,
      byKind: { planning: 0, task: 0, review: 0, legacy: 0 },
      byStatus: {
        actual: { runs: 0, costUsd: 0 },
        unavailable: { runs: 0, costUsd: 0 },
        legacy_aggregate: { runs: 0, costUsd: 0 },
      },
      runs: runs.length,
      runningRuns: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    };
    for (const r of runs) {
      if (r.status === 'running') {
        out.runningRuns++;
        continue;
      }
      const cost = r.costUsd ?? 0;
      out.byStatus[r.costStatus].runs++;
      out.byStatus[r.costStatus].costUsd += cost;
      out.byKind[r.kind] += cost;
      out.knownCostUsd += cost;
      out.tokens.input += r.inputTokens ?? 0;
      out.tokens.output += r.outputTokens ?? 0;
      out.tokens.cacheRead += r.cacheReadTokens ?? 0;
      out.tokens.cacheCreation += r.cacheCreationTokens ?? 0;
    }
    return out;
  }

  /** Tasks this task waits on that are not done yet. */
  unmetDependencies(taskId: string): Task[] {
    return (
      this.db
        .prepare(
          `SELECT ${TASK_COLS} FROM tasks JOIN task_dependencies d ON d.depends_on = tasks.id
           WHERE d.task_id = ? AND tasks.status != 'done'`,
        )
        .all(taskId) as Row[]
    ).map(toTask);
  }
  dependents(taskId: string): Task[] {
    return (
      this.db
        .prepare(`SELECT ${TASK_COLS} FROM tasks JOIN task_dependencies d ON d.task_id = tasks.id WHERE d.depends_on = ?`)
        .all(taskId) as Row[]
    ).map(toTask);
  }

  // -- tool-call audit log --------------------------------------------------
  addToolCall(c: Omit<ToolCallRecord, 'id' | 'createdAt' | 'outcome'>): ToolCallRecord {
    const id = newId('tc');
    this.db
      .prepare(
        `INSERT INTO tool_calls (id, run_id, project_id, task_id, agent_id, tool_use_id, tool, path, detail, decision, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, c.runId, c.projectId, c.taskId, c.agentId, c.toolUseId, c.tool, c.path, c.detail, c.decision, c.reason, nowIso());
    return toToolCall(this.db.prepare(`SELECT * FROM tool_calls WHERE id = ?`).get(id) as Row);
  }
  setToolOutcome(toolUseId: string, outcome: 'ok' | 'error') {
    this.db.prepare(`UPDATE tool_calls SET outcome = ? WHERE tool_use_id = ? AND decision = 'allow'`).run(outcome, toolUseId);
  }
  listToolCalls(f: { projectId?: string; runId?: string; taskId?: string; decision?: ToolCallRecord['decision'] }): ToolCallRecord[] {
    const where: string[] = [];
    const args: string[] = [];
    if (f.projectId) (where.push('project_id = ?'), args.push(f.projectId));
    if (f.runId) (where.push('run_id = ?'), args.push(f.runId));
    if (f.taskId) (where.push('task_id = ?'), args.push(f.taskId));
    if (f.decision) (where.push('decision = ?'), args.push(f.decision));
    return (
      this.db
        .prepare(`SELECT * FROM tool_calls ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, rowid`)
        .all(...args) as Row[]
    ).map(toToolCall);
  }

  // -- review history -------------------------------------------------------
  addReview(r: Omit<TaskReview, 'id' | 'createdAt'>): TaskReview {
    const id = newId('rev');
    this.db
      .prepare(
        `INSERT INTO task_reviews (id, project_id, task_id, reviewer, decision, feedback, revision, run_id, approval_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, r.projectId, r.taskId, r.reviewer, r.decision, r.feedback, r.revision, r.runId, r.approvalId, nowIso());
    return toReview(this.db.prepare(`SELECT * FROM task_reviews WHERE id = ?`).get(id) as Row);
  }
  listReviews(taskId: string): TaskReview[] {
    return (
      this.db.prepare(`SELECT * FROM task_reviews WHERE task_id = ? ORDER BY created_at, rowid`).all(taskId) as Row[]
    ).map(toReview);
  }

  // -- agent state ----------------------------------------------------------
  listAgentStates(): AgentState[] {
    return (this.db.prepare(`SELECT * FROM agent_state`).all() as Row[]).map(toAgentState);
  }
  setAgentState(st: Omit<AgentState, 'updatedAt'>): AgentState {
    const t = nowIso();
    this.db
      .prepare(
        `INSERT INTO agent_state (agent_id, status, current_task_id, project_id, activity, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET status=excluded.status, current_task_id=excluded.current_task_id,
           project_id=excluded.project_id, activity=excluded.activity, updated_at=excluded.updated_at`,
      )
      .run(st.agentId, st.status, st.currentTaskId, st.projectId, st.activity, t);
    return { ...st, updatedAt: t };
  }
}
