/**
 * The three biome ids the road cycles through (ROADMAP task 9 added the
 * second; task 15 generalized this to N). `road.ts` uses this list to pick
 * how many bands a run gets and which id each one carries; the audio layer
 * mirrors the same ids independently (`audio/ambience.ts`'s
 * `AMBIENCE_BIOMES`). Everything about what a biome actually *looks* like —
 * colour, density, skyline — now lives in `three/world/palette.ts`; this
 * file used to carry that too (2D-era `skyColor`/`sceneryColor`/etc. fields
 * and a `biomeBlendAt`/`signpostDistanceAt` crossfade system) but none of it
 * had a consumer left after the v0.6 Three.js migration, and it was removed
 * as dead weight (STATE.md's run-211 handoff) rather than kept "just in
 * case."
 */
export interface Biome {
  id: string;
}

export const BIOMES: Biome[] = [{ id: 'village' }, { id: 'forest' }, { id: 'riverside' }];
