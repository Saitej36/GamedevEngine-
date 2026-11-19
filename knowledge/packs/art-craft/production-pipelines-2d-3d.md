---
id: art.production-pipelines-2d-3d
title: 2D and 3D art production pipelines
tags: pipeline, 2d pipeline, 3d pipeline, pixel art, vector, painted, blockout, modelling, uv, texturing, lod, rigging, export, file formats, svg, png, gltf, fbx
---
# 2D and 3D art production pipelines

An art pipeline is the agreed sequence of stages, file formats and handoffs that turns an idea into an asset the engine
can load. A pipeline is good when every stage has a reviewable output and nobody has to guess the next step.

## 2D pixel art pipeline

The 2D pixel art pipeline optimised for small teams:

1. **Spec** — size, frame count, pivot, palette (see the asset specification template).
2. **Silhouette/blockout** — flat-colour shapes at final resolution; review readability at 1x.
3. **Colour and shading** — apply palette ramps; one light direction.
4. **Animation** — key poses first, then in-betweens; check loops.
5. **Export** — sprite sheet plus metadata.
6. **In-engine check** — integer scaling, nearest-neighbour filtering, pivot alignment.

Pixel art must be displayed with nearest-neighbour filtering and integer scale factors; smoothing or 1.5x scaling
blurs or distorts pixels. In Pixel Studio, pixel art is authored directly as SVG `<rect>` grids with
`shape-rendering="crispEdges"`; programmers either render the SVG at integer scale or rasterise it in their own
build step. The artist has no shell and does not convert files.

## 2D vector and painted pipelines

Vector pipeline: shapes authored as paths (SVG is the typical interchange format), resolution-independent, good for
UI, icons and flat-shaded styles. Rules: keep a consistent stroke width scale, avoid filters that engines render
inconsistently, convert text to shapes or document the font, and set a `viewBox` that matches the intended aspect.

Painted pipeline: raster art painted at 2x the display size and downsampled (a common heuristic), delivered as PNG
with alpha. Painted assets cost more per asset and are harder to keep consistent; they need stricter style guides and
master files with layers. In an environment without raster tools, painted pipelines are not available — choose
pixel or vector.

## 3D pipeline stages

The 3D pipeline in order, with the review question for each stage:

| Stage | Output | Review question |
|---|---|---|
| Blockout | primitive-shape proxy at true scale | Is scale and gameplay space right? |
| High/low modelling | final mesh within triangle budget | Does the silhouette match the concept? |
| UV unwrapping | non-overlapping UVs (except deliberate mirroring) | Is texel density consistent? |
| Texturing | albedo/base colour, normal, roughness/metallic (PBR) or hand-painted | Does it match the art bible under game lighting? |
| LODs | 2–4 lower-detail meshes | Are transitions invisible at switch distances? |
| Rigging and skinning | skeleton, weights | Do joints deform cleanly in extreme poses? |
| Animation and export | clips, engine-ready file | Does it import with correct scale, axis and pivot? |

A common heuristic for LODs is to reduce triangle count by roughly half at each level. Always block out first:
geometry changes after texturing are expensive.

## File formats and export settings

Common formats and when to use them:

- **SVG** — vector and Pixel Studio pixel art source; human-readable, diffable text.
- **PNG** — lossless raster with alpha; the default for sprites and UI.
- **JPEG/WebP** — lossy, for large opaque backgrounds only; never for pixel art.
- **glTF/GLB** — open 3D interchange format with materials and animation; well suited to web engines.
- **FBX** — widely used 3D interchange, especially with Unity and Unreal.
- **JSON** — sprite sheet and atlas metadata, palettes.

Export checklist: correct units and scale (agree e.g. 1 unit = 1 metre for 3D, or pixels-per-unit for 2D); correct
up-axis; pivot at the agreed point; no hidden or helper objects; transforms applied; names follow the convention;
alpha premultiplication settled with programming.

## Pipeline handoffs and ownership

Each pipeline handoff should carry: the file, its spec, a short note of known issues, and the place where it is
referenced (manifest or doc). In Pixel Studio the artist writes `assets/` and `docs/art/`; a manifest such as
`docs/art/asset-manifest.md` lets programmers find each asset, its dimensions, frames and pivot without opening it.
Programmers own loading code; artists never edit `src/`.

## Pipeline pitfalls

- Skipping blockout and discovering scale problems after texturing.
- Mixed pixel densities (a 16 px character on 32 px tiles) with no documented rule.
- Bilinear filtering on pixel art.
- Lossy compression on sprites with hard edges.
- Asset files with no spec or manifest entry, so integration is guesswork.
