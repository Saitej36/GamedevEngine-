---
id: generate-qa-report
role: qa
title: Generate a QA report
summary: Summarise QA status for a build, sprint or milestone with honest test execution counts, coverage against acceptance criteria, open bugs by severity, risks and a clear release recommendation.
triggers: qa report, test report, test summary, quality status, release readiness, sign-off, test results
packs: qa-craft, studio-core
version: 1.0.0
disciplines: publishing
genres: any
engines: any
engine_dependent: false
---
## Purpose
Give the Director and Producer an accurate picture of quality: what was tested, what was not, what is broken, and whether
the build meets its exit criteria. Accuracy matters more than a positive result; an honest "not verified" is a valid outcome.

## Required inputs
- Test plans and case results in `qa/`; automated tests in `tests/`.
- Bug reports and their statuses.
- Any test or run output reported by other roles or humans (with its source).
- Milestone or sprint exit criteria (`docs/production/` roadmap or sprint plan) and acceptance criteria.
- Build identifier the report covers.

## Workflow
1. Identify the build and scope; if no build id is available, state "build not identified".
2. Collect every case and classify status: passed (executed and observed by QA), failed, blocked, not executed, or
   reported by <role>. Do not upgrade any status [K:qa.functional-testing].
3. Compute metrics: criteria covered = criteria with ≥1 case ÷ total; execution rate = executed ÷ written; pass rate =
   passed ÷ executed. Show numerators and denominators.
4. Summarise bugs by severity and status (open/fixed/verified); list every open S1/S2 with ID and title
   [K:qa.bug-reproduction].
5. Compare against exit criteria item by item: met / not met / not verified, with evidence paths
   [K:production.milestone-management].
6. List regression scope covered and gaps [K:qa.regression-testing]; list performance results only if measured.
7. State risks to quality and untested areas.
8. Give a recommendation: ready, ready with conditions, not ready, or cannot assess — with reasons.
9. Provide a "to execute" list for humans: exact commands from README/package.json and manual steps by case ID.
10. Write `qa/qa-report-<build-or-date>.md` and end with References.

Template:
```
# QA report — <build> — <date>
Recommendation: <ready | conditions | not ready | cannot assess> — <one line why>
## Execution summary (counts by status, metrics with fractions)
## Acceptance criteria / exit criteria status
## Open bugs (S1/S2 listed; S3/S4 counts)
## Results reported by others (source, not observed by QA)
## Not executed — steps/commands for a human
## Risks and untested areas
## References
```

## Expected output
- `qa/qa-report-<build-or-date>.md` following the template, with honest counts and a recommendation.
- Reply stating the recommendation, open S1/S2 count and number of cases not executed.

## Quality checklist
- [ ] "Passed" used only for cases QA executed and observed
- [ ] Results from others are labelled with source and kept separate
- [ ] Metrics show fractions, not only percentages
- [ ] Every open S1/S2 is listed by ID
- [ ] Exit criteria each marked met / not met / not verified with evidence
- [ ] Human run instructions are exact and taken from project files
- [ ] Only `qa/` and `tests/` written; references cited

## Failure conditions
- No test plan or results exist: produce a report with recommendation "cannot assess" and a list of what is needed.
- Conflicting results for the same case: report both with sources; do not pick one.
- Asked to sign off a build with unexecuted must-have tests: decline to state "ready" and explain what must be run.
