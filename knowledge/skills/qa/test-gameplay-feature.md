---
id: test-gameplay-feature
role: qa
title: Test a gameplay feature
summary: Evaluate a gameplay feature for correctness, feel, balance, difficulty and exploits through static review of spec, data and code, and produce findings plus a human playtest script, labelling every result by how it was obtained.
triggers: test feature, gameplay test, playtest, balance check, feel check, exploit check, verify mechanic
packs: qa-craft, studio-core
version: 1.0.0
disciplines: feel, combat, input, performance
genres: any
engines: any
engine_dependent: false
---
## Purpose
Find problems in a gameplay feature before players do: rules that differ from the spec, poor feel, imbalance, difficulty
spikes, exploits and edge cases. Without a shell the agent cannot play the build, so findings must be honest about
whether they come from analysis or from someone's observed play.

## Required inputs
- Feature spec and acceptance criteria (`design/` or `docs/`).
- Implementation files and tuning data (`src/`, data/config files).
- Any playtest notes or results reported by others (Programmer, Director, human testers).
- Existing test plan in `qa/`, if any.

## Workflow
1. Read the spec; list the intended behaviour and every numeric value (speeds, damage, cooldowns, costs).
2. Read the implementation and data; compare each value and rule with the spec. Record mismatches with file:line.
3. Functional check by reading: trace each acceptance criterion through the code path and note guards for boundaries,
   state transitions and interruption [K:qa.functional-testing].
4. Balance: compute outcomes from data (DPS, time-to-kill, cost per value, economy sources vs sinks) and look for dominant
   options [K:qa.gameplay-testing]. Show calculations.
5. Difficulty: check that new mechanics are introduced before being tested and look for spikes in level/encounter data.
6. Exploits and edge cases: walk the checklist (sequence breaks, softlocks, duplication, timing, extreme values, input
   spam) against the code; note where guards are missing.
7. Write a playtest script for a human: build, setup, tasks, what to observe, questions to ask afterward.
8. File bugs for confirmed spec mismatches and likely defects using [K:qa.bug-reproduction], marked "static analysis
   (not executed)" with steps a human can use to confirm.
9. Write `qa/gameplay-<feature>.md` with findings grouped by type and labelled by source, then References.

Finding format:
```
F-3 [Balance] Source: analysis of data/weapons.json:12–30 (not playtested)
Observation: Shotgun DPS 48 vs rifle 30 vs pistol 22 at all ranges → dominant option
Suggestion (opinion): reduce shotgun damage falloff range; Designer to decide
```

## Expected output
- `qa/gameplay-<feature>.md`: summary, findings (functional, feel, balance, difficulty, exploits), bugs filed, playtest
  script, open questions, references.
- Bug entries in `qa/bugs/` or the project's bug file, if that convention exists.

## Quality checklist
- [ ] Every finding labelled: analysis (not executed), observed by QA, or reported by <role>
- [ ] Spec-vs-code mismatches cite file:line on both sides
- [ ] Balance numbers show their formula and source data
- [ ] Feel and fun statements marked as opinion with a suggested owner decision
- [ ] Playtest script is runnable by a human without extra explanation
- [ ] Only `qa/` and `tests/` written; references cited

## Failure conditions
- No spec exists: test against the implemented behaviour, state that intended behaviour is unknown, and ask the Designer.
- Implementation files missing: report the feature as not testable and stop.
- Asked to declare the feature "fun" or "passed" without observed play: decline and provide the playtest script instead.
