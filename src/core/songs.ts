import { Song } from './song';

/**
 * The songbook (ROADMAP task 45, grown from one tune per biome to four —
 * task 60's Mulberry Bush was the last piece). Twelve public-domain
 * melodies, four per biome, each biome's set staying in one region of the
 * treble staff so the walk is both a tour of real tunes *and* an ascending
 * tour of the staff — DESIGN.md's biome curriculum, now made of actual
 * music:
 *
 *   village   — Mary Had a Little Lamb, Hot Cross Buns, Row, Row, Row Your
 *               Boat, This Old Man. Low register, around middle C, so the
 *               ledger line is met in the first bar.
 *   forest    — Twinkle Twinkle Little Star, London Bridge, Are You
 *               Sleeping?, Here We Go Round the Mulberry Bush. Mid-staff;
 *               stems begin to flip.
 *   riverside — Ode to Joy, Jingle Bells, Old MacDonald Had a Farm, The
 *               Itsy Bitsy Spider. Upper staff, an octave up from village.
 *
 * Each biome plays its four in rotation (`SONGS_BY_BIOME` below), not one
 * tune on repeat, so a full walk is well past its first repeat before
 * anything is heard twice. A separate Book Two set (below, task 165) adds
 * the game's first accidental for a family that has finished all twelve.
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

/** Row, Row, Row Your Boat — traditional, 8 bars of 4/4, in C. */
export const ROW_YOUR_BOAT: Song = {
  id: 'row',
  title: 'Row, Row, Row Your Boat',
  beatsPerBar: 4,
  notes: [
    { semitone: 0, beats: 2 }, { semitone: 0, beats: 2 },
    { semitone: 0, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 4, beats: 2 },
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 5, beats: 1 },
    { semitone: 7, beats: 4 },
    { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 1 },
    { semitone: 7, beats: 0.5 }, { semitone: 7, beats: 0.5 }, { semitone: 7, beats: 1 },
    { semitone: 4, beats: 0.5 }, { semitone: 4, beats: 0.5 }, { semitone: 4, beats: 1 },
    { semitone: 0, beats: 0.5 }, { semitone: 0, beats: 0.5 }, { semitone: 0, beats: 1 },
    { semitone: 7, beats: 1 }, { semitone: 5, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 },
    { semitone: 0, beats: 4 },
  ],
};

/** Old MacDonald Had a Farm — traditional, 12 bars of 4/4, an octave up. */
export const OLD_MACDONALD: Song = {
  id: 'macdonald',
  title: 'Old MacDonald Had a Farm',
  beatsPerBar: 4,
  notes: [
    { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 2 },
    { semitone: 21, beats: 1 }, { semitone: 21, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 19, beats: 1 },
    { semitone: 17, beats: 4 },
    { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 0.5 }, { semitone: 14, beats: 0.5 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 2 },
    { semitone: 21, beats: 1 }, { semitone: 21, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 19, beats: 1 },
    { semitone: 17, beats: 4 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 0.5 },
    { semitone: 17, beats: 0.5 }, { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 },
  ],
};

/** London Bridge Is Falling Down — traditional, 8 bars of 4/4, in G. */
export const LONDON_BRIDGE: Song = {
  id: 'london',
  title: 'London Bridge',
  beatsPerBar: 4,
  notes: [
    { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 11, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 12, beats: 2 },
    { semitone: 11, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 11, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 9, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 11, beats: 2 },
    { semitone: 7, beats: 4 },
  ],
};

/** Are You Sleeping? (Frère Jacques) — traditional, 8 bars of 4/4, in G. The round every child sings. */
export const ARE_YOU_SLEEPING: Song = {
  id: 'frere',
  title: 'Are You Sleeping?',
  beatsPerBar: 4,
  notes: [
    { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 11, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 11, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 14, beats: 0.5 }, { semitone: 16, beats: 0.5 }, { semitone: 14, beats: 0.5 },
    { semitone: 12, beats: 0.5 }, { semitone: 11, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 14, beats: 0.5 }, { semitone: 16, beats: 0.5 }, { semitone: 14, beats: 0.5 },
    { semitone: 12, beats: 0.5 }, { semitone: 11, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 7, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 7, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 7, beats: 2 },
  ],
};

/** Jingle Bells (chorus) — Pierpont, 1857. 8 bars of 4/4, an octave up. */
export const JINGLE_BELLS: Song = {
  id: 'jingle',
  title: 'Jingle Bells',
  beatsPerBar: 4,
  notes: [
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 16, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 },
    { semitone: 16, beats: 4 },
    { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 17, beats: 1 },
    { semitone: 17, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 16, beats: 0.5 }, { semitone: 16, beats: 0.5 },
    { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 19, beats: 2 },
  ],
};

/**
 * This Old Man — traditional, 8 bars of 4/4, in C. Also the tune of
 * Barney's "I love you", which is why almost every child already has it.
 * Bars 5–6 happen to walk the C-major pentascale straight up with the
 * tonic hammered before it — the cleanest possible drill for the village's
 * five notes, hidden inside a song they can already sing.
 */
export const THIS_OLD_MAN: Song = {
  id: 'oldman',
  title: 'This Old Man',
  beatsPerBar: 4,
  notes: [
    { semitone: 7, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 7, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 7, beats: 2 },
    { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 5, beats: 1 }, { semitone: 4, beats: 1 },
    { semitone: 2, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 5, beats: 1 },
    { semitone: 4, beats: 0.5 }, { semitone: 5, beats: 0.5 },
    { semitone: 7, beats: 1 }, { semitone: 0, beats: 1 },
    { semitone: 0, beats: 0.5 }, { semitone: 0, beats: 0.5 }, { semitone: 0, beats: 1 },
    { semitone: 0, beats: 0.5 }, { semitone: 2, beats: 0.5 }, { semitone: 4, beats: 0.5 },
    { semitone: 5, beats: 0.5 }, { semitone: 7, beats: 2 },
    { semitone: 7, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 5, beats: 1 },
    { semitone: 4, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 0, beats: 2 },
  ],
};

/**
 * The Itsy Bitsy Spider — traditional, 14 bars of 4/4, an octave up. Its
 * phrase-ending rests are the songbook's clearest use of written silence:
 * the spider pauses, and so does the player.
 */
export const ITSY_BITSY_SPIDER: Song = {
  id: 'spider',
  title: 'The Itsy Bitsy Spider',
  beatsPerBar: 4,
  notes: [
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 0.5 }, { semitone: 16, beats: 0.5 },
    { semitone: 12, beats: 3 }, { semitone: 0, beats: 1, rest: true },
    { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 19, beats: 1 },
    { semitone: 19, beats: 1 }, { semitone: 17, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 17, beats: 0.5 }, { semitone: 19, beats: 0.5 },
    { semitone: 16, beats: 3 }, { semitone: 0, beats: 1, rest: true },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 0.5 }, { semitone: 16, beats: 0.5 },
    { semitone: 12, beats: 3 }, { semitone: 0, beats: 1, rest: true },
    { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 12, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 16, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 14, beats: 0.5 }, { semitone: 16, beats: 0.5 },
    { semitone: 12, beats: 4 },
  ],
};

/**
 * Here We Go Round the Mulberry Bush — traditional English singing game
 * (recorded by Halliwell, 1849; melody shared with Nuts in May), the
 * fourth forest song task 60 waited on. Transcribed 2026-08-05 from the
 * Wikipedia article's engraved score (G major, 6/8) transposed up a
 * fourth to C — which lands it naturals-only on degrees 1/2/3/5/6/7
 * exactly as task 60's entry predicted, sitting G4–G5, the forest
 * register. Independently corroborated by a Kodály-curriculum source
 * (musicyoucanread.com): 6/8, form ABAC, tone set so-la-ti-do-re-mi-so —
 * the very set this transcription uses with do = C5. The songbook's
 * first 6/8 tune: three quarter-beats to the bar, the lilt carried by
 * quarter+eighth pairs.
 */
export const MULBERRY_BUSH: Song = {
  id: 'mulberry',
  title: 'Here We Go Round the Mulberry Bush',
  beatsPerBar: 3,
  notes: [
    // Here we go round the mul-b'ry bush,
    { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 0.5 },
    { semitone: 12, beats: 1 }, { semitone: 16, beats: 0.5 },
    { semitone: 19, beats: 1 }, { semitone: 16, beats: 0.5 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 0.5 },
    // the mul-b'ry bush, the mul-b'ry bush.
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 0.5 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 0.5 },
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 0.5 }, { semitone: 7, beats: 1.5 },
    // Here we go round the mul-b'ry bush
    { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 0.5 }, { semitone: 12, beats: 0.5 },
    { semitone: 12, beats: 1 }, { semitone: 16, beats: 0.5 },
    { semitone: 19, beats: 1 }, { semitone: 16, beats: 0.5 }, { semitone: 12, beats: 1 }, { semitone: 12, beats: 0.5 },
    // so ear-ly in the mor-ning.
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 0.5 }, { semitone: 7, beats: 1 }, { semitone: 7, beats: 0.5 },
    { semitone: 12, beats: 1.5 }, { semitone: 12, beats: 1.5 },
  ],
};

/**
 * Each biome's set, played in rotation so a long walk isn't one tune on
 * repeat. Every song in a set lives in the same region of the staff, so the
 * curriculum (low → middle → upper) survives the variety.
 */
export const SONGS_BY_BIOME: Record<string, Song[]> = {
  village: [MARY_HAD_A_LITTLE_LAMB, HOT_CROSS_BUNS, ROW_YOUR_BOAT, THIS_OLD_MAN],
  forest: [TWINKLE_TWINKLE, LONDON_BRIDGE, ARE_YOU_SLEEPING, MULBERRY_BUSH],
  riverside: [ODE_TO_JOY, JINGLE_BELLS, OLD_MACDONALD, ITSY_BITSY_SPIDER],
};

export const SONGS: Song[] = Object.values(SONGS_BY_BIOME).flat();

// ---------------------------------------------------------------------------
// Book Two: true keys (task 165)
// ---------------------------------------------------------------------------

/**
 * My Bonnie Lies Over the Ocean — traditional Scottish (published 1881,
 * melody older; unambiguously public domain), the accidentals volume's
 * opening tune: a waltz in G whose F♯ is the leading tone a child already
 * sings without knowing its name ("to ME", "bring BACK").
 *
 * Transcribed 2026-08-05 from two independent settings on thesession.org
 * (tune 6023: a G-major setting and a D-major setting), which agree
 * note-for-note once transposed; cross-checked against the tune as sung.
 * Two normalizations, both honest to this engine where duration is
 * arrival spacing, not sustain:
 * - the source's cross-barline ties (the held "o-cean", "me") become
 *   note + written rest — one tap, then the breath the singer holds
 *   through, engraved as the rests task 50 already teaches;
 * - the closing G is short by the one-beat pickup, so the loop's seam
 *   completes the final bar with the next verse's "My" — see
 *   `Song.pickupBeats`.
 */
export const MY_BONNIE: Song = {
  id: 'my-bonnie',
  title: 'My Bonnie Lies Over the Ocean',
  beatsPerBar: 3,
  pickupBeats: 1,
  key: 'G',
  notes: [
    // My
    { semitone: 2, beats: 1 },
    // Bon-nie lies | o-ver the | o---cean
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 4, beats: 1 },
    { semitone: 2, beats: 1 }, { semitone: -1, beats: 2 },
    { rest: true, semitone: 0, beats: 2 }, { semitone: 2, beats: 1 },
    // Bon-nie lies | o-ver the | sea
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 7, beats: 1 }, { semitone: 6, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 9, beats: 3 },
    { rest: true, semitone: 0, beats: 2 }, { semitone: 2, beats: 1 },
    // Bon-nie lies | o-ver the | o---cean
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 4, beats: 1 },
    { semitone: 2, beats: 1 }, { semitone: -1, beats: 2 },
    { rest: true, semitone: 0, beats: 2 }, { semitone: 2, beats: 1 },
    // bring back my | Bon-nie to | me
    { semitone: 4, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 },
    { semitone: 6, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 7, beats: 3 },
    { rest: true, semitone: 0, beats: 3 },
    // Bring | back, | bring | back,
    { semitone: 2, beats: 3 }, { semitone: 7, beats: 3 },
    { semitone: 4, beats: 3 }, { semitone: 9, beats: 2 }, { semitone: 7, beats: 1 },
    // bring back my Bon-nie to | me, to | me
    { semitone: 6, beats: 1 }, { semitone: 6, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 6, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 7, beats: 2 }, { semitone: 9, beats: 1 },
    { semitone: 11, beats: 3 },
    // Bring | back, | bring | back,
    { semitone: 2, beats: 3 }, { semitone: 7, beats: 3 },
    { semitone: 4, beats: 3 }, { semitone: 9, beats: 2 }, { semitone: 7, beats: 1 },
    // bring back my Bon-nie to | me
    { semitone: 6, beats: 1 }, { semitone: 6, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 6, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 7, beats: 2 },
  ],
};

/**
 * Yankee Doodle — traditional (18th-century American; unambiguously public
 * domain), Book Two's second tune and its first in common time. Run 301.
 *
 * Transcribed from the tune as it is universally taught to beginners in C
 * (2/4: CCDE CEDG | CCDE C B | CCDE FEDC | BGAB C C), then transposed up a
 * fifth into G so its leading tone becomes the signature's F♯ — met three
 * times, always resolving up to G ("po-NY", "MAC-a-ro-ni"), the same
 * leading-tone lesson My Bonnie opens with, now in a march a child already
 * knows. The source's eighths are written as quarters here (4/4, two of the
 * source's bars per bar) so the walking tap stays the game's usual pace.
 * Range D4–C5: the low end of the staff, no ledger lines.
 */
export const YANKEE_DOODLE: Song = {
  id: 'yankee-doodle',
  title: 'Yankee Doodle',
  beatsPerBar: 4,
  key: 'G',
  notes: [
    // Yan-kee Doo-dle | went to town, a-
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 },
    { semitone: 7, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 2, beats: 1 },
    // rid-ing on a | po-ny,
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 },
    { semitone: 7, beats: 2 }, { semitone: 6, beats: 2 },
    // stuck a fea-ther | in his cap and
    { semitone: 7, beats: 1 }, { semitone: 7, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 },
    { semitone: 12, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 7, beats: 1 },
    // called it mac-a- | ro-ni.
    { semitone: 6, beats: 1 }, { semitone: 2, beats: 1 }, { semitone: 4, beats: 1 }, { semitone: 6, beats: 1 },
    { semitone: 7, beats: 2 }, { semitone: 7, beats: 2 },
  ],
};

/**
 * Oh My Darling, Clementine — American folk song (1880s; public domain).
 * Book Two's third tune and its first flat key. Run 302.
 *
 * Transcribed from the melody as songbooks give it in C, 3/4 with an
 * eighth-note pickup ("In a | CAV-ern, in a | CAN-yon…": C C | C G3 E E |
 * E C C E | G G F E | D D E | F F E D | E C C E | D G3 B3 D | C), then
 * transposed up a fourth into F so the source's F becomes the signature's
 * B♭ — met three times ("for a MINE", "MI-ner, for-ty"), each time stepping
 * down to A: fa falling to mi, the flat side's mirror of the F♯ that leads
 * up to G in the two sharp-key tunes. Each bar keeps the source's long-short
 * lilt as a dotted quarter and three eighths. The closing bar is short by
 * the pickup, so a looping pass hands the upbeat back, as in My Bonnie.
 * Range C4–C5: inside the staff, no ledger lines.
 */
export const CLEMENTINE: Song = {
  id: 'clementine',
  title: 'Oh My Darling, Clementine',
  beatsPerBar: 3,
  pickupBeats: 1,
  key: 'F',
  notes: [
    // In a
    { semitone: 5, beats: 0.5 }, { semitone: 5, beats: 0.5 },
    // cav-ern, in a | can-yon, ex-ca-
    { semitone: 5, beats: 1.5 }, { semitone: 0, beats: 0.5 }, { semitone: 9, beats: 0.5 }, { semitone: 9, beats: 0.5 },
    { semitone: 9, beats: 1.5 }, { semitone: 5, beats: 0.5 }, { semitone: 5, beats: 0.5 }, { semitone: 9, beats: 0.5 },
    // va-ting for a | mine, dwelt a
    { semitone: 12, beats: 1.5 }, { semitone: 12, beats: 0.5 }, { semitone: 10, beats: 0.5 }, { semitone: 9, beats: 0.5 },
    { semitone: 7, beats: 2 }, { semitone: 7, beats: 0.5 }, { semitone: 9, beats: 0.5 },
    // mi-ner, for-ty | ni-ner, and his
    { semitone: 10, beats: 1.5 }, { semitone: 10, beats: 0.5 }, { semitone: 9, beats: 0.5 }, { semitone: 7, beats: 0.5 },
    { semitone: 9, beats: 1.5 }, { semitone: 5, beats: 0.5 }, { semitone: 5, beats: 0.5 }, { semitone: 9, beats: 0.5 },
    // daugh-ter Clem-en- | tine.
    { semitone: 7, beats: 1.5 }, { semitone: 0, beats: 0.5 }, { semitone: 4, beats: 0.5 }, { semitone: 7, beats: 0.5 },
    { semitone: 5, beats: 2 },
  ],
};

/**
 * Good King Wenceslas — carol, words J. M. Neale (1853) to the spring tune
 * "Tempus adest floridum" from Piae Cantiones (1582); public domain.
 * Book Two's fourth tune and its first with two sharps. Run 303.
 *
 * Transcribed from the hymnal melody in G (4/4, quarters with half-note
 * phrase ends: GGGA GG D | EDEF♯ G G | … | DCBA G C | G), then transposed
 * up a fifth into D with the tonic on D5, so the tune sits on the staff
 * and only its high A (twice) takes a ledger line. C♯ is the leading tone
 * now, met four times ("feast OF Ste-phen", "crisp AND e-ven", "frost WAS
 * cru-el", "poor MAN came") and every one of them steps straight up to D: the
 * lesson Yankee Doodle teaches in G, carried one sharp further round.
 * Range A4–A5.
 */
export const GOOD_KING_WENCESLAS: Song = {
  id: 'good-king-wenceslas',
  title: 'Good King Wenceslas',
  beatsPerBar: 4,
  key: 'D',
  notes: [
    // Good King Wen-ces- | las looked out | on the feast of | Ste-phen,
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 9, beats: 2 },
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 13, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 14, beats: 2 },
    // when the snow lay | round a- bout, | deep and crisp and | e- ven;
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 9, beats: 2 },
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 13, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 14, beats: 2 },
    // bright-ly shone the | moon that night, | though the frost was | cru- el,
    { semitone: 21, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 18, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 18, beats: 1 }, { semitone: 16, beats: 1 }, { semitone: 14, beats: 2 },
    { semitone: 11, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 13, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 14, beats: 2 },
    // when a poor man | came in sight, | gath-'ring win-ter | fu- - | el.
    { semitone: 9, beats: 1 }, { semitone: 9, beats: 1 }, { semitone: 11, beats: 1 }, { semitone: 13, beats: 1 },
    { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 16, beats: 2 },
    { semitone: 21, beats: 1 }, { semitone: 19, beats: 1 }, { semitone: 18, beats: 1 }, { semitone: 16, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 19, beats: 2 },
    { semitone: 14, beats: 4 },
  ],
};

/**
 * When the Saints Go Marching In — traditional spiritual (sung well before
 * its first recordings in the 1920s; public domain). Book Two's fifth tune
 * and its first in B flat, two flats. Run 304.
 *
 * Transcribed from the setting every beginner's book gives in C (4/4, a
 * three-quarter pickup: C E F | G | - C E F | G | - C E F | G E | C E | D |
 * - E E D | C . . C | E G | G F | - - E F | G E | C D | C), then transposed
 * down a whole step into B flat. The home note itself now carries the
 * signature's flat, a first for the book; the second flat, E flat, tops
 * every rising three-note call ("oh when THE", "go march-ING") — fa,
 * climbing on to the held fifth. The
 * closing whole note keeps its full bar and the next verse's pickup takes
 * the last beat of a short breath bar, so the loop stays bar-true, as in
 * My Bonnie and Clementine. Range B♭4–F5: on the staff, no ledger lines.
 */
export const WHEN_THE_SAINTS: Song = {
  id: 'when-the-saints',
  title: 'When the Saints Go Marching In',
  beatsPerBar: 4,
  pickupBeats: 3,
  key: 'Bb',
  notes: [
    // Oh when the | saints
    { semitone: 10, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 15, beats: 1 },
    { semitone: 17, beats: 4 },
    // go march-ing | in — the echo of the call above
    { rest: true, semitone: 0, beats: 1 }, { semitone: 10, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 15, beats: 1 },
    { semitone: 17, beats: 4 },
    // oh when the | saints go | march-ing | in,
    { rest: true, semitone: 0, beats: 1 }, { semitone: 10, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 15, beats: 1 },
    { semitone: 17, beats: 2 }, { semitone: 14, beats: 2 },
    { semitone: 10, beats: 2 }, { semitone: 14, beats: 2 },
    { semitone: 12, beats: 4 },
    // oh Lord I | want to | be in | that num- | ber, when the
    { rest: true, semitone: 0, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 14, beats: 1 }, { semitone: 12, beats: 1 },
    { semitone: 10, beats: 3 }, { semitone: 10, beats: 1 },
    { semitone: 14, beats: 2 }, { semitone: 17, beats: 2 },
    { semitone: 17, beats: 1 }, { semitone: 15, beats: 3 },
    { rest: true, semitone: 0, beats: 2 }, { semitone: 14, beats: 1 }, { semitone: 15, beats: 1 },
    // saints go | march-ing | in. | (breath)
    { semitone: 17, beats: 2 }, { semitone: 14, beats: 2 },
    { semitone: 10, beats: 2 }, { semitone: 12, beats: 2 },
    { semitone: 10, beats: 4 },
    { rest: true, semitone: 0, beats: 1 },
  ],
};

/**
 * The accidentals volume. Its own list, not a biome set: Book Two is a
 * choice made after the festival, not scenery met on the road — the
 * volume-structure piece wires where these become reachable. Every song
 * here carries a key and is held to the keyed engraving rules.
 */
export const BOOK_TWO_SONGS: Song[] = [MY_BONNIE, YANKEE_DOODLE, CLEMENTINE, GOOD_KING_WENCESLAS, WHEN_THE_SAINTS];

/**
 * The song a biome plays on its `pass`-th time through, cycling. Falls back
 * to the village set for an unknown biome id.
 */
export function songForBiome(biomeId: string, pass = 0): Song {
  const set = SONGS_BY_BIOME[biomeId] ?? SONGS_BY_BIOME.village;
  return set[((pass % set.length) + set.length) % set.length];
}
