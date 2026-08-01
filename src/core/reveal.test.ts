import { describe, expect, it } from 'vitest';
import { revealLeads } from './reveal';
import {
  createScaffold,
  encounter,
  leadMsFor,
  MAX_SUPPORT,
  SUPPORT_LEAD_MS,
  supportFor,
} from './scaffold';

const CALM = { struggling: false, lost: false };

/** A scaffold that has genuinely learned one position. */
function learned(step: number, hits: number) {
  const s = createScaffold();
  for (let i = 0; i < hits; i++) encounter(s, step, 'hit', true);
  return s;
}

describe('revealLeads', () => {
  it('a brand-new scaffold labels every note for its whole flight — the old behaviour, by arithmetic', () => {
    const leads = revealLeads(createScaffold(), [0, 2, 4, 2, 0], 5, CALM);
    for (const lead of leads) expect(lead).toBe(leadMsFor(MAX_SUPPORT));
  });

  it('an earned position reveals later, but its first sighting each pass keeps a band more help', () => {
    const s = learned(2, 12); // enough to leave full support
    expect(supportFor(s, 2)).toBeLessThan(MAX_SUPPORT);
    const leads = revealLeads(s, [2, 2, 2], 3, CALM);
    expect(leads[1]).toBe(leads[2]);
    expect(leads[0]).toBeGreaterThan(leads[1]); // the teacher points at the first one
  });

  it('pass boundaries reset the first-sighting help — exact repeats are re-pointed-at', () => {
    const s = learned(2, 12);
    const leads = revealLeads(s, [2, 2, 2, 2], 2, CALM);
    expect(leads[0]).toBe(leads[2]);
    expect(leads[1]).toBe(leads[3]);
    expect(leads[0]).toBeGreaterThan(leads[1]);
  });

  it('lost restores full help regardless of strength', () => {
    const s = learned(2, 40);
    const leads = revealLeads(s, [2, 2], 2, { struggling: false, lost: true });
    for (const lead of leads) expect(lead).toBe(leadMsFor(MAX_SUPPORT));
  });

  it('struggling buys one band of help', () => {
    const s = learned(2, 12);
    const calm = revealLeads(s, [2, 2], 2, CALM)[1];
    const strained = revealLeads(s, [2, 2], 2, { struggling: true, lost: false })[1];
    expect(strained).toBeGreaterThan(calm);
  });

  it('rests carry the full lead so nothing downstream special-cases them', () => {
    const leads = revealLeads(learned(2, 40), [null, 2], 2, CALM);
    expect(leads[0]).toBe(leadMsFor(MAX_SUPPORT));
  });

  it('every lead is one of the model’s own bands', () => {
    const s = learned(2, 25);
    for (const lead of revealLeads(s, [2, 4, null, 2, 6], 5, CALM)) {
      expect(SUPPORT_LEAD_MS).toContain(lead);
    }
  });

  it('never writes back: computing leads does not change the scaffold', () => {
    const s = learned(2, 12);
    const before = JSON.stringify(s);
    revealLeads(s, [2, 4, 6, 2], 4, CALM);
    // `supportFor` creates untouched positions at full support on read; the
    // learned position itself must be unmoved.
    expect(JSON.parse(JSON.stringify(s)).positions[2]).toEqual(JSON.parse(before).positions[2]);
  });
});
