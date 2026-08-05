/**
 * How worn a songbook page looks — from walks alone.
 *
 * This reads the diary fact and nothing else. It never touches the scaffold
 * model, and it must not: a page that got prettier as the letters faded
 * would be a grade in costume, which the pedagogy rule forbids as firmly as
 * a printed percentage would be. Walks are a record of time spent carrying
 * a tune, not of how well it went, so wear can only ever say "this one has
 * been on the road with you" — which is what a thumbed page says too.
 *
 * The thresholds are `mastery.ts`'s own (GHOST_WALKS, CLEAN_WALKS), reused
 * rather than reinvented so the page and the staff age on one clock.
 */

import { CLEAN_WALKS, GHOST_WALKS } from './mastery';

/** 0 = untouched, 3 = well-thumbed. Never shown as a number. */
export type WearTier = 0 | 1 | 2 | 3;

/** The tier a page has earned. Junk, negatives and zero all read as untouched. */
export function wearTier(walks: number): WearTier {
  if (!Number.isFinite(walks) || walks < 1) return 0;
  const carried = Math.floor(walks);
  if (carried >= CLEAN_WALKS) return 3;
  if (carried >= GHOST_WALKS) return 2;
  return 1;
}
