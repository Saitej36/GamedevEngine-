---
id: art.composition-and-color
title: Composition, value and colour for games
tags: composition, color, colour, value, contrast, palette, limited palette, color blind, accessibility, readability, hue shifting
---
# Composition, value and colour for games

Composition and colour in games are functional: they direct attention to what matters for play. A beautiful frame
in which the player cannot find the enemy is a failed frame.

## Value structure comes before colour

Value (lightness) structure is the foundation of readable game art; hue is secondary. A practical value plan uses
three to four bands:

- **Background:** narrow value range, low contrast.
- **Gameplay terrain:** medium contrast, clear edges.
- **Actors (player, enemies, pickups):** the strongest contrast against their surroundings.
- **UI:** high contrast against whatever is behind it, often with a backing panel.

The greyscale test is the core check: convert a screenshot or mock to greyscale (or mentally evaluate palette
lightness values). If the player and hazards disappear in greyscale, colour alone is carrying the read, which fails
for colour-blind players and on poor screens.

## Limited palettes and colour ramps

Limited palettes keep art consistent and readable. Common pixel-art sizes are 4, 8, 16 or 32 colours; a common
heuristic for a small project is 16–32 colours. Build the palette as ramps:

- A ramp is 3–5 colours of one material from shadow to highlight.
- **Hue shift** along the ramp: shadows shift toward cool (blue/purple), highlights toward warm (yellow), rather than
  only darkening and lightening. This avoids muddy, flat shading.
- Saturation usually peaks in the mid-tones and drops at the extremes.
- Share colours between ramps where possible (the darkest shade of several ramps can be one colour), which keeps the
  palette small and unified.

Store the palette as data (in Pixel Studio, `assets/palette.json`, e.g. named entries with hex values) and treat it as
locked once approved.

## Contrast for gameplay readability

Contrast is a budget: if everything is high contrast, nothing stands out. Allocation rules:

- Reserve the highest saturation and brightest accents for interactive elements (pickups, hazards, the player).
- Give hazards a dedicated colour family (often red/orange or a sickly green) that safe terrain never uses.
- Keep backgrounds desaturated relative to the gameplay layer.
- Use outlines or a 1-pixel dark rim on actors when backgrounds are busy.
- Telegraph attacks with a value change (flash to white or a light tint), not only a hue change.

## Colour-blind considerations

Colour-vision deficiency affects a meaningful share of players, most commonly red–green confusion. Design so that
colour is never the only channel of information:

- Pair colour with **shape** (a spiky hazard vs. a round pickup), **value** (light vs. dark), **pattern** or an
  **icon**.
- Avoid pairing red and green of similar lightness for opposing meanings (friend/foe, safe/danger).
- Blue/orange pairs are generally more distinguishable across common deficiencies than red/green.
- Check palette pairs by lightness difference: if two meaning-bearing colours are close in value, separate them.
- UI text should meet a strong contrast ratio against its background; WCAG's 4.5:1 for body text is a useful target.

## Composition of a game screen

Composition in a game frame is about where the eye goes and where play happens:

- Keep the camera framing so the player has more space in the direction of travel (lead room).
- Keep the central play area free of heavy decoration; push detail to edges and background.
- Reserve consistent UI zones (e.g. top-left health, top-right score) and keep gameplay-critical objects out of them.
- Use leading lines in level art (paths, light shafts) toward goals.
- Group detail: alternate busy areas with calm areas so the eye can rest and important objects pop.

## Worked example: fixing an unreadable cave level

Problem: in a cave level, players miss the spike hazards. Diagnosis: spikes use the grey rock ramp, and the
background is as dark and contrasty as the floor. Fixes: move spikes to the warm accent ramp with a 1-pixel light tip;
lift and desaturate the background two ramp steps; add a lighter top edge to walkable rock. Re-check in greyscale:
floor, spikes and player now separate.

## Composition and colour pitfalls

- Pure black outlines and pure black shadows everywhere, flattening depth.
- Adding "just one more colour" per asset until the palette has 60 entries.
- Meaning carried only by red vs. green.
- Judging colour only zoomed in, never at 1x in context.
