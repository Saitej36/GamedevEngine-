# Game UI/UX: HUDs, Menus, Scaling, Focus and Accessibility

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/game-ui-ux/SKILL.md, skills/disciplines/game-ui-ux/references/layout-and-flow.md
> Source: https://github.com/Donchitos/claude-code-game-studios @ abc0de79d6ceb0b5d7aa693945849b3937afbe6a — .claude/agents/ux-designer.md, .claude/rules/ui-code.md, .claude/docs/templates/accessibility-requirements.md (UI scaling row)
> License: Apache-2.0 AND MIT (see licenses/). Modified by Pixel Studio: removed engine code for an engine Pixel Studio does not target and resolution-sweep command lines; re-targeted Unity 6.3 notes to Unity 6 / 2022.3 LTS; added UE 5.4 and Phaser 3.90 notes; merged the UX checklist and UI code rules; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Structure: screens as a stack, UI as display only

Model menus as a **screen stack**: push for overlays (pause, settings over pause, confirm dialog),
pop for back. Only the top screen takes input, and the screen below gets its focus back when the
top closes. Booleans such as `isPaused`, `inSettings`, `confirmOpen` break on the third overlay.

UI never owns or directly modifies game state; it displays state and sends commands or events to
request changes. UI must never block the game thread, all user-facing text goes through the
localization system, and UI sounds go through the audio event system. Map every user flow (boot →
menu → play, failure → retry) and name what each step does for the player before merging or
removing it.

## Layout with anchors and containers

Anchor to edges, corners or centre and let rows, columns and grids place children; a hard-coded
`(x, y)` is right at one resolution only. Set the pivot to the same corner as the anchor, or an
element grows in every direction when its size changes. Let containers **size to content**:
German text is often about 30 % longer than English. Keep icons separate from text, and leave room
for right-to-left mirroring and different number formats.

Diegetic UI (ammo on the gun) is immersive but harder to read; keep a non-diegetic fallback for
key information. World-space bars and damage numbers anchor to a world position, clamp to screen
edges when off-screen and scale with distance in 3D.

## Scaling and safe areas

Choose one scaling policy for the whole UI: a **reference resolution** (usually 1920×1080) that
scales to fit, plus an aspect rule. Default to expanding and anchoring HUD corners outward;
letterbox only when the design needs a fixed frame. HUD scaling should be independent of menu
scaling. Pixel-art UI needs integer scale steps or it shimmers.

Inset **critical** UI (health, timers, prompts) to the OS safe area, which excludes notches,
rounded corners and TV overscan; decorative art may bleed. Convert the pixel safe rect to anchors:
`anchorMin = (safe.x / screenW, safe.y / screenH)`, `anchorMax = ((safe.x + safe.w) / screenW,
(safe.y + safe.h) / screenH)`. Reapply on resize and orientation change, caching the last rect
rather than recomputing every frame. Test every screen at the minimum and maximum supported
resolutions, plus an ultrawide and a tall phone aspect.

## Gamepad focus and navigation

1. **Initial focus** on every screen open, and again when a screen above it closes. Nothing
   focused leaves a pad player stuck.
2. **Explicit neighbours** where the automatic guess is wrong.
3. A **focus style** distinct from hover, not colour alone.
4. Wrap or stop deliberately at list ends, and **trap focus inside modals**: focusing a dialog's
   button does not stop navigation reaching buttons behind it; disable focus on the screen below.
5. Mouse and pad coexist: mouse movement may move the selection, but never leave the screen with
   nothing selected. Every interactive element works with keyboard/mouse and gamepad.
6. Pause must not freeze the pause menu: menu animation uses unscaled time.

## Event-driven HUD

The HUD subscribes to events (`HealthChanged`, `ScoreChanged`) and updates only when a value
changes. Events do not replay, so set the initial value once on subscribe. Polling the player every
frame couples UI to gameplay internals and does work when nothing changed.

```csharp
void OnEnable() {
    player.HealthChanged += OnHealthChanged;
    OnHealthChanged(player.Hp, player.MaxHp);      // initial state
}
void OnDisable() => player.HealthChanged -= OnHealthChanged;
void OnHealthChanged(int hp, int max) =>
    bar.fillAmount = max > 0 ? Mathf.Clamp01((float)hp / max) : 0f;
```

## Accessibility minimums

| Requirement | Minimum |
|---|---|
| Body text at 1080p | 26 px on console/TV, 18 px on PC (Xbox Accessibility Guideline 101) |
| Text scaling | up to 200 % without clipping or lost meaning; UI scale range e.g. 75–150 % |
| Contrast | 4.5:1 for informational text, 3:1 for large text and key visuals (XAG 102) |
| Colour | never the only signal; add icon, shape or label; colour-blind modes |
| Touch targets | about 9 mm or larger, with padding |
| Motion and flashing | reduce-motion and reduce-flashing toggles; animations skippable |
| Input | usable with keyboard only and gamepad only; remappable controls |
| Audio | subtitles for all dialogue |

## Verification

- Focus check per screen: open each in turn and fail if nothing is focused.
- Screenshot sweep at 1280×720, 2560×1080 and 1080×2340; inspect for clipped or overlapping
  elements. Agents cannot run this; ask a human and record it as not executed until they report.
- Ask a human to unplug the mouse, play every menu with a pad, and report any screen where nothing
  is selected or focus escapes.

## Engine notes

- **Unreal Engine 5.4 (UMG):** anchors on Canvas Panel slots, Horizontal/Vertical/Grid boxes, the
  DPI scaling curve in project User Interface settings, and a Safe Zone widget for insets. Set
  focus with `SetUserFocus`/`SetKeyboardFocus` when a widget is shown. CommonUI (plugin) provides
  activatable widget stacks and gamepad routing; Verify on UE 5.4: CommonUI setup requirements.
- **Unity 6 / 2022.3 LTS:** UGUI `CanvasScaler` Scale With Screen Size, reference 1920×1080, Match
  0.5 (1.0 if vertical must never clip); `Screen.safeArea` mapped to a panel's anchors;
  `EventSystem.current.SetSelectedGameObject` in `OnEnable`. With the Input System, replace
  `StandaloneInputModule` with `InputSystemUIInputModule` or the pad is ignored. UI Toolkit keeps
  the same settings on `PanelSettings`; call `Focus()` on the first element.
- **Phaser 3.90:** the Scale Manager (`scale: { mode: Phaser.Scale.FIT, autoCenter:
  Phaser.Scale.CENTER_BOTH }`) handles fit; read CSS `env(safe-area-inset-*)` values via the DOM
  for notches. There is no built-in focus system: implement a focus index per screen with explicit
  neighbours, and run the HUD in its own scene that listens to game-scene events.
