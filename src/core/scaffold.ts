import { letterForStep } from './notation';

/**
 * The learning model (DESIGN.md "Pedagogy → Learning, not just exposure").
 *
 * A letter printed inside every note head forever is a crutch: a child can
 * read the letters and never learn the positions. So the letter is a
 * *scaffold*, and scaffolds have to fade or no memory is ever retrieved.
 *
 * It fades in TIME, not in opacity. As a staff position becomes familiar,
 * its letter arrives later and later in the note's flight — from present at
 * spawn, down to not arriving before the tap at all. A half-faded letter
 * would still be readable and would teach nothing; a letter that arrives
 * 900ms late buys 900ms of genuine attempted recall.
 *
 * The governing safety rule is **fade the prompt, never the answer**: every
 * note shows its letter when it is struck *or* missed (see `RoadScene`), so
 * a hidden letter is always answered and a miss never costs information.
 *
 * Honest about what it can measure: a tap proves timing, not reading — it's
 * confounded by melodic memory of a tune the child already knows. So this
 * is a *dosage* schedule driven by exposure, not an assessment. The one
 * inference it trusts is asymmetric: an isolated miss during otherwise-good
 * play means the screen just asked too much. Quick to help, slow to
 * withdraw.
 */

/**
 * How long before the hit line the letter becomes readable, per support
 * band. Band 4 = present for the whole 1800ms flight.
 *
 * Note the floor: even fully faded, the letter still arrives 350ms before
 * the tap. That is deliberate and load-bearing. A note only lives ~500ms
 * past the hit line before it fades out, so relying on an after-the-fact
 * reveal would leave a child roughly 400ms of *fading* letter to check
 * themselves against — which is answering the question by withholding the
 * answer. With the floor, the child still gets ~1450ms of blank flight to
 * recall in, and then always sees the answer in the same glance as the
 * tap. Retrieval, then confirmation, every single time.
 */
export const SUPPORT_LEAD_MS = [350, 600, 950, 1350, 1800];

export const MAX_SUPPORT = 4;
export const MAX_STRENGTH = 40;
/** Most strength one page-load may add to a position, so a scaffold can't vanish inside a single sitting. */
export const SESSION_GAIN_CAP = 12;
const HIT_GAIN = 1;
const MISS_LOSS = 3;
/** Strength at which a position's letter is considered known well enough to transfer to the same letter elsewhere. */
const TRANSFER_STRENGTH = 20;
const TRANSFER_INIT = 6;
/** A position that ever reached this peak never falls all the way back to always-labelled. */
const FLOOR_PEAK = 12;
const FLOOR_STRENGTH = 6;
const DECAY_PER_DAY = 1.5;
const DECAY_MAX_DAYS = 10;

/** Strength needed to *withdraw* support down to this band. */
const WITHDRAW_AT: Record<number, number> = { 3: 6, 2: 12, 1: 20, 0: 30 };
/**
 * Falling below this while in a band *restores* one band of support.
 *
 * Every gap here is wider than MISS_LOSS, so no single miss can ever flip a
 * band on its own — otherwise a position sitting on a threshold would
 * bounce between "letter" and "no letter" on alternating notes, which reads
 * as the game being indecisive rather than helpful. Two misses still bring
 * help back, which is the responsiveness the model is supposed to have.
 */
const RESTORE_BELOW: Record<number, number> = { 3: 3, 2: 8, 1: 15, 0: 26 };

export interface PositionState {
  strength: number;
  peak: number;
  /** Current support band, remembered so hysteresis has something to be hysteretic about. */
  band: number;
  /** Strength gained since this page load, capped by SESSION_GAIN_CAP. */
  gained: number;
}

export interface ScaffoldState {
  positions: Record<number, PositionState>;
}

export function createScaffold(): ScaffoldState {
  return { positions: {} };
}

/**
 * Reads (creating if needed) the state for a staff position. A position
 * seen for the first time starts one band in if the child already knows
 * that letter somewhere else on the staff — letter-name recall genuinely
 * transfers across octaves even though position recognition does not.
 */
export function positionState(state: ScaffoldState, step: number): PositionState {
  const existing = state.positions[step];
  if (existing) return existing;

  const letter = letterForStep(step);
  const knowsLetterElsewhere = Object.entries(state.positions).some(
    ([otherStep, p]) => p.strength >= TRANSFER_STRENGTH && letterForStep(Number(otherStep)) === letter
  );
  const strength = knowsLetterElsewhere ? TRANSFER_INIT : 0;
  const created: PositionState = { strength, peak: strength, band: MAX_SUPPORT, gained: 0 };
  created.band = bandFor(strength, MAX_SUPPORT);
  state.positions[step] = created;
  return created;
}

/** Support band for a strength, given the band currently held (hysteresis). Lower band = less help. */
function bandFor(strength: number, currentBand: number): number {
  let band = currentBand;
  while (band > 0 && strength >= WITHDRAW_AT[band - 1]) band--;
  while (band < MAX_SUPPORT && strength < RESTORE_BELOW[band]) band++;
  return band;
}

/**
 * Records one played note.
 *
 * A hit is exposure, and exposure is all a tap can honestly evidence, so it
 * nudges by one. A miss *while the bard is still walking* is the one signal
 * worth trusting — an isolated stumble during good play plausibly means
 * that note surprised the child — so it costs three. A miss while the meter
 * has already collapsed is ignored entirely: a child who has lost the beat
 * misses everything, and wiping the whole board for that would be both
 * wrong and cruel.
 */
export function encounter(
  state: ScaffoldState,
  step: number,
  outcome: 'hit' | 'miss',
  walking: boolean
): ScaffoldState {
  const p = positionState(state, step);

  if (outcome === 'hit') {
    if (p.gained < SESSION_GAIN_CAP) {
      const gain = Math.min(HIT_GAIN, SESSION_GAIN_CAP - p.gained);
      p.strength = Math.min(MAX_STRENGTH, p.strength + gain);
      p.gained += gain;
    }
    p.peak = Math.max(p.peak, p.strength);
  } else if (walking) {
    p.strength = Math.max(0, p.strength - MISS_LOSS);
    // Give the session allowance back too, or a position that is missed a
    // lot burns through its cap and can no longer climb at all for the rest
    // of the sitting — the cap is meant to slow the fade, not to strand a
    // child who had a wobble halfway through.
    p.gained = Math.max(0, p.gained - MISS_LOSS);
  }

  p.band = bandFor(p.strength, p.band);
  return state;
}

/** The stored support band for a position — how much help it has earned its way out of. */
export function supportFor(state: ScaffoldState, step: number): number {
  return positionState(state, step).band;
}

/** Milliseconds before the hit line at which the letter becomes readable. */
export function leadMsFor(support: number): number {
  return SUPPORT_LEAD_MS[Math.max(0, Math.min(MAX_SUPPORT, Math.round(support)))];
}

export interface DisplayContext {
  /** First time this position appears in the current pass of the tune. */
  firstInPass: boolean;
  /** Meter has fallen below the walking threshold. */
  struggling: boolean;
  /** Meter has been on the floor long enough that the child is plainly lost. */
  lost: boolean;
}

/**
 * The support actually used for one note, which is never written back.
 *
 * The first sighting of a position within a tune keeps its letter: these
 * songs are built of exact repeats, so labelling the first and hiding the
 * rest is textbook within-trial fading — the teacher points at the note,
 * then lets you try the next three. It also guarantees that even a fully
 * faded position is named at least once per tune, so there is structurally
 * no dead end. Struggling restores help immediately, which doubles as the
 * difficulty adjustment we are not allowed to put in a menu.
 */
export function displaySupport(storedBand: number, ctx: DisplayContext): number {
  if (ctx.lost) return MAX_SUPPORT;
  let support = storedBand;
  if (ctx.firstInPass) support += 1;
  if (ctx.struggling) support += 1;
  return Math.max(0, Math.min(MAX_SUPPORT, support));
}

/**
 * Time away softens the fade, so returning after a week meets a little more
 * help than you left. A position that was ever properly learned never falls
 * all the way back to always-labelled — the game does not un-teach.
 */
export function decayForDaysAway(state: ScaffoldState, daysAway: number): ScaffoldState {
  if (daysAway <= 0) return state;
  const days = Math.min(daysAway, DECAY_MAX_DAYS);
  for (const p of Object.values(state.positions)) {
    const floor = p.peak >= FLOOR_PEAK ? FLOOR_STRENGTH : 0;
    p.strength = Math.max(floor, p.strength - DECAY_PER_DAY * days);
    p.band = bandFor(p.strength, p.band);
  }
  return state;
}

/** Clears per-session gain caps. Called once when a session begins. */
export function beginSession(state: ScaffoldState): ScaffoldState {
  for (const p of Object.values(state.positions)) p.gained = 0;
  return state;
}
