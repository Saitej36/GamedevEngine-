---
id: direction.revision-management
title: Revision management
tags: revision, feedback, revise, actionable feedback, revision limit, iteration, escalation, rework
---
# Revision management

Revision management keeps rework productive. Every revision costs a full task cycle, so a revision request must be
precise enough to succeed the first time, and the number of cycles must be bounded.

## Writing actionable feedback

Actionable feedback names the problem, the location, the expected result and how it will be checked. A useful
structure for each point:

```
[Criterion or rule] — [what is wrong, where] — [what to do] — [how I will verify]
```

Examples:

- "Criterion 2 (palette) — `assets/characters/player.svg` walk-2 uses `#ff0000`, not in the palette — replace with the
  palette red `#c8343a` — I will Grep the file for fills not in `assets/palette.json`."
- "GDD consistency — `src/config.js` sets jumpVelocity 400; `docs/gdd.md` specifies 360 — use the GDD value or explain
  in the report why the GDD is wrong — I will compare both files."

Weak feedback to avoid: "Doesn't feel right", "Needs more polish", "Make the character more heroic". If the feedback
is a matter of taste, convert it to a checkable rule first ("raise the head two pixels and widen the shoulders to 10 px
so the silhouette reads as strong").

## Prioritising revision points

Revision requests should separate must-fix from optional:

- **Must fix** — failed acceptance criteria and contradictions with sources of truth. Limit to what blocks approval.
- **Should fix** — clear improvements that are cheap; include only if they are in scope.
- **Note for later** — ideas for a future task; do not put these in the revision.

A heuristic is that a revision with more than five must-fix points usually means the task was too big or the brief
was unclear; consider splitting or rewriting the task instead of revising.

## Revision limits

Bound revision cycles to prevent loops. A common studio heuristic:

- **Revision 1:** normal; specific feedback.
- **Revision 2:** check whether the brief is the problem. Re-read the original task: were the criteria ambiguous,
  inputs missing, or the skill wrong?
- **After 2 failed revisions:** stop revising. Choose one: rewrite the task with clearer criteria, split it, provide
  a missing input (e.g. a spec), reassign to a better-suited role, or escalate.

Each revision should show progress on the specific points. If the same criterion fails twice, the feedback or the
brief is not working.

## Diagnosing why work keeps failing

Repeated revisions usually have one of these causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| Same criterion fails repeatedly | criterion ambiguous or uncheckable | rewrite the criterion |
| Agent asks for or invents missing info | input not provided | add the input or dependency |
| Output good but different from expectation | expectation not written down | write a spec or exemplar |
| Agent claims something it cannot do | capability mismatch (e.g. running code) | change criterion or role |
| Fix in one place breaks another | hidden coupling between files | coordinate or sequence tasks |

## When to escalate a revision

Escalate to the owner via `request_approval` when resolving the revision would:

- change scope, schedule or a milestone the owner approved;
- change the vision, pillars, or a decision the owner made;
- require a trade-off with no clear answer from the pillars (e.g. readability vs. a requested art style);
- exceed the revision limit with no internal fix.

Do not escalate routine quality issues; those are the Director's job.

## Recording revisions

Keep revision history traceable: the revise comment in `review_task` holds the specific points; significant
decisions made during revision go into the decision log; and if a source-of-truth document changed as a result,
note which dependent tasks or assets need re-checking.

## Revision pitfalls

- Bundling new requirements into a revision.
- Contradicting earlier feedback without acknowledging it.
- Revising the same task five times instead of fixing the brief.
- Accepting "fixed" in a report without re-checking the file.
