import { describe, expect, it } from 'vitest';
import { generateBaseLoopSchedule, semitoneToFrequency } from './baseLoop';
import { LoopLayer } from './manifest';

describe('semitoneToFrequency', () => {
  it('returns the root frequency at zero offset', () => {
    expect(semitoneToFrequency(220, 0)).toBe(220);
  });

  it('doubles/halves an octave (12 semitones) up/down', () => {
    expect(semitoneToFrequency(220, 12)).toBeCloseTo(440);
    expect(semitoneToFrequency(220, -12)).toBeCloseTo(110);
  });
});

describe('generateBaseLoopSchedule', () => {
  const layer: LoopLayer = {
    id: 'test',
    waveform: 'triangle',
    pattern: [0, 7],
    gain: 0.05,
    noteDurationMs: 100,
  };

  it('shares beat timing with the visual beat schedule', () => {
    const schedule = generateBaseLoopSchedule(120, 4, 200, layer);
    expect(schedule.map((n) => n.timeMs)).toEqual([500, 1000, 1500, 2000]);
  });

  it('cycles the pattern per beat and carries the configured duration', () => {
    const schedule = generateBaseLoopSchedule(120, 4, 200, layer);
    expect(schedule.map((n) => n.frequencyHz)).toEqual([
      semitoneToFrequency(200, 0),
      semitoneToFrequency(200, 7),
      semitoneToFrequency(200, 0),
      semitoneToFrequency(200, 7),
    ]);
    expect(schedule.every((n) => n.durationMs === 100)).toBe(true);
  });

  it('continues the pattern cycle across a later batch via indexOffset', () => {
    const first = generateBaseLoopSchedule(120, 4, 200, layer, 0);
    const second = generateBaseLoopSchedule(120, 2, 200, layer, 2000, 4);
    expect(second.map((n) => n.frequencyHz)).toEqual([
      semitoneToFrequency(200, 0),
      semitoneToFrequency(200, 7),
    ]);
    expect(second[0].timeMs).toBe(first[first.length - 1].timeMs + 500);
  });
});
