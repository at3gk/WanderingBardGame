import { describe, expect, it } from 'vitest';

import { CLEAN_WALKS, GHOST_WALKS } from './mastery';
import { wearTier } from './pageWear';

describe('wearTier', () => {
  it('leaves an unwalked page untouched', () => {
    expect(wearTier(0)).toBe(0);
  });

  it('steps at the diary-fact thresholds mastery.ts uses', () => {
    expect(wearTier(1)).toBe(1);
    expect(wearTier(GHOST_WALKS - 1)).toBe(1);
    expect(wearTier(GHOST_WALKS)).toBe(2);
    expect(wearTier(CLEAN_WALKS - 1)).toBe(2);
    expect(wearTier(CLEAN_WALKS)).toBe(3);
  });

  it('never un-wears as walks pile up', () => {
    let last = 0;
    for (let walks = 0; walks <= 40; walks++) {
      const tier = wearTier(walks);
      expect(tier).toBeGreaterThanOrEqual(last);
      last = tier;
    }
    expect(last).toBe(3);
  });

  it('tops out rather than inventing a fourth tier', () => {
    expect(wearTier(9999)).toBe(3);
  });

  it('reads junk as untouched', () => {
    expect(wearTier(-1)).toBe(0);
    expect(wearTier(-9999)).toBe(0);
    expect(wearTier(Number.NaN)).toBe(0);
    expect(wearTier(Number.POSITIVE_INFINITY)).toBe(0);
    expect(wearTier(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('counts a part-walked pass by what is finished', () => {
    expect(wearTier(0.9)).toBe(0);
    expect(wearTier(1.9)).toBe(1);
  });
});
