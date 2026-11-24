import type { ServerInfo } from '@pixel/shared';
import { config } from './config.js';
import { aiHealth } from './agents/health.js';
import { playtestHealth } from './agents/playtest.js';

export function serverInfo(): ServerInfo {
  return {
    aiMode: config.aiMode,
    aiReason: aiHealth.state === 'ready' ? config.aiReason : aiHealth.detail,
    ai: { ...aiHealth },
    credentialHint: config.credentialHint,
    workspacesDir: config.workspacesDir,
    previewPort: config.previewPort,
    playtest: { ...playtestHealth },
    model: config.model,
    maxConcurrentAgents: config.maxConcurrentAgents,
    bashEnabled: config.bashEnabled,
    version: config.version,
  };
}
