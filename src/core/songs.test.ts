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
      if (note.rest) continue;
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
      if (note.rest) continue;
      const step = staffStepAt(note.semitone)!;
      // One ledger below middle C through one ledger above the staff.
      expect(step, `semitone ${note.semitone}`).toBeGreaterThanOrEqual(-2);
      expect(step, `semitone ${note.semitone}`).toBeLessThanOrEqual(12);
    }
  });

  it('is long enough to be recognizable as a tune', () => {
    expect(song.notes.filter((n) => !n.rest).length).toBeGreaterThanOrEqual(16);
  });

  it('never opens with a rest — the tune should start when the player does', () => {
    expect(song.notes[0].rest).toBeUndefined();
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
      Math.min(
        ...SONGS_BY_BIOME[id].flatMap((s) => s.notes.filter((n) => !n.rest).map((n) => staffStepAt(n.semitone)!))
      );
    expect(lowest('village')).toBeLessThan(lowest('forest'));
    expect(lowest('forest')).toBeLessThan(lowest('riverside'));
  });

  it('keeps every song in a biome inside the same region of the staff', () => {
    // Rotation must not smuggle a low tune into the upper-staff vignette;
    // the curriculum is the point of the biome split.
    for (const [biome, set] of Object.entries(SONGS_BY_BIOME)) {
      const lows = set.map((s) =>
        Math.min(...s.notes.filter((n) => !n.rest).map((n) => staffStepAt(n.semitone)!))
      );
      expect(Math.max(...lows) - Math.min(...lows), `${biome} spread`).toBeLessThanOrEqual(4);
    }
  });

  it('rotates through a biome\'s set pass by pass, and wraps', () => {
    const set = SONGS_BY_BIOME.village;
    for (let pass = 0; pass < set.length * 2; pass++) {
      expect(songForBiome('village', pass).id).toBe(set[pass % set.length].id);
    }
    // Negative passes shouldn't throw or land off the end.
    expect(songForBiome('village', -1).id).toBe(set[set.length - 1].id);
  });

  it('falls back to the village set for an unknown biome', () => {
    expect(songForBiome('nowhere').id).toBe('mary');
  });

  it('leaves no gap in the beginner treble range — every position gets practice', () => {
    // The learning model (core/scaffold.ts) fades a position's letter as
    // the child meets it. A position that appears in NO song can never be
    // learned, and one that appears in only a handful of notes would sit
    // fully-labelled forever while its neighbours faded — a visibly patchy
    // staff. This is the guard against a future song swap quietly opening
    // such a hole.
    const counts = new Map<number, number>();
    for (const song of SONGS) {
      for (const note of song.notes) {
        if (note.rest) continue;
        const step = staffStepAt(note.semitone)!;
        counts.set(step, (counts.get(step) ?? 0) + 1);
      }
    }
    // Middle C (0) up to A5 (12): one ledger below the staff to one above.
    for (let step = 0; step <= 12; step++) {
      expect(counts.get(step) ?? 0, `staff step ${step} never appears`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Book Two keys (task 165): the rules a keyed song is held to.
//
// No shipped song carries a key yet — the volume-structure piece decides
// where Book Two songs live. These rules bind now, on fixtures, so the
// first real keyed song inherits a working validator instead of writing
// one: notes must be diatonic to the key (the signature does ALL the work
// — a shown accidental is a later, deliberate step), every spelling must
// round-trip to the exact pitch, and the spelt steps must stay on the
// drawable staff.
// ---------------------------------------------------------------------------

import { semitoneOfSpelling, spellInKey } from './notation';
import { songKey, type Song } from './song';

/** The Book Two engraving rules, as one callable check. */
function keyedSongFaults(song: Song): string[] {
  const faults: string[] = [];
  const key = songKey(song);
  if (!key) return [`unknown key '${song.key}'`];
  for (const note of song.notes) {
    if (note.rest) continue;
    const spelt = spellInKey(note.semitone, key);
    if (spelt.shown !== null) {
      faults.push(`semitone ${note.semitone} is not diatonic in '${song.key ?? 'C'}' (shows ${spelt.shown})`);
    }
    if (semitoneOfSpelling(spelt.step, spelt.accidental) !== note.semitone) {
      faults.push(`semitone ${note.semitone} does not round-trip`);
    }
    if (spelt.step < -2 || spelt.step > 12) {
      faults.push(`semitone ${note.semitone} spells off the drawable staff (step ${spelt.step})`);
    }
  }
  return faults;
}

describe('Book Two keys', () => {
  const inG: Song = {
    id: 'fixture-g',
    title: 'Fixture in G',
    beatsPerBar: 4,
    key: 'G',
    // G4 A4 B4 F#4 | G4 D5 B4 G4 — diatonic in G, F# through the signature.
    notes: [7, 9, 11, 6, 7, 14, 11, 7].map((semitone) => ({ semitone, beats: 1 })),
  };

  it('resolves keys: absent is C major, unknown is a caught bug', () => {
    expect(songKey({ ...inG, key: undefined })).toEqual({ fifths: 0 });
    expect(songKey(inG)).toEqual({ fifths: 1 });
    expect(songKey({ ...inG, key: 'H' })).toBeNull();
    expect(keyedSongFaults({ ...inG, key: 'H' })).toEqual(["unknown key 'H'"]);
  });

  it('accepts a diatonic keyed song whole', () => {
    expect(keyedSongFaults(inG)).toEqual([]);
  });

  it('rejects a chromatic note — the signature must do all the work', () => {
    const chromatic = { ...inG, notes: [...inG.notes, { semitone: 8, beats: 1 }] };
    expect(keyedSongFaults(chromatic).some((f) => f.includes('not diatonic'))).toBe(true);
    // And F natural in G would need its cancelling sign — equally not yet allowed.
    const cancelled = { ...inG, notes: [...inG.notes, { semitone: 5, beats: 1 }] };
    expect(keyedSongFaults(cancelled).some((f) => f.includes('not diatonic'))).toBe(true);
  });

  it('rejects a spelt note off the drawable staff', () => {
    const low = { ...inG, notes: [{ semitone: -10, beats: 1 }] };
    expect(keyedSongFaults(low).some((f) => f.includes('off the drawable staff'))).toBe(true);
  });

  it('holds every shipped keyed song to the rules (none ship yet — Book One is keyless on purpose)', () => {
    for (const song of SONGS) {
      expect(song.key, `${song.title} carries a key before the volume structure exists`).toBeUndefined();
    }
    for (const song of SONGS.filter((s) => s.key !== undefined)) {
      expect(keyedSongFaults(song)).toEqual([]);
    }
  });
});
