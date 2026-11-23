# Phaser 3.90 core: game config, scene lifecycle, loader and scene flow

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/web-engines/phaser-core/SKILL.md, skills/web-engines/phaser-core/references/scene-flow.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: re-targeted from Phaser 4.2 to Phaser 3.90 only; moved Phaser 4 renderer/filter/tint changes into a do-not-use section; removed the package-manager and browser-automation smoke test and all shell commands; marked the 4.2.1 keyboard diagnosis as unverified on 3.90; condensed.
> Engine target: Phaser 3.90. Code is illustrative and has NOT been compiled or run.

## One game, built from a config

```js
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PlayScene from './scenes/PlayScene.js';
import HudScene from './scenes/HudScene.js';

const config = {
  type: Phaser.AUTO,                 // WebGL, falls back to Canvas
  parent: 'game',                    // element id that holds the canvas
  width: 320, height: 180,
  pixelArt: true,                    // see "Pixel art" below
  backgroundColor: '#1d1d28',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },    // only if you use this.add.dom(); needs parent
  scene: [BootScene, PlayScene, HudScene], // later in list = drawn on top
};
const game = new Phaser.Game(config);
window.game = game;                  // for console debugging
```

- The first scene in the array, and any with `active: true`, starts on boot.
- Exactly one `Phaser.Game`. On hot reload or a React/Vue remount, call `game.destroy(true)` before creating another, or you get two canvases. Leave `noReturn` false so a new game can start.
- Keep game rules (score, turns, inventory, AI decisions) in plain modules with no Phaser import. Scenes draw state and send input commands; the rules stay unit-testable under Node.

## Scene lifecycle: init, preload, create, update

A scene instance is booted once and can be started many times. Each start runs `init(data)` → `preload()` → (loader runs) → `create(data)` → `update(time, delta)` every frame.

```js
export default class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }            // unique key; no run state here
  init(data) { this.level = data.level ?? 1; this.gameOver = false; }
  preload() {
    this.load.image('player', 'assets/player.png');
    this.load.spritesheet('coin', 'assets/coin.png', { frameWidth: 16, frameHeight: 16 });
  }
  create() {
    this.player = this.add.sprite(160, 90, 'player');
    this.cursors = this.input.keyboard.createCursorKeys();
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
  }
  update(time, delta) { /* delta is milliseconds: divide by 1000 for seconds */ }
}
```

- **Restart-state bug**: fields set in the constructor are set once and survive restarts. Reset run state in `init()`.
- The same `data` object goes to `init` and `create`, from `scene.start(key, data)` / `launch(key, data)`.
- Clear arrays of game objects on `shutdown`: `this.events.once('shutdown', () => { this.enemies.length = 0; })`.

## The loader

- Assets queued in `preload` are ready in `create`. "Undefined in create" means not queued, or a wrong key. A failed file shows as a 404 in the console and sprites using it draw the green-boxed missing texture.
- The cache is global: a key loaded in `BootScene` is usable in every scene. A common pattern is a Boot/Preload scene with a progress bar (`this.load.on('progress', p => ...)`, `this.load.on('complete', ...)`) that then calls `this.scene.start('menu')`.
- Loading outside `preload` (for example in `create`) needs `this.load.start()` and a `complete` listener.
- Paths are relative to the page, not the JS module; set `this.load.setPath('assets/')` or `baseURL` once.

## Scene transitions and a parallel HUD scene

| Call | Target | Caller |
|---|---|---|
| `start(key, data)` | start/restart | stopped |
| `launch(key, data)` | start in parallel; restarts if running | keeps running |
| `run(key, data)` | wake if asleep, resume if paused, else start | keeps running |
| `switch(key)` | wake or start | sleeps |
| `pause()` / `resume()` | stop/continue updating, still drawn | — |
| `sleep()` / `wake()` | stop updating and drawing, keep state | — |
| `stop()` | shut down, free objects | — |

- All of these are queued and applied at the start of the next game step: the target has not started on the next line.
- HUD: `launch('hud')` once, guarded with `isActive('hud')`. Using `start` stops gameplay. Draw order follows the scene list; call `bringToTop('hud')` if it was listed first. Toggle with `setVisible` or `sleep`/`wake`.
- Modal pause: `pause()` gameplay and `launch('pause-menu')`; `resume('play')` on close.
- Reusing a key requires removing the old scene first (`this.scene.remove('level')`, then `this.scene.add('level', NewLevel, true)`).

## Registry and events

```js
// HUD scene create(): react to changes instead of polling.
const onScore = (_parent, value) => this.scoreText.setText(`Score: ${value}`);
this.registry.events.on('changedata-score', onScore);
this.events.once('shutdown', () => this.registry.events.off('changedata-score', onScore));

// Gameplay scene:
this.registry.set('score', 0);
this.registry.inc('score', 10);                          // Verify on 3.90: DataManager.inc
this.scene.get('hud').events.emit('show-message', 'Level cleared!');
```

The registry and other scenes' emitters outlive a scene. Listeners added in `create` stack up on every restart unless removed on `shutdown` or added with `once`. `setdata-<key>` fires when a key is first set, `changedata-<key>` on later changes.

## Pixel art and roundPixels

- `pixelArt: true` turns off antialiasing (nearest-neighbour textures) and turns on `roundPixels`. Set it in the game config, not per sprite.
- Blurry or shimmering sprites: `pixelArt` missing, a non-integer camera zoom, or camera follow with lerp producing sub-pixel scroll. Use integer zoom, and `startFollow(target, true)` (roundPixels argument) with care at low lerp.
- `scale.mode: FIT` with a small base resolution (320×180) scales the canvas; CSS `image-rendering: pixelated` is handled by `pixelArt`. Verify on 3.90: whether `zoom` in the config or `Scale.FIT` gives crisper integer scaling for your target sizes.
- HTML overlays (`this.add.dom`) need `dom.createContainer` and `parent`, or you get "No DOM Container set in game config".

## Phaser 4 differences you must NOT use on 3.90

Upstream code written for Phaser 4 can look plausible but will fail or misbehave on 3.90:

- Filters: `obj.enableFilters()`, `obj.filters.internal/external`. On 3.90 use `preFX`/`postFX` and `BitmapMask`/`GeometryMask`.
- Lighting: `setLighting(true)` is Phaser 4. On 3.90 use `setPipeline('Light2D')` and `this.lights.enable()`.
- Tint: `setTintMode(Phaser.TintModes.FILL)` is Phaser 4. On 3.90 `setTintFill(color)` is correct.
- `Phaser.Math.TAU`: different meaning in v4 (2π); on 3.90 do not rely on it, write `Math.PI * 2` or `Math.PI / 2` explicitly.
- `Geom.Point` exists on 3.90 but was removed in v4; prefer `Phaser.Math.Vector2` anyway for forward compatibility.
- v4 renderer extension points differ entirely; 3.90 custom pipelines (`Renderer.WebGL.Pipelines`) do not port, and vice versa.
- `roundPixels` defaults differ between majors; on 3.90 set `pixelArt: true` explicitly rather than relying on defaults.
- Upstream's "keys stay down when the host page calls `preventDefault` on keyup" diagnosis was checked only on 4.2.1. Verify on 3.90 before applying it; `this.input.keyboard.resetKeys()` exists for clearing stuck keys once.

## Browser console checks for the human

With `window.game` exposed: `game.scene.dump()` lists scene states (black screen with no error usually means no scene started); `game.scene.getScenes(true).map(s => s.sys.settings.key)` shows running scenes; `game.renderer.type` is `Phaser.WEBGL` (2) or `Phaser.CANVAS` (1). Ask the human to report console errors and what is drawn.
