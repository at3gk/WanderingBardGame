import { describe, expect, it } from 'vitest';
import { noteNameAt, staffStepAt } from './notation';
import { songLengthBeats } from './song';
import { SONGS, SONGS_BY_BIOME, songForBiome } from './songs';

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
  it('never repeats a song across the whole book', () => {
    const ids = SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every biome a set to rotate through', () => {
    for (const [biome, set] of Object.entries(SONGS_BY_BIOME)) {
      expect(set.length, `${biome} set`).toBeGreaterThanOrEqual(2);
    }
  });

  it('walks up the staff across the biomes, low to high', () => {
    const lowest = (id: string) =>
      Math.min(...SONGS_BY_BIOME[id].flatMap((s) => s.notes.map((n) => staffStepAt(n.semitone)!)));
    expect(lowest('village')).toBeLessThan(lowest('forest'));
    expect(lowest('forest')).toBeLessThan(lowest('riverside'));
  });

  it('keeps every song in a biome inside the same region of the staff', () => {
    // Rotation must not smuggle a low tune into the upper-staff vignette;
    // the curriculum is the point of the biome split.
    for (const [biome, set] of Object.entries(SONGS_BY_BIOME)) {
      const lows = set.map((s) => Math.min(...s.notes.map((n) => staffStepAt(n.semitone)!)));
      expect(Math.max(...lows) - Math.min(...lows), `${biome} spread`).toBeLessThanOrEqual(4);
    }
  });

  it('rotates through a biome\'s set pass by pass, and wraps', () => {
    expect(songForBiome('village', 0).id).toBe('mary');
    expect(songForBiome('village', 1).id).toBe('buns');
    expect(songForBiome('village', 2).id).toBe('mary');
    expect(songForBiome('village', -1).id).toBe('buns');
  });

  it('falls back to the village set for an unknown biome', () => {
    expect(songForBiome('nowhere').id).toBe('mary');
  });
});
