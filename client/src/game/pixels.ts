/** Tiny helpers for drawing pixel art into a 2D canvas context. */

export type Ctx = CanvasRenderingContext2D;

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx: Ctx, x: number, y: number, color: string) {
  rect(ctx, x, y, 1, 1, color);
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt in [-1, 1]: negative darkens toward black, positive lightens toward white. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return `rgb(${clamp(r + (t - r) * p)},${clamp(g + (t - g) * p)},${clamp(b + (t - b) * p)})`;
}

export function hexToNumber(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

/** Deterministic pseudo-random for stable texture noise. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Adds a 1px dark outline around opaque pixels, restricted to each frame cell so outlines
 * never bleed between neighbouring frames.
 */
export function outline(ctx: Ctx, w: number, h: number, frameW: number, frameH: number, color: [number, number, number]) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const alpha = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  const marks: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 0) continue;
      const fx = Math.floor(x / frameW);
      const fy = Math.floor(y / frameH);
      const same = (nx: number, ny: number) =>
        nx >= 0 && ny >= 0 && nx < w && ny < h && Math.floor(nx / frameW) === fx && Math.floor(ny / frameH) === fy;
      if (
        (same(x - 1, y) && alpha(x - 1, y) > 0) ||
        (same(x + 1, y) && alpha(x + 1, y) > 0) ||
        (same(x, y - 1) && alpha(x, y - 1) > 0) ||
        (same(x, y + 1) && alpha(x, y + 1) > 0)
      ) {
        marks.push((y * w + x) * 4);
      }
    }
  }
  for (const i of marks) {
    d[i] = color[0];
    d[i + 1] = color[1];
    d[i + 2] = color[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
