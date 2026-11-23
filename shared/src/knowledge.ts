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
  /** Engine version ranges this pack was written for, e.g. { unreal: ">=5.4 <5.5" }. */
  engineVersions: Record<string, string>;
  version: string;
  license: string;
  trust: KnowledgeTrust;
  defaultDepartments: AgentId[];
  /** Effective assignment (defaults overridden by the owner). */
  departments: AgentId[];
  docs: KnowledgeDocMeta[];
}

/** Version + provenance metadata shared by studio-authored and imported skills. */
export interface SkillMeta {
  version: string;
  /** 'internal' for skills in knowledge/skills; repository URL for imports. */
  sourceRepo: string;
  sourceCommit: string;
  license: string;
  /** Engines the skill applies to; empty = engine-neutral. */
  engines: string[];
  /** Version ranges per engine, e.g. { unreal: ">=5.4 <5.5" }. */
  engineVersions: Record<string, string>;
  disciplines: string[];
  genres: string[];
  /** The task cannot be done correctly without knowing the target engine. */
  engineDependent: boolean;
  approval: 'approved' | 'quarantined' | 'rejected';
  origin: 'internal' | 'imported';
}

export interface Skill extends SkillMeta {
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
  /** Engine this source documents (if engine-specific) and the version range it applies to. */
  engine: string;
  engineVersions: string;
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
  /** compatible · unverified (no version information on one side) */
  versionStatus?: 'compatible' | 'unverified';
  /** Which part of the routing budget selected this reference. */
  slot?: 'engine' | 'discipline' | 'genre' | 'project' | 'general';
}

export type DisciplineId =
  | 'combat'
  | 'ai'
  | 'animation'
  | 'input'
  | 'save'
  | 'ui'
  | 'procgen'
  | 'progression'
  | 'economy'
  | 'level'
  | 'feel'
  | 'performance'
  | 'art-pipeline'
  | 'publishing';

/** The router's decision for one agent run (or for a task it refused to start). */
export interface RoutingDecision {
  id: string;
  runId: string | null;
  projectId: string | null;
  taskId: string | null;
  agentId: AgentId;
  engine: string | null;
  engineVersion: string | null;
  engineSource: 'profile' | 'files' | 'task' | 'brief' | 'none';
  engineConfidence: number;
  genre: string | null;
  genreSource: 'profile' | 'text' | 'none';
  disciplines: { id: DisciplineId; score: number; matched: string[] }[];
  primarySkill: string | null;
  supportingSkills: string[];
  references: { refId: string; section: string; slot: string; versionStatus: string }[];
  excluded: { refId: string; reason: string }[];
  confidence: number;
  reasons: string[];
  clarificationRequired: boolean;
  clarificationQuestion: string;
  createdAt: string;
}

/** An externally sourced skill waiting for (or past) owner review. Never available to agents unless approved. */
export interface ImportedSkill extends SkillMeta {
  id: string;
  skillId: string;
  role: AgentId;
  title: string;
  summary: string;
  body: string;
  lintFindings: { severity: 'block' | 'warn'; rule: string; detail: string }[];
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
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
