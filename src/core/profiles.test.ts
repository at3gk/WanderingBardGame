import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOKMARK_POINTER_KEY,
  activeBookmark,
  bookmarkKey,
  setActiveBookmark,
} from './profiles';

// The node test environment has no localStorage; give it the minimal
// in-memory one the module's own wrapper expects.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('bookmarkKey', () => {
  it('is a byte-for-byte passthrough for bookmark 0', () => {
    // The design's whole safety argument: an existing save is never
    // migrated because bookmark 0 IS the legacy keys.
    expect(bookmarkKey('wb.journey.v1', 0)).toBe('wb.journey.v1');
    expect(bookmarkKey('wb.learn.v1', 0)).toBe('wb.learn.v1');
    expect(bookmarkKey('wb.idle.v1', 0)).toBe('wb.idle.v1');
  });

  it('suffixes bookmark 1 without touching the base', () => {
    expect(bookmarkKey('wb.journey.v1', 1)).toBe('wb.journey.v1.b1');
  });

  it('defaults to the active bookmark', () => {
    setActiveBookmark(1);
    expect(bookmarkKey('wb.learn.v1')).toBe('wb.learn.v1.b1');
    setActiveBookmark(0);
    expect(bookmarkKey('wb.learn.v1')).toBe('wb.learn.v1');
  });
});

describe('activeBookmark', () => {
  it('is 0 when the pointer is absent, garbage, or storage is empty', () => {
    expect(activeBookmark()).toBe(0);
    globalThis.localStorage.setItem(BOOKMARK_POINTER_KEY, 'seventeen');
    expect(activeBookmark()).toBe(0);
  });

  it('round-trips through the pointer', () => {
    setActiveBookmark(1);
    expect(activeBookmark()).toBe(1);
    setActiveBookmark(0);
    expect(activeBookmark()).toBe(0);
  });

  it('choosing 0 REMOVES the pointer rather than writing it', () => {
    // Absent IS bookmark 0: a pre-bookmark build (which never reads the
    // pointer) and a current one must agree about whose save the legacy
    // keys hold.
    setActiveBookmark(1);
    setActiveBookmark(0);
    expect(globalThis.localStorage.getItem(BOOKMARK_POINTER_KEY)).toBeNull();
  });
});
