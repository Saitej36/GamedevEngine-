---
id: design-level
role: designer
title: Design a level
summary: Write a buildable level spec in design/level-<nn>-<name>.md with goal, teaching structure, beat chart, grid or coordinate layout, entity table and checkpoints, consistent with GDD movement numbers.
triggers: level design, level, stage, map, layout, encounter, room, world, mission
packs: design-craft, studio-core
version: 1.0.0
disciplines: level, procgen
genres: any
engines: any
engine_dependent: false
---
## Purpose

Produce a level specification precise enough for the Programmer to build as data and for QA to verify reachability and
intended solutions, without visual editors or follow-up questions. The level should teach or test specific mechanics
with deliberate pacing and readable guidance.

## Required inputs

- `docs/GDD.md`: mechanics with numbers (jump height and distance, speeds, enemy behaviours), level list, pillars.
- `design/` specs and tables for enemies, items and existing levels (to keep the difficulty curve continuous).
- `docs/art/` style guide or tileset notes if present, for tile size and visual language.
- Task statement naming the level (number, purpose) and acceptance criteria.
- Retrieved knowledge: `design.level-design`, the genre section of `design.genre-design`,
  `design.mechanics-and-systems`.

## Workflow

1. Read the GDD and the specs of the previous and next levels. Note the player's movement numbers and which mechanics
   and enemies are already known. Number acceptance criteria `AC-1…n`.
2. State the level's goal, the mechanics it introduces or tests, target completion time (estimate), and its place on
   the overall difficulty curve.
3. Plan the teaching structure (introduce, develop, twist, conclude) for each mechanic featured. Introduce at most one
   new mechanic or enemy unless the task says otherwise.
4. Write a beat chart table: beat, content, new element, intensity 1–5, estimated time. Check it forms a sawtooth with
   rest points before spikes.
5. Convert beats into a layout: ASCII grid with tile size, dimensions, origin and legend for tile games; coordinates
   in world units for others.
6. Verify reachability on paper: convert jump height and distance from the GDD into tiles and check every required gap
   and ledge. Show the arithmetic (e.g. "max jump distance 150 px ≈ 4.7 tiles at 32 px; widest gap 4 tiles: OK").
7. Add an entity table: id, type, position, parameters (patrol range, timing, contents). Add checkpoints so a
   failure costs a bounded amount of replay (heuristic 30–60 s).
8. Describe guidance and readability: breadcrumbs, landmarks, safe previews of hazards, secrets and their signposting.
9. Write the intended solution or critical path as numbered steps for QA, and list edge cases (soft-locks, skips).
10. Save as `design/level-<nn>-<name>.md`; add or update the level list in `docs/GDD.md` with version bump and
    changelog. Close with AC coverage, Assumptions, Open questions and References citing `[K:<doc-id>]`.

## Expected output

- `design/level-<nn>-<name>.md`: goal and mechanics, teaching plan, beat chart, layout with legend and units, entity
  table, checkpoints, reachability checks, guidance notes, critical path, edge cases, art requests (new tiles or
  props), AC coverage, Assumptions, Open questions, References.
- Updated level list in `docs/GDD.md`.

## Quality checklist

- [ ] Layout uses explicit units, dimensions, origin and a complete legend.
- [ ] Every required jump or traversal is checked against GDD movement numbers with arithmetic shown.
- [ ] Each new element is introduced safely before being used dangerously.
- [ ] Beat chart shows a sawtooth with rest points; times labelled "estimate".
- [ ] Checkpoints bound replay cost; no soft-lock is possible on the critical path.
- [ ] Critical path and edge cases are written so QA can test them.
- [ ] Visual language matches the art style guide; new art needs are listed, not assumed.
- [ ] Names and IDs match the GDD; References cite only ids that were in context.

## Failure conditions

- Movement or mechanic numbers are missing from the GDD: report it; do not design gaps without them, or clearly
  mark a provisional assumption and flag the reachability checks as unverified.
- The level's purpose or position in the sequence is unclear: ask as `Q-n` before laying out content.
- The task requires mechanics or enemies not in the GDD: list them as proposals for the GDD rather than adding them
  silently to the level.
- Tile size or camera constraints conflict between GDD and art guide: report the conflict to the Director.
