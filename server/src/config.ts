import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');

/** Minimal .env loader (no dependency). Existing env vars win. */
function loadDotEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^['"]|['"]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadDotEnv(path.join(REPO_ROOT, '.env'));

const env = process.env;

function bool(v: string | undefined, dflt: boolean) {
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(v);
}

const claudeConfigDir = env.CLAUDE_CONFIG_DIR || path.join(env.HOME || env.USERPROFILE || '', '.claude');
/**
 * Credentials we can see. Only a hint: on macOS a Claude Code login lives in the Keychain, so the real answer
 * comes from the startup preflight (a minimal real Agent SDK call), never from this guess.
 */
const credentialHint = env.ANTHROPIC_API_KEY
  ? 'ANTHROPIC_API_KEY'
  : env.ANTHROPIC_AUTH_TOKEN
    ? 'ANTHROPIC_AUTH_TOKEN'
    : env.CLAUDE_CODE_OAUTH_TOKEN
      ? 'CLAUDE_CODE_OAUTH_TOKEN'
      : env.CLAUDE_CODE_USE_BEDROCK || env.CLAUDE_CODE_USE_VERTEX || env.CLAUDE_CODE_USE_FOUNDRY
        ? 'cloud provider (Bedrock/Vertex/Foundry)'
        : fs.existsSync(path.join(claudeConfigDir, '.credentials.json'))
          ? `Claude Code login (${claudeConfigDir})`
          : '';

/**
 * LIVE is the normal mode. The studio is offline only when the owner explicitly sets AI_MODE=off;
 * it never falls back to offline or simulated work on its own.
 */
const aiModeSetting = (env.AI_MODE ?? 'live').toLowerCase();

export const config = {
  port: Number(env.PORT ?? 8787),
  /** Separate origin for playing generated games (never the app's own origin). */
  previewPort: Number(env.PREVIEW_PORT ?? Number(env.PORT ?? 8787) + 1),
  dataDir: path.resolve(REPO_ROOT, env.DATA_DIR ?? 'data'),
  get dbPath() {
    return path.join(this.dataDir, 'studio.db');
  },
  get workspacesDir() {
    return path.resolve(env.WORKSPACES_DIR ?? path.join(this.dataDir, 'workspaces'));
  },
  /** 'live' runs real Claude agents; 'offline' (only with AI_MODE=off) never calls the model. */
  aiMode: (aiModeSetting === 'off' ? 'offline' : 'live') as 'live' | 'offline',
  aiReason: aiModeSetting === 'off' ? 'AI_MODE=off in .env (explicitly disabled by the owner)' : 'Claude Agent SDK',
  credentialHint,
  /** One minimal real Agent SDK call at startup proves authentication works (fractions of a cent). */
  aiPreflight: bool(env.AI_PREFLIGHT, true),
  model: env.AGENT_MODEL ?? 'claude-opus-5-5',
  maxConcurrentAgents: Math.max(1, Number(env.MAX_CONCURRENT_AGENTS ?? 2)),
  maxTurnsPerTask: Number(env.MAX_TURNS_PER_TASK ?? 40),
  maxBudgetUsdPerTask: Number(env.MAX_BUDGET_USD_PER_TASK ?? 2),
  maxRevisions: Number(env.MAX_REVISIONS ?? 2),
  /** Shell access for Programmer/QA. Off by default: Bash can reach outside the workspace. */
  bashEnabled: bool(env.ALLOW_AGENT_BASH, false),
  /** Director auto-reviews each deliverable before it is marked done. */
  autoReview: bool(env.DIRECTOR_AUTO_REVIEW, true),
  /** Start queued tasks automatically (otherwise the user presses "Run"). */
  autoRun: bool(env.AUTO_RUN_TASKS, true),
  version: '0.1.0',
};

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.workspacesDir, { recursive: true });
