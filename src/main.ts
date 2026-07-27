import Phaser from 'phaser';
import { noteTexture, restTexture } from './render/engraving';
import {
  farTileTexture,
  glintTexture,
  moonTexture,
  nearTileTexture,
  roadTileTexture,
  sceneryTileTexture,
  signpostTexture,
  starFieldTexture,
} from './render/scenery';
import { createStyleTextures, songbookTexture } from './render/ui';
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
  // Every sound in this game is hand-rolled Web Audio in audio/AudioEngine —
  // nothing ever touches Phaser's sound manager. Left enabled it still
  // creates a second AudioContext and holds it open for the whole session,
  // which on a phone is an idle claim on the audio hardware for no reason.
  // It also made an earlier verification script grab the wrong context.
  audio: { noAudio: true },
  scene: [RoadScene],
});

// Handle for headless verification (STATE.md, "Process notes for future
// runs"): the automated checks drive a real browser and need to reach the
// live scene to assert on gameplay state and to bake proof sheets of the
// notation. Phaser keeps no global registry of its own, and a read-only
// handle costs nothing at runtime.
(window as unknown as { game: Phaser.Game }).game = game;

// The engraving functions, for the same reason. tools/proofsheet.mjs bakes
// every note-value x staff-position the songbook can produce and checks
// them in one grid; it has to call the *same* code the game calls, or the
// proof sheet stops being proof. It used to reach a private method on the
// scene, which quietly broke the moment the engraving moved to its own
// module — so the handle is explicit now rather than incidental.
(window as unknown as { engraving: unknown }).engraving = { noteTexture, restTexture };

// Likewise the world textures, for tools/scenery-sheet.mjs. A live
// screenshot only ever shows the biome you happen to be walking through,
// so the sheet bakes all three at once instead.
(window as unknown as { scenery: unknown }).scenery = {
  roadTileTexture,
  sceneryTileTexture,
  glintTexture,
  starFieldTexture,
  signpostTexture,
  moonTexture,
  farTileTexture,
  nearTileTexture,
};

// And the shared UI glyphs, for tools/ui-sheet.mjs.
(window as unknown as { ui: unknown }).ui = { createStyleTextures, songbookTexture };
