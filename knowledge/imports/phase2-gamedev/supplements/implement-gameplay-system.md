# Engine-specific verification for implement-gameplay-system (Unreal 5.4, Unity 6 / 2022.3, Phaser 3.90)

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unreal/unreal-cpp-gameplay/SKILL.md, skills/unreal/unreal-enhanced-input/SKILL.md, skills/unity/unity-csharp-scripting/SKILL.md, skills/unity/unity-csharp-scripting/references/agent-checks.md, skills/web-engines/phaser-core/SKILL.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: turned upstream "Verify" sections into pre-hand-off static checks for agents that cannot compile or run; re-targeted to UE 5.4, Unity 6 (6000.0) / 2022.3 LTS and Phaser 3.90; removed every shell, CLI and package-manager step; condensed.
> Engine target: Unreal Engine 5.4, Unity 6 (6000.0) and 2022.3 LTS, Phaser 3.90. Code is illustrative and has NOT been compiled or run.

## Additional workflow steps

1. Before writing engine code, record the exact engine version from project files: `EngineAssociation` in the `.uproject` (expect 5.4), `m_EditorVersion` in `ProjectSettings/ProjectVersion.txt` (2022.3.x or 6000.0.x), or the `phaser` version in `package.json` (3.90.x). Use only APIs valid on that version; if an API is version-sensitive and you are unsure, add a "Verify on <version>:" line to the hand-off instead of asserting it.
2. Keep the pure core module free of engine types so its unit tests remain the one thing the human can run cheaply; the engine adapter stays thin.
3. Unity: where 2022.3 and Unity 6 differ (`velocity` vs `linearVelocity`, `PhysicMaterial` vs `PhysicsMaterial`, `Awaitable`, project-wide input actions), write the form for the project's version and name the other form in a comment if the project may upgrade.
4. When the change needs editor-only work (Blueprint nodes, IMC/IA assets, prefabs, `.asmdef`, Project Settings, layer matrix), write the exact step-by-step editor instructions in the hand-off instead of editing binary or editor-managed files.

## Additional quality checks

- **Unreal 5.4**: each new header has `#pragma once`, its `.generated.h` as the last include, and `GENERATED_BODY()` first in the body; every UObject member is `UPROPERTY()` `TObjectPtr`, non-owning ones `TWeakObjectPtr`; components are created only in the constructor; overrides call `Super::`; every included module (`EnhancedInput`, `AIModule`, `UMG`…) is listed in the module's `Build.cs`; the API macro matches the module.
- **Unity**: file name equals class name; no `.meta` files were created, renamed or moved by hand; renamed serialized fields carry `[FormerlySerializedAs]`; physics runs in `FixedUpdate`, input edges in `Update`; every `+=` subscription in `OnEnable` has a `-=` in `OnDisable`; test files sit inside a test assembly whose `.asmdef` references the game assembly; destroyed-object checks use `== null`, not `?.`.
- **Phaser 3.90**: run state is reset in `init()`, not the constructor; assets used in `create` are queued in `preload` with matching keys; colliders and overlaps are registered once in `create`; registry and cross-scene listeners are removed on `shutdown`; no Phaser 4 APIs (`enableFilters`, `setLighting`, `setTintMode`).
- Re-read imports and include paths against real files with Glob/Grep.

## Additional failure conditions

- The engine version cannot be determined, or the code would need an API that exists only on a newer version (UE 5.5+, Unity 6.1+, Phaser 4): stop and report instead of upgrading or guessing.
- The hand-off would claim compilation, a passing test run, or in-editor behaviour without human-provided output. The status must read: "Not compiled or executed by the agent; tests not run. Static checks performed: <list>." List the editor or command-line checks the human should run and what result to report back (compiler errors, test totals and failures, console errors).
- A required Build.cs module, plugin, package or asmdef change falls outside programmer write permissions: report it as a human step rather than writing it.
