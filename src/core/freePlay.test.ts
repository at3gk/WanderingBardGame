import { describe, expect, it } from 'vitest';
import {
  FREE_PLAY_HIGH_STEP,
  FREE_PLAY_LOW_STEP,
  freePlayStaff,
  freePlayStepAt,
  freePlayStepY,
  MIN_STEP_BAND,
} from './freePlay';
import { noteNameAtStep, semitoneAtStep } from './notation';
import { advanceSequence, songStepSequence, stepsUsedBy } from './freePlay';
import { ITSY_BITSY_SPIDER, MARY_HAD_A_LITTLE_LAMB, ODE_TO_JOY, SONGS } from './songs';

const VIEWPORTS: Array<[string, number]> = [
  ['narrow 320', 568],
  ['iPhone SE', 667],
  ['iPhone 12', 664],
  ['landscape', 390],
  ['iPad', 1024],
  ['desktop', 600],
];

describe('the free-play staff', () => {
  it('gives every offered note a touch target a finger can actually hit', () => {
    // The reason this mode gets its own geometry at all: during the walk
    // the steps are 9px apart, and a fingertip covers four of them.
    for (const [name, h] of VIEWPORTS) {
      const staff = freePlayStaff(h, 70, 60);
      expect(staff.stepGap, name).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    }
  });

  it('maps a tap back to the step it was aimed at', () => {
    const staff = freePlayStaff(667, 70, 60);
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      expect(freePlayStepAt(freePlayStepY(step, staff), staff), `step ${step}`).toBe(step);
    }
  });

  it('is forgiving within a step, in both directions', () => {
    const staff = freePlayStaff(667, 70, 60);
    const nudge = staff.stepGap * 0.45;
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      const y = freePlayStepY(step, staff);
      expect(freePlayStepAt(y - nudge, staff), `above ${step}`).toBe(step);
      expect(freePlayStepAt(y + nudge, staff), `below ${step}`).toBe(step);
    }
  });

  it('plays the nearest note rather than nothing when aimed off the ends', () => {
    // In a mode with no failure state, an input that does nothing is the
    // only thing that can feel like a mistake.
    const staff = freePlayStaff(667, 70, 60);
    expect(freePlayStepAt(staff.topY - 500, staff)).toBe(FREE_PLAY_HIGH_STEP);
    expect(freePlayStepAt(staff.bottomY + 500, staff)).toBe(FREE_PLAY_LOW_STEP);
  });

  it('runs low pitch at the bottom and high at the top, like written music', () => {
    const staff = freePlayStaff(667, 70, 60);
    expect(freePlayStepY(FREE_PLAY_LOW_STEP, staff)).toBeGreaterThan(freePlayStepY(FREE_PLAY_HIGH_STEP, staff));
  });

  it('covers exactly the range the songbook draws, naming every step', () => {
    expect(semitoneAtStep(FREE_PLAY_LOW_STEP)).toBe(0); // middle C
    expect(semitoneAtStep(FREE_PLAY_HIGH_STEP)).toBe(21); // A5
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      expect(noteNameAtStep(step)).toMatch(/^[A-G]$/);
    }
  });

  it('still lays out on a screen far too short for the notes', () => {
    // It overflows rather than crushing the targets — a scrollable
    // overflow is recoverable, an unhittable note is not.
    const staff = freePlayStaff(120, 70, 60);
    expect(staff.stepGap).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    expect(freePlayStepAt(freePlayStepY(7, staff), staff)).toBe(7);
  });
});

describe('marking the chosen song\'s notes', () => {
  it('marks exactly the positions the tune uses', () => {
    // Mary is C D E G — four notes, and famously no F.
    expect([...stepsUsedBy(MARY_HAD_A_LITTLE_LAMB)].sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
  });

  it('marks nothing when wandering', () => {
    expect(stepsUsedBy(null).size).toBe(0);
    expect(stepsUsedBy(undefined).size).toBe(0);
  });

  it('only ever marks positions free play actually offers', () => {
    // A song whose notes fell outside the ladder would draw pips against
    // rows that are not there.
    for (const song of SONGS) {
      for (const step of stepsUsedBy(song)) {
        expect(step, `${song.id} step ${step}`).toBeGreaterThanOrEqual(FREE_PLAY_LOW_STEP);
        expect(step, `${song.id} step ${step}`).toBeLessThanOrEqual(FREE_PLAY_HIGH_STEP);
      }
    }
  });

  it('leaves plenty unmarked — the point is that it narrows the ladder', () => {
    // If a song used every position the marking would say nothing.
    const span = FREE_PLAY_HIGH_STEP - FREE_PLAY_LOW_STEP + 1;
    expect(stepsUsedBy(MARY_HAD_A_LITTLE_LAMB).size).toBeLessThan(span / 2);
    expect(stepsUsedBy(ODE_TO_JOY).size).toBeLessThan(span);
  });
});

describe('playing a chosen song at your own pace', () => {
  const mary = songStepSequence(MARY_HAD_A_LITTLE_LAMB);

  it('is the tune in order, as positions to find', () => {
    // "Mary had a little lamb" opens E D C D E E E.
    expect(mary.slice(0, 7)).toEqual([2, 1, 0, 1, 2, 2, 2]);
    expect(mary.length).toBe(MARY_HAD_A_LITTLE_LAMB.notes.filter((n) => !n.rest).length);
  });

  it('drops rests — there is no clock here, so a silence has nothing to press', () => {
    const spider = songStepSequence(ITSY_BITSY_SPIDER);
    expect(spider.length).toBe(ITSY_BITSY_SPIDER.notes.filter((n) => !n.rest).length);
    expect(spider.length).toBeLessThan(ITSY_BITSY_SPIDER.notes.length);
  });

  it('moves on when the right note is found', () => {
    expect(advanceSequence(0, mary[0], mary)).toBe(1);
    expect(advanceSequence(5, mary[5], mary)).toBe(6);
  });

  it('stays put on a wrong note, and costs nothing', () => {
    // The rule that makes this practice rather than a test.
    const wrong = mary[0] === 5 ? 6 : 5;
    expect(advanceSequence(0, wrong, mary)).toBe(0);
    expect(advanceSequence(3, wrong, mary)).toBe(3);
  });

  it('wraps at the end, because you will want it again', () => {
    const last = mary.length - 1;
    expect(advanceSequence(last, mary[last], mary)).toBe(0);
  });

  it('survives an out-of-range index rather than reading past the end', () => {
    expect(advanceSequence(mary.length + 4, mary[4], mary)).toBe(5);
    expect(advanceSequence(-1, mary[mary.length - 1], mary)).toBe(0);
  });

  it('does nothing at all when wandering', () => {
    expect(songStepSequence(null)).toEqual([]);
    expect(advanceSequence(0, 4, [])).toBe(0);
  });
});
