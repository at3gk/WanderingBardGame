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
    gain: 0.05,
    noteDurationMs: 180,
  },
  layers: [
    {
      id: 'harmony',
      waveform: 'sine',
      pattern: [12, 12, 19, 17],
      gain: 0.04,
      noteDurationMs: 220,
      meterThreshold: 0.5,
    },
    {
      id: 'sparkle',
      waveform: 'triangle',
      pattern: [24, 19, 24, 28],
      gain: 0.03,
      noteDurationMs: 140,
      meterThreshold: 0.85,
    },
  ],
};
