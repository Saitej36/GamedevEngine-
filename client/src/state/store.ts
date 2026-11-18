import { create } from 'zustand';
import type {
  AgentEvent,
  AgentId,
  AgentState,
  Approval,
  ChatMessage,
  Milestone,
  Project,
  ProjectStats,
  ServerInfo,
  ServerMessage,
  Task,
} from '@pixel/shared';
import { AGENT_IDS, EVENT_ANIMATION } from '@pixel/shared';

export type Mode = 'connecting' | 'live' | 'demo';
export type Tab = 'chat' | 'tasks' | 'approvals' | 'files' | 'dashboard' | 'timeline';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
}

interface StudioState {
  mode: Mode;
  info: ServerInfo | null;
  projects: Project[];
  projectId: string | null;
  milestones: Milestone[];
  tasks: Task[];
  approvals: Approval[];
  stats: ProjectStats | null;
  chat: ChatMessage[];
  events: AgentEvent[];
  agents: Record<AgentId, AgentState>;
  bubbles: Partial<Record<AgentId, { emoji: string; until: number }>>;
  filesVersion: number;
  /** Bumped whenever an agent run starts/finishes or a review is recorded. */
  usageVersion: number;
  directorTyping: boolean;
  selectedAgent: AgentId | null;
  tab: Tab;
  /** File the explorer should open (set from task cards / timeline). */
  openFile: string | null;
  toasts: Toast[];

  set: (patch: Partial<StudioState>) => void;
  apply: (msg: ServerMessage) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  selectAgent: (id: AgentId | null) => void;
}

const idleAgents = (): Record<AgentId, AgentState> =>
  Object.fromEntries(
    AGENT_IDS.map((id) => [
      id,
      { agentId: id, status: 'idle', currentTaskId: null, projectId: null, activity: '', updatedAt: new Date(0).toISOString() },
    ]),
  ) as Record<AgentId, AgentState>;

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
};

let toastSeq = 1;
const MAX_EVENTS = 600;

export const useStudio = create<StudioState>((set, get) => ({
  mode: 'connecting',
  info: null,
  projects: [],
  projectId: null,
  milestones: [],
  tasks: [],
  approvals: [],
  stats: null,
  chat: [],
  events: [],
  agents: idleAgents(),
  bubbles: {},
  filesVersion: 0,
  usageVersion: 0,
  directorTyping: false,
  selectedAgent: null,
  tab: 'chat',
  openFile: null,
  toasts: [],

  set: (patch) => set(patch),

  toast: (text, tone = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 8000 : 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  selectAgent: (id) => set({ selectedAgent: id }),

  apply: (msg) => {
    const s = get();
    const inProject = (pid: string | null) => !pid || pid === s.projectId;
    switch (msg.kind) {
      case 'hello': {
        const agents = idleAgents();
        for (const a of msg.agents) agents[a.agentId] = a;
        set({ info: msg.info, agents });
        break;
      }
      case 'agent_state':
        set({ agents: { ...s.agents, [msg.state.agentId]: msg.state } });
        break;
      case 'event': {
        const e = msg.event;
        if (!inProject(e.projectId)) {
          // Other projects still animate the office, but don't pollute this project's timeline.
          if (e.agentId) setBubble(e);
          break;
        }
        set({ events: [...s.events.slice(-MAX_EVENTS + 1), e] });
        if (e.agentId) setBubble(e);
        if (e.type === 'approval_required') get().toast(e.message, 'warn');
        if (e.type === 'task_failed') get().toast(e.message, 'error');
        if (e.type === 'task_completed') get().toast(e.message, 'success');
        break;
      }
      case 'task_updated':
        if (inProject(msg.task.projectId)) set({ tasks: upsert(s.tasks, msg.task) });
        break;
      case 'task_deleted':
        set({ tasks: s.tasks.filter((t) => t.id !== msg.taskId) });
        break;
      case 'approval_updated':
        if (inProject(msg.approval.projectId)) set({ approvals: upsert(s.approvals, msg.approval) });
        break;
      case 'chat_message':
        if (inProject(msg.message.projectId) && !s.chat.some((m) => m.id === msg.message.id))
          set({ chat: [...s.chat, msg.message] });
        break;
      case 'project_updated':
        set({ projects: upsert(s.projects, msg.project) });
        break;
      case 'milestone_updated':
        if (inProject(msg.milestone.projectId)) set({ milestones: upsert(s.milestones, msg.milestone) });
        break;
      case 'usage_updated':
        if (inProject(msg.projectId)) set({ usageVersion: s.usageVersion + 1 });
        break;
      case 'files_changed':
        if (inProject(msg.projectId)) set({ filesVersion: s.filesVersion + 1 });
        break;
      case 'director_typing':
        if (inProject(msg.projectId)) set({ directorTyping: msg.typing });
        break;
    }
  },
}));

function setBubble(e: AgentEvent) {
  const anim = EVENT_ANIMATION[e.type];
  if (!e.agentId) return;
  const emoji = e.type === 'agent_working' && e.data.status === 'reading' ? '📖' : anim.bubble;
  useStudio.setState((s) => ({
    bubbles: { ...s.bubbles, [e.agentId!]: { emoji, until: Date.now() + (anim.revertAfterMs ?? 4000) } },
  }));
}

export const currentProject = (s: StudioState) => s.projects.find((p) => p.id === s.projectId) ?? null;
