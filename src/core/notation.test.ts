import { describe, expect, it } from 'vitest';
import { needsLedger, noteNameAt, noteNameAtStep, semitoneAtStep, staffStepAt, stemDown } from './notation';

describe('noteNameAt', () => {
  it('names the naturals of the C4 octave', () => {
    expect(noteNameAt(0)).toBe('C');
    expect(noteNameAt(2)).toBe('D');
    expect(noteNameAt(4)).toBe('E');
    expect(noteNameAt(5)).toBe('F');
    expect(noteNameAt(7)).toBe('G');
    expect(noteNameAt(9)).toBe('A');
    expect(noteNameAt(11)).toBe('B');
  });

  it('is octave-agnostic in both directions', () => {
    expect(noteNameAt(12)).toBe('C');
    expect(noteNameAt(14)).toBe('D');
    expect(noteNameAt(-3)).toBe('A');
    expect(noteNameAt(-12)).toBe('C');
  });

  it('returns null for accidentals instead of guessing a spelling', () => {
    expect(noteNameAt(1)).toBeNull();
    expect(noteNameAt(6)).toBeNull();
    expect(noteNameAt(-2)).toBeNull();
  });
});

describe('staffStepAt', () => {
  it('walks the diatonic steps of the C4 octave', () => {
    expect(staffStepAt(0)).toBe(0); // C4 — middle C
    expect(staffStepAt(2)).toBe(1);
    expect(staffStepAt(4)).toBe(2); // E4 — bottom staff line
    expect(staffStepAt(5)).toBe(3);
    expect(staffStepAt(7)).toBe(4);
    expect(staffStepAt(9)).toBe(5);
    expect(staffStepAt(11)).toBe(6); // B4 — middle line
  });

  it('continues across octaves', () => {
    expect(staffStepAt(12)).toBe(7); // C5
    expect(staffStepAt(16)).toBe(9); // E5
    expect(staffStepAt(17)).toBe(10); // F5 — top staff line
    expect(staffStepAt(-3)).toBe(-2); // A3
  });

  it('returns null for accidentals', () => {
    expect(staffStepAt(1)).toBeNull();
    expect(staffStepAt(6)).toBeNull();
  });
});

describe('stemDown', () => {
  it('points stems up below the middle line and down from it upward', () => {
    expect(stemDown(0)).toBe(false); // middle C
    expect(stemDown(5)).toBe(false); // A4
    expect(stemDown(6)).toBe(true); // B4 — the middle line itself
    expect(stemDown(9)).toBe(true); // E5
  });
});

describe('needsLedger', () => {
  it('gives middle C (and below) its ledger line', () => {
    expect(needsLedger(0)).toBe(true);
    expect(needsLedger(-2)).toBe(true);
  });

  it('needs no ledger inside or immediately around the staff', () => {
    expect(needsLedger(1)).toBe(false); // D4, space under the bottom line
    expect(needsLedger(2)).toBe(false); // E4, bottom line
    expect(needsLedger(10)).toBe(false); // F5, top line
    expect(needsLedger(11)).toBe(false); // G5, space above the top line
  });

  it('starts ledgers again above the staff at A5', () => {
    expect(needsLedger(12)).toBe(true);
  });
});

describe('reading the staff the other way round', () => {
  it('round-trips every drawable step through pitch and back', () => {
    // One ledger below middle C to one above the staff — the range the
    // songbook draws and the range free play offers.
    for (let step = -2; step <= 12; step++) {
      expect(staffStepAt(semitoneAtStep(step)), `step ${step}`).toBe(step);
    }
  });

  it('puts the landmarks where a reader expects them', () => {
    expect(semitoneAtStep(0)).toBe(0); // middle C, on its ledger
    expect(semitoneAtStep(2)).toBe(4); // E, the staff's bottom line
    expect(semitoneAtStep(4)).toBe(7); // G, the line the clef spirals on
    expect(semitoneAtStep(10)).toBe(17); // F, the top line
    expect(semitoneAtStep(7)).toBe(12); // C5, an octave up
  });

  it('names every step with a single letter, below middle C too', () => {
    for (let step = -3; step <= 13; step++) {
      expect(noteNameAtStep(step), `step ${step}`).toMatch(/^[A-G]$/);
      expect(noteNameAtStep(step)).toBe(noteNameAt(semitoneAtStep(step)));
    }
  });
});

// ---------------------------------------------------------------------------
// Book Two: true keys (task 165, first piece)
// ---------------------------------------------------------------------------

import {
  FLAT_ORDER,
  FLAT_SIGNATURE_STEPS,
  SHARP_ORDER,
  SHARP_SIGNATURE_STEPS,
  alteredLetters,
  majorKey,
  semitoneOfSpelling,
  spellInKey,
} from './notation';

const KEY_NAMES = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];

describe('majorKey', () => {
  it('knows the teaching span, four sharps to four flats', () => {
    expect(majorKey('C')).toEqual({ fifths: 0 });
    expect(majorKey('G')).toEqual({ fifths: 1 });
    expect(majorKey('E')).toEqual({ fifths: 4 });
    expect(majorKey('F')).toEqual({ fifths: -1 });
    expect(majorKey('Ab')).toEqual({ fifths: -4 });
  });

  it('answers null for a key outside the span instead of guessing', () => {
    expect(majorKey('F#')).toBeNull();
    expect(majorKey('Db')).toBeNull();
    expect(majorKey('c')).toBeNull();
    expect(majorKey('')).toBeNull();
  });
});

describe('alteredLetters', () => {
  it('slices the standard orders', () => {
    expect(alteredLetters({ fifths: 0 })).toEqual([]);
    expect(alteredLetters({ fifths: 2 })).toEqual(['F', 'C']);
    expect(alteredLetters({ fifths: -3 })).toEqual(['B', 'E', 'A']);
  });

  it('sharp and flat orders mirror each other', () => {
    expect([...FLAT_ORDER].reverse()).toEqual([...SHARP_ORDER]);
    expect(SHARP_SIGNATURE_STEPS).toHaveLength(4);
    expect(FLAT_SIGNATURE_STEPS).toHaveLength(4);
  });
});

describe('spellInKey', () => {
  it('spells the sharp key diatonics through the signature, shown nothing', () => {
    // F# in G major: carries the sharp, shows nothing — the signature says it.
    const fis = spellInKey(6, majorKey('G')!);
    expect(fis).toMatchObject({ letter: 'F', accidental: 'sharp', shown: null, step: 3 });
    // C# and F# in D major.
    expect(spellInKey(1, majorKey('D')!)).toMatchObject({ letter: 'C', accidental: 'sharp', shown: null, step: 0 });
    // G# in E major.
    expect(spellInKey(8, majorKey('E')!)).toMatchObject({ letter: 'G', accidental: 'sharp', shown: null });
  });

  it('spells the flat key diatonics through the signature', () => {
    // Bb in F major.
    expect(spellInKey(10, majorKey('F')!)).toMatchObject({ letter: 'B', accidental: 'flat', shown: null, step: 6 });
    // Ab and Db in Ab major.
    expect(spellInKey(8, majorKey('Ab')!)).toMatchObject({ letter: 'A', accidental: 'flat', shown: null });
    expect(spellInKey(1, majorKey('Ab')!)).toMatchObject({ letter: 'D', accidental: 'flat', shown: null });
  });

  it('shows the natural sign exactly where the signature is being cancelled', () => {
    // F natural in G major: the lesson a key signature teaches.
    expect(spellInKey(5, majorKey('G')!)).toMatchObject({ letter: 'F', accidental: 'natural', shown: 'natural' });
    // B natural in F major.
    expect(spellInKey(11, majorKey('F')!)).toMatchObject({ letter: 'B', accidental: 'natural', shown: 'natural' });
    // F natural in C major shows nothing — nothing to cancel.
    expect(spellInKey(5, majorKey('C')!)).toMatchObject({ letter: 'F', accidental: null, shown: null });
  });

  it('shows chromatic notes in the key’s own direction', () => {
    // C# in C major: sharp side.
    expect(spellInKey(1, majorKey('C')!)).toMatchObject({ letter: 'C', accidental: 'sharp', shown: 'sharp' });
    // Gb in Ab major: flat side, and not in the signature, so shown.
    expect(spellInKey(6, majorKey('Ab')!)).toMatchObject({ letter: 'G', accidental: 'flat', shown: 'flat' });
  });

  it('never spells B#, E#, Cb or Fb, and never a double accidental', () => {
    for (const name of KEY_NAMES) {
      const key = majorKey(name)!;
      for (let s = -24; s <= 24; s++) {
        const spelt = spellInKey(s, key);
        if (spelt.accidental === 'sharp') expect(['B', 'E']).not.toContain(spelt.letter);
        if (spelt.accidental === 'flat') expect(['C', 'F']).not.toContain(spelt.letter);
      }
    }
  });

  it('round-trips: every spelling sounds back as the pitch it was spelt from', () => {
    // Musical accuracy is inviolable (DESIGN.md): the letter+accidental the
    // child reads must be exactly the pitch the engine plays, in every key,
    // across four octaves.
    for (const name of KEY_NAMES) {
      const key = majorKey(name)!;
      for (let s = -24; s <= 24; s++) {
        const spelt = spellInKey(s, key);
        expect(semitoneOfSpelling(spelt.step, spelt.accidental)).toBe(s);
      }
    }
  });

  it('keeps octaves honest at the boundaries', () => {
    // F#3 sits on F3’s step, one octave below F#4.
    expect(spellInKey(-6, majorKey('G')!).step).toBe(-4);
    expect(spellInKey(6, majorKey('G')!).step).toBe(3);
    expect(spellInKey(18, majorKey('G')!).step).toBe(10);
  });

  it('leaves Book One untouched: the naturals-only functions still refuse accidentals', () => {
    expect(noteNameAt(6)).toBeNull();
    expect(staffStepAt(6)).toBeNull();
  });
});
