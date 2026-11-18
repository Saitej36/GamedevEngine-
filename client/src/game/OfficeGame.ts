import Phaser from 'phaser';
import type { OfficeGameHandle, OfficeGameOptions } from './bridge';
import { OfficeScene } from './OfficeScene';

/**
 * Mounts the pixel-art office into `parent` and returns a small handle React uses to
 * push agent state in and receive NPC clicks out.
 */
export function createOfficeGame(parent: HTMLElement, opts: OfficeGameOptions): OfficeGameHandle {
  const scene = new OfficeScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#14111f',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 960,
      height: parent.clientHeight || 640,
    },
    input: { mouse: { preventDefaultWheel: true } },
    scene: [scene],
  });

  let destroyed = false;
  return {
    update(views) {
      if (!destroyed) scene.applyViews(views);
    },
    focus(id) {
      if (!destroyed) scene.focusAgent(id);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.shutdownNpcs();
      game.destroy(true);
    },
  };
}
