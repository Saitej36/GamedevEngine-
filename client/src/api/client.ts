import type {
  CitationCheck,
  ImportedSkill,
  ProjectProfile,
  RoutingDecision,
  KnowledgeHit,
  KnowledgePack,
  KnowledgeSource,
  KnowledgeUsage,
  Skill,
  AgentRun,
  TaskReview,
  UsageSummary,
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
    headers: { 'X-Pixel-Studio': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new ApiError(res.status, (data && typeof data === 'object' && 'error' in data ? String(data.error) : '') || res.statusText);
  return data as T;
}

export interface RoutingPreview {
  engine: string | null;
  engineVersion: string | null;
  engineSource: string;
  engineConfidence: number;
  genre: string | null;
  disciplines: { id: string; score: number; matched: string[] }[];
  supportingSkills: string[];
  excluded: { refId: string; reason: string }[];
  confidence: number;
  reasons: string[];
  clarification: string | null;
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
  skillId?: string | null;
}

export const api = {
  info: () => req<ServerInfo>('GET', '/info'),
  projects: () => req<Project[]>('GET', '/projects'),
  createProject: (p: { name: string; genre: string; brief: string; repoUrl: string; profile?: ProjectProfile }) => req<Project>('POST', '/projects', p),
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
  knowledge: () => req<{ packs: KnowledgePack[]; skills: Skill[]; sources: KnowledgeSource[]; errors: string[] }>('GET', '/knowledge'),
  knowledgeDoc: (id: string) => req<{ title: string; body: string; packId: string }>('GET', `/knowledge/docs/${encodeURIComponent(id)}`),
  knowledgeSkill: (id: string) => req<Skill & { body: string }>('GET', `/knowledge/skills/${encodeURIComponent(id)}`),
  setSkillEnabled: (id: string, enabled: boolean) => req<Skill>('PUT', `/knowledge/skills/${encodeURIComponent(id)}`, { enabled }),
  setPackDepartments: (id: string, departments: AgentId[]) => req<KnowledgePack>('PUT', `/knowledge/packs/${encodeURIComponent(id)}/departments`, { departments }),
  knowledgeSearch: (agent: AgentId, q: string, projectId?: string | null) =>
    req<{ tools: string[]; skill: Skill | null; hits: KnowledgeHit[]; routing: RoutingPreview | null }>(
      'GET',
      `/knowledge/search?agent=${agent}&q=${encodeURIComponent(q)}${projectId ? `&projectId=${projectId}` : ''}`,
    ),
  addSource: (body: Record<string, unknown>) => req<KnowledgeSource>('POST', '/knowledge/sources', body),
  updateSource: (id: string, patch: Partial<KnowledgeSource>) => req<KnowledgeSource>('PATCH', `/knowledge/sources/${id}`, patch),
  refreshSource: (id: string) => req<KnowledgeSource>('POST', `/knowledge/sources/${id}/refresh`),
  deleteSource: (id: string) => req('DELETE', `/knowledge/sources/${id}`),
  sourceDoc: (id: string, docId: string) => req<{ path: string; title: string; content: string }>('GET', `/knowledge/sources/${id}/docs/${docId}`),
  checkAi: () => req<ServerInfo>('POST', '/ai/check'),
  taskRouting: (id: string) => req<RoutingDecision[]>('GET', `/tasks/${id}/routing`),
  skillImports: () => req<ImportedSkill[]>('GET', '/knowledge/skill-imports'),
  importBundles: () => req<ImportBundle[]>('GET', '/knowledge/import-bundles'),
  importBundle: (id: string) => req<{ id: string; kind: string; result: string; blocking: string[] }[]>('POST', `/knowledge/import-bundles/${id}/import`),
  reviewSource: (id: string, decision: 'approve' | 'reject', note: string) => req<KnowledgeSource>('POST', `/knowledge/sources/${id}/review`, { decision, note }),
  taskCitations: (id: string) => req<CitationCheck[]>('GET', `/tasks/${id}/citations`),
  reviewImport: (id: string, decision: 'approve' | 'reject', note: string) => req<ImportedSkill>('POST', `/knowledge/skill-imports/${id}/${decision}`, { note }),
  taskKnowledge: (id: string) => req<KnowledgeUsage[]>('GET', `/tasks/${id}/knowledge`),
  taskHistory: (id: string) => req<{ reviews: TaskReview[]; runs: AgentRun[] }>('GET', `/tasks/${id}/history`),
  usage: (projectId: string) => req<{ summary: UsageSummary; runs: AgentRun[] }>('GET', `/projects/${projectId}/usage`),
};

export interface ImportBundle {
  id: string;
  title: string;
  retrievedAt: string;
  baselines: Record<string, string>;
  sources: Record<string, { repo: string; commit: string; upstreamVersion: string; license: string }>;
  items: { id: string; kind: 'reference' | 'supplement'; title: string; engine: string | null; status: string; sourceId: string | null; importId: string | null; targetSkillId?: string }[];
}
