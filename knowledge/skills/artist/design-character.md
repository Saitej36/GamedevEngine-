---
id: design-character
role: artist
title: Design a game character as SVG sprites
summary: Design a readable character (silhouette, shape language, palette) and deliver real SVG pixel-art sprite sheets with documented cell size, pivot, frames and manifest entry.
triggers: character, character design, sprite, player sprite, enemy sprite, npc, sprite sheet, animation frames, hero
packs: art-craft, studio-core
version: 1.0.0
disciplines: animation, art-pipeline
genres: any
engines: any
engine_dependent: false
---
## Purpose
Turn a character requirement into a production-ready character: a design sheet explaining silhouette and shape choices,
plus real SVG sprite files that programmers can load, following the art bible and asset spec.

## Required inputs
- The character's gameplay role (player, enemy type, NPC) and abilities, from `docs/gdd.md` or the task.
- `docs/art/art-bible.md` and `assets/palette.json` (approved).
- Cell size, required animations and frame counts from the task or an existing spec in `docs/art/`.
- Existing characters (Glob `assets/characters/*.svg`) for lineup comparison.

## Workflow
1. Read the GDD entry, art bible, palette and any spec. Note the role, threat level and required animations.
2. Choose the dominant shape language (round/square/spiky) and one unique silhouette feature not shared by existing
   characters ([K:art.character-design]).
3. Write or update the spec in `docs/art/specs/<asset-id>.md` using the template fields: cell size, pivot,
   animations with frames and fps, sheet layout ([K:art.asset-specifications]).
4. Draw the idle frame first as an SVG `<rect>` grid: `viewBox` equal to the pixel grid, integer coordinates,
   `shape-rendering="crispEdges"`, fills only from the palette. Merge horizontal same-colour runs into wider rects.
5. Check the idle frame: fill test (would the silhouette read in one colour?), 1x readability, contrast against the
   intended background ([K:art.composition-and-color]).
6. Draw remaining frames in the sheet: one animation per row, frames left to right, each frame in
   `<g id="<anim>-<n>">` offset by whole cells, pivot at the same cell coordinate in every frame. Key poses first,
   then in-betweens.
7. Save as `assets/characters/<asset-id>.svg` (and optionally a separate `<asset-id>-idle.svg` preview).
8. Update `assets/characters/lineup.svg` (create if absent) placing all characters' idle frames side by side at 1x.
9. Write `docs/art/characters/<asset-id>.md`: role, shape language rationale, silhouette feature, palette ramps used,
   animation table, known limitations, References.
10. Add or update the row in `docs/art/asset-manifest.md`: path, ID, cell size, rows/frames, fps, pivot, status.
11. Grep the SVG for `fill="#` and confirm every value exists in `assets/palette.json`.

## Expected output
- `assets/characters/<asset-id>.svg` sprite sheet (real SVG pixels).
- Updated `assets/characters/lineup.svg`.
- `docs/art/specs/<asset-id>.md`, `docs/art/characters/<asset-id>.md`, updated `docs/art/asset-manifest.md`.
- A report listing files, frame counts, and any deviations from the spec, with a References section citing `[K:...]`.

## Quality checklist
- [ ] Silhouette is distinct from every existing character in the lineup.
- [ ] Every frame has identical cell size and identical pivot position.
- [ ] Frame counts and rows match the spec exactly.
- [ ] All fills are palette colours; no gradients, filters, strokes or non-integer coordinates.
- [ ] Character reads at 1x against the intended background.
- [ ] Manifest row matches the file (dimensions, frames, pivot).
- [ ] Only `assets/` and `docs/art/` were written; References present.

## Failure conditions
- No approved art bible or palette exists: stop and report that `create-art-bible` must run first.
- The character's gameplay role or required animations are unknown: report the gap rather than guessing scope.
- Requested frame counts are impractical for the deadline (e.g. many 12-frame animations): deliver key poses, document
  what is missing, and flag it — never mark undrawn frames as done.
- The task asks for painted or generated raster images: report that only hand-authored SVG is available.
