---
id: track-dependencies
role: producer
title: Track dependencies and the critical path
summary: Build or update a dependency register and critical path from the real task list and workspace files, flagging blocked and at-risk handoffs.
triggers: dependencies, critical path, blockers, handoffs, sequencing, what is blocking, float, schedule check
packs: production-craft, studio-core
version: 1.0.0
disciplines: 
genres: any
engines: any
engine_dependent: false
---
## Purpose
Show which tasks wait on which, which chain determines the delivery date, and which handoffs are blocked or at risk, so
the team works on the right thing first. Status must be verified against files in the workspace.

## Required inputs
- The task list with owners and estimates (task brief, sprint plan or roadmap in `docs/production/`).
- The workspace file tree (Glob `src/`, `assets/`, `design/`, `docs/`, `qa/`, `tests/`).
- Existing register `docs/production/dependencies.md`, if any.

## Workflow
1. Read the task list and existing register. For each task note owner role, estimate (labelled estimate) and the file(s)
   it produces.
2. For each task, identify what it needs: another task's output file, a decision, an external item. Classify the
   relationship (FS, SS, FF) and hard vs soft [K:production.dependency-management].
3. Check every claimed "delivered" input by globbing for the file. If missing, set status "blocked" or "at risk"; if the
   file exists but is a stub, say so with the path.
4. Compute ES/EF with a forward pass and LS/LF with a backward pass; total float = LS − ES. Mark float-0 tasks as the
   critical path. Show the arithmetic in a table.
5. Flag: blocked critical-path items (top priority), handoffs scheduled in the last 20% of a sprint, circular
   dependencies, single owners on several critical tasks.
6. Propose actions: placeholders or agreed interfaces to soften hard dependencies, re-ordering, timeboxed spikes, or cuts
   [K:production.scope-and-delivery].
7. Write `docs/production/dependencies.md` with the register, critical path table, flags, actions and References.

Register template:
```
| ID | From (task/file) | To (task) | Type | Hard/Soft | Owner | Needed by | Status | Verified by |
| D1 | design/dash-spec.md | Implement dash | FS | Hard | Designer→Programmer | day 2 | delivered | file exists |
```

## Expected output
- `docs/production/dependencies.md` with dependency register, critical path calculation, blocked/at-risk list,
  recommended actions with owners, and references.
- Reply naming the critical path and the single most urgent blocker.

## Quality checklist
- [ ] Every dependency names a concrete file or decision, not just a task title
- [ ] Each "delivered" status was verified by file existence, or labelled "reported, not verified"
- [ ] Forward/backward pass shown; float computed correctly
- [ ] Critical path stated; durations labelled as estimates
- [ ] Actions have an owner role and a date or sequence point
- [ ] Only `docs/production/` written; references cited

## Failure conditions
- Task list missing owners or outputs so dependencies cannot be inferred: list the gaps and stop.
- Circular dependency that needs a creative decision: escalate to the Director with options.
- Status reports conflict with the files present: report the discrepancy rather than choosing one version.
