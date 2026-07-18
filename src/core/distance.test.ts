import { describe, expect, it } from 'vitest';
import { accumulateDistance } from './distance';

describe('accumulateDistance', () => {
  it('accumulates distance while walking', () => {
    expect(accumulateDistance(0, true, 1000, 90)).toBe(90);
  });

  it('holds distance still while stopped', () => {
    expect(accumulateDistance(500, false, 1000, 90)).toBe(500);
  });

  it('ignores zero or negative delta', () => {
    expect(accumulateDistance(500, true, 0, 90)).toBe(500);
    expect(accumulateDistance(500, true, -16, 90)).toBe(500);
  });

  it('accumulates across repeated calls like a per-frame accumulator', () => {
    let distance = 0;
    for (let i = 0; i < 10; i += 1) {
      distance = accumulateDistance(distance, true, 100, 90);
    }
    expect(distance).toBeCloseTo(90, 5);
  });
});
