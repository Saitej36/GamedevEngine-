---
id: unity.project-and-lifecycle
title: Unity project structure and MonoBehaviour lifecycle
tags: unity, c#, project structure, assets folder, assembly definition, asmdef, monobehaviour, awake, onenable, start, update, fixedupdate, lateupdate, ondisable, ondestroy, serializefield, meta files
---
# Unity project structure and MonoBehaviour lifecycle

Assumed version: Unity 6 (6000.0 LTS), with notes for Unity 2022.3 LTS. This is a Pixel Studio internal summary, not
official Unity documentation; when details matter, check the Unity Manual and Scripting API for the exact version the
project uses.

## Unity project layout

A Unity project is a folder containing `Assets/` (all project content and scripts), `Packages/` (`manifest.json` lists
package dependencies), and `ProjectSettings/` (engine settings). `Library/`, `Temp/`, `Logs/` and `obj/` are generated
and must not be committed or edited.

Every asset has a `.meta` file holding its GUID; references between assets use these GUIDs. Rules for agents writing
files into a Unity project:

- Never delete or rename a `.meta` file independently of its asset; references break silently.
- New scripts written without the editor get a `.meta` generated when the human opens the project; note this in the
  hand-off.
- Scenes, prefabs and ScriptableObject assets are YAML files with GUID references; do not hand-edit them. Describe the
  editor steps for the human instead.

A common script layout: `Assets/_Project/Scripts/Core/` (plain C#), `.../Gameplay/` (MonoBehaviours),
`.../UI/`, `Assets/_Project/Tests/EditMode/`, `.../PlayMode/`.

## Assembly definitions

Assembly definition files (`.asmdef`) split scripts into separate assemblies. Benefits: faster recompiles, enforced
dependency direction, and they are required for Unity Test Framework test assemblies.

- A `Core` assembly can be pure C# with "No Engine References" enabled, which enforces that game rules do not touch
  `UnityEngine` and makes them testable in EditMode.
- `Gameplay` references `Core`; `Core` never references `Gameplay`.
- Test assemblies reference the assembly under test plus the test framework references.

## MonoBehaviour lifecycle

MonoBehaviour is the base class for scripts attached to GameObjects. The main callbacks, in order:

| Callback | When | Use for |
|---|---|---|
| `Awake()` | Once, when the instance loads (even if the component is disabled, as long as the GameObject is active) | Cache own components, initialise own state |
| `OnEnable()` | Each time the component becomes enabled and active | Subscribe to events |
| `Start()` | Once, before the first `Update` of an enabled component | Logic that needs other objects' `Awake` to have run |
| `FixedUpdate()` | On the fixed physics step (default `Time.fixedDeltaTime` = 0.02 s), zero or more times per frame | Rigidbody forces and velocities |
| `Update()` | Once per rendered frame | Input reading, non-physics logic, using `Time.deltaTime` |
| `LateUpdate()` | After all `Update` calls in a frame | Camera follow, final adjustments |
| `OnDisable()` | When disabled or before destroy | Unsubscribe from events |
| `OnDestroy()` | When the object is destroyed or the scene unloads | Release resources |

Pitfalls:

- The execution order of the same callback across different scripts is not guaranteed unless set in Script Execution
  Order settings or via the `[DefaultExecutionOrder]` attribute. Do not depend on another script's `Awake` inside your
  own `Awake`; use `Start` or explicit initialisation.
- Do not use constructors in MonoBehaviours; use `Awake`.
- Subscribing in `OnEnable` and unsubscribing in `OnDisable` prevents leaked handlers.
- A destroyed `UnityEngine.Object` compares equal to `null` via Unity's overloaded `==`, but the null-conditional
  (`?.`) and null-coalescing (`??`) operators bypass that overload; avoid them on Unity objects.

## Serialized fields

Unity serializes public fields and private fields marked `[SerializeField]`, showing them in the Inspector. Prefer:

```csharp
public class PlayerMover : MonoBehaviour
{
    [SerializeField] private float moveSpeed = 5f;   // units per second
    [SerializeField] private Rigidbody2D body;

    private void Awake()
    {
        if (body == null) body = GetComponent<Rigidbody2D>();
    }
}
```

- Keep fields private with `[SerializeField]` rather than public, to keep the API narrow.
- Inspector values override code defaults once the component is saved in a scene or prefab; changing the default in
  code does not update existing instances. Mention this whenever tuning values change.
- Renaming a serialized field loses saved values unless `[FormerlySerializedAs("oldName")]` (namespace
  `UnityEngine.Serialization`) is added.

## Agent hand-off notes for Unity

Because agents cannot open the editor, Unity deliverables should include: scripts written and their folders; any
`.asmdef` changes; exact editor steps (add component X to GameObject Y, assign field Z, create asset via menu); which
tests to run in Window > General > Test Runner; and an explicit statement that nothing was compiled or run.

## Further reading
- https://docs.unity3d.com/Manual/index.html
- https://docs.unity3d.com/ScriptReference/index.html
