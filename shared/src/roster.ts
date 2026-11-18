import type { AgentId, AgentStatus, DepartmentId, TaskStatus } from './types.js';

export interface AgentProfile {
  id: AgentId;
  name: string;
  title: string;
  department: DepartmentId;
  bio: string;
  /** Specialities shown on the profile card and fed to the Director for delegation. */
  skills: string[];
  /** Workspace folders (relative to the project root) this agent may write into. */
  writableDirs: string[];
  /** Built-in Claude Agent SDK tools this agent can use. */
  tools: string[];
  /** Whether this agent may run shell commands (also gated by server config). */
  canUseBash: boolean;
  /** Pixel palette for the procedurally generated sprite. */
  look: {
    skin: string;
    hair: string;
    hairStyle: 'short' | 'long' | 'bun' | 'spiky' | 'bald' | 'cap';
    shirt: string;
    pants: string;
    accent: string;
  };
}

export const AGENTS: Record<AgentId, AgentProfile> = {
  director: {
    id: 'director',
    name: 'Ada Vance',
    title: 'Game Director',
    department: 'director',
    bio: 'Owns the creative vision. Turns your instructions into a plan, delegates to the team, reviews every deliverable and escalates key decisions to you.',
    skills: ['Vision & pillars', 'Planning', 'Delegation', 'Deliverable review'],
    writableDirs: ['docs'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: false,
    look: { skin: '#f1c27d', hair: '#2b1d14', hairStyle: 'bun', shirt: '#1f2937', pants: '#111827', accent: '#facc15' },
  },
  designer: {
    id: 'designer',
    name: 'Milo Park',
    title: 'Game Designer',
    department: 'design',
    bio: 'Writes the GDD, core loops, mechanics, level and economy design. Thinks in systems and player motivation.',
    skills: ['GDD', 'Core loop', 'Mechanics', 'Level design', 'Balancing'],
    writableDirs: ['docs', 'design'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: false,
    look: { skin: '#e0ac69', hair: '#7c2d12', hairStyle: 'spiky', shirt: '#2563eb', pants: '#1e3a8a', accent: '#93c5fd' },
  },
  artist: {
    id: 'artist',
    name: 'Rin Okada',
    title: 'Concept Artist',
    department: 'art',
    bio: 'Defines the visual style. Produces style guides, palettes, and SVG/pixel concept art and sprite sheets as real files.',
    skills: ['Art direction', 'Palettes', 'SVG concepts', 'Pixel sprites', 'UI mockups'],
    writableDirs: ['assets', 'docs/art'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: false,
    look: { skin: '#ffdbac', hair: '#db2777', hairStyle: 'long', shirt: '#9333ea', pants: '#3b0764', accent: '#f9a8d4' },
  },
  programmer: {
    id: 'programmer',
    name: 'Theo Brandt',
    title: 'Game Programmer',
    department: 'programming',
    bio: 'Builds the playable game. Writes clean, runnable code (HTML5/TypeScript by default) and keeps the build green.',
    skills: ['Gameplay code', 'Engine architecture', 'Tooling', 'Prototyping'],
    writableDirs: ['src', 'public', 'tests', 'package.json', 'index.html', 'README.md'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: true,
    look: { skin: '#8d5524', hair: '#0f0f0f', hairStyle: 'cap', shirt: '#16a34a', pants: '#374151', accent: '#86efac' },
  },
  producer: {
    id: 'producer',
    name: 'Sasha Reyes',
    title: 'Producer',
    department: 'production',
    bio: 'Keeps the project on track: milestones, schedules, risk registers and status reports.',
    skills: ['Roadmaps', 'Milestones', 'Risk management', 'Status reports'],
    writableDirs: ['docs/production'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: false,
    look: { skin: '#c68642', hair: '#facc15', hairStyle: 'short', shirt: '#ea580c', pants: '#431407', accent: '#fdba74' },
  },
  qa: {
    id: 'qa',
    name: 'Jun Ito',
    title: 'QA Tester',
    department: 'programming',
    bio: 'Breaks things on purpose. Writes test plans, reviews code for bugs and files clear, reproducible bug reports.',
    skills: ['Test plans', 'Code review', 'Bug reports', 'Regression checks'],
    writableDirs: ['qa', 'tests'],
    tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    canUseBash: true,
    look: { skin: '#f1c27d', hair: '#64748b', hairStyle: 'bald', shirt: '#0891b2', pants: '#164e63', accent: '#67e8f9' },
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];
export const WORKER_IDS = AGENT_IDS.filter((a) => a !== 'director');

export const DEPARTMENTS: Record<DepartmentId, { name: string; color: string }> = {
  reception: { name: 'Reception', color: '#c084fc' },
  design: { name: 'Design', color: '#60a5fa' },
  art: { name: 'Art', color: '#f472b6' },
  programming: { name: 'Programming', color: '#4ade80' },
  production: { name: 'Production', color: '#fb923c' },
  meeting: { name: 'Meeting Room', color: '#facc15' },
  director: { name: "Director's Cabin", color: '#fde047' },
  break: { name: 'Break Room', color: '#2dd4bf' },
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Idle',
  walking: 'Walking',
  working: 'Working',
  reading: 'Reading',
  meeting: 'In a meeting',
  celebrating: 'Celebrating',
  blocked: 'Waiting for approval',
  error: 'Hit a problem',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: 'Queued',
  in_progress: 'In progress',
  in_review: 'Director review',
  revision: 'Needs revision',
  awaiting_approval: 'Awaiting approval',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const TASK_STATUSES: TaskStatus[] = [
  'queued',
  'in_progress',
  'in_review',
  'revision',
  'awaiting_approval',
  'done',
  'failed',
  'cancelled',
];

export function isAgentId(v: unknown): v is AgentId {
  return typeof v === 'string' && v in AGENTS;
}
