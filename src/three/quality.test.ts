import { describe, expect, it } from 'vitest';
import { detectQuality, tierFor, type CapabilityProbe } from './App';

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
});
