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
