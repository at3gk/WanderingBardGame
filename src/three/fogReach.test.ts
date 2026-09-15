import { describe, expect, it } from 'vitest';
import {
  FOG_FAR_BASE,
  FOG_NEAR_BASE,
  REACH_HORIZON,
  REACH_NIGHT,
  REACH_NOON,
  RIVERSIDE_REACH_BONUS,
  fogReachAt,
  fogReachMultiplier,
} from './fogReach';

/**
 * The color-script spec (docs/color-script.md, "Fog reach") names three
 * ordered claims: night is the shortest reach of the day, dawn/golden the
 * longest, noon shorter than dawn/golden but not as short as night. Every
 * test here is checking one of those claims against a real named-hour sun
 * height (sky.ts's SKY_KEYS), not an arbitrary point on the curve.
 */
describe('fogReachMultiplier', () => {
  it('is the shortest reach of the day at full night', () => {
    // Deep night's own sun height (sin(-0.5)).
    expect(fogReachMultiplier(-0.48)).toBe(REACH_NIGHT);
    expect(fogReachMultiplier(-1)).toBe(REACH_NIGHT);
  });

  it('gives dawn and golden the same longest-reach plateau', () => {
    // Golden ~0.12, dawn ~0.16 (sky.ts SKY_KEYS elevations 0.12/0.16).
    expect(fogReachMultiplier(0.12)).toBe(REACH_HORIZON);
    expect(fogReachMultiplier(0.16)).toBe(REACH_HORIZON);
  });

  it('pulls noon in to the shortest daylight reach', () => {
    // High day's own sun height (sin(0.70)).
    expect(fogReachMultiplier(0.64)).toBe(REACH_NOON);
    expect(fogReachMultiplier(1)).toBe(REACH_NOON);
  });

  it('orders night shortest, then noon, then the dawn/golden plateau', () => {
    expect(REACH_NIGHT).toBeLessThan(REACH_NOON);
    expect(REACH_NOON).toBeLessThan(REACH_HORIZON);
  });

  it('gives morning and afternoon a partial pull toward noon, not the plateau', () => {
    // Afternoon ~0.33, morning ~0.37 — inside the horizon-to-noon ramp.
    for (const y of [0.33, 0.37]) {
      const m = fogReachMultiplier(y);
      expect(m).toBeLessThan(REACH_HORIZON);
      expect(m).toBeGreaterThan(REACH_NOON);
    }
  });

  it('is continuous: no jump greater than a fine step could explain', () => {
    let prev = fogReachMultiplier(-1);
    for (let y = -0.99; y <= 1; y += 0.01) {
      const cur = fogReachMultiplier(y);
      expect(Math.abs(cur - prev)).toBeLessThan(0.05);
      prev = cur;
    }
  });
});

describe('fogReachAt', () => {
  it('scales RoadStage’s original near/far by the hour multiplier', () => {
    const terrainReach = 165;
    const reach = fogReachAt(0.64, 'forest', terrainReach);
    const mult = fogReachMultiplier(0.64);
    expect(reach.near).toBeCloseTo(terrainReach * FOG_NEAR_BASE * mult, 6);
    expect(reach.far).toBeCloseTo(terrainReach * FOG_FAR_BASE * mult, 6);
  });

  it('keeps the near/far ratio fixed at every hour, so the shape never distorts', () => {
    const terrainReach = 165;
    for (const y of [-0.48, -0.1, 0, 0.12, 0.33, 0.64]) {
      const reach = fogReachAt(y, 'village', terrainReach);
      expect(reach.far / reach.near).toBeCloseTo(FOG_FAR_BASE / FOG_NEAR_BASE, 6);
    }
  });

  it('gives riverside a longer reach than the same hour elsewhere', () => {
    const terrainReach = 165;
    const riverside = fogReachAt(0.64, 'riverside', terrainReach);
    const forest = fogReachAt(0.64, 'forest', terrainReach);
    expect(riverside.near).toBeCloseTo(forest.near * RIVERSIDE_REACH_BONUS, 6);
    expect(riverside.far).toBeCloseTo(forest.far * RIVERSIDE_REACH_BONUS, 6);
  });

  it('leaves non-riverside biomes, and unrecognised strings, at the plain hour reach', () => {
    const terrainReach = 165;
    const forest = fogReachAt(0.3, 'forest', terrainReach);
    const village = fogReachAt(0.3, 'village', terrainReach);
    const unknown = fogReachAt(0.3, 'nowhere', terrainReach);
    expect(village).toEqual(forest);
    expect(unknown).toEqual(forest);
  });
});
