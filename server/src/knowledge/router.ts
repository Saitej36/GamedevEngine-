import fs from 'node:fs';
import path from 'node:path';
import type { DisciplineId, EngineId, ProjectProfile } from '@pixel/shared';
import { normalise } from './search.js';

/**
 * Knowledge Router v2 — pure decision logic (no I/O except reading workspace marker files).
 * Decides which single engine, which disciplines and which genre a task is about, so retrieval
 * loads only relevant knowledge. Never guesses an engine for engine-dependent work.
 */

export interface RoutingTables {
  engines: Record<string, { label: string; baseline: string; pack: string | null }>;
  disciplines: Record<string, { label: string; keywords: string[]; hints: string[] }>;
  genres: Record<string, { label: string; aliases: string[]; hints: string[] }>;
}

export function loadRoutingTables(knowledgeRoot: string): RoutingTables {
  const file = path.join(knowledgeRoot, 'routing.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RoutingTables & { $comment?: string };
  return { engines: raw.engines, disciplines: raw.disciplines, genres: raw.genres };
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** Normalise an engine version to comparable "major.minor" form (Unity 6 → 6000.x, 2022.3.21f1 → 2022.3). */
export function normaliseVersion(engine: string, v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim().replace(/^[\^~=v>< ]+/, '');
  const m = s.match(/(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  let major = Number(m[1]);
  const minor = m[2] !== undefined ? Number(m[2]) : null;
  if (engine === 'unity' && major >= 6 && major < 100) major = 6000; // "Unity 6", "6.0", "6.2" → 6000.x
  return minor === null ? String(major) : `${major}.${minor}`;
}

function cmp(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Is `version` inside `range`? Range syntax: space-separated clauses like ">=5.4 <5.5", "5.4" (prefix), "3.x".
 * Returns 'unverified' when either side is missing — never silently "compatible".
 */
export function versionCompat(engine: string, version: string | null, range: string | null | undefined): 'compatible' | 'incompatible' | 'unverified' {
  const v = normaliseVersion(engine, version);
  if (!v || !range || !range.trim()) return 'unverified';
  for (const clause of range.trim().split(/\s+/)) {
    const m = clause.match(/^(>=|<=|>|<|=)?(.+)$/);
    if (!m) return 'unverified';
    const op = m[1] ?? '=';
    const target = m[2].replace(/\.x$/i, '');
    const t = op === '=' ? target : normaliseVersion(engine, target);
    if (!t) return 'unverified';
    if (op === '=') {
      const tn = normaliseVersion(engine, t) ?? t;
      if (!(v === tn || v.startsWith(tn + '.') || tn.startsWith(v + '.'))) return 'incompatible';
    } else {
      const c = cmp(v, t);
      if (op === '>=' && c < 0) return 'incompatible';
      if (op === '>' && c <= 0) return 'incompatible';
      if (op === '<=' && c > 0) return 'incompatible';
      if (op === '<' && c >= 0) return 'incompatible';
    }
  }
  return 'compatible';
}

// ---------------------------------------------------------------------------
// Engine signals
// ---------------------------------------------------------------------------

export interface EngineSignal {
  engine: EngineId;
  version: string | null;
  strength: 'strong' | 'medium';
  evidence: string;
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'Library', 'Intermediate', 'Binaries', 'Saved', 'DerivedDataCache', 'Temp', 'dist', 'build']);

/** Read engine marker files from a project workspace (bounded depth, read-only). */
export function scanWorkspaceEngines(root: string): EngineSignal[] {
  const out: EngineSignal[] = [];
  if (!fs.existsSync(root)) return out;
  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || files.length > 4000) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else files.push(path.join(dir, e.name));
    }
  };
  walk(root, 0);
  const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
  const read = (f: string) => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  };
  let webCandidate: string | null = null;
  let hasWebEngineDep = false;
  for (const f of files) {
    const name = path.basename(f);
    if (name.endsWith('.uproject')) {
      let version: string | null = null;
      try {
        const assoc = String((JSON.parse(read(f)) as { EngineAssociation?: string }).EngineAssociation ?? '');
        version = /^\d+\.\d+/.test(assoc) ? normaliseVersion('unreal', assoc) : null; // GUIDs = source builds
      } catch {
        /* malformed: still an Unreal project */
      }
      out.push({ engine: 'unreal', version, strength: 'strong', evidence: rel(f) });
    } else if (name === 'ProjectVersion.txt' && rel(f).endsWith('ProjectSettings/ProjectVersion.txt')) {
      const m = read(f).match(/m_EditorVersion:\s*([^\s]+)/);
      out.push({ engine: 'unity', version: m ? normaliseVersion('unity', m[1]) : null, strength: 'strong', evidence: rel(f) });
    } else if (name === 'project.godot') {
      out.push({ engine: 'godot', version: null, strength: 'strong', evidence: rel(f) });
    } else if (name.endsWith('.asmdef')) {
      out.push({ engine: 'unity', version: null, strength: 'medium', evidence: rel(f) });
    } else if (name.endsWith('.Build.cs') || name.endsWith('.uplugin')) {
      out.push({ engine: 'unreal', version: null, strength: 'medium', evidence: rel(f) });
    } else if (name === 'package.json') {
      try {
        const pkg = JSON.parse(read(f)) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (deps.phaser) {
          out.push({ engine: 'phaser', version: normaliseVersion('phaser', deps.phaser), strength: 'strong', evidence: `${rel(f)} (phaser ${deps.phaser})` });
          hasWebEngineDep = true;
        }
        if (deps['pixi.js'] || deps.three) hasWebEngineDep = true;
        if (!hasWebEngineDep) webCandidate = webCandidate ?? rel(f);
      } catch {
        /* ignore */
      }
    } else if (name === 'index.html' && /<script[^>]+type=["']module["']|<canvas/i.test(read(f))) {
      webCandidate = webCandidate ?? rel(f);
    }
  }
  if (webCandidate && !hasWebEngineDep && !out.some((s) => s.strength === 'strong')) {
    out.push({ engine: 'web', version: null, strength: 'medium', evidence: `${webCandidate} (no engine dependency)` });
  }
  // One signal per engine+strength; keep the one carrying a version.
  const seen = new Map<string, EngineSignal>();
  for (const s of out) {
    const k = `${s.engine}:${s.strength}`;
    const prev = seen.get(k);
    if (!prev || (!prev.version && s.version)) seen.set(k, s);
  }
  return [...seen.values()];
}

const TEXT_ENGINE: Record<Exclude<EngineId, 'other'>, RegExp> = {
  unity: /\bunity\b|monobehaviou?r|scriptableobject|unity test framework/i,
  unreal: /\bunreal\b|\bue ?5\b|\bue4\b|\bblueprints?\b|\buclass\b|\buproperty\b|gameplay ability system/i,
  phaser: /\bphaser\b/i,
  godot: /\bgodot\b|\bgdscript\b/i,
  web: /vanilla (?:js|javascript)|\bhtml5 canvas\b|\bcanvas 2d\b|no (?:game )?engine|dependency-free browser/i,
};

/** Engines explicitly named in text. 'web' only counts when no real engine is named. */
export function textEngines(text: string): { engine: EngineId; version: string | null }[] {
  const found = (Object.keys(TEXT_ENGINE) as Exclude<EngineId, 'other'>[]).filter((e) => TEXT_ENGINE[e].test(text));
  const real = found.filter((e) => e !== 'web');
  const list = real.length ? real : found;
  return list.map((engine) => {
    const v =
      engine === 'unreal'
        ? text.match(/\b(?:unreal(?: engine)?|ue)\s*(5\.\d+)/i)?.[1]
        : engine === 'unity'
          ? text.match(/\bunity\s*(6(?:\.\d+)?|20\d\d(?:\.\d+)?)/i)?.[1]
          : engine === 'phaser'
            ? text.match(/\bphaser\s*(\d+(?:\.\d+)?)/i)?.[1]
            : undefined;
    return { engine, version: v ? normaliseVersion(engine, v) : null };
  });
}

const ENGINE_NAME: Record<string, string> = {
  unity: String.raw`unity(?:\s*(?:6(?:\.\d+)?|20\d\d(?:\.\d+)?))?`,
  unreal: String.raw`(?:unreal(?:\s+engine)?|ue)\s*(?:5(?:\.\d+)?|4(?:\.\d+)?)?`,
  phaser: String.raw`phaser(?:\s*\d+(?:\.\d+)*)?`,
  godot: String.raw`godot(?:\s*\d+(?:\.\d+)?)?`,
};

/**
 * Engines a task explicitly REQUESTS (as opposed to merely mentions): "implement X in Phaser", "using Unity 6",
 * "port this to Unreal", "target Phaser 3.60", "Phaser implementation of …". Incidental mentions such as
 * "make it feel like the Unity prototype" are not requests.
 */
export function explicitEngineRequests(text: string): { engine: EngineId; version: string | null; phrase: string }[] {
  const out: { engine: EngineId; version: string | null; phrase: string }[] = [];
  for (const [engine, name] of Object.entries(ENGINE_NAME)) {
    const patterns = [
      // in / using / with / for / via / on <engine> — but not "like the <engine> prototype"
      new RegExp(String.raw`\b(?:in|using|with|via|on|targeting|target|for)\s+(?:the\s+)?(${name})\b(?!\s+(?:prototype|version of the|game we|demo|reference|example|clone))`, 'i'),
      new RegExp(String.raw`\b(?:port|convert|migrate|rewrite|switch|move|re-?implement|upgrade)\b[^.\n]{0,60}?\b(?:to|into|in)\s+(${name})\b`, 'i'),
      new RegExp(String.raw`\b(${name})\s+(?:implementation|project|scene|plugin|module|script|code|build|version)\s+(?:of|for)\b`, 'i'),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (!m) continue;
      // Skip negated requests ("not in Phaser", "instead of Unity", "unlike Phaser").
      const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
      if (/\b(?:not|instead of|unlike|rather than|no)\s*$/i.test(before) || /\bnot\s+(?:in|using|with)\s/i.test(m[0])) continue;
      const v = textEngines(m[1])[0]?.version ?? null;
      out.push({ engine: engine as EngineId, version: v, phrase: m[0].trim() });
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Engine resolution
// ---------------------------------------------------------------------------

export interface EngineResolution {
  engine: EngineId | null;
  version: string | null;
  source: 'profile' | 'files' | 'task' | 'brief' | 'none';
  confidence: number;
  reasons: string[];
  /** Set when the router refuses to pick: the question for the owner. */
  clarification: string | null;
  signals: { files: EngineSignal[]; task: EngineId[]; brief: EngineId[] };
}

/** Same version at the precision the request gave (up to minor): "6000" matches "6000.0.23"; "5.5" does not match "5.4". */
const sameMinor = (req: string, pinned: string) => {
  const n = Math.min(2, req.split('.').length);
  return req.split('.').slice(0, n).join('.') === pinned.split('.').slice(0, n).join('.');
};
const label = (e: string) => ({ unreal: 'Unreal Engine', unity: 'Unity', phaser: 'Phaser', web: 'vanilla web', godot: 'Godot', other: 'another engine' })[e] ?? e;

/**
 * Priority: 1. explicit project profile, 2. actual project files, 3. explicit task instruction (then the brief).
 * Exactly one engine or none. Conflicts are never resolved by loading several engines.
 */
export function resolveEngine(p: {
  profile: ProjectProfile;
  files: EngineSignal[];
  taskText: string;
  briefText: string;
  engineDependent: boolean;
}): EngineResolution {
  const task = textEngines(p.taskText);
  const brief = textEngines(p.briefText);
  const signals = { files: p.files, task: task.map((t) => t.engine), brief: brief.map((t) => t.engine) };
  const reasons: string[] = [];
  const clarify = (question: string, why: string): EngineResolution => {
    reasons.push(why);
    if (!p.engineDependent) {
      reasons.push('Task is not engine-dependent: continuing without engine-specific knowledge.');
      return { engine: null, version: null, source: 'none', confidence: 0, reasons, clarification: null, signals };
    }
    return { engine: null, version: null, source: 'none', confidence: 0, reasons, clarification: question, signals };
  };
  const strong = [...new Set(p.files.filter((s) => s.strength === 'strong').map((s) => s.engine))];
  const medium = [...new Set(p.files.filter((s) => s.strength === 'medium').map((s) => s.engine))];
  const fileVersion = (e: string) => p.files.find((s) => s.engine === e && s.version)?.version ?? null;

  // 1. Explicit project profile
  const pe = p.profile.engine;
  if (pe) {
    const contradicting = strong.filter((e) => e !== pe);
    if (contradicting.length)
      return clarify(
        `The project profile says ${label(pe)}, but the workspace contains ${contradicting.map(label).join(' and ')} project files (${p.files
          .filter((s) => contradicting.includes(s.engine))
          .map((s) => s.evidence)
          .join(', ')}). Which engine is this project using?`,
        `Conflict: profile engine ${pe} vs project files ${contradicting.join(', ')}.`,
      );
    const version = normaliseVersion(pe, p.profile.engineVersion) ?? fileVersion(pe);
    // An explicit task-level request for a different engine (or a different version of the same engine) is a
    // conflict the owner must resolve; it is never silently overridden by the profile.
    for (const req of explicitEngineRequests(p.taskText)) {
      if (req.engine !== pe)
        return {
          engine: null, version: null, source: 'none', confidence: 0, signals,
          reasons: [...reasons, `Conflict: task explicitly requests ${req.engine} ("${req.phrase}") but the project profile says ${pe}.`],
          clarification: `The task explicitly asks for ${label(req.engine)} ("${req.phrase}"), but the project profile says ${label(pe)}${version ? ` ${version}` : ''}. Should this task target ${label(pe)} (edit the task), or should the project profile change?`,
        };
      if (req.version && version && !sameMinor(req.version, version))
        return {
          engine: null, version: null, source: 'none', confidence: 0, signals,
          reasons: [...reasons, `Conflict: task explicitly requests ${pe} ${req.version} ("${req.phrase}") but the project profile pins ${version}.`],
          clarification: `The task asks for ${label(pe)} ${req.version} ("${req.phrase}"), but the project profile pins ${label(pe)} ${version}. Should the task follow the profile (${version}), or should the profile's engine version change?`,
        };
    }
    reasons.push(`Engine ${label(pe)} from the project profile${version ? ` (version ${version}${p.profile.engineVersion ? '' : ' from project files'})` : ' (no version recorded)'}.`);
    const softOthers = [...new Set([...medium.filter((e) => e !== pe), ...task.map((t) => t.engine).filter((e) => e !== pe)])];
    if (softOthers.length) reasons.push(`Ignored weaker mentions of ${softOthers.map(label).join(', ')} (profile takes priority).`);
    if (pe === 'other' || pe === 'godot') reasons.push(`The studio has no knowledge pack for ${label(pe)}; no engine references will be loaded.`);
    return { engine: pe, version, source: 'profile', confidence: 1, reasons, clarification: null, signals };
  }

  // 2. Actual project files
  if (strong.length > 1 || (!strong.length && medium.length > 1))
    return clarify(
      `The workspace contains files for several engines (${p.files.map((s) => `${label(s.engine)}: ${s.evidence}`).join('; ')}). Which engine should the team target? Set it in the project profile.`,
      `Conflict: project files indicate ${[...new Set([...strong, ...medium])].join(', ')}.`,
    );
  const fileEngine = strong[0] ?? medium[0];
  if (fileEngine) {
    const version = fileVersion(fileEngine);
    const sig = p.files.find((s) => s.engine === fileEngine)!;
    reasons.push(`Engine ${label(fileEngine)} detected from project files (${sig.evidence})${version ? `, version ${version}` : ', version unknown'}.`);
    const others = task.map((t) => t.engine).filter((e) => e !== fileEngine);
    if (others.length) reasons.push(`Task text mentions ${others.map(label).join(', ')}; project files take priority.`);
    return { engine: fileEngine, version, source: 'files', confidence: sig.strength === 'strong' ? 0.9 : 0.75, reasons, clarification: null, signals };
  }

  // 3. Explicit task instruction, then the project brief
  for (const [list, source, confidence] of [
    [task, 'task', 0.7],
    [brief, 'brief', 0.6],
  ] as const) {
    if (list.length > 1)
      return clarify(
        `The ${source === 'task' ? 'task' : 'project brief'} mentions ${list.map((t) => label(t.engine)).join(' and ')}. Which single engine should be used? Set it in the project profile.`,
        `Conflict: ${source} text names ${list.map((t) => t.engine).join(', ')}.`,
      );
    if (list.length === 1) {
      reasons.push(`Engine ${label(list[0].engine)} named in the ${source === 'task' ? 'task instructions' : 'project brief'}${list[0].version ? ` (version ${list[0].version})` : ''}. No profile or project files say otherwise.`);
      return { engine: list[0].engine, version: list[0].version, source, confidence, reasons, clarification: null, signals };
    }
  }

  return clarify(
    'No engine is recorded in the project profile, found in the project files or named in the task. Which engine (and version) should this work target?',
    'No engine signal found.',
  );
}

// ---------------------------------------------------------------------------
// Disciplines and genre
// ---------------------------------------------------------------------------

const phraseRe = (phrase: string) => new RegExp(`(^|[^a-z0-9])${normalise(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')}([^a-z0-9]|$)`, 'i');

export function detectDisciplines(tables: RoutingTables, text: string, max = 4) {
  const t = normalise(text);
  const out: { id: DisciplineId; score: number; matched: string[] }[] = [];
  for (const [id, d] of Object.entries(tables.disciplines)) {
    const matched = d.keywords.filter((k) => phraseRe(k).test(t));
    // Multi-word phrases are stronger evidence than single generic words.
    const score = matched.reduce((n, k) => n + (k.includes(' ') ? 2 : 1), 0);
    if (score >= 1) out.push({ id: id as DisciplineId, score, matched });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, max);
}

export function resolveGenre(tables: RoutingTables, profile: ProjectProfile, fallbackText: string) {
  const match = (v: string) => {
    const n = normalise(v);
    for (const [id, g] of Object.entries(tables.genres)) if (id === n || g.aliases.some((a) => phraseRe(a).test(n))) return id;
    return null;
  };
  if (profile.primaryGenre) {
    const id = match(profile.primaryGenre);
    return {
      genre: id ?? normalise(profile.primaryGenre).trim(),
      source: 'profile' as const,
      known: !!id,
      reason: id
        ? `Primary genre ${tables.genres[id].label} from the project profile.`
        : `Primary genre "${profile.primaryGenre}" from the profile has no studio genre knowledge yet.`,
      secondary: profile.secondaryGenre ? match(profile.secondaryGenre) : null,
    };
  }
  const id = match(fallbackText);
  if (id) return { genre: id, source: 'text' as const, known: true, reason: `Genre ${tables.genres[id].label} inferred from the project's genre/brief text (no profile genre).`, secondary: null };
  return { genre: null, source: 'none' as const, known: false, reason: 'No genre in the profile or brief.', secondary: null };
}
