import { describe, expect, it } from 'vitest';
import { accumulateCoins, crossedCoinMilestone } from './coins';

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

describe('crossedCoinMilestone', () => {
  it('is true the frame accrual crosses a multiple of `every`', () => {
    expect(crossedCoinMilestone(24.7, 25.1, 25)).toBe(true);
  });

  it('is false while still short of the next multiple', () => {
    expect(crossedCoinMilestone(24.1, 24.7, 25)).toBe(false);
  });

  it('is false exactly at zero coins (no milestone reached yet)', () => {
    expect(crossedCoinMilestone(0, 0, 25)).toBe(false);
  });

  it('catches a jump spanning more than one multiple, same as a normal frame', () => {
    expect(crossedCoinMilestone(20, 51, 25)).toBe(true);
  });

  it('never fires for a non-positive `every`', () => {
    expect(crossedCoinMilestone(24, 26, 0)).toBe(false);
    expect(crossedCoinMilestone(24, 26, -5)).toBe(false);
  });
});
