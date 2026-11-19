---
id: design.progression-and-balancing
title: Progression and balancing
tags: progression, balancing, difficulty curve, xp curve, power curve, flow, tuning, formulas, spreadsheet
---
# Progression and balancing

Progression is how the player's capability, options and goals change over time; balancing is tuning numbers so the
experience matches intent. Pixel Studio designers cannot playtest, so balancing work is done with explicit formulas,
tables and stated targets, and every result is labelled as an estimate.

## Types of progression

Specify which progression types a game uses and how they interact:
- **Player skill**: the player gets better. Free, but must be supported by level and difficulty design.
- **Power**: stats rise (HP, damage). Easy to build, easy to over-inflate.
- **Options / breadth**: new abilities, weapons, characters. Adds variety without necessarily adding power.
- **Content**: new levels, biomes, story beats.
- **Cosmetic / status**: skins, titles. No gameplay effect.

A heuristic: power progression should be roughly matched by difficulty progression, so felt challenge comes from new
situations and options rather than from numbers drifting apart.

## Common curve formulas

Use simple, named curves for XP, costs and enemy stats. Common choices:

| Curve | Formula | Feel |
|---|---|---|
| Linear | `base + step × (n − 1)` | Predictable, flattens late |
| Polynomial | `base × n^k` (k often 1.5–2.5) | Steady acceleration |
| Exponential | `base × r^(n − 1)` (r often 1.07–1.25) | Fast escalation; common in idle games |
| Logistic / capped | approach a cap asymptotically | Good for stats with a sensible max |

Worked example: XP to reach level n = `50 × n^1.8`. Level 2 needs ~174 XP, level 10 ~3,155 XP (estimate, rounded). If
an average enemy gives `8 + 2n` XP, kills needed per level rise from about 15 at level 2 to about 112 at level 10, so
either enemy XP must scale faster or the curve exponent should drop. Make this kind of check in a table and show it.

## Difficulty curve and flow

The difficulty curve should keep the player in flow: challenge slightly above current skill, with relief periods.
Practical rules:
- Use a sawtooth: each section ends harder than it started, then a new section starts slightly easier with a new
  element.
- Place spikes deliberately (bosses), and precede them with a rest and a checkpoint.
- Provide catch-up: optional grinding, assist options or dynamic difficulty for players who fall behind.
- Define a target failure rate per section as a design target (for example, "first boss: most players need 2–4
  attempts"), and label it as a target to verify in playtesting, not a fact.

## Balancing methods without a playtest

When the game cannot be run, balance with analysis:
1. **Target metrics first**: write intended time-to-kill, time-to-complete, deaths per level, gold per level.
2. **Derive numbers from targets**: compute HP, damage, costs from the targets rather than guessing values.
3. **Transitive balance**: give each option a cost and a benefit on the same scale (e.g. DPS per gold); outliers are
   dominant or useless.
4. **Extremes check**: test the formula at level 1, mid-game and max level, and with best/worst builds.
5. **Sensitivity check**: change one parameter by ±20% and see whether outcomes change sensibly.

Record all of this in `design/table-<system>.md` with formulas visible so the programmer can implement them directly.

## Worked example: weapon balance by DPS per cost

| Weapon | Damage | Shots/s | DPS | Cost | DPS per 100 g |
|---|---|---|---|---|---|
| Pistol | 10 | 3 | 30 | 0 | — |
| SMG | 6 | 10 | 60 | 200 | 30 |
| Shotgun | 8 × 6 pellets | 1.2 | 57.6 (max) | 250 | 23 |
| Rifle | 45 | 1.5 | 67.5 | 300 | 22.5 |

The SMG is most efficient; that may be intended (early buy) or should be offset by range or accuracy. The shotgun's
DPS assumes all pellets hit, so its effective DPS at range is lower: state that assumption.

## Progression and balancing checklist

- [ ] Each progression type in use is named, with how it is earned and what it unlocks.
- [ ] Curves are written as formulas with parameters, plus a sample table at key levels.
- [ ] Target metrics are stated and numbers are derived from them.
- [ ] Extremes and ±20% sensitivity checked; results labelled "estimate".
- [ ] No option dominates others on cost-efficiency without a stated trade-off.
- [ ] Tunable values live in one table referenced by the GDD.

## Pitfalls

- Exponential stats against linear rewards, creating a hard wall mid-game.
- Balancing for the average player only, ignoring the top and bottom of the skill range.
- Hidden multiplicative stacking: three +50% bonuses multiplying to +237.5%.
- Claiming a game "is balanced" without playtest data; say "balanced on paper against these targets".
