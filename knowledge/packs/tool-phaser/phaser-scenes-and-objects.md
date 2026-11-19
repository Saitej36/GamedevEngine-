---
id: phaser.scenes-and-objects
title: Phaser 3 scenes and game objects
tags: phaser, phaser 3, game config, pixelart, scale manager, scene, preload, create, update, init, scene manager, game objects, sprite, image, text, group, container, events, shutdown, cameras, tweens, timers
---
# Phaser 3 scenes and game objects

Assumed version: Phaser 3.90 with TypeScript or modern JavaScript. This is a Pixel Studio internal summary, not official
Phaser documentation; confirm details in the Phaser docs for the installed version. Phaser 4 has different APIs in
places; do not mix examples.

## Game configuration

A Phaser game starts from a config object passed to `new Phaser.Game(config)`:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,            // WebGL with Canvas fallback
  parent: 'game',               // id of the container element
  width: 320,
  height: 180,                  // low internal resolution for pixel art
  pixelArt: true,               // nearest-neighbour filtering, no antialias
  backgroundColor: '#1d1d2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 600 }, debug: false } },
  scene: [BootScene, PlayScene],  // the first scene starts automatically
};

new Phaser.Game(config);
```

For crisp pixel art, combine `pixelArt: true` with an internal resolution that scales by whole numbers to common screen
sizes (320×180 scales ×4 to 1280×720 and ×6 to 1920×1080). `FIT` scaling can produce non-integer scale factors; if
exact integer scaling matters, handle zoom yourself or accept slight unevenness.

## Scene lifecycle

A scene is a self-contained state of the game (boot/loading, title, play, pause overlay, game over). Lifecycle methods:

- `constructor()`: call `super('PlayScene')` with a unique key.
- `init(data)`: receives data passed when the scene starts; reset per-run fields here, because scene instances are
  reused when restarted.
- `preload()`: queue assets with `this.load.*`; Phaser waits for them before `create`.
- `create(data)`: build game objects, colliders, input and UI.
- `update(time, delta)`: per-frame logic; `delta` is milliseconds since the last frame.

Scene control: `this.scene.start('Key', data)` stops the current scene and starts another; `this.scene.launch('Key')`
runs another scene in parallel (useful for a HUD or pause overlay); `this.scene.pause()`, `resume()`, `stop()` and
`restart()` manage state. A common structure is a Boot/Preload scene that loads all shared assets and shows a progress
bar, then starts the Title scene.

## Game objects and the display list

Game objects are created through the scene's factory, `this.add`:

- `this.add.image(x, y, key)`: static image, no animation.
- `this.add.sprite(x, y, key, frame?)`: supports animations.
- `this.add.text(x, y, 'Score: 0', style)`; for pixel fonts, bitmap text (`this.add.bitmapText`) renders more crisply.
- `this.add.rectangle`, `this.add.graphics` for shapes and debug drawing.
- `this.add.container(x, y, children)`: groups objects that move together (containers have rendering and physics
  limitations; avoid deep nesting).
- `this.add.group()`: a logical collection, not a display parent; useful for pooling with `maxSize` and `get()`.

Objects render in creation order unless `setDepth(n)` is used; set depths explicitly for background, actors, effects and
UI. Origin defaults to the centre (0.5, 0.5); `setOrigin(0, 0)` for top-left. `setScrollFactor(0)` pins HUD elements to
the camera.

## Events and cleanup

Phaser uses EventEmitter-style events throughout: `this.events` (scene events), `this.game.events` (global), and
per-object events (`sprite.on('pointerdown', ...)` after `setInteractive()`).

- Use a scene-level emitter for gameplay notifications: `this.events.emit('score-changed', score)`.
- Listeners added to `this.game.events` or another scene's events outlive the current scene; remove them on
  shutdown: `this.events.once('shutdown', () => this.game.events.off('pause', this.onPause, this))`.
- Scene restarts reuse the instance, so leaked listeners fire twice after a restart; this is a top source of Phaser
  bugs.

## Cameras, timers and tweens

- Camera: `this.cameras.main.startFollow(player, true)`, `setBounds(0, 0, worldW, worldH)`, `setZoom(2)`. Camera
  `roundPixels` reduces shimmering for pixel art.
- Timers: `this.time.delayedCall(500, fn)` and `this.time.addEvent({ delay, callback, loop: true })`. Scene timers pause
  with the scene, unlike `setTimeout`.
- Tweens: `this.tweens.add({ targets: sprite, y: 100, duration: 300, ease: 'Sine.easeOut' })` for UI and juice.

Prefer scene timers over `setTimeout`/`setInterval`, which keep running when the scene pauses or stops.

## Keeping logic out of scenes

Scenes should translate between Phaser and pure game logic: read input, call `step(state, commands, dtSeconds)` from a
`src/core/` module, then sync sprites to the returned state. Pure modules must not import Phaser, so they can be unit
tested in Node. Keep the mapping from entity ids to sprites in the scene (`Map<number, Phaser.GameObjects.Sprite>`).

## Further reading
- https://docs.phaser.io
