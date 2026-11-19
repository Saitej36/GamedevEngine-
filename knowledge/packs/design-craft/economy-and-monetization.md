---
id: design.economy-and-monetization
title: Economy and monetization
tags: economy, currency, sinks, faucets, inflation, monetization, ethical monetization, loot boxes, premium, ads
---
# Economy and monetization

A game economy is the set of resources the player earns, holds, converts and spends. Monetization is how the game
earns money from players. Both shape player behaviour strongly, so Pixel Studio designs them explicitly, models them
on paper, and treats ethical limits as hard requirements.

## Economy building blocks

Describe a game economy with five element types:
- **Faucets**: sources that create resources (enemy drops, quest rewards, daily login, idle generation).
- **Sinks**: uses that destroy resources (purchases, upgrades, repairs, crafting inputs, fees).
- **Stocks**: what the player holds (wallet, inventory).
- **Converters**: turn one resource into another (crafting, trading, refining).
- **Traps / gates**: caps, timers or requirements that limit flow.

Keep currencies few. A heuristic for small games: one soft currency, optionally one rare currency, and no premium
currency unless the brief requires monetization. Every currency needs at least one meaningful faucet and one
meaningful sink.

## Sink/faucet modelling

Model a game economy per unit of play (per level, per run, or per hour) in a table in `design/table-economy.md`:

| Level | Income `I(n) = 30 + 10n` | Potion spend | Net | Wallet | Purchase |
|---|---|---|---|---|---|
| 1–3 | 40, 50, 60 | 25 each | +15, +25, +35 | 75 | — |
| 4 | 70 | 25 | +45 | 120 | Upgrade T1 (100) → 20 |
| 5–7 | 80, 90, 100 | 25 each | +55, +65, +75 | 215 | Upgrade T2 (180) → 35 |
| 8–11 | 110–140 | 25 each | +85 … +115 | 435 | Upgrade T3 (324) → 111 |

The table uses income `I(n) = 30 + 10n` and upgrade cost per tier `C(t) = 100 × 1.8^(t − 1)`, assuming one potion
bought per level. Upgrades land at levels 4, 7 and 11 (estimate), a steady gap of 3–4 levels; slightly slower than the
heuristic below, so a cheaper intermediate purchase may be worth adding. Then check:
- **Time-to-afford**: how many levels until the next meaningful purchase? A common heuristic is a meaningful purchase
  every 1–3 sessions or levels.
- **Inflation**: if wallet balances grow without bound, sinks are too weak and prices stop mattering.
- **Starvation**: if net is negative for long stretches, players feel stuck.
- **Dominant strategy**: if one sink gives far more value per coin, players will only use it.

All results are estimates until playtested; label them and state the assumed player behaviour (e.g. "collects 80% of
drops, buys one potion per level").

## Sink design patterns

Strong sinks keep currency meaningful:
- **Scaling upgrades** with rising costs (multiplier 1.3–2.0 per tier is a common range).
- **Consumables** that give tactical value (potions, bombs) and are repurchased.
- **Cosmetics and collections**: open-ended sinks without power creep.
- **Rerolls and refreshes**: pay to re-roll shop offers; cost rising per use within a run.
- **Run-reset currencies**: roguelites reset in-run gold each run, which removes long-term inflation.

## Ethical monetization guidance

Pixel Studio treats these as requirements whenever a design includes monetization:
- **Transparent pricing**: show real-money prices; avoid premium currency bundles priced so that leftovers push
  further purchases.
- **No pay-to-win in competitive modes**: paid items do not give advantage over other players.
- **Randomized paid items**: avoid them by default. If the brief requires them, disclose odds clearly, consider
  pity/guarantee systems, and check the applicable regional rules; flag this to the Director as an open question,
  since rules differ by region and change over time.
- **No dark patterns**: no fake urgency timers, no confirm-shaming copy, no hidden costs, no disguised ads, no
  punishing players for not paying (e.g. deliberately frustrating grind walls sold as skips).
- **Protect minors and vulnerable players**: no targeting spending at children; offer spending limits where the
  platform allows.
- **Ads**: rewarded ads must be opt-in with a clear reward; avoid interstitials during active play.
- **Fair value**: a paying player should feel they bought something specific and worthwhile.

## Monetization models at a glance

| Model | Fits | Design implication |
|---|---|---|
| Premium (pay once) | Most PC/console indie, Pixel Studio default | Economy tuned purely for fun |
| Free + cosmetics | Multiplayer, live games | Needs a large cosmetic sink and content pipeline |
| Free + rewarded ads | Mobile casual | Natural pause points to place opt-in ads |
| Free + IAP | Mobile mid-core | Highest risk of dark patterns; apply the guidance above |

## Economy pitfalls

- Currencies with no sink, which become meaningless within an hour.
- Too many currencies, confusing players and multiplying balance work.
- Tuning prices against average income while top players earn several times more.
- Designing monetization into the core loop before the loop is fun without it.
