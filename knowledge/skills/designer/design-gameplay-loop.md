---
id: design-gameplay-loop
role: designer
title: Design a gameplay loop
summary: Specify the moment-to-moment, session and meta loops with timings, resource flows, variation sources and a paper evaluation, in design/core-loop.md and the GDD.
triggers: core loop, gameplay loop, game loop, meta loop, session loop, compulsion loop, loop design
packs: design-craft, studio-core
---
## Purpose

Define the repeated cycle of play precisely enough that the Programmer can build a vertical slice and QA can check
the loop's beats. The output makes the loop's actions, feedback, rewards, choices, timings and resource flows explicit
across three layers, and records a reasoned evaluation since the loop cannot be playtested by the agent.

## Required inputs

- `docs/BRIEF.md`: genre, platform, target session length, audience.
- `docs/GDD.md` if it exists: pillars, verbs and mechanics already decided.
- The task statement and its acceptance criteria.
- Retrieved knowledge: `design.core-loops`, plus `design.genre-design` for the genre's levers and
  `design.player-experience-and-retention` for feedback and onboarding.

## Workflow

1. Read the brief and GDD. Note the target session length, platform constraints and pillars. Number the task's
   acceptance criteria `AC-1…n`.
2. Write the moment-to-moment loop as action → feedback → reward → choice, naming the exact player verbs and the
   feedback for each (visual, audio, timing). Target feedback within roughly 100 ms (heuristic).
3. Write the session loop: goal of a session, how it ends (win, fail, natural stop), and its length as an estimate
   derived from the beats (e.g. 8 rooms × ~45 s ≈ 6 min).
4. Write the meta loop: what persists between sessions, what it unlocks, and how that changes moment-to-moment play
   (new options preferred over raw stat gains).
5. Draw a text loop diagram and, under it, a resource-flow table: resource, produced by, consumed by, approximate
   quantity per cycle, source of variation.
6. List at least two sources of variation (randomised input, player expression, escalation, content rotation) and
   when new elements are introduced across the first 15 minutes.
7. Define failure and retry: what failure costs and how fast play resumes (heuristic target: under ~5 s).
8. Evaluate the loop on paper with the checklist from `design.core-loops`; record each result as a design judgement
   and list risks with a playtest question for each ("Do players use dash offensively?").
9. Write `design/core-loop.md`. Update the core loop section of `docs/GDD.md` with a summary and link, bump its
   version and add a changelog line.
10. End both files' new content with AC coverage, Assumptions, Open questions and References (`[K:<doc-id>]`).

## Expected output

- `design/core-loop.md` containing: three loop layers with beats, text diagram, resource-flow table, variation
  plan, failure/retry rules, paper evaluation, risks and playtest questions, AC coverage, Assumptions, Open
  questions, References.
- Updated `docs/GDD.md` core loop section linking to the spec, with version bump and changelog entry.

## Quality checklist

- [ ] Each layer names concrete verbs, feedback, rewards and the choice the reward enables.
- [ ] Timings are numeric and labelled "estimate", with the arithmetic shown.
- [ ] Each layer feeds the next; the meta loop changes how the core plays.
- [ ] At least two variation sources and a new-element schedule for the first 15 minutes.
- [ ] Failure state and retry time are defined.
- [ ] Resource-flow table has quantities and sources for every resource.
- [ ] Evaluation is framed as judgement with playtest questions, not as a test result.
- [ ] Vocabulary matches the GDD; References only cite ids that were in context.

## Failure conditions

- No brief and no GDD available: stop and report; a loop without genre or platform context is guesswork.
- The requested loop conflicts with GDD pillars or the brief's session length: report the conflict with options
  instead of overriding approved design.
- The task requires meta-progression or monetization the brief excludes: note it as an open question and design
  without it.
- The loop depends on mechanics that are unspecified and outside this task: list them as dependencies and stop
  short of inventing them in detail.
