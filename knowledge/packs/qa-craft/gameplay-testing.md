---
id: qa.gameplay-testing
title: Gameplay testing — feel, balance, difficulty and exploits
tags: gameplay testing, game feel, balance, difficulty, exploit, edge case, playtest, observation, sequence break, softlock
---
# Gameplay testing — feel, balance, difficulty and exploits

Gameplay testing checks whether a feature plays well and cannot be broken by players, beyond whether it functions.
It combines structured checks, exploratory sessions and careful observation of other players.

## Testing game feel

Game feel testing turns subjective impressions into specific, checkable observations. For a movement or combat feature,
check and describe:
- **Responsiveness**: delay between input and visible reaction; does the action happen on press or release?
- **Readability**: can the player see what happened (hit flash, sound, screen shake, particles)?
- **Consistency**: the same input in the same situation produces the same result.
- **Forgiveness**: coyote time, input buffering, generous hitboxes where the design wants them.
- **Control during actions**: air control, cancel windows, animation locks.
Record feel notes as observation plus suggestion: "Jump feels floaty: about one second airtime for a 3-tile jump;
consider higher gravity on descent." Feel judgments are opinions; label them and leave the decision to the Designer.

## Testing balance

Balance testing compares options that should be competitive. Methods:
- **Dominant strategy check**: is one weapon, build or route always best? Compare damage per second, cost per value, or
  time to clear.
- **Formula review**: read tuning data and compute outcomes at boundaries, e.g. DPS = damage × attacks per second ×
  hit rate; time-to-kill = enemy HP ÷ DPS. Compare across options and levels.
- **Economy flow**: track sources and sinks of currency over a session; look for runaway accumulation or starvation.
- **Degenerate combos**: stacking multipliers, cooldown resets, infinite chains.
Present balance findings as tables of computed values with the data file and line they came from.

## Testing difficulty

Difficulty testing checks the curve, not just individual spikes:
- Map each level or encounter to the skills it requires and confirm skills are introduced before being tested.
- Look for spikes: a section much harder than its neighbours, or a new mechanic introduced under pressure.
- Check failure recovery: checkpoint spacing, lost progress after death, frustration loops.
- Check difficulty settings actually change the intended values.
Useful playtest metrics when available: deaths per section, attempts to clear, time per section, quit points.

## Exploits and edge cases

Exploit testing deliberately plays "wrong":
- [ ] Sequence breaks: skipping triggers, reaching areas early, wall clipping, out-of-bounds
- [ ] Softlocks: states where progress is impossible without restart (key consumed, door closed behind)
- [ ] Duplication: items or currency duplicated via save/reload, pause, or rapid input
- [ ] Cheese: enemies stuck on geometry, safe spots, AI that cannot reach the player
- [ ] Timing: input during transitions, pause on the frame of death, alt-tab mid-jump
- [ ] Extreme values: max score overflow, maximum entity counts, zero or negative stats
- [ ] Repeated actions: spam jump, attack, menu open/close
Every confirmed exploit becomes a bug report with exact reproduction steps (see [K:qa.bug-reproduction]).

## Playtest observation

Observing other players is a different skill from playing. Rules:
- Give a minimal brief; do not explain mechanics unless the test is about something later.
- Watch and record; do not help. Note where players hesitate, misread, fail repeatedly or express emotion.
- Record what players do separately from what they say; behaviour is more reliable.
- Ask open questions afterwards: "What was the goal of that area?" rather than "Was that clear?"
- Note sample size; three players reveal major problems but not percentages.
Observation log format: `time · location · what player did · what they said · interpretation (labelled)`.

## Honesty in gameplay findings

A QA agent without a shell cannot play the build. It can review design docs, tuning data and code, compute balance
values, and design playtest scripts. Report such findings as "analysis, not playtested", and give a human a playtest
plan with the exact build, steps and what to observe. Never present imagined play experience as observation.
