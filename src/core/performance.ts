import { isBeatMissed, wasUnplayable } from './beats';
import {
  DEFAULT_SONG_METER_CONFIG,
  SongMeterConfig,
  applyHit,
  applyMiss,
  isWalking,
} from './songMeter';

/**
 * Busking — the game's one mechanic.
 *
 * The bard stops at a spot, starts a tune, and the notes of a real melody
 * scroll toward a line. You tap them. That is the whole verb. Everything
 * this module computes is downstream of one question asked once per note:
 * how close was the tap.
 *
 * The stance, inherited from `scaffold.ts` and not negotiable here: there is
 * **no fail state and no grade**. A busk cannot be lost, abandoned, failed or
 * scored. Missing notes makes the crowd thinner and the coins slower; it
 * never ends the busk, never rolls anything back, and never produces a
 * letter, a percentage or a rank. `scaffold.ts` fades a prompt but never the
 * answer; this module dims a reward but never a door.
 *
 * Three signals come out, and they are deliberately different in kind:
 *
 *   meter   — instantaneous. Is the bard walking right now. Owned by
 *             `songMeter.ts`; this module only holds it in [0,1] instead of
 *             [0,100] so every public number here is a fraction.
 *   warmth  — slow. How big the crowd has got. This is what the adaptive
 *             music and the visual effects read, so it must move on the
 *             timescale of a *phrase*, not a note.
 *   delight — cumulative. What the busk was worth, in the end. Only ever
 *             goes up, because a miss must not undo progress already made.
 *
 * Nothing here touches the DOM, audio, or Three.js: the scene calls
 * `tickPerformance` each frame and `pickBeat` + `judge` + `applyJudgement`
 * on each tap, and reads the numbers off the state.
 */

export type Judgement = 'perfect' | 'good' | 'late' | 'miss';

export interface PerformanceConfig {
  /** Half-width of the dead-centre window, in ms either side of the beat. */
  perfectWindowMs: number;
  /** Half-width of the ordinary hit window, in ms either side of the beat. */
  goodWindowMs: number;
  /** Warmth lost by one missed note. See `DEFAULT_PERFORMANCE_CONFIG`. */
  missPenalty: number;
  /**
   * The meter this performance's hits and misses move. Omitted, the busk
   * meter (`PERFORMANCE_METER_CONFIG`). The walk passes its own — see
   * `WALK_PERFORMANCE_CONFIG` for why the two must differ.
   */
  meterConfig?: SongMeterConfig;
}

/**
 * Windows about three times wider than a rhythm game would use, on purpose.
 *
 * `beats.ts` sets HIT_WINDOW_MS to 90ms, which is the tolerance of the old
 * single-window scene and is a genuinely tight ask for a thumb on a phone.
 * Busking is not a test of milliseconds — it is a tune played to strangers —
 * so the perfect window here is roughly that old window, and around it sits
 * a good window twice as wide again. The intent is that a player who is
 * *with* the music essentially always lands 'good', and 'perfect' is a thing
 * you notice happening rather than a thing you chase.
 *
 * `missPenalty` is in warmth, not in coins or notes. Nothing else is taken.
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  perfectWindowMs: 120,
  goodWindowMs: 240,
  missPenalty: 0.03,
};

/**
 * The late tail runs this many good-windows past the beat.
 *
 * Late is a hit. Hearing a note and answering it a beat-fraction afterwards
 * is what a person learning a tune actually does, and charging them a miss
 * for it teaches them to fear the instrument. With the defaults the tail
 * closes 480ms after the line, which is inside the ~500ms a note stays
 * visible past it (see `scaffold.ts`'s note on the reveal floor) — so the
 * rule a player can see is "if the note is still on screen, it still counts",
 * and that rule is exactly true rather than approximately true.
 *
 * There is deliberately no matching *early* tail. A tap far ahead of a note
 * is not a late note played early, it is a different note, and
 * `pickBeat` declines to attribute it at all rather than spending someone's
 * note on a guess.
 */
export const LATE_TAIL_WINDOWS = 2;

/** Milliseconds after the beat at which a tap stops counting entirely. */
export function lateWindowMs(config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG): number {
  return goodOf(config) * LATE_TAIL_WINDOWS;
}

/**
 * The song meter, restated as fractions of itself.
 *
 * Derived from `songMeter.ts` rather than retyped so that a tuning pass on
 * the meter (there has already been one, after a playtest) carries over
 * here automatically. Dividing through by `max` is the whole of it: the
 * feel — how many hits to start walking, how many misses to stop — is
 * scale-free and therefore preserved exactly.
 */
export const PERFORMANCE_METER_CONFIG: SongMeterConfig = normaliseMeter(DEFAULT_SONG_METER_CONFIG);

/**
 * The walk's meter: same gains, less than half the drain.
 *
 * The default meter (hit +12, miss −14 before normalising) was human-tuned
 * for the 2D game, where tapping was the entire activity and "about three
 * misses to stop from full" felt right. On the v0.8 road it is the wrong
 * contract: a miss out-costs a hit, so holding any stride at all demands
 * better than 54% accuracy at ninety-two notes a minute — and DESIGN.md's
 * own brief for the walk is that a player looking at the *scenery* should
 * be able to keep it alive with casual timing.
 *
 * With the drain at 6, one hit buys two misses: a player answering every
 * third note holds a slow walk, every other note a comfortable one, and the
 * band between `WALK_STOP_METER` and the walking threshold does what it was
 * built for — the stride eases instead of snapping. The busk keeps the
 * original meter on purpose: it is a short social set a player leans into,
 * not twenty minutes of road, and its stakes (warmth, coins) already carry
 * their own forgiveness.
 */
export const WALK_METER_CONFIG: SongMeterConfig = normaliseMeter({
  max: 100,
  hitGain: 12,
  missDrain: 6,
  walkingThreshold: 40,
});

/** The walk's judging contract: default windows, the walk's gentler meter. */
export const WALK_PERFORMANCE_CONFIG: PerformanceConfig = {
  ...DEFAULT_PERFORMANCE_CONFIG,
  meterConfig: WALK_METER_CONFIG,
};

function normaliseMeter(config: SongMeterConfig): SongMeterConfig {
  // Divided rather than multiplied by a precomputed reciprocal: `x * (1 / x)`
  // is not 1 for every x in binary floating point, and `max` being exactly 1
  // is the one property everything downstream leans on. It happens to hold
  // for the current max of 100; it should not stop holding because someone
  // retunes the meter to 3.
  const divisor = config.max > 0 ? config.max : 1;
  return {
    max: config.max / divisor,
    hitGain: config.hitGain / divisor,
    missDrain: config.missDrain / divisor,
    walkingThreshold: config.walkingThreshold / divisor,
  };
}

/**
 * Where the meter sits when a busk begins.
 *
 * Half full, not empty. Starting empty would mean every busk opens with the
 * bard standing still for three notes, which reads as being told off before
 * you have played anything. Half full also happens to be the value where the
 * arithmetic is symmetrical and legible: one miss (-0.14) drops you below
 * the 0.4 walking line, and one hit (+0.12) puts you back over it. The
 * stakes of a single note are therefore visible and completely reversible,
 * which is the strongest possible statement that this cannot be lost.
 */
export const START_METER = 0.5;

/**
 * Warmth: how far each judgement closes the remaining gap to a full square.
 *
 * Multiplicative on the *headroom*, not additive, so the curve is the shape
 * a gathering crowd actually has — the first few listeners are easy and the
 * last few are not — and so it plateaus instead of running away. It also
 * makes the ceiling unreachable by construction rather than by clamping,
 * which matters because the effects that read warmth will be tuned against
 * its top end and should never sit pinned there.
 */
const WARMTH_GAIN: Record<Judgement, number> = {
  perfect: 0.055,
  good: 0.04,
  late: 0.022,
  miss: 0,
};

/**
 * Warmth bleeds while nothing is being played.
 *
 * 0.008/s empties a full square in about two minutes of silence, which is
 * slow enough that a rest, a page of held notes or a fumbled bar cannot
 * scatter the crowd, and fast enough that walking away from a busy corner
 * for a minute and coming back does not find it still busy.
 */
const WARMTH_DECAY_PER_SEC = 0.008;

/**
 * Longest frame gap that is allowed to count as elapsed time for decay.
 *
 * A backgrounded tab hands back a delta of minutes. Charging that as decay
 * would empty the square while the player was reading a message, which is
 * the same class of unfairness `beats.ts`'s `wasUnplayable` exists to
 * prevent, so it gets the same treatment: time nobody could have played in
 * is not time.
 */
const MAX_DECAY_STEP_MS = 1000;

/**
 * Coins and delight per note, before warmth and streak.
 *
 * Late is worth about half a perfect. The gap has to be big enough that
 * playing tightly is visibly better and small enough that playing loosely
 * is still clearly worth doing.
 */
const DELIGHT_PER_HIT: Record<Judgement, number> = { perfect: 3, good: 2, late: 1, miss: 0 };
const COINS_PER_HIT: Record<Judgement, number> = { perfect: 1, good: 0.7, late: 0.45, miss: 0 };

/**
 * Coins are paid by the crowd, so they scale with warmth: a cold corner pays
 * 0.75 of the base rate and a full square pays 1.25.
 *
 * This is the entire mechanism by which a miss "costs coins". Nothing is
 * ever taken out of the purse — `coins.ts` says a readout never takes coins
 * back and that holds here — a miss simply thins the crowd, and a thinner
 * crowd pays less for the notes that follow. The cost is real, it is felt a
 * few seconds later rather than immediately, and it is recoverable by
 * playing well, which is the difference between a consequence and a
 * punishment.
 */
const COIN_WARMTH_FLOOR = 0.75;
const COIN_WARMTH_SPAN = 0.5;

/**
 * Streaks: a gentle, capped lean, not a multiplier.
 *
 * At most +50%, reached after eight notes in a row and flat thereafter.
 * Capping it early is the point — an uncapped combo turns the last bar of a
 * good run into the only bar that matters, and makes breaking a streak feel
 * like losing something you had, which is exactly the feeling this game is
 * built to not have. Here, breaking a streak costs the next note about a
 * third of a coin, and everything already earned is already banked.
 */
const STREAK_BONUS_NOTES = 8;
const STREAK_BONUS_MAX = 0.5;

export interface PerformanceState {
  /** Walking meter, [0,1]. See `PERFORMANCE_METER_CONFIG`. */
  meter: number;
  streak: number;
  bestStreak: number;
  hits: number;
  misses: number;
  /** Notes landed dead centre, kept apart from `hits` for the closing line. */
  perfects: number;
  /** Notes landed in the tail, likewise. */
  lates: number;
  /** Cumulative, never decreasing. */
  delight: number;
  /** Cumulative and fractional, like `coins.ts`; whole coins are a display concern. */
  coins: number;
  /** Crowd size, [0,1]. Read by the music and the effects. */
  warmth: number;
  /** High-water mark of `warmth`, for the closing line. */
  peakWarmth: number;
  /**
   * Watermark: beats with `index < noteIndex` are resolved and can never be
   * judged, missed or paid for again. It is a beat index, not a position in
   * any array, so it survives the scene handing us a sliding window of
   * on-screen notes rather than the whole schedule.
   */
  noteIndex: number;
  /**
   * Timestamp of the last `tickPerformance`; -1 before the first one. Busk
   * clocks start at zero and run forwards, so a negative sentinel is
   * unambiguous; a caller feeding this a clock with negative pre-roll would
   * get every one of those frames treated as the first.
   */
  lastTickMs: number;
}

export function createPerformance(): PerformanceState {
  return {
    meter: START_METER,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    misses: 0,
    perfects: 0,
    lates: 0,
    delight: 0,
    coins: 0,
    warmth: 0,
    peakWarmth: 0,
    noteIndex: 0,
    lastTickMs: -1,
  };
}

/** The parts of a `Beat`/`SongBeat` this module needs. */
export interface JudgeableBeat {
  index: number;
  hitTimeMs: number;
  /** Written silence: never tapped, and therefore never missable. */
  rest?: boolean;
}

/**
 * How a tap sat against one specific beat.
 *
 * Timing only — it does not know or care whether the beat was already
 * resolved. Choosing *which* beat a tap belongs to is `pickBeat`'s job, and
 * keeping a beat from being judged twice is the watermark's; splitting those
 * three concerns is what makes each of them testable in isolation.
 */
export function judge(
  beat: { hitTimeMs: number },
  inputTimeMs: number,
  config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
): Judgement {
  const delta = inputTimeMs - beat.hitTimeMs;
  if (!Number.isFinite(delta)) return 'miss';

  const perfect = perfectOf(config);
  const good = goodOf(config);
  const distance = Math.abs(delta);

  if (distance <= perfect) return 'perfect';
  if (distance <= good) return 'good';
  if (delta > 0 && delta <= good * LATE_TAIL_WINDOWS) return 'late';
  return 'miss';
}

/**
 * The beat a tap should be credited to, or undefined if it should be
 * credited to nothing.
 *
 * Nearest unresolved beat wins, and only beats the tap could plausibly have
 * been aimed at are eligible: anywhere in the late tail behind the tap, but
 * no further than the good window ahead of it. Consequences of that
 * asymmetry, both wanted:
 *
 *  - A stray tap between notes returns undefined, and a stray tap costs
 *    nothing at all. There is no penalty for fidgeting, drumming along, or
 *    testing whether the screen works.
 *  - A note in its late tail and the next note in its early window can both
 *    be eligible at once. Nearest wins, so the player is always credited
 *    with the note they were most likely playing, and the loser of that
 *    comparison stays unresolved and can still be played.
 *
 * Assumes `beats` is in ascending time order, as everything that produces
 * beats (`generateBeatSchedule`, `expandSong`) guarantees; that is what lets
 * it stop early instead of scanning the whole schedule on every tap.
 */
export function pickBeat<T extends JudgeableBeat>(
  state: PerformanceState,
  beats: readonly T[],
  inputTimeMs: number,
  config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
): T | undefined {
  const good = goodOf(config);
  const tail = good * LATE_TAIL_WINDOWS;

  let best: T | undefined;
  let bestDistance = Infinity;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    if (beat.index < state.noteIndex) continue;
    const delta = inputTimeMs - beat.hitTimeMs;
    if (delta < -good) break;
    if (beat.rest) continue;
    if (delta > tail) continue;
    const distance = Math.abs(delta);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = beat;
    }
  }

  return best;
}

export interface JudgementContext {
  /**
   * The beat this judgement settles. Supplying it resolves the beat: the
   * watermark moves past it, and a judgement naming a beat already behind the
   * watermark is discarded outright rather than merely failing to advance it.
   * Omitting it applies the judgement's effects without resolving anything,
   * which only makes sense in tests. A non-finite index is treated as no
   * index at all — a bad number must not swallow someone's note.
   */
  beatIndex?: number;
  /**
   * Multiplier on this note's coins, for spot quality or an instrument's
   * knack. Never applied to warmth or to the meter — an instrument may be
   * worth more money, but it must not make the tune easier or harder, or
   * choosing one becomes a difficulty setting in disguise.
   */
  coinMultiplier?: number;
}

/**
 * Folds one judged note into the state, in place.
 *
 * In place rather than returning a fresh object, matching `scaffold.ts`'s
 * `encounter`: this is called from a frame loop, the state is a single
 * mutable session record with no history, and copying it every note would
 * buy nothing but garbage. It still returns the state so it reads like an
 * expression at the call site.
 */
export function applyJudgement(
  state: PerformanceState,
  judgement: Judgement,
  config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG,
  ctx?: JudgementContext
): PerformanceState {
  const beatIndex = ctx?.beatIndex;
  if (beatIndex !== undefined && Number.isFinite(beatIndex)) {
    // The watermark's whole promise is that a resolved beat "can never be
    // judged, missed or paid for again". Refusing to move backwards is not
    // enough to deliver that: a second call naming a settled beat would still
    // add a hit and pay for it, and the guarantee would really be living in
    // `pickBeat` rather than here. So a stale index ends the call.
    if (beatIndex < state.noteIndex) return state;
    state.noteIndex = Math.floor(beatIndex) + 1;
  }

  const warmth = clamp01(finiteOr(state.warmth, 0));

  if (judgement === 'miss') {
    state.misses += 1;
    state.streak = 0;
    state.meter = applyMiss(
      clamp01(finiteOr(state.meter, START_METER)),
      config.meterConfig ?? PERFORMANCE_METER_CONFIG
    );
    state.warmth = clamp01(warmth - Math.max(0, finiteOr(config.missPenalty, 0)));
    return state;
  }

  state.hits += 1;
  if (judgement === 'perfect') state.perfects += 1;
  if (judgement === 'late') state.lates += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.meter = applyHit(
    clamp01(finiteOr(state.meter, START_METER)),
    config.meterConfig ?? PERFORMANCE_METER_CONFIG
  );
  state.warmth = clamp01(warmth + WARMTH_GAIN[judgement] * (1 - warmth));
  state.peakWarmth = Math.max(state.peakWarmth, state.warmth);

  // Warmth from *this* note is deliberately not in these two, so a note is
  // paid at the crowd size it was played to rather than the one it created.
  const bonus = 1 + streakBonus(state.streak);
  const multiplier = Math.max(0, finiteOr(ctx?.coinMultiplier ?? 1, 1));
  state.delight += DELIGHT_PER_HIT[judgement] * (1 + warmth);
  state.coins +=
    COINS_PER_HIT[judgement] * (COIN_WARMTH_FLOOR + COIN_WARMTH_SPAN * warmth) * bonus * multiplier;

  return state;
}

/** The capped streak lean, as a fraction added to a note's coins. */
export function streakBonus(streak: number): number {
  const run = Math.max(0, Math.min(STREAK_BONUS_NOTES, finiteOr(streak, 0)));
  return (run / STREAK_BONUS_NOTES) * STREAK_BONUS_MAX;
}

export interface TickResult {
  state: PerformanceState;
  /** Indices of beats charged as missed on this tick. Usually empty. */
  missed: readonly number[];
  /** Beats resolved without charge because nobody could have played them. */
  excused: number;
}

const NO_MISSES: readonly number[] = [];

/**
 * One frame. Bleeds warmth for elapsed time, then resolves any beat whose
 * whole window has closed unplayed.
 *
 * The double-count hazard is the reason this is written around a watermark
 * rather than a flag on each beat or a set of seen indices. A frame loop
 * calls this at whatever rate the device manages, with timestamps that on
 * real hardware occasionally repeat and occasionally go backwards, over an
 * array the scene is free to slice as notes scroll off. A watermark is
 * monotonic under all three of those, so a beat charged once cannot be
 * charged again by any subsequent call, at any timestamp, over any window of
 * the schedule. That property is worth more here than anywhere else in the
 * codebase: a miss double-counted at 60fps would not look like a bug, it
 * would look like the player being bad at the game.
 *
 * Beats absent from `beats` are skipped silently rather than charged. If the
 * scene has already dropped a note from its window, this module never saw
 * it and has no business having an opinion about it.
 */
export function tickPerformance(
  state: PerformanceState,
  nowMs: number,
  beats: readonly JudgeableBeat[],
  config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
): TickResult {
  const now = finiteOr(nowMs, state.lastTickMs);
  const firstTick = state.lastTickMs < 0;
  const previous = firstTick ? now : state.lastTickMs;

  // Clamped both ways: negative when timestamps arrive out of order, huge
  // when the tab was asleep. Neither is elapsed playing time.
  const elapsed = Math.max(0, Math.min(MAX_DECAY_STEP_MS, now - previous));
  if (elapsed > 0) {
    state.warmth = clamp01(
      finiteOr(state.warmth, 0) - (WARMTH_DECAY_PER_SEC * elapsed) / 1000
    );
  }

  const deadline = lateWindowMs(config);
  // The window a tap can land in is asymmetric — it opens one good window
  // before the beat and closes at the end of the late tail — so the question
  // "was there a frame the player could have tapped on" is not the symmetric
  // one `wasUnplayable` asks by default. Handing it the *good* window is what
  // makes it ask the right question: the closing side is already true here
  // (the beat is past its whole tail or we would have broken out of the loop
  // below), leaving exactly "did the last frame happen before this note
  // became playable". Passing `deadline` instead would treat the 240ms before
  // the note as tappable time, and charge a miss for a stall that began in it.
  const opensBefore = goodOf(config);
  let missed: number[] | undefined;
  let excused = 0;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    if (beat.index < state.noteIndex) continue;
    // Ascending order: the first beat still in play means every beat after
    // it is too, so there is nothing left to check this frame.
    if (!isBeatMissed(beat, now, deadline)) break;

    // A rest is written silence. It occupies its time and then it is over;
    // there was never anything to tap.
    if (beat.rest) {
      state.noteIndex = beat.index + 1;
      continue;
    }

    // The window fell entirely inside one frame gap, or entirely before the
    // busk's first frame: the note was never on screen while it was live.
    if (firstTick || wasUnplayable(beat, now, previous, opensBefore)) {
      state.noteIndex = beat.index + 1;
      excused += 1;
      continue;
    }

    applyJudgement(state, 'miss', config, { beatIndex: beat.index });
    (missed ??= []).push(beat.index);
  }

  // Monotonic, so a stale timestamp cannot reopen a window that has closed.
  state.lastTickMs = Math.max(state.lastTickMs, now);

  return { state, missed: missed ?? NO_MISSES, excused };
}

/** Whether the bard is walking, per `songMeter.ts`. */
export function isBardWalking(state: PerformanceState): boolean {
  return isWalking(state.meter, PERFORMANCE_METER_CONFIG);
}

export type Crowd = 'none' | 'passers-by' | 'gathering' | 'crowd' | 'square';

/**
 * Warmth thresholds, named once and used by everything that describes a
 * crowd, so the closing line and the visuals never disagree about how many
 * people were there.
 */
const CROWD_STEPS: ReadonlyArray<{ at: number; crowd: Crowd }> = [
  { at: 0.85, crowd: 'square' },
  { at: 0.6, crowd: 'crowd' },
  { at: 0.35, crowd: 'gathering' },
  { at: 0.15, crowd: 'passers-by' },
];

export function crowdFor(warmth: number): Crowd {
  const value = clamp01(finiteOr(warmth, 0));
  for (const step of CROWD_STEPS) if (value >= step.at) return step.crowd;
  return 'none';
}

/**
 * How many layers of an arrangement warmth should have brought in.
 *
 * Lives here rather than in the audio and effects modules so that the two
 * cannot drift apart — the whole appeal of warmth is that the extra fiddle
 * line and the extra drifting motes arrive on the same note. Layer one is
 * always on: the bard is playing whether or not anyone stopped.
 */
export function warmthLayers(warmth: number, layers: number): number {
  if (!Number.isFinite(layers) || layers <= 0) return 0;
  const top = Math.floor(layers);
  return Math.min(top, 1 + Math.floor(clamp01(finiteOr(warmth, 0)) * top));
}

export interface PerformanceSummary {
  notes: number;
  hits: number;
  misses: number;
  bestStreak: number;
  coins: number;
  delight: number;
  warmth: number;
  peakWarmth: number;
  crowd: Crowd;
  /** Warm prose about how it went. Never a grade. */
  line: string;
}

/**
 * The campfire read-back.
 *
 * There is no score here and there is not going to be one. Counts of notes
 * are facts about the evening and are fine; a ratio of those counts is an
 * assessment, and `scaffold.ts` already argues at length why this game does
 * not assess. So the summary reports what happened and then says one true,
 * kind sentence about it, keyed to the largest the crowd ever got — which is
 * the thing a busker would actually remember about a pitch.
 *
 * Deterministic: the same evening always gets the same sentence. Varying it
 * randomly would make the line decoration rather than information, and a
 * player who plays twice would learn to stop reading it.
 */
export function performanceSummary(state: PerformanceState): PerformanceSummary {
  const hits = Math.max(0, Math.floor(finiteOr(state.hits, 0)));
  const misses = Math.max(0, Math.floor(finiteOr(state.misses, 0)));
  const peakWarmth = clamp01(finiteOr(state.peakWarmth, 0));

  return {
    notes: hits + misses,
    hits,
    misses,
    bestStreak: Math.max(0, Math.floor(finiteOr(state.bestStreak, 0))),
    coins: Math.max(0, finiteOr(state.coins, 0)),
    delight: Math.max(0, finiteOr(state.delight, 0)),
    warmth: clamp01(finiteOr(state.warmth, 0)),
    peakWarmth,
    crowd: crowdFor(peakWarmth),
    line: summaryLine(hits, misses, peakWarmth, Math.max(0, finiteOr(state.bestStreak, 0))),
  };
}

function summaryLine(hits: number, misses: number, peakWarmth: number, bestStreak: number): string {
  if (hits + misses === 0) {
    return 'You stood a while with the strings under your thumb and never quite began. The road waits well.';
  }
  if (hits === 0) {
    return 'It never found its feet tonight. A shutter closed somewhere up the street, and that was that.';
  }

  const opening = openingLine(peakWarmth);

  // At most one coda, and the generous one wins ties. A long good run is the
  // more interesting fact about an evening than a scattering of dropped
  // notes, and if both are true the player already knows about the notes.
  if (bestStreak >= 16 && misses * 4 <= hits) {
    return `${opening} There was a long stretch in the middle where the tune carried itself.`;
  }
  if (misses > hits) {
    return `${opening} It wandered off the beat more than once, and came back every time, which is the part worth having.`;
  }
  return opening;
}

function openingLine(peakWarmth: number): string {
  switch (crowdFor(peakWarmth)) {
    case 'square':
      return "The square filled right up, and somebody's grandmother found the harmony without being asked.";
    case 'crowd':
      return 'A proper little crowd by the end, with coins going in while you were still playing.';
    case 'gathering':
      return 'A few people slowed down and then stayed, which is most of what a busker is after.';
    case 'passers-by':
      return 'Two travellers listened to the middle of it and went on humming the rest.';
    default:
      return 'Mostly for yourself, and for a dog who sat down to hear it out. That counts.';
  }
}

/**
 * Config sanitisers. A window that arrives negative, reversed or non-finite
 * has to degrade into a narrower-but-sane one, never into a state where
 * `judge` throws or returns nonsense: this runs inside a tap handler, and a
 * bad tuning value must cost tightness, not the busk.
 */
function perfectOf(config: PerformanceConfig): number {
  return Math.max(0, finiteOr(config.perfectWindowMs, DEFAULT_PERFORMANCE_CONFIG.perfectWindowMs));
}

function goodOf(config: PerformanceConfig): number {
  const good = Math.max(0, finiteOr(config.goodWindowMs, DEFAULT_PERFORMANCE_CONFIG.goodWindowMs));
  return Math.max(good, perfectOf(config));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
