---
id: eng.software-architecture
title: Game software architecture
tags: architecture, pure logic, separation of concerns, data-driven, config, module boundaries, determinism, dependency direction, testability
---
# Game software architecture

Good game architecture keeps the rules of the game independent of how the game is drawn, heard and controlled. In
Pixel Studio this matters twice: the code must be testable by people who did not write it, and agents cannot run an
engine, so the logic that matters most must be readable and checkable as plain code.

## Separate pure game logic from the engine

Game architecture should split code into two layers with a one-way dependency:

- **Core (pure logic)**: rules, state, scoring, collision math on plain data, AI decisions, economy, save data. No
  engine types, no DOM, no rendering, no audio, no `Date.now()` or global random. Inputs are arguments; outputs are
  return values or new state.
- **Shell (engine adapter)**: scenes, sprites, physics bodies, input devices, sound, UI. The shell reads input, calls
  the core, then renders the resulting state.

The dependency rule: the shell imports the core, the core never imports the shell. A quick check is to grep core files
for engine names (`Phaser`, `UnityEngine`, `document`, `window`, `canvas`). Any hit is a boundary violation.

A typical shape for a web or Phaser project:

```
src/core/      rules.js, state.js, rng.js, levels.js   (pure, unit-tested)
src/game/      scenes, rendering, input mapping        (engine/DOM)
src/main.js    wiring only
tests/         tests for src/core only
```

In Unity the same idea is a plain C# assembly (no `UnityEngine` reference) used by MonoBehaviours; in Unreal it is plain
C++ structs/functions or `UObject` logic kept out of Actor tick code.

## Data-driven configuration

Game architecture should keep tunable numbers out of code paths. Put speeds, damage, spawn tables, level layouts and
costs into config data (JSON, a `config.js` export, ScriptableObjects, Data Assets or Data Tables) that the core reads.

Practical rules:

- One source of truth per value. A designer-owned number in `design/` should be copied into one config file, with a
  comment or README line naming the design doc it came from.
- Validate config at load: missing keys, negative timers and empty spawn tables should fail loudly with a clear message,
  not produce a silent zero.
- Prefer units in names: `moveSpeedPxPerSec`, `cooldownMs`, `spawnIntervalSec`. Unit confusion is a common source of
  tuning bugs.
- Keep content (levels, waves, items) as data arrays, not as branches in code, so adding content is not a code change.

## Module boundaries and dependencies

Game architecture works best with small modules that each own one concept and expose a narrow API. Guidelines:

- A module owns its state; other modules change it only through its functions or events, never by reaching into fields.
- Avoid global singletons for game state. Pass a `state` or `world` object explicitly; it makes tests trivial and makes
  restart/reset correct by construction.
- Communicate across systems with events or return values rather than direct calls in both directions; circular imports
  are a design smell and break ES module initialisation order.
- Keep files short enough to review: a common heuristic is under roughly 300 lines per file and one exported concept.
- Name the boundary in the README: which folders are pure, which touch the engine, how to run tests.

## Determinism

A deterministic game core produces the same outputs from the same inputs and seed. Determinism makes bugs reproducible,
enables replays and golden tests, and is a prerequisite for lockstep multiplayer.

Sources of non-determinism to remove from the core:

- **Random numbers**: use a seeded RNG object passed in, never `Math.random()` or an engine global random inside rules.
- **Time**: pass `dt` or a tick counter in; do not read the wall clock inside logic.
- **Variable timestep**: simulate on a fixed step (for example 1/60 s) so results do not depend on frame rate.
- **Iteration order**: iterating hash maps or sets whose order depends on insertion or hashing can change results;
  sort by a stable id when order matters.
- **Floating point across platforms**: identical code can differ across CPUs/compilers. For cross-machine lockstep,
  consider integer or fixed-point math; for single-machine replays, fixed step plus seeded RNG is usually enough.

## Architecture review checklist

- [ ] Core logic folder has no engine, DOM or rendering imports.
- [ ] All tunable values live in config data with units in their names.
- [ ] Game state can be created fresh (`createInitialState(config, seed)`) for restart and tests.
- [ ] Randomness and time are injected, not read globally.
- [ ] Each module's public API is documented in a header comment.
- [ ] README states the folder layout, the dependency rule and the test command.

## Common pitfalls

Game architecture problems that recur in reviews: logic placed inside render or `update` callbacks where it cannot be
tested; state duplicated in sprites and in the model so they drift; "manager" classes that know everything; and
premature engine-wide frameworks (full ECS, plugin systems) for a small game. Start with plain functions and data, and
add structure only when a concrete problem appears.

## Further reading
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
