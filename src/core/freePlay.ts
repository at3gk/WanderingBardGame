/**
 * Free play: the staff as an instrument.
 *
 * The walk hands a child notes and asks for timing. That teaches the beat
 * and, through the fading letters, the position→name association — but
 * DESIGN.md is honest that a tap proves timing rather than reading, because
 * knowing the tune tells you when to tap whatever is written.
 *
 * This is the inverse, and the point of having both. Nothing scrolls,
 * nothing is asked, nothing can be missed. The child points at a line or a
 * space and hears what it is. Position → sound → name, at their own pace,
 * chosen by them rather than presented to them — which is the one direction
 * the walk cannot exercise.
 *
 * It deliberately does **not** feed the learning model. A note the child
 * picked is not evidence that they can read one the game picked, and
 * quietly fading letters on the strength of poking about would corrupt the
 * only signal the scaffold has.
 */

import { Song } from './song';
import { staffStepAt } from './notation';

/** One ledger below middle C up to one ledger above the staff — the range the songbook draws. */
export const FREE_PLAY_LOW_STEP = 0;
export const FREE_PLAY_HIGH_STEP = 12;

/**
 * The minimum a touch target may shrink to. Well under the 44px Apple asks
 * for, because thirteen of them have to share a phone's height — but a
 * deliberate poke at a stationary target is a far easier gesture than a
 * timed tap, and the alternative is offering fewer notes than the songs
 * use.
 */
export const MIN_STEP_BAND = 26;

export interface FreePlayStaff {
  /** Vertical distance between adjacent steps (a line to its neighbouring space). */
  stepGap: number;
  /** Screen y of the lowest offered step. */
  bottomY: number;
  /** Screen y of the highest offered step. */
  topY: number;
}

/**
 * Lays the free-play staff out to fill the height available.
 *
 * During the walk the steps sit 9px apart, which is fine to read and
 * impossible to aim at — a fingertip covers four of them. With nothing
 * scrolling there is no reason to be that small, so free play spreads the
 * same thirteen positions over whatever room the screen has.
 */
export function freePlayStaff(viewportH: number, topMargin: number, bottomMargin: number): FreePlayStaff {
  const steps = FREE_PLAY_HIGH_STEP - FREE_PLAY_LOW_STEP;
  const usable = Math.max(steps * MIN_STEP_BAND, viewportH - topMargin - bottomMargin);
  const stepGap = usable / steps;
  const bottomY = topMargin + usable;
  return { stepGap, bottomY, topY: topMargin };
}

/** Screen y of a staff step in free play. */
export function freePlayStepY(step: number, staff: FreePlayStaff): number {
  return staff.bottomY - (step - FREE_PLAY_LOW_STEP) * staff.stepGap;
}

/**
 * Which step a tap at `y` means — the nearest one, clamped to the range.
 *
 * Nearest rather than "inside a band" on purpose: a tap slightly above the
 * top note or below the bottom one should play that note, not nothing. In
 * a mode with no failure state, an input that does nothing is the only
 * thing that can feel like a mistake.
 */
export function freePlayStepAt(y: number, staff: FreePlayStaff): number {
  const raw = FREE_PLAY_LOW_STEP + (staff.bottomY - y) / staff.stepGap;
  return Math.max(FREE_PLAY_LOW_STEP, Math.min(FREE_PLAY_HIGH_STEP, Math.round(raw)));
}

/**
 * Which staff positions a song actually uses.
 *
 * Free play on its own is a ladder with no suggestion of where to start.
 * Marking the notes of the tune the child chose turns it into "here are
 * the ones in Twinkle, try those" — a pointer rather than an instruction,
 * which matters when the player cannot read.
 */
export function stepsUsedBy(song: Song | null | undefined): Set<number> {
  const steps = new Set<number>();
  if (!song) return steps;
  for (const note of song.notes) {
    if (note.rest) continue;
    const step = staffStepAt(note.semitone);
    if (step !== null) steps.add(step);
  }
  return steps;
}
