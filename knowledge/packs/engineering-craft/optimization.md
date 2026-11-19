---
id: eng.optimization
title: Game performance optimization
tags: optimization, performance, profiling, frame budget, 60 fps, 30 fps, garbage collection, allocations, draw calls, batching, mobile, thermal, battery, memory budget
---
# Game performance optimization

Optimization is measuring, finding the biggest cost, fixing it, and measuring again. Agents in Pixel Studio cannot run
a profiler, so optimization work is split: the programmer writes code that is cheap by construction and states exactly
what the human should measure; the human reports numbers back.

## Profile first

Optimization without profiling usually targets the wrong thing. The loop is:

1. Define the target (device, resolution, frame rate) and a repeatable scenario (level 3, 200 enemies, 60 seconds).
2. Measure frame time, not FPS. FPS is non-linear: going from 60 to 50 FPS costs 3.3 ms, from 30 to 20 costs 16.7 ms.
3. Find whether the frame is CPU-bound (script, physics, layout) or GPU-bound (fill rate, overdraw, shaders).
4. Fix the single largest cost, re-measure in the same scenario, keep or revert.

Tools by platform: browser DevTools Performance panel and the FPS meter; Unity Profiler and Frame Debugger; Unreal
`stat unit` and Unreal Insights; Xcode Instruments and Android Studio profilers for device-level CPU, GPU and energy.

When the agent cannot measure, write in the deliverable: "Performance not measured. Suggested measurement: …" and give
the scenario and tool.

## Frame budgets

The frame budget is 1000 ms divided by the target frame rate:

| Target | Budget per frame |
|---|---|
| 30 FPS | 33.3 ms |
| 60 FPS | 16.6 ms |
| 120 FPS | 8.3 ms |

Do not plan to spend the whole budget. A common heuristic is to leave around 20% headroom for spikes, OS work and
weaker devices. Split the remainder explicitly, for example at 60 FPS: simulation 4 ms, rendering submission 6 ms,
UI 1 ms, audio and misc 1 ms. A consistent 30 FPS often feels better than an unstable 60; on mobile, a capped 30 FPS
also saves battery.

## Allocations and garbage collection

In JavaScript and C#, per-frame allocations eventually trigger garbage collection pauses that appear as hitches.

- Avoid creating objects, arrays, closures and strings inside `update` hot paths; reuse scratch vectors.
- Pool frequently spawned objects (bullets, particles, damage numbers).
- Avoid `array.map/filter` chains every frame on large lists; use plain loops over preallocated arrays.
- Avoid string building for UI every frame; update text only when the value changes.
- In Unity, watch for hidden allocations: LINQ, boxing, `GetComponent` in loops, `foreach` over some collections in
  older runtimes. In Unreal C++, reserve `TArray` capacity and avoid per-tick `NewObject`.

## Draw calls and batching

The CPU cost of rendering grows with the number of draw calls and state changes (texture, shader, blend mode).

- Pack sprites that render together into texture atlases so they can batch.
- Group objects by material/texture; interleaving textures breaks batches.
- For tile maps, render static layers once into a cached texture or use the engine's tilemap renderer.
- Reduce overdraw: large transparent layers stacked over the full screen cost fill rate, especially on mobile GPUs.
- In canvas 2D, avoid changing `globalAlpha`, filters and fonts per sprite; use integer coordinates for pixel art.

## Mobile: thermal and battery

Mobile devices throttle CPU and GPU clocks when hot, so a game that runs at 60 FPS for two minutes may drop after ten.

- Test sessions of at least 10–15 minutes on a mid-range device, not only short runs on a flagship.
- Cap the frame rate to what the design needs; idle menus can render less often.
- Lower render resolution before cutting gameplay features; for pixel art, render at native low resolution and scale.
- Avoid unnecessary work when the app is backgrounded or the tab is hidden (pause the loop and audio).
- Prefer simple shaders and fewer full-screen post effects.

## Memory budgets

Set a memory budget per target device class early and track it. Main consumers are textures, audio and level data.

- Texture memory is roughly width × height × 4 bytes uncompressed (plus about a third more with mipmaps). A 2048×2048
  RGBA texture is about 16 MB uncompressed.
- Use platform texture compression where the engine supports it; keep pixel-art atlases small and power-of-two when
  required.
- Stream or unload assets per level; release references so GC or engine unloading can reclaim them.
- Low-memory mobile devices may terminate the app without a crash dialog; treat memory as a hard limit.

## Optimization report template

- Target and scenario; measured before/after (or "not measured").
- Suspected bottleneck and evidence.
- Change made, expected effect, risks (visual change, behaviour change).
- How to verify: exact steps and tool for the human.

## Further reading
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
