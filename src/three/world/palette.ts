/**
 * What each biome looks like in three dimensions.
 *
 * The 2D game's biome palettes (src/core/biome.ts) are dark-dusk colours
 * chosen so that cream notation would read on top of them. They are still
 * correct for what they do and they are not touched here — but they are
 * unusable as *world* colours in a game that now has a sun in it, so the
 * 3D world keeps its own palette keyed by the same biome ids.
 *
 * The palettes are built around one idea: each biome is a **narrow hue
 * family with one dissenting accent**. Village is a spread of warm yellow-
 * greens with a terracotta dissenter; forest is deep blue-greens with one
 * warm bracken; riverside is cool grey-greens with one bright water blue. A
 * biome that uses six unrelated hues reads as a texture pack. A biome that
 * uses one reads as flat. One dissenter is the whole trick.
 *
 * The second idea is that the three biomes have to be different *places*,
 * not the same place in three tints. So they disagree about more than hue:
 * village is open and sparse and full of flowers, forest is closed and
 * three times as dense and has fallen timber in it, riverside is flat and
 * reeded. Density and species mix carry as much of that as colour does — a
 * player who cannot tell where they are from a silhouette at eighty metres
 * is not really travelling.
 *
 * Every colour here is an *albedo* — the colour the surface would be under
 * neutral light. The sun, sky tint and fog are applied by the painterly
 * shader on top, which is why these read as much lighter and less
 * saturated than the finished frame looks.
 */

export type TreeKind = 'conifer' | 'broadleaf' | 'willow';

export interface BiomePalette {
  id: string;
  /**
   * The four ground tones. `grass` and `grassVariant` are the pair the
   * meadow drifts between; `grassShade` is what hollows fall to and
   * `grassDry` is what rises and worn patches come up to. Four is the
   * minimum that gives the mid-distance any landform at all — with two, a
   * hillside a hundred metres off is a single flat wash and the eye has
   * nowhere to land.
   */
  grass: number;
  grassVariant: number;
  grassShade: number;
  grassDry: number;
  /** Packed earth of the road itself, and its worn shoulder. */
  road: number;
  roadShoulder: number;
  rock: number;
  trunk: number;
  /** Canopy colours; instances draw from a spread between these. */
  canopy: number;
  canopyVariant: number;
  /** The dissenting accent — flowers, roofs, water, whatever is not green. */
  accent: number;
  accentAlt: number;
  /** Which tree silhouettes belong here, and in what proportion. */
  trees: Array<{ kind: TreeKind; weight: number }>;
  /**
   * Scatter densities, relative. Tuned per biome so they feel different.
   * A zero means the kind is absent here, and `WorldStreamer` skips the
   * draw call entirely rather than issuing an empty one.
   */
  density: {
    grass: number;
    tree: number;
    rock: number;
    flower: number;
    fern: number;
    shrub: number;
    reed: number;
    log: number;
  };
  /** How hilly. Multiplies the terrain amplitude within this band. */
  relief: number;
}

export const BIOME_PALETTES: Record<string, BiomePalette> = {
  // Open, cultivated, gentle. The lightest and most golden of the three —
  // this is where the road feels most walked-on, and the wide sightlines
  // are what make the first stretch of a day feel like setting out. Almost
  // all broadleaf, hardly any undergrowth, and more flowers than anywhere
  // else, so the ground reads as pasture rather than as wilderness.
  village: {
    id: 'village',
    grass: 0x9ab157,
    grassVariant: 0xd2ce84,
    grassShade: 0x66803e,
    grassDry: 0xe3d69c,
    road: 0xc0a67c,
    roadShoulder: 0xb4ab77,
    rock: 0xbcb39d,
    trunk: 0x9d7b60,
    canopy: 0x84a44f,
    canopyVariant: 0xb2c46a,
    accent: 0xe07a5f,
    accentAlt: 0xf2cf8a,
    trees: [
      { kind: 'broadleaf', weight: 9 },
      { kind: 'conifer', weight: 1 },
    ],
    density: { grass: 1.1, tree: 0.45, rock: 0.3, flower: 2.4, fern: 0.1, shrub: 0.9, reed: 0, log: 0 },
    relief: 0.7,
  },

  // Close, deep, cool. Three times the tree density of anywhere else and
  // the tallest species, so the sky comes through in patches — which is
  // what makes the shafts of light through the canopy the memorable thing
  // about this stretch. The floor is bracken and fallen timber, not lawn.
  forest: {
    id: 'forest',
    grass: 0x466c42,
    grassVariant: 0x718f50,
    grassShade: 0x274434,
    grassDry: 0x96995a,
    road: 0x7d6a52,
    roadShoulder: 0x5f6f47,
    rock: 0x8b9490,
    trunk: 0x6d5a4a,
    canopy: 0x2f5c3f,
    canopyVariant: 0x4c7f47,
    accent: 0xc4763a,
    accentAlt: 0xd9b06a,
    trees: [
      { kind: 'conifer', weight: 7 },
      { kind: 'broadleaf', weight: 3 },
    ],
    density: { grass: 0.75, tree: 3.0, rock: 0.8, flower: 0.35, fern: 2.4, shrub: 0.45, reed: 0, log: 1.3 },
    relief: 1.25,
  },

  // Low, wet, and open to the sky. Least relief, most grass, and the only
  // biome whose accent is cooler than its greens — which is what makes
  // arriving here at golden hour worth walking to. The reeds are the tell:
  // a bank of verticals at the roadside says water is near without a drop
  // of it having to be drawn.
  riverside: {
    id: 'riverside',
    grass: 0x76a07d,
    grassVariant: 0xaac292,
    grassShade: 0x477165,
    grassDry: 0xccd2ac,
    road: 0xa89a80,
    roadShoulder: 0x8fa184,
    rock: 0xa2a8ae,
    trunk: 0x847266,
    canopy: 0x6c9a76,
    canopyVariant: 0x9ac093,
    accent: 0x5fa6c8,
    accentAlt: 0xe4e8d2,
    trees: [
      { kind: 'willow', weight: 7 },
      { kind: 'broadleaf', weight: 3 },
    ],
    density: { grass: 1.45, tree: 0.9, rock: 0.45, flower: 0.8, fern: 0.6, shrub: 0.5, reed: 0.9, log: 0.2 },
    relief: 0.45,
  },
};

/** Fallback so an unknown biome id degrades to a walkable world, not a crash. */
export const DEFAULT_PALETTE = BIOME_PALETTES.village;

export function paletteFor(biomeId: string): BiomePalette {
  return BIOME_PALETTES[biomeId] ?? DEFAULT_PALETTE;
}

/**
 * Linear blend between two palettes' numeric colours, for the band
 * transitions. Blending in plain RGB rather than a perceptual space is
 * deliberate: these are all low-saturation neighbours, sRGB lerp between
 * them has no visible dead zone, and the shader is already going to shift
 * them further than the blend error.
 */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
