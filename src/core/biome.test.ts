import { describe, expect, it } from 'vitest';
import { biomeBlendAt, BiomeTransition } from './biome';

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

  it('ignores transitions beyond biomeCount - 1', () => {
    // Only 2 biomes but 2 transitions supplied — the second transition
    // should never be reached since there's no third biome to blend into.
    expect(biomeBlendAt(3250, TWO_STAGE, 2)).toEqual({ fromIndex: 1, toIndex: 1, ratio: 0 });
  });
});
