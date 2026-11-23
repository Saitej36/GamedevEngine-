# Game AI: Decision Models, Behavior Trees and Utility AI

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/game-ai/SKILL.md, skills/disciplines/game-ai/references/fsm-perception-steering.md, skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md, skills/disciplines/ai-behavior-trees-utility-ai/references/behavior-tree-core.md, skills/disciplines/ai-behavior-trees-utility-ai/references/utility-ai-system.md, skills/disciplines/ai-behavior-trees-utility-ai/references/best-practices-and-pitfalls.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/rules/ai-code.md
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: merged two skills and one rule file; removed engine-specific code for engines Pixel Studio does not target and all test-runner commands; added notes for UE 5.4, Unity 6 / 2022.3 LTS and Phaser 3.90; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Layer the agent before choosing a model

Split every NPC into layers that each pass one small value on: **perceive** (facts written to a
Blackboard) → **decide** (an intent such as "go to X" or "attack Y") → **path** (waypoints) →
**steer** (a velocity) → **animate**. Most "dumb AI" bugs are one layer doing another's job,
such as a state that raycasts. Keep AI parameters in data files, and make AI telegraph intent
before it acts.

## Choosing FSM, HFSM, behavior tree, utility or GOAP

| Situation | Default |
|---|---|
| 2–6 states, obvious transitions (door, turret, simple guard) | FSM |
| Several states share exits (stunned, dead, alerted from anywhere) | Hierarchical FSM: a parent state owns the shared exits |
| Many prioritized, interruptible behaviors reused across enemy types | Behavior tree (BT) |
| Graded trade-offs (which target, heal or attack, villager needs) | Utility scoring, usually inside one BT branch |
| Multi-step plans with preconditions designers want to emerge | GOAP, only if a BT cannot express it; plans are hard to debug |

A common mix is an FSM for the top mode (Idle, Combat, Dead) with a BT inside Combat; promote a
state to a BT when its transitions no longer fit on one screen.

**FSM gotchas.** Route the first state through the same `ChangeState()` as every other, or its
`Enter()` never runs. Queue state changes requested inside `Enter()`/`Exit()` and apply them after
`Update()`. Use separate enter and exit thresholds (chase at 10 m, give up at 14 m) and a minimum
time in state of 0.3–0.5 s. Log transitions; more than about 2 per second means missing
hysteresis.

## Perception at a tick rate

One sensor per agent writes `target`, `lastKnownPos`, `canSee` and `heardAt` to the Blackboard on
a timer of 5–10 Hz, with a random start phase so agents do not all raycast on the same frame.
Decisions read those facts and never raycast themselves.

- **Cheap to expensive:** squared distance, then the view cone
  (`dot(forward, dirToTarget) > cos(halfAngle)`), then rays. Only survivors pay for rays.
- **Cast to two or three points** (head, chest). One ray to the feet fails behind low cover.
- **Hearing is pushed, not polled:** gameplay posts a noise with a radius (gunshot about 12 m,
  footsteps less) to nearby sensors.
- **No omniscience:** after sight is lost, chase `lastKnownPos`, then search. Delay the first
  reaction by about 0.2–0.5 s, or fill an awareness meter that rises faster at close range.

## Behavior tree lifecycle and reactive composites

Every node returns `Success`, `Failure` or `Running`. The contract where most BT bugs live:
a parent calls `Reset()` on a child as soon as it returns a terminal status and when it abandons a
`Running` child; the tree resets a terminal root. `Reset()` must be idempotent and clear only
execution-local state (timers, reservations), never persistent state such as a cooldown deadline.
A **memory** composite remembers its `Running` child and resumes there next tick; it is cheap but
cannot be preempted.

- **Reactive selector** re-checks children from index 0 every tick and `Reset()`s the branch it
  abandons. Use it for top-level priorities, or Attack is never re-asked while Patrol runs.
- **Reactive sequence** re-checks its guard conditions each tick. A memory sequence
  `[CanSeePlayer?, Chase]` chases forever after sight is lost.
- **Parallel** must store per-child results; re-ticking a finished child restarts it.
- **Cooldown** keeps its ready time across resets, or flickering between branches bypasses it.
  Wrap it in `ForceSuccess` when "wait for cooldown" should hold the branch.
- Tick the tree on a decision cadence (5–15 Hz) from an accumulator; movement and animation still
  run every frame. Build the tree once at spawn; `Tick` allocates nothing.

## Utility curves and selection

Each consideration maps one fact to 0..1 through a response curve: linear for proportional wants,
quadratic or exponential for "only matters at the extreme", sigmoid or smoothstep for a soft
threshold (flee when health crosses about 40 %); invert with `1 - curve(t)`. Every output is
clamped to 0..1, or a 0..100 input dominates and weights become meaningless.

Combine considerations by multiplication so an exact 0 vetoes the action, then apply the
compensation factor (Dave Mark), because five factors of 0.8 multiply to 0.33:

```csharp
static float Compensate(float product, int count) {
    if (count <= 1) return Math.Clamp(product, 0f, 1f);
    float makeUp = (1f - product) * (1f - 1f / count);
    return Math.Clamp(product + makeUp * product, 0f, 1f); // 0 stays 0
}
```

Select by argmax with an inertia bonus of about 0.05 for the running action, added only to
positive raw scores so it cannot revive a vetoed action. Use softmax (temperature about 0.2) for
variety, subtracting the best score before `exp` to avoid overflow. The selector returns `null`
when everything scores 0, and the caller must cope. Default shape: BT outside, utility inside.

## Debugging, budgets and verification

- **Draw the decision:** running leaf, path, sight cone and a live bar per utility score. A stuck
  `Running` leaf or an un-normalized consideration pinned at 1.0 is visible at once.
- **Log transitions, not ticks.** Seed a per-agent RNG for softmax so a bad agent can be replayed.
- **Budget:** upstream suggests 2 ms per frame for all AI, confirmed by profiling. Cost lives in
  leaves, so cache perception, repath every 0.25–0.5 s, time-slice agents into buckets and slow
  distant agents.
- **Tick tests:** script the Blackboard, tick N times, assert statuses. Cover: a `Wait` run twice
  takes full time both runs; a lost guard aborts its action; a cooldown blocks after abort;
  all-zero utility returns `null`. Stuck check: under 0.5 units of progress in 2 s fails.

## Engine notes

- **Unreal Engine 5.4:** Behavior Tree and Blackboard assets. Decorators with Observer Aborts
  (Self, Lower Priority, Both) give reactive behavior; Services tick at their own interval and are
  the place to update Blackboard facts. `UAIPerceptionComponent` with sight and hearing configs
  replaces hand-rolled sensors. StateTree exists as a plugin; Verify on UE 5.4: its feature set
  before choosing it over a BT.
- **Unity 6 / 2022.3 LTS:** plain C# runtimes work in both; drive them from `Update` with an
  accumulator. Verify on Unity 6: availability of the Unity Behavior package before depending on
  it. Movement goes through the AI Navigation package's `NavMeshAgent`.
- **Phaser 3.90:** no built-in AI; port these shapes to TypeScript, tick from the scene's
  `update(time, delta)` with an accumulator, and draw debug overlays with a Graphics object.
