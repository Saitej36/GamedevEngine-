---
id: art.character-design
title: Character design for games
tags: character design, silhouette, shape language, readability, sprite, sprite sheet, animation frames, pixel art character
---
# Character design for games

Game character design serves gameplay first: the player must identify who a character is, what it is doing and
whether it is dangerous, at play speed and at the size the character actually appears on screen.

## Silhouette-first character design

Character design should start from the silhouette, because silhouette is what survives small sizes, motion and busy
backgrounds. Practical checks:

- **Fill test:** fill the character with one flat colour. The character type and facing direction should still be
  obvious.
- **Lineup test:** place all characters' silhouettes side by side at 1x. Each must be distinguishable by outline
  alone; if two only differ by colour, one needs a different head shape, prop or proportion.
- **Pose test:** the idle pose should show the character's key feature (weapon, tail, hat) outside the body mass,
  not overlapping it.

A common heuristic is that each character should own one unique silhouette feature that no other character in the
cast shares.

## Shape language for characters

Shape language uses primitive forms to signal personality before any detail is read:

| Dominant shape | Typical read | Typical use |
|---|---|---|
| Circle / soft curves | friendly, safe, soft | player companions, NPCs, collectibles |
| Square / blocky | stable, strong, stubborn | tanks, guards, heavy enemies |
| Triangle / spikes | dangerous, fast, aggressive | enemies, hazards, bosses |

These reads are conventions, not laws, and can be inverted deliberately (a round enemy that is surprisingly
dangerous) — but only as a documented choice. Keep the dominant shape consistent within a faction so the player can
generalise: "spiky things hurt".

## Readability at small sizes

Character readability at small sizes depends on pixel budget and contrast, not detail. Heuristics for pixel art:

- At 16×16, a character has room for roughly a head, a body mass, and one feature. Eyes are often 1 pixel each or a
  single 2-pixel band.
- At 32×32, faces, hands and a held item become possible; outfits can have 2–3 regions.
- Exaggerate proportions: heads at 1/3 to 1/2 of body height read better than realistic proportions at low resolution.
- Keep the player's value contrast against the background highest of any object in play.
- Use no more than 3–4 colour ramps per character; each extra ramp adds noise at 1x.
- Check every design at 1x and at the intended display scale (e.g. 3x or 4x integer scale), never only zoomed.

## Planning sprite sheets and animation frames

Animation should be planned as a frame budget before any pixels are drawn. Typical starting budgets (heuristics for
small 2D games, adjust to scope):

| Animation | Frames | Notes |
|---|---|---|
| Idle | 2–4 | subtle breathing or bob; loops |
| Walk / run | 4–8 | contact and passing poses first |
| Jump | 1–3 | anticipation, rise, fall (fall can loop) |
| Attack | 3–5 | anticipation, strike (hold 1–2 ticks), recovery |
| Hurt | 1–2 | strong pose change plus flash |
| Death | 3–6 | ends on a hold frame or disappears |

Sprite sheet layout rules: every frame uses an identical cell size; one animation per row; frames left to right in
playback order; the pivot (usually bottom-centre, at the feet) is at the same cell coordinate in every frame; leave
the cell's spare space as transparent rather than cropping per frame. Document frame rate per animation (a common
default is 8–12 fps for pixel art).

## Character design in Pixel Studio SVG files

In Pixel Studio, characters are real SVG files drawn as a `<rect>` grid with `shape-rendering="crispEdges"`, using
only colours from `assets/palette.json`. Recommended practice:

- `viewBox` equal to the pixel grid (e.g. `0 0 16 24` for one frame; `0 0 64 24` for a 4-frame row).
- Group each frame in `<g id="walk-0">` etc., offset by whole cell widths.
- Merge horizontal runs of same-colour pixels into one wider rect to keep files small.
- No gradients, blur, anti-aliased strokes or non-integer coordinates in pixel art.

## Character design pitfalls

- Designing the character large and shrinking it — detail turns to noise.
- Player and enemies sharing a palette ramp, so threats do not stand out.
- Pivot drifting between frames, causing in-game jitter.
- Planning 12-frame animations for 15 characters on a 2-week schedule.
- Describing a character in text and calling the description a sprite.
