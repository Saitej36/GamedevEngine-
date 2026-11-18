import type { ClientMessage, ServerMessage } from '@pixel/shared';

type Listener = (msg: ServerMessage) => void;
type StatusListener = (connected: boolean) => void;

/** Auto-reconnecting WebSocket client for the studio event stream. */
export class StudioSocket {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private retry = 0;
  private closed = false;
  private pingTimer: number | undefined;

  constructor(
    private onMessage: Listener,
    private onStatus: StatusListener,
  ) {}

  connect() {
    this.closed = false;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus(true);
      this.send({ kind: 'subscribe', projectId: this.projectId });
      this.pingTimer = window.setInterval(() => this.send({ kind: 'ping' }), 25000);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && typeof msg.kind === 'string' && msg.kind !== 'pong') this.onMessage(msg as ServerMessage);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      window.clearInterval(this.pingTimer);
      this.onStatus(false);
      if (this.closed) return;
      const delay = Math.min(10000, 500 * 2 ** this.retry++);
      window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  subscribe(projectId: string | null) {
    this.projectId = projectId;
    this.send({ kind: 'subscribe', projectId });
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    window.clearInterval(this.pingTimer);
    this.ws?.close();
  }
}
