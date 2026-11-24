import { useEffect, useRef } from 'react';
import type { AgentId } from '@pixel/shared';
import { AGENT_IDS } from '@pixel/shared';
import type { NpcView, OfficeGameHandle } from '../game/bridge';
import { createOfficeGame } from '../game/OfficeGame';
import { useStudio } from '../state/store';
import { openDemo, recheckAi, retryConnection } from '../state/controller';

/** Hosts the Phaser office and feeds it agent state from the store. */
export function OfficeView() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<OfficeGameHandle | null>(null);
  const mode = useStudio((s) => s.mode);
  const info = useStudio((s) => s.info);
  const connectionError = useStudio((s) => s.connectionError);

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
          <strong>SIMULATED DEMO (selected by you)</strong> — nothing here is real work and no files are produced.
          <button className="btn small" onClick={() => retryConnection()}>Leave demo</button>
        </div>
      )}
      {mode === 'disconnected' && (
        <div className="office-banner error">
          <span className="banner-text">
            <strong>STUDIO SERVER NOT REACHABLE</strong> — {connectionError || 'no response from /api'}. Start it with <code>npm run dev</code> (or{' '}
            <code>npm start</code>) in the repository and retry. No work can run until it is connected.
          </span>
          <button className="btn small" onClick={() => retryConnection()}>Retry</button>
          <button className="btn small ghost" onClick={() => openDemo()}>Open simulated demo</button>
        </div>
      )}
      {mode === 'live' && info && info.ai.state !== 'ready' && (
        <div className={`office-banner ${info.ai.state === 'error' ? 'error' : 'warn'}`}>
          {info.ai.state === 'error' && (
            <span className="banner-text">
              <strong>AI CONFIGURATION ERROR</strong> — {info.ai.detail} Tasks stay queued until this is fixed.
            </span>
          )}
          {info.ai.state === 'disabled' && (
            <>
              <strong>AI DISABLED</strong> — {info.ai.detail}. No agent will run.
            </>
          )}
          {(info.ai.state === 'checking' || info.ai.state === 'unchecked') && (
            <>
              <strong>CHECKING CLAUDE AGENT SDK…</strong> — starting a test session before any task runs.
            </>
          )}
          {info.ai.state !== 'checking' && info.ai.state !== 'disabled' && (
            <button className="btn small" onClick={() => recheckAi()}>
              Re-check
            </button>
          )}
        </div>
      )}
      <div className="office-hint">Click an employee to open their profile · scroll to zoom · drag to pan</div>
    </div>
  );
}
