---
id: art.visual-consistency
title: Visual consistency across many assets
tags: visual consistency, style guide, art bible, palette lock, style drift, art review, review checklist, consistency
---
# Visual consistency across many assets

Visual consistency means every asset looks like it belongs to the same game, regardless of who made it or when. Drift
is gradual: each asset is "almost" on style, and after thirty assets the game looks like a collage.

## The art bible as the source of truth

The art bible (in Pixel Studio, `docs/art/art-bible.md` plus `assets/palette.json`) is the single source of truth for
style. It should contain rules that can be checked, not adjectives:

- Palette: exact hex values, ramp definitions, which ramps belong to which material or faction.
- Scale: tile size, character cell sizes, internal resolution, display scale.
- Line: outline yes/no, outline colour rule (e.g. darkest step of the fill ramp, never pure black), outline thickness.
- Light: direction (e.g. top-left), number of shading steps, highlight rules.
- Detail density: maximum colours per sprite, minimum feature size (e.g. no isolated single pixels except eyes).
- Do/don't examples: reference files in `assets/` that are approved exemplars.

"Cute and colourful" is a mood; "max 4 ramps per character, outlines one step darker than fill" is a rule.

## Palette locking

Palette locking is the single most effective defence against drift in pixel art. Once the palette is approved:

- Every colour in every asset must exist in `assets/palette.json` — exact hex match.
- Adding a colour requires a palette change request: why, which ramp, which assets use it. The Director approves.
- Palette changes are versioned in the art bible change log; existing assets are re-checked when a shared colour
  changes.

Because Pixel Studio assets are SVG text, palette compliance is checkable by reading: every `fill` value in an asset
should appear in the palette file. An artist can verify this with Grep over `assets/` for `fill="#` values.

## Exemplar assets and reference sheets

Exemplars anchor style better than prose. Maintain a small set of approved "golden" assets — one character, one tile
set, one prop, one UI element — and compare every new asset against them side by side. A lineup sheet (an SVG that
places all characters next to each other at 1x) exposes scale, proportion and palette inconsistencies instantly.
Update the lineup whenever a character is added.

## Consistency review checklist

Use this checklist on every asset before marking it ready for review:

- [ ] All colours are in the locked palette (exact hex).
- [ ] Dimensions and cell size match the spec.
- [ ] Pivot matches the spec in every frame.
- [ ] Outline rule and light direction match the art bible.
- [ ] Colour count and detail density within the art bible limits.
- [ ] Reads at 1x next to the exemplars and on the intended background.
- [ ] Name follows the convention; manifest entry added.
- [ ] Pixel art uses integer coordinates and `shape-rendering="crispEdges"`, no gradients or filters.

## Preventing drift in batches

Drift accelerates when assets are produced quickly in sequence. Countermeasures:

- Produce the hardest or most representative asset first and get it approved before the batch.
- Work in families (all enemies of a faction together) and review the family as a lineup, not one by one.
- Re-read the art bible at the start of every task; do not rely on memory of a previous task.
- Every 5–10 assets (a heuristic), do a full lineup review of everything produced so far.
- When a deliberate style change is approved, record it in the art bible and list the existing assets that now
  need updating, rather than leaving old and new styles mixed.

## Visual consistency pitfalls

- Near-duplicate colours (`#3a5f2b` vs `#3b602c`) creeping in through manual edits.
- Each asset reviewed in isolation and passing, while the set fails as a whole.
- Art bible updated in conversation but not in the file.
- Exemplars that were never actually approved.
