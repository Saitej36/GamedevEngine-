---
id: qa.acceptance-criteria
title: Acceptance criteria and test mapping
tags: acceptance criteria, given when then, gherkin, testable, definition of done, traceability, test case mapping, user story
---
# Acceptance criteria and test mapping

Acceptance criteria are the conditions a feature must meet to be accepted. They connect design intent to QA
verification: if a criterion cannot be tested, nobody can say whether the feature is done.

## Writing criteria in Given/When/Then

Given/When/Then is a structured format for acceptance criteria:
- **Given** the starting state or context
- **When** the player or system action
- **Then** the observable outcome
Example for a dash ability:
```
AC-1 Given the player is grounded and dash is off cooldown
     When the player presses Dash
     Then the player moves 4 tiles in the facing direction within 0.25 s
AC-2 Given the player has just dashed
     When the player presses Dash again within 1.0 s
     Then no dash occurs and the cooldown indicator is visible
AC-3 Given the player dashes toward a wall closer than 4 tiles
     When the dash completes
     Then the player stops at the wall without overlapping it
```
Use `And` for additional conditions. One behaviour per criterion.

## What makes a criterion testable

A testable criterion is specific, observable and unambiguous. Check each one:
- [ ] Contains numbers or observable states instead of adjectives ("4 tiles in 0.25 s", not "fast")
- [ ] Describes outcome, not implementation ("player stops at wall", not "uses raycast")
- [ ] Has a clear pass/fail result two testers would agree on
- [ ] Covers failure and edge cases, not only the happy path
- [ ] Independent of other criteria where possible

Rewrite examples:
| Untestable | Testable |
|---|---|
| Jump feels good | Jump reaches 3 tiles height; apex at 0.4 s ± 0.05 s; input buffered 0.1 s before landing |
| Menus are intuitive | From the main menu, a new player reaches gameplay in ≤ 2 inputs |
| Game runs smoothly | Frame time ≤ 16.7 ms for 99% of frames in the baseline scenario on target device |

Subjective qualities (feel, fun) still need criteria: use measurable proxies plus a named sign-off ("Designer approves
feel in playtest") and state that the sign-off is a judgment.

## Mapping criteria to test cases

Traceability links every criterion to the tests that verify it:
```
| AC | Test cases | Type | Status | Evidence |
| AC-1 | TC-DASH-01, TC-DASH-02 (boundary 3.9/4/4.1 tiles) | manual | not executed | steps in qa/test-plan.md |
| AC-2 | tests/dash.test.js "blocks dash during cooldown" | automated | written, not executed | run: npm test |
| AC-3 | TC-DASH-05, TC-DASH-06 | manual | not executed | — |
```
Each criterion needs at least one positive case and, where relevant, negative and boundary cases (see
[K:qa.functional-testing]). A criterion with no case is a coverage gap; a case with no criterion is either a regression
case tied to a bug or a sign the criteria are incomplete.

## Criteria quality review by QA

QA should review criteria before implementation starts, when changes are cheap:
1. Flag vague words: fast, smooth, intuitive, fun, appropriate, correctly.
2. Ask for missing edge cases: interruption, rapid input, zero/max values, save/load during the action.
3. Check consistency with the design spec and other features.
4. Propose rewritten criteria rather than only objecting; the owner (Designer or Director) approves them.

## Feature acceptance decision

A feature is accepted only when every criterion has a recorded status:
- All criteria passed (executed and observed) → accept.
- Any failed → not accepted; bugs linked.
- Any not executed → "not verified"; list the steps for a human. Do not report the feature as accepted.
- Results reported by others are labelled with their source and do not count as QA-observed.
