import Phaser from 'phaser';
import { AGENTS, type AgentId, type AgentStatus } from '@pixel/shared';
import type { NpcView } from './bridge';
import { animKey, charTextureKey, CHAR_H, type Pose, type SheetDir } from './characters';
import { DESKS, MEETING_SEATS, POIS, TILE, type Dir, type Point } from './map';
import { findPath, nearestWalkable } from './pathfinding';

const SPEED = 56; // px / second
const FONT = '"Press Start 2P", monospace';

export const STATUS_COLOR: Record<AgentStatus, number> = {
  idle: 0x9ca3af,
  walking: 0x9ca3af,
  working: 0x22c55e,
  reading: 0x38bdf8,
  meeting: 0xfacc15,
  celebrating: 0xf472b6,
  blocked: 0xfb923c,
  error: 0xef4444,
};

interface Action {
  pose: Pose;
  dir: Dir;
}

type Mode = 'moving' | 'acting' | 'waiting';

/** Shared bookkeeping so two NPCs never pick the same roaming spot. */
export interface NpcWorld {
  reserved: Map<string, AgentId>;
}

export function tileToFeet(t: Point): Point {
  return { x: t.x * TILE + 8, y: t.y * TILE + 13 };
}

export class Npc {
  readonly id: AgentId;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly dot: Phaser.GameObjects.Arc;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleText: Phaser.GameObjects.Text;

  x: number;
  y: number;
  view: NpcView;
  selected = false;

  private path: Point[] = [];
  private arrive: Action | null = null;
  private mode: Mode = 'waiting';
  private waitMs = 0;
  private roaming = true;
  private poiId: string | null = null;
  private hopT = 0;
  private facing: Dir = 'down';
  private errorFlashMs = 0;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    id: AgentId,
    private readonly world: NpcWorld,
  ) {
    this.id = id;
    const start = tileToFeet(DESKS[id].seat);
    this.x = start.x;
    this.y = start.y;
    this.view = { agentId: id, status: 'idle', activity: '', bubble: '', live: false };

    this.shadow = scene.add.ellipse(this.x, this.y, 12, 5, 0x140e1e, 0.28);
    this.ring = scene.add.ellipse(this.x, this.y, 20, 9).setStrokeStyle(1.5, 0xfde047, 1).setVisible(false);

    this.sprite = scene.add.sprite(this.x, this.y, charTextureKey(id));
    this.sprite.setOrigin(0.5, 25 / CHAR_H);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.setData('agentId', id);

    const profile = AGENTS[id];
    const name = (this.nameText = scene.add
      .text(3, 2, profile.name.split(' ')[0].toUpperCase(), {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#ffffff',
        stroke: '#1a1420',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setResolution(8));
    this.dot = scene.add.circle(-name.width / 2 - 1, 4.5, 2, STATUS_COLOR.idle).setStrokeStyle(1, 0x1a1420);

    const bubbleBg = scene.add.graphics();
    bubbleBg.fillStyle(0xffffff, 1);
    bubbleBg.lineStyle(1, 0x1a1420, 1);
    bubbleBg.fillRoundedRect(-8, -14, 16, 13, 3);
    bubbleBg.strokeRoundedRect(-8, -14, 16, 13, 3);
    bubbleBg.fillTriangle(-2, -1.5, 2, -1.5, 0, 2);
    bubbleBg.lineBetween(-2, -1, 0, 2);
    bubbleBg.lineBetween(2, -1, 0, 2);
    this.bubbleText = scene.add
      .text(0, -7.5, '', { fontFamily: 'sans-serif', fontSize: '9px' })
      .setOrigin(0.5, 0.5)
      .setResolution(6);
    this.bubble = scene.add.container(0, -CHAR_H - 1, [bubbleBg, this.bubbleText]).setVisible(false);

    this.overlay = scene.add.container(this.x, this.y, [name, this.dot, this.bubble]);

    this.playAction({ pose: 'idle', dir: 'down' });
    this.mode = 'waiting';
    this.waitMs = 500 + Math.random() * 2500;
  }

  /** Current tile under the NPC's feet. */
  tile(): Point {
    return { x: Math.floor(this.x / TILE), y: Math.floor((this.y - 1) / TILE) };
  }

  /** Re-measure the name label (after the pixel font finishes loading). */
  refreshLabel() {
    this.nameText.updateText();
    this.dot.x = -this.nameText.width / 2 - 1;
  }

  setSelected(sel: boolean) {
    this.selected = sel;
    this.ring.setVisible(sel);
  }

  setView(v: NpcView) {
    const prev = this.view.status;
    this.view = v;
    this.dot.setFillStyle(STATUS_COLOR[v.status]);
    this.bubbleText.setText(v.bubble);
    this.bubble.setVisible(!!v.bubble);
    if (prev !== v.status) this.applyStatus(prev);
  }

  private applyStatus(prev: AgentStatus) {
    const s = this.view.status;
    this.releasePoi();
    this.hopT = 0;
    if (s !== 'error') this.sprite.clearTint();
    switch (s) {
      case 'working':
        this.goTo(DESKS[this.id].seat, { pose: 'work', dir: 'down' });
        break;
      case 'reading':
        this.goTo(DESKS[this.id].seat, { pose: 'read', dir: 'down' });
        break;
      case 'blocked':
        this.goTo(DESKS[this.id].seat, { pose: 'wait', dir: 'down' });
        break;
      case 'error':
        this.errorFlashMs = 1500;
        this.goTo(DESKS[this.id].seat, { pose: 'sad', dir: 'down' });
        break;
      case 'meeting': {
        const seat = MEETING_SEATS[this.id];
        this.goTo(seat.tile, { pose: 'meet', dir: seat.dir });
        break;
      }
      case 'celebrating':
        this.path = [];
        this.roaming = false;
        this.playAction({ pose: 'cheer', dir: 'down' });
        this.hopT = 0.0001;
        break;
      case 'idle':
      case 'walking':
        this.roaming = true;
        // Linger a moment where the last job finished before wandering off.
        this.path = [];
        this.mode = 'waiting';
        this.waitMs = prev === 'idle' || prev === 'walking' ? 800 : 1500 + Math.random() * 2000;
        this.playAction({ pose: 'idle', dir: this.facing });
        break;
    }
  }

  private goTo(target: Point, action: Action) {
    this.roaming = this.view.status === 'idle' || this.view.status === 'walking';
    const here = this.tile();
    const start = nearestWalkable(here);
    const path = findPath(start, target);
    if (path === null) {
      // Unreachable — teleport rather than freeze.
      const p = tileToFeet(target);
      this.x = p.x;
      this.y = p.y;
      this.path = [];
      this.arrive = action;
      this.playAction(action);
      return;
    }
    // Re-centre on the current tile first if we were interrupted between tiles.
    const c = tileToFeet(start);
    const off = Math.abs(c.x - this.x) + Math.abs(c.y - this.y) > 0.5;
    this.path = off ? [start, ...path] : path;
    this.arrive = action;
    if (this.path.length === 0) this.playAction(action);
    else this.mode = 'moving';
  }

  private playAction(a: Action) {
    this.mode = 'acting';
    this.facing = a.dir;
    const sheetDir: SheetDir = a.dir === 'left' || a.dir === 'right' ? 'side' : a.dir;
    this.sprite.setFlipX(a.dir === 'left');
    this.sprite.play(animKey(this.id, a.pose, sheetDir), true);
  }

  private startWalkAnim(dir: Dir) {
    if (this.facing === dir && this.sprite.anims.currentAnim?.key.includes('-walk-')) return;
    this.facing = dir;
    const sheetDir: SheetDir = dir === 'left' || dir === 'right' ? 'side' : dir;
    this.sprite.setFlipX(dir === 'left');
    this.sprite.play(animKey(this.id, 'walk', sheetDir), true);
  }

  private releasePoi() {
    if (this.poiId && this.world.reserved.get(this.poiId) === this.id) this.world.reserved.delete(this.poiId);
    this.poiId = null;
  }

  /** Ambient behaviour for idle employees: wander between points of interest. */
  private pickRoamTarget() {
    this.releasePoi();
    if (Math.random() < 0.22) {
      this.goTo(DESKS[this.id].seat, { pose: Math.random() < 0.5 ? 'work' : 'idle', dir: 'down' });
      return;
    }
    const here = this.tile();
    const free = POIS.filter(
      (p) => !this.world.reserved.has(p.id) && (p.tile.x !== here.x || p.tile.y !== here.y),
    );
    if (!free.length) {
      this.waitMs = 2000;
      return;
    }
    const poi = free[Math.floor(Math.random() * free.length)];
    this.poiId = poi.id;
    this.world.reserved.set(poi.id, this.id);
    this.goTo(poi.tile, { pose: poi.pose, dir: poi.dir });
  }

  update(dtMs: number) {
    this.time += dtMs;
    const dt = dtMs / 1000;

    if (this.mode === 'moving') {
      let budget = SPEED * dt;
      while (budget > 0 && this.path.length) {
        const next = tileToFeet(this.path[0]);
        const dx = next.x - this.x;
        const dy = next.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
          const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          this.startWalkAnim(dir);
        }
        if (dist <= budget) {
          this.x = next.x;
          this.y = next.y;
          budget -= dist;
          this.path.shift();
        } else {
          this.x += (dx / dist) * budget;
          this.y += (dy / dist) * budget;
          budget = 0;
        }
      }
      if (!this.path.length) {
        if (this.arrive) this.playAction(this.arrive);
        if (this.roaming) {
          this.mode = 'waiting';
          this.waitMs = 3000 + Math.random() * 6000;
        }
      }
    } else if (this.roaming) {
      this.waitMs -= dtMs;
      if (this.waitMs <= 0) {
        this.waitMs = 0;
        this.pickRoamTarget();
      }
    }

    // Celebration hop.
    let hop = 0;
    if (this.hopT > 0) {
      this.hopT += dt;
      hop = Math.abs(Math.sin(this.hopT * 9)) * 5;
    }

    if (this.errorFlashMs > 0) {
      this.errorFlashMs -= dtMs;
      this.sprite.setTint(Math.floor(this.time / 150) % 2 ? 0xff6b6b : 0xffffff);
      if (this.errorFlashMs <= 0) this.sprite.setTint(0xffb4b4);
    }

    const rx = Math.round(this.x);
    const ry = Math.round(this.y);
    this.sprite.setPosition(rx, ry - Math.round(hop));
    this.sprite.setDepth(ry);
    this.shadow.setPosition(rx, ry).setDepth(ry - 0.6).setScale(hop ? 1 - hop / 12 : 1);
    this.ring.setPosition(rx, ry).setDepth(ry - 0.5);
    if (this.selected) this.ring.setAlpha(0.55 + Math.sin(this.time / 180) * 0.45);
    this.overlay.setPosition(rx, ry - Math.round(hop));
    this.overlay.setDepth(100000 + ry);
    // Gentle float on the speech bubble.
    this.bubble.y = -CHAR_H - 1 + Math.round(Math.sin(this.time / 300));
  }

  destroy() {
    this.releasePoi();
    this.sprite.destroy();
    this.shadow.destroy();
    this.ring.destroy();
    this.overlay.destroy(true);
  }
}
