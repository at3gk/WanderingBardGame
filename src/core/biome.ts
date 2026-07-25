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
 * `BIOME_TRANSITIONS[i]` is the transition from `BIOMES[i % N]` to
 * `BIOMES[(i + 1) % N]`. When the list is as long as the biome list, the
 * final transition wraps back to biome 0 and the whole sequence repeats
 * every cycle (ROADMAP task 35 — "the road loops home"): the walk is
 * village → forest → riverside → village → … forever, making the
 * Concept's endless road true of the scenery, not just the beat schedule.
 * The cycle length is the last transition's end; distances are taken
 * modulo that, so every loop's rhythm of change is identical (village
 * band 0–4000 of each cycle, transitions every 5000px).
 */
export const BIOME_TRANSITIONS: BiomeTransition[] = [
  { startPx: 4000, lengthPx: 2000 },
  { startPx: 9000, lengthPx: 2000 },
  { startPx: 14000, lengthPx: 2000 },
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
 * In steady state (between transitions) `fromIndex === toIndex` and
 * `ratio` is 0.
 *
 * Wrapping (ROADMAP task 35): when the transition list is at least as
 * long as the biome list, the final transition leads back to biome 0 and
 * the whole schedule repeats every cycle (distance modulo the last
 * transition's end). A shorter list keeps the original clamping behavior
 * — walk ends parked on the final biome — so the pure math stays usable
 * for non-looping sequences.
 */
export function biomeBlendAt(
  distancePx: number,
  transitions: BiomeTransition[] = BIOME_TRANSITIONS,
  biomeCount: number = BIOMES.length
): BiomeBlend {
  const wraps = transitions.length > 0 && transitions.length >= biomeCount;
  let d = distancePx;
  if (wraps) {
    const last = transitions[transitions.length - 1];
    const cycleLengthPx = last.startPx + last.lengthPx;
    if (cycleLengthPx > 0) {
      d = ((distancePx % cycleLengthPx) + cycleLengthPx) % cycleLengthPx;
    }
  }

  const limit = wraps ? transitions.length : Math.min(transitions.length, biomeCount - 1);
  for (let i = 0; i < limit; i++) {
    const { startPx, lengthPx } = transitions[i];
    if (d < startPx) {
      const idx = i % biomeCount;
      return { fromIndex: idx, toIndex: idx, ratio: 0 };
    }
    const end = startPx + lengthPx;
    if (d < end || lengthPx <= 0) {
      const ratio = lengthPx <= 0 ? 1 : (d - startPx) / lengthPx;
      return {
        fromIndex: i % biomeCount,
        toIndex: (i + 1) % biomeCount,
        ratio: Math.min(1, Math.max(0, ratio)),
      };
    }
  }
  const last = Math.max(0, Math.min(limit, biomeCount - 1)) % biomeCount;
  return { fromIndex: last, toIndex: last, ratio: 0 };
}

/**
 * Distance (px) at which the `occurrenceIndex`-th transition fires, counting
 * every wrap of the loop (0 = the first transition, `transitions.length` =
 * the first transition of the second cycle, and so on). Used to place
 * one-off scenery events that mark a transition's start — e.g. a signpost
 * scrolling by — as opposed to `biomeBlendAt`'s per-frame blend state.
 */
export function signpostDistanceAt(
  occurrenceIndex: number,
  transitions: BiomeTransition[] = BIOME_TRANSITIONS
): number {
  const last = transitions[transitions.length - 1];
  const cycleLengthPx = last.startPx + last.lengthPx;
  const idx = occurrenceIndex % transitions.length;
  const cycle = Math.floor(occurrenceIndex / transitions.length);
  return transitions[idx].startPx + cycle * cycleLengthPx;
}
