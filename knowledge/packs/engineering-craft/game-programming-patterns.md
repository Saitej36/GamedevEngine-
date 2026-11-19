---
id: eng.game-programming-patterns
title: Game programming patterns
tags: game loop, fixed timestep, update method, component, ecs, state machine, observer, events, object pooling, command pattern, spatial partitioning, grid
---
# Game programming patterns

These patterns solve problems that appear in almost every game. Use the simplest one that fits; each section lists
when the pattern helps and when it is overkill.

## Game loop and fixed timestep

The game loop pattern runs input, simulation and rendering every frame. A fixed-timestep loop decouples simulation from
frame rate: the simulation always advances in equal steps, while rendering happens as often as the display allows.

```js
const STEP = 1 / 60;            // seconds per simulation tick
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25); // clamp to avoid a "spiral of death" after a stall
  last = now;
  while (acc >= STEP) { state = update(state, input, STEP); acc -= STEP; }
  render(state, acc / STEP);    // alpha for optional interpolation
  requestAnimationFrame(frame);
}
```

Use a fixed step whenever physics, collisions, replays or tests depend on results. Engines provide this already:
Unity `FixedUpdate`, Phaser Arcade physics' internal step, Unreal's physics sub-stepping options.

## Update method

The update method pattern gives each entity an `update(dt)` called once per tick. Rules that keep it sane:

- Multiply every rate by `dt` (speed in units per second, not per frame).
- Decide and document update order (input, then movement, then collisions, then cleanup). Order bugs look like
  one-frame lag or objects passing through each other.
- Do not add or remove entities from the list being iterated; queue spawns and despawns and apply them after the loop.

## Components and ECS

The component pattern builds entities from small parts (position, sprite, health, AI) rather than deep inheritance
trees. Entity-Component-System goes further: entities are ids, components are plain data, systems iterate over entities
that have a given set of components.

- Components are the default in Unity (MonoBehaviours on GameObjects) and Unreal (ActorComponents).
- A full ECS pays off with thousands of similar entities and data-oriented performance needs. For a small 2D game,
  plain objects with a few composed parts are usually clearer.
- Keep component data serialisable; it simplifies save games and tests.

## State machines

A finite state machine models behaviour with explicit states and transitions: player `idle → run → jump → fall`,
enemy `patrol → chase → attack`, game `title → playing → paused → gameOver`.

```js
const transitions = {
  idle:  { move: 'run', jump: 'jump' },
  run:   { stop: 'idle', jump: 'jump' },
  jump:  { land: 'idle' },
};
function next(state, event) { return transitions[state]?.[event] ?? state; }
```

Benefits: impossible combinations (jumping while dead) become unrepresentable, and transitions are trivially unit
tested. Add `enter`/`exit` hooks for animations and sounds. Hierarchical or stack-based machines help when states
share behaviour (a pause state pushed on top of play).

## Observer and events

The observer pattern lets a system announce that something happened (`enemyKilled`, `scoreChanged`) without knowing who
listens. UI, audio, achievements and analytics subscribe. Pitfalls:

- Always unsubscribe when a listener is destroyed (scene shutdown, object destroy); leaked listeners cause duplicate
  sounds and calls on dead objects.
- Avoid long chains where one event triggers another; they hide control flow. Prefer events for "notify", direct
  calls for "do this now".
- Name events in past tense and document their payload.

## Object pooling

Object pooling reuses a fixed set of objects (bullets, particles, enemies) instead of creating and destroying them.
It reduces garbage-collection spikes in JavaScript and C#, and allocation cost in C++.

- Pre-allocate a pool sized from the design's worst case; decide what happens when it is empty (skip spawn, recycle
  oldest, or grow with a warning).
- Fully reset every field on reuse; stale velocity or timers are the classic pooling bug.
- Phaser groups with `maxSize`, Unity's `UnityEngine.Pool.ObjectPool<T>` and manual arrays all implement this idea.

## Command pattern

The command pattern turns an action into an object or record: `{ type: 'move', dx: 1 }`. Input produces commands; the
simulation consumes them. This enables key rebinding, AI and players sharing one action API, undo in puzzle games, and
replays (store the command stream plus the seed). Commands are also easy test inputs.

## Spatial partitioning

Spatial partitioning avoids checking every object against every other (O(n²)). Options:

- **Uniform grid**: bucket objects by cell (`cellX = Math.floor(x / cellSize)`); query only neighbouring cells. A
  common heuristic is a cell size about the size of the largest typical object. Ideal for tile games and bullets.
- **Quadtree**: adapts to uneven density; more complex to maintain for moving objects.
- **Engine broadphase**: Unity, Unreal and Phaser physics already do broadphase; only add your own for custom queries
  such as "enemies within radius".

Profile before adding partitioning; with under a few hundred objects a brute-force loop is often fine.
