---
id: art.visual-development
title: Visual development
tags: visual development, visdev, art direction, style exploration, mood board, style frame, art pillars, look and feel
---
# Visual development

Visual development (visdev) is the phase where a team decides what the game looks like before committing to
production assets. Its job is to remove ambiguity cheaply: every decision made in a style frame is a decision that
does not have to be re-made on asset 40.

## Visual development goals and outputs

Visual development should end with a small set of locked decisions, not a pile of pretty pictures. A useful visdev
phase produces:

- **Art pillars** — 3 to 5 short, testable statements (e.g. "Readable at a glance: the player sprite is always the
  highest-contrast object on screen"). A pillar that cannot be used to reject an asset is too vague.
- **A locked palette** — for pixel art, a fixed list of hex values stored as data (in Pixel Studio, `assets/palette.json`).
- **Resolution and scale rules** — base tile size, character height in pixels, internal render resolution.
- **One or two style frames** — a mock screenshot showing player, enemy, terrain, UI and background together at
  target resolution.
- **A rejected-directions list** — what was tried and why it lost, so the debate does not reopen.

## Visual development process in four passes

A practical visdev process runs in four short passes, each with a review gate:

1. **Reference and intent.** Translate the game's design pillars and genre into visual intent: mood words, era,
   camera, readability needs. Collect reference descriptions (not copied images) and note what each one is for —
   "palette warmth", "silhouette chunkiness".
2. **Divergent exploration.** Produce 2 to 3 genuinely different directions as small thumbnails or swatch sheets.
   Directions should differ on a meaningful axis (palette temperature, outline vs. no outline, detail density), not
   only on subject.
3. **Convergence.** Pick one direction against the pillars, then build a single style frame at real game resolution.
   Small test sprites reveal problems that large paintings hide.
4. **Codify.** Write the art bible: palette file, scale rules, outline rules, lighting direction, naming and
   specification references.

A common heuristic is to spend no more than 10–15% of the art schedule on visdev for a small project; beyond that,
exploration usually becomes avoidance of production.

## Visual development in Pixel Studio's SVG workflow

In Pixel Studio, the Concept Artist has no raster image generator. Every visual is a real, hand-authored file:

- Pixel art is an SVG of `<rect>` elements on an integer grid with `shape-rendering="crispEdges"`, one rect per
  pixel or per horizontal run of same-colour pixels.
- Swatch sheets are SVGs of labelled rectangles using only palette colours.
- Style frames are composite SVGs assembled from the actual test sprites and tiles, so the frame proves the assets
  work together.

Never describe an image in prose and present the description as an asset. A visdev deliverable without files in
`assets/` is a written proposal, and must be labelled as one.

## Choosing between visual directions

Choosing between directions should be a scored decision, not a taste contest. Score each direction 1–5 on:

| Criterion | Question |
|---|---|
| Pillar fit | Does it express the stated mood and art pillars? |
| Readability | Can the player, hazards and pickups be told apart at 1x scale in under a second? |
| Production cost | How many hand-placed pixels or shapes per asset? Can the team sustain it for every asset? |
| Scalability | Does the style survive 30+ assets, animation and UI without drift? |
| Distinctiveness | Would a screenshot be recognisable among genre peers? |

Production cost is the criterion most often ignored. A gorgeous 64×64 character with 12-colour shading is the wrong
choice if the game needs 20 enemies with 6-frame walks and the team can sustain only 16×16.

## Worked example: a cosy farming prototype

Owner request: "a calm farming game, mobile-friendly." Visdev decisions:

- Pillars: *Warm and soft*, *Readable on a phone*, *Cheap to animate*.
- Directions explored: (A) 16 px tiles, 16-colour warm palette, dark-brown outlines; (B) 32 px tiles, no outlines,
  painterly ramps; (C) 8 px tiles, 4-colour Game Boy style.
- Decision: A. B costs roughly four times the pixels per asset; C fails "warm and soft".
- Codified rules: 16×16 tiles, 16×24 characters, 16-colour palette with 3-step ramps, outlines one ramp step darker
  than the fill (never pure black), light from top-left.

## Visual development pitfalls

- Exploring only subjects (a knight, a wizard) instead of styles.
- Approving a large illustration and discovering the style collapses at 16 px.
- Leaving the palette "open" — every new asset then adds colours and the look drifts.
- No rejected-directions list, so stakeholders re-litigate settled choices.
- Style frames composed from assets that will never exist in production.
