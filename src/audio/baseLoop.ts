/** Equal-temperament frequency for a semitone offset from a root frequency. */
export function semitoneToFrequency(rootHz: number, semitones: number): number {
  return rootHz * Math.pow(2, semitones / 12);
}
