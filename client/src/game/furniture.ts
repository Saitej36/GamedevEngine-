import Phaser from 'phaser';
import { TILE, type Furniture } from './map';
import { rect, rng, shade, type Ctx } from './pixels';

/** Procedural furniture sprites. Each texture is anchored at the bottom-left of its footprint. */

interface Spec {
  w: number;
  h: number;
  draw: (ctx: Ctx, w: number, h: number) => void;
}

const WOOD = '#b07a4a';
const WOOD_D = '#7d5233';
const WOOD_L = '#cf9a64';
const METAL = '#8b93a7';
const METAL_D = '#5b6273';
const DARK = '#262335';

function shadow(ctx: Ctx, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(20,14,30,0.25)';
  ctx.fillRect(x, y, w, 2);
}

function monitor(ctx: Ctx, x: number, y: number, glow: string) {
  rect(ctx, x, y, 12, 9, DARK);
  rect(ctx, x + 1, y + 1, 10, 7, glow);
  rect(ctx, x + 2, y + 2, 5, 1, shade(glow, 0.5));
  rect(ctx, x + 2, y + 4, 7, 1, shade(glow, 0.3));
  rect(ctx, x + 2, y + 6, 4, 1, shade(glow, 0.4));
  rect(ctx, x + 5, y + 9, 2, 2, DARK);
  rect(ctx, x + 3, y + 11, 6, 1, DARK);
}

function deskSpec(wTiles: number, variant: number, big: boolean): Spec {
  const w = wTiles * TILE;
  const top = 9;
  const h = TILE + top;
  return {
    w,
    h,
    draw(ctx) {
      const wood = big ? '#6e4326' : [WOOD, '#9a8a7a', '#a07450', '#8d6e5a'][variant % 4];
      const woodL = shade(wood, 0.18);
      const woodD = shade(wood, -0.3);
      // tabletop
      rect(ctx, 0, top - 7, w, 12, wood);
      rect(ctx, 0, top - 7, w, 1, woodL);
      rect(ctx, 0, top + 4, w, 1, woodD);
      // front panel + legs
      rect(ctx, 1, top + 5, w - 2, 8, woodD);
      rect(ctx, 3, top + 6, w - 6, 1, shade(wood, -0.15));
      rect(ctx, 1, top + 13, 2, 3, DARK);
      rect(ctx, w - 3, top + 13, 2, 3, DARK);
      shadow(ctx, 2, h - 2, w - 4);
      // keyboard in front of the seated employee (left tile)
      rect(ctx, 2, top - 1, 11, 3, '#d9dce6');
      rect(ctx, 3, top, 9, 1, '#aab0c0');
      rect(ctx, 14, top - 1, 2, 3, '#e8eaf2');
      // monitor on the right half
      const glow = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b'][variant % 4];
      monitor(ctx, w - 15, 0, big ? '#0ea5e9' : glow);
      if (big) {
        // lamp + papers
        rect(ctx, 20, top - 6, 7, 5, '#f4efe1');
        rect(ctx, 21, top - 5, 5, 1, '#cfc7b2');
        rect(ctx, 4, top - 9, 2, 6, METAL_D);
        rect(ctx, 2, top - 11, 6, 3, '#facc15');
      } else {
        // mug
        rect(ctx, w - 4, top - 3, 3, 3, ['#ef4444', '#f8fafc', '#14b8a6', '#eab308'][variant % 4]);
      }
    },
  };
}

function specFor(f: Furniture): Spec {
  const v = f.variant ?? 0;
  switch (f.kind) {
    case 'desk':
      return deskSpec(f.w, v, false);
    case 'bigdesk':
      return deskSpec(f.w, v, true);
    case 'chair':
      return {
        w: 16,
        h: 18,
        draw(ctx) {
          rect(ctx, 3, 0, 10, 9, '#3f3a56');
          rect(ctx, 4, 1, 8, 7, '#565073');
          rect(ctx, 2, 9, 12, 4, '#3f3a56');
          rect(ctx, 7, 13, 2, 3, METAL_D);
          rect(ctx, 3, 16, 10, 1, METAL_D);
        },
      };
    case 'plant':
    case 'tallplant': {
      const tall = f.kind === 'tallplant';
      const h = tall ? 30 : 22;
      return {
        w: 16,
        h,
        draw(ctx) {
          const r = rng(f.x * 31 + f.y * 7);
          const potTop = h - 9;
          rect(ctx, 4, potTop, 8, 7, '#c2410c');
          rect(ctx, 3, potTop, 10, 2, '#ea580c');
          rect(ctx, 5, potTop + 2, 1, 4, '#fb923c');
          shadow(ctx, 4, h - 2, 8);
          const leaves = ['#15803d', '#16a34a', '#22c55e', '#4ade80'];
          const n = tall ? 26 : 14;
          for (let i = 0; i < n; i++) {
            const lx = 2 + Math.floor(r() * 11);
            const ly = Math.floor(r() * (potTop - 1));
            rect(ctx, lx, ly, 3, 2, leaves[Math.floor(r() * leaves.length)]);
          }
          rect(ctx, 7, potTop - 6, 2, 6, '#166534');
        },
      };
    }
    case 'bookshelf':
      return {
        w: f.w * TILE,
        h: 30,
        draw(ctx, w, h) {
          rect(ctx, 0, 0, w, h - 2, WOOD_D);
          rect(ctx, 1, 1, w - 2, h - 4, '#4a301d');
          const r = rng(f.x * 13 + f.y);
          const colors =
            v === 1
              ? ['#f472b6', '#facc15', '#38bdf8', '#a78bfa', '#fb923c']
              : ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', '#e5e7eb'];
          for (let s = 0; s < 3; s++) {
            const sy = 2 + s * 9;
            let x = 2;
            while (x < w - 3) {
              const bw = 2 + Math.floor(r() * 2);
              const bh = 5 + Math.floor(r() * 3);
              rect(ctx, x, sy + 7 - bh, bw, bh, colors[Math.floor(r() * colors.length)]);
              x += bw + (r() < 0.2 ? 2 : 0);
            }
            rect(ctx, 1, sy + 7, w - 2, 1, WOOD);
          }
          shadow(ctx, 1, h - 2, w - 2);
        },
      };
    case 'whiteboard':
      return {
        w: f.w * TILE,
        h: 28,
        draw(ctx, w) {
          rect(ctx, 3, 18, 2, 9, METAL_D);
          rect(ctx, w - 5, 18, 2, 9, METAL_D);
          rect(ctx, 0, 0, w, 19, METAL);
          rect(ctx, 1, 1, w - 2, 17, '#f8fafc');
          if (v === 1) {
            rect(ctx, 4, 4, 7, 4, '#22c55e');
            rect(ctx, 18, 4, 9, 4, '#3b82f6');
            rect(ctx, 11, 6, 7, 1, '#475569');
            rect(ctx, 10, 11, 10, 4, '#f97316');
            rect(ctx, 22, 8, 1, 4, '#475569');
          } else {
            rect(ctx, 3, 3, 12, 1, '#2563eb');
            rect(ctx, 3, 6, 18, 1, '#64748b');
            rect(ctx, 3, 9, 14, 1, '#64748b');
            rect(ctx, 22, 3, 6, 6, '#ef4444');
            rect(ctx, 23, 4, 4, 4, '#f8fafc');
            rect(ctx, 3, 13, 9, 1, '#16a34a');
          }
          rect(ctx, 2, 18, w - 4, 1, '#94a3b8');
        },
      };
    case 'kanban':
      return {
        w: f.w * TILE,
        h: 28,
        draw(ctx, w) {
          rect(ctx, 3, 20, 2, 7, WOOD_D);
          rect(ctx, w - 5, 20, 2, 7, WOOD_D);
          rect(ctx, 0, 0, w, 21, WOOD_D);
          rect(ctx, 1, 1, w - 2, 19, '#c8a46e');
          const cols = 3;
          const cw = Math.floor((w - 2) / cols);
          const notes = ['#fde047', '#f9a8d4', '#86efac', '#93c5fd', '#fdba74'];
          const r = rng(99);
          for (let c = 0; c < cols; c++) {
            if (c) rect(ctx, 1 + c * cw, 2, 1, 17, '#9b7a4a');
            const count = 3 - c + (c === 2 ? 1 : 0);
            for (let i = 0; i < count; i++) {
              rect(ctx, 3 + c * cw + (i % 2) * 6, 3 + Math.floor(i / 2) * 6 + (i % 2), 5, 5, notes[Math.floor(r() * notes.length)]);
            }
          }
        },
      };
    case 'meetingtable':
      return {
        w: f.w * TILE,
        h: f.h * TILE + 4,
        draw(ctx, w, h) {
          shadow(ctx, 6, h - 3, w - 12);
          rect(ctx, 4, 2, w - 8, h - 10, '#5b3a22');
          rect(ctx, 2, 4, w - 4, h - 14, '#5b3a22');
          rect(ctx, 5, 3, w - 10, h - 12, '#7a4f2f');
          rect(ctx, 3, 5, w - 6, h - 16, '#7a4f2f');
          rect(ctx, 8, 5, w - 16, 1, '#9a6a42');
          rect(ctx, 4, h - 8, w - 8, 4, '#4a2e1a');
          // papers, laptop, mugs
          rect(ctx, 20, 12, 8, 6, '#f4efe1');
          rect(ctx, 52, 14, 14, 9, '#cbd5e1');
          rect(ctx, 53, 15, 12, 6, '#1e293b');
          rect(ctx, 54, 16, 7, 1, '#38bdf8');
          rect(ctx, 90, 11, 9, 7, '#f4efe1');
          rect(ctx, 92, 13, 5, 1, '#94a3b8');
          rect(ctx, 38, 26, 3, 3, '#f8fafc');
          rect(ctx, 76, 28, 3, 3, '#ef4444');
          rect(ctx, 106, 24, 8, 5, '#fde047');
        },
      };
    case 'couch': {
      const color = ['#0d9488', '#7c4a2d', '#6d28d9'][v % 3];
      if (v === 2) {
        // vertical couch, back against the left wall
        return {
          w: 16,
          h: f.h * TILE + 4,
          draw(ctx, w, h) {
            rect(ctx, 0, 0, 6, h - 2, shade(color, -0.25));
            rect(ctx, 5, 2, w - 6, h - 6, color);
            rect(ctx, 6, 3, w - 8, h - 8, shade(color, 0.15));
            rect(ctx, 6, Math.floor(h / 2) - 1, w - 8, 1, shade(color, -0.2));
            rect(ctx, 0, 0, w - 1, 3, shade(color, -0.35));
            rect(ctx, 0, h - 5, w - 1, 3, shade(color, -0.35));
          },
        };
      }
      return {
        w: f.w * TILE,
        h: 22,
        draw(ctx, w, h) {
          shadow(ctx, 2, h - 2, w - 4);
          rect(ctx, 0, 0, w, 9, shade(color, -0.25));
          rect(ctx, 1, 1, w - 2, 2, shade(color, -0.1));
          rect(ctx, 0, 8, w, 11, color);
          rect(ctx, 0, 6, 4, 14, shade(color, -0.35));
          rect(ctx, w - 4, 6, 4, 14, shade(color, -0.35));
          for (let x = 4 + 13; x < w - 4; x += 13) rect(ctx, x, 9, 1, 8, shade(color, -0.2));
          rect(ctx, 5, 9, w - 10, 1, shade(color, 0.2));
        },
      };
    }
    case 'coffee':
      return {
        w: 16,
        h: 26,
        draw(ctx) {
          rect(ctx, 0, 10, 16, 16, '#e7e5e4');
          rect(ctx, 0, 10, 16, 2, '#a8a29e');
          rect(ctx, 1, 14, 14, 10, '#d6d3d1');
          rect(ctx, 7, 15, 2, 8, '#a8a29e');
          if (v === 1) {
            rect(ctx, 2, 2, 12, 9, '#f5f5f4');
            rect(ctx, 3, 3, 7, 6, '#1c1917');
            rect(ctx, 11, 4, 2, 4, '#a8a29e');
          } else {
            rect(ctx, 3, 0, 10, 11, '#292524');
            rect(ctx, 4, 1, 8, 3, '#57534e');
            rect(ctx, 5, 2, 2, 1, '#ef4444');
            rect(ctx, 6, 6, 4, 4, '#1c1917');
            rect(ctx, 7, 8, 2, 2, '#f5f5f4');
          }
        },
      };
    case 'fridge':
      return {
        w: 16,
        h: 30,
        draw(ctx) {
          rect(ctx, 1, 0, 14, 29, '#e2e8f0');
          rect(ctx, 2, 1, 12, 27, '#f8fafc');
          rect(ctx, 1, 11, 14, 1, '#94a3b8');
          rect(ctx, 12, 4, 1, 5, '#64748b');
          rect(ctx, 12, 14, 1, 7, '#64748b');
          rect(ctx, 4, 3, 3, 3, '#f472b6');
          shadow(ctx, 1, 28, 14);
        },
      };
    case 'vending':
      return {
        w: 16,
        h: 30,
        draw(ctx) {
          rect(ctx, 0, 0, 16, 29, '#b91c1c');
          rect(ctx, 2, 2, 9, 20, '#1e293b');
          const c = ['#facc15', '#22c55e', '#38bdf8', '#f97316', '#e879f9'];
          for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) rect(ctx, 3 + k * 3, 3 + r * 5, 2, 3, c[(r + k) % c.length]);
          rect(ctx, 12, 4, 3, 6, '#fca5a5');
          rect(ctx, 2, 24, 9, 3, '#0f172a');
          shadow(ctx, 0, 28, 16);
        },
      };
    case 'cooler':
      return {
        w: 16,
        h: 28,
        draw(ctx) {
          rect(ctx, 4, 0, 8, 2, '#1d4ed8');
          rect(ctx, 3, 2, 10, 10, '#60a5fa');
          rect(ctx, 4, 3, 3, 8, '#bfdbfe');
          rect(ctx, 3, 12, 10, 14, '#e2e8f0');
          rect(ctx, 4, 14, 8, 2, '#94a3b8');
          rect(ctx, 6, 17, 1, 2, '#3b82f6');
          rect(ctx, 9, 17, 1, 2, '#ef4444');
          shadow(ctx, 3, 26, 10);
        },
      };
    case 'counter':
      return {
        w: f.w * TILE,
        h: 26,
        draw(ctx, w, h) {
          rect(ctx, 0, 0, w, 6, '#ddd6fe');
          rect(ctx, 0, 5, w, 1, '#a78bfa');
          rect(ctx, 0, 6, w, h - 8, '#7c3aed');
          rect(ctx, 2, 8, w - 4, h - 12, '#6d28d9');
          rect(ctx, Math.floor(w / 2) - 10, 11, 20, 6, '#facc15');
          rect(ctx, Math.floor(w / 2) - 8, 13, 16, 2, '#6d28d9');
          rect(ctx, 6, 1, 6, 3, '#f8fafc');
          rect(ctx, w - 14, 0, 5, 4, '#22c55e');
          shadow(ctx, 1, h - 2, w - 2);
        },
      };
    case 'easel':
      return {
        w: 16,
        h: 30,
        draw(ctx) {
          rect(ctx, 3, 10, 1, 19, WOOD_D);
          rect(ctx, 12, 10, 1, 19, WOOD_D);
          rect(ctx, 7, 4, 2, 24, WOOD);
          rect(ctx, 1, 2, 14, 16, '#fafaf9');
          rect(ctx, 1, 2, 14, 1, WOOD_D);
          if (v === 1) {
            rect(ctx, 2, 10, 12, 7, '#4ade80');
            rect(ctx, 2, 3, 12, 7, '#7dd3fc');
            rect(ctx, 9, 4, 3, 3, '#fde047');
            rect(ctx, 4, 7, 4, 4, '#166534');
          } else {
            rect(ctx, 3, 5, 6, 6, '#f472b6');
            rect(ctx, 7, 9, 6, 6, '#a78bfa');
            rect(ctx, 4, 13, 3, 2, '#1e293b');
          }
          rect(ctx, 1, 18, 14, 2, WOOD_L);
        },
      };
    case 'server':
      return {
        w: f.w * TILE,
        h: 32,
        draw(ctx, w) {
          for (let x = 0; x < w; x += 16) {
            rect(ctx, x + 1, 0, 14, 31, '#111827');
            rect(ctx, x + 2, 1, 12, 29, '#1f2937');
            for (let r = 0; r < 6; r++) {
              rect(ctx, x + 3, 3 + r * 4, 10, 3, '#374151');
              rect(ctx, x + 4, 4 + r * 4, 1, 1, (r + x) % 3 ? '#22c55e' : '#f59e0b');
              rect(ctx, x + 6, 4 + r * 4, 1, 1, r % 2 ? '#38bdf8' : '#22c55e');
            }
          }
        },
      };
    case 'cabinet':
      return {
        w: 16,
        h: 24,
        draw(ctx) {
          rect(ctx, 1, 0, 14, 23, METAL_D);
          rect(ctx, 2, 1, 12, 21, METAL);
          for (let r = 0; r < 3; r++) {
            rect(ctx, 2, 1 + r * 7 + 6, 12, 1, METAL_D);
            rect(ctx, 6, 3 + r * 7, 4, 1, '#e5e7eb');
          }
          shadow(ctx, 1, 22, 14);
        },
      };
    case 'tv':
      return {
        w: f.w * TILE,
        h: 26,
        draw(ctx, w) {
          rect(ctx, 0, 0, w, 17, '#0f172a');
          rect(ctx, 1, 1, w - 2, 15, '#1e3a8a');
          rect(ctx, 3, 11, 4, 4, '#38bdf8');
          rect(ctx, 9, 8, 4, 7, '#a78bfa');
          rect(ctx, 15, 5, 4, 10, '#4ade80');
          rect(ctx, 21, 3, 4, 12, '#facc15');
          rect(ctx, w / 2 - 1, 17, 2, 6, '#334155');
          rect(ctx, w / 2 - 6, 23, 12, 2, '#334155');
        },
      };
    case 'sidetable':
      return {
        w: f.w * TILE,
        h: 18,
        draw(ctx, w) {
          shadow(ctx, 3, 16, w - 6);
          rect(ctx, 1, 2, w - 2, 7, WOOD_L);
          rect(ctx, 1, 8, w - 2, 2, WOOD_D);
          rect(ctx, 3, 10, 2, 6, WOOD_D);
          rect(ctx, w - 5, 10, 2, 6, WOOD_D);
          rect(ctx, 4, 3, 3, 3, '#f8fafc');
          if (w > 16) rect(ctx, w - 10, 3, 6, 4, '#fde047');
        },
      };
    case 'printer':
      return {
        w: 16,
        h: 22,
        draw(ctx) {
          rect(ctx, 1, 6, 14, 14, '#cbd5e1');
          rect(ctx, 1, 6, 14, 2, '#e2e8f0');
          rect(ctx, 3, 2, 10, 5, '#f8fafc');
          rect(ctx, 3, 12, 10, 2, '#475569');
          rect(ctx, 11, 9, 2, 1, '#22c55e');
          shadow(ctx, 1, 20, 14);
        },
      };
  }
}

/** Creates (once) and returns the texture key for a furniture piece. */
export function furnitureTexture(scene: Phaser.Scene, f: Furniture): { key: string; w: number; h: number } {
  const spec = specFor(f);
  const key = `f-${f.kind}-${f.variant ?? 0}-${f.w}x${f.h}-${f.kind.includes('plant') || f.kind === 'bookshelf' ? `${f.x}_${f.y}` : ''}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, spec.w, spec.h)!;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    spec.draw(ctx, spec.w, spec.h);
    tex.refresh();
  }
  return { key, w: spec.w, h: spec.h };
}
