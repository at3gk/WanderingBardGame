import { describe, expect, it } from 'vitest';
import { biomeBlendAt, BiomeTransition, signpostDistanceAt } from './biome';

const TWO_STAGE: BiomeTransition[] = [
  { startPx: 1000, lengthPx: 500 },
  { startPx: 3000, lengthPx: 500 },
];

describe('biomeBlendAt', () => {
  it('is steady state on biome 0 before the first transition starts', () => {
    expect(biomeBlendAt(0, TWO_STAGE, 3)).toEqual({ fromIndex: 0, toIndex: 0, ratio: 0 });
    expect(biomeBlendAt(999, TWO_STAGE, 3)).toEqual({ fromIndex: 0, toIndex: 0, ratio: 0 });
  });

  it('is 0 ratio at the exact start of the first transition', () => {
    expect(biomeBlendAt(1000, TWO_STAGE, 3)).toEqual({ fromIndex: 0, toIndex: 1, ratio: 0 });
  });

  it('ramps linearly across the first transition band', () => {
    const blend = biomeBlendAt(1250, TWO_STAGE, 3);
    expect(blend.fromIndex).toBe(0);
    expect(blend.toIndex).toBe(1);
    expect(blend.ratio).toBeCloseTo(0.5, 5);
  });

  it('settles into steady state on biome 1 between transitions', () => {
    expect(biomeBlendAt(1500, TWO_STAGE, 3)).toEqual({ fromIndex: 1, toIndex: 1, ratio: 0 });
    expect(biomeBlendAt(2999, TWO_STAGE, 3)).toEqual({ fromIndex: 1, toIndex: 1, ratio: 0 });
  });

  it('ramps linearly across the second transition band', () => {
    const blend = biomeBlendAt(3250, TWO_STAGE, 3);
    expect(blend.fromIndex).toBe(1);
    expect(blend.toIndex).toBe(2);
    expect(blend.ratio).toBeCloseTo(0.5, 5);
  });

  it('is steady state on the final biome after the last transition completes', () => {
    expect(biomeBlendAt(3500, TWO_STAGE, 3)).toEqual({ fromIndex: 2, toIndex: 2, ratio: 0 });
    expect(biomeBlendAt(100000, TWO_STAGE, 3)).toEqual({ fromIndex: 2, toIndex: 2, ratio: 0 });
  });

  it('clamps negative distance to steady state on biome 0', () => {
    expect(biomeBlendAt(-100, TWO_STAGE, 3)).toEqual({ fromIndex: 0, toIndex: 0, ratio: 0 });
  });

  it('treats a zero-length transition as a hard cut at the start', () => {
    const hardCut: BiomeTransition[] = [{ startPx: 1000, lengthPx: 0 }];
    expect(biomeBlendAt(999, hardCut, 2)).toEqual({ fromIndex: 0, toIndex: 0, ratio: 0 });
    expect(biomeBlendAt(1000, hardCut, 2)).toEqual({ fromIndex: 0, toIndex: 1, ratio: 1 });
  });

  it('wraps home when the transition list is as long as the biome list (task 35)', () => {
    // 2 biomes, 2 transitions: the second transition now leads back to
    // biome 0 instead of being ignored (pre-task-35 clamping behavior).
    const blend = biomeBlendAt(3250, TWO_STAGE, 2);
    expect(blend.fromIndex).toBe(1);
    expect(blend.toIndex).toBe(0);
    expect(blend.ratio).toBeCloseTo(0.5, 5);
  });
});

describe('biomeBlendAt cyclic wrapping (task 35 — the road loops home)', () => {
  // 3 biomes, 3 transitions; the last one wraps 2 -> 0. Cycle length is
  // the last transition's end: 5500.
  const LOOP: BiomeTransition[] = [
    { startPx: 1000, lengthPx: 500 },
    { startPx: 3000, lengthPx: 500 },
    { startPx: 5000, lengthPx: 500 },
  ];

  it('ramps the final transition from the last biome back to biome 0', () => {
    const blend = biomeBlendAt(5250, LOOP, 3);
    expect(blend.fromIndex).toBe(2);
    expect(blend.toIndex).toBe(0);
    expect(blend.ratio).toBeCloseTo(0.5, 5);
  });

  it('is steady on biome 0 again just past the cycle boundary', () => {
    expect(biomeBlendAt(5600, LOOP, 3)).toEqual({ fromIndex: 0, toIndex: 0, ratio: 0 });
  });

  it('repeats the first transition in the second cycle at the same in-cycle distance', () => {
    const firstCycle = biomeBlendAt(1100, LOOP, 3);
    const secondCycle = biomeBlendAt(5500 + 1100, LOOP, 3);
    expect(secondCycle).toEqual(firstCycle);
    expect(secondCycle.toIndex).toBe(1);
    expect(secondCycle.ratio).toBeCloseTo(0.2, 5);
  });

  it('keeps cycling at very large distances', () => {
    const blend = biomeBlendAt(5500 * 100 + 3250, LOOP, 3);
    expect(blend.fromIndex).toBe(1);
    expect(blend.toIndex).toBe(2);
    expect(blend.ratio).toBeCloseTo(0.5, 5);
  });

  it('still clamps (no wrap) when the transition list is shorter than the biome list', () => {
    expect(biomeBlendAt(100000, TWO_STAGE, 3)).toEqual({ fromIndex: 2, toIndex: 2, ratio: 0 });
  });
});

describe('signpostDistanceAt', () => {
  const LOOP: BiomeTransition[] = [
    { startPx: 1000, lengthPx: 500 },
    { startPx: 3000, lengthPx: 500 },
    { startPx: 5000, lengthPx: 500 },
  ];

  it('returns each transition\'s own start distance within the first cycle', () => {
    expect(signpostDistanceAt(0, LOOP)).toBe(1000);
    expect(signpostDistanceAt(1, LOOP)).toBe(3000);
    expect(signpostDistanceAt(2, LOOP)).toBe(5000);
  });

  it('carries the cycle length forward into the second cycle', () => {
    // cycle length = last transition's end = 5500
    expect(signpostDistanceAt(3, LOOP)).toBe(5500 + 1000);
    expect(signpostDistanceAt(4, LOOP)).toBe(5500 + 3000);
    expect(signpostDistanceAt(5, LOOP)).toBe(5500 + 5000);
  });

  it('keeps advancing at large occurrence indices', () => {
    expect(signpostDistanceAt(3 * 100, LOOP)).toBe(5500 * 100 + 1000);
  });
});
