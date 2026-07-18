import { describe, expect, it } from 'vitest';
import { biomeBlendRatio } from './biome';

describe('biomeBlendRatio', () => {
  it('is 0 before the transition starts', () => {
    expect(biomeBlendRatio(0, 1000, 500)).toBe(0);
    expect(biomeBlendRatio(999, 1000, 500)).toBe(0);
  });

  it('is 0 at the exact start', () => {
    expect(biomeBlendRatio(1000, 1000, 500)).toBe(0);
  });

  it('ramps linearly across the transition band', () => {
    expect(biomeBlendRatio(1250, 1000, 500)).toBeCloseTo(0.5, 5);
  });

  it('is 1 at and beyond the end of the transition band', () => {
    expect(biomeBlendRatio(1500, 1000, 500)).toBe(1);
    expect(biomeBlendRatio(5000, 1000, 500)).toBe(1);
  });

  it('clamps negative distance to 0', () => {
    expect(biomeBlendRatio(-100, 1000, 500)).toBe(0);
  });

  it('treats a zero-length transition as a hard cut at the start', () => {
    expect(biomeBlendRatio(999, 1000, 0)).toBe(0);
    expect(biomeBlendRatio(1000, 1000, 0)).toBe(1);
  });
});
