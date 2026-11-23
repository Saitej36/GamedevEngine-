# Unreal 5.4 C++ and Blueprints: reflection, GC safety and the C++/Blueprint split

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unreal/unreal-cpp-gameplay/SKILL.md, skills/unreal/unreal-cpp-gameplay/references/components-and-gc.md, skills/unreal/unreal-blueprints/SKILL.md, skills/unreal/unreal-blueprints/references/communication.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — docs/engine-reference/unreal/current-best-practices.md, docs/engine-reference/unreal/breaking-changes.md, docs/engine-reference/unreal/deprecated-apis.md
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: re-targeted from UE 5.8 to UE 5.4; removed 5.5–5.9 features (C++20 floor, UE_LOGF, Blueprint scripting APIs, editor MCP), toolchain tables and shell build steps; merged the two sources and condensed.
> Engine target: Unreal Engine 5.4. Code is illustrative and has NOT been compiled or run.

## Reflection basics that must be right the first time

- Prefix matches the base: `A` actors, `U` other UObjects and components, `F` structs, `E` enums, `I` interfaces.
- `GENERATED_BODY()` is the first line inside the class body; `#include "Name.generated.h"` is the last include in the header.
- Match the module's API macro (`MYGAME_API`) and the existing `Public/` / `Private/` layout. Read `EngineAssociation` in the `.uproject` and confirm it says 5.4 before using any API from this page.
- `USTRUCT(BlueprintType)` / `UENUM(BlueprintType)` with `GENERATED_BODY()` in the struct make data usable as Blueprint variables. Plain values (ints, FString, FVector, POD structs) need no UPROPERTY for GC; they are owned by value.

```cpp
UCLASS()
class MYGAME_API APickup : public AActor
{
    GENERATED_BODY()
public:
    APickup();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Pickup")
    int32 ScoreValue = 10;
    UFUNCTION(BlueprintCallable, Category = "Pickup")
    void Collect();
protected:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Mesh;   // UPROPERTY keeps it alive
};
```

## GC-safe pointers and components

The garbage collector only keeps a UObject alive if it can reach it through a reflected reference.

- Owning members: `UPROPERTY() TObjectPtr<T>` (UE5 style; raw `T*` with UPROPERTY still compiles). Containers too: `UPROPERTY() TArray<TObjectPtr<AActor>>`.
- Non-owning references (a cached target, a listener): `TWeakObjectPtr<T>`, checked with `IsValid()`/`Get()` before each use.
- Plain C++ classes cannot use UPROPERTY: hold UObjects with `TStrongObjectPtr<T>` or derive from `FGCObject` and implement `AddReferencedObjects` plus `GetReferencerName`. `AddToRoot()` is a last resort.
- A raw `UObject*` member without UPROPERTY is the classic "random crash on a pointer that was valid". `IsValid()` on a dangling raw pointer does not save you.

Components: default subobjects are created **only in the constructor** with `CreateDefaultSubobject` and attached with `SetupAttachment`; set `RootComponent`. At runtime use `NewObject<T>(this)`, then `RegisterComponent()` (otherwise it never ticks or renders), then `AttachToComponent(...)`.

## Modules and Build.cs

Whenever you include another module's headers, add it to `PublicDependencyModuleNames` (or `Private...` if only `.cpp` files use it): `EnhancedInput`, `AIModule`, `GameplayTasks`, `UMG`, `Niagara`. Find the module name from the header's folder under `Engine/Source/` or `Engine/Plugins/`. Plugins also need enabling in the `.uproject`.

Not on 5.4 — added in 5.8: the C++20 minimum that makes `CppStandardVersion.Cpp17` an error. On 5.4, leave any existing `CppStandard` setting alone unless the human asks. Not on 5.4 — `UE_LOGF` (5.8); use `UE_LOG` with a declared log category.

## Gameplay framework placement

- GameMode: rules and default classes, **server only**; clients never have it.
- GameState / PlayerState: replicated data clients must see.
- PlayerController: input ownership and UI. Pawn/Character: the body. Components: reusable behaviour.
- Overrides of `BeginPlay`, `Tick`, `EndPlay`, `GetLifetimeReplicatedProps` must call `Super::`.
- Replication: `bReplicates = true` in the constructor, `UPROPERTY(ReplicatedUsing = OnRep_Health)`, register with `DOREPLIFETIME` (needs `#include "Net/UnrealNetwork.h"`). Change state on the server; react in `OnRep_`.

## C++ vs Blueprint split and Blueprint hooks

- C++: core systems, hot loops, large data, anything needing diffs and unit tests. Blueprint: content, tuning, designer-facing reactions. Blueprint Nativization is gone in UE5, so move hot logic to C++ by hand.
- `BlueprintImplementableEvent`: declared in C++, no C++ body, implemented only in Blueprint (`OnDeath()` for VFX/audio).
- `BlueprintNativeEvent`: C++ default in `Name_Implementation()`; Blueprint may override and call the parent. Call it from C++ as `Name()` (or `IMyInterface::Execute_Name(Obj)` for interfaces), never `Name_Implementation()` directly.
- Blueprint communication: Interface (Message node, safe on non-implementers) for "do this to whatever I hit"; Event Dispatcher (a `DECLARE_DYNAMIC_MULTICAST_DELEGATE` in C++, `BlueprintAssignable`) for one-to-many; Cast only to a class the caller already depends on, since a cast hard-loads that class and its dependencies. "Cast down, broadcast up."
- Construction Script reruns on every editor edit: no spawning, no timers. Gameplay init goes in BeginPlay. Prefer timers, Timelines and overlaps to Event Tick.
- Blueprints are binary `.uasset`: agents cannot edit them as text. Write node-by-node recipes for the human.

## Common UHT, linker and runtime errors

- **"Cannot open include file ...generated.h"** / UHT errors: generated include not last, `GENERATED_BODY()` missing, or a new file added while the editor ran and project files were not regenerated.
- **Unresolved external symbol**: the defining module is missing from Build.cs, or the class lacks the `MODULE_API` export.
- **Live Coding after header changes**: new UPROPERTYs/UFUNCTIONs rely on reinstancing and are unreliable; close the editor and do a full build. Verify on 5.4: whether Live Coding object reinstancing is on by default.
- **IDE build fights the running editor**: with Live Coding active, close the editor first or compile via Live Coding.
- **"Accessed None"** in Blueprint: a reference never set or destroyed; guard with Is Valid. Unbind dispatchers on EndPlay/Destruct.
- **Variable missing on placed instance**: Instance Editable off; for Spawn Actor also Expose on Spawn.
- A function-local Blueprint variable sharing a member's name can pick up the wrong default; on 5.4 nothing prevents this (the 5.8 guard is not on 5.4), so rename.

## Automation tests

Keep rules in plain structs so most tests need no world:

```cpp
#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FScoreAddsTest, "MyGame.Score.Adds",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FScoreAddsTest::RunTest(const FString& Parameters)
{
    FScoreBoard Board;  Board.Add(10);
    TestEqual(TEXT("score after one add"), Board.Total(), 10);
    return true;
}
#endif
```

Use functional tests in a test map for actor behaviour. A wrong test filter runs nothing and still looks clean, so the human should confirm the expected test names ran.

## Commands for the human (not run by agents)

- Build with the editor closed: `Engine/Build/BatchFiles/Build.bat <Project>Editor Win64 Development -Project="<abs path>.uproject" -WaitMutex` (Linux/Mac: `Build.sh` with `Linux`/`Mac`).
- Run tests headless: `UnrealEditor-Cmd "<abs path>.uproject" -ExecCmds="Automation RunTests MyGame.; Quit" -unattended -nullrhi -stdout`. Look for `Test Completed. Result={...}` lines and the final exit code.
- Compile all Blueprints: `UnrealEditor-Cmd "<abs path>.uproject" -run=CompileAllBlueprints -unattended -nullrhi`; read every Error/Warning naming your assets.
- Verify on 5.4: exact flag spelling (`RunTest` vs `RunTests`, `-ReportExportPath`) in the 5.4 automation docs.
