---
id: direction.deliverable-reviews
title: Reviewing deliverables
tags: review, deliverable review, review_task, approve, revise, acceptance criteria, verification, evidence, quality gate
---
# Reviewing deliverables

A deliverable review decides whether a task's output meets its acceptance criteria. In Pixel Studio the Director
reviews with `review_task`, choosing approve or revise. The core rule: **verify against the files, not the report.**

## Verify files, not reports

An agent's completion report is a claim, not evidence. Reports can be optimistic, incomplete or describe work that
was planned but not written. For every review:

- Open each deliverable path with Read; confirm it exists and is non-trivial.
- Use Glob to confirm all expected files exist (e.g. `assets/characters/*.svg`).
- Use Grep to check specific facts (a section heading, a function name, every `fill` colour against the palette).
- Compare what the files contain with what the report claims; note any gap.

If a file named in the report does not exist, the criterion fails regardless of how well the report describes it.
A description of an image is not an image; a description of code is not code.

## Criterion-by-criterion review

Review each acceptance criterion separately and record a verdict with evidence:

```
Criterion 1: assets/characters/player.svg exists with 16x24 cells — PASS
  Evidence: viewBox "0 0 96 72", 6 columns x 3 rows of 16x24 groups.
Criterion 2: all fills in assets/palette.json — FAIL
  Evidence: fill="#ff0000" on walk-2 is not in the palette.
Criterion 3: manifest entry with pivot — PASS
  Evidence: docs/art/asset-manifest.md row "player", pivot (8,24).
```

This format makes the decision mechanical and the revise request specific. Never approve on overall impression.

## Approve or revise rules

Decision rules for `review_task`:

- **Approve** when every acceptance criterion passes. Minor polish notes can go in the approval comment but must not
  be required.
- **Revise** when any criterion fails, when a deliverable is missing, or when the work contradicts a source of truth
  (GDD, art bible, decisions log).
- **Do not revise for new requirements.** If the review reveals a need the criteria did not include, approve the
  task if it passes and create a new task — or, if the original criteria were wrong, say so explicitly in the
  revision and accept that this is the Director's error.
- **Escalate** when passing would require changing scope, the vision, or something the owner approved.

## What to check beyond the criteria

Beyond explicit criteria, every review should apply a short standard checklist:

- Files are inside the role's writable folders and follow naming conventions.
- Consistency with sources of truth: names match the glossary, values match the GDD, colours match the palette.
- Deliverable includes a References section citing knowledge used (`[K:<doc-id>]`) where the studio standard requires.
- No claims of work the agent cannot do (e.g. "tested in browser" from an agent with no shell). Programmer and QA
  reports must state which tests were written but not run.
- Nothing unrelated was changed.

Failures here are grounds for revision only if they break a standing studio rule or a source of truth.

## Reviewing by discipline

Discipline-specific evidence to look for:

- **Design docs:** every mechanic has concrete values and units; win/lose conditions defined; content list complete.
- **Art:** SVG files exist; pixel art uses integer `<rect>` coordinates and `crispEdges`; palette compliance; cell
  sizes and frame counts match the spec; manifest updated.
- **Code:** referenced modules exist and export what the README says; tests exist for the logic described; config
  values match the GDD.
- **QA:** test cases have steps, expected results and traceability to requirements; bugs are reproducible.

## Review pitfalls

- Approving because the report is confident and long.
- Reviewing only the first file of a multi-file deliverable.
- Vague revise notes ("make it better") that cause a second revision.
- Moving the goalposts by adding criteria during review.
- Approving work that contradicts the GDD because the task criteria forgot to mention it.
