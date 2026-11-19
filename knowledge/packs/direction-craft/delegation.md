---
id: direction.delegation
title: Delegation and task writing
tags: delegation, create_task, task writing, acceptance criteria, dependencies, depends_on, specialist, skill selection, brief
---
# Delegation and task writing

Delegation in Pixel Studio means turning intent into tasks a specialist agent can complete without asking questions.
The agent receiving a task sees only the task, its skill, retrieved knowledge and the files in the workspace — not the
Director's conversation with the owner. Every task must therefore be self-contained.

## Anatomy of a self-contained task

A self-contained task created with `create_task` should contain:

- **Goal** — one sentence: what changes in the project when this is done.
- **Context** — the relevant pillars or decisions, with file paths to read (`docs/gdd.md`, `docs/art/art-bible.md`).
- **Deliverables** — exact files to create or edit, with paths.
- **Acceptance criteria** — 3 to 7 checkable statements.
- **Constraints** — scope limits, things not to touch, size or palette limits.
- **Out of scope** — what the specialist should not attempt.
- **Dependencies** — `depends_on` the tasks whose outputs are inputs here.

If the specialist would need to ask "which file?" or "how big?", the task is not finished.

## Writing acceptance criteria

Acceptance criteria are what the Director will check during review, so they must be verifiable by reading files.
Agents cannot run the game, so criteria must not depend on playing it unless a human will test.

| Weak | Strong |
|---|---|
| "Player sprite looks good" | "`assets/characters/player.svg` exists; 16×24 cells; idle 4 frames and walk 6 frames; all fills in `assets/palette.json`" |
| "Write the GDD" | "`docs/gdd.md` has sections Vision, Core loop, Controls, Levels, Win/Lose; each mechanic lists tunable values" |
| "Implement movement" | "`src/player.js` exports update(dt, input); speed and jump values read from a config object; tests in `tests/player.test.js` cover jump and gravity; README says how to run tests" |

A useful pattern is one criterion for existence and location, one for structure, one or two for content quality,
and one for consistency with a source-of-truth document.

## Choosing the specialist and skill

Match the task to the role whose write permissions cover the deliverable:

- **Game Designer** — `docs/`, `design/`: GDD, mechanics, levels, balance tables.
- **Concept Artist** — `assets/`, `docs/art/`: art bible, palette, SVG sprites and tiles, asset manifest.
- **Game Programmer** — `src/`, `public/`, `tests/`, `index.html`, `package.json`, `README.md`.
- **Producer** — `docs/production/`: schedules, risk registers, milestone plans.
- **QA Tester** — `qa/`, `tests/`: test plans, bug reports, test code (cannot execute it).

Then attach the most specific skill whose triggers fit (e.g. `create-art-bible` before `design-character`). If no
skill fits, write extra workflow guidance in the task itself.

## Dependencies and sequencing

Use `depends_on` whenever one task reads another's output. A typical early chain:

1. Designer: GDD core (vision, loop, controls).
2. Artist: art bible and palette — depends on 1.
3. Artist: player and tiles — depends on 2.
4. Programmer: core movement with placeholder rects — depends on 1 (can run parallel to 2–3).
5. Programmer: integrate sprites — depends on 3 and 4.
6. QA: test plan and logic tests — depends on 1, then 5.

Avoid false dependencies: if a programmer can use placeholder art, do not block code on art. Avoid hidden
dependencies: if two tasks both edit `docs/gdd.md`, sequence them.

## Right-sizing tasks

A heuristic is that a task should produce one coherent deliverable that can be reviewed in a single pass — a
document, an asset family, a module with its tests. Split when acceptance criteria exceed about seven, or when parts
have different owners. Merge when tasks are so small that the review overhead exceeds the work.

## Delegation pitfalls

- "See previous discussion" — the specialist cannot see it.
- Criteria that require running code or playing the game with no human tester.
- Asking the artist to "generate" images; the artist hand-authors SVG files.
- Assigning a deliverable outside the role's writable folders.
- Forgetting to cite the knowledge the task depends on, so the specialist misses it.
