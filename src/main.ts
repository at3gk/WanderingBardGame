import Phaser from 'phaser';
import { RoadScene } from './scenes/RoadScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  backgroundColor: '#1a1621',
  scene: [RoadScene],
});

// Handle for headless verification (STATE.md, "Process notes for future
// runs"): the automated checks drive a real browser and need to reach the
// live scene to assert on gameplay state and to bake proof sheets of the
// notation. Phaser keeps no global registry of its own, and a read-only
// handle costs nothing at runtime.
(window as unknown as { game: Phaser.Game }).game = game;
