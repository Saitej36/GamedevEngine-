---
id: production.dependency-management
title: Dependency management and the critical path
tags: dependency, critical path, float, slack, handoff, blocker, finish-to-start, sequencing, cross-discipline
---
# Dependency management and the critical path

Dependencies decide what can happen in parallel and what must wait. Game production has many cross-discipline handoffs
(design → code → art integration → QA), so dependency mistakes show up as idle people and late surprises.

## Dependency types

Dependency management uses four standard relationships between tasks A and B:
- **Finish-to-start (FS)**: B starts after A finishes. Most common: implementation starts after the design spec exists.
- **Start-to-start (SS)**: B starts after A starts. Art can begin final assets once the style guide is in progress.
- **Finish-to-finish (FF)**: B finishes after A finishes. QA sign-off finishes after the last fix.
- **Start-to-finish (SF)**: rare in games; ignore unless needed.
Also distinguish **hard** dependencies (cannot start without it) from **soft** ones (could start with a placeholder).
Turning hard dependencies into soft ones with placeholders, stubs or agreed interfaces is the main lever for parallel work.

## Critical path and float

The critical path is the longest chain of dependent tasks; its length is the shortest possible project duration.
Calculation (forward and backward pass):
1. Forward pass: Earliest Start (ES) = max Earliest Finish of predecessors; EF = ES + duration.
2. Backward pass: Latest Finish (LF) = min Latest Start of successors; LS = LF − duration.
3. **Total float** = LS − ES. Tasks with float 0 are on the critical path.

Worked example (days, all estimates):
| Task | Duration | Depends on | ES | EF | LS | LF | Float |
|---|---|---|---|---|---|---|---|
| A Design spec | 2 | — | 0 | 2 | 0 | 2 | 0 |
| B Implement | 4 | A | 2 | 6 | 2 | 6 | 0 |
| C Create sprites | 3 | A | 2 | 5 | 3 | 6 | 1 |
| D Integrate art | 1 | B, C | 6 | 7 | 6 | 7 | 0 |
| E QA pass | 2 | D | 7 | 9 | 7 | 9 | 0 |
Critical path A → B → D → E = 9 days. Sprites have 1 day of float; any slip in implementation slips the whole delivery.

## Cross-discipline handoffs

A handoff is a dependency between disciplines, and most delays hide there. Make every handoff explicit:
- **What**: the exact file(s) handed over, e.g. `design/jump-spec.md`, `assets/sprites/player.png`.
- **Definition of ready**: what the receiver needs (acceptance criteria, dimensions, naming convention, API).
- **When**: the date or the predecessor task.
- **Who**: sender and receiver roles.
Typical game handoff chain: Designer spec → Programmer implementation + Artist assets (parallel) → integration →
QA test plan execution → Director review. QA can write the test plan as soon as the spec exists, off the critical path.

## Dependency register template

```
| ID | From (task/file) | To (task) | Type | Hard/Soft | Owner | Needed by | Status |
| D1 | design/jump-spec.md | Implement jump | FS | Hard | Designer→Programmer | day 2 | delivered |
```
Status values: planned / at risk / blocked / delivered. Check "delivered" by confirming the file exists in the workspace.

## Managing dependencies during a sprint

- Review blocked and at-risk items daily; a blocked critical-path item is the top production priority.
- Spend float deliberately: if non-critical work slips into its float, the critical path does not change, but the
  float is gone and the task becomes critical.
- Break chains: agree an interface or data format early so both sides work in parallel.
- Avoid late-sprint handoffs: work handed over on the last day cannot be integrated or tested in that sprint.
- Watch for circular dependencies (design waits on a prototype that waits on design); break them with a timeboxed spike.

## Pitfalls

- Tracking dependencies only inside one discipline.
- Treating estimates as dates; carry the uncertainty (see [K:production.risk-assessment]).
- Marking a handoff delivered because someone said so, without checking the file.
- Ignoring external dependencies such as store requirements or third-party libraries.
