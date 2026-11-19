import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config, REPO_ROOT } from './config.js';
import { openDb } from './db/db.js';
import { Store } from './db/store.js';
import { Hub } from './events/hub.js';
import { Studio } from './orchestrator/studio.js';
import { runtime } from './agents/runner.js';
import { apiRouter } from './routes/api.js';
import { log } from './util.js';
import { KnowledgeService } from './knowledge/service.js';
import { KnowledgeStore } from './knowledge/store.js';
import { workspaceRoot } from './workspace/workspace.js';

const db = openDb();
const store = new Store(db);
const hub = new Hub(store);
runtime.hub = hub;
const knowledge = new KnowledgeService(new KnowledgeStore(db), {
  root: path.join(REPO_ROOT, 'knowledge'),
  projectRoot: workspaceRoot,
  githubToken: process.env.GITHUB_TOKEN,
});
const studio = new Studio(store, hub, undefined, undefined, knowledge);

const app = express();
app.disable('x-powered-by');
app.use('/api', apiRouter(store, studio, hub));

// Serve the built client in production.
const clientDist = path.join(REPO_ROOT, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  hub.attach(ws, {
    kind: 'hello',
    info: {
      aiMode: config.aiMode,
      aiReason: config.aiReason,
      model: config.model,
      maxConcurrentAgents: config.maxConcurrentAgents,
      bashEnabled: config.bashEnabled,
      version: config.version,
    },
    agents: store.listAgentStates(),
  });
});

studio.recover();

server.listen(config.port, () => {
  log.info(`Pixel Studio server on http://localhost:${config.port}`);
  log.info(`AI mode: ${config.aiMode} (${config.aiReason}); model ${config.model}`);
  log.info(`Workspaces: ${config.workspacesDir}`);
});

const shutdown = () => {
  log.info('shutting down');
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
