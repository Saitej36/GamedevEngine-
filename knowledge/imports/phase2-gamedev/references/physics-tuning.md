# Physics Tuning: Timestep, Scale, Jump Arcs and Tunnelling

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/physics-tuning/SKILL.md, skills/disciplines/physics-tuning/references/timestep-and-ccd.md, skills/disciplines/level-design/SKILL.md (jump measurement figures)
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: removed engine code and headless test scripts for an engine Pixel Studio does not target and all command lines; translated the accumulator loop to TypeScript; re-targeted Unity 6.3 notes to Unity 6 / 2022.3 LTS; added UE 5.4 and Phaser 3.90 notes, units/scale and jump-arc formulas; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Fixed timestep for simulation, interpolation for display

Integration and collision are sensitive to step size; with a variable `dt` springs gain energy,
fast objects tunnel more and stacks settle differently at 30 versus 144 FPS. Put forces, velocity
writes and collision reads in the fixed step and use that step's `dt`. Render by interpolating
between the previous and current physics states.

```ts
const FIXED_DT = 1 / 60, MAX_STEPS = 5;
let acc = 0;
function frame(renderDt: number) {
  acc += Math.min(renderDt, FIXED_DT * MAX_STEPS);   // clamp hitches: no spiral of death
  let steps = 0;
  while (acc >= FIXED_DT && steps < MAX_STEPS) {
    savePrevious(); step(FIXED_DT); acc -= FIXED_DT; steps++;
  }
  render(acc / FIXED_DT);                             // alpha for lerp(prev, curr)
}
```

Zero, one or several steps per frame is normal. The clamp's price: below `tickRate / MAX_STEPS`
FPS the game runs in slow motion. Interpolation adds up to one step of latency but removes the
beat between physics and display rates. Prefer the engine's built-in interpolation and never apply
two interpolations to one object. After a teleport, reset the interpolation history or the object
visibly slides from its old position.

## Units and scale

Pick a unit and keep real-world-ish sizes: engines tune sleep thresholds, contact offsets and
default gravity for their unit. Unreal works in centimetres (1 unit = 1 cm, so a 180 cm character
is 180 units); Unity in metres (a character is about 1.8 units); 2D web engines usually in pixels
per second. A character modelled 10× too large falls in slow motion, because gravity is an
acceleration in that unit. Mass changes collision response, not fall speed: shape "heaviness" with
gravity scale and damping. Keep mass ratios of touching bodies within about 1:10.

## Jump arcs from height and time

Designers think in "jump 3 tiles high, reach the apex in 0.35 s"; derive the physics from that:

| Quantity | Formula |
|---|---|
| Gravity | `g = 2h / t²` (h = apex height, t = time to apex) |
| Launch speed | `v₀ = 2h / t = g · t` |
| Airtime on flat ground | `2t` |
| Horizontal reach | `runSpeed · 2t` |
| Variable height | on early release, multiply upward velocity by about 0.5 or raise gravity |
| Snappier fall | fall gravity 1.5–2.5 × rise gravity (recompute reach) |

Example: h = 96 px, t = 0.35 s gives g ≈ 1567 px/s² and v₀ ≈ 549 px/s. These formulas are the
ideal arc. A fixed step integrates in whole ticks; upstream measured a controller whose formulas
gave 90 px apex and 206 px reach at 93.6 px and 212 px. Fall gravity, air control and collider
width shift it further, so **measure the real controller** and size required gaps at about 0.7 of
measured reach (optional challenges up to about 0.95).

## Friction, drag and restitution

- **Damping (drag)** bleeds velocity each step; it is how "floaty" or "heavy" airborne motion
  feels. Some engines apply it as `v *= 1 - damp · dt`, so large values behave differently after a
  tick-rate change: retune when you change the rate.
- **Friction** lives in a physics material; character controllers usually ignore it and use their
  own acceleration and braking values instead.
- **Restitution (bounce)** 0..1 in the material; above about 0.8 stacks rarely settle.
- Tune one knob at a time, starting from the body, not the scene.

## Tunnelling and CCD

Discrete collision tests positions once per step; a body moving more than its own thickness per
step passes through thin walls, and once its centre passes the middle of a wall it is pushed out
the far side.

- Rule of thumb: `speed / tickRate < thinnest wall`. Fix by capping max speed, thickening walls,
  raising the tick rate, or enabling **CCD** only on small fast bodies (it costs more).
- Bullets: use a ray or shape cast along the frame's motion instead of a fast rigid body.
- Speculative CCD is cheap and covers dynamic bodies but can cause "ghost" deflections.
- Test it: fire the game's fastest body at its thinnest wall from an offset that is not a multiple
  of the step distance, and fail if it ends on the far side.

## Stability, sleeping and layers

Exploding stacks and shaky joints mean extreme mass ratios or too few solver iterations; raise
iterations or substeps for those systems only. Enable sleeping so resting bodies stop jittering and
costing CPU, and make sure gameplay bodies wake on the right events. Plan the collision matrix as a
named table (what each layer is, what it collides with) and check both directions.

## Determinism caveats

Fixed steps make a simulation repeatable on one machine and build, not across machines. Floating
point results can differ by CPU, compiler flags, platform and engine version, and contact order can
depend on object creation order. For replays or lockstep networking, record inputs and re-simulate
only on identical builds, or use deterministic fixed-point logic for gameplay. Verify on your
engine version: whether its physics claims any cross-platform determinism before relying on it.

## Engine notes

- **Unreal Engine 5.4 (Chaos):** Character Movement owns jump and walk feel (`JumpZVelocity`,
  `GravityScale`, `AirControl`, `BrakingDecelerationWalking`, `GroundFriction`). Enable CCD per
  body instance (`bUseCCD`); substepping and async physics tick are project physics settings.
  Verify on UE 5.4: substepping and async tick defaults.
- **Unity 6 / 2022.3 LTS:** `FixedUpdate` with `Time.fixedDeltaTime` (default 0.02 s, 50 Hz);
  Maximum Allowed Timestep caps steps per frame. `Rigidbody.interpolation = Interpolate` on
  followed bodies; move them through the Rigidbody, not the transform. CCD modes: Continuous
  (static only), ContinuousDynamic, ContinuousSpeculative. Unity 6 renamed `drag` to
  `linearDamping` and `velocity` to `linearVelocity`; 2022.3 keeps the old names.
- **Phaser 3.90 (Arcade):** AABB and circle bodies only, no CCD. Use `setMaxVelocity`, keep tiles
  thick, and tune `overlapBias`/`tileBias`. `setDrag`, `setBounce` and per-body gravity set feel.
  Verify on Phaser 3.90: the Arcade world `fps` and `fixedStep` defaults. Matter.js physics is an
  alternative for rigid-body stacking.
