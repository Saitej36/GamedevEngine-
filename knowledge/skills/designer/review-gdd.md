---
id: review-gdd
role: designer
title: Review a game design document
summary: Check docs/GDD.md and linked design specs against the brief, acceptance criteria and design craft standards, and write a severity-ranked review with an approve or revise verdict.
triggers: review gdd, gdd review, design review, critique design, check design document, feedback on gdd
packs: design-craft, studio-core
---
## Purpose

Give a structured, evidence-based review of the GDD and its linked specs so the author knows exactly what to fix and
the Director can decide whether the design is ready for production. The review checks the actual files, not the
author's summary, and separates must-fix problems from suggestions.

## Required inputs

- `docs/GDD.md` (mandatory) and every `design/` file it links to.
- `docs/BRIEF.md` (mandatory): the yardstick for scope, platform, audience and goals.
- The original GDD task statement and its acceptance criteria, and the review task statement.
- Optional: `docs/production/` plans (scope and schedule), `docs/art/` style guide, previous reviews in `docs/`.
- Retrieved knowledge: `studio.review-standards`, `design.gdd-frameworks`, and the design-craft docs relevant to the
  GDD's systems.

## Workflow

1. Read the brief and the GDD task. List acceptance criteria `AC-1…n`. If a previous review exists, list its
   findings to verify first.
2. Read `docs/GDD.md` completely, then Glob `design/` and Read every linked file. Note links that point to missing
   files.
3. Brief alignment: compare genre, platform, controls, session length, audience and exclusions with the brief.
4. Structure: check header (status, version, changelog), presence of pillars, three-layer core loop, mechanics, systems,
   content, UX/onboarding, art hooks, scope, AC coverage, assumptions, open questions, references.
5. Buildability: for each mechanic, check input, rules, numbers with units, states, interactions, edge cases. Flag
   adjectives without numbers.
6. Consistency: names and values match across GDD and `design/` files; each value stated once.
7. Numbers on paper: spot-check two or three formulas or tables (e.g. a jump gap vs jump distance, an economy
   wallet line) and recompute them. Record discrepancies with your arithmetic.
8. Honesty: claims about fun, balance or playtime are labelled estimate or hypothesis; nothing claims to have been
   playtested.
9. Ethics and scope: monetization meets studio guidance; MVP fits the brief and producer plan.
10. Classify each finding Blocker, Major, Minor or Nit with location, evidence, criterion and proposed fix. Decide
    Approve, Approve with notes, or Revise using the rules in `studio.review-standards`.
11. Write the review to `docs/reviews/review-gdd-v<version>.md` and close with References citing `[K:<doc-id>]`.

## Expected output

- `docs/reviews/review-gdd-v<version>.md` containing: verdict line, reviewer role, GDD version, files inspected,
  summary, AC verification table (AC, verdict, evidence path), findings `F-n` with severity and actionable fixes,
  verification of previous findings (if any), items not verifiable by review (playtest questions), References.
- No edits to `docs/GDD.md` itself unless the task explicitly asks the reviewer to apply fixes.

## Quality checklist

- [ ] Every file the GDD links to was opened; missing files are findings.
- [ ] Every AC has a verdict with a file and section pointer.
- [ ] Each finding has severity, location, evidence, criterion and a concrete fix or acceptable range.
- [ ] At least two numeric spot-checks were recomputed and shown.
- [ ] Verdict follows the approve/revise rules; taste-only objections are Minor at most.
- [ ] Runtime questions are listed as not verifiable by review, not judged as failures.
- [ ] No new requirements were invented; scope ideas are labelled proposals.
- [ ] References cite only knowledge ids that were in context.

## Failure conditions

- `docs/GDD.md` or `docs/BRIEF.md` is missing: stop and report; a review without the yardstick or the subject is
  meaningless.
- The GDD task's acceptance criteria are unavailable: review against the brief and studio standards, and state that ACs
  were reconstructed.
- The same Blocker has survived two revise cycles: escalate to the Director with the history instead of a third
  identical review.
- The review would require judging runtime behaviour (feel, real balance): record it as a playtest question for QA
  rather than approving or rejecting on it.
