import { describe, expect, it } from 'vitest';
import { roadName } from './roadName';
import { dayKey, legSeed } from './rng';

describe('roadName', () => {
  it('gives one seed one name, every time', () => {
    for (const seed of [0, 1, 7, 991, 0xdeadbe, 4294967295]) {
      expect(roadName(seed)).toBe(roadName(seed));
    }
  });

  it('reads as two storybook words', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(roadName(seed)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });

  it('spreads: a season of roads does not repeat itself into one name', () => {
    const names = new Set<string>();
    for (let seed = 0; seed < 200; seed++) names.add(roadName(seed));
    expect(names.size).toBeGreaterThanOrEqual(60);
  });

  it('never names a road anything the journal would not say out loud', () => {
    // The same rule the page and the encounters keep: nothing in this game
    // is a verdict, and a signpost is read by children too.
    const banned = /gallow|grave|dead|dark|blood|fail|lost|wrong/i;
    for (let seed = 0; seed < 500; seed++) {
      expect(roadName(seed)).not.toMatch(banned);
    }
  });

  it('gives a moonlit leg its own name — a second road is a second place', () => {
    let differ = 0;
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 50; d++) {
      const key = dayKey(new Date(start + d * 86400000));
      if (roadName(legSeed(key, 0)) !== roadName(legSeed(key, 1))) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(45);
  });
});
