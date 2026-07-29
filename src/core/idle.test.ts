import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_OPTIONS,
  IDLE_STORAGE_KEY,
  IdleState,
  IdleYield,
  describeIdleYield,
  idleYield,
  loadIdle,
  saveIdle,
} from './idle';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = 1_700_000_000_000;

function state(overrides: Partial<IdleState> = {}): IdleState {
  return { since: T0, instrumentId: 'lute', quality: 1, ...overrides };
}

function after(ms: number, overrides: Partial<IdleState> = {}): IdleYield {
  return idleYield(state(overrides), T0 + ms);
}

describe('idleYield — the taper', () => {
  it('pays nothing for no time at all', () => {
    const y = after(0);
    expect(y.coins).toBe(0);
    expect(y.delight).toBe(0);
    expect(y.elapsedMs).toBe(0);
    expect(y.cappedAtMs).toBeNull();
  });

  it('never decreases as the absence grows', () => {
    let previous = -1;
    for (let h = 0; h <= 24; h += 0.5) {
      const coins = after(h * HOUR).coins;
      expect(coins).toBeGreaterThanOrEqual(previous);
      previous = coins;
    }
  });

  it('saturates: every hour is worth less than the one before it', () => {
    const at = (h: number) => after(h * HOUR).coins;
    const gains = [1, 2, 3, 4, 5].map((h) => at(h) - at(h - 1));
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeLessThan(gains[i - 1]);
    }
    expect(gains[0]).toBeGreaterThan(0);
  });

  it('makes the first hour worth coming back for', () => {
    // Most of a third of everything the case can hold, in the first hour. If
    // this ever drops far below that, the design has turned into a waiting
    // game and the taper needs shortening.
    expect(after(HOUR).coins).toBeGreaterThan(after(10 * HOUR).coins * 0.3);
  });

  it('does not reward sleeping in proportion to the sleep', () => {
    const oneHour = after(HOUR).coins;
    const eightHours = after(8 * HOUR).coins;
    expect(eightHours).toBeGreaterThan(oneHour);
    expect(eightHours).toBeLessThan(oneHour * 4);
  });

  it('matches the balance the defaults were chosen for', () => {
    expect(after(3 * HOUR).coins).toBe(41);
    expect(after(HOUR).coins).toBe(19);
  });

  it('pays delight on the same curve but a smaller share', () => {
    const y = after(3 * HOUR);
    expect(y.delight).toBeGreaterThan(0);
    expect(y.delight).toBeLessThan(y.coins);
  });

  it('returns whole numbers, never fractions of a coin', () => {
    for (const ms of [MINUTE, 7 * MINUTE, HOUR, 2.5 * HOUR, 9.9 * HOUR]) {
      const y = after(ms);
      expect(Number.isInteger(y.coins)).toBe(true);
      expect(Number.isInteger(y.delight)).toBe(true);
    }
  });

  it('pays nothing for a claim too small to be a coin', () => {
    expect(after(30_000).coins).toBe(0);
  });
});

describe('idleYield — the cap', () => {
  it('is not capped at exactly the cap', () => {
    expect(after(DEFAULT_IDLE_OPTIONS.capMs).cappedAtMs).toBeNull();
  });

  it('reports the cap honestly once past it', () => {
    const y = after(DEFAULT_IDLE_OPTIONS.capMs + 1);
    expect(y.cappedAtMs).toBe(DEFAULT_IDLE_OPTIONS.capMs);
  });

  it('still reports the true time away when capped', () => {
    const y = after(72 * HOUR);
    expect(y.elapsedMs).toBe(72 * HOUR);
    expect(y.cappedAtMs).toBe(DEFAULT_IDLE_OPTIONS.capMs);
  });

  it('pays a hundred days exactly what it pays eleven hours', () => {
    const long = after(100 * 24 * HOUR);
    const capped = after(11 * HOUR);
    expect(long.coins).toBe(capped.coins);
    expect(long.delight).toBe(capped.delight);
  });

  it('honours a caller-supplied cap', () => {
    const y = idleYield(state(), T0 + 5 * HOUR, { capMs: 2 * HOUR });
    expect(y.cappedAtMs).toBe(2 * HOUR);
    expect(y.coins).toBe(idleYield(state(), T0 + 2 * HOUR, { capMs: 2 * HOUR }).coins);
  });
});

describe('idleYield — quality and instrument', () => {
  it('pays a good set better than a rough one', () => {
    expect(after(3 * HOUR, { quality: 1 }).coins).toBeGreaterThan(after(3 * HOUR, { quality: 0 }).coins);
  });

  it('still pays something after a rough set — the case is open either way', () => {
    expect(after(3 * HOUR, { quality: 0 }).coins).toBeGreaterThan(0);
  });

  it('clamps quality rather than trusting it', () => {
    expect(after(3 * HOUR, { quality: 99 }).coins).toBe(after(3 * HOUR, { quality: 1 }).coins);
    expect(after(3 * HOUR, { quality: -5 }).coins).toBe(after(3 * HOUR, { quality: 0 }).coins);
    expect(after(3 * HOUR, { quality: Number.NaN }).coins).toBe(after(3 * HOUR, { quality: 0 }).coins);
  });

  it('treats an unknown instrument as ordinary rather than worthless', () => {
    const known = idleYield(state({ instrumentId: 'lute' }), T0 + 3 * HOUR, { instrumentMultipliers: { lute: 1 } });
    const unknown = idleYield(state({ instrumentId: 'hurdy-gurdy' }), T0 + 3 * HOUR, {
      instrumentMultipliers: { lute: 1 },
    });
    expect(unknown.coins).toBe(known.coins);
  });

  it('applies a supplied instrument multiplier', () => {
    const plain = after(3 * HOUR).coins;
    const y = idleYield(state({ instrumentId: 'drum' }), T0 + 3 * HOUR, { instrumentMultipliers: { drum: 2 } });
    // Not exactly 2x the floored figure: the multiplier applies before the
    // floor, so the doubled yield can be a coin ahead of double the single.
    expect(y.coins).toBeGreaterThanOrEqual(plain * 2);
    expect(y.coins).toBeLessThanOrEqual(plain * 2 + 1);
  });

  it('ignores a junk multiplier instead of producing a junk yield', () => {
    const bad = idleYield(state({ instrumentId: 'drum' }), T0 + 3 * HOUR, {
      instrumentMultipliers: { drum: Number.NaN },
    });
    const negative = idleYield(state({ instrumentId: 'drum' }), T0 + 3 * HOUR, {
      instrumentMultipliers: { drum: -4 },
    });
    expect(bad.coins).toBe(after(3 * HOUR).coins);
    expect(negative.coins).toBe(after(3 * HOUR).coins);
  });
});

describe('idleYield — purity', () => {
  it('does not touch the state it was handed', () => {
    const s: IdleState = { since: T0, instrumentId: 'lute', quality: 0.5 };
    const before = JSON.stringify(s);
    idleYield(s, T0 + 3 * HOUR, { instrumentMultipliers: { lute: 2 } });
    idleYield(s, T0 - 3 * HOUR);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('does not touch the options it was handed', () => {
    const table = { lute: 1.5 };
    const opts = { coinsPerHour: 10, instrumentMultipliers: table };
    idleYield(state(), T0 + 3 * HOUR, opts);
    expect(opts).toEqual({ coinsPerHour: 10, instrumentMultipliers: { lute: 1.5 } });
    expect(table).toEqual({ lute: 1.5 });
  });

  it('cannot have its balance rewritten from outside', () => {
    // resolveOptions reads these on every call, so a stray write would
    // silently re-balance the game for the rest of the session.
    expect(Object.isFrozen(DEFAULT_IDLE_OPTIONS)).toBe(true);
    expect(() => {
      (DEFAULT_IDLE_OPTIONS as { coinsPerHour: number }).coinsPerHour = 9999;
    }).toThrow();
    expect(after(3 * HOUR).coins).toBe(41);
  });

  it('treats no stored absence as no yield rather than throwing', () => {
    const y = idleYield(null, T0 + 3 * HOUR);
    expect(y).toEqual({ coins: 0, delight: 0, elapsedMs: 0, cappedAtMs: null });
  });

  it('returns a fresh object each call', () => {
    const a = after(3 * HOUR);
    const b = after(3 * HOUR);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('is unaffected by the order of keys in the multiplier table', () => {
    const one = idleYield(state({ instrumentId: 'drum' }), T0 + 3 * HOUR, {
      instrumentMultipliers: { lute: 1.5, drum: 2, bells: 0.5 },
    });
    const other = idleYield(state({ instrumentId: 'drum' }), T0 + 3 * HOUR, {
      instrumentMultipliers: { bells: 0.5, drum: 2, lute: 1.5 },
    });
    expect(one).toEqual(other);
  });

  it('does not mistake an inherited Object property for a multiplier', () => {
    for (const id of ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf']) {
      const y = idleYield(state({ instrumentId: id }), T0 + 3 * HOUR, { instrumentMultipliers: {} });
      expect(y.coins).toBe(after(3 * HOUR).coins);
    }
  });
});

describe('idleYield — clocks that lie', () => {
  it('pays nothing when the clock has gone backwards', () => {
    const y = idleYield(state(), T0 - 5 * HOUR);
    expect(y.coins).toBe(0);
    expect(y.delight).toBe(0);
    expect(y.elapsedMs).toBe(0);
    expect(y.cappedAtMs).toBeNull();
  });

  it('survives a small backwards NTP correction the same way', () => {
    const y = idleYield(state(), T0 - 400);
    expect(y.elapsedMs).toBe(0);
    expect(y.coins).toBe(0);
  });

  it('never reports a negative anything', () => {
    for (const offset of [-1, -1000, -HOUR, -400 * 24 * HOUR]) {
      const y = idleYield(state(), T0 + offset);
      expect(y.coins).toBeGreaterThanOrEqual(0);
      expect(y.delight).toBeGreaterThanOrEqual(0);
      expect(y.elapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('treats a nonsense clock as no time passing rather than guessing', () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const y = idleYield(state(), now);
      expect(y.coins).toBe(0);
      expect(y.elapsedMs).toBe(0);
    }
  });

  it('survives a nonsense `since`', () => {
    for (const since of [Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      const y = idleYield(state({ since }), T0 + 3 * HOUR);
      expect(y.coins).toBe(0);
      expect(Number.isFinite(y.elapsedMs)).toBe(true);
    }
  });

  it('caps a laptop that booted at the epoch instead of paying out a lifetime', () => {
    const y = idleYield(state({ since: 0 }), T0);
    expect(y.cappedAtMs).toBe(DEFAULT_IDLE_OPTIONS.capMs);
    expect(y.coins).toBe(after(DEFAULT_IDLE_OPTIONS.capMs).coins);
    expect(y.coins).toBeLessThan(1000);
  });

  it('produces finite integers for every hostile input tried', () => {
    const nows = [0, T0, -T0, Number.MAX_SAFE_INTEGER];
    const sinces = [0, T0, -T0, Number.MAX_SAFE_INTEGER];
    for (const now of nows) {
      for (const since of sinces) {
        const y = idleYield(state({ since }), now);
        expect(Number.isInteger(y.coins)).toBe(true);
        expect(Number.isInteger(y.delight)).toBe(true);
        expect(y.coins).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('describeIdleYield', () => {
  const spread: IdleYield[] = [
    { coins: 0, delight: 0, elapsedMs: 0, cappedAtMs: null },
    { coins: 0, delight: 0, elapsedMs: 20_000, cappedAtMs: null },
    { coins: 1, delight: 0, elapsedMs: 4 * MINUTE, cappedAtMs: null },
    { coins: 3, delight: 1, elapsedMs: 12 * MINUTE, cappedAtMs: null },
    { coins: 6, delight: 2, elapsedMs: 22 * MINUTE, cappedAtMs: null },
    { coins: 19, delight: 4, elapsedMs: HOUR, cappedAtMs: null },
    { coins: 41, delight: 10, elapsedMs: 3 * HOUR, cappedAtMs: null },
    { coins: 58, delight: 14, elapsedMs: 9 * HOUR, cappedAtMs: null },
    { coins: 58, delight: 14, elapsedMs: 30 * HOUR, cappedAtMs: 10 * HOUR },
    { coins: 58, delight: 14, elapsedMs: 96 * HOUR, cappedAtMs: 10 * HOUR },
    { coins: 120, delight: 40, elapsedMs: 400 * 24 * HOUR, cappedAtMs: 10 * HOUR },
  ];

  it('is a single well-formed sentence for every yield in the spread', () => {
    for (const y of spread) {
      const line = describeIdleYield(y);
      expect(line.length).toBeGreaterThan(20);
      expect(line.startsWith('You')).toBe(true);
      expect(line.endsWith('.')).toBe(true);
      expect(line.slice(0, -1)).not.toContain('.');
      expect(line).not.toMatch(/\s{2,}/);
      expect(line).not.toMatch(/\s[;,.]/);
      expect(line).not.toMatch(/undefined|NaN|Infinity|\bnull\b/);
    }
  });

  it('spells its numbers rather than printing them', () => {
    const line = describeIdleYield({ coins: 41, delight: 10, elapsedMs: 3 * HOUR, cappedAtMs: null });
    expect(line).toContain('forty-one coins');
    expect(line).toContain('three hours');
    expect(line).not.toMatch(/[0-9]/);
  });

  it('says nothing much happened when nothing much happened', () => {
    const line = describeIdleYield({ coins: 0, delight: 0, elapsedMs: 3000, cappedAtMs: null });
    expect(line).toContain('a moment');
    expect(line).toContain('much as you left it');
  });

  it('mentions a full case only when there was something in it', () => {
    const full = describeIdleYield({ coins: 58, delight: 14, elapsedMs: 30 * HOUR, cappedAtMs: 10 * HOUR });
    expect(full).toContain('full');
    const empty = describeIdleYield({ coins: 0, delight: 0, elapsedMs: 30 * HOUR, cappedAtMs: 10 * HOUR });
    expect(empty).not.toContain('full');
  });

  it('never blames the player for being away', () => {
    for (const y of spread) {
      expect(describeIdleYield(y).toLowerCase()).not.toMatch(/lost|missed|wasted|only earned|too long/);
    }
  });

  it('is deterministic for identical numbers', () => {
    const y = { coins: 41, delight: 10, elapsedMs: 3 * HOUR, cappedAtMs: null };
    expect(describeIdleYield(y)).toBe(describeIdleYield({ ...y }));
  });

  it('reads differently for every absence that is actually different', () => {
    // Entries 0 and 1 are both under the "only gone a moment" threshold and
    // are *meant* to collide, so they are excluded rather than absorbed into
    // a fudged `>= length - 1`. Everything else must be distinguishable.
    const distinguishable = spread.slice(1);
    const lines = new Set(distinguishable.map(describeIdleYield));
    expect(lines.size).toBe(distinguishable.length);
  });

  it('deliberately reads the same for two absences too short to tell apart', () => {
    const a = describeIdleYield({ coins: 0, delight: 0, elapsedMs: 0, cappedAtMs: null });
    const b = describeIdleYield({ coins: 0, delight: 0, elapsedMs: 20_000, cappedAtMs: null });
    expect(a).toBe(b);
  });

  it('does not call an hour and a half an hour', () => {
    const line = (ms: number) => describeIdleYield({ coins: 30, delight: 7, elapsedMs: ms, cappedAtMs: null });
    expect(line(70 * MINUTE)).toContain('an hour;');
    expect(line(95 * MINUTE)).toContain('an hour and a half');
    expect(line(115 * MINUTE)).toContain('two hours');
    // The whole-hours bucket must never round back down to one, or the line
    // after "an hour and a half" would be "one hour".
    for (let m = 110; m < 22 * 60; m += 7) {
      expect(describeIdleYield({ coins: 1, delight: 0, elapsedMs: m * MINUTE, cappedAtMs: null })).not.toMatch(
        /away one hours/
      );
    }
  });

  it('does not claim the case was full "some time before" when it filled a moment ago', () => {
    const cap = DEFAULT_IDLE_OPTIONS.capMs;
    const justOver = describeIdleYield({ coins: 58, delight: 14, elapsedMs: cap + 1, cappedAtMs: cap });
    expect(justOver).not.toContain('full');
    const wellOver = describeIdleYield({ coins: 58, delight: 14, elapsedMs: cap + 3 * HOUR, cappedAtMs: cap });
    expect(wellOver).toContain('full');
  });

  it('does not describe coins in a case it has just called empty', () => {
    // Unreachable with the default rates, reachable with a caller's, and the
    // sentence has to hold either way.
    for (const delight of [1, 5, 10, 40]) {
      const line = describeIdleYield({ coins: 0, delight, elapsedMs: 3 * HOUR, cappedAtMs: null });
      expect(line).toContain('much as you left it');
      expect(line).not.toContain('coin');
    }
  });

  it('agrees with itself about singular and plural', () => {
    expect(describeIdleYield({ coins: 1, delight: 0, elapsedMs: 5 * MINUTE, cappedAtMs: null })).toContain(
      'a single coin'
    );
    expect(describeIdleYield({ coins: 2, delight: 0, elapsedMs: 5 * MINUTE, cappedAtMs: null })).toContain(
      'two coins'
    );
  });

  it('survives a yield built from junk without throwing or leaking it', () => {
    const junk = { coins: Number.NaN, delight: -3, elapsedMs: Number.NaN, cappedAtMs: null } as IdleYield;
    const line = describeIdleYield(junk);
    expect(line.endsWith('.')).toBe(true);
    expect(line).not.toMatch(/undefined|NaN/);
  });

  it('describes real yields from idleYield end to end', () => {
    for (const h of [0.01, 0.5, 1, 3, 8, 24, 24 * 90]) {
      const line = describeIdleYield(after(h * HOUR));
      expect(line.endsWith('.')).toBe(true);
      expect(line).not.toMatch(/undefined|NaN/);
    }
  });
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function installStorage(impl: Partial<Storage> | 'throws-on-access' | null): void {
  if (impl === null) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    return;
  }
  if (impl === 'throws-on-access') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is disabled');
      },
    });
    return;
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: impl });
}

function memoryStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    length: 0,
    clear: () => map.clear(),
    key: () => null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage & { map: Map<string, string> };
}

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
});

describe('saveIdle / loadIdle', () => {
  it('round-trips a state', () => {
    installStorage(memoryStorage());
    saveIdle({ since: T0, instrumentId: 'lute', quality: 0.75 }, T0 + 1000);
    expect(loadIdle()).toEqual({ since: T0, instrumentId: 'lute', quality: 0.75 });
  });

  it('clamps a `since` from the future down to now, so no record can pay for time that has not happened', () => {
    installStorage(memoryStorage());
    saveIdle({ since: T0 + 5 * HOUR, instrumentId: 'lute', quality: 1 }, T0);
    expect(loadIdle()?.since).toBe(T0);
  });

  it('clamps quality on the way in', () => {
    installStorage(memoryStorage());
    saveIdle({ since: T0, instrumentId: 'lute', quality: 4 }, T0);
    expect(loadIdle()?.quality).toBe(1);
  });

  it('clears the record when passed null', () => {
    const store = memoryStorage();
    installStorage(store);
    saveIdle({ since: T0, instrumentId: 'lute', quality: 1 }, T0);
    saveIdle(null, T0);
    expect(store.map.has(IDLE_STORAGE_KEY)).toBe(false);
    expect(loadIdle()).toBeNull();
  });

  it('returns null when there is nothing stored', () => {
    installStorage(memoryStorage());
    expect(loadIdle()).toBeNull();
  });

  it('returns null for unparseable JSON', () => {
    const store = memoryStorage();
    installStorage(store);
    store.map.set(IDLE_STORAGE_KEY, '{"v":1,"since":17000000');
    expect(loadIdle()).toBeNull();
  });

  it('returns null for a record from another version', () => {
    const store = memoryStorage();
    installStorage(store);
    store.map.set(IDLE_STORAGE_KEY, JSON.stringify({ v: 2, since: T0, i: 'lute', q: 1 }));
    expect(loadIdle()).toBeNull();
  });

  it('returns null for a partial record rather than a state full of holes', () => {
    const store = memoryStorage();
    installStorage(store);
    for (const payload of [
      '{}',
      'null',
      '[]',
      '"lute"',
      JSON.stringify({ v: 1, i: 'lute', q: 1 }),
      JSON.stringify({ v: 1, since: 'yesterday', i: 'lute', q: 1 }),
      JSON.stringify({ v: 1, since: T0, q: 1 }),
      JSON.stringify({ v: 1, since: null, i: 'lute', q: 1 }),
    ]) {
      store.map.set(IDLE_STORAGE_KEY, payload);
      expect(loadIdle()).toBeNull();
    }
  });

  it('fills in a missing quality instead of discarding an otherwise good record', () => {
    const store = memoryStorage();
    installStorage(store);
    store.map.set(IDLE_STORAGE_KEY, JSON.stringify({ v: 1, since: T0, i: 'lute' }));
    expect(loadIdle()).toEqual({ since: T0, instrumentId: 'lute', quality: 0 });
  });

  it('degrades to no idle progress when there is no storage at all', () => {
    installStorage(null);
    expect(() => saveIdle({ since: T0, instrumentId: 'lute', quality: 1 }, T0)).not.toThrow();
    expect(loadIdle()).toBeNull();
  });

  it('degrades quietly when reading throws', () => {
    const store = memoryStorage();
    installStorage({ ...store, getItem: () => {
      throw new Error('SecurityError');
    } });
    expect(() => loadIdle()).not.toThrow();
    expect(loadIdle()).toBeNull();
  });

  it('degrades quietly when writing throws, as Safari private mode does', () => {
    const store = memoryStorage();
    installStorage({ ...store, setItem: () => {
      throw new Error('QuotaExceededError');
    } });
    expect(() => saveIdle({ since: T0, instrumentId: 'lute', quality: 1 }, T0)).not.toThrow();
  });

  it('degrades quietly when touching localStorage at all throws', () => {
    installStorage('throws-on-access');
    expect(() => saveIdle({ since: T0, instrumentId: 'lute', quality: 1 }, T0)).not.toThrow();
    expect(loadIdle()).toBeNull();
  });

  it('a loaded state pays out the same as the one that was saved', () => {
    installStorage(memoryStorage());
    saveIdle({ since: T0, instrumentId: 'lute', quality: 0.5 }, T0);
    const loaded = loadIdle();
    expect(loaded).not.toBeNull();
    expect(idleYield(loaded as IdleState, T0 + 3 * HOUR).coins).toBe(
      idleYield({ since: T0, instrumentId: 'lute', quality: 0.5 }, T0 + 3 * HOUR).coins
    );
  });
});
