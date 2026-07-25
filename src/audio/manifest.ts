/**
 * Single source of truth for all procedural audio, per CLAUDE.md ("Keep
 * audio behind one manifest file"). `baseLoop` always plays; `layers` are
 * additional instrument voices that fade in/out as the song meter crosses
 * each one's `meterThreshold` (ROADMAP task 8), independent of `baseLoop`.
 */

export interface LoopLayer {
  id: string;
  waveform: OscillatorType;
  /** Transposition of the song's written pitches for this voice, in semitones (0 = as written). */
  semitoneOffset: number;
  gain: number;
  /** Sounding length of a one-beat (quarter) note; longer notes scale up from this. */
  noteDurationMs: number;
  /** Song-meter fraction (0–1) at/above which this layer is audible. Omitted (or 0) means always on — used by `baseLoop`. */
  meterThreshold?: number;
}

export interface AudioManifest {
  rootFrequencyHz: number;
  baseLoop: LoopLayer;
  layers: LoopLayer[];
}

// v0.3 (ROADMAP task 46): the melody now comes from `core/songs.ts` — real
// tunes, one per biome — so this manifest holds only *voicing*: timbre,
// level, note length, and each layer's transposition of the written
// pitches. The root stays MIDDLE C (C4), matching `core/notation.ts`, so a
// note drawn on the staff and the note sounded are the same note.
//
// The three voices are the bard's one instrument heard fully: the melody as
// written, an octave-below drone that fills in as the song holds together,
// and an octave-above sparkle for a really good run. Octaves can never
// clash with the tune and never introduce an accidental — whatever song is
// playing, every sounding pitch keeps the letter name on the staff.
export const AUDIO_MANIFEST: AudioManifest = {
  rootFrequencyHz: 261.63,
  baseLoop: {
    id: 'baseLoop',
    waveform: 'triangle',
    semitoneOffset: 0,
    gain: 0.05,
    noteDurationMs: 180,
  },
  layers: [
    {
      id: 'harmony',
      waveform: 'sine',
      semitoneOffset: -12,
      gain: 0.045,
      noteDurationMs: 260,
      meterThreshold: 0.5,
    },
    {
      id: 'sparkle',
      waveform: 'triangle',
      semitoneOffset: 12,
      gain: 0.025,
      noteDurationMs: 140,
      meterThreshold: 0.85,
    },
  ],
};
