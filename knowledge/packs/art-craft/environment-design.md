---
id: art.environment-design
title: Environment design and tilesets
tags: environment design, tileset, tiles, modular, autotile, level art, background, parallax, readability, collision
---
# Environment design and tilesets

Game environment art has two jobs that compete: create a place with mood, and keep the gameplay space instantly
readable. When they conflict, readability wins.

## Readability of the gameplay space

Environment readability means the player can tell, without thinking, what is solid, what is walkable, what is
dangerous and what is decoration. Practical rules:

- **Value layering:** gameplay layer (solid ground, platforms, hazards) has the strongest contrast; background layers
  are lower in contrast and usually lighter or more desaturated; characters sit on top with the highest contrast.
- **Consistent affordances:** every solid surface shares a visual cue (e.g. a lighter top edge on platforms); every
  hazard shares a colour family not used for safe surfaces.
- **Decoration discipline:** decorative props must not resemble collectibles or hazards. If a flower looks like a
  pickup, players will try to collect it.
- **Collision honesty:** the visible edge of a tile should match its collision box within a pixel or two.

A quick check is the squint test: blur or shrink a mock screenshot; solid ground, hazards and the player should
still separate into distinct shapes.

## Tileset design and modularity

A tileset is a modular kit: a small number of tiles that combine into many layouts. Design guidelines:

- Pick one base tile size for the project (common choices: 8, 16 or 32 px) and keep every tile on that grid.
- Build terrain as a **core set** first: fill, top edge, bottom edge, left/right edges, outer corners, inner corners.
  For a single terrain on a square grid that is roughly 13–16 tiles; a full blob-style autotile set for arbitrary
  neighbour combinations is commonly 47 tiles.
- Make fill tiles seamless on all four sides; create 2–4 fill variants to break repetition.
- Keep tile edges where terrain meets air consistent so any edge tile can sit beside any other edge tile of the
  same type.
- Separate layers: terrain, decoration overlays, foreground occluders, and background — each its own sheet or group.

Test a tileset by building three small layouts (a flat run, a staircase, a floating island) from it. Seams, missing
corners and repetition become obvious immediately.

## Parallax and background layers

Parallax layers create depth by scrolling slower than the gameplay layer. A practical structure for 2D side views:

| Layer | Scroll factor (heuristic) | Content |
|---|---|---|
| Sky | 0.0–0.1 | gradient bands, sun/moon |
| Far | 0.2–0.3 | mountains, skyline silhouettes |
| Mid | 0.4–0.6 | trees, buildings |
| Gameplay | 1.0 | tiles, characters |
| Foreground | 1.1–1.5 | occasional occluders, kept sparse |

Farther layers use fewer colours, lower contrast and colours shifted toward the sky colour (atmospheric
perspective). Background layers must tile horizontally: the left and right edges must match. Foreground occluders
should never hide the player or hazards for more than a moment.

## Environment storytelling within budget

Environment storytelling comes from a few deliberate props, not dense detail. Choose 3–5 signature props per area
(a broken cart, a shrine, a lamp) and reuse them with variation. Give each area one dominant hue so the player can
tell areas apart on the map and in memory. Lighting direction must match the art bible across every tile and prop.

## Environment design in Pixel Studio SVG files

In Pixel Studio, tilesets are real SVG files drawn with `<rect>` pixels and `shape-rendering="crispEdges"`, using
only `assets/palette.json` colours. Lay tiles out in a grid sheet (e.g. 8 columns × N rows of 16×16 cells) with a
companion entry in `docs/art/` listing each tile's index, name and role (`grass_top_l`, `grass_fill_a`). A mock
layout SVG assembled from those tiles is the best proof that the set works; prose descriptions of a level are not
environment art.

## Environment design pitfalls

- Background as detailed and contrasty as the gameplay layer, hiding platforms.
- Hazards and safe ground sharing a colour.
- Tilesets with no inner corners, forcing programmers to fake them.
- Non-tiling backgrounds that show a seam every screen width.
- Tile sizes that do not match the engine tilemap or the character scale.
