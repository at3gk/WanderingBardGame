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

/**
 * Whether the beat's *entire* hit window fell between two frames — so no
 * input could possibly have landed on it.
 *
 * The learning model treats a miss as evidence that a position was asked
 * for too early, which is only fair when the child actually had a chance.
 * A garbage-collection pause, a throttled background tab or a slow device
 * can skip far enough that a note's whole window elapses inside one frame
 * gap, and the child is charged for a note that was never on screen.
 *
 * The scene already had two guards on this premise: encounters are dropped
 * while the document is hidden, and a frame that misses more than
 * MASS_MISS_LIMIT notes at once is treated as a sleeping tab rather than
 * forgetting. This closes the band between them — a hitch big enough to
 * swallow one or two notes but not enough to trip the mass-miss rule,
 * which is what a moderate stall on a cheap phone looks like.
 *
 * Scope, honestly: a phone rotation was the suspected trigger and it is
 * *not* one. Measured headless, rotation peaks at a 50ms frame gap and
 * backgrounding at 69ms, both far short of the 180ms window; the strength
 * loss that prompted the investigation turned out to be the test harness
 * pausing its own taps. So this guard is insurance against device
 * conditions that cannot be reproduced here, not a fix for an observed bug.
 *
 * It is exact rather than heuristic — it asks whether the window closed
 * before the frame began, not whether the frame merely felt long — so it is
 * provably inert during ordinary play, where frame gaps are far shorter
 * than the window is wide. `beats.test.ts` checks that exhaustively.
 */
export function wasUnplayable(beat: Beat, nowMs: number, previousMs: number, hitWindowMs: number): boolean {
  const opensAt = beat.hitTimeMs - hitWindowMs;
  const closesAt = beat.hitTimeMs + hitWindowMs;
  return opensAt > previousMs && closesAt <= nowMs;
}
