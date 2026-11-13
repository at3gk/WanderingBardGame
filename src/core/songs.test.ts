import { describe, expect, it } from 'vitest';
import { noteNameAt, staffStepAt } from './notation';
import { songLengthBeats } from './song';
import { BOOK_TWO_SONGS, SONGS, SONGS_BY_BIOME, songForBiome } from './songs';

/**
 * These are engraving checks, not style checks. Kids read this screen, so a
 * transcription bug (an accidental, a bar that doesn't add up, a note that
 * runs over a bar line, a pitch off the staff) is a correctness bug — see
 * DESIGN.md Pedagogy, "the notation is never allowed to be wrong".
 */

// Quarter, half, whole, eighth, dotted quarter, dotted half.
const LEGAL_DURATIONS = [0.5, 1, 1.5, 2, 3, 4];

describe.each([...SONGS, ...BOOK_TWO_SONGS])('song: $title', (song) => {
  it('spells cleanly: naturals-only in Book One, diatonic to the key in Book Two', () => {
    const key = song.key === undefined ? null : majorKey(song.key);
    for (const note of song.notes) {
      if (note.rest) continue;
      if (key === null) {
        expect(noteNameAt(note.semitone), `semitone ${note.semitone}`).not.toBeNull();
      } else {
        // The signature does all the work — no shown accidental, ever.
        expect(spellInKey(note.semitone, key).shown, `semitone ${note.semitone}`).toBeNull();
      }
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
    // The bar grid starts a pickup early (anacrusis — see Song.pickupBeats):
    // an upbeat note lives in its own partial bar before beat zero. Every
    // Book One song has no pickup, so this is the old arithmetic for them.
    let cursor = -(song.pickupBeats ?? 0);
    for (const note of song.notes) {
      // `+ 0` folds Math.floor's -0 into 0 — toBe is Object.is, which tells them apart.
      const startBar = Math.floor(cursor / song.beatsPerBar) + 0;
      const endBar = Math.floor((cursor + note.beats - 1e-9) / song.beatsPerBar) + 0;
      expect(endBar, `note at beat ${cursor} spans bars`).toBe(startBar);
      cursor += note.beats;
    }
  });

  it('stays in a range the staff can draw legibly', () => {
    const key = song.key === undefined ? null : majorKey(song.key);
    for (const note of song.notes) {
      if (note.rest) continue;
      const step = key === null ? staffStepAt(note.semitone)! : spellInKey(note.semitone, key).step;
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

import { keyDisplayName, majorKey, semitoneOfSpelling, spellInKey } from './notation';
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

  it('keeps Book One keyless and holds every Book Two song to the keyed rules', () => {
    for (const song of SONGS) {
      expect(song.key, `${song.title} carries a key inside Book One`).toBeUndefined();
    }
    for (const song of BOOK_TWO_SONGS) {
      expect(song.key, `${song.title} is in Book Two without a key`).toBeDefined();
      expect(keyedSongFaults(song)).toEqual([]);
    }
  });

  it('keeps a pickup smaller than the bar, and the loop seam bar-true', () => {
    for (const song of [...SONGS, ...BOOK_TWO_SONGS]) {
      const pickup = song.pickupBeats ?? 0;
      expect(pickup).toBeGreaterThanOrEqual(0);
      expect(pickup).toBeLessThan(song.beatsPerBar);
    }
    // My Bonnie's closing bar is short by exactly its pickup, so a looping
    // pass hands the upbeat back — total length stays whole-bar divisible.
    const bonnie = BOOK_TWO_SONGS.find((s) => s.id === 'my-bonnie')!;
    expect(bonnie.pickupBeats).toBe(1);
    expect(bonnie.notes.reduce((t, n) => t + n.beats, 0) % bonnie.beatsPerBar).toBe(0);
  });

  it('holds Yankee Doodle to the lesson too: F sharp always resolving up to G', () => {
    const yankee = BOOK_TWO_SONGS.find((s) => s.id === 'yankee-doodle')!;
    expect(yankee.key).toBe('G');
    const pitched = yankee.notes.filter((n) => !n.rest);
    const sharps = pitched.flatMap((n, i) => (n.semitone === 6 ? [i] : []));
    expect(sharps.length).toBeGreaterThanOrEqual(2);
    // Every F sharp is followed, sooner or later in its phrase, by a G —
    // the leading tone leads. Checked as: the next note above F sharp is G.
    for (const i of sharps) {
      const nextUp = pitched.slice(i + 1).find((n) => n.semitone > 6);
      expect(nextUp?.semitone, `F sharp at note ${i}`).toBe(7);
    }
    // A shelf of distinct tunes, never a duplicate id.
    expect(new Set(BOOK_TWO_SONGS.map((s) => s.id)).size).toBe(BOOK_TWO_SONGS.length);
  });

  it('opens the flat side with Clementine: B flat through the signature, always falling to A', () => {
    const clem = BOOK_TWO_SONGS.find((s) => s.id === 'clementine')!;
    expect(songKey(clem)).toEqual({ fifths: -1 });
    const key = songKey(clem)!;
    const pitched = clem.notes.filter((n) => !n.rest);
    const flats = pitched.flatMap((n, i) => (n.semitone === 10 ? [i] : []));
    expect(flats.length).toBeGreaterThanOrEqual(2);
    for (const i of flats) {
      // Spelt as a B carrying a flat that the signature already shows.
      const spelt = spellInKey(10, key);
      expect([spelt.letter, spelt.accidental, spelt.shown]).toEqual(['B', 'flat', null]);
      // Fa falls to mi: the next different pitch after B flat is A.
      const next = pitched.slice(i + 1).find((n) => n.semitone !== 10);
      expect(next?.semitone, `B flat at note ${i}`).toBe(9);
    }
    // The upbeat loops back: the closing bar is short by exactly the pickup.
    expect(clem.pickupBeats).toBe(1);
    expect(clem.notes.reduce((t, n) => t + n.beats, 0) % clem.beatsPerBar).toBe(0);
  });

  it('turns one more sharp with Good King Wenceslas: C sharp always stepping up to D', () => {
    const wence = BOOK_TWO_SONGS.find((s) => s.id === 'good-king-wenceslas')!;
    expect(songKey(wence)).toEqual({ fifths: 2 });
    const key = songKey(wence)!;
    const pitched = wence.notes.filter((n) => !n.rest);
    const sharps = pitched.flatMap((n, i) => (n.semitone === 13 ? [i] : []));
    expect(sharps.length).toBeGreaterThanOrEqual(3);
    for (const i of sharps) {
      // A C carrying the signature's second sharp, nothing drawn by the head.
      const spelt = spellInKey(13, key);
      expect([spelt.letter, spelt.accidental, spelt.shown]).toEqual(['C', 'sharp', null]);
      // The leading tone leads: the very next note is the tonic D.
      expect(pitched[i + 1]?.semitone, `C sharp at note ${i}`).toBe(14);
    }
    // The F sharp the signature also carries is really sung, not decoration.
    expect(pitched.some((n) => n.semitone === 18)).toBe(true);
    // No pickup: it starts on the downbeat, and ends on the tonic.
    expect(wence.pickupBeats ?? 0).toBe(0);
    expect(pitched[pitched.length - 1].semitone).toBe(14);
  });

  it('reaches two flats with When the Saints: a home note that carries a flat', () => {
    const saints = BOOK_TWO_SONGS.find((s) => s.id === 'when-the-saints')!;
    expect(songKey(saints)).toEqual({ fifths: -2 });
    const key = songKey(saints)!;
    const pitched = saints.notes.filter((n) => !n.rest);
    // The tonic is B flat — spelt through the signature, nothing by the head.
    const tonic = spellInKey(10, key);
    expect([tonic.letter, tonic.accidental, tonic.shown]).toEqual(['B', 'flat', null]);
    expect(pitched[0].semitone).toBe(10);
    expect(pitched[pitched.length - 1].semitone).toBe(10);
    // The second flat is really sung, and spelt as an E the signature flattens.
    const eFlat = spellInKey(15, key);
    expect([eFlat.letter, eFlat.accidental, eFlat.shown]).toEqual(['E', 'flat', null]);
    expect(pitched.filter((n) => n.semitone === 15).length).toBeGreaterThanOrEqual(3);
    // Three-beat pickup; the breath bar is short by exactly that, so the loop is bar-true.
    expect(saints.pickupBeats).toBe(3);
    expect(saints.notes[saints.notes.length - 1].rest).toBe(true);
    expect(saints.notes.reduce((t, n) => t + n.beats, 0) % saints.beatsPerBar).toBe(0);
  });

  it('reaches three sharps with Oh! Susanna: C sharp and F sharp sung, G sharp only in the signature', () => {
    const sus = BOOK_TWO_SONGS.find((s) => s.id === 'oh-susanna')!;
    expect(songKey(sus)).toEqual({ fifths: 3 });
    const key = songKey(sus)!;
    const pitched = sus.notes.filter((n) => !n.rest);
    const cSharp = spellInKey(13, key);
    expect([cSharp.letter, cSharp.accidental, cSharp.shown]).toEqual(['C', 'sharp', null]);
    const fSharp = spellInKey(18, key);
    expect([fSharp.letter, fSharp.accidental, fSharp.shown]).toEqual(['F', 'sharp', null]);
    expect(pitched.filter((n) => n.semitone === 13).length).toBeGreaterThanOrEqual(8);
    expect(pitched.filter((n) => n.semitone === 18).length).toBeGreaterThanOrEqual(4);
    // The doc comment's honest claim: the third sharp (G sharp) is never sung.
    expect(pitched.some((n) => ((n.semitone % 12) + 12) % 12 === 8)).toBe(false);
    // Starts and ends on the tonic A; the pickup loops back bar-true.
    expect(pitched[0].semitone).toBe(9);
    expect(pitched[pitched.length - 1].semitone).toBe(9);
    expect(sus.pickupBeats).toBe(2);
    expect(sus.notes.reduce((t, n) => t + n.beats, 0) % sus.beatsPerBar).toBe(0);
  });

  it('reaches three flats with Amazing Grace: E flat home, B flat sung, A flat only in the signature', () => {
    const grace = BOOK_TWO_SONGS.find((s) => s.id === 'amazing-grace')!;
    expect(songKey(grace)).toEqual({ fifths: -3 });
    const key = songKey(grace)!;
    const pitched = grace.notes.filter((n) => !n.rest);
    const tonic = spellInKey(3, key);
    expect([tonic.letter, tonic.accidental, tonic.shown]).toEqual(['E', 'flat', null]);
    for (const semitone of [-2, 10]) {
      const bFlat = spellInKey(semitone, key);
      expect([bFlat.letter, bFlat.accidental, bFlat.shown]).toEqual(['B', 'flat', null]);
    }
    expect(pitched.filter((n) => n.semitone === 3).length).toBeGreaterThanOrEqual(8);
    expect(pitched.filter((n) => n.semitone === -2 || n.semitone === 10).length).toBeGreaterThanOrEqual(4);
    // The doc comment's honest claim: the third flat (A flat) is never sung.
    expect(pitched.some((n) => ((n.semitone % 12) + 12) % 12 === 8)).toBe(false);
    // Opens on the low B flat upbeat, closes home on E flat; the loop is bar-true.
    expect(pitched[0].semitone).toBe(-2);
    expect(pitched[pitched.length - 1].semitone).toBe(3);
    expect(grace.pickupBeats).toBe(1);
    expect(grace.notes.reduce((t, n) => t + n.beats, 0) % grace.beatsPerBar).toBe(0);
  });

  it('uses the leading tone — Book Two’s first lesson is a real F sharp', () => {
    const bonnie = BOOK_TWO_SONGS.find((s) => s.id === 'my-bonnie')!;
    expect(bonnie.notes.some((n) => !n.rest && ((n.semitone % 12) + 12) % 12 === 6)).toBe(true);
  });
});

describe('the Book Two shelf names each key', () => {
  it('every Book Two tune carries a key the shelf can write out', () => {
    for (const song of BOOK_TWO_SONGS) {
      expect(song.key, song.title).toBeTruthy();
      expect(keyDisplayName(song.key!), song.title).not.toBeNull();
    }
  });

  it('writes the shelf as a reader would read it', () => {
    const names = BOOK_TWO_SONGS.map((s) => keyDisplayName(s.key!));
    expect(names).toContain('B♭');
    expect(names).toContain('E♭');
    expect(names.every((n) => n !== null && !n.includes('b'))).toBe(true);
  });
});
