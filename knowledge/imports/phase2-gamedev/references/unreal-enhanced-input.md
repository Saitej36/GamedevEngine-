# Unreal 5.4 Enhanced Input: actions, mapping contexts, triggers and buffering

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unreal/unreal-enhanced-input/SKILL.md, skills/unreal/unreal-enhanced-input/references/cpp-setup.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: re-targeted from UE 5.8 to UE 5.4; removed 5.8-only changes (Common UI unification, Input Debugger, CVar fixes, Combo deprecation) or marked them; removed grep/shell and headless test commands; added an input-buffering pattern; condensed.
> Engine target: Unreal Engine 5.4. Code is illustrative and has NOT been compiled or run.

## The data model

- **Input Action (`IA_`)**: one asset per player intent, with a Value Type: `Digital (bool)` for buttons, `Axis1D (float)` for throttle/triggers, `Axis2D (Vector2D)` for move and look, `Axis3D` rarely.
- **Input Mapping Context (`IMC_`)**: which keys produce which actions. Several contexts can be active at once, ordered by priority; a higher-priority context that maps the same key consumes it.
- **Modifiers** shape the raw value (Negate, Dead Zone, Swizzle Input Axis Values, Scalar, Smooth). **Triggers** decide when the action fires (Down is the implicit default; Pressed, Released, Hold, Hold And Release, Tap, Pulse, Chorded Action, Combo).
- On 5.4 Enhanced Input is the default input system (since 5.1) and legacy `BindAction("Jump", IE_Pressed, ...)` / `BindAxis` mappings are deprecated. Check Project Settings > Input > Default Player Input Class = `EnhancedPlayerInput` and Default Input Component Class = `EnhancedInputComponent` in older projects.

## WASD into one Axis2D action

In `IMC_Default` map `IA_Move` to: W (Swizzle YXZ), S (Swizzle YXZ + Negate), D (no modifier), A (Negate). Add Dead Zone on gamepad sticks. Swizzle moves the key's 1D value onto Y; Negate flips it. `IA_Look` to Mouse XY (Negate Y for non-inverted pitch if needed) and the right stick. `IA_Jump` (Digital) to Space Bar and the bottom face button. Assign the IMC and IA assets on the Blueprint subclass of the C++ Character.

## Adding the context and binding in C++

Build.cs needs `"EnhancedInput"` (plus `"InputCore"`). Includes: `EnhancedInputComponent.h`, `EnhancedInputSubsystems.h`, `InputActionValue.h`.

```cpp
void AMyCharacter::PawnClientRestart()
{
    Super::PawnClientRestart();          // owning client, after possession
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
        if (ULocalPlayer* LP = PC->GetLocalPlayer())
            if (auto* Sub = LP->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
                Sub->AddMappingContext(DefaultMappingContext, 0);
}

void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    if (auto* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyCharacter::Move);
        EIC->BindAction(JumpAction, ETriggerEvent::Started,   this, &ACharacter::Jump);
        EIC->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
    }
}

void AMyCharacter::Move(const FInputActionValue& Value)
{
    const FVector2D Axis = Value.Get<FVector2D>();            // IA_Move is Axis2D
    const FRotator Yaw(0, Controller->GetControlRotation().Yaw, 0);
    AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), Axis.Y);
    AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), Axis.X);
}
```

- Declare the assets as `UPROPERTY(EditAnywhere, Category="Input") TObjectPtr<UInputMappingContext>` / `TObjectPtr<UInputAction>`, forward-declared in the header.
- Do not name the parameter `InputComponent`: it shadows `AActor::InputComponent`.
- Adding the context in `BeginPlay` works in single player but breaks on clients and after respawn because `GetController()` can still be null. `PawnClientRestart` or the PlayerController is the robust place.
- Blueprint equivalent: on Possessed (or the PlayerController's BeginPlay) get the Enhanced Input Local Player Subsystem, Add Mapping Context; then use `EnhancedInputAction IA_Move` event nodes.

## Trigger events and mode switching

- `Triggered`: fires every tick while the trigger condition holds (continuous move/look). With the default Down trigger it repeats every frame while held, which is wrong for one-shot actions.
- `Started` / `Completed`: press and release edges (jump, fire, interact). `Ongoing` and `Canceled` matter for Hold/Tap triggers: a Hold released early reports `Canceled`, not `Triggered`.
- Read the value with the `Get<T>()` matching the Value Type; a mismatch returns zero silently.
- Switch modes (on foot vs vehicle vs menu) by `RemoveMappingContext` / `AddMappingContext`, or by priorities. A UI-only `SetInputMode` blocks game input entirely.
- Combo trigger: exists on 5.4, but the upstream source reports it was deprecated in 5.8 as unreliable. Prefer your own sequence logic on `Started` events for fighting-game style combos.
- Touch bound to a Digital action can stay true after release on versions before 5.8 (the touch key carries screen position as its value). On 5.4 bind touch to `Started`/`Completed`.

## Input buffering pattern

Enhanced Input does not buffer for you. Record the press time on `Started` and consume it when the gameplay state allows, so a jump pressed slightly before landing still fires:

```cpp
void AMyCharacter::OnJumpStarted(const FInputActionValue&)
{
    LastJumpPressTime = GetWorld()->GetTimeSeconds();
}

void AMyCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const bool bBuffered = GetWorld()->GetTimeSeconds() - LastJumpPressTime <= JumpBufferSeconds;
    if (bBuffered && CanJump())
    {
        Jump();
        LastJumpPressTime = -1000.0;     // consume once
    }
}
```

Keep `JumpBufferSeconds` (for example 0.1–0.15 s) as a designer-tunable `UPROPERTY`. The same shape works for attack buffering during recovery frames: store the intent and timestamp, consume on the first frame the combo window opens. Coyote time is the mirror image (remember when the character left the ground).

## Player rebinding

Editing the IMC asset changes the default for everyone and is not saved per player. The supported path is Enhanced Input User Settings: enable User Settings in Project Settings > Engine > Enhanced Input, give each remappable mapping Player Mappable Key Settings with a unique Name, register the context with the subsystem's user settings, then remap with `UEnhancedInputUserSettings::MapPlayerKey` (an `FMapPlayerKeyArgs`), reset with `UnMapPlayerKey`, and persist with `SaveSettings`. The settings object belongs to the local player's subsystem.

Verify on 5.4: User Settings matured between 5.2 and 5.4 and was marked experimental for part of that time; confirm the exact names of `FModifyContextOptions::bNotifyUserSettings`, `RegisterInputMappingContext` and `FMapPlayerKeyArgs` in the 5.4 headers before relying on them. The older `UPlayerMappableInputConfig` route is deprecated in favour of User Settings.

## Debugging checklist (ask the human)

- In PIE, console `showdebug enhancedinput`: lists active contexts, priorities and live action values. Not on 5.4 — the dedicated Input Debugger UI was added in 5.8.
- No input at all: context never added, added before a local player existed, wrong IMC asset assigned, or UI-only input mode.
- Works in single player but not on a client or after respawn: context added in `BeginPlay`.
- Fires every frame: `Triggered` with the default Down trigger on a button.
- A key works in one mode but not another: a higher-priority context maps it.
- Unresolved symbols at link: `EnhancedInput` missing from Build.cs.
- For automated regression, a functional test can inject input with the subsystem's `InjectInputForAction`. Verify on 5.4: its signature in `EnhancedInputSubsystemInterface.h`.
