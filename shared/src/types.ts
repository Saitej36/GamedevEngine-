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

/** One Claude Agent SDK run (query) made on behalf of a project. */
export type AgentRunKind = 'planning' | 'task' | 'review' | 'legacy';
/**
 * actual           — total_cost_usd reported by the Agent SDK for this run
 * unavailable      — no cost reported (run crashed, was aborted or interrupted before its result)
 * legacy_aggregate — measured before per-run tracking existed; one figure covering a task's run + review
 */
export type CostStatus = 'actual' | 'unavailable' | 'legacy_aggregate';

export interface AgentRun {
  id: string;
  projectId: string;
  taskId: string | null;
  agentId: AgentId;
  kind: AgentRunKind;
  sessionId: string | null;
  status: 'running' | 'ok' | 'error' | 'cancelled' | 'interrupted';
  costUsd: number | null;
  costStatus: CostStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  numTurns: number | null;
  durationMs: number | null;
  model: string | null;
  error: string;
  startedAt: string;
  finishedAt: string | null;
}

/** A reviewer decision on a task; one record per decision, never overwritten. */
export interface TaskReview {
  id: string;
  projectId: string;
  taskId: string;
  reviewer: 'director' | 'owner' | 'legacy';
  /** director: approve | revise | escalated · owner: approved | rejected · legacy: note */
  decision: 'approve' | 'revise' | 'escalated' | 'approved' | 'rejected' | 'note';
  feedback: string;
  /** Task revision number the decision applied to. */
  revision: number | null;
  runId: string | null;
  approvalId: string | null;
  createdAt: string;
}

export interface UsageSummary {
  /** Sum of every run whose cost is known (actual + legacy_aggregate). */
  knownCostUsd: number;
  byKind: Record<AgentRunKind, number>;
  byStatus: Record<CostStatus, { runs: number; costUsd: number }>;
  runs: number;
  runningRuns: number;
  tokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
}

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  activeTasks: number;
  failedTasks: number;
  pendingApprovals: number;
  fileCount: number;
  /** Known AI spend for the whole project (all runs with a reported cost). */
  costUsd: number;
  usage: UsageSummary;
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
  | { kind: 'usage_updated'; projectId: string; taskId: string | null }
  | { kind: 'director_typing'; projectId: string; typing: boolean };

export type ClientMessage = { kind: 'subscribe'; projectId: string | null } | { kind: 'ping' };
