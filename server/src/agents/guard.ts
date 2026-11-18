import type { AgentProfile } from '@pixel/shared';
import { config } from '../config.js';
import { resolveInside, toPosixRel } from '../workspace/workspace.js';

export type GuardDecision = { allow: true } | { allow: false; reason: string };

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const PATH_KEYS = ['file_path', 'path', 'notebook_path'];

/** Commands that are never allowed even when shell access is enabled. */
const BASH_DENY: RegExp[] = [
  /\bsudo\b/,
  /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)/i,
  /\b(curl|wget)\b[^|]*\|\s*(ba)?sh/,
  /\b(ssh|scp|rsync|nc|ncat|telnet)\b/,
  /\bgit\s+(push|remote)\b/,
  /\bnpm\s+publish\b/,
  /(^|[\s'"=])\.\.(\/|$)/,
  /(^|\s)\/(etc|root|home|usr|var|proc|sys)\b/,
  /\b(env|printenv)\b/,
  /ANTHROPIC|_TOKEN|API_KEY/i,
];

function isWritable(rel: string, writable: string[]) {
  return writable.some((d) => rel === d || rel.startsWith(d.replace(/\/$/, '') + '/'));
}

/**
 * Central permission policy for every tool call an agent makes. Used both from the
 * SDK's canUseTool callback and from a PreToolUse hook (hooks run even for tools the
 * SDK would otherwise auto-approve), so the policy cannot be bypassed.
 */
export function checkToolUse(
  agent: AgentProfile,
  root: string,
  toolName: string,
  input: Record<string, unknown>,
  extraAllowed: string[] = [],
): GuardDecision {
  if (extraAllowed.includes(toolName)) return { allow: true };
  if (toolName.startsWith('mcp__')) return { allow: false, reason: `${toolName} is not available to ${agent.title}` };

  if (READ_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName)) {
    if (!agent.tools.includes(toolName) && !(toolName === 'MultiEdit' && agent.tools.includes('Edit')))
      return { allow: false, reason: `${agent.title} does not have the ${toolName} tool` };
    for (const key of PATH_KEYS) {
      const v = input[key];
      if (typeof v !== 'string' || !v) continue;
      let abs: string;
      try {
        abs = resolveInside(root, v);
      } catch {
        return { allow: false, reason: `Access outside the project workspace is not allowed (${v}).` };
      }
      if (WRITE_TOOLS.has(toolName)) {
        const rel = toPosixRel(root, abs);
        if (!isWritable(rel, agent.writableDirs))
          return {
            allow: false,
            reason: `${agent.title} may only write under: ${agent.writableDirs.join(', ')}. Rejected: ${rel}`,
          };
      }
    }
    return { allow: true };
  }

  if (toolName === 'Bash') {
    if (!agent.canUseBash || !config.bashEnabled)
      return { allow: false, reason: 'Shell access is disabled for this agent (ALLOW_AGENT_BASH=false).' };
    const cmd = String(input.command ?? '');
    const hit = BASH_DENY.find((re) => re.test(cmd));
    if (hit) return { allow: false, reason: `Command blocked by studio policy (${hit}).` };
    return { allow: true };
  }

  if (toolName === 'TodoWrite') return { allow: true };
  return { allow: false, reason: `${toolName} is not permitted in Pixel Studio.` };
}

export const ALWAYS_DISALLOWED = ['WebFetch', 'WebSearch', 'Task', 'Agent', 'KillShell', 'BashOutput'];

export function toolsFor(agent: AgentProfile): string[] {
  const tools = [...agent.tools];
  if (agent.canUseBash && config.bashEnabled) tools.push('Bash');
  return tools;
}

export { isWritable };
