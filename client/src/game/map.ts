import type { AgentId, DepartmentId } from '@pixel/shared';

export const TILE = 16;
export const COLS = 48;
export const ROWS = 32;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

export type Dir = 'down' | 'up' | 'left' | 'right';
export type Zone = DepartmentId | 'corridor';

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: DepartmentId;
  label: string;
  /** Interior bounds, inclusive, in tiles. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Interior rectangles. Walls sit on the rows/cols just outside them. */
export const ROOMS: Room[] = [
  { id: 'director', label: "DIRECTOR'S CABIN", x0: 1, y0: 1, x1: 10, y1: 10 },
  { id: 'meeting', label: 'MEETING ROOM', x0: 12, y0: 1, x1: 27, y1: 10 },
  { id: 'production', label: 'PRODUCTION', x0: 29, y0: 1, x1: 36, y1: 10 },
  { id: 'break', label: 'BREAK ROOM', x0: 38, y0: 1, x1: 46, y1: 10 },
  { id: 'reception', label: 'RECEPTION', x0: 1, y0: 16, x1: 10, y1: 30 },
  { id: 'design', label: 'DESIGN', x0: 12, y0: 16, x1: 22, y1: 30 },
  { id: 'art', label: 'ART', x0: 24, y0: 16, x1: 34, y1: 30 },
  { id: 'programming', label: 'PROGRAMMING', x0: 36, y0: 16, x1: 46, y1: 30 },
];

export const CORRIDOR = { x0: 1, y0: 12, x1: 46, y1: 14 };

/** Doorway tiles cut into walls (walkable). */
const DOORS: Point[] = [
  // row 11: top rooms → corridor
  { x: 5, y: 11 }, { x: 6, y: 11 },
  { x: 19, y: 11 }, { x: 20, y: 11 },
  { x: 32, y: 11 }, { x: 33, y: 11 },
  { x: 41, y: 11 }, { x: 42, y: 11 },
  // row 15: corridor → bottom rooms
  { x: 5, y: 15 }, { x: 6, y: 15 },
  { x: 16, y: 15 }, { x: 17, y: 15 },
  { x: 28, y: 15 }, { x: 29, y: 15 },
  { x: 40, y: 15 }, { x: 41, y: 15 },
];

/** Decorative main entrance in the outer wall (not walkable). */
export const ENTRANCE: Point[] = [{ x: 5, y: 31 }, { x: 6, y: 31 }];

export type TileKind = 'wall' | 'floor' | 'door';

export const tiles: TileKind[][] = [];
export const zones: (Zone | null)[][] = [];

for (let y = 0; y < ROWS; y++) {
  tiles.push(new Array<TileKind>(COLS).fill('wall'));
  zones.push(new Array<Zone | null>(COLS).fill(null));
}
for (const r of ROOMS) {
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    tiles[y][x] = 'floor';
    zones[y][x] = r.id;
  }
}
for (let y = CORRIDOR.y0; y <= CORRIDOR.y1; y++) for (let x = CORRIDOR.x0; x <= CORRIDOR.x1; x++) {
  tiles[y][x] = 'floor';
  zones[y][x] = 'corridor';
}
for (const d of DOORS) {
  tiles[d.y][d.x] = 'door';
  zones[d.y][d.x] = 'corridor';
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

export type FurnitureKind =
  | 'desk'
  | 'bigdesk'
  | 'chair'
  | 'plant'
  | 'tallplant'
  | 'bookshelf'
  | 'whiteboard'
  | 'kanban'
  | 'meetingtable'
  | 'couch'
  | 'coffee'
  | 'fridge'
  | 'vending'
  | 'cooler'
  | 'counter'
  | 'easel'
  | 'server'
  | 'cabinet'
  | 'tv'
  | 'sidetable'
  | 'printer';

export interface Furniture {
  kind: FurnitureKind;
  x: number; // tile
  y: number; // tile
  w: number; // footprint in tiles
  h: number;
  blocks: boolean;
  /** Override draw depth (pixels); default = bottom edge of the footprint. */
  depth?: number;
  variant?: number;
}

export const furniture: Furniture[] = [];

function add(kind: FurnitureKind, x: number, y: number, w = 1, h = 1, blocks = true, extra: Partial<Furniture> = {}) {
  furniture.push({ kind, x, y, w, h, blocks, ...extra });
}

export interface DeskSpot {
  seat: Point; // where the NPC sits, facing down
}

/** Desk = 2x1 footprint; the seat is the tile above its left half. */
function desk(x: number, y: number, variant = 0): DeskSpot {
  add('desk', x, y, 2, 1, true, { variant });
  add('chair', x, y - 1, 1, 1, false, { depth: (y - 1) * TILE + 2 });
  return { seat: { x, y: y - 1 } };
}

// Director's cabin
add('bookshelf', 1, 1, 2, 1);
add('bookshelf', 3, 1, 2, 1);
add('cabinet', 10, 1);
add('tallplant', 1, 10);
add('plant', 10, 10);
add('bigdesk', 4, 6, 3, 1);
add('chair', 5, 5, 1, 1, false, { depth: 5 * TILE + 2 });
add('couch', 7, 9, 3, 1, false, { depth: 9 * TILE + 2, variant: 1 });
add('sidetable', 8, 3);
const directorDesk: DeskSpot = { seat: { x: 5, y: 5 } };

// Meeting room
add('meetingtable', 16, 4, 8, 3);
add('tv', 19, 1, 2, 1);
add('tallplant', 12, 1);
add('tallplant', 27, 1);
add('plant', 12, 10);
add('plant', 27, 10);
add('whiteboard', 25, 2, 2, 1);
export const MEETING_SEATS: Record<AgentId, { tile: Point; dir: Dir }> = {
  director: { tile: { x: 15, y: 5 }, dir: 'right' },
  designer: { tile: { x: 17, y: 3 }, dir: 'down' },
  artist: { tile: { x: 19, y: 3 }, dir: 'down' },
  programmer: { tile: { x: 21, y: 3 }, dir: 'down' },
  producer: { tile: { x: 18, y: 7 }, dir: 'up' },
  qa: { tile: { x: 20, y: 7 }, dir: 'up' },
};
const extraMeetingSeats: Point[] = [{ x: 22, y: 7 }, { x: 24, y: 5 }];
for (const s of [...Object.values(MEETING_SEATS).map((m) => m.tile), ...extraMeetingSeats]) {
  add('chair', s.x, s.y, 1, 1, false, { depth: s.y * TILE + 2 });
}

// Production
add('kanban', 29, 1, 3, 1);
add('cabinet', 35, 1);
add('cabinet', 36, 1);
add('printer', 36, 6);
add('plant', 29, 10);
const producerDesk = desk(31, 5);
desk(31, 9, 1);

// Break room
add('vending', 38, 1);
add('fridge', 46, 1);
add('coffee', 44, 1);
add('coffee', 45, 1, 1, 1, true, { variant: 1 });
add('sidetable', 42, 5, 2, 1);
add('couch', 39, 8, 3, 1, false, { depth: 8 * TILE + 2 });
add('tallplant', 46, 10);
add('plant', 38, 10);

// Reception
add('counter', 3, 22, 4, 1);
add('chair', 4, 21, 1, 1, false, { depth: 21 * TILE + 2 });
add('couch', 1, 26, 1, 3, false, { depth: 28 * TILE + 2, variant: 2 });
add('tallplant', 1, 16);
add('tallplant', 10, 16);
add('plant', 10, 30);
add('cooler', 9, 18);
add('sidetable', 2, 29);

// Design
add('bookshelf', 21, 16, 2, 1);
add('whiteboard', 18, 16, 2, 1);
add('tallplant', 12, 16);
add('plant', 22, 30);
const designerDesk = desk(14, 20);
desk(18, 21, 1);
desk(14, 26, 2);
desk(18, 26, 3);

// Art
add('easel', 31, 19);
add('easel', 33, 19, 1, 1, true, { variant: 1 });
add('bookshelf', 24, 16, 2, 1, true, { variant: 1 });
add('tallplant', 34, 16);
add('plant', 24, 30);
const artistDesk = desk(26, 20);
desk(26, 26, 1);
desk(31, 26, 2);

// Programming
add('server', 45, 16, 2, 1);
add('server', 43, 16, 1, 1, true, { variant: 1 });
add('tallplant', 36, 16);
add('plant', 46, 30);
add('whiteboard', 37, 16, 2, 1, true, { variant: 1 });
const programmerDesk = desk(38, 20);
const qaDesk = desk(42, 20, 1);
desk(38, 26, 2);
desk(42, 26, 3);

// Corridor
add('cooler', 24, 12);
add('plant', 1, 12);
add('plant', 46, 12);
add('plant', 12, 14);
add('plant', 35, 14);

export const DESKS: Record<AgentId, DeskSpot> = {
  director: directorDesk,
  designer: designerDesk,
  artist: artistDesk,
  programmer: programmerDesk,
  producer: producerDesk,
  qa: qaDesk,
};

// ---------------------------------------------------------------------------
// Walkability
// ---------------------------------------------------------------------------

export const walkable: boolean[][] = tiles.map((row) => row.map((t) => t !== 'wall'));
for (const f of furniture) {
  if (!f.blocks) continue;
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) walkable[y][x] = false;
}

export function isWalkable(x: number, y: number): boolean {
  return y >= 0 && y < ROWS && x >= 0 && x < COLS && walkable[y][x];
}

// ---------------------------------------------------------------------------
// Points of interest for ambient roaming
// ---------------------------------------------------------------------------

export type RoamPose = 'idle' | 'read' | 'meet' | 'work';

export interface Poi {
  id: string;
  tile: Point;
  dir: Dir;
  pose: RoamPose;
}

export const POIS: Poi[] = [
  { id: 'coffee-1', tile: { x: 44, y: 2 }, dir: 'up', pose: 'idle' },
  { id: 'coffee-2', tile: { x: 45, y: 2 }, dir: 'up', pose: 'idle' },
  { id: 'fridge', tile: { x: 46, y: 2 }, dir: 'up', pose: 'idle' },
  { id: 'vending', tile: { x: 38, y: 2 }, dir: 'up', pose: 'idle' },
  { id: 'couch-1', tile: { x: 39, y: 8 }, dir: 'down', pose: 'idle' },
  { id: 'couch-2', tile: { x: 40, y: 8 }, dir: 'down', pose: 'read' },
  { id: 'couch-3', tile: { x: 41, y: 8 }, dir: 'down', pose: 'idle' },
  { id: 'break-table', tile: { x: 42, y: 6 }, dir: 'up', pose: 'meet' },
  { id: 'break-table-2', tile: { x: 43, y: 4 }, dir: 'down', pose: 'meet' },
  { id: 'cooler-corridor', tile: { x: 24, y: 13 }, dir: 'up', pose: 'idle' },
  { id: 'cooler-reception', tile: { x: 8, y: 18 }, dir: 'right', pose: 'idle' },
  { id: 'reception-counter', tile: { x: 5, y: 23 }, dir: 'up', pose: 'meet' },
  { id: 'reception-couch', tile: { x: 1, y: 27 }, dir: 'right', pose: 'read' },
  { id: 'design-board', tile: { x: 18, y: 17 }, dir: 'up', pose: 'read' },
  { id: 'design-shelf', tile: { x: 21, y: 17 }, dir: 'up', pose: 'read' },
  { id: 'art-easel', tile: { x: 31, y: 20 }, dir: 'up', pose: 'work' },
  { id: 'art-easel-2', tile: { x: 33, y: 20 }, dir: 'up', pose: 'work' },
  { id: 'art-shelf', tile: { x: 25, y: 17 }, dir: 'up', pose: 'read' },
  { id: 'server', tile: { x: 45, y: 17 }, dir: 'up', pose: 'work' },
  { id: 'prog-board', tile: { x: 37, y: 17 }, dir: 'up', pose: 'read' },
  { id: 'kanban', tile: { x: 30, y: 2 }, dir: 'up', pose: 'read' },
  { id: 'printer', tile: { x: 35, y: 6 }, dir: 'right', pose: 'idle' },
  { id: 'director-shelf', tile: { x: 2, y: 2 }, dir: 'up', pose: 'read' },
  { id: 'meeting-tv', tile: { x: 22, y: 2 }, dir: 'up', pose: 'idle' },
  { id: 'corridor-w', tile: { x: 9, y: 13 }, dir: 'down', pose: 'idle' },
  { id: 'corridor-e', tile: { x: 37, y: 13 }, dir: 'down', pose: 'idle' },
  { id: 'corridor-m', tile: { x: 30, y: 12 }, dir: 'down', pose: 'meet' },
];
