import { deliver } from './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentEventType, TaskStatus } from '@pixel/shared';
import { openDb } from '../src/db/db.js';
import { Store } from '../src/db/store.js';
import { Hub } from '../src/events/hub.js';
import { Studio } from '../src/orchestrator/studio.js';
import { runtime, type RunOptions, type RunResult } from '../src/agents/runner.js';
import { workspaceRoot } from '../src/workspace/workspace.js';

function setup(behaviour: (o: RunOptions) => Partial<RunResult>) {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  const events: AgentEventType[] = [];
  const origEmit = hub.emit.bind(hub);
  hub.emit = ((type, p) => {
    events.push(type);
    return origEmit(type, p);
  }) as Hub['emit'];
  const calls: RunOptions[] = [];
  const fake = async (o: RunOptions): Promise<RunResult> => {
    calls.push(o);
    return {
      ok: true,
      sessionId: 'sess',
      text: 'done',
      costUsd: 0.01,
      costAvailable: true,
      usage: null,
      durationMs: null,
      model: null,
      turns: 1,
      files: await deliver(o),
      error: '',
      aborted: false,
      ...behaviour(o),
    };
  };
  const studio = new Studio(store, hub, fake, () => true);
  const project = studio.createProject({ name: 'Test', genre: 'Puzzle', brief: 'b', repoUrl: '' });
  return { store, hub, studio, project, events, calls };
}

async function waitFor(fn: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('task runs, is reviewed by the Director and completes', async () => {
  const { store, studio, project, events, calls } = setup((o) => {
    if (o.agentId === 'designer') {
      fs.writeFileSync(path.join(workspaceRoot(o.projectId), 'docs', 'GDD.md'), '# GDD');
      return { files: ['docs/GDD.md'], text: 'Wrote the GDD' };
    }
    return { text: 'Looks good' };
  });
  const task = studio.createTask({ projectId: project.id, title: 'GDD', description: 'Write the GDD', assignee: 'designer', createdBy: 'user' });
  await waitFor(() => store.getTask(task.id).status === 'done');
  const done = store.getTask(task.id);
  assert.deepEqual(done.files, ['docs/GDD.md']);
  assert.equal(done.result, 'Wrote the GDD');
  assert.ok(done.costUsd > 0);
  assert.deepEqual(calls.map((c) => c.agentId), ['designer', 'director']);
  for (const e of ['task_created', 'task_assigned', 'task_started', 'task_completed'] as const) assert.ok(events.includes(e), e);
  assert.ok(store.listChat(project.id).some((m) => m.role === 'agent' && m.agentId === 'designer'));
});

test('tasks requiring approval wait for the owner, rejection sends them back', async () => {
  const { store, studio, project, events } = setup(() => ({}));
  const task = studio.createTask({ projectId: project.id, title: 'Art', description: 'Style guide', assignee: 'artist', requiresApproval: true, createdBy: 'director' });
  await waitFor(() => store.getTask(task.id).status === 'awaiting_approval');
  assert.ok(events.includes('approval_required'));
  const approval = store.listApprovals(project.id).find((a) => a.taskId === task.id)!;
  studio.resolveApproval(approval.id, 'rejected', 'More color please');
  // Rejected → revision → re-run → review → awaiting approval again
  await waitFor(() => store.getTask(task.id).revisionCount === 1 && store.getTask(task.id).status === 'awaiting_approval');
  const second = store.listApprovals(project.id).find((a) => a.taskId === task.id && a.status === 'pending')!;
  studio.resolveApproval(second.id, 'approved', '');
  assert.equal(store.getTask(task.id).status, 'done');
});

test('failures are recorded and can be retried', async () => {
  let fail = true;
  const { store, studio, project, events } = setup((o) => (o.agentId === 'programmer' && fail ? { ok: false, error: 'boom' } : {}));
  const task = studio.createTask({ projectId: project.id, title: 'Code', description: 'Build it', assignee: 'programmer', createdBy: 'user' });
  await waitFor(() => store.getTask(task.id).status === 'failed');
  assert.equal(store.getTask(task.id).error, 'boom');
  assert.ok(events.includes('task_failed'));
  fail = false;
  studio.retryTask(task.id);
  await waitFor(() => store.getTask(task.id).status === 'done');
});

test('recovery re-queues interrupted tasks', () => {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  const studio = new Studio(store, hub, async () => { throw new Error('no'); }, () => false);
  const p = studio.createProject({ name: 'R', genre: '', brief: '', repoUrl: '' });
  const t = studio.createTask({ projectId: p.id, title: 'x', description: 'y', assignee: 'qa', createdBy: 'user' });
  store.updateTask(t.id, { status: 'in_progress' });
  studio.recover();
  assert.equal(store.getTask(t.id).status as TaskStatus, 'queued');
});

test('retry: the next attempt is told why the last one stopped and which files it already wrote', async () => {
  let attempt = 0;
  const { store, studio, project, calls } = setup((o) => {
    if (o.agentId !== 'programmer') return {};
    attempt++;
    if (attempt === 1)
      for (const f of ['src/Core/Motor.cs', 'tests/MotorTests.cs']) {
        const abs = path.join(workspaceRoot(o.projectId), f);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, '// partial');
      }
    return attempt === 1
      ? { ok: false, error: 'Stopped at the $2 budget limit for one task', files: ['src/Core/Motor.cs', 'tests/MotorTests.cs'] }
      : { files: ['README.md'] };
  });
  const task = studio.createTask({ projectId: project.id, title: 'Motor', description: 'Build it', assignee: 'programmer', createdBy: 'user' });
  await waitFor(() => store.getTask(task.id).status === 'failed');
  assert.match(store.getTask(task.id).error, /budget/);
  studio.retryTask(task.id);
  assert.match(store.getTask(task.id).error, /budget/, 'error kept while queued');
  await waitFor(() => store.getTask(task.id).status === 'done');
  const prompts = calls.filter((c) => c.agentId === 'programmer').map((c) => c.prompt);
  assert.doesNotMatch(prompts[0], /PREVIOUS ATTEMPT/);
  assert.match(prompts[1], /PREVIOUS ATTEMPT STOPPED: Stopped at the \$2 budget limit/);
  assert.match(prompts[1], /- src\/Core\/Motor\.cs\n- tests\/MotorTests\.cs/);
  assert.deepEqual(store.getTask(task.id).files.sort(), ['README.md', 'src/Core/Motor.cs', 'tests/MotorTests.cs']);
  assert.equal(store.getTask(task.id).error, '');
});
