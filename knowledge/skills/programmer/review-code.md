---
id: review-code
role: programmer
title: Review game code
summary: Review game source and tests for correctness, architecture, testability, performance and honest reporting, producing prioritized findings with file references.
triggers: code review, review code, review pr, review changes, audit code, check implementation, refactor review, quality review
packs: engineering-craft, qa-craft, studio-core
version: 1.0.0
disciplines: performance, save, ai
genres: any
engines: any
engine_dependent: true
---
## Purpose
Give a structured, actionable review of game code written by another agent or person, catching bugs and design-boundary
violations before they reach QA. The review reasons from reading the code, since the agent cannot compile or run it, and
is explicit about what could only be confirmed by execution.

## Required inputs
- The files or change to review (paths in `src/`, `tests/`, `index.html`, `package.json`, `README.md`), and the
  hand-off summary that accompanied them.
- The design spec or task the code implements, and acceptance criteria if any.
- The target engine/stack and the project's conventions (README, existing code).

## Workflow
1. Read the task, design spec and hand-off summary; list what the code is supposed to do.
2. Read every changed file fully, then Grep for callers and related modules to understand integration.
3. Check correctness against each design rule: logic errors, off-by-one, sign and unit mistakes, missing `dt` scaling,
   update order, mutation during iteration, null/destroyed object access, restart/reset state, listener cleanup,
   pooled object reset, float comparisons [K:eng.debugging].
4. Check architecture: pure core separated from engine/DOM, dependencies point one way, tuning in config with units,
   RNG and time injected, no global mutable state [K:eng.software-architecture].
5. Check tests: do they exist for each rule and edge case, are they deterministic, are they included in the test
   command, would they actually fail if the rule broke [K:eng.testing-and-deployment].
6. Check performance in hot paths: per-frame allocations, O(n²) loops, unpooled spawns, per-frame text updates
   [K:eng.optimization].
7. Check engine-specific correctness against the relevant tool pack (lifecycle methods, physics usage, input API,
   loader keys); flag any API you cannot confirm instead of asserting it is wrong.
8. Check reporting honesty: the hand-off must not claim compilation, execution or passing tests without human output;
   README must state run and test commands.
9. Write the review. Only edit code yourself if the task explicitly asks for fixes; otherwise report findings.

## Expected output
- A review document returned as the deliverable (or written where the task specifies, within programmer paths, e.g. a
  section in `README.md` only if requested), containing:
  - Summary verdict: approve, approve with changes, or request changes.
  - Findings ordered by severity (blocker, major, minor, nit), each with file path and line or function, the problem,
    why it matters, and a concrete suggested fix.
  - Test gaps and suggested test cases.
  - Items needing execution to confirm, with exact commands for the human.
  - A References section with `[K:<id>]` citations.

## Quality checklist
- [ ] Every changed file was read in full.
- [ ] Each finding cites a specific location and gives an actionable fix.
- [ ] Severity reflects player or project impact, not style preference.
- [ ] Design rules were checked one by one against the implementation.
- [ ] Architecture boundary and determinism were checked.
- [ ] Test coverage and honesty of test reporting were checked.
- [ ] Uncertain engine API claims are marked as "verify against official docs", not stated as fact.
- [ ] The review states that no code was compiled or executed during review.

## Failure conditions
- The code or the spec it implements is not available: report what is missing instead of reviewing from assumptions.
- The change is too large to read fully within the task: review the highest-risk files, and state clearly which files
  were not reviewed.
- Findings reveal a design ambiguity rather than a code defect: escalate to the designer/director.
- The task asks for approval that depends on test results the human has not provided: give a conditional verdict.
