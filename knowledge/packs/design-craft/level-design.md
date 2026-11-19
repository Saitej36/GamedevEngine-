---
id: design.level-design
title: Level design
tags: level design, layout, pacing, teaching, kishotenketsu, beat chart, grid, encounter, sightlines, blockout
---
# Level design

Level design arranges space, challenges and rewards so the player learns, practises and masters the game's mechanics
in a deliberate order. At Pixel Studio, level specs live in `design/level-<nn>-<name>.md` and must be precise enough
for a programmer to build the level as data without visual tools.

## Teaching structure: introduce, develop, twist, conclude

A reliable level teaching structure is the four-step pattern often linked to kishotenketsu and widely used in
platformer design:

1. **Introduce** the mechanic in a safe context where failure costs little (a gap over a short drop, not a pit).
2. **Develop** it with gradually harder variations (wider gap, moving platform).
3. **Twist** it by combining it with another mechanic or changing context (gap plus enemy, gap in the dark).
4. **Conclude** with a test that uses the mastered skill confidently, then reward.

Apply it per mechanic within a level, and across levels for the whole game. A heuristic: introduce no more than one
new mechanic or enemy per level in the first third of the game.

## Beat chart for pacing

A level beat chart lists the beats of a level and their intensity so pacing is visible before building. Use a table:

| Beat | Content | New element | Intensity 1–5 | Est. time |
|---|---|---|---|---|
| 1 | Safe start, coins show route | — | 1 | 10 s |
| 2 | First spring, short drop | Spring | 2 | 15 s |
| 3 | Spring over spikes | — | 3 | 20 s |
| 4 | Rest area, checkpoint | — | 1 | 5 s |
| 5 | Spring + moving platform | Combination | 4 | 30 s |
| 6 | Exit, reward chest | — | 2 | 10 s |

Aim for a sawtooth: tension rises, then drops at a rest point, then rises higher. Avoid flat intensity for more than
three beats. Times are estimates and must be labelled as such.

## Spatial spec format for buildable levels

Programmers build levels from data, so specify layouts precisely. For tile-based games, use an ASCII grid with a
legend and fixed tile size:

```
Tile size: 32 px. Grid 20 x 8. Origin top-left.
....................
....................
.........C.C........
...P.....===....E...
.......=......====..
S.......^^^........G
####################
Legend: S start, G goal, P platform-moving (path x=3..7), = platform, ^ spikes, C coin, E enemy (patrol x=14..18), # ground
```

Add entity tables (id, type, position, parameters) for anything with behaviour. For non-tile games, give coordinates
in world units and a bounding box.

## Readability and guidance

Players should understand where to go and what is dangerous without text. Level readability techniques:
- **Leading lines and breadcrumbs**: coins, lights or edges that point along the intended route.
- **Landmarks**: unique objects visible from far away for orientation.
- **Gating**: a locked door seen before its key, so the player forms a goal.
- **Safe preview**: show a hazard where it cannot hurt before it appears where it can.
- **Consistent visual language**: the same colour or shape always means the same thing (red = damage). Coordinate
  this with the Concept Artist via `docs/art/`.

## Encounter design

An encounter is a combination of enemies, terrain and objectives. Vary encounters on these axes: enemy mix (roles such
as melee rusher, ranged, tank, support), arena shape (open, corridor, vertical), entry (ambush, visible approach),
and win condition (kill all, survive N seconds, reach exit). A heuristic for difficulty budgeting: assign each enemy
type a threat cost (rusher 1, ranged 2, tank 3) and give each encounter a budget that rises along the beat chart.

## Level design checklist

- [ ] Each level has a stated goal, the mechanics it teaches or tests, and a target completion time (estimate).
- [ ] Layout is specified as grid or coordinates with a legend and units.
- [ ] Every new element is introduced safely before it is used dangerously.
- [ ] Checkpoints are placed so that a failure costs at most a set amount of replay (a common heuristic is 30–60 s).
- [ ] Rewards and secrets are placed off the critical path but signposted.
- [ ] No unreachable areas: jump distances fit the player's movement parameters from the GDD.

## Level design pitfalls

- Teaching by text pop-up instead of by space.
- Leap-of-faith jumps where the landing is off-screen.
- Difficulty spikes from new mechanic and new enemy introduced at the same time.
- Jump gaps designed without checking the GDD jump height and distance numbers.
