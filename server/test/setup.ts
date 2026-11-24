import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must run before any server module reads config.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-test-'));
process.env.DATA_DIR = dir;
process.env.AI_MODE = 'off';
process.env.ALLOW_AGENT_BASH = 'true';
export const TMP = dir;

/**
 * Stand-in agents must produce real output: the studio refuses to accept a "successful" run whose files do
 * not exist. Writes one deliverable into the agent's own folder and returns its workspace-relative path.
 */
export async function deliver(o: { agentId: string; projectId: string; taskId: string | null }): Promise<string[]> {
  if (o.agentId === 'director' || !o.taskId) return [];
  const { AGENTS } = await import('@pixel/shared');
  const { workspaceRoot } = await import('../src/workspace/workspace.js');
  const dir = AGENTS[o.agentId as keyof typeof AGENTS].writableDirs.find((d) => !d.includes('.')) ?? 'docs';
  const rel = `${dir}/${o.taskId}-${o.agentId}.md`;
  const abs = path.join(workspaceRoot(o.projectId), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `# Output of ${o.taskId}\n`);
  return [rel];
}
