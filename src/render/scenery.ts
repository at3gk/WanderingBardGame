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
// Doubled from 256. At 256 the same three houses repeated three and a half
// times across a desktop screen and the repeat was the first thing you saw.
// 512 halves that frequency and, more importantly, leaves room for the
// silhouettes inside one tile to differ from each other.
export const SCENERY_TILE_WIDTH = 512;
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
    const W = ROAD_TILE_WIDTH;
    const H = ROAD_TILE_HEIGHT;

    g.fillStyle(biome.roadBandColor, 1);
    g.fillRect(0, 0, W, H);

    // Verges, top and bottom. Everything added here has to be *continuous
    // along the tile*: ROAD_TILE_WIDTH is load-bearing — the road scrolls
    // exactly one tile per beat, which is what keeps the bard's footfalls
    // on the music — so the tile cannot be widened, and any detail that
    // varies across 64px repeats about fourteen times on a phone and reads
    // as wallpaper. Edges running the full width have no period at all.
    //
    // The near edge catches the light and the far edge falls away into the
    // scenery, which is what gives a flat band a top and a bottom rather
    // than being a bar of colour.
    g.fillStyle(recede(biome.roadDashColor, biome.sceneryAccent, 0.12), 0.55);
    g.fillRect(0, 0, W, 2);
    g.fillStyle(biome.sceneryColor, 0.35);
    g.fillRect(0, H - 3, W, 3);

    g.fillStyle(biome.roadDashColor, 1);
    g.fillRect(W * 0.1, H * 0.4, W * 0.3, 4);

    g.generateTexture(key, W, H);
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
          [276, H - 15, 20],
          [410, H - 17, 15],
        ]
      : [
          [80, H - 10, 14],
          [210, H - 12, 12],
          [338, H - 11, 16],
          [468, H - 13, 13],
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
    [268, 44, 1.1, 0.6],
    [300, 112, 1.0, 0.5],
    [325, 20, 1.4, 0.85],
    [352, 76, 1.0, 0.55],
    [378, 134, 1.2, 0.6],
    [402, 34, 1.0, 0.7],
    [430, 98, 1.3, 0.5],
    [455, 52, 1.0, 0.8],
    [478, 146, 1.1, 0.45],
    [290, 172, 1.0, 0.5],
    [340, 158, 1.2, 0.55],
    [396, 180, 1.0, 0.4],
    [446, 166, 1.0, 0.5],
    [500, 120, 1.1, 0.6],
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
    // Seven buildings across the tile, no two the same height and no two
    // the same gap apart — an evenly spaced row reads as wallpaper however
    // wide the tile is.
    g.fillStyle(biome.sceneryColor, 1);
    const houses: Array<[number, number, number]> = [
      // [left, width, wall height]
      [24, 52, 60],
      [124, 44, 45],
      [202, 36, 35],
      [258, 58, 68],
      [340, 40, 40],
      [396, 48, 54],
      [462, 34, 32],
    ];
    for (const [x, w, wall] of houses) {
      g.fillRect(x, H - wall, w, wall);
      // Roof pitch scales with the house, so a tall one is not wearing a
      // small one's hat.
      g.fillTriangle(x - 6, H - wall, x + w + 6, H - wall, x + w / 2, H - wall - (14 + w * 0.28));
    }
    // Two chimneys, on the two tallest.
    g.fillRect(64, H - 82, 8, 14);
    g.fillRect(300, H - 92, 8, 15);
    // Lit windows: not on every house, because a village at dusk has some
    // dark ones, and the gaps are what make the lit ones read as light.
    g.fillStyle(biome.sceneryAccent, 0.9);
    const windows: Array<[number, number, number, number]> = [
      [34, H - 40, 6, 8],
      [58, H - 40, 6, 8],
      [140, H - 30, 6, 7],
      [216, H - 25, 5, 6],
      [270, H - 46, 6, 8],
      [294, H - 46, 6, 8],
      [408, H - 36, 6, 7],
      [472, H - 22, 5, 6],
    ];
    for (const [x, y, w, h] of windows) g.fillRect(x, y, w, h);
  } else if (biome.id === 'forest') {
    // A stand of conifers at varying heights plus two round-canopy trees.
    g.fillStyle(biome.sceneryColor, 1);
    const firs: Array<[number, number, number]> = [
      // [centre, half-width, height]
      [40, 20, 80],
      [90, 20, 55],
      [150, 25, 90],
      [268, 22, 72],
      [318, 17, 48],
      [372, 26, 96],
      [438, 19, 62],
    ];
    for (const [cx, hw, ht] of firs) g.fillTriangle(cx - hw, H, cx + hw, H, cx, H - ht);
    g.fillRect(211, H - 25, 8, 25);
    g.fillCircle(215, H - 40, 22);
    g.fillRect(480, H - 20, 7, 20);
    g.fillCircle(483, H - 32, 17);
    // Fireflies, scattered rather than spaced.
    g.fillStyle(biome.sceneryAccent, 0.8);
    for (const [x, y, r] of [[70, H - 30, 1.5], [185, H - 50, 1.5], [120, H - 20, 1.2],
                             [300, H - 38, 1.4], [420, H - 26, 1.2], [455, H - 54, 1.5]]) {
      g.fillCircle(x, y, r);
    }
  } else {
    // Riverside: water band with glints, a tent, a campfire, reeds.
    g.fillStyle(0x16344a, 1);
    g.fillRect(0, H - 24, SCENERY_TILE_WIDTH, 24);
    // The water's glints are NOT baked here — they live in their own
    // layers so they can shimmer (see glintTexture).
    g.fillStyle(biome.sceneryColor, 1);
    // Two camps along the bank rather than one repeated every 256px.
    for (const cx of [65, 330]) {
      g.fillTriangle(cx - 25, H - 24, cx + 25, H - 24, cx, H - 60);
      g.fillTriangle(cx - 7, H - 24, cx + 7, H - 24, cx, H - 46);
    }
    // Reeds in loose clumps.
    for (const [x, h] of [[160, 12], [166, 14], [230, 10], [388, 13], [396, 16], [462, 11], [470, 9]]) {
      g.fillRect(x, H - 24 - h, 2, h);
    }
    // Campfires, each with its glow.
    for (const cx of [110, 375]) {
      g.fillStyle(0xe8c157, 0.95);
      g.fillCircle(cx, H - 28, 3);
      g.fillStyle(0xe8c157, 0.25);
      g.fillCircle(cx, H - 28, 7);
    }
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

/**
 * The moon: a warm cream disc with a few craters.
 *
 * It is the largest single thing in the sky and was a plain flat circle
 * while every other element in the world — the gabled houses, the conifers,
 * the tent and campfire — carries some shape. The craters are drawn only a
 * little darker than the disc, and never outlined: the art direction makes
 * the moon a *light source*, so it has to keep reading as one from across
 * the room. They are texture, not detail to be studied.
 *
 * Baked rather than assembled from Arcs so the whole moon is one image the
 * scene can fade with the dusk cycle in a single setAlpha.
 */
export function moonTexture(scene: Phaser.Scene, radius: number): string {
  const key = `moon-${radius}`;
  if (scene.textures.exists(key)) return key;

  const d = radius * 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xe8d9c0, 1);
  g.fillCircle(radius, radius, radius);
  // Craters, as a fraction of the radius so the moon can be resized without
  // them drifting off its face. Kept clear of the rim — a crater breaking
  // the edge would read as a bite taken out of it rather than as a shadow.
  g.fillStyle(0xd6c4a6, 1);
  const craters: Array<[number, number, number]> = [
    [-0.30, -0.26, 0.20],
    [0.26, 0.10, 0.15],
    [-0.10, 0.38, 0.11],
    [0.34, -0.36, 0.08],
  ];
  for (const [cx, cy, cr] of craters) {
    g.fillCircle(radius + cx * radius, radius + cy * radius, cr * radius);
  }

  g.generateTexture(key, d, d);
  g.destroy();
  return key;
}

/**
 * Aerial perspective: how far a silhouette recedes toward the sky.
 *
 * Distant things are not just smaller, they are *paler* — haze between you
 * and them washes them toward the colour of the sky. Deriving the far
 * layer's colour from each biome's own sky and silhouette (rather than
 * adding a hand-picked colour to every biome) means it stays correct for
 * free whenever a palette is re-pitched, which has already happened once.
 */
export function recede(sceneryColor: number, skyColor: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const mix = (shift: number) => {
    const a = (sceneryColor >> shift) & 0xff;
    const b = (skyColor >> shift) & 0xff;
    return Math.round(a + (b - a) * t) & 0xff;
  };
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export const FAR_TILE_WIDTH = 512;
export const FAR_TILE_HEIGHT = 96;

/**
 * The far band: a low ridge behind the scenery, on its own parallax plane.
 *
 * Two problems, one layer. The world had exactly one silhouette plane
 * between the stars and the road, so a 256px scenery tile repeated three
 * and a half times across a desktop screen and the repeat was the first
 * thing you saw. And three planes (stars 0.08, scenery 0.45, road 1.0)
 * left a conspicuous gap in the middle of the depth range.
 *
 * This tile is twice as wide as the scenery one and drifts at a different
 * rate, so the two never line up into a visible period — the cheapest way
 * to make a repeating background stop looking repeated is to have a second
 * thing repeating at a rate that does not divide into the first.
 */
export function farTileTexture(scene: Phaser.Scene, biome: Biome): string {
  const key = `far-${biome.id}`;
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const H = FAR_TILE_HEIGHT;
  const W = FAR_TILE_WIDTH;
  g.fillStyle(recede(biome.sceneryColor, biome.skyColor, 0.55), 1);

  if (biome.id === 'forest') {
    // A ridge of distant conifers: many small peaks of varying height,
    // deliberately not evenly spaced.
    const peaks = [14, 26, 9, 31, 18, 11, 35, 22, 15, 28, 12, 33, 20, 25, 10, 30];
    const step = W / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      g.fillTriangle(x - step * 0.55, H, x + step * 0.55, H, x, H - 22 - peaks[i]);
    }
  } else if (biome.id === 'riverside') {
    // The far bank: a long low bluff with a couple of rises.
    g.fillRect(0, H - 20, W, 20);
    g.fillEllipse(90, H - 20, 200, 46);
    g.fillEllipse(300, H - 20, 150, 32);
    g.fillEllipse(430, H - 20, 190, 40);
  } else {
    // Rolling hills behind the village, at three sizes so the horizon has
    // a shape rather than a wave.
    g.fillRect(0, H - 14, W, 14);
    g.fillEllipse(70, H - 14, 230, 60);
    g.fillEllipse(210, H - 14, 150, 36);
    g.fillEllipse(340, H - 14, 260, 72);
    g.fillEllipse(470, H - 14, 140, 30);
  }

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}
