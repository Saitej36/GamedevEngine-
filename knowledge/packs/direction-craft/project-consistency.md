---
id: direction.project-consistency
title: Project consistency across documents and code
tags: consistency, gdd, art bible, roadmap, code, source of truth, decision log, audit, traceability, drift
---
# Project consistency across documents and code

Project consistency means the GDD, the art bible, the roadmap and the code describe the same game. Inconsistency is
the default outcome of many agents working in parallel; consistency must be maintained deliberately.

## The consistency map

A consistency map lists which document owns which facts, and which other artefacts depend on them:

| Fact | Owner (source of truth) | Dependants |
|---|---|---|
| Vision, pillars | `docs/vision.md` | everything |
| Mechanics, tuning values | `docs/gdd.md` | `src/` config, `qa/` test plans |
| Content list (enemies, levels, items) | `docs/gdd.md` | art manifest, roadmap, code |
| Style, palette, scale | `docs/art/art-bible.md`, `assets/palette.json` | all `assets/` |
| Asset inventory | `docs/art/asset-manifest.md` | code asset loading |
| Milestones, scope | `docs/production/roadmap.md` | task list |
| Decisions | `docs/decisions.md` | all of the above |

Keep the map in the project (e.g. at the top of `docs/decisions.md`) so every agent can find the owner of a fact.

## Traceability between documents and code

Traceability means you can follow a feature from roadmap to GDD to assets to code to tests. Practical techniques:

- Give features and content stable IDs in the GDD (`MECH-JUMP`, `ENEMY-SLIME`) and reuse them in task titles,
  manifest rows, code comments and test names.
- Keep tuning values in one config file in code whose keys match GDD names, so a Grep for the name finds both.
- Asset IDs in the manifest match the names the code loads.
- Roadmap milestones list the feature IDs they contain.

With stable IDs, consistency checks become Grep searches rather than reading every file.

## Consistency audits

Run a consistency audit at each milestone and after any significant change. A checklist:

- [ ] Every content item in the GDD has a manifest entry or an open task; every manifest entry is in the GDD.
- [ ] Every tuning value in code config matches the GDD (or the GDD has been updated with a recorded decision).
- [ ] Every asset path referenced in code exists in `assets/`.
- [ ] Every colour in `assets/` is in the palette.
- [ ] Roadmap milestones match actual task status; cut features are marked cut everywhere.
- [ ] Glossary terms are used consistently in docs, asset names and code identifiers.
- [ ] Decisions in the decision log are reflected in their owning documents.

Record audit results in a short report under `docs/` and create tasks for each mismatch.

## Handling change without drift

Changes are the main source of inconsistency. When a fact changes:

1. Update the owning document first.
2. Add a decision log entry: what changed, why, which pillar, who approved.
3. Grep for the old value or name across `docs/`, `assets/`, `src/`, `qa/` to find dependants.
4. Create revision tasks for each dependant with `depends_on` on the owning-doc update.
5. Re-run the relevant audit items at the next review.

Never let a task description carry a new value that is not in the owning document; the next task will use the old one.

## Cuts and scope changes

Cuts are the most commonly half-applied change. When a feature is cut, mark it as cut (not deleted) in the GDD, the
roadmap and the manifest, and note whether code and assets for it should be removed or left dormant. A cut feature
still listed in a QA plan generates false failures; a cut enemy still in the manifest generates wasted art tasks.

## Project consistency pitfalls

- Two GDDs (`gdd.md` and `design/gdd-v2.md`) with no statement of which is current.
- Values agreed in review comments that never reach the documents.
- Code that silently diverges from the GDD because the programmer "tuned it".
- Audits done once at the start and never again.
