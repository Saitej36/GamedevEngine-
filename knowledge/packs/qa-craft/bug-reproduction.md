---
id: qa.bug-reproduction
title: Bug reproduction and bug reports
tags: bug report, reproduction, repro steps, severity, priority, frequency, expected actual, evidence, triage, isolation
---
# Bug reproduction and bug reports

A bug report is only useful if someone else can reproduce the problem from it. Reproduction and clear reporting save
more developer time than any other QA activity.

## Bug report template

Every bug report uses the same fields:
```
ID: BUG-<n>
Title: <where> — <what goes wrong> — <condition>   e.g. "Level 2: player falls through platform after dash"
Severity: S1–S4        Priority: P1–P4
Build / environment: <commit or build id, platform, browser/OS, device, settings>
Frequency: <x of y attempts> (e.g. 4/5), or "always", or "once, not reproduced"
Preconditions: <save state, level, settings>
Steps to reproduce:
  1. ...
Expected result: <per spec/AC, cite it>
Actual result: <observed>
Evidence: <screenshot/video/log path, console output, test output>
Location: <file:line if known, e.g. src/physics.js:142>
Source: observed by QA | reported by <role> (not reproduced by QA) | static analysis (not executed)
Notes / workaround / related bugs:
```
Title rule: someone reading only the title in a list should know where and what.

## Severity versus priority

Severity is the technical impact of the bug; priority is the order in which it should be fixed. QA sets severity;
the Producer or creative owner sets priority, usually at triage.

| Severity | Definition | Example |
|---|---|---|
| S1 Critical | Crash, data loss, progression blocker, security issue, no workaround | Save file corrupted on quit |
| S2 Major | Major feature broken or severe gameplay impact, workaround hard | Boss cannot be damaged in phase 2 |
| S3 Minor | Feature partly wrong, easy workaround, limited impact | Score counter skips on combo of 10+ |
| S4 Trivial | Cosmetic, typo, small visual glitch | Tooltip text overlaps border |

| Priority | Meaning |
|---|---|
| P1 | Fix now; blocks testing or release |
| P2 | Fix this sprint / before milestone |
| P3 | Fix when convenient |
| P4 | Fix if time allows; may ship as known issue |

They differ deliberately: a typo in the game title on the main menu is S4 but may be P1; a crash in a hidden debug menu
is S1 but may be P3.

## Reproducing reliably

Reproduction steps should be minimal and deterministic:
1. Start from a known state (fresh launch, specific save, specific level).
2. Write every action, including timing ("press Dash within 0.2 s of landing").
3. Remove steps one at a time; keep only those needed for the bug to occur.
4. Repeat and record frequency as attempts: 3/10 is information, "sometimes" is not.
5. Vary one factor to isolate: different level, input device, browser, settings, build.
6. Find the boundary: "happens with dash speed ≥ 12, not at 10".
For intermittent bugs, record every attempt with conditions; patterns (frame rate, timing, object count) often appear.

## Evidence and code location

Good evidence: a screenshot or video showing the actual result, console errors with stack trace, the save file used,
and the build id. When the code is readable, point to the suspected location with file:line and explain why, e.g.
"src/player.js:88 sets `grounded = true` before collision resolution". Mark it as a suspicion unless confirmed.

## Honesty rules for agents

A QA agent without a shell cannot launch the game. It can still file bugs from static analysis of code and data, but the
report must say "Source: static analysis (not executed)", give frequency as "not reproduced", and give a human the exact
steps to confirm. Bugs reported by another role are logged with "reported by <role>, not reproduced by QA". Never fill
the frequency or actual-result fields with guesses.

## Pitfalls

- Several bugs in one report; split them so each can be fixed and verified.
- Steps that start from "play until it happens".
- Severity inflated to get attention; it destroys trust in triage.
- Missing build id; developers cannot tell whether it is already fixed.
