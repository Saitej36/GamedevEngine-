import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import express from 'express';
import { REPO_ROOT } from '../src/config.js';
import { openDb } from '../src/db/db.js';
import { Store } from '../src/db/store.js';
import { Hub } from '../src/events/hub.js';
import { Studio } from '../src/orchestrator/studio.js';
import { runtime, type RunOptions, type RunResult } from '../src/agents/runner.js';
import { apiRouter } from '../src/routes/api.js';
import { runPlaytest } from '../src/agents/playtest.js';
import { startPreviewServer } from '../src/workspace/preview.js';
import { aiHealth } from '../src/agents/health.js';
import { workspaceRoot } from '../src/workspace/workspace.js';

const res = (over: Partial<RunResult>): RunResult => ({ ok: true, sessionId: 's', text: 'Done. All features work.', costUsd: 0.01, costAvailable: true, usage: null, durationMs: null, model: null, turns: 1, files: [], error: '', aborted: false, ...over });
const wait = async (fn: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  assert.ok(fn());
};
function setup(runner: (o: RunOptions) => Promise<RunResult>) {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  const studio = new Studio(store, hub, runner, () => true);
  const project = studio.createProject({ name: 'Real', genre: '', brief: '', repoUrl: '' });
  return { store, hub, studio, project };
}

test('truth: a run that claims success but wrote no file is FAILED, never completed', async () => {
  const { store, studio, project } = setup(async (o) => res(o.agentId === 'programmer' ? { files: ['src/main.js'] } : {}));
  const t = studio.createTask({ projectId: project.id, title: 'Game', description: 'Write the game', assignee: 'programmer', createdBy: 'user' });
  await wait(() => store.getTask(t.id).status === 'failed');
  const failed = store.getTask(t.id);
  assert.match(failed.error, /no output file exists in the project workspace/);
  assert.deepEqual(failed.files, [], 'claimed-but-missing files are not recorded');
  assert.ok(!store.listReviews(t.id).length, 'never sent to review');
});

test('truth: only files that exist are recorded, and a file deleted before completion blocks COMPLETED', async () => {
  let deleteBeforeReview = false;
  const { store, studio, project } = setup(async (o) => {
    const root = workspaceRoot(o.projectId);
    if (o.agentId === 'programmer') {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src/main.js'), 'console.log(1)');
      return res({ files: ['src/main.js', 'src/ghost.js'] });
    }
    if (deleteBeforeReview) fs.rmSync(path.join(root, 'src/main.js'));
    return res({ text: 'Approved' });
  });
  const t = studio.createTask({ projectId: project.id, title: 'Game', description: 'Write it', assignee: 'programmer', createdBy: 'user' });
  await wait(() => store.getTask(t.id).status === 'done');
  assert.deepEqual(store.getTask(t.id).files, ['src/main.js']);
  deleteBeforeReview = true;
  const t2 = studio.createTask({ projectId: project.id, title: 'Game 2', description: 'Write it', assignee: 'programmer', createdBy: 'user' });
  await wait(() => store.getTask(t2.id).status === 'failed');
  assert.match(store.getTask(t2.id).error, /Cannot complete: none of the task's output files exist/);
});

test('truth: with AI not ready, tasks stay QUEUED and no agent runs', async () => {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  let calls = 0;
  const studio = new Studio(store, hub, async () => (calls++, res({})), () => false);
  const p = studio.createProject({ name: 'Off', genre: '', brief: '', repoUrl: '' });
  const t = studio.createTask({ projectId: p.id, title: 'x', description: 'y', assignee: 'designer', createdBy: 'user' });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(store.getTask(t.id).status, 'queued');
  assert.equal(calls, 0);
  assert.throws(() => studio.startTask(t.id), /AI_MODE=off|Not checked|configuration|Claude/);
  // Test setup sets AI_MODE=off: health reports "disabled", never a fake "ready".
  assert.equal(aiHealth.state, 'disabled');
});

test('security: state-changing API calls without the studio header are refused (cross-site forgery)', async () => {
  const { store, studio, hub } = setup(async () => res({}));
  const app = express();
  app.use('/api', apiRouter(store, studio, hub));
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}/api`;
  try {
    const forged = await fetch(`${base}/projects`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"name":"x"}' });
    assert.equal(forged.status, 403);
    const ok = await fetch(`${base}/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pixel-Studio': '1' }, body: JSON.stringify({ name: 'Legit' }) });
    assert.equal(ok.status, 200);
    const info = (await (await fetch(`${base}/info`)).json()) as { ai: { state: string }; workspacesDir: unknown };
    assert.equal(info.ai.state, 'disabled');
    assert.equal(typeof info.workspacesDir, 'string');
  } finally {
    srv.close();
  }
});

test('preview: games are served read-only from the workspace on a separate origin with a locked-down CSP', async () => {
  const { project } = setup(async () => res({}));
  const root = workspaceRoot(project.id);
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>g</title>');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const srv = startPreviewServer(port);
  await new Promise((r) => (srv.listening ? r(null) : srv.once('listening', r)));
  try {
    const get = (p: string, method = 'GET') =>
      new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path: p, method }, (r) => {
          let body = '';
          r.on('data', (c) => (body += c));
          r.on('end', () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body }));
        });
        req.on('error', reject);
        req.end();
      });
    const ok = await get(`/${project.id}/index.html`);
    assert.equal(ok.status, 200);
    assert.match(String(ok.headers['content-security-policy']), /connect-src 'self'/);
    assert.match(ok.body, /<title>g<\/title>/);
    assert.equal((await get(`/${project.id}/missing.js`)).status, 404);
    assert.equal((await get(`/${project.id}/..%2F..%2Fstudio.db`)).status, 403);
    assert.equal((await get(`/${project.id}/index.html`, 'POST')).status, 405);
  } finally {
    srv.close();
  }
});

const hasPlaywright = (() => {
  for (const base of [REPO_ROOT, ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean)]) {
    try {
      createRequire(path.join(base, 'x.js')).resolve(base === REPO_ROOT ? 'playwright' : path.join(base, 'playwright'));
      return true;
    } catch {
      /* next */
    }
  }
  return false;
})();

test('playtest: the game really runs in a browser; input, probes, errors and blocked network are reported', { skip: !hasPlaywright && 'Playwright not installed' }, async () => {
  const { project } = setup(async () => res({}));
  const root = workspaceRoot(project.id);
  fs.mkdirSync(path.join(root, 'public/vendor'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'node_modules/phaser/dist/phaser.min.js'), path.join(root, 'public/vendor/phaser.min.js'));
  fs.writeFileSync(
    path.join(root, 'index.html'),
    `<!doctype html><title>t</title><script src="public/vendor/phaser.min.js"></script><script>
window.x = 0;
new Phaser.Game({ type: Phaser.CANVAS, width: 200, height: 100, scene: { create() { this.k = this.input.keyboard.createCursorKeys(); }, update() { if (this.k.right.isDown) window.x++; } } });
</script><script src="https://example.com/tracker.js"></script>`,
  );
  const r = await runPlaytest(root, {
    screenshotDir: 'qa/playtests',
    actions: [
      { type: 'probe', expression: 'window.x' },
      { type: 'key', key: 'ArrowRight', ms: 500 },
      { type: 'probe', expression: 'window.x > 5' },
      { type: 'probe', expression: 'Phaser.VERSION' },
      { type: 'probe', expression: 'undefinedThing.y' },
    ],
  });
  assert.equal(r.loaded, true);
  assert.deepEqual(r.canvas, { width: 200, height: 100 });
  assert.equal(r.steps[0].result, '0');
  assert.equal(r.steps[2].result, 'true', 'holding ArrowRight changed game state');
  assert.equal(r.steps[3].result, '"3.90.0"');
  assert.match(r.steps[4].result, /THROWN: ReferenceError/);
  assert.deepEqual(r.blockedExternalRequests, ['https://example.com/tracker.js']);
  assert.equal(r.ok, false, 'blocked/failed loads make the run not-ok');
  assert.ok(fs.existsSync(path.join(root, r.screenshots[0])));
  // A broken game reports the real page error.
  fs.writeFileSync(path.join(root, 'broken.html'), '<!doctype html><script>nope(</script>');
  const b = await runPlaytest(root, { entry: 'broken.html', screenshotDir: 'qa/playtests' });
  assert.ok(b.pageErrors.some((e) => /SyntaxError/.test(e)));
  assert.equal(b.ok, false);
});
