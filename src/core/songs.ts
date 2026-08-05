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
 * The accidentals volume. Its own list, not a biome set: Book Two is a
 * choice made after the festival, not scenery met on the road — the
 * volume-structure piece wires where these become reachable. Every song
 * here carries a key and is held to the keyed engraving rules.
 */
export const BOOK_TWO_SONGS: Song[] = [MY_BONNIE];

/**
 * The song a biome plays on its `pass`-th time through, cycling. Falls back
 * to the village set for an unknown biome id.
 */
export function songForBiome(biomeId: string, pass = 0): Song {
  const set = SONGS_BY_BIOME[biomeId] ?? SONGS_BY_BIOME.village;
  return set[((pass % set.length) + set.length) % set.length];
}
