# Input Systems: Actions, Buffering, Rebinding and Devices

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/input-systems/SKILL.md, skills/disciplines/input-systems/references/buffering-and-accessibility.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: replaced engine-specific code for an engine Pixel Studio does not target with C# and TypeScript; removed the headless binding-audit script and its command (kept as a prose checklist); added notes for UE 5.4 Enhanced Input, the Unity Input System (Unity 6 / 2022.3 LTS) and Phaser 3.90 input; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Actions over raw keys

Gameplay reads named **actions** by intent (`jump`, `attack`, `move`); bindings from keys, buttons
and touch to those actions are data. Rebinding, multi-device play and most input accessibility
follow from this one indirection. Give every action a keyboard/mouse binding and a gamepad
binding; route touch through the same actions.

Match the read to the action. **Edge** reads (pressed this frame or tick) for discrete actions;
**held** or **axis** reads for continuous ones. A held check for jump re-fires every frame; an edge
check for movement drops held input. Before editing a project, inventory the existing actions
and search gameplay code for raw key reads; outside debug tools that count should reach zero.

## Analog sticks: radial dead zone and response curve

Sticks never rest at exactly zero. Apply a **radial** dead zone on the vector length, then rescale
so output ramps from 0 at the dead-zone edge. Per-axis dead zones carve a square hole and snap
movement to the axes.

```csharp
static Vector2 ApplyDeadzone(Vector2 stick, float dead = 0.2f, float curve = 1f) {
    float mag = stick.magnitude;
    if (mag <= dead) return Vector2.zero;
    float scaled = Mathf.Min((mag - dead) / (1f - dead), 1f); // some pads exceed 1 on diagonals
    return stick / mag * Mathf.Pow(scaled, curve);           // curve > 1 = finer aim near centre
}
```

Keep the response curve separate from sensitivity (a gain on the result, typically a camera turn
rate) and expose both, plus independent X and Y inversion. Validate settings (`0 ≤ dead < 1`,
`curve > 0`) instead of dividing by zero.

## Buffering discrete presses

A buffer remembers a press that arrived slightly before it was legal (attack during recovery,
dodge during landing, menu confirm during a transition) and fires it the moment it is allowed.

- Window 100–200 ms for attacks and dodges; combo links in fighting games are often tighter and
  fixed per move.
- Measure in **game time** advanced in the fixed step, so the window freezes during pause and
  hit-stop. Wall-clock time lets it expire during a freeze.
- **Consume** on fire (one press, one action) and **clear** on death, pause, cutscene and scene
  change, or presses fire twice or after a respawn.
- When two buffered actions become legal on the same tick, pick by a fixed priority, not by
  container order.
- Jump buffering and coyote time use the same idea but belong to the jump controller.

## Rebinding with conflict handling

1. Enter "listening" for one action; capture the next press, ignoring releases, key repeat and stick
   noise below about 0.5.
2. Bind the **physical key position**, not the layout's letter, so WASD stays in place on AZERTY or
   Dvorak; display the player's own layout label.
3. Store gamepad bindings for **all devices**, or a rebound button works only for pad 1.
4. Reject or offer to swap when another action already uses the input. Two actions never active at
   the same time (menu versus gameplay) may share a key; list such pairs explicitly.
5. Persist overrides with the settings file, load them before the first gameplay frame, and offer
   reset to defaults. Keep a way back to the pause menu that cannot be unbound.

Binding audit, as a review checklist: every action has a keyboard/mouse and a gamepad binding
(except a named keyboard-only list); no two simultaneously active actions share an input
(compare exactly, so opposite directions of one stick axis do not count as a conflict).

## Device switching and prompts

Track the **last-used device** on every input event and swap glyphs and tutorial text immediately,
without a restart; players pick up a pad mid-session. Map buttons by **position** (South, East,
West, North), then choose an icon set per controller family: the South button is Xbox A,
PlayStation Cross and Nintendo B. When Steam Input is active, the game sees an emulated
Xbox-style pad, so name-based detection reports Xbox for every pad; ask Steam for the real type or
its glyphs. Touch controls use a floating virtual stick with the same radial dead zone, large hit
areas and no precise multi-touch chords.

## Accessibility checklist

- Full remapping of every action on every device, with conflict handling and reset.
- Toggle versus hold for actions that default to hold (aim, crouch, sprint).
- No required simultaneous inputs for essential actions; offer single or sequential alternatives.
- Adjustable stick sensitivity, dead zone and optional aim assist.
- Adjustable timing windows (longer buffers, slower quick-time events) and a hold option instead
  of button mashing.
- No artificial input delay.

## Engine notes

- **Unreal Engine 5.4 (Enhanced Input):** `UInputAction` assets per action, grouped in
  `UInputMappingContext` assets added through the `UEnhancedInputLocalPlayerSubsystem` with a
  priority (gameplay versus menu contexts). Triggers (Pressed, Hold, Tap) express edge versus held;
  modifiers handle dead zones, swizzle and negate. Verify on UE 5.4: the Dead Zone modifier's
  radial mode and default thresholds, and the status of Enhanced Input User Settings with
  player-mappable keys before building a rebind screen on them.
- **Unity Input System (Unity 6 / 2022.3 LTS):** an `.inputactions` asset with action maps;
  `WasPressedThisFrame()` for edges, `ReadValue<Vector2>()` for sticks; the Stick Deadzone processor
  is radial. Rebinding via `PerformInteractiveRebinding()` with `WithCancelingThrough`, persisted
  with `SaveBindingOverridesAsJson()` / `LoadBindingOverridesFromJson()`. `PlayerInput`'s controls
  changed callback drives glyph swaps. Project-wide actions are a Unity 6-era feature. Verify on
  your package version: the default dead-zone min and max values.
- **Phaser 3.90:** no action layer is built in; write a small TypeScript `Actions` map from action
  names to key codes and pad buttons, read with `Phaser.Input.Keyboard.JustDown(key)` for edges and
  `key.isDown` for held. For physical positions, use the DOM `KeyboardEvent.code` delivered with
  keyboard events. Gamepads require `input: { gamepad: true }` in the game config; browsers expose
  a pad only after a button press, and the standard mapping puts the South button at index 0.
  Buffer presses using the scene's game time, not `Date.now()`.
