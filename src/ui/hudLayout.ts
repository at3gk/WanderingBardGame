/**
 * Where the heads-up chrome sits, in a file with no DOM in it.
 *
 * The 2D game had `core/hud.ts` for the same job and the lesson from that
 * file stands: the moment two pieces of chrome are positioned by two
 * different rules, one of them ends up drawn on top of the other on exactly
 * the device nobody tested. So there is one rule here for the whole overlay
 * — a safe rectangle, a gutter, and boxes pinned to its corners — and
 * `Hud.ts` is not allowed to have an opinion about pixels.
 *
 * What is different from `core/hud.ts` is the *shape* of the problem. That
 * file laid out a dashboard across the top of a canvas. This game does not
 * have a dashboard: it is a walk you look at, and the chrome is three small
 * things tucked into corners plus a card that appears when the road has
 * something to say. So the maths here is mostly about staying out of the
 * way — of a notch, of a home indicator, and of the scenery.
 *
 * Insets come in as numbers rather than being read from `env(safe-area-inset-*)`
 * here, because CSS environment variables cannot be read from script without
 * a layout pass and this file has to stay testable. `Hud.ts` measures them
 * once with a probe element and hands them over.
 */

import { HUD_TOUCH_TARGET } from '../core/hud';

export { HUD_TOUCH_TARGET };

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HudViewport {
  width: number;
  height: number;
  /** Safe-area insets in CSS pixels. Missing sides are zero. */
  insets?: Partial<SafeAreaInsets>;
}

/** A box in CSS pixels from the top-left of the viewport. */
export interface HudBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HudChrome {
  /** The rectangle everything is laid inside: the viewport less its insets. */
  safe: HudBox;
  /** Breathing room between a box and the edge of the safe rectangle. */
  gutter: number;
  /** A phone, roughly. Drives type size and how much the card may take. */
  compact: boolean;
  /** The purse. Top trailing corner, and a touch target because it will be one. */
  coins: HudBox;
  /** The instrument in hand. Bottom leading corner, and likewise. */
  instrument: HudBox;
  /** The journal card: what the road just said. Bottom centre, above the row. */
  journal: HudBox;
}

/**
 * Below this, in the *narrow* dimension, the screen is a phone and the
 * chrome has to give ground: smaller type, a narrower card, tighter gutters.
 * 480 rather than a width-only test so a phone held in landscape — 844x390,
 * the widest screen in the postcard set and the tightest vertically — is
 * still treated as a phone.
 */
export const COMPACT_EDGE = 480;

const GUTTER_ROOMY = 22;
const GUTTER_TIGHT = 14;

/** Widest the journal card is allowed to get. Past this a line stops scanning. */
export const JOURNAL_MAX_WIDTH = 520;

/**
 * How tall the card is, by type size rather than by share of the screen.
 *
 * A share of the height was the first version and it was wrong in the way
 * that matters here: on a 900px screen it produced a 300px card for two
 * sentences, which is a panel across the middle of the scenery. The card
 * holds a line or two of prose and nothing else, so its height is a property
 * of the prose. The screen only gets to make it *smaller*.
 */
const JOURNAL_HEIGHT_ROOMY = 112;
const JOURNAL_HEIGHT_TIGHT = 92;

/** Room for the longest purse readout the game can produce, at either type size. */
const COINS_WIDTH_ROOMY = 132;
const COINS_WIDTH_TIGHT = 108;

/** Room for "Wayfarer's Lute", which is the longest instrument name. */
const INSTRUMENT_WIDTH_ROOMY = 200;
const INSTRUMENT_WIDTH_TIGHT = 164;

export function hudChrome(viewport: HudViewport): HudChrome {
  const width = size(viewport?.width);
  const height = size(viewport?.height);
  const insets = resolveInsets(viewport?.insets, width, height);

  const safe: HudBox = {
    left: insets.left,
    top: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };

  const compact = Math.min(width, height) < COMPACT_EDGE;
  // The gutter is clamped to the safe rectangle so that a viewport smaller
  // than two gutters degrades into overlapping boxes rather than into boxes
  // with negative width, which is the difference between chrome that looks
  // cramped and chrome that disappears.
  const gutter = Math.min(
    compact ? GUTTER_TIGHT : GUTTER_ROOMY,
    Math.max(0, Math.min(safe.width, safe.height) / 4),
  );

  const innerLeft = safe.left + gutter;
  const innerTop = safe.top + gutter;
  const innerWidth = Math.max(0, safe.width - gutter * 2);
  const innerHeight = Math.max(0, safe.height - gutter * 2);
  const innerRight = innerLeft + innerWidth;
  const innerBottom = innerTop + innerHeight;

  // Every box is at least a touch target in both directions even when it is
  // currently only a readout. A purse that becomes tappable later must not
  // need this file edited to become tappable *fairly*, and a box that is
  // already the right size cannot be given the wrong one by accident.
  const rowHeight = Math.min(HUD_TOUCH_TARGET, innerHeight);

  const coinsWidth = Math.min(compact ? COINS_WIDTH_TIGHT : COINS_WIDTH_ROOMY, innerWidth);
  const coins: HudBox = {
    left: innerRight - coinsWidth,
    top: innerTop,
    width: coinsWidth,
    height: rowHeight,
  };

  const instrumentWidth = Math.min(
    compact ? INSTRUMENT_WIDTH_TIGHT : INSTRUMENT_WIDTH_ROOMY,
    innerWidth,
  );
  const instrument: HudBox = {
    left: innerLeft,
    top: innerBottom - rowHeight,
    width: instrumentWidth,
    height: rowHeight,
  };

  const journalWidth = Math.min(JOURNAL_MAX_WIDTH, innerWidth);
  // The card sits above the instrument row rather than beside it. Beside
  // works on a desk and fails on a phone, and a card that changes corner
  // with the viewport reads as two different pieces of chrome.
  const availableForJournal = Math.max(0, innerHeight - rowHeight - gutter);
  const journalHeight = Math.min(
    availableForJournal,
    compact ? JOURNAL_HEIGHT_TIGHT : JOURNAL_HEIGHT_ROOMY,
  );
  const journal: HudBox = {
    left: innerLeft + (innerWidth - journalWidth) / 2,
    top: instrument.top - gutter - journalHeight,
    width: journalWidth,
    height: journalHeight,
  };

  return { safe, gutter, compact, coins, instrument, journal };
}

/** Whether a box could be tapped fairly by a thumb. */
export function isTouchable(box: HudBox): boolean {
  return box.width >= HUD_TOUCH_TARGET && box.height >= HUD_TOUCH_TARGET;
}

/** Whether a box lies entirely inside another, to a pixel of slack. */
export function contains(outer: HudBox, inner: HudBox): boolean {
  const slack = 0.001;
  return (
    inner.left >= outer.left - slack &&
    inner.top >= outer.top - slack &&
    inner.left + inner.width <= outer.left + outer.width + slack &&
    inner.top + inner.height <= outer.top + outer.height + slack
  );
}

/** Whether two boxes share any area. Used by the tests, and by nothing else. */
export function overlaps(a: HudBox, b: HudBox): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/**
 * Insets are clamped against the viewport they claim to be inside.
 *
 * A browser reporting a 200px bottom inset on a 100px-tall window is not a
 * hypothetical — it is what a mid-rotation layout pass can hand back — and
 * the honest reading is that there is no safe area left, not that the safe
 * rectangle has negative height.
 */
function resolveInsets(
  raw: Partial<SafeAreaInsets> | undefined,
  width: number,
  height: number,
): SafeAreaInsets {
  const top = size(raw?.top);
  const bottom = size(raw?.bottom);
  const left = size(raw?.left);
  const right = size(raw?.right);
  return {
    top: Math.min(top, height),
    bottom: Math.min(bottom, Math.max(0, height - top)),
    left: Math.min(left, width),
    right: Math.min(right, Math.max(0, width - left)),
  };
}

function size(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
