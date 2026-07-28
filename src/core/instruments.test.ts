import { describe, expect, it } from 'vitest';
import { mulberry32, subSeed } from './rng';
import {
  INSTRUMENTS,
  Instrument,
  InstrumentVoice,
  NOMINAL_DAY,
  UnlockProgress,
  describeUnlock,
  emptyProgress,
  instrumentById,
  isInstrumentId,
  isUnlocked,
  newlyUnlocked,
  nextLockedInstrument,
  unlockDayEstimate,
  unlockRatio,
  unlockThreshold,
  unlockedInstruments,
} from './instruments';

const byId = (id: string): Instrument => instrumentById(id);
const ids = (list: Instrument[]): string[] => list.map((i) => i.id);

/** Total partial energy, and the share of it that is not the ratio-1 partial. */
function offFundamental(voice: InstrumentVoice): number {
  const total = voice.partials.reduce((sum, [, amp]) => sum + amp, 0);
  const fundamental = voice.partials.find(([ratio]) => ratio === 1)?.[1] ?? 0;
  return (total - fundamental) / total;
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

/** Rec. 709 relative luminance, 0..255. Used only to compare two colours. */
function luminance(color: number): number {
  const [r, g, b] = channels(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function value(color: number): number {
  return Math.max(...channels(color)) / 255;
}

function saturation(color: number): number {
  const [r, g, b] = channels(color);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function hue(color: number): number {
  const [r, g, b] = channels(color);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

function hueGap(a: number, b: number): number {
  const raw = Math.abs(hue(a) - hue(b));
  return Math.min(raw, 360 - raw);
}

describe('the catalogue', () => {
  it('ships exactly six instruments with unique, url-safe ids', () => {
    expect(INSTRUMENTS).toHaveLength(6);
    expect(new Set(ids(INSTRUMENTS)).size).toBe(6);
    for (const instrument of INSTRUMENTS) {
      expect(instrument.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(instrument.name.length).toBeGreaterThan(2);
      expect(instrument.character.length).toBeGreaterThan(10);
      expect(instrument.character.length).toBeLessThan(90);
    }
  });

  it('gives exactly one instrument away for free, and it is the lute', () => {
    const free = INSTRUMENTS.filter((i) => i.unlock.type === 'start');
    expect(ids(free)).toEqual(['lute']);
    expect(INSTRUMENTS[0].id).toBe('lute');
  });

  it('uses every note motion at least once', () => {
    const motions = new Set(INSTRUMENTS.map((i) => i.noteMotion));
    expect(motions).toEqual(new Set(['drift', 'spiral', 'pulse', 'cascade']));
  });

  it('treats the lute as the tempo reference and bends only modestly around it', () => {
    expect(byId('lute').tempoFeel).toBe(1);
    for (const instrument of INSTRUMENTS) {
      expect(instrument.tempoFeel).toBeGreaterThanOrEqual(0.75);
      expect(instrument.tempoFeel).toBeLessThanOrEqual(1.25);
    }
    // The long ringers ask for room, the drum asks to be pushed.
    expect(byId('bells').tempoFeel).toBeLessThan(byId('harp').tempoFeel);
    expect(byId('hand-drum').tempoFeel).toBeGreaterThan(1);
  });

  it('is frozen, so a scene cannot nudge a voice for one note and keep it', () => {
    expect(() => {
      byId('lute').voice.cutoffHz = 100;
    }).toThrow();
    expect(() => {
      INSTRUMENTS.push(byId('lute'));
    }).toThrow();
    expect(byId('lute').voice.cutoffHz).toBe(5200);
  });
});

describe('voice parameters', () => {
  it('keeps every scalar inside a range a synthesiser can use', () => {
    for (const { id, voice } of INSTRUMENTS) {
      expect(voice.attackMs, id).toBeGreaterThanOrEqual(0);
      expect(voice.attackMs, id).toBeLessThanOrEqual(400);
      expect(voice.decayMs, id).toBeGreaterThan(50);
      expect(voice.decayMs, id).toBeLessThanOrEqual(4000);
      expect(voice.sustain, id).toBeGreaterThanOrEqual(0);
      expect(voice.sustain, id).toBeLessThanOrEqual(1);
      expect(voice.releaseMs, id).toBeGreaterThan(40);
      expect(voice.releaseMs, id).toBeLessThanOrEqual(4000);
      expect(voice.detuneCents, id).toBeGreaterThanOrEqual(0);
      expect(voice.detuneCents, id).toBeLessThanOrEqual(30);
      expect(voice.cutoffHz, id).toBeGreaterThanOrEqual(400);
      expect(voice.cutoffHz, id).toBeLessThanOrEqual(16000);
      expect(voice.transient, id).toBeGreaterThanOrEqual(0);
      expect(voice.transient, id).toBeLessThanOrEqual(1);
    }
  });

  it('has partials that are ascending, positive, and normalised to one peak', () => {
    for (const { id, voice } of INSTRUMENTS) {
      expect(voice.partials.length, id).toBeGreaterThanOrEqual(4);
      let previousRatio = 0;
      let total = 0;
      let peaks = 0;
      for (const [ratio, amp] of voice.partials) {
        expect(ratio, id).toBeGreaterThan(previousRatio);
        expect(ratio, id).toBeLessThanOrEqual(16);
        expect(amp, id).toBeGreaterThan(0);
        expect(amp, id).toBeLessThanOrEqual(1);
        if (amp === 1) peaks++;
        previousRatio = ratio;
        total += amp;
      }
      // Exactly one partial at unity: an implementation scales the whole
      // stack by a single gain, so two peaks or none makes voices land at
      // different loudnesses for no musical reason.
      expect(peaks, id).toBe(1);
      // Loud enough to be worth summing, quiet enough not to clip when it is.
      expect(total, id).toBeGreaterThan(1.1);
      expect(total, id).toBeLessThan(4);
    }
  });

  it('gives vibrato a rate exactly when it has depth', () => {
    for (const { id, voice } of INSTRUMENTS) {
      const [rate, depth] = voice.vibrato;
      expect(depth > 0, id).toBe(rate > 0);
      expect(rate, id).toBeLessThanOrEqual(12);
      expect(depth, id).toBeLessThanOrEqual(60);
    }
  });

  it('sustains only the two voices that are physically driven', () => {
    const sustaining = INSTRUMENTS.filter((i) => i.voice.sustain > 0);
    expect(ids(sustaining).sort()).toEqual(['hurdy-gurdy', 'reed-flute']);
    for (const instrument of INSTRUMENTS) {
      if (instrument.voice.sustain === 0) continue;
      expect(instrument.voice.sustain).toBeGreaterThan(0.5);
    }
  });
});

describe('the voices sound like what they claim to be', () => {
  it('makes the flute nearly a sine, slow to speak, and breathy', () => {
    const flute = byId('reed-flute').voice;
    for (const other of INSTRUMENTS) {
      if (other.id === 'reed-flute') continue;
      expect(offFundamental(flute)).toBeLessThan(offFundamental(other.voice));
      expect(flute.attackMs).toBeGreaterThan(other.voice.attackMs);
    }
    expect(offFundamental(flute)).toBeLessThan(0.25);
    expect(flute.transient).toBeGreaterThan(0.3);
    expect(flute.vibrato[1]).toBeGreaterThan(0);
  });

  it('makes the lute a bright, short pluck with odd partials on top', () => {
    const lute = byId('lute').voice;
    expect(lute.sustain).toBe(0);
    expect(lute.attackMs).toBeLessThan(10);
    expect(lute.decayMs).toBeLessThan(1000);
    const ratios = lute.partials.map(([r]) => r);
    expect(ratios).toContain(5);
    expect(ratios).toContain(7);
    expect(ratios).toContain(9);
    // The two plucked string voices are the hardest pair to tell apart, so
    // they differ on spectrum, ring length and pick noise all at once.
    const harp = byId('harp').voice;
    expect(lute.transient).toBeGreaterThan(harp.transient * 2);
    expect(harp.decayMs).toBeGreaterThan(lute.decayMs * 1.5);
    expect(offFundamental(lute)).toBeGreaterThan(offFundamental(harp));
  });

  it('makes the harp the softest attack noise and a smooth rolloff', () => {
    const harp = byId('harp').voice;
    for (const other of INSTRUMENTS) {
      if (other.id === 'harp') continue;
      expect(harp.transient).toBeLessThan(other.voice.transient);
    }
    let previous = Infinity;
    for (const [, amp] of harp.partials) {
      expect(amp).toBeLessThan(previous);
      previous = amp;
    }
  });

  it('makes the drum dark, inharmonic and over almost at once', () => {
    const drum = byId('hand-drum').voice;
    // Decay plus release is the whole note only for voices that do not
    // sustain; for the flute and the gurdy the note lasts as long as you
    // keep blowing or cranking, so they are not comparable here.
    const length = (v: InstrumentVoice): number => v.decayMs + v.releaseMs;
    expect(drum.sustain).toBe(0);
    for (const other of INSTRUMENTS) {
      if (other.id === 'hand-drum') continue;
      expect(drum.transient).toBeGreaterThan(other.voice.transient);
      expect(drum.cutoffHz).toBeLessThan(other.voice.cutoffHz);
      if (other.voice.sustain === 0) expect(length(drum)).toBeLessThan(length(other.voice));
    }
    // Membrane modes: nothing above the fundamental is a whole multiple of
    // it, which is the whole reason a drum has no pitch.
    for (const [ratio] of drum.partials.slice(1)) {
      expect(Number.isInteger(ratio)).toBe(false);
    }
  });

  it('makes the bells inharmonic, top-heavy and impossible to damp', () => {
    const bells = byId('bells').voice;
    const ratios = bells.partials.map(([r]) => r);
    // A hum below the strike note, and the minor third that makes a bell sad.
    expect(ratios.some((r) => r < 1)).toBe(true);
    expect(ratios.some((r) => r > 1.1 && r < 1.3)).toBe(true);
    expect(ratios.some((r) => r > 4)).toBe(true);
    // The nominal, at the octave, is the loudest partial in a real bell.
    expect(bells.partials.find(([, amp]) => amp === 1)?.[0]).toBe(2);
    for (const other of INSTRUMENTS) {
      if (other.id === 'bells') continue;
      expect(bells.cutoffHz).toBeGreaterThan(other.voice.cutoffHz);
      expect(bells.releaseMs).toBeGreaterThan(other.voice.releaseMs);
      expect(bells.decayMs).toBeGreaterThan(other.voice.decayMs);
    }
  });

  it('makes the hurdy-gurdy the richest and the most out of tune with itself', () => {
    const gurdy = byId('hurdy-gurdy').voice;
    for (const other of INSTRUMENTS) {
      if (other.id === 'hurdy-gurdy') continue;
      expect(gurdy.detuneCents).toBeGreaterThan(other.voice.detuneCents);
      expect(gurdy.partials.length).toBeGreaterThan(other.voice.partials.length);
      // Off-fundamental energy only means "rich" for a voice built on a
      // fundamental. The bells are not: their loudest partial is the
      // nominal an octave up, so the measure would call them richer still.
      if (other.id !== 'bells') {
        expect(offFundamental(gurdy)).toBeGreaterThan(offFundamental(other.voice));
      }
    }
    // Roughly 1/n, the way a bowed string is: each partial within a
    // reasonable factor of the sawtooth it approximates.
    for (const [ratio, amp] of gurdy.partials) {
      expect(amp).toBeGreaterThan(1 / ratio / 2.2);
      expect(amp).toBeLessThanOrEqual(1 / ratio + 0.15);
    }
    // Wheel wobble is faster and shallower than a player's breath.
    const flute = byId('reed-flute').voice;
    expect(gurdy.vibrato[0]).toBeGreaterThan(flute.vibrato[0]);
    expect(gurdy.vibrato[1]).toBeLessThan(flute.vibrato[1]);
  });

  it('gives no two instruments the same voice', () => {
    const fingerprints = INSTRUMENTS.map((i) => JSON.stringify(i.voice));
    expect(new Set(fingerprints).size).toBe(INSTRUMENTS.length);
  });
});

describe('the palette', () => {
  it('uses distinct 24-bit colours', () => {
    const all = INSTRUMENTS.flatMap((i) => [i.color, i.accent]);
    expect(new Set(all).size).toBe(all.length);
    for (const color of all) {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('holds every base colour to one band of lightness and saturation', () => {
    for (const { id, color } of INSTRUMENTS) {
      expect(value(color), id).toBeGreaterThanOrEqual(0.5);
      expect(value(color), id).toBeLessThanOrEqual(0.82);
      expect(saturation(color), id).toBeGreaterThanOrEqual(0.3);
      expect(saturation(color), id).toBeLessThanOrEqual(0.66);
    }
  });

  it('makes every accent a lighter, calmer version of its own hue', () => {
    for (const { id, color, accent } of INSTRUMENTS) {
      expect(luminance(accent), id).toBeGreaterThan(luminance(color));
      expect(value(accent), id).toBeGreaterThanOrEqual(0.82);
      expect(value(accent), id).toBeLessThanOrEqual(0.96);
      expect(saturation(accent), id).toBeLessThan(saturation(color));
      expect(saturation(accent), id).toBeGreaterThanOrEqual(0.2);
      // Same family, not a second colour.
      expect(hueGap(color, accent), id).toBeLessThan(30);
    }
  });

  it('keeps the six base hues apart enough to read at a glance', () => {
    for (let i = 0; i < INSTRUMENTS.length; i++) {
      for (let j = i + 1; j < INSTRUMENTS.length; j++) {
        expect(hueGap(INSTRUMENTS[i].color, INSTRUMENTS[j].color)).toBeGreaterThan(12);
      }
    }
  });

  it('leaves cream to the notation', () => {
    // 0xe8d9c0 is the staff, the note heads and the clef, and DESIGN.md's
    // standing rule is that nothing else may borrow it. Hue alone will not
    // enforce that — the lute's accent sits about a degree off cream's hue
    // and is a legitimate warm highlight — so the separation that matters is
    // saturation: cream is a pale parchment at s≈0.17, and anything sharing
    // its hue has to be an actual colour rather than a near-white. Either be
    // clearly a different hue, or be clearly more saturated than cream.
    const CREAM = 0xe8d9c0;
    const creamSaturation = saturation(CREAM);
    expect(creamSaturation).toBeLessThan(0.2);
    for (const { id, color, accent } of INSTRUMENTS) {
      for (const [what, c] of [
        ['color', color],
        ['accent', accent],
      ] as const) {
        const label = `${id} ${what}`;
        expect(c, label).not.toBe(CREAM);
        const differentHue = hueGap(c, CREAM) > 25;
        const moreColour = saturation(c) >= creamSaturation * 2;
        expect(differentHue || moreColour, label).toBe(true);
      }
    }
  });
});

describe('instrumentById', () => {
  it('finds every shipped instrument', () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrumentById(instrument.id)).toBe(instrument);
    }
  });

  it('throws on an unknown id rather than falling back to the lute', () => {
    expect(() => instrumentById('kazoo')).toThrow(/kazoo/);
    expect(() => instrumentById('')).toThrow();
  });

  it('lets a caller check an untrusted id first', () => {
    expect(isInstrumentId('lute')).toBe(true);
    expect(isInstrumentId('kazoo')).toBe(false);
  });
});

describe('unlock rules', () => {
  const progress = (p: Partial<UnlockProgress>): UnlockProgress => ({ ...emptyProgress(), ...p });

  it('starts a new player with the lute and nothing else', () => {
    expect(ids(unlockedInstruments(emptyProgress()))).toEqual(['lute']);
  });

  it('gives everything to a player who has done everything', () => {
    const rich = progress({ totalMetres: 1e6, totalCoins: 1e6, totalEncounters: 1e4, campfires: 1e3 });
    expect(ids(unlockedInstruments(rich))).toEqual(ids(INSTRUMENTS));
  });

  it('counts a threshold met exactly as met', () => {
    for (const instrument of INSTRUMENTS) {
      const need = unlockThreshold(instrument.unlock);
      const exact = progress({
        totalMetres: need,
        totalCoins: need,
        totalEncounters: need,
        campfires: need,
      });
      expect(isUnlocked(instrument.unlock, exact), instrument.id).toBe(true);
      if (need > 0) {
        const short = progress({
          totalMetres: need - 1,
          totalCoins: need - 1,
          totalEncounters: need - 1,
          campfires: need - 1,
        });
        expect(isUnlocked(instrument.unlock, short), instrument.id).toBe(false);
      }
    }
  });

  it('unlocks each instrument only on its own metric', () => {
    const flute = byId('reed-flute').unlock;
    expect(isUnlocked(flute, progress({ totalCoins: 99999, campfires: 99 }))).toBe(false);
    expect(isUnlocked(flute, progress({ totalMetres: 900 }))).toBe(true);
  });

  it('treats missing, negative and non-finite progress as no progress', () => {
    const broken = progress({
      totalMetres: Number.NaN,
      totalCoins: -500,
      totalEncounters: Number.POSITIVE_INFINITY,
      campfires: -1,
    });
    // Infinity is not a real count either; it must not hand out an unlock.
    expect(ids(unlockedInstruments(broken))).toEqual(['lute']);
  });

  it('never un-unlocks anything as progress grows', () => {
    // A deterministic sweep of monotonically rising progress. Uses the
    // project PRNG so a failure here is reproducible rather than flaky.
    const rand = mulberry32(subSeed(0xbadc0de, 'instruments/monotonicity'));
    const walked: UnlockProgress = emptyProgress();
    let seen: string[] = [];
    for (let step = 0; step < 400; step++) {
      walked.totalMetres += rand() * 40;
      walked.totalCoins += rand() * 9;
      walked.totalEncounters += rand() < 0.05 ? 1 : 0;
      walked.campfires += rand() < 0.01 ? 1 : 0;
      const now = ids(unlockedInstruments({ ...walked }));
      for (const id of seen) expect(now).toContain(id);
      seen = now;
    }
    // The sweep is long enough to be a real test of the schedule: this
    // particular walk reaches every unlock, so every rule was exercised.
    expect(seen).toEqual(ids(INSTRUMENTS));
  });

  it('reports progress toward a rule as a clamped fraction', () => {
    expect(unlockRatio(byId('lute').unlock, emptyProgress())).toBe(1);
    expect(unlockRatio(byId('reed-flute').unlock, emptyProgress())).toBe(0);
    expect(unlockRatio(byId('reed-flute').unlock, progress({ totalMetres: 450 }))).toBeCloseTo(0.5, 10);
    expect(unlockRatio(byId('reed-flute').unlock, progress({ totalMetres: 90000 }))).toBe(1);
    expect(unlockRatio(byId('bells').unlock, progress({ totalMetres: Number.NaN }))).toBe(0);
  });

  it('describes every rule in words a card can show', () => {
    for (const instrument of INSTRUMENTS) {
      const text = describeUnlock(instrument.unlock);
      expect(text.length).toBeGreaterThan(5);
      expect(text).toBe(text.toLowerCase());
    }
    expect(describeUnlock({ type: 'distance', metres: 900 })).toBe('900 m walked');
    expect(describeUnlock({ type: 'campfires', count: 1 })).toBe('1 night camped');
    expect(describeUnlock({ type: 'campfires', count: 3 })).toBe('3 nights camped');
    expect(describeUnlock({ type: 'encounters', count: 1 })).toBe('1 meeting on the road');
    expect(describeUnlock({ type: 'encounters', count: 6 })).toBe('6 meetings on the road');
    // The shipped coins rule is 700, so the singular arm is only ever reached
    // by a retuned threshold — which is exactly when nobody would be looking
    // at this string, and exactly when "1 coins earned" would ship.
    expect(describeUnlock({ type: 'coins', coins: 1 })).toBe('1 coin earned');
    expect(describeUnlock({ type: 'coins', coins: 700 })).toBe('700 coins earned');
    // "m" is a symbol, not a word, so it stays singular at any count.
    expect(describeUnlock({ type: 'distance', metres: 1 })).toBe('1 m walked');
  });

  it('never grades the player or shouts at them', () => {
    // DESIGN.md's no-grading stance covers unlock copy too: these strings say
    // what a thing costs and what an instrument feels like, never how well
    // the player is doing. Cheap to check, and the sort of thing that drifts
    // in one careless line at a time.
    const prose = [
      ...INSTRUMENTS.map((i) => i.character),
      ...INSTRUMENTS.map((i) => i.name),
      ...INSTRUMENTS.map((i) => describeUnlock(i.unlock)),
    ];
    for (const line of prose) {
      expect(line, line).not.toMatch(/!/);
      expect(line, line).not.toMatch(/\b(perfect|amazing|awesome|great job|epic|master|legendary|score|rank|grade)\b/i);
      expect(line.trim(), line).toBe(line);
    }
  });

  it('points at the nearest locked instrument, by fraction not by list order', () => {
    expect(nextLockedInstrument(emptyProgress())?.id).toBe('reed-flute');
    expect(nextLockedInstrument(progress({ totalMetres: 800 }))?.id).toBe('reed-flute');
    // Both cases above are also what "the first entry still locked" would
    // return, so on their own they prove nothing. These two separate the
    // implementations: two campfires is two thirds of the way to the
    // hurdy-gurdy while three earlier instruments have not moved at all, and
    // 350 coins is halfway to the harp with the drum still on zero.
    expect(nextLockedInstrument(progress({ campfires: 2 }))?.id).toBe('hurdy-gurdy');
    expect(nextLockedInstrument(progress({ totalMetres: 900, totalCoins: 350 }))?.id).toBe('harp');
    // It must never point at something the player already holds.
    for (const p of [emptyProgress(), progress({ campfires: 2 }), progress({ totalMetres: 5000, totalCoins: 400 })]) {
      const next = nextLockedInstrument(p);
      if (next) expect(isUnlocked(next.unlock, p)).toBe(false);
    }
    const everything = progress({ totalMetres: 1e6, totalCoins: 1e6, totalEncounters: 1e4, campfires: 1e3 });
    expect(nextLockedInstrument(everything)).toBeNull();
  });

  it('reads progress without writing to it', () => {
    // Every one of these takes a record the caller owns — in practice the
    // live save — and a stray `+=` inside a predicate would corrupt it in a
    // way no other test here would notice, because they all build fresh
    // records. Frozen input turns that into a throw at the site.
    const p: UnlockProgress = Object.freeze(progress({ totalMetres: 1200, totalCoins: 400, campfires: 2 }));
    expect(() => {
      unlockedInstruments(p);
      nextLockedInstrument(p);
      newlyUnlocked(p, p);
      for (const i of INSTRUMENTS) {
        isUnlocked(i.unlock, p);
        unlockRatio(i.unlock, p);
      }
    }).not.toThrow();
    expect(p).toEqual({ totalMetres: 1200, totalCoins: 400, totalEncounters: 0, campfires: 2 });
  });
});

describe('newlyUnlocked', () => {
  const at = (p: Partial<UnlockProgress>): UnlockProgress => ({ ...emptyProgress(), ...p });

  it('returns nothing when nothing changed', () => {
    const now = at({ totalMetres: 2000, totalCoins: 100 });
    expect(newlyUnlocked(now, now)).toEqual([]);
  });

  it('returns exactly the difference', () => {
    const before = at({ totalMetres: 800 });
    const after = at({ totalMetres: 6200 });
    expect(ids(newlyUnlocked(before, after))).toEqual(['reed-flute', 'bells']);
  });

  it('never announces a loss when progress appears to go backwards', () => {
    const high = at({ totalMetres: 9000, totalCoins: 9000, totalEncounters: 90, campfires: 9 });
    expect(newlyUnlocked(high, emptyProgress())).toEqual([]);
  });

  it('splits across two steps the same way it lands in one', () => {
    const a = emptyProgress();
    const b = at({ totalMetres: 1000, totalEncounters: 6 });
    const c = at({ totalMetres: 7000, totalEncounters: 6, totalCoins: 800, campfires: 4 });
    const twoSteps = [...ids(newlyUnlocked(a, b)), ...ids(newlyUnlocked(b, c))];
    expect(twoSteps.sort()).toEqual(ids(newlyUnlocked(a, c)).sort());
  });

  it('returns instruments in catalogue order, not discovery order', () => {
    const after = at({ totalMetres: 9000, totalCoins: 9000, totalEncounters: 90, campfires: 9 });
    expect(ids(newlyUnlocked(emptyProgress(), after))).toEqual(ids(INSTRUMENTS).slice(1));
  });
});

describe('pacing', () => {
  it('measures a nominal day against the road the generator actually builds', () => {
    // ROAD_MIN_LENGTH_M..ROAD_MAX_LENGTH_M in road.ts is 1200..1800, and a
    // day ends at one campfire. If those change, this estimate is stale.
    expect(NOMINAL_DAY.totalMetres).toBeGreaterThanOrEqual(1200);
    expect(NOMINAL_DAY.totalMetres).toBeLessThanOrEqual(1800);
    expect(NOMINAL_DAY.campfires).toBe(1);
  });

  it('converts each rule into days by dividing by a nominal day, and nothing else', () => {
    // The ordering test below only checks that the estimates increase, which
    // a badly scaled estimator would also satisfy. These pin the arithmetic
    // to numbers worked out from NOMINAL_DAY by hand: 900 m at 1500 m a day,
    // 6 meetings at 4 a day, 3 nights at 1 a night.
    expect(unlockDayEstimate({ type: 'start' })).toBe(0);
    expect(unlockDayEstimate({ type: 'distance', metres: 900 })).toBeCloseTo(0.6, 10);
    expect(unlockDayEstimate({ type: 'encounters', count: 6 })).toBeCloseTo(1.5, 10);
    expect(unlockDayEstimate({ type: 'coins', coins: 700 })).toBeCloseTo(7 / 3, 10);
    expect(unlockDayEstimate({ type: 'campfires', count: 3 })).toBe(3);
    expect(unlockDayEstimate({ type: 'distance', metres: 6000 })).toBeCloseTo(4, 10);
    // A threshold of nothing costs nothing, and is not confused with `start`.
    expect(unlockDayEstimate({ type: 'coins', coins: 0 })).toBe(0);
  });

  it('keeps the nominal day out of reach of the code that measures against it', () => {
    // unlockDayEstimate divides by this object. If a caller ever treated it
    // as a starting progress record and added to it, every estimate would
    // move underneath the pacing tests without a single one failing.
    expect(Object.isFrozen(NOMINAL_DAY)).toBe(true);
    expect(() => {
      NOMINAL_DAY.totalCoins = 9000;
    }).toThrow();
    expect(NOMINAL_DAY.totalCoins).toBe(300);
  });

  it('orders the unlocks strictly, so the catalogue order is the play order', () => {
    const days = INSTRUMENTS.map((i) => unlockDayEstimate(i.unlock));
    expect(days[0]).toBe(0);
    for (let i = 1; i < days.length; i++) {
      expect(Number.isFinite(days[i])).toBe(true);
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it('lands the first unlock inside a single day and the last inside a handful', () => {
    const days = INSTRUMENTS.map((i) => unlockDayEstimate(i.unlock));
    expect(days[1]).toBeGreaterThan(0.25);
    expect(days[1]).toBeLessThan(1);
    expect(days[days.length - 1]).toBeLessThanOrEqual(5);
  });

  it('unlocks something on the first day of a nominal walk', () => {
    expect(ids(unlockedInstruments(NOMINAL_DAY))).toEqual(['lute', 'reed-flute']);
  });

  it('has given a nominal player everything by the fifth day', () => {
    const fiveDays: UnlockProgress = {
      totalMetres: NOMINAL_DAY.totalMetres * 5,
      totalCoins: NOMINAL_DAY.totalCoins * 5,
      totalEncounters: NOMINAL_DAY.totalEncounters * 5,
      campfires: NOMINAL_DAY.campfires * 5,
    };
    expect(unlockedInstruments(fiveDays)).toHaveLength(INSTRUMENTS.length);
  });

  it('spreads the unlocks over four different metrics so no one grind dominates', () => {
    const kinds = new Set(INSTRUMENTS.map((i) => i.unlock.type));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
});
