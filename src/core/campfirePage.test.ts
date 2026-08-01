import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_LEGS,
  PAGE_MOMENTS_MAX,
  campfirePage,
  festivalLine,
} from './campfirePage';
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

  it('never uses the vocabulary the journal bans — the page is journal, out loud', () => {
    // Same rule encounters.ts pins for its lines: nothing on this page may
    // read as a verdict. Checked across the whole pilgrimage span.
    const banned = /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed)?\b|streak|score/i;
    for (let fires = 1; fires <= FESTIVAL_LEGS + 2; fires++) {
      const page = campfirePage(atFire(fires, ['a fine tune by the bridge']));
      expect(page.title).not.toMatch(banned);
      expect(page.festival).not.toMatch(banned);
      for (const moment of page.moments) expect(moment.text).not.toMatch(banned);
    }
  });
});
