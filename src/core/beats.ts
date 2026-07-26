export interface Beat {
  index: number;
  hitTimeMs: number;
}

/**
 * How long a note takes to travel from spawn to the hit line, and how far
 * either side of the line a tap still counts.
 *
 * These live here rather than in the scene because `scaffold.ts`'s reveal
 * schedule is measured against them: a letter's lead time is "how long
 * before the hit line does the answer appear", so the two schedules must be
 * comparable. See `scaffold.test.ts`, "the answer always beats the tap".
 */
export const TRAVEL_TIME_MS = 1800;
export const HIT_WINDOW_MS = 90;

/** Milliseconds between consecutive beats at the given tempo. */
export function beatIntervalMs(bpm: number): number {
  if (bpm <= 0) throw new Error('bpm must be positive');
  return 60000 / bpm;
}

/**
 * Schedule of beats, each carrying the timestamp (relative to `startTimeMs`)
 * at which it should cross the hit line. First beat lands one interval after
 * `startTimeMs` so the player gets a beat's worth of runway before playing.
 *
 * `indexOffset` lets a caller request a later batch that continues an
 * earlier one seamlessly (same tempo, indices carrying on from where the
 * previous batch left off) — used to keep the beat schedule effectively
 * unbounded without generating it all up front.
 */
export function generateBeatSchedule(bpm: number, count: number, startTimeMs = 0, indexOffset = 0): Beat[] {
  const interval = beatIntervalMs(bpm);
  return Array.from({ length: count }, (_, i) => ({
    index: indexOffset + i,
    hitTimeMs: startTimeMs + interval * (i + 1),
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
