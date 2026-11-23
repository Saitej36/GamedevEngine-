---
id: debug-gameplay
role: programmer
title: Debug a gameplay bug
summary: Find the root cause of a reported gameplay bug by reading code against a reproduction, fix it minimally, and add a regression test the human can run.
triggers: bug, debug, fix, broken, crash, glitch, not working, regression, stuck, falls through, wrong score, frame rate, jitter, flaky
packs: engineering-craft, qa-craft, studio-core
version: 1.0.0
disciplines: combat, ai, input, save, performance
genres: any
engines: any
engine_dependent: true
---
## Purpose
Resolve a reported gameplay defect with a root-cause fix rather than a symptom patch. Because the agent cannot run the
game, debugging is done by reasoning from a reproduction and the code, encoding the bug as a failing regression test,
and giving the human exact steps to confirm the fix.

## Required inputs
- A bug report (usually in `qa/`): steps to reproduce, expected vs actual result, frequency, platform/browser/engine
  version, and seed or save file if relevant.
- Any evidence: console output, logs, screenshots described in the report.
- Access to the relevant `src/` and `tests/` files and the design rule that defines correct behaviour.

## Workflow
1. Read the bug report and restate it in one sentence: "When X, Y happens; expected Z." If steps or expected behaviour
   are missing, stop and request them [K:eng.debugging].
2. Locate the code path: Grep for the entities, events and values named in the report; read the update order from the
   loop or scene down to the failing behaviour.
3. Form hypotheses ranked by likelihood. Check the common game causes first: frame-rate dependence (missing `dt`),
   large `dt` spikes, tunnelling, float comparison, update/collision order, mutation during iteration, stale state after
   restart, leaked event listeners, unreset pooled objects, unseeded randomness.
4. For each hypothesis, find the exact lines that would produce the symptom and confirm it explains every detail of the
   report (frequency, platform, timing). Discard hypotheses that explain only part.
5. Write a failing regression test in `tests/` that reproduces the bug through pure logic (fixed seed, fixed `dt`,
   explicit inputs). If the bug cannot be expressed without the engine, write precise manual verification steps
   instead, and consider whether logic should move into the testable core.
6. Make the smallest fix that addresses the root cause, using `Edit`. Do not refactor unrelated code in the same change.
7. If the cause is still uncertain, add temporary, flag-guarded logging at the suspected boundary (tagged, with frame
   number) and ask the human to run the reproduction and return the output.
8. Search for the same pattern elsewhere (Grep) and list other likely occurrences; fix them only if clearly identical.
9. Write the fix report with a References section, e.g. `[K:eng.debugging]`, `[K:eng.testing-and-deployment]`.

## Expected output
- A minimal code change in `src/` and a regression test in `tests/` (or written manual verification steps).
- A fix report containing: bug summary; root cause in one or two sentences with file and function names; the change
  made; why it fixes every symptom; regression test path and name; exact commands and reproduction steps for the human
  to verify; other places the pattern may occur; risks; and "Not executed by the agent: tests and game not run."
- A References section with `[K:<id>]` citations.

## Quality checklist
- [ ] The root cause explains all reported symptoms, including frequency and platform specifics.
- [ ] A regression test fails without the fix and passes with it, by reasoning shown in the report.
- [ ] The fix is minimal and does not change unrelated behaviour or tuning.
- [ ] Rates are `dt`-scaled and no new frame-rate dependence or unseeded randomness was introduced.
- [ ] Temporary logging is removed or guarded by a debug flag.
- [ ] Only programmer-writable paths were changed.
- [ ] The report states plainly that nothing was executed and gives exact verification commands.

## Failure conditions
- The report lacks reproduction steps or expected behaviour: request them from QA instead of guessing.
- Correct behaviour is undefined or disputed in the design: escalate to the designer/director.
- Two or more hypotheses remain equally plausible after reading the code: provide instrumentation and ask the human to
  run it, rather than shipping a speculative fix.
- The bug lives in engine/editor assets or third-party code the agent cannot edit: document the finding and the
  workaround options.
- The fix would require a large refactor or a design change: report the cause and propose options for approval first.
