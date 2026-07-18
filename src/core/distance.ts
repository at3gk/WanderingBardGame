/**
 * Distance traveled is a readout of the walking state, not a new system —
 * it accumulates at the same rate the road already scrolls at while the
 * bard is walking, and holds still while stopped (ROADMAP task 9).
 */
export function accumulateDistance(
  distancePx: number,
  walking: boolean,
  deltaMs: number,
  speedPxPerSec: number
): number {
  if (!walking || deltaMs <= 0) {
    return distancePx;
  }
  return distancePx + (speedPxPerSec * deltaMs) / 1000;
}
