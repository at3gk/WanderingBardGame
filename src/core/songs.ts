import { Song } from './song';

/**
 * The songbook (ROADMAP task 45). Three public-domain melodies every child
 * meets early, one per biome, chosen so the walk is both a tour of real
 * tunes *and* an ascending tour of the treble staff — DESIGN.md's biome
 * curriculum, now made of actual music:
 *
 *   village   — Mary Had a Little Lamb, C major (C4–G4). Five notes, the
 *               simplest tune there is, and it lives around middle C so
 *               the ledger line is met from the first bar.
 *   forest    — Twinkle Twinkle Little Star, G major (G4–E5). Longer,
 *               wider, sits in the middle of the staff. (Twinkle in G
 *               happens to need no F#, so it stays naturals-only.)
 *   riverside — Ode to Joy, C major up an octave (C5–G5). Stepwise motion
 *               across the staff's upper half, and the only tune here with
 *               a dotted rhythm — the advanced vignette.
 *
 * Semitones are measured from middle C. Naturals only, enforced by test.
 */

/** Mary Had a Little Lamb — traditional, 8 bars of 4/4. */
export const MARY_HAD_A_LITTLE_LAMB: Song = {
  id: 'mary',
  title: 'Mary Had a Little Lamb',
  beatsPerBar: 4,
  notes: [
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 2, beats: 1 },
    { semitone: 4, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 4, beats: 2 },
    { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 2, beats: 2 },
    { semitone: 4, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 7, beats: 2 },
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 2, beats: 1 },
    { semitone: 4, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 4, beats: 1 },
    { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 },
    { semitone: 0, beats: 4 },
  ],
};

/** Twinkle Twinkle Little Star — traditional, 12 bars of 4/4, in G. */
export const TWINKLE_TWINKLE: Song = {
  id: 'twinkle',
  title: 'Twinkle Twinkle Little Star',
  beatsPerBar: 4,
  notes: [
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 },
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 11, beats: 1 },
    { semitone: 9, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 2 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 11, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 2 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 11, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 },
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 11, beats: 1 },
    { semitone: 9, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 2 },
  ],
};

/** Ode to Joy (Beethoven, 9th Symphony) — 8 bars of 4/4, an octave up. */
export const ODE_TO_JOY: Song = {
  id: 'ode',
  title: 'Ode to Joy',
  beatsPerBar: 4,
  notes: [
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 19, beats: 1 },
    { semitone: 19, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 16, beats: 1.5 }, { semitone: 14, beats: 0.5 }, { semitone: 14, beats: 2 },
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 19, beats: 1 },
    { semitone: 19, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 14, beats: 1.5 }, { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 2 },
  ],
};

/**
 * Hot Cross Buns — traditional, 5 bars of 4/4. The three-note first tune,
 * and the first place a reader meets a **rest**: each "hot cross buns" is
 * three beats and a beat of breath, which is how beginner books write it.
 */
export const HOT_CROSS_BUNS: Song = {
  id: 'buns',
  title: 'Hot Cross Buns',
  beatsPerBar: 4,
  notes: [
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 0, beats: 1, rest: true },
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 0, beats: 1, rest: true },
    { semitone: 0, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 0, beats: 1 },
    { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 },
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 1 }, { semitone: 0, beats: 1, rest: true },
  ],
};

/** Au Clair de la Lune — traditional, 8 bars of 4/4, in G. */
export const AU_CLAIR_DE_LA_LUNE: Song = {
  id: 'auclair',
  title: 'Au Clair de la Lune',
  beatsPerBar: 4,
  notes: [
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 },
    { semitone: 11, beats: 2 }, { semitone: 9, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 9, beats: 1 },
    { semitone: 7, beats: 4 },
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 },
    { semitone: 11, beats: 2 }, { semitone: 9, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 9, beats: 1 },
    { semitone: 7, beats: 4 },
  ],
};

/** Lightly Row — traditional, 8 bars of 4/4, an octave up. */
export const LIGHTLY_ROW: Song = {
  id: 'lightly',
  title: 'Lightly Row',
  beatsPerBar: 4,
  notes: [
    { semitone: 19, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 17, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 17, beats: 1 },
    { semitone: 19, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 19, beats: 2 },
    { semitone: 19, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 17, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 17, beats: 1 },
    { semitone: 19, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 19, beats: 2 },
  ],
};

/**
 * Each biome's set, played in rotation so a long walk isn't one tune on
 * repeat. Both songs in a set live in the same region of the staff, so the
 * curriculum (low → middle → upper) survives the variety.
 */
export const SONGS_BY_BIOME: Record<string, Song[]> = {
  village: [MARY_HAD_A_LITTLE_LAMB, HOT_CROSS_BUNS],
  forest: [TWINKLE_TWINKLE, AU_CLAIR_DE_LA_LUNE],
  riverside: [ODE_TO_JOY, LIGHTLY_ROW],
};

export const SONGS: Song[] = Object.values(SONGS_BY_BIOME).flat();

/**
 * The song a biome plays on its `pass`-th time through, cycling. Falls back
 * to the village set for an unknown biome id.
 */
export function songForBiome(biomeId: string, pass = 0): Song {
  const set = SONGS_BY_BIOME[biomeId] ?? SONGS_BY_BIOME.village;
  return set[((pass % set.length) + set.length) % set.length];
}
