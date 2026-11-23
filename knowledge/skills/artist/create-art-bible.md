---
id: create-art-bible
role: artist
title: Create an art bible and locked palette
summary: Establish the project's visual rules — pillars, palette file, scale, outline and lighting rules, naming — plus exemplar SVG swatches, as the source of truth for all later art.
triggers: art bible, style guide, art direction, palette, visual style, look and feel, visual development, style frame
packs: art-craft, studio-core
version: 1.0.0
disciplines: art-pipeline, ui
genres: any
engines: any
engine_dependent: false
---
## Purpose
Create the single source of truth for the game's visual style so every later asset can be checked against written,
testable rules. The art bible is the first art task in a project; character, environment and asset tasks depend on it.

## Required inputs
- The game's vision, genre and pillars: read `docs/vision.md` and/or `docs/gdd.md` (use Glob on `docs/**/*.md` to
  find them).
- Target platform and display (web, mobile, desktop) and camera view, from the GDD or the task.
- Any owner style preferences stated in the task.
- Existing art, if any: Glob `assets/**/*` and `docs/art/**/*` so you extend rather than overwrite.

## Workflow
1. Read the vision/GDD and the task. List 3–5 mood words and the readability needs (what must stand out).
2. Write 3–5 art pillars that can reject an asset (see [K:art.visual-development]).
3. Decide format: pixel art (SVG `<rect>` grid, `shape-rendering="crispEdges"`) or flat vector SVG. No raster
   painting tool exists; do not promise painted or photographic art.
4. Decide scale rules: base tile size, character cell sizes, internal resolution and integer display scale.
5. Build the palette as ramps of 3–5 colours with hue shifting (shadows cooler, highlights warmer); a heuristic total
   is 16–32 colours. Reserve one accent family for hazards and one for pickups; check meaning-bearing pairs differ in
   lightness, not only hue ([K:art.composition-and-color]).
6. Write `assets/palette.json`: an object with a `colors` array of `{ "name", "hex", "ramp" }` entries and a
   `version` field.
7. Write `assets/art-bible/palette-swatches.svg`: one labelled rectangle per palette colour, grouped by ramp, using
   only palette hex values.
8. Write one exemplar test sprite at real resolution (e.g. `assets/art-bible/exemplar-player.svg`) to prove the rules
   work at 1x. Draw it as real `<rect>` pixels with integer coordinates.
9. Write `docs/art/art-bible.md` with sections: Pillars, Format, Scale, Palette (reference the JSON, list ramps and
   reserved meanings), Line and outline rules, Lighting, Detail density limits, Animation defaults (frame rates),
   Naming conventions ([K:art.asset-specifications]), Consistency checklist ([K:art.visual-consistency]), Exemplars,
   Change log, References.
10. Self-check every file against the Quality checklist; Grep your SVGs for `fill="#` and confirm each value is in
    the palette.

## Expected output
- `assets/palette.json` — locked palette as data.
- `assets/art-bible/palette-swatches.svg` and at least one exemplar SVG.
- `docs/art/art-bible.md` — rules, conventions, change log and a References section citing `[K:...]` sources used.
- A short report listing files written and any open questions for the Director.

## Quality checklist
- [ ] Every pillar is testable and could reject a real asset.
- [ ] Palette exists as JSON; every SVG colour appears in it (exact hex).
- [ ] Scale rules give exact pixel numbers, not "about".
- [ ] Hazard/pickup colours are separated by lightness as well as hue.
- [ ] Exemplar is a real SVG drawn at target resolution, not a description.
- [ ] Naming convention and asset spec template are referenced.
- [ ] Only `assets/` and `docs/art/` were written.
- [ ] References section cites the knowledge used.

## Failure conditions
- No vision, GDD or genre information is available: stop and report what is missing rather than inventing a game.
- The task asks for raster painting, photos or AI-generated images: report that only hand-authored SVG is possible
  and propose pixel or vector alternatives.
- An existing art bible or palette conflicts with the task: do not overwrite; report the conflict to the Director.
- Target platform or camera view is unknown and would change scale rules: state the assumption explicitly in the
  art bible and flag it in the report.
