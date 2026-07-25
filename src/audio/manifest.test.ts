import { describe, expect, it } from 'vitest';
import { resolvePattern } from './baseLoop';
import { noteNameAt } from '../core/notation';
import { AUDIO_MANIFEST } from './manifest';

describe('AUDIO_MANIFEST layer biome patterns', () => {
  it('gives every layer (base loop and additional layers) a forest and riverside override', () => {
    const allLayers = [AUDIO_MANIFEST.baseLoop, ...AUDIO_MANIFEST.layers];
    for (const layer of allLayers) {
      expect(layer.patternByBiome?.forest, `${layer.id} forest pattern`).toBeDefined();
      expect(layer.patternByBiome?.riverside, `${layer.id} riverside pattern`).toBeDefined();
    }
  });

  it('falls back to the base pattern for village (no override) on every layer', () => {
    const allLayers = [AUDIO_MANIFEST.baseLoop, ...AUDIO_MANIFEST.layers];
    for (const layer of allLayers) {
      expect(resolvePattern(layer, 'village')).toEqual(layer.pattern);
    }
  });

  it('shifts harmony and sparkle by the same per-beat diff as the base loop at each biome', () => {
    const diff = (pattern: number[], base: number[]) => pattern.map((n, i) => n - base[i]);
    const baseLoopForestDiff = diff(AUDIO_MANIFEST.baseLoop.patternByBiome!.forest, AUDIO_MANIFEST.baseLoop.pattern);
    const baseLoopRiversideDiff = diff(
      AUDIO_MANIFEST.baseLoop.patternByBiome!.riverside,
      AUDIO_MANIFEST.baseLoop.pattern
    );

    for (const layer of AUDIO_MANIFEST.layers) {
      expect(diff(layer.patternByBiome!.forest, layer.pattern)).toEqual(baseLoopForestDiff);
      expect(diff(layer.patternByBiome!.riverside, layer.pattern)).toEqual(baseLoopRiversideDiff);
    }
  });

  it('uses only natural notes in every pattern of every layer — the staff must never show an accidental (v0.2 Pedagogy)', () => {
    const allLayers = [AUDIO_MANIFEST.baseLoop, ...AUDIO_MANIFEST.layers];
    for (const layer of allLayers) {
      const patterns: Array<[string, number[]]> = [
        ['base', layer.pattern],
        ...Object.entries(layer.patternByBiome ?? {}),
      ];
      for (const [which, pattern] of patterns) {
        for (const semitone of pattern) {
          expect(noteNameAt(semitone), `${layer.id}/${which} semitone ${semitone}`).not.toBeNull();
        }
      }
    }
  });

  it('roots the manifest at middle C so staff positions match sounded pitches', () => {
    expect(AUDIO_MANIFEST.rootFrequencyHz).toBeCloseTo(261.63, 2);
  });
});
