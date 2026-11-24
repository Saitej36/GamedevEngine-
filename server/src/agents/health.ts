import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config.js';
import { errorMessage, log, nowIso } from '../util.js';

/**
 * Real AI availability. "ready" is only set after an actual Agent SDK session answered; "error" carries
 * the SDK's own error text so the owner sees exactly what is wrong. Nothing here simulates success.
 */
export interface AiHealth {
  state: 'disabled' | 'unchecked' | 'checking' | 'ready' | 'error';
  detail: string;
  checkedAt: string | null;
  sessionId: string | null;
  costUsd: number | null;
  durationMs: number | null;
}

export const aiHealth: AiHealth = {
  state: config.aiMode === 'offline' ? 'disabled' : config.aiPreflight ? 'unchecked' : 'ready',
  detail:
    config.aiMode === 'offline' ? config.aiReason : config.aiPreflight ? 'Not checked yet' : 'Preflight disabled (AI_PREFLIGHT=false); real runs will report their own errors',
  checkedAt: null,
  sessionId: null,
  costUsd: null,
  durationMs: null,
};

const listeners = new Set<(h: AiHealth) => void>();
export const onAiHealth = (fn: (h: AiHealth) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const publish = () => listeners.forEach((fn) => fn({ ...aiHealth }));

let inflight: Promise<AiHealth> | null = null;

/** One minimal real Claude Agent SDK session: no tools, one turn, tiny prompt. */
export function checkAi(): Promise<AiHealth> {
  if (config.aiMode === 'offline') return Promise.resolve({ ...aiHealth });
  if (inflight) return inflight;
  inflight = (async () => {
    Object.assign(aiHealth, { state: 'checking', detail: 'Starting a test Agent SDK session…' });
    publish();
    const started = Date.now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 90_000);
    try {
      let text = '';
      let ok = false;
      let error = '';
      const q = query({
        prompt: 'Health check. Reply with exactly: OK',
        options: {
          model: config.model,
          systemPrompt: 'You are a health check. Reply with exactly: OK',
          tools: [],
          settingSources: [],
          maxTurns: 1,
          abortController: abort,
          permissionMode: 'default',
        },
      });
      for await (const msg of q as AsyncIterable<SDKMessage>) {
        if (msg.type === 'system' && msg.subtype === 'init') aiHealth.sessionId = msg.session_id;
        if (msg.type === 'assistant') for (const b of msg.message.content) if (b.type === 'text') text += b.text;
        if (msg.type === 'result') {
          aiHealth.costUsd = msg.total_cost_usd ?? null;
          ok = msg.subtype === 'success' && !msg.is_error;
          if (!ok) error = 'result' in msg && typeof msg.result === 'string' ? msg.result : msg.subtype;
        }
      }
      if (!ok) throw new Error(error || text || 'The Agent SDK session ended without a result');
      Object.assign(aiHealth, { state: 'ready', detail: `Agent SDK session answered (${config.model})`, checkedAt: nowIso(), durationMs: Date.now() - started });
      log.info(`AI preflight ok: session ${aiHealth.sessionId}, cost $${aiHealth.costUsd ?? '?'}`);
    } catch (e) {
      const msg = abort.signal.aborted ? 'Timed out after 90 s waiting for the Agent SDK' : errorMessage(e);
      const hint = config.credentialHint
        ? `Credentials found: ${config.credentialHint}.`
        : 'No credentials found: set ANTHROPIC_API_KEY in .env (or log in to Claude Code on this machine) and press Re-check.';
      Object.assign(aiHealth, { state: 'error', detail: `${msg} — ${hint}`, checkedAt: nowIso(), durationMs: Date.now() - started });
      log.error('AI preflight failed', msg);
    } finally {
      clearTimeout(timer);
      inflight = null;
      publish();
    }
    return { ...aiHealth };
  })();
  return inflight;
}
