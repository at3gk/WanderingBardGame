import { Beat, beatIntervalMs } from './beats';
import { majorKey, type KeySignature } from './notation';

/**
 * Written melodies (ROADMAP task 45; DESIGN.md Pedagogy). v0.2 taught note
 * *names* from generated patterns; v0.3 teaches from real songs a child
 * already knows, because recognizing the tune is what makes the notation
 * mean something. A song is just pitches and durations — the same data a
 * page of sheet music carries.
 *
 * Durations are in beats (1 = quarter, 2 = half, 4 = whole, 0.5 = eighth,
 * 1.5 = dotted quarter). This is how note values enter the game *without*
 * touching the one-tap mechanic: a half note isn't held, it simply takes
 * twice as long to arrive, so the player feels its length in the waiting.
 */

export interface SongNote {
  /** Semitones from middle C (C4). Naturals only — see core/notation.ts. Ignored for a rest. */
  semitone: number;
  /** Length in beats. */
  beats: number;
  /**
   * A written silence. It occupies its time like any note — the next note
   * still waits for it — but nothing sounds and nothing is tapped. Rests
   * are half of reading rhythm, so they get their own symbol on the staff
   * rather than being an invisible gap.
   */
  rest?: true;
}

export interface Song {
  id: string;
  title: string;
  beatsPerBar: number;
  notes: SongNote[];
  /**
   * Anacrusis: how many beats of pickup open the song before its first
   * full bar (the "My BON-nie" upbeat). An engraving fact only — like
   * `beatsPerBar` it never changes how the timeline expands, because this
   * engine's durations are arrival spacing either way. The bar-integrity
   * tests offset their grid by it, and a looping song's final bar is
   * short by exactly this much, so the seam completes the bar: the tune
   * hands its own upbeat back. Absent means none, which is every Book
   * One song.
   */
  pickupBeats?: number;
  /**
   * Major key the song is written in, by name ('G', 'F', 'Bb', …) —
   * resolved through notation.ts's `majorKey`. Absent means C major:
   * Book One's whole world, where every pitch is a natural and no
   * signature is drawn. Only Book Two songs carry one (task 165), and a
   * keyed song's notes are semitone-exact like everyone else's — the
   * spelling (letter, signature, shown accidental) derives from the key
   * at engraving time via `spellInKey`, so the page and the ear cannot
   * disagree.
   */
  key?: string;
}

/**
 * The song's key signature. An absent key reads as C major rather than
 * null, because keyless is Book One's contract, not an error; an unknown
 * key *name* answers null rather than guessing — a shipped song with an
 * unresolvable key is a bug the engraving tests exist to catch.
 */
export function songKey(song: Song): KeySignature | null {
  return song.key === undefined ? { fifths: 0 } : majorKey(song.key);
}

/** A song note placed on the timeline — a `Beat` that knows what it is. */
export interface SongBeat extends Beat {
  semitone: number;
  beats: number;
  rest?: true;
}

/** Total length of one repetition, in beats. */
export function songLengthBeats(song: Song): number {
  return song.notes.reduce((total, note) => total + note.beats, 0);
}

/** Total length of one repetition, in milliseconds at the given tempo. */
export function songDurationMs(song: Song, bpm: number): number {
  return songLengthBeats(song) * beatIntervalMs(bpm);
}

/**
 * Places one repetition of a song on the timeline. Like
 * `generateBeatSchedule`, the first note lands one beat after
 * `startTimeMs` so the player gets a beat of runway; each following note
 * lands after the *previous* note's own duration, which is what makes a
 * half note feel twice as long.
 *
 * Advancing `startTimeMs` by `songDurationMs` schedules the next
 * repetition seamlessly: the seam between the last note of one pass and
 * the first of the next is exactly the last note's written length.
 */
export function expandSong(song: Song, bpm: number, startTimeMs = 0, indexOffset = 0): SongBeat[] {
  const interval = beatIntervalMs(bpm);
  let cursorBeats = 0;
  return song.notes.map((note, i) => {
    const hitTimeMs = startTimeMs + interval * (1 + cursorBeats);
    cursorBeats += note.beats;
    const placed: SongBeat = { index: indexOffset + i, hitTimeMs, semitone: note.semitone, beats: note.beats };
    if (note.rest) placed.rest = true;
    return placed;
  });
}
