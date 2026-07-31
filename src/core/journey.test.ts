import { afterEach, describe, expect, it } from 'vitest';
import {
  DAWN_FRACTION,
  DEFAULT_INSTRUMENT_ID,
  DUSK_FRACTION,
  JOURNEY_STORAGE_KEY,
  JourneyState,
  LEGAL_TRANSITIONS,
  MAX_JOURNAL_ENTRIES,
  PHASES,
  Phase,
  advance,
  canEnter,
  chooseInstrument,
  chooseSong,
  createJourney,
  dayFractionAt,
  earn,
  enterPhase,
  hasArrived,
  hasVisited,
  isDayComplete,
  loadJourney,
  recordEntry,
  saveJourney,
  startNewDay,
  unlockInstrument,
  visitStop,
} from './journey';

const DAY = '2026-07-28';
const NEXT_DAY = '2026-07-29';
const LENGTH = 1500;

/** A journey already out on the road, so transition tests do not all begin with the same `waking → walking`. */
function walking(overrides: Partial<JourneyState> = {}): JourneyState {
  return { ...createJourney(DAY, LENGTH), phase: 'walking', ...overrides };
}

function inPhase(phase: Phase): JourneyState {
  return walking({ phase });
}

/**
 * Freezes a state through and through. Module code is strict-mode, so any
 * assignment into a frozen object throws at the point of the mistake — a
 * sharper immutability check than comparing before-and-after snapshots,
 * which only notices mutations that change a value.
 */
function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

describe('dayFractionAt', () => {
  it('sets out at first light and arrives at dusk', () => {
    expect(dayFractionAt(0, LENGTH)).toBeCloseTo(DAWN_FRACTION, 10);
    expect(dayFractionAt(LENGTH, LENGTH)).toBeCloseTo(DUSK_FRACTION, 10);
  });

  it('puts the whole golden afternoon inside the walk', () => {
    // Half way down the road should be early afternoon, not morning and not
    // evening. If this ever fails the mapping has stopped being narrative.
    const midday = dayFractionAt(LENGTH / 2, LENGTH);
    expect(midday).toBeGreaterThan(0.5);
    expect(midday).toBeLessThan(0.62);
  });

  it('increases strictly with distance and never leaves the arc', () => {
    let previous = -1;
    for (let s = 0; s <= LENGTH; s += LENGTH / 64) {
      const f = dayFractionAt(s, LENGTH);
      expect(f).toBeGreaterThan(previous);
      expect(f).toBeGreaterThanOrEqual(DAWN_FRACTION);
      expect(f).toBeLessThanOrEqual(DUSK_FRACTION);
      previous = f;
    }
  });

  it('clamps rather than running past dusk or before dawn', () => {
    expect(dayFractionAt(LENGTH * 3, LENGTH)).toBeCloseTo(DUSK_FRACTION, 10);
    expect(dayFractionAt(-500, LENGTH)).toBeCloseTo(DAWN_FRACTION, 10);
  });

  it('answers first light for a road of no length rather than a NaN', () => {
    expect(dayFractionAt(100, 0)).toBe(DAWN_FRACTION);
    expect(dayFractionAt(100, -1)).toBe(DAWN_FRACTION);
    expect(dayFractionAt(100, Number.NaN)).toBe(DAWN_FRACTION);
  });

  it('is unaffected by a nonsense position', () => {
    expect(dayFractionAt(Number.NaN, LENGTH)).toBe(DAWN_FRACTION);
  });
});

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

describe('createJourney', () => {
  it('starts at the roadside at first light with nothing behind it', () => {
    const j = createJourney(DAY, LENGTH);
    expect(j.dayKey).toBe(DAY);
    expect(j.phase).toBe('waking');
    expect(j.s).toBe(0);
    expect(j.dayFraction).toBeCloseTo(DAWN_FRACTION, 10);
    expect(j.coins).toBe(0);
    expect(j.delight).toBe(0);
    expect(j.journal).toEqual([]);
    expect(j.visited).toEqual([]);
    expect(j.totalMetres).toBe(0);
    expect(j.totalCoins).toBe(0);
    expect(j.totalEncounters).toBe(0);
    expect(j.campfires).toBe(0);
  });

  it('hands the bard the starting instrument, and only that one', () => {
    const j = createJourney(DAY, LENGTH);
    expect(j.instrumentId).toBe(DEFAULT_INSTRUMENT_ID);
    expect(j.unlockedInstruments).toEqual([DEFAULT_INSTRUMENT_ID]);
  });
});

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

describe('advance', () => {
  it('moves the bard and the sky together', () => {
    const j = advance(walking(), 750, LENGTH);
    expect(j.s).toBe(750);
    expect(j.dayFraction).toBeCloseTo((DAWN_FRACTION + DUSK_FRACTION) / 2, 10);
    expect(j.totalMetres).toBe(750);
  });

  it('accumulates across calls', () => {
    let j: JourneyState = walking();
    for (let i = 0; i < 10; i++) j = advance(j, 30, LENGTH);
    expect(j.s).toBe(300);
    expect(j.totalMetres).toBe(300);
  });

  it('does not move while standing at a stop or sitting at the fire', () => {
    for (const phase of ['waking', 'busking', 'encounter', 'resting'] as const) {
      const j = advance(inPhase(phase), 400, LENGTH);
      expect(j.s).toBe(0);
      expect(j.totalMetres).toBe(0);
    }
  });

  it('pins at the end of the road without inflating the lifetime distance', () => {
    const j = advance(walking({ s: 1400, totalMetres: 1400 }), 9000, LENGTH);
    expect(j.s).toBe(LENGTH);
    expect(j.totalMetres).toBe(LENGTH);
  });

  it('refuses to walk backwards', () => {
    const j = advance(walking({ s: 400, totalMetres: 400 }), -120, LENGTH);
    expect(j.s).toBe(400);
    expect(j.totalMetres).toBe(400);
  });

  it('survives a nonsense delta by standing still', () => {
    // Exact, not a range: a NaN delta that teleported the bard to the end of
    // the road would satisfy "still finite, still on the road" and is the
    // failure this test exists to catch.
    for (const delta of [Number.NaN, Infinity, -Infinity]) {
      const j = advance(walking({ s: 200, totalMetres: 200 }), delta as number, LENGTH);
      expect(j.s).toBe(200);
      expect(j.totalMetres).toBe(200);
    }
  });

  it('pulls a stored position back onto a shorter road', () => {
    // A shorter road has landed under a save from earlier today. The bard
    // should be at its campfire, not past it — in every phase, because the
    // walking branch is the one a resumed save actually arrives in.
    for (const phase of PHASES) {
      expect(advance(walking({ phase, s: 1400 }), 0, 900).s).toBe(900);
    }
  });

  it('does not bill the bard for being pulled back onto a shorter road', () => {
    // The regression this guards: clamping `s` down while walking used to be
    // credited as a negative distance, so a shorter road silently subtracted
    // 500 m from the lifetime figure that gates the instrument unlocks.
    const j = advance(walking({ s: 1400, totalMetres: 5000 }), 0, 900);
    expect(j.s).toBe(900);
    expect(j.totalMetres).toBe(5000);

    // And it must not be recoverable by walking either: the next honest step
    // is credited in full, from the clamped position.
    expect(advance(j, 50, 900).totalMetres).toBe(5000);
  });

  it('stands still on a road of no length rather than walking for ever', () => {
    // An unbounded fallback here would let a generator bug pay out lifetime
    // metres at sixty frames a second, and lifetime metres unlock instruments.
    for (const length of [0, -1, Number.NaN, Infinity]) {
      let j: JourneyState = walking();
      for (let i = 0; i < 5; i++) j = advance(j, 1000, length);
      expect(j.s).toBe(0);
      expect(j.totalMetres).toBe(0);
      expect(j.dayFraction).toBe(DAWN_FRACTION);
    }
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(walking());
    const after = advance(before, 100, LENGTH);
    expect(after).not.toBe(before);
    expect(before.s).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

describe('enterPhase', () => {
  it('allows exactly the transitions in the table and no others', () => {
    for (const from of PHASES) {
      for (const to of PHASES) {
        const legal = LEGAL_TRANSITIONS[from].includes(to);
        const result = enterPhase(inPhase(from), to);
        expect(canEnter(inPhase(from), to)).toBe(legal);
        expect(result.phase).toBe(legal ? to : from);
      }
    }
  });

  it('routes everything through walking, so no side scene leads to another', () => {
    expect(canEnter(inPhase('busking'), 'encounter')).toBe(false);
    expect(canEnter(inPhase('encounter'), 'busking')).toBe(false);
    expect(canEnter(inPhase('waking'), 'busking')).toBe(false);
  });

  it('treats every self-transition as illegal', () => {
    for (const phase of PHASES) {
      expect(canEnter(inPhase(phase), phase)).toBe(false);
    }
  });

  it('ends the day for good once the bard has sat down', () => {
    for (const to of PHASES) {
      expect(enterPhase(inPhase('resting'), to).phase).toBe('resting');
    }
  });

  it('ignores a phase name it does not know', () => {
    expect(canEnter(walking(), 'dancing')).toBe(false);
    expect(enterPhase(walking(), 'dancing').phase).toBe('walking');
    expect(enterPhase(walking(), '').phase).toBe('walking');
  });

  it('counts an encounter once, on the way in', () => {
    const met = enterPhase(walking(), 'encounter');
    expect(met.totalEncounters).toBe(1);
    // A second request while already in the encounter must not count again.
    expect(enterPhase(met, 'encounter').totalEncounters).toBe(1);
    expect(enterPhase(enterPhase(met, 'walking'), 'encounter').totalEncounters).toBe(2);
  });

  it('counts a night by the fire once', () => {
    const rested = enterPhase(walking(), 'resting');
    expect(rested.campfires).toBe(1);
    expect(enterPhase(rested, 'resting').campfires).toBe(1);
  });

  it('does not count an illegal move towards a counted phase', () => {
    expect(enterPhase(inPhase('busking'), 'encounter').totalEncounters).toBe(0);
    expect(enterPhase(inPhase('busking'), 'resting').campfires).toBe(0);
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(walking());
    const after = enterPhase(before, 'encounter');
    expect(after).not.toBe(before);
    expect(before.phase).toBe('walking');
    expect(before.totalEncounters).toBe(0);
  });
});

describe('isDayComplete / hasArrived', () => {
  it('is complete only while resting', () => {
    for (const phase of PHASES) {
      expect(isDayComplete(inPhase(phase))).toBe(phase === 'resting');
    }
  });

  it('separates reaching the campfire from stopping at it', () => {
    const arrived = advance(walking(), LENGTH, LENGTH);
    expect(hasArrived(arrived, LENGTH)).toBe(true);
    expect(isDayComplete(arrived)).toBe(false);
    expect(isDayComplete(enterPhase(arrived, 'resting'))).toBe(true);
  });

  it('has not arrived part way along', () => {
    expect(hasArrived(walking({ s: LENGTH - 1 }), LENGTH)).toBe(false);
  });

  it('refuses to declare arrival on a road of no length', () => {
    expect(hasArrived(walking(), 0)).toBe(false);
    expect(hasArrived(walking(), Number.NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Things that happen along the way
// ---------------------------------------------------------------------------

describe('visitStop', () => {
  it('records stops once each, in the order they were reached', () => {
    let j: JourneyState = walking();
    j = visitStop(j, `${DAY}/busk/0`);
    j = visitStop(j, `${DAY}/encounter/1`);
    j = visitStop(j, `${DAY}/busk/0`);
    expect(j.visited).toEqual([`${DAY}/busk/0`, `${DAY}/encounter/1`]);
  });

  it('answers whether a stop is done', () => {
    const j = visitStop(walking(), 'a');
    expect(hasVisited(j, 'a')).toBe(true);
    expect(hasVisited(j, 'b')).toBe(false);
  });

  it('ignores an empty or non-string id rather than storing a blank', () => {
    expect(visitStop(walking(), '').visited).toEqual([]);
    expect(visitStop(walking(), undefined as unknown as string).visited).toEqual([]);
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(visitStop(walking(), 'a'));
    expect(visitStop(before, 'b').visited).toEqual(['a', 'b']);
    expect(before.visited).toEqual(['a']);
  });
});

describe('recordEntry', () => {
  it('keeps the journal in the order the day happened', () => {
    let j: JourneyState = walking();
    j = recordEntry(j, { kind: 'busk', line: 'first' });
    j = advance(j, 500, LENGTH);
    j = recordEntry(j, { kind: 'weather', line: 'second' });
    expect(j.journal.map((e) => e.line)).toEqual(['first', 'second']);
  });

  it('stamps an entry with where and when it happened', () => {
    const j = recordEntry(advance(walking(), 300, LENGTH), { kind: 'busk', line: 'a fiddler joined in' });
    expect(j.journal[0].s).toBe(300);
    expect(j.journal[0].dayFraction).toBeCloseTo(dayFractionAt(300, LENGTH), 10);
    expect(j.journal[0].kind).toBe('busk');
  });

  it('lets a caller override the stamp for a moment recorded late', () => {
    const j = recordEntry(walking({ s: 900 }), { s: 40, dayFraction: 0.3, kind: 'idle', line: 'the case filled' });
    expect(j.journal[0].s).toBe(40);
    expect(j.journal[0].dayFraction).toBe(0.3);
  });

  it('holds an overridden stamp to the same bounds a stamp read from disk gets', () => {
    // Otherwise an entry means one thing until the state is next normalized
    // and something else afterwards, and the recap tints each line from
    // `dayFraction` — a value of 50 would light one line unlike any other.
    const j = recordEntry(walking({ s: 900 }), { s: -40, dayFraction: 50, line: 'out of bounds' });
    expect(j.journal[0].s).toBe(0);
    expect(j.journal[0].dayFraction).toBe(1);
    // Normalizing again must not move it a second time.
    expect(advance(j, 0, LENGTH).journal[0]).toEqual(j.journal[0]);
  });

  it('drops an entry that is not text, rather than writing the word undefined into the recap', () => {
    expect(recordEntry(walking(), { kind: 'busk' }).journal).toEqual([]);
    expect(recordEntry(walking(), { line: 42 }).journal).toEqual([]);
    expect(recordEntry(walking(), {}).journal).toEqual([]);
  });

  it('falls back to a plain kind', () => {
    expect(recordEntry(walking(), { line: 'x' }).journal[0].kind).toBe('note');
    expect(recordEntry(walking(), { kind: '', line: 'x' }).journal[0].kind).toBe('note');
  });

  it('keeps the end of the day when the journal overflows', () => {
    let j: JourneyState = walking();
    for (let i = 0; i < MAX_JOURNAL_ENTRIES + 25; i++) j = recordEntry(j, { line: `line ${i}` });
    expect(j.journal).toHaveLength(MAX_JOURNAL_ENTRIES);
    expect(j.journal[j.journal.length - 1].line).toBe(`line ${MAX_JOURNAL_ENTRIES + 24}`);
    expect(j.journal[0].line).toBe('line 25');
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(recordEntry(walking(), { line: 'a' }));
    expect(recordEntry(before, { line: 'b' }).journal).toHaveLength(2);
    expect(before.journal).toHaveLength(1);
  });
});

describe('earn', () => {
  it('pays the day and the lifetime in the same step', () => {
    const j = earn(earn(walking(), 12, 3), 5, 1);
    expect(j.coins).toBe(17);
    expect(j.totalCoins).toBe(17);
    expect(j.delight).toBe(4);
  });

  it('ignores a negative or nonsense payout instead of taking coins away', () => {
    const start = earn(walking(), 10, 2);
    for (const bad of [-5, Number.NaN, Infinity]) {
      const j = earn(start, bad as number, bad as number);
      expect(j.coins).toBe(10);
      expect(j.totalCoins).toBe(10);
      expect(j.delight).toBe(2);
    }
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(walking());
    expect(earn(before, 9).coins).toBe(9);
    expect(before.coins).toBe(0);
  });
});

describe('instruments', () => {
  it('adds an instrument once, however often the unlock check runs', () => {
    let j: JourneyState = walking();
    j = unlockInstrument(j, 'reed-flute');
    j = unlockInstrument(j, 'reed-flute');
    expect(j.unlockedInstruments).toEqual([DEFAULT_INSTRUMENT_ID, 'reed-flute']);
  });

  it('refuses an instrument the player has not earned', () => {
    const j = chooseInstrument(walking(), 'hurdy-gurdy');
    expect(j.instrumentId).toBe(DEFAULT_INSTRUMENT_ID);
  });

  it('picks up an unlocked instrument', () => {
    const j = chooseInstrument(unlockInstrument(walking(), 'small-harp'), 'small-harp');
    expect(j.instrumentId).toBe('small-harp');
  });

  it('ignores an empty id', () => {
    expect(unlockInstrument(walking(), '').unlockedInstruments).toEqual([DEFAULT_INSTRUMENT_ID]);
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(walking());
    expect(unlockInstrument(before, 'bells').unlockedInstruments).toHaveLength(2);
    expect(before.unlockedInstruments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The day rollover
// ---------------------------------------------------------------------------

/** A day's walk with something to show for it, used by the rollover tests. */
function spentDay(): JourneyState {
  let j: JourneyState = enterPhase(createJourney(DAY, LENGTH), 'walking');
  j = advance(j, 900, LENGTH);
  j = enterPhase(j, 'encounter');
  j = earn(j, 40, 8);
  j = enterPhase(j, 'walking');
  j = visitStop(j, `${DAY}/encounter/0`);
  j = recordEntry(j, { kind: 'encounter', line: 'a tinker traded a song for directions' });
  j = advance(j, 600, LENGTH);
  j = unlockInstrument(j, 'reed-flute');
  j = chooseInstrument(j, 'reed-flute');
  return enterPhase(j, 'resting');
}

describe('startNewDay', () => {
  it('carries everything about the bard forward', () => {
    const yesterday = spentDay();
    const today = startNewDay(yesterday, NEXT_DAY);
    expect(today.totalMetres).toBe(yesterday.totalMetres);
    expect(today.totalCoins).toBe(yesterday.totalCoins);
    expect(today.totalEncounters).toBe(yesterday.totalEncounters);
    expect(today.campfires).toBe(yesterday.campfires);
    expect(today.instrumentId).toBe('reed-flute');
    expect(today.unlockedInstruments).toEqual(yesterday.unlockedInstruments);
  });

  it('leaves everything about yesterday behind', () => {
    const today = startNewDay(spentDay(), NEXT_DAY);
    expect(today.dayKey).toBe(NEXT_DAY);
    expect(today.phase).toBe('waking');
    expect(today.s).toBe(0);
    expect(today.dayFraction).toBe(DAWN_FRACTION);
    expect(today.coins).toBe(0);
    expect(today.delight).toBe(0);
    expect(today.visited).toEqual([]);
    expect(today.journal).toEqual([]);
    expect(isDayComplete(today)).toBe(false);
  });

  it('loses nothing when a day is abandoned mid-road', () => {
    // The whole reason lifetime totals are banked as they are earned: a tab
    // closed at noon must still count towards the next instrument.
    let j: JourneyState = advance(enterPhase(createJourney(DAY, LENGTH), 'walking'), 800, LENGTH);
    j = earn(j, 55, 9);
    const today = startNewDay(j, NEXT_DAY);
    expect(today.totalMetres).toBe(800);
    expect(today.totalCoins).toBe(55);
    expect(today.campfires).toBe(0);
  });

  it('copies the instrument list rather than sharing it with yesterday', () => {
    const yesterday = spentDay();
    const today = startNewDay(yesterday, NEXT_DAY);
    expect(today.unlockedInstruments).not.toBe(yesterday.unlockedInstruments);
  });

  it('can restart the same day without touching lifetime totals', () => {
    const again = startNewDay(spentDay(), DAY);
    expect(again.dayKey).toBe(DAY);
    expect(again.s).toBe(0);
    expect(again.totalMetres).toBe(1500);
  });

  it('never mutates the state it was given', () => {
    const before = deepFreeze(spentDay());
    startNewDay(before, NEXT_DAY);
    expect(before.s).toBe(LENGTH);
    expect(before.journal).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Repairing states from outside
// ---------------------------------------------------------------------------

describe('states from outside', () => {
  it('makes something usable out of nothing at all', () => {
    for (const junk of [null, undefined, {}, [], 'nope', 7]) {
      const j = advance(junk as unknown as object, 10, LENGTH);
      expect(PHASES).toContain(j.phase);
      expect(Number.isFinite(j.s)).toBe(true);
      expect(j.unlockedInstruments).toContain(j.instrumentId);
    }
  });

  it('recovers an unknown phase onto the road rather than back into the morning', () => {
    expect(advance({ phase: 'juggling' }, 0, LENGTH).phase).toBe('walking');
  });

  it('clamps nonsense numbers instead of propagating them', () => {
    const j = advance(
      { s: -40, coins: Number.NaN, totalMetres: -1, totalEncounters: 2.7, campfires: Infinity },
      0,
      LENGTH
    );
    expect(j.s).toBe(0);
    expect(j.coins).toBe(0);
    expect(j.totalMetres).toBe(0);
    expect(j.totalEncounters).toBe(2);
    expect(j.campfires).toBe(0);
  });

  it('always leaves an instrument in the bard hands', () => {
    expect(advance({ instrumentId: 42, unlockedInstruments: null }, 0, LENGTH).instrumentId).toBe(
      DEFAULT_INSTRUMENT_ID
    );
    // A save that lost its chosen instrument but kept its unlocks should get
    // back something the player earned, not be demoted to the lute.
    const j = advance({ unlockedInstruments: ['bells', 'small-harp'] }, 0, LENGTH);
    expect(j.instrumentId).toBe('bells');
  });

  it('keeps the chosen instrument in the unlocked list even if the save disagreed', () => {
    const j = advance({ instrumentId: 'bells', unlockedInstruments: ['lute'] }, 0, LENGTH);
    expect(j.unlockedInstruments).toContain('bells');
  });

  it('strips junk out of the id lists and the journal', () => {
    const j = advance(
      {
        visited: ['a', 'a', '', 3, null, 'b'],
        journal: [{ line: 'kept' }, 'not an entry', { kind: 'x' }, null],
      },
      0,
      LENGTH
    );
    expect(j.visited).toEqual(['a', 'b']);
    expect(j.journal.map((e) => e.line)).toEqual(['kept']);
  });
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function installStorage(impl: Partial<Storage> | 'throws-on-access' | null): void {
  if (impl === null) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    return;
  }
  if (impl === 'throws-on-access') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is disabled');
      },
    });
    return;
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: impl });
}

function memoryStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    length: 0,
    clear: () => map.clear(),
    key: () => null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage & { map: Map<string, string> };
}

function put(raw: string): Storage & { map: Map<string, string> } {
  const store = memoryStorage();
  store.map.set(JOURNEY_STORAGE_KEY, raw);
  installStorage(store);
  return store;
}

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
});

describe('saveJourney / loadJourney', () => {
  it('round-trips a day that has been lived in', () => {
    installStorage(memoryStorage());
    const j = spentDay();
    saveJourney(j, true);
    const back = loadJourney(DAY);
    expect(back).not.toBeNull();
    expect(back).toEqual(j);
  });

  it('returns null when there is nothing stored', () => {
    installStorage(memoryStorage());
    expect(loadJourney(DAY)).toBeNull();
  });

  it('returns null when there is no storage at all', () => {
    installStorage(null);
    expect(loadJourney(DAY)).toBeNull();
    expect(() => saveJourney(spentDay(), true)).not.toThrow();
  });

  it('degrades quietly when touching localStorage at all throws', () => {
    installStorage('throws-on-access');
    expect(loadJourney(DAY)).toBeNull();
    expect(() => saveJourney(spentDay(), true)).not.toThrow();
  });

  it('degrades quietly when the write throws', () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => saveJourney(spentDay(), true)).not.toThrow();
  });

  it('degrades quietly when the read throws', () => {
    installStorage({
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(loadJourney(DAY)).toBeNull();
  });

  it('discards a record that is not JSON', () => {
    put('{not json at all');
    expect(loadJourney(DAY)).toBeNull();
  });

  it('discards a record that is JSON but not ours', () => {
    for (const raw of ['null', '[1,2,3]', '"a string"', '{"user":"bob"}', '42']) {
      put(raw);
      expect(loadJourney(DAY)).toBeNull();
    }
  });

  it('discards a record from a schema version this build does not know', () => {
    const store = memoryStorage();
    installStorage(store);
    saveJourney(spentDay(), true);
    const record = JSON.parse(store.map.get(JOURNEY_STORAGE_KEY) as string) as Record<string, unknown>;
    for (const v of [0, 2, 99, '1', null]) {
      store.map.set(JOURNEY_STORAGE_KEY, JSON.stringify({ ...record, v }));
      expect(loadJourney(DAY)).toBeNull();
    }
  });

  it('repairs a half-written record instead of handing back holes', () => {
    put(JSON.stringify({ v: 1, day: DAY, s: 300 }));
    const back = loadJourney(DAY);
    expect(back).not.toBeNull();
    expect(back?.s).toBe(300);
    expect(back?.instrumentId).toBe(DEFAULT_INSTRUMENT_ID);
    expect(back?.unlockedInstruments).toEqual([DEFAULT_INSTRUMENT_ID]);
    expect(back?.journal).toEqual([]);
    expect(back?.visited).toEqual([]);
    // Named, not "some member of PHASES": a record with no phase must resume
    // on the road, and resuming into 'waking' or 'resting' would be a
    // different bug that a membership check would wave through.
    expect(back?.phase).toBe('walking');
  });

  it('resumes the same day exactly where it was left', () => {
    installStorage(memoryStorage());
    const j = spentDay();
    saveJourney(j, true);
    const back = loadJourney(DAY) as JourneyState;
    expect(back.dayKey).toBe(DAY);
    expect(back.s).toBe(j.s);
    expect(back.coins).toBe(j.coins);
    expect(back.visited).toEqual(j.visited);
    expect(back.journal).toEqual(j.journal);
  });

  it('rolls a stored day over when the calendar has moved on', () => {
    installStorage(memoryStorage());
    const yesterday = spentDay();
    saveJourney(yesterday, true);

    const today = loadJourney(NEXT_DAY) as JourneyState;
    expect(today.dayKey).toBe(NEXT_DAY);
    expect(today.s).toBe(0);
    expect(today.phase).toBe('waking');
    expect(today.coins).toBe(0);
    expect(today.visited).toEqual([]);
    expect(today.journal).toEqual([]);
    expect(today.totalMetres).toBe(yesterday.totalMetres);
    expect(today.totalCoins).toBe(yesterday.totalCoins);
    expect(today.totalEncounters).toBe(yesterday.totalEncounters);
    expect(today.campfires).toBe(yesterday.campfires);
    expect(today.instrumentId).toBe('reed-flute');
  });

  it('rolls over an unfinished day the same way, keeping what it earned', () => {
    installStorage(memoryStorage());
    let j: JourneyState = advance(enterPhase(createJourney(DAY, LENGTH), 'walking'), 640, LENGTH);
    j = earn(j, 31, 4);
    saveJourney(j, true);

    const today = loadJourney(NEXT_DAY) as JourneyState;
    expect(today.totalMetres).toBe(640);
    expect(today.totalCoins).toBe(31);
    expect(today.campfires).toBe(0);
    expect(today.coins).toBe(0);
  });

  it('treats a record with no day at all as belonging to some other day', () => {
    put(JSON.stringify({ v: 1, metres: 400, earned: 90, campfires: 2 }));
    const today = loadJourney(DAY) as JourneyState;
    expect(today.dayKey).toBe(DAY);
    expect(today.totalMetres).toBe(400);
    expect(today.totalCoins).toBe(90);
    expect(today.campfires).toBe(2);
    expect(today.s).toBe(0);
  });

  it('does not write anything while loading', () => {
    installStorage(memoryStorage());
    saveJourney(spentDay(), true);
    const store = globalThis.localStorage as Storage & { map: Map<string, string> };
    const raw = store.map.get(JOURNEY_STORAGE_KEY);
    loadJourney(NEXT_DAY);
    expect(store.map.get(JOURNEY_STORAGE_KEY)).toBe(raw);
  });

  it('caps a record that arrived with more history than the cap allows', () => {
    const lines = Array.from({ length: MAX_JOURNAL_ENTRIES + 40 }, (_, i) => [0, 0.5, 'note', `line ${i}`]);
    put(JSON.stringify({ v: 1, day: DAY, journal: lines, visited: Array.from({ length: 400 }, (_, i) => `s${i}`) }));
    const back = loadJourney(DAY) as JourneyState;
    expect(back.journal).toHaveLength(MAX_JOURNAL_ENTRIES);
    expect(back.journal[back.journal.length - 1].line).toBe(`line ${MAX_JOURNAL_ENTRIES + 39}`);
    expect(back.visited).toHaveLength(256);
    expect(back.visited[back.visited.length - 1]).toBe('s399');
  });

  it('keeps saving after the clock jumps backwards', () => {
    // An NTP correction or a timezone change must not stall the throttle
    // until wall time has caught up again — that could be hours of walking
    // written to nothing.
    const store = memoryStorage();
    installStorage(store);
    const j = spentDay();
    saveJourney(j, true, 9_000_000);
    saveJourney(earn(j, 300), false, 10_000);
    expect((loadJourney(DAY) as JourneyState).coins).toBe(j.coins + 300);
  });

  it('throttles ordinary saves and always honours a forced one', () => {
    const store = memoryStorage();
    installStorage(store);
    const j = spentDay();

    saveJourney(j, true, 10_000);
    saveJourney(earn(j, 500), false, 11_000);
    expect((loadJourney(DAY) as JourneyState).coins).toBe(j.coins);

    saveJourney(earn(j, 500), false, 20_000);
    expect((loadJourney(DAY) as JourneyState).coins).toBe(j.coins + 500);

    saveJourney(earn(j, 900), true, 20_100);
    expect((loadJourney(DAY) as JourneyState).coins).toBe(j.coins + 900);
  });

  it('never mutates the state it was handed to save', () => {
    installStorage(memoryStorage());
    const before = deepFreeze(spentDay());
    expect(() => saveJourney(before, true)).not.toThrow();
    expect(before.journal).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The song being learnt (v0.8)
// ---------------------------------------------------------------------------

describe('chooseSong', () => {
  it('starts wandering, pins a song, and hands the rotation back with null', () => {
    const j = createJourney(DAY, LENGTH);
    expect(j.songChoice).toBeNull();
    const pinned = chooseSong(j, 'twinkle');
    expect(pinned.songChoice).toBe('twinkle');
    expect(chooseSong(pinned, null).songChoice).toBeNull();
  });

  it('reads anything that is not a real id as wander', () => {
    const pinned = chooseSong(walking(), 'twinkle');
    expect(chooseSong(pinned, '').songChoice).toBeNull();
    expect(chooseSong(pinned, 42 as unknown as string).songChoice).toBeNull();
  });

  it('does not mutate its argument', () => {
    const before = deepFreeze(walking());
    expect(() => chooseSong(before, 'twinkle')).not.toThrow();
    expect(before.songChoice).toBeNull();
  });

  it('survives the day rollover: the tune being learnt describes the bard, not the road', () => {
    const yesterday = chooseSong(spentDay(), 'twinkle');
    expect(startNewDay(yesterday, NEXT_DAY).songChoice).toBe('twinkle');
  });

  it('round-trips through the save, pinned or wandering', () => {
    installStorage(memoryStorage());
    const pinned = chooseSong(spentDay(), 'twinkle');
    saveJourney(pinned, true);
    expect(loadJourney(DAY)?.songChoice).toBe('twinkle');
    saveJourney(chooseSong(pinned, null), true);
    expect(loadJourney(DAY)?.songChoice).toBeNull();
  });

  it('reads a pre-v0.8 save, which has no song field, as wandering', () => {
    installStorage(memoryStorage());
    saveJourney(spentDay(), true);
    const store = globalThis.localStorage;
    const raw = JSON.parse(store.getItem(JOURNEY_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    delete raw.song;
    store.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(raw));
    expect(loadJourney(DAY)?.songChoice).toBeNull();
  });
});
