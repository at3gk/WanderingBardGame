/**
 * The by-heart ladder's road surface (DESIGN.md, "The true goal": the end
 * goal is playing without the notes).
 *
 * A song the player has genuinely carried stops needing its ink in two
 * quiet steps: the note heads thin to ghosts, and then the staff comes
 * clean and the tune is kept alive from memory — rhythm recall, confirmed
 * at every strike by the bloom that never fades. This module decides which
 * step a song has earned. It deliberately answers for a *song*, not a
 * child: there is no score here, no fraction anywhere, and the only place
 * the answer is ever visible is the staff's own ink.
 *
 * Two gates, both required:
 * - The diary fact: how many passes of this song the player has walked
 *   with it pinned (`scaffoldStorage.songWalks`). Carrying is the claim
 *   the campfire and the festival make about a song, so carrying is what
 *   counts — a tune drifted past on the wander rotation was never carried.
 * - The model: every one of the song's staff positions must have earned
 *   its letter fully away (band 0). Heads fading before letters have
 *   faded would remove two prompts at once, which is not "one level up",
 *   it is a cliff.
 *
 * The safety rule is unchanged from the letters level — fade the prompt,
 *   never the answer — plus the stumble rule: a miss returns one level of
 * heads *instantly* for the rest of the pass (quick to help), and the
 * fade only resumes at the next pass boundary (slow to withdraw). That
 * arithmetic lives with the caller, because "the rest of the pass" is a
 * clock this module does not have; `shownLevel` is the one line of it
 * that must not drift.
 */

import { supportFor, type ScaffoldState } from './scaffold';

/** 0 = full heads, 1 = ghosts, 2 = a clean staff, from memory. */
export type HeadsLevel = 0 | 1 | 2;

/**
 * Passes carried before each step of the ladder may open. At the walk's
 * tempo a pass is tens of seconds, so ghosts arrive within a dedicated
 * evening or two of carrying one song, and the clean staff is a real
 * journey — which is the pacing the festival arc wants: by-heart is
 * rehearsed across campfires, not unlocked in a sitting.
 */
export const GHOST_WALKS = 6;
export const CLEAN_WALKS = 14;

/** Head alpha for each level. Ghosts still whisper; clean is clean. */
export const HEADS_ALPHA: Record<HeadsLevel, number> = { 0: 1, 1: 0.35, 2: 0 };

/**
 * The level a song has earned, from the model and the diary fact.
 *
 * A song with no playable positions never fades — there is nothing to
 * recall. An unseen position reads as band 4 (`supportFor` creates at
 * full support), which correctly holds the whole song at full heads
 * until every position has genuinely been met and learned.
 */
export function headsLevel(
  scaffold: ScaffoldState,
  steps: ReadonlyArray<number>,
  walks: number,
): HeadsLevel {
  if (steps.length === 0) return 0;
  for (const step of steps) {
    if (supportFor(scaffold, step) !== 0) return 0;
  }
  const carried = Math.max(0, Math.floor(Number.isFinite(walks) ? walks : 0));
  if (carried >= CLEAN_WALKS) return 2;
  if (carried >= GHOST_WALKS) return 1;
  return 0;
}

/**
 * What the staff actually shows right now: the earned level, less one per
 * stumble this pass, floored at full heads. Kept as its own function so
 * the demotion arithmetic is pinned by test rather than living loose in
 * a scene.
 */
export function shownLevel(earned: HeadsLevel, stumblesThisPass: number): HeadsLevel {
  const stumbles = Math.max(0, Math.floor(Number.isFinite(stumblesThisPass) ? stumblesThisPass : 0));
  return Math.max(0, earned - stumbles) as HeadsLevel;
}
