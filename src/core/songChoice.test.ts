import { describe, expect, it } from 'vitest';
import { homeBiomeOf, songForPass, songGridLayout, songMenu } from './songChoice';
import { SONGS, SONGS_BY_BIOME } from './songs';

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

  it('knows every song\'s home biome', () => {
    for (const [biomeId, set] of Object.entries(SONGS_BY_BIOME)) {
      for (const song of set) expect(homeBiomeOf(song.id)).toBe(biomeId);
    }
  });

  it('has no home for wandering, or for an unknown song', () => {
    expect(homeBiomeOf(null)).toBeNull();
    expect(homeBiomeOf('nope')).toBeNull();
  });

  it('offers the whole songbook in the picker, in road order', () => {
    const menu = songMenu();
    expect(menu.flatMap((g) => g.songs).length).toBe(SONGS.length);
    expect(menu.map((g) => g.biomeId)).toEqual(Object.keys(SONGS_BY_BIOME));
  });
});

describe('picker layout', () => {
  const COUNT = SONGS.length + 1; // every song, plus "wander"

  it('stacks into one column when there is height for it', () => {
    // 320x568 portrait, the narrowest supported screen.
    const l = songGridLayout(COUNT, 300, 470);
    expect(l.cols).toBe(1);
    expect(l.rows).toBe(COUNT);
  });

  it('spills into columns on a short landscape phone instead of overflowing', () => {
    // 664x390 landscape: twelve stacked rows do not fit, and this is the
    // case the layout exists for.
    const l = songGridLayout(COUNT, 620, 300);
    expect(l.cols).toBeGreaterThan(1);
    expect(l.rows * l.cellH).toBeLessThanOrEqual(300 + 1e-9);
    expect(l.cellH).toBeGreaterThanOrEqual(34);
  });

  it('always has room for every entry', () => {
    for (const [w, h] of [[300, 470], [620, 300], [240, 200], [1200, 500], [280, 120]]) {
      const l = songGridLayout(COUNT, w, h);
      expect(l.cols * l.rows, `${w}x${h}`).toBeGreaterThanOrEqual(COUNT);
    }
  });

  it('never returns a zero or negative cell, however cramped', () => {
    for (const [w, h] of [[10, 10], [1, 1], [300, 20]]) {
      const l = songGridLayout(COUNT, w, h);
      expect(l.cols, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(l.rows, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(l.cellW, `${w}x${h}`).toBeGreaterThan(0);
      expect(l.cellH, `${w}x${h}`).toBeGreaterThan(0);
    }
  });

  it('caps how wide a row gets, so a desktop does not draw one giant button', () => {
    expect(songGridLayout(COUNT, 1400, 600).cellW).toBeLessThanOrEqual(260);
  });
});

describe('Book Two resolution (task 165)', () => {
  it('resolves a pinned Book Two song like any other', () => {
    const bonnie = BOOK_TWO_SONGS[0];
    expect(songForPass(bonnie.id, 'village', 0).id).toBe(bonnie.id);
  });

  it('keeps the rotation itself Book One — wandering never deals a keyed song', () => {
    for (const biome of ['village', 'forest', 'riverside']) {
      for (let pass = 0; pass < 8; pass++) {
        expect(songForPass(null, biome, pass).key).toBeUndefined();
      }
    }
  });

  it('gives a Book Two song no home biome — the road keeps wandering', () => {
    expect(homeBiomeOf(BOOK_TWO_SONGS[0].id)).toBeNull();
  });
});

import { BOOK_TWO_SONGS } from './songs';
