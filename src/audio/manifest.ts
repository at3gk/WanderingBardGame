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

export const AUDIO_MANIFEST: AudioManifest = {
  rootFrequencyHz: 220,
  baseLoop: {
    id: 'baseLoop',
    waveform: 'triangle',
    pattern: [0, 0, 7, 5],
    patternByBiome: {
      forest: [0, 3, 7, 3],
      riverside: [0, 5, 9, 5],
    },
    gain: 0.05,
    noteDurationMs: 180,
  },
  // `harmony`/`sparkle` biome overrides below apply the same per-beat
  // semitone diff as `baseLoop`'s own forest/riverside overrides (e.g.
  // forest is +[0,3,0,-2] over the base pattern) so all three layers shift
  // together at a biome transition instead of only the base melody moving.
  layers: [
    {
      id: 'harmony',
      waveform: 'sine',
      pattern: [12, 12, 19, 17],
      patternByBiome: {
        forest: [12, 15, 19, 15],
        riverside: [12, 17, 21, 17],
      },
      gain: 0.04,
      noteDurationMs: 220,
      meterThreshold: 0.5,
    },
    {
      id: 'sparkle',
      waveform: 'triangle',
      pattern: [24, 19, 24, 28],
      patternByBiome: {
        forest: [24, 22, 24, 26],
        riverside: [24, 24, 26, 28],
      },
      gain: 0.03,
      noteDurationMs: 140,
      meterThreshold: 0.85,
    },
  ],
};
