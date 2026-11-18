import Phaser from 'phaser';
import { AGENTS, AGENT_IDS, type AgentId, type AgentProfile } from '@pixel/shared';
import { hexToRgb, outline, shade, type Ctx } from './pixels';

/** Procedurally generated character sprite sheets (one per employee). */

export const CHAR_W = 18;
export const CHAR_H = 26;

export type SheetDir = 'down' | 'up' | 'side';
export type Pose = 'walk' | 'idle' | 'work' | 'read' | 'meet' | 'cheer' | 'wait' | 'sad';

const POSE_FRAMES: Record<Pose, number> = {
  walk: 4,
  idle: 2,
  work: 2,
  read: 2,
  meet: 2,
  cheer: 2,
  wait: 2,
  sad: 2,
};

const POSE_RATE: Record<Pose, number> = {
  walk: 8,
  idle: 1.6,
  work: 6,
  read: 1.2,
  meet: 3,
  cheer: 5,
  wait: 1.5,
  sad: 0.8,
};

const DIRS: SheetDir[] = ['down', 'up', 'side'];
const POSES = Object.keys(POSE_FRAMES) as Pose[];

export function charTextureKey(id: AgentId) {
  return `char-${id}`;
}

export function animKey(id: AgentId, pose: Pose, dir: SheetDir) {
  return `${id}-${pose}-${dir}`;
}

interface Palette {
  skin: string;
  skinS: string;
  hair: string;
  hairHi: string;
  shirt: string;
  shirtS: string;
  pants: string;
  pantsS: string;
  accent: string;
  shoe: string;
  eye: string;
  mouth: string;
}

function palette(p: AgentProfile): Palette {
  const l = p.look;
  return {
    skin: l.skin,
    skinS: shade(l.skin, -0.18),
    hair: l.hair,
    hairHi: shade(l.hair, 0.3),
    shirt: l.shirt,
    shirtS: shade(l.shirt, -0.25),
    pants: l.pants,
    pantsS: shade(l.pants, -0.25),
    accent: l.accent,
    shoe: '#2a2230',
    eye: '#1b1626',
    mouth: '#7a2e3a',
  };
}

function drawCharacter(
  ctx: Ctx,
  ox: number,
  oy: number,
  look: AgentProfile['look'],
  pal: Palette,
  dir: SheetDir,
  pose: Pose,
  frame: number,
) {
  const p = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  const bob = (pose === 'idle' || pose === 'wait' || pose === 'sad') && frame === 1 ? 1 : 0;
  const drop = pose === 'sad' ? 1 : 0;
  const b = bob; // upper body offset
  const hy = b + drop; // head offset

  // ---- legs ---------------------------------------------------------------
  const leg = (x: number, lifted: boolean, color: string) => {
    if (lifted) {
      p(x, 18, 3, 3, color);
      p(x, 21, 3, 2, pal.shoe);
    } else {
      p(x, 18, 3, 4, color);
      p(x, 22, 3, 2, pal.shoe);
    }
  };
  if (dir === 'side') {
    if (pose === 'walk' && (frame === 1 || frame === 3)) {
      const back = frame === 1 ? pal.pantsS : pal.pants;
      const front = frame === 1 ? pal.pants : pal.pantsS;
      p(5, 18, 2, 4, back);
      p(4, 22, 3, 2, pal.shoe);
      p(9, 18, 2, 4, front);
      p(9, 22, 3, 2, pal.shoe);
    } else {
      p(6, 18, 4, 4, pal.pants);
      p(8, 18, 1, 4, pal.pantsS);
      p(6, 22, 5, 2, pal.shoe);
    }
  } else {
    const lLift = pose === 'walk' && frame === 1;
    const rLift = (pose === 'walk' && frame === 3) || (pose === 'wait' && frame === 1);
    leg(5, lLift, pal.pants);
    leg(8, rLift, pal.pantsS);
  }

  // ---- torso --------------------------------------------------------------
  if (dir === 'side') {
    p(5, 11 + b, 6, 7, pal.shirt);
    p(5, 11 + b, 1, 7, pal.shirtS);
    p(5, 17 + b, 6, 1, pal.pantsS);
  } else {
    p(4, 11 + b, 8, 7, pal.shirt);
    p(11, 11 + b, 1, 7, pal.shirtS);
    p(4, 17 + b, 8, 1, pal.pantsS);
    if (dir === 'down') {
      p(7, 11 + b, 2, 2, pal.accent);
      if (pose === 'sad') p(4, 11 + b, 8, 1, pal.shirtS);
    }
  }

  // ---- arms ---------------------------------------------------------------
  const front = dir === 'down';
  if (dir === 'side') {
    switch (pose) {
      case 'walk': {
        const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
        p(7, 12 + b, 2, 4, pal.shirtS);
        p(7 + swing, 16 + b, 2, 1, pal.skin);
        break;
      }
      case 'work':
        p(7, 12 + b, 2, 2, pal.shirtS);
        p(8, 14 + b, 3, 1, pal.shirtS);
        p(11, 14 + b - (frame === 1 ? 1 : 0), 1, 1, pal.skin);
        break;
      case 'read':
        p(7, 12 + b, 2, 2, pal.shirtS);
        p(9, 12 + b, 3, 4, frame === 0 ? '#f8f4e3' : '#ece4c8');
        p(11, 12 + b, 1, 4, pal.accent);
        p(9, 14 + b, 1, 1, pal.skin);
        break;
      case 'meet':
        p(7, 12 + b, 2, 1, pal.shirtS);
        if (frame === 0) {
          p(9, 10 + b, 2, 2, pal.shirtS);
          p(11, 9 + b, 1, 1, pal.skin);
        } else {
          p(9, 12 + b, 2, 1, pal.shirtS);
          p(11, 12 + b, 1, 1, pal.skin);
        }
        break;
      case 'cheer':
        p(8, 5 + b + frame, 2, 6, pal.shirtS);
        p(8 + frame, 4 + b + frame, 2, 1, pal.skin);
        break;
      case 'wait':
        p(7, 12 + b, 2, 3, pal.shirtS);
        p(8, 15 + b, 2, 1, pal.skin);
        break;
      default:
        p(7, 12 + b, 2, 4, pal.shirtS);
        p(7, 16 + b, 2, 1, pal.skin);
    }
  } else {
    const armDown = (x: number, dy = 0) => {
      p(x, 12 + b + dy, 1, 5, pal.shirt);
      p(x, 17 + b + dy, 1, 1, pal.skin);
    };
    switch (pose) {
      case 'walk': {
        const s = frame === 1 ? -1 : frame === 3 ? 1 : 0;
        armDown(3, s);
        armDown(12, -s);
        break;
      }
      case 'work': {
        p(3, 12 + b, 1, 3, pal.shirt);
        p(12, 12 + b, 1, 3, pal.shirt);
        if (front) {
          p(4, 15 + b, 1, 1, pal.shirt);
          p(11, 15 + b, 1, 1, pal.shirt);
          p(5, 15 + b - (frame === 0 ? 1 : 0), 1, 1, pal.skin);
          p(10, 15 + b - (frame === 1 ? 1 : 0), 1, 1, pal.skin);
        }
        break;
      }
      case 'read':
        p(3, 12 + b, 1, 4, pal.shirt);
        p(12, 12 + b, 1, 4, pal.shirt);
        if (front) {
          p(5, 13 + b, 6, 4, pal.accent);
          p(6, 13 + b, 4, 3, '#f8f4e3');
          p(frame === 0 ? 6 : 8, 14 + b, 2, 1, '#b9b09a');
          p(7, 13 + b, 1, 3, '#d8cfb6');
          p(4, 15 + b, 1, 1, pal.skin);
          p(11, 15 + b, 1, 1, pal.skin);
        }
        break;
      case 'meet':
        armDown(3);
        if (frame === 0) {
          p(12, 9 + b, 1, 4, pal.shirt);
          p(13, 8 + b, 1, 2, pal.skin);
        } else {
          p(12, 12 + b, 1, 2, pal.shirt);
          p(13, 12 + b, 1, 2, pal.skin);
        }
        break;
      case 'cheer':
        if (frame === 0) {
          p(3, 6 + b, 1, 6, pal.shirt);
          p(12, 6 + b, 1, 6, pal.shirt);
          p(3, 5 + b, 1, 1, pal.skin);
          p(12, 5 + b, 1, 1, pal.skin);
        } else {
          p(2, 7 + b, 2, 5, pal.shirt);
          p(12, 7 + b, 2, 5, pal.shirt);
          p(1, 6 + b, 1, 2, pal.skin);
          p(14, 6 + b, 1, 2, pal.skin);
        }
        break;
      case 'wait':
        p(3, 12 + b, 1, 4, pal.shirt);
        p(12, 12 + b, 1, 4, pal.shirt);
        if (front) {
          p(4, 14 + b, 8, 2, pal.shirtS);
          p(4, 14 + b, 1, 1, pal.skin);
          p(11, 15 + b, 1, 1, pal.skin);
        }
        break;
      default:
        armDown(3);
        armDown(12);
    }
  }

  // ---- head ---------------------------------------------------------------
  const y0 = hy;
  if (dir === 'side') {
    p(6, 3 + y0, 5, 1, pal.skin);
    p(5, 4 + y0, 7, 6, pal.skin);
    p(6, 10 + y0, 5, 1, pal.skin);
    p(7, 7 + y0, 1, 2, pal.skinS);
    if (pose === 'sad') p(9, 7 + y0, 2, 1, pal.eye);
    else p(10, 6 + y0, 1, 2, pal.eye);
    if (pose === 'meet' && frame === 0) p(10, 9 + y0, 2, 1, pal.mouth);
    if (pose === 'cheer') p(10, 9 + y0, 2, 1, pal.mouth);
  } else {
    p(5, 3 + y0, 6, 1, pal.skin);
    p(4, 4 + y0, 8, 6, pal.skin);
    p(5, 10 + y0, 6, 1, pal.skin);
    p(3, 7 + y0, 1, 2, pal.skinS);
    p(12, 7 + y0, 1, 2, pal.skinS);
    if (dir === 'down') {
      if (pose === 'sad') {
        p(5, 7 + y0, 2, 1, pal.eye);
        p(9, 7 + y0, 2, 1, pal.eye);
        p(7, 9 + y0, 2, 1, pal.skinS);
      } else {
        p(6, 6 + y0, 1, 2, pal.eye);
        p(9, 6 + y0, 1, 2, pal.eye);
        const open = (pose === 'meet' && frame === 0) || pose === 'cheer';
        p(7, 9 + y0, 2, 1, open ? pal.mouth : pal.skinS);
        if (pose === 'cheer') p(6, 8 + y0, 1, 1, pal.mouth), p(9, 8 + y0, 1, 1, pal.mouth);
      }
    }
  }

  // ---- hair ---------------------------------------------------------------
  const style = look.hairStyle;
  const H = pal.hair;
  const HH = pal.hairHi;
  if (dir === 'down') {
    switch (style) {
      case 'short':
        p(5, 2 + y0, 6, 1, H);
        p(4, 3 + y0, 8, 2, H);
        p(4, 5 + y0, 1, 2, H);
        p(11, 5 + y0, 1, 2, H);
        p(6, 3 + y0, 2, 1, HH);
        break;
      case 'long':
        p(5, 2 + y0, 6, 1, H);
        p(4, 3 + y0, 8, 2, H);
        p(3, 5 + y0, 2, 8, H);
        p(11, 5 + y0, 2, 8, H);
        p(4, 5 + y0, 1, 1, H);
        p(6, 3 + y0, 2, 1, HH);
        break;
      case 'bun':
        p(6, 0 + y0, 4, 2, H);
        p(7, 0 + y0, 1, 1, HH);
        p(5, 2 + y0, 6, 1, H);
        p(4, 3 + y0, 8, 2, H);
        p(4, 5 + y0, 1, 2, H);
        p(11, 5 + y0, 1, 2, H);
        break;
      case 'spiky':
        p(4, 1 + y0, 1, 1, H);
        p(6, 0 + y0, 1, 2, H);
        p(9, 0 + y0, 1, 2, H);
        p(11, 1 + y0, 1, 1, H);
        p(4, 2 + y0, 8, 3, H);
        p(4, 5 + y0, 1, 1, H);
        p(11, 5 + y0, 1, 1, H);
        p(7, 2 + y0, 2, 1, HH);
        break;
      case 'bald':
        p(4, 5 + y0, 1, 3, H);
        p(11, 5 + y0, 1, 3, H);
        p(6, 4 + y0, 2, 1, shade(look.skin, 0.35));
        break;
      case 'cap': {
        const cap = shade(look.shirt, -0.1);
        p(5, 1 + y0, 6, 1, cap);
        p(4, 2 + y0, 8, 3, cap);
        p(7, 2 + y0, 2, 1, look.accent);
        p(4, 5 + y0, 9, 1, shade(look.shirt, -0.35));
        p(4, 6 + y0, 1, 1, H);
        p(11, 6 + y0, 1, 1, H);
        break;
      }
    }
  } else if (dir === 'up') {
    switch (style) {
      case 'bald':
        p(4, 7 + y0, 8, 3, H);
        p(6, 4 + y0, 2, 1, shade(look.skin, 0.35));
        break;
      case 'cap': {
        const cap = shade(look.shirt, -0.1);
        p(5, 1 + y0, 6, 1, cap);
        p(4, 2 + y0, 8, 4, cap);
        p(4, 6 + y0, 8, 3, H);
        p(6, 5 + y0, 4, 1, shade(look.shirt, -0.35));
        break;
      }
      case 'long':
        p(5, 2 + y0, 6, 1, H);
        p(4, 3 + y0, 8, 7, H);
        p(3, 5 + y0, 10, 8, H);
        p(6, 3 + y0, 3, 1, HH);
        break;
      default:
        if (style === 'bun') p(6, 0 + y0, 4, 3, H);
        if (style === 'spiky') {
          p(4, 1 + y0, 1, 1, H);
          p(6, 0 + y0, 1, 2, H);
          p(9, 0 + y0, 1, 2, H);
          p(11, 1 + y0, 1, 1, H);
        }
        p(5, 2 + y0, 6, 1, H);
        p(4, 3 + y0, 8, 6, H);
        p(5, 9 + y0, 6, 1, H);
        p(6, 3 + y0, 3, 1, HH);
    }
  } else {
    // side, facing right
    switch (style) {
      case 'bald':
        p(5, 6 + y0, 2, 3, H);
        p(8, 4 + y0, 2, 1, shade(look.skin, 0.35));
        break;
      case 'cap': {
        const cap = shade(look.shirt, -0.1);
        p(6, 1 + y0, 5, 1, cap);
        p(5, 2 + y0, 7, 3, cap);
        p(10, 5 + y0, 4, 1, shade(look.shirt, -0.35));
        p(5, 5 + y0, 2, 3, H);
        break;
      }
      case 'long':
        p(6, 2 + y0, 5, 1, H);
        p(5, 3 + y0, 7, 2, H);
        p(4, 5 + y0, 4, 8, H);
        p(7, 3 + y0, 2, 1, HH);
        break;
      default:
        if (style === 'bun') p(3, 3 + y0, 3, 3, H);
        if (style === 'spiky') {
          p(4, 2 + y0, 1, 1, H);
          p(6, 0 + y0, 1, 2, H);
          p(9, 0 + y0, 1, 2, H);
        }
        p(6, 2 + y0, 5, 1, H);
        p(5, 3 + y0, 7, 2, H);
        p(5, 5 + y0, 3, 3, H);
        p(7, 3 + y0, 2, 1, HH);
    }
  }
}

/** Builds every agent's sprite sheet texture and registers their animations. */
export function buildCharacters(scene: Phaser.Scene) {
  const framesPerDir = POSES.reduce((n, pose) => n + POSE_FRAMES[pose], 0);
  const width = framesPerDir * CHAR_W;
  const height = DIRS.length * CHAR_H;

  for (const id of AGENT_IDS) {
    const key = charTextureKey(id);
    if (scene.textures.exists(key)) continue;
    const profile = AGENTS[id];
    const pal = palette(profile);
    const tex = scene.textures.createCanvas(key, width, height)!;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    DIRS.forEach((dir, row) => {
      let col = 0;
      for (const pose of POSES) {
        for (let f = 0; f < POSE_FRAMES[pose]; f++) {
          drawCharacter(ctx, col * CHAR_W + 1, row * CHAR_H + 1, profile.look, pal, dir, pose, f);
          const name = `${dir}-${pose}-${f}`;
          tex.add(name, 0, col * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H);
          col++;
        }
      }
    });
    outline(ctx, width, height, CHAR_W, CHAR_H, hexToRgb('#1a1420'));
    tex.refresh();

    for (const dir of DIRS) {
      for (const pose of POSES) {
        const k = animKey(id, pose, dir);
        if (scene.anims.exists(k)) continue;
        scene.anims.create({
          key: k,
          frames: Array.from({ length: POSE_FRAMES[pose] }, (_, f) => ({ key, frame: `${dir}-${pose}-${f}` })),
          frameRate: POSE_RATE[pose],
          repeat: -1,
        });
      }
    }
  }
}
