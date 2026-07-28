import { describe, expect, it } from 'vitest';
import {
  COMPACT_EDGE,
  HUD_TOUCH_TARGET,
  JOURNAL_MAX_WIDTH,
  contains,
  hudChrome,
  isTouchable,
  overlaps,
  type HudBox,
  type HudViewport,
} from './hudLayout';

/**
 * The screens that actually break layouts: a desk, a tablet, a tall phone
 * with a notch, and the same phone rotated — which is the hardest of the
 * four, because it has less vertical room than anything else the game runs
 * on and an inset on the *side*.
 */
const SCREENS: Array<{ name: string; viewport: HudViewport }> = [
  { name: 'desktop', viewport: { width: 1600, height: 900 } },
  { name: 'tablet', viewport: { width: 1024, height: 768 } },
  {
    name: 'phone portrait',
    viewport: { width: 390, height: 844, insets: { top: 47, bottom: 34 } },
  },
  {
    name: 'phone landscape',
    viewport: { width: 844, height: 390, insets: { left: 47, right: 47, bottom: 21 } },
  },
];

function boxes(chrome: ReturnType<typeof hudChrome>): Array<[string, HudBox]> {
  return [
    ['coins', chrome.coins],
    ['instrument', chrome.instrument],
    ['journal', chrome.journal],
  ];
}

describe('hudChrome', () => {
  it('keeps every box inside the safe rectangle on every screen', () => {
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      for (const [label, box] of boxes(chrome)) {
        expect(contains(chrome.safe, box), `${label} on ${name}`).toBe(true);
      }
    }
  });

  it('keeps the safe rectangle inside the viewport, insets and all', () => {
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      const screen: HudBox = { left: 0, top: 0, width: viewport.width, height: viewport.height };
      expect(contains(screen, chrome.safe), name).toBe(true);
      expect(chrome.safe.left, name).toBe(viewport.insets?.left ?? 0);
      expect(chrome.safe.top, name).toBe(viewport.insets?.top ?? 0);
    }
  });

  it('gives the corner readouts a full touch target', () => {
    // Not decoration: both corners are where a "tap the purse" and a "swap
    // instrument" control will land, and a control that arrives later must
    // not arrive at 30px because the readout was only ever meant to be read.
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      expect(isTouchable(chrome.coins), `coins on ${name}`).toBe(true);
      expect(isTouchable(chrome.instrument), `instrument on ${name}`).toBe(true);
    }
  });

  it('never lets the journal card sit on top of the corner chrome', () => {
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      expect(overlaps(chrome.journal, chrome.instrument), `instrument on ${name}`).toBe(false);
      expect(overlaps(chrome.journal, chrome.coins), `coins on ${name}`).toBe(false);
    }
  });

  it('keeps the card clear of the figure, who is always low in frame', () => {
    // Every camera framing puts the bard in the lower half and leaves the
    // top of the frame to the sky. A card in the bottom half covers him,
    // and during a busk that is the one thing it must not do.
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      const bottom = chrome.journal.top + chrome.journal.height;
      expect(bottom, name).toBeLessThan(viewport.height * 0.5);
    }
  });

  it('leaves the middle of the screen empty', () => {
    // The whole point of the chrome is that it is not a dashboard. A box
    // that reaches the centre of a 16:9 screen is covering the scenery,
    // which is the thing the game is made of.
    const chrome = hudChrome({ width: 1600, height: 900 });
    const centre: HudBox = { left: 500, top: 250, width: 600, height: 300 };
    for (const [label, box] of boxes(chrome)) {
      expect(overlaps(centre, box), label).toBe(false);
    }
  });

  it('reads a phone in either orientation as compact, and a tablet as not', () => {
    expect(hudChrome({ width: 390, height: 844 }).compact).toBe(true);
    expect(hudChrome({ width: 844, height: 390 }).compact).toBe(true);
    expect(hudChrome({ width: 1024, height: 768 }).compact).toBe(false);
    // The boundary is the narrow edge, exactly, and it is exclusive.
    expect(hudChrome({ width: 2000, height: COMPACT_EDGE }).compact).toBe(false);
    expect(hudChrome({ width: 2000, height: COMPACT_EDGE - 1 }).compact).toBe(true);
  });

  it('caps the journal card so a wide screen does not get a banner', () => {
    const wide = hudChrome({ width: 2560, height: 1440 });
    expect(wide.journal.width).toBe(JOURNAL_MAX_WIDTH);
    // Centred in the safe rectangle, not pinned to a corner.
    const centre = wide.journal.left + wide.journal.width / 2;
    expect(centre).toBeCloseTo(wide.safe.left + wide.safe.width / 2, 6);
  });

  it('shrinks the card rather than the road on a short screen', () => {
    const landscape = hudChrome({ width: 844, height: 390, insets: { bottom: 21 } });
    expect(landscape.journal.height).toBeLessThanOrEqual(landscape.safe.height * 0.4);
    expect(landscape.journal.height).toBeGreaterThan(0);
  });

  it('moves the chrome by exactly the inset when a notch appears', () => {
    const plain = hudChrome({ width: 390, height: 844 });
    const notched = hudChrome({ width: 390, height: 844, insets: { top: 47, bottom: 34 } });
    expect(notched.coins.top - plain.coins.top).toBeCloseTo(47, 6);
    expect(notched.journal.top - plain.journal.top).toBeCloseTo(47, 6);
    expect(plain.instrument.top - notched.instrument.top).toBeCloseTo(34, 6);
    // A top-only inset must not move the bottom row, and vice versa.
    const topOnly = hudChrome({ width: 390, height: 844, insets: { top: 47 } });
    expect(topOnly.instrument.top).toBeCloseTo(plain.instrument.top, 6);
  });

  it('survives a viewport that makes no sense', () => {
    const nonsense: HudViewport[] = [
      { width: 0, height: 0 },
      { width: -100, height: -100 },
      { width: Number.NaN, height: 844 },
      { width: 390, height: Number.POSITIVE_INFINITY },
      { width: 100, height: 100, insets: { top: 400, bottom: 400, left: 400, right: 400 } },
    ];
    for (const viewport of nonsense) {
      const chrome = hudChrome(viewport);
      for (const [label, box] of boxes(chrome)) {
        for (const value of [box.left, box.top, box.width, box.height]) {
          expect(Number.isFinite(value), `${label} of ${JSON.stringify(viewport)}`).toBe(true);
        }
        expect(box.width, label).toBeGreaterThanOrEqual(0);
        expect(box.height, label).toBeGreaterThanOrEqual(0);
      }
      expect(chrome.gutter).toBeGreaterThanOrEqual(0);
    }
  });

  it('never asks for a touch target taller than the screen', () => {
    // A 40px-tall window is not a real device, but a browser mid-rotation
    // reports one for a frame, and chrome taller than its own safe area
    // would spend that frame hanging off the bottom of the page.
    const chrome = hudChrome({ width: 300, height: 40 });
    expect(chrome.coins.height).toBeLessThanOrEqual(chrome.safe.height);
    expect(chrome.instrument.height).toBeLessThanOrEqual(chrome.safe.height);
    expect(chrome.coins.height).toBeLessThanOrEqual(HUD_TOUCH_TARGET);
  });
});
