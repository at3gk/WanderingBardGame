import { describe, expect, it } from 'vitest';
import { applyHit, applyMiss, type SongMeterConfig } from './songMeter';

const config: SongMeterConfig = {
  max: 100,
  hitGain: 10,
  missDrain: 20,
  fullStrideMeter: 40,
};

describe('applyHit', () => {
  it('raises the meter by the configured gain', () => {
    expect(applyHit(50, config)).toBe(60);
  });

  it('clamps at the configured max', () => {
    expect(applyHit(95, config)).toBe(100);
  });
});

describe('applyMiss', () => {
  it('lowers the meter by the configured drain', () => {
    expect(applyMiss(50, config)).toBe(30);
  });

  it('clamps at zero', () => {
    expect(applyMiss(10, config)).toBe(0);
  });
});
