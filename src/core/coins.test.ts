import { describe, expect, it } from 'vitest';
import { accumulateCoins } from './coins';

describe('accumulateCoins', () => {
  it('accrues at full rate when the meter is full', () => {
    expect(accumulateCoins(0, 1, 1000, 5)).toBe(5);
  });

  it('accrues proportionally slower as meter ratio drops', () => {
    expect(accumulateCoins(0, 0.5, 1000, 5)).toBe(2.5);
  });

  it('holds still when the meter is empty', () => {
    expect(accumulateCoins(10, 0, 1000, 5)).toBe(10);
  });

  it('ignores zero or negative delta', () => {
    expect(accumulateCoins(10, 1, 0, 5)).toBe(10);
    expect(accumulateCoins(10, 1, -16, 5)).toBe(10);
  });

  it('accumulates across repeated calls like a per-frame accumulator', () => {
    let coins = 0;
    for (let i = 0; i < 10; i += 1) {
      coins = accumulateCoins(coins, 1, 100, 5);
    }
    expect(coins).toBeCloseTo(5, 5);
  });
});
