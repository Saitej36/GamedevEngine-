---
id: eng.debugging
title: Debugging games
tags: debugging, reproduce, isolate, bisect, logging, determinism, seed, frame-rate dependence, float precision, update order, root cause
---
# Debugging games

Debugging is a search for the cause of a difference between expected and actual behaviour. In Pixel Studio, agents read
code and reports but cannot run the game, so the method relies on reproduction steps from humans or QA, reasoning from
code, and tests or instrumentation that a human can run.

## Reproduce first

A bug that cannot be reproduced cannot be confirmed fixed. A useful reproduction states:

- Build/commit, platform, device, browser or engine version.
- Exact steps from a known state (fresh load, level 2 start), with inputs and timing.
- Expected vs actual result, frequency (always, 1 in 5), and the seed if the game uses one.
- Evidence: console output, screenshot, video, save file.

If the report lacks these, the first deliverable is a request for them, not a guess. Intermittent bugs usually hide a
dependency on timing, frame rate, randomness or uninitialised state; try to make them deterministic.

## Isolate the cause

Isolation narrows where the bug lives:

1. Form a hypothesis from symptoms ("the enemy tunnels through walls at high speed").
2. Find the smallest code path that could produce it; read it line by line, noting units, signs and order.
3. Write a failing unit test against the pure logic that reproduces the bug. If the bug cannot be expressed in a pure
   test, add temporary logging or an assertion at the suspected boundary.
4. Remove variables: disable systems, use a minimal level, fix the seed, fix the timestep.

Change one thing at a time. A fix that also refactors makes it impossible to know which change mattered.

## Bisect

Bisecting finds when a bug was introduced by halving the search space. For history, `git bisect` lets a human test the
midpoint commit and mark it good or bad until the first bad commit appears. The same idea works for content (disable half
the entities), config (revert half the changed values) and code (comment out half a function). Agents cannot run
`git bisect` but can ask the human to, giving the reproduction steps to use at each step.

## Logging and instrumentation

Logging turns invisible state into evidence. Good game logging:

- Is tagged and filterable: `[combat] hit enemy=12 dmg=5 hp=3→-2 frame=8812`.
- Includes the frame or tick number, so ordering problems are visible.
- Logs transitions (state changes, spawns, collisions), not every frame, to avoid flooding.
- Lives behind a debug flag so it can stay in the code and be off in release.
- Pairs with assertions for invariants: `hp >= 0`, `entity in exactly one cell`, `score never decreases`.

On-screen debug overlays (hitboxes, velocity vectors, state names) find spatial bugs faster than logs.

## Determinism and seeds

Deterministic simulation makes bugs replayable. Inject a seeded RNG into game logic, print the seed at startup, and
allow a seed override (URL parameter, config value or command-line argument). With a fixed timestep and recorded input
commands, a bug report becomes "seed 12345, inputs file X", which anyone can replay and which can become a regression
test.

## Common game bugs

**Frame-rate dependence.** Movement written as `x += 5` per frame runs twice as fast at 120 Hz as at 60 Hz. Use
`x += speed * dt`, and simulate physics on a fixed step. Also check timers that count frames instead of seconds.

**Large dt spikes.** After a tab switch or breakpoint, `dt` can be seconds long, causing tunnelling or huge jumps. Clamp
`dt` (for example to 0.25 s) and pause the loop when the page or app is hidden.

**Tunnelling.** Fast objects skip past thin colliders between steps. Use smaller steps, thicker colliders, swept or
continuous collision detection, or raycasts along the movement.

**Float precision.** `0.1 + 0.2 !== 0.3`; compare with a tolerance (`Math.abs(a - b) < 1e-6`). Accumulated floats drift,
so derive positions from integers when exact (tile coordinates). Far from the origin, 32-bit floats lose precision,
causing jitter in large worlds; engines with large worlds use origin rebasing or double precision.

**Order of update.** Camera updated before the player shows one-frame lag; collision resolved before movement misses
contacts; an object destroyed mid-iteration skips the next element. Write down the intended order and check it.

**Stale state on restart.** Module-level variables, leaked event listeners and pooled objects not reset cause bugs only
on the second play-through. Always test "play, die, restart".

## Bug fix report

Every fix should state: root cause in one sentence, the change, the regression test added (path and name), how the human
should verify, and what was not executed: "Tests written but not executed — run `<command>`."
