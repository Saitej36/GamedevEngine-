# Performance Optimization: Measure First, Then Fix One Bottleneck

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/performance-optimization/SKILL.md, skills/disciplines/performance-optimization/references/profiling-and-budgets.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/skills/perf-profile/SKILL.md, .claude/agents/performance-analyst.md
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: re-targeted profiler notes from Unreal 5.8 and Unity 6.3 to UE 5.4 and Unity 6 / 2022.3 LTS; removed engines Pixel Studio does not target, headless scripts and shell commands; added browser DevTools notes for Phaser 3.90; merged the "not assessed" reporting rule; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## The measure-first loop

**Set a budget, measure, find the one bottleneck, fix it, measure again, report the numbers.**
Guesses usually target the wrong system.

1. Turn the complaint into a number and a repeatable worst-case scene (test level, recorded input,
   fixed seed).
2. **Uncap** VSync and frame caps before measuring: a 4 ms frame and a 15 ms frame both show
   60 FPS. Read frame time in milliseconds, not FPS.
3. Profile a **release-like build on target hardware**; editor and debug builds add overhead.
4. **Split CPU from GPU** and work on the side nearest the frame time.
5. Fix the single biggest cost, preferring doing less work over polishing a hot line.
6. Re-measure the same scene on the same machine, three runs, and keep or revert on the numbers.
7. Commit per-subsystem budgets so the fix stays fixed.

**No data means no verdict.** A metric with no measurement, or no committed budget, is reported
as `NOT ASSESSED`, never as a pass or as "headroom" against a placeholder. Code reading identifies
candidates; only runtime profiling confirms them.

## Frame budgets

| Target | Budget per frame |
|---|---|
| 30 FPS | 33.3 ms |
| 60 FPS | 16.67 ms |
| 120 FPS | 8.33 ms |

Example split at 60 FPS: gameplay scripts about 5 ms, physics about 3 ms, render submission about
4 ms, UI about 2 ms, the rest slack; AI is often given 2 ms. On mobile keep 20–30 % headroom for
thermal throttling. Report average **and** p95 or p99 frame time; averages hide hitches.

## CPU-bound or GPU-bound

- **GPU ≫ CPU:** overdraw, shader cost, resolution (a 2× pixel ratio is 4× the pixels), lights and
  shadows.
- **CPU ≫ GPU:** inspect main and render threads: scripts, physics, pathfinding, allocations and
  GC, draw submission and state changes.
- **Alternating:** find the spike in the timeline; one system usually owns it.

CPU micro-optimizations do nothing for a GPU-bound frame, and the reverse. If a change did not move
frame time, revert it and re-triage.

## Recurring fixes

- **Pooling:** bullets, particles, damage numbers, wave enemies and audio one-shots are recycled,
  not created and destroyed. Pre-warm at load, cap the pool, choose an overflow policy, and fully
  reset state (velocity, timers, event subscriptions) on release.
- **Zero steady-state allocation:** no per-frame `new`, LINQ, closures, string building or boxing
  in update loops; reuse lists and buffers; use non-allocating physics queries; cache lookups.
  Garbage-collection pauses show up as periodic hitches.
- **Draw calls:** atlas textures and share materials so sprites batch; instance identical meshes;
  bake static lighting; reduce overlapping transparent layers.
- **Do less:** run AI and expensive checks on timers and stagger them; spatial partitioning for
  queries; LOD and culling; spread generation and loading across frames.
- **First-use hitches:** shader or pipeline compilation the first time an effect appears; warm it
  during loading.

## Asset budgets and mobile thermals

| Asset | Desktop | Mobile |
|---|---|---|
| Texture max size | 2048–4096 | 1024–2048, compressed (ASTC) |
| Character triangles | 30k–80k | 5k–20k, with LODs |
| Draw calls per frame | low thousands | a few hundred |
| Real-time lights | a few | 1–2 plus baked |

A phone that holds 60 FPS for two minutes and then drops is overheating. Cap the frame rate, keep
headroom and reduce sustained GPU load. Agents cannot feel a device heat up, so ask a human to play
15 minutes on the target phone and report frame time in the first and last minute.

## Per-engine profilers

- **Unreal Engine 5.4:** the `stat unit` overlay splits Frame, Game (game thread), Draw (render
  thread) and GPU milliseconds; `stat scenerendering` shows draw calls; Unreal Insights records
  timeline traces; `ProfileGPU` gives a per-pass GPU breakdown. Profile a Development or Test
  build, and use PSO caching for first-use hitches. Verify on UE 5.4: PSO precaching behaviour for
  your RHI.
- **Unity 6 / 2022.3 LTS:** Profiler window (CPU, GPU, Rendering, Memory modules) attached to a
  Development build on device; Deep Profile only sparingly, because it distorts timings. Frame
  Debugger shows what breaks batching; the Memory Profiler package covers leaks.
  `ProfilerRecorder` and `FrameTimingManager` feed an in-build HUD. Android and iOS default to
  30 FPS unless `Application.targetFrameRate` is set. Under URP the SRP Batcher takes precedence
  over material GPU instancing; the GPU Resident Drawer is Unity 6 only.
- **Phaser 3.90 / browser:** Chrome or Edge DevTools Performance panel (main-thread flame chart,
  GC events, frame timeline) and Memory panel heap snapshots for leaks; `performance.now()` around
  suspect code; `game.loop.actualFps` for an overlay. Pool with Groups (`group.get()`, deactivate
  and hide instead of destroy). Frequently changing `Text` objects re-render a texture on each
  change; bitmap text is cheaper for scores and timers. Test on a real mid-range phone browser.

## Reporting

Report scene, hardware, build type, before and after (average and p95/p99), the bottleneck and the
fix, plus what was measured by a human versus estimated from code. Each recommendation states
location, expected gain, risk and the owner who implements it: rendering work (LOD, batching,
atlases) goes to the artist or technical art owner, hot-path code to the programmer. Track
regressions build to build; never read a cause from commits when the build has no profile.

## Commands for the human (not run by agents)

Unreal Engine 5.4 in-game console, in a Development build: `stat unit`, `stat unitgraph`,
`stat scenerendering`, `stat hitches`, `ProfileGPU`; uncap with `r.VSync 0` and `t.MaxFPS 0`
before measuring.
