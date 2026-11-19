---
id: direction.cross-department-coordination
title: Cross-department coordination
tags: coordination, handoff, interfaces, parallel work, conflicts, source of truth, contracts, manifest, naming
---
# Cross-department coordination

Cross-department coordination is about the seams between disciplines: where a designer's numbers become a
programmer's config, where an artist's sprites become loaded textures. Most integration bugs happen at seams, not
inside one department's work.

## Handoff contracts between departments

A handoff contract states what one department delivers to another, in what form and where. Typical contracts in a
Pixel Studio project:

| From → To | Contract | Where |
|---|---|---|
| Designer → Programmer | mechanics with named tunable values and units | `docs/gdd.md`, `design/*.json` or tables |
| Designer → Artist | list of required characters, tiles, UI states | GDD content list section |
| Artist → Programmer | file paths, cell sizes, frame counts, pivots, frame rates | `docs/art/asset-manifest.md` |
| Programmer → QA | how to run tests, what is implemented, known gaps | `README.md`, task report |
| QA → Programmer | reproducible bug reports with expected vs. actual | `qa/` |

Each contract should be a file, not a chat message. If the receiving department has to open the producer's raw work
to understand it, the contract is missing.

## Shared sources of truth

Each kind of fact should have exactly one owning document:

- Vision, pillars, decisions — `docs/vision.md`, `docs/decisions.md` (Director).
- Mechanics, content list, tuning values — `docs/gdd.md` (Designer).
- Style, palette, scale — `docs/art/art-bible.md`, `assets/palette.json` (Artist).
- Asset inventory — `docs/art/asset-manifest.md` (Artist).
- Schedule and milestones — `docs/production/` (Producer).
- Code behaviour — `src/` plus `README.md` (Programmer).

Other documents reference the owner instead of copying it. Copies drift: if the jump height is in the GDD and also
hard-coded in a task description, one will become wrong.

## Managing parallel work

Parallel tasks save time but create conflicts when they touch the same file or depend on an undecided interface.
Rules:

- **One writer per file at a time.** If two tasks must edit the same file, sequence them with `depends_on`.
- **Agree interfaces before parallel work.** Before art and code run in parallel, fix the names, sizes and paths
  (e.g. "player sprite: `assets/characters/player.svg`, 16×24 cells, rows idle/walk/jump").
- **Placeholders with the real contract.** Programmers can use coloured rectangles of the agreed size; when art lands,
  only the asset reference changes.
- **Integration task last.** Plan an explicit integration task depending on both streams, with criteria that check
  names and sizes match.

## Resolving cross-department conflicts

When two deliverables disagree (the GDD says 8 enemies, the manifest has 5; code uses 32 px tiles, art uses 16 px):

1. Identify the source of truth for that fact.
2. If the source of truth is right, revise the other deliverable with a specific instruction.
3. If the source of truth is wrong, update it first (owner of that doc), then revise dependants.
4. If the conflict changes scope, schedule or what the owner was promised, escalate.
5. Record the resolution in the decision log.

Never resolve a conflict by quietly accepting both versions.

## Naming and vocabulary alignment

Shared vocabulary prevents silent mismatch. Keep a short glossary in the GDD: entity names, state names, level IDs.
Asset IDs, code identifiers and design names should match (`slime_green` in the GDD, `char_slime_green.svg` in
assets, `SlimeGreen` or `slime_green` in code). A common heuristic is to check any new noun in a deliverable
against the glossary during review.

## Coordination pitfalls

- Handoffs by summary ("art is done") instead of by manifest.
- Programmers inventing tuning values the designer never specified.
- Artists producing assets for features cut from the GDD.
- Parallel tasks editing the same document.
- Integration left implicit, discovered at the end.
