---
id: unreal.gameplay-framework
title: Unreal Engine gameplay framework
tags: unreal, ue5, gameplay framework, aactor, apawn, acharacter, agamemodebase, agamestatebase, aplayercontroller, aplayerstate, gameinstance, subsystem, beginplay, tick, enhanced input, gameplay ability system, gas, replication
---
# Unreal Engine gameplay framework

Assumed version: Unreal Engine 5.4. This is a Pixel Studio internal summary, not official Epic documentation; check the
Unreal Engine documentation for exact class names and behaviour in the project's version.

## Framework classes and their responsibilities

The Unreal gameplay framework assigns each concern to a class. Putting logic in the right class avoids multiplayer bugs
and lifetime surprises.

| Class | Responsibility | Lifetime / location |
|---|---|---|
| `AGameModeBase` / `AGameMode` | Rules: who spawns where, win/lose conditions, default classes | Server only, per level |
| `AGameStateBase` / `AGameState` | Match state everyone needs (time left, team scores) | Replicated to all clients |
| `APlayerController` | Player's will: input, camera, UI ownership | One per player |
| `APlayerState` | Per-player data others see (name, score) | Replicated, survives pawn death |
| `APawn` | A controllable body | Possessed by a controller |
| `ACharacter` | Pawn with capsule, skeletal mesh and `UCharacterMovementComponent` | Humanoid walking/jumping |
| `AHUD` / UMG widgets | Presentation | Owned by the player controller |
| `UGameInstance` | Data that persists across level loads | Whole application run |

`AGameMode` adds match-state handling on top of `AGameModeBase`; small single-player games usually use `AGameModeBase`.
Because the game mode does not exist on clients, never put state that the UI needs only in the game mode.

## Actors, components, BeginPlay and Tick

`AActor` is anything placed or spawned in a level. Behaviour is usually composed of components (`UActorComponent` for
logic, `USceneComponent` for things with a transform, primitive components for collision and rendering).

- Constructor: create default subobjects and set defaults only. Do not access the world or other actors.
- `BeginPlay()`: runtime initialisation; always call `Super::BeginPlay()`.
- `Tick(float DeltaSeconds)`: per-frame update. Ticking must be enabled with `PrimaryActorTick.bCanEverTick = true` in
  the constructor. Disable tick on actors that do not need it; prefer timers (`GetWorldTimerManager().SetTimer(...)`)
  or events for infrequent work.
- `EndPlay(const EEndPlayReason::Type EndPlayReason)`: cleanup when removed or the level ends.
- Multiply rates by `DeltaSeconds`. Character movement already handles frame-rate-independent movement.

## Enhanced Input

Enhanced Input is the default input system in UE5. Assets: `UInputAction` (an action such as Move, value type bool, 1D,
2D or 3D) and `UInputMappingContext` (bindings from keys to actions, with modifiers and triggers).

Typical C++ setup in a character or controller:

1. Add `"EnhancedInput"` to the module's `Build.cs` dependencies.
2. Add the mapping context through `UEnhancedInputLocalPlayerSubsystem` (obtained from the local player) with
   `AddMappingContext(Context, Priority)`, commonly in `BeginPlay` of the player controller or pawn.
3. In `SetupPlayerInputComponent`, cast the input component to `UEnhancedInputComponent` and call
   `BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyCharacter::Move)`.
4. In the handler, read `const FInputActionValue& Value` with `Value.Get<FVector2D>()`.

Expose `UInputAction*` and `UInputMappingContext*` as `UPROPERTY(EditDefaultsOnly)` so the human assigns assets in the
Blueprint; list those assignments in the hand-off.

## Subsystems

Subsystems are auto-instanced singletons with managed lifetimes: `UGameInstanceSubsystem` (whole run),
`UWorldSubsystem` (per world), `ULocalPlayerSubsystem` (per local player), and engine/editor subsystems. They are a
cleaner home for services (save system, quest tracking, audio routing) than global singletons or bloated game modes.
Access them through the owning object, for example `GetGameInstance()->GetSubsystem<USaveSubsystem>()`.

## Gameplay Ability System basics

The Gameplay Ability System (GAS) is a plugin for abilities, attributes and effects, used in many action and RPG games.
Core pieces: `UAbilitySystemComponent` (on the actor or player state), `UGameplayAbility` (an action such as Dash),
`UAttributeSet` (Health, Stamina), Gameplay Effects (data that modifies attributes, instant or over time) and Gameplay
Tags (hierarchical labels like `State.Stunned`). GAS has significant setup cost; a common heuristic is to adopt it only
when the design has many interacting abilities, buffs and cooldowns, or multiplayer prediction. For small games, a
plain component with health and cooldown timers is easier to test.

## Replication essentials

If the game is multiplayer, the server is authoritative. Mark actors `bReplicates = true`, replicate properties with
`UPROPERTY(Replicated)` or `ReplicatedUsing=OnRep_X` plus `GetLifetimeReplicatedProps`, and send client requests via
`UFUNCTION(Server, Reliable)` RPCs. State that changes gameplay must be modified on the server; clients only predict or
present. Single-player projects should still respect the class responsibilities above, which keeps a later port possible.

## Further reading
- https://dev.epicgames.com/documentation/en-us/unreal-engine
