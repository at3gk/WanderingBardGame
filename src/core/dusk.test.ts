import { describe, expect, it } from 'vitest';
import { DUSK_CYCLE_PX, DUSK_MAX_DARKEN, duskShadeAt, nightnessAt } from './dusk';

describe('duskShadeAt', () => {
  it('is full brightness at the cycle start (dusk)', () => {
    expect(duskShadeAt(0)).toBeCloseTo(1, 10);
  });

  it('dips to exactly 1 - maxDarken at mid-cycle (deep night)', () => {
    expect(duskShadeAt(DUSK_CYCLE_PX / 2)).toBeCloseTo(1 - DUSK_MAX_DARKEN, 10);
  });

  it('returns to full brightness at the cycle boundary', () => {
    expect(duskShadeAt(DUSK_CYCLE_PX)).toBeCloseTo(1, 10);
  });

  it('darkens monotonically through the first half-cycle', () => {
    let prev = duskShadeAt(0);
    for (let d = DUSK_CYCLE_PX / 10; d <= DUSK_CYCLE_PX / 2; d += DUSK_CYCLE_PX / 10) {
      const shade = duskShadeAt(d);
      expect(shade).toBeLessThan(prev);
      prev = shade;
    }
  });

  it('repeats identically on later cycles', () => {
    const d = DUSK_CYCLE_PX * 0.3;
    expect(duskShadeAt(DUSK_CYCLE_PX * 5 + d)).toBeCloseTo(duskShadeAt(d), 10);
  });

  it('is safe for negative distances and degenerate cycle lengths', () => {
    expect(duskShadeAt(-DUSK_CYCLE_PX / 2)).toBeCloseTo(1 - DUSK_MAX_DARKEN, 10);
    expect(duskShadeAt(1234, 0)).toBe(1);
  });
});

describe('nightnessAt', () => {
  it('is 0 at dusk and 1 at deepest night', () => {
    expect(nightnessAt(0)).toBeCloseTo(0, 10);
    expect(nightnessAt(DUSK_CYCLE_PX / 2)).toBeCloseTo(1, 10);
  });
});
