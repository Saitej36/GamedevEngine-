import type { AgentEventType, AgentStatus } from './types.js';

/**
 * The single place where real-time events become NPC behaviour.
 * Both the live WebSocket feed and the offline simulation go through this table.
 */
export interface EventAnimation {
  /** Status the agent named in the event switches to. */
  status: AgentStatus;
  /** Optional icon shown in the NPC's speech bubble. */
  bubble: string;
  /** If set, the status reverts to `idle` after this many ms. */
  revertAfterMs?: number;
}

export const EVENT_ANIMATION: Record<AgentEventType, EventAnimation> = {
  task_created: { status: 'working', bubble: '📝', revertAfterMs: 2500 },
  task_assigned: { status: 'meeting', bubble: '📋' },
  task_started: { status: 'working', bubble: '💻' },
  agent_working: { status: 'working', bubble: '⌨️' },
  file_created: { status: 'working', bubble: '📄' },
  task_completed: { status: 'celebrating', bubble: '🎉', revertAfterMs: 3500 },
  approval_required: { status: 'blocked', bubble: '❗' },
  task_failed: { status: 'error', bubble: '⚠️', revertAfterMs: 8000 },
  agent_idle: { status: 'idle', bubble: '' },
};

/** Tool name → animation used while an agent is running that tool. */
export function statusForTool(toolName: string): AgentStatus {
  if (/^(Read|Glob|Grep|LS|WebFetch|WebSearch)$/.test(toolName)) return 'reading';
  if (/review|get_project|list_tasks/i.test(toolName)) return 'reading';
  if (/create_task|delegate|request_approval|add_milestone/i.test(toolName)) return 'meeting';
  return 'working';
}
