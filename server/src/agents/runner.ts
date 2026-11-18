import {
  query,
  type HookCallback,
  type McpServerConfig,
  type Options,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { AgentId, AgentStatus } from '@pixel/shared';
import { AGENTS, statusForTool } from '@pixel/shared';
import { config } from '../config.js';
import type { Hub } from '../events/hub.js';
import { diffSnapshots, resolveInside, snapshot, toPosixRel, workspaceRoot } from '../workspace/workspace.js';
import { errorMessage, log, truncate } from '../util.js';
import { ALWAYS_DISALLOWED, checkToolUse, toolsFor } from './guard.js';

export interface RunOptions {
  agentId: AgentId;
  projectId: string;
  taskId: string | null;
  prompt: string;
  systemPrompt: string;
  /** Resume a previous Agent SDK session (keeps the agent's memory of earlier turns). */
  resume?: string | null;
  mcpServers?: Record<string, McpServerConfig>;
  /** MCP tool names auto-approved for this run (e.g. the Director's studio tools). */
  mcpTools?: string[];
  abort?: AbortController;
  effort?: Options['effort'];
  /** Status used while the model is thinking/writing text (default "working"). */
  thinkingStatus?: AgentStatus;
  /** Called as soon as the SDK announces the session id (before the run finishes). */
  onSession?: (sessionId: string) => void;
}

export interface RunResult {
  ok: boolean;
  sessionId: string | null;
  text: string;
  /** Cost reported by the SDK result message; 0 when `costAvailable` is false. */
  costUsd: number;
  /** False when the run ended without a result message (crash, abort), so its cost is unknown. */
  costAvailable: boolean;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number } | null;
  durationMs: number | null;
  model: string | null;
  turns: number;
  files: string[];
  error: string;
  aborted: boolean;
}

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

function describeTool(name: string, input: Record<string, unknown>, root: string): string {
  const p = (input.file_path ?? input.path ?? input.notebook_path) as string | undefined;
  const rel = p ? safeRel(root, p) : '';
  switch (name) {
    case 'Write':
      return `Writing ${rel}`;
    case 'Edit':
    case 'MultiEdit':
      return `Editing ${rel}`;
    case 'Read':
      return `Reading ${rel}`;
    case 'Glob':
      return `Browsing files (${String(input.pattern ?? '')})`;
    case 'Grep':
      return `Searching for "${truncate(String(input.pattern ?? ''), 40)}"`;
    case 'Bash':
      return `Running: ${truncate(String(input.command ?? ''), 60)}`;
    case 'TodoWrite':
      return 'Planning steps';
    default: {
      const short = name.replace(/^mcp__studio__/, '');
      if (short === 'create_task') return `Delegating "${truncate(String(input.title ?? ''), 48)}" to ${input.assignee}`;
      if (short === 'review_task') return `Reviewing deliverable (${input.decision})`;
      if (short === 'request_approval') return `Asking the owner: ${truncate(String(input.title ?? ''), 48)}`;
      if (short === 'add_milestone') return `Planning milestone "${truncate(String(input.title ?? ''), 40)}"`;
      if (short === 'get_project_status') return 'Checking project status';
      return `Using ${short}`;
    }
  }
}

function safeRel(root: string, p: string) {
  try {
    return toPosixRel(root, resolveInside(root, p));
  } catch {
    return p;
  }
}

/**
 * Runs one Claude Agent SDK session for a studio employee, streaming its tool use to
 * the hub as `agent_working` / `file_created` events. All tool calls go through the
 * studio permission guard (workspace sandbox + per-role write folders).
 */
export async function runAgent(o: RunOptions): Promise<RunResult> {
  const agent = AGENTS[o.agentId];
  const root = workspaceRoot(o.projectId);
  const before = snapshot(o.projectId);
  const abort = o.abort ?? new AbortController();
  const mcpTools = o.mcpTools ?? [];
  const pendingFiles = new Map<string, { path: string; tool: string }>();
  const emitted = new Set<string>();
  const hub = runtime.hub;

  const guardHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    const d = checkToolUse(agent, root, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>, mcpTools);
    if (d.allow) return {};
    log.warn(`[guard] ${o.agentId} denied ${input.tool_name}: ${d.reason}`);
    return {
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.reason },
    };
  };

  const options: Options = {
    cwd: root,
    model: config.model,
    systemPrompt: o.systemPrompt,
    tools: toolsFor(agent),
    allowedTools: mcpTools,
    disallowedTools: [...ALWAYS_DISALLOWED, ...(toolsFor(agent).includes('Bash') ? [] : ['Bash'])],
    permissionMode: 'default',
    settingSources: [],
    mcpServers: o.mcpServers,
    maxTurns: config.maxTurnsPerTask,
    maxBudgetUsd: config.maxBudgetUsdPerTask,
    effort: o.effort ?? 'medium',
    abortController: abort,
    resume: o.resume ?? undefined,
    canUseTool: async (toolName, input) => {
      const d = checkToolUse(agent, root, toolName, input, mcpTools);
      return d.allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: d.reason };
    },
    hooks: { PreToolUse: [{ hooks: [guardHook] }] },
    stderr: (data: string) => {
      if (/error/i.test(data)) log.warn(`[${o.agentId} stderr]`, truncate(data.trim(), 400));
    },
  };

  const result: RunResult = {
    ok: false,
    sessionId: null,
    text: '',
    costUsd: 0,
    costAvailable: false,
    usage: null,
    durationMs: null,
    model: null,
    turns: 0,
    files: [],
    error: '',
    aborted: false,
  };
  const texts: string[] = [];

  const working = (message: string, status: AgentStatus, data: Record<string, unknown> = {}) =>
    hub.emit('agent_working', { projectId: o.projectId, agentId: o.agentId, taskId: o.taskId, message, status, data });

  try {
    const q = query({ prompt: o.prompt, options });
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        result.sessionId = msg.session_id;
        result.model = msg.model ?? null;
        try {
          o.onSession?.(msg.session_id);
        } catch (e) {
          log.warn('onSession callback failed', e);
        }
      } else if (msg.type === 'assistant') {
        if (msg.parent_tool_use_id) continue;
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text.trim()) {
            texts.push(block.text);
            working(truncate(block.text.trim().replace(/\s+/g, ' '), 120), o.thinkingStatus ?? 'working', {
              kind: 'text',
            });
          } else if (block.type === 'tool_use') {
            const input = (block.input ?? {}) as Record<string, unknown>;
            const status = statusForTool(block.name);
            working(describeTool(block.name, input, root), status, { kind: 'tool', tool: block.name });
            if (FILE_TOOLS.has(block.name)) {
              const p = String(input.file_path ?? input.notebook_path ?? '');
              if (p) pendingFiles.set(block.id, { path: safeRel(root, p), tool: block.name });
            }
          }
        }
      } else if (msg.type === 'user') {
        const content = msg.message.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
          if (block.type !== 'tool_result') continue;
          const pending = pendingFiles.get(block.tool_use_id);
          if (!pending) continue;
          pendingFiles.delete(block.tool_use_id);
          if (block.is_error) continue;
          if (!emitted.has(pending.path)) {
            emitted.add(pending.path);
            hub.emit('file_created', {
              projectId: o.projectId,
              agentId: o.agentId,
              taskId: o.taskId,
              message: `${pending.tool === 'Write' ? 'Created' : 'Updated'} ${pending.path}`,
              data: { path: pending.path, tool: pending.tool },
            });
          }
          hub.broadcast({ kind: 'files_changed', projectId: o.projectId }, o.projectId);
        }
      } else if (msg.type === 'result') {
        result.costAvailable = typeof msg.total_cost_usd === 'number';
        result.costUsd = msg.total_cost_usd ?? 0;
        result.turns = msg.num_turns;
        result.durationMs = msg.duration_ms;
        result.usage = {
          inputTokens: msg.usage?.input_tokens ?? 0,
          outputTokens: msg.usage?.output_tokens ?? 0,
          cacheReadTokens: msg.usage?.cache_read_input_tokens ?? 0,
          cacheCreationTokens: msg.usage?.cache_creation_input_tokens ?? 0,
        };
        const models = Object.keys(msg.modelUsage ?? {});
        if (models.length) result.model = models.join(', ');
        result.sessionId = msg.session_id ?? result.sessionId;
        if (msg.subtype === 'success' && !msg.is_error) {
          result.ok = true;
          result.text = msg.result || texts.at(-1) || '';
        } else {
          result.error =
            msg.subtype === 'success'
              ? msg.result || 'Agent reported an error'
              : msg.subtype === 'error_max_turns'
                ? `Stopped after ${config.maxTurnsPerTask} turns without finishing`
                : msg.subtype === 'error_max_budget_usd'
                  ? `Stopped at the $${config.maxBudgetUsdPerTask} budget limit for one task`
                  : 'Agent execution error';
          result.text = texts.at(-1) ?? '';
        }
      }
    }
  } catch (e) {
    result.aborted = abort.signal.aborted;
    result.error = result.aborted ? 'Cancelled' : errorMessage(e);
    log.error(`[${o.agentId}] run failed:`, result.error);
  }

  // Ground truth for files: diff the workspace (also catches files written via Bash).
  result.files = diffSnapshots(before, snapshot(o.projectId));
  for (const f of result.files) {
    if (emitted.has(f)) continue;
    hub.emit('file_created', {
      projectId: o.projectId,
      agentId: o.agentId,
      taskId: o.taskId,
      message: `Created ${f}`,
      data: { path: f },
    });
  }
  if (result.files.length) hub.broadcast({ kind: 'files_changed', projectId: o.projectId }, o.projectId);
  return result;
}

/** Late-bound runtime services (set in index.ts) to avoid import cycles. */
export const runtime = { hub: undefined as unknown as Hub };
