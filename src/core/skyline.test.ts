import { describe, expect, it } from 'vitest';
import { generateRoad, sampleRoad } from './road';
import { legSeed, nextDayKey } from './rng';
import { SKYLINE_SAMPLES, tomorrowSkyline } from './skyline';

describe('nextDayKey', () => {
  it('steps one UTC day', () => {
    expect(nextDayKey('2026-07-28')).toBe('2026-07-29');
  });

  it('turns month ends, year ends and leap days', () => {
    expect(nextDayKey('2026-07-31')).toBe('2026-08-01');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
    expect(nextDayKey('2028-02-28')).toBe('2028-02-29');
    expect(nextDayKey('2028-02-29')).toBe('2028-03-01');
    expect(nextDayKey('2027-02-28')).toBe('2027-03-01');
  });

  it('hands back a key it cannot read rather than inventing NaN', () => {
    expect(nextDayKey('')).toBe('');
    expect(nextDayKey('not-a-day')).toBe('not-a-day');
  });
});

describe('tomorrowSkyline', () => {
  it('is deterministic: the same evening always shows the same tomorrow', () => {
    expect(tomorrowSkyline('2026-07-28')).toEqual(tomorrowSkyline('2026-07-28'));
  });

  it('is genuinely tomorrow: derived from the next day’s shared road', () => {
    const key = nextDayKey('2026-07-28');
    const road = generateRoad(legSeed(key, 0), key);
    const heights = Array.from({ length: SKYLINE_SAMPLES }, (_, i) =>
      sampleRoad(road, (road.lengthM * i) / (SKYLINE_SAMPLES - 1)).y,
    );
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    const expected = heights.map((h) => (h - min) / (max - min));
    const profile = tomorrowSkyline('2026-07-28');
    for (let i = 0; i < SKYLINE_SAMPLES; i++) {
      expect(profile[i]).toBeCloseTo(expected[i], 10);
    }
  });

  it('changes with the day — anticipation, not wallpaper', () => {
    expect(tomorrowSkyline('2026-07-28')).not.toEqual(tomorrowSkyline('2026-07-29'));
  });

  it('stays inside [0, 1] and uses the full relief', () => {
    const profile = tomorrowSkyline('2026-07-28');
    expect(profile).toHaveLength(SKYLINE_SAMPLES);
    for (const h of profile) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(Math.min(...profile)).toBe(0);
    expect(Math.max(...profile)).toBe(1);
  });

  it('answers a requested sample count, floored at two', () => {
    expect(tomorrowSkyline('2026-07-28', 24)).toHaveLength(24);
    expect(tomorrowSkyline('2026-07-28', 1)).toHaveLength(2);
  });
});
