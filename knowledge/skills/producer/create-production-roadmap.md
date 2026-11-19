---
id: create-production-roadmap
role: producer
title: Create a production roadmap
summary: Turn the project's design docs, task list and existing files into a milestone roadmap with exit criteria, estimates labelled as estimates, dependencies, risks and a cut list.
triggers: roadmap, production plan, milestone plan, schedule, project plan, timeline, release plan
packs: production-craft, studio-core
---
## Purpose
Produce a milestone-based production roadmap that tells the team what state the game must reach at each milestone, in
what order work happens, and what will be cut if time runs out. The roadmap must be grounded in the actual task list
and the files in the workspace, not in a generic plan.

## Required inputs
- The project brief or GDD (typically under `docs/` or `design/`); read it, do not assume it.
- The current task list (from the task brief and any existing `docs/production/` files).
- The workspace contents: what already exists in `src/`, `assets/`, `design/`, `qa/` (use Glob to list).
- Target date or number of sprints, and team composition, if given. If missing, state the assumption you used.
- Existing roadmap at `docs/production/roadmap.md`, if any (update it rather than replace it blindly).

## Workflow
1. Read the brief/GDD and list the must-have features and the core promise in one paragraph.
2. Glob the workspace and record what exists per discipline; this is the real starting point. Note files that are
   referenced in tasks but missing.
3. Choose the milestones that apply (concept, pre-production, vertical slice, alpha, beta, release candidate) per
   [K:production.milestone-management]. Small projects may merge milestones; say which and why.
4. For each milestone write 4–8 checkable exit criteria tied to real files or features (e.g. "`src/player.js` implements
   AC-1..AC-3 of design/movement.md; QA test status recorded in `qa/`").
5. Sort features with MoSCoW and assign them to milestones; build an ordered cut list from could- and should-haves
   [K:production.scope-and-delivery].
6. Estimate effort per milestone with three-point estimates where uncertain, `E = (O + 4M + P) ÷ 6`, and label every
   figure "estimate" with its basis [K:production.risk-assessment].
7. Identify cross-discipline dependencies and the critical path between milestones [K:production.dependency-management].
8. List the top 5 risks with probability × impact scores, owner and response.
9. Add a buffer (sprint or percentage) before release candidate and state its size.
10. Write `docs/production/roadmap.md` with the template below, ending with a References section citing `[K:...]` ids used.

Template:
```
# Production roadmap — <project> — <date>
Basis: <files read>; all durations are estimates
## Milestones (table: milestone · goal · target sprint/date · exit criteria · status)
## Feature allocation (MoSCoW per milestone)
## Critical path and key handoffs
## Top risks (P × I)
## Cut list (ordered)
## Assumptions and open questions
## References
```

## Expected output
- `docs/production/roadmap.md` containing milestones with exit criteria, MoSCoW allocation, critical path, risk table,
  ordered cut list, buffer, assumptions and references.
- A short summary in the task reply naming the critical path and the top risk.

## Quality checklist
- [ ] Every exit criterion is checkable and points to a feature, file or test result
- [ ] Every number is labelled as an estimate with its basis
- [ ] Workspace state was read, not assumed; missing referenced files are listed
- [ ] Must-haves fit the estimated capacity, or the overrun is stated plainly
- [ ] Cut list is ordered and flagged as needing Director approval
- [ ] Only `docs/production/` was written
- [ ] References section cites the knowledge used

## Failure conditions
- No brief, GDD or task list exists: stop and report what is missing instead of inventing features.
- Must-haves exceed any plausible capacity: deliver the roadmap with the gap stated and escalate to the Director rather
  than hiding it with optimistic estimates.
- Conflicting requirements between documents: list the conflicts and ask the Director to decide.
- Asked to write outside `docs/production/`: decline that part and report it.
