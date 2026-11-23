# Supplement: Create a test plan (story types and verification checks)

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/skills/qa-plan/SKILL.md, .claude/docs/templates/test-plan.md
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — "Check it" / verification sections of skills/disciplines/save-systems/SKILL.md, skills/disciplines/procedural-gen/SKILL.md, skills/disciplines/input-systems/SKILL.md, skills/disciplines/physics-tuning/SKILL.md, skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md
> License: MIT AND Apache-2.0 (see licenses/). Modified by Pixel Studio: reduced to additions for the existing create-test-plan skill; removed slash-command, config-helper and shell steps; kept the base skill's "not executed" rule; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Additional workflow steps

Classify each acceptance criterion or story by **type** before deriving cases, and use the
declared type if the spec already has one (note when you inferred it):

| Type | Indicators | Default evidence |
|---|---|---|
| Logic | formulas, thresholds, state transitions, AI decisions, validation | automated unit test |
| Integration | two or more systems, events across boundaries, save/load round trips | integration test plus smoke step |
| Visual/Feel | animation, VFX, "feels responsive", timing, screen shake, audio sync | screenshot or video plus named sign-off |
| UI | menus, HUD, buttons, screens, tooltips | screenshot of each screen touched |
| Config/Data | balance values or data files only | data validation test plus spot check |

- For mixed items, pick the type with the highest risk and note the secondary type.
- For Logic cases, cover zero/minimum, maximum/boundary and invalid or null inputs, plus every
  edge case named in the spec.
- Translate every subjective criterion ("feels", "looks") into a benchmark or a playtest
  protocol: who plays, how many sessions, what question the session answers.
- Add a **smoke scope**: launches to menu, new session starts, the changed mechanic works, save and
  load round trip (if a save system exists), no new frame spikes.
- Add discipline verification cases where they apply: save round trip and truncated-file fallback
  to backup, refusal of a newer save version; seed sweep (determinism, zero validity failures,
  distinct-map count); binding audit (every action has keyboard and gamepad bindings, no
  conflicts); tunnelling test with the fastest body against the thinnest wall and the same
  position at two frame rates; AI tick tests (lost guard aborts the action, cooldown survives
  abort).
- Include a Definition of Done per type: tests written for Logic and Integration, retained
  screenshots for Visual/Feel and UI, sign-off named for Visual/Feel.

## Additional quality checks

- [ ] Every case has a type, and the totals per type appear in the summary.
- [ ] Visual/Feel and UI cases name evidence to capture and who signs off.
- [ ] Subjective criteria have a benchmark or playtest protocol.
- [ ] Device-dependent checks (gamepad, phone, thermal, cloud sync) are written as human steps
      with a report-back question.
- [ ] Every status remains "not executed" unless QA executed and observed it; results reported
      by others are labelled with their source.

## Additional failure conditions

- Zero acceptance criteria or stories in scope: report `NOT ASSESSED — nothing in scope` and name
  where you looked; do not produce an empty plan that looks complete.
- A story has no testable criteria: record it as a QA finding rather than skipping it.
- A verification case needs a harness the project lacks (headless runner, seed sweep tool): list
  it as a request for the Programmer, status "not executed".
