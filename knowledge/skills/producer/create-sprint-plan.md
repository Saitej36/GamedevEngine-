---
id: create-sprint-plan
role: producer
title: Create a sprint plan
summary: Build a sprint plan with a sprint goal, per-discipline capacity using a focus factor, committed items from the real task list, dependencies, risks and an explicit not-in-sprint list.
triggers: sprint plan, sprint planning, iteration plan, next sprint, capacity, velocity, backlog commitment
packs: production-craft, studio-core
version: 1.0.0
disciplines: publishing
genres: any
engines: any
engine_dependent: false
---
## Purpose
Create a realistic plan for one sprint that the team can finish, built from the actual backlog and workspace state,
with capacity and estimates shown so the Director can see what fits and what does not.

## Required inputs
- The task list or backlog (task brief, `docs/production/backlog.md` or roadmap); read the real items.
- The roadmap and current milestone exit criteria (`docs/production/roadmap.md`), if present.
- Sprint length and available roles; previous sprint plans or reviews for velocity history, if any.
- Acceptance criteria for candidate items (design docs or `qa/`).

## Workflow
1. Read the roadmap and backlog; note the current milestone and its exit criteria.
2. Read previous sprint reviews in `docs/production/` to obtain velocity and focus factor. If none, state "no history —
   first sprint" and plan by capacity at ~70–80%.
3. Write one testable sprint goal that advances the current milestone [K:production.sprint-planning].
4. Compute capacity per discipline: `days × hours/day × focus factor`; for agent roles without hours history, use task
   counts and complexity (S/M/L) and label it as an estimate.
5. Glob the workspace to confirm the state of each candidate item (e.g. design spec exists before implementation is
   planned; implementation exists before QA execution is planned).
6. Pull items in backlog order until any discipline reaches ~80–90% of capacity. Mark items without acceptance criteria
   as "not ready" and do not commit them.
7. Record intra-sprint dependencies and handoff days; avoid handoffs in the last 20% of the sprint
   [K:production.dependency-management].
8. List the top 3 sprint risks with probability × impact and an owner [K:production.risk-assessment].
9. Write the "not in this sprint" list with reasons.
10. Write `docs/production/sprint-<n>.md` and end with a References section.

Template:
```
# Sprint <n> — <dates or sequence>
Goal: <one sentence>
Capacity (estimate): <per role, basis>
Velocity reference: <history or "none">
| ID | Item | Owner role | Est | Depends on | Acceptance ref | Files expected |
Handoffs: <from → to, file, by when>
Risks: <top 3, P×I, owner>
Not in sprint: <item — reason>
Definition of done: <link or list>
References
```

## Expected output
- `docs/production/sprint-<n>.md` with goal, capacity, committed items, dependencies, risks, exclusions and references.
- A short reply stating the goal, load per discipline and any overloaded role.

## Quality checklist
- [ ] Sprint goal is one testable sentence
- [ ] Capacity shown per discipline with focus factor; all figures labelled as estimates
- [ ] No discipline planned above ~90% without an explicit note
- [ ] Every committed item has an owner role able to write its files, an estimate and acceptance criteria
- [ ] QA execution time is included for every feature item
- [ ] Item states were checked against actual files
- [ ] Not-in-sprint list present; only `docs/production/` written; references cited

## Failure conditions
- Backlog is empty or items lack enough description to estimate: report what is needed and stop.
- Sprint goal conflicts with roadmap priorities: flag the conflict to the Director rather than choosing silently.
- Committed scope exceeds capacity and the Director required it anyway: write the plan, state the overload and the risk
  plainly, and propose cuts.
- Velocity or status claims cannot be verified from files: label them as reported, not confirmed.
