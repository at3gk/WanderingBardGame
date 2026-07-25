import { describe, expect, it } from 'vitest';
import { needsLedger, noteNameAt, staffStepAt, stemDown } from './notation';

describe('noteNameAt', () => {
  it('names the naturals of the C4 octave', () => {
    expect(noteNameAt(0)).toBe('C');
    expect(noteNameAt(2)).toBe('D');
    expect(noteNameAt(4)).toBe('E');
    expect(noteNameAt(5)).toBe('F');
    expect(noteNameAt(7)).toBe('G');
    expect(noteNameAt(9)).toBe('A');
    expect(noteNameAt(11)).toBe('B');
  });

  it('is octave-agnostic in both directions', () => {
    expect(noteNameAt(12)).toBe('C');
    expect(noteNameAt(14)).toBe('D');
    expect(noteNameAt(-3)).toBe('A');
    expect(noteNameAt(-12)).toBe('C');
  });

  it('returns null for accidentals instead of guessing a spelling', () => {
    expect(noteNameAt(1)).toBeNull();
    expect(noteNameAt(6)).toBeNull();
    expect(noteNameAt(-2)).toBeNull();
  });
});

describe('staffStepAt', () => {
  it('walks the diatonic steps of the C4 octave', () => {
    expect(staffStepAt(0)).toBe(0); // C4 — middle C
    expect(staffStepAt(2)).toBe(1);
    expect(staffStepAt(4)).toBe(2); // E4 — bottom staff line
    expect(staffStepAt(5)).toBe(3);
    expect(staffStepAt(7)).toBe(4);
    expect(staffStepAt(9)).toBe(5);
    expect(staffStepAt(11)).toBe(6); // B4 — middle line
  });

  it('continues across octaves', () => {
    expect(staffStepAt(12)).toBe(7); // C5
    expect(staffStepAt(16)).toBe(9); // E5
    expect(staffStepAt(17)).toBe(10); // F5 — top staff line
    expect(staffStepAt(-3)).toBe(-2); // A3
  });

  it('returns null for accidentals', () => {
    expect(staffStepAt(1)).toBeNull();
    expect(staffStepAt(6)).toBeNull();
  });
});

describe('stemDown', () => {
  it('points stems up below the middle line and down from it upward', () => {
    expect(stemDown(0)).toBe(false); // middle C
    expect(stemDown(5)).toBe(false); // A4
    expect(stemDown(6)).toBe(true); // B4 — the middle line itself
    expect(stemDown(9)).toBe(true); // E5
  });
});

describe('needsLedger', () => {
  it('gives middle C (and below) its ledger line', () => {
    expect(needsLedger(0)).toBe(true);
    expect(needsLedger(-2)).toBe(true);
  });

  it('needs no ledger inside or immediately around the staff', () => {
    expect(needsLedger(1)).toBe(false); // D4, space under the bottom line
    expect(needsLedger(2)).toBe(false); // E4, bottom line
    expect(needsLedger(10)).toBe(false); // F5, top line
    expect(needsLedger(11)).toBe(false); // G5, space above the top line
  });

  it('starts ledgers again above the staff at A5', () => {
    expect(needsLedger(12)).toBe(true);
  });
});
