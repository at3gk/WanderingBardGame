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
 *
 * With a song chosen it becomes **practice** (see `songStepSequence` and
 * `advanceSequence` below): the tune as a list of positions to find, one at
 * a time, at whatever pace suits. That is the only place in the game where
 * *reading the staff* — rather than remembering how the tune goes — is what
 * moves you forward, which is precisely the gap the walk cannot close.
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

/**
 * The chosen song as a plain sequence of staff positions to find.
 *
 * This is what turns free play from a ladder into practice. Rests are
 * dropped: a silence is part of reading rhythm, and rhythm is what the
 * *walk* teaches — here there is no clock at all, so a rest is just a step
 * with nothing to press, which would read as the game having stopped
 * responding.
 */
export function songStepSequence(song: Song | null | undefined): number[] {
  if (!song) return [];
  const steps: number[] = [];
  for (const note of song.notes) {
    if (note.rest) continue;
    const step = staffStepAt(note.semitone);
    if (step !== null) steps.push(step);
  }
  return steps;
}

/**
 * Where the sequence goes after a tap.
 *
 * The rule that makes this practice rather than a test: a wrong note
 * *sounds* and costs nothing — you simply have not moved on yet. There is
 * no penalty to apply, no streak to break and nothing to undo, so a child
 * exploring around the right answer is doing the thing this mode is for.
 * Reaching the end wraps to the beginning, because a tune you have just
 * finished is the one you are most likely to want again.
 */
export function advanceSequence(index: number, tappedStep: number, sequence: number[]): number {
  if (!sequence.length) return 0;
  const here = ((index % sequence.length) + sequence.length) % sequence.length;
  if (sequence[here] !== tappedStep) return here;
  return (here + 1) % sequence.length;
}
