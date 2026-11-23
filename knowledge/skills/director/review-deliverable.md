---
id: review-deliverable
role: director
title: Review a deliverable against its acceptance criteria
summary: Verify a completed task criterion by criterion against the actual files (not the report), then approve or request a specific, checkable revision with review_task.
triggers: review, review task, review deliverable, approve, revise, acceptance, check work, quality gate, sign off
packs: direction-craft, studio-core
version: 1.0.0
disciplines: 
genres: any
engines: any
engine_dependent: false
---
## Purpose
Decide with evidence whether a task's output meets its acceptance criteria, and either approve it or send back
precise, verifiable revision points using `review_task`. The review protects every downstream task that depends on
this output.

## Required inputs
- The task: goal, deliverable paths, acceptance criteria, constraints, revision count so far.
- The specialist's completion report.
- The relevant sources of truth: `docs/vision.md`, `docs/gdd.md`, `docs/art/art-bible.md`, `assets/palette.json`,
  `docs/decisions.md`, as applicable.

## Workflow
1. Re-read the task's acceptance criteria. Treat the report as a list of claims to verify, not as evidence
   ([K:direction.deliverable-reviews]).
2. Glob the expected paths. For each deliverable file, Read it and confirm it exists and is substantive. A file named
   in the report that does not exist is a failed criterion.
3. For each criterion in order, gather evidence from files: headings, values, function names, `viewBox` sizes, frame
   groups. Use Grep for mechanical checks (e.g. every `fill="#` value in an SVG appears in `assets/palette.json`; a
   GDD value appears in code config).
4. Record a verdict per criterion: PASS or FAIL, with one line of evidence (file and what was found).
5. Apply standard checks: files are in the role's writable folders and follow naming conventions; values and names
   match sources of truth; a References section cites knowledge where required; no unverifiable claims (e.g. "ran
   the tests" from an agent with no shell — reports must say tests were written but not run); nothing unrelated was
   changed.
6. Decide:
   - All criteria pass and no source-of-truth contradiction: `review_task` approve, with optional non-blocking notes.
   - Any criterion fails or a source of truth is contradicted: `review_task` revise.
   - Passing would require changing scope, vision or an owner decision: `request_approval`
     ([K:direction.escalation-and-approval]).
7. For revise, write each must-fix point as: criterion — what is wrong and where — what to do — how it will be
   verified. Do not add new requirements; create a new task for them ([K:direction.revision-management]).
8. If this is the second failed revision, diagnose the brief (ambiguous criterion, missing input, wrong role or skill)
   and rewrite or split the task instead of revising again.
9. If approval changes a fact (new asset IDs, final values), make sure the owning document is updated and note it in
   `docs/decisions.md`.

## Expected output
- A `review_task` decision (approve or revise) whose comment contains the per-criterion verdict table with evidence.
- For revise: numbered must-fix points, each checkable.
- Where relevant: a new follow-up task, a decision-log entry, or a `request_approval` call.
- References to the knowledge applied, as `[K:...]`, in any review note written to `docs/`.

## Quality checklist
- [ ] Every deliverable path was opened, not assumed from the report.
- [ ] Every acceptance criterion has its own verdict and evidence.
- [ ] Approval only if all criteria pass.
- [ ] Revision points are specific, located and verifiable; none is a new requirement.
- [ ] Consistency with GDD, art bible, palette and decisions was checked.
- [ ] Revision count considered; repeated failure triggered a brief rewrite or escalation.

## Failure conditions
- The task has no acceptance criteria or they are unverifiable: do not guess; rewrite the criteria, record why, and
  revise with the clarified criteria.
- A deliverable cannot be read (missing, empty, outside allowed folders): revise; do not approve on the report alone.
- Criteria and a source of truth contradict each other: resolve the source of truth first or escalate; do not approve
  work you know is inconsistent.
- Verifying a criterion requires running the game or code: state it could not be verified, approve only on what was
  checkable if the criterion allows, and request human testing via `request_approval` where it matters.
