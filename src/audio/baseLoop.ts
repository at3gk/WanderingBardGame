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
 * Resolves which pattern a layer should play for a given biome: its
 * `patternByBiome` override if one exists for `biomeId`, else its base
 * `pattern`. Kept separate from `generateBaseLoopSchedule` so it's testable
 * on its own.
 */
export function resolvePattern(layer: LoopLayer, biomeId?: string): number[] {
  if (biomeId && layer.patternByBiome?.[biomeId]) {
    return layer.patternByBiome[biomeId];
  }
  return layer.pattern;
}

/**
 * Schedule of base-loop notes tied 1:1 to the beat grid, cycling through the
 * layer's pattern (or its `patternByBiome` override for `biomeId`, if any —
 * ROADMAP task 16). Reuses `generateBeatSchedule` from the timing core so
 * the audio and the visual beat lane share one clock and never drift apart.
 */
export function generateBaseLoopSchedule(
  bpm: number,
  count: number,
  rootHz: number,
  layer: LoopLayer,
  startTimeMs = 0,
  indexOffset = 0,
  biomeId?: string
): ScheduledNote[] {
  const beats = generateBeatSchedule(bpm, count, startTimeMs, indexOffset);
  const pattern = resolvePattern(layer, biomeId);
  return beats.map((beat) => ({
    timeMs: beat.hitTimeMs,
    frequencyHz: semitoneToFrequency(rootHz, pattern[beat.index % pattern.length]),
    durationMs: layer.noteDurationMs,
  }));
}
