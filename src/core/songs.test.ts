import { describe, expect, it } from 'vitest';
import { noteNameAt, staffStepAt } from './notation';
import { songLengthBeats } from './song';
import { SONG_BY_BIOME, SONGS, songForBiome } from './songs';

/**
 * These are engraving checks, not style checks. Kids read this screen, so a
 * transcription bug (an accidental, a bar that doesn't add up, a note that
 * runs over a bar line, a pitch off the staff) is a correctness bug — see
 * DESIGN.md Pedagogy, "the notation is never allowed to be wrong".
 */

// Quarter, half, whole, eighth, dotted quarter, dotted half.
const LEGAL_DURATIONS = [0.5, 1, 1.5, 2, 3, 4];

describe.each(SONGS)('song: $title', (song) => {
  it('uses only natural notes — every note has a one-letter name', () => {
    for (const note of song.notes) {
      expect(noteNameAt(note.semitone), `semitone ${note.semitone}`).not.toBeNull();
    }
  });

  it('uses only writable note values', () => {
    for (const note of song.notes) {
      expect(LEGAL_DURATIONS, `semitone ${note.semitone}`).toContain(note.beats);
    }
  });

  it('fills whole bars', () => {
    expect(songLengthBeats(song) % song.beatsPerBar).toBe(0);
  });

  it('never runs a note over a bar line (it would need a tie)', () => {
    let cursor = 0;
    for (const note of song.notes) {
      const startBar = Math.floor(cursor / song.beatsPerBar);
      const endBar = Math.floor((cursor + note.beats - 1e-9) / song.beatsPerBar);
      expect(endBar, `note at beat ${cursor} spans bars`).toBe(startBar);
      cursor += note.beats;
    }
  });

  it('stays in a range the staff can draw legibly', () => {
    for (const note of song.notes) {
      const step = staffStepAt(note.semitone)!;
      // One ledger below middle C through one ledger above the staff.
      expect(step, `semitone ${note.semitone}`).toBeGreaterThanOrEqual(-2);
      expect(step, `semitone ${note.semitone}`).toBeLessThanOrEqual(12);
    }
  });

  it('is long enough to be recognizable as a tune', () => {
    expect(song.notes.length).toBeGreaterThanOrEqual(16);
  });
});

describe('the songbook', () => {
  it('gives every biome its own distinct song', () => {
    const ids = Object.values(SONG_BY_BIOME).map((s) => s.id);
    expect(ids).toEqual(['mary', 'twinkle', 'ode']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('walks up the staff across the biomes, low to high', () => {
    const lowest = (id: string) => Math.min(...SONG_BY_BIOME[id].notes.map((n) => staffStepAt(n.semitone)!));
    expect(lowest('village')).toBeLessThan(lowest('forest'));
    expect(lowest('forest')).toBeLessThan(lowest('riverside'));
  });

  it('falls back to the village tune for an unknown biome', () => {
    expect(songForBiome('nowhere').id).toBe('mary');
  });
});
