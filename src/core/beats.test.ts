import { describe, expect, it } from 'vitest';
import {
  beatIntervalMs,
  generateBeatSchedule,
  isBeatMissed,
  isWithinHitWindow,
  scrollProgress,
  wasUnplayable,
} from './beats';

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

describe('wasUnplayable', () => {
  // A note is only excused when its whole window fell inside one frame gap.
  // The risk of this guard is that it excuses too much: if it fired on
  // ordinary misses, a child could never generate the evidence the learning
  // model runs on, and letters would stop fading. So most of these cases are
  // about it staying OUT of the way.
  const beat = { index: 0, hitTimeMs: 1000 };
  const W = 90; // HIT_WINDOW_MS

  it('excuses a note whose whole window fell between two frames', () => {
    // Frame gap 800ms -> 1200ms swallows the window 910..1090 entirely.
    expect(wasUnplayable(beat, 1200, 800, W)).toBe(true);
  });

  it('does not excuse an ordinary miss at a normal frame rate', () => {
    // 16ms frame: the window was open across many frames before this one.
    expect(wasUnplayable(beat, 1100, 1084, W)).toBe(false);
  });

  it('does not excuse a note whose window was already open last frame', () => {
    // The child had from 910ms onwards; the hitch only ate the tail.
    expect(wasUnplayable(beat, 1200, 950, W)).toBe(false);
  });

  it('does not excuse a note whose window is still open now', () => {
    // Still playable this instant — it is not a miss yet at all.
    expect(wasUnplayable(beat, 1050, 900, W)).toBe(false);
  });

  it('is exact at the boundaries rather than fuzzy', () => {
    // previousMs exactly at the window's open time: the frame did NOT skip
    // it, so it is a real miss.
    expect(wasUnplayable(beat, 1200, 910, W)).toBe(false);
    // One millisecond earlier and the window opened inside the gap.
    expect(wasUnplayable(beat, 1200, 909, W)).toBe(true);
    // nowMs exactly at the close time still counts as fully elapsed.
    expect(wasUnplayable(beat, 1090, 800, W)).toBe(true);
    expect(wasUnplayable(beat, 1089, 800, W)).toBe(false);
  });

  it('never fires while frame gaps stay shorter than the window is wide', () => {
    // The structural reason this costs nothing in ordinary play: a gap has
    // to exceed the full window width (2W) to swallow one.
    for (let gap = 1; gap <= 2 * W; gap++) {
      for (let now = 900; now <= 1300; now++) {
        expect(wasUnplayable(beat, now, now - gap, W), `gap ${gap} at ${now}`).toBe(false);
      }
    }
  });
});
