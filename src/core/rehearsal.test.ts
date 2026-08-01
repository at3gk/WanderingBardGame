import { describe, expect, it } from 'vitest';
import { rehearsalInvitation, rehearsalLine } from './rehearsal';

const BANNED = /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed)?\b|streak|score|\btry again\b|\bbetter luck\b/i;

describe('rehearsalLine', () => {
  it('sings whole from memory at the top register', () => {
    expect(rehearsalLine('Twinkle Twinkle Little Star', 14, 14)).toContain('whole, from memory');
  });

  it('finds its way home in the middle register', () => {
    expect(rehearsalLine('Twinkle Twinkle Little Star', 7, 14)).toContain('found its way home');
  });

  it('is kindest at the bottom, and says how tunes are learned', () => {
    const line = rehearsalLine('Twinkle Twinkle Little Star', 1, 14);
    expect(line).toContain('came back to walk alongside');
    expect(line).toContain('learned');
  });

  it('always names the song', () => {
    for (const hits of [0, 5, 14]) {
      expect(rehearsalLine('Ode to Joy', hits, 14)).toContain('Ode to Joy');
    }
  });

  it('never uses verdict vocabulary at any skill level', () => {
    for (let hits = 0; hits <= 14; hits++) {
      expect(rehearsalLine('London Bridge', hits, 14)).not.toMatch(BANNED);
    }
    expect(rehearsalInvitation('London Bridge')).not.toMatch(BANNED);
  });

  it('survives nonsense counts without arithmetic accidents', () => {
    expect(() => rehearsalLine('x', Number.NaN, 0)).not.toThrow();
    expect(rehearsalLine('x', 5, 0)).toContain('whole');
  });
});

describe('rehearsalInvitation', () => {
  it('asks in the fire’s voice and names the song', () => {
    const line = rehearsalInvitation('Hot Cross Buns');
    expect(line).toContain('Hot Cross Buns');
    expect(line).toContain('from memory');
    expect(line).toContain('tap');
  });
});
