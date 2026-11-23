---
id: prepare-game-assets
role: artist
title: Prepare game assets for integration
summary: Make a batch of SVG assets integration-ready — verified dimensions, pivots, frames, naming, palette compliance — and publish an accurate asset manifest for programmers.
triggers: prepare assets, asset export, asset manifest, sprite sheet, atlas, integration, naming, asset pass, deliver assets, ui assets, icons
packs: art-craft, studio-core
version: 1.0.0
disciplines: art-pipeline, animation
genres: any
engines: any
engine_dependent: false
---
## Purpose
Turn finished or in-progress art into a clean, verified delivery that a programmer can load without opening every
file: consistent names and sizes, documented pivots and frames, palette compliance, and a manifest that matches
reality exactly.

## Required inputs
- The list of assets required, from the task, `docs/gdd.md` content list, or existing specs in `docs/art/specs/`.
- `docs/art/art-bible.md`, `assets/palette.json`, and the naming convention.
- The current asset files: Glob `assets/**/*.svg`.
- Target platform and display scale, and any engine constraints stated in the GDD or README (read-only).

## Workflow
1. Glob `assets/**/*` and build a working list of every asset file. Read `docs/art/asset-manifest.md` if it exists.
2. Compare required assets against existing files. Classify each as: present and correct, present with issues,
   or missing.
3. For each present asset, Read the SVG and verify: `viewBox` matches spec dimensions; cell size and frame count
   match; frames grouped and named `<anim>-<n>`; integer coordinates; `shape-rendering="crispEdges"` for pixel art;
   no gradients, filters or embedded raster images ([K:art.asset-specifications]).
4. Grep each file for `fill="#` and confirm every colour is in `assets/palette.json` ([K:art.visual-consistency]).
5. Fix issues within your remit: rename files to the convention (write the new file, then note the old path for
   removal), correct off-palette colours to the nearest ramp colour, add missing group IDs.
6. For missing assets that are in scope for this task, draw them as real SVG following the spec; if out of scope,
   list them as missing — never add a manifest row for an asset that does not exist.
7. Write or update `docs/art/asset-manifest.md` as a table: ID, path, type, dimensions, cell size, rows/frames, fps,
   pivot, loop, status. Add a note on rendering: nearest-neighbour filtering and integer scale for pixel art
   ([K:art.production-pipelines-2d-3d]).
8. If useful, add atlas grouping guidance (which assets appear together on screen) for the programmer.
9. Re-Glob `assets/` and cross-check: every manifest path exists, every asset file appears in the manifest.

## Expected output
- Corrected and/or new SVG files in `assets/`.
- `docs/art/asset-manifest.md` matching the files exactly.
- A delivery report: files verified, fixes made, assets still missing, old paths to remove, assumptions — with a
  References section citing `[K:...]` sources.

## Quality checklist
- [ ] Every manifest path exists; every asset file is in the manifest.
- [ ] Dimensions, cell sizes, frames and pivots in the manifest match the SVGs.
- [ ] All names follow the convention (lowercase, underscores, category prefix).
- [ ] All colours are palette colours; pixel art uses crispEdges and integer coordinates.
- [ ] Missing assets are listed as missing, not described as delivered.
- [ ] Only `assets/` and `docs/art/` were written; References present.

## Failure conditions
- No list of required assets and no specs exist: report and request a content list rather than guessing.
- The palette or art bible is missing: report that verification cannot be done reliably.
- An asset conflicts with the code's expectations (size, name) and the source of truth is unclear: report the
  conflict to the Director; do not edit `src/`.
- The task requires converting to PNG or building atlases with a tool: report that no shell or conversion tool is
  available and that the programmer must handle rasterisation.
