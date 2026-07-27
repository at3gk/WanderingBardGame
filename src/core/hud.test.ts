import { describe, expect, it } from 'vitest';
import {
  HUD_MARGIN_X,
  HUD_ICON_RADIUS,
  HUD_METER_MAX_WIDTH,
  HUD_TOUCH_TARGET,
  hudLayout,
} from './hud';

/** Every viewport the pillar check walks, so the two agree on what "real" means. */
const VIEWPORTS: Array<[string, number]> = [
  ['iphone se portrait', 320],
  ['iphone se landscape', 568],
  ['phone portrait', 390],
  ['phone landscape', 664],
  ['tablet portrait', 768],
  ['tablet landscape', 1024],
  ['desktop', 1280],
  ['narrow desktop', 900],
  ['very narrow', 280],
];

describe('hudLayout', () => {
  it('never lets two button touch zones overlap', () => {
    // The bug this replaces: the songbook zone spanned 57-101 and the lute
    // zone 92-136, so a tap between 92 and 101 was ambiguous.
    for (const [, w] of VIEWPORTS) {
      const { iconXs } = hudLayout(w, 3);
      for (let i = 1; i < iconXs.length; i++) {
        const gap = iconXs[i] - iconXs[i - 1];
        expect(gap, `${w}px, buttons ${i - 1}->${i}`).toBeGreaterThanOrEqual(HUD_TOUCH_TARGET);
      }
    }
  });

  it("lines the first button's glyph up with the rest of the chrome's inset", () => {
    // Not the zone — the zone is allowed to overhang toward the screen edge.
    // The visible glyph is what has to agree with the distance readout and
    // the meter track, all of which start at the margin.
    const { iconXs } = hudLayout(390, 3);
    expect(iconXs[0] - HUD_ICON_RADIUS).toBe(HUD_MARGIN_X);
  });

  it('keeps every touch zone on screen', () => {
    for (const [name, w] of VIEWPORTS) {
      const { iconXs } = hudLayout(w, 3);
      expect(iconXs[0] - HUD_TOUCH_TARGET / 2, name).toBeGreaterThanOrEqual(0);
      expect(iconXs[iconXs.length - 1] + HUD_TOUCH_TARGET / 2, name).toBeLessThanOrEqual(w);
    }
  });

  it('keeps the meter clear of the buttons on every viewport', () => {
    // This is the whole point. On a 390px phone the old meter track began
    // at x=78 and the songbook button sat at 68-90.
    for (const [name, w] of VIEWPORTS) {
      const l = hudLayout(w, 3);
      // Different rows, so horizontal overlap is fine and expected — what
      // must hold is that they are not on the same row.
      expect(l.meterY, name).toBeGreaterThan(l.iconY);
      expect(l.meterY - l.iconY, name).toBeGreaterThanOrEqual(HUD_TOUCH_TARGET / 2);
    }
  });

  it('gives the meter the full width between the margins on a phone', () => {
    expect(hudLayout(390, 3).meterWidth).toBe(390 - HUD_MARGIN_X * 2);
    expect(hudLayout(320, 3).meterWidth).toBe(320 - HUD_MARGIN_X * 2);
  });

  it('caps the meter so it does not become a horizon line on a wide screen', () => {
    expect(hudLayout(1280, 3).meterWidth).toBe(HUD_METER_MAX_WIDTH);
    expect(hudLayout(1024, 3).meterWidth).toBe(HUD_METER_MAX_WIDTH);
  });

  it('is wider than the meter it replaces at every phone size', () => {
    // The old rule was 60% of the width, centred.
    for (const w of [320, 390, 568, 664]) {
      expect(hudLayout(w, 3).meterWidth, `${w}px`).toBeGreaterThan(w * 0.6);
    }
  });

  it('centres the meter', () => {
    for (const [name, w] of VIEWPORTS) {
      const l = hudLayout(w, 3);
      expect(l.meterCenterX, name).toBe(w / 2);
      expect(l.meterLeft + l.meterRight, name).toBeCloseTo(w, 6);
    }
  });

  it('stays on screen even at an absurdly narrow width', () => {
    const l = hudLayout(280, 3);
    expect(l.meterLeft).toBeGreaterThanOrEqual(0);
    expect(l.meterRight).toBeLessThanOrEqual(280);
    expect(l.meterWidth).toBeGreaterThan(0);
  });

  it('puts the title below the meter, not on top of it', () => {
    const l = hudLayout(390, 3);
    expect(l.titleY).toBeGreaterThan(l.meterY + l.meterWidth * 0);
    expect(l.titleY - l.meterY).toBeGreaterThanOrEqual(16);
  });

  it('handles zero buttons without producing a bogus row edge', () => {
    const l = hudLayout(390, 0);
    expect(l.iconXs).toEqual([]);
    expect(l.iconRowRight).toBe(HUD_MARGIN_X);
  });
});
