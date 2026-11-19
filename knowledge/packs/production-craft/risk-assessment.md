---
id: production.risk-assessment
title: Production risk assessment
tags: risk, risk register, probability, impact, risk score, mitigation, contingency, pert, three-point estimate, uncertainty
---
# Production risk assessment

A risk is an uncertain event that would hurt scope, schedule, quality or cost if it happened. Risk assessment makes
risks visible early, scores them consistently, and assigns someone to reduce each important one before it becomes an issue.

## Identifying risks

Risk identification in game projects works best with a category prompt list:
- **Design**: the core mechanic is not fun; difficulty cannot be tuned; scope of content underestimated.
- **Technical**: performance on target platform; unproven engine feature; save/load or networking complexity.
- **Art/content**: style not achievable at the required volume; asset pipeline not proven end to end.
- **People/process**: single point of failure; unclear decision owner; late feedback.
- **External**: platform or store requirements, third-party tools, licensing.
Write each risk as cause → event → consequence: "Because the physics jump is unprototyped, tuning may take longer than
planned, delaying the vertical slice by a sprint." Vague risks ("tech is hard") cannot be mitigated.

## Scoring: probability × impact

Risk score = probability × impact, each on a 1–5 scale.

| Score | Probability | Impact |
|---|---|---|
| 1 | Very unlikely | Negligible; absorbed by buffer |
| 2 | Unlikely | Minor slip within a sprint |
| 3 | Possible | Slips a milestone deliverable or cuts a should-have |
| 4 | Likely | Slips a milestone or cuts a must-have |
| 5 | Almost certain | Threatens release or core vision |

Bands: 15–25 **high** (act now, review weekly), 8–14 **medium** (mitigation planned, review each sprint), 1–7 **low**
(monitor). Example: "jump feel unproven" P=3, I=4 → 12, medium; "only one person knows the build pipeline" P=2, I=5 →
10, medium. Scores are judgments; record who scored them.

## Responses: avoid, reduce, transfer, accept

- **Avoid**: change the plan so the risk cannot occur (drop online multiplayer).
- **Reduce**: spike, prototype, or test early to cut probability or impact (build the jump in week one).
- **Transfer**: move it to someone better placed (use an existing, proven library).
- **Accept**: consciously take it, with a **contingency** plan and a trigger ("if jump is not signed off by day 5, use
  the tuned preset from the prototype").
Every high and medium risk needs an owner, a response, a trigger and a review date.

## Quantifying schedule risk with PERT

For uncertain tasks use three-point estimates: optimistic (O), most likely (M), pessimistic (P).
- Expected time `E = (O + 4M + P) ÷ 6`
- Standard deviation `σ ≈ (P − O) ÷ 6`
- For a sequence of independent tasks, sum the E values and combine σ as `√(σ₁² + σ₂² + …)`.

Worked example: three tasks (2, 3, 6), (1, 2, 5), (3, 4, 8) days → E = 3.33, 2.33, 4.5 = 10.17 days; σ = 0.67, 0.67, 0.83 →
combined ≈ 1.26 days. Planning to E + 1σ ≈ 11.4 days gives a more defensible date than the sum of most-likely values
(9 days). Label all of these as estimates.

## Risk register template

```
| ID | Risk (cause → event → consequence) | Cat | P | I | Score | Response | Owner | Trigger | Review |
| R1 | Jump unprototyped → tuning overruns → slice slips 1 sprint | Design | 3 | 4 | 12 | Reduce: prototype wk1 | Designer | not signed off day 5 | each sprint |
```
Keep a "closed risks" section with the outcome; it calibrates future scoring.

## Pitfalls

- Registers written once and never reviewed.
- Every risk scored 3×3: the scale is being avoided, not used.
- Mitigations with no owner or date.
- Confusing risks (uncertain) with issues (already happening); issues go to the blocker list immediately.
- Hiding risks to look on track; an early, honest risk is cheaper than a late surprise.
