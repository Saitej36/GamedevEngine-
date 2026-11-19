---
id: production.scope-and-delivery
title: Scope control and delivery
tags: scope, moscow, cut list, scope creep, change request, buffer, triple constraint, prioritisation, delivery
---
# Scope control and delivery

Most game projects run out of time before they run out of ideas. Scope control is the discipline of deciding what will
not be built, early and explicitly, so the parts that ship are finished and polished.

## The fixed-time, flexible-scope model

Delivery trades among scope, time, quality and team. In games, release dates and team size are often fixed, and
quality below a bar is not shippable, so **scope is the variable**. Plan as if the date is fixed and treat feature
scope as the adjustable quantity. If scope is also fixed, the only remaining variable is quality, which usually shows up
as crunch and bugs.

## MoSCoW prioritisation

MoSCoW sorts every feature or content item into four buckets:
- **Must have** — the game does not work or does not deliver its core promise without it (core loop, save, controls).
- **Should have** — important, painful to lose, but the game still works (secondary mode, extra enemy types).
- **Could have** — nice to have; first to go (cosmetics, extra polish passes, bonus levels).
- **Won't have (this release)** — explicitly out; written down to stop it returning silently.

A common heuristic is to keep must-haves to around 60% of estimated effort so that should- and could-haves provide room
to absorb overruns. If must-haves alone exceed capacity, the plan is already over scope.

## Cut lists

A cut list is a pre-agreed, ordered list of what goes first if time runs out. Prepare it at milestone start, when cuts are
calm decisions rather than emergency ones.
```
| Order | Item | Bucket | Effort saved (est.) | Player impact | Dependencies affected | Approved by |
| 1 | Bonus level 6 | Could | 3 days | low | none | Director |
| 2 | Enemy variant C | Should | 4 days | medium | level 4 rebalance | Director |
```
Order by best effort saved per unit of player impact. Check dependencies: cutting a system can orphan content built on it.

## Controlling scope creep

Scope creep is the gradual addition of work without matching time. Controls:
1. **Baseline**: freeze the milestone scope in `docs/production/` with a date.
2. **Change requests**: any addition is written down with estimate, impact and what it replaces.
3. **Swap, don't add**: a new item enters only if an item of similar effort leaves.
4. **Feature lock at alpha**: after alpha, only bug fixes and tuning without a formal exception.
5. **Watch gold-plating**: polishing beyond acceptance criteria is creep too.
Change request template: `Request · Requested by · Reason · Estimate (est.) · Schedule impact · Proposed trade-off · Decision · Date`.

## Buffers

A buffer is planned time with no assigned feature work, kept to absorb estimation error and bugs. Practical forms:
- **Sprint buffer**: plan to ~80–90% of capacity (see [K:production.sprint-planning]).
- **Milestone buffer**: a final sprint or a percentage of the milestone reserved for fixing and polish. A common
  heuristic is 15–25% for new teams or unproven tech.
- **Project buffer** sized from PERT: sum of expected durations plus about 1–2 combined standard deviations
  (see [K:production.risk-assessment]).
Track buffer consumption: if half the milestone is gone and 80% of the buffer is used, trigger the cut list now.

## Delivery checks

- [ ] Every must-have has acceptance criteria and a verification status
- [ ] Cut list exists, is ordered and approved by the creative owner
- [ ] Change requests logged with decisions
- [ ] Buffer consumption tracked against elapsed time
- [ ] Known-issues list written for anything shipping with defects

## Pitfalls

- Cutting quality instead of features ("we'll fix bugs after launch").
- Cut lists made by the Producer alone; cuts are creative decisions and need the creative owner.
- Hidden scope: tutorials, menus, settings, save systems, accessibility and localisation are often missing from estimates.
- Calling buffer "slack to fill"; once spent on features it no longer protects the date.
