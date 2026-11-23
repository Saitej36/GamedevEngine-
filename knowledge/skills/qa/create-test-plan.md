---
id: create-test-plan
role: qa
title: Create a test plan
summary: Write a test plan for a feature or milestone that maps every acceptance criterion to functional, regression, gameplay and performance test cases, with honest execution status and run steps for humans.
triggers: test plan, test cases, test strategy, qa plan, coverage, test matrix, verification plan
packs: qa-craft, studio-core
version: 1.0.0
disciplines: performance, feel
genres: any
engines: any
engine_dependent: false
---
## Purpose
Define what will be tested, how, and how each result will be recorded, so that acceptance of a feature or milestone is
based on traceable evidence. The plan is written before or alongside implementation and is reused for regression.

## Required inputs
- The feature spec or GDD section with acceptance criteria (`design/` or `docs/`).
- The code or data under test, if it exists (`src/`, data files), to identify real entry points.
- Project README/package.json to learn the test framework and the real test command.
- Existing plans in `qa/` and tests in `tests/`.

## Workflow
1. Read the spec and list every acceptance criterion with an ID. Review each for testability and propose rewrites for
   vague ones in Given/When/Then [K:qa.acceptance-criteria].
2. Define scope: in scope, out of scope, platforms/browsers, build to be tested.
3. For each criterion derive cases using equivalence partitions, boundaries, state transitions and negative tests
   [K:qa.functional-testing]. Write cases with ID, preconditions, steps, expected result, priority.
4. Add gameplay checks (feel, balance, exploits) relevant to the feature [K:qa.gameplay-testing] and performance
   scenarios if budgets apply [K:qa.performance-testing].
5. Select the smoke and regression cases affected by the change [K:qa.regression-testing].
6. Decide automation: deterministic rules get automated tests in `tests/`, with names that reference the AC
   [K:qa.test-automation]. Read the code to use real exported names.
7. Build the traceability matrix: AC → cases → type → status → evidence.
8. Set every status to "not executed" unless QA executed and observed it. For each not-executed case give the exact steps
   or the command from README/package.json.
9. Define entry/exit criteria: e.g. exit when all must-have ACs pass, zero open S1/S2.
10. Write `qa/test-plan-<feature>.md` and end with References.

## Expected output
- `qa/test-plan-<feature>.md` containing scope, criteria list, test cases, traceability matrix, entry/exit criteria, run
  instructions for humans, and references.
- Optionally new or updated automated test files in `tests/`, listed in the plan as "written, not executed".

## Quality checklist
- [ ] Every acceptance criterion maps to at least one case; gaps listed explicitly
- [ ] Cases include boundary and negative tests, not only happy paths
- [ ] Expected results are observable and specific
- [ ] Statuses are honest: no "passed" without execution; others' results labelled with source
- [ ] Test command and manual steps are taken from project files, not invented
- [ ] Only `qa/` and `tests/` written; references cited

## Failure conditions
- No spec or acceptance criteria: write proposed criteria marked "draft — needs Designer approval" and stop short of
  claiming coverage.
- Spec contradicts implemented code: record the conflict with file:line and ask the Designer/Director which is correct.
- Test framework unknown: do not invent one; state that the run command must be confirmed by the Programmer.
