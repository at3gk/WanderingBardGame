/**
 * Slow time-of-day cycle (ROADMAP task 36). DESIGN.md's Tone section has
 * promised a palette "that shifts with time-of-day-per-biome" since Run 0;
 * this is that shift: a smooth dusk → deep-night → dusk brightness curve
 * riding on top of the per-biome palettes, far slower than the biome loop
 * itself (one full dusk cycle every three 16000px biome loops), so a long
 * walk has a second, slower rhythm of change. Readout-only — nothing about
 * the mechanic reads this value.
 */

export const DUSK_CYCLE_PX = 48000;
export const DUSK_MAX_DARKEN = 0.22;

/**
 * Brightness multiplier for the world at a given walked distance: 1 at the
 * cycle start (dusk), dipping smoothly to `1 - maxDarken` at mid-cycle
 * (deep night), and back. Cosine-shaped so there are no visible speed
 * kinks; safe for negative distances.
 */
export function duskShadeAt(
  distancePx: number,
  cyclePx: number = DUSK_CYCLE_PX,
  maxDarken: number = DUSK_MAX_DARKEN
): number {
  if (cyclePx <= 0) return 1;
  const phase = (((distancePx % cyclePx) + cyclePx) % cyclePx) / cyclePx;
  return 1 - (maxDarken * (1 - Math.cos(2 * Math.PI * phase))) / 2;
}

/**
 * How far into night the walk currently is, normalized 0 (dusk) to 1
 * (deepest night) — the complement of `duskShadeAt`, used to brighten the
 * stars and moon as the sky darkens.
 */
export function nightnessAt(distancePx: number, cyclePx: number = DUSK_CYCLE_PX): number {
  return (1 - duskShadeAt(distancePx, cyclePx)) / DUSK_MAX_DARKEN;
}
