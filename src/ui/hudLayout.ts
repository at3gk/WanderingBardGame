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
  /** The song being learnt. Bottom trailing corner, mirroring the instrument. */
  song: HudBox;
  /** The journal card: what the road just said. Up in the sky — see `hudChrome`. */
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

/**
 * The share of the frame that is reliably sky, measured from the top.
 *
 * Every camera framing keeps the horizon low and the figure lower, so the
 * top of the picture is the one region the world does not draw in — with one
 * exception, and it is the important one: during a busk the staff climbs up
 * out of the road toward the vanishing point, and its top note is the highest
 * thing the game ever puts on screen. Just under three tenths of the way down
 * is where that note sits on the shortest screen the game runs on, and it is
 * therefore the line the card has to stay above.
 *
 * Stated as a fraction of the *viewport* rather than of the safe rectangle,
 * because the staff is drawn into the canvas and the canvas does not know
 * about notches.
 */
export const JOURNAL_SKY_FRACTION = 0.28;

/** Room for the longest purse readout the game can produce, at either type size. */
const COINS_WIDTH_ROOMY = 132;
const COINS_WIDTH_TIGHT = 108;

/** Room for "Wayfarer's Lute", which is the longest instrument name. */
const INSTRUMENT_WIDTH_ROOMY = 200;
const INSTRUMENT_WIDTH_TIGHT = 164;

/**
 * Room for a song title. The longest in the book ("Twinkle Twinkle Little
 * Star") does not fit the tight width and ellipsises, which is fine — the
 * corner is a handle first and a label second, and the open book shows the
 * full titles.
 */
const SONG_WIDTH_ROOMY = 220;
const SONG_WIDTH_TIGHT = 168;

/**
 * The gesture-strip kindness: on a phone-sized screen that reports NO bottom
 * safe-area inset, the bottom corners still get this much clearance.
 *
 * A browser tab and an uninstalled web app both report zero — the inset only
 * turns real once the game is installed to the home screen — but the thumb
 * and the system's edge-swipe are there either way, and wave 8's mobile lens
 * found the bottom labels "pinned into the bottom-edge thumb strip" on every
 * phone frame. Where a genuine inset arrives it wins (it is larger).
 */
export const BOTTOM_KINDNESS = 12;

export function hudChrome(viewport: HudViewport): HudChrome {
  const width = size(viewport?.width);
  const height = size(viewport?.height);
  const insets = resolveInsets(viewport?.insets, width, height);
  const compact = Math.min(width, height) < COMPACT_EDGE;
  if (compact) insets.bottom = Math.min(Math.max(insets.bottom, BOTTOM_KINDNESS), height);

  const safe: HudBox = {
    left: insets.left,
    top: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
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

  // The songbook mirrors the instrument in the opposite bottom corner, and
  // gives ground first when the two would meet: its width is whatever the
  // instrument and a gutter have left, so on a narrow portrait screen the
  // title ellipsises rather than the two corners overlapping.
  const songWidth = Math.max(
    0,
    Math.min(compact ? SONG_WIDTH_TIGHT : SONG_WIDTH_ROOMY, innerWidth - instrumentWidth - gutter),
  );
  const song: HudBox = {
    left: innerRight - songWidth,
    top: innerBottom - rowHeight,
    width: songWidth,
    height: rowHeight,
  };

  // The card lives in the sky, and how much sky there is decides which of two
  // places it takes.
  //
  // It was at the bottom of the screen first, which is where a game usually
  // puts its narration, and that put a 92px card straight over the bard
  // during a busk — the one moment the player has to be able to see him. So
  // it moved to the top, hanging under the purse row, and that is still the
  // right answer wherever there is room for it: full width, centred, clear of
  // both corners without having to know anything about them.
  //
  // On a phone held sideways there is no such room, and a nudge would not
  // have found any. That screen is 390 tall; the purse row and two gutters
  // spend the first 72 of it, the card wants 92 more, and the staff's top
  // note is already there at about 109. The card and the notation were being
  // asked to share the same forty pixels, and one of them has a fixed height
  // while the other is drawn by the camera.
  //
  // So the rule is stated once, about the sky, and the placement follows from
  // it: the card's bottom edge stays inside the sky band. Where the roomy
  // placement would break that, the card moves up *into* the purse row and
  // sits beside the purse rather than under it — the only band of the frame
  // left that the world does not use. What it gives up is the full width,
  // which is the honest trade: on that screen there was never a full-width
  // slot, only one that had not been measured against the notation.
  const journalWanted = compact ? JOURNAL_HEIGHT_TIGHT : JOURNAL_HEIGHT_ROOMY;
  const skyBottom = height * JOURNAL_SKY_FRACTION;
  const belowRowTop = coins.top + rowHeight + gutter;
  const inRow = belowRowTop + journalWanted > skyBottom;

  const journalTop = inRow ? innerTop : belowRowTop;
  // Beside the purse, the card's span is what the purse has left over. Under
  // it, the card owns the width and the purse is out of its way vertically.
  const journalSpan = inRow ? Math.max(0, innerWidth - coinsWidth - gutter) : innerWidth;
  const journalWidth = Math.min(JOURNAL_MAX_WIDTH, journalSpan);
  const journalHeight = Math.max(
    0,
    Math.min(
      journalWanted,
      skyBottom - journalTop,
      // And never taller than the room the corners have left it, whichever
      // placement it took.
      inRow ? innerHeight : innerHeight - rowHeight - gutter,
    ),
  );
  const journal: HudBox = {
    // Centred in its own span, not in the screen. Under the purse row those
    // are the same thing; beside the purse the card sits a little to the
    // leading side, which is where the space actually is.
    left: innerLeft + (journalSpan - journalWidth) / 2,
    top: journalTop,
    width: journalWidth,
    height: journalHeight,
  };

  return { safe, gutter, compact, coins, instrument, song, journal };
}

/**
 * The open case: what the bard could be playing instead.
 *
 * A stack of rows rising out of the instrument corner, flush with it and the
 * same width, because this is meant to read as that one object opened rather
 * than as a panel that arrived from off-screen. Each row is as tall as the
 * row it opened from, which is a touch target by construction — the corner
 * has been sized as one since long before anything could be tapped.
 *
 * The count is passed in rather than derived because this file knows nothing
 * about instruments and should not learn: it is told how many rows to make
 * room for and answers with a rectangle.
 *
 * The ceiling is the journal card's foot, not the top of the safe rectangle.
 * The card's slot is spoken for whether or not a line happens to be in it —
 * the same reasoning that puts the card under the purse row rather than
 * checking whether the purse has anything in it — and on a phone in
 * landscape, where the card has moved up into the purse row, that ceiling is
 * what stops an open case from swallowing the line that is very often the
 * reason it was opened.
 *
 * Whole rows only. Where the room does not divide evenly the case is short by
 * a row and scrolls, which is a far better failure than a half-height row at
 * the top that looks like a rendering fault and is a poor touch target
 * besides.
 */
export function instrumentCaseBox(chrome: HudChrome, count: number): HudBox {
  const rows = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const { instrument, safe, gutter, journal } = chrome;
  const ceiling = Math.max(safe.top + gutter, journal.top + journal.height + gutter);
  const room = Math.max(0, instrument.top - ceiling);
  const row = instrument.height;
  const fit = row > 0 ? Math.min(rows, Math.floor(room / row)) : 0;
  const height = fit * row;
  return {
    left: instrument.left,
    top: instrument.top - height,
    width: instrument.width,
    height,
  };
}

/**
 * The open songbook: what the road could be playing instead.
 *
 * `instrumentCaseBox`'s twin, rising out of the song corner with the same
 * ceiling (the journal card's foot) and the same whole-rows-only rule, for
 * the same reasons — see that function. The one difference is which corner
 * it grows from.
 */
export function songBookBox(chrome: HudChrome, count: number): HudBox {
  const rows = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const { song, safe, gutter, journal } = chrome;
  const ceiling = Math.max(safe.top + gutter, journal.top + journal.height + gutter);
  const room = Math.max(0, song.top - ceiling);
  const row = song.height;
  const fit = row > 0 ? Math.min(rows, Math.floor(room / row)) : 0;
  const height = fit * row;
  return {
    left: song.left,
    top: song.top - height,
    width: song.width,
    height,
  };
}

/**
 * How many whole rows the open songbook can show on this chrome. The same
 * arithmetic `songBookBox` sizes with, exported so the book can page: the
 * fold used to silently cut every row past this count — on a 844x390
 * landscape phone that was everything past FOUR — which made the far end
 * of the songbook unreachable exactly where screens are smallest.
 */
export function bookCapacity(chrome: HudChrome): number {
  const { song, safe, gutter, journal } = chrome;
  const ceiling = Math.max(safe.top + gutter, journal.top + journal.height + gutter);
  const room = Math.max(0, song.top - ceiling);
  return song.height > 0 ? Math.floor(room / song.height) : 0;
}

/**
 * Which of the book's rows this page shows. When everything fits, one page
 * and no turn row; otherwise the last visible slot is reserved for the
 * "turn the page" row, and `page` wraps, so tapping it cycles through the
 * whole book on any screen. Pure, so the smallest landscape phone is a
 * unit test rather than a surprise.
 */
export function bookPage<T>(
  rows: readonly T[],
  capacity: number,
  page: number,
): { shown: T[]; pages: number } {
  const cap = Math.max(1, Math.floor(Number.isFinite(capacity) ? capacity : 1));
  if (rows.length <= cap) return { shown: rows.slice(), pages: 1 };
  const size = Math.max(1, cap - 1);
  const pages = Math.ceil(rows.length / size);
  const p = ((Math.trunc(page) % pages) + pages) % pages;
  return { shown: rows.slice(p * size, p * size + size), pages };
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
