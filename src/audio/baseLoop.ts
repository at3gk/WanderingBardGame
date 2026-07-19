import { generateBeatSchedule } from '../core/beats';
import { LoopLayer } from './manifest';

export interface ScheduledNote {
  timeMs: number;
  frequencyHz: number;
  durationMs: number;
}

/** Equal-temperament frequency for a semitone offset from a root frequency. */
export function semitoneToFrequency(rootHz: number, semitones: number): number {
  return rootHz * Math.pow(2, semitones / 12);
}

/**
 * Schedule of base-loop notes tied 1:1 to the beat grid, cycling through the
 * layer's pattern. Reuses `generateBeatSchedule` from the timing core so the
 * audio and the visual beat lane share one clock and never drift apart.
 */
export function generateBaseLoopSchedule(
  bpm: number,
  count: number,
  rootHz: number,
  layer: LoopLayer,
  startTimeMs = 0,
  indexOffset = 0
): ScheduledNote[] {
  const beats = generateBeatSchedule(bpm, count, startTimeMs, indexOffset);
  return beats.map((beat) => ({
    timeMs: beat.hitTimeMs,
    frequencyHz: semitoneToFrequency(rootHz, layer.pattern[beat.index % layer.pattern.length]),
    durationMs: layer.noteDurationMs,
  }));
}
