/**
 * The one thing about the songboard that cannot be judged from a frame.
 *
 * Every other property of the board — whether it sits well in the light,
 * whether the plank is too big, whether the ink reads — is a question a
 * screenshot answers. This one is not: the plank's margin is sized for the
 * *highest and lowest notes the songbook can ask for*, and most frames show a
 * tune sitting comfortably inside the staff, so a margin that has been cut too
 * far looks fine until the one bar that needs it arrives. A critique measured
 * the staff at 55 per cent of the plank's height and proposed taking the top
 * margin from 3.5 steps to 1.5; that would have put Old MacDonald's A5 and its
 * ledger line off the top edge of the board. This is the test that says so.
 *
 * It is written against the songbook rather than against a hardcoded step
 * range, so adding a tune that reaches higher fails here rather than in a
 * screenshot nobody takes.
 */
import { describe, expect, it } from 'vitest';
import { printableSteps } from './SongNotes';
import { SONGS } from '../../core/songs';
import { staffStepAt } from '../../core/notation';

function songbookRange(): { lowest: number; highest: number } {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const song of SONGS) {
    for (const note of song.notes) {
      const step = staffStepAt(note.semitone);
      if (step === null) continue;
      lowest = Math.min(lowest, step);
      highest = Math.max(highest, step);
    }
  }
  return { lowest, highest };
}

describe('the songboard has room for the songbook', () => {
  it('prints the highest note any tune reaches', () => {
    expect(printableSteps().highest).toBeGreaterThanOrEqual(songbookRange().highest);
  });

  it('prints the lowest note any tune reaches', () => {
    expect(printableSteps().lowest).toBeLessThanOrEqual(songbookRange().lowest);
  });

  it('is sized for notation and not for taste — the margin is nearly all used', () => {
    // Guards the change in the other direction. If the margin grows, the plank
    // grows with it and the board goes back to being signage across the
    // vanishing point, so the slack at each end is held under half a step.
    const { lowest, highest } = songbookRange();
    const printable = printableSteps();
    expect(printable.highest - highest).toBeLessThan(0.5);
    expect(lowest - printable.lowest).toBeLessThan(0.5);
  });
});
