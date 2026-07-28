/**
 * The backing that joins in.
 *
 * The bard plays; a crowd warms up; and as it warms, more of the tune is
 * there than the bard is playing. That is the whole illusion this file is
 * responsible for, and it lives or dies on two decisions that are easy to get
 * wrong and impossible to hear yourself getting wrong.
 *
 * **A layer's level does not track warmth.** Once a layer is in, it plays at
 * its own settled gain and stays there. The obvious implementation — every
 * layer's gain is some curve of `warmth` — is a volume slider wired to a
 * stat: it swells and ducks with every hit and miss, it never sounds like
 * anyone made a decision, and a player can hear that it is a readout. Warmth
 * decides *membership* only. Nothing else about the mix moves with it.
 *
 * **Joining and leaving are not symmetric.** A layer arrives when warmth
 * crosses its threshold, on the next bar line, over a couple of seconds. It
 * leaves only after warmth has sat *well below* a lower threshold for the
 * better part of ten seconds, and then it takes twice as long to go as it
 * took to arrive. So a fumbled phrase costs nothing, a bad half-minute costs
 * the top of the arrangement, and nothing about it feels like a punishment.
 * The hysteresis gap and the patience are the difference between adaptive
 * music and a mixer automated by a health bar.
 *
 * Everything here is pure: `updateAdaptive` takes the previous state and the
 * current signals and returns the next state plus a list of ramps for the
 * caller to schedule. It creates no nodes and reads no clock — `nowSec` is
 * passed in, and it is an `AudioContext.currentTime`, because a layer that
 * enters on a bar line has to enter on the *audio* clock's idea of that bar.
 */

import type { Instrument, InstrumentVoice } from '../core/instruments';
import { dayShape } from './ambience';
import { voiceInharmonicity, voiceRingSec } from './instrumentVoice';

export type AdaptiveLayerId = 'drone' | 'pulse' | 'harmony' | 'counter' | 'shimmer';

export interface AdaptiveLayerDef {
  id: AdaptiveLayerId;
  /** Warmth at or above which this layer wants to join. */
  enterAt: number;
  /** Warmth below which it begins to consider leaving. Always well under `enterAt`. */
  leaveAt: number;
  /** Seconds of continuous cold before it actually goes. */
  patienceSec: number;
  fadeInSec: number;
  /** Always longer than `fadeInSec`. Leaving is the quiet half of this file. */
  fadeOutSec: number;
  /** Settled level once in. Not a function of warmth; see the header. */
  gain: number;
  /**
   * Transposition from the biome's drone root, in semitones. Octaves and
   * fourths only, and the roots below are chosen to match, so that every
   * pitch this file can sound is a C, a D or a G. See `BIOME_DRONE_SEMITONE`
   * for why that particular set.
   */
  semitoneOffset: number;
}

/**
 * Five layers, ordered as a crowd actually assembles: someone humming a
 * drone, then a foot, then a second voice, then somebody who can really play,
 * and finally the thing on top that only happens when a room is going well.
 *
 * Thresholds rise and patience *falls* up the stack, so that a room cooling
 * loses its sparkle first and its foot-tapping last. Losing the drone before
 * the shimmer would read as the arrangement collapsing rather than as the
 * evening winding down — and the drone never leaves at all, because there is
 * always at least the bard.
 */
export const ADAPTIVE_LAYERS: readonly AdaptiveLayerDef[] = [
  { id: 'drone', enterAt: 0, leaveAt: -1, patienceSec: 0, fadeInSec: 3, fadeOutSec: 8, gain: 0.16, semitoneOffset: -12 },
  { id: 'pulse', enterAt: 0.2, leaveAt: 0.08, patienceSec: 8, fadeInSec: 1.6, fadeOutSec: 5, gain: 0.13, semitoneOffset: -12 },
  { id: 'harmony', enterAt: 0.42, leaveAt: 0.28, patienceSec: 7, fadeInSec: 2, fadeOutSec: 6, gain: 0.12, semitoneOffset: -5 },
  { id: 'counter', enterAt: 0.64, leaveAt: 0.48, patienceSec: 6, fadeInSec: 2.4, fadeOutSec: 7, gain: 0.11, semitoneOffset: 0 },
  { id: 'shimmer', enterAt: 0.84, leaveAt: 0.66, patienceSec: 5, fadeInSec: 3, fadeOutSec: 9, gain: 0.07, semitoneOffset: 12 },
];

/**
 * Where each biome's drone sits.
 *
 * The songbook is C major in the village, G major in the forest and C major
 * an octave up at the riverside (DESIGN.md, "The curriculum is the
 * songbook"), with one tune centred on F. Taken with the layer offsets above,
 * these roots make every pitch the backing can sound a C, a D or a G — the
 * three notes that are naturals in all of C, G and F major, so the backing
 * can never sit a semitone off a melody a child is being taught to read, and
 * no arrangement of biome and tune needs a key signature to explain itself.
 *
 * The temptation is to give each biome a more characterful mode. It is not
 * worth it: DESIGN.md's rule that the notation is never allowed to be
 * musically wrong applies to what sounds underneath the notation too, and a
 * clash there would be blamed on the child rather than on this table.
 */
const BIOME_DRONE_SEMITONE: Record<string, number> = {
  village: 0,
  forest: 7,
  riverside: 12,
};

/** Lead time on a bar entry, so the caller has something to schedule against. */
export const BAR_LEAD_SEC = 0.08;

/** Gain changes smaller than this are not worth a ramp. */
const GAIN_EPSILON = 0.005;

export interface AdaptiveInput {
  /** How warmed-up the crowd is, 0..1. The only signal that decides membership. */
  warmth: number;
  biomeId: string;
  instrument: Instrument;
  /** 0..1 from midnight, wrapping. Same parameter the sky is keyed on. */
  dayFraction: number;
  /** Audio-clock seconds. Never a wall clock. */
  nowSec: number;
  /** Length of one bar, seconds. */
  barSec: number;
  /** Audio-clock time of any bar line; bars fall at `barAnchorSec + n * barSec`. */
  barAnchorSec: number;
}

export interface AdaptiveCommand {
  id: AdaptiveLayerId;
  /** Where this layer's gain should end up. 0 means it is leaving. */
  targetGain: number;
  /** Audio-clock time the ramp should begin. Always a bar line. */
  startAtSec: number;
  /** Seconds the ramp should take. Never zero — nothing here cuts. */
  rampSec: number;
  /** Semitones from the biome's drone root. */
  semitoneOffset: number;
}

interface LayerState {
  /** Whether the layer is in the arrangement, ignoring how far its fade has got. */
  present: boolean;
  /** Audio-clock time warmth first fell below `leaveAt` and stayed there. */
  coldSinceSec: number | null;
  targetGain: number;
  startAtSec: number;
  rampSec: number;
  semitoneOffset: number;
}

export interface AdaptiveState {
  layers: Record<AdaptiveLayerId, LayerState>;
  lastSec: number;
}

export interface AdaptiveUpdate {
  state: AdaptiveState;
  /** Every layer's current standing, for readouts and for tests. */
  layers: AdaptiveCommand[];
  /** Only what moved since the last update — what the caller schedules. */
  changes: AdaptiveCommand[];
}

export function initialAdaptiveState(nowSec = 0): AdaptiveState {
  const layers = {} as Record<AdaptiveLayerId, LayerState>;
  for (const def of ADAPTIVE_LAYERS) {
    layers[def.id] = {
      present: false,
      coldSinceSec: null,
      targetGain: 0,
      startAtSec: nowSec,
      rampSec: def.fadeInSec,
      semitoneOffset: def.semitoneOffset,
    };
  }
  return { layers, lastSec: nowSec };
}

/**
 * The first bar line at or after `nowSec`.
 *
 * Bars are derived from an anchor and a length rather than counted, so a
 * caller that re-anchors its schedule (as `AudioEngine.schedule` does every
 * song, to keep the two clocks from drifting) does not have to tell this file
 * about it — the next call simply lands on the new grid.
 */
export function nextBarAt(nowSec: number, barAnchorSec: number, barSec: number): number {
  if (!(barSec > 0) || !Number.isFinite(barAnchorSec) || !Number.isFinite(nowSec)) return nowSec;
  const bars = Math.ceil((nowSec - barAnchorSec) / barSec);
  return barAnchorSec + bars * barSec;
}

/**
 * How loud each layer sits for this instrument.
 *
 * Derived from the voice rather than looked up by id, so a seventh instrument
 * cannot be added without being covered. Two properties matter:
 *
 * - **Inharmonicity.** A hand drum has no pitch in it, so the pulse layer is
 *   redundant under it (the instrument *is* the pulse) while the melodic
 *   layers have to carry more of the tune than they otherwise would.
 * - **Ring.** A bell that sounds for four and a half seconds turns a
 *   counter-melody into porridge, so the two busiest layers back off in
 *   proportion to how long the instrument's own notes hang around.
 */
export function instrumentTrim(voice: InstrumentVoice, id: AdaptiveLayerId): number {
  const inharmonic = voiceInharmonicity(voice);
  const ring = voiceRingSec(voice);
  // Anything under about a second of ring is a normal instrument and pays
  // nothing; past that the busy layers thin out, to a floor rather than to
  // silence, because a bell should still have company.
  const crowding = clamp(1 - 0.28 * (ring - 1.1), 0.45, 1);
  switch (id) {
    case 'drone':
      return 1;
    case 'pulse':
      return 1 - 0.55 * inharmonic;
    case 'harmony':
      return 1 + 0.25 * inharmonic;
    case 'counter':
      return crowding * (1 + 0.2 * inharmonic);
    case 'shimmer':
      return crowding * crowding;
  }
}

/**
 * The whole arrangement quietens after dark.
 *
 * Not a mood effect: a busk at midnight has fewer people at it, and the layers
 * are people. The pulse takes the largest share of that, because a stamping
 * foot is the first thing that stops being appropriate at night.
 */
function nightTrim(dayFraction: number, id: AdaptiveLayerId): number {
  // Borrowed from the ambience rather than restated, so "night" means one
  // thing in this game. Two curves that disagree by an hour would have the
  // crickets arriving before the crowd thins, which reads as a bug in
  // something nobody could name.
  const { night } = dayShape(dayFraction);
  return id === 'pulse' ? 1 - 0.45 * night : 1 - 0.2 * night;
}

/** Settled gain for a layer, given who is playing and when. */
export function layerGain(def: AdaptiveLayerDef, instrument: Instrument, dayFraction: number): number {
  const gain = def.gain * instrumentTrim(instrument.voice, def.id) * nightTrim(dayFraction, def.id);
  return Number.isFinite(gain) ? Math.max(0, gain) : 0;
}

/** Semitones from concert root for a layer in a biome. */
export function layerSemitone(def: AdaptiveLayerDef, biomeId: string): number {
  return (BIOME_DRONE_SEMITONE[biomeId] ?? 0) + def.semitoneOffset;
}

/**
 * Advance the arrangement.
 *
 * Pure: same state and input, same output. Call it as often as you like — it
 * only reports a change when one has actually happened, so a caller can hand
 * `changes` straight to Web Audio every frame without re-ramping anything.
 */
export function updateAdaptive(state: AdaptiveState, input: AdaptiveInput): AdaptiveUpdate {
  const warmth = clamp(Number.isFinite(input.warmth) ? input.warmth : 0, 0, 1);
  // A clock that went backwards is a re-anchored schedule or a resumed
  // context, not a reason to expire everybody's patience at once.
  const nowSec = Math.max(Number.isFinite(input.nowSec) ? input.nowSec : state.lastSec, state.lastSec);
  const barLineSec = nextBarAt(nowSec + BAR_LEAD_SEC, input.barAnchorSec, input.barSec);

  const layers = {} as Record<AdaptiveLayerId, LayerState>;
  const all: AdaptiveCommand[] = [];
  const changes: AdaptiveCommand[] = [];

  for (const def of ADAPTIVE_LAYERS) {
    const previous = state.layers[def.id];
    const semitoneOffset = layerSemitone(def, input.biomeId);
    let present = previous.present;
    let coldSinceSec = previous.coldSinceSec;
    let targetGain = previous.targetGain;
    let startAtSec = previous.startAtSec;
    let rampSec = previous.rampSec;

    if (warmth >= def.leaveAt) coldSinceSec = null;
    else if (coldSinceSec === null) coldSinceSec = nowSec;

    if (!present && warmth >= def.enterAt) {
      // Committed the moment the threshold is crossed, even though the sound
      // does not start until the bar. Someone who has stood up to join in
      // does not sit back down because the next phrase wobbled.
      present = true;
      coldSinceSec = null;
      startAtSec = barLineSec;
      rampSec = def.fadeInSec;
    } else if (present && coldSinceSec !== null && nowSec - coldSinceSec >= def.patienceSec) {
      present = false;
      startAtSec = barLineSec;
      rampSec = def.fadeOutSec;
    }

    const settled = present ? layerGain(def, input.instrument, input.dayFraction) : 0;
    if (Math.abs(settled - targetGain) >= GAIN_EPSILON || semitoneOffset !== previous.semitoneOffset) {
      targetGain = settled;
      // A gain that drifted (the day moved on, or the player changed
      // instrument) rather than a layer arriving or leaving still moves on a
      // bar and still takes seconds, so there is no such thing as a step here.
      if (startAtSec < nowSec) startAtSec = barLineSec;
    }

    const command: AdaptiveCommand = { id: def.id, targetGain, startAtSec, rampSec, semitoneOffset };
    all.push(command);
    if (
      Math.abs(targetGain - previous.targetGain) >= GAIN_EPSILON ||
      semitoneOffset !== previous.semitoneOffset ||
      startAtSec !== previous.startAtSec
    ) {
      changes.push(command);
    }
    layers[def.id] = { present, coldSinceSec, targetGain, startAtSec, rampSec, semitoneOffset };
  }

  return { state: { layers, lastSec: nowSec }, layers: all, changes };
}

/** Which layers are currently in the arrangement. A readout, and a test seam. */
export function activeLayerIds(state: AdaptiveState): AdaptiveLayerId[] {
  return ADAPTIVE_LAYERS.filter((def) => state.layers[def.id].present).map((def) => def.id);
}

/** Total level the backing is asking for. */
export function adaptiveTotal(update: AdaptiveUpdate): number {
  let total = 0;
  for (const layer of update.layers) total += layer.targetGain;
  return total;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
