/**
 * Who is louder than whom.
 *
 * This file exists because of a bug that took a human listening to the live
 * game to catch: the walk sounded like white noise. Every individual piece
 * was defensible — the beds were quiet, the arrangement was careful — but
 * nothing anywhere owned the *relationship* between them, and during the walk
 * the arrangement was not running at all, so the only relationship that
 * mattered was ambience-to-silence. A game about a bard whose default
 * soundscape is filtered noise is broken by definition (DESIGN.md, "the walk
 * is played, not watched").
 *
 * So: one small module that states the mix as arithmetic, and a test file
 * that holds it to that arithmetic at every point in the day, at every meter,
 * in every biome, in every weather, on every instrument. The claim "ambience
 * sits under music" is otherwise unfalsifiable — nobody can audition four
 * thousand combinations, and the one that goes wrong will be the one nobody
 * thought to try.
 *
 * ## The two buses
 *
 * The music bus carries the bard's own notes and the adaptive backing. The
 * ambience bus carries the beds and the grains. Both feed the master. The
 * music bus is the *reference* — it is fixed at 1 and never moves — and every
 * other level in the game is stated as a fraction of it. That is the whole
 * trick: a mix with a moving reference is a mix nobody can reason about, and
 * two gains that both drift are two gains that will eventually cross.
 *
 * ## Why the ambience ducks at all
 *
 * A fixed ambience level has to be chosen for the loudest moment the music
 * ever reaches, which leaves the world inaudible for the ninety per cent of
 * the time the music is quieter than that. So the bed moves — down as the
 * arrangement fills out, up when the bard stops playing and stands there.
 * That last part is the point: the moment the player stops tapping is the
 * moment the road is supposed to be the loudest thing, and it comes for free
 * from a duck keyed on how full the band is.
 *
 * Everything here is a pure function of the scene. No nodes, no clock.
 */

import type { Instrument } from '../core/instruments';
import {
  type AdaptiveMode,
  adaptiveProfile,
  guaranteedTotal,
  modeCeilingTotal,
} from './adaptive';
import { type AmbienceMix, type AmbienceWeather, ambienceMix, mixTotal } from './ambience';

/**
 * The reference. Everything below is a fraction of this, and it is 1 so that
 * "a fraction of the music bus" and "the number you type" are the same thing.
 */
export const MUSIC_BUS_GAIN = 1;

/**
 * The hard ceiling on the ambience bus, as a fraction of the music bus.
 *
 * Six decibels under is the difference between a background and a foreground.
 * This is a *cap*, not a target — `ambienceBusGain` is normally well below it
 * — and it is stated separately from the base level so the invariant test can
 * assert the relationship rather than assert a number, and so that raising
 * the base level later cannot silently raise the ceiling with it.
 */
export const AMBIENCE_MUSIC_RATIO = 0.5;

/**
 * The ambience bus with nothing playing over it.
 *
 * Chosen against the beds rather than in the abstract: `ambience.ts`'s worst
 * case (riverside, rain, after dark) sums to about 0.31, so this puts the
 * whole outdoors around a tenth of the music bus at its loudest, and the beds
 * are uncorrelated noise so they sum in power rather than in amplitude and
 * arrive quieter still. Deliberately under the ratio cap with room to spare:
 * the cap is a proof, not a design.
 */
export const AMBIENCE_BUS_BASE = 0.34;

/** How much of the ambience a completely full arrangement takes away. */
export const AMBIENCE_DUCK_DEPTH = 0.45;

/**
 * Level the bard's own notes sound at when the tune is being kept.
 *
 * The loudest thing in the game, and it should be: the player pressed a
 * button and a note came out, and everything else in the mix is a response to
 * that. Matches the value the busk scene has always used.
 */
export const MELODY_GAIN = 0.22;

/**
 * Level the bard noodles at with the meter on the floor.
 *
 * DESIGN.md: stop playing and the bard "slows to a stop and noodles quietly
 * in place — no fail, no punishment". Quietly is the operative word, and the
 * gap between this and `MELODY_GAIN` is the only volume change in the game
 * that tracks a stat continuously. It is allowed to, because it is not the
 * arrangement — it is one person playing more softly to themselves than they
 * would to a road, which is a thing people actually do.
 */
export const NOODLE_GAIN = 0.1;

/**
 * Fraction of the time some part of the melody is sounding.
 *
 * The melody is notes, not a bed, so counting its peak level as though it
 * were continuous would overstate the music and let the ambience sit higher
 * than it should. Half is the honest figure for the songbook: quarters and
 * halves at walking tempo, on instruments whose ring carries past the written
 * length, with rests written in.
 */
const MELODY_DUTY = 0.5;

export interface MixInput {
  mode: AdaptiveMode;
  /** 0..1. The walk's song meter, or the crowd's warmth. See `adaptiveDrive`. */
  drive: number;
  instrument: Instrument;
  /** 0..1 from midnight, wrapping. Same parameter the sky is keyed on. */
  dayFraction: number;
  biomeId: string;
  weather: AmbienceWeather;
}

/** The reference bus. A function so callers never hard-code the constant. */
export function musicBusGain(): number {
  return MUSIC_BUS_GAIN;
}

/**
 * Level one played note should be given, in this mode at this drive.
 *
 * Hand this straight to `playVoiceNote`'s `gain` option. Smoothstepped rather
 * than linear so that a meter hovering near zero — which is exactly where a
 * struggling player's meter hovers — does not put a tremolo on the melody.
 */
export function melodyGain(mode: AdaptiveMode, drive: number): number {
  if (mode !== 'walking') return MELODY_GAIN;
  return NOODLE_GAIN + (MELODY_GAIN - NOODLE_GAIN) * smoothstep(0, 0.35, clamp01(drive));
}

/**
 * The level the music is never quieter than, right now.
 *
 * Only the layers whose thresholds this drive has actually cleared, plus the
 * melody's continuous share. Hysteresis means the real arrangement is almost
 * always fuller than this — a layer that has joined stays joined through a
 * bad phrase — so pinning the ambience to this floor is conservative in the
 * direction that matters. A floor derived from the live `AdaptiveState`
 * instead would make the ambience level a function of the arrangement's
 * history, and the bed would breathe every time a layer came and went.
 */
export function musicFloorGain(input: MixInput): number {
  const backing = guaranteedTotal(input.mode, input.drive, input.instrument, input.dayFraction);
  return backing + melodyGain(input.mode, input.drive) * MELODY_DUTY;
}

/**
 * How full the band is, 0..1.
 *
 * A function of the drive rather than of the state, for the same reason the
 * floor is: this multiplies the ambience level, and an ambience that stepped
 * every time a layer crossed a threshold would announce the threshold.
 * Walking is halved because a walking arrangement at full meter is still only
 * three of five layers at 62% — it should not duck the world as hard as a
 * square full of people does.
 */
export function arrangementFullness(mode: AdaptiveMode, drive: number): number {
  const level = clamp01(drive);
  return mode === 'walking' ? level * 0.5 : level;
}

/**
 * Where the whole ambience bed should sit.
 *
 * `min` with the ratio cap rather than trusting the base constant, so that
 * the invariant holds by construction: no future retune of `AMBIENCE_BUS_BASE`
 * can breach the ceiling without someone also editing the ceiling, which is a
 * decision rather than an accident.
 */
export function ambienceBusGain(input: MixInput): number {
  const cap = AMBIENCE_MUSIC_RATIO * MUSIC_BUS_GAIN;
  const ducked = 1 - AMBIENCE_DUCK_DEPTH * arrangementFullness(input.mode, input.drive);
  const gain = Math.min(AMBIENCE_BUS_BASE, cap) * ducked;
  return Number.isFinite(gain) ? Math.max(0, gain) : 0;
}

/** Every ambience layer at the level it will actually be heard at. */
export function ambienceLayerLevels(input: MixInput): AmbienceMix {
  const bus = ambienceBusGain(input);
  const mix = ambienceMix({ biomeId: input.biomeId, dayFraction: input.dayFraction, weather: input.weather });
  const levels = {} as AmbienceMix;
  for (const id of Object.keys(mix) as Array<keyof AmbienceMix>) levels[id] = mix[id] * bus;
  return levels;
}

/**
 * The loudest single thing the outdoors is doing.
 *
 * The invariant that actually protects the ear is per-layer, not on the sum:
 * a listener does not hear "the total of six noise beds", they hear whichever
 * one is in front. `mix.test.ts` holds this under `musicFloorGain` everywhere
 * — no one bed is ever as loud as the drone that is always under the bard.
 */
export function loudestAmbienceLayer(input: MixInput): number {
  const levels = ambienceLayerLevels(input);
  let loudest = 0;
  for (const id of Object.keys(levels) as Array<keyof AmbienceMix>) {
    loudest = Math.max(loudest, levels[id]);
  }
  return loudest;
}

/** The whole bed, summed, at the level it will be heard at. */
export function ambienceTotalLevel(input: MixInput): number {
  return (
    mixTotal(ambienceMix({ biomeId: input.biomeId, dayFraction: input.dayFraction, weather: input.weather })) *
    ambienceBusGain(input)
  );
}

/**
 * The most the music can be asking for in this mode, melody included.
 *
 * The other end of the range from `musicFloorGain`, and the number to reach
 * for when deciding whether a new sound has room. Uses the mode's ceiling
 * rather than the live arrangement so it is a genuine bound.
 */
export function musicCeilingGain(mode: AdaptiveMode): number {
  return modeCeilingTotal(mode) + MELODY_GAIN;
}

/**
 * How much sparser the walk is than the busk, as a ratio of ceilings.
 *
 * A readout for the tests, which assert the walk is materially thinner rather
 * than merely different — that gap is what makes arriving at a busk stop feel
 * like arriving somewhere.
 */
export function walkToBuskRatio(): number {
  return musicCeilingGain('walking') / musicCeilingGain('busking');
}

/** How many layers a mode can field. Exposed for the integration doc's sake. */
export function modeLayerCount(mode: AdaptiveMode): number {
  return adaptiveProfile(mode).maxLayers;
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
