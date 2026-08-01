import { afterEach, describe, expect, it } from 'vitest';
import { IDLE_STORAGE_KEY } from './idle';
import { JOURNEY_STORAGE_KEY } from './journey';
import { KEEPSAKE_FILENAME, exportKeepsake, importKeepsake } from './keepsake';

/** Private to `scaffoldStorage.ts`, repeated here for the same reason `keepsake.ts` repeats it. */
const LEARN_KEY = 'wb.learn.v1';

const NOW = 1_785_000_000_000;

// ---------------------------------------------------------------------------
// Storage stubbing — the same shape as journey.test.ts
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

// ---------------------------------------------------------------------------
// Realistic records, in the shapes the three loaders actually write
// ---------------------------------------------------------------------------

const JOURNEY_RECORD = {
  v: 1,
  day: '2026-07-28',
  phase: 'walking',
  s: 412.5,
  f: 0.34,
  coins: 12,
  delight: 3,
  instrument: 'bells',
  unlocked: ['lute', 'bells'],
  song: 'lavenders-blue',
  visited: ['mill', 'ford'],
  metres: 8400.5,
  earned: 216,
  encounters: 9,
  campfires: 4,
  journal: [[120.5, 0.2, 'busk', 'You played at the mill and someone clapped.']],
};

const LEARN_RECORD = {
  v: 1,
  t: NOW - 86_400_000,
  p: { '0': [0.8, 0.9, 2], '4': [0.3, 0.55, 1] },
  s: 'lavenders-blue',
};

const IDLE_RECORD = { v: 1, since: NOW - 3_600_000, i: 'bells', q: 0.72 };

function seedAll(): Storage & { map: Map<string, string> } {
  const store = memoryStorage();
  store.map.set(JOURNEY_STORAGE_KEY, JSON.stringify(JOURNEY_RECORD));
  store.map.set(LEARN_KEY, JSON.stringify(LEARN_RECORD));
  store.map.set(IDLE_STORAGE_KEY, JSON.stringify(IDLE_RECORD));
  installStorage(store);
  return store;
}

function keepsake(records: unknown, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ kind: 'wandering-bard-keepsake', v: 1, t: NOW, records, ...overrides });
}

// ---------------------------------------------------------------------------

describe('exportKeepsake', () => {
  it('names the file something a person can find again', () => {
    expect(KEEPSAKE_FILENAME).toBe('wandering-bard-keepsake.json');
  });

  it('carries the kind, the version and the moment it was made', () => {
    seedAll();
    const text = exportKeepsake(NOW);
    expect(text).not.toBeNull();
    const parsed = JSON.parse(text as string);
    expect(parsed.kind).toBe('wandering-bard-keepsake');
    expect(parsed.v).toBe(1);
    expect(parsed.t).toBe(NOW);
  });

  it('is human-readable, because a family is asked to keep it', () => {
    seedAll();
    expect(exportKeepsake(NOW)).toContain('\n  "kind"');
  });

  it('includes only the keys that are actually present', () => {
    const store = memoryStorage();
    store.map.set(IDLE_STORAGE_KEY, JSON.stringify(IDLE_RECORD));
    installStorage(store);

    const parsed = JSON.parse(exportKeepsake(NOW) as string);
    expect(Object.keys(parsed.records)).toEqual([IDLE_STORAGE_KEY]);
    expect(parsed.records[IDLE_STORAGE_KEY]).toEqual(IDLE_RECORD);
  });

  it('returns null when there is no storage at all', () => {
    installStorage(null);
    expect(exportKeepsake(NOW)).toBeNull();
  });

  it('returns null when touching storage throws', () => {
    installStorage('throws-on-access');
    expect(exportKeepsake(NOW)).toBeNull();
  });

  it('returns null when nothing has been saved yet', () => {
    installStorage(memoryStorage());
    expect(exportKeepsake(NOW)).toBeNull();
  });

  it('skips a corrupt record and still keeps the healthy ones', () => {
    const store = seedAll();
    store.map.set(LEARN_KEY, '{ not json at all');

    const parsed = JSON.parse(exportKeepsake(NOW) as string);
    expect(Object.keys(parsed.records).sort()).toEqual([IDLE_STORAGE_KEY, JOURNEY_STORAGE_KEY].sort());
    expect(parsed.records[JOURNEY_STORAGE_KEY]).toEqual(JOURNEY_RECORD);
  });
});

describe('importKeepsake', () => {
  it('round-trips the whole save through a wipe', () => {
    seedAll();
    const text = exportKeepsake(NOW);
    expect(text).not.toBeNull();

    // The eviction: everything the game had is gone.
    const wiped = memoryStorage();
    installStorage(wiped);
    expect(exportKeepsake(NOW)).toBeNull();

    expect(importKeepsake(text as string)).toBe('restored');

    // Compare parsed, not raw: key order through JSON is not a promise.
    expect(JSON.parse(wiped.map.get(JOURNEY_STORAGE_KEY) as string)).toEqual(JOURNEY_RECORD);
    expect(JSON.parse(wiped.map.get(LEARN_KEY) as string)).toEqual(LEARN_RECORD);
    expect(JSON.parse(wiped.map.get(IDLE_STORAGE_KEY) as string)).toEqual(IDLE_RECORD);
  });

  it('calls garbage unreadable', () => {
    installStorage(memoryStorage());
    expect(importKeepsake('this is a shopping list')).toBe('unreadable');
    expect(importKeepsake('')).toBe('unreadable');
  });

  it('calls valid JSON of the wrong kind unreadable', () => {
    installStorage(memoryStorage());
    expect(importKeepsake(JSON.stringify({ kind: 'someone-elses-save', v: 1, records: {} }))).toBe(
      'unreadable'
    );
    expect(importKeepsake(JSON.stringify([1, 2, 3]))).toBe('unreadable');
    expect(importKeepsake('null')).toBe('unreadable');
  });

  it('refuses a version it does not know', () => {
    installStorage(memoryStorage());
    expect(importKeepsake(keepsake({ [IDLE_STORAGE_KEY]: IDLE_RECORD }, { v: 2 }))).toBe('unreadable');
  });

  it('calls a keepsake with no records nothing-inside', () => {
    installStorage(memoryStorage());
    expect(importKeepsake(keepsake({}))).toBe('nothing-inside');
    expect(importKeepsake(keepsake([]))).toBe('unreadable');
  });

  it('ignores keys it does not own', () => {
    const store = memoryStorage();
    installStorage(store);

    const result = importKeepsake(
      keepsake({ 'evil.token': { admin: true }, 'wb.something.else': { a: 1 } })
    );

    expect(result).toBe('nothing-inside');
    expect(store.map.has('evil.token')).toBe(false);
    expect(store.map.has('wb.something.else')).toBe(false);
    expect(store.map.size).toBe(0);
  });

  it('drops a known key whose record is not an object', () => {
    const store = memoryStorage();
    installStorage(store);

    const result = importKeepsake(
      keepsake({
        [JOURNEY_STORAGE_KEY]: 'a string pretending to be a save',
        [LEARN_KEY]: [1, 2, 3],
        [IDLE_STORAGE_KEY]: IDLE_RECORD,
      })
    );

    expect(result).toBe('restored');
    expect(store.map.has(JOURNEY_STORAGE_KEY)).toBe(false);
    expect(store.map.has(LEARN_KEY)).toBe(false);
    expect(JSON.parse(store.map.get(IDLE_STORAGE_KEY) as string)).toEqual(IDLE_RECORD);
  });

  it('does not throw when there is no storage to restore into', () => {
    installStorage(null);
    expect(importKeepsake(keepsake({ [IDLE_STORAGE_KEY]: IDLE_RECORD }))).toBe('nothing-inside');
    installStorage('throws-on-access');
    expect(importKeepsake(keepsake({ [IDLE_STORAGE_KEY]: IDLE_RECORD }))).toBe('nothing-inside');
  });

  it('treats a storage that refuses every write as nothing-inside', () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    } as unknown as Storage);

    expect(importKeepsake(keepsake({ [IDLE_STORAGE_KEY]: IDLE_RECORD }))).toBe('nothing-inside');
  });
});
