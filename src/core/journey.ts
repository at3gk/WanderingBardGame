/**
 * The day's journey — the state machine that sequences a walk, and the one
 * record the walk persists.
 *
 * ## The in-game day is the road, not the clock
 *
 * `dayFraction` advances with *distance walked*, never with wall time. You
 * set out at first light and reach the campfire at dusk, so the sky's colour
 * is a readout of how far you have come. That is the whole reason the
 * lighting is worth having: a player who walks for ten minutes and one who
 * dips in six times across an afternoon see the same golden hour at the same
 * bend in the road, and "it is getting late" means "you are nearly there"
 * rather than "you have been holding the phone a while". Tying it to the
 * clock instead would have made the sky drift out of sync with the road on
 * every interruption, and would have punished the player for putting the
 * game down — the opposite of what a cosy game should do.
 *
 * ## Lifetime totals are banked eagerly, never at dusk
 *
 * `totalMetres`, `totalCoins`, `totalEncounters` and `campfires` are updated
 * at the moment the thing happens, not when the day is closed out. This is
 * the single decision that makes the day rollover — the subtlest part of
 * this module — almost trivial: rolling over is a *reset of the daily
 * fields*, with nothing to reconcile or settle. The alternative, tallying
 * the day into lifetime totals when a new day is detected, means a player
 * who closes the tab mid-road and never returns loses everything they earned
 * that day, and it means the rollover path has to be correct for states it
 * has never seen (half-written, from a crashed tab, from a schema that has
 * since changed). Banking eagerly makes those cases uninteresting.
 *
 * Those four fields are deliberately the exact shape of `UnlockProgress` in
 * `instruments.ts`, so a `JourneyState` can be handed straight to
 * `unlockedInstruments()`. They are not imported here: this module is the
 * spine of the game and must stay loadable — and testable — without the
 * instrument catalogue, the road generator, or anything else behind it.
 * The structural match is checked by the caller's own types, not by an
 * import that would make the dependency run the wrong way.
 *
 * Pure apart from `saveJourney`/`loadJourney`, which are the only functions
 * that touch a browser global and which degrade to doing nothing when
 * storage is unavailable.
 *
 * Every exported function returns a *new* state object and never mutates its
 * argument, including when it declines to do anything. The render layer
 * diffs states, and a function that sometimes hands back the same reference
 * and sometimes does not is the shape of bug that only appears on the rare
 * path. Callers must therefore not read `next === previous` as "nothing
 * happened"; compare the fields they care about.
 */

export type Phase = 'waking' | 'walking' | 'busking' | 'encounter' | 'resting';

export interface JournalEntry {
  /** Where on the road it happened. */
  s: number;
  /** What the sky looked like when it happened, so the campfire recap can tint each line. */
  dayFraction: number;
  /** Free-form tag: 'busk', 'encounter', 'weather', 'idle'. Not an enum on purpose — see `recordEntry`. */
  kind: string;
  /** One sentence, already written. This module never composes prose. */
  line: string;
}

export interface JourneyState {
  /** The UTC day this walk belongs to, from `dayKey()` in `rng.ts`. */
  dayKey: string;
  phase: Phase;
  /** Arc distance along the day's road, in metres. Clamped to `[0, roadLengthM]`. */
  s: number;
  /** Time of day, derived from `s`. See `dayFractionAt`. */
  dayFraction: number;

  /** Today's takings. Reset at dawn; the lifetime figure is `totalCoins`. */
  coins: number;
  /** Today's audience delight. Reset at dawn. */
  delight: number;

  instrumentId: string;
  /** Every instrument the player may choose. Always contains `instrumentId`. */
  unlockedInstruments: string[];
  /**
   * The song pinned for the walk, or null to wander the songbook's rotation.
   *
   * A plain id rather than anything from the songbook, for the same reason
   * `instrumentId` is a plain string: this module must stay loadable without
   * the catalogue behind it. An id this build has never heard of is kept as
   * written and simply falls back to rotation downstream (`songForPass`),
   * so a save from a newer build does not lose the player's choice.
   */
  songChoice: string | null;
  /** Ids of road stops already played or resolved today, in the order they were reached. */
  visited: string[];

  totalMetres: number;
  totalCoins: number;
  totalEncounters: number;
  campfires: number;

  /** Today's moments, oldest first. Capped — see `MAX_JOURNAL_ENTRIES`. */
  journal: JournalEntry[];
}

/**
 * First light and dusk as fractions of a 24-hour day.
 *
 * Not 0 and 1: a road that started at midnight would spend its first stretch
 * in the dark, and one that ended at midnight would spend its last stretch
 * there too, which wastes the two prettiest parts of the cycle on an empty
 * road. 0.22 is a little after five in the morning and 0.90 is a little after
 * nine at night, which puts the whole golden afternoon in the middle of the
 * walk where the busking spots are.
 */
export const DAWN_FRACTION = 0.22;
export const DUSK_FRACTION = 0.9;

/** The instrument every bard starts with. Duplicated from `instruments.ts` rather than imported — see the file header. */
export const DEFAULT_INSTRUMENT_ID = 'lute';

/**
 * A day holds perhaps thirty notable moments. The cap is not a design limit,
 * it is a guard: a caller stuck in a loop must not be able to grow the
 * persisted record without bound. When it bites, the *oldest* entries go,
 * because the campfire recap reads the end of the day.
 */
export const MAX_JOURNAL_ENTRIES = 80;

/** Same reasoning, for the two id lists. A day's road has far fewer stops than this. */
const MAX_VISITED = 256;
const MAX_UNLOCKED = 64;

export const PHASES: readonly Phase[] = Object.freeze<Phase[]>([
  'waking',
  'walking',
  'busking',
  'encounter',
  'resting',
]);

/**
 * Which phase may follow which.
 *
 * The shape is deliberately a star around `walking`: the road is the hub and
 * everything else is a stop off it. You cannot go from a busking spot
 * straight into an encounter, because in the fiction you have to pick your
 * case up and walk on first, and in the code that rule is what guarantees
 * every side scene has exactly one exit to tear down against.
 *
 * `resting` has no successors. A day ends once; the way to the next day is
 * `startNewDay`, not a transition. Self-transitions are absent too, and that
 * matters for more than tidiness: re-entering `encounter` must not be able
 * to bump `totalEncounters` a second time.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = Object.freeze({
  waking: Object.freeze<Phase[]>(['walking']),
  walking: Object.freeze<Phase[]>(['busking', 'encounter', 'resting']),
  busking: Object.freeze<Phase[]>(['walking']),
  encounter: Object.freeze<Phase[]>(['walking']),
  resting: Object.freeze<Phase[]>([]),
});

/** The one key this module owns. Exported so a future "forget me" control has something to remove. */
export const JOURNEY_STORAGE_KEY = 'wb.journey.v1';

const SCHEMA_VERSION = 1;
const SAVE_THROTTLE_MS = 4000;

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

/**
 * Where on the dawn→dusk arc a position on the road falls.
 *
 * Linear, not eased. An eased curve would make the sky linger at dawn and at
 * dusk, which sounds nicer and is wrong here: the busking spots are spread
 * evenly along the road, so easing would give most of them the same light.
 * The road's own pacing — where the stops are, where the biomes change — is
 * what should make the day feel uneven, not a curve applied on top of it.
 *
 * A road of no length is a generator bug rather than a play state, so this
 * answers first light for it: it is the least misleading thing to say when
 * we cannot know how far along you are.
 */
export function dayFractionAt(s: number, roadLengthM: number): number {
  if (!Number.isFinite(roadLengthM) || roadLengthM <= 0) return DAWN_FRACTION;
  const t = clamp01(finiteOr(s, 0) / roadLengthM);
  return DAWN_FRACTION + (DUSK_FRACTION - DAWN_FRACTION) * t;
}

/**
 * Whether the campfire at the end of the road has been reached. Does not
 * itself end the day — sitting down is `enterPhase(state, 'resting')`, and
 * keeping the two apart is what lets a player linger at the last vista.
 *
 * A degenerate road length answers no. Saying yes would let a generator bug
 * end the day the instant it began, which is the failure that is hardest to
 * recognise from the outside.
 */
export function hasArrived(state: object, roadLengthM: number): boolean {
  if (!Number.isFinite(roadLengthM) || roadLengthM <= 0) return false;
  return normalize(state).s >= roadLengthM;
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

/** A fresh walk, at the roadside at first light, with no history at all. */
export function createJourney(dayKey: string, roadLengthM: number): JourneyState {
  return {
    dayKey: typeof dayKey === 'string' ? dayKey : '',
    phase: 'waking',
    s: 0,
    dayFraction: dayFractionAt(0, roadLengthM),
    coins: 0,
    delight: 0,
    instrumentId: DEFAULT_INSTRUMENT_ID,
    unlockedInstruments: [DEFAULT_INSTRUMENT_ID],
    songChoice: null,
    visited: [],
    totalMetres: 0,
    totalCoins: 0,
    totalEncounters: 0,
    campfires: 0,
    journal: [],
  };
}

/**
 * Walk `deltaMetres` further along the road.
 *
 * Distance only accrues while `walking`. Standing at a busking spot or
 * sitting at a fire does not move you down the road, and enforcing that here
 * rather than in the scene means the state machine alone decides when the
 * campfire becomes reachable — a scene that forgets to stop feeding the
 * walk cannot skip the player past a stop they are standing in.
 *
 * A negative delta is treated as zero rather than as walking backwards. In
 * practice it means a frame timer went backwards or a camera rig glitched,
 * and honouring it would un-reach stops and rewind the sky, which looks far
 * more broken than standing still for a frame does.
 *
 * `totalMetres` is credited with the distance *actually* covered, so walking
 * into the end of the road does not inflate the lifetime figure.
 */
export function advance(state: object, deltaMetres: number, roadLengthM: number): JourneyState {
  const next = normalize(state);

  // A road of no length is a generator bug rather than a play state, and the
  // safe reading of it is that there is nowhere to walk. Treating it as an
  // unbounded road — which is what falling back to an infinite limit here
  // would do — lets `s` and `totalMetres` climb for ever on a road that does
  // not exist, and lifetime metres are what unlock instruments. A bad road
  // should cost the player nothing and should not hand them the catalogue
  // either. This mirrors `hasArrived`, which refuses to end the day on one.
  if (!Number.isFinite(roadLengthM) || roadLengthM <= 0) {
    next.dayFraction = DAWN_FRACTION;
    return next;
  }

  if (next.phase === 'walking') {
    const delta = Math.max(0, finiteOr(deltaMetres, 0));
    const moved = Math.min(next.s + delta, roadLengthM);
    // The credit is floored at zero, not taken as the bare difference. A
    // stored `s` can be *longer* than the road being walked — a deploy landed
    // a shorter road under a save made this morning, which is an ordinary
    // event in a game that ships several times a day. Pulling the bard back
    // onto the road is right; billing them for the walk back is not, and the
    // bare difference would do exactly that, eating metres they really walked
    // and possibly taking an instrument back out of the case.
    next.totalMetres += Math.max(0, moved - next.s);
    next.s = moved;
  } else {
    // Clamp anyway, for the same reason: standing still on a road that has
    // since got shorter should still put the bard somewhere on it.
    next.s = Math.min(next.s, roadLengthM);
  }

  next.dayFraction = dayFractionAt(next.s, roadLengthM);
  return next;
}

/** Whether `phase` is a legal next phase from where the journey is now. */
export function canEnter(state: object, phase: string): boolean {
  const current = normalize(state).phase;
  return isPhase(phase) && LEGAL_TRANSITIONS[current].includes(phase);
}

/**
 * Move to `phase`, or return the journey unchanged if that move is not legal.
 *
 * Refusing rather than throwing is a considered choice. The callers are
 * scenes reacting to touch input and to a walk that is still running for a
 * frame or two after a transition has been requested; a double-tap on
 * "perform" arriving after the busk has already started is ordinary, not
 * exceptional. Callers that want to know first can ask `canEnter`.
 *
 * The two lifetime counters that key off a transition are bumped here, and
 * only on a legal one, which is why self-transitions are illegal.
 */
export function enterPhase(state: object, phase: string): JourneyState {
  const next = normalize(state);
  if (!isPhase(phase) || !LEGAL_TRANSITIONS[next.phase].includes(phase)) return next;

  next.phase = phase;
  if (phase === 'encounter') next.totalEncounters += 1;
  // A night by the fire counts wherever you made camp. If a scene ever lets a
  // tired bard stop short of the end, that is still a night by the fire.
  if (phase === 'resting') next.campfires += 1;
  return next;
}

/** The day is over once the bard has stopped for the night. Arriving at the campfire is not enough; sitting down is. */
export function isDayComplete(state: object): boolean {
  return normalize(state).phase === 'resting';
}

// ---------------------------------------------------------------------------
// Things that happen along the way
// ---------------------------------------------------------------------------

/**
 * Append a journal line.
 *
 * `s` and `dayFraction` default to wherever the journey currently is, so the
 * ordinary call is `recordEntry(state, { kind: 'busk', line })` and a caller
 * cannot accidentally stamp a moment with the wrong place. `kind` is a free
 * string rather than a union because the journal is a readout: a new kind of
 * moment should not require editing this file, and nothing here branches on
 * the value.
 *
 * An entry whose `line` is not a string is dropped. A journal line that is
 * not text is not a journal line, and quietly storing `undefined` would
 * surface as the word "undefined" in the campfire recap.
 */
export function recordEntry(state: object, entry: object): JourneyState {
  const next = normalize(state);
  const raw = asRecord(entry);
  if (typeof raw.line !== 'string') return next;

  // An overridden stamp is put through the same bounds `journalList` applies
  // on the way in from disk. Without that, an entry means one thing until the
  // state is next normalized and something else afterwards, and the recap
  // tints its lines from `dayFraction` — a value of 50 would light one line of
  // the campfire recap like nothing else on the page.
  next.journal = next.journal.concat({
    s: Math.max(0, finiteOr(raw.s, next.s)),
    dayFraction: clamp01(finiteOr(raw.dayFraction, next.dayFraction)),
    kind: typeof raw.kind === 'string' && raw.kind !== '' ? raw.kind : 'note',
    line: raw.line,
  });
  if (next.journal.length > MAX_JOURNAL_ENTRIES) {
    next.journal = next.journal.slice(next.journal.length - MAX_JOURNAL_ENTRIES);
  }
  return next;
}

/**
 * Mark a road stop as done, by its `RoadStop.id`.
 *
 * De-duplicating rather than counting is what makes the list safe to write
 * from a scene's teardown, which can run twice on a fast back-and-forth. The
 * order is preserved because the campfire recap walks it as an itinerary.
 */
export function visitStop(state: object, stopId: string): JourneyState {
  const next = normalize(state);
  if (typeof stopId !== 'string' || stopId === '' || next.visited.includes(stopId)) return next;
  next.visited = next.visited.concat(stopId).slice(-MAX_VISITED);
  return next;
}

/** Whether a stop has already been played or resolved today. */
export function hasVisited(state: object, stopId: string): boolean {
  return normalize(state).visited.includes(stopId);
}

/**
 * Take payment for a performance or a gift.
 *
 * Adds to today's purse and to the lifetime total in the same step, because
 * those two must never disagree — see the file header on eager banking.
 * Negative and non-finite amounts are ignored rather than clamped into
 * something: there is no way to lose coins in this game, so a negative
 * payout is a caller's arithmetic bug, and if spending is ever added it
 * should arrive as its own function that says so.
 */
export function earn(state: object, coins: number, delight = 0): JourneyState {
  const next = normalize(state);
  const c = Math.max(0, finiteOr(coins, 0));
  const d = Math.max(0, finiteOr(delight, 0));
  next.coins += c;
  next.totalCoins += c;
  next.delight += d;
  return next;
}

/** Add an instrument to the case. Idempotent, so an unlock check can run every frame. */
export function unlockInstrument(state: object, instrumentId: string): JourneyState {
  const next = normalize(state);
  if (typeof instrumentId !== 'string' || instrumentId === '') return next;
  if (next.unlockedInstruments.includes(instrumentId)) return next;
  next.unlockedInstruments = next.unlockedInstruments.concat(instrumentId).slice(-MAX_UNLOCKED);
  return next;
}

/**
 * Pick up an instrument. Refuses one that is not unlocked, so a stale menu or
 * a hand-edited save cannot put an instrument in the player's hands that the
 * audio layer has no voice for.
 */
export function chooseInstrument(state: object, instrumentId: string): JourneyState {
  const next = normalize(state);
  if (!next.unlockedInstruments.includes(instrumentId)) return next;
  next.instrumentId = instrumentId;
  return next;
}

/**
 * Pin one song for the walk, or hand the rotation back with `null`.
 *
 * Unlike `chooseInstrument` there is no unlock list to check against — every
 * song in the book is the player's to learn from the first step, because
 * choosing what to learn is the point (DESIGN.md, "Choose a song"). Anything
 * that is not a non-empty string is read as "wander".
 */
export function chooseSong(state: object, songId: string | null): JourneyState {
  const next = normalize(state);
  next.songChoice = typeof songId === 'string' && songId !== '' ? songId : null;
  return next;
}

// ---------------------------------------------------------------------------
// The day rollover
// ---------------------------------------------------------------------------

/**
 * Close out a journey and open a fresh one for `dayKey`.
 *
 * Kept and reset by the same rule everywhere: anything that describes *this
 * road* is reset, anything that describes *this bard* is kept. So the walk,
 * the day's purse, the itinerary and the journal go; the lifetime totals, the
 * instrument in hand and the case of unlocked instruments stay.
 *
 * Unconditional — it does not check whether the day has actually changed.
 * The comparison belongs to the caller that knows which day it is asking
 * about (`loadJourney`), and keeping it out of here means "start this day
 * over" is expressible too.
 */
export function startNewDay(state: object, dayKey: string): JourneyState {
  const previous = normalize(state);
  return {
    dayKey: typeof dayKey === 'string' ? dayKey : '',
    phase: 'waking',
    s: 0,
    dayFraction: DAWN_FRACTION,
    coins: 0,
    delight: 0,
    instrumentId: previous.instrumentId,
    unlockedInstruments: previous.unlockedInstruments.slice(),
    // The song being learnt describes the bard, not the road: repetition
    // across days is the whole mechanism, so a new dawn keeps the choice.
    songChoice: previous.songChoice,
    visited: [],
    totalMetres: previous.totalMetres,
    totalCoins: previous.totalCoins,
    totalEncounters: previous.totalEncounters,
    campfires: previous.campfires,
    journal: [],
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type StoredEntry = [s: number, dayFraction: number, kind: string, line: string];

interface Stored {
  v: number;
  day: string;
  phase: string;
  s: number;
  f: number;
  coins: number;
  delight: number;
  instrument: string;
  unlocked: string[];
  /** Pinned song id, or null while wandering. Absent in pre-v0.8 saves, which reads as null. */
  song?: string | null;
  visited: string[];
  metres: number;
  earned: number;
  encounters: number;
  campfires: number;
  journal: StoredEntry[];
}

let lastSaveMs = 0;

/**
 * Write the journey out.
 *
 * Throttled, because `s` changes every frame and a synchronous
 * `localStorage` write costs about a millisecond — sixty of those a second
 * is a visible stutter on a cheap phone for no benefit. `force` is for the
 * moments where the next chance may not come: a phase change, a payout, and
 * above all page-hide. The same `force`/`nowMs` shape as `saveScaffold` in
 * `scaffoldStorage.ts`, so there is one convention in the codebase rather
 * than two.
 *
 * Journal entries are stored as tuples. Field names would be about a third
 * of the payload at eighty entries, and this is the one record that can grow
 * during a day.
 */
export function saveJourney(state: object, force = false, nowMs: number = Date.now()): void {
  const now = finiteOr(nowMs, 0);
  // `now >= lastSaveMs` in the guard so a clock that jumps backwards (a
  // timezone change, an NTP correction) does not stall saving until it has
  // caught up again.
  if (!force && now >= lastSaveMs && now - lastSaveMs < SAVE_THROTTLE_MS) return;
  const store = storage();
  if (!store) return;
  lastSaveMs = now;

  try {
    const j = normalize(state);
    const record: Stored = {
      v: SCHEMA_VERSION,
      day: j.dayKey,
      phase: j.phase,
      s: round(j.s, 1),
      f: round(j.dayFraction, 4),
      coins: round(j.coins, 2),
      delight: round(j.delight, 2),
      instrument: j.instrumentId,
      unlocked: j.unlockedInstruments,
      song: j.songChoice,
      visited: j.visited,
      metres: round(j.totalMetres, 1),
      earned: round(j.totalCoins, 2),
      encounters: Math.round(j.totalEncounters),
      campfires: Math.round(j.campfires),
      journal: j.journal.map((e): StoredEntry => [round(e.s, 1), round(e.dayFraction, 4), e.kind, e.line]),
    };
    store.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Quota, private browsing, partitioned storage. The walk continues; the
    // player simply resumes at dawn next time, which is the honest failure.
  }
}

/**
 * Read the journey back for the day being asked about.
 *
 * Three outcomes, and the middle one is the whole point of the function:
 * there is no record (null — the caller calls `createJourney`); there is a
 * record from *another* day, in which case that day is closed out and a
 * fresh one is handed back carrying the lifetime totals; or there is today's
 * record, resumed as it stood.
 *
 * A record from a schema version this build does not know is discarded
 * rather than salvaged. Its field *names* might match while their meanings
 * have moved, and a lifetime total read out of the wrong field is worse than
 * a lost one. A future version bump therefore has to bring an explicit
 * migration with it; there is deliberately nothing here that would let one
 * be forgotten quietly.
 *
 * Reads never write. The rolled-over state is not persisted until the caller
 * saves it, so a player who opens the tab and closes it again has not yet
 * spent their previous day.
 */
export function loadJourney(dayKey: string): JourneyState | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.v !== SCHEMA_VERSION) return null;

    // Everything below is fed through `normalize`, the same validator every
    // other entry point uses. Two validators for one shape drift apart, and
    // the one that drifts is always the storage one because it is the one
    // nobody exercises by playing.
    const candidate = normalize({
      dayKey: parsed.day,
      phase: parsed.phase,
      s: parsed.s,
      dayFraction: parsed.f,
      coins: parsed.coins,
      delight: parsed.delight,
      instrumentId: parsed.instrument,
      unlockedInstruments: parsed.unlocked,
      songChoice: parsed.song,
      visited: parsed.visited,
      totalMetres: parsed.metres,
      totalCoins: parsed.earned,
      totalEncounters: parsed.encounters,
      campfires: parsed.campfires,
      journal: Array.isArray(parsed.journal)
        ? parsed.journal.map((e) =>
            Array.isArray(e) ? { s: e[0], dayFraction: e[1], kind: e[2], line: e[3] } : e
          )
        : [],
    });

    return candidate.dayKey === dayKey ? candidate : startNewDay(candidate, dayKey);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Turn anything at all into a usable `JourneyState`, repairing rather than
 * rejecting wherever a sensible repair exists.
 *
 * Every exported function starts here, which is why they all take `object`
 * instead of `JourneyState`. The states this module is handed come off disk,
 * out of a scene that may have been mid-edit when it reloaded, and out of
 * tests; making the boundary total once is cheaper and far more honest than
 * dotting optional chaining through the state machine.
 */
function normalize(input: unknown): JourneyState {
  const raw = asRecord(input);

  const unlocked = stringList(raw.unlockedInstruments, MAX_UNLOCKED);
  // An unknown or missing instrument falls back to the first one in the case
  // rather than straight to the lute: a save that lost its `instrumentId` but
  // kept its unlocks should put something the player has earned in their hands.
  let instrumentId = typeof raw.instrumentId === 'string' && raw.instrumentId !== '' ? raw.instrumentId : '';
  if (instrumentId === '') instrumentId = unlocked[0] ?? DEFAULT_INSTRUMENT_ID;
  if (!unlocked.includes(instrumentId)) {
    unlocked.unshift(instrumentId);
    // Forcing the chosen instrument back in must not push the list past its
    // own cap. If it did, every save/load cycle would grow the record by one
    // and `stringList` would trim the front on the way back in — which is
    // where the chosen instrument now sits — so a real unlock would be lost
    // each time round. The oldest of the rest goes instead, as above.
    if (unlocked.length > MAX_UNLOCKED) unlocked.splice(1, unlocked.length - MAX_UNLOCKED);
  }

  const s = Math.max(0, finiteOr(raw.s, 0));

  return {
    dayKey: typeof raw.dayKey === 'string' ? raw.dayKey : '',
    // An unrecognised phase resolves to `walking`, not `waking`. Walking is
    // the hub every other phase is reachable from, so it is the state a
    // confused save recovers from without replaying the morning.
    phase: isPhase(raw.phase) ? raw.phase : 'walking',
    s,
    dayFraction: clamp01(finiteOr(raw.dayFraction, DAWN_FRACTION)),
    coins: Math.max(0, finiteOr(raw.coins, 0)),
    delight: Math.max(0, finiteOr(raw.delight, 0)),
    instrumentId,
    unlockedInstruments: unlocked,
    songChoice:
      typeof raw.songChoice === 'string' && raw.songChoice !== '' ? raw.songChoice : null,
    visited: stringList(raw.visited, MAX_VISITED),
    totalMetres: Math.max(0, finiteOr(raw.totalMetres, 0)),
    totalCoins: Math.max(0, finiteOr(raw.totalCoins, 0)),
    totalEncounters: Math.max(0, Math.floor(finiteOr(raw.totalEncounters, 0))),
    campfires: Math.max(0, Math.floor(finiteOr(raw.campfires, 0))),
    journal: journalList(raw.journal),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** De-duplicated, order-preserving, string-only, bounded. Keeps the *newest* when it overflows. */
function stringList(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item === '' || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out.length > cap ? out.slice(out.length - cap) : out;
}

function journalList(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const out: JournalEntry[] = [];
  for (const item of value) {
    const e = asRecord(item);
    if (typeof e.line !== 'string') continue;
    out.push({
      s: Math.max(0, finiteOr(e.s, 0)),
      dayFraction: clamp01(finiteOr(e.dayFraction, DAWN_FRACTION)),
      kind: typeof e.kind === 'string' && e.kind !== '' ? e.kind : 'note',
      line: e.line,
    });
  }
  return out.length > MAX_JOURNAL_ENTRIES ? out.slice(out.length - MAX_JOURNAL_ENTRIES) : out;
}

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}
