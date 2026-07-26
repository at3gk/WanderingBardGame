import Phaser from 'phaser';
import { Biome } from '../core/biome';

/**
 * Baking the world behind the staff — road bands, biome silhouettes, the
 * water glints, the star field and the trail signpost. Split out of
 * RoadScene alongside the engraving (see engraving.ts) for the same
 * reason: the scene was carrying far too much drawing code to read
 * comfortably, and none of this needs game state.
 *
 * Every one of these is a pure function of a biome (or of nothing at all),
 * cached by texture key, which is what lets `tools/scenery-sheet.mjs` bake
 * all of them at once and check the lot in a single image — a live
 * screenshot only ever shows whichever biome you happen to be walking
 * through.
 *
 * No image assets anywhere, per CLAUDE.md: everything here is Graphics.
 */

// Exported because the scene has to *place* what this module *draws* —
// a TileSprite's size and a signpost's origin must agree with the texture
// they show, and two copies of these numbers would be free to drift apart.
export const ROAD_TILE_WIDTH = 64;
export const ROAD_TILE_HEIGHT = 48;
// Background scenery band (ROADMAP task 31): silhouette features sitting on
// the horizon, scrolling slower than the road so the world reads as having
// depth. One repeating tile per biome, crossfaded exactly like the road.
export const SCENERY_TILE_WIDTH = 256;
export const SCENERY_TILE_HEIGHT = 120;
// Night sky (ROADMAP task 34): a starfield drifting far slower than the
// scenery is what turns two flat bands into a world with depth.
export const STAR_FIELD_HEIGHT = 200;
export const SIGNPOST_WIDTH = 36;
export const SIGNPOST_HEIGHT = 80;

/** Procedural ground tile (dashed band) per biome, generated once and reused via TileSprite scrolling. No image assets per CLAUDE.md. */
export function roadTileTexture(scene: Phaser.Scene, biome: Biome): string {
  const key = `roadTile-${biome.id}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(biome.roadBandColor, 1);
    g.fillRect(0, 0, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
    g.fillStyle(biome.roadDashColor, 1);
    g.fillRect(ROAD_TILE_WIDTH * 0.1, ROAD_TILE_HEIGHT * 0.4, ROAD_TILE_WIDTH * 0.3, 4);
    g.generateTexture(key, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
    g.destroy();
  }
  return key;
}

/**
 * One half of the riverside's water glints, on transparent, so the two
 * halves can be pulsed at opposite phases. A single layer pulsing as one
 * reads as a light blinking; two out of phase read as water moving.
 */
export function glintTexture(scene: Phaser.Scene, half: 0 | 1): string {
  const key = `scenery-glint-${half}`;
  if (scene.textures.exists(key)) return key;
  const H = SCENERY_TILE_HEIGHT;
  const dashes: Array<[number, number, number]> =
    half === 0
      ? [
          [20, H - 16, 18],
          [150, H - 18, 16],
        ]
      : [
          [80, H - 10, 14],
          [210, H - 12, 12],
        ];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  for (const [x, y, w] of dashes) g.fillRect(x, y, w, 2);
  g.generateTexture(key, SCENERY_TILE_WIDTH, SCENERY_TILE_HEIGHT);
  g.destroy();
  return key;
}

/**
 * Sparse starfield tile (ROADMAP task 34). Fixed positions rather than
 * random so every load (and every screenshot) is identical; denser in
 * the upper half — stars thin out toward the horizon haze. Cream like
 * the rest of the light in this game, never pure white.
 */
export function starFieldTexture(scene: Phaser.Scene): string {
  const key = 'star-field';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const stars: Array<[number, number, number, number]> = [
    [12, 30, 1.2, 0.9],
    [40, 122, 1.0, 0.5],
    [66, 58, 1.5, 0.8],
    [90, 16, 1.0, 0.6],
    [110, 92, 1.2, 0.7],
    [140, 38, 1.0, 0.9],
    [160, 138, 1.3, 0.5],
    [185, 70, 1.0, 0.8],
    [205, 22, 1.5, 0.6],
    [230, 108, 1.0, 0.7],
    [25, 168, 1.0, 0.4],
    [75, 150, 1.2, 0.6],
    [125, 176, 1.0, 0.5],
    [175, 162, 1.0, 0.45],
    [220, 154, 1.2, 0.55],
    [245, 62, 1.0, 0.75],
  ];
  for (const [x, y, r, a] of stars) {
    g.fillStyle(0xe8d9c0, a);
    g.fillCircle(x, y, r);
  }
  g.generateTexture(key, SCENERY_TILE_WIDTH, STAR_FIELD_HEIGHT);
  g.destroy();
  return key;
}

/**
 * Procedural background scenery tile per biome (ROADMAP task 31):
 * silhouette features drawn against a transparent sky so the camera's
 * blended background color shows through. Each biome gets its own shapes
 * — this is the "three vignettes" of DESIGN.md's concept finally visible
 * as places, not just palette swaps. Silhouettes are anchored to the
 * tile's bottom edge, which sits on the road band's top edge.
 */
export function sceneryTileTexture(scene: Phaser.Scene, biome: Biome): string {
  const key = `scenery-${biome.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const H = SCENERY_TILE_HEIGHT;

  if (biome.id === 'village') {
    // Three gabled houses of varying heights, warm lit windows, a chimney.
    g.fillStyle(biome.sceneryColor, 1);
    g.fillRect(24, H - 60, 52, 60);
    g.fillTriangle(18, H - 60, 82, H - 60, 50, H - 90);
    g.fillRect(64, H - 82, 8, 14);
    g.fillRect(124, H - 45, 44, 45);
    g.fillTriangle(118, H - 45, 172, H - 45, 146, H - 70);
    g.fillRect(202, H - 35, 36, 35);
    g.fillTriangle(198, H - 35, 240, H - 35, 220, H - 56);
    g.fillStyle(biome.sceneryAccent, 0.9);
    g.fillRect(34, H - 40, 6, 8);
    g.fillRect(58, H - 40, 6, 8);
    g.fillRect(140, H - 30, 6, 7);
    g.fillRect(216, H - 25, 5, 6);
  } else if (biome.id === 'forest') {
    // Conifer silhouettes, one round-canopy tree, a couple of fireflies.
    g.fillStyle(biome.sceneryColor, 1);
    g.fillTriangle(20, H, 60, H, 40, H - 80);
    g.fillTriangle(70, H, 110, H, 90, H - 55);
    g.fillTriangle(125, H, 175, H, 150, H - 90);
    g.fillRect(211, H - 25, 8, 25);
    g.fillCircle(215, H - 40, 22);
    g.fillStyle(biome.sceneryAccent, 0.8);
    g.fillCircle(70, H - 30, 1.5);
    g.fillCircle(185, H - 50, 1.5);
    g.fillCircle(120, H - 20, 1.2);
  } else {
    // Riverside: water band with glints, a tent, a campfire, reeds.
    g.fillStyle(0x16344a, 1);
    g.fillRect(0, H - 24, SCENERY_TILE_WIDTH, 24);
    // The water's glints are NOT baked here — they live in their own
    // layers so they can shimmer (see glintTexture).
    g.fillStyle(biome.sceneryColor, 1);
    g.fillTriangle(40, H - 24, 90, H - 24, 65, H - 60);
    g.fillTriangle(58, H - 24, 72, H - 24, 65, H - 46);
    g.fillRect(160, H - 34, 2, 12);
    g.fillRect(166, H - 36, 2, 14);
    g.fillRect(230, H - 32, 2, 10);
    g.fillStyle(0xe8c157, 0.95);
    g.fillCircle(110, H - 28, 3);
    g.fillStyle(0xe8c157, 0.25);
    g.fillCircle(110, H - 28, 7);
  }

  g.generateTexture(key, SCENERY_TILE_WIDTH, SCENERY_TILE_HEIGHT);
  g.destroy();
  return key;
}

/**
 * A small silhouette trail signpost (idea backlog): a post with two
 * angled boards, one per direction. Same neutral silhouette color in
 * every biome — unlike the lit windows/fireflies/water glints, it isn't
 * a light source, so per the art direction it stays cool rather than
 * warm. Origin is bottom-center so it can be placed with its post base
 * on the road's top edge, same as the scenery band's own silhouettes.
 */
export function signpostTexture(scene: Phaser.Scene): string {
  const key = 'signpost';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = SIGNPOST_WIDTH;
  const H = SIGNPOST_HEIGHT;
  const cx = W / 2;
  g.fillStyle(0x140e1a, 1);
  g.fillRect(cx - 3, H - 62, 6, 62);
  g.fillRect(cx - 3, H - 62, 23, 12);
  g.fillTriangle(cx + 20, H - 62, cx + 20, H - 50, cx + 27, H - 56);
  g.fillRect(cx - 20, H - 46, 23, 12);
  g.fillTriangle(cx - 20, H - 46, cx - 20, H - 34, cx - 27, H - 40);
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}
