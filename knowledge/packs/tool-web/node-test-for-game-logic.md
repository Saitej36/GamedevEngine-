---
id: web.node-test-for-game-logic
title: Testing game logic with node:test
tags: node, node:test, node --test, node:assert/strict, unit tests, esm, type module, test discovery, glob, seeded rng, mulberry32, determinism, npm test
---
# Testing game logic with node:test

Assumed version: Node.js 20 LTS or newer (the built-in test runner is stable from Node 20). This is a Pixel Studio
internal summary, not official Node.js documentation; see the Node.js test runner docs for the installed version.

## Why node:test for game logic

Node's built-in test runner needs no dependencies, which fits dependency-free web games. It tests the pure modules in
`src/core/` (rules, state transitions, scoring, level generation, RNG). It cannot test canvas drawing or DOM input,
so those modules must stay out of the files under test. Any core file that touches `window`, `document` or a canvas
will throw in Node; that failure is a useful signal that logic has leaked into the wrong layer.

## ESM setup

Game code written as browser ES modules can be imported by Node directly when `package.json` declares ESM:

```json
{
  "name": "my-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/rules.test.js tests/rng.test.js tests/level.test.js"
  }
}
```

- With `"type": "module"`, `.js` files are ES modules in Node; use `import`/`export`, include file extensions in
  import paths (`'../src/core/rules.js'`), and do not use `require`.
- Node has no browser globals; inject anything environment-specific (time, random, storage) as parameters.

## Writing tests with node:test and node:assert/strict

```js
// tests/rules.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, step } from '../src/core/rules.js';
import { mulberry32 } from '../src/core/rng.js';

describe('step', () => {
  it('moves the player right by speed * dt', () => {
    const s0 = createInitialState({ playerSpeed: 120 }, mulberry32(1));
    const s1 = step(s0, { right: true }, 0.5);
    assert.equal(s1.player.x, s0.player.x + 60);
  });

  it('does not mutate the previous state', () => {
    const s0 = createInitialState({ playerSpeed: 120 }, mulberry32(1));
    const copy = structuredClone(s0);
    step(s0, { right: true }, 1 / 60);
    assert.deepEqual(s0, copy);
  });
});
```

Useful API (all from `node:test` and `node:assert/strict`):

- `test(name, fn)` or `describe`/`it`; test functions may be `async`. Hooks: `before`, `after`, `beforeEach`,
  `afterEach`. `test.skip` and `test.todo` mark incomplete work honestly.
- In strict mode, `assert.equal` uses strict equality and `assert.deepEqual` is deep strict equality.
- `assert.throws(fn, /message/)` for invalid input; `assert.rejects` for async; `assert.ok(cond)` for general checks.
- Floats: compare with a tolerance, `assert.ok(Math.abs(actual - expected) < 1e-9)`, rather than `equal`.

## File discovery differs across Node versions

`node --test` with no file arguments discovers test files automatically, but the rules have changed between versions.
Node 20 searches directories for names matching built-in patterns; Node 21 and later use glob patterns (such as files
ending in `.test.js` or files inside a `test` directory) and also accept glob patterns as arguments. A plain directory
argument such as `node --test tests/` behaves differently across versions, and shell glob expansion (`tests/*.test.js`)
depends on the shell (npm scripts run under `cmd.exe` on Windows, which does not expand globs).

Recommendation: list test files explicitly in the `test` script, as in the example above, and update the list whenever
a test file is added. The human runs `npm test` (or the same `node --test file1 file2` command). This works the same on
every supported Node version and operating system. Name files `*.test.js` in `tests/` anyway, so automatic discovery
also finds them.

## Seeded RNG for determinism

`Math.random()` cannot be seeded, so tests of random behaviour would be flaky. Use a small seeded generator and pass it
into logic. Mulberry32 is a widely used 32-bit generator adequate for games (not for security):

```js
// src/core/rng.js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
  };
}

export function randInt(rng, min, maxInclusive) {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}
```

Test patterns: the same seed yields the same sequence (`assert.deepEqual` of the first 5 values from two generators);
`randInt` stays within bounds over many draws; `generateLevel(mulberry32(42))` matches a committed golden JSON file.
In the browser, log the seed at startup and allow overriding it (for example a `?seed=` URL parameter) so bugs reproduce.

## Reporting test results honestly

Agents write tests but cannot run them. A deliverable states: test files and case counts, the exact command
(`npm test` or `node --test tests/rules.test.js ...`), the minimum Node version assumed, and "Not executed by the
agent." Only paste results that the human actually provided.

## Further reading
- https://nodejs.org/api/test.html
