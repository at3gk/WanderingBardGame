import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_LEGS,
  PAGE_MOMENTS_MAX,
  WELCOME_KIND,
  WELCOME_LINE,
  campfirePage,
  festivalLine,
  otherBookmarkPage,
} from './campfirePage';
import { MEMENTO_KIND } from './encounters';
import { IDLE_JOURNAL_KIND } from './idle';
import { createJourney, enterPhase, recordEntry, type JourneyState } from './journey';

const DAY = '2026-07-28';
const LENGTH = 1500;

/** A bard at the fire with `campfires` nights behind them (tonight included). */
function atFire(campfires: number, entries: string[] = []): JourneyState {
  let j: JourneyState = {
    ...createJourney(DAY, LENGTH),
    phase: 'walking',
    s: LENGTH,
    campfires: Math.max(0, campfires - 1),
  };
  for (const line of entries) j = recordEntry(j, { kind: 'busk', line });
  return enterPhase(j, 'resting');
}

/**
 * The same bard, on a day that opened with the case standing open — the
 * boot's own journal line, kind and all, exactly as `collectIdle` writes it.
 * Its prose is deliberately the real thing, numbers included, so the tests
 * below prove the welcome is composed from the *tag* and not from anything
 * countable sitting next to it.
 */
function returnedToFire(campfires: number, entries: string[] = []): JourneyState {
  let j: JourneyState = {
    ...createJourney(DAY, LENGTH),
    phase: 'walking',
    s: LENGTH,
    campfires: Math.max(0, campfires - 1),
  };
  j = recordEntry(j, {
    kind: IDLE_JOURNAL_KIND,
    dayFraction: 0.25,
    line: 'You were away three days; the case has forty coins in it.',
  });
  for (const line of entries) j = recordEntry(j, { kind: 'busk', line });
  return enterPhase(j, 'resting');
}

describe('festivalLine', () => {
  it('names the festival in full at the first fire a bard ever sits at', () => {
    const line = festivalLine(atFire(1));
    expect(line).toContain('Festival of the Long Road');
    expect(line).toContain('news');
    // First fire: one leg walked, the rest still to come, said in words.
    expect(line).toContain('twelve');
  });

  it('keeps the count warm in one line at later fires', () => {
    const line = festivalLine(atFire(5));
    expect(line).toContain('Festival of the Long Road');
    expect(line).not.toContain('news');
    expect(line).toContain('campfires on');
  });

  it('says one campfire on, singular, at the second-to-last fire', () => {
    expect(festivalLine(atFire(FESTIVAL_LEGS - 1))).toContain('one campfire on');
  });

  it('goes anticipatory at the gate without promising a scene', () => {
    const line = festivalLine(atFire(FESTIVAL_LEGS));
    expect(line).toContain('festival');
    // The arrival belongs to the festival scene; this line must read true
    // before that scene exists, so it names no arrival and no tomorrow.
    expect(line).not.toMatch(/tomorrow|arrive|gate opens/i);
  });

  it('measures in distance, never in time — no calendar vocabulary anywhere', () => {
    for (let fires = 1; fires <= FESTIVAL_LEGS + 3; fires++) {
      expect(festivalLine(atFire(fires))).not.toMatch(/\bday\b|\bdays\b|week|left|remaining|hurry|behind/i);
    }
  });
});

describe('campfirePage', () => {
  it('reads the day back, oldest first, capped to the page', () => {
    const lines = Array.from({ length: PAGE_MOMENTS_MAX + 4 }, (_, i) => `moment ${i}`);
    const page = campfirePage(atFire(3, lines));
    expect(page.moments).toHaveLength(PAGE_MOMENTS_MAX);
    expect(page.moments[0].text).toBe('moment 4');
    expect(page.moments[page.moments.length - 1].text).toBe(`moment ${PAGE_MOMENTS_MAX + 3}`);
  });

  it('gives a quiet day a page too', () => {
    const page = campfirePage(atFire(2));
    expect(page.moments).toHaveLength(1);
    expect(page.moments[0].text).toContain('quiet road');
  });

  it('carries each moment’s own sky, so the page can tint it', () => {
    const page = campfirePage(atFire(2, ['a', 'b']));
    for (const moment of page.moments) {
      expect(moment.dayFraction).toBeGreaterThanOrEqual(0);
      expect(moment.dayFraction).toBeLessThanOrEqual(1);
    }
  });

  it('always names the festival', () => {
    expect(campfirePage(atFire(1)).festival).toContain('Festival of the Long Road');
    expect(campfirePage(atFire(FESTIVAL_LEGS)).festival).toContain('festival');
  });

  it('carries the fire’s asking while an attempt is open, and only then', () => {
    const open = campfirePage(atFire(2), 'Twinkle Twinkle Little Star');
    expect(open.invitation).toContain('Twinkle Twinkle Little Star');
    expect(open.invitation).toContain('from memory');

    const played = campfirePage({ ...atFire(2), rehearsed: true }, 'Twinkle Twinkle Little Star');
    expect(played.invitation).toBeUndefined();

    const wandering = campfirePage(atFire(2), null);
    expect(wandering.invitation).toBeUndefined();
  });

  it('heads the page with the road, when the road has been named', () => {
    const named = campfirePage(atFire(2), null, 'Larchwind Road');
    expect(named.title).toContain('Larchwind Road');
    expect(named.title).toContain("tonight's page");

    expect(campfirePage(atFire(2), null, null).title).toBe("Tonight's page");
    expect(campfirePage(atFire(2)).title).toBe("Tonight's page");
  });

  it('always offers the moonlit road — walking on is never gated', () => {
    // DESIGN.md's hybrid pacing: nothing gates an eager Saturday. The door
    // stands whether the rehearsal has been played, whatever leg it is,
    // however far the pilgrimage has come. (The festival eve's page drops
    // it, but that is the caller's edit — the composer always offers.)
    expect(campfirePage(atFire(1)).walkOn).toContain('walk on');
    expect(campfirePage({ ...atFire(2), rehearsed: true }).walkOn).toContain('walk on');
    expect(campfirePage({ ...atFire(4), legIndex: 2 }).walkOn).toContain('moon');
    // "Tap here", because every other row on the page folds it instead.
    expect(campfirePage(atFire(3)).walkOn).toMatch(/tap here/i);
  });

  it('never uses the vocabulary the journal bans — the page is journal, out loud', () => {
    // Same rule encounters.ts pins for its lines: nothing on this page may
    // read as a verdict. Checked across the whole pilgrimage span.
    const banned = /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed)?\b|streak|score/i;
    for (let fires = 1; fires <= FESTIVAL_LEGS + 2; fires++) {
      const page = campfirePage(atFire(fires, ['a fine tune by the bridge']));
      expect(page.title).not.toMatch(banned);
      expect(page.festival).not.toMatch(banned);
      expect(page.walkOn).not.toMatch(banned);
      // Distance, never deadline, on the door too: no calendar words, no urgency.
      expect(page.walkOn).not.toMatch(/\bday\b|\bdays\b|week|left|remaining|hurry|behind|now or/i);
      for (const moment of page.moments) expect(moment.text).not.toMatch(banned);
    }
  });
});

describe('mementos on the page', () => {
  it('carries a lovely meeting through under its own kind, and marks nothing else', () => {
    // The page does not decide what was lovely — the encounter did, hours
    // ago, when it was written down (`leavesMemento`). All this pins is that
    // the word survives the trip to the fire, since the mark is drawn from
    // it and a dropped `kind` would fail silently as a page with no flowers.
    let j = atFire(3);
    j = recordEntry(j, { kind: 'busk', line: 'a square, and a hat that filled' });
    j = recordEntry(j, { kind: MEMENTO_KIND, line: 'nine hares sat in a circle' });
    const kinds = campfirePage(j).moments.map((m) => m.kind);
    expect(kinds).toEqual(['busk', MEMENTO_KIND]);
  });

  it('gives the quiet day no mark at all', () => {
    expect(campfirePage(atFire(2)).moments.map((m) => m.kind)).toEqual(['note']);
  });
});

describe('campfirePage — the welcome back', () => {
  it('opens the page with a welcome when the day began with a coming back', () => {
    const page = campfirePage(returnedToFire(3, ['a fine tune by the bridge']));
    expect(page.moments[0].kind).toBe(WELCOME_KIND);
    expect(page.moments[0].text).toBe(WELCOME_LINE);
  });

  it('says nothing of the sort on an ordinary day', () => {
    const page = campfirePage(atFire(3, ['a fine tune by the bridge']));
    expect(page.moments.some((m) => m.kind === WELCOME_KIND)).toBe(false);
    expect(page.moments.some((m) => m.text === WELCOME_LINE)).toBe(false);
  });

  it('still welcomes after a full day, when the dawn line has scrolled off the page', () => {
    // The regression this guards: the coming-back is written at dawn, so a
    // day with more moments than the page holds drops it from the window.
    // The fact is looked for in the whole journal, or the welcome would
    // only ever appear on days too quiet to have one.
    const lines = Array.from({ length: PAGE_MOMENTS_MAX + 4 }, (_, i) => `moment ${i}`);
    const page = campfirePage(returnedToFire(3, lines));
    expect(page.moments[0].text).toBe(WELCOME_LINE);
    expect(page.moments.some((m) => m.text.startsWith('You were away'))).toBe(false);
  });

  it('takes a moment’s room rather than making the page longer', () => {
    const lines = Array.from({ length: PAGE_MOMENTS_MAX + 4 }, (_, i) => `moment ${i}`);
    expect(campfirePage(returnedToFire(3, lines)).moments).toHaveLength(PAGE_MOMENTS_MAX);
    expect(campfirePage(atFire(3, lines)).moments).toHaveLength(PAGE_MOMENTS_MAX);
  });

  it('carries the sky the return happened under', () => {
    const moment = campfirePage(returnedToFire(3, ['a fine tune'])).moments[0];
    expect(moment.dayFraction).toBeGreaterThanOrEqual(0);
    expect(moment.dayFraction).toBeLessThanOrEqual(1);
  });

  it('keeps no count of days, kept or missed — not a digit, not a calendar word', () => {
    // retention-design.md, recommendation 5 and its rejected-on-principle
    // list: absence becomes story, never debt. The boot line may still say
    // how long the case stood open (it is describing the case); the fire's
    // hello may not, because a welcome that measures is a ledger.
    for (const fires of [1, 3, FESTIVAL_LEGS]) {
      const welcome = campfirePage(returnedToFire(fires, ['a fine tune'])).moments[0].text;
      expect(welcome).not.toMatch(/\d/);
      expect(welcome).not.toMatch(/\bday\b|\bdays\b|\bweek|\bmonth|since|\bago\b|streak/i);
    }
  });

  it('never reads as debt, guilt, or a verdict', () => {
    const banned =
      /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed|ing)?\b|streak|score|you were gone|finally|at last|owe|catch up|behind/i;
    expect(WELCOME_LINE).not.toMatch(banned);
    const page = campfirePage(returnedToFire(4, ['a fine tune']));
    expect(page.title).not.toMatch(banned);
    expect(page.festival).not.toMatch(banned);
  });

  it('is one line, and not the title card’s line said twice', () => {
    expect(WELCOME_LINE.split('\n')).toHaveLength(1);
    // Hud.ts's boot card already says this; the fire is a different voice
    // hours later, so it may share the sentiment and none of the words.
    expect(WELCOME_LINE).not.toContain('kept your place');
  });
});

describe('otherBookmarkPage', () => {
  it('carries only pages: prose moments, no festival, no doors', () => {
    const page = otherBookmarkPage(
      {
        dayKey: '2026-08-07',
        entries: [
          { line: 'A fox sat down to listen.', dayFraction: 0.4, kind: 'encounter' },
          { line: 'Two stayed to the end.', dayFraction: 0.8, kind: 'busk' },
        ],
      },
      'Barleymow Path',
    );
    expect(page.title).toContain('Barleymow Path');
    expect(page.title).toContain("other bookmark's page");
    expect(page.moments.map((m) => m.text)).toEqual([
      'A fox sat down to listen.',
      'Two stayed to the end.',
    ]);
    // The ethics rule enforced by shape: no festival distance (their
    // progress), no invitation, no walk-on door onto their road.
    expect(page.festival).toBe('');
    expect(page.invitation).toBeUndefined();
    expect(page.walkOn).toBeUndefined();
  });

  it('caps at the page window and keeps the newest', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      line: `moment ${i}`,
      dayFraction: 0.5,
      kind: 'busk',
    }));
    const page = otherBookmarkPage({ dayKey: 'd', entries });
    expect(page.moments).toHaveLength(PAGE_MOMENTS_MAX);
    expect(page.moments[page.moments.length - 1].text).toBe('moment 9');
  });

  it('gives an empty day the quiet line, not an empty page', () => {
    const page = otherBookmarkPage({ dayKey: 'd', entries: [] });
    expect(page.moments).toHaveLength(1);
    expect(page.moments[0].text.length).toBeGreaterThan(0);
  });
});
