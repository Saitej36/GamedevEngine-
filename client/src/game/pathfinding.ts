import { COLS, ROWS, isWalkable, type Point } from './map';

/**
 * Grid A* (4-directional, Manhattan heuristic) over the office walkability grid.
 * Returns the tiles to visit after `start`, ending with `goal`; [] if already there; null if unreachable.
 */
export function findPath(start: Point, goal: Point): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!isWalkable(goal.x, goal.y)) return null;

  const idx = (x: number, y: number) => y * COLS + x;
  const size = COLS * ROWS;
  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  // Binary min-heap keyed by f.
  const heap: number[] = [];
  const push = (n: number) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const s = idx(start.x, start.y);
  g[s] = 0;
  f[s] = h(start.x, start.y);
  push(s);
  const goalIdx = idx(goal.x, goal.y);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (heap.length) {
    const cur = pop();
    if (cur === goalIdx) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % COLS;
    const cy = (cur / COLS) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      // The start tile may be "unwalkable" (e.g. NPC interrupted on furniture edge); neighbours must be walkable.
      if (!isWalkable(nx, ny)) continue;
      const n = idx(nx, ny);
      if (closed[n]) continue;
      // Tiny bias against turning keeps paths in straight corridors.
      let turn = 0;
      if (came[cur] >= 0) {
        const pdx = cx - (came[cur] % COLS);
        const pdy = cy - ((came[cur] / COLS) | 0);
        if (pdx !== dx || pdy !== dy) turn = 0.001;
      }
      const ng = g[cur] + 1 + turn;
      if (ng < g[n]) {
        g[n] = ng;
        f[n] = ng + h(nx, ny);
        came[n] = cur;
        push(n);
      }
    }
  }

  if (came[goalIdx] < 0) return null;
  const out: Point[] = [];
  for (let c = goalIdx; c !== s; c = came[c]) out.push({ x: c % COLS, y: (c / COLS) | 0 });
  return out.reverse();
}

/** Nearest walkable tile to `p` (BFS ring search), used to recover from odd positions. */
export function nearestWalkable(p: Point): Point {
  if (isWalkable(p.x, p.y)) return p;
  for (let r = 1; r < Math.max(COLS, ROWS); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (isWalkable(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
      }
    }
  }
  return p;
}
