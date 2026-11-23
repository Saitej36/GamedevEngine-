# Phaser 3.90 Arcade Physics: bodies, colliders, pools, categories and tilemaps

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/web-engines/phaser-arcade-physics/SKILL.md, skills/web-engines/phaser-arcade-physics/references/bodies-and-collision.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: re-targeted from Phaser 4.2.1 to Phaser 3.90 only; marked defaults checked only in the v4 source as "Verify on 3.90"; removed package-manager, type-check and browser-automation commands; added tilemap collision and fixed-step notes; condensed.
> Engine target: Phaser 3.90. Code is illustrative and has NOT been compiled or run.

## Enable the world and create bodies

```js
physics: {
  default: 'arcade',
  arcade: { gravity: { x: 0, y: 600 }, debug: true },  // top-down: y: 0
},
```

- Arcade bodies are axis-aligned rectangles or circles: no rotation in collision, no joints, no slopes. Matter is a separate engine whose bodies never collide with Arcade bodies.
- Dynamic: `this.physics.add.sprite/image/group`. Static: `this.physics.add.staticImage/staticSprite/staticGroup` (ground, walls). Existing object: `this.physics.add.existing(obj)` (pass `true` for static).
- A sprite made with `this.add.sprite` has no body and ignores physics.
- Keep `debug: true` while building: outlines and velocity lines answer most "why didn't it collide" questions. Turn it off for release.

## Moving bodies

Move dynamic bodies through the body, never by writing `x`/`y` (that teleports past colliders).

| Setter | Notes |
|---|---|
| `setVelocity(x, y)` | px/s |
| `setAcceleration(x, y)` | px/s²; accumulates into velocity |
| `setDrag(x, y)` | applied only on an axis with zero acceleration; with `setDamping(true)` it is a fraction kept per second |
| `setMaxVelocity(x, y)` | clamp speed |
| `setBounce`, `setFriction` | rebound; motion passed to a riding body |
| `body.setAllowGravity(false)` | flying enemies, bullets |

```js
update() {
  const body = this.player.body, speed = 220;
  body.setVelocity(0);
  if (this.cursors.left.isDown) body.setVelocityX(-speed);
  if (this.cursors.right.isDown) body.setVelocityX(speed);
  if (this.cursors.up.isDown) body.setVelocityY(-speed);
  if (this.cursors.down.isDown) body.setVelocityY(speed);
  body.velocity.normalize().scale(speed);   // equal diagonal speed
}
```

Hitboxes: `body.setSize(20, 36, true)` (true re-centres), `body.setOffset(6, 4)`, `body.setCircle(16)`. `body.stop()` zeroes motion; `body.reset(x, y)` teleports and clears it.

## Colliders vs overlaps

```js
this.physics.add.collider(this.player, this.platforms);              // separate bodies
this.physics.add.collider(this.player, this.enemies, (p, e) => this.hurt(p, e));
this.physics.add.overlap(this.player, this.coins, (p, coin) => {    // detect only
  coin.disableBody(true, true);
  this.registry.inc('score', 10);
}, (p, coin) => coin.active);                                        // process callback
```

- Register each collider/overlap **once in `create`**. Calling them in `update` adds a new one every frame and the game slows down. Disable with `collider.active = false`; remove with `this.physics.world.removeCollider(c)`.
- The process callback returning `false` skips the pair before the main callback: the simplest way to ignore allies.
- Either side can be a game object, an array, a group or a tilemap layer.

## Contact state and ground checks

- `body.blocked.down` (same as `onFloor()`): cannot move down because of world bounds, a colliding tile, or a static, immovable or non-pushable body. `touching.*`: any body contact this step. `wasTouching`: previous step, for first-frame-of-hit detection.
- `onFloor()` always false: no collider with the ground, gravity off, or landing on an ordinary dynamic body (it does not set `blocked`). Make platforms static, `setImmovable(true)` or `setPushable(false)`.
- The player shoves platforms around: they are dynamic. Use a `staticGroup`, or `setImmovable(true)` for moving platforms.
- A static body moved but collides at the old spot: static bodies do not follow their game object. Call `body.updateFromGameObject()` or `obj.refreshBody()`.
- World bounds: `this.physics.world.setBounds(...)`, `setCollideWorldBounds(true)`, and `body.onWorldBounds = true` plus a `'worldbounds'` listener for events.

## Groups and pooling

```js
create() { this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 }); }
fire(x, y) {
  const b = this.bullets.get(x, y);          // inactive member, or new one under maxSize
  if (!b) return;
  b.enableBody(true, x, y, true, true);
  b.body.setAllowGravity(false);
  b.setVelocityY(-500);
}
update() {
  for (const b of this.bullets.getChildren())
    if (b.active && b.y < -32) b.disableBody(true, true);   // return to pool
}
```

- Firing stops after `maxSize` shots: members were hidden (`setVisible(false)`) but not disabled, so they still count as active. Recycle with `disableBody(true, true)`.
- Group config such as `allowGravity: false` or `collideWorldBounds` applies to members created by the group. Verify on 3.90: which group defaults are re-applied when a pooled member is re-enabled with `get()`.
- One collider against a group covers every member, including future ones.

## Collision categories

Collision categories exist in Phaser 3 since 3.70, so they are available on 3.90. A pair is tested only when each side's mask contains the other's category.

```js
const WORLD = 1;
const PLAYER = this.physics.nextCategory();
const ENEMY  = this.physics.nextCategory();
player.setCollisionCategory(PLAYER).setCollidesWith([WORLD, ENEMY]);
ground.setCollidesWith([WORLD, PLAYER, ENEMY]);   // untouched bodies still have mask 1
```

- Moving a body into a new category cuts it off from every body you did not also widen.
- A group's category and mask are checked as well as each member's; they are not copied to members, so set both.
- Verify on 3.90: the upstream defaults (bodies and static groups start category 1 / mask 1, dynamic groups with all mask bits, 32 categories max) were checked in the v4 source only.
- For a few exceptions, a process callback is simpler than categories.

## Tilemap collision

```js
const map = this.make.tilemap({ key: 'level' });
const tiles = map.addTilesetImage('tiles', 'tiles-img');
const ground = map.createLayer('Ground', tiles, 0, 0);
ground.setCollisionByProperty({ collides: true });  // or setCollisionByExclusion([-1])
this.physics.add.collider(this.player, ground);
```

- Order between flagging tiles and adding the collider does not matter, but a layer with no flagged tiles collides with nothing.
- Visualise with `ground.renderDebug(this.add.graphics())` while building.
- `setCollisionByProperty` needs the custom property set on tiles in Tiled and the map exported to JSON with embedded tilesets.
- One-way platforms: give those tiles top-only collision, for example `tile.setCollision(false, false, true, false)` (left, right, up, down), or skip the pair in a process callback while the player moves up. Verify on 3.90: the `Tile.setCollision` argument order.

## Fixed step, delta and tunnelling

- Arcade steps at `arcade.fps` (default 60) with a fixed step; rendering can run at another rate. Verify on 3.90: the `fixedStep` config flag and its default (upstream checked it in v4).
- Velocities are per second, so motion is frame-rate independent; your own timers in `update` must scale by `delta / 1000`.
- No swept collision: a body that moves farther than a wall's thickness in one step skips it. Thicken the wall's body, cap speed with `setMaxVelocity`, raise `arcade.fps` (CPU cost), or use `overlapRect`/a ray-style check for bullets.
- Drag does nothing while a key is held: acceleration is non-zero. Set acceleration to 0 when input stops.

## Checks for the human

With `debug: true`, ask the human to confirm outlines match the art and where the player stops. In the browser console: `game.scene.getScene('play').physics.world.bodies.size` (should stay flat while firing if pooling works) and `.player.body.blocked.down` (true once landed).
