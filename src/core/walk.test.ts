import { describe, expect, it } from 'vitest';
import {
  PERFORMANCE_METER_CONFIG,
  START_METER,
  WALK_METER_CONFIG,
  WALK_PERFORMANCE_CONFIG,
  applyJudgement,
  createPerformance,
} from './performance';
import { applyHit, applyMiss } from './songMeter';
import { MARY_HAD_A_LITTLE_LAMB } from './songs';
import {
  WALK_STOP_METER,
  WALK_TUNE_HORIZON_MS,
  extendWalkTune,
  startWalkTune,
  walkPaceFactor,
} from './walk';

const CONFIG = PERFORMANCE_METER_CONFIG;

describe('the walking meter (WALK_METER_CONFIG)', () => {
  it('lets one hit buy two misses, so casual timing holds the walk', () => {
    // The contract DESIGN.md v0.8 states in prose: a player answering every
    // third note keeps the bard moving. Break-even accuracy = drain/(gain+
    // drain) — it must sit at or below one-third.
    const { hitGain, missDrain } = WALK_METER_CONFIG;
    expect(missDrain / (hitGain + missDrain)).toBeLessThanOrEqual(1 / 3 + 1e-9);
  });

  it('never makes a hit weaker than the busk meter does', () => {
    expect(WALK_METER_CONFIG.hitGain).toBeGreaterThanOrEqual(PERFORMANCE_METER_CONFIG.hitGain);
  });

  it('keeps the same walking threshold as the busk meter', () => {
    // The pace ramp (walkPaceFactor) reads PERFORMANCE_METER_CONFIG's
    // threshold; if the walk judged against a different one, the stride and
    // the meter would disagree about what "walking" means.
    expect(WALK_METER_CONFIG.walkingThreshold).toBe(PERFORMANCE_METER_CONFIG.walkingThreshold);
  });

  it('is what applyJudgement actually uses when handed the walk config', () => {
    const state = createPerformance();
    const before = state.meter;
    applyJudgement(state, 'miss', WALK_PERFORMANCE_CONFIG);
    expect(before - state.meter).toBeCloseTo(WALK_METER_CONFIG.missDrain, 10);
    const afterMiss = state.meter;
    applyJudgement(state, 'good', WALK_PERFORMANCE_CONFIG);
    expect(state.meter - afterMiss).toBeCloseTo(WALK_METER_CONFIG.hitGain, 10);
  });

  it('leaves the busk meter untouched when no meter config is passed', () => {
    const state = createPerformance();
    const before = state.meter;
    applyJudgement(state, 'miss');
    expect(before - state.meter).toBeCloseTo(PERFORMANCE_METER_CONFIG.missDrain, 10);
  });
});

describe('walkPaceFactor', () => {
  it('walks at full stride at or above the meter walking threshold', () => {
    expect(walkPaceFactor(CONFIG.walkingThreshold)).toBe(1);
    expect(walkPaceFactor(1)).toBe(1);
    // The busk-start meter is half full and half full is a full stride —
    // the walk must never open with a told-off bard.
    expect(walkPaceFactor(START_METER)).toBe(1);
  });

  it('stands still at or below the stop floor, and only there', () => {
    expect(walkPaceFactor(0)).toBe(0);
    expect(walkPaceFactor(WALK_STOP_METER)).toBe(0);
    expect(walkPaceFactor(WALK_STOP_METER + 0.01)).toBeGreaterThan(0);
  });

  it('is monotonic in the meter', () => {
    let previous = -1;
    for (let m = 0; m <= 1.0001; m += 0.01) {
      const pace = walkPaceFactor(m);
      expect(pace).toBeGreaterThanOrEqual(previous);
      expect(pace).toBeGreaterThanOrEqual(0);
      expect(pace).toBeLessThanOrEqual(1);
      previous = pace;
    }
  });

  it('recovers the moment the rhythm does: the first hit out of a stall moves the bard', () => {
    // Drain to a standstill, then play. No warm-up period, no penalty box —
    // the pace is a pure function of the meter, so it moves on the same
    // frame the hit lands.
    let meter = 0;
    expect(walkPaceFactor(meter)).toBe(0);
    meter = applyHit(meter, CONFIG);
    expect(walkPaceFactor(meter)).toBeGreaterThan(0.15);
    meter = applyHit(applyHit(applyHit(meter, CONFIG), CONFIG), CONFIG);
    // Four hits from empty is the meter's own empty-to-walking pace.
    expect(walkPaceFactor(meter)).toBe(1);
  });

  it('holds a full stride through an occasional miss — the walk is forgiving', () => {
    // A player watching the scenery drops a note now and then. From a full
    // meter, several consecutive misses still leave the bard moving.
    let meter = CONFIG.max;
    meter = applyMiss(meter, CONFIG);
    expect(walkPaceFactor(meter)).toBe(1);
    meter = applyMiss(meter, CONFIG);
    expect(walkPaceFactor(meter)).toBeGreaterThan(0.9);
    meter = applyMiss(meter, CONFIG);
    expect(walkPaceFactor(meter)).toBeGreaterThan(0);
  });

  it('never punishes a bad number: non-finite meters read as full stride', () => {
    expect(walkPaceFactor(Number.NaN)).toBe(1);
    expect(walkPaceFactor(Number.POSITIVE_INFINITY)).toBe(1);
    expect(walkPaceFactor(-1)).toBe(0);
  });
});

describe('walk tune schedule', () => {
  const BPM = 92;

  it('starts with exactly one pass of the song', () => {
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    expect(tune.passes).toBe(1);
    expect(tune.beats.length).toBe(MARY_HAD_A_LITTLE_LAMB.notes.length);
    expect(tune.beats[0].index).toBe(0);
  });

  it('appends passes until the horizon is covered, and then stops', () => {
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    const appended = extendWalkTune(tune, tune.passLengthMs * 2);
    expect(appended).toBeGreaterThan(0);
    const last = tune.beats[tune.beats.length - 1];
    expect(last.hitTimeMs).toBeGreaterThanOrEqual(tune.passLengthMs * 2 + WALK_TUNE_HORIZON_MS);
    // Already covered: the ordinary per-frame call appends nothing.
    expect(extendWalkTune(tune, tune.passLengthMs * 2)).toBe(0);
  });

  it('keeps indices dense and ascending across the pass seams', () => {
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    extendWalkTune(tune, tune.passLengthMs * 3);
    for (let i = 0; i < tune.beats.length; i++) {
      expect(tune.beats[i].index).toBe(i);
      if (i > 0) expect(tune.beats[i].hitTimeMs).toBeGreaterThan(tune.beats[i - 1].hitTimeMs);
    }
  });

  it('makes the seam between passes exactly the last note`s written length', () => {
    // The same property `expandSong`'s own header promises for the busk;
    // asserted here because the walk relies on it forever rather than for
    // three passes.
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    extendWalkTune(tune, 0, tune.passLengthMs + 1);
    const n = MARY_HAD_A_LITTLE_LAMB.notes.length;
    const lastOfFirst = tune.beats[n - 1];
    const firstOfSecond = tune.beats[n];
    const interval = tune.passLengthMs / MARY_HAD_A_LITTLE_LAMB.notes.reduce((t, x) => t + x.beats, 0);
    const lastNote = MARY_HAD_A_LITTLE_LAMB.notes[n - 1];
    expect(firstOfSecond.hitTimeMs - lastOfFirst.hitTimeMs).toBeCloseTo(
      lastNote.beats * interval,
      6,
    );
  });

  it('grows the beats array in place rather than replacing it', () => {
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    const reference = tune.beats;
    extendWalkTune(tune, tune.passLengthMs);
    expect(tune.beats).toBe(reference);
  });

  it('refuses to loop on a degenerate song', () => {
    const silent = { id: 'x', title: 'x', beatsPerBar: 4, notes: [] };
    const tune = startWalkTune(silent, BPM);
    expect(extendWalkTune(tune, 1e9)).toBe(0);
  });

  it('caps a single extension so a huge clock jump cannot stall a frame', () => {
    const tune = startWalkTune(MARY_HAD_A_LITTLE_LAMB, BPM);
    const appended = extendWalkTune(tune, tune.passLengthMs * 1e6);
    expect(appended).toBeLessThanOrEqual(64);
  });
});
