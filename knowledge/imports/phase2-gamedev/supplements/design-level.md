# Supplement: Design a level (procedurally generated levels)

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/level-design/SKILL.md, skills/disciplines/level-design/references/pacing-and-flow.md, skills/disciplines/procedural-gen/SKILL.md, skills/disciplines/procedural-gen/references/dungeon-generation.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: reduced to additions for the existing design-level skill covering generated levels; removed engine code for an engine Pixel Studio does not target and headless test commands; described checks in prose; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Additional workflow steps

- When the level is generated rather than hand-placed, the spec describes **rules and
  constraints**, not one layout: room types and size ranges, the generation technique (rooms and
  spanning tree, BSP, drunkard's walk, WFC), seed handling, and an example layout for one named
  seed.
- Write a **gating graph** as a table: room or room type, exits, what each exit needs (key,
  ability), what each room grants, and whether an exit is one-way (drops) or two-way (doors, as two
  rows). Generation must place each grant on the reachable side of its gate.
- Specify the **soft-lock checks** QA and the Programmer will implement: search over (room, items
  held) states from the start to the goal, so a key behind its own door fails even though a flood
  fill says every room is connected; and from every one-way drop's landing room, a save point or
  exit must still be reachable. Also: safe spawn, path to exit, no isolated floor.
- Write **pacing as data**: a beat list with type (teach, combat, rest, climax) and intensity 0..1
  per slot, which the generator fills. Rules to state: no more than 2 high-intensity beats in a row
  (threshold about 0.7), a rest beat directly before the climax, the level opens with a teach beat,
  and each mechanic's teach beat precedes its first combat beat. Spawn density and music intensity
  read the same table.
- Define **seed-sweep acceptance criteria** for QA: at least 200 seeds; zero validity failures;
  identical output for the same seed in a fresh run; distinct layouts close to the seed count;
  min / median / max for room count, critical-path length and floor ratio within stated ranges.
- Name 3–5 showcase seeds for human playtests and ask testers to report the seed with every
  issue.

## Additional quality checks

- [ ] Gating graph lists every key, ability and one-way exit, with grants and requirements.
- [ ] Soft-lock and drop-landing checks are written as testable rules.
- [ ] Pacing rules are expressed as data thresholds, not prose only.
- [ ] Seed-sweep criteria give numbers and the seed count; ranges are labelled "estimate" until
      measured.
- [ ] Required gaps on the generated critical path use about 0.7 of the measured jump reach, not
      the ideal formula value.
- [ ] Authored set pieces that need intent (boss intro, tutorial) are marked hand-made, not
      generated.

## Additional failure conditions

- The generation technique or seed policy is not decided: list options as `Q-n` for the Director
  instead of assuming one.
- A gate's grant cannot be guaranteed reachable by the stated rules: report the soft-lock risk
  and propose a rule change; do not hide it in "QA will check".
- Measured jump reach is unavailable: mark generated gap ranges provisional and the reachability
  checks unverified.
