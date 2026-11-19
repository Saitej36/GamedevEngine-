---
id: plan-project
role: director
title: Plan a project from an owner request
summary: Turn the owner's request into a vision, milestones and a dependency-ordered set of self-contained tasks with the right specialist, skill and checkable acceptance criteria.
triggers: plan project, project plan, new game, kickoff, breakdown, roadmap, task breakdown, owner request, milestones, delegate
packs: direction-craft, studio-core
---
## Purpose
Convert an owner request into an executable plan: a written vision, milestones, and tasks created with `create_task`
that specialists can complete without further context, sequenced with `depends_on` so nothing starts before its
inputs exist.

## Required inputs
- The owner's request (genre, platform, scope, style, deadline hints).
- Current workspace state: Glob `docs/**/*`, `assets/**/*`, `src/**/*` to see whether this is a new project or a
  continuation.
- Existing vision, GDD, art bible, roadmap and decision log if present.

## Workflow
1. Read the request and the workspace. List explicit requirements, implied requirements and open ambiguities.
2. If an ambiguity would materially change the plan (platform, genre, art style, scope), use `request_approval` with
   2–3 options and a recommendation before creating dependent tasks ([K:direction.escalation-and-approval]).
   Continue with tasks the ambiguity does not affect.
3. Write `docs/vision.md`: vision statement, 3–5 pillars that can reject ideas, target platform, scope limits
   ([K:direction.creative-direction]).
4. Create `docs/decisions.md` with a consistency map (which document owns which facts) and initial decisions
   ([K:direction.project-consistency]).
5. Define milestones with `add_milestone`, e.g. Pre-production (vision, GDD, art bible), Vertical slice (one playable
   level with final-style art), Content complete, Polish. Scale to the request; a small prototype may need two.
6. Break each milestone into tasks. For each, pick the role whose writable folders cover the deliverable and the most
   specific skill (e.g. designer GDD skill; artist `create-art-bible`, `design-character`, `design-environment`,
   `prepare-game-assets`) ([K:direction.delegation]).
7. Write every task self-contained: goal, context files to read, exact deliverable paths, 3–7 acceptance criteria
   checkable by reading files, constraints, out of scope. Never require agents to run code; programmer and QA
   criteria must ask them to state which tests were written but not run.
8. Set `depends_on`: GDD before art bible and code; art bible before characters and tiles; code may use placeholder
   rectangles in parallel; add an explicit integration task depending on both streams; QA after the work it tests
   ([K:direction.cross-department-coordination]).
9. Check for two tasks writing the same file in parallel; sequence them.
10. Write `docs/roadmap.md` (or ask the Producer for `docs/production/roadmap.md`) listing milestones, tasks,
    owners, dependencies, with a References section citing `[K:...]` sources used.

## Expected output
- `docs/vision.md`, `docs/decisions.md`, and a roadmap document.
- Milestones created with `add_milestone`.
- Tasks created with `create_task`, each with role, skill, deliverable paths, acceptance criteria and `depends_on`.
- Any `request_approval` calls needed for material ambiguities.
- A short plan summary for the owner: milestones, first tasks, open decisions.

## Quality checklist
- [ ] Every pillar could reject a concrete proposal.
- [ ] Every task names exact file paths inside the assigned role's writable folders.
- [ ] Every acceptance criterion is verifiable by reading files.
- [ ] No task asks the artist to generate raster images or any agent to run code.
- [ ] Dependencies form no cycles; no task reads an output that is not yet a dependency.
- [ ] An integration task and a QA task exist for each playable milestone.
- [ ] Scope fits the request; extras are noted as optional, not planned.

## Failure conditions
- The request is too vague to choose genre or core loop: ask the owner with `request_approval` presenting options,
  rather than inventing the game.
- The request requires capabilities the studio lacks (raster painting, audio recording, running builds, publishing):
  tell the owner and propose achievable alternatives.
- Existing project documents conflict with the new request: escalate the conflict instead of silently overwriting.
