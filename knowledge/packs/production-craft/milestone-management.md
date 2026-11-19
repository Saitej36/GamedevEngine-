---
id: production.milestone-management
title: Milestones and exit criteria
tags: milestone, concept, pre-production, vertical slice, alpha, beta, release candidate, gold, exit criteria, gate review
---
# Milestones and exit criteria

Milestones are checkpoints where the team proves a defined state of the game. Their value comes from **exit criteria**:
specific, checkable conditions agreed in advance. A milestone without exit criteria is just a date.

## Concept milestone

The concept milestone answers "is this game worth pre-producing?". Typical exit criteria:
- [ ] One-page pitch: genre, audience, platform, core fantasy, unique hook
- [ ] Core loop described (see design-craft) and, ideally, a paper or digital toy prototype of it
- [ ] Visual target: mood board or a few concept pieces
- [ ] Rough scope and team size estimate, labelled as an estimate
- [ ] Top risks listed with an owner
Decision at gate: proceed, pivot, or stop. Stopping here is cheap and should be a normal outcome.

## Pre-production milestone

Pre-production removes uncertainty: it proves the fun, the pipeline and the technical approach. Exit criteria:
- [ ] Playable prototype of the core mechanic that the creative owner signs off as "the fun is there"
- [ ] Game design document covering core systems; open questions listed
- [ ] Art style guide and at least one asset taken through the full pipeline into the build
- [ ] Technical architecture chosen; highest technical risks spiked
- [ ] Production plan: milestone dates, backlog of epics, staffing assumptions

## Vertical slice

A vertical slice is a short section of the game at near-final quality across every discipline: gameplay, art, audio, UI
and performance. It proves the team can hit the quality bar and gives a real cost-per-content measurement. Exit criteria:
- [ ] 5–15 minutes (or one level) playable start to end without developer help
- [ ] Final-quality art, UI and feel in that section
- [ ] Performance at target on target hardware, measured by someone who actually ran it
- [ ] Measured production cost: e.g. hours per level, per character — used to re-plan full production
Pitfall: a "horizontal" slice (all systems at placeholder) presented as a vertical slice. It proves breadth, not quality.

## Alpha

Alpha means **feature complete**: every feature intended to ship is in the build in at least functional form. Exit criteria:
- [ ] All must-have features implemented; any feature not in is formally cut
- [ ] Game playable start to end (placeholder content allowed)
- [ ] Full test pass started; bug database reflects reality
- [ ] No known blockers (S1) preventing progression
After alpha, new features require an explicit change request.

## Beta

Beta means **content complete**: all content is in; work shifts to fixing, polishing and tuning. Exit criteria:
- [ ] All levels, assets, text and audio final or final-candidate
- [ ] Zero open S1 bugs; S2 count trending down
- [ ] Performance, memory and load-time targets met or with an approved plan
- [ ] Localization and platform requirements in test where relevant

## Release candidate and gold

A release candidate (RC) is a build the team believes could ship. Exit criteria:
- [ ] Zero open S1/S2 bugs; remaining bugs reviewed and accepted by the creative owner
- [ ] Full regression pass executed on the RC build (see [K:qa.regression-testing]) with results recorded per case
- [ ] Platform or store submission checklist complete
- [ ] Release notes and known-issues list written
When an RC passes, it becomes the gold/release build. Any change after that restarts RC testing.

## Running a milestone gate review

1. Publish the exit criteria at the start of the milestone, not the week before.
2. For each criterion record status: met / not met / partially met, with evidence (file path, build, test report).
3. Separate evidence the reviewer observed from evidence reported by someone else.
4. Decide: pass, pass with conditions (list them with dates), or fail and re-plan.
5. Re-estimate remaining milestones with what was learned; slips found early are cheaper.
Pitfall: moving the date but keeping the scope. A slip is information; respond with scope, time or quality decisions
made explicitly (see [K:production.scope-and-delivery]).
