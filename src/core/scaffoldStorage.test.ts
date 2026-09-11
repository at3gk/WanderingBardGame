import { afterEach, describe, expect, it } from 'vitest';
import { createScaffold } from './scaffold';
import { currentLabelStyle, loadScaffold, saveScaffold, setLabelStyle } from './scaffoldStorage';

/** Private to `scaffoldStorage.ts`, repeated here for the same reason `keepsake.test.ts` does. */
const LEARN_KEY = 'wb.learn.v1';

const NOW = 1_785_000_000_000;

// ---------------------------------------------------------------------------
// Storage stubbing — the same shape as keepsake.test.ts / journey.test.ts
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

describe('label style (ROADMAP task 191 piece 2a)', () => {
  it('defaults to letter with no storage at all', () => {
    installStorage(null);
    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('letter');
  });

  it('defaults to letter for a record with no l field', () => {
    const store = memoryStorage();
    store.map.set(LEARN_KEY, JSON.stringify({ v: 1, t: NOW, p: {} }));
    installStorage(store);
    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('letter');
  });

  it('rejects a garbage l value as letter', () => {
    const store = memoryStorage();
    store.map.set(LEARN_KEY, JSON.stringify({ v: 1, t: NOW, p: {}, l: 'nonsense' }));
    installStorage(store);
    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('letter');
  });

  it('round-trips solfege through save and load', () => {
    const store = memoryStorage();
    installStorage(store);
    const state = loadScaffold(NOW);

    setLabelStyle('solfege', state);
    expect(currentLabelStyle()).toBe('solfege');

    const raw = JSON.parse(store.map.get(LEARN_KEY) as string);
    expect(raw.l).toBe('solfege');

    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('solfege');
  });

  it('a fresh load does not inherit a previous load’s style', () => {
    const solfegeStore = memoryStorage();
    solfegeStore.map.set(LEARN_KEY, JSON.stringify({ v: 1, t: NOW, p: {}, l: 'solfege' }));
    installStorage(solfegeStore);
    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('solfege');

    installStorage(null);
    loadScaffold(NOW);
    expect(currentLabelStyle()).toBe('letter');
  });

  it('omits the l field entirely when the style is letter', () => {
    const store = memoryStorage();
    installStorage(store);
    const state = createScaffold();
    saveScaffold(state, true, NOW);

    const raw = JSON.parse(store.map.get(LEARN_KEY) as string);
    expect(raw.l).toBeUndefined();
  });
});
