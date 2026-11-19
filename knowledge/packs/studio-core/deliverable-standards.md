---
id: studio.deliverable-standards
title: Deliverable standards
tags: deliverable structure, acceptance criteria, traceability, assumptions, open questions, references, citations, not executed, estimate
---
# Deliverable standards

A Pixel Studio deliverable is any file an agent writes to complete a task. Reviewers and downstream roles read
deliverables cold, so each one must explain what it is, what it answers, what it assumed and what it relied on.

## Standard deliverable structure

Use this skeleton for documents (specs, plans, reports, reviews). Adapt section names, keep the order:

```markdown
# <Title>
Status: Draft · Version: 0.1 · Author role: <role> · Task: <one-line task summary>

## Summary            3–5 sentences: what this is and the key decisions.
## Inputs             Files read, e.g. docs/BRIEF.md, docs/GDD.md §3.
## <Body sections>    The actual content.
## Acceptance criteria coverage   Traceability table (below).
## Assumptions
## Open questions
## References         [K:...] citations.
```

Code deliverables put the same information in `README.md` or a header comment block: purpose, inputs, assumptions,
how acceptance criteria are covered, and what was not executed. Asset deliverables put it in a manifest under
`docs/art/`.

## Acceptance-criteria traceability

Every task's acceptance criteria must be traceable to evidence in the deliverable. Number criteria `AC-1`, `AC-2`…
in the order the task gives them; if the task gives none, derive them from the brief and say so. Add a table:

| AC | Criterion | Where addressed | Status |
|---|---|---|---|
| AC-1 | Core loop fits in 30–90 s | GDD §2.1 | Met |
| AC-2 | Three enemy types | design/table-enemies.md | Met |
| AC-3 | Runs at 60 fps on mid-range laptop | src/game.js | Not verified (not executed) |
| AC-4 | Leaderboard | — | Not met: out of scope per brief, see Open questions |

Allowed statuses: Met, Partially met, Not met, Not verified. "Met" requires a pointer to a concrete file and section.
Never mark an item Met because you intend to do it later.

## Assumptions and open questions

Deliverable assumptions are decisions you made without confirmation; open questions are decisions you could not make.
Write each so another person can act on it:

- Assumption format: `A-1: Target is desktop browser with keyboard, because the brief mentions "web" and no touch.
  Impact if wrong: input section and HUD layout need a touch pass.`
- Open question format: `Q-1 (for Director): Is a meta-progression layer in scope for the MVP? Blocks: §5 Progression.
  Default if unanswered: no meta layer.`

A heuristic: more than five assumptions on a small task usually means inputs were missing and the task should have
been reported back rather than completed on guesses (see the failure conditions in the relevant skill).

## Labelling unverified claims

Pixel Studio agents cannot run code, play the game, open images or measure anything. Every claim must therefore be
labelled by how it is known:

- **Verified by reading**: you read the file and the content is there ("src/player.js defines `dash()`").
- **not executed**: behaviour that depends on running code or tests. Write tests, but report them as
  "written, not executed".
- **estimate**: numbers you computed or guessed, such as playtime, difficulty curves, task durations. Show the formula
  or reasoning: "estimate: 12 levels × ~4 min ≈ 48 min first playthrough".
- **assumption**: references to A-n entries.

Never write "tested", "works", "balanced" or "performs well" without one of these labels. Unlabelled certainty is the
most common reason reviewers send work back.

## References and the [K:...] citation convention

Every deliverable ends with a `## References` section. Cite knowledge the work actually relied on, using the doc or
source id exactly as given in your retrieved context:

```markdown
## References
- [K:design.core-loops] Used the three-layer loop template for §2.
- [K:studio.deliverable-standards] Deliverable structure and AC table.
```

Rules: cite inline too where a specific decision follows a source (`... 30–90 s loop target [K:design.core-loops]`).
Cite only ids that appeared in your context; never fabricate an id or cite a document you did not read. Workspace
files are referenced by path, not with `[K:...]`. If no knowledge was used, write `None.`

## Pitfalls

- Burying the decision. The Summary must state the key decisions, not the process.
- Restating the brief at length instead of linking to `docs/BRIEF.md`.
- A traceability table that lists criteria without file pointers.
- Citing a reference for a claim it does not make, which is treated as an invented citation.
