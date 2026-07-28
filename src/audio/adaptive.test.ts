import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instrumentById } from '../core/instruments';
import { BIOMES } from '../core/biome';
import {
  ADAPTIVE_LAYERS,
  type AdaptiveInput,
  type AdaptiveLayerId,
  type AdaptiveState,
  activeLayerIds,
  adaptiveTotal,
  initialAdaptiveState,
  instrumentTrim,
  layerGain,
  layerSemitone,
  nextBarAt,
  updateAdaptive,
} from './adaptive';

const LUTE = instrumentById('lute');
const BAR_SEC = 2;

function input(over: Partial<AdaptiveInput> = {}): AdaptiveInput {
  return {
    warmth: 0,
    biomeId: 'village',
    instrument: LUTE,
    dayFraction: 0.5,
    nowSec: 0,
    barSec: BAR_SEC,
    barAnchorSec: 0,
    ...over,
  };
}

/** Hold a warmth for a stretch of seconds, updating twice a second. */
function hold(state: AdaptiveState, warmth: number, fromSec: number, seconds: number): AdaptiveState {
  let next = state;
  for (let t = fromSec; t <= fromSec + seconds + 1e-9; t += 0.5) {
    next = updateAdaptive(next, input({ warmth, nowSec: t })).state;
  }
  return next;
}

function activeAt(warmth: number): AdaptiveLayerId[] {
  return activeLayerIds(updateAdaptive(initialAdaptiveState(), input({ warmth })).state);
}

describe('the layer table', () => {
  it('is asymmetric: every layer takes longer to leave than to arrive', () => {
    for (const def of ADAPTIVE_LAYERS) {
      expect(def.fadeOutSec, def.id).toBeGreaterThan(def.fadeInSec);
    }
  });

  it('leaves a real gap between joining and leaving, so a wobble costs nothing', () => {
    for (const def of ADAPTIVE_LAYERS) {
      if (def.id === 'drone') continue;
      expect(def.enterAt - def.leaveAt, def.id).toBeGreaterThanOrEqual(0.1);
      expect(def.patienceSec, def.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('brings its layers in in order and loses them from the top down', () => {
    const enters = ADAPTIVE_LAYERS.map((d) => d.enterAt);
    const leaves = ADAPTIVE_LAYERS.map((d) => d.leaveAt);
    for (let i = 1; i < enters.length; i++) {
      expect(enters[i]).toBeGreaterThan(enters[i - 1]);
      expect(leaves[i]).toBeGreaterThan(leaves[i - 1]);
    }
  });

  it('always has the bard: the drone can never leave', () => {
    const drone = ADAPTIVE_LAYERS.find((d) => d.id === 'drone');
    expect(drone?.enterAt).toBe(0);
    expect(drone?.leaveAt).toBeLessThan(0);
  });
});

describe('nextBarAt', () => {
  it('lands on the grid the anchor defines', () => {
    expect(nextBarAt(0, 0, 2)).toBe(0);
    expect(nextBarAt(0.1, 0, 2)).toBe(2);
    expect(nextBarAt(1.9, 0, 2)).toBe(2);
    expect(nextBarAt(2, 0, 2)).toBe(2);
    expect(nextBarAt(2.1, 0, 2)).toBe(4);
  });

  it('follows a re-anchored schedule instead of counting bars of its own', () => {
    expect(nextBarAt(10, 0.75, 2)).toBeCloseTo(10.75, 12);
  });

  it('degrades to "now" rather than to NaN when the tempo is nonsense', () => {
    expect(nextBarAt(5, 0, 0)).toBe(5);
    expect(nextBarAt(5, 0, Number.NaN)).toBe(5);
    expect(nextBarAt(5, Number.NaN, 2)).toBe(5);
  });
});

describe('membership', () => {
  it('adds layers as warmth rises and never drops one on the way up', () => {
    let previous: AdaptiveLayerId[] = [];
    for (let warmth = 0; warmth <= 1.0001; warmth += 0.02) {
      const active = activeAt(warmth);
      for (const id of previous) expect(active, `warmth ${warmth}`).toContain(id);
      previous = active;
    }
    expect(previous).toEqual(ADAPTIVE_LAYERS.map((d) => d.id));
  });

  it('takes a layer exactly at its threshold, not one step past it', () => {
    for (const def of ADAPTIVE_LAYERS) {
      expect(activeAt(def.enterAt), def.id).toContain(def.id);
      if (def.enterAt > 0) expect(activeAt(def.enterAt - 0.001), def.id).not.toContain(def.id);
    }
  });

  it('starts a cold room with only the bard', () => {
    expect(activeAt(0)).toEqual(['drone']);
  });

  it('never brings anything in mid-bar', () => {
    const { changes } = updateAdaptive(initialAdaptiveState(), input({ warmth: 1, nowSec: 1.1 }));
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(change.startAtSec % BAR_SEC).toBeCloseTo(0, 12);
      expect(change.startAtSec).toBeGreaterThanOrEqual(1.1);
      expect(change.rampSec).toBeGreaterThan(0);
    }
  });
});

describe('hysteresis and patience', () => {
  it('does not strip a layer the moment warmth falls', () => {
    const warm = hold(initialAdaptiveState(), 1, 0, 1);
    expect(activeLayerIds(warm)).toHaveLength(ADAPTIVE_LAYERS.length);
    const dipped = hold(warm, 0.4, 1.5, 3);
    expect(activeLayerIds(dipped)).toHaveLength(ADAPTIVE_LAYERS.length);
  });

  it('eventually lets the top of the arrangement go, sparkle first', () => {
    let state = hold(initialAdaptiveState(), 1, 0, 1);
    state = hold(state, 0.4, 1.5, 5.5);
    expect(activeLayerIds(state)).not.toContain('shimmer');
    expect(activeLayerIds(state)).toContain('counter');
    state = hold(state, 0.4, 7.5, 2);
    expect(activeLayerIds(state)).not.toContain('counter');
    // 0.4 is still above harmony's and pulse's leave thresholds, so the room
    // is thinner but has not emptied.
    expect(activeLayerIds(state)).toEqual(['drone', 'pulse', 'harmony']);
  });

  it('forgives: one warm moment resets the whole countdown', () => {
    let state = hold(initialAdaptiveState(), 1, 0, 1);
    state = hold(state, 0.4, 1.5, 4);
    state = updateAdaptive(state, input({ warmth: 0.9, nowSec: 6 })).state;
    state = hold(state, 0.4, 6.5, 4);
    expect(activeLayerIds(state)).toHaveLength(ADAPTIVE_LAYERS.length);
  });

  it('makes a departed layer earn its way back in, not merely stop falling', () => {
    let state = hold(initialAdaptiveState(), 1, 0, 1);
    state = hold(state, 0.4, 1.5, 6);
    expect(activeLayerIds(state)).not.toContain('shimmer');
    // Above shimmer's leave threshold but below the one it joins at.
    state = hold(state, 0.7, 8, 20);
    expect(activeLayerIds(state)).not.toContain('shimmer');
    state = updateAdaptive(state, input({ warmth: 0.85, nowSec: 29 })).state;
    expect(activeLayerIds(state)).toContain('shimmer');
  });

  it('takes far longer to lose a room than to fill one', () => {
    const fill = updateAdaptive(initialAdaptiveState(), input({ warmth: 1 }));
    expect(activeLayerIds(fill.state)).toHaveLength(ADAPTIVE_LAYERS.length);
    let state = fill.state;
    let seconds = 0;
    while (activeLayerIds(state).length > 1 && seconds < 120) {
      seconds += 0.5;
      state = updateAdaptive(state, input({ warmth: 0, nowSec: seconds })).state;
    }
    expect(seconds).toBeGreaterThan(7);
    expect(activeLayerIds(state)).toEqual(['drone']);
  });

  it('does not expire the countdown when the audio clock is re-anchored backwards', () => {
    let state = hold(initialAdaptiveState(10), 1, 10, 1);
    state = hold(state, 0.4, 11.5, 3);
    state = updateAdaptive(state, input({ warmth: 0.4, nowSec: 0 })).state;
    expect(activeLayerIds(state)).toHaveLength(ADAPTIVE_LAYERS.length);
  });
});

describe('gains', () => {
  it('does not track warmth once a layer is in — membership is the whole signal', () => {
    const low = updateAdaptive(initialAdaptiveState(), input({ warmth: 0.45 }));
    const high = updateAdaptive(initialAdaptiveState(), input({ warmth: 1 }));
    const harmonyLow = low.layers.find((l) => l.id === 'harmony');
    const harmonyHigh = high.layers.find((l) => l.id === 'harmony');
    expect(harmonyLow?.targetGain).toBeCloseTo(harmonyHigh?.targetGain ?? 0, 12);
  });

  it('keeps the backing under the bard, for every instrument in every biome', () => {
    for (const instrument of INSTRUMENTS) {
      for (const biome of BIOMES) {
        for (const dayFraction of [0, 0.25, 0.5, 0.75]) {
          const update = updateAdaptive(
            initialAdaptiveState(),
            input({ warmth: 1, instrument, biomeId: biome.id, dayFraction })
          );
          const total = adaptiveTotal(update);
          expect(total, `${instrument.id}/${biome.id}`).toBeGreaterThan(0);
          expect(total, `${instrument.id}/${biome.id}`).toBeLessThan(0.7);
          for (const layer of update.layers) expect(Number.isFinite(layer.targetGain)).toBe(true);
        }
      }
    }
  });

  it('quietens at midnight, and takes the foot-tapping down hardest', () => {
    const noonPulse = layerGain(ADAPTIVE_LAYERS[1], LUTE, 0.55);
    const nightPulse = layerGain(ADAPTIVE_LAYERS[1], LUTE, 0);
    const noonDrone = layerGain(ADAPTIVE_LAYERS[0], LUTE, 0.55);
    const nightDrone = layerGain(ADAPTIVE_LAYERS[0], LUTE, 0);
    expect(nightPulse).toBeLessThan(noonPulse);
    expect(nightDrone).toBeLessThan(noonDrone);
    expect(nightPulse / noonPulse).toBeLessThan(nightDrone / noonDrone);
  });

  it('survives nonsense warmth and nonsense clocks without producing NaN', () => {
    const update = updateAdaptive(
      initialAdaptiveState(),
      input({ warmth: Number.NaN, nowSec: Number.NaN, dayFraction: Number.NaN, barSec: 0 })
    );
    for (const layer of update.layers) {
      expect(Number.isFinite(layer.targetGain)).toBe(true);
      expect(Number.isFinite(layer.startAtSec)).toBe(true);
      expect(Number.isFinite(layer.rampSec)).toBe(true);
    }
  });

  it('reports nothing when nothing has moved', () => {
    const first = updateAdaptive(initialAdaptiveState(), input({ warmth: 0.5, nowSec: 1 }));
    expect(first.changes.length).toBeGreaterThan(0);
    const second = updateAdaptive(first.state, input({ warmth: 0.5, nowSec: 1.02 }));
    expect(second.changes).toEqual([]);
  });
});

describe('instrument voicing', () => {
  it('thins the pulse under a drum, which is already the pulse', () => {
    const drum = instrumentById('hand-drum').voice;
    expect(instrumentTrim(drum, 'pulse')).toBeLessThan(0.85);
    expect(instrumentTrim(LUTE.voice, 'pulse')).toBe(1);
  });

  it('leans on the melodic layers under an instrument with no tune in it', () => {
    const drum = instrumentById('hand-drum').voice;
    expect(instrumentTrim(drum, 'harmony')).toBeGreaterThan(1);
  });

  it('makes room for a long ring rather than piling on top of it', () => {
    const bells = instrumentById('bells').voice;
    const harp = instrumentById('harp').voice;
    expect(instrumentTrim(bells, 'counter')).toBeLessThan(instrumentTrim(harp, 'counter'));
    expect(instrumentTrim(harp, 'counter')).toBeLessThan(instrumentTrim(LUTE.voice, 'counter'));
    expect(instrumentTrim(bells, 'shimmer')).toBeLessThan(instrumentTrim(bells, 'counter'));
  });

  it('never trims a layer to silence or lets one run away', () => {
    for (const instrument of INSTRUMENTS) {
      for (const def of ADAPTIVE_LAYERS) {
        const trim = instrumentTrim(instrument.voice, def.id);
        expect(trim, `${instrument.id}/${def.id}`).toBeGreaterThan(0.15);
        expect(trim, `${instrument.id}/${def.id}`).toBeLessThan(1.2);
      }
    }
  });
});

describe('pitch', () => {
  it('only ever sounds a C, a D or a G, whatever the biome', () => {
    for (const biome of BIOMES) {
      for (const def of ADAPTIVE_LAYERS) {
        const pitchClass = ((layerSemitone(def, biome.id) % 12) + 12) % 12;
        expect([0, 2, 7], `${biome.id}/${def.id}`).toContain(pitchClass);
      }
    }
  });

  it('never sounds an F or an F sharp, which is what would clash with the songbook', () => {
    for (const biomeId of [...BIOMES.map((b) => b.id), 'somewhere-new']) {
      for (const def of ADAPTIVE_LAYERS) {
        const pitchClass = ((layerSemitone(def, biomeId) % 12) + 12) % 12;
        expect(pitchClass).not.toBe(5);
        expect(pitchClass).not.toBe(6);
      }
    }
  });

  it('keeps the stack spread over three octaves so the layers do not mask each other', () => {
    const offsets = ADAPTIVE_LAYERS.map((d) => layerSemitone(d, 'village'));
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThanOrEqual(24);
  });
});
