---
id: web.canvas-game-architecture
title: Canvas game architecture with ES modules
tags: web, html5, canvas, canvas 2d, es modules, no build step, requestanimationframe, fixed timestep, pixel art, imagesmoothingenabled, integer scaling, devicepixelratio, keyboard, pointer events, input
---
# Canvas game architecture with ES modules

Assumed platform: current evergreen browsers (Chrome, Firefox, Safari, Edge) with the Canvas 2D API and native ES
modules, no bundler. This is a Pixel Studio internal summary, not official documentation; MDN is the reference for API
details.

## ES modules without a build step

A dependency-free browser game can ship as plain files:

```
index.html     <canvas id="game"></canvas><script type="module" src="src/main.js"></script>
src/main.js    wiring: canvas, loop, input, scenes
src/core/      pure logic (state, rules, rng) - no DOM access
src/render/    drawing functions that read state
src/input.js   keyboard/pointer -> command object
public/        images and audio
tests/         node:test files for src/core
```

Rules:

- Import paths need the file extension and a relative or absolute prefix: `import { step } from './core/rules.js';`.
- Module scripts are deferred and run in strict mode; `main.js` runs after the HTML is parsed.
- Modules do not load from `file://` URLs in most browsers (CORS). The human must serve the folder over HTTP, for
  example `npx serve .` or `python3 -m http.server 8000`, then open `http://localhost:8000/`. State this in README.
- Avoid circular imports; module-level state persists for the page lifetime, so restarting the game must reset it or,
  better, keep state in an object created by `createInitialState()`.
- `package.json` should contain `"type": "module"` so the same `src/core/*.js` files load as ESM in Node tests.

## The loop: requestAnimationFrame with a fixed timestep

`requestAnimationFrame(callback)` calls back before the next repaint with a high-resolution timestamp in milliseconds.
Its rate follows the display (60, 120, 144 Hz) and it pauses in background tabs, so simulate on a fixed step:

```js
const STEP_MS = 1000 / 60;
let last = 0, acc = 0, running = true;

function frame(now) {
  if (!running) return;
  if (last === 0) last = now;
  acc += Math.min(now - last, 250);   // clamp long gaps (tab switch, breakpoint)
  last = now;
  while (acc >= STEP_MS) {
    state = step(state, input.consume(), STEP_MS / 1000);
    acc -= STEP_MS;
  }
  draw(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { running = false; }
  else { running = true; last = 0; requestAnimationFrame(frame); }
});
```

`step` is pure and unit-testable; `draw` only reads state. For smoother motion at high refresh rates, interpolate
between previous and current positions using `acc / STEP_MS`.

## Pixel art: integer scaling and smoothing

Pixel art should be drawn at a low internal resolution and scaled up by a whole number:

- Create the canvas at the internal size (for example `canvas.width = 320; canvas.height = 180;`).
- Disable smoothing: `ctx.imageSmoothingEnabled = false;`. Resizing the canvas resets context state, so set it again
  after any change to `canvas.width`/`height`.
- Scale with CSS by an integer factor: `scale = Math.max(1, Math.floor(Math.min(innerWidth / 320, innerHeight / 180)))`,
  then set `canvas.style.width = 320 * scale + 'px'` (same for height) and add the CSS
  `image-rendering: pixelated;` so the browser does not blur the upscale.
- Draw at integer coordinates (`Math.round(x)`) to avoid sub-pixel blur and shimmering.
- Letterbox the remaining space with a background colour rather than stretching.

## devicePixelRatio and high-DPI displays

`window.devicePixelRatio` is the ratio of physical to CSS pixels (often 2 or 3 on phones). For non-pixel-art games that
draw text and vector shapes, size the backing store in device pixels to stay sharp:

```js
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(cssWidth * dpr);
canvas.height = Math.round(cssHeight * dpr);
canvas.style.width = cssWidth + 'px';
canvas.style.height = cssHeight + 'px';
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
```

For pixel art, include `devicePixelRatio` in the integer-scale calculation if exact physical pixels matter; otherwise the
CSS integer scale plus `image-rendering: pixelated` is usually enough. Large backing stores cost fill rate on mobile;
cap the ratio (for example at 2) if performance suffers.

## Input handling

Input should be collected by event listeners and read by the simulation once per step:

- Keyboard: listen to `keydown`/`keyup` on `window`, use `event.code` (layout-independent physical key, e.g. `'KeyW'`,
  `'ArrowLeft'`, `'Space'`) for movement, and call `event.preventDefault()` for arrow keys and space so the page does
  not scroll. Ignore `event.repeat` for single-press actions.
- Track "pressed this step" separately from "held", so a quick tap between steps is not lost.
- Clear all held keys on `window` `blur`, otherwise a key released while the window was unfocused stays stuck.
- Pointer: use Pointer Events (`pointerdown`, `pointermove`, `pointerup`) to cover mouse, touch and pen together.
  Convert to game coordinates with `canvas.getBoundingClientRect()` and the current scale. Add CSS
  `touch-action: none` on the canvas to stop browser gestures.
- Audio may only start after a user gesture; begin with a "click/tap to start" screen.

## Hand-off notes

Canvas deliverables should list the files, the serve command, the browser(s) the human should test, the test command
for `src/core`, and state plainly that nothing was run by the agent.

## Further reading
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
