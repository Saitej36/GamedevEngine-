---
id: unreal.testing-profiling-packaging
title: Unreal Engine testing, profiling and packaging
tags: unreal, ue5, automation test, implement_simple_automation_test, session frontend, test automation, stat unit, stat fps, unreal insights, profiling, packaging, build configuration, shipping, development, runuat, buildcookrun
---
# Unreal Engine testing, profiling and packaging

Assumed version: Unreal Engine 5.4. This is a Pixel Studio internal summary, not official Epic documentation; testing
flags, console commands and packaging options change between versions, so confirm in the Unreal Engine documentation.

## Automation tests

The Automation system runs C++ tests inside the editor or a headless editor process. Simple tests suit pure logic:

```cpp
// Source/MyGame/Private/Tests/DamageRulesTest.cpp
#include "Misc/AutomationTest.h"
#include "DamageRules.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDamageRulesArmorTest,
    "MyGame.Combat.DamageRules.ArmorNeverReducesBelowOne",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDamageRulesArmorTest::RunTest(const FString& Parameters)
{
    TestEqual(TEXT("High armor floors at 1"), FDamageRules::Apply(3, 10), 1);
    TestEqual(TEXT("Normal case"), FDamageRules::Apply(7, 2), 5);
    return true;
}

#endif
```

Notes:

- The test name string is a dotted path used for filtering (`MyGame.Combat...`); keep a project prefix.
- Helpers on the test object include `TestEqual`, `TestTrue`, `TestFalse`, `TestNotNull` and `AddError`.
- Context and filter flag names have changed in some engine versions (for example around application context masks in
  5.5). Copy the flag style from an existing test in the installed engine version if the build fails.
- `IMPLEMENT_COMPLEX_AUTOMATION_TEST` generates multiple parameterised tests; latent commands support tests that span
  frames. Spec-style tests (`BEGIN_DEFINE_SPEC`) offer describe/it structure.
- Functional tests (`AFunctionalTest` actors placed in a test map) cover in-world behaviour.

## Running automation tests

Humans run tests from the editor via Tools > Test Automation (the Session Frontend automation tab in some versions),
filtering by the name prefix. For CI, a common pattern is the command-line editor with automation commands:

```
UnrealEditor-Cmd <Project>.uproject -ExecCmds="Automation RunTests MyGame.;Quit" -unattended -nullrhi -log
```

The exact executable name and path differ by platform. Agents give this as a suggested command and report tests as
"written, not compiled, not executed" until a human supplies the log.

## Profiling

Unreal provides layered profiling tools:

- `stat fps` and `stat unit` (console): frame time split into Game thread, Draw (render) thread, GPU and RHI. The
  largest of these is the bottleneck; if Game dominates, look at Tick and gameplay code; if GPU dominates, look at
  rendering.
- `stat game`, `stat scenerendering` and other `stat` groups give subsystem counters.
- **Unreal Insights**: trace-based CPU/GPU timelines, memory and asset loading. Start the game with tracing enabled
  (for example `-trace=cpu,frame,gpu`), then open the trace in Unreal Insights. Add named scopes to your own code with
  `TRACE_CPUPROFILER_EVENT_SCOPE(Name)` so it shows up in the timeline.
- `ProfileGPU` (or the GPU Visualizer) breaks down GPU passes.

Profile packaged Development or Test builds on target hardware; editor play-in-editor numbers include editor overhead.

## Build configurations

Unreal build configurations:

- **DebugGame**: game code unoptimised for debugging, engine optimised.
- **Development**: default; optimised with logging, console commands and stats available.
- **Test**: close to Shipping but keeps some profiling support.
- **Shipping**: release; console, stats and most logging stripped.

Code guarded by `#if !UE_BUILD_SHIPPING` is removed from Shipping, which is the right place for cheats and debug draw.

## Packaging

Packaging cooks content (converts assets to platform formats) and builds the executable. From the editor: Platforms
menu, choose the platform and Package Project, with the build configuration selected there. From the command line, the
Unreal Automation Tool's `BuildCookRun` command (via `RunUAT`) performs build, cook, stage and package, and is what CI
uses. Before packaging:

- Set the default maps (Project Settings > Maps & Modes) and check every map to be shipped is included in the cook.
- Assets referenced only by string path may not be cooked; use soft object references or add directories to cook.
- Set the project version and platform settings (icons, SDK versions, signing for mobile and consoles).

## Unreal release checklist

- [ ] Automation tests pass in a Development build (log attached by the human).
- [ ] Shipping build packaged and launched on each target platform; no missing assets (pink materials, empty meshes).
- [ ] `stat unit` within frame budget on the lowest target hardware in the heaviest level.
- [ ] Cheats and debug draw compiled out of Shipping.
- [ ] Save game compatibility checked against the previous version.
- [ ] Logs from a packaged run reviewed for errors and warnings.

## Further reading
- https://dev.epicgames.com/documentation/en-us/unreal-engine
