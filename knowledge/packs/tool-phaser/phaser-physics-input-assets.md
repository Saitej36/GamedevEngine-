---
id: phaser.physics-input-assets
title: Phaser 3 physics, input and assets
tags: phaser, arcade physics, collider, overlap, static group, body, velocity, gravity, keyboard, createcursorkeys, addkey, justdown, pointer, touch, loader, load.image, load.spritesheet, animations, tilemap, tiled
---
# Phaser 3 physics, input and assets

Assumed version: Phaser 3.90. This is a Pixel Studio internal summary, not official Phaser documentation; check the
Phaser docs and type definitions for exact signatures.

## Arcade physics bodies

Arcade physics is Phaser's lightweight AABB (and circle) physics, enabled with `physics: { default: 'arcade' }` in the
game config. Bodies are axis-aligned and do not rotate, which suits platformers, top-down and shoot-'em-up games.

```ts
this.player = this.physics.add.sprite(32, 100, 'hero');
this.player.setCollideWorldBounds(true);
this.player.setBounce(0);
this.player.body.setSize(10, 14).setOffset(3, 2); // hitbox smaller than the frame

this.platforms = this.physics.add.staticGroup();
this.platforms.create(160, 170, 'ground');

this.enemies = this.physics.add.group({ maxSize: 30 });
```

- Dynamic bodies move via velocity: `setVelocityX(160)`, `setVelocity(x, y)`; gravity comes from the world config or
  `body.setAllowGravity(false)` per body.
- Static bodies never move; if a static object's position or scale changes, call `refreshBody()`.
- Tune hitboxes with `body.setSize` and `setOffset`; forgiving hitboxes for the player and slightly generous ones for
  pickups usually feel better.
- In TypeScript, `sprite.body` is typed as a union; cast to `Phaser.Physics.Arcade.Body` when calling body methods.

## Colliders and overlaps

- `this.physics.add.collider(a, b, callback?, processCallback?, context?)`: separates the objects and optionally calls
  back. Use for player vs platforms, enemies vs walls.
- `this.physics.add.overlap(a, b, callback, processCallback?, context?)`: detects without separation. Use for pickups,
  hazards, damage zones.
- `a` and `b` can be game objects, groups or tilemap layers.
- Platformer ground checks: `body.blocked.down` (against tiles/world bounds) or `body.touching.down` (against other
  bodies).
- Fast objects can tunnel through thin bodies; keep speeds below roughly the body size per step, or thicken colliders.
- Turn on `arcade: { debug: true }` while developing to see bodies and velocity vectors.

Keep collision callbacks thin: they should translate to a game-logic event (`collectCoin(state, coinId)`) instead of
holding rules.

## Keyboard, pointer and touch input

- Cursor keys: `this.cursors = this.input.keyboard!.createCursorKeys();` then check `this.cursors.left.isDown` in
  `update`. The object includes up, down, left, right, space and shift.
- Other keys: `this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);` and
  `Phaser.Input.Keyboard.JustDown(this.jumpKey)` for a single-press check per frame.
- `this.input.keyboard` can be null in TypeScript types (keyboard disabled), hence the non-null assertion or a guard.
- Pointer: `this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { ... })`; `p.worldX`/`p.worldY` include
  camera scroll. Interactive objects need `setInteractive()`.
- Touch for mobile: on-screen buttons as interactive images, or virtual joystick logic from pointer positions. Support
  multiple pointers with `this.input.addPointer(n)`.

Map raw input to a small command object each frame (`{ left, right, jumpPressed }`) and pass it to pure logic; this
supports remapping, touch controls and tests.

## Loading assets

Queue assets in `preload()`:

- `this.load.image('ground', 'assets/ground.png')`
- `this.load.spritesheet('hero', 'assets/hero.png', { frameWidth: 16, frameHeight: 16 })`
- `this.load.atlas('ui', 'assets/ui.png', 'assets/ui.json')` for texture-packer atlases
- `this.load.audio('jump', ['assets/jump.ogg', 'assets/jump.mp3'])`
- `this.load.tilemapTiledJSON('level1', 'assets/level1.json')`
- `this.load.bitmapFont('pixel', 'assets/font.png', 'assets/font.xml')`

Use stable keys defined as constants in one module. Listen to `this.load.on('progress', v => ...)` for a loading bar,
and `this.load.on('loaderror', ...)` to surface missing files. Paths are relative to the page (or `this.load.setPath`).
In Vite projects, files in `public/` are served from the site root.

## Spritesheet animations

Define animations once (for example in the preload scene's `create`), since animations are global to the game:

```ts
this.anims.create({
  key: 'hero-run',
  frames: this.anims.generateFrameNumbers('hero', { start: 4, end: 9 }),
  frameRate: 12,
  repeat: -1,
});
this.player.anims.play('hero-run', true); // true: ignore if already playing
```

Frame indices must match the artist's sheet layout; record frame ranges and frame size in the asset spec so code and
art agree.

## Tilemaps from Tiled

```ts
const map = this.make.tilemap({ key: 'level1' });
const tiles = map.addTilesetImage('terrain', 'terrain-tiles'); // name in Tiled, texture key
const ground = map.createLayer('Ground', tiles!, 0, 0);
ground!.setCollisionByProperty({ collides: true });
this.physics.add.collider(this.player, ground!);
```

The tileset name and layer names must match the Tiled file exactly. Embed tilesets in the JSON export (external `.tsx`
tilesets are not loaded by the Tiled JSON loader). Use object layers for spawn points and read them with
`map.getObjectLayer('Spawns')`.

## Further reading
- https://docs.phaser.io
