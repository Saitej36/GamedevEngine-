---
id: production.sprint-planning
title: Sprint planning, capacity and velocity
tags: sprint planning, capacity, velocity, focus factor, story points, sprint goal, commitment, estimation, planning poker
---
# Sprint planning, capacity and velocity

Sprint planning turns the top of an ordered backlog into a commitment the team believes it can finish. A good plan has
one sprint goal, a capacity calculation, a list of items that fits it, and an explicit list of what was left out.

## Sprint goal

A sprint goal is one sentence describing the outcome, not the activity: "A player can complete level 1 with placeholder
art and the jump feels final" rather than "work on level 1". The goal lets the team decide what to drop if the sprint
runs long: anything not serving the goal is cut first. Keep goals testable so QA can verify them at review.

## Capacity with a focus factor

Capacity is the time actually available for sprint work. Formula:

`capacity (hours) = Σ per person (sprint days − days off) × hours per day × focus factor`

The **focus factor** accounts for meetings, reviews, support and context switching. A common starting heuristic is 0.6–0.7
for an established team and lower (around 0.5) for a new team or one carrying live support; calibrate it from history:
`focus factor = hours delivered on planned work ÷ hours available`.

Worked example, 10-day sprint:
| Role | Days available | Hours/day | Focus | Capacity |
|---|---|---|---|---|
| Programmer | 10 | 6 | 0.7 | 42 h |
| Designer | 8 | 6 | 0.7 | 33.6 h |
| Artist | 10 | 6 | 0.6 | 36 h |
| QA | 10 | 6 | 0.7 | 42 h |

Capacity is per discipline: a sprint can have spare programmer time and still be overloaded on art. Check each column.

## Velocity and story points

**Velocity** = story points of items fully done (meeting the definition of done) in a sprint. Partly done items count as
zero. Plan with a rolling average of the last three sprints, and treat a range rather than one number:
`plan between min(last 3) and average(last 3)`.

If there is no history (sprint 1), plan in hours from capacity and commit to roughly 70–80% of it; record the result as
the first velocity data point. Never compare velocity across teams, and never raise the target to "improve" velocity —
points inflate instead.

Estimation scales: a modified Fibonacci series (1, 2, 3, 5, 8, 13) for points. Any item at 13 or above should be split
before it enters a sprint. For hours, use three-point estimates for uncertain work (see [K:production.risk-assessment]):
`expected = (optimistic + 4 × most likely + pessimistic) ÷ 6`.

## Planning procedure

1. Confirm the backlog top is refined: each item has acceptance criteria, an owner discipline and an estimate.
2. State the sprint goal and check it with the creative owner.
3. Compute capacity per discipline.
4. Pull items in order until any discipline reaches ~80–90% of capacity; leave the rest as buffer for bugs and review.
5. Check dependencies inside the sprint: an art handoff due on day 9 of 10 leaves no time to integrate.
6. Write the "not in this sprint" list so cuts are visible.
7. Label every number as an estimate and say what it is based on (history or judgment).

## Sprint plan template

```
# Sprint N — <dates>
Goal: <one sentence>
Capacity (estimate): Prog 42h · Design 34h · Art 36h · QA 42h  (focus 0.7/0.6)
Velocity reference: last 3 = 18, 22, 20 → plan 18–20 pts
| ID | Item | Owner | Est | Depends on | Acceptance ref |
Not in sprint: <items + reason>
Risks: <top 3 with owner>
```

## Pitfalls

- Planning to 100% capacity; any surprise breaks the sprint.
- Committing items with no acceptance criteria; QA cannot sign them off.
- Ignoring QA capacity; features finish on the last day and are never tested.
- Treating the plan as fixed: if the goal becomes unreachable, renegotiate scope with the creative owner mid-sprint
  rather than quietly letting items spill over.
