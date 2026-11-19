---
id: phaser.typescript-testing-performance
title: Phaser 3 with TypeScript, testing and performance
tags: phaser, typescript, vite, tsconfig, strict, project layout, unit tests, vitest, node:test, pure logic, object pooling, groups, texture atlas, performance, pixel art, mobile
---
# Phaser 3 with TypeScript, testing and performance

Assumed version: Phaser 3.90 with TypeScript 5.x and a Vite-style dev server. This is a Pixel Studio internal summary,
not official Phaser documentation; check the Phaser docs and the project's own `package.json` for the actual tooling.

## Project layout for a TypeScript Phaser game

A Phaser TypeScript project keeps engine code and pure logic in separate folders:

```
index.html            <div id="game"></div> + <script type="module" src="/src/main.ts">
src/main.ts           creates Phaser.Game
src/scenes/           Boot, Title, Play, UI scenes (import Phaser)
src/core/             rules, state, rng, level data (NO Phaser imports)
src/config/           tuning constants and asset keys
public/assets/        images, audio, tilemaps served as static files
tests/                unit tests for src/core
```

Phaser ships its own type definitions, so `import Phaser from 'phaser'` is typed without an extra `@types` package.
Recommended `tsconfig` settings: `"strict": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"` (with Vite),
`"noEmit": true` when the bundler handles compilation. Strict mode surfaces the nullable `this.input.keyboard` and
tilemap return values that commonly crash at runtime.

## TypeScript patterns that help in Phaser

- Declare scene fields with definite assignment when they are created in `create()`:
  `private player!: Phaser.Physics.Arcade.Sprite;`
- Keep asset and scene keys in `as const` objects (`export const Keys = { Hero: 'hero' } as const;`) to avoid typos.
- Type game state as plain interfaces (`interface GameState { score: number; enemies: Enemy[] }`) in `src/core/`;
  sprites hold only an entity id.
- Type event payloads by wrapping `emit`/`on` in small typed helper functions rather than passing untyped strings
  around the codebase.
- Avoid `any` for physics bodies; cast once: `const body = sprite.body as Phaser.Physics.Arcade.Body;`.

## Testing pure logic outside Phaser

Phaser expects a browser environment (window, canvas, WebGL), so importing it in Node unit tests is fragile. The rule is:
test `src/core/` only, and keep it free of Phaser imports.

- If the project already has a test runner (for example Vitest, run with `npx vitest run`), use it; it handles
  TypeScript directly.
- If the project uses Node's built-in runner (`node --test`), TypeScript support depends on the Node version and flags;
  either keep core modules in plain JavaScript with JSDoc types, or compile first. Do not assume a TypeScript-capable
  setup that `package.json` does not show.
- Inject randomness: core functions accept an `rng: () => number` created from a seed, so tests are deterministic.
- Test collisions and movement as maths on plain rectangles and velocities, not via Arcade bodies.

Example core test target: `step(state, { left: false, right: true, jump: false }, 1/60)` moves the player by
`speed / 60` pixels and never past the level bound.

Agents cannot run tests. Report: "Tests written in `tests/…`; not executed; run `<exact script from package.json>`."
If `package.json` has no test script, add one in the programmer's allowed files and state it.

## Performance in Phaser

Phaser games are usually limited by draw calls, overdraw and garbage collection rather than raw script speed.

- **Texture atlases**: pack sprites that appear together into one atlas; the WebGL renderer batches consecutive
  objects sharing a texture. Interleaving textures in the display list breaks batches.
- **Pooling**: use physics groups with `maxSize`; spawn with `group.get(x, y)` and recycle with
  `setActive(false).setVisible(false)` plus disabling the body (`body.enable = false`, or `disableBody(true, true)`
  on an Arcade sprite). Reset every field on reuse.
- **Avoid per-frame allocations** in `update`: no new arrays, closures or `Phaser.Math.Vector2` objects per frame;
  reuse scratch objects.
- **Text**: updating `Text` objects re-renders a canvas texture; update only on value change, or use bitmap text.
- **Tilemaps**: static layers are cheap; avoid thousands of individual sprites for terrain.
- **Off-screen work**: deactivate distant enemies; cull logic, not only rendering.
- **Physics**: fewer, larger static colliders beat many small ones; avoid colliders between groups that never interact.

## Pixel art and mobile considerations

- Use `pixelArt: true` and a low internal resolution; scale up with the Scale Manager rather than drawing large sprites.
- Round camera positions (`roundPixels`) to avoid shimmering seams in tilemaps.
- Mobile browsers throttle hidden tabs and pause `requestAnimationFrame`; Phaser pauses its loop when the page is hidden
  by default. Pause audio and game state too, and resume cleanly.
- Audio on mobile requires a user gesture before playback starts; begin with a "tap to start" screen.
- Test on a mid-range Android device in Chrome and on iOS Safari, which differ in WebGL limits and audio behaviour.

## Performance hand-off

When an agent changes code for performance, the deliverable names the expected gain, the risk, and a human verification
step: open DevTools Performance, record 10 seconds of the heaviest scene, compare frame times and GC events before and
after. Results the agent did not observe are reported as "not measured".

## Further reading
- https://docs.phaser.io
