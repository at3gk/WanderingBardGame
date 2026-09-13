import { describe, expect, it } from 'vitest';
import { isPrimaryContact } from './inputGesture';

/**
 * Task 175's residual: "palm-rejection kindness already exists (stray taps
 * are free) — pin it with a test." `pickBeat`'s own tests already pin the
 * timing half (a tap between notes credits nothing); this pins the other
 * half of the same promise — a second finger landing during a tune must
 * never register as a tap at all, primary or not.
 */
describe('isPrimaryContact', () => {
  it('accepts the primary contact', () => {
    expect(isPrimaryContact({ isPrimary: true })).toBe(true);
  });

  it('rejects a second, non-primary contact', () => {
    expect(isPrimaryContact({ isPrimary: false })).toBe(false);
  });

  it('treats a field left unset as primary, not as a second contact', () => {
    expect(isPrimaryContact({})).toBe(true);
  });
});
