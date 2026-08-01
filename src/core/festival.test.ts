import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_SET_MAX,
  festivalArrival,
  festivalClosingLine,
  festivalSetList,
  isFestivalEve,
} from './festival';
import { FESTIVAL_LEGS, createJourney, noteFestival } from './journey';

const BANNED = /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed)?\b|streak|score/i;

describe('isFestivalEve', () => {
  it('is the night the pilgrimage covers its distance, once', () => {
    const j = createJourney('2026-07-28', 1500);
    expect(isFestivalEve(j)).toBe(false);
    const arrived = { ...j, campfires: FESTIVAL_LEGS };
    expect(isFestivalEve(arrived)).toBe(true);
    expect(isFestivalEve(noteFestival(arrived))).toBe(false);
  });
});

describe('festivalSetList', () => {
  it('plays the most-carried songs, capped as an occasion', () => {
    const set = festivalSetList({ a: 3, b: 9, c: 5, d: 1 }, null, 'x');
    expect(set).toEqual(['b', 'c', 'a']);
    expect(set.length).toBeLessThanOrEqual(FESTIVAL_SET_MAX);
  });

  it('opens with tonight’s pinned tune when it was carried at all', () => {
    expect(festivalSetList({ a: 9, b: 1 }, 'b', 'x')[0]).toBe('b');
  });

  it('a pinned song never carried does not jump the queue', () => {
    expect(festivalSetList({ a: 9 }, 'b', 'x')).toEqual(['a']);
  });

  it('meets an all-wandering player with the tune they arrived humming', () => {
    expect(festivalSetList({}, null, 'rotation-song')).toEqual(['rotation-song']);
  });
});

describe('the festival’s words', () => {
  it('arrive warm, ask with a tap, and close in any direction', () => {
    const one = festivalArrival(1);
    expect(one.title).toContain('Festival of the Long Road');
    expect(one.invitation).toContain('the song you carried');
    expect(festivalArrival(3).invitation).toContain('the songs you carried');
    expect(festivalClosingLine(1)).toContain('one song');
    expect(festivalClosingLine(3)).toContain('3 songs');
  });

  it('never uses verdict vocabulary', () => {
    for (const text of [
      festivalArrival(1).festival,
      festivalArrival(3).invitation,
      festivalClosingLine(1),
      festivalClosingLine(3),
    ]) {
      expect(text).not.toMatch(BANNED);
    }
  });
});
