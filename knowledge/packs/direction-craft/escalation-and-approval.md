---
id: direction.escalation-and-approval
title: Escalation and owner approval
tags: escalation, approval, request_approval, owner, decision, options, trade-off, scope change, stakeholder
---
# Escalation and owner approval

Escalation is how the Director brings a decision to the human owner using `request_approval`. Escalating too little
means the studio makes choices the owner should have made; escalating too much wastes the owner's attention and slows
the project.

## What needs the owner's decision

The owner should decide anything that changes what they asked for or what they will receive. Escalate when a choice:

- changes **scope** — adding or cutting features, levels, platforms;
- changes the **vision or pillars**, or the genre, tone or target audience;
- changes **milestones or delivery dates** the owner approved, including adding milestones with `add_milestone`
  that alter the plan they saw;
- involves a **trade-off with no clear answer from the pillars** (e.g. pixel art vs. vector for a mobile release);
- requires an **external commitment** — third-party content, licences, publishing, anything outside the workspace;
- concerns **ambiguity in the original request** that would materially change the plan;
- follows a **failed internal resolution** — revision limits exhausted.

## What the Director decides alone

The Director should not escalate routine execution. Decide internally:

- task breakdown, sequencing, specialist and skill choices;
- approve/revise outcomes against acceptance criteria;
- interpretation of a pillar when one option clearly serves it better;
- naming, file layout, conventions within studio standards;
- small tuning or style choices inside the approved vision.

A heuristic: if the owner would be surprised to discover the decision later, escalate; if they would be surprised
to be asked, decide.

## Presenting options

A good approval request lets the owner decide in under two minutes. Structure:

```
Decision needed: [one sentence]
Context: [2–3 sentences; what happened, why it matters now]
Options:
  A. [option] — Pros / Cons / Impact on scope, schedule, quality
  B. [option] — Pros / Cons / Impact
  C. [option, if genuinely distinct]
Recommendation: [A/B/C] because [pillar or constraint]
If no answer: [what the studio will do meanwhile; what is blocked]
```

Rules: 2 to 3 genuine options (not one real option and two strawmen); state impact in concrete terms (tasks added,
milestones moved, features cut); always give a recommendation; keep jargon out.

## Worked example: an art-style trade-off

Situation: the owner asked for "detailed hand-painted art", but the Concept Artist can only hand-author SVG (pixel or
vector); no raster painting tool exists.

- Decision needed: which achievable style replaces hand-painted art.
- Option A: 32 px pixel art with rich ramps — closest to "detailed"; more pixels per asset, fewer enemy types in
  budget.
- Option B: flat vector illustration with layered shading shapes — scales cleanly to any resolution; less "painted"
  texture.
- Option C: keep hand-painted as a goal and have the owner supply painted assets; the studio integrates them.
- Recommendation: A, because the "readable on small screens" pillar favours pixel art at integer scale.
- Meanwhile: design and code proceed with placeholder rectangles.

## Timing and batching escalations

Escalate as early as the need is known; late escalations force rework. Batch non-urgent questions into one request
at a natural checkpoint (e.g. end of pre-production) rather than sending many small requests. Never block all work on
an approval: identify what can continue and what is genuinely blocked, and keep the unblocked tasks moving.

## Recording owner decisions

When the owner answers, record the decision in the decision log with date, choice and rationale, update the owning
documents, and reference the decision in affected tasks. An owner decision that is not written down will be
relitigated by agents who never saw it.

## Escalation pitfalls

- Asking open questions ("What do you want?") instead of presenting options.
- Escalating to avoid making a routine call.
- Hiding a known problem until a milestone review.
- Presenting a recommendation without its costs.
