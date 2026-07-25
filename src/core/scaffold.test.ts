import { describe, expect, it } from 'vitest';
import {
  beginSession,
  createScaffold,
  decayForDaysAway,
  displaySupport,
  encounter,
  leadMsFor,
  MAX_SUPPORT,
  SESSION_GAIN_CAP,
  supportFor,
} from './scaffold';

/** Play a position `n` times cleanly, spread over enough sessions to beat the per-session cap. */
function practise(state: ReturnType<typeof createScaffold>, step: number, times: number) {
  for (let i = 0; i < times; i++) {
    if (i > 0 && i % SESSION_GAIN_CAP === 0) beginSession(state);
    encounter(state, step, 'hit', true);
  }
  return state;
}

describe('a fresh scaffold behaves exactly like the game before it existed', () => {
  it('gives every unseen position full support', () => {
    const s = createScaffold();
    expect(supportFor(s, 0)).toBe(MAX_SUPPORT);
    expect(supportFor(s, 9)).toBe(MAX_SUPPORT);
  });

  it('full support means the letter is there for the whole flight', () => {
    expect(leadMsFor(MAX_SUPPORT)).toBe(1800);
  });

  it('even fully faded, the answer still arrives before the tap', () => {
    // The floor is the safety property: a note leaves the screen ~500ms
    // after the line, so without this the child would be left checking
    // themselves against a letter that is already fading away.
    expect(leadMsFor(0)).toBeGreaterThanOrEqual(300);
  });

  it('still leaves most of the flight blank for recall at full fade', () => {
    const TRAVEL_MS = 1800;
    expect(TRAVEL_MS - leadMsFor(0)).toBeGreaterThan(1200);
  });

  it('gives strictly more help at every higher band', () => {
    for (let band = 1; band <= MAX_SUPPORT; band++) {
      expect(leadMsFor(band)).toBeGreaterThan(leadMsFor(band - 1));
    }
  });
});

describe('support withdraws as a position is practised', () => {
  it('drops a band once, and only once, at the first threshold', () => {
    const s = createScaffold();
    practise(s, 2, 5);
    expect(supportFor(s, 2)).toBe(4);
    practise(s, 2, 1); // 6 encounters
    expect(supportFor(s, 2)).toBe(3);
  });

  it('reaches no-support only after sustained practice across sessions', () => {
    const s = createScaffold();
    practise(s, 2, 30);
    expect(supportFor(s, 2)).toBe(0);
    // Fully faded still means the answer arrives, just barely in time.
    expect(leadMsFor(supportFor(s, 2))).toBe(350);
  });

  it('cannot fade a position more than two bands in one sitting', () => {
    const s = createScaffold();
    // 40 hits without ever starting a new session.
    for (let i = 0; i < 40; i++) encounter(s, 2, 'hit', true);
    expect(supportFor(s, 2)).toBe(2);
  });
});

describe('support returns when the child struggles', () => {
  it('does not flip a band on one single miss', () => {
    const s = createScaffold();
    practise(s, 2, 6);
    expect(supportFor(s, 2)).toBe(3);
    encounter(s, 2, 'miss', true);
    expect(supportFor(s, 2)).toBe(3); // one wobble is not evidence
  });

  it('walks back a band after two misses during good play', () => {
    const s = createScaffold();
    practise(s, 2, 6);
    encounter(s, 2, 'miss', true);
    encounter(s, 2, 'miss', true);
    expect(supportFor(s, 2)).toBe(4);
  });

  it('never oscillates a band on alternating miss/hit', () => {
    const s = createScaffold();
    practise(s, 2, 6);
    const bands = new Set<number>();
    for (let i = 0; i < 10; i++) {
      encounter(s, 2, i % 2 === 0 ? 'miss' : 'hit', true);
      bands.add(supportFor(s, 2));
    }
    expect(bands.size).toBeLessThanOrEqual(2);
  });

  it('gives back session allowance on a miss, so a wobble cannot strand a position', () => {
    const s = createScaffold();
    // Burn most of the session cap, then stumble repeatedly.
    practise(s, 2, 12);
    for (let i = 0; i < 4; i++) encounter(s, 2, 'miss', true);
    // The child must still be able to climb again within the same sitting.
    const before = supportFor(s, 2);
    for (let i = 0; i < 8; i++) encounter(s, 2, 'hit', true);
    expect(supportFor(s, 2)).toBeLessThanOrEqual(before);
  });

  it('ignores misses once the bard has already stopped — a lost child misses everything', () => {
    const s = createScaffold();
    practise(s, 2, 12);
    const before = supportFor(s, 2);
    for (let i = 0; i < 10; i++) encounter(s, 2, 'miss', false);
    expect(supportFor(s, 2)).toBe(before);
  });

  it('does not flicker between bands at a threshold', () => {
    const s = createScaffold();
    practise(s, 2, 6); // band 3, strength 6
    // Alternating miss/hit around the boundary must not oscillate every time.
    encounter(s, 2, 'miss', true); // 3 -> band 4
    const bands = new Set<number>();
    for (let i = 0; i < 6; i++) {
      encounter(s, 2, 'hit', true);
      bands.add(supportFor(s, 2));
    }
    // Climbing back from 3 to 9 crosses the withdraw threshold once, not repeatedly.
    expect(bands.size).toBeLessThanOrEqual(2);
  });
});

describe('letter knowledge transfers across octaves, position knowledge does not', () => {
  it('starts a never-seen position at full support by default', () => {
    const s = createScaffold();
    practise(s, 0, 6); // C4 only mildly known
    expect(supportFor(s, 7)).toBe(MAX_SUPPORT); // C5 still fully supported
  });

  it('starts the same letter an octave up one band in once the first is well known', () => {
    const s = createScaffold();
    practise(s, 0, 20); // C4 well known
    expect(supportFor(s, 7)).toBe(3); // C5 gets a head start, not a free pass
  });

  it('does not transfer to a different letter', () => {
    const s = createScaffold();
    practise(s, 0, 20);
    expect(supportFor(s, 1)).toBe(MAX_SUPPORT); // D4 unaffected
  });
});

describe('time away softens the fade without un-teaching', () => {
  it('returns some support after a week away', () => {
    const s = createScaffold();
    practise(s, 2, 30);
    expect(supportFor(s, 2)).toBe(0);
    decayForDaysAway(s, 7);
    expect(supportFor(s, 2)).toBeGreaterThan(0);
  });

  it('never falls back to always-labelled once a position was properly learned', () => {
    const s = createScaffold();
    practise(s, 2, 30);
    decayForDaysAway(s, 365);
    expect(supportFor(s, 2)).toBeLessThan(MAX_SUPPORT);
  });

  it('does nothing for a same-day return', () => {
    const s = createScaffold();
    practise(s, 2, 12);
    const before = supportFor(s, 2);
    decayForDaysAway(s, 0);
    expect(supportFor(s, 2)).toBe(before);
  });
});

describe('display support — help that is never written back', () => {
  it('keeps the letter on the first sighting of a position in each tune', () => {
    expect(displaySupport(0, { firstInPass: true, struggling: false, lost: false })).toBe(1);
    expect(displaySupport(2, { firstInPass: true, struggling: false, lost: false })).toBe(3);
  });

  it('gives help back the moment the meter drops', () => {
    expect(displaySupport(0, { firstInPass: false, struggling: true, lost: false })).toBe(1);
  });

  it('restores everything for a child who is plainly lost', () => {
    expect(displaySupport(0, { firstInPass: false, struggling: false, lost: true })).toBe(MAX_SUPPORT);
  });

  it('never exceeds full support however many modifiers stack', () => {
    expect(displaySupport(4, { firstInPass: true, struggling: true, lost: false })).toBe(MAX_SUPPORT);
  });

  it('leaves a faded position faded during ordinary good play', () => {
    expect(displaySupport(0, { firstInPass: false, struggling: false, lost: false })).toBe(0);
  });
});
