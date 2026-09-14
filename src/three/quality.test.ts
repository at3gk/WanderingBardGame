import { afterEach, describe, expect, it } from 'vitest';
import {
  detectQuality,
  loadQualityOverride,
  QUALITY_OVERRIDE_KEY,
  saveQualityOverride,
  tierFor,
  type CapabilityProbe,
} from './App';

// ---------------------------------------------------------------------------
// Storage stubbing — the same shape as scaffoldStorage.test.ts / keepsake.test.ts
// ---------------------------------------------------------------------------

function installStorage(impl: Partial<Storage> | null): void {
  if (impl === null) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
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

/**
 * Task 174: the tier decision, one test per device family. The old rule
 * read Chromium-only deviceMemory with a default that made every iPad
 * 'medium' and left 'low' unreachable on Apple hardware entirely.
 */

const base: CapabilityProbe = {
  dpr: 2,
  cores: 8,
  memory: null,
  coarse: true,
  userAgent: '',
  maxTouchPoints: 5,
  hasWebGPU: false,
};

const UA = {
  oldIpad:
    'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
  newIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  oldIpadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  androidBudget:
    'Mozilla/5.0 (Linux; Android 11; SM-A115F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

describe('tierFor', () => {
  it('sends an old iPad to low — the family the old default stranded on medium', () => {
    expect(tierFor({ ...base, userAgent: UA.oldIpad, cores: 2 })).toBe('low');
  });

  it('keeps a modern iPhone and a masquerading iPad on medium', () => {
    expect(tierFor({ ...base, userAgent: UA.newIphone, hasWebGPU: true })).toBe('medium');
    expect(tierFor({ ...base, userAgent: UA.ipadAsMac, cores: 8 })).toBe('medium');
  });

  it('catches an OLD iPad masquerading as a Mac by its Safari version', () => {
    expect(tierFor({ ...base, userAgent: UA.oldIpadAsMac })).toBe('low');
  });

  it('never mistakes a real Mac for an iPad — no touch points, no Apple-touch path', () => {
    // A real Mac takes the Chromium-style path. Desktop Safari reports no
    // deviceMemory, which the preserved heuristic reads as 4 → medium;
    // that is the pre-task-174 behaviour, deliberately untouched here.
    expect(
      tierFor({ ...base, userAgent: UA.ipadAsMac, coarse: false, maxTouchPoints: 0, cores: 10 }),
    ).toBe('medium');
  });

  it('keeps the Chromium heuristics word for word', () => {
    expect(tierFor({ ...base, userAgent: UA.desktopChrome, coarse: false, maxTouchPoints: 0, memory: 8, cores: 12 })).toBe('high');
    expect(tierFor({ ...base, userAgent: UA.androidBudget, cores: 4, memory: 2 })).toBe('low');
    expect(tierFor({ ...base, userAgent: UA.androidBudget, cores: 8, memory: 6 })).toBe('medium');
    // Absent deviceMemory on a non-Apple engine still reads as 4 — which
    // the `memory <= 4` arm sends to medium, exactly as before this task.
    expect(tierFor({ ...base, userAgent: UA.desktopChrome, coarse: false, maxTouchPoints: 0, cores: 12, memory: null })).toBe('medium');
  });
});

describe('detectQuality', () => {
  it('makes low genuinely low: no shadow map at all', () => {
    const q = detectQuality({ ...base, userAgent: UA.oldIpad, cores: 2 });
    expect(q.tier).toBe('low');
    expect(q.shadows).toBe(false);
    expect(q.shadowMapSize).toBe(0);
  });

  it('leaves medium and high shadowed exactly as before', () => {
    expect(detectQuality({ ...base, userAgent: UA.newIphone }).shadows).toBe(true);
    expect(
      detectQuality({ ...base, userAgent: UA.desktopChrome, coarse: false, maxTouchPoints: 0, memory: 8, cores: 12 }).shadows,
    ).toBe(true);
  });

  it('an explicit override beats the probe entirely', () => {
    // An old iPad would auto-detect to 'low' — a hand override to 'high'
    // wins anyway, per mobile-friendly.md recommendation 6: the toggle is
    // for a human who has actually seen the device run, not a corrective
    // to the probe's own judgment.
    const q = detectQuality({ ...base, userAgent: UA.oldIpad, cores: 2 }, 'high');
    expect(q.tier).toBe('high');
    expect(q.shadows).toBe(true);
  });

  it('a null override (the default, nothing chosen) falls through to the probe', () => {
    expect(detectQuality({ ...base, userAgent: UA.oldIpad, cores: 2 }, null).tier).toBe('low');
  });
});

describe('quality override storage (ROADMAP task 192 piece 1)', () => {
  it('defaults to null with no storage at all', () => {
    installStorage(null);
    expect(loadQualityOverride()).toBeNull();
  });

  it('round-trips a chosen tier', () => {
    installStorage(memoryStorage());
    saveQualityOverride('low');
    expect(loadQualityOverride()).toBe('low');
    saveQualityOverride('high');
    expect(loadQualityOverride()).toBe('high');
  });

  it('clearing the override (null) removes the key rather than storing it', () => {
    const store = memoryStorage();
    installStorage(store);
    saveQualityOverride('medium');
    expect(store.map.has(QUALITY_OVERRIDE_KEY)).toBe(true);
    saveQualityOverride(null);
    expect(store.map.has(QUALITY_OVERRIDE_KEY)).toBe(false);
    expect(loadQualityOverride()).toBeNull();
  });

  it('rejects garbage and a half-written value rather than trusting it', () => {
    const store = memoryStorage();
    installStorage(store);
    store.map.set(QUALITY_OVERRIDE_KEY, 'ultra');
    expect(loadQualityOverride()).toBeNull();
  });

  it('a write that throws (quota, private browsing) is swallowed, not fatal', () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => saveQualityOverride('high')).not.toThrow();
    expect(() => saveQualityOverride(null)).not.toThrow();
  });

  it('detectQuality reads the real stored override by default, with no explicit second argument', () => {
    installStorage(memoryStorage());
    saveQualityOverride('high');
    expect(detectQuality({ ...base, userAgent: UA.oldIpad, cores: 2 }).tier).toBe('high');
  });
});
