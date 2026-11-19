---
id: eng.testing-and-deployment
title: Testing and deployment for games
tags: testing, test pyramid, unit tests, pure logic, golden tests, snapshot tests, integration tests, playtest, ci, continuous integration, build, release checklist, versioning
---
# Testing and deployment for games

Games are hard to test end to end, so the strategy is to make as much behaviour as possible testable without the engine,
then cover the rest with a small number of integration checks and structured human playtests.

## The test pyramid for games

The test pyramid for games has three layers:

- **Unit tests (many, fast)**: pure logic such as rules, scoring, damage formulas, state machines, level parsing,
  economy maths, RNG-driven generators with fixed seeds. Run in milliseconds without an engine.
- **Integration tests (some)**: engine-level checks such as "the scene loads", "the player collides with the floor",
  "saving and loading round-trips". Use the engine's test framework (Unity Test Framework PlayMode, Unreal Automation,
  a headless browser for web).
- **Manual and playtest (targeted)**: feel, readability, difficulty, performance on devices. Driven by a written test
  plan with expected results, not ad-hoc play.

Game feel cannot be unit tested, but the numbers behind it can: jump height from gravity and jump velocity, time to kill
from DPS and HP, economy balance over N sessions.

## Testing pure logic

Unit tests are only possible when logic is separated from rendering. Patterns that make code testable:

- Functions take state and inputs and return new state or results; no hidden globals.
- Randomness and time are parameters (`rng`, `dt`, `nowMs`).
- Config is passed in, so tests can use small, explicit values.

A good unit test has one behaviour per test, a descriptive name ("enemy at 0 hp is removed on next tick"), arrange-act-
assert structure and exact expected values computed by hand in a comment. Cover edge cases: zero, max, empty lists,
simultaneous events, boundary tiles, and restart.

## Golden and snapshot tests

Golden tests compare output against a stored, reviewed "golden" result. Useful cases:

- Procedural generation: `generateLevel(seed=42)` serialised to JSON must equal `tests/golden/level-42.json`.
- Simulation: run 600 fixed ticks with a recorded input sequence; the final state hash must match.
- Rendering (engine-level only): screenshot comparison with a pixel tolerance.

Rules: goldens are committed and reviewed like code; regenerating them is a deliberate step with a stated reason;
outputs must be deterministic (seeded RNG, fixed timestep, stable key order).

## Continuous integration

CI runs tests on every change so regressions are caught before release. A minimal setup:

1. Install exact dependency versions (lockfile).
2. Run unit tests; fail the build on any failure.
3. Run a production build; fail on build errors or warnings promoted to errors.
4. Optionally run engine tests in batch/headless mode and archive the build artifact.

Keep the CI test command identical to the documented local command in the README, so a human can reproduce failures.
Engine CI (Unity, Unreal) needs licences, large caches and long build times; start with unit tests of pure logic.

## Honest test reporting

Pixel Studio agents cannot execute anything. Deliverables must separate what was written from what was run:

- "Tests written: `tests/score.test.js` (6 cases). Not executed. Run: `node --test tests/score.test.js`."
- Never write "all tests pass" unless a human supplied the output. Quote real output when it exists.
- List known gaps: what is untested and why.

## Build and release checklist

- [ ] Version number bumped (semantic versioning or a build counter) and shown in-game or in the console.
- [ ] Release/production configuration, debug flags and cheat keys off, verbose logging off.
- [ ] All unit tests and integration tests pass on the release commit (with output attached).
- [ ] Smoke test on each target platform: launch, start, play one level, pause, restart, quit.
- [ ] Performance checked against the frame budget on the lowest target device.
- [ ] Save data compatibility with the previous version checked, or a migration provided.
- [ ] Asset licences and credits verified.
- [ ] Build artifact archived with commit hash and changelog; the release is reproducible from the tag.
- [ ] Rollback plan: the previous build is still available.

## Further reading
- https://nodejs.org/api/test.html
