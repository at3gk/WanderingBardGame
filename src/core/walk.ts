/**
 * The walk, played rather than watched (DESIGN.md v0.8).
 *
 * v0.6 quietly made walking automatic and inputless. This module is the pure
 * half of putting the core mechanic back: while the bard walks, the current
 * song's notes scroll toward the barline exactly as they do at a busk, and
 * the song meter — the same meter, `songMeter.ts`, held in [0,1] by
 * `performance.ts` — decides the stride.
 *
 * Two jobs, both free of any rendering:
 *
 *   - `walkPaceFactor` maps the meter to a walking speed multiplier. Healthy
 *     meter, full stride; drained, the bard slows and then stands, playing
 *     quietly in place. There is no fail state anywhere in this: missing
 *     costs meter, the meter costs stride, and both come straight back with
 *     the rhythm. The map is a pure function of the meter, so recovery is as
 *     instant as the meter itself — a hit moves the meter, and the pace
 *     moves with it on the same frame.
 *
 *   - `startWalkTune`/`extendWalkTune` keep an endless schedule of one song
 *     under the walk. A busk expands a fixed number of passes up front
 *     because a busk ends; the walk does not end, so passes are appended as
 *     the clock approaches the horizon, seamlessly (the seam between passes
 *     is exactly the last note's written length — `expandSong`'s contract).
 */

import { PERFORMANCE_METER_CONFIG } from './performance';
import type { SongMeterConfig } from './songMeter';
import { expandSong, songDurationMs, type Song, type SongBeat } from './song';

/**
 * At or below this meter the bard has stopped walking.
 *
 * Deliberately well below the meter's own `walkingThreshold` rather than at
 * it: the threshold is where the stride is *full*, and the band between the
 * two is where the bard visibly slows — which is the whole feedback. A
 * binary walk/stop at one threshold reads as punishment; a stride that eases
 * off reads as the tune winding down, which is what is actually happening.
 */
export const WALK_STOP_METER = 0.05;

/**
 * How far ahead of the clock the schedule must always reach, in ms.
 *
 * Comfortably longer than a note's flight down the staff, so a note is
 * always scheduled well before it would need to spawn, and short enough
 * that a backgrounded tab returning after an hour appends passes in a few
 * frames rather than all at once.
 */
export const WALK_TUNE_HORIZON_MS = 8000;

/** Most passes one `extendWalkTune` call may append. A guard, not a tuning. */
const MAX_PASSES_PER_EXTEND = 64;

/**
 * The walking-speed multiplier for a meter value in [0,1].
 *
 * 1 at or above the meter's walking threshold, 0 at or below
 * `WALK_STOP_METER`, linear between. Linear rather than eased because the
 * bottom of the ramp is where recovery lives: the first hit out of a stall
 * (+0.12 with the default meter) must visibly move the bard, and an eased
 * curve spends that first hit on almost nothing.
 *
 * A non-finite meter reads as full stride. A bad number must never stop the
 * walk — the same stance every sanitiser in `performance.ts` takes.
 */
export function walkPaceFactor(
  meter: number,
  config: SongMeterConfig = PERFORMANCE_METER_CONFIG,
): number {
  const value = Number.isFinite(meter) ? Math.min(1, Math.max(0, meter)) : 1;
  const full = Math.max(WALK_STOP_METER + 1e-6, config.walkingThreshold);
  if (value <= WALK_STOP_METER) return 0;
  if (value >= full) return 1;
  return (value - WALK_STOP_METER) / (full - WALK_STOP_METER);
}

/**
 * A song kept endlessly under the walk.
 *
 * `beats` is grown *in place* by `extendWalkTune`, on purpose: the scene
 * hands the same array to the performance judge and to the staff renderer,
 * both of which track their position in it by index, so appending to one
 * shared array is what keeps the three views of the schedule from ever
 * disagreeing. (Replacing the array would reset the renderer's scan and
 * re-spawn every note on screen.)
 */
export interface WalkTune {
  song: Song;
  bpm: number;
  /** One pass of the song, in ms — the offset between repetitions. */
  passLengthMs: number;
  /** Passes scheduled so far. */
  passes: number;
  beats: SongBeat[];
}

/** Begin a tune at clock zero, with one pass scheduled. */
export function startWalkTune(song: Song, bpm: number): WalkTune {
  return {
    song,
    bpm,
    passLengthMs: songDurationMs(song, bpm),
    passes: 1,
    beats: expandSong(song, bpm),
  };
}

/**
 * Append passes until the schedule reaches `nowMs + horizonMs`.
 *
 * Returns how many passes were appended, which is 0 whenever the horizon is
 * already covered — the ordinary case, so the per-frame cost is one
 * comparison. A degenerate song (no notes, or a non-positive pass length)
 * appends nothing rather than looping.
 */
export function extendWalkTune(
  tune: WalkTune,
  nowMs: number,
  horizonMs: number = WALK_TUNE_HORIZON_MS,
): number {
  if (tune.passLengthMs <= 0 || tune.song.notes.length === 0) return 0;
  const target = (Number.isFinite(nowMs) ? nowMs : 0) + Math.max(0, horizonMs);
  let appended = 0;
  while (appended < MAX_PASSES_PER_EXTEND) {
    const last = tune.beats[tune.beats.length - 1];
    if (last && last.hitTimeMs >= target) break;
    tune.beats.push(
      ...expandSong(
        tune.song,
        tune.bpm,
        tune.passLengthMs * tune.passes,
        tune.song.notes.length * tune.passes,
      ),
    );
    tune.passes += 1;
    appended += 1;
  }
  return appended;
}
