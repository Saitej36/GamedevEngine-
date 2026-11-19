---
id: qa.test-automation
title: Test automation for games
tags: test automation, unit test, integration test, test pyramid, deterministic, seeded random, node test, unity test framework, ci, flaky
---
# Test automation for games

Test automation makes regression checks cheap and repeatable. In games it works best on deterministic logic and worst
on feel and visuals, so the goal is to automate the right layer, not everything.

## What to automate

Test automation pays off on rules that are precise and stable:
- Game rules and formulas: damage, scoring, combo multipliers, economy, cooldowns.
- State machines: game states, AI states, menu flow logic.
- Data validation: every level file loads, every item ID referenced exists, tuning values within ranges.
- Serialisation: save → load round-trip equals original state; older save versions still load.
- Procedural generation with a fixed seed: output is valid and solvable.
Leave to manual testing: game feel, visual quality, audio mix, fun, and anything changing daily during prototyping.

## The game test pyramid

A healthy suite is shaped like a pyramid:
- **Many unit tests**: pure functions and classes without the engine. Fast, deterministic.
- **Some integration tests**: several systems together, e.g. player + physics in a headless scene.
- **Few end-to-end tests**: launch the build, run scripted input, check outcomes. Slow and brittle; keep to smoke level.
Architecture enables this: keeping rules in plain modules separate from rendering and engine callbacks makes them
testable without the engine (see engineering-craft and tool packs).

## Writing deterministic tests

Flaky tests destroy trust in automation. Rules:
- Inject randomness: pass a seeded random generator instead of calling global random functions.
- Inject time: pass `dt` or a clock instead of reading the wall clock.
- No dependency on frame rate; step the simulation a fixed number of fixed-size ticks.
- One behaviour per test, named for that behaviour: `takeDamage_reducesHealth_clampedAtZero`.
- Arrange–Act–Assert structure; no logic or loops in assertions that could hide failures.
- Test boundaries (see [K:qa.functional-testing]): 0, 1, max, max+1.

Example (Node's built-in runner, for a vanilla web project):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage } from '../src/combat.js';
test('applyDamage clamps health at zero', () => {
  assert.equal(applyDamage({ hp: 5 }, 8).hp, 0);
});
```
Use the project's existing framework (node:test, Jest, Vitest, Unity Test Framework, Unreal Automation) as named in its
README or package.json; do not introduce a new one without the Programmer agreeing.

## Mapping tests to criteria

Each automated test should trace to an acceptance criterion or a bug:
`AC-3 (score doubles at combo ≥ 5) → tests/score.test.js "doubles score at combo 5"`
`BUG-12 (negative score) → tests/score.test.js "never below zero"`
This makes coverage reportable and stops tests nobody can justify (see [K:qa.acceptance-criteria]).

## Writing tests without a shell

A QA agent can write test files in `tests/` but cannot run them. Therefore:
- Read the code under test first and import real exported names; do not guess function signatures.
- Mark each new test file in the QA report as "written, not executed" with the exact command, taken from package.json
  scripts or README (e.g. `npm test` or `node --test tests/`).
- If an expected value comes from the spec rather than from current code behaviour, say so; the test may fail by design
  and reveal a bug.
- Never report a test as passing until a human or CI run output is available, and then label it with its source.

## Pitfalls

- Testing implementation details (private fields), causing breakage on every refactor.
- Tests that pass without asserting anything meaningful.
- Ignoring flaky tests instead of fixing or quarantining them with a ticket.
- Automating unstable prototype features; rewrite cost exceeds benefit.
