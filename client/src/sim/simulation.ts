import type {
  AgentEventType,
  AgentId,
  AgentStatus,
  Approval,
  ChatMessage,
  Project,
  ServerMessage,
  Task,
  TaskPriority,
} from '@pixel/shared';
import { AGENTS, EVENT_ANIMATION, WORKER_IDS } from '@pixel/shared';

/**
 * Offline demo: drives the office with SIMULATED agent activity through the exact same
 * ServerMessage protocol the real backend uses. Nothing here produces real work or files —
 * every event is flagged `simulated: true` and the UI labels the whole session as a demo.
 * When the backend is reachable the app uses live Claude agents instead.
 */

const DEMO_PROJECT: Project = {
  id: 'demo',
  name: 'Neon Drift (demo)',
  genre: 'Arcade racer',
  brief:
    'Simulated demo project. Start the backend (npm run dev) with an ANTHROPIC_API_KEY to run real AI agents that write real files.',
  repoUrl: '',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SCRIPT: { assignee: AgentId; title: string; steps: string[]; files: string[]; approval?: boolean }[] = [
  { assignee: 'designer', title: 'Draft the GDD core loop', steps: ['Reading docs/BRIEF.md', 'Outlining core loop', 'Writing docs/GDD.md'], files: ['docs/GDD.md'] },
  { assignee: 'artist', title: 'Visual style guide + palette', steps: ['Reading docs/GDD.md', 'Picking neon palette', 'Writing assets/palette.json', 'Drawing assets/concepts/car.svg'], files: ['assets/palette.json', 'assets/concepts/car.svg', 'docs/art/STYLE_GUIDE.md'], approval: true },
  { assignee: 'producer', title: 'Roadmap for the vertical slice', steps: ['Reading task list', 'Writing docs/production/ROADMAP.md'], files: ['docs/production/ROADMAP.md'] },
  { assignee: 'programmer', title: 'Prototype car controller', steps: ['Reading docs/GDD.md', 'Writing index.html', 'Writing src/main.js', 'Writing src/game/car.js'], files: ['index.html', 'src/main.js', 'src/game/car.js'] },
  { assignee: 'qa', title: 'Test plan for the prototype', steps: ['Reading src/game/car.js', 'Writing qa/TEST_PLAN.md', 'Filing qa/bugs/BUG-001-drift-jitter.md'], files: ['qa/TEST_PLAN.md', 'qa/bugs/BUG-001-drift-jitter.md'] },
  { assignee: 'designer', title: 'Track & level progression', steps: ['Reading docs/GDD.md', 'Writing design/levels.md'], files: ['design/levels.md'] },
];

type Emit = (msg: ServerMessage) => void;

export class Simulation {
  private timers: number[] = [];
  private tasks: Task[] = [];
  private approvals: Approval[] = [];
  private seq = 0;
  private scriptIdx = 0;
  private stopped = false;

  constructor(private emit: Emit) {}

  get project() {
    return DEMO_PROJECT;
  }

  start() {
    this.stopped = false;
    this.chat('director', 'director', 'Hi! This is a **simulated demo** — the backend is not reachable, so no real AI is running. Watch the office to see how agent events map to animations. Start the server to work with the real team.');
    this.after(2500, () => this.nextScriptTask());
  }

  stop() {
    this.stopped = true;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private after(ms: number, fn: () => void) {
    if (this.stopped) return;
    this.timers.push(window.setTimeout(() => !this.stopped && fn(), ms));
  }

  private id(p: string) {
    return `${p}_sim${++this.seq}`;
  }

  private event(type: AgentEventType, agentId: AgentId | null, taskId: string | null, message: string, status?: AgentStatus, data: Record<string, unknown> = {}) {
    this.emit({
      kind: 'event',
      event: {
        id: this.id('evt'),
        type,
        projectId: DEMO_PROJECT.id,
        agentId,
        taskId,
        message,
        data: { ...data, ...(status ? { status } : {}) },
        createdAt: new Date().toISOString(),
        simulated: true,
      },
    });
    if (agentId) {
      const st = status ?? EVENT_ANIMATION[type].status;
      this.state(agentId, st, message, type === 'agent_idle' ? null : taskId);
      const revert = EVENT_ANIMATION[type].revertAfterMs;
      if (revert) this.after(revert, () => this.state(agentId, 'idle', '', null));
    }
  }

  private state(agentId: AgentId, status: AgentStatus, activity: string, taskId: string | null) {
    this.emit({
      kind: 'agent_state',
      state: { agentId, status, activity, currentTaskId: taskId, projectId: DEMO_PROJECT.id, updatedAt: new Date().toISOString() },
    });
  }

  private chat(role: ChatMessage['role'], agentId: AgentId | null, content: string) {
    this.emit({
      kind: 'chat_message',
      message: { id: this.id('msg'), projectId: DEMO_PROJECT.id, role, agentId, content, createdAt: new Date().toISOString() },
    });
  }

  private putTask(t: Task) {
    const i = this.tasks.findIndex((x) => x.id === t.id);
    if (i === -1) this.tasks.push(t);
    else this.tasks[i] = t;
    this.emit({ kind: 'task_updated', task: t });
  }

  private patch(id: string, p: Partial<Task>) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return null;
    const n = { ...t, ...p, updatedAt: new Date().toISOString() };
    this.putTask(n);
    return n;
  }

  private nextScriptTask() {
    const item = SCRIPT[this.scriptIdx++ % SCRIPT.length];
    this.createTask(item.title, `Simulated task for the demo.`, item.assignee, 'medium', 'director', item.approval ?? false, item.steps, item.files);
    this.after(9000 + Math.random() * 6000, () => this.nextScriptTask());
  }

  /** Also used when the user adds a task on the board in demo mode. */
  createTask(
    title: string,
    description: string,
    assignee: AgentId,
    priority: TaskPriority,
    createdBy: AgentId | 'user',
    requiresApproval = false,
    steps = ['Reading the brief', 'Working on it'],
    files: string[] = [],
  ) {
    if (assignee === 'director') assignee = WORKER_IDS[0];
    const now = new Date().toISOString();
    const task: Task = {
      id: this.id('task'),
      projectId: DEMO_PROJECT.id,
      milestoneId: null,
      title,
      description,
      assignee,
      status: 'queued',
      priority,
      requiresApproval,
      revisionCount: 0,
      feedback: '',
      result: '',
      files: [],
      error: '',
      costUsd: 0,
      dependsOn: [],
      createdBy,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    };
    this.putTask(task);
    this.event('task_created', createdBy === 'user' ? null : createdBy, task.id, `${createdBy === 'user' ? 'You' : AGENTS[createdBy].name} created "${title}"`, createdBy === 'director' ? 'meeting' : undefined);
    this.event('task_assigned', assignee, task.id, `${AGENTS[assignee].name} was assigned "${title}"`);
    this.after(4000, () => this.runTask(task.id, steps, files));
    return task;
  }

  private runTask(id: string, steps: string[], files: string[]) {
    const t = this.patch(id, { status: 'in_progress', startedAt: new Date().toISOString() });
    if (!t) return;
    this.event('task_started', t.assignee, id, `${AGENTS[t.assignee].name} started "${t.title}"`);
    let delay = 2500;
    steps.forEach((step) => {
      this.after(delay, () => this.event('agent_working', t.assignee, id, step, /^Reading|Searching/.test(step) ? 'reading' : 'working'));
      delay += 2500 + Math.random() * 2000;
    });
    files.forEach((f) => {
      this.after(delay, () => this.event('file_created', t.assignee, id, `Created ${f} (simulated)`, undefined, { path: f }));
      delay += 1200;
    });
    this.after(delay, () => {
      this.patch(id, { status: 'in_review', files, result: '(simulated report)' });
      this.event('agent_idle', t.assignee, id, `${AGENTS[t.assignee].name} handed "${t.title}" to the Director`);
      this.event('agent_working', 'director', id, `Reviewing "${t.title}"`, 'reading');
    });
    this.after(delay + 4500, () => {
      this.event('agent_idle', 'director', null, 'Review finished');
      const cur = this.tasks.find((x) => x.id === id);
      if (!cur || cur.status !== 'in_review') return;
      if (cur.requiresApproval) {
        const ap: Approval = {
          id: this.id('apr'),
          projectId: DEMO_PROJECT.id,
          taskId: id,
          title: `Sign off: ${cur.title}`,
          details: 'Simulated approval request. Approve or reject to see the NPC react.',
          requestedBy: 'director',
          status: 'pending',
          response: '',
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        };
        this.approvals.push(ap);
        this.emit({ kind: 'approval_updated', approval: ap });
        this.patch(id, { status: 'awaiting_approval' });
        this.event('approval_required', cur.assignee, id, `"${cur.title}" needs your sign-off`);
      } else {
        this.complete(id);
      }
    });
  }

  private complete(id: string) {
    const t = this.patch(id, { status: 'done', completedAt: new Date().toISOString() });
    if (t) this.event('task_completed', t.assignee, id, `${AGENTS[t.assignee].name} completed "${t.title}"`);
  }

  resolveApproval(id: string, decision: 'approved' | 'rejected', response: string) {
    const ap = this.approvals.find((a) => a.id === id);
    if (!ap || ap.status !== 'pending') return;
    const n: Approval = { ...ap, status: decision, response, resolvedAt: new Date().toISOString() };
    this.approvals = this.approvals.map((a) => (a.id === id ? n : a));
    this.emit({ kind: 'approval_updated', approval: n });
    if (!ap.taskId) return;
    if (decision === 'approved') this.complete(ap.taskId);
    else {
      const t = this.patch(ap.taskId, { status: 'revision', revisionCount: 1, feedback: response });
      if (t) {
        this.event('task_assigned', t.assignee, t.id, `The owner requested a revision of "${t.title}"`);
        this.after(4000, () => this.runTask(t.id, ['Applying feedback'], t.files));
      }
    }
  }

  cancelTask(id: string) {
    this.patch(id, { status: 'cancelled' });
  }

  userChat(content: string) {
    this.chat('user', null, content);
    this.emit({ kind: 'director_typing', projectId: DEMO_PROJECT.id, typing: true });
    this.event('agent_working', 'director', null, 'Reading your instructions', 'reading');
    this.after(2200, () => {
      this.emit({ kind: 'director_typing', projectId: DEMO_PROJECT.id, typing: false });
      this.chat(
        'director',
        'director',
        `(Simulated) I'd plan this with the team — but I'm not connected to the backend, so no real agent will act on "${content.slice(0, 80)}". Run \`npm run dev\` with ANTHROPIC_API_KEY set to work with the real studio.`,
      );
      this.event('agent_idle', 'director', null, 'Ada is available');
    });
  }
}
