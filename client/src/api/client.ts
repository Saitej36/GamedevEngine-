import type {
  AgentEvent,
  AgentId,
  AgentProfile,
  AgentState,
  Approval,
  ChatMessage,
  FileNode,
  Milestone,
  Project,
  ProjectStats,
  ServerInfo,
  Task,
  TaskPriority,
} from '@pixel/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new ApiError(res.status, (data && typeof data === 'object' && 'error' in data ? String(data.error) : '') || res.statusText);
  return data as T;
}

export interface ProjectDetail {
  project: Project;
  milestones: Milestone[];
  tasks: Task[];
  approvals: Approval[];
  stats: ProjectStats;
}

export interface AgentDetail {
  profile: AgentProfile;
  state: AgentState;
  tasks: Task[];
  events: AgentEvent[];
  permissions: { writableDirs: string[]; tools: string[]; bash: boolean };
}

export interface NewTaskInput {
  title: string;
  description: string;
  assignee: AgentId;
  priority: TaskPriority;
  milestoneId?: string | null;
  requiresApproval?: boolean;
}

export const api = {
  info: () => req<ServerInfo>('GET', '/info'),
  projects: () => req<Project[]>('GET', '/projects'),
  createProject: (p: { name: string; genre: string; brief: string; repoUrl: string }) => req<Project>('POST', '/projects', p),
  updateProject: (id: string, p: Partial<Project>) => req<Project>('PATCH', `/projects/${id}`, p),
  deleteProject: (id: string) => req('DELETE', `/projects/${id}`),
  project: (id: string) => req<ProjectDetail>('GET', `/projects/${id}`),
  stats: (id: string) => req<ProjectStats>('GET', `/projects/${id}/stats`),
  events: (id: string) => req<AgentEvent[]>('GET', `/projects/${id}/events?limit=400`),
  chat: (id: string) => req<ChatMessage[]>('GET', `/projects/${id}/chat`),
  sendChat: (id: string, content: string) => req<ChatMessage>('POST', `/projects/${id}/chat`, { content }),
  createTask: (projectId: string, t: NewTaskInput) => req<Task>('POST', `/projects/${projectId}/tasks`, t),
  updateTask: (id: string, patch: Partial<NewTaskInput>) => req<Task>('PATCH', `/tasks/${id}`, patch),
  startTask: (id: string) => req<Task>('POST', `/tasks/${id}/start`),
  cancelTask: (id: string) => req<Task>('POST', `/tasks/${id}/cancel`),
  retryTask: (id: string) => req<Task>('POST', `/tasks/${id}/retry`),
  deleteTask: (id: string) => req('DELETE', `/tasks/${id}`),
  createMilestone: (projectId: string, m: { title: string; description?: string; dueDate?: string }) =>
    req<Milestone>('POST', `/projects/${projectId}/milestones`, m),
  updateMilestone: (id: string, m: Partial<Milestone>) => req<Milestone>('PATCH', `/milestones/${id}`, m),
  deleteMilestone: (id: string) => req('DELETE', `/milestones/${id}`),
  resolveApproval: (id: string, decision: 'approved' | 'rejected', response: string) =>
    req<Approval>('POST', `/approvals/${id}/resolve`, { decision, response }),
  files: (projectId: string) => req<FileNode>('GET', `/projects/${projectId}/files`),
  fileUrl: (projectId: string, path: string, download = false) =>
    `/api/projects/${projectId}/file?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}`,
  readFile: async (projectId: string, path: string) => {
    const res = await fetch(api.fileUrl(projectId, path));
    if (!res.ok) throw new ApiError(res.status, 'Could not read file');
    return res.text();
  },
  writeFile: (projectId: string, path: string, content: string) => req('PUT', `/projects/${projectId}/file`, { path, content }),
  agent: (id: AgentId) => req<AgentDetail>('GET', `/agents/${id}`),
};
