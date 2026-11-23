# Unity C# core for Unity 6 (6000.0) and 2022.3 LTS: lifecycle, serialization, ScriptableObjects, asmdefs and tests

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unity/unity-csharp-scripting/SKILL.md, skills/unity/unity-csharp-scripting/references/agent-checks.md, skills/unity/unity-csharp-scripting/references/lifecycle-and-coroutines.md, skills/unity/unity-scriptableobjects/SKILL.md, skills/unity/unity-scriptableobjects/references/event-channels.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — docs/engine-reference/unity/VERSION.md, docs/engine-reference/unity/breaking-changes.md, docs/engine-reference/unity/deprecated-apis.md, docs/engine-reference/unity/current-best-practices.md
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: re-targeted from Unity 6.3/6.4 to Unity 6 (6000.0) and 2022.3 LTS with both API forms; removed the Python checker, Unity CLI, batch-mode and shell commands; removed 6.4+ notes; merged sources and condensed.
> Engine target: Unity 6 (6000.0) and Unity 2022.3 LTS. Code is illustrative and has NOT been compiled or run.

## Read the project version first

`ProjectSettings/ProjectVersion.txt` (`m_EditorVersion`) tells you 2022.3.x or 6000.0.x; `Packages/manifest.json` lists packages; `*.asmdef` files tell you which assembly a new script lands in. Never write code that silently requires an upgrade: opening a 2022.3 project in a Unity 6 editor upgrades it. Both baselines use C# 9 on .NET Standard 2.1, so target-typed `new()`, pattern matching and most C# 9 syntax are fine on both. Verify on 2022.3 and 6000.0: `record` and `init` need an `IsExternalInit` shim and do not serialize, so avoid them for Inspector data.

## Lifecycle: pick the callback by purpose

| Callback | Use for |
|---|---|
| `Awake` | cache own components; runs even if the component is disabled, not while the GameObject is inactive |
| `OnEnable` / `OnDisable` | subscribe / unsubscribe (always paired) |
| `Start` | wiring that depends on other objects' `Awake` |
| `FixedUpdate` | physics; may run 0..n times per frame |
| `Update` | input polling, non-physics logic |
| `LateUpdate` | camera follow after movement |
| `OnDestroy` | release handles |

- All `Awake`s finish before any `Start`, but order among `Awake`s is undefined without Script Execution Order.
- Coroutines die on `SetActive(false)`, not when only `enabled = false`. Cache `new WaitForSeconds(x)`; keep the `Coroutine` handle to stop exactly.
- **Destroyed objects and `?.`**: Unity overrides `==` so a destroyed object equals null, but `?.`, `??` and `is null` bypass it. Use `if (target)` or `target == null` for `UnityEngine.Object`.

## Async: Awaitable is Unity 6 only

`UnityEngine.Awaitable` (`NextFrameAsync`, `WaitForSecondsAsync`, `FixedUpdateAsync`, `EndOfFrameAsync`, `BackgroundThreadAsync`/`MainThreadAsync`) is Unity 6 only; it does not exist on 2022.3. On 2022.3 use coroutines, or `Task` with care.

- Async methods are not stopped by disable/destroy: pass `destroyCancellationToken` (MonoBehaviour property, available on 2022.3 and Unity 6) and catch `OperationCanceledException`.
- Await each `Awaitable` instance once; they are pooled. Prefer `async Awaitable` over `async void` except for Unity messages such as `Start`.
- After `BackgroundThreadAsync`, most Unity APIs are off-limits until `MainThreadAsync`.

## Serialization rules

- Expose tunables as `[SerializeField] private` fields; plain classes need `[System.Serializable]`.
- Renaming a serialized field wipes saved values in every scene, prefab and asset: add `[FormerlySerializedAs("oldName")]` (`UnityEngine.Serialization`).
- Each MonoBehaviour/ScriptableObject class lives in a file of the same name, or it shows "Missing script" / "The associated script can not be loaded".
- A `.meta` holds the GUID. Moving or renaming a file without its `.meta` creates a new GUID and breaks every reference. Agents must not invent `.meta` files; Unity writes them for new files on import.
- Properties, dictionaries, static and `readonly` fields are not serialized by default.

## ScriptableObjects: config, shared variables, event channels

```csharp
[CreateAssetMenu(fileName = "WeaponData", menuName = "Game/Weapon Data")]
public class WeaponData : ScriptableObject
{
    public int damage = 10;
    public float fireRate = 0.25f;
}

[CreateAssetMenu(menuName = "Game/Events/Int Event")]
public class IntEvent : ScriptableObject
{
    public event System.Action<int> OnRaised;
    public void Raise(int value) => OnRaised?.Invoke(value);
}
```

- An SO asset is shared by everyone who references it; per-object state (current HP) belongs on the MonoBehaviour.
- Play-mode edits to an SO persist in the Editor. Keep runtime state in `[System.NonSerialized]` fields and reset it. With Enter Play Mode Options and Reload Domain off, `OnEnable` does not rerun on Play: also reset from `EditorApplication.playModeStateChanged` or a `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]` method.
- Event channels: listeners register in `OnEnable`, unregister in `OnDisable`; raise by iterating backwards. Handlers run synchronously on the raiser's frame. Prefer concrete typed channels to open generics (Unity cannot create assets of open generic types).
- Runtime sets (enemies add themselves in `OnEnable`, remove in `OnDisable`) replace per-frame scene scans. Clear them at Play start.
- Assets ship only if referenced from a built scene, another included asset, `Resources` or Addressables.
- Do not hand-write `.asset` files: the `m_Script` GUID must match the script's `.meta`. Create assets via the Create menu or an `Editor`-folder script using `AssetDatabase.CreateAsset`; after code edits call `EditorUtility.SetDirty` then `AssetDatabase.SaveAssets`.

## 2022.3 vs Unity 6 API differences

| Topic | 2022.3 LTS | Unity 6 (6000.0) |
|---|---|---|
| Find all | `FindObjectsByType<T>(FindObjectsSortMode.None)` (also old `FindObjectsOfType<T>()`) | `FindObjectsByType<T>(FindObjectsSortMode.None)`; `FindObjectsOfType` is obsolete |
| Find one | `FindAnyObjectByType<T>()` / `FindFirstObjectByType<T>()` | same; `FindObjectOfType` obsolete |
| Rigidbody speed | `rb.velocity`, `rb.drag`, `rb.angularDrag` | `rb.linearVelocity`, `rb.linearDamping`, `rb.angularDamping` (old names warn) |
| Physics material | `PhysicMaterial` | `PhysicsMaterial` |
| Async waits | coroutines | `Awaitable` |
| Input actions | per-asset `InputActionAsset` | adds project-wide actions (`InputSystem.actions`) |

`FindObjectsByType`/`FindAnyObjectByType` exist on 2022.3, so code using them compiles on both baselines. Verify on 6000.0: whether `FindObjectsOfType` is a warning or already a hard error in the project's patch. All Find calls scan the scene: cache results, never call per frame. Upstream notes that later 6.x releases obsolete more Find overloads; that is not a baseline concern.

## Assembly definitions and tests

Tests need their own `.asmdef`. EditMode: `"includePlatforms": ["Editor"]`, references `UnityEngine.TestRunner`, `UnityEditor.TestRunner` and the game's runtime assembly, `"overrideReferences": true`, `"precompiledReferences": ["nunit.framework.dll"]`, `"defineConstraints": ["UNITY_INCLUDE_TESTS"]`, `"autoReferenced": false`. PlayMode: `"includePlatforms": []` and drop `UnityEditor.TestRunner`.

- An asmdef cannot reference the predefined `Assembly-CSharp`. If game scripts have no asmdef, adding one is a structural change: ask first, or keep tests to engine types built inside the test.
- EditMode tests: pure logic, SO data, asset contents. PlayMode tests (`[UnityTest]` returning `IEnumerator`): physics, animation, input, anything needing frames.
- Results are NUnit 3 XML: report `total`, `passed`, `failed` and failure messages, not just an exit code.

## Commands for the human (not run by agents)

- Compile check: `<Unity editor> -batchmode -nographics -quit -projectPath "<project>" -logFile "<abs>/compile.log"`, then search the log for `error CS`.
- Tests: `<Unity editor> -batchmode -nographics -projectPath "<project>" -runTests -testPlatform EditMode -testResults "<abs>/editmode.xml" -logFile "<abs>/tests.log"` (no `-quit`; use `PlayMode` for PlayMode tests). Close the project in the Editor first.
- Use the Editor version from `ProjectVersion.txt`.
