import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, type InstrumentVoice } from '../core/instruments';
import {
  VOICE_SILENCE,
  defaultHoldSec,
  planEnvelope,
  planPartials,
  planTransient,
  planVoice,
  voiceInharmonicity,
  voiceRingSec,
} from './instrumentVoice';

/** A plain harmonic voice with no chorus, transient or vibrato to get in the way. */
const plain: InstrumentVoice = {
  partials: [
    [1, 1],
    [2, 0.5],
    [3, 0.25],
  ],
  attackMs: 10,
  decayMs: 400,
  sustain: 0,
  releaseMs: 100,
  detuneCents: 0,
  cutoffHz: 4000,
  transient: 0,
  vibrato: [0, 0],
};

const sustained: InstrumentVoice = { ...plain, sustain: 0.7, decayMs: 120, releaseMs: 200 };

describe('planPartials', () => {
  it('normalises the stack to sum to one', () => {
    const plan = planPartials(plain, 440);
    const total = plan.reduce((sum, p) => sum + p.gain, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it('places partials at their ratio times the played pitch', () => {
    expect(planPartials(plain, 200).map((p) => p.frequencyHz)).toEqual([200, 400, 600]);
  });

  it('doubles the stack into a detuned pair when the voice asks for chorus', () => {
    const chorus = planPartials({ ...plain, detuneCents: 8 }, 440);
    expect(chorus).toHaveLength(6);
    expect(chorus.map((p) => p.detuneCents)).toEqual([-4, 4, -4, 4, -4, 4]);
    expect(chorus.reduce((sum, p) => sum + p.gain, 0)).toBeCloseTo(1, 12);
  });

  it('drops partials that would sit above the nyquist rather than aliasing', () => {
    expect(planPartials(plain, 8000, { nyquistHz: 20000 }).map((p) => p.frequencyHz)).toEqual([8000, 16000]);
  });

  it('never exceeds the oscillator budget, chorus or not', () => {
    const wide: InstrumentVoice = {
      ...plain,
      partials: Array.from({ length: 20 }, (_, i): [number, number] => [i + 1, 1 / (i + 1)]),
    };
    expect(planPartials(wide, 110, { maxOscillators: 12 })).toHaveLength(12);
    expect(planPartials({ ...wide, detuneCents: 6 }, 110, { maxOscillators: 12 })).toHaveLength(12);
  });

  it('spends the budget on the loudest partials and returns them in pitch order', () => {
    const plan = planPartials(plain, 100, { maxOscillators: 2 });
    expect(plan.map((p) => p.frequencyHz)).toEqual([100, 200]);
  });

  it('returns nothing for a pitch that cannot be sounded', () => {
    expect(planPartials(plain, 0)).toEqual([]);
    expect(planPartials(plain, Number.NaN)).toEqual([]);
  });

  it('gives every shipped instrument a usable stack across the songbook range', () => {
    for (const instrument of INSTRUMENTS) {
      for (const frequencyHz of [130.81, 261.63, 523.25, 1046.5]) {
        const plan = planPartials(instrument.voice, frequencyHz);
        expect(plan.length, instrument.id).toBeGreaterThan(0);
        for (const partial of plan) {
          expect(Number.isFinite(partial.frequencyHz), instrument.id).toBe(true);
          expect(Number.isFinite(partial.gain), instrument.id).toBe(true);
          expect(partial.gain).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('planEnvelope', () => {
  it('runs forward in time and lands on a true zero', () => {
    for (const instrument of INSTRUMENTS) {
      for (const holdSec of [0, 0.05, 0.3, 2, 10]) {
        const { points, endSec } = planEnvelope(instrument.voice, holdSec);
        for (let i = 1; i < points.length; i++) {
          expect(points[i].timeSec, `${instrument.id} @ ${holdSec}`).toBeGreaterThanOrEqual(points[i - 1].timeSec);
        }
        expect(points[0].value).toBe(0);
        expect(points[points.length - 1].value).toBe(0);
        expect(points[points.length - 1].timeSec).toBe(endSec);
        expect(endSec).toBeGreaterThan(0);
      }
    }
  });

  it('never asks an exponential ramp to reach zero', () => {
    for (const instrument of INSTRUMENTS) {
      for (const point of planEnvelope(instrument.voice, 0.4).points) {
        if (point.shape !== 'exponential') continue;
        expect(point.value, instrument.id).toBeGreaterThanOrEqual(VOICE_SILENCE);
      }
    }
  });

  it('holds a sustaining voice at its sustain level until the release', () => {
    const { points } = planEnvelope(sustained, 3);
    const hold = points.find((p) => p.shape === 'step' && p.timeSec === 3);
    expect(hold?.value).toBeCloseTo(0.7, 6);
  });

  it('truncates the decay when the note is released part-way through it', () => {
    const full = planEnvelope(sustained, 3);
    const short = planEnvelope(sustained, 0.06);
    const fullDecay = full.points.find((p) => p.shape === 'exponential')?.value ?? 0;
    const shortDecay = short.points.find((p) => p.shape === 'exponential')?.value ?? 0;
    // Released half-way down, so it is still above where the decay was headed.
    expect(shortDecay).toBeGreaterThan(fullDecay);
    expect(shortDecay).toBeLessThan(1);
  });

  it('still attacks and releases when the note is shorter than its own attack', () => {
    const { points, endSec } = planEnvelope({ ...plain, attackMs: 95 }, 0.001);
    expect(points.some((p) => p.shape === 'linear' && p.value === 1)).toBe(true);
    expect(endSec).toBeGreaterThan(0.095);
  });

  it('treats a malformed voice as silence rather than producing NaN', () => {
    const broken: InstrumentVoice = {
      ...plain,
      attackMs: Number.NaN,
      decayMs: Number.NaN,
      releaseMs: Number.NaN,
      sustain: Number.NaN,
    };
    for (const point of planEnvelope(broken, Number.NaN).points) {
      expect(Number.isFinite(point.timeSec)).toBe(true);
      expect(Number.isFinite(point.value)).toBe(true);
    }
  });
});

describe('planTransient', () => {
  it('is absent when the voice has no noise in it', () => {
    expect(planTransient(plain, 440)).toBeNull();
  });

  it('gets louder with the transient amount', () => {
    const quiet = planTransient({ ...plain, transient: 0.2 }, 440);
    const loud = planTransient({ ...plain, transient: 0.9 }, 440);
    expect(loud?.gain).toBeGreaterThan(quiet?.gain ?? 0);
  });

  it('lasts as long as a slow attack, so a breath chiff covers the breath', () => {
    const chiff = planTransient({ ...plain, transient: 0.45, attackMs: 95 }, 440);
    expect(chiff?.durationSec).toBeGreaterThan(0.1);
  });

  it('keeps its band inside the voice and inside the nyquist', () => {
    for (const instrument of INSTRUMENTS) {
      const plan = planTransient(instrument.voice, 1046.5, 22050);
      if (!plan) continue;
      expect(plan.centreHz, instrument.id).toBeGreaterThan(0);
      expect(plan.centreHz, instrument.id).toBeLessThan(11025);
      expect(plan.durationSec).toBeGreaterThan(0);
    }
  });
});

describe('planVoice', () => {
  it('shares the note between pitch and noise instead of adding noise on top', () => {
    const clean = planVoice(plain, 440);
    const noisy = planVoice({ ...plain, transient: 0.95 }, 440);
    expect(clean.tonalGain).toBe(1);
    expect(noisy.tonalGain).toBeLessThan(0.5);
  });

  it('only carries vibrato when the voice declares a depth', () => {
    expect(planVoice(plain, 440).vibrato).toBeNull();
    expect(planVoice({ ...plain, vibrato: [5.2, 18] }, 440).vibrato).toEqual({ rateHz: 5.2, depthCents: 18 });
    expect(planVoice({ ...plain, vibrato: [5.2, 0] }, 440).vibrato).toBeNull();
  });

  it('produces finite, in-range numbers for every instrument at every songbook pitch', () => {
    for (const instrument of INSTRUMENTS) {
      for (const frequencyHz of [130.81, 261.63, 523.25, 1046.5]) {
        const plan = planVoice(instrument.voice, frequencyHz, { nyquistHz: 24000 });
        expect(Number.isFinite(plan.endSec), instrument.id).toBe(true);
        expect(plan.endSec).toBeGreaterThan(0);
        expect(plan.cutoffHz).toBeGreaterThan(0);
        expect(plan.cutoffHz).toBeLessThanOrEqual(24000);
        expect(plan.tonalGain).toBeGreaterThan(0);
        expect(plan.tonalGain).toBeLessThanOrEqual(1);
        expect(plan.gain).toBeGreaterThan(0);
      }
    }
  });

  it('lets the caller override the hold without disturbing the release', () => {
    const short = planVoice(sustained, 440, { holdSec: 0.5 });
    const long = planVoice(sustained, 440, { holdSec: 2 });
    expect(long.endSec - short.endSec).toBeCloseTo(1.5, 6);
  });
});

describe('voice analysis', () => {
  it('reads the drum and the bells as inharmonic and the strings as not', () => {
    const of = (id: string): number => voiceInharmonicity(INSTRUMENTS.find((i) => i.id === id)!.voice);
    expect(of('hand-drum')).toBeGreaterThan(0.3);
    expect(of('bells')).toBeGreaterThan(0.1);
    expect(of('lute')).toBe(0);
    expect(of('harp')).toBe(0);
    expect(of('hurdy-gurdy')).toBe(0);
  });

  it('orders the instruments by how long one note hangs around', () => {
    const ring = (id: string): number => voiceRingSec(INSTRUMENTS.find((i) => i.id === id)!.voice);
    expect(ring('hand-drum')).toBeLessThan(ring('lute'));
    expect(ring('lute')).toBeLessThan(ring('harp'));
    expect(ring('harp')).toBeLessThan(ring('bells'));
  });

  it('gives a plucked voice a default hold that covers its whole ring', () => {
    expect(defaultHoldSec(plain)).toBeCloseTo(0.41, 6);
    // A sustaining voice has to be told to stop, so it gets held past its decay.
    expect(defaultHoldSec(sustained)).toBeGreaterThan(0.13 + 0.2);
  });
});
