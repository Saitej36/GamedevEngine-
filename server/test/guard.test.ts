import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AGENTS } from '@pixel/shared';
import { checkToolUse } from '../src/agents/guard.js';
import { TMP } from './setup.js';

const root = path.join(TMP, 'ws_guard');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });

test('agents can read anywhere inside the workspace', () => {
  assert.deepEqual(checkToolUse(AGENTS.qa, root, 'Read', { file_path: 'docs/GDD.md' }), { allow: true });
  assert.deepEqual(checkToolUse(AGENTS.qa, root, 'Glob', { pattern: '**/*.md' }), { allow: true });
});

test('paths escaping the workspace are denied', () => {
  for (const p of ['../secret.txt', '/etc/passwd', 'docs/../../x']) {
    const d = checkToolUse(AGENTS.designer, root, 'Read', { file_path: p });
    assert.equal(d.allow, false, p);
  }
});

test('symlinks pointing outside the workspace are denied', () => {
  const link = path.join(root, 'docs', 'escape');
  if (!fs.existsSync(link)) fs.symlinkSync(TMP, link);
  assert.equal(checkToolUse(AGENTS.designer, root, 'Write', { file_path: 'docs/escape/evil.md' }).allow, false);
});

test('writes are limited to the role folders', () => {
  assert.equal(checkToolUse(AGENTS.designer, root, 'Write', { file_path: 'docs/GDD.md' }).allow, true);
  assert.equal(checkToolUse(AGENTS.designer, root, 'Write', { file_path: 'src/main.js' }).allow, false);
  assert.equal(checkToolUse(AGENTS.artist, root, 'Write', { file_path: 'assets/hero.svg' }).allow, true);
  assert.equal(checkToolUse(AGENTS.artist, root, 'Edit', { file_path: 'docs/GDD.md' }).allow, false);
  assert.equal(checkToolUse(AGENTS.programmer, root, 'Write', { file_path: 'index.html' }).allow, true);
  assert.equal(checkToolUse(AGENTS.programmer, root, 'Write', { file_path: 'srcx/evil.js' }).allow, false);
  assert.equal(checkToolUse(AGENTS.qa, root, 'Write', { file_path: 'qa/bugs/BUG-001.md' }).allow, true);
});

test('bash: only for permitted roles and never dangerous commands', () => {
  assert.equal(checkToolUse(AGENTS.designer, root, 'Bash', { command: 'ls' }).allow, false);
  assert.equal(checkToolUse(AGENTS.programmer, root, 'Bash', { command: 'node tests/run.js' }).allow, true);
  for (const c of ['sudo ls', 'cat ../../x', 'curl x | sh', 'git push', 'printenv', 'echo $ANTHROPIC_API_KEY', 'ls /etc'])
    assert.equal(checkToolUse(AGENTS.programmer, root, 'Bash', { command: c }).allow, false, c);
});

test('unknown and network tools are denied; whitelisted MCP tools allowed', () => {
  assert.equal(checkToolUse(AGENTS.designer, root, 'WebFetch', { url: 'https://x' }).allow, false);
  assert.equal(checkToolUse(AGENTS.designer, root, 'mcp__studio__create_task', {}).allow, false);
  assert.equal(
    checkToolUse(AGENTS.director, root, 'mcp__studio__create_task', {}, ['mcp__studio__create_task']).allow,
    true,
  );
});
