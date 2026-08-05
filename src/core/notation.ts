/**
 * Written-music mapping for the teaching direction (ROADMAP task 41;
 * DESIGN.md's Pedagogy section is the contract). Everything is measured in
 * semitones from middle C (C4), which is also the audio manifest's root,
 * so what the player sees on the staff is literally what the engine plays.
 *
 * Naturals only: the game world is C major / A minor by design — every
 * note a kid meets has a one-letter name. An accidental reaching these
 * functions is a bug, so they return null for one rather than guessing a
 * sharp/flat spelling; the manifest test enforces that shipped melodies
 * never contain any.
 */

const NATURALS: ReadonlyArray<{ semitone: number; letter: string }> = [
  { semitone: 0, letter: 'C' },
  { semitone: 2, letter: 'D' },
  { semitone: 4, letter: 'E' },
  { semitone: 5, letter: 'F' },
  { semitone: 7, letter: 'G' },
  { semitone: 9, letter: 'A' },
  { semitone: 11, letter: 'B' },
];

/** Letter name (C–B) for a natural note, or null for an accidental. Octave-agnostic. */
export function noteNameAt(semitoneFromC4: number): string | null {
  const pitchClass = ((semitoneFromC4 % 12) + 12) % 12;
  return NATURALS.find((n) => n.semitone === pitchClass)?.letter ?? null;
}

/**
 * The treble staff's five lines, as diatonic steps (E4 G4 B4 D5 F5).
 * Shared by the walk's own staff and free play's ladder, so both draw the
 * same five positions as "lines" rather than each hardcoding the list.
 */
export const STAFF_LINE_STEPS = [2, 4, 6, 8, 10];

/**
 * Diatonic staff step from middle C: C4 = 0, D4 = 1, … C5 = 7, E5 = 9.
 * Null for accidentals. The treble staff's five lines sit at steps
 * 2/4/6/8/10 (E4 G4 B4 D5 F5); even steps are lines, odd steps are
 * spaces.
 */
export function staffStepAt(semitoneFromC4: number): number | null {
  const pitchClass = ((semitoneFromC4 % 12) + 12) % 12;
  const index = NATURALS.findIndex((n) => n.semitone === pitchClass);
  if (index === -1) return null;
  const octave = Math.floor(semitoneFromC4 / 12);
  return octave * 7 + index;
}

/** Letter name for a diatonic staff step (C4 = 0), in any octave. */
export function letterForStep(step: number): string {
  return NATURALS[((step % 7) + 7) % 7].letter;
}

/**
 * Engraving rule, always correct because kids learn from this screen:
 * stems point up for notes below the staff's middle line (B4, step 6),
 * down at or above it.
 */
export function stemDown(step: number): boolean {
  return step >= 6;
}

/**
 * Whether a note at this step wears a ledger line: at/below middle C
 * (step 0, the iconic first ledger of every beginner book) or at/above
 * A5 (step 12, the first ledger over the staff).
 */
export function needsLedger(step: number): boolean {
  return step <= 0 || step >= 12;
}

/**
 * The inverse of `staffStepAt`: which pitch sits on a given staff step.
 *
 * The walk only ever needs step-from-pitch, because the song says what to
 * play. Free play needs the other direction — a child points at a line or
 * a space and the game has to know what note that *is*. Naturals only, so
 * seven steps to the octave.
 */
export function semitoneAtStep(step: number): number {
  const octave = Math.floor(step / 7);
  const index = ((step % 7) + 7) % 7;
  return octave * 12 + NATURALS[index].semitone;
}

/** Letter name for a staff step. Always defined — every step is a natural. */
export function noteNameAtStep(step: number): string {
  const index = ((step % 7) + 7) % 7;
  return NATURALS[index].letter;
}

// ---------------------------------------------------------------------------
// Book Two: true keys (ROADMAP task 165, first piece — notation core only)
// ---------------------------------------------------------------------------
//
// Everything above is Book One's contract and is deliberately untouched:
// naturals-only functions keep returning null for accidentals, because Book
// One's staff must never quietly start spelling sharps. Book Two reads
// through the functions below instead, which take a key and always answer.
//
// Majors only, and only the practical teaching span (up to four sharps or
// flats): that covers every key a beginner method book reaches, and each
// added signature is one more thing that must be *exactly* right before it
// ships. Minors are a later piece — they change which letters carry
// accidentals mid-tune (the raised seventh), not just the signature, and
// that rule should arrive with the songs that need it.
//
// Spelling policy, chosen for beginners and enforced by test: a chromatic
// note outside the key is spelt in the key's own direction (sharp keys and
// C sharpen, flat keys flatten), always as an altered form of the natural
// one letter away — so B♯, E♯, C♭ and F♭ never appear, and neither do
// double accidentals. A note whose letter the signature alters but which
// sounds natural is spelt with an explicit natural sign, which is exactly
// the lesson a key signature teaches.

export type Accidental = 'sharp' | 'flat' | 'natural';

/**
 * A key, as its place on the circle of fifths: positive = that many sharps,
 * negative = that many flats, 0 = C major. The one honest encoding — the
 * signature's contents and order fall out of it rather than being listed.
 */
export interface KeySignature {
  fifths: number;
}

/** The order sharps enter a signature (F♯ first), which is also circle-of-fifths order. */
export const SHARP_ORDER: readonly string[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
/** The order flats enter (B♭ first) — the sharps' mirror. */
export const FLAT_ORDER: readonly string[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Where the signature's glyphs sit on the treble staff, as diatonic steps
 * (C4 = 0), in the order the accidentals enter. Standard engraving
 * positions: sharps F5 C5 G5 D5, flats B4 E5 A4 D5.
 */
export const SHARP_SIGNATURE_STEPS: readonly number[] = [10, 7, 11, 8];
export const FLAT_SIGNATURE_STEPS: readonly number[] = [6, 9, 5, 8];

const MAJOR_KEYS: Readonly<Record<string, number>> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
};

/**
 * Look a major key up by name ('C', 'G', 'Bb', …). Null for a name outside
 * the supported span rather than a guess — an unknown key reaching the
 * engraver is a bug upstream, same stance as `noteNameAt`.
 */
export function majorKey(name: string): KeySignature | null {
  const fifths = MAJOR_KEYS[name];
  return fifths === undefined ? null : { fifths };
}

/** Which letters this signature alters, in signature order. */
export function alteredLetters(key: KeySignature): string[] {
  const n = clampFifths(key);
  return n >= 0 ? SHARP_ORDER.slice(0, n) : FLAT_ORDER.slice(0, -n);
}

/**
 * A pitch, spelt for a key.
 *
 * `accidental` is what the note *carries* relative to its letter (F♯ in D
 * major carries 'sharp'); `shown` is what the engraver must draw by the
 * head — null when the key signature already says it. The two are different
 * exactly where the pedagogy lives: in G major, F♯ carries a sharp but
 * shows nothing, and F natural shows the natural sign.
 */
export interface SpeltNote {
  /** Diatonic staff step of the LETTER (C4 = 0) — where the head is drawn. */
  step: number;
  letter: string;
  accidental: Accidental | null;
  shown: Accidental | null;
}

/**
 * Spell a semitone-from-C4 in a key. Total: every pitch has a spelling in
 * every supported key, and (letter, accidental, octave) always sounds back
 * to the input semitone — the round-trip the tests pin, because the
 * notation is never allowed to disagree with the ear.
 */
export function spellInKey(semitoneFromC4: number, key: KeySignature): SpeltNote {
  const altered = alteredLetters(key);
  const direction = clampFifths(key) < 0 ? -1 : 1;
  const pitchClass = ((semitoneFromC4 % 12) + 12) % 12;

  const natural = NATURALS.find((n) => n.semitone === pitchClass);
  if (natural) {
    // A white key. If the signature alters this letter, sounding the
    // natural needs the sign; otherwise it is simply itself.
    const cancels = altered.includes(natural.letter);
    return spelt(semitoneFromC4, natural.letter, 0, cancels ? 'natural' : null, cancels ? 'natural' : null);
  }

  // A black key: an altered form of the natural one semitone toward the
  // key's own direction. Sharp keys (and C) write the sharp of the letter
  // below; flat keys write the flat of the letter above. Neither ever
  // needs B♯/E♯/C♭/F♭, because those gaps have no black key in them.
  const naturalPc = ((pitchClass - direction) % 12 + 12) % 12;
  const letter = NATURALS.find((n) => n.semitone === naturalPc)!.letter;
  const accidental: Accidental = direction > 0 ? 'sharp' : 'flat';
  // Shown only when the signature does not already say it.
  const inSignature = altered.includes(letter);
  return spelt(semitoneFromC4, letter, direction, accidental, inSignature ? null : accidental);
}

/** The audible semitone of a spelt letter+accidental — the round-trip's other half. */
export function semitoneOfSpelling(step: number, accidental: Accidental | null): number {
  const alt = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0;
  return semitoneAtStep(step) + alt;
}

function spelt(
  semitone: number,
  letter: string,
  alt: number,
  accidental: Accidental | null,
  shown: Accidental | null,
): SpeltNote {
  const index = NATURALS.findIndex((n) => n.letter === letter);
  // The letter's own natural semitone, in the octave that makes
  // letter+alteration sound as the input pitch.
  const naturalSemitone = semitone - alt;
  const octave = Math.floor(naturalSemitone / 12);
  return { step: octave * 7 + index, letter, accidental, shown };
}

function clampFifths(key: KeySignature): number {
  const raw = Number.isFinite(key?.fifths) ? Math.trunc(key.fifths) : 0;
  return Math.max(-4, Math.min(4, raw));
}
