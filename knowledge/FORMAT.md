# Pixel Studio knowledge format

Everything under `knowledge/` is **trusted, studio-authored** content, reviewed in git. External material (official docs,
GitHub repos, PDFs) is never stored here; owners register it at runtime and it is always treated as untrusted reference data.

## Layout

```
knowledge/
  packs/<pack-id>/pack.json     pack manifest (see below)
  packs/<pack-id>/<doc>.md      knowledge documents
  skills/<role>/<skill-id>.md   reusable skills (role = designer | artist | programmer | producer | qa | director)
```

## pack.json

```json
{
  "id": "design-craft",
  "title": "Game design craft",
  "layer": "role",                 // studio | role | tool
  "description": "One sentence.",
  "defaultDepartments": ["designer", "director"],
  "tools": [],                     // tool packs only, e.g. ["unity"]; retrieval loads them only for tasks that target that tool
  "version": "1.0",
  "license": "Pixel Studio internal",
  "trust": "internal"
}
```

## Knowledge document

```markdown
---
id: design.core-loops
title: Core gameplay loops
tags: core loop, moment-to-moment, session loop, meta loop, compulsion loop
---
# Core gameplay loops

Body in Markdown. Use `##` sections — retrieval splits documents at `##` headings, so each section must make sense on
its own (repeat the subject in the first sentence of a section instead of "this" / "it").

## Further reading
- Only real, stable official URLs you are certain exist (e.g. https://docs.unity3d.com/Manual/index.html).
```

Rules for documents:
- Practical and specific: checklists, numbers, formulas, templates, pitfalls, worked examples. No filler, no marketing.
- 450–900 words per document, 4–8 `##` sections.
- Tool documents state the version they assume (e.g. "Unity 6 / 2022 LTS", "Unreal Engine 5.4", "Phaser 3.90"),
  and say plainly that they are an internal summary, not official documentation.
- Never invent APIs, numbers presented as industry facts, quotes or citations. Prefer "a common heuristic is…".

## Skill

```markdown
---
id: create-gdd
role: designer
title: Create a game design document
summary: One sentence the Director sees when choosing a skill.
triggers: gdd, game design document, design doc, concept document
packs: design-craft, studio-core
---
## Purpose
## Required inputs
## Workflow
1. Numbered, concrete steps, naming the files to read and write.
## Expected output
## Quality checklist
- [ ] Checkable items
## Failure conditions
- When to stop and report instead of guessing (missing inputs, conflicting requirements, …).
```

All six `##` sections are mandatory and validated at load time. A skill must stay within its role's write permissions
(designer: docs/, design/ · artist: assets/, docs/art/ · programmer: src/, public/, tests/, index.html, package.json,
README.md · producer: docs/production/ · qa: qa/, tests/ · director: docs/ and studio tools). Agents have **no shell**,
so skills must not require running commands; QA/programmer skills must say how to report tests that could not be run.
Skills should tell the agent to cite knowledge sources it relied on (`[K:<doc-or-source id>]`) in a References section.
