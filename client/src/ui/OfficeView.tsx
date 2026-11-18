import { useEffect, useRef } from 'react';
import type { AgentId } from '@pixel/shared';
import { AGENT_IDS } from '@pixel/shared';
import type { NpcView, OfficeGameHandle } from '../game/bridge';
import { createOfficeGame } from '../game/OfficeGame';
import { useStudio } from '../state/store';
import { retryConnection } from '../state/controller';

/** Hosts the Phaser office and feeds it agent state from the store. */
export function OfficeView() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<OfficeGameHandle | null>(null);
  const mode = useStudio((s) => s.mode);
  const info = useStudio((s) => s.info);

  useEffect(() => {
    if (!host.current) return;
    const g = createOfficeGame(host.current, { onSelectAgent: (id) => useStudio.getState().selectAgent(id) });
    game.current = g;

    const push = () => {
      const s = useStudio.getState();
      const now = Date.now();
      const views = {} as Record<AgentId, NpcView>;
      for (const id of AGENT_IDS) {
        const st = s.agents[id];
        const b = s.bubbles[id];
        const transient = b && b.until > now ? b.emoji : '';
        const sticky = st.status === 'blocked' ? '❗' : st.status === 'error' ? '⚠️' : '';
        views[id] = {
          agentId: id,
          status: st.status,
          activity: st.activity,
          bubble: sticky || transient,
          live: s.mode === 'live' && st.status !== 'idle',
        };
      }
      g.update(views);
    };
    push();
    const unsub = useStudio.subscribe((s, prev) => {
      if (s.agents !== prev.agents || s.bubbles !== prev.bubbles || s.mode !== prev.mode) push();
      if (s.selectedAgent !== prev.selectedAgent) g.focus(s.selectedAgent);
    });
    const tick = window.setInterval(push, 1000); // expire bubbles
    return () => {
      unsub();
      window.clearInterval(tick);
      g.destroy();
      game.current = null;
    };
  }, []);

  return (
    <div className="office">
      <div className="office-canvas" ref={host} />
      {mode === 'demo' && (
        <div className="office-banner demo">
          <strong>SIMULATED DEMO</strong> — backend not reachable; agent activity below is simulated and produces no files.
          <button className="btn small" onClick={() => retryConnection()}>Retry connection</button>
        </div>
      )}
      {mode === 'live' && info?.aiMode === 'offline' && (
        <div className="office-banner warn">
          <strong>AI OFFLINE</strong> — {info.aiReason} Employees roam the office (ambient simulation) until AI is enabled.
        </div>
      )}
      <div className="office-hint">Click an employee to open their profile · scroll to zoom · drag to pan</div>
    </div>
  );
}
