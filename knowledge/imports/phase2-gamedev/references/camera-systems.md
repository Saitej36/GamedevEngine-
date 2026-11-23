# Camera Systems: Follow, Dead Zones, Look-Ahead and Pixel-Perfect 2D

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/camera-systems/SKILL.md, skills/disciplines/camera-systems/references/follow-and-framing.md, skills/disciplines/game-ui-ux/SKILL.md (integer scaling note)
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: replaced engine code for an engine Pixel Studio does not target with C# and prose; re-targeted from Unity 6.3 / Cinemachine 3.1 to Unity 6 / 2022.3 LTS; added UE 5.4 and Phaser 3.90 notes and a pixel-perfect section; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## What the camera serves

Decide the job first: a platformer camera leads the jump and shows hazards; top-down centres with
a dead zone; third-person orbits with collision; first-person only looks. A good camera follows
smoothly at any frame rate, leads the action, never shows outside the level and never clips
through walls. Use the engine's built-in rig first and hand-roll only what it cannot do.

## Frame-rate-independent smoothing

A fixed `lerp(pos, target, 0.1)` per frame is frame-rate dependent: floatier at 30 FPS, snappier
at 144. Use exponential smoothing with a per-second rate, or a critically damped spring:

```csharp
void LateUpdate() {
    float t = 1f - Mathf.Exp(-rate * Time.deltaTime);   // rate ≈ 5 (floaty) .. 12 (snappy)
    focus = Vector3.Lerp(focus, desiredFocus, t);
    // or: focus = Vector3.SmoothDamp(focus, desiredFocus, ref vel, smoothTime);
}
```

Upstream's check: step the follow code with a target moving at 300 px/s for 2 s at `dt = 1/30`
and `dt = 1/144`. With `rate = 8` the lag is about 33 px and 37 px; a fixed 0.1 lerp gives about
90 px and 19 px, proof of frame-rate dependence.

## Dead zone and look-ahead

Per frame, after the target has moved:

1. **Dead zone:** move the focus only by the target's overflow beyond a box (or circle) around it,
   per axis. Typical half-extents 32–64 px. A box and a circle feel different; choose deliberately.
2. **Look-ahead:** offset the focus along the direction of motion by 40–120 px, and **ease the
   offset itself** over 0.2–0.4 s so a direction flip does not whip the view.
3. **Smooth** toward the focus (rate 6–10).
4. **Clamp the view, not the centre:** clamp the centre to `[min + halfView, max - halfView]` per
   axis, where `halfView` accounts for zoom. If the level is smaller than the view on an axis,
   centre on that axis instead.

## Update order, jitter and cuts

- Follow **after** the target moves (late update), or you get one frame of lag.
- **Jitter while following a physics body** happens when the body moves at the physics tick and
  the camera at the display rate. Turn on the body's interpolation and follow the interpolated
  transform, or move both in the same step; mixing them jitters.
- Do not parent the camera to the moving player; it inherits every bump. Keep it separate and
  follow in code or with a rig.
- **Teleport or respawn:** hard-cut and reset the smoothing state, or the camera slingshots
  across the level.
- **Group framing:** centre on the targets' bounding box, then zoom (2D) or dolly or widen FOV (3D)
  to fit it plus padding, with zoom limits. Split-screen doubles render cost; budget it.

## Third- and first-person rules

Third-person: an invisible pivot at shoulder height, yaw on the pivot, pitch on a child, camera at
the arm's length. A spring arm or occlusion ray shortens to the first hit, with a probe radius a
little larger than the near-plane half-size. Clamp pitch to about -80° to +45°. First-person: yaw
rotates the body, pitch only the head, clamp about ±80°, never accumulate roll. Expose look
sensitivity and invert-Y.

## Screen-shake integration

Shake is an additive offset written by the game-feel trauma model: smooth follow first, add the
shake offset last. Writing shake into the follow target makes the follow fight the shake. Shake
decay should use unscaled time so it does not freeze off-centre during hit-stop.

## 2D pixel-perfect cameras

This section is a Pixel Studio addition built on the upstream integer-scaling note.

- Pick a **reference resolution** that divides target displays evenly (for example 320×180 or
  640×360 scaled by whole numbers to 1280×720, 1920×1080, 2560×1440) and scale only by integers;
  fractional scales shimmer and blur.
- **Snap the rendered camera position** to whole texels (after smoothing, before render) while
  keeping the smoothed position in floats; snapping the stored position kills slow movement.
- Disable texture filtering on pixel art and keep sprite pivots on whole pixels.
- Sub-pixel jitter on a slowly moving follow is usually the camera and sprite rounding differently;
  round both the same way, or render to a low-resolution target and upscale.
- Shake offsets in whole pixels look crisper at low reference resolutions.

## Engine notes

- **Unreal Engine 5.4:** `USpringArmComponent` gives collision push-in (`bDoCollisionTest`,
  `ProbeSize`) and lag (`bEnableCameraLag`, `CameraLagSpeed`, `CameraLagMaxDistance`). For 2D, an
  orthographic camera on a spring arm with lag; dead zones and look-ahead are hand-written in the
  camera actor's tick. Shake through `UCameraShakeBase` on the player camera manager.
- **Unity 6 / 2022.3 LTS:** Cinemachine 3 on Unity 6 (`CinemachineCamera` with Position Composer
  for damping, dead zone and lookahead; Confiner 2D for bounds; Orbital Follow and Deoccluder for
  3D). Cinemachine 2.x on 2022.3 uses `CinemachineVirtualCamera` with Framing Transposer and
  Collider; do not mix names across versions. URP 2D offers a Pixel Perfect Camera component, and
  Cinemachine has a pixel-perfect extension. Follow in `LateUpdate` and set
  `Rigidbody.interpolation` on followed bodies. Verify on your installed Cinemachine version:
  component and property names.
- **Phaser 3.90:** `this.cameras.main.startFollow(target, roundPixels, lerpX, lerpY)`,
  `setDeadzone(width, height)`, `setBounds(x, y, w, h)` (clamps the view), `setFollowOffset` for
  look-ahead, `setZoom`, `shake`. Game config `pixelArt: true` disables smoothing for crisp
  textures, and `roundPixels` snaps rendering. Verify on Phaser 3.90: whether follow lerp is
  applied per frame (frame-rate dependent); if so, compute lerp from delta as above.
