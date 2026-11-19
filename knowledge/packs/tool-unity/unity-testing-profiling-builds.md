---
id: unity.testing-profiling-builds
title: Unity testing, profiling and builds
tags: unity, unity test framework, nunit, editmode, playmode, unitytest, test runner, batchmode, profiler, frame debugger, memory profiler, development build, il2cpp, build settings
---
# Unity testing, profiling and builds

Assumed version: Unity 6 (6000.0 LTS), with notes for Unity 2022.3 LTS. This is a Pixel Studio internal summary, not
official Unity documentation; check the Unity Manual and the Unity Test Framework package documentation for the
project's exact version.

## Unity Test Framework basics

The Unity Test Framework (package `com.unity.test-framework`) runs NUnit-based tests inside Unity. Two modes:

- **EditMode tests** run in the editor without entering Play Mode. Use them for pure C# logic and editor code. Fast.
- **PlayMode tests** run with the player loop active, so MonoBehaviour callbacks, physics and coroutines work. Slower.

Tests live in folders with their own assembly definition that references the code under test and is marked as a test
assembly (the Test Runner window can create these). An EditMode test assembly is typically restricted to the Editor
platform.

Tests are run by a human from Window > General > Test Runner. Agents must never claim tests passed; write
"EditMode tests written, not executed" and list the test names.

## Writing EditMode and PlayMode tests

EditMode test of pure logic with NUnit `[Test]`:

```csharp
using NUnit.Framework;

public class DamageRulesTests
{
    [Test]
    public void ArmorReducesDamageButNeverBelowOne()
    {
        Assert.AreEqual(1, DamageRules.Apply(baseDamage: 3, armor: 10));
        Assert.AreEqual(5, DamageRules.Apply(baseDamage: 7, armor: 2));
    }
}
```

PlayMode test with `[UnityTest]`, which returns `IEnumerator` and can yield frames:

```csharp
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

public class PlayerFallsTests
{
    [UnityTest]
    public IEnumerator PlayerWithRigidbodyFallsUnderGravity()
    {
        var go = new GameObject("Player");
        go.AddComponent<Rigidbody2D>();
        float startY = go.transform.position.y;
        yield return new WaitForFixedUpdate();
        yield return new WaitForFixedUpdate();
        Assert.Less(go.transform.position.y, startY);
        Object.Destroy(go);
    }
}
```

Guidelines: prefer EditMode tests on plain C# classes (fast, deterministic); keep PlayMode tests few and focused on
engine integration; clean up created GameObjects; avoid waiting on real time with `WaitForSeconds` in tests where frame
or fixed-step yields suffice; use `[SetUp]`/`[TearDown]` for shared setup.

## Running tests from the command line

Unity can run tests headlessly for CI using batch mode. The commonly used form is:

```
<UnityEditor> -batchmode -projectPath <path> -runTests -testPlatform EditMode -testResults <path>/results.xml
```

`-testPlatform PlayMode` runs PlayMode tests. Results are written as NUnit-style XML. Flags and exit behaviour have
varied between versions, so the human should confirm against the Unity Test Framework documentation for the installed
package. Agents should give the command as a suggestion, not as something they ran.

## Profiling in Unity

Profile on the target device with a Development Build, because editor profiling includes editor overhead.

- **Profiler** (Window > Analysis > Profiler): CPU timeline and hierarchy, rendering, memory and physics modules. Look
  for the slowest markers, `GC.Alloc` per frame (target zero in steady gameplay), and spikes.
- **Frame Debugger** (Window > Analysis > Frame Debugger): steps through draw calls to see why batching breaks.
- **Memory Profiler** package: snapshots for texture, mesh and managed memory usage and leaks.
- Custom markers (`Unity.Profiling.ProfilerMarker` with `Begin`/`End` or `Auto()`) label your own code in the profiler.

When agents suggest optimizations, they should name the profiler module and marker the human should check.

## Builds and player settings

Builds are configured in Build Settings (Unity 6 calls the window Build Profiles). Key choices:

- **Development Build**: enables profiler connection and debugging; not for release.
- **Scripting backend**: Mono (faster iteration) or IL2CPP (ahead-of-time compiled; required for iOS and commonly used
  for Android release builds). IL2CPP can strip unused code; reflection-heavy code may need a `link.xml`.
- **Scenes in build**: the scene list and order; index 0 loads first.
- **Platform settings**: Android target architectures and minimum API level, iOS minimum version, texture compression.
- Scripted builds use `BuildPipeline.BuildPlayer` from an editor script, which lets CI produce builds without the UI.

## Unity release checklist

- [ ] All EditMode and PlayMode tests pass (results file attached by the human).
- [ ] Development Build and script debugging disabled; debug overlays and cheats compiled out.
- [ ] Correct scenes in build, in the correct order.
- [ ] Version and bundle version code incremented.
- [ ] Profiled on the lowest target device: frame time within budget, no per-frame GC allocations in gameplay.
- [ ] IL2CPP build tested if the release uses IL2CPP (stripping issues only appear there).
- [ ] Console free of errors and warnings on startup in the built player.

## Further reading
- https://docs.unity3d.com/Manual/index.html
- https://docs.unity3d.com/ScriptReference/index.html
