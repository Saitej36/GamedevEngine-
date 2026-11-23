# Game Feel: Hit-Stop, Shake, Squash and Responsiveness

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/game-feel/SKILL.md, skills/disciplines/game-feel/references/feedback-recipes.md, skills/disciplines/input-systems/references/buffering-and-accessibility.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/docs/templates/guidance/game-design-document-guide.md (Game Feel section), .claude/docs/templates/accessibility-requirements.md (motion, flash and motor rows)
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: replaced engine code for engines Pixel Studio does not target with C# and TypeScript; re-targeted from Unity 6.3 / Cinemachine 3.1 to Unity 6 / 2022.3 LTS, added UE 5.4 and Phaser 3.90 notes; merged the feel-spec structure from a GDD template; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Principle: feedback rides on top of a working mechanic

Juice is several small, brief, exaggerated responses fired together on one discrete event (`hit`,
`landed`, `pickedUp`, `died`). It never changes the simulation: shake moves the camera, hit-stop
scales time, neither moves bodies or stalls gameplay logic. If the mechanic emits no events, add
them first; never poll for feedback triggers. Route every event through one `Feedback(tier, pos)`
call so the whole game stays proportional, start with 2–3 channels per event (sound, particles,
shake) and add channels until it reads.

## Tiers with numbers

| Tier | Trauma added | Hit-stop | Particles | Extra | Example events |
|---|:---:|:---:|:---:|---|---|
| small | 0.10–0.20 | none | 0–4 | tick SFX | footstep, coin, UI hover |
| medium | 0.30–0.50 | 0.04–0.06 s | 6–12 | flash | normal hit, landing, pickup |
| large | 0.70–1.00 | 0.10–0.15 s | 20–40 | flash, zoom, number | crit, boss hit, death, explosion |

Other starting points: shake max offset 8–16 px horizontally and 6–10 px vertically, max roll
0.05–0.12 rad, trauma decay 1.0–1.5 per second; sprite flash 1–3 frames; squash to (1.3, 0.7) and
spring back over about 0.18 s with an overshoot ease.

## Trauma-based screen shake

Track one `trauma` value in [0, 1]. Events **add** to it (never reset it), it decays linearly, and
the displayed shake is `trauma²` so light hits barely move and heavy hits punch. Sample smooth
noise or summed sines, never a fresh random offset per frame, which buzzes like static.

```csharp
void LateUpdate() {
    if (trauma <= 0f) return;
    float dt = Time.unscaledDeltaTime;               // keeps decaying during hit-stop
    trauma = Mathf.Max(trauma - decay * dt, 0f);
    float s = trauma * trauma * playerShakeStrength; // accessibility setting 0..1
    t += dt * 30f;
    shakeOffset = new Vector2(maxOffset.x * s * Mathf.Sin(t * 1.7f),
                              maxOffset.y * s * Mathf.Sin(t * 2.3f));
    if (trauma == 0f) shakeOffset = Vector2.zero;     // always return to rest
}
```

Write the result into a camera offset that the follow camera adds last, not into the player body,
which would desync collision and aim.

## Hit-stop that survives overlapping hits

Slow time to about 0.05 (or freeze) for the tier's duration, then restore after a **real-time**
delay. Two hits 30 ms apart must not let the first timer restore time during the second freeze,
so only the newest call restores:

```csharp
int hitStopId;
IEnumerator HitStop(float duration, float slow = 0.05f) {
    int myId = ++hitStopId;
    Time.timeScale = slow;
    yield return new WaitForSecondsRealtime(duration); // scaled waits never finish at 0
    if (myId == hitStopId) Time.timeScale = 1f;
}
```

Decide what runs during the stop: shake decay and UI tweens use unscaled time; the frozen pose does
not. Time scale does not slow audio, so keep stops short. Skip hit-stop on hits that land during an
active stop and on every frame of multi-hit attacks. Keep freezes under about 0.15 s and buffer
input through them so they never feel like lag.

## Squash, stretch and easing

Keep area roughly constant: stretch one axis, squash the other, then ease back. Overshoot
("back" ease-out) for pops, ease-out for settling, ease-in only for anticipation, ease-in-out for
camera moves and menu slides. Kill or reuse a previous tween on the same property when an event
can retrigger, or two tweens fight and the node ends at the wrong scale. Snap to the exact rest
value at the end of every effect. Other menu items: knockback impulse with a brief control lockout,
rising damage numbers with random drift, pooled particle bursts at the contact point.

## Input latency, coyote time and buffers

Responsiveness is specified at design time because it drives animation budgets and input
architecture. A feel spec should state, per action: maximum input-to-response latency in ms and
frames (for example 50 ms ≈ 3 frames at 60 FPS), startup/active/recovery frames, impact moments
with durations (hit-stop 80 ms, shake 150 ms), and testable acceptance criteria such as "no
playtester calls it floaty or unresponsive" and "hit-stop reads as impact, not stutter".

- **Input buffer:** remember a discrete press for 100–200 ms (in game time) and fire it the moment
  the action becomes legal; consume it on fire, clear it on death and scene change.
- **Coyote time:** allow a jump for a short grace window after leaving a ledge. The upstream source
  gives no number; treat about 0.1 s as a Pixel Studio starting guess and tune it from playtests.
- Add no artificial input delay; process presses on the frame or tick they arrive.

## Accessibility toggles

Ship them with the juice, not after: screen shake strength 0–100 % (default around 60–80 %),
reduce or disable flashing (replace white flashes with a static tint, and keep large bright flashes
at or under three per second), reduce camera motion (cut roll, zoom punches, camera bob), and
platforming assists such as a longer coyote window. Over-juicing routine actions causes nausea and
hides real impacts.

## Engine notes

- **Unreal Engine 5.4:** hit-stop via `UGameplayStatics::SetGlobalTimeDilation` or per-actor
  `CustomTimeDilation` (freeze only attacker and target); restore with a timer that ignores
  dilation. Shake with a `UCameraShakeBase` asset (Perlin noise pattern) started from the
  `PlayerCameraManager`, scaled by the player setting.
- **Unity 6 / 2022.3 LTS:** `Time.timeScale` plus `WaitForSecondsRealtime`. Cinemachine 3 (Unity 6)
  uses `CinemachineBasicMultiChannelPerlin` gains and `CinemachineImpulseSource`/`Listener`;
  Cinemachine 2.x on 2022.3 has equivalent components under the older namespace. Verify on your
  installed Cinemachine version: component names.
- **Phaser 3.90:** `this.cameras.main.shake(duration, intensity)` for simple shake, or write
  `setFollowOffset` from your own trauma model; `this.tweens.add` with `ease: 'Back.easeOut'` for
  pops. For hit-stop, pause physics and tweens briefly; Verify on Phaser 3.90: which clocks
  (`this.time`, tweens, physics) each scale or pause setting affects.
