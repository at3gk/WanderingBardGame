import { describe, expect, it } from 'vitest';
import {
  GATE_FALL_END,
  GATE_FALL_START,
  GATE_RISE_END,
  GATE_RISE_START,
  skylightSatGate,
} from './skylightGate';

/**
 * Task 194 piece 3's own requirement, from ROADMAP's "Next" note: exactly 0
 * at the CARRYING hours (dawn/golden/dusk/night), nonzero across morning/
 * noon/afternoon. Every test checks a named hour from `sky.ts`'s SKY_KEYS
 * `t` values, not an arbitrary point on the curve.
 */
describe('skylightSatGate', () => {
  it('is exactly zero at every CARRYING hour', () => {
    expect(skylightSatGate(0.0)).toBe(0); // night
    expect(skylightSatGate(0.2)).toBe(0); // first light
    expect(skylightSatGate(0.28)).toBe(0); // dawn
    expect(skylightSatGate(0.82)).toBe(0); // golden
    expect(skylightSatGate(0.9)).toBe(0); // dusk
  });

  it('is exactly zero deep in the night on both sides of the wrap', () => {
    expect(skylightSatGate(0.95)).toBe(0);
    expect(skylightSatGate(0.05)).toBe(0);
  });

  it('is full by morning and stays full through noon and afternoon', () => {
    expect(skylightSatGate(0.42)).toBe(1); // morning
    expect(skylightSatGate(0.55)).toBe(1); // noon
    expect(skylightSatGate(0.7)).toBe(1); // afternoon
  });

  it('rises smoothly between dawn and morning', () => {
    let prev = skylightSatGate(GATE_RISE_START);
    for (let t = GATE_RISE_START; t <= GATE_RISE_END; t += 0.01) {
      const cur = skylightSatGate(t);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = cur;
    }
  });

  it('falls smoothly between afternoon and golden', () => {
    let prev = skylightSatGate(GATE_FALL_START);
    for (let t = GATE_FALL_START; t <= GATE_FALL_END; t += 0.01) {
      const cur = skylightSatGate(t);
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
      prev = cur;
    }
  });

  it('wraps 1.0 and 0.0 to the same reading', () => {
    expect(skylightSatGate(1.0)).toBeCloseTo(skylightSatGate(0.0), 10);
    expect(skylightSatGate(1.55)).toBeCloseTo(skylightSatGate(0.55), 10);
  });

  it('handles a value already outside 0..1 without throwing', () => {
    expect(() => skylightSatGate(-0.3)).not.toThrow();
    expect(skylightSatGate(-0.3)).toBeCloseTo(skylightSatGate(0.7), 10);
  });

  it('never exceeds the 0..1 range', () => {
    for (let t = 0; t < 1; t += 0.01) {
      const g = skylightSatGate(t);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});
