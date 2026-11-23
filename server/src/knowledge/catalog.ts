import fs from 'node:fs';
import path from 'node:path';
import type { AgentId, KnowledgeLayer, KnowledgeTrust, Skill } from '@pixel/shared';
import { isAgentId } from '@pixel/shared';

/**
 * Loads the trusted, studio-authored knowledge from the repository (knowledge/). This content is reviewed in
 * git; owner-registered external material lives in the database and is never loaded through here.
 */

export interface CatalogDoc {
  id: string;
  packId: string;
  title: string;
  tags: string[];
  /** Per-document override of the pack's engine version ranges. */
  engineVersions: Record<string, string>;
  body: string;
  file: string;
}

export interface CatalogPack {
  id: string;
  title: string;
  layer: KnowledgeLayer;
  description: string;
  tools: string[];
  engineVersions: Record<string, string>;
  version: string;
  license: string;
  trust: KnowledgeTrust;
  defaultDepartments: AgentId[];
  docs: CatalogDoc[];
}

export type CatalogSkill = Omit<Skill, 'enabled'> & { body: string };

export interface Catalog {
  root: string;
  packs: CatalogPack[];
  skills: CatalogSkill[];
  /** Problems found while loading (invalid skills are excluded, never half-loaded). */
  errors: string[];
}

export const SKILL_SECTIONS = {
  purpose: 'Purpose',
  inputs: 'Required inputs',
  workflow: 'Workflow',
  output: 'Expected output',
  checklist: 'Quality checklist',
  failure: 'Failure conditions',
} as const;

export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

const list = (v: string | undefined) =>
  (v ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

/** "unreal >=5.4 <5.5; unity >=2022.3 <7" → { unreal: ">=5.4 <5.5", unity: ">=2022.3 <7" } */
export function parseEngineVersions(v: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (v ?? '').split(';')) {
    const m = part.trim().match(/^([a-z0-9-]+)\s+(.+)$/i);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/** Split Markdown into `##` sections (text before the first `##` becomes "Overview"). */
export function splitSections(body: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  let heading = 'Overview';
  let buf: string[] = [];
  let inFence = false;
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) out.push({ heading, text });
    buf = [];
  };
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence && line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (h) {
      flush();
      heading = h[1];
    } else if (!(!inFence && /^#\s+/.test(line) && out.length === 0 && buf.every((l) => !l.trim()))) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

function parseSkill(file: string, roleDir: string, errors: string[]): CatalogSkill | null {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const rel = path.basename(file);
  const id = meta.id || path.basename(file, '.md');
  const role = meta.role || roleDir;
  if (!isAgentId(role)) {
    errors.push(`skill ${rel}: unknown role "${role}"`);
    return null;
  }
  if (role !== roleDir) {
    errors.push(`skill ${rel}: role "${role}" does not match folder "${roleDir}"`);
    return null;
  }
  const byHeading = new Map(splitSections(body).map((s) => [s.heading.toLowerCase(), s.text]));
  const sections = {} as CatalogSkill['sections'];
  const missing: string[] = [];
  for (const [key, heading] of Object.entries(SKILL_SECTIONS) as [keyof typeof SKILL_SECTIONS, string][]) {
    const text = byHeading.get(heading.toLowerCase());
    if (!text) missing.push(heading);
    else sections[key] = text;
  }
  if (missing.length) {
    errors.push(`skill ${role}/${rel}: missing section(s) ${missing.join(', ')}`);
    return null;
  }
  if (!meta.title || !meta.summary) {
    errors.push(`skill ${role}/${rel}: title and summary are required`);
    return null;
  }
  const engines = list(meta.engines).map((e) => e.toLowerCase()).filter((e) => e !== 'any');
  return {
    id,
    role,
    title: meta.title,
    summary: meta.summary,
    triggers: list(meta.triggers),
    packs: list(meta.packs),
    // Metadata foundations (defaults keep pre-v2 skills valid).
    version: meta.version || '1.0.0',
    sourceRepo: 'internal',
    sourceCommit: '',
    license: meta.license || 'Pixel Studio internal',
    engines,
    engineVersions: parseEngineVersions(meta.engine_versions),
    disciplines: list(meta.disciplines),
    genres: list(meta.genres).filter((g) => g !== 'any'),
    engineDependent: /^(true|yes|1)$/i.test(meta.engine_dependent ?? ''),
    approval: 'approved',
    origin: 'internal',
    sections,
    file: path.relative(path.dirname(path.dirname(path.dirname(file))), file),
    body,
  };
}

export function loadCatalog(root: string): Catalog {
  const errors: string[] = [];
  const packs: CatalogPack[] = [];
  const skills: CatalogSkill[] = [];
  const packsDir = path.join(root, 'packs');
  if (fs.existsSync(packsDir)) {
    for (const dir of fs.readdirSync(packsDir).sort()) {
      const manifest = path.join(packsDir, dir, 'pack.json');
      if (!fs.existsSync(manifest)) continue;
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      } catch (e) {
        errors.push(`pack ${dir}: invalid pack.json (${(e as Error).message})`);
        continue;
      }
      const defaultDepartments = (Array.isArray(m.defaultDepartments) ? m.defaultDepartments : []).filter(isAgentId);
      const pack: CatalogPack = {
        id: String(m.id ?? dir),
        title: String(m.title ?? dir),
        layer: (['studio', 'role', 'tool'].includes(String(m.layer)) ? m.layer : 'role') as KnowledgeLayer,
        description: String(m.description ?? ''),
        tools: Array.isArray(m.tools) ? m.tools.map(String) : [],
        engineVersions:
          m.engineVersions && typeof m.engineVersions === 'object' ? Object.fromEntries(Object.entries(m.engineVersions as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {},
        version: String(m.version ?? ''),
        license: String(m.license ?? ''),
        trust: 'internal',
        defaultDepartments,
        docs: [],
      };
      for (const f of fs.readdirSync(path.join(packsDir, dir)).sort()) {
        if (!f.endsWith('.md')) continue;
        const file = path.join(packsDir, dir, f);
        const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
        if (!meta.id || !meta.title) {
          errors.push(`doc ${dir}/${f}: id and title are required`);
          continue;
        }
        pack.docs.push({ id: meta.id, packId: pack.id, title: meta.title, tags: list(meta.tags), engineVersions: parseEngineVersions(meta.engine_versions), body, file: `packs/${dir}/${f}` });
      }
      packs.push(pack);
    }
  }
  const skillsDir = path.join(root, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const roleDir of fs.readdirSync(skillsDir).sort()) {
      const dir = path.join(skillsDir, roleDir);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.md')) continue;
        const s = parseSkill(path.join(dir, f), roleDir, errors);
        if (s) skills.push(s);
      }
    }
  }
  const seen = new Set<string>();
  for (const d of packs.flatMap((p) => p.docs)) {
    if (seen.has(d.id)) errors.push(`duplicate doc id ${d.id}`);
    seen.add(d.id);
  }
  const skillIds = new Set<string>();
  for (const s of skills) {
    if (skillIds.has(s.id)) errors.push(`duplicate skill id ${s.id}`);
    skillIds.add(s.id);
  }
  return { root, packs, skills, errors };
}
