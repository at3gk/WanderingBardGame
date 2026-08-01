/**
 * Tomorrow's road, as a skyline.
 *
 * The campfire bookend (ROADMAP 151, folded into 159) promises the horizon
 * shows the road that will actually be walked tomorrow — pure anticipation,
 * and honest anticipation only because it is derived from tomorrow's real
 * seed rather than painted. This module is the derivation: build tomorrow's
 * shared road (`nextDayKey` + leg 0, which is `dailySeed` by identity) and
 * read its centreline hills off as a normalized profile the sky can raise
 * as a far ridge band.
 *
 * Pure and deterministic: the same evening always shows the same tomorrow,
 * and two players at two fires on the same day see the same skyline —
 * the shared road, shared a night early.
 */

import { generateRoad, sampleRoad } from './road';
import { legSeed, nextDayKey } from './rng';

/**
 * How many heights the profile carries. Enough that the skyline has
 * summits in the ten-degree range the sky's own ridge noise aims for
 * (sky.ts's ridgeMask note), few enough to hand a shader as a plain
 * uniform array.
 */
export const SKYLINE_SAMPLES = 16;

/**
 * The silhouette of tomorrow's road: `samples` heights in [0, 1], west end
 * of the road first. Normalized against the road's own relief rather than
 * any absolute scale — the sky decides amplitude; this only decides shape.
 * A perfectly flat road (not something the generator produces, but the
 * boundary belongs to this module) reads as a low even band at 0.5.
 */
export function tomorrowSkyline(todayKey: string, samples = SKYLINE_SAMPLES): number[] {
  const n = Math.max(2, Math.floor(samples));
  const key = nextDayKey(todayKey);
  const road = generateRoad(legSeed(key, 0), key);

  const heights: number[] = [];
  for (let i = 0; i < n; i++) {
    heights.push(sampleRoad(road, (road.lengthM * i) / (n - 1)).y);
  }

  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (!(max > min)) return heights.map(() => 0.5);
  return heights.map((h) => (h - min) / (max - min));
}
