---
id: studio.review-standards
title: Review standards
tags: review, reviewer, acceptance criteria, severity, approve, revise, feedback, verification
---
# Review standards

A Pixel Studio review checks a deliverable against its task and against the actual files in the workspace, then
returns a clear decision: Approve or Revise. Reviews are written by the Director, by QA, or by a peer role, and live
in the reviewer's own folder (Director: `docs/`, QA: `qa/`).

## Review procedure

Follow these steps for every review; skipping step 2 is the most common reviewer failure.

1. Read the task statement and list its acceptance criteria as `AC-1…n`. Read `docs/BRIEF.md` for constraints.
2. Open every file the deliverable claims to have produced. Use Glob to confirm the files exist at the stated paths
   and Read to confirm the claimed content is actually there. A summary that says "added dash mechanic" is not
   evidence; the section or function is.
3. Walk the deliverable's traceability table. For each AC, confirm the pointer leads to content that satisfies it.
4. Check consistency with neighbouring sources of truth: names and numbers against `docs/GDD.md`, asset references
   against `assets/`, scope against `docs/production/`.
5. Check honesty labels: anything about runtime behaviour must be marked "not executed"; numbers must be marked as
   estimates with reasoning.
6. Check the References section: cited `[K:...]` ids should be plausible for the claims they support.
7. Classify findings by severity, decide, and write the review file.

## Severity of findings

Classify every finding in a review using four levels:

| Severity | Meaning | Examples |
|---|---|---|
| Blocker | Deliverable cannot be used; an AC is unmet or the work is wrong | Required file missing; GDD contradicts the brief's platform; claims tests pass that were never run |
| Major | Usable only with significant rework; an AC is partially met | Economy has no sinks; level spec lacks spawn positions; names conflict with GDD |
| Minor | Correct but weaker than it should be | Unclear wording; missing edge case in a table; formula not shown |
| Nit | Style or preference | Heading order, typos |

A finding the reviewer cannot verify (because it needs running the game) is not a severity level; record it as
"Not verifiable by review" and route it to QA or the owner as an open item.

## Approve vs revise rules

Pixel Studio review decisions follow fixed rules so outcomes are predictable:
- **Approve** when there are zero Blockers and zero Majors. Minors and Nits are listed but do not block.
- **Approve with notes** when there are no Blockers, at most one or two Majors that are cheap to fix, and the
  Director accepts tracking them as follow-ups. State the follow-ups explicitly.
- **Revise** when any Blocker exists, when Majors are more than trivial, or when any claim of execution or testing is
  unsupported. Dishonest verification claims are always a Blocker.
- Do not revise for taste alone. If you disagree with a design choice that meets the ACs and the brief, record it as
  a Minor with a rationale, not a Blocker.
- A heuristic: after two revise cycles on the same Blocker, escalate to the Director or owner instead of a third round;
  the task or inputs are probably at fault.

## Writing actionable revision feedback

Revision feedback must let the author fix the issue without a follow-up conversation. Each finding uses this form:

```markdown
### F-3 (Major) — Economy has no gold sink after level 5
Where: design/table-economy.md, rows L6–L12
Evidence: Gold income rises from 40 to 220 per level; the only sink (potions, 25 g) caps at ~75 g per level.
Criterion: AC-2 "economy stays meaningful through the full run".
Fix: Add at least one scaling sink (e.g. upgrade costs growing ~1.3× per tier) so net gold per level stays
within ±20% of the target band. Update the faucet/sink table.
```

Rules: one issue per finding; point to file and section; quote or summarise the evidence; name the criterion; propose
a fix or the acceptable range, not just "improve". Separate "must fix" from "consider".

## Review file template

```markdown
# Review: <deliverable> — <Approve | Approve with notes | Revise>
Reviewer: <role> · Deliverable version: <x.y> · Files inspected: <paths>
## Verdict and summary
## AC verification   (table: AC, verdict, evidence path)
## Findings          (F-1… with severity)
## Not verifiable by review
## References
```

## Reviewer pitfalls

- Approving from the author's summary without opening files.
- Inventing new requirements during review; new scope goes to the Director as a proposal.
- Vague findings ("feels unbalanced") with no numbers, location or target.
- Re-reviewing everything on a revision instead of verifying the previous findings first, then scanning for regressions.
