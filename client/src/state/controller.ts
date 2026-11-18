import type { AgentId, TaskPriority } from '@pixel/shared';
import { api, type NewTaskInput } from '../api/client';
import { StudioSocket } from '../api/socket';
import { Simulation } from '../sim/simulation';
import { useStudio } from './store';

const LAST_PROJECT_KEY = 'pixel-studio:last-project';
let socket: StudioSocket | null = null;
let sim: Simulation | null = null;
let statsTimer: number | undefined;

const S = () => useStudio.getState();

function store(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function report(e: unknown) {
  S().toast(e instanceof Error ? e.message : String(e), 'error');
}

/** Boot: connect to the backend, or fall back to the clearly-labelled offline simulation. */
let booted = false;
export async function boot() {
  if (booted) return; // React StrictMode runs effects twice in dev
  booted = true;
  await connect();
}

async function connect() {
  try {
    const info = await api.info();
    S().set({ info, mode: 'live' });
  } catch {
    startDemo();
    return;
  }
  socket = new StudioSocket(
    (msg) => {
      S().apply(msg);
      if (['task_updated', 'files_changed', 'approval_updated', 'usage_updated'].includes(msg.kind)) scheduleStats();
    },
    (connected) => {
      if (connected && S().projectId) void loadProject(S().projectId!); // resync after reconnects
      if (!connected && S().mode === 'live') S().toast('Lost connection to the studio server — reconnecting…', 'warn');
    },
  );
  socket.connect();
  const projects = await api.projects();
  S().set({ projects });
  const last = load(LAST_PROJECT_KEY);
  const pick = projects.find((p) => p.id === last) ?? projects[0];
  if (pick) await selectProject(pick.id);
}

function startDemo() {
  sim?.stop();
  S().set({ mode: 'demo', info: null });
  sim = new Simulation((msg) => S().apply(msg));
  S().set({ projects: [sim.project], projectId: sim.project.id, tasks: [], chat: [], events: [], approvals: [], milestones: [] });
  sim.start();
}

export async function retryConnection() {
  try {
    await api.info();
    sim?.stop();
    sim = null;
    S().set({ projects: [], projectId: null, tasks: [], chat: [], events: [], approvals: [] });
    await connect();
    S().toast('Connected to the studio server', 'success');
  } catch {
    S().toast('Server still unreachable. Run `npm run dev` in the repo.', 'warn');
  }
}

function scheduleStats() {
  window.clearTimeout(statsTimer);
  statsTimer = window.setTimeout(async () => {
    const id = S().projectId;
    if (!id || S().mode !== 'live') return;
    try {
      S().set({ stats: await api.stats(id) });
    } catch {
      /* ignore */
    }
  }, 600);
}

async function loadProject(id: string) {
  const [detail, chat, events] = await Promise.all([api.project(id), api.chat(id), api.events(id)]);
  if (S().projectId !== id) return;
  S().set({
    milestones: detail.milestones,
    tasks: detail.tasks,
    approvals: detail.approvals,
    stats: detail.stats,
    chat,
    events,
    filesVersion: S().filesVersion + 1,
  });
}

export async function selectProject(id: string | null) {
  if (S().mode === 'demo') return;
  S().set({ projectId: id, tasks: [], chat: [], events: [], approvals: [], milestones: [], stats: null, directorTyping: false });
  store(LAST_PROJECT_KEY, id);
  socket?.subscribe(id);
  if (id) await loadProject(id).catch(report);
}

export const actions = {
  async createProject(p: { name: string; genre: string; brief: string; repoUrl: string }) {
    if (S().mode === 'demo') return S().toast('Projects need the backend. Start the server first.', 'warn');
    const project = await api.createProject(p);
    S().set({ projects: [project, ...S().projects.filter((x) => x.id !== project.id)] });
    await selectProject(project.id);
    S().set({ tab: 'chat' });
  },
  async updateProject(id: string, patch: { name?: string; genre?: string; brief?: string; repoUrl?: string }) {
    if (S().mode === 'demo') return;
    await api.updateProject(id, patch).catch(report);
  },
  async sendChat(content: string) {
    const id = S().projectId;
    if (!id) return;
    if (S().mode === 'demo') return sim?.userChat(content);
    await api.sendChat(id, content).catch(report);
  },
  async createTask(t: NewTaskInput) {
    const id = S().projectId;
    if (!id) return;
    if (S().mode === 'demo') {
      sim?.createTask(t.title, t.description, t.assignee, t.priority as TaskPriority, 'user', t.requiresApproval);
      return;
    }
    await api.createTask(id, t).catch(report);
  },
  async taskAction(taskId: string, action: 'start' | 'cancel' | 'retry' | 'delete') {
    if (S().mode === 'demo') {
      if (action === 'cancel') sim?.cancelTask(taskId);
      return;
    }
    try {
      if (action === 'start') await api.startTask(taskId);
      if (action === 'cancel') await api.cancelTask(taskId);
      if (action === 'retry') await api.retryTask(taskId);
      if (action === 'delete') await api.deleteTask(taskId);
    } catch (e) {
      report(e);
    }
  },
  async reassign(taskId: string, assignee: AgentId) {
    if (S().mode === 'demo') return;
    await api.updateTask(taskId, { assignee }).catch(report);
  },
  async resolveApproval(id: string, decision: 'approved' | 'rejected', response: string) {
    if (S().mode === 'demo') return sim?.resolveApproval(id, decision, response);
    await api.resolveApproval(id, decision, response).catch(report);
  },
  async addMilestone(title: string, dueDate: string) {
    const id = S().projectId;
    if (!id || S().mode === 'demo') return;
    await api.createMilestone(id, { title, dueDate: dueDate || undefined }).catch(report);
  },
  async setMilestoneStatus(id: string, status: 'planned' | 'active' | 'done') {
    if (S().mode === 'demo') return;
    await api.updateMilestone(id, { status }).catch(report);
  },
};
