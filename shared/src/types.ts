// Domain model shared by the server, the React UI and the Phaser office.

export type AgentId =
  | 'director'
  | 'designer'
  | 'artist'
  | 'programmer'
  | 'producer'
  | 'qa';

export type DepartmentId =
  | 'reception'
  | 'design'
  | 'art'
  | 'programming'
  | 'production'
  | 'meeting'
  | 'director'
  | 'break';

/** What an employee is doing right now. Drives the NPC animation. */
export type AgentStatus =
  | 'idle' // free; NPC roams the office (ambient simulation)
  | 'walking'
  | 'working' // typing at desk (writing files, thinking)
  | 'reading' // reading files / reviewing
  | 'meeting' // briefing / delegating in the meeting room
  | 'celebrating' // just finished a task
  | 'blocked' // waiting for human approval
  | 'error'; // last task failed

export type TaskStatus =
  | 'queued'
  | 'in_progress'
  | 'in_review'
  | 'revision'
  | 'awaiting_approval'
  | 'done'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  name: string;
  genre: string;
  brief: string;
  repoUrl: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: 'planned' | 'active' | 'done';
  order: number;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  assignee: AgentId;
  status: TaskStatus;
  priority: TaskPriority;
  requiresApproval: boolean;
  revisionCount: number;
  feedback: string;
  result: string;
  files: string[];
  error: string;
  costUsd: number;
  createdBy: AgentId | 'user';
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Approval {
  id: string;
  projectId: string;
  taskId: string | null;
  title: string;
  details: string;
  requestedBy: AgentId;
  status: 'pending' | 'approved' | 'rejected';
  response: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'director' | 'agent' | 'system';
  agentId: AgentId | null;
  content: string;
  createdAt: string;
}

export interface AgentState {
  agentId: AgentId;
  status: AgentStatus;
  currentTaskId: string | null;
  projectId: string | null;
  activity: string;
  updatedAt: string;
}

export interface FileNode {
  name: string;
  path: string; // relative to the project workspace, posix separators
  type: 'file' | 'dir';
  size?: number;
  modifiedAt?: string;
  children?: FileNode[];
}

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  activeTasks: number;
  failedTasks: number;
  pendingApprovals: number;
  fileCount: number;
  costUsd: number;
  progress: number; // 0..1
  byStatus: Record<TaskStatus, number>;
  byAgent: Record<AgentId, { total: number; done: number }>;
}

export interface ServerInfo {
  aiMode: 'live' | 'offline';
  aiReason: string;
  model: string;
  maxConcurrentAgents: number;
  bashEnabled: boolean;
  version: string;
}

// ---------------------------------------------------------------------------
// Real-time events
// ---------------------------------------------------------------------------

/** Event types required by the studio spec; each maps to an NPC animation. */
export type AgentEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'agent_working'
  | 'file_created'
  | 'task_completed'
  | 'approval_required'
  | 'task_failed'
  | 'agent_idle';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  projectId: string | null;
  agentId: AgentId | null;
  taskId: string | null;
  /** Short human-readable line for timelines and speech bubbles. */
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
  /** True when produced by the client-side simulation, never by a real agent. */
  simulated?: boolean;
}

/** Messages pushed over the WebSocket. */
export type ServerMessage =
  | { kind: 'hello'; info: ServerInfo; agents: AgentState[] }
  | { kind: 'event'; event: AgentEvent }
  | { kind: 'agent_state'; state: AgentState }
  | { kind: 'task_updated'; task: Task }
  | { kind: 'task_deleted'; taskId: string; projectId: string }
  | { kind: 'approval_updated'; approval: Approval }
  | { kind: 'chat_message'; message: ChatMessage }
  | { kind: 'project_updated'; project: Project }
  | { kind: 'milestone_updated'; milestone: Milestone }
  | { kind: 'files_changed'; projectId: string }
  | { kind: 'director_typing'; projectId: string; typing: boolean };

export type ClientMessage = { kind: 'subscribe'; projectId: string | null } | { kind: 'ping' };
