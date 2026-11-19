---
id: art.asset-specifications
title: Asset specifications
tags: asset spec, specification, dimensions, pivot, frame count, naming convention, file format, texture budget, atlas, sprite sheet, platform constraints, manifest
---
# Asset specifications

An asset specification is the contract between art, design and programming for a single asset or asset family. A good
spec lets an artist produce the asset without questions and lets a programmer integrate it without opening the file.

## Asset specification template

Every asset specification should answer these fields. Copy the template into `docs/art/` and fill one per asset or
family:

```
Asset ID:        player_knight
Purpose:         Player character, side view platformer
File(s):         assets/characters/player_knight.svg
Format:          SVG, <rect> pixel grid, shape-rendering="crispEdges"
Cell size:       16 x 24 px (per frame)
Pivot:           bottom-centre (8, 24) in every frame
Palette:         assets/palette.json, ramps: skin, steel, cape
Animations:      idle 4f @ 8fps (loop), walk 6f @ 10fps (loop), jump 3f, hurt 2f
Sheet layout:    one animation per row, frames left to right
Collision hint:  10 x 20 box, bottom-aligned (design to confirm)
Display scale:   4x integer, nearest-neighbour
Dependencies:    art bible v1, character sheet for player_knight
Status:          spec | in progress | review | approved
```

## Naming conventions

Asset naming should be predictable, lowercase and machine-friendly. A common convention is
`<category>_<name>_<variant>_<state>` with underscores, no spaces, no capitals:

- `char_knight_walk.svg`, `tile_grass_top_l.svg`, `ui_btn_play_hover.svg`, `bg_forest_far.svg`.
- Frame groups inside a sheet: `walk-0`, `walk-1` … zero-based.
- Never encode "final", "new" or dates in names; version through status and history, not filenames.

Agree the prefix list once in the art bible and reject assets that do not follow it.

## Dimensions, pivots and frame counts

Dimension rules that prevent integration bugs:

- All tiles share one base size; all characters of a class share one cell size.
- Prefer sizes that divide evenly into the tile grid (character height of 1.5 or 2 tiles, for example).
- Pivot is specified in pixel coordinates within the cell and is identical across every frame.
- Frame count and frame rate are specified per animation, plus loop/one-shot and any hold frames.
- Leave consistent transparent padding rather than cropping each frame differently.

## Texture budgets and atlases

Texture budgets keep memory and draw calls predictable. Heuristics, not platform facts:

- Pack many small sprites into an atlas so a scene renders with few texture switches.
- Keep atlas pages at power-of-two sizes such as 1024 or 2048 px per side for broad compatibility, and leave
  1–2 px padding (extruded edges) between sprites to avoid bleeding.
- Group atlas contents by what is on screen together (a level's tiles, a character's animations), not by type.
- For 3D, set a texel density target (pixels per metre) and keep it consistent between neighbouring assets.

Budget example for a small web game: one 1024×1024 atlas for the player and common enemies, one per level for
tiles, one for UI.

## Per-platform constraints

Constraints differ by target; record the targets in the spec:

| Target | Typical concern |
|---|---|
| Web/browser | download size, first-load time, many small files vs. one atlas |
| Mobile | memory, touch target size for UI (a common heuristic is at least ~44–48 px), varied aspect ratios and safe areas |
| Desktop | multiple resolutions; integer scaling for pixel art at 1080p, 1440p, 4K |
| Console | platform holder requirements — check official documentation, never assume |

For pixel art, list the internal resolution (e.g. 320×180, which scales by integers to 1280×720 and 1920×1080).

## Asset manifest

An asset manifest (e.g. `docs/art/asset-manifest.md`) lists every delivered asset with path, ID, dimensions, frame
layout, pivot, status and the spec it satisfies. The manifest is how programmers and the Director verify delivery:
every entry must point to a file that actually exists, and every file in `assets/` should appear in the manifest.

## Asset specification pitfalls

- Specs that say "about 32 px" — ambiguity becomes rework.
- Pivots undocumented, so every sprite floats or sinks differently.
- Frame rate left to the programmer's guess.
- Manifest entries for assets that were described but never drawn.
