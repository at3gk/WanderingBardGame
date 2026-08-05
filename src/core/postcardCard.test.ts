import { describe, expect, it } from 'vitest';

import { postcardLines } from './postcardCard';

/**
 * The ban. Everything a shared card must never be able to say about the
 * player — see the module header: a card carrying any of these is a
 * leaderboard with one row, and the research rejects those on principle.
 * `%` and the score-words are here together because they are the two ways
 * the same claim gets made.
 */
const FORBIDDEN = /\b(accuracy|coins?|score|streak|fail|missed|best|record|%)\b/i;

function allText(card: { title: string; lines: string[] }): string {
  return [card.title, ...card.lines].join(' \n ');
}

describe('postcardLines', () => {
  it('heads the card with the road it was walked on', () => {
    const card = postcardLines('The Hollowbell Way', 'Sparrowlight', 3);
    expect(card.title).toBe('The Hollowbell Way');
  });

  it('names the song being carried', () => {
    const card = postcardLines('The Hollowbell Way', 'Sparrowlight', 3);
    expect(card.lines.some((line) => line.includes('Sparrowlight'))).toBe(true);
  });

  it('gives wandering a line of its own rather than a blank', () => {
    const card = postcardLines('The Hollowbell Way', null, 3);
    expect(card.lines).toHaveLength(2);
    for (const line of card.lines) expect(line.trim().length).toBeGreaterThan(0);
    expect(allText(card).toLowerCase()).toContain('road hummed');
  });

  it('counts campfires in words, never digits', () => {
    for (let n = 0; n <= 15; n++) {
      const text = allText(postcardLines('A Road', 'A Tune', n));
      expect(text).not.toMatch(/\d/);
    }
    expect(allText(postcardLines('A Road', 'A Tune', 7))).toContain('Seven campfires');
  });

  it('reads right on the first evening, before any fire', () => {
    const card = postcardLines('A Road', null, 0);
    expect(allText(card)).toContain('No campfire behind it yet');
    expect(allText(card)).not.toMatch(/\d/);
  });

  it('says one campfire in the singular', () => {
    expect(allText(postcardLines('A Road', 'A Tune', 1))).toContain('One campfire behind it');
  });

  it('falls through to a phrase rather than a numeral for absurd counts', () => {
    for (const n of [16, 40, 999, 1e9]) {
      const text = allText(postcardLines('A Road', 'A Tune', n));
      expect(text).not.toMatch(/\d/);
      expect(text).toContain('More campfires behind it than a page can hold');
    }
  });

  it('survives nonsense counts without printing them', () => {
    for (const n of [-1, -999, Number.NaN, Number.POSITIVE_INFINITY]) {
      const text = allText(postcardLines('A Road', 'A Tune', n));
      expect(text).not.toMatch(/\d/);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('titles an unnamed road rather than leaving the card blank', () => {
    expect(postcardLines('', 'A Tune', 2).title.length).toBeGreaterThan(0);
    expect(postcardLines('   ', 'A Tune', 2).title.length).toBeGreaterThan(0);
  });

  it('treats a blank song title as wandering', () => {
    const blank = postcardLines('A Road', '   ', 2);
    const wandering = postcardLines('A Road', null, 2);
    expect(blank.lines).toEqual(wandering.lines);
  });

  it('never speaks the vocabulary of performance', () => {
    const roads = ['The Hollowbell Way', '', 'Ninefold Lane'];
    const songs: (string | null)[] = ['Sparrowlight', null, 'The Long Way Home'];
    const counts = [0, 1, 2, 7, 15, 16, 400, Number.NaN, -3];

    for (const road of roads) {
      for (const song of songs) {
        for (const count of counts) {
          const card = postcardLines(road, song, count);
          expect(card.title).not.toMatch(FORBIDDEN);
          for (const line of card.lines) expect(line).not.toMatch(FORBIDDEN);
        }
      }
    }
  });
});
