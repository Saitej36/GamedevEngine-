---
id: optimize-mobile-game
role: programmer
title: Optimize a game for mobile
summary: Improve frame time, memory and battery use for mobile targets through code changes justified by measurements or clear hot-path analysis, with a measurement plan for the human.
triggers: optimize, optimise, performance, slow, lag, low fps, stutter, hitch, mobile, battery, overheating, memory, garbage collection, draw calls, frame budget
packs: engineering-craft, studio-core
---
## Purpose
Make the game hold its target frame rate and stay within memory and thermal limits on mobile devices. The agent cannot
profile, so it combines any measurements the human provides with code analysis of hot paths, makes targeted low-risk
changes, and specifies exactly how the human should measure before and after.

## Required inputs
- Target devices or device class, target frame rate (30 or 60 FPS) and any memory budget, from the brief or producer.
- Symptoms or measurements: profiler captures summarised as text, frame times, GC events, scenario where it is slow.
  If none exist, the task becomes a measurement plan plus analysis-only recommendations.
- Access to `src/`, the engine/stack in use, and asset specifications for texture sizes and counts.

## Workflow
1. Read the performance report and identify the scenario (scene, entity count, duration). Compute the frame budget:
   16.6 ms at 60 FPS, 33.3 ms at 30 FPS, keeping headroom [K:eng.optimization].
2. If measurements exist, decide CPU-bound vs GPU-bound from them. If not, write the measurement plan first (tool,
   scenario, metrics) and continue only with changes that are safe by construction.
3. Read the per-frame code paths (`update`/`Tick`/loop, collision, rendering, UI) and list costs: allocations per frame,
   O(n²) loops, repeated lookups, per-frame text updates, unpooled spawns, work done for off-screen or inactive
   entities, frequent texture switches.
4. Rank candidate fixes by expected impact and risk. Prefer: pooling frequent spawns, removing per-frame allocations,
   caching lookups, updating UI on change only, spatial partitioning for large query counts, deactivating off-screen
   logic, capping frame rate where design allows [K:eng.game-programming-patterns].
5. For rendering costs, specify atlas and batching changes, overdraw reduction and lower internal resolution; if assets
   must change (atlas packing, texture sizes), write the request for the artist rather than editing `assets/`.
6. Implement the top changes with `Edit`, one concern at a time, preserving behaviour. Add or update unit tests where
   logic changed (e.g. pool reset, spatial grid queries).
7. Handle mobile lifecycle: pause the loop and audio when hidden/backgrounded, resume cleanly, clamp `dt` after resume.
8. Write the optimization report with a References section citing knowledge used, e.g. `[K:eng.optimization]` and the
   relevant engine doc.

## Expected output
- Code changes under `src/` (and tests under `tests/`) limited to the identified hot paths.
- An optimization report: target and budget; evidence used (or "not measured"); each change with expected effect and
  risk; asset requests for other departments; a before/after measurement plan the human runs (device, scenario,
  duration of at least 10–15 minutes for thermal behaviour, tool, metrics); test commands; and "Performance not measured
  by the agent; tests not executed."
- A References section with `[K:<id>]` citations.

## Quality checklist
- [ ] Every change targets a cost identified from measurement or explicit hot-path analysis.
- [ ] No gameplay behaviour or tuning changed unintentionally; any visual change is stated.
- [ ] No new per-frame allocations introduced; pooled objects are fully reset on reuse.
- [ ] Mobile lifecycle (hidden/background, resume) handled.
- [ ] The report gives a repeatable measurement plan with the frame budget.
- [ ] No performance numbers are claimed that the human did not provide.
- [ ] Only programmer-writable paths were changed.

## Failure conditions
- No target device, frame rate or symptom is known: ask the producer/human instead of optimizing blindly.
- Measurements show the bottleneck is in assets or engine settings outside programmer permissions: report findings and
  route requests to the right role.
- The only meaningful gains require design changes (fewer enemies, simpler effects): propose options to the director
  rather than changing design values.
- A change would risk correctness without tests the human can run: stop and propose it with the risk stated.
