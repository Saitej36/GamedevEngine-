import Phaser from 'phaser';
import { COLS, ENTRANCE, MAP_H, MAP_W, ROWS, TILE, tiles, zones, type Zone } from './map';
import { rect, rng, shade, type Ctx } from './pixels';

/** Paints the static floor + wall layer into one canvas texture. */

type FloorStyle = (ctx: Ctx, x: number, y: number, tx: number, ty: number, r: () => number) => void;

const planks = (base: string): FloorStyle => (ctx, x, y, tx, ty) => {
  rect(ctx, x, y, TILE, TILE, base);
  const d = shade(base, -0.12);
  const l = shade(base, 0.08);
  for (let i = 0; i < 4; i++) {
    rect(ctx, x, y + i * 4 + 3, TILE, 1, d);
    const off = ((ty * 4 + i) * 7 + tx * 16) % 16;
    rect(ctx, x + off, y + i * 4, 1, 3, d);
    rect(ctx, x, y + i * 4, TILE, 1, l);
  }
};

const carpet = (base: string, dot: string): FloorStyle => (ctx, x, y, _tx, _ty, r) => {
  rect(ctx, x, y, TILE, TILE, base);
  for (let i = 0; i < 6; i++) rect(ctx, x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, dot);
};

const checker = (a: string, b: string, size = 8): FloorStyle => (ctx, x, y, tx, ty) => {
  for (let j = 0; j < TILE / size; j++)
    for (let i = 0; i < TILE / size; i++) {
      const c = (tx * (TILE / size) + i + ty * (TILE / size) + j) % 2 === 0 ? a : b;
      rect(ctx, x + i * size, y + j * size, size, size, c);
    }
  rect(ctx, x, y, TILE, 1, shade(a, -0.08));
};

const tiled = (base: string, grout: string): FloorStyle => (ctx, x, y) => {
  rect(ctx, x, y, TILE, TILE, base);
  rect(ctx, x, y, TILE, 1, grout);
  rect(ctx, x, y, 1, TILE, grout);
  rect(ctx, x + 2, y + 2, 3, 1, shade(base, 0.12));
};

const marble: FloorStyle = (ctx, x, y, _tx, _ty, r) => {
  rect(ctx, x, y, TILE, TILE, '#e4e0ef');
  rect(ctx, x, y, TILE, 1, '#cbc4dd');
  rect(ctx, x, y, 1, TILE, '#cbc4dd');
  const vx = Math.floor(r() * 12);
  for (let i = 0; i < 6; i++) rect(ctx, x + vx + Math.floor(i / 2), y + 3 + i * 2, 1, 2, '#d3cde4');
};

const STYLES: Record<Zone, FloorStyle> = {
  director: planks('#7a4e2f'),
  meeting: carpet('#3d4a72', '#4a5888'),
  production: checker('#d6b48a', '#c9a378'),
  break: checker('#e7f6f2', '#9fd8cc'),
  reception: marble,
  design: carpet('#5a6f93', '#6a80a6'),
  art: planks('#d6ae82'),
  programming: tiled('#3c4a4a', '#2f3b3b'),
  corridor: tiled('#a7a3b5', '#938fa3'),
};

interface Rug {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  border: string;
}

const RUGS: Rug[] = [
  { x: 3, y: 4, w: 5, h: 4, color: '#7f1d1d', border: '#facc15' },
  { x: 39, y: 3, w: 6, h: 6, color: '#fef3c7', border: '#f59e0b' },
  { x: 3, y: 26, w: 6, h: 4, color: '#6d28d9', border: '#c4b5fd' },
  { x: 28, y: 22, w: 6, h: 3, color: '#fbcfe8', border: '#db2777' },
];

const WALL_CAP = '#2b2740';
const WALL_FACE = '#8d88ab';
const WALL_FACE_D = '#6f6a8c';
const BASEBOARD = '#4c4766';

function isWall(x: number, y: number) {
  return x < 0 || y < 0 || x >= COLS || y >= ROWS || tiles[y][x] === 'wall';
}

export function buildFloor(scene: Phaser.Scene): string {
  const key = 'office-floor';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, MAP_W, MAP_H)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const r = rng(1234);

  // Outside the building
  rect(ctx, 0, 0, MAP_W, MAP_H, '#1b1828');

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      const t = tiles[ty][tx];
      if (t === 'wall') continue;
      const z = zones[ty][tx] ?? 'corridor';
      STYLES[z](ctx, x, y, tx, ty, r);
      if (t === 'door') {
        rect(ctx, x, y + 6, TILE, 4, '#7d7891');
        rect(ctx, x, y + 7, TILE, 2, '#9a95ad');
      }
    }
  }

  for (const rug of RUGS) {
    const x = rug.x * TILE + 2;
    const y = rug.y * TILE + 2;
    const w = rug.w * TILE - 4;
    const h = rug.h * TILE - 4;
    rect(ctx, x, y, w, h, rug.border);
    rect(ctx, x + 2, y + 2, w - 4, h - 4, rug.color);
    rect(ctx, x + 4, y + 4, w - 8, 1, rug.border);
    rect(ctx, x + 4, y + h - 5, w - 8, 1, rug.border);
  }

  // Walls: a dark cap, plus a lit front face when there is floor below.
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (!isWall(tx, ty)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const floorBelow = !isWall(tx, ty + 1);
      if (floorBelow) {
        rect(ctx, x, y, TILE, 4, WALL_CAP);
        rect(ctx, x, y + 4, TILE, 10, WALL_FACE);
        rect(ctx, x, y + 4, TILE, 1, shade(WALL_FACE, 0.2));
        rect(ctx, x + (tx % 2 ? 0 : 8), y + 9, 1, 5, WALL_FACE_D);
        rect(ctx, x, y + 14, TILE, 2, BASEBOARD);
      } else {
        rect(ctx, x, y, TILE, TILE, WALL_CAP);
        if (!isWall(tx - 1, ty)) rect(ctx, x, y, 1, TILE, '#3a3554');
        if (!isWall(tx + 1, ty)) rect(ctx, x + TILE - 1, y, 1, TILE, '#3a3554');
      }
    }
  }

  // Windows on the outer north wall.
  for (let tx = 2; tx < COLS - 2; tx += 4) {
    if (!isWall(tx, 0) || isWall(tx, 1)) continue;
    const x = tx * TILE + 2;
    rect(ctx, x, 5, 12, 8, '#cbd5e1');
    rect(ctx, x + 1, 6, 10, 6, '#7dd3fc');
    rect(ctx, x + 2, 7, 3, 1, '#e0f2fe');
    rect(ctx, x + 6, 6, 1, 6, '#cbd5e1');
  }

  // Main entrance (glass doors) in the south wall.
  for (const e of ENTRANCE) {
    const x = e.x * TILE;
    const y = e.y * TILE;
    rect(ctx, x, y, TILE, TILE, '#475569');
    rect(ctx, x + 1, y + 2, TILE - 2, TILE - 3, '#93c5fd');
    rect(ctx, x + 3, y + 4, 2, 6, '#dbeafe');
  }

  tex.refresh();
  return key;
}

/** Tile row of each room's north wall face (used for name plaques). */
export function wallFaceY(roomTopRow: number) {
  return (roomTopRow - 1) * TILE + 9;
}

