/**
 * Scenery biomes, per DESIGN.md's Concept section ("a sleepy village, a
 * forest at dusk, a riverside camp"). Palette-only — the bard and mechanic
 * are unchanged across biomes, this is a readout, not a new system
 * (ROADMAP task 9 added the second biome; task 15 generalized this to N
 * biomes and added the third).
 */
export interface Biome {
  id: string;
  name: string;
  skyColor: number;
  roadBandColor: number;
  roadDashColor: number;
  /** Silhouette color for the background scenery band (darker than the sky so features read as shapes against it). */
  sceneryColor: number;
  /** Small warm/lit accent used inside the scenery (village windows, riverside water glints) — see RoadScene's per-biome tile drawers. */
  sceneryAccent: number;
}

// Human playtest (2026-07-25): the original palettes were so close in hue
// and lightness (all three skies within a few RGB points of each other)
// that transitions barely registered. Re-pitched with clearly separated
// hues — warm plum, saturated green, cool blue — while staying dark enough
// that markers/UI keep their contrast.
export const BIOMES: Biome[] = [
  {
    id: 'village',
    name: 'Village Dusk',
    skyColor: 0x2a1a2e,
    roadBandColor: 0x4a3450,
    roadDashColor: 0x66486c,
    sceneryColor: 0x1c1020,
    sceneryAccent: 0xe8c157,
  },
  {
    id: 'forest',
    name: 'Forest Dusk',
    skyColor: 0x0f2818,
    roadBandColor: 0x24422a,
    roadDashColor: 0x3c6242,
    sceneryColor: 0x081a0e,
    sceneryAccent: 0xb5d98a,
  },
  {
    id: 'riverside',
    name: 'Riverside Camp',
    skyColor: 0x0f2438,
    roadBandColor: 0x22475c,
    roadDashColor: 0x3d7291,
    sceneryColor: 0x081624,
    sceneryAccent: 0x5da8c9,
  },
];

export interface BiomeTransition {
  /** Distance (px) at which the crossfade into the next biome begins. */
  startPx: number;
  /** Length (px) of the crossfade band. */
  lengthPx: number;
}

/**
 * One entry per biome after the first: `BIOME_TRANSITIONS[i]` is the
 * transition from `BIOMES[i]` to `BIOMES[i + 1]`. Same start/length as the
 * original village→forest transition (task 9), repeated at a further
 * distance for forest→riverside so both crossfades read the same way.
 */
export const BIOME_TRANSITIONS: BiomeTransition[] = [
  { startPx: 4000, lengthPx: 2000 },
  { startPx: 9000, lengthPx: 2000 },
];

export interface BiomeBlend {
  fromIndex: number;
  toIndex: number;
  /** 0 = fully `BIOMES[fromIndex]`, 1 = fully `BIOMES[toIndex]`. */
  ratio: number;
}

/**
 * Which two biomes (by index into `biomes`) the scenery is currently
 * blending between at a given distance, and how far across that blend.
 * Before the first transition starts, or after the last one completes,
 * `fromIndex === toIndex` and `ratio` is 0 (steady state, no blend needed).
 */
export function biomeBlendAt(
  distancePx: number,
  transitions: BiomeTransition[] = BIOME_TRANSITIONS,
  biomeCount: number = BIOMES.length
): BiomeBlend {
  for (let i = 0; i < transitions.length && i < biomeCount - 1; i++) {
    const { startPx, lengthPx } = transitions[i];
    if (distancePx < startPx) {
      return { fromIndex: i, toIndex: i, ratio: 0 };
    }
    const end = startPx + lengthPx;
    if (distancePx < end || lengthPx <= 0) {
      const ratio = lengthPx <= 0 ? 1 : (distancePx - startPx) / lengthPx;
      return { fromIndex: i, toIndex: i + 1, ratio: Math.min(1, Math.max(0, ratio)) };
    }
  }
  const last = Math.max(0, Math.min(transitions.length, biomeCount - 1));
  return { fromIndex: last, toIndex: last, ratio: 0 };
}
