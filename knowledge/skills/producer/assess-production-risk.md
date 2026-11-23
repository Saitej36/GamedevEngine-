---
id: assess-production-risk
role: producer
title: Assess production risk
summary: Create or update a risk register from the actual project state, scoring each risk as probability × impact with owner, response, trigger and review date.
triggers: risk, risk register, risk assessment, what could go wrong, schedule risk, pert, contingency
packs: production-craft, studio-core
version: 1.0.0
disciplines: publishing
genres: any
engines: any
engine_dependent: false
---
## Purpose
Identify the risks that could hurt scope, schedule or quality, score them consistently, and give each important one an
owner and a response, so problems are handled before they become blockers.

## Required inputs
- Brief/GDD, roadmap and current sprint plan (`docs/production/`).
- Task list with estimates; dependency register if present.
- Workspace state (Glob) and the latest QA reports in `qa/` for open S1/S2 bugs and untested features.
- Existing `docs/production/risks.md`, if any.

## Workflow
1. Read the inputs. Note evidence of risk: missing files that tasks depend on, features with no acceptance criteria,
   untested or "not executed" QA results, single-owner systems, unproven tech in the brief.
2. Walk the categories design, technical, art/content, people/process, external [K:production.risk-assessment] and
   write each risk as cause → event → consequence.
3. Score probability and impact 1–5; risk score = P × I. Bands: 15–25 high, 8–14 medium, 1–7 low. Record that scores
   are judgments and who made them.
4. For high and medium risks choose avoid / reduce / transfer / accept, and write owner role, trigger and review date.
5. For schedule-critical uncertain tasks, compute PERT: `E = (O + 4M + P) ÷ 6`, `σ = (P − O) ÷ 6`, combined σ as root of
   sum of squares; recommend a date at E + 1σ, labelled as an estimate.
6. Update existing risks: re-score, close those that passed with outcome noted, add new ones.
7. Write `docs/production/risks.md` with summary, register, PERT table if used, closed risks and References.

Template:
```
# Risk register — <date>
Top 3: <id, score, one-line action>
| ID | Risk (cause → event → consequence) | Cat | P | I | Score | Response | Owner | Trigger | Review | Evidence |
## Schedule estimate (PERT, estimates)
## Closed risks (outcome)
## References
```

## Expected output
- `docs/production/risks.md` with a scored, owned register, top-3 summary, optional PERT analysis and references.
- Reply listing the top three risks and whether any requires a Director decision now.

## Quality checklist
- [ ] Each risk is specific (cause → event → consequence) and cites evidence (file path, QA report, task)
- [ ] Scores use the 1–5 scales; not every risk scored 3×3
- [ ] Every high/medium risk has response, owner, trigger and review date
- [ ] Issues already happening are listed as blockers, not risks
- [ ] PERT numbers checked arithmetically and labelled as estimates
- [ ] No statistics presented as fact; only `docs/production/` written; references cited

## Failure conditions
- Not enough project information to identify concrete risks: report what is missing and give only clearly evidenced risks.
- A high risk threatens the release or core vision: escalate to the Director immediately in the reply, not only in the file.
- QA or status information is reported but unverifiable: include it labelled "reported by <role>, not verified".
