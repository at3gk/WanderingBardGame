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
 * greens with a single cool slate for roofs; forest is deep blue-greens
 * with one warm bracken; riverside is grey-greens with one bright water
 * blue. A biome that uses six unrelated hues reads as a texture pack. A
 * biome that uses one reads as flat. One dissenter is the whole trick.
 *
 * Every colour here is an *albedo* — the colour the surface would be under
 * neutral light. The sun, sky tint and fog are applied by the painterly
 * shader on top, which is why these read as much lighter and less
 * saturated than the finished frame looks.
 */

export type TreeKind = 'conifer' | 'broadleaf' | 'willow';

export interface BiomePalette {
  id: string;
  /** The two greens the ground blends between via world-space noise. */
  grass: number;
  grassVariant: number;
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
  /** Scatter densities, relative. Tuned per biome so they feel different. */
  density: {
    grass: number;
    tree: number;
    rock: number;
    flower: number;
    fern: number;
  };
  /** How hilly. Multiplies the terrain amplitude within this band. */
  relief: number;
}

export const BIOME_PALETTES: Record<string, BiomePalette> = {
  // Open, cultivated, gentle. The lightest and most golden of the three —
  // this is where the road feels most walked-on, and the wide sightlines
  // are what make the first stretch of a day feel like setting out.
  village: {
    id: 'village',
    grass: 0x9cae63,
    grassVariant: 0xc4bd6e,
    road: 0xb39a72,
    roadShoulder: 0xa8a06a,
    rock: 0x9c9384,
    trunk: 0x7a5a41,
    canopy: 0x7f9d55,
    canopyVariant: 0xa8bb64,
    accent: 0xd98f6a,
    accentAlt: 0xe8c98a,
    trees: [
      { kind: 'broadleaf', weight: 8 },
      { kind: 'conifer', weight: 1 },
    ],
    density: { grass: 1.0, tree: 0.5, rock: 0.35, flower: 1.2, fern: 0.2 },
    relief: 0.75,
  },

  // Close, deep, cool. The densest scatter and the tallest trees, so the
  // sky comes through in patches — which is what makes the shafts of light
  // through the canopy the memorable thing about this stretch.
  forest: {
    id: 'forest',
    grass: 0x5c7b4c,
    grassVariant: 0x74914f,
    road: 0x8a7256,
    roadShoulder: 0x6e7b4d,
    rock: 0x7d8079,
    trunk: 0x5c4433,
    canopy: 0x3f6b45,
    canopyVariant: 0x568044,
    accent: 0xb0713f,
    accentAlt: 0xcfa15c,
    trees: [
      { kind: 'conifer', weight: 6 },
      { kind: 'broadleaf', weight: 4 },
    ],
    density: { grass: 0.85, tree: 2.6, rock: 0.7, flower: 0.45, fern: 1.6 },
    relief: 1.15,
  },

  // Low, wet, and open to the sky. Least tree cover, most flat ground, and
  // the only biome whose accent is cooler than its greens — which is what
  // makes arriving here at golden hour worth walking to.
  riverside: {
    id: 'riverside',
    grass: 0x7d9a70,
    grassVariant: 0x9db183,
    road: 0xa08f76,
    roadShoulder: 0x8a9a76,
    rock: 0x8d9298,
    trunk: 0x6b5a48,
    canopy: 0x6f9068,
    canopyVariant: 0x8fae74,
    accent: 0x6fa8c4,
    accentAlt: 0xd8dfc9,
    trees: [
      { kind: 'willow', weight: 7 },
      { kind: 'broadleaf', weight: 3 },
    ],
    density: { grass: 1.3, tree: 0.8, rock: 0.5, flower: 0.7, fern: 0.9 },
    relief: 0.5,
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
