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
