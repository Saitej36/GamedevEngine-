---
id: design.mechanics-and-systems
title: Mechanics and systems design
tags: mechanics, systems, rules, player verbs, emergence, interactions, state machine, spec, tuning table
---
# Mechanics and systems design

Mechanics are the individual rules and player verbs of a game; systems are sets of mechanics that interact through
shared resources or states. Good mechanics are readable and responsive; good systems create interesting situations
the designer did not have to author one by one.

## Mechanic spec template

Specify every mechanic with the same template, in `docs/GDD.md` for core verbs or in `design/spec-<mechanic>.md`
for larger ones:

```markdown
### Mechanic: Wall jump
Purpose: lets players climb vertical shafts; serves pillar "mastery through movement".
Input: Jump while touching a wall and airborne.
Rules: Launch away from wall at 45°; horizontal input ignored for 0.12 s (tunable).
Parameters: launch speed 420 px/s; wall slide speed cap 120 px/s.
States: Airborne -> WallSliding -> WallJumping -> Airborne.
Interactions: Resets dash. Does not work on ice walls.
Feedback: dust particle, wall-kick sound, short squash on launch.
Edge cases: two walls 1 tile apart; wall ends mid-jump; jump pressed on the landing frame.
Acceptance: player can climb a 6-tile shaft using alternating wall jumps.
```

The edge cases and acceptance lines turn into QA test cases, so do not skip them.

## Qualities of a good mechanic

Evaluate each mechanic against these qualities (design judgement, not measurement):
- **Readable**: the player can predict the outcome before acting. Telegraph enemy attacks; make hitboxes match art.
- **Responsive**: input produces feedback immediately; buffering and coyote time (a short grace window after
  leaving a ledge, commonly around 0.1 s) make controls feel fair.
- **Expressive**: there is more than one good way to use it, with a skill ceiling.
- **Orthogonal**: it does something no other mechanic already does. Two mechanics with overlapping purposes is a cut
  candidate.
- **Composable**: it interacts with other mechanics to create new situations.

## Designing systems with interactions

A game system becomes interesting through interactions between its elements. Build an interaction matrix: elements
on both axes, and in each cell what happens when they meet.

| | Fire | Water | Oil | Wood crate |
|---|---|---|---|---|
| Fire | — | Extinguished, creates steam | Ignites, spreads fast | Burns over 3 s |
| Water | | — | Oil floats, spreads | Crate floats |
| Oil | | | — | Crate becomes flammable |

Each filled cell is a potential emergent situation. Empty cells are design decisions: either fill them or state "no
interaction" so programmers do not guess. A heuristic is that a small set of elements (four to six) with dense
interactions produces more play than many elements with sparse ones.

## States and state machines

Describe stateful entities (player, enemies, doors, turrets) as state machines in the spec. List states, transitions
and their triggers, and what the entity can do in each state:

```
Enemy "Charger": Idle -(player within 160 px)-> Windup (0.6 s, flashes red)
  -> Charge (300 px/s, 1.0 s) -(hits wall)-> Stunned (1.5 s, takes 2x damage) -> Idle
```

State tables remove most ambiguity for programmers and give QA the transitions to test.

## Tuning tables and parameters

Collect every tunable number for a system in one tuning table in `design/table-<system>.md` with columns: parameter,
value, unit, range tried or allowed, rationale. Rules:
- One source per number; the GDD links to the table rather than repeating values.
- Use units (px, s, px/s, %, per minute).
- Prefer parameters that designers can reason about (time-to-kill in seconds) over raw internals (damage per frame).

## Worked example: time-to-kill driven combat

Start from the experience: "basic enemies die in about 1 s of focused fire; elites in about 4 s." With player DPS of
10 × 4 shots/s = 40, set basic HP ≈ 40 and elite HP ≈ 160 (estimate). Then derive upgrade values: a +25% damage upgrade
cuts basic TTK to 0.8 s. Record the target TTK in the table so later changes preserve intent.

## Mechanics pitfalls

- Specifying feel words without numbers or feedback.
- Hidden rules the player cannot discover (invisible modifiers, unexplained immunities).
- Mechanics that only matter in one level: high cost, low value.
- Adding a new mechanic to fix a balance problem that a parameter change would solve.
