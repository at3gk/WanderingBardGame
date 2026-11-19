import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { songForPass } from './songChoice';
import { SONGS_BY_BIOME } from './songs';
import { MIN_CUSTOM_SONG_NOTES, saveCustomSong } from './customSongs';

// Same in-memory localStorage stub customSongs.test.ts uses — the node test
// environment has none.
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

/** Sixteen quarter notes, in range, filling exactly 4 bars of 4/4 — a minimal valid tune (same shape customSongs.test.ts uses). */
function validSteps(): number[] {
  const steps: number[] = [];
  for (let i = 0; i < MIN_CUSTOM_SONG_NOTES; i++) steps.push(i % 8);
  return steps;
}

describe('choosing one song to learn', () => {
  it('plays the chosen song on every pass, whatever the biome says', () => {
    // The whole point: repetition is how the letters come off its notes.
    for (let pass = 0; pass < 6; pass++) {
      for (const biomeId of Object.keys(SONGS_BY_BIOME)) {
        expect(songForPass('twinkle', biomeId, pass).id).toBe('twinkle');
      }
    }
  });

  it('wanders when nothing is chosen — the original rotation, untouched', () => {
    const village = SONGS_BY_BIOME.village;
    for (let pass = 0; pass < village.length * 2; pass++) {
      expect(songForPass(null, 'village', pass).id).toBe(village[pass % village.length].id);
    }
  });

  it('falls back to wandering for a song id that no longer exists', () => {
    // A saved choice outlives the songbook; dropping a song must not brick
    // a returning child's game.
    expect(songForPass('a-song-that-was-cut', 'village', 0).id).toBe(SONGS_BY_BIOME.village[0].id);
  });
});

describe('Book Two resolution (task 165)', () => {
  it('resolves a pinned Book Two song like any other, in every biome the road passes', () => {
    const bonnie = BOOK_TWO_SONGS[0];
    for (const biomeId of Object.keys(SONGS_BY_BIOME)) {
      expect(songForPass(bonnie.id, biomeId, 0).id).toBe(bonnie.id);
    }
  });

  it('keeps the rotation itself Book One — wandering never deals a keyed song', () => {
    for (const biome of ['village', 'forest', 'riverside']) {
      for (let pass = 0; pass < 8; pass++) {
        expect(songForPass(null, biome, pass).key).toBeUndefined();
      }
    }
  });
});

describe('a family\'s own song resolves too (task 176)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('plays a saved custom song on every pass, whatever the biome says', () => {
    const result = saveCustomSong('Test Tune', validSteps());
    if ('error' in result) throw new Error(result.error);
    for (const biomeId of Object.keys(SONGS_BY_BIOME)) {
      expect(songForPass(result.song.id, biomeId, 0).id).toBe(result.song.id);
    }
  });

  it('falls back to wandering for a custom id that is no longer saved', () => {
    expect(songForPass('custom:gone', 'village', 0).id).toBe(SONGS_BY_BIOME.village[0].id);
  });

});

import { BOOK_TWO_SONGS } from './songs';
