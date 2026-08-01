import { describe, expect, it } from 'vitest';
import { CLEAN_WALKS, GHOST_WALKS, HEADS_ALPHA, headsLevel, shownLevel } from './mastery';
import { beginSession, createScaffold, encounter, supportFor, type ScaffoldState } from './scaffold';

const STEPS = [0, 2, 4];

/**
 * A scaffold whose given positions have fully earned their letters away
 * (band 0). This takes several sessions on purpose — SESSION_GAIN_CAP
 * means no position can earn its letter fully away inside one sitting,
 * which is itself part of the by-heart pacing: heads cannot begin to
 * fade until at least a few separate days of play have gone into every
 * position of the song.
 */
function earned(steps: number[]): ScaffoldState {
  const s = createScaffold();
  for (let round = 0; round < 4; round++) {
    beginSession(s);
    for (const step of steps) {
      for (let i = 0; i < 12; i++) encounter(s, step, 'hit', true);
    }
  }
  for (const step of steps) expect(supportFor(s, step)).toBe(0);
  return s;
}

describe('headsLevel', () => {
  it('a fresh scaffold holds full heads whatever the diary says', () => {
    expect(headsLevel(createScaffold(), STEPS, 999)).toBe(0);
  });

  it('letters must be fully earned away on EVERY position — one raw position holds the song', () => {
    const s = earned([0, 2]);
    expect(headsLevel(s, [0, 2, 4], CLEAN_WALKS)).toBe(0);
  });

  it('carrying opens the ladder: ghosts, then the clean staff', () => {
    const s = earned(STEPS);
    expect(headsLevel(s, STEPS, GHOST_WALKS - 1)).toBe(0);
    expect(headsLevel(s, STEPS, GHOST_WALKS)).toBe(1);
    expect(headsLevel(s, STEPS, CLEAN_WALKS - 1)).toBe(1);
    expect(headsLevel(s, STEPS, CLEAN_WALKS)).toBe(2);
  });

  it('a song with no playable positions never fades', () => {
    expect(headsLevel(earned(STEPS), [], 999)).toBe(0);
  });

  it('nonsense walk counts read as never-carried', () => {
    const s = earned(STEPS);
    expect(headsLevel(s, STEPS, Number.NaN)).toBe(0);
    expect(headsLevel(s, STEPS, -5)).toBe(0);
  });
});

describe('shownLevel — the stumble arithmetic', () => {
  it('each stumble returns one level of ink, floored at full heads', () => {
    expect(shownLevel(2, 0)).toBe(2);
    expect(shownLevel(2, 1)).toBe(1);
    expect(shownLevel(2, 2)).toBe(0);
    expect(shownLevel(2, 7)).toBe(0);
    expect(shownLevel(1, 1)).toBe(0);
    expect(shownLevel(0, 3)).toBe(0);
  });

  it('the alphas run full, ghost, clean', () => {
    expect(HEADS_ALPHA[0]).toBe(1);
    expect(HEADS_ALPHA[1]).toBeGreaterThan(0);
    expect(HEADS_ALPHA[1]).toBeLessThan(1);
    expect(HEADS_ALPHA[2]).toBe(0);
  });
});
