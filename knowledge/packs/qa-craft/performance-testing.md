---
id: qa.performance-testing
title: Performance testing
tags: performance, frame rate, frame time, fps, memory, load time, profiling, budget, stress test, hitch, percentile
---
# Performance testing

Performance testing measures whether the game meets its budgets for frame time, memory, load time and stability on
target hardware. It needs real measurements; estimates and code reading can only point to suspects.

## Budgets and metrics

Performance testing starts from budgets written in the project docs. Frame time is the core metric:
`frame budget (ms) = 1000 ÷ target fps` → 60 fps = 16.7 ms, 30 fps = 33.3 ms, 120 fps = 8.3 ms.
Measure frame time rather than average fps, because averages hide stutter. Report:
- **Average frame time** and **1% / 0.1% worst frame times** (or 99th percentile), which capture hitches.
- **Hitches**: frames over a threshold, e.g. more than 2× the budget, with count per minute.
- **Memory**: peak and steady-state, and growth over time (leaks show as steady climb).
- **Load times**: cold start to menu, menu to gameplay, level transitions.
- **Build/download size** where the platform limits it.
If the project has no written budgets, record that as a finding and propose budgets for the Director to approve.

## Test scenarios

A performance test plan uses repeatable scenarios:
- **Baseline**: a fixed route through a typical level, same duration each run.
- **Worst case / stress**: maximum enemies, particles and effects on screen; largest level.
- **Soak**: play or idle for 30–60 minutes to reveal leaks and slow degradation.
- **Transitions**: repeated load/unload of levels and menus.
- **Low-end target**: the weakest supported device or browser.
Keep conditions fixed between runs: same build, settings, resolution, device, background apps and route. Run each
scenario several times and report the spread, not a single number.

## Measurement tools by platform

Typical sources of measurements, used by a human or CI with access to the build:
- Browser games: the browser's developer tools performance panel and memory panel; an in-game frame time overlay.
- Unity: the Unity Profiler and Frame Debugger.
- Unreal: `stat fps`, `stat unit` and Unreal Insights.
- Mobile: the platform vendor's profiling tools.
Record which tool and version produced each number.

## Performance report template

```
Build: <id/commit>  Device: <model, OS, browser/version>  Settings: <resolution, quality>
| Scenario | Runs | Avg frame ms | 1% worst ms | Hitches/min | Peak mem | Status |
| Baseline L1 | 3 | 14.2 | 22.5 | 0.3 | 310 MB | passed (observed by <human>) |
| Stress 200 enemies | 0 | — | — | — | — | not executed |
Budget: 16.7 ms @60fps, 512 MB
```
Status uses the same strict vocabulary as functional tests: passed only if measured and observed; otherwise not executed,
with steps for a human; numbers from others labelled with their source.

## Static performance review without a shell

A QA agent with no shell cannot run a profiler. It can review code and assets for common performance risks and must
label them as suspects, not measurements:
- Allocation in the per-frame update (new arrays, objects or closures in `update()` / `Update()` / tick).
- Work that scales with entity count squared (all-pairs collision checks).
- Uncached lookups each frame (DOM queries, `GetComponent`, find-by-name).
- Unbounded growth: arrays or listeners added and never removed.
- Oversized textures or audio, many separate draw calls for small sprites.
Format: "Suspect: src/enemies.js:120 loops all enemies × all bullets per frame (O(n·m)); at 200 × 100 that is 20,000
checks/frame. Not measured. Suggest a measurement with 200 enemies in the stress scenario."

## Pitfalls

- Measuring in the editor or debug build and reporting it as shipping performance.
- Average fps only; stutter goes unreported.
- One run per scenario; noise is mistaken for change.
- Changing several variables between runs.
- Optimisation advice presented as measured gain; without a before/after measurement it is a hypothesis.
