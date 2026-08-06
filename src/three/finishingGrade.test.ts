import { describe, expect, it } from 'vitest';
import {
  buildLutData,
  gradeColor,
  CONTRAST,
  HIGHLIGHT_DIR,
  LUT_SIZE,
  SHADOW_DIR,
  SPLIT,
  VIBRANCE,
} from './finishingGrade';

/**
 * Task 168, the finishing pass. These are the design contracts of the
 * grade, not a snapshot of its numbers — the knobs (CONTRAST, VIBRANCE,
 * SPLIT, the two tone directions) are meant to be re-tuned by eye across
 * runs, and every pin below is derived from them so that re-tuning stays
 * cheap. What must never change is the *character*: endpoints untouched,
 * greys still grey, shadows cool, highlights warm, vivid colours left alone.
 */

const luma = (c: readonly [number, number, number]) =>
  0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const saturation = (c: readonly [number, number, number]) => Math.max(...c) - Math.min(...c);

describe('gradeColor', () => {
  it('leaves black black and white white, exactly', () => {
    // The LUT's two extreme corners are the ones a player notices. A grade
    // that lifts black turns night into grey haze; one that tints white puts
    // a cast on the UI. The 4L(1-L) window on the split-tone exists purely
    // to make this exact rather than merely close, so pin it exactly.
    expect(gradeColor(0, 0, 0)).toEqual([0, 0, 0]);
    expect(gradeColor(1, 1, 1)).toEqual([1, 1, 1]);
  });

  it('never leaves the unit cube, anywhere in the cube', () => {
    // Out-of-range values would clip to garbage once quantised into bytes.
    for (let r = 0; r <= 1.0001; r += 0.125) {
      for (let g = 0; g <= 1.0001; g += 0.125) {
        for (let b = 0; b <= 1.0001; b += 0.125) {
          for (const v of gradeColor(r, g, b)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('clamps inputs outside 0..1 instead of extrapolating the curve', () => {
    expect(gradeColor(-1, -0.5, -0.001)).toEqual(gradeColor(0, 0, 0));
    expect(gradeColor(2, 1.5, 1.001)).toEqual(gradeColor(1, 1, 1));
  });

  it('never darkens as the input grey brightens', () => {
    // A single reversal along the grey ramp shows up as a visible band in
    // the sky gradient — the one place in the game with 128 shades of the
    // same hue on screen at once. Both the S-curve and the split-tone
    // window have slopes that could in principle overpower the ramp; this
    // is the test that says they don't.
    let prevLuma = -1;
    let prev: [number, number, number] = [-1, -1, -1];
    for (let i = 0; i <= 128; i++) {
      const x = i / 128;
      const out = gradeColor(x, x, x);
      expect(luma(out)).toBeGreaterThanOrEqual(prevLuma);
      for (let k = 0; k < 3; k++) expect(out[k]).toBeGreaterThanOrEqual(prev[k]);
      prevLuma = luma(out);
      prev = out;
    }
  });

  it('keeps greys near-neutral, within the split-tone budget', () => {
    // The most the split-tone can pull two channels apart: its peak strength
    // (the 4L(1-L) window tops out at 1, so `amount` <= SPLIT) times the
    // widest component spread any interpolated nudge can have. Vibrance
    // cannot contribute — a grey has zero saturation to scale.
    const nudges = [...SHADOW_DIR, ...HIGHLIGHT_DIR];
    const bound = SPLIT * (Math.max(...nudges) - Math.min(...nudges));
    for (let i = 0; i <= 64; i++) {
      const x = i / 64;
      expect(saturation(gradeColor(x, x, x))).toBeLessThanOrEqual(bound);
    }
  });

  it('cools the shadows and warms the highlights', () => {
    // The whole reason the grade exists: dusk should read as painted, not
    // dimmed. Violet-blue below, warm cream above.
    const dark = gradeColor(0.25, 0.25, 0.25);
    expect(dark[2]).toBeGreaterThan(dark[0]);

    const light = gradeColor(0.75, 0.75, 0.75);
    expect(light[0]).toBeGreaterThan(light[2]);
  });

  it('lifts muted colours more than vivid ones, proportionally', () => {
    // Vibrance, not saturation. A saturation boost would flatten the sunset
    // and the lantern flame into plates; this one has to spend most of its
    // strength on the mossy stone and leave the loud things nearly alone.
    const muted: [number, number, number] = [0.5, 0.45, 0.4];
    const vivid: [number, number, number] = [0.9, 0.5, 0.1];

    const mutedGain = saturation(gradeColor(...muted)) / saturation(muted) - 1;
    const vividGain = saturation(gradeColor(...vivid)) / saturation(vivid) - 1;

    expect(mutedGain).toBeGreaterThan(0);
    expect(mutedGain).toBeGreaterThan(vividGain);
  });

  it('keeps every knob in gentle-unifier territory', () => {
    // A grade a player can name is too strong. If a future run wants a
    // bolder look it should say so here, deliberately, rather than drift
    // into it one tweak at a time.
    expect(CONTRAST).toBeLessThanOrEqual(0.2);
    expect(VIBRANCE).toBeLessThanOrEqual(0.25);
    expect(SPLIT).toBeLessThanOrEqual(0.05);
  });
});

describe('buildLutData', () => {
  it('is sized and padded for a Data3DTexture', () => {
    const data = buildLutData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(LUT_SIZE ** 3 * 4);
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });

  it('bakes identity into the black and white corners', () => {
    const size = LUT_SIZE;
    const data = buildLutData();
    const at = (r: number, g: number, b: number) => ((b * size + g) * size + r) * 4;

    const black = at(0, 0, 0);
    expect([data[black], data[black + 1], data[black + 2]]).toEqual([0, 0, 0]);

    const white = at(size - 1, size - 1, size - 1);
    expect([data[white], data[white + 1], data[white + 2]]).toEqual([255, 255, 255]);
  });

  it('puts each graded colour in the slot the shader will sample it from', () => {
    // r fastest, then g, then b. Getting this backwards swaps the red and
    // blue axes of the whole grade — which looks plausible in a screenshot
    // and is wrong everywhere, so it gets an explicit interior pin.
    const size = 9; // a small cube: same indexing, faster to reason about
    const data = buildLutData(size);
    const last = size - 1;
    const [r, g, b] = [2, 5, 7];

    const expected = gradeColor(r / last, g / last, b / last);
    const i = ((b * size + g) * size + r) * 4;
    expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([
      Math.round(expected[0] * 255),
      Math.round(expected[1] * 255),
      Math.round(expected[2] * 255),
      255,
    ]);
  });

  it('is deterministic — the same bytes every boot', () => {
    // The LUT is built at boot on the player's device rather than shipped as
    // an image (no image assets in this repo), so "same look everywhere"
    // rests entirely on this being a pure function of the constants.
    expect(buildLutData(9)).toEqual(buildLutData(9));
  });
});
