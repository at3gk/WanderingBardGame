import { describe, expect, it } from 'vitest';
import {
  LOW_SUN_FLOOR_MAX,
  lowSunFloorAmount,
} from './valueFloor';

describe('lowSunFloorAmount', () => {
  it('is full across the three measured sites', () => {
    // golden (NPC voids), dawn first light, dusk (12/13 stripes).
    for (const y of [0.12, 0.14, 0.06, -0.14]) {
      expect(lowSunFloorAmount(y)).toBe(LOW_SUN_FLOOR_MAX);
    }
  });

  it('is zero at the night gauge pose and at high day', () => {
    // The night pose's sun height is -0.296; its 6.4-stop range is
    // load-bearing. Morning (0.371) and noon (0.644) keep their contrast.
    expect(lowSunFloorAmount(-0.296)).toBe(0);
    expect(lowSunFloorAmount(-1)).toBe(0);
    expect(lowSunFloorAmount(0.371)).toBe(0);
    expect(lowSunFloorAmount(0.644)).toBe(0);
  });

  it('never goes negative and never exceeds its max', () => {
    for (let y = -1; y <= 1; y += 0.01) {
      const a = lowSunFloorAmount(y);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(LOW_SUN_FLOOR_MAX);
    }
  });
});
