# Supplement: Optimize a game for mobile (measure-first method)

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/performance-optimization/SKILL.md, skills/disciplines/performance-optimization/references/profiling-and-budgets.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/skills/perf-profile/SKILL.md, .claude/agents/performance-analyst.md
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: reduced to additions for the existing optimize-mobile-game skill; removed shell commands and engines Pixel Studio does not target; re-targeted to UE 5.4, Unity 6 / 2022.3 LTS and Phaser 3.90; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Additional workflow steps

- Before step 1 of the base workflow, list each input the analysis needs (target device, frame
  rate, budget, profiler summary, worst-case scenario) and mark it FOUND or ABSENT. Any section
  whose input is ABSENT is reported as `NOT ASSESSED — NO DATA`, not estimated.
- Ask the human to measure with VSync and frame caps off where the platform allows, and to read
  frame time in milliseconds. A capped 60 FPS hides whether the frame takes 4 ms or 15 ms.
- In the measurement plan, require a release-like build on the device (Unity Development build
  with the profiler attached; Unreal Development or Test build; a production web build in a real
  phone browser), three runs of the same scene, and average plus p95 or p99 frame time.
- When the evidence includes CPU and GPU times, work only on the side closest to the frame time.
  If a change does not move frame time in the human's re-measurement, recommend reverting it.
- Propose per-subsystem budgets (for example at 60 FPS: scripts about 5 ms, physics about 3 ms,
  render submission about 4 ms, UI about 2 ms) for the Producer to confirm; do not set them
  yourself.
- For Unity mobile targets, check whether `Application.targetFrameRate` is set; Android and iOS
  default to 30 FPS, which can look like a performance problem.
- Add first-use hitches to the plan: ask the human to note frames that spike the first time an
  effect or enemy appears, and propose warming shaders or effects during loading.

## Additional quality checks

- [ ] Every metric in the report is labelled measured-by-human, estimated-from-code or
      `NOT ASSESSED`; no headroom is claimed against a budget nobody committed.
- [ ] The report names the bottleneck side (CPU or GPU) only when the human's data supports it.
- [ ] Each recommendation gives location, expected gain, risk and the role that implements it
      (asset changes routed to the Artist).
- [ ] Pooled objects reset velocity, timers and event subscriptions on release.
- [ ] The thermal test asks for frame time in the first and last minute of a 15-minute session.
- [ ] Before/after numbers come from the same scene, device and build type.

## Additional failure conditions

- The human's numbers come from the editor or a deep-profiling session only: say the timings are
  distorted and ask for a device build capture before ranking fixes.
- Data is absent for every required input: the verdict is `NOT ASSESSED — NO DATA`, naming what is
  missing; deliver only the measurement plan and changes that are safe by construction.
- Two captures disagree by more than run-to-run noise: report both and ask for repeat runs rather
  than picking the favourable one.
