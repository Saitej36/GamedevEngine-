import type { AgentId, AgentStatus } from '@pixel/shared';

/** What the office needs to know about one employee to animate them. */
export interface NpcView {
  agentId: AgentId;
  status: AgentStatus;
  /** Short line shown in the hover tooltip / bubble ("Writing src/player.ts"). */
  activity: string;
  /** Emoji shown in the speech bubble; empty string hides it. */
  bubble: string;
  /** True when the state comes from a real agent run (vs ambient simulation). */
  live: boolean;
}

export interface OfficeGameOptions {
  onSelectAgent: (id: AgentId | null) => void;
}

/** Public surface of the Phaser office used by React. */
export interface OfficeGameHandle {
  update(views: Record<AgentId, NpcView>): void;
  focus(id: AgentId | null): void;
  destroy(): void;
}
