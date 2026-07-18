/**
 * Two scenery biomes for v0.1 (DESIGN.md: "the scenery drifts from one cozy
 * vignette to the next"). Palette-only — the bard and mechanic are unchanged
 * across biomes, this is a readout, not a new system (ROADMAP task 9).
 */
export interface Biome {
  id: string;
  name: string;
  skyColor: number;
  roadBandColor: number;
  roadDashColor: number;
}

export const BIOMES: Biome[] = [
  {
    id: 'village',
    name: 'Village Dusk',
    skyColor: 0x1a1621,
    roadBandColor: 0x3a2f3f,
    roadDashColor: 0x4d3f52,
  },
  {
    id: 'forest',
    name: 'Forest Dusk',
    skyColor: 0x141f1c,
    roadBandColor: 0x2f3a2f,
    roadDashColor: 0x3f4d3a,
  },
];

export const BIOME_TRANSITION_START_PX = 4000;
export const BIOME_TRANSITION_LENGTH_PX = 2000;

/**
 * 0 = fully the first biome, 1 = fully the second; linear ramp across the
 * transition band so the scenery crossfades rather than cuts.
 */
export function biomeBlendRatio(
  distancePx: number,
  transitionStartPx = BIOME_TRANSITION_START_PX,
  transitionLengthPx = BIOME_TRANSITION_LENGTH_PX
): number {
  if (transitionLengthPx <= 0) {
    return distancePx >= transitionStartPx ? 1 : 0;
  }
  const raw = (distancePx - transitionStartPx) / transitionLengthPx;
  return Math.min(1, Math.max(0, raw));
}
