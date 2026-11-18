import fs from 'node:fs';
import path from 'node:path';
import type { FileNode, Project } from '@pixel/shared';
import { config } from '../config.js';
import { HttpError } from '../util.js';

const IGNORED = new Set(['node_modules', '.git', '.DS_Store', '.claude']);

export function workspaceRoot(projectId: string): string {
  if (!/^[a-z0-9_]+$/i.test(projectId)) throw new HttpError(400, 'Invalid project id');
  return path.join(config.workspacesDir, projectId);
}

/**
 * Resolve a user/agent supplied path inside a workspace. Throws if it escapes the
 * workspace (absolute paths outside, `..` traversal, or symlinks pointing outside).
 */
export function resolveInside(root: string, p: string): string {
  const abs = path.resolve(root, p);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new HttpError(403, `Path escapes workspace: ${p}`);
  // Resolve symlinks on the deepest existing ancestor.
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== root) probe = path.dirname(probe);
  const real = fs.realpathSync(probe);
  const realRoot = fs.realpathSync(root);
  const realRel = path.relative(realRoot, real);
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new HttpError(403, `Path escapes workspace: ${p}`);
  return abs;
}

export function toPosixRel(root: string, abs: string) {
  return path.relative(root, abs).split(path.sep).join('/');
}

const SCAFFOLD_DIRS = ['docs', 'docs/art', 'docs/production', 'design', 'assets', 'src', 'tests', 'qa'];

/** Create the project's folder layout and seed the brief + GDD placeholder. */
export function initWorkspace(project: Project) {
  const root = workspaceRoot(project.id);
  for (const d of SCAFFOLD_DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
  const brief = path.join(root, 'docs', 'BRIEF.md');
  if (!fs.existsSync(brief)) fs.writeFileSync(brief, briefMarkdown(project));
  const gdd = path.join(root, 'docs', 'GDD.md');
  if (!fs.existsSync(gdd))
    fs.writeFileSync(
      gdd,
      `# ${project.name} — Game Design Document\n\n> Status: not started. Ask the Director to have the Game Designer draft this document.\n`,
    );
  const readme = path.join(root, 'README.md');
  if (!fs.existsSync(readme))
    fs.writeFileSync(
      readme,
      `# ${project.name}\n\nWorkspace produced by the Pixel Studio AI team.\n\n| Folder | Owner |\n|---|---|\n| docs/ | Director, Designer |\n| design/ | Game Designer |\n| assets/, docs/art/ | Concept Artist |\n| src/, tests/ | Game Programmer |\n| docs/production/ | Producer |\n| qa/ | QA Tester |\n` +
        (project.repoUrl ? `\nCode repository: ${project.repoUrl}\n` : ''),
    );
  return root;
}

export function briefMarkdown(p: Project) {
  return `# Project Brief — ${p.name}\n\n**Genre:** ${p.genre || 'TBD'}\n\n${p.brief || '_No brief yet._'}\n${
    p.repoUrl ? `\n**Code repository:** ${p.repoUrl}\n` : ''
  }`;
}

export function writeBrief(p: Project) {
  const root = workspaceRoot(p.id);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'BRIEF.md'), briefMarkdown(p));
}

export function fileTree(projectId: string): FileNode {
  const root = workspaceRoot(projectId);
  fs.mkdirSync(root, { recursive: true });
  const walk = (abs: string, depth: number): FileNode => {
    const st = fs.statSync(abs);
    const node: FileNode = {
      name: abs === root ? '/' : path.basename(abs),
      path: toPosixRel(root, abs),
      type: st.isDirectory() ? 'dir' : 'file',
      size: st.isDirectory() ? undefined : st.size,
      modifiedAt: st.mtime.toISOString(),
    };
    if (st.isDirectory() && depth < 12) {
      node.children = fs
        .readdirSync(abs)
        .filter((n) => !IGNORED.has(n))
        .map((n) => walk(path.join(abs, n), depth + 1))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    }
    return node;
  };
  return walk(root, 0);
}

export function countFiles(node: FileNode): number {
  if (node.type === 'file') return 1;
  return (node.children ?? []).reduce((n, c) => n + countFiles(c), 0);
}

/** Snapshot of file path → mtime, used to detect files an agent created or changed. */
export function snapshot(projectId: string): Map<string, number> {
  const out = new Map<string, number>();
  const root = workspaceRoot(projectId);
  const walk = (abs: string) => {
    if (!fs.existsSync(abs)) return;
    for (const n of fs.readdirSync(abs)) {
      if (IGNORED.has(n)) continue;
      const p = path.join(abs, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else out.set(toPosixRel(root, p), st.mtimeMs);
    }
  };
  walk(root);
  return out;
}

export function diffSnapshots(before: Map<string, number>, after: Map<string, number>) {
  const changed: string[] = [];
  for (const [p, m] of after) if (!before.has(p) || before.get(p) !== m) changed.push(p);
  return changed;
}

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.html': 'text/html',
  '.md': 'text/markdown',
};
export const mimeFor = (p: string) => MIME[path.extname(p).toLowerCase()] ?? 'text/plain';
