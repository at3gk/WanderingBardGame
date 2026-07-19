import { describe, expect, it } from 'vitest';
import { beatIntervalMs, generateBeatSchedule, isBeatMissed, isWithinHitWindow, scrollProgress } from './beats';

describe('beatIntervalMs', () => {
  it('converts BPM to milliseconds per beat', () => {
    expect(beatIntervalMs(120)).toBe(500);
    expect(beatIntervalMs(60)).toBe(1000);
  });

  it('rejects non-positive tempos', () => {
    expect(() => beatIntervalMs(0)).toThrow();
    expect(() => beatIntervalMs(-10)).toThrow();
  });
});

describe('generateBeatSchedule', () => {
  it('spaces beats evenly starting one interval after the start time', () => {
    const beats = generateBeatSchedule(120, 3, 1000);
    expect(beats).toEqual([
      { index: 0, hitTimeMs: 1500 },
      { index: 1, hitTimeMs: 2000 },
      { index: 2, hitTimeMs: 2500 },
    ]);
  });

  it('defaults the start time to zero', () => {
    const beats = generateBeatSchedule(60, 2);
    expect(beats.map((b) => b.hitTimeMs)).toEqual([1000, 2000]);
  });

  it('continues indices from indexOffset for a later batch', () => {
    const first = generateBeatSchedule(120, 2, 0);
    const second = generateBeatSchedule(120, 2, first[first.length - 1].hitTimeMs, first.length);
    expect(second).toEqual([
      { index: 2, hitTimeMs: 1500 },
      { index: 3, hitTimeMs: 2000 },
    ]);
  });
});

describe('scrollProgress', () => {
  const beat = { index: 0, hitTimeMs: 2000 };

  it('is 0 at spawn and 1 at the hit line', () => {
    expect(scrollProgress(beat, 1000, 1000)).toBe(0);
    expect(scrollProgress(beat, 2000, 1000)).toBe(1);
  });

  it('is linear in between and exceeds 1 once past the line', () => {
    expect(scrollProgress(beat, 1500, 1000)).toBe(0.5);
    expect(scrollProgress(beat, 2500, 1000)).toBe(1.5);
  });
});

describe('isWithinHitWindow', () => {
  const beat = { index: 0, hitTimeMs: 2000 };

  it('accepts inputs inside the window, inclusive of the edges', () => {
    expect(isWithinHitWindow(beat, 2000, 100)).toBe(true);
    expect(isWithinHitWindow(beat, 1900, 100)).toBe(true);
    expect(isWithinHitWindow(beat, 2100, 100)).toBe(true);
  });

  it('rejects inputs outside the window', () => {
    expect(isWithinHitWindow(beat, 1899, 100)).toBe(false);
    expect(isWithinHitWindow(beat, 2101, 100)).toBe(false);
  });
});

describe('isBeatMissed', () => {
  const beat = { index: 0, hitTimeMs: 2000 };

  it('is not missed before or at the end of the hit window', () => {
    expect(isBeatMissed(beat, 2000, 100)).toBe(false);
    expect(isBeatMissed(beat, 2100, 100)).toBe(false);
  });

  it('is missed once the window has fully passed', () => {
    expect(isBeatMissed(beat, 2101, 100)).toBe(true);
  });
});
