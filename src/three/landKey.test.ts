import { describe, expect, it } from 'vitest';
import {
  LAND_KEYS,
  LAND_KEY_MAX,
  LAND_KEY_RISE_END,
  LAND_KEY_RISE_START,
  landKeyAmount,
} from './landKey';

/**
 * The land key is a daylight instrument. The colour script marks dawn,
 * golden hour, dusk and night as CARRYING hours — no run may spend
 * anything there, including this one. The schedule's whole contract is
 * that it is exactly zero when those hours own the frame.
 */
describe('landKeyAmount', () => {
  it('is zero at and below the horizon', () => {
    expect(landKeyAmount(0)).toBe(0);
    expect(landKeyAmount(-0.5)).toBe(0);
  });

  it('leaves dawn alone (sun height 0.16)', () => {
    expect(landKeyAmount(0.16)).toBe(0);
  });

  it('leaves the golden descent essentially alone (sun height 0.33)', () => {
    // Just inside the ramp's foot; the smoothstep keeps it a whisper.
    expect(landKeyAmount(0.33)).toBeLessThan(LAND_KEY_MAX * 0.05);
  });

  it('reaches full pull by the noon sun (height 0.64)', () => {
    expect(landKeyAmount(0.64)).toBe(LAND_KEY_MAX);
    expect(landKeyAmount(1)).toBe(LAND_KEY_MAX);
  });

  it('gives morning (height 0.37) a partial pull', () => {
    const morning = landKeyAmount(0.37);
    expect(morning).toBeGreaterThan(0);
    expect(morning).toBeLessThan(LAND_KEY_MAX * 0.5);
  });

  it('never decreases as the sun climbs', () => {
    let prev = -1;
    for (let y = -0.2; y <= 1; y += 0.01) {
      const a = landKeyAmount(y);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('ramp bounds are ordered and the max stays gentle-unifier sized', () => {
    expect(LAND_KEY_RISE_START).toBeLessThan(LAND_KEY_RISE_END);
    // Past ~0.5 the attraction stops binding a family and starts erasing
    // it — the within-family variety is the noon design's whole point.
    expect(LAND_KEY_MAX).toBeLessThanOrEqual(0.5);
  });
});

describe('LAND_KEYS', () => {
  it('covers every biome with a green-family chroma', () => {
    for (const [biome, hex] of Object.entries(LAND_KEYS)) {
      const r = (hex >> 16) & 0xff;
      const g = (hex >> 8) & 0xff;
      const b = hex & 0xff;
      // The key must point INTO the green family: the attraction only
      // binds hues within 90° of it, so a key that drifted off-green
      // would silently start binding the wrong half of the wheel.
      expect(g, `${biome} key must lead with green`).toBeGreaterThan(r);
      expect(g, `${biome} key must lead with green`).toBeGreaterThan(b);
    }
  });
});
