import { describe, expect, it } from 'vitest';
import {
  chance,
  dailySeed,
  dayKey,
  fbm1D,
  hashString,
  legRoadKey,
  legSeed,
  mulberry32,
  pick,
  randInt,
  randRange,
  shuffled,
  subSeed,
  valueNoise1D,
  weightedPick,
} from './rng';

describe('legSeed / legRoadKey — the moonlit roads', () => {
  it('leg 0 IS the shared daily seed — communal by identity, not by luck', () => {
    const d = new Date(Date.UTC(2026, 6, 28, 15, 30));
    expect(legSeed(dayKey(d), 0)).toBe(dailySeed(d));
  });

  it('each leg of a day is its own deterministic road', () => {
    expect(legSeed('2026-07-28', 1)).toBe(legSeed('2026-07-28', 1));
    expect(legSeed('2026-07-28', 1)).not.toBe(legSeed('2026-07-28', 0));
    expect(legSeed('2026-07-28', 1)).not.toBe(legSeed('2026-07-28', 2));
    expect(legSeed('2026-07-28', 1)).not.toBe(legSeed('2026-07-29', 1));
  });

  it('reads a nonsense leg as the shared road', () => {
    expect(legSeed('2026-07-28', Number.NaN)).toBe(legSeed('2026-07-28', 0));
    expect(legSeed('2026-07-28', -3)).toBe(legSeed('2026-07-28', 0));
    expect(legSeed('2026-07-28', 1.9)).toBe(legSeed('2026-07-28', 1));
  });

  it('stamps a moonlit road with a key of its own, so its stop ids cannot collide', () => {
    expect(legRoadKey('2026-07-28', 0)).toBe('2026-07-28');
    expect(legRoadKey('2026-07-28', 2)).toBe('2026-07-28~2');
    expect(legRoadKey('2026-07-28', 2)).not.toBe(legRoadKey('2026-07-28', 1));
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('diverges for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays in [0, 1)', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a roughly flat distribution across ten buckets', () => {
    const rand = mulberry32(7);
    const buckets = new Array(10).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) buckets[Math.floor(rand() * 10)]++;
    // Each bucket should hold ~2000. Allow a generous ±20%: this is a
    // smoke test for "the generator isn't broken", not a chi-squared.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 10 - n / 50);
      expect(count).toBeLessThan(n / 10 + n / 50);
    }
  });
});

describe('hashString / subSeed', () => {
  it('is stable', () => {
    expect(hashString('wandering-bard')).toBe(hashString('wandering-bard'));
  });

  it('separates streams that share a base seed', () => {
    const base = 4242;
    const foliage = mulberry32(subSeed(base, 'foliage'));
    const encounters = mulberry32(subSeed(base, 'encounters'));
    // The first draws must not coincide — that correlation is exactly the
    // bug this function exists to prevent.
    expect(foliage()).not.toBe(encounters());
  });

  it('returns unsigned 32-bit values', () => {
    for (const s of ['a', 'the road', '2026-07-28']) {
      expect(hashString(s)).toBeGreaterThanOrEqual(0);
      expect(hashString(s)).toBeLessThan(2 ** 32);
    }
  });
});

describe('dayKey / dailySeed', () => {
  it('formats UTC dates zero-padded', () => {
    expect(dayKey(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
    expect(dayKey(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });

  it('is the same across timezones for the same UTC instant', () => {
    // Two Date objects for the same instant produce the same key by
    // construction; the point of the assertion is that we never reach for
    // the local-time getters, which would not.
    const instant = Date.UTC(2026, 6, 28, 23, 30);
    expect(dayKey(new Date(instant))).toBe('2026-07-28');
  });

  it('gives different days different seeds', () => {
    const a = dailySeed(new Date(Date.UTC(2026, 6, 28)));
    const b = dailySeed(new Date(Date.UTC(2026, 6, 29)));
    expect(a).not.toBe(b);
  });

  it('gives the same day the same seed', () => {
    const morning = dailySeed(new Date(Date.UTC(2026, 6, 28, 1)));
    const night = dailySeed(new Date(Date.UTC(2026, 6, 28, 22)));
    expect(morning).toBe(night);
  });
});

describe('draw helpers', () => {
  it('randInt covers both endpoints and nothing outside', () => {
    const rand = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randInt(rand, 2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('randRange stays within bounds', () => {
    const rand = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const v = randRange(rand, -3, 7);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(7);
    }
  });

  it('pick returns a member and throws on empty', () => {
    const rand = mulberry32(5);
    expect(['a', 'b', 'c']).toContain(pick(rand, ['a', 'b', 'c']));
    expect(() => pick(rand, [])).toThrow();
  });

  it('weightedPick never returns a zero-weight item', () => {
    const rand = mulberry32(17);
    const items = [
      { id: 'never', w: 0 },
      { id: 'rare', w: 1 },
      { id: 'common', w: 99 },
    ];
    const counts: Record<string, number> = { never: 0, rare: 0, common: 0 };
    for (let i = 0; i < 3000; i++) counts[weightedPick(rand, items, (it) => it.w).id]++;
    expect(counts.never).toBe(0);
    expect(counts.common).toBeGreaterThan(counts.rare);
  });

  it('weightedPick falls back to uniform when every weight is zero', () => {
    const rand = mulberry32(19);
    const items = [{ w: 0 }, { w: 0 }];
    expect(items).toContain(weightedPick(rand, items, (it) => it.w));
  });

  it('chance respects its endpoints', () => {
    const rand = mulberry32(23);
    for (let i = 0; i < 100; i++) {
      expect(chance(rand, 0)).toBe(false);
      expect(chance(rand, 1)).toBe(true);
    }
  });

  it('shuffled is a permutation and leaves the input alone', () => {
    const rand = mulberry32(29);
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffled(rand, input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
  });
});

describe('noise', () => {
  it('valueNoise1D is deterministic and bounded', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const v = valueNoise1D(1234, x);
      expect(v).toBe(valueNoise1D(1234, x));
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('valueNoise1D is continuous — no jumps between adjacent samples', () => {
    // The whole reason for smoothstep interpolation. Step 1/16 of a
    // lattice cell; the value must not leap more than a fraction of the
    // full range, or the road has a crease in it.
    let previous = valueNoise1D(77, 0);
    for (let i = 1; i < 800; i++) {
      const v = valueNoise1D(77, i / 16);
      expect(Math.abs(v - previous)).toBeLessThan(0.5);
      previous = v;
    }
  });

  it('valueNoise1D actually varies', () => {
    const samples = Array.from({ length: 100 }, (_, i) => valueNoise1D(5, i * 0.9));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
  });

  it('fbm1D stays in range and is repeatable', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm1D(31, i * 0.21, 4);
      expect(v).toBe(fbm1D(31, i * 0.21, 4));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('fbm1D with one octave equals the base noise', () => {
    expect(fbm1D(9, 3.3, 1)).toBeCloseTo(valueNoise1D(9, 3.3), 10);
  });
});
