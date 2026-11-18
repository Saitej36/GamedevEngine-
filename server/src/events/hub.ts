import type { WebSocket } from 'ws';
import type { AgentEvent, AgentEventType, AgentId, AgentState, AgentStatus, ServerMessage } from '@pixel/shared';
import { EVENT_ANIMATION } from '@pixel/shared';
import type { Store } from '../db/store.js';
import { log, newId, nowIso } from '../util.js';

interface Client {
  ws: WebSocket;
  projectId: string | null;
}

/**
 * Real-time hub: persists agent events, keeps the agent state table in sync and
 * pushes everything to WebSocket subscribers.
 */
export class Hub {
  private clients = new Set<Client>();
  private revertTimers = new Map<AgentId, NodeJS.Timeout>();

  constructor(private store: Store) {}

  attach(ws: WebSocket, hello: ServerMessage) {
    const client: Client = { ws, projectId: null };
    this.clients.add(client);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.kind === 'subscribe') client.projectId = typeof msg.projectId === 'string' ? msg.projectId : null;
        if (msg?.kind === 'ping') ws.send(JSON.stringify({ kind: 'pong' }));
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on('close', () => this.clients.delete(client));
    ws.on('error', () => this.clients.delete(client));
    ws.send(JSON.stringify(hello));
  }

  /** Send to all clients; project-scoped messages only reach subscribers of that project. */
  broadcast(msg: ServerMessage, projectId: string | null = null) {
    const data = JSON.stringify(msg);
    for (const c of this.clients) {
      if (projectId && c.projectId && c.projectId !== projectId) continue;
      if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
    }
  }

  /** Emit one of the spec'd agent events, persist it and update the agent's animation state. */
  emit(
    type: AgentEventType,
    p: {
      projectId: string | null;
      agentId: AgentId | null;
      taskId?: string | null;
      message: string;
      data?: Record<string, unknown>;
      /** Override the status from the event → animation table (e.g. reading vs working). */
      status?: AgentStatus;
    },
  ): AgentEvent {
    const event: AgentEvent = {
      id: newId('evt'),
      type,
      projectId: p.projectId,
      agentId: p.agentId,
      taskId: p.taskId ?? null,
      message: p.message,
      data: { ...(p.data ?? {}), ...(p.status ? { status: p.status } : {}) },
      createdAt: nowIso(),
    };
    try {
      this.store.addEvent(event);
    } catch (e) {
      log.error('failed to persist event', e);
    }
    this.broadcast({ kind: 'event', event }, event.projectId);

    if (p.agentId) {
      const anim = EVENT_ANIMATION[type];
      const status = p.status ?? anim.status;
      const keepTask = type !== 'agent_idle';
      this.setAgent(p.agentId, {
        status,
        activity: p.message,
        currentTaskId: keepTask ? (p.taskId ?? this.current(p.agentId)?.currentTaskId ?? null) : null,
        projectId: p.projectId,
      });
      if (anim.revertAfterMs) {
        const agentId = p.agentId;
        this.clearRevert(agentId);
        this.revertTimers.set(
          agentId,
          setTimeout(() => {
            const cur = this.current(agentId);
            // Only revert if nothing newer happened meanwhile.
            if (cur && cur.status === status) this.setAgent(agentId, { status: 'idle', activity: '', currentTaskId: null });
          }, anim.revertAfterMs),
        );
      } else {
        this.clearRevert(p.agentId);
      }
    }
    return event;
  }

  private clearRevert(agentId: AgentId) {
    const t = this.revertTimers.get(agentId);
    if (t) clearTimeout(t);
    this.revertTimers.delete(agentId);
  }

  current(agentId: AgentId): AgentState | undefined {
    return this.store.listAgentStates().find((a) => a.agentId === agentId);
  }

  setAgent(agentId: AgentId, patch: Partial<Omit<AgentState, 'agentId' | 'updatedAt'>>) {
    const cur = this.current(agentId);
    const next = this.store.setAgentState({
      agentId,
      status: patch.status ?? cur?.status ?? 'idle',
      activity: patch.activity ?? cur?.activity ?? '',
      currentTaskId: patch.currentTaskId !== undefined ? patch.currentTaskId : (cur?.currentTaskId ?? null),
      projectId: patch.projectId !== undefined ? patch.projectId : (cur?.projectId ?? null),
    });
    this.broadcast({ kind: 'agent_state', state: next });
  }
}
