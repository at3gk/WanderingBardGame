import { describe, expect, it } from 'vitest';
import { isLayerActive } from './layering';
import { LoopLayer } from './manifest';

const layer: LoopLayer = {
  id: 'test',
  waveform: 'sine',
  pattern: [0],
  gain: 0.04,
  noteDurationMs: 100,
  meterThreshold: 0.5,
};

describe('isLayerActive', () => {
  it('is inactive below the threshold', () => {
    expect(isLayerActive(0.49, layer)).toBe(false);
  });

  it('is active exactly at the threshold', () => {
    expect(isLayerActive(0.5, layer)).toBe(true);
  });

  it('is active above the threshold', () => {
    expect(isLayerActive(0.9, layer)).toBe(true);
  });

  it('defaults to always active when no threshold is set', () => {
    const alwaysOn: LoopLayer = { ...layer, meterThreshold: undefined };
    expect(isLayerActive(0, alwaysOn)).toBe(true);
  });
});
