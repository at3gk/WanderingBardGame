/**
 * The sound of the place you are standing in.
 *
 * The bard's music is the foreground and this is everything behind it: air,
 * wind in whatever the wind has to move through, water if there is water,
 * birds by day and crickets by night. All generated — filtered noise for the
 * beds, short scattered grains for the living things — because six seconds of
 * stereo forest at any usable rate is more bytes than the whole rest of the
 * game, and the CC0-or-procedural rule in CLAUDE.md would make sourcing them
 * a project of its own.
 *
 * ## The shape of this file
 *
 * Two halves, deliberately separated. `ambienceMix` and the day-shape
 * functions decide *which layers are audible and how loud*, given a biome, a
 * point in the day and the weather; they are pure and hold no state, so the
 * whole of the actual design is testable without an AudioContext. The
 * `Ambience` class below is a shell that keeps one noise bed per layer alive
 * and ramps their gains toward whatever the pure half last asked for.
 *
 * ## Why the mix is a target, not a cut
 *
 * A biome band ends at a stated metre on the road and the biome id flips
 * there, but the forest does not stop having leaves in it because the player
 * crossed a line. So `setScene` never assigns a gain; it ramps toward one
 * over `fadeSec` (several seconds), which means the crossfade falls out of
 * the pure mix being a *target* rather than being a special case anyone has
 * to remember to write. The same mechanism carries the slow drift of the day,
 * and the day shape is continuous in `dayFraction` anyway, so nothing about
 * dusk arrives as an event.
 *
 * ## The day
 *
 * `dayFraction` is 0..1 from midnight and wraps, matching the sky's own
 * keyframe parameter (`three/sky.ts`) — high day near 0.55, dawn near 0.3,
 * dusk near 0.9. Every shape below is built from a sine or cosine of that
 * fraction rather than from a table of ranges, because a table has seams and
 * a seam in the ambience is a click in something that is meant to be air.
 */

import { mulberry32, randRange, type Rand } from '../core/rng';
import { VOICE_SILENCE, noiseBuffer } from './instrumentVoice';

/** The biomes this file knows the sound of. Mirrors `core/biome.ts`'s ids. */
export type AmbienceBiomeId = 'village' | 'forest' | 'riverside';

export const AMBIENCE_BIOMES: readonly AmbienceBiomeId[] = ['village', 'forest', 'riverside'];

/**
 * Weather, as much of it as the ambience can hear.
 *
 * Deliberately four coarse states rather than a continuous wetness: the
 * encounters table already speaks of weather in whole moods ("a ring around
 * the moon"), and a slider would invite the mix to be tuned by dragging
 * rather than by deciding.
 */
export type AmbienceWeather = 'clear' | 'breezy' | 'overcast' | 'rain';

export type AmbienceLayerId =
  | 'air'
  | 'wind-open'
  | 'wind-canopy'
  | 'water'
  | 'hearth'
  | 'rain'
  | 'birds'
  | 'crickets'
  | 'owl'
  | 'frogs';

export type GrainVoice = 'chirp' | 'tick' | 'hoot' | 'croak';

export interface GrainDef {
  /** Grains per minute at this layer's full gain, scaled down with it. */
  perMinute: number;
  voice: GrainVoice;
  /** Pitch range, Hz. */
  pitchHz: [number, number];
}

export interface AmbienceLayerDef {
  id: AmbienceLayerId;
  /** A continuous bed of filtered noise, or scattered one-shot grains. */
  kind: 'bed' | 'grain';
  /**
   * Where this layer belongs. A biome outside the list can never hear it, and
   * that is enforced in `ambienceMix` rather than left to each gain formula
   * remembering — a river in the village is the sort of bug that ships.
   */
  biomes: readonly AmbienceBiomeId[];
  /** Layers that are about weather or air rather than about place. */
  everywhere?: boolean;
  /** Gain at this layer's own best moment. Its mix gain never exceeds this. */
  gain: number;
  /**
   * Filter cascade, source into `filters[0]` into `filters[1]` and so on. One
   * biquad lowpass is a 12 dB/octave slope, which leaves a noise bed's corner
   * only lightly attenuated an octave up — plenty of sibilance-band energy
   * survives, and that band is exactly what a listener labels "hiss" rather
   * than "air". Two cascaded stages give 24 dB/octave, steep enough that a
   * filter actually removes a band instead of merely tilting it.
   */
  filters?: readonly FilterSpec[];
  /** Slow amplitude wander as `[rate Hz, depth 0..1]`. Wind is never steady. */
  swell?: [number, number];
  /**
   * Slow wander of the first filter's corner, as `[rate Hz, depth as a
   * fraction of the corner]`. A noise bed behind a fixed filter is
   * spectrally frozen, and the ear identifies a frozen spectrum as a machine
   * within a second or two — real wind changes *colour* as it gusts, not
   * just loudness, so this is what keeps a bed from sounding synthesised.
   */
  sweep?: [number, number];
  grain?: GrainDef;
}

export interface FilterSpec {
  type: BiquadFilterType;
  frequencyHz: number;
  q: number;
}

/** The range the first filter's corner wanders over, `[minHz, maxHz]`. */
export function sweepRangeHz(layer: AmbienceLayerDef): [number, number] {
  const frequencyHz = layer.filters?.[0]?.frequencyHz ?? 0;
  if (!layer.sweep || !layer.filters?.length) return [frequencyHz, frequencyHz];
  const [, depth] = layer.sweep;
  const span = frequencyHz * depth;
  return [frequencyHz - span, frequencyHz + span];
}

/**
 * The catalogue.
 *
 * Filter corners rather than descriptions, because the difference between
 * wind and water is almost entirely where the noise is filtered: wind is a
 * broad low shelf that moves, water is a narrower band an octave up that
 * barely moves at all. Getting those two confused is why so much generated
 * ambience sounds like the same hiss wearing different labels.
 *
 * A retuning pass (the one that added the filter cascades and sweeps below)
 * also pulled every bed and grain layer's `gain` down by roughly a third
 * across the board. The individual filter changes fix *what band* survives;
 * this fixes *how much of it* does — the whole bed was originally mixed to
 * be heard on its own, but its job is to sit deliberately under the music
 * rather than beside it, so the headroom has to be given back deliberately
 * too.
 */
export const AMBIENCE_LAYERS: readonly AmbienceLayerDef[] = [
  {
    id: 'air',
    kind: 'bed',
    biomes: AMBIENCE_BIOMES,
    everywhere: true,
    gain: 0.045,
    // Nobody hears this layer; they hear its absence. The old single-pole
    // lowpass at 220 Hz still passed enough mid content past its shallow
    // 12 dB/octave slope to read as a hiss under everything else, which
    // defeats the point of a layer that is supposed to be inaudible as
    // itself. Below roughly 150 Hz the ear stops parsing pitch and starts
    // reading pressure, so the corner drops to 140 Hz and gets a second
    // identical stage so the rolloff actually means it — 24 dB/octave, not
    // 12.
    filters: [
      { type: 'lowpass', frequencyHz: 140, q: 0.7 },
      { type: 'lowpass', frequencyHz: 140, q: 0.7 },
    ],
    swell: [0.05, 0.25],
  },
  {
    id: 'wind-open',
    kind: 'bed',
    biomes: ['village', 'riverside'],
    gain: 0.06,
    // Wind, at its core, is a low-frequency pressure fluctuation; anything
    // above about a kilohertz in a "wind" bed is really the sound of the
    // object the wind is moving through, and open ground barely has one.
    // Two lowpass stages at 520 Hz keep the bed's top end genuinely gone
    // rather than merely tilted, and the slow sweep of that corner — roughly
    // 312 to 728 Hz on a 23-second cycle — gives the bed the colour change
    // of an actual gust instead of a hiss with a fixed shape.
    filters: [
      { type: 'lowpass', frequencyHz: 520, q: 0.6 },
      { type: 'lowpass', frequencyHz: 520, q: 0.6 },
    ],
    swell: [0.07, 0.55],
    sweep: [0.043, 0.4],
  },
  {
    id: 'wind-canopy',
    kind: 'bed',
    biomes: ['forest'],
    gain: 0.075,
    // The old single bandpass at 1600 Hz Q 0.5 is nearly flat from 800 Hz to
    // 3.2 kHz — three octaves centred squarely on the sibilance band, which
    // is close to a textbook definition of white noise. Leaf rustle needs a
    // defined top edge the way real foliage has one: a tighter band at
    // 1 kHz (Q 0.8) for the rustle itself, then a lowpass at 2.4 kHz so the
    // band's own skirt cannot reopen the top end.
    filters: [
      { type: 'bandpass', frequencyHz: 1000, q: 0.8 },
      { type: 'lowpass', frequencyHz: 2400, q: 0.7 },
    ],
    swell: [0.09, 0.7],
    sweep: [0.055, 0.45],
  },
  {
    id: 'water',
    kind: 'bed',
    biomes: ['riverside'],
    gain: 0.085,
    // The same fault as the old canopy filter, in a different register: a
    // river's audible energy peaks around 400-800 Hz (the bubble resonance
    // of moving water) and falls away quickly above 2 kHz, but a single wide
    // bandpass at 900 Hz Q 0.35 left the top end essentially unfiltered. The
    // highpass at 240 Hz keeps the band out from under the air layer's
    // drone; the lowpass at 1250 Hz gives it the fast-but-not-instant
    // falloff a river actually has above its resonance.
    filters: [
      { type: 'highpass', frequencyHz: 240, q: 0.7 },
      { type: 'lowpass', frequencyHz: 1250, q: 0.7 },
    ],
    // Barely any swell or sweep: a river is the steadiest thing in this
    // catalogue, and giving it wind's breathing or wind's colour change
    // makes it sound like wind.
    swell: [0.13, 0.12],
    sweep: [0.09, 0.18],
  },
  {
    id: 'hearth',
    kind: 'bed',
    biomes: ['village'],
    gain: 0.05,
    // Voices and doors and a dog, heard from far enough away that all that
    // survives is a low murmur with a slow shape to it. The added highpass
    // at 90 Hz keeps this layer's own low end from crowding the air layer's
    // drone, which shares that register; the lowpass at 380 Hz (Q 1.0, a
    // gentle resonant lift right at the corner) is what turns filtered noise
    // into something that reads as distant speech rather than distant
    // static.
    filters: [
      { type: 'highpass', frequencyHz: 90, q: 0.7 },
      { type: 'lowpass', frequencyHz: 380, q: 1.0 },
    ],
    swell: [0.16, 0.45],
    sweep: [0.11, 0.25],
  },
  {
    id: 'rain',
    kind: 'bed',
    biomes: AMBIENCE_BIOMES,
    everywhere: true,
    gain: 0.09,
    // The worst offender in the old catalogue: a bare highpass at 800 Hz
    // leaves the entire 8-20 kHz band sitting at full level, and full-level
    // energy above 8 kHz is precisely the signature the ear calls static.
    // Rain heard from any real distance has its energy concentrated between
    // roughly 1 and 5 kHz and essentially nothing above 8 kHz, so the
    // highpass moves down to 600 Hz — which still keeps it out of the low
    // end — and a lowpass at 4.2 kHz finally does the shaping the old single
    // filter never did.
    filters: [
      { type: 'highpass', frequencyHz: 600, q: 0.7 },
      { type: 'lowpass', frequencyHz: 4200, q: 0.7 },
    ],
    swell: [0.05, 0.2],
    sweep: [0.05, 0.15],
  },
  {
    id: 'birds',
    kind: 'grain',
    biomes: ['village', 'forest'],
    gain: 0.07,
    grain: { perMinute: 26, voice: 'chirp', pitchHz: [1800, 3400] },
  },
  {
    id: 'crickets',
    kind: 'grain',
    biomes: AMBIENCE_BIOMES,
    gain: 0.05,
    // The old 3.8-5.2 kHz range sits in the ear's single most sensitive
    // band and is piercing enough, night after night, to read as tinnitus
    // rather than wildlife. Real field crickets sing nearer 3-4 kHz; the
    // range moves down to match and lands comfortably clear of the top-end
    // static the rest of this pass is trying to remove.
    grain: { perMinute: 70, voice: 'tick', pitchHz: [3000, 4200] },
  },
  {
    id: 'owl',
    kind: 'grain',
    biomes: ['forest', 'riverside'],
    gain: 0.055,
    // Rare on purpose. An owl every ten seconds is a menagerie; an owl twice
    // a minute is a wood at night.
    grain: { perMinute: 2.2, voice: 'hoot', pitchHz: [330, 460] },
  },
  {
    id: 'frogs',
    kind: 'grain',
    biomes: ['riverside'],
    gain: 0.05,
    grain: { perMinute: 24, voice: 'croak', pitchHz: [180, 300] },
  },
];

export type AmbienceMix = Record<AmbienceLayerId, number>;

export interface AmbienceInput {
  biomeId: string;
  /** 0..1 from midnight, wrapping. Same parameter the sky is keyed on. */
  dayFraction: number;
  weather: AmbienceWeather;
}

/** How the day is doing, as four smooth, wrapping, overlapping shapes. */
export interface DayShape {
  /** 0 in the dark, 1 at high day. */
  daylight: number;
  night: number;
  /** Peaks at dawn and at dusk, zero at noon and midnight. */
  twilight: number;
  /** Peaks at dawn, zero through the afternoon and the small hours. */
  morning: number;
  /** Peaks at golden hour. */
  evening: number;
}

/** Where the sun is highest, in `dayFraction`. Matches `three/sky.ts`'s keys. */
const NOON_FRACTION = 0.55;

export function dayShape(dayFraction: number): DayShape {
  const phase = 2 * Math.PI * (wrap01(dayFraction) - NOON_FRACTION);
  // Smoothstepped rather than used raw so that the sun spends most of the day
  // fully up and most of the night fully down, with the transition where the
  // sky keys put dawn and dusk, instead of the whole day being a slow slope.
  const daylight = smoothstep(-0.75, 0.35, Math.cos(phase));
  const night = 1 - daylight;
  // The derivative of the daylight curve, split into its two signs: rising
  // before noon, falling after. Free continuity, and no ranges to seam.
  const morning = clamp01(-Math.sin(phase));
  const evening = clamp01(Math.sin(phase));
  return { daylight, night, twilight: 4 * daylight * night, morning, evening };
}

/** Weather, reduced to the two numbers the layers actually ask about. */
function weatherShape(weather: AmbienceWeather): { wind: number; wet: number } {
  switch (weather) {
    case 'breezy':
      return { wind: 1, wet: 0 };
    case 'overcast':
      return { wind: 0.55, wet: 0 };
    case 'rain':
      return { wind: 0.7, wet: 1 };
    case 'clear':
    default:
      return { wind: 0.35, wet: 0 };
  }
}

/**
 * The bed each layer should be heading toward.
 *
 * Every formula below returns a factor in 0..1 which is then multiplied by
 * the layer's declared gain, so a layer can never be louder than the
 * catalogue says it can be — that invariant is what makes the sum of the mix
 * predictable without every combination having to be auditioned.
 *
 * An unrecognised biome id keeps only the layers marked `everywhere`. That is
 * the honest answer for a place this file has never heard of: air, and
 * whatever the weather is doing.
 */
export function ambienceMix(input: AmbienceInput): AmbienceMix {
  const day = dayShape(input.dayFraction);
  const { wind, wet } = weatherShape(input.weather);
  const biome = input.biomeId as AmbienceBiomeId;

  const mix = {} as AmbienceMix;
  for (const layer of AMBIENCE_LAYERS) {
    const belongs = layer.everywhere === true || layer.biomes.includes(biome);
    mix[layer.id] = belongs ? layer.gain * clamp01(factorFor(layer.id, day, wind, wet)) : 0;
  }
  return mix;
}

function factorFor(id: AmbienceLayerId, day: DayShape, wind: number, wet: number): number {
  switch (id) {
    case 'air':
      return 0.85 + 0.15 * day.night;
    case 'wind-open':
    case 'wind-canopy':
      // Wind drops away after dark far more than people expect, and a night
      // that keeps its daytime wind never settles into being night.
      return wind * (0.55 + 0.45 * day.daylight);
    case 'water':
      return 0.8 + 0.2 * wet;
    case 'hearth':
      // Quiet market murmur by day, the whole village indoors by night.
      return 0.35 + 0.65 * day.night;
    case 'rain':
      return wet;
    case 'birds':
      // The dawn chorus is a real thing and it is the single most evocative
      // fact about birdsong, so morning weighs more than the plain fact of
      // it being light.
      return day.daylight * (0.45 + 0.55 * day.morning) * (1 - 0.85 * wet);
    case 'crickets':
      return day.night * (0.6 + 0.4 * day.evening) * (1 - 0.9 * wet);
    case 'owl':
      return day.night * (1 - 0.6 * wet);
    case 'frogs':
      // Frogs keep the twilight either side of the night, and rain suits them.
      return clamp01(day.night * 0.75 + day.twilight * 0.35) * (0.7 + 0.3 * wet);
  }
}

/**
 * Linear blend of two mixes.
 *
 * Offered for callers that know the width of a crossfade better than this
 * file does — a biome seam on the road is a stated distance, and blending
 * across it explicitly is more honest than letting a fixed-time ramp guess.
 * The `Ambience` shell does not use this; it ramps in time instead.
 */
export function blendMixes(from: AmbienceMix, to: AmbienceMix, t: number): AmbienceMix {
  const k = clamp01(t);
  const mix = {} as AmbienceMix;
  for (const layer of AMBIENCE_LAYERS) {
    mix[layer.id] = from[layer.id] + (to[layer.id] - from[layer.id]) * k;
  }
  return mix;
}

/** Total level of a mix. Used to check the beds never pile up over the music. */
export function mixTotal(mix: AmbienceMix): number {
  let total = 0;
  for (const layer of AMBIENCE_LAYERS) total += mix[layer.id];
  return total;
}

export interface AmbienceOptions {
  /** Seconds a layer takes to reach a new target. Never zero; never a cut. */
  fadeSec?: number;
  /**
   * Seed for grain scatter. Fixed by default so a scene sounds the same shape
   * every time rather than rolling `Math.random` per call — not a reproducible
   * sequence, since how many draws each `update` takes depends on the frame
   * cadence. Nothing shared depends on these; the road's determinism lives in
   * `core/rng.ts`.
   */
  seed?: number;
  /** Overall level for the whole bed, under the music. */
  masterGain?: number;
}

const DEFAULT_FADE_SEC = 6;
/** How far ahead grains are handed to the audio clock. */
const GRAIN_LOOKAHEAD_SEC = 1.5;
/** Below this a grain layer is inaudible and not worth scheduling. */
const GRAIN_FLOOR = 0.004;

interface BedNodes {
  gain: GainNode;
  source: AudioBufferSourceNode;
  swell: OscillatorNode | null;
  sweep: OscillatorNode | null;
  nodes: AudioNode[];
}

/**
 * The node shell.
 *
 * Owns one permanently running noise bed per bed layer and a gain node per
 * grain layer. Beds are created once and never torn down while the scene
 * lives: starting a noise source is a discontinuity, and starting one every
 * time the player walks back into the forest would put a soft thump on every
 * biome seam.
 */
export class Ambience {
  private master: GainNode;
  private beds = new Map<AmbienceLayerId, BedNodes>();
  private grainGains = new Map<AmbienceLayerId, GainNode>();
  private mix: AmbienceMix;
  private nextGrainSec = new Map<AmbienceLayerId, number>();
  private rand: Rand;
  private fadeSec: number;
  private disposed = false;
  /** Last value requested of `setMasterGain`, including the constructor's. */
  private masterGainTarget: number;

  constructor(
    private ctx: AudioContext,
    destination: AudioNode,
    options: AmbienceOptions = {}
  ) {
    this.fadeSec = Math.max(0.25, options.fadeSec ?? DEFAULT_FADE_SEC);
    this.rand = mulberry32(options.seed ?? 0x5eed1e);
    this.master = ctx.createGain();
    this.masterGainTarget = clamp01(options.masterGain ?? 1);
    this.master.gain.value = this.masterGainTarget;
    this.master.connect(destination);

    this.mix = silentMix();
    const now = ctx.currentTime;
    for (const layer of AMBIENCE_LAYERS) {
      if (layer.kind === 'bed') {
        this.beds.set(layer.id, this.createBed(layer, now));
      } else {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.master);
        this.grainGains.set(layer.id, gain);
        // Staggered so that every grain layer coming up at once does not fire
        // its first grain on the same frame.
        this.nextGrainSec.set(layer.id, now + randRange(this.rand, 0.5, 3));
      }
    }
  }

  /** Head toward the mix this scene calls for. Safe to call every frame. */
  setScene(input: AmbienceInput): void {
    this.setMix(ambienceMix(input));
  }

  /** Head toward an explicit mix — for callers doing their own crossfade. */
  setMix(target: AmbienceMix): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    for (const layer of AMBIENCE_LAYERS) {
      const next = target[layer.id];
      // Re-ramping an unchanged target every frame would restart the fade
      // every frame and freeze each layer near its starting value.
      if (Math.abs(next - this.mix[layer.id]) < 1e-4) continue;
      this.mix[layer.id] = next;
      const param = layer.kind === 'bed' ? this.beds.get(layer.id)?.gain.gain : this.grainGains.get(layer.id)?.gain;
      if (!param) continue;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(next, now + this.fadeSec);
    }
  }

  /**
   * Move the whole bed's level. The mix module decides this value per frame
   * from how full the arrangement is: when the band fills its register the
   * bed should duck out from underneath it, and when the arrangement thins
   * the bed should breathe back up. This method only moves the number — the
   * decision of what to ask for lives outside this file, so `ambience.ts`
   * stays a shell that has never had to know what "full" means. Guarded the
   * same way `setMix` guards each layer, since the mix module is expected to
   * call this every frame regardless of whether the value actually moved.
   */
  setMasterGain(value: number, rampSec = 1.5): void {
    if (this.disposed) return;
    const next = clamp01(value);
    if (Math.abs(next - this.masterGainTarget) < 1e-4) return;
    this.masterGainTarget = next;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(next, now + rampSec);
  }

  /**
   * Schedule the next second or so of grains. Call once a frame with the
   * audio clock; it is cheap and idempotent between grain times.
   */
  update(nowSec: number): void {
    if (this.disposed) return;
    const horizon = nowSec + GRAIN_LOOKAHEAD_SEC;
    for (const layer of AMBIENCE_LAYERS) {
      if (layer.kind !== 'grain' || !layer.grain) continue;
      const destination = this.grainGains.get(layer.id);
      if (!destination) continue;
      const level = this.mix[layer.id];
      let next = this.nextGrainSec.get(layer.id) ?? nowSec;
      if (level < GRAIN_FLOOR) {
        // Keep the clock moving while the layer is silent. Otherwise a night
        // spent walking would leave an hour of owl calls in the past, and
        // they would all arrive at once at the next dusk.
        this.nextGrainSec.set(layer.id, Math.max(next, nowSec));
        continue;
      }
      // Rate falls with level, so a layer fading out thins out as well as
      // getting quieter — which is what actually reads as dawn.
      const meanGapSec = (60 / layer.grain.perMinute) * (layer.gain / level);
      while (next < horizon) {
        if (next >= nowSec) playGrain(this.ctx, destination, layer.grain, this.rand, next);
        next += meanGapSec * randRange(this.rand, 0.45, 1.75);
      }
      this.nextGrainSec.set(layer.id, next);
    }
  }

  /** Stop everything and let it be collected. The instance is spent after this. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, VOICE_SILENCE), now);
    // Fade the whole bed out before pulling it apart. Cutting a running noise
    // source is an audible thump, and this is the sound of the outdoors.
    this.master.gain.exponentialRampToValueAtTime(VOICE_SILENCE, now + 0.4);
    for (const bed of this.beds.values()) {
      try {
        bed.source.stop(now + 0.45);
        bed.swell?.stop(now + 0.45);
        bed.sweep?.stop(now + 0.45);
      } catch {
        // Already stopped; there is nothing left to silence.
      }
      bed.source.onended = () => {
        for (const node of bed.nodes) node.disconnect();
      };
    }
    // Held rather than disconnected here. The grain gains feed the master, so
    // the fade above already covers them; cutting them loose now would take an
    // owl mid-hoot off the fade and produce exactly the thump the line above
    // exists to avoid.
    const grainGains = [...this.grainGains.values()];
    this.beds.clear();
    this.grainGains.clear();
    // Grains already scheduled clean up after themselves; the master hangs on
    // until they have, then goes.
    window.setTimeout(() => {
      for (const gain of grainGains) gain.disconnect();
      this.master.disconnect();
    }, 2000);
  }

  private createBed(layer: AmbienceLayerDef, nowSec: number): BedNodes {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    source.loop = true;
    // Detuning the loop so its two-second period is not a two-second period
    // any more; an unpitched loop still betrays itself by repeating.
    source.playbackRate.value = randRange(this.rand, 0.85, 1.15);

    const nodes: AudioNode[] = [gain];
    let tail: AudioNode = source;
    const filters: BiquadFilterNode[] = [];
    for (const spec of layer.filters ?? []) {
      const filter = ctx.createBiquadFilter();
      filter.type = spec.type;
      filter.frequency.value = spec.frequencyHz;
      filter.Q.value = spec.q;
      tail.connect(filter);
      nodes.push(filter);
      tail = filter;
      filters.push(filter);
    }

    let swell: OscillatorNode | null = null;
    if (layer.swell) {
      const [rateHz, depth] = layer.swell;
      // The swell rides a *second* gain rather than modulating the layer's
      // own, so `setScene` can own one parameter outright and never have to
      // unpick a fade from a gust.
      const swellGain = ctx.createGain();
      swellGain.gain.value = 1 - depth;
      swell = ctx.createOscillator();
      swell.type = 'sine';
      swell.frequency.value = rateHz;
      const depthGain = ctx.createGain();
      depthGain.gain.value = depth;
      swell.connect(depthGain).connect(swellGain.gain);
      swell.start(nowSec + this.rand());
      tail.connect(swellGain);
      nodes.push(swellGain, depthGain);
      tail = swellGain;
    }

    let sweep: OscillatorNode | null = null;
    if (layer.sweep && filters.length > 0) {
      const [rateHz, depth] = layer.sweep;
      const firstFilter = filters[0];
      // Modulates the corner frequency directly, in parallel with the swell
      // modulating level — spectral movement and amplitude movement are two
      // different things and wind needs both, not one standing in for the
      // other. Random start phase (up to 8 seconds in) so two beds sharing a
      // scene never gust in lockstep.
      const sweepDepthGain = ctx.createGain();
      sweepDepthGain.gain.value = firstFilter.frequency.value * depth;
      sweep = ctx.createOscillator();
      sweep.type = 'sine';
      sweep.frequency.value = rateHz;
      sweep.connect(sweepDepthGain).connect(firstFilter.frequency);
      sweep.start(nowSec + this.rand() * 8);
      nodes.push(sweepDepthGain);
    }

    tail.connect(gain);
    source.start(nowSec, this.rand() * 1.5);
    return { gain, source, swell, sweep, nodes };
  }
}

/**
 * One bird, one cricket, one owl, one frog.
 *
 * Each is a handful of oscillators or a noise burst with a shaped envelope,
 * and each cleans itself up on `onended`. The pitch and timing jitter come
 * from the caller's generator so that a whole night of owls is reproducible
 * from a seed rather than being a fresh roll of `Math.random` every call.
 */
function playGrain(ctx: AudioContext, destination: AudioNode, grain: GrainDef, rand: Rand, whenSec: number): void {
  const [lowHz, highHz] = grain.pitchHz;
  const pitchHz = randRange(rand, lowHz, highHz);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  let endSec = whenSec;

  const blip = (
    startSec: number,
    durationSec: number,
    fromHz: number,
    toHz: number,
    level: number,
    attackFraction: number
  ): void => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, startSec);
    // Exponential rather than linear, because pitch is heard logarithmically
    // and a linear glide over an octave lands late and sounds mechanical.
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 20), startSec + durationSec);
    const env = ctx.createGain();
    const attackSec = Math.max(0.004, durationSec * attackFraction);
    env.gain.setValueAtTime(0, startSec);
    env.gain.linearRampToValueAtTime(level, startSec + attackSec);
    env.gain.exponentialRampToValueAtTime(VOICE_SILENCE, startSec + durationSec);
    env.gain.setValueAtTime(0, startSec + durationSec);
    osc.connect(env).connect(destination);
    osc.start(startSec);
    sources.push(osc);
    nodes.push(env);
    endSec = Math.max(endSec, startSec + durationSec);
  };

  const burst = (startSec: number, durationSec: number, centreHz: number, q: number, level: number): void => {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = centreHz;
    band.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startSec);
    env.gain.linearRampToValueAtTime(level, startSec + durationSec * 0.25);
    env.gain.exponentialRampToValueAtTime(VOICE_SILENCE, startSec + durationSec);
    env.gain.setValueAtTime(0, startSec + durationSec);
    noise.connect(band).connect(env).connect(destination);
    noise.start(startSec, rand() * 1.5);
    sources.push(noise);
    nodes.push(band, env);
    endSec = Math.max(endSec, startSec + durationSec);
  };

  switch (grain.voice) {
    case 'chirp': {
      // Two to four notes with a glide on each. A single blip reads as an
      // electronic beep; the little phrase is what makes it a bird.
      const notes = 2 + Math.floor(rand() * 3);
      let at = whenSec;
      for (let i = 0; i < notes; i++) {
        const durationSec = randRange(rand, 0.045, 0.09);
        const glide = randRange(rand, 0.75, 1.35);
        blip(at, durationSec, pitchHz, pitchHz * glide, randRange(rand, 0.35, 0.7), 0.25);
        at += durationSec + randRange(rand, 0.03, 0.08);
      }
      break;
    }
    case 'tick': {
      const pulses = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < pulses; i++) {
        burst(whenSec + i * 0.028, 0.014, pitchHz, 12, 0.5);
      }
      break;
    }
    case 'hoot': {
      // Two soft calls, the second a little lower, with a slow attack. An owl
      // with a fast attack is a synthesiser.
      blip(whenSec, 0.42, pitchHz, pitchHz * 0.97, 0.55, 0.35);
      blip(whenSec + 0.62, 0.5, pitchHz * 0.94, pitchHz * 0.9, 0.45, 0.35);
      break;
    }
    case 'croak': {
      blip(whenSec, 0.11, pitchHz, pitchHz * 0.85, 0.4, 0.15);
      burst(whenSec, 0.13, pitchHz * 2.4, 3, 0.35);
      break;
    }
  }

  let pending = sources.length;
  const teardown = (): void => {
    pending -= 1;
    if (pending > 0) return;
    for (const node of nodes) node.disconnect();
    for (const source of sources) source.disconnect();
  };
  for (const source of sources) {
    source.onended = teardown;
    source.stop(endSec + 0.02);
  }
}

function silentMix(): AmbienceMix {
  const mix = {} as AmbienceMix;
  for (const layer of AMBIENCE_LAYERS) mix[layer.id] = 0;
  return mix;
}

/** Non-finite fractions become midnight rather than NaN spreading into a gain. */
function wrap01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
