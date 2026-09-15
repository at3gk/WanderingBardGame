/**
 * Per-hour, per-biome fog reach (ROADMAP task 193 piece 2, wiring the spec
 * `docs/color-script.md`'s "Fog reach" section wrote in piece 1).
 *
 * `uFogNear`/`uFogFar` used to be set once, at scene construction, from
 * `TERRAIN_REACH` alone (`RoadStage.ts`) — the same constant for every hour
 * and every biome. This module is the authored schedule the spec asked for,
 * driven off the same `sunDirection.y` every other hour-keyed mechanism
 * here already reads (`landKey.ts`, `valueFloor.ts`):
 *
 * - **Night** wants the SHORTEST reach of the day — the fire is the one
 *   light event, and a fog edge reaching as far as noon's dilutes it.
 * - **Dawn/golden** (both "carrying", value-led hours) want a LONGER reach
 *   than noon, so the raking ladder and the long casts recede gradually
 *   into light-filled air instead of getting cut off.
 * - **Noon** wants the treeline anchor kept CLOSER and clearer — colour is
 *   noon's whole carrying mechanism, and it reads worst exactly where fog
 *   has already desaturated it.
 *
 * Sun heights (`sunDirection.y`) for the named hours, from `sky.ts`'s
 * `SKY_KEYS`, for reference: deep night -0.48, dusk -0.10, first light
 * -0.04, golden 0.12, dawn 0.16, afternoon 0.33, morning 0.37, noon 0.64.
 * The schedule below is a single smooth curve rather than eight discrete
 * cases: night ramps up into the dawn/golden plateau (0.06-0.20, which
 * covers both without a seam), then the plateau ramps back down into
 * noon's own low by 0.55, same shape hourKeyMode/lowSunFloorAmount use for
 * their own bands.
 *
 * The near/far pair themselves are geometry, not hour, and were solved for
 * once when they first shipped (RoadStage.ts, task 143/166's aerial-
 * perspective work): with the terrain ribbon reaching 165 m, the sixty-
 * metre treeline is to keep nearly all of its own tone (about a twelfth
 * veiled) and the ribbon's far edge is to be mostly air (about three
 * quarters) — the one pair of smoothstep edges that does both comes out at
 * a twelfth and about one-and-a-half times TERRAIN_REACH. That shape is
 * right at every hour; only how far out it sits moves, so both ends scale
 * by the same multiplier here and the shape never distorts.
 */

/** RoadStage's original constants, as a fraction of TERRAIN_REACH. */
export const FOG_NEAR_BASE = 0.12;
export const FOG_FAR_BASE = 1.47;

/** Reach multiplier at full night — the shortest of the day. */
export const REACH_NIGHT = 0.6;
/** Reach multiplier across the dawn/golden plateau — the longest. */
export const REACH_HORIZON = 1.3;
/** Reach multiplier at noon and beyond — short, for a clear treeline. */
export const REACH_NOON = 0.8;

/** Full night below here. */
export const REACH_NIGHT_FULL = -0.2;
/** The dawn/golden plateau: covers golden (0.12) and dawn (0.16) both. */
export const REACH_HORIZON_FULL_LO = 0.06;
export const REACH_HORIZON_FULL_HI = 0.2;
/** Noon's pull is fully in by here (noon itself sits at 0.64). */
export const REACH_NOON_IN = 0.55;

/**
 * Riverside's water band is the hour's one guaranteed saturated read (see
 * "The biomes under the script" in color-script.md) — fog desaturating it
 * before it reaches the camera would compete with that, so riverside gets
 * a longer reach than the same hour elsewhere, independent of the hour
 * schedule below.
 */
export const RIVERSIDE_REACH_BONUS = 1.15;

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** The hour's own reach multiplier, before any per-biome adjustment. */
export function fogReachMultiplier(sunHeight: number): number {
  if (sunHeight <= REACH_HORIZON_FULL_LO) {
    const t = smooth01(
      (sunHeight - REACH_NIGHT_FULL) / (REACH_HORIZON_FULL_LO - REACH_NIGHT_FULL),
    );
    return REACH_NIGHT + (REACH_HORIZON - REACH_NIGHT) * t;
  }
  if (sunHeight <= REACH_HORIZON_FULL_HI) return REACH_HORIZON;
  const t = smooth01((sunHeight - REACH_HORIZON_FULL_HI) / (REACH_NOON_IN - REACH_HORIZON_FULL_HI));
  return REACH_HORIZON + (REACH_NOON - REACH_HORIZON) * t;
}

export interface FogReach {
  near: number;
  far: number;
}

/**
 * The fog near/far for a frame, in world units (already scaled by
 * `terrainReach`). `biome` is read loosely (as `RoadStage.ts` already reads
 * it against `LAND_KEYS`) since `biomeAt` returns a plain string; anything
 * other than `'riverside'` gets the hour's reach unchanged.
 */
export function fogReachAt(sunHeight: number, biome: string, terrainReach: number): FogReach {
  const mult =
    fogReachMultiplier(sunHeight) * (biome === 'riverside' ? RIVERSIDE_REACH_BONUS : 1);
  return {
    near: terrainReach * FOG_NEAR_BASE * mult,
    far: terrainReach * FOG_FAR_BASE * mult,
  };
}
