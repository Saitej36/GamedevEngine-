---
id: qa.regression-testing
title: Regression testing
tags: regression, smoke test, sanity test, test suite, change impact, retest, build verification, release candidate
---
# Regression testing

Regression testing confirms that changes did not break behaviour that previously worked. Games regress constantly:
a physics tweak breaks a level, a UI refactor breaks controller navigation, a save format change breaks old saves.

## Types of regression pass

Regression testing comes in layers that trade depth for speed:
- **Smoke test (build verification)**: 10–20 critical checks that decide whether a build is testable at all: game
  launches, main menu works, a level loads, player can move, save/load works, no crash in the first minutes.
- **Sanity / targeted regression**: tests around the changed area and its known dependents.
- **Full regression**: the whole suite, used at milestones such as beta and release candidate (see
  [K:production.milestone-management]).
- **Bug-fix verification**: re-run the exact reproduction steps of a fixed bug, then nearby cases.

## Choosing tests by change impact

Targeted regression starts from what changed. For each change, list:
1. Files and systems touched (from the task description, diff or commit notes).
2. Systems that depend on them: callers of a changed function, levels using a changed prefab, UI bound to changed data.
3. Previously fixed bugs in the same area: old bugs are a good predictor of fragile code.
Impact map example:
| Change | Direct tests | Dependent areas |
|---|---|---|
| `src/physics.js` gravity tweak | jump height, fall speed | every platforming level, enemy knockback |
| Save format v2 | save/load cases | loading v1 saves, settings persistence |

## Building and maintaining the suite

- Every fixed bug of severity S1/S2 gets a regression case (manual or automated, see [K:qa.test-automation]).
- Tag cases: `smoke`, `core`, `area:<system>`, `platform:<x>` so subsets can be picked quickly.
- Retire or rewrite cases for removed features; stale cases waste time and hide real coverage.
- Keep expected results specific and current with design changes.
- Prefer automation for stable, deterministic logic (damage formulas, inventory rules, save serialisation); keep manual
  cases for feel, visuals and exploratory checks.

## Regression run record

```
# Regression run — <build id/commit> — <date>
Scope: smoke + area:physics (reason: gravity change in task T-14)
| Case | Status | Executed by | Evidence | Bug |
| SMK-01 Launch to menu | not executed | — | steps for human: open index.html | — |
| PHY-03 Jump height 3 tiles | passed (reported by Programmer, not observed by QA) | Programmer | test output pasted in task | — |
Summary: executed 0 / 12 by QA; 3 reported by others; 9 not executed
```
The status vocabulary is strict: passed only means executed and observed. Results from someone else are labelled with
their source. Unexecuted cases include the exact command or steps for a human.

## Regression without a shell

A QA agent with no shell cannot run the suite. It still adds value by:
- Writing or updating regression cases and automated test files in `tests/` for a human or CI to execute.
- Static review of changed code for likely regressions, citing file:line, e.g. "src/save.js:88 reads `version` but v1
  saves have no version field → likely load failure on old saves (not executed)".
- Producing an explicit "run these" list with commands, such as `node --test tests/` or `npm test`, taken from the
  project's README or package.json rather than invented.

## Pitfalls

- Running only new-feature tests near release; regressions hide in untouched areas.
- Smoke test that grows to 100 cases; keep it fast so it runs on every build.
- Reporting "regression passed" when nothing was executed.
- Not recording the build; a pass on an older build says nothing about the current one.
