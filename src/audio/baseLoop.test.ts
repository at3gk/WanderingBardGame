import { describe, expect, it } from 'vitest';
import { semitoneToFrequency } from './baseLoop';

describe('semitoneToFrequency', () => {
  it('returns the root itself at offset 0', () => {
    expect(semitoneToFrequency(261.63, 0)).toBeCloseTo(261.63, 5);
  });

  it('doubles an octave up and halves an octave down', () => {
    expect(semitoneToFrequency(261.63, 12)).toBeCloseTo(523.26, 5);
    expect(semitoneToFrequency(261.63, -12)).toBeCloseTo(130.815, 5);
  });

  it('lands on the standard tuning pitches of the C major scale', () => {
    // Middle C's scale, to the nearest tenth of a Hz.
    expect(semitoneToFrequency(261.63, 2)).toBeCloseTo(293.7, 1); // D4
    expect(semitoneToFrequency(261.63, 4)).toBeCloseTo(329.6, 1); // E4
    expect(semitoneToFrequency(261.63, 7)).toBeCloseTo(392.0, 1); // G4
    expect(semitoneToFrequency(261.63, 9)).toBeCloseTo(440.0, 1); // A4 — concert pitch
  });
});
