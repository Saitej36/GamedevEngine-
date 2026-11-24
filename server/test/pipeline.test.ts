import { deliver } from './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/db.js';
import { Store } from '../src/db/store.js';
import { Hub } from '../src/events/hub.js';
import { Studio } from '../src/orchestrator/studio.js';
import { auditFields, runtime, type RunOptions, type RunResult } from '../src/agents/runner.js';
import { workerTaskPrompt } from '../src/agents/prompts.js';
import fs from 'node:fs';
import path from 'node:path';
import { TMP } from './setup.js';

function setup(behaviour: (o: RunOptions) => Partial<RunResult> = () => ({})) {
  const store = new Store(openDb(':memory:'));
  const hub = new Hub(store);
  runtime.hub = hub;
  const calls: RunOptions[] = [];
  const runner = async (o: RunOptions): Promise<RunResult> => {
    calls.push(o);
    return {
      ok: true,
      sessionId: 's',
      text: 'done',
      costUsd: 0.01,
      costAvailable: true,
      usage: null,
      durationMs: null,
      model: null,
      turns: 1,
      files: o.agentId === 'designer' ? ['docs/GDD.md'] : await deliver(o),
      error: '',
      aborted: false,
      ...behaviour(o),
    };
  };
  const studio = new Studio(store, hub, runner, () => true);
  const project = studio.createProject({ name: 'P', genre: '', brief: '', repoUrl: '' });
  return { store, studio, project, calls };
}

async function waitFor(fn: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}
const settle = () => new Promise((r) => setTimeout(r, 80));

test('dependencies: dependent work waits for the prerequisite, including owner sign-off', async () => {
  const { store, studio, project, calls } = setup();
  const gdd = studio.createTask({ projectId: project.id, title: 'GDD', description: 'Write GDD', assignee: 'designer', requiresApproval: true, createdBy: 'director' });
  const roadmap = studio.createTask({ projectId: project.id, title: 'Roadmap', description: 'Plan', assignee: 'producer', dependsOn: [gdd.id], createdBy: 'director' });
  const qa = studio.createTask({ projectId: project.id, title: 'QA', description: 'Test', assignee: 'qa', dependsOn: [roadmap.id], createdBy: 'director' });
  assert.deepEqual(store.getTask(roadmap.id).dependsOn, [gdd.id]);

  await waitFor(() => store.getTask(gdd.id).status === 'awaiting_approval');
  await settle();
  // Prerequisite is reviewed but not signed off: nothing downstream may start.
  assert.equal(store.getTask(roadmap.id).status, 'queued');
  assert.equal(store.getTask(qa.id).status, 'queued');
  assert.ok(!calls.some((c) => c.agentId === 'producer' || c.agentId === 'qa'));

  const ap = store.listApprovals(project.id).find((a) => a.status === 'pending')!;
  studio.resolveApproval(ap.id, 'approved', '');
  await waitFor(() => store.getTask(qa.id).status === 'done');
  const order = calls.filter((c) => c.agentId !== 'director').map((c) => c.agentId);
  assert.deepEqual(order, ['designer', 'producer', 'qa']);
});

test('dependencies: the prerequisite deliverables are handed to the next agent', async () => {
  const { store, studio, project, calls } = setup();
  const gdd = studio.createTask({ projectId: project.id, title: 'GDD', description: 'Write GDD', assignee: 'designer', createdBy: 'director' });
  const art = studio.createTask({ projectId: project.id, title: 'Art bible', description: 'Art', assignee: 'artist', dependsOn: [gdd.id], createdBy: 'director' });
  await waitFor(() => store.getTask(art.id).status === 'done');
  const artistPrompt = calls.find((c) => c.agentId === 'artist')!.prompt;
  assert.match(artistPrompt, /Prerequisite deliverables/);
  assert.match(artistPrompt, /GDD \(Game Designer\): docs\/GDD\.md/);
  // Revision prompts keep the handoff.
  const t = { ...store.getTask(art.id), revisionCount: 1, feedback: 'Fix palette' };
  assert.match(workerTaskPrompt(t, [store.getTask(gdd.id)]), /REVISION 1[\s\S]*Prerequisite deliverables/);
});

test('dependencies: invalid prerequisites are rejected and blocked tasks cannot be force-started', async () => {
  const { store, studio, project } = setup();
  const other = studio.createProject({ name: 'Other', genre: '', brief: '', repoUrl: '' });
  const foreign = studio.createTask({ projectId: other.id, title: 'X', description: 'x', assignee: 'qa', createdBy: 'user' });
  assert.throws(() => studio.createTask({ projectId: project.id, title: 'A', description: 'a', assignee: 'qa', dependsOn: ['task_missing'], createdBy: 'user' }), /does not exist/);
  assert.throws(() => studio.createTask({ projectId: project.id, title: 'A', description: 'a', assignee: 'qa', dependsOn: [foreign.id], createdBy: 'user' }), /another project/);

  const gdd = studio.createTask({ projectId: project.id, title: 'GDD', description: 'g', assignee: 'designer', requiresApproval: true, createdBy: 'user' });
  studio.cancelTask(gdd.id);
  assert.throws(() => studio.createTask({ projectId: project.id, title: 'A', description: 'a', assignee: 'qa', dependsOn: [gdd.id], createdBy: 'user' }), /cancelled/);

  const gdd2 = studio.createTask({ projectId: project.id, title: 'GDD2', description: 'g', assignee: 'designer', requiresApproval: true, createdBy: 'user' });
  const dep = studio.createTask({ projectId: project.id, title: 'Code', description: 'c', assignee: 'programmer', dependsOn: [gdd2.id], createdBy: 'user' });
  await waitFor(() => store.getTask(gdd2.id).status === 'awaiting_approval');
  assert.throws(() => studio.startTask(dep.id), /Waiting on prerequisite/);
});

test('audit: every tool call is stored with its run, decision and outcome', async () => {
  const { store, studio, project } = setup((o) => {
    if (o.agentId === 'artist') {
      o.onToolCall?.({ toolUseId: 'tu1', tool: 'Write', path: 'assets/hero.svg', detail: '', decision: 'allow', reason: '' });
      o.onToolResult?.('tu1', 'ok');
      o.onToolCall?.({ toolUseId: 'tu2', tool: 'Write', path: 'src/main.js', detail: '', decision: 'deny', reason: 'Concept Artist may only write under: assets, docs/art' });
      o.onToolResult?.('tu2', 'error');
    }
    return {};
  });
  const t = studio.createTask({ projectId: project.id, title: 'Art', description: 'a', assignee: 'artist', createdBy: 'user' });
  await waitFor(() => store.getTask(t.id).status === 'done');
  const calls = studio.toolCalls(project.id);
  const run = store.listRuns({ taskId: t.id }).find((r) => r.kind === 'task')!;
  assert.deepEqual(
    calls.map((c) => [c.tool, c.path, c.decision, c.outcome, c.runId === run.id, c.taskId]),
    [
      ['Write', 'assets/hero.svg', 'allow', 'ok', true, t.id],
      ['Write', 'src/main.js', 'deny', null, true, t.id],
    ],
  );
  assert.deepEqual(studio.toolCalls(project.id, 'deny').map((c) => c.reason), ['Concept Artist may only write under: assets, docs/art']);
});

test('audit: tool inputs are summarised; paths outside the workspace are kept verbatim', () => {
  const root = path.join(TMP, 'ws_audit');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  assert.deepEqual(auditFields(root, { file_path: path.join(root, 'docs/GDD.md') }), { path: 'docs/GDD.md', detail: '' });
  assert.deepEqual(auditFields(root, { file_path: '/etc/passwd' }), { path: '/etc/passwd', detail: '' });
  assert.deepEqual(auditFields(root, { pattern: '**/*.md' }), { path: null, detail: '**/*.md' });
});

test('attribution: concurrent writes by other agents are never credited to a run', async () => {
  const { attributeShellFiles } = await import('../src/agents/runner.js');
  const changed = ['assets/hero.svg', 'src/core/collision.js', 'docs/production/ROADMAP.md'];
  // Artist without shell: only its own tool writes count.
  assert.deepEqual(attributeShellFiles(changed, new Set(['assets/hero.svg']), ['assets', 'docs/art'], false), []);
  // Programmer with shell: shell-written files inside its own folders only.
  assert.deepEqual(
    attributeShellFiles(changed, new Set<string>(), ['src', 'tests', 'index.html'], true),
    ['src/core/collision.js'],
  );
});

test('attribution: startup repair removes files outside the assignee folders and is idempotent', () => {
  const { store, studio, project } = setup();
  const t = studio.createTask({ projectId: project.id, title: 'Art', description: 'a', assignee: 'artist', createdBy: 'user' });
  store.updateTask(t.id, { files: ['assets/hero.svg', 'docs/art/ART_BIBLE.md', 'src/core/collision.js'] });
  assert.equal(studio.repairFileAttribution(), 1);
  assert.deepEqual(store.getTask(t.id).files, ['assets/hero.svg', 'docs/art/ART_BIBLE.md']);
  assert.equal(studio.repairFileAttribution(), 0);
});

test('audit: calls a tool rejects before the guard runs are recorded as tool_rejected', async () => {
  const { ToolAuditTracker } = await import('../src/agents/runner.js');
  const root = path.join(TMP, 'ws_audit2');
  fs.mkdirSync(root, { recursive: true });
  const records: { tool: string; decision: string; path: string | null; reason: string }[] = [];
  const t = new ToolAuditTracker(root, (c) => records.push(c));
  // Normal call: guard hook sees it, then the result arrives.
  t.toolUse('a', 'Read', { file_path: path.join(root, 'x.md') });
  t.hook({ toolUseId: 'a', tool: 'Read', path: 'x.md', detail: '', decision: 'allow', reason: '' });
  t.toolResult('a', false, 'ok');
  // Rejected by the tool's own validation: no hook call, error result (as seen live for studio.db).
  t.toolUse('b', 'Read', { file_path: '/srv/data/studio.db' });
  t.toolResult('b', true, [{ type: 'text', text: 'This tool cannot read binary files.' }]);
  assert.deepEqual(
    records.map((r) => [r.tool, r.decision, r.path, r.reason]),
    [
      ['Read', 'allow', 'x.md', ''],
      ['Read', 'tool_rejected', '/srv/data/studio.db', 'This tool cannot read binary files.'],
    ],
  );
});
