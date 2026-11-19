---
id: unity.gameplay-systems
title: Unity gameplay systems
tags: unity, physics 2d, physics 3d, rigidbody2d, collider, trigger, input system, playerinput, scriptableobject, prefab, ui toolkit, ugui, textmeshpro, coroutine, async, awaitable
---
# Unity gameplay systems

Assumed version: Unity 6 (6000.0 LTS), with notes for Unity 2022.3 LTS. This is a Pixel Studio internal summary, not
official Unity documentation; verify signatures in the Scripting API for the project's exact version.

## Unity physics 2D and 3D

Unity has two separate physics systems: 2D (`Rigidbody2D`, `Collider2D`, `Physics2D`) and 3D (`Rigidbody`, `Collider`,
`Physics`). 2D and 3D components never interact; pick one per game.

- Body types for `Rigidbody2D`: Dynamic (simulated), Kinematic (moved by script, not by forces), Static.
- Move dynamic bodies in `FixedUpdate` via velocity, forces or `MovePosition`; setting `transform.position` directly
  bypasses physics and causes tunnelling and jitter.
- Unity 6 renamed `Rigidbody2D.velocity` to `linearVelocity` (the old name is obsolete); 2022 LTS uses `velocity`.
  Check the project's version before writing either.
- Enable interpolation on the player's body for smooth visuals when frame rate and physics step differ.
- Collision callbacks: `OnCollisionEnter2D(Collision2D)` and `OnTriggerEnter2D(Collider2D)` for 2D;
  `OnCollisionEnter(Collision)` and `OnTriggerEnter(Collider)` for 3D. At least one object needs a Rigidbody for
  callbacks to fire; triggers need `isTrigger` enabled on the collider.
- Use layers and the layer collision matrix (Project Settings > Physics 2D / Physics) to stop irrelevant pairs from
  colliding, rather than filtering in callbacks.
- Fast projectiles: set collision detection to Continuous on the Rigidbody.

## Unity Input System package

The Input System package (`com.unity.inputsystem`, namespace `UnityEngine.InputSystem`) replaces the legacy
`Input.GetAxis` API. Player Settings "Active Input Handling" decides which is enabled; check before writing code.

- Define actions (Move, Jump, Pause) in an Input Actions asset with bindings for keyboard, gamepad and touch. Unity 6
  supports project-wide actions accessible through `InputSystem.actions`.
- Read actions in code: `moveAction.ReadValue<Vector2>()` each frame, or subscribe to `performed`/`canceled` events
  (subscribe in `OnEnable`, unsubscribe in `OnDisable`). Actions must be enabled to produce values.
- The `PlayerInput` component can route actions to methods for simpler setups and local multiplayer.
- Direct device access (`Keyboard.current.spaceKey.wasPressedThisFrame`) is fine for debug keys, not for gameplay that
  must support rebinding.

Keep input mapping in the shell: translate actions into plain commands (move vector, jump pressed) that pure logic
consumes, so logic stays testable.

## ScriptableObjects for data

ScriptableObject is a data container asset not attached to a GameObject; it is the standard way to make Unity games
data-driven.

```csharp
[CreateAssetMenu(fileName = "EnemyConfig", menuName = "Game/Enemy Config")]
public class EnemyConfig : ScriptableObject
{
    [SerializeField] private int maxHealth = 3;
    [SerializeField] private float moveSpeed = 2f;
    public int MaxHealth => maxHealth;
    public float MoveSpeed => moveSpeed;
}
```

- Treat config ScriptableObjects as read-only at runtime. In the editor, changes made in Play Mode to an asset persist
  after exiting Play Mode; in builds they do not. This mismatch is a frequent bug.
- Copy runtime state into plain C# objects (`new EnemyState(config)`).
- The human creates asset instances via the Create menu; the agent should list which assets to create and their values.

## Prefabs

A prefab is a reusable GameObject template saved as an asset. Use `Instantiate(prefab, position, rotation)` to spawn and
`Destroy(gameObject)` to remove. Nested prefabs and prefab variants let a base enemy be specialised without duplication.
For frequent spawns, pool instances with `UnityEngine.Pool.ObjectPool<T>` or a simple list instead of instantiating each
time. Reference prefabs through `[SerializeField]` fields, not `Resources.Load` strings, unless loading is dynamic
(Addressables is the package for larger dynamic loading).

## UI Toolkit and uGUI

Unity has two runtime UI systems:

- **uGUI** (GameObject-based): `Canvas`, `RectTransform`, `Button`, `Image`; text via TextMeshPro (`TMP_Text`). Mature,
  well-suited to world-space UI and existing tutorials.
- **UI Toolkit**: a `UIDocument` component loads UXML layout and USS styles; query elements in code with
  `root.Q<Button>("start-button")` and register callbacks such as `button.clicked += OnStart`. Recommended by Unity for
  new UI in recent versions, though some features (world-space UI) have lagged uGUI depending on version.

Either way, UI should observe game state (events or polling a view model), not own it. Update labels only when values
change to avoid per-frame string allocations.

## Coroutines vs async

Coroutines are `IEnumerator` methods started with `StartCoroutine`, yielding `null` (next frame),
`new WaitForSeconds(t)` or `new WaitForFixedUpdate()`. They stop when the owning GameObject is deactivated or destroyed,
which is usually what gameplay wants.

`async`/`await` with plain `Task` keeps running after the object is destroyed and can touch destroyed objects; add
cancellation (`destroyCancellationToken` on MonoBehaviour, available since 2022.2). Unity 2023.1+ and Unity 6 provide the
`Awaitable` type (e.g. `Awaitable.NextFrameAsync()`, `Awaitable.WaitForSecondsAsync`) designed for Unity's main thread.

Guideline: coroutines or `Awaitable` for gameplay sequencing; timers in pure logic (decrement by `dt`) when the behaviour
needs unit tests, since they are deterministic and engine-free.

## Further reading
- https://docs.unity3d.com/Manual/index.html
- https://docs.unity3d.com/ScriptReference/index.html
