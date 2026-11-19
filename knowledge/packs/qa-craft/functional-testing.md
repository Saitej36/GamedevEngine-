---
id: qa.functional-testing
title: Functional testing for games
tags: functional testing, test case, test plan, equivalence partitioning, boundary value, state transition, negative testing, coverage, test status
---
# Functional testing for games

Functional testing checks that each feature does what its specification and acceptance criteria say. It answers "does
it work as designed?", separate from "is it fun?" (see [K:qa.gameplay-testing]) and "is it fast enough?"
(see [K:qa.performance-testing]).

## Deriving functional test cases

Functional test cases come from three sources: acceptance criteria (see [K:qa.acceptance-criteria]), the design spec,
and the code or data where available. Techniques:
- **Equivalence partitioning**: group inputs that should behave the same and test one per group. Player health input to
  `takeDamage`: damage < 0, 0, between 1 and current health, ≥ current health.
- **Boundary values**: test at, just below and just above each limit: health 0, 1, max−1, max, max+1; inventory slot
  count 0, 1, full, full+1.
- **State transitions**: list game states (menu, playing, paused, game over) and test every allowed and disallowed
  transition, e.g. pausing during a death animation, opening the menu during a level load.
- **Negative tests**: invalid input, rapid repeated input, input during transitions, missing or corrupt save files.

## Test case template

```
ID: TC-JUMP-003
Feature / criterion: Jump — AC-2 "player cannot double jump"
Preconditions: Level 1 loaded, player grounded, default settings
Steps: 1. Press Jump  2. At apex, press Jump again
Expected: Second press has no effect; player lands normally
Priority: High
Status: not executed | passed | failed | blocked
Executed by / build / date: —
Evidence: —
```
Each case tests one thing, has observable expected results and can be repeated by someone else.

## Recording status honestly

Test status must reflect what was actually observed:
- **passed** — the case was executed on a named build and the expected result was observed.
- **failed** — executed, and the actual result differed; link the bug ID.
- **blocked** — could not be executed because of another defect or missing build; say what blocks it.
- **not executed** — not run. Give the exact steps or command a human should run, e.g. `node --test tests/` or
  "open index.html in a browser and follow steps 1–4".
- **reported by others** — a result someone else stated but QA did not observe; label it with the source.
An agent without a shell cannot run tests or the game. It can review code and test files statically, and must say so:
"Static review of src/player.js:42–60 suggests the double-jump guard exists; behaviour not executed."

## Coverage and prioritisation

Coverage is measured against requirements, not lines of code: what fraction of acceptance criteria have at least one test
case, and what fraction of those were executed. Report both:
`criteria covered = criteria with ≥1 case ÷ total criteria`
`execution rate = cases executed ÷ cases written`
Prioritise by risk: core loop, progression blockers, save/load, input and anything recently changed get the most cases.
Cosmetic features get fewer.

## Game-specific functional areas

Checklist of areas often under-tested:
- [ ] Save/load: save mid-level, quit, reload; corrupt or missing save; version upgrade
- [ ] Pause/resume in every state; focus loss (alt-tab, tab hidden, phone call)
- [ ] Input: keyboard, mouse, gamepad, touch as applicable; rebinding; simultaneous inputs
- [ ] Settings persist and apply (volume, resolution, language)
- [ ] Progression: unlocks, scoring, achievements counted once
- [ ] Death/respawn, restart, return to menu, and any reset of state
- [ ] Text: overflow, missing strings, special characters

## Pitfalls

- Expected results like "works correctly" — not verifiable. State the observable outcome.
- Testing only the happy path.
- Marking cases passed from reading the code; that is a static review finding, not an executed test.
- Not recording the build tested; results become meaningless after the next change.
