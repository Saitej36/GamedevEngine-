---
id: implement-gameplay-system
role: programmer
title: Implement a gameplay system
summary: Implement a gameplay mechanic or system from a design spec as testable pure logic plus a thin engine layer, with unit tests and an honest hand-off.
triggers: implement, gameplay system, mechanic, feature, player movement, combat, scoring, inventory, spawning, enemy ai, build the game, prototype, code the system
packs: engineering-craft, studio-core
version: 1.0.0
disciplines: combat, ai, input, save, procgen, progression, ui, feel
genres: any
engines: any
engine_dependent: true
---
## Purpose
Turn a designed mechanic (movement, combat, scoring, spawning, inventory, a state machine) into working source code that
other people can review and test. The core rules are written as pure, deterministic logic separated from rendering and
input, so QA and the human can verify behaviour with unit tests even though the agent cannot compile or run anything.

## Required inputs
- The design source for the system: a spec or GDD section under `design/` or `docs/`, with rules and tuning values.
- The target engine/stack (web canvas, Phaser, Unity, Unreal), taken from the project brief, `package.json`, README or
  existing `src/` files.
- Existing code in `src/` and `tests/` that the system must integrate with.
- Acceptance criteria, if QA or the producer has written them (`qa/` or `docs/production/`).

## Workflow
1. Read the design spec and list every rule, state, input, output and tuning value. Write down open questions; if a
   rule needed for correctness is missing, stop (see Failure conditions).
2. Read `README.md`, `package.json` (or engine project files) and Glob `src/**` and `tests/**` to learn the existing
   layout, module style, naming and test runner. Follow existing conventions over personal preference.
3. Design the module boundary [K:eng.software-architecture]: a pure core module (e.g. `src/core/<system>.js`) exposing
   functions such as `createState(config, rng)` and `step(state, commands, dt)`, plus an engine adapter (scene,
   MonoBehaviour, Actor) that maps input to commands and state to visuals. The core must not import the engine or DOM.
4. Put tuning values in a config module or data file with units in names, and cite the design doc each value came from.
5. Choose patterns deliberately [K:eng.game-programming-patterns]: fixed timestep and `dt`-scaled rates, an explicit
   state machine for modes, events for notifying UI/audio, pools for frequent spawns.
6. Write the core code with `Write`/`Edit`. Inject randomness (seeded RNG) and time; never call `Math.random()` or read
   the clock inside rules.
7. Write unit tests in `tests/` covering each rule, edge cases (zero, max, empty, simultaneous events, restart) and a
   determinism check (same seed and inputs produce the same state). Use the project's runner; for dependency-free web
   projects use `node:test` with files listed explicitly in the `test` script.
8. Write the engine adapter and wiring (`src/`, `index.html`, `public/` as needed). Keep callbacks thin: translate
   engine events into core calls.
9. Update `README.md` with how to run the game and the exact test command; update `package.json` scripts if needed.
10. Re-read every file you wrote, checking imports and paths, unit consistency, and that no file outside your write
    permissions was touched.
11. Write the hand-off summary (see Expected output) with a References section citing knowledge used, e.g.
    `[K:eng.software-architecture]`, `[K:eng.testing-and-deployment]`, and the engine doc ids relied on.

## Expected output
- Source files under `src/` (core logic separate from engine code), tests under `tests/`, and README/package.json
  updates if needed.
- A hand-off summary listing: files created/changed; how the system maps to each design rule; tuning values and their
  sources; test files and case count; exact commands the human should run (serve/build, tests); any editor steps for
  engine projects (assign components, create assets); known limitations and open questions; and the statement
  "Not compiled or executed by the agent; tests not run."
- A References section with `[K:<id>]` citations.

## Quality checklist
- [ ] Every design rule is implemented or explicitly listed as deferred.
- [ ] Core logic has no engine, DOM or rendering imports and takes RNG and time as parameters.
- [ ] Movement and timers are scaled by `dt`; simulation assumes a fixed step.
- [ ] Tuning values live in config with units and design-doc sources.
- [ ] Unit tests cover rules, edge cases, restart and determinism, and are listed in the test command.
- [ ] Only allowed paths were written (src/, public/, tests/, index.html, package.json, README.md).
- [ ] README states the run and test commands; hand-off says what was not executed.
- [ ] No claim that code compiles, runs or passes tests without human-provided output.

## Failure conditions
- The design spec is missing, or rules needed for correct behaviour are ambiguous or contradictory: stop and report the
  specific questions to the designer/director instead of inventing rules.
- The target engine or stack cannot be determined from the project files or brief.
- The task requires editing binary or editor-only assets (Unity scenes/prefabs, Unreal Blueprints) to function: write
  the code, then report the exact editor steps needed rather than hand-editing those files.
- The work requires writing outside programmer permissions (e.g. design docs or art): report what is needed and who
  should do it.
- Existing code conflicts with the spec in a way that requires a design decision.
