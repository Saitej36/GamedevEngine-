---
id: studio.studio-standards
title: Studio standards and workspace conventions
tags: workspace, file ownership, folders, naming, versioning, changelog, definition of done, conventions
---
# Studio standards and workspace conventions

Every Pixel Studio project lives in one workspace shared by six roles. Agents have no shell: they can only Read, Glob,
Grep, Write and Edit inside the folders their role owns. These standards keep the workspace predictable so any agent
can find the latest truth without asking.

## Workspace layout and file ownership

The Pixel Studio workspace layout is fixed. Write only inside the folders your role owns; read anything.

| Path | Owner | Contents |
|---|---|---|
| `docs/BRIEF.md` | Owner (read-only for agents) | The owner's brief: goals, constraints, platform, scope |
| `docs/GDD.md` | Designer | Game design document, the single design source of truth |
| `design/` | Designer | Level layouts, balance tables, loop diagrams, system specs |
| `assets/`, `docs/art/` | Concept Artist | Image/audio assets; style guide, asset lists, art specs |
| `src/`, `tests/`, `index.html`, `package.json`, `README.md` | Programmer | Game code, unit tests, entry page, run instructions |
| `docs/production/` | Producer | Plans, milestones, risk register, status reports |
| `qa/` | QA Tester | Test plans, test cases, bug reports, verification reports |
| `docs/` (other files) | Director | Direction notes, reviews, decisions |

Rules for file ownership:
- Never edit another role's file to "fix" it. Write the issue into your own deliverable or a review and name the owner.
- If a task needs a file outside your folders, stop and report the dependency instead of writing it elsewhere.
- `docs/BRIEF.md` is never edited by agents. If the brief is ambiguous, record the question in your deliverable.

## Naming conventions

Consistent workspace names let Glob and Grep find things. Heuristics the studio uses:
- Lowercase kebab-case for files and folders: `design/level-01-tutorial.md`, `assets/sprites/player-idle.png`.
- Zero-pad sequence numbers to two digits (`level-01`, `level-10`) so sorting stays correct.
- Prefix by type where a folder mixes types: `spec-`, `table-`, `report-`, `plan-`, `bug-`.
- Bug and test IDs are stable and never reused: `BUG-0007`, `TC-012`. Acceptance criteria use `AC-1`, `AC-2`.
- Asset names describe the thing, not the version: `enemy-slime-walk.png`, not `slime-final-v3.png`.
- Use the same identifiers in every role's files. If the GDD calls it "Dash", code, art and tests say `dash` too.

## Versioning documents

Agents have no git access, so document versioning is done inside the file. Every living document (GDD, specs, plans,
style guides) starts with a short header block and ends or begins with a changelog:

```markdown
Status: Draft | In review | Approved | Superseded
Version: 0.3
Last updated by: designer (task: tune economy)
## Changelog
- 0.3 — Raised wave-5 enemy HP 20%; see design/table-enemies.md.
- 0.2 — Added dash mechanic (AC-4).
```

Rules: bump the minor version for any content change, bump to 1.0 when the Director approves, and never delete
history lines. When a document is replaced, mark the old one `Status: Superseded by <path>` rather than deleting it,
so earlier citations still resolve. Edit in place with Edit for small changes; rewrite with Write only when
restructuring, and say so in the changelog.

## Definition of done for any deliverable

A deliverable in a Pixel Studio workspace is done only when all of the following hold:
- [ ] Every file the task asked for exists at the stated path, inside the author's own folders.
- [ ] Each acceptance criterion in the task is addressed and traceable (see `studio.deliverable-standards`).
- [ ] Inputs that were read are listed; assumptions and open questions are stated explicitly.
- [ ] Nothing is claimed as tested, run or measured unless it actually was; otherwise it is labelled "not executed".
- [ ] Names match the GDD vocabulary and the naming conventions above.
- [ ] Living documents carry a status, version and changelog entry.
- [ ] A final "References" section cites knowledge used as `[K:<doc-id>]`, or states "None".
- [ ] No placeholder text remains (`TODO`, `TBD`, lorem ipsum) unless listed as an open question.

## Common pitfalls

- Writing outside your folder because it "seemed faster". The write is rejected or, worse, overwrites another role.
- Creating `GDD-v2.md` next to `GDD.md`. Two sources of truth guarantee drift; version inside the file instead.
- Silent renames. Renaming a mechanic, file or ID without a changelog line breaks every downstream reference.
- Huge single files. A heuristic: split any document above roughly 1,500 lines or with more than ten unrelated
  topics into linked files under the owner's folder, and link them from the parent document.
