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

// Human playtest (2026-07-25): the old 4-note loops read as "random", not
// intentional music. Recomposed as 8-beat phrases sharing one arch contour
// (rise to the octave, fall back), each biome voiced from a coherent scale
// off the A3 root so the phrase resolves instead of wandering:
//   village   — A major pentatonic (0 4 7 9 12): warm, home.
//   forest    — A minor pentatonic (0 3 7 10 12): same shape, darker.
//   riverside — open fourths/fifths (0 5 7 12 14): suspended, like water.
// `harmony`/`sparkle` double the phrase +1/+2 octaves (music-box style), so
// the per-beat biome diff is identical across all three layers by
// construction — they shift together at a transition and always stay
// in-scale with each other.
export const AUDIO_MANIFEST: AudioManifest = {
  rootFrequencyHz: 220,
  baseLoop: {
    id: 'baseLoop',
    waveform: 'triangle',
    pattern: [0, 4, 7, 9, 12, 9, 7, 4],
    patternByBiome: {
      forest: [0, 3, 7, 10, 12, 10, 7, 3],
      riverside: [0, 5, 7, 12, 14, 12, 7, 5],
    },
    gain: 0.05,
    noteDurationMs: 180,
  },
  layers: [
    {
      id: 'harmony',
      waveform: 'sine',
      pattern: [12, 16, 19, 21, 24, 21, 19, 16],
      patternByBiome: {
        forest: [12, 15, 19, 22, 24, 22, 19, 15],
        riverside: [12, 17, 19, 24, 26, 24, 19, 17],
      },
      gain: 0.04,
      noteDurationMs: 220,
      meterThreshold: 0.5,
    },
    {
      id: 'sparkle',
      waveform: 'triangle',
      pattern: [24, 28, 31, 33, 36, 33, 31, 28],
      patternByBiome: {
        forest: [24, 27, 31, 34, 36, 34, 31, 27],
        riverside: [24, 29, 31, 36, 38, 36, 31, 29],
      },
      gain: 0.03,
      noteDurationMs: 140,
      meterThreshold: 0.85,
    },
  ],
};
