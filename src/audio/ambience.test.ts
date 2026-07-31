import { describe, expect, it } from 'vitest';
import { BIOMES } from '../core/biome';
import {
  AMBIENCE_BIOMES,
  AMBIENCE_LAYERS,
  type AmbienceBiomeId,
  type AmbienceLayerDef,
  type AmbienceLayerId,
  type AmbienceMix,
  type AmbienceWeather,
  ambienceMix,
  blendMixes,
  dayShape,
  mixTotal,
  sweepRangeHz,
} from './ambience';

const WEATHERS: AmbienceWeather[] = ['clear', 'breezy', 'overcast', 'rain'];

/** A fine sweep of the whole day, including the seam at midnight. */
const DAY_SAMPLES = Array.from({ length: 97 }, (_, i) => i / 96);

function everyScene(visit: (mix: AmbienceMix, biome: AmbienceBiomeId, dayFraction: number, weather: AmbienceWeather) => void): void {
  for (const biomeId of AMBIENCE_BIOMES) {
    for (const dayFraction of DAY_SAMPLES) {
      for (const weather of WEATHERS) {
        visit(ambienceMix({ biomeId, dayFraction, weather }), biomeId, dayFraction, weather);
      }
    }
  }
}

function gainOf(mix: AmbienceMix, id: AmbienceLayerId): number {
  return mix[id];
}

describe('dayShape', () => {
  it('is dark at midnight and bright at high day', () => {
    expect(dayShape(0).daylight).toBeCloseTo(0, 3);
    expect(dayShape(0.55).daylight).toBeCloseTo(1, 3);
  });

  it('wraps, so the seam at midnight is not a seam', () => {
    expect(dayShape(0.999).daylight).toBeCloseTo(dayShape(-0.001).daylight, 6);
    expect(dayShape(1.25).night).toBeCloseTo(dayShape(0.25).night, 12);
  });

  it('is continuous all the way round', () => {
    let previous = dayShape(0);
    for (const t of DAY_SAMPLES) {
      const shape = dayShape(t);
      expect(Math.abs(shape.daylight - previous.daylight)).toBeLessThan(0.12);
      previous = shape;
    }
    // Either side of midnight rather than dayShape(1) against dayShape(0):
    // those wrap to the same input and would agree even if the shapes had a
    // seam. `evening` is the one shape that is neither pinned nor flat there,
    // so it is the only one that would actually catch one.
    expect(Math.abs(dayShape(1 - 1e-6).evening - dayShape(1e-6).evening)).toBeLessThan(1e-4);
  });

  it('puts morning before noon and evening after it', () => {
    expect(dayShape(0.3).morning).toBeGreaterThan(0.9);
    expect(dayShape(0.3).evening).toBe(0);
    expect(dayShape(0.8).evening).toBeGreaterThan(0.9);
    expect(dayShape(0.8).morning).toBe(0);
  });

  it('peaks its twilight at dawn and dusk and not at noon or midnight', () => {
    expect(dayShape(0.55).twilight).toBeCloseTo(0, 2);
    expect(dayShape(0).twilight).toBeCloseTo(0, 2);
    expect(Math.max(dayShape(0.28).twilight, dayShape(0.88).twilight)).toBeGreaterThan(0.7);
  });

  it('never produces a NaN, whatever it is handed', () => {
    for (const value of [Number.NaN, Infinity, -Infinity, -3.5, 12.25]) {
      const shape = dayShape(value);
      for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
        expect(Number.isFinite(shape[key]), `${value} / ${key}`).toBe(true);
      }
    }
  });
});

describe('ambienceMix', () => {
  it('covers every biome the game actually ships', () => {
    expect([...AMBIENCE_BIOMES].sort()).toEqual(BIOMES.map((b) => b.id).sort());
  });

  it('never sounds a layer in a biome it has no business in', () => {
    everyScene((mix, biomeId, dayFraction, weather) => {
      for (const layer of AMBIENCE_LAYERS) {
        if (layer.everywhere === true || layer.biomes.includes(biomeId)) continue;
        expect(mix[layer.id], `${layer.id} in ${biomeId} @ ${dayFraction} ${weather}`).toBe(0);
      }
    });
  });

  it('never lets a layer exceed the level the catalogue declares for it', () => {
    everyScene((mix) => {
      for (const layer of AMBIENCE_LAYERS) {
        expect(mix[layer.id]).toBeGreaterThanOrEqual(0);
        expect(mix[layer.id]).toBeLessThanOrEqual(layer.gain + 1e-12);
      }
    });
  });

  it('keeps the whole bed under the music', () => {
    everyScene((mix) => {
      expect(mixTotal(mix)).toBeLessThan(0.85);
    });
  });

  it('always leaves some air, so nothing is ever digitally silent', () => {
    everyScene((mix) => {
      expect(gainOf(mix, 'air')).toBeGreaterThan(0.03);
    });
  });

  it('swaps birds for crickets and owls after dark', () => {
    const noon = ambienceMix({ biomeId: 'forest', dayFraction: 0.55, weather: 'clear' });
    const midnight = ambienceMix({ biomeId: 'forest', dayFraction: 0, weather: 'clear' });
    expect(gainOf(noon, 'birds')).toBeGreaterThan(0);
    expect(gainOf(noon, 'crickets')).toBeCloseTo(0, 3);
    expect(gainOf(noon, 'owl')).toBeCloseTo(0, 3);
    expect(gainOf(midnight, 'birds')).toBeCloseTo(0, 3);
    expect(gainOf(midnight, 'crickets')).toBeGreaterThan(0.02);
    expect(gainOf(midnight, 'owl')).toBeGreaterThan(0.02);
  });

  it('makes the dawn chorus the loudest birdsong of the day', () => {
    const dawn = gainOf(ambienceMix({ biomeId: 'forest', dayFraction: 0.32, weather: 'clear' }), 'birds');
    const afternoon = gainOf(ambienceMix({ biomeId: 'forest', dayFraction: 0.7, weather: 'clear' }), 'birds');
    expect(dawn).toBeGreaterThan(afternoon);
  });

  it('gives each biome its own defining layer and no other biome that layer', () => {
    const village = ambienceMix({ biomeId: 'village', dayFraction: 0.5, weather: 'clear' });
    const forest = ambienceMix({ biomeId: 'forest', dayFraction: 0.5, weather: 'clear' });
    const riverside = ambienceMix({ biomeId: 'riverside', dayFraction: 0.5, weather: 'clear' });
    expect(gainOf(village, 'hearth')).toBeGreaterThan(0);
    expect(gainOf(forest, 'hearth')).toBe(0);
    expect(gainOf(forest, 'wind-canopy')).toBeGreaterThan(0);
    expect(gainOf(village, 'wind-canopy')).toBe(0);
    expect(gainOf(riverside, 'water')).toBeGreaterThan(0);
    expect(gainOf(forest, 'water')).toBe(0);
    expect(gainOf(riverside, 'frogs')).toBe(0); // midday: the frogs are asleep
    expect(gainOf(ambienceMix({ biomeId: 'riverside', dayFraction: 0, weather: 'clear' }), 'frogs')).toBeGreaterThan(0);
  });

  it('only rains when it is raining, and quietens the wildlife when it does', () => {
    for (const weather of WEATHERS) {
      const mix = ambienceMix({ biomeId: 'village', dayFraction: 0.5, weather });
      expect(gainOf(mix, 'rain') > 0).toBe(weather === 'rain');
    }
    const dry = ambienceMix({ biomeId: 'forest', dayFraction: 0.5, weather: 'clear' });
    const wet = ambienceMix({ biomeId: 'forest', dayFraction: 0.5, weather: 'rain' });
    expect(gainOf(wet, 'birds')).toBeLessThan(gainOf(dry, 'birds') * 0.3);
  });

  it('gives a breezy day more wind than a still one', () => {
    const still = ambienceMix({ biomeId: 'village', dayFraction: 0.5, weather: 'clear' });
    const breezy = ambienceMix({ biomeId: 'village', dayFraction: 0.5, weather: 'breezy' });
    expect(gainOf(breezy, 'wind-open')).toBeGreaterThan(gainOf(still, 'wind-open'));
  });

  it('moves smoothly through the day rather than switching at a boundary', () => {
    for (const biomeId of AMBIENCE_BIOMES) {
      let previous = ambienceMix({ biomeId, dayFraction: 0, weather: 'clear' });
      for (const dayFraction of DAY_SAMPLES) {
        const mix = ambienceMix({ biomeId, dayFraction, weather: 'clear' });
        for (const layer of AMBIENCE_LAYERS) {
          expect(Math.abs(mix[layer.id] - previous[layer.id]), `${biomeId} ${layer.id} @ ${dayFraction}`).toBeLessThan(0.02);
        }
        previous = mix;
      }
    }
  });

  it('falls back to air and weather for a place it has never heard of', () => {
    const mix = ambienceMix({ biomeId: 'moon', dayFraction: 0.5, weather: 'rain' });
    expect(gainOf(mix, 'air')).toBeGreaterThan(0);
    expect(gainOf(mix, 'rain')).toBeGreaterThan(0);
    expect(gainOf(mix, 'water')).toBe(0);
    expect(gainOf(mix, 'birds')).toBe(0);
    expect(gainOf(mix, 'hearth')).toBe(0);
  });

  it('produces no NaN from nonsense input', () => {
    const mix = ambienceMix({ biomeId: 'forest', dayFraction: Number.NaN, weather: 'clear' });
    for (const layer of AMBIENCE_LAYERS) expect(Number.isFinite(mix[layer.id])).toBe(true);
  });
});

describe('blendMixes', () => {
  const village = ambienceMix({ biomeId: 'village', dayFraction: 0.5, weather: 'clear' });
  const riverside = ambienceMix({ biomeId: 'riverside', dayFraction: 0.5, weather: 'clear' });

  it('returns the endpoints exactly', () => {
    expect(blendMixes(village, riverside, 0)).toEqual(village);
    expect(blendMixes(village, riverside, 1)).toEqual(riverside);
  });

  it('never leaves the range spanned by the two ends, at any t including out-of-range ones', () => {
    for (const t of [-1, 0, 0.13, 0.5, 0.87, 1, 2]) {
      const mix = blendMixes(village, riverside, t);
      for (const layer of AMBIENCE_LAYERS) {
        const low = Math.min(village[layer.id], riverside[layer.id]);
        const high = Math.max(village[layer.id], riverside[layer.id]);
        expect(mix[layer.id]).toBeGreaterThanOrEqual(low - 1e-12);
        expect(mix[layer.id]).toBeLessThanOrEqual(high + 1e-12);
      }
    }
  });

  it('carries the total across the seam without a dip or a pile-up', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const total = mixTotal(blendMixes(village, riverside, t));
      expect(total).toBeGreaterThan(Math.min(mixTotal(village), mixTotal(riverside)) - 1e-12);
      expect(total).toBeLessThan(Math.max(mixTotal(village), mixTotal(riverside)) + 1e-12);
    }
  });
});

describe('the beds', () => {
  const bedLayers = AMBIENCE_LAYERS.filter((layer) => layer.kind === 'bed');

  it('steeply filters every bed — a single-pole cascade reads as hiss, not air', () => {
    for (const layer of bedLayers) {
      expect(layer.filters?.length ?? 0, layer.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('leaves no bed cascade with significant energy above 5 kHz', () => {
    for (const layer of bedLayers) {
      const shaping = (layer.filters ?? []).filter((f) => f.type === 'lowpass' || f.type === 'bandpass');
      // A cascade of highpasses only, with nothing ever narrowing the top
      // end, is exactly the "bare highpass" bug this pass exists to fix.
      expect(shaping.length, layer.id).toBeGreaterThan(0);
      const highestCorner = Math.max(...shaping.map((f) => f.frequencyHz));
      expect(highestCorner, layer.id).toBeLessThanOrEqual(4200);
    }
  });

  it('never sweeps a filter corner across zero or past 8 kHz', () => {
    for (const layer of AMBIENCE_LAYERS) {
      const [minHz, maxHz] = sweepRangeHz(layer);
      expect(minHz, layer.id).toBeGreaterThanOrEqual(0);
      expect(maxHz, layer.id).toBeLessThanOrEqual(8000);
    }
  });

  it('widens the sweep range strictly as depth grows, on a synthetic layer', () => {
    const layerAt = (depth: number): AmbienceLayerDef => ({
      id: 'air',
      kind: 'bed',
      biomes: AMBIENCE_BIOMES,
      gain: 0.05,
      filters: [{ type: 'lowpass', frequencyHz: 1000, q: 0.7 }],
      sweep: [0.05, depth],
    });
    let previousWidth = -Infinity;
    for (const depth of [0, 0.1, 0.25, 0.4, 0.6]) {
      const [minHz, maxHz] = sweepRangeHz(layerAt(depth));
      const width = maxHz - minHz;
      expect(width).toBeGreaterThan(previousWidth);
      previousWidth = width;
    }
  });

  it('returns a flat range when a layer has no sweep or no filter', () => {
    const noSweep: AmbienceLayerDef = {
      id: 'air',
      kind: 'bed',
      biomes: AMBIENCE_BIOMES,
      gain: 0.05,
      filters: [{ type: 'lowpass', frequencyHz: 500, q: 0.7 }],
    };
    expect(sweepRangeHz(noSweep)).toEqual([500, 500]);
    const noFilter: AmbienceLayerDef = { id: 'air', kind: 'bed', biomes: AMBIENCE_BIOMES, gain: 0.05 };
    expect(sweepRangeHz(noFilter)).toEqual([0, 0]);
  });

  it('never sweeps faster than one cycle per six-plus seconds — faster reads as an effect, not weather', () => {
    for (const layer of bedLayers) {
      if (!layer.sweep) continue;
      const [rateHz] = layer.sweep;
      expect(rateHz, layer.id).toBeLessThan(0.15);
    }
  });

  it('keeps the loudest possible mix materially under the old ceiling', () => {
    let worst = 0;
    everyScene((mix) => {
      worst = Math.max(worst, mixTotal(mix));
    });
    expect(worst).toBeLessThanOrEqual(0.42);
  });

  it('keeps crickets below the range that reads as tinnitus', () => {
    const crickets = AMBIENCE_LAYERS.find((layer) => layer.id === 'crickets');
    expect(crickets?.grain?.pitchHz[1]).toBeLessThanOrEqual(4500);
  });
});
