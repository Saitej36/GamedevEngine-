---
id: design.core-loops
title: Core gameplay loops
tags: core loop, moment-to-moment, session loop, meta loop, compulsion loop, feedback, reward, loop diagram
---
# Core gameplay loops

A core gameplay loop is the repeated cycle of actions, outcomes and rewards that makes up most of play time. If the
core loop is not fun, no amount of content or progression fixes it, so the loop is the first thing to specify and the
first thing to prototype.

## Three nested loop layers

Most games have three nested loop layers. Specify all three in the GDD with explicit timings (the timings below are
common heuristics, not rules):

| Layer | Duration (heuristic) | Question it answers | Example (roguelite) |
|---|---|---|---|
| Moment-to-moment | 1–30 s | What am I doing right now? | Move, dodge, shoot, collect |
| Session / mid loop | 3–30 min | What am I working toward this sitting? | Clear rooms, pick upgrades, beat the boss or die |
| Meta loop | Hours to weeks | Why come back? | Spend run currency on permanent unlocks |

Each layer should feed the next: moment-to-moment actions earn session resources, sessions earn meta progress, and
meta progress changes how the moment-to-moment feels (new options, not just bigger numbers).

## Loop anatomy: action, feedback, reward, choice

Every core loop layer can be written as four beats. Write them explicitly for each layer:

1. **Action**: the player verb(s) used (aim and shoot).
2. **Feedback**: immediate response that confirms the action (hit flash, sound, damage number, within ~100 ms as a
   common heuristic).
3. **Reward / outcome**: what changes (enemy dies, drops coins, room clears).
4. **Choice / reinvestment**: what the player does with the reward (spend coins on an upgrade), which changes the next
   action.

A loop without the fourth beat feels like a treadmill. A loop without fast feedback feels unresponsive regardless of
how good the rewards are.

## Loop diagram template

Draw loops as text diagrams in `docs/GDD.md` or `design/core-loop.md` so every role can read them:

```
[Explore room] -> [Fight enemies] -> [Collect coins + XP]
      ^                                     |
      |                                     v
[Enter next room] <- [Choose 1 of 3 upgrades on level-up]
Meta: run ends -> coins banked -> buy permanent unlock -> new run starts stronger/wider
```

Under the diagram, list for each arrow: the resource that flows, its rough quantity per cycle, and its source of
variation (random drop, skill, choice).

## Sources of variation

A core loop repeated hundreds of times needs variation to stay interesting. Common levers:
- **Randomness of input** (before the player acts): random room layouts, card draws, upgrade offers. Gives the player
  a new problem to solve each cycle.
- **Randomness of output** (after the player acts): random hit chance, random loot. Adds excitement but can feel
  unfair; keep it low for skill-based actions.
- **Player expression**: builds, routes, play styles that change how the loop is executed.
- **Escalation**: enemy density, speed or new enemy types over time.
- **Content rotation**: new biomes, enemies, puzzles introduced at intervals.

A useful heuristic: introduce something new (enemy, mechanic, visual setting) at least every few minutes of the
session loop, especially in the first 15 minutes.

## Worked example: endless runner

- Moment-to-moment (2–5 s): see obstacle, jump or slide, land; coin pickup sound on collect.
- Session (60–180 s, estimate): run until collision; speed rises 3% every 10 s (tunable); end screen shows distance,
  coins and best score.
- Meta: coins buy cosmetic skins and one of three permanent boosts (start shield, magnet duration, revive token).
- Choice beat: before each run, equip one boost; this changes moment-to-moment risk-taking.

## Evaluating a core loop on paper

Without a playable build, evaluate a loop with these checks and record the result as a design judgement, not a test:
- [ ] Can the moment-to-moment loop be described in one sentence with a verb?
- [ ] Does every action get feedback within roughly a tenth of a second?
- [ ] Does each layer's reward feed a choice in the same or next layer?
- [ ] Is there a failure state, and is retrying fast (a common target is under ~5 s back to play)?
- [ ] Are at least two sources of variation present?
- [ ] Does the meta loop add options, not only stat inflation?

## Core loop pitfalls

- Meta loop compensating for a weak core: unlock systems wrapped around a dull action.
- Reward overload: every action pays out, so nothing feels meaningful.
- Dead time: menus, travel or loading between loop beats that add no decisions.
- Loops that only make sense with content the scope cannot afford.
