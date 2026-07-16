export interface SongMeterConfig {
  max: number;
  hitGain: number;
  missDrain: number;
  walkingThreshold: number;
}

export const DEFAULT_SONG_METER_CONFIG: SongMeterConfig = {
  max: 100,
  hitGain: 8,
  missDrain: 14,
  walkingThreshold: 40,
};

/** Meter value after a hit, clamped to the configured max. */
export function applyHit(meter: number, config: SongMeterConfig): number {
  return Math.min(config.max, meter + config.hitGain);
}

/** Meter value after a miss, clamped to zero. */
export function applyMiss(meter: number, config: SongMeterConfig): number {
  return Math.max(0, meter - config.missDrain);
}

/** Walking-vs-stopped state derived from the meter, per DESIGN.md. */
export function isWalking(meter: number, config: SongMeterConfig): boolean {
  return meter >= config.walkingThreshold;
}
