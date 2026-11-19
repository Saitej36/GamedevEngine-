---
id: design.gdd-frameworks
title: GDD frameworks
tags: gdd, game design document, one-page design, design pillars, MDA, scope, living document, feature spec
---
# GDD frameworks

A game design document (GDD) is the single design source of truth for a project. At Pixel Studio it lives at
`docs/GDD.md`, is owned by the Designer, and is read by every other role. A good GDD is a decision record that
programmers, artists and QA can build and test from, not a pitch.

## Choosing a GDD format

Pick the lightest GDD format that lets each role work without asking the Designer questions:

| Format | When to use | Typical size (heuristic) |
|---|---|---|
| One-page design | Jam games, prototypes, very small scope | 1 page, ~400–800 words |
| Lean GDD | Small single-player games, most Pixel Studio projects | 2,000–5,000 words in `docs/GDD.md` |
| Modular GDD | Larger scope or many systems | Short `docs/GDD.md` hub linking specs in `design/` |

The lean GDD is the default. Move detail into `design/` specs (levels, balance tables, system specs) once any single
section exceeds roughly a screen or two, and link it from the GDD.

## Lean GDD template

```markdown
# <Game title> — GDD
Status / Version / Changelog
1. Overview: one-sentence pitch, genre, platform, target session length, target player
2. Design pillars (3, each with "we do / we don't")
3. Core loop: moment-to-moment, session, meta (diagram + timings)
4. Mechanics: player verbs, controls, rules, numbers
5. Systems: progression, economy, difficulty
6. Content: levels/encounters list, enemies, items
7. UX & feedback: HUD, menus, juice, onboarding
8. Art & audio direction hooks (what design needs from art)
9. Scope: MVP vs later, cut list
10. Acceptance criteria coverage, Assumptions, Open questions, References
```

## Design pillars

Design pillars are three short statements that every feature must serve; they settle arguments and drive cuts.
Write each pillar with a positive and negative form:

- "Readable chaos: many enemies, but the player can always see the threat. We don't use screen-filling effects that
  hide hitboxes."
- "One more run: runs last 5–10 minutes. We don't add mid-run saves or long cutscenes."

Test each proposed feature: which pillar does it serve? A feature serving none goes on the cut list.

## Framing tools: MDA and player verbs

The MDA framework (Mechanics, Dynamics, Aesthetics; Hunicke, LeBlanc and Zubek) is useful for structuring the GDD's
reasoning. Designers author mechanics (rules), which produce dynamics (runtime behaviour), which players experience
as aesthetics (feelings such as challenge, discovery, expression). Work backwards: pick the target aesthetic, choose
dynamics that produce it, then specify mechanics.

Player verbs anchor the mechanics section of a GDD. List the verbs (jump, dash, place, merge, aim) and for each give
input, rules, numeric parameters and interactions. If a verb has no numbers, programmers will invent them.

## Writing specifiable rules

A GDD rule is buildable when a programmer can implement it and QA can test it without guessing. Compare:

- Vague: "The dash is fast and lets you avoid enemies."
- Specifiable: "Dash: Shift. Moves 96 px over 0.15 s in facing direction; player is invulnerable for the duration;
  cooldown 0.8 s, shown as a HUD ring. Cannot dash while stunned. Dash through enemies, not walls."

Every number is a starting value; mark tuning values as such ("tunable, start 0.8 s") and collect them in a tuning
table in `design/` so they can be changed in one place.

## Scope section and MVP

The GDD scope section protects the schedule. Split every feature into MVP, Nice-to-have and Cut, with a one-line
reason. A common heuristic for small projects is that the MVP should be describable as one core loop plus one
progression layer; anything beyond that needs explicit justification against the brief. Align the MVP list with the
Producer's plan in `docs/production/` and flag mismatches as open questions.

## GDD pitfalls

- Lore before loop: pages of story with an unspecified core loop.
- Adjectives instead of numbers ("fast", "challenging", "rewarding").
- Contradicting the brief's platform, controls or session length without an explicit, justified assumption.
- Duplicate truth: values repeated in several places that drift apart. State a value once and reference it.
- No changelog, so other roles cannot tell what changed since they last read it.
