export interface Beat {
  index: number;
  hitTimeMs: number;
}

/** Milliseconds between consecutive beats at the given tempo. */
export function beatIntervalMs(bpm: number): number {
  if (bpm <= 0) throw new Error('bpm must be positive');
  return 60000 / bpm;
}

/**
 * Schedule of beats, each carrying the timestamp (relative to `startTimeMs`)
 * at which it should cross the hit line. First beat lands one interval after
 * `startTimeMs` so the player gets a beat's worth of runway before playing.
 */
export function generateBeatSchedule(bpm: number, count: number, startTimeMs = 0): Beat[] {
  const interval = beatIntervalMs(bpm);
  return Array.from({ length: count }, (_, index) => ({
    index,
    hitTimeMs: startTimeMs + interval * (index + 1),
  }));
}

/**
 * Scroll progress of a beat marker: 0 at spawn, 1 at the hit line, >1 once
 * it has scrolled past. Spawn time is derived from `hitTimeMs - travelTimeMs`.
 */
export function scrollProgress(beat: Beat, nowMs: number, travelTimeMs: number): number {
  const spawnTimeMs = beat.hitTimeMs - travelTimeMs;
  return (nowMs - spawnTimeMs) / travelTimeMs;
}

/** Whether an input at `inputTimeMs` falls within the beat's hit window. */
export function isWithinHitWindow(beat: Beat, inputTimeMs: number, hitWindowMs: number): boolean {
  return Math.abs(inputTimeMs - beat.hitTimeMs) <= hitWindowMs;
}

/** Whether the beat has scrolled past its hit window without being hit. */
export function isBeatMissed(beat: Beat, nowMs: number, hitWindowMs: number): boolean {
  return nowMs > beat.hitTimeMs + hitWindowMs;
}
