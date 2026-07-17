/**
 * Single source of truth for all procedural audio, per CLAUDE.md ("Keep
 * audio behind one manifest file"). Every layer (base loop now, additional
 * layers in ROADMAP task 8) is described here as data, not scattered
 * constants in scene/engine code.
 */

export interface LoopLayer {
  id: string;
  waveform: OscillatorType;
  /** Semitone offsets from `rootFrequencyHz`, one per beat, cycling. */
  pattern: number[];
  gain: number;
  noteDurationMs: number;
}

export interface AudioManifest {
  rootFrequencyHz: number;
  baseLoop: LoopLayer;
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
};
