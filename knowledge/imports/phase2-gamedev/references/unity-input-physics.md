# Unity Input System and physics for Unity 6 (6000.0) and 2022.3 LTS

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unity/unity-input-system/SKILL.md, skills/unity/unity-input-system/references/rebinding.md, skills/unity/unity-physics/SKILL.md, skills/unity/unity-physics/references/physics-2d.md, skills/unity/unity-physics/references/raycasting-and-joints.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: re-targeted from Unity 6.3 / Input System 1.20 to Unity 6 (6000.0) and 2022.3 LTS with both API forms; removed Unity CLI, low-level 2D physics and 6.5 notes; removed shell commands; condensed.
> Engine target: Unity 6 (6000.0) and Unity 2022.3 LTS, Input System package 1.x. Code is illustrative and has NOT been compiled or run.

## Input System: versions and Active Input Handling

- Read `com.unity.inputsystem` in `Packages/manifest.json` before using any API. Verify on 2022.3: the package version shipped/recommended is typically 1.7.x; 1.8+ installs on 2022.3 but project-wide actions require Unity 6. Verify on 6000.0: new projects get 1.8 or later (1.11.x on later 6000.0 patches). Upstream targets 1.20.x, which requires Unity 6000.0 minimum, so never suggest it for a 2022.3 project.
- `ProjectSettings/ProjectSettings.asset` → `activeInputHandler`: `0` old Input Manager only, `1` Input System only, `2` both. At `0` the package receives nothing; at `1` any leftover `Input.GetAxis`/`GetKey` throws `InvalidOperationException`. Changing it restarts the Editor: a human step.

## Reading actions: three ways

1. **Project-wide actions (Unity 6 only, Input System 1.8+)**: `InputSystem.actions.FindAction("Player/Move")`. New Unity 6 projects ship `Assets/InputSystem_Actions.inputactions` with `Player` and `UI` maps, all maps enabled at startup. Add to it rather than creating a second asset. Not on 2022.3.
2. **`PlayerInput` component**: works on both baselines; Behavior = Send Messages calls `On<Action>(InputValue)` on the same GameObject (Broadcast Messages reaches children). Use for local co-op with `PlayerInputManager`.
3. **An `InputActionReference` or generated C# class from an asset**: works on both; you must `Enable()`/`Disable()` yourself. The safe default for code that must run on 2022.3.

```csharp
[SerializeField] private InputActionReference move, jump;   // works on both baselines
private void OnEnable()  { move.action.Enable(); jump.action.Enable(); }
private void OnDisable() { move.action.Disable(); jump.action.Disable(); }
private void Update()
{
    Vector2 m = move.action.ReadValue<Vector2>();
    if (jump.action.WasPressedThisFrame()) _jumpQueued = true;   // consume in FixedUpdate
}
```

- Switch action maps for context (`player.Disable(); ui.Enable();`) instead of guarding handlers. With project-wide actions, disable unwanted maps in `Start`.
- Buttons are edges: use `performed` or `WasPressedThisFrame()` in `Update`. Reading edges in `FixedUpdate` misses or doubles presses.
- Pair every `performed +=` in `OnEnable` with `-=` in `OnDisable`.
- `.inputactions` is JSON (`maps[].actions[]`, `maps[].bindings[]` with `path` like `<Keyboard>/space`, composites with `isComposite`/`isPartOfComposite`). Agents may edit it only with the Editor closed, giving new entries fresh `id` GUIDs and keeping it valid JSON.

## Rebinding and tests

```csharp
action.Disable();                                  // rebinding an enabled action throws
_op = action.PerformInteractiveRebinding(bindingIndex)
    .WithControlsExcluding("<Mouse>/position")
    .OnComplete(op => { op.Dispose(); action.Enable(); Save(action.actionMap.asset); })
    .OnCancel(op => { op.Dispose(); action.Enable(); })
    .Start();
```

- Rebinds are overrides; the asset is not modified. Persist with `asset.SaveBindingOverridesAsJson()` / `LoadBindingOverridesFromJson()`. Reset with `RemoveBindingOverride` / `RemoveAllBindingOverrides`. Composites (WASD) rebind per part index. Always `Dispose()` the operation.
- `InputTestFixture` adds virtual devices (`InputSystem.AddDevice<Keyboard>()`, `Press(keyboard.spaceKey)`). The test asmdef needs `Unity.InputSystem` and `Unity.InputSystem.TestFramework`, and the package listed under `"testables"` in the manifest.

## Rigidbody basics on both baselines

Unity 3D (`Rigidbody`, `Physics`) and 2D (`Rigidbody2D`, `Physics2D`) are separate engines that never interact; a 3D-named callback on a 2D object never runs, with no error.

| Concept | 2022.3 LTS | Unity 6 |
|---|---|---|
| 3D velocity | `rb.velocity` | `rb.linearVelocity` |
| 3D damping | `rb.drag`, `rb.angularDrag` | `rb.linearDamping`, `rb.angularDamping` |
| 2D velocity | `rb2d.velocity = new Vector2(x, rb2d.velocity.y)` | `rb2d.linearVelocity`, or `rb2d.linearVelocityX = x` |
| 2D kinematic | `bodyType = RigidbodyType2D.Kinematic` (`isKinematic` also works) | `bodyType` (`isKinematic` obsolete) |
| Material | `PhysicMaterial` | `PhysicsMaterial` |
| 2D non-alloc casts | `Physics2D.RaycastNonAlloc` works | `*NonAlloc` deprecated; use the `ContactFilter2D` + results-array overload (also on 2022.3) |

Old names compile on Unity 6 with obsolete warnings and the API Updater offers to rewrite them; that rewrite breaks 2022.3 compatibility, so do not mix forms in one project.

## FixedUpdate, movement and interpolation

- Read input in `Update`, store intent, apply in `FixedUpdate`: `AddForce`, set velocity, or `MovePosition`. Writing `transform.position` on a dynamic body teleports it and skips collision; if unavoidable, call `Physics.SyncTransforms()` before same-frame queries.
- `ForceMode.Force`/`Acceleration` are continuous (mass-scaled / not); `Impulse`/`VelocityChange` are instant (use for jumps).
- Kinematic movers (platforms) use `MovePosition` in `FixedUpdate` so resting bodies ride along.
- Set `interpolation = Interpolate` (2D: `RigidbodyInterpolation2D.Interpolate`) on the player body a camera follows, or it jitters between fixed steps. Freeze rotation for upright characters.
- `Time.timeScale = 0` stops simulation, but queries still hit. In 2D, `Physics2D.simulationMode = Script` means nothing moves until `Physics2D.Simulate`.
- `CharacterController.Move` bypasses rigidbodies: no `OnCollisionEnter`, use `OnControllerColliderHit`.
- `Rigidbody2D.Slide` (kinematic slide-along-surfaces): Verify on 2022.3 — it may be Unity 6 only; hand-roll a cast-and-slide loop if absent.

## Collision layers, triggers and queries

- At least one of a colliding pair needs a rigidbody; two static colliders never report. Default Contact Pairs Mode reports nothing kinematic-vs-kinematic or kinematic-vs-static (2D: `useFullKinematicContacts`).
- Collision vs trigger: solid colliders call `OnCollisionEnter(2D)`; `isTrigger` calls `OnTriggerEnter(2D)`.
- Layer Collision Matrix lives in `DynamicsManager.asset` / `Physics2DSettings.asset` as hex bitfields. Runtime `Physics.IgnoreLayerCollision` is not saved; a lasting change is a Project Settings edit for the human.
- Queries hit triggers by default: pass `QueryTriggerInteraction.Ignore` (3D) or a `ContactFilter2D { useTriggers = false }` (2D).
- 2D `queriesStartInColliders` is on by default, so a ground ray from the player's centre hits the player. Exclude the player layer or use `rb2d.IsTouching(filter)` with `SetNormalAngle(45, 135)`.
- Masks: `LayerMask.GetMask("Ground", "Enemy")`; prefer buffer overloads in per-frame code.
- One-way platforms: `PlatformEffector2D` with `useOneWay` and the collider's **Used By Effector** ticked.

## Continuous collision detection and common traps

- Fast objects tunnel with `Discrete`. 3D `Continuous` sweeps against static colliders only; `ContinuousDynamic` also against other continuous bodies; `ContinuousSpeculative` against everything and is cheaper but can produce ghost contacts. 2D: `CollisionDetectionMode2D.Continuous`. For bullets a cast along the path is often better.
- Concave `MeshCollider` cannot be on a dynamic body; use Convex or primitive compounds. A compound body has one rigidbody on the root; an extra child rigidbody splits it off.
- A static collider moved by its Transform may not wake sleeping bodies; give moving colliders a kinematic rigidbody or call `WakeUp()`.
- 2D `angularVelocity` is degrees/s (float); 3D is radians/s (Vector3).
