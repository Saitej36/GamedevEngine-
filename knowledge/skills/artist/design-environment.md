---
id: design-environment
role: artist
title: Design an environment tileset and backgrounds
summary: Produce a modular SVG tileset, parallax background layers and a mock layout that proves the gameplay space is readable, with tile index documentation and manifest entries.
triggers: environment, tileset, tiles, level art, background, parallax, terrain, autotile, props, scenery
packs: art-craft, studio-core
---
## Purpose
Create environment art that is modular, cheap to reuse and readable for play: a tileset sheet, optional parallax
layers and props, all as real SVG files with documentation a programmer can map to a tilemap.

## Required inputs
- Area description, mood and gameplay needs (platforms, hazards, collectibles) from `docs/gdd.md` or the task.
- `docs/art/art-bible.md` and `assets/palette.json` — tile size, internal resolution, lighting direction.
- Camera view (side view or top-down) and whether parallax is required.
- Existing environment art: Glob `assets/tiles/*` and `assets/backgrounds/*`.

## Workflow
1. Read the GDD area, art bible and palette. List the terrain types, hazards and props required, and the area's
   dominant hue.
2. Plan the tile list before drawing: per terrain the core set (fill with 2–4 variants, top/bottom/left/right edges,
   outer and inner corners), plus hazard tiles and decoration overlays ([K:art.environment-design]).
3. Write the tile index in `docs/art/environment/<area-id>.md`: index number, tile name, role, solid/non-solid,
   hazard yes/no.
4. Draw the tileset as `assets/tiles/<area-id>-tiles.svg`: a grid sheet (e.g. 8 columns of `tile_size` cells), each
   tile in `<g id="<tile-name>">`, `<rect>` pixels with integer coordinates, `shape-rendering="crispEdges"`, palette
   fills only. Give walkable tops a consistent lighter edge; hazards use the reserved hazard ramp.
5. Make fill tiles seamless: the left column must continue the right column, top continues bottom.
6. If parallax is required, draw `assets/backgrounds/<area-id>-far.svg`, `-mid.svg` etc. Farther layers use fewer,
   lighter, lower-contrast colours; left and right edges must match so the layer tiles horizontally. Document scroll
   factors (heuristic: far 0.2–0.3, mid 0.4–0.6).
7. Build `assets/tiles/<area-id>-mock.svg`: a mock screen at internal resolution assembled from the actual tiles
   (flat run, staircase, floating platform, one hazard), with a placeholder player rectangle of the correct size.
8. Check readability on the mock: in greyscale terms, are ground, hazards and player distinct? Is the background
   quieter than the gameplay layer ([K:art.composition-and-color])?
9. Add manifest rows in `docs/art/asset-manifest.md` for each sheet: path, tile size, grid columns/rows, tile count.
10. Grep all new SVGs for `fill="#` values and confirm each exists in `assets/palette.json`.

## Expected output
- `assets/tiles/<area-id>-tiles.svg`, `assets/tiles/<area-id>-mock.svg`, optional `assets/backgrounds/*.svg`.
- `docs/art/environment/<area-id>.md` with tile index, layer scroll factors and References citing `[K:...]`.
- Updated `docs/art/asset-manifest.md` and a short report of files and any gaps.

## Quality checklist
- [ ] Every tile sits on the project tile grid; sheet dimensions are exact multiples of the tile size.
- [ ] Core set complete, including inner corners.
- [ ] Fill tiles and background layers tile seamlessly.
- [ ] Hazards use a colour family never used on safe terrain.
- [ ] Mock layout is assembled from the delivered tiles, not drawn separately.
- [ ] Background is lower contrast than the gameplay layer.
- [ ] All fills are palette colours; only `assets/` and `docs/art/` written; References present.

## Failure conditions
- No approved art bible, palette or tile size: stop and report that the art bible task must come first.
- Tile size conflicts with the engine/tilemap size stated in code or GDD: report the conflict; do not pick one silently.
- Required terrain or hazard types are unspecified: report the missing content list instead of inventing gameplay.
- The task asks for painted or generated raster backgrounds: report that only hand-authored SVG is available.
