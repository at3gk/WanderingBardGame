import { describe, expect, it } from 'vitest';
import { noteNameAt } from '../core/notation';
import { AUDIO_MANIFEST } from './manifest';

describe('AUDIO_MANIFEST', () => {
  it('roots the manifest at middle C so staff positions match sounded pitches', () => {
    expect(AUDIO_MANIFEST.rootFrequencyHz).toBeCloseTo(261.63, 2);
  });

  it('transposes every layer by whole octaves, so no voice can introduce an accidental', () => {
    // Songs are naturals-only (songs.test.ts). An octave keeps a note's
    // letter name, so the sounding chord always agrees with the staff —
    // any other interval could voice a C as an F#.
    const allLayers = [AUDIO_MANIFEST.baseLoop, ...AUDIO_MANIFEST.layers];
    for (const layer of allLayers) {
      expect(Math.abs(layer.semitoneOffset % 12), `${layer.id} offset`).toBe(0);
      for (const semitone of [0, 2, 4, 5, 7, 9, 11]) {
        expect(noteNameAt(semitone + layer.semitoneOffset)).toBe(noteNameAt(semitone));
      }
    }
  });

  it('keeps the melody the loudest voice', () => {
    for (const layer of AUDIO_MANIFEST.layers) {
      expect(layer.gain, `${layer.id} gain`).toBeLessThanOrEqual(AUDIO_MANIFEST.baseLoop.gain);
    }
  });

  it('brings extra voices in at rising meter thresholds, none of them always-on', () => {
    expect(AUDIO_MANIFEST.baseLoop.meterThreshold).toBeUndefined();
    const thresholds = AUDIO_MANIFEST.layers.map((l) => l.meterThreshold ?? 0);
    expect(thresholds.every((t) => t > 0)).toBe(true);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });
});
