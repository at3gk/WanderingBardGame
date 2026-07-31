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
import { Color } from 'three';
import {
  FLOOR_WARMTH,
  PAINTERLY_CONSTANTS,
  boardSpan,
  painterlyConstant,
  printableSteps,
  unitLuminance,
} from './SongNotes';
import { createPainterlyGlobals, createPainterlyMaterial } from '../painterly';
import { SONGS } from '../../core/songs';
import { staffStepAt } from '../../core/notation';
import { beatIntervalMs } from '../../core/beats';
import { INSTRUMENTS } from '../../core/instruments';

/**
 * The tempo the busk runs at, which lives in `RoadStage.ts` as `BASE_BPM` and
 * is not exported. Restated here rather than imported because this file is
 * about the *board*, and reaching into the stage for one number would couple
 * the notation's geometry to the scene that happens to drive it. If the busk
 * is ever re-pitched, this is the line that has to follow it — and the
 * assertions below carry enough margin to say so loudly rather than quietly.
 */
const BUSK_BASE_BPM = 92;

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

/**
 * The same argument for the plank's *width*, which is the thing every critique
 * of this board has actually asked to change.
 *
 * A busk frame shows a tune of crotchets sitting comfortably on a board with
 * daylight at both ends, so "draw it to the live note span instead of full
 * width" looks free. It is not: both ends are already at their floor, and the
 * bar that proves it — a run of quavers played on the fastest instrument, or a
 * note that has just gone by — is not the bar anybody poses for a screenshot.
 * So it is pinned here instead.
 */
describe('the songboard is as narrow as the notation lets it be', () => {
  it('reaches past where a gone-by note comes to rest', () => {
    // A critic once measured the drifted-past note falling off the left edge
    // and retracted it. It does not fall off — but only by 23 mm, so anything
    // taken off `TAIL_M` or `BOARD_END_M` ships the fault for real.
    const span = boardSpan();
    expect(span.leftOfBarline).toBeGreaterThanOrEqual(span.driftedNoteReach);
  });

  it('keeps the tightest pair of note heads the songbook can ask for apart', () => {
    // The tightest pair the game can draw: the shortest note in the book, at
    // the tempo of the instrument that hurries the most.
    let shortestBeats = Infinity;
    for (const song of SONGS) {
      for (const note of song.notes) shortestBeats = Math.min(shortestBeats, note.beats);
    }
    const fastest = Math.max(...INSTRUMENTS.map((i) => i.tempoFeel));
    const tightestGapMs = shortestBeats * beatIntervalMs(BUSK_BASE_BPM * fastest);

    // Below this gap two heads print on top of each other. Two note heads
    // overlapping is not notation, and the child is being asked to read the
    // pitch off exactly those heads.
    const span = boardSpan();
    expect(span.gapAtWhichHeadsTouchMs).toBeLessThan(tightestGapMs);
    // And with enough daylight left that they read as two marks rather than
    // as a smear: a fifth of a head between them at the worst case. This is
    // the assertion that fails if someone shortens the run to narrow the
    // plank, which is what the composition critiques keep asking for.
    expect(span.gapAtWhichHeadsTouchMs * 1.2).toBeLessThan(tightestGapMs);
  });

  it('stands the whole plank clear of the point the road runs to', () => {
    // The fault this replaced: the barline was offset 2.1 m from the road
    // while the plank reached 2.32 m to the right of the barline, so the board
    // was drawn across the road's own vanishing point on every screen — by 42
    // px on 1600x900 and 21 px on 844x390, measured. The offset is derived
    // from the plank now, so the two cannot drift apart again.
    const span = boardSpan();
    expect(span.barlineOffset).toBeGreaterThan(span.rightOfBarline);
  });
});

/**
 * The other thing about this board that a frame cannot judge: whether the two
 * halves of it are lit by the same model.
 *
 * The plank runs `painterly.ts`'s material and the notes run this file's own,
 * so the lighting model is evaluated twice — once on the GPU over there and
 * once on the CPU in `updateLight`. For most of the project's life the
 * constants were copied across, and one of them drifted and stayed drifted:
 * `AMBIENT_STRENGTH` came down to 0.27 in `painterly.ts` while the copy here
 * stayed at 0.32, so the notes predicted a world 19 per cent brighter than
 * the shader was painting and `LIGHT_FLOOR` fired late and small at exactly
 * the dark hours it exists for. Nothing failed, nothing looked obviously
 * wrong, and it survived a wave of visual critique.
 *
 * They are read out of the shader source now rather than copied. These tests
 * are what makes that safe: they prove the reader can find each constant in
 * the real material, and that the fallbacks recorded beside it are still the
 * shader's own values, so a rename or a retune over there fails here loudly
 * instead of silently degrading to a stale number.
 */
describe('the board reads its lighting model rather than copying it', () => {
  const source = createPainterlyMaterial(createPainterlyGlobals(), {
    vertexColors: true,
  }).fragmentShader;

  for (const [name, recorded] of Object.entries(PAINTERLY_CONSTANTS)) {
    it(`finds ${name} in the painterly shader, and the fallback still matches it`, () => {
      // A sentinel no shader constant would ever be, so "found" and "fell
      // back" cannot be confused — the failure this whole arrangement is
      // guarding against is a silent fallback.
      const sentinel = -12345;
      const found = painterlyConstant(source, name, sentinel);
      expect(found).not.toBe(sentinel);
      expect(found).toBeCloseTo(recorded, 6);
    });
  }

  it('will not match a #define that does not start a line', () => {
    // Three's own preprocessor only substitutes an `#include` that starts a
    // line, and a probe in this project that ignored that quietly measured
    // nothing for a round. A directive mid-line is not a directive, and a
    // reader that matched one would happily pick up a number out of a
    // comment or a string.
    expect(painterlyConstant('float x = 1.0; #define SUN_STRENGTH 9.5', 'SUN_STRENGTH', 0.92)).toBe(
      0.92,
    );
    expect(painterlyConstant('// see #define SUN_STRENGTH 9.5 above', 'SUN_STRENGTH', 0.92)).toBe(
      0.92,
    );
    // …and it must still see its own success case, indented or not.
    expect(painterlyConstant('#define SUN_STRENGTH 9.5', 'SUN_STRENGTH', 0.92)).toBe(9.5);
    expect(painterlyConstant('  #define SUN_STRENGTH 9.5\n', 'SUN_STRENGTH', 0.92)).toBe(9.5);
  });
});

/**
 * The floor is quoted in relative luminance, so it has to be *paid* in
 * relative luminance.
 *
 * It was not. The lift was added as `FLOOR_WARMTH * lift`, and `FLOOR_WARMTH`
 * carries 0.7196 of a unit of luminance per unit of itself, so the board
 * received 72 per cent of the light `LIGHT_FLOOR` promised — worst at the
 * darkest hours, where the lift is nearly all of the board's light. Measured
 * on `05-golden-busk`, the board's light landed at 0.150 against a floor of
 * 0.170. This is the arithmetic that says so.
 */
describe('the light floor is paid in the units it is quoted in', () => {
  const luma = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it('records the shortfall that made this necessary', () => {
    // The bug, preserved as a number so nobody has to rediscover it.
    expect(luma(new Color(FLOOR_WARMTH))).toBeCloseTo(0.7196, 3);
  });

  it('normalises the lamplight to carry exactly one unit of luminance', () => {
    expect(luma(unitLuminance(new Color(FLOOR_WARMTH)))).toBeCloseTo(1, 6);
  });

  it('leaves the hue exactly where it was — this is a scale, not a tint', () => {
    const raw = new Color(FLOOR_WARMTH);
    const paid = unitLuminance(new Color(FLOOR_WARMTH));
    expect(paid.r / paid.g).toBeCloseTo(raw.r / raw.g, 9);
    expect(paid.g / paid.b).toBeCloseTo(raw.g / raw.b, 9);
  });

  it('cannot divide by a black lamp', () => {
    const black = unitLuminance(new Color(0x000000));
    expect(Number.isFinite(black.r + black.g + black.b)).toBe(true);
  });
});
