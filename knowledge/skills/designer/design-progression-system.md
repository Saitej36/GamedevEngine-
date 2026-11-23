---
id: design-progression-system
role: designer
title: Design a progression system
summary: Specify how player power, options and goals grow over time using explicit curves, unlock schedules and difficulty pacing, written to design/spec-progression.md with a tuning table.
triggers: progression, leveling, xp curve, unlocks, skill tree, upgrades, difficulty curve, meta progression
packs: design-craft, studio-core
version: 1.0.0
disciplines: progression
genres: any
engines: any
engine_dependent: false
---
## Purpose

Design the progression system so players always have a visible next goal, power and difficulty grow together, and
every number is implementable from formulas. Because the agent cannot playtest, the output states target metrics,
derives numbers from them, and labels all outcomes as estimates.

## Required inputs

- `docs/GDD.md`: pillars, core loop, mechanics, intended game length.
- `docs/BRIEF.md`: audience, session length, scope.
- `design/core-loop.md` and any existing `design/table-*.md` (economy, enemies) that progression must align with.
- Task statement and acceptance criteria.
- Retrieved knowledge: `design.progression-and-balancing`, `design.core-loops`, and `design.economy-and-monetization`
  if progression is bought with currency.

## Workflow

1. Read the GDD, brief and existing tables. Note total intended play time and session length. Number the task's
   acceptance criteria `AC-1…n`.
2. Choose progression types (skill, power, options, content, cosmetic) and state why each serves a pillar.
3. Set target metrics: e.g. levels per session, time to first unlock, time to max level, time-to-kill at key points,
   target attempts for bosses. Label each "target, to verify in playtest".
4. Choose curves with explicit formulas for XP or cost and for enemy or challenge scaling (linear, polynomial,
   exponential, capped). Write parameter values and the reason for each.
5. Build a sample table at key points (start, 25%, 50%, 75%, max): required XP or cost, expected reward rate,
   resulting time-to-level, player power, enemy power, ratio of the two.
6. Check extremes and sensitivity: best and worst build, ±20% on key parameters, multiplicative stacking of bonuses.
   Adjust until no wall, no runaway and no dominant option remains on paper.
7. Write an unlock schedule: what unlocks when, ensuring something new arrives regularly (heuristic: every few
   minutes early, slower later) and that unlocks widen options, not only stats.
8. Define catch-up and failure handling: what happens if a player falls behind the curve.
9. Write `design/spec-progression.md` (rules, curves, schedule, analysis) and `design/table-progression.md` (all tunable
   parameters with units and rationale). Update `docs/GDD.md` with a summary and link, version bump and changelog.
10. Close with AC coverage, Assumptions (including assumed player behaviour), Open questions, and References citing
    `[K:<doc-id>]`.

## Expected output

- `design/spec-progression.md`: progression types, target metrics, formulas, sample table, extremes and sensitivity
  analysis, unlock schedule, catch-up rules, risks with playtest questions, AC coverage, Assumptions, Open questions,
  References.
- `design/table-progression.md`: parameter, value, unit, allowed range, rationale.
- Updated `docs/GDD.md` progression section with link, version bump and changelog.

## Quality checklist

- [ ] Every curve is a formula with named parameters, plus sample values at key points.
- [ ] Target metrics are stated before numbers, and numbers are derived from them.
- [ ] Power and difficulty curves are compared side by side; their ratio stays in a stated band.
- [ ] Extremes and ±20% sensitivity checks are shown, with results labelled "estimate".
- [ ] Bonus stacking is computed (additive vs multiplicative stated explicitly).
- [ ] Unlock schedule gives a visible next goal at every stage.
- [ ] Parameters live in one table; the GDD links rather than duplicates them.
- [ ] No claim that the system "is balanced"; at most "balanced on paper against these targets".

## Failure conditions

- No GDD or core loop exists: report that progression cannot be designed before the loop; offer to design the loop
  first.
- Intended game length or session length is unknown and cannot be reasonably assumed from the brief: ask as `Q-n`
  and stop before tuning numbers.
- Progression conflicts with the existing economy tables owned by the same role but approved by the Director:
  report the conflict and propose options rather than silently changing approved values.
- The task asks for monetized progression the brief excludes, or that violates the ethical guidance in
  `design.economy-and-monetization`: flag to the Director instead of designing it.
