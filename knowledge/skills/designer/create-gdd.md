---
id: create-gdd
role: designer
title: Create a game design document
summary: Turn the owner brief into a buildable lean GDD at docs/GDD.md with pillars, core loop, specified mechanics, scope and acceptance-criteria traceability.
triggers: gdd, game design document, design doc, concept document, write the design, initial design
packs: design-craft, studio-core
---
## Purpose

Produce the project's single design source of truth, `docs/GDD.md`, from the owner's brief. The GDD must let the
Programmer build, the Concept Artist plan assets, the Producer schedule and QA write tests without asking the Designer
follow-up questions. It is a decision record with numbers, not a pitch.

## Required inputs

- `docs/BRIEF.md` (mandatory): goals, genre, platform, controls, target audience, scope or time limits.
- The task statement from the Director, including any acceptance criteria (`AC-n`).
- Optional, read if present: an existing `docs/GDD.md` (update rather than replace), `design/` specs,
  `docs/production/` plans for scope limits, `docs/art/` style guide for visual constraints.
- Retrieved knowledge, especially `design.gdd-frameworks`, `design.core-loops`, `design.mechanics-and-systems` and
  the relevant genre section of `design.genre-design`.

## Workflow

1. Read `docs/BRIEF.md` fully. Extract into notes: pitch, genre, platform and input devices, session length, audience,
   hard constraints, explicit exclusions. Number task acceptance criteria `AC-1…n`; if none are given, derive 3–6
   from the brief and say they were derived.
2. Glob `docs/` and `design/` for existing design files. If `docs/GDD.md` exists, Read it and plan an update with a
   version bump and changelog rather than a rewrite.
3. Choose the format (one-page, lean, or modular) per `design.gdd-frameworks`; default to lean.
4. Write three design pillars, each with a "we do / we don't" line, tied to the brief's goals.
5. Specify the core loop in three layers (moment-to-moment, session, meta) with timings labelled as estimates, a text
   loop diagram, and the action-feedback-reward-choice beats for each layer.
6. List player verbs and specify each core mechanic with the mechanic template: input, rules, numeric parameters,
   states, interactions, feedback, edge cases, acceptance line. Put larger specs or tuning tables in
   `design/spec-<name>.md` or `design/table-<name>.md` and link them.
7. Outline systems (progression, economy, difficulty) at the level the scope needs; flag any that need a dedicated
   design task.
8. Write content lists (levels, enemies, items) with counts sized to the brief's scope, UX and onboarding beats, and
   the art and audio hooks the artist needs (entity list with gameplay-relevant visual requirements).
9. Write the scope section: MVP, Nice-to-have, Cut, each with a one-line reason; check against producer plans.
10. Add the header (Status: Draft, Version, changelog), then Acceptance criteria coverage table, Assumptions (`A-n`
    with impact if wrong), Open questions (`Q-n` with owner and default), and References citing `[K:<doc-id>]` for
    knowledge you actually used.
11. Re-read the finished `docs/GDD.md` once against the quality checklist and fix gaps before finishing.

## Expected output

- `docs/GDD.md`: lean GDD with Status, Version and Changelog; sections for overview, pillars, core loop, mechanics,
  systems, content, UX and onboarding, art/audio hooks, scope; then AC coverage, Assumptions, Open questions,
  References.
- Optional linked files in `design/` for specs or tuning tables too large for the GDD.
- A short completion note to the Director listing files written, ACs met or not, and blocking open questions.

## Quality checklist

- [ ] Every mechanic has numbers with units, marked tunable where appropriate.
- [ ] Core loop has three layers with timings labelled "estimate" and a text diagram.
- [ ] Pillars are specific enough to cut a feature with.
- [ ] Platform, controls and session length match the brief, or deviations are justified assumptions.
- [ ] Scope fits the brief; MVP is one core loop plus at most one progression layer unless justified.
- [ ] Every AC is in the coverage table with a section pointer and a status.
- [ ] No claim of playtesting or measured fun; predictions are labelled.
- [ ] Each value is stated once; specs in `design/` are linked, not duplicated.
- [ ] References section lists only knowledge ids that were in context.
- [ ] Files written only under `docs/` and `design/`.

## Failure conditions

- `docs/BRIEF.md` is missing or empty: stop and report; do not invent a game concept.
- The brief contradicts itself on a fundamental point (genre, platform, single vs multiplayer) and no reasonable
  default exists: write the questions as `Q-n`, produce at most an outline, and report back.
- The brief's scope is clearly impossible for the stated constraints: write the GDD for a reduced MVP, list the cuts
  explicitly, and flag it to the Director rather than silently shrinking scope.
- The task requires files outside `docs/` or `design/` (code, art): describe the requirement and hand it off.
- More than about five significant assumptions would be needed: report the missing inputs first.
