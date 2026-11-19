---
id: production.agile-and-scrum
title: Agile, Scrum and Kanban for game teams
tags: agile, scrum, kanban, sprint, backlog, product owner, scrum master, standup, retrospective, review, wip limit, definition of done
---
# Agile, Scrum and Kanban for game teams

Agile in games means short feedback loops on something playable. The framework matters less than three habits: a single
ordered backlog, a regular point where the team looks at the build together, and an honest record of what is actually done.

## Scrum roles adapted to a game studio

Scrum defines three accountabilities. In a Pixel Studio project they map as follows:
- **Product Owner** — owns the backlog order and accepts work. In games this is usually the Director or lead Game
  Designer, because "value" means player experience, not feature count.
- **Scrum Master / facilitator** — protects the process, removes blockers, runs events. This is the Producer's role.
  The Producer does not assign creative direction and does not accept features.
- **Developers** — every discipline that builds the game: design, art, programming, QA. Game Scrum teams are
  cross-functional; a story is not done when code merges if art, tuning and testing are still missing.

Pitfall: making the Producer the de facto Product Owner. The Producer can propose order based on risk and dependencies,
but the creative owner decides what matters most.

## Scrum events and what they produce

Each Scrum event in a game project should leave a written trace in `docs/production/`:
- **Sprint planning** — sprint goal plus committed backlog items with estimates (see [K:production.sprint-planning]).
- **Daily standup** — blockers and handoffs; for agents, a short status note per role is the equivalent.
- **Sprint review** — the team plays the build or reviews the deliverables. Record what was demonstrated, by whom,
  and what was only described. "Described" is not "done".
- **Retrospective** — two or three concrete process changes with an owner, checked at the next retro.
- **Backlog refinement** — splitting epics into stories small enough to finish in one sprint, adding acceptance
  criteria (see [K:qa.acceptance-criteria]).

## Scrum artifacts and the definition of done

The three Scrum artifacts are the **product backlog** (everything wanted, ordered), the **sprint backlog** (this sprint's
commitment plus the plan), and the **increment** (the sum of finished work). A game definition of done typically includes:

- [ ] Implemented in the build, not only in a design doc
- [ ] Placeholder or final assets present and named per convention
- [ ] Acceptance criteria verified by QA, with the test status recorded honestly (executed / not executed)
- [ ] No open bugs of severity S1/S2 against the item
- [ ] Docs updated (GDD section, README, changelog where relevant)

Write the definition of done into the project once and reference it from every sprint plan.

## Kanban for game production

Kanban visualises work as a board (e.g. Backlog → Ready → In progress → Review → QA → Done) and limits work in progress
(WIP) per column. Key metrics:
- **Lead time** = date done − date requested.
- **Cycle time** = date done − date work started.
- **Throughput** = items finished per week.
- **Little's Law**: average WIP = throughput × average cycle time. If throughput is 5 items/week and you want a 1-week
  cycle time, a WIP limit near 5 is consistent; a board with 15 items "in progress" will show cycle times near 3 weeks.

A common heuristic is a WIP limit of roughly one to two items per person per column. When a column is full, people swarm
to finish rather than start new work.

## Choosing Scrum, Kanban or a hybrid

Scrum fits when the team is building new features toward a demo, priorities can be frozen for 1–3 weeks, and a fixed
cadence of review helps. Kanban fits when work arrives unpredictably: live-ops, bug fixing in beta, art asset pipelines,
porting. Many studios run **Scrumban**: sprint cadence for planning and review, Kanban board and WIP limits inside the
sprint. Pre-production prototyping often benefits from very short timeboxes (a few days) because most prototypes are
meant to be thrown away.

| Situation | Recommended |
|---|---|
| Building a vertical slice | Scrum, 1–2 week sprints |
| Asset production at volume | Kanban with WIP limits |
| Bug fixing toward release candidate | Kanban, daily triage |
| Mixed feature + content work | Scrumban |

## Common failure patterns

- Sprints with no goal, only a task list: nobody can decide what to cut.
- Velocity used to compare people or teams; it is only a planning signal for one team.
- "Done" meaning "handed to QA"; this hides the real backlog in the QA column.
- Skipping reviews because "nothing is playable yet" — that is the clearest signal of a problem.
- Agent-specific: reporting tasks complete without the file existing. The Producer should check the file paths listed
  in the task output before marking items done.
