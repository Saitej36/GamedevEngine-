import type { AgentId } from './types.js';

/** Where a piece of knowledge comes from. */
export type KnowledgeOrigin = 'pack' | 'external' | 'project';
/**
 * internal  — authored and reviewed by the studio (knowledge/ in the repo)
 * official  — vendor / engine documentation registered by the owner
 * community — third-party examples, tutorials, repos (unverified)
 * project   — this project's own workspace documents
 */
export type KnowledgeTrust = 'internal' | 'official' | 'community' | 'project';
export type KnowledgeLayer = 'studio' | 'role' | 'tool';

export interface KnowledgeDocMeta {
  id: string;
  title: string;
  tags: string[];
  words: number;
  sections: string[];
}

export interface KnowledgePack {
  id: string;
  title: string;
  layer: KnowledgeLayer;
  description: string;
  tools: string[];
  version: string;
  license: string;
  trust: KnowledgeTrust;
  defaultDepartments: AgentId[];
  /** Effective assignment (defaults overridden by the owner). */
  departments: AgentId[];
  docs: KnowledgeDocMeta[];
}

export interface Skill {
  id: string;
  role: AgentId;
  title: string;
  summary: string;
  triggers: string[];
  packs: string[];
  enabled: boolean;
  sections: Record<'purpose' | 'inputs' | 'workflow' | 'output' | 'checklist' | 'failure', string>;
  file: string;
}

export type SourceKind = 'docs_site' | 'github' | 'markdown' | 'pdf' | 'example_project' | 'internal_doc';

export interface KnowledgeSource {
  id: string;
  kind: SourceKind;
  name: string;
  url: string;
  version: string;
  license: string;
  trust: Exclude<KnowledgeTrust, 'project'>;
  departments: AgentId[];
  includePaths: string[];
  projectId: string | null;
  enabled: boolean;
  status: 'pending' | 'ready' | 'error';
  error: string;
  notes: string;
  retrievedAt: string | null;
  createdAt: string;
  documents: { id: string; path: string; title: string; bytes: number }[];
}

/** One retrieved section as handed to an agent. */
export interface KnowledgeHit {
  refId: string; // e.g. "design.core-loops" or "src_abc/docs/guide.md"
  title: string;
  section: string;
  text: string;
  score: number;
  origin: KnowledgeOrigin;
  trust: KnowledgeTrust;
  packId: string | null;
  sourceId: string | null;
  sourceName: string;
  url: string;
  version: string;
  license: string;
}

export interface KnowledgeUsage {
  id: string;
  runId: string | null;
  projectId: string | null;
  taskId: string | null;
  agentId: AgentId;
  /** auto: injected at task start · search/read: agent used the knowledge tools · skill: workflow loaded */
  mode: 'auto' | 'search' | 'read' | 'skill';
  refId: string;
  title: string;
  section: string;
  origin: KnowledgeOrigin | 'skill';
  trust: KnowledgeTrust;
  query: string;
  score: number | null;
  createdAt: string;
}
