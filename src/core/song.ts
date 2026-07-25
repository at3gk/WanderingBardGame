import { Beat, beatIntervalMs } from './beats';

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
  /** Semitones from middle C (C4). Naturals only — see core/notation.ts. */
  semitone: number;
  /** Length in beats. */
  beats: number;
}

export interface Song {
  id: string;
  title: string;
  beatsPerBar: number;
  notes: SongNote[];
}

/** A song note placed on the timeline — a `Beat` that knows what it is. */
export interface SongBeat extends Beat {
  semitone: number;
  beats: number;
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
    return { index: indexOffset + i, hitTimeMs, semitone: note.semitone, beats: note.beats };
  });
}
