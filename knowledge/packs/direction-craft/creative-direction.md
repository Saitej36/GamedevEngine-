---
id: direction.creative-direction
title: Creative direction
tags: creative direction, vision, pillars, design pillars, vision statement, alignment, decision making, director
---
# Creative direction

Creative direction is the work of holding one coherent vision for the game and making sure every department's
decisions serve it. The Director does not need to make every decision, but must make every decision traceable to the
vision.

## The vision statement

A vision statement is one to three sentences that say what the player does, how it should feel and what makes the
game distinct. A useful template:

> *[Game] is a [genre] where the player [core verb/activity] to [goal], feeling [emotion], unlike [reference] because
> [differentiator].*

Example: "Lanternfall is a short side-scrolling platformer where the player carries a fading lantern through a dark
forest to reach dawn, feeling tense but hopeful, unlike typical precision platformers because light is both health and
the only way to see."

Write the vision into a document every agent reads (e.g. `docs/vision.md`) and refer to it in task descriptions.
A vision that lives only in the owner's original request will be lost by the third task.

## Pillars that can reject ideas

Pillars are 3 to 5 short statements that operationalise the vision. A pillar is good if it can say "no" to a
feature, an asset or a scope request. Test each pillar against a real proposal:

| Weak pillar | Strong pillar |
|---|---|
| "Fun combat" | "Every enemy is defeated with the lantern, never a weapon" |
| "Beautiful art" | "Darkness is the default; light is the most readable element on screen" |
| "Accessible" | "A full run fits in 10 minutes and needs only arrows plus one button" |

Keep separate design pillars and art pillars if useful, but each must trace back to the vision.

## Keeping decisions aligned

Alignment is maintained through a lightweight decision loop:

1. **Frame the decision** — what is being decided, by whom, by when.
2. **Check against pillars** — which pillar does each option serve or violate?
3. **Decide and record** — write a one-line entry in a decision log (e.g. `docs/decisions.md`): date, decision,
   reason, pillar, owner.
4. **Propagate** — update the source-of-truth document (GDD, art bible, roadmap) and mention the decision in
   affected tasks.

A decision that is not recorded will be re-made differently by the next agent.

## Making creative calls under constraints

Creative direction in a small studio is mostly about saying no. Heuristics for constrained projects:

- **Protect the core loop first.** If time is short, cut breadth (levels, enemy types) before cutting the feel of the
  core verb.
- **One hero feature.** A small game usually supports one distinctive idea done well, not three done partially.
- **Prefer readable over impressive.** Art and audio that clarify gameplay beat spectacle that obscures it.
- **Prototype before polishing.** Validate that the core verb is fun with greybox or placeholder art before a full
  art pass.
- **Scope to the workforce.** Agents cannot run code or play the game; build-and-verify tasks need explicit
  acceptance criteria that can be checked by reading files.

## Signals that the vision is drifting

Watch for these drift signals during reviews:

- Deliverables justify themselves by "industry standard" rather than by a pillar.
- The GDD describes mechanics the art bible has no assets for, or vice versa.
- New features keep appearing in tasks that were not in the roadmap.
- Two departments use different names for the same thing.
- The owner's latest feedback contradicts a pillar and nobody flagged it.

When drift appears, stop and reconcile: either the vision changes (record it, and seek owner approval if it changes
what was promised) or the deliverable changes.

## Creative direction pitfalls

- Pillars so broad that everything fits them.
- A vision that changes silently with each review.
- The Director personally redoing specialist work instead of giving direction.
- Treating the owner's first request as a full spec rather than a starting brief that needs clarifying questions.
