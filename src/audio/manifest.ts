/**
 * Single source of truth for all procedural audio, per CLAUDE.md ("Keep
 * audio behind one manifest file"). `baseLoop` always plays; `layers` are
 * additional instrument voices that fade in/out as the song meter crosses
 * each one's `meterThreshold` (ROADMAP task 8), independent of `baseLoop`.
 */

export interface LoopLayer {
  id: string;
  waveform: OscillatorType;
  /** Semitone offsets from `rootFrequencyHz`, one per beat, cycling. */
  pattern: number[];
  /** Per-biome override of `pattern`, keyed by `Biome.id`. Falls back to `pattern` for any biome not listed. */
  patternByBiome?: Record<string, number[]>;
  gain: number;
  noteDurationMs: number;
  /** Song-meter fraction (0–1) at/above which this layer is audible. Omitted (or 0) means always on — used by `baseLoop`. */
  meterThreshold?: number;
}

export interface AudioManifest {
  rootFrequencyHz: number;
  baseLoop: LoopLayer;
  layers: LoopLayer[];
}

// v0.2 teaching re-voice (ROADMAP task 41; DESIGN.md Pedagogy): the root
// moves from A3 to MIDDLE C (C4) and every pattern is spelled in naturals
// only — the game world is C major / A minor, so every note the staff
// shows has a one-letter name and the notation is never wrong. Each biome
// is a curriculum region of the treble staff, 8-beat arch phrases as
// before:
//   village   — first notes:  C D E G A around middle C (the ledger line).
//   forest    — climbing:     G A C5 D5 E5 in the staff's upper half.
//   riverside — leaps:        C D G A D5 across the whole range.
// `harmony` doubles the phrase +1 octave; `sparkle` sits +19 (an octave
// and a fifth — richer than plain octaves, and +7 pitch-classes maps
// naturals to naturals so the no-accidentals rule holds). Per-beat biome
// diffs stay identical across layers by construction, so they shift
// together at a transition and never leave the scale.
export const AUDIO_MANIFEST: AudioManifest = {
  rootFrequencyHz: 261.63,
  baseLoop: {
    id: 'baseLoop',
    waveform: 'triangle',
    pattern: [0, 2, 4, 7, 9, 7, 4, 2],
    patternByBiome: {
      forest: [7, 9, 12, 14, 16, 14, 12, 9],
      riverside: [0, 2, 7, 9, 14, 9, 7, 2],
    },
    gain: 0.05,
    noteDurationMs: 180,
  },
  layers: [
    {
      id: 'harmony',
      waveform: 'sine',
      pattern: [12, 14, 16, 19, 21, 19, 16, 14],
      patternByBiome: {
        forest: [19, 21, 24, 26, 28, 26, 24, 21],
        riverside: [12, 14, 19, 21, 26, 21, 19, 14],
      },
      gain: 0.04,
      noteDurationMs: 220,
      meterThreshold: 0.5,
    },
    {
      id: 'sparkle',
      waveform: 'triangle',
      pattern: [19, 21, 23, 26, 28, 26, 23, 21],
      patternByBiome: {
        forest: [26, 28, 31, 33, 35, 33, 31, 28],
        riverside: [19, 21, 26, 28, 33, 28, 26, 21],
      },
      gain: 0.03,
      noteDurationMs: 140,
      meterThreshold: 0.85,
    },
  ],
};
