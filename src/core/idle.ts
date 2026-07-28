/**
 * Idle busking — what the case collects while you are not here.
 *
 * The bard leaves the instrument case open and walks off. Time passes; a few
 * people put coins in it. That is the whole feature, and the shape of the
 * curve is the whole design decision.
 *
 * A linear rate would make this game a treadmill: eight hours away is eight
 * times one hour, so the correct play becomes "stay away as long as possible",
 * and the correct play after that becomes "set an alarm to collect". Both are
 * the opposite of what a cosy game wants from a player. So accrual saturates:
 * `1 - e^(-t/tau)`, with tau a couple of hours. The first hour is worth coming
 * back for, the eighth adds a little, and there is no hour at which checking
 * in is urgent. Nothing about the curve rewards vigilance.
 *
 * The other half of the promise is that being away is never *punished*. There
 * is no decay of what you already have, no rot on the case, no streak to
 * break, no timer counting down anywhere. `idleYield` only ever returns
 * non-negative numbers, and the only thing an absurdly long absence does is
 * hit the cap — which is reported honestly in `cappedAtMs` so the journal can
 * say the case was full rather than quietly swallowing the difference.
 *
 * Clocks are the hard part. A phone that crosses a timezone, an NTP
 * correction, a user setting the date back to farm the curve, a laptop whose
 * battery died and booted at the epoch — all of these arrive here as a
 * `nowMs` that makes no sense against a stored `since`. Every one of them
 * resolves to "zero yield" or "the cap", never to a negative payout and never
 * to a throw.
 *
 * Pure apart from `saveIdle`/`loadIdle`, which are the only functions in the
 * file that touch a browser global, and which degrade to doing nothing when
 * storage is unavailable.
 */

import { hashString } from './rng';

export interface IdleState {
  /** Epoch ms at which the case was left open. */
  since: number;
  /** Which instrument was left out. Only affects the rate, via `instrumentMultipliers`. */
  instrumentId: string;
  /** How the last performance went, 0..1. Values outside that range are clamped, not rejected. */
  quality: number;
}

export interface IdleYield {
  coins: number;
  delight: number;
  /**
   * How long the player was actually away — the *true* gap, not the capped
   * one, so the journal can say "three days" and "the case was full" in the
   * same breath instead of pretending the three days were ten hours.
   */
  elapsedMs: number;
  /** Where accrual stopped, or null if it never reached the cap. */
  cappedAtMs: number | null;
}

export interface IdleOptions {
  /** Coins per hour at the *start* of an absence. The curve's initial slope, which is the tunable a designer can reason about. */
  coinsPerHour?: number;
  delightPerHour?: number;
  /** Time constant of the taper, in hours. Total possible yield is rate * taperHours. */
  taperHours?: number;
  /** Accrual stops here. */
  capMs?: number;
  /** Rate multiplier at quality 0. Not zero: an open case catches something even after a rough set. */
  qualityFloor?: number;
  /**
   * Per-instrument rate multipliers, supplied by the caller rather than
   * hard-coded here. The instrument roster lives elsewhere and will grow;
   * an unknown id is worth 1x rather than an error, so a new instrument is
   * playable the moment it exists and can be balanced afterwards.
   */
  instrumentMultipliers?: Readonly<Record<string, number>>;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Defaults, chosen together: 24 coins/hour initial slope with a 2.5 hour
 * taper means an absence is worth at most about 60 coins, of which the first
 * hour is 20 and the first three are 42. Eight times the time away is three
 * times the coins — enough that sleeping is rewarded, not nearly enough that
 * it beats walking the road.
 *
 * The 10 hour cap is a night's sleep plus slack. It exists to make the
 * numbers explainable ("the case holds about a night") rather than to limit
 * anyone; the curve is already 98% spent by the time it bites.
 *
 * Frozen because `resolveOptions` reads these fields on every call: an
 * accidental write anywhere in the app would silently re-balance idle for the
 * rest of the session, and a throw at the offending line is far easier to
 * chase than a game that quietly pays double.
 */
export const DEFAULT_IDLE_OPTIONS: Required<IdleOptions> = Object.freeze({
  coinsPerHour: 24,
  delightPerHour: 6,
  taperHours: 2.5,
  capMs: 10 * HOUR_MS,
  qualityFloor: 0.5,
  instrumentMultipliers: Object.freeze({}),
});

/** The one key this module owns. Exported so a future "forget me" control has something to remove. */
export const IDLE_STORAGE_KEY = 'wb.idle.v1';

/**
 * Yield for an absence. Deterministic: same state and same clock, same
 * result, on every device — with the one caveat that `Math.exp` is only
 * specified to be *approximately* correct, so two engines could in principle
 * disagree in the last bit. That is tolerable here and nowhere else in the
 * codebase: idle yield is private to one player and never compared against
 * another's, unlike the road, which must never touch a transcendental.
 *
 * Takes `null` as well as a state, because `loadIdle()` returns `IdleState |
 * null` and "there is no open case" and "the case has been open for no time"
 * are the same answer — zero. That saves every caller a guard.
 *
 * Deliberately *not* stateful — it does not mark the yield as collected. The
 * caller resets `since` when it takes the coins. That does mean a caller
 * could reset repeatedly to keep riding the steep part of the curve, which is
 * left unguarded on purpose: the flooring below means a one-minute claim is
 * worth zero coins, so the exploit pays nothing, and defending against it
 * properly would require the module to keep secret state about a player who
 * is not trying to cheat.
 */
export function idleYield(state: IdleState | null, nowMs: number, opts: IdleOptions = {}): IdleYield {
  const o = resolveOptions(opts);
  const held = state ?? null;

  const now = finite(nowMs);
  const since = held ? finite(held.since) : null;

  // Either end of the interval being nonsense means we know nothing about how
  // long the player was away, and "nothing" resolves to zero rather than to a
  // guess. A guess here would be a payout invented out of a corrupt record.
  const gap = now !== null && since !== null ? now - since : 0;

  // A backwards clock lands here. Zero, never negative: the case does not
  // empty itself because a phone changed timezone.
  const elapsedMs = gap > 0 ? gap : 0;

  // Exactly at the cap is not capped: the case became full at the same instant
  // the player walked back in, and "your case was full" would be a strange
  // thing to say about that.
  const cappedAtMs = elapsedMs > o.capMs ? o.capMs : null;
  const accruedMs = Math.min(elapsedMs, o.capMs);

  const quality = held ? clamp01(finite(held.quality) ?? 0) : 0;
  const instrument = held ? instrumentMultiplier(o.instrumentMultipliers, held.instrumentId) : 1;
  const scale = (o.qualityFloor + (1 - o.qualityFloor) * quality) * instrument;

  const saturation = 1 - Math.exp(-accruedMs / HOUR_MS / o.taperHours);

  return {
    coins: whole(o.coinsPerHour * o.taperHours * saturation * scale),
    delight: whole(o.delightPerHour * o.taperHours * saturation * scale),
    elapsedMs,
    cappedAtMs,
  };
}

/**
 * One sentence for the journal.
 *
 * Numbers are spelled out because "forty-one coins" is a thing someone says
 * and "41 coins" is a thing a game says. The phrasing varies with the size of
 * the numbers rather than at random — a two-minute absence and a two-day one
 * should not read the same — with a small amount of extra variety chosen by
 * hashing the yield, so the line is still identical for identical numbers and
 * two consecutive similar absences do not produce the same sentence twice.
 */
export function describeIdleYield(y: IdleYield): string {
  const elapsedMs = Math.max(0, finite(y?.elapsedMs) ?? 0);
  const coins = Math.max(0, Math.floor(finite(y?.coins) ?? 0));
  const delight = Math.max(0, Math.floor(finite(y?.delight) ?? 0));
  const cappedAt = y ? finite(y.cappedAtMs) : null;

  const away =
    elapsedMs < 90 * 1000 ? 'You were only gone a moment' : `You were away ${describeDuration(elapsedMs)}`;

  let cased: string;
  if (coins <= 0) cased = 'the case is much as you left it';
  else if (coins === 1) cased = 'there is a single coin in the case';
  else if (coins <= 6) cased = `there are ${spell(coins)} coins in the case`;
  else cased = `the case has ${spell(coins)} coins in it`;

  const variant = hashString(`idle/${elapsedMs}/${coins}/${delight}`);
  const flourish = delight > 0 ? ` ${choose(flourishesFor(delight, coins > 0), variant)}` : '';

  // Two things have to be true before the cap is worth mentioning. There has
  // to be something in the case — "it was full" about an empty one is
  // nonsense — and the case has to have been full for long enough that "some
  // time before you got back" is not a lie. One millisecond past the cap it
  // is a lie: as far as anyone could tell, the case filling and the player
  // arriving were the same moment.
  const fullFor = cappedAt !== null ? elapsedMs - cappedAt : 0;
  const full =
    fullFor >= 30 * MINUTE_MS && (coins > 0 || delight > 0)
      ? ', though it was full some time before you got back'
      : '';

  return `${away}; ${cased}${flourish}${full}.`;
}

/**
 * Writes the open-case record, or clears it when passed null (which is what
 * "the player is here and playing" looks like — an absence that has ended
 * should not be able to pay out twice if the tab crashes).
 *
 * `since` is clamped to `nowMs` on the way in. An absence cannot begin in the
 * future, and catching that at the write is worth more than catching it at
 * the read: it means the stored record is always sane even if the clock that
 * wrote it was not.
 */
export function saveIdle(state: IdleState | null, nowMs: number = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    if (state === null || state === undefined) {
      store.removeItem(IDLE_STORAGE_KEY);
      return;
    }
    const now = finite(nowMs) ?? Date.now();
    const since = Math.min(finite(state.since) ?? now, now);
    const record: Stored = {
      v: 1,
      since: Math.round(since),
      i: typeof state.instrumentId === 'string' ? state.instrumentId : '',
      q: Math.round(clamp01(finite(state.quality) ?? 0) * 1000) / 1000,
    };
    store.setItem(IDLE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Quota, private browsing, partitioned storage. The game plays the same;
    // the player simply gets no idle progress, which is the honest failure.
  }
}

/**
 * Reads the record back, or null when there isn't one, storage is
 * unavailable, or the payload is anything other than exactly what we wrote.
 *
 * Every field is checked individually rather than trusting the version tag:
 * a half-written record from a tab killed mid-`setItem` parses fine and has
 * the right version, and a `since` of `undefined` would otherwise reach
 * `idleYield` as a NaN.
 */
export function loadIdle(): IdleState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(IDLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;

    const since = finite(parsed.since);
    if (since === null) return null;
    if (typeof parsed.i !== 'string') return null;

    return { since, instrumentId: parsed.i, quality: clamp01(finite(parsed.q) ?? 0) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Stored {
  v: 1;
  since: number;
  i: string;
  q: number;
}

/**
 * Matches the wrapper in `scaffoldStorage.ts`: `localStorage` can throw on
 * mere property access in private browsing and inside sandboxed iframes, and
 * this ships on GitHub Pages where both happen.
 */
function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** A number, or null if the value is anything that would poison arithmetic. */
function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Coins are things, not fractions of things. Flooring also means a claim too small to be a coin pays nothing. */
function whole(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function resolveOptions(opts: IdleOptions): Required<IdleOptions> {
  const d = DEFAULT_IDLE_OPTIONS;
  return {
    coinsPerHour: positiveOr(opts.coinsPerHour, d.coinsPerHour),
    delightPerHour: positiveOr(opts.delightPerHour, d.delightPerHour),
    // A zero or negative taper would divide the exponent by zero; falling back
    // to the default is kinder than throwing at a caller who passed a stray 0.
    taperHours: strictlyPositiveOr(opts.taperHours, d.taperHours),
    capMs: positiveOr(opts.capMs, d.capMs),
    qualityFloor: clamp01(finite(opts.qualityFloor) ?? d.qualityFloor),
    instrumentMultipliers: opts.instrumentMultipliers ?? d.instrumentMultipliers,
  };
}

/** Zero is a legal rate (a caller can switch idle off), negatives and junk are not. */
function positiveOr(value: number | undefined, fallback: number): number {
  const n = finite(value);
  return n !== null && n >= 0 ? n : fallback;
}

function strictlyPositiveOr(value: number | undefined, fallback: number): number {
  const n = finite(value);
  return n !== null && n > 0 ? n : fallback;
}

function instrumentMultiplier(table: Readonly<Record<string, number>>, id: string): number {
  if (typeof id !== 'string') return 1;
  const m = finite(table[id]);
  return m !== null && m >= 0 ? m : 1;
}

// ---------------------------------------------------------------------------
// The writing
// ---------------------------------------------------------------------------

/**
 * Duration in the words a person would use. Nobody says "four hundred and
 * twelve minutes", so the buckets get coarser as they get longer and top out
 * at "a long while" — which is also what stops a corrupt epoch-zero `since`
 * from producing "twenty thousand days" in the journal.
 */
function describeDuration(ms: number): string {
  if (ms < 10 * MINUTE_MS) return 'a few minutes';
  if (ms < 55 * MINUTE_MS) return `${spell(Math.round(ms / MINUTE_MS / 5) * 5)} minutes`;
  if (ms < 80 * MINUTE_MS) return 'an hour';
  // The gap between "an hour" and "two hours" is the one place where rounding
  // to whole hours reads as wrong rather than as vague: an hour and a half is
  // a phrase people use, and calling it "an hour" was losing half an hour of
  // someone's evening. Above 110 minutes whole hours are fine again, and the
  // first of them rounds to two, never back to one.
  if (ms < 110 * MINUTE_MS) return 'an hour and a half';
  if (ms < 22 * HOUR_MS) return `${spell(Math.round(ms / HOUR_MS))} hours`;
  if (ms < 40 * HOUR_MS) return 'a day';
  if (ms < 30 * DAY_MS) return `${spell(Math.round(ms / DAY_MS))} days`;
  return 'a long while';
}

/**
 * Delight is people, so the flourishes describe people. They escalate with
 * the number because the same line under a two-minute absence and a two-day
 * one would give the whole system away as a formula.
 *
 * `hasCoins` exists because most of these lines mention coins, and a line
 * about a child sorting the coins by size directly after "the case is much as
 * you left it" contradicts itself. The defaults cannot produce delight
 * without coins — coins accrue four times faster, so they round up first —
 * but a caller is free to set `delightPerHour` above `coinsPerHour`, and
 * prose that only holds for one set of numbers is prose waiting to break.
 */
function flourishesFor(delight: number, hasCoins: boolean): readonly string[] {
  if (!hasCoins) {
    return [
      'and someone hummed a little of your tune going past',
      'and somebody stopped to listen a while, then went on',
    ];
  }
  if (delight <= 2) {
    return ['and someone hummed a little of your tune going past', 'and there is a note in there, folded small'];
  }
  if (delight <= 6) {
    return ['and a child has arranged the coins by size', 'and someone left a button that is not worth anything'];
  }
  if (delight <= 12) {
    return ['and someone left a pressed flower on top', 'and two or three people seem to have stopped a while'];
  }
  return ['and word appears to have got round about you', 'and the coins are sitting on a folded map someone left'];
}

function choose(options: readonly string[], key: number): string {
  return options[key % options.length];
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Words up to 999, digits above — past a thousand of anything the word form stops being warm and starts being a mouthful. */
function spell(n: number): string {
  const value = Math.round(finite(n) ?? 0);
  if (value < 0 || value > 999) return String(value);
  if (value < 20) return ONES[value];
  if (value < 100) {
    const unit = value % 10;
    return unit === 0 ? TENS[Math.floor(value / 10)] : `${TENS[Math.floor(value / 10)]}-${ONES[unit]}`;
  }
  const rest = value % 100;
  const hundreds = `${ONES[Math.floor(value / 100)]} hundred`;
  return rest === 0 ? hundreds : `${hundreds} and ${spell(rest)}`;
}
