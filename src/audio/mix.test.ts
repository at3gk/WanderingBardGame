import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instrumentById } from '../core/instruments';
import { BIOMES } from '../core/biome';
import { AMBIENCE_LAYERS, type AmbienceWeather } from './ambience';
import { type AdaptiveMode } from './adaptive';
import {
  AMBIENCE_BUS_BASE,
  AMBIENCE_MUSIC_RATIO,
  MELODY_GAIN,
  NOODLE_GAIN,
  type MixInput,
  ambienceBusGain,
  ambienceLayerLevels,
  ambienceTotalLevel,
  arrangementFullness,
  loudestAmbienceLayer,
  melodyGain,
  modeLayerCount,
  musicBusGain,
  musicCeilingGain,
  musicFloorGain,
  walkToBuskRatio,
} from './mix';

const MODES: AdaptiveMode[] = ['walking', 'busking'];
const WEATHERS: AmbienceWeather[] = ['clear', 'breezy', 'overcast', 'rain'];
const DAY_SAMPLES = Array.from({ length: 17 }, (_, i) => i / 16);
const DRIVE_SAMPLES = Array.from({ length: 13 }, (_, i) => i / 12);

const LUTE = instrumentById('lute');

function input(over: Partial<MixInput> = {}): MixInput {
  return {
    mode: 'walking',
    drive: 0.5,
    instrument: LUTE,
    dayFraction: 0.5,
    biomeId: 'village',
    weather: 'clear',
    ...over,
  };
}

/**
 * Every scene the game can be in, coarsely but exhaustively: two modes, six
 * instruments, three biomes, four weathers, a day in twenty-four steps and a
 * meter in twenty. That is about thirty-five thousand mixes, which is thirty-
 * five thousand more than anyone could audition, and the whole reason the
 * relationships in `mix.ts` are arithmetic rather than taste.
 */
function everyScene(visit: (mix: MixInput) => void): void {
  for (const mode of MODES) {
    for (const instrument of INSTRUMENTS) {
      for (const biome of BIOMES) {
        for (const weather of WEATHERS) {
          for (const dayFraction of DAY_SAMPLES) {
            for (const drive of DRIVE_SAMPLES) {
              visit({ mode, drive, instrument, dayFraction, biomeId: biome.id, weather });
            }
          }
        }
      }
    }
  }
}

describe('the ambience never gets over the music', () => {
  it('keeps the ambience bus at or under half the music bus, in every scene the game has', () => {
    everyScene((mix) => {
      expect(
        ambienceBusGain(mix),
        `${mix.mode}/${mix.instrument.id}/${mix.biomeId}/${mix.weather} @ day ${mix.dayFraction} drive ${mix.drive}`
      ).toBeLessThanOrEqual(AMBIENCE_MUSIC_RATIO * musicBusGain() + 1e-12);
    });
  });

  it('never lets one bed get as loud as the music that is guaranteed to be under it', () => {
    everyScene((mix) => {
      expect(
        loudestAmbienceLayer(mix),
        `${mix.mode}/${mix.instrument.id}/${mix.biomeId}/${mix.weather} @ day ${mix.dayFraction} drive ${mix.drive}`
      ).toBeLessThan(musicFloorGain(mix));
    });
  });

  it('keeps the whole bed summed under the music floor, even at the wettest midnight', () => {
    everyScene((mix) => {
      expect(
        ambienceTotalLevel(mix),
        `${mix.mode}/${mix.instrument.id}/${mix.biomeId}/${mix.weather} @ day ${mix.dayFraction} drive ${mix.drive}`
      ).toBeLessThan(musicFloorGain(mix));
    });
  });

  it('holds the cap by construction, so raising the base level cannot breach it', () => {
    // Not a tautology: it is the assertion that the cap is applied at all.
    // A future retune that pushed the base past the ratio would be caught
    // here rather than by a player.
    expect(ambienceBusGain(input({ drive: 0 }))).toBeLessThanOrEqual(AMBIENCE_MUSIC_RATIO);
    expect(AMBIENCE_BUS_BASE).toBeLessThan(AMBIENCE_MUSIC_RATIO);
  });

  it('produces no NaN and nothing negative from nonsense signals', () => {
    for (const drive of [Number.NaN, Infinity, -Infinity, -3, 7]) {
      for (const dayFraction of [Number.NaN, -2, 5]) {
        const mix = input({ drive, dayFraction });
        expect(Number.isFinite(ambienceBusGain(mix))).toBe(true);
        expect(ambienceBusGain(mix)).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(musicFloorGain(mix))).toBe(true);
        expect(musicFloorGain(mix)).toBeGreaterThan(0);
        for (const layer of AMBIENCE_LAYERS) {
          expect(Number.isFinite(ambienceLayerLevels(mix)[layer.id])).toBe(true);
        }
      }
    }
  });
});

describe('ducking', () => {
  it('pulls the world back as the band fills out', () => {
    const empty = ambienceBusGain(input({ mode: 'busking', drive: 0 }));
    const full = ambienceBusGain(input({ mode: 'busking', drive: 1 }));
    expect(full).toBeLessThan(empty);
    // Never all the way out: a square with no outdoors in it is a diorama.
    expect(full).toBeGreaterThan(0.5 * empty);
  });

  it('gives the road back to the player the moment they stop playing', () => {
    const playing = ambienceBusGain(input({ mode: 'walking', drive: 1 }));
    const stopped = ambienceBusGain(input({ mode: 'walking', drive: 0 }));
    expect(stopped).toBeGreaterThan(playing);
  });

  it('ducks a busk harder than a walk, because a square holds more people', () => {
    expect(arrangementFullness('busking', 1)).toBeGreaterThan(arrangementFullness('walking', 1));
    expect(ambienceBusGain(input({ mode: 'busking', drive: 1 }))).toBeLessThan(
      ambienceBusGain(input({ mode: 'walking', drive: 1 }))
    );
  });

  it('moves smoothly with the meter rather than stepping at a threshold', () => {
    for (const mode of MODES) {
      let previous = ambienceBusGain(input({ mode, drive: 0 }));
      for (let drive = 0; drive <= 1.0001; drive += 0.01) {
        const gain = ambienceBusGain(input({ mode, drive }));
        expect(Math.abs(gain - previous), `${mode} @ ${drive}`).toBeLessThan(0.01);
        previous = gain;
      }
    }
  });

  it('moves smoothly through the day too', () => {
    for (const mode of MODES) {
      let previous = musicFloorGain(input({ mode, dayFraction: 0 }));
      for (let dayFraction = 0; dayFraction <= 1.0001; dayFraction += 1 / 96) {
        const floor = musicFloorGain(input({ mode, dayFraction }));
        // A ninety-sixth of a day is a quarter of an hour of game time, and
        // the steepest quarter-hour — the one either side of dawn, where the
        // night trim is moving fastest — must still be under three per cent
        // of the floor's own value, which is a third of a decibel. Anything
        // larger would be a dusk you could hear arriving as a change rather
        // than as weather.
        expect(Math.abs(floor - previous), `${mode} @ ${dayFraction}`).toBeLessThan(0.03 * floor);
        previous = floor;
      }
    }
  });
});

describe('the melody', () => {
  it('is the loudest thing in the game whenever the tune is being kept', () => {
    everyScene((mix) => {
      if (mix.drive < 0.6) return;
      expect(melodyGain(mix.mode, mix.drive)).toBeGreaterThan(loudestAmbienceLayer(mix));
    });
  });

  it('drops to a noodle when the bard has stopped, and only on the road', () => {
    expect(melodyGain('walking', 0)).toBeCloseTo(NOODLE_GAIN, 12);
    expect(melodyGain('walking', 1)).toBeCloseTo(MELODY_GAIN, 12);
    // A busk is a performance; nobody busks quietly because a phrase wobbled.
    expect(melodyGain('busking', 0)).toBeCloseTo(MELODY_GAIN, 12);
  });

  it('rises without a step and never overshoots either end', () => {
    let previous = melodyGain('walking', 0);
    for (let drive = 0; drive <= 1.0001; drive += 0.01) {
      const gain = melodyGain('walking', drive);
      expect(gain).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(gain).toBeGreaterThanOrEqual(NOODLE_GAIN - 1e-12);
      expect(gain).toBeLessThanOrEqual(MELODY_GAIN + 1e-12);
      previous = gain;
    }
  });

  it('does not put a tremolo on a meter hovering near zero', () => {
    // Smoothstepped, so the derivative at the bottom of the range is nearly
    // flat: a meter jittering between 0 and 0.05 must not be audible as a
    // level change on every note.
    expect(melodyGain('walking', 0.05) - melodyGain('walking', 0)).toBeLessThan(0.01);
  });
});

describe('the walk is sparser than the busk', () => {
  it('fields fewer voices on the road than in the square', () => {
    expect(modeLayerCount('walking')).toBeLessThan(modeLayerCount('busking'));
  });

  it('asks for materially less music, so arriving at a busk stop is an event', () => {
    expect(musicCeilingGain('walking')).toBeLessThan(musicCeilingGain('busking'));
    expect(walkToBuskRatio()).toBeLessThan(0.8);
    // But not so much less that the road sounds like the game has stopped.
    expect(walkToBuskRatio()).toBeGreaterThan(0.4);
  });

  it('still has the bard on it with the meter on the floor', () => {
    for (const instrument of INSTRUMENTS) {
      for (const dayFraction of [0, 0.3, 0.55, 0.9]) {
        const floor = musicFloorGain(input({ mode: 'walking', drive: 0, instrument, dayFraction }));
        // The drone plus a noodling melody. Silence here is the bug this
        // whole module exists to prevent.
        expect(floor, `${instrument.id} @ ${dayFraction}`).toBeGreaterThan(NOODLE_GAIN * 0.5);
      }
    }
  });

  it('never claims a floor above its own ceiling', () => {
    everyScene((mix) => {
      expect(musicFloorGain(mix)).toBeLessThanOrEqual(musicCeilingGain(mix.mode) + 1e-12);
    });
  });
});
