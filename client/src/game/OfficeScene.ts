import Phaser from 'phaser';
import { AGENTS, AGENT_IDS, DEPARTMENTS, STATUS_LABEL, type AgentId } from '@pixel/shared';
import type { NpcView, OfficeGameOptions } from './bridge';
import { buildCharacters } from './characters';
import { buildFloor, wallFaceY } from './floor';
import { furnitureTexture } from './furniture';
import { furniture, MAP_H, MAP_W, ROOMS, TILE } from './map';
import { Npc, type NpcWorld } from './Npc';
import { hexToNumber } from './pixels';

const PIXEL_FONT = '"Press Start 2P", monospace';

export class OfficeScene extends Phaser.Scene {
  private npcs = new Map<AgentId, Npc>();
  private world: NpcWorld = { reserved: new Map() };
  private pendingViews: Record<AgentId, NpcView> | null = null;
  private pendingFocus: AgentId | null | undefined;
  private ready = false;
  private plaques: Phaser.GameObjects.GameObject[] = [];
  private tooltip!: Phaser.GameObjects.Text;
  private hovered: Npc | null = null;
  private fitZoom = 1;
  private userMovedCamera = false;
  private dragging = false;
  private downAt: { x: number; y: number } | null = null;

  constructor(private readonly opts: OfficeGameOptions) {
    super({ key: 'office' });
  }

  create() {
    this.add.image(0, 0, buildFloor(this)).setOrigin(0, 0).setDepth(-10000);

    for (const f of furniture) {
      const tex = furnitureTexture(this, f);
      const img = this.add.image(f.x * TILE, (f.y + f.h) * TILE, tex.key).setOrigin(0, 1);
      img.setDepth(f.depth ?? (f.y + f.h) * TILE);
    }

    this.drawPlaques();

    buildCharacters(this);
    for (const id of AGENT_IDS) this.npcs.set(id, new Npc(this, id, this.world));

    this.tooltip = this.add
      .text(0, 0, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '7px',
        color: '#f8fafc',
        backgroundColor: '#1a1420e8',
        padding: { x: 4, y: 3 },
        lineSpacing: 1,
      })
      .setResolution(8)
      .setOrigin(0.5, 1)
      .setDepth(300000)
      .setVisible(false);

    this.setupInput();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    // Re-render pixel-font labels once the web font is available.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts
      ?.load(`8px ${PIXEL_FONT}`)
      .then(() => {
        if (!this.sys.isActive()) return;
        this.drawPlaques();
        this.npcs.forEach((n) => n.refreshLabel());
      })
      .catch(() => undefined);

    this.ready = true;
    if (this.pendingViews) this.applyViews(this.pendingViews);
    if (this.pendingFocus !== undefined) this.focusAgent(this.pendingFocus);
  }

  private drawPlaques() {
    this.plaques.forEach((p) => p.destroy());
    this.plaques = [];
    for (const room of ROOMS) {
      const color = DEPARTMENTS[room.id].color;
      const cx = ((room.x0 + room.x1 + 1) / 2) * TILE;
      const cy = wallFaceY(room.y0);
      const text = this.add
        .text(cx, cy, room.label, { fontFamily: PIXEL_FONT, fontSize: '6px', color })
        .setOrigin(0.5, 0.5)
        .setResolution(8);
      const w = Math.ceil(text.width) + 8;
      const g = this.add.graphics();
      g.fillStyle(0x1a1420, 0.92);
      g.fillRoundedRect(cx - w / 2, cy - 5, w, 10, 2);
      g.lineStyle(1, hexToNumber(color), 0.9);
      g.strokeRoundedRect(cx - w / 2, cy - 5, w, 10, 2);
      const depth = 60000; // always readable, below NPC labels
      g.setDepth(depth);
      text.setDepth(depth + 0.1);
      this.plaques.push(g, text);
    }
  }

  private setupInput() {
    const cam = this.cameras.main;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downAt = { x: p.x, y: p.y };
      this.dragging = false;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.downAt) return;
      if (!this.dragging && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > 4) this.dragging = true;
      if (this.dragging) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
        this.userMovedCamera = true;
        this.clampCamera();
      }
    });

    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const wasDrag = this.dragging;
      this.dragging = false;
      this.downAt = null;
      if (wasDrag) return;
      const hit = over.find((o) => o.getData('agentId'));
      const id = (hit?.getData('agentId') as AgentId | undefined) ?? null;
      this.setSelected(id);
      this.opts.onSelectAgent(id);
    });

    this.input.on('gameobjectover', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const id = obj.getData('agentId') as AgentId | undefined;
      if (id) this.hovered = this.npcs.get(id) ?? null;
    });
    this.input.on('gameobjectout', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.hovered && obj.getData('agentId') === this.hovered.id) this.hovered = null;
    });

    this.input.on(
      'wheel',
      (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const old = cam.zoom;
        const next = Phaser.Math.Clamp(old * (dy > 0 ? 0.88 : 1.14), this.fitZoom * 0.8, 6);
        if (next === old) return;
        // Keep the world point under the cursor fixed while zooming.
        const hw = cam.width / 2;
        const hh = cam.height / 2;
        const wx = cam.scrollX + hw + (p.x - hw) / old;
        const wy = cam.scrollY + hh + (p.y - hh) / old;
        cam.setZoom(next);
        cam.scrollX = wx - hw - (p.x - hw) / next;
        cam.scrollY = wy - hh - (p.y - hh) / next;
        this.userMovedCamera = true;
        this.clampCamera();
      },
    );
  }

  private clampCamera() {
    const cam = this.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    // Camera centre in world space must stay over the map.
    const cx = Phaser.Math.Clamp(cam.scrollX + hw, 0, MAP_W);
    const cy = Phaser.Math.Clamp(cam.scrollY + hh, 0, MAP_H);
    cam.scrollX = cx - hw;
    cam.scrollY = cy - hh;
  }

  private fitCamera() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    this.fitZoom = Math.max(0.25, Math.min(w / (MAP_W + 12), h / (MAP_H + 12)));
    cam.setZoom(this.fitZoom);
    cam.centerOn(MAP_W / 2, MAP_H / 2);
  }

  private onResize() {
    if (!this.userMovedCamera) this.fitCamera();
    else {
      const w = this.scale.width;
      const h = this.scale.height;
      this.fitZoom = Math.max(0.25, Math.min(w / (MAP_W + 12), h / (MAP_H + 12)));
      this.clampCamera();
    }
  }

  private setSelected(id: AgentId | null) {
    this.npcs.forEach((n) => n.setSelected(n.id === id));
  }

  // ---- public API (called via OfficeGame) -------------------------------------

  applyViews(views: Record<AgentId, NpcView>) {
    if (!this.ready) {
      this.pendingViews = views;
      return;
    }
    for (const id of AGENT_IDS) {
      const v = views[id];
      if (v) this.npcs.get(id)?.setView(v);
    }
  }

  focusAgent(id: AgentId | null) {
    if (!this.ready) {
      this.pendingFocus = id;
      return;
    }
    this.setSelected(id);
    if (!id) return;
    const npc = this.npcs.get(id);
    if (!npc) return;
    const cam = this.cameras.main;
    const zoom = Math.max(cam.zoom, this.fitZoom * 1.7);
    cam.pan(npc.x, npc.y - 12, 600, 'Sine.easeInOut');
    cam.zoomTo(zoom, 600, 'Sine.easeInOut');
    this.userMovedCamera = true;
  }

  /** Reset the camera to show the whole office. */
  resetCamera() {
    this.userMovedCamera = false;
    this.fitCamera();
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.npcs.forEach((n) => n.update(dt));

    if (this.hovered) {
      const n = this.hovered;
      const p = AGENTS[n.id];
      const status = STATUS_LABEL[n.view.status];
      const activity = n.view.activity ? `\n${truncate(n.view.activity, 48)}` : '';
      const tag = n.view.live ? '' : n.view.status === 'idle' ? '' : ' (sim)';
      this.tooltip
        .setText(`${p.name} · ${p.title}\n${status}${tag}${activity}`)
        .setPosition(Math.round(n.x), Math.round(n.y) - 40)
        .setVisible(true);
    } else if (this.tooltip.visible) {
      this.tooltip.setVisible(false);
    }
  }

  shutdownNpcs() {
    this.npcs.forEach((n) => n.destroy());
    this.npcs.clear();
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
