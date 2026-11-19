---
id: unreal.cpp-and-blueprints
title: Unreal Engine C++ and Blueprints
tags: unreal, ue5, c++, blueprints, uclass, uproperty, ufunction, generated_body, blueprintcallable, blueprintimplementableevent, blueprintnativeevent, reflection, garbage collection, tobjectptr, live coding
---
# Unreal Engine C++ and Blueprints

Assumed version: Unreal Engine 5.4 (most content applies to 5.x). This is a Pixel Studio internal summary, not official
Epic documentation; verify macros, specifiers and class names in the Unreal Engine documentation for the project's
version.

## Splitting work between C++ and Blueprints

Unreal projects usually combine C++ and Blueprints. A common split:

- **C++**: core systems, performance-sensitive code, data structures, rules that need automated tests, base classes
  exposing tunable properties and hooks.
- **Blueprints**: content-specific subclasses, wiring assets (meshes, sounds, effects), level scripting, quick
  iteration on behaviour by designers, UI (UMG Widget Blueprints).

Rule of thumb: logic lives in C++ base classes; Blueprint subclasses (`BP_Enemy` derived from `AEnemyBase`) set
values and assets and implement presentation events. Blueprints are binary `.uasset` files: agents cannot write or
read them meaningfully, so agent deliverables are C++ plus written instructions for Blueprint setup.

## The reflection macros

Unreal's reflection system (Unreal Header Tool) generates code from macros so classes appear in the editor, Blueprints,
serialisation and garbage collection.

```cpp
// EnemyBase.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "EnemyBase.generated.h"   // must be the last include

UCLASS()
class MYGAME_API AEnemyBase : public AActor
{
    GENERATED_BODY()

public:
    AEnemyBase();

    UFUNCTION(BlueprintCallable, Category = "Enemy")
    void ApplyDamage(int32 Amount);

    UFUNCTION(BlueprintImplementableEvent, Category = "Enemy")
    void OnDefeated();   // implemented in the Blueprint subclass, no C++ body

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Enemy")
    int32 MaxHealth = 3;

    UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Enemy")
    int32 Health = 0;
};
```

Key points: `UCLASS`, `USTRUCT` and `UENUM` mark reflected types; `GENERATED_BODY()` goes at the top of the class body;
the `.generated.h` include must be last; `MYGAME_API` is the module's export macro (named after the module).

## Common specifiers

`UPROPERTY` specifiers control editor and Blueprint access:

- `EditAnywhere` / `EditDefaultsOnly` / `EditInstanceOnly`: editable in the editor (on archetype and instances, only
  on class defaults, or only on placed instances).
- `VisibleAnywhere` / `VisibleDefaultsOnly` / `VisibleInstanceOnly`: shown read-only; typical for component pointers.
- `BlueprintReadOnly` / `BlueprintReadWrite`: access from Blueprint graphs.
- `Category = "..."` groups properties in the Details panel and Blueprint menus; always set one for consistency.

`UFUNCTION` specifiers:

- `BlueprintCallable`: Blueprints can call the C++ function.
- `BlueprintPure`: callable with no execution pin; must not change state.
- `BlueprintImplementableEvent`: declared in C++, implemented only in Blueprint; C++ calls it as a hook.
- `BlueprintNativeEvent`: has a C++ default implementation in `FunctionName_Implementation`, overridable in Blueprint.

Prefer `EditDefaultsOnly` for tuning values so designers set them once per Blueprint class.

## Memory and garbage collection

`UObject`-derived objects are garbage collected. A `UObject` pointer stored in a member is only tracked if the member is
a `UPROPERTY` (UE5 recommends `TObjectPtr<T>` for member pointers). Raw unmarked pointers to UObjects can become
dangling after collection. Other rules:

- Create components in the constructor with `CreateDefaultSubobject<T>(TEXT("Name"))`; spawn actors at runtime with
  `GetWorld()->SpawnActor<T>(...)`; create other UObjects with `NewObject<T>(Outer)`.
- Use `IsValid(Ptr)` before using actors that may have been destroyed.
- Plain C++ structs and classes (non-UObject) use normal C++ ownership (`TUniquePtr`, `TSharedPtr`, values).

## Keeping logic testable

Unreal Automation tests can test plain functions without spawning a world. Put rules in static functions, plain structs
or `UObject`s that do not need a level, for example `FDamageRules::Apply(int32 Base, int32 Armor)`. Actors call these
functions and handle presentation. This keeps the tested surface large even though agents cannot run the editor.

## Compiling and agent hand-off

C++ changes require compiling (from the IDE, or Live Coding in the editor). Live Coding handles function body changes
well; header changes that alter reflected layout (new `UPROPERTY`, new `UCLASS`) are safer with a full editor restart
and rebuild. Agents cannot compile, so hand-offs must list: files added or changed, the module's `Build.cs` dependencies
added (for example `"EnhancedInput"`), Blueprint steps the human performs (reparent `BP_Enemy` to `AEnemyBase`, set
`MaxHealth`), and "Not compiled. Not executed."

## Further reading
- https://dev.epicgames.com/documentation/en-us/unreal-engine
