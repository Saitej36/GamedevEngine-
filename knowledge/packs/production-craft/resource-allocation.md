---
id: production.resource-allocation
title: Resource allocation across disciplines
tags: resource allocation, staffing, capacity, utilization, bottleneck, load balancing, discipline, specialist, cross-training
---
# Resource allocation across disciplines

Resource allocation decides who works on what, when, so that the scarcest skills are spent on the most important work.
In games the binding constraint is rarely total headcount; it is usually one discipline (often animation, tech art or a
single systems programmer) that every feature passes through.

## Building a capacity-versus-demand table

Resource allocation starts with demand per discipline compared to capacity per discipline, for each sprint or milestone.

`demand (hours) = Σ estimated hours of planned work for that discipline`
`load % = demand ÷ capacity × 100`

| Discipline | Capacity (est.) | Demand (est.) | Load |
|---|---|---|---|
| Design | 34 h | 28 h | 82% |
| Programming | 42 h | 55 h | 131% |
| Art | 36 h | 20 h | 56% |
| QA | 42 h | 18 h | 43% |

Read the table as: programming is the bottleneck; art and QA have slack. Use capacity with a focus factor as in
[K:production.sprint-planning]. A common heuristic is to plan disciplines at 80–90% load; above 100% the plan is fiction.

## Resolving overload

Options for an overloaded discipline, in roughly increasing cost:
1. **Re-order** work so the bottleneck works only on items on the critical path (see [K:production.dependency-management]).
2. **Reduce demand**: simplify the feature, reuse existing systems, use placeholder assets, or cut (see
   [K:production.scope-and-delivery]).
3. **Shift work** to disciplines with slack: designers can author data or tuning tables instead of asking for code;
   QA can write test cases and acceptance criteria early; art can prepare assets ahead of integration.
4. **Move dates**: let the bottleneck work finish later and sequence dependents accordingly.
5. **Add people**: last, because onboarding costs the existing team time first. Adding people late to a late project
   tends to make it later.

## Utilization and why 100% is wrong

Queueing behaviour means waiting time rises sharply as utilization approaches 100%: a person loaded at 95% has almost no
ability to absorb urgent work, so every interruption delays something else. Keep slack deliberately in the bottleneck
discipline. Slack in non-bottleneck disciplines is not waste; it is what lets them respond to the bottleneck's output
quickly.

## Allocation principles for game teams

- **Specialists on specialist work.** Do not spend the only shader programmer on menu code.
- **Pair or shadow on single points of failure.** If only one person (or one agent role) understands a system, record
  the knowledge in docs and give a second owner review duty.
- **Limit context switching.** One person on more than two concurrent features loses efficiency; prefer finishing.
- **Front-load QA involvement.** QA writing test plans during design costs little and prevents rework at the end.
- **Protect the creative owner's time** for reviews and decisions; a blocked decision stalls every discipline.

## Allocation in an agent studio

In Pixel Studio each role is an agent with its own write scope, so allocation is mostly about task ordering:
- Assign a task only to the role that can write the required files (e.g. code in `src/` to the Programmer,
  `qa/` reports to QA, plans in `docs/production/` to the Producer).
- Sequence handoffs so the upstream file exists before a downstream task starts (design spec before implementation,
  implementation before test execution).
- Estimate in task count and complexity rather than hours if no timing history exists; label it as an estimate.
- Ground the allocation in the actual task list and the files present in the workspace, not in an assumed plan.

## Allocation plan template

```
# Resource allocation — <milestone/sprint>
Basis: task list <path>, estimates by <who>, all figures estimates
| Discipline | Capacity | Demand | Load | Bottleneck? |
Bottleneck actions: <reorder/cut/shift with owner>
Single points of failure: <system → backup owner>
Open questions: <decisions needed, from whom, by when>
```

## Pitfalls

- Allocating by total team hours and missing a per-discipline overload.
- Assuming a person is 100% available; ignoring reviews, support and leave.
- Rebalancing silently: always state what moved and why, so the creative owner can object.
