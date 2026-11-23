---
id: balance-game-economy
role: designer
title: Balance a game economy
summary: Model faucets, sinks and currencies per unit of play, tune prices and rewards against target time-to-afford, and document results as estimates in design/table-economy.md.
triggers: economy, balance economy, currency, sinks, faucets, prices, rewards, shop, inflation, monetization
packs: design-craft, studio-core
version: 1.0.0
disciplines: economy, progression
genres: any
engines: any
engine_dependent: false
---
## Purpose

Make the game's currencies stay meaningful from start to finish: players can afford something worthwhile at a steady
rhythm, nothing inflates into irrelevance, and no single purchase dominates. Any monetization must meet the studio's
ethical guidance. The agent cannot run simulations, so the model is a transparent table with formulas whose outcomes
are labelled as estimates.

## Required inputs

- `docs/GDD.md`: core loop, progression, items and upgrades, monetization stance.
- `docs/BRIEF.md`: business model (premium, ads, IAP), audience (note any minors), platform.
- Existing `design/table-*.md` files (progression, enemies, items) whose values feed income or prices.
- Task statement and acceptance criteria.
- Retrieved knowledge: `design.economy-and-monetization`, `design.progression-and-balancing`.

## Workflow

1. Read GDD, brief and tables. List every currency and resource. Number acceptance criteria `AC-1…n`.
2. For each currency, list all faucets and sinks with their trigger and amount. Flag any currency lacking a
   meaningful sink or faucet; propose merging or removing extra currencies.
3. Choose the unit of play (per level, per run, per hour) and state assumed player behaviour (e.g. "collects 80% of
   drops, buys one consumable per level").
4. Write formulas for income and prices, e.g. `I(n) = a + b·n`, `C(t) = c₀ × m^(t−1)`. Pick parameters from target
   time-to-afford (a common heuristic is a meaningful purchase every 1–3 levels or sessions).
5. Build a cumulative table across the game: income, spend, net, wallet balance, and the point at which each key item
   becomes affordable. Show arithmetic so reviewers can check it.
6. Run paper checks: inflation (wallet growth late game), starvation (long negative stretches), dominant purchase
   (value per coin across options), top and bottom player income (e.g. ±50% of average), and a ±20% price
   sensitivity check.
7. Adjust parameters and add or strengthen sinks (scaling upgrades, consumables, rerolls, cosmetics) until checks pass
   on paper.
8. If monetization is in scope, review it against the ethical guidance: transparent prices, no pay-to-win in
   competition, no dark patterns, randomized paid items avoided or disclosed with odds, rewarded ads opt-in. Record
   any requirement you could not satisfy as an open question for the Director.
9. Write `design/table-economy.md` (parameters, formulas, cumulative table, check results) and update the GDD economy
   section with summary, link, version bump and changelog.
10. Close with AC coverage, Assumptions, Open questions and References citing `[K:<doc-id>]`.

## Expected output

- `design/table-economy.md`: currency list, faucet and sink inventory, formulas with parameters, cumulative
  per-unit-of-play table, checks (inflation, starvation, dominance, player-range, sensitivity) with results labelled
  "estimate", ethical monetization review if applicable, AC coverage, Assumptions, Open questions, References.
- Updated `docs/GDD.md` economy section with version bump and changelog.

## Quality checklist

- [ ] Every currency has at least one meaningful faucet and one meaningful sink.
- [ ] Assumed player behaviour is explicit.
- [ ] Prices and income are formulas, and the cumulative table is arithmetically consistent.
- [ ] Time-to-afford for key purchases is stated and fits the target rhythm.
- [ ] Inflation, starvation, dominance, player-range and sensitivity checks are documented.
- [ ] Monetization (if any) passes the ethical guidance or the gaps are escalated.
- [ ] All outcomes are labelled "estimate"; nothing claims to be playtested or simulated.
- [ ] Values are stated once and linked from the GDD.

## Failure conditions

- No defined items, upgrades or loop to spend on: report that the economy needs the GDD content first.
- Business model is unspecified and affects design (ads vs IAP vs premium): ask as `Q-n`; default to premium with no
  real-money economy and say so.
- The brief or task requires a monetization pattern that conflicts with the ethical guidance (dark patterns,
  undisclosed paid randomness, spending pressure aimed at minors): do not design it; escalate to the Director.
- Input tables disagree with each other (e.g. enemy rewards differ between GDD and table): report the conflict instead
  of picking one silently.
