import { LoopLayer } from './manifest';

/**
 * Whether a layer should be audible at a given song-meter fraction (0–1),
 * per its manifest `meterThreshold`. Pure so the fade-in/out rule is
 * covered by Vitest without touching Web Audio (ROADMAP task 8);
 * `AudioEngine` calls this to decide when to ramp a layer's gain.
 */
export function isLayerActive(meterRatio: number, layer: LoopLayer): boolean {
  return meterRatio >= (layer.meterThreshold ?? 0);
}
