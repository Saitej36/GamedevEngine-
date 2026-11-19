---
id: reproduce-bug
role: qa
title: Reproduce and report a bug
summary: Turn a reported or suspected defect into a complete bug report with severity, priority suggestion, minimal reproduction steps, expected vs actual, environment, frequency, evidence and file:line, stating honestly whether it was reproduced.
triggers: bug, reproduce, repro steps, bug report, defect, crash, issue report, triage
packs: qa-craft, studio-core
---
## Purpose
Produce a bug report that a programmer can act on without asking questions, and that is truthful about how the bug was
confirmed. Since the agent cannot run the game, reproduction is done by code and data analysis plus precise steps for a
human to confirm.

## Required inputs
- The bug report or symptom (from a user, Director, Programmer, playtest notes or a test failure output).
- The relevant code and data (`src/`, config/data files) and the spec or acceptance criteria for expected behaviour.
- Build identifier (commit, version, date) and environment, if known.
- The project's bug file or folder convention in `qa/`.

## Workflow
1. Restate the symptom in one sentence and record its source ("reported by Programmer in task T-12").
2. Find the expected behaviour in the spec or acceptance criteria and cite it.
3. Locate the relevant code with Grep (function names, event names, data keys). Trace the path from input to symptom
   and identify the suspected cause with file:line [K:qa.bug-reproduction].
4. Derive minimal reproduction steps from a known start state, including timing and settings. Identify boundary
   conditions from the code (e.g. "only when speed ≥ 12").
5. Set severity S1–S4 by impact; suggest priority P1–P4, noting that the Producer/Director confirm priority.
6. Fill frequency honestly: observed counts only if someone executed it; otherwise "not reproduced — static analysis".
7. Attach evidence: quoted log/test output with its source, code excerpt reference, save file path.
8. Write a regression case or an automated test in `tests/` that would catch the bug, marked "written, not executed",
   with the run command from README/package.json [K:qa.test-automation].
9. Write the report to the project's bug location (e.g. `qa/bugs/BUG-<n>.md`) and finish with References.

Report template:
```
ID / Title: BUG-<n> <where> — <what> — <condition>
Severity: S? · Priority (suggested): P?
Build / environment:
Frequency: <x/y observed by …> | not reproduced — static analysis
Preconditions:
Steps to reproduce: 1. … 2. …
Expected (cite spec): 
Actual:
Evidence:
Location: <file:line> (confirmed | suspected)
Source: observed by QA | reported by <role> | static analysis (not executed)
Human confirmation steps / command:
References:
```

## Expected output
- One bug report per defect in `qa/` following the template.
- Optional regression test in `tests/`, linked from the report.
- Reply with bug ID, severity, and whether reproduction was observed or inferred.

## Quality checklist
- [ ] Title states where, what and condition
- [ ] Steps start from a known state and are minimal
- [ ] Expected result cites the spec or criterion
- [ ] Severity follows the S1–S4 definitions; priority marked as suggestion
- [ ] Frequency and actual result are not guessed; source field filled
- [ ] file:line given where known, marked confirmed or suspected
- [ ] One defect per report; only `qa/` and `tests/` written; references cited

## Failure conditions
- Symptom too vague to locate (no feature, level or action): ask the reporter for specifics instead of guessing.
- Expected behaviour undefined in any spec: report as "spec gap" and ask the Designer.
- Code for the area cannot be found: file the report with the observed symptom only and state that cause is unknown.
