import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, openDb } from '../src/db/db.js';
import { Store } from '../src/db/store.js';
import { Hub } from '../src/events/hub.js';
import { Studio } from '../src/orchestrator/studio.js';
import { runtime, type RunOptions, type RunResult } from '../src/agents/runner.js';
import { TMP } from './setup.js';

type Behaviour = (o: RunOptions) => Partial<RunResult> | Promise<Partial<RunResult>>;

function setup(behaviour: Behaviour) {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  const runner = async (o: RunOptions): Promise<RunResult> => {
    const kind = o.agentId !== 'director' ? 'task' : o.taskId ? 'review' : 'planning';
    o.onSession?.(`${kind}-session`);
    return {
      ok: true,
      sessionId: `${kind}-session`,
      text: 'done',
      costUsd: 0,
      costAvailable: true,
      usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5 },
      durationMs: 1000,
      model: 'claude-opus-5-5',
      turns: 3,
      files: [],
      error: '',
      aborted: false,
      ...(await behaviour(o)),
    };
  };
  const studio = new Studio(store, hub, runner, () => true);
  const project = studio.createProject({ name: 'T', genre: '', brief: '', repoUrl: '' });
  return { store, studio, project };
}

async function waitFor(fn: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const COSTS = { planning: 0.05, task: 0.2, review: 0.03 };
const byKind = (o: RunOptions) => (o.agentId !== 'director' ? 'task' : o.taskId ? 'review' : 'planning');

// 1. COST ACCOUNTING --------------------------------------------------------
test('cost: planning, task and review runs are recorded and aggregated per project', async () => {
  const { store, studio, project } = setup((o) => ({ costUsd: COSTS[byKind(o)] }));
  await studio.chat(project.id, 'Plan something');
  await waitFor(() => store.listRuns({ projectId: project.id }).some((r) => r.kind === 'planning' && r.status === 'ok'));
  const task = studio.createTask({ projectId: project.id, title: 'GDD', description: 'Write it', assignee: 'designer', createdBy: 'director' });
  await waitFor(() => store.getTask(task.id).status === 'done');

  const u = studio.stats(project.id).usage;
  assert.equal(u.byKind.planning, 0.05);
  assert.equal(u.byKind.task, 0.2);
  assert.equal(u.byKind.review, 0.03);
  assert.ok(Math.abs(u.knownCostUsd - 0.28) < 1e-9);
  assert.equal(studio.stats(project.id).costUsd, u.knownCostUsd);
  assert.equal(u.byStatus.actual.runs, 3);
  assert.equal(u.tokens.input, 300);
  // Task cost = its own run + the Director's review of it (planning is project-level).
  assert.ok(Math.abs(store.getTask(task.id).costUsd - 0.23) < 1e-9);
});

test('cost: a run without a reported cost is "unavailable", never counted as $0 actual', async () => {
  const { store, studio, project } = setup((o) =>
    o.agentId === 'qa' ? { ok: false, costAvailable: false, costUsd: 0, usage: null, error: 'crashed' } : {},
  );
  const task = studio.createTask({ projectId: project.id, title: 'Test', description: 'Test it', assignee: 'qa', createdBy: 'user' });
  await waitFor(() => store.getTask(task.id).status === 'failed');
  const [run] = store.listRuns({ taskId: task.id });
  assert.equal(run.costStatus, 'unavailable');
  assert.equal(run.costUsd, null);
  assert.equal(run.status, 'error');
  const u = studio.stats(project.id).usage;
  assert.equal(u.byStatus.unavailable.runs, 1);
  assert.equal(u.byStatus.actual.runs, 0);
});

// 2. SESSION PERSISTENCE ----------------------------------------------------
test('sessions: planning, task and review session ids are stored with project and task', async () => {
  const { store, studio, project } = setup(() => ({}));
  await studio.chat(project.id, 'Hi');
  const task = studio.createTask({ projectId: project.id, title: 'GDD', description: 'Write it', assignee: 'designer', createdBy: 'director' });
  await waitFor(() => store.getTask(task.id).status === 'done');
  const runs = store.listRuns({ projectId: project.id });
  const find = (kind: string) => runs.find((r) => r.kind === kind)!;
  assert.equal(find('planning').sessionId, 'planning-session');
  assert.equal(find('planning').taskId, null);
  assert.equal(find('task').sessionId, 'task-session');
  assert.equal(find('task').taskId, task.id);
  assert.equal(find('task').agentId, 'designer');
  assert.equal(find('review').sessionId, 'review-session');
  assert.equal(find('review').taskId, task.id);
  assert.equal(find('review').agentId, 'director');
  for (const r of runs) assert.equal(r.projectId, project.id);
});

test('sessions: the session id is persisted while the run is still in progress, and survives a restart', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { store, studio, project } = setup(async () => {
    await gate;
    return {};
  });
  const task = studio.createTask({ projectId: project.id, title: 'Code', description: 'Build', assignee: 'programmer', createdBy: 'user' });
  await waitFor(() => store.listRuns({ taskId: task.id }).length === 1);
  const [running] = store.listRuns({ taskId: task.id });
  assert.equal(running.status, 'running');
  assert.equal(running.sessionId, 'task-session');
  // Simulate a crash/restart before the run reports.
  assert.equal(store.interruptRunningRuns(), 1);
  const [after] = store.listRuns({ taskId: task.id });
  assert.equal(after.status, 'interrupted');
  assert.equal(after.costStatus, 'unavailable');
  assert.equal(after.sessionId, 'task-session');
  release();
});

// 3. REVIEW HISTORY ---------------------------------------------------------
test('reviews: Director notes, owner rejection, revision and owner approval are separate records', async () => {
  let reviewNo = 0;
  const { store, studio, project } = setup((o) =>
    byKind(o) === 'review' ? { text: `Director note ${++reviewNo}` } : {},
  );
  const task = studio.createTask({ projectId: project.id, title: 'Art', description: 'Style', assignee: 'artist', requiresApproval: true, createdBy: 'director' });
  await waitFor(() => store.getTask(task.id).status === 'awaiting_approval');
  const a1 = store.listApprovals(project.id).find((a) => a.status === 'pending')!;
  studio.resolveApproval(a1.id, 'rejected', 'Warmer colours please');
  await waitFor(() => store.getTask(task.id).status === 'awaiting_approval' && store.getTask(task.id).revisionCount === 1);
  const a2 = store.listApprovals(project.id).find((a) => a.status === 'pending')!;
  studio.resolveApproval(a2.id, 'approved', 'Ship it');

  const t = store.getTask(task.id);
  assert.equal(t.status, 'done');
  // The owner's final comment must not overwrite anything on the task record.
  assert.notEqual(t.feedback, 'Ship it');
  const h = studio.taskHistory(task.id).reviews.map((r) => [r.reviewer, r.decision, r.feedback, r.revision]);
  assert.deepEqual(h, [
    ['director', 'approve', 'Director note 1', 0],
    ['owner', 'rejected', 'Warmer colours please', 0],
    ['director', 'approve', 'Director note 2', 1],
    ['owner', 'approved', 'Ship it', 1],
  ]);
  const reviews = studio.taskHistory(task.id).reviews;
  assert.ok(reviews[0].runId, 'director review linked to its run');
  assert.equal(reviews[3].approvalId, a2.id);
});

// MIGRATION: existing data is preserved and backfilled ------------------------
test('migration v2 preserves v1 data and backfills runs and reviews', () => {
  const file = path.join(TMP, 'v1.db');
  const v1 = new DatabaseSync(file);
  v1.exec(MIGRATIONS[0]);
  v1.exec('CREATE TABLE schema_version (version INTEGER NOT NULL); INSERT INTO schema_version VALUES (1);');
  const t = '2026-01-01T00:00:00.000Z';
  v1.prepare(`INSERT INTO projects (id, name, director_session_id, created_at, updated_at) VALUES ('p1','Old','dir-old',?,?)`).run(t, t);
  v1.prepare(
    `INSERT INTO tasks (id, project_id, title, assignee, status, feedback, cost_usd, session_id, created_at, updated_at)
     VALUES ('t1','p1','GDD','designer','done','Owner said ok',0.78,'sess-old',?,?)`,
  ).run(t, t);
  v1.prepare(
    `INSERT INTO approvals (id, project_id, task_id, title, requested_by, status, response, created_at, resolved_at)
     VALUES ('a1','p1','t1','Sign off','director','approved','Owner said ok',?,?)`,
  ).run(t, t);
  v1.close();

  const store = new Store(openDb(file));
  const task = store.getTask('t1');
  assert.equal(task.costUsd, 0.78);
  assert.equal(task.feedback, 'Owner said ok');
  const runs = store.listRuns({ projectId: 'p1' });
  assert.deepEqual(
    runs.map((r) => [r.kind, r.sessionId, r.costUsd, r.costStatus]).sort(),
    [
      ['legacy', 'sess-old', 0.78, 'legacy_aggregate'],
      ['planning', 'dir-old', null, 'unavailable'],
    ].sort(),
  );
  const u = store.usageSummary('p1');
  assert.equal(u.knownCostUsd, 0.78);
  assert.equal(u.byStatus.legacy_aggregate.runs, 1);
  assert.equal(u.byStatus.unavailable.runs, 1);
  assert.deepEqual(
    store.listReviews('t1').map((r) => [r.reviewer, r.decision]).sort(),
    [['legacy', 'note'], ['owner', 'approved']].sort(),
  );
  // Re-opening is idempotent.
  assert.equal(new Store(openDb(file)).listRuns({ projectId: 'p1' }).length, 2);
});

// 5. RESUMED SESSIONS: the SDK reports cumulative cost ---------------------------
test('cost: a resumed session records only the increase over its previous report', async () => {
  // Fake SDK: cumulative total_cost_usd per session, like the real CLI on resume.
  const cumulative = new Map<string, number>();
  const { store, studio, project } = setup((o) => {
    const session = o.resume ?? `${o.agentId}-${o.taskId ?? 'chat'}-${cumulative.size}`;
    const add = o.agentId === 'director' ? (o.taskId ? 0.2 : 0.1) : o.resume ? 0.07 : 0.9;
    const total = (cumulative.get(session) ?? 0) + add;
    cumulative.set(session, total);
    return { sessionId: session, costUsd: total };
  });
  const t = studio.createTask({ projectId: project.id, title: 'GDD', description: 'g', assignee: 'designer', requiresApproval: true, createdBy: 'director' });
  await waitFor(() => store.getTask(t.id).status === 'awaiting_approval');
  const ap = store.listApprovals(project.id).find((a) => a.status === 'pending')!;
  studio.resolveApproval(ap.id, 'rejected', 'Fix the numbers');
  await waitFor(() => store.getTask(t.id).status === 'awaiting_approval' && store.getTask(t.id).revisionCount === 1);

  const taskRuns = store.listRuns({ taskId: t.id }).filter((r) => r.kind === 'task');
  assert.equal(taskRuns.length, 2);
  assert.equal(taskRuns[0].sessionId, taskRuns[1].sessionId, 'revision resumes the same session');
  assert.ok(Math.abs(taskRuns[0].costUsd! - 0.9) < 1e-9);
  assert.ok(Math.abs(taskRuns[1].reportedCostUsd! - 0.97) < 1e-9, 'raw SDK figure kept');
  assert.ok(Math.abs(taskRuns[1].costUsd! - 0.07) < 1e-9, 'only the revision itself is charged');
  // Task total: two task runs (0.9 + 0.07) + two reviews (0.2 each)
  assert.ok(Math.abs(store.getTask(t.id).costUsd - 1.37) < 1e-9);
});

test('migration v4 corrects double-counted resumed-session costs and keeps the raw figures', () => {
  const file = path.join(TMP, 'v3.db');
  const v3 = new DatabaseSync(file);
  for (const m of MIGRATIONS.slice(0, 3)) v3.exec(m);
  v3.exec('CREATE TABLE schema_version (version INTEGER NOT NULL); INSERT INTO schema_version VALUES (3);');
  v3.prepare(`INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p','P','t','t')`).run();
  v3.prepare(`INSERT INTO tasks (id, project_id, title, assignee, cost_usd, created_at, updated_at) VALUES ('t','p','GDD','designer',2.32,'t','t')`).run();
  const run = v3.prepare(
    `INSERT INTO agent_runs (id, project_id, task_id, agent_id, kind, session_id, status, cost_usd, cost_status, started_at) VALUES (?, 'p', 't', ?, ?, ?, 'ok', ?, 'actual', ?)`,
  );
  run.run('r1', 'designer', 'task', 'S', 0.959, '2026-01-01T00:00:01Z');
  run.run('r2', 'director', 'review', 'R1', 0.329, '2026-01-01T00:00:02Z');
  run.run('r3', 'designer', 'task', 'S', 1.033, '2026-01-01T00:00:03Z');
  v3.close();

  const store = new Store(openDb(file));
  const runs = Object.fromEntries(store.listRuns({ taskId: 't' }).map((r) => [r.id, r]));
  assert.ok(Math.abs(runs.r1.costUsd! - 0.959) < 1e-9);
  assert.ok(Math.abs(runs.r2.costUsd! - 0.329) < 1e-9);
  assert.ok(Math.abs(runs.r3.costUsd! - 0.074) < 1e-9);
  assert.equal(runs.r3.reportedCostUsd, 1.033);
  assert.ok(Math.abs(store.getTask('t').costUsd - 1.362) < 1e-9);
});
