---
id: design.genre-design
title: Genre design levers
tags: genre, roguelite, platformer, puzzle, rpg, shooter, strategy, idle, mobile casual, design levers
---
# Genre design levers

Each game genre has a small set of design levers that most strongly determine whether it works. Identify the genre in
the brief, then spend design effort on its levers first. Numbers below are common heuristics, not industry facts.

## Roguelite design levers

Roguelites combine short runs, procedural variation and persistent meta progression.
- **Run length**: commonly 10–40 minutes; shorter runs lower the cost of death.
- **Build variety**: upgrades that combine (synergies) rather than only adding stats. Offer choices of 2–3 options.
- **Procedural structure**: hand-made rooms assembled by rules usually read better than fully random layouts.
- **Meta progression**: unlocks that widen options (new characters, items in the pool) more than raw power, so skill
  still matters.
- **Death as learning**: show what killed the player and what they unlocked.
Pitfall: meta power so strong that early runs feel pointless and late runs trivial.

## Platformer design levers

Platformers live on movement feel and level layout.
- **Movement parameters**: jump height, air control, acceleration, coyote time, jump buffering, variable jump
  height. Specify all as numbers.
- **Readable hazards** and consistent collision; hitboxes slightly smaller than sprites for hazards feel fair.
- **Level teaching** via introduce-develop-twist-conclude; checkpoints spaced to limit replay.
- **Camera**: look-ahead in the movement direction; never hide landing spots.
Pitfall: level gaps designed without the jump numbers.

## Puzzle design levers

Puzzle games are about insight, not execution.
- **Rule clarity**: few rules, fully consistent, discoverable by experimentation.
- **One idea per puzzle**: each puzzle should have an "aha" built on a single insight or a new combination.
- **Difficulty ordering** by number of steps and how hidden the insight is, not by board size alone.
- **Undo and reset** with no penalty; hints that nudge before they solve.
Pitfall: puzzles solvable by brute force, or with multiple unintended easy solutions. Write the intended solution
in the level spec so QA can verify it.

## RPG design levers

RPGs centre on character growth, choice and a world to explore.
- **Stat model**: few stats, each with a clear role; show formulas such as `damage = atk × skill_mult − def × 0.5`.
- **Build identity**: classes or skill trees with distinct play styles.
- **Encounter pacing**: combat frequency, rest points, resource attrition between rests.
- **Quest structure**: clear objectives, meaningful rewards, choices with visible consequences.
Pitfall: grinding required to pass content because XP curves outpace rewards.

## Shooter design levers

Shooters depend on weapon feel and enemy readability.
- **Time-to-kill** targets per enemy class drive HP and damage numbers.
- **Weapon roles**: range, fire rate, spread and reload create trade-offs; avoid weapons that dominate all ranges.
- **Enemy roles**: rusher, ranged, tank, flanker; mix them per encounter.
- **Feedback**: hit markers, hit-stop, recoil, clear damage direction indicators.
Pitfall: bullet-sponge enemies that raise difficulty by HP alone.

## Strategy design levers

Strategy games are about decisions under constraints.
- **Meaningful choices**: options with real trade-offs, such as economy vs military vs tech.
- **Information**: decide what is visible (fog of war) and what is hidden; hidden information creates risk.
- **Counter systems**: rock-paper-scissors relationships with soft rather than absolute counters.
- **Pacing**: turn or tick length, snowball control (comeback mechanics, diminishing returns).
Pitfall: a single dominant strategy found early, which collapses the decision space.

## Idle and mobile casual design levers

Idle and casual mobile games fit short, interruptible sessions.
- **Session length**: many casual sessions are a few minutes; design for one-handed, interruptible play.
- **Exponential growth** with prestige resets that multiply future progress; tune the first prestige to feel like a
  reward, often after the first hour or so of play (heuristic).
- **Offline progress** with a sensible cap, presented as a welcome-back reward.
- **Instant readability**: understand the goal within seconds, without text.
Pitfall: monetization pressure replacing design; follow the ethical guidance in `design.economy-and-monetization`.
