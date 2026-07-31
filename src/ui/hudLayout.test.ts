import { describe, expect, it } from 'vitest';
import {
  COMPACT_EDGE,
  HUD_TOUCH_TARGET,
  JOURNAL_MAX_WIDTH,
  JOURNAL_SKY_FRACTION,
  contains,
  hudChrome,
  instrumentCaseBox,
  isTouchable,
  overlaps,
  songBookBox,
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
  // The same screen without a notch, because that is the viewport the
  // postcard tool shoots shot 09 at and the one the collision was found in.
  { name: 'phone landscape, no notch', viewport: { width: 844, height: 390 } },
];

function boxes(chrome: ReturnType<typeof hudChrome>): Array<[string, HudBox]> {
  return [
    ['coins', chrome.coins],
    ['instrument', chrome.instrument],
    ['song', chrome.song],
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
      expect(isTouchable(chrome.song), `song on ${name}`).toBe(true);
    }
  });

  it('keeps the two bottom corners off each other on every screen', () => {
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      expect(overlaps(chrome.instrument, chrome.song), name).toBe(false);
    }
  });

  it('never lets the journal card sit on top of the corner chrome', () => {
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      expect(overlaps(chrome.journal, chrome.instrument), `instrument on ${name}`).toBe(false);
      expect(overlaps(chrome.journal, chrome.coins), `coins on ${name}`).toBe(false);
    }
  });

  it('keeps the card inside the band of sky the world never draws in', () => {
    // This used to say "the top half", which every screen passed and which
    // was not the constraint. The bard is in the lower half, but during a
    // busk the *staff* climbs well above him, and on a phone in landscape
    // the card was landing on the top note while comfortably clearing the
    // figure. The sky band is the real budget; half the screen was never it.
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      const bottom = chrome.journal.top + chrome.journal.height;
      expect(bottom, name).toBeLessThanOrEqual(viewport.height * JOURNAL_SKY_FRACTION + 0.001);
    }
  });

  it('leaves the card tall enough to hold the line it is for', () => {
    // The sky band is a ceiling, and a ceiling on its own can be satisfied by
    // squashing the card flat against it — which is what the first attempt at
    // the landscape fix did, and a 37px card clips its second line without
    // reporting anything. Two lines of the card's own type is 45px; 56 is
    // that with the wash's breathing room around it.
    for (const { name, viewport } of SCREENS) {
      expect(hudChrome(viewport).journal.height, name).toBeGreaterThanOrEqual(56);
    }
  });

  it('hangs the card under the purse where there is sky for it, and beside it where there is not', () => {
    // Both placements are correct; which one a screen gets is the whole
    // decision, so it is asserted rather than left to fall out of the maths.
    const tall = hudChrome({ width: 390, height: 844, insets: { top: 47, bottom: 34 } });
    expect(tall.journal.top).toBeGreaterThanOrEqual(tall.coins.top + tall.coins.height);
    expect(tall.journal.width).toBe(tall.safe.width - tall.gutter * 2);

    const short = hudChrome({ width: 844, height: 390 });
    expect(short.journal.top).toBeCloseTo(short.coins.top, 6);
    // Sharing the row means giving up the width the purse is standing in.
    expect(short.journal.left + short.journal.width).toBeLessThanOrEqual(short.coins.left);
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

  it('opens the case out of the instrument corner, with fair rows', () => {
    // Five is the most the case can ever hold: six instruments, less the one
    // already in the bard's hands.
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      const box = instrumentCaseBox(chrome, 5);
      expect(contains(chrome.safe, box), `case on ${name}`).toBe(true);
      expect(box.left, `case left on ${name}`).toBe(chrome.instrument.left);
      expect(box.top + box.height, `case foot on ${name}`).toBeCloseTo(chrome.instrument.top, 6);
      // Every row a thumb's width and a thumb's height, on every screen the
      // game is meant to be played on. Whole rows, and at least two of them —
      // a phone in landscape only has room for four of the five and scrolls
      // the rest, which is fine; showing one and a fraction would not be.
      expect(box.height % chrome.instrument.height, `whole rows on ${name}`).toBeCloseTo(0, 6);
      expect(chrome.instrument.height, `row on ${name}`).toBeGreaterThanOrEqual(HUD_TOUCH_TARGET);
      expect(box.height / chrome.instrument.height, `rows on ${name}`).toBeGreaterThanOrEqual(2);
      expect(box.width, `case width on ${name}`).toBeGreaterThanOrEqual(HUD_TOUCH_TARGET);
      expect(overlaps(box, chrome.journal), `case and card on ${name}`).toBe(false);
      expect(overlaps(box, chrome.coins), `case and purse on ${name}`).toBe(false);
    }
  });

  it('opens the songbook out of the song corner, exactly as the case opens', () => {
    // Twelve rows is the most the book can ask for: eleven songs plus the
    // wander row. Screens without the room show fewer, whole rows only.
    for (const { name, viewport } of SCREENS) {
      const chrome = hudChrome(viewport);
      const box = songBookBox(chrome, 12);
      expect(contains(chrome.safe, box), `book on ${name}`).toBe(true);
      expect(box.left, `book left on ${name}`).toBe(chrome.song.left);
      expect(box.top + box.height, `book foot on ${name}`).toBeCloseTo(chrome.song.top, 6);
      expect(box.height % chrome.song.height, `whole rows on ${name}`).toBeCloseTo(0, 6);
      expect(box.height / chrome.song.height, `rows on ${name}`).toBeGreaterThanOrEqual(2);
      expect(overlaps(box, chrome.journal), `book and card on ${name}`).toBe(false);
    }
  });

  it('gives the book no height at all when there is nothing to choose', () => {
    const chrome = hudChrome({ width: 1600, height: 900 });
    for (const count of [0, -3, Number.NaN]) {
      const box = songBookBox(chrome, count);
      expect(box.height, String(count)).toBe(0);
      expect(box.top, String(count)).toBe(chrome.song.top);
    }
  });

  it('gives the case no height at all when there is nothing to take out', () => {
    const chrome = hudChrome({ width: 1600, height: 900 });
    for (const count of [0, -3, Number.NaN]) {
      const box = instrumentCaseBox(chrome, count);
      expect(box.height, String(count)).toBe(0);
      expect(box.top, String(count)).toBe(chrome.instrument.top);
    }
  });

  it('clamps the case to the room above rather than running off the screen', () => {
    // A phone in landscape with a long case is the case that bites: five
    // rows is 220px in a frame 390 tall. It must still start inside the
    // safe rectangle, however many rows are asked for.
    const chrome = hudChrome({ width: 844, height: 390 });
    const box = instrumentCaseBox(chrome, 40);
    expect(contains(chrome.safe, box)).toBe(true);
    expect(box.top).toBeGreaterThanOrEqual(chrome.safe.top + chrome.gutter - 0.001);
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
