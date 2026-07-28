import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERFORMANCE_CONFIG,
  JudgeableBeat,
  Judgement,
  LATE_TAIL_WINDOWS,
  PERFORMANCE_METER_CONFIG,
  PerformanceState,
  START_METER,
  applyJudgement,
  createPerformance,
  crowdFor,
  isBardWalking,
  judge,
  lateWindowMs,
  performanceSummary,
  pickBeat,
  streakBonus,
  tickPerformance,
  warmthLayers,
} from './performance';
import { expandSong } from './song';
import { HOT_CROSS_BUNS, MARY_HAD_A_LITTLE_LAMB } from './songs';
import { DEFAULT_SONG_METER_CONFIG, isWalking } from './songMeter';
import { mulberry32 } from './rng';

const CONFIG = DEFAULT_PERFORMANCE_CONFIG;
const BPM = 100;

/** One note at a known time, for window arithmetic. */
const NOTE = { index: 0, hitTimeMs: 10_000 };

function hit(state: PerformanceState, times: number, judgement: Judgement = 'perfect'): void {
  for (let i = 0; i < times; i++) applyJudgement(state, judgement, CONFIG);
}

describe('createPerformance', () => {
  it('opens with the bard already walking and no crowd', () => {
    const state = createPerformance();
    expect(state.meter).toBe(START_METER);
    expect(isBardWalking(state)).toBe(true);
    expect(state.warmth).toBe(0);
    expect(state.peakWarmth).toBe(0);
    expect(state.noteIndex).toBe(0);
    expect(state.coins).toBe(0);
    expect(state.delight).toBe(0);
  });

  it('is a fresh object each time, so two busks cannot share a purse', () => {
    const a = createPerformance();
    const b = createPerformance();
    applyJudgement(a, 'perfect', CONFIG);
    expect(b.coins).toBe(0);
    expect(b.hits).toBe(0);
  });

  it('starts where one miss stops the bard and one hit restarts him', () => {
    const state = createPerformance();
    applyJudgement(state, 'miss', CONFIG);
    expect(isBardWalking(state)).toBe(false);
    applyJudgement(state, 'good', CONFIG);
    expect(isBardWalking(state)).toBe(true);
  });
});

describe('the meter stays in lockstep with songMeter', () => {
  it('is the same configuration expressed as fractions', () => {
    const scale = DEFAULT_SONG_METER_CONFIG.max;
    expect(PERFORMANCE_METER_CONFIG.max).toBe(1);
    expect(PERFORMANCE_METER_CONFIG.hitGain).toBeCloseTo(DEFAULT_SONG_METER_CONFIG.hitGain / scale, 12);
    expect(PERFORMANCE_METER_CONFIG.missDrain).toBeCloseTo(DEFAULT_SONG_METER_CONFIG.missDrain / scale, 12);
    expect(PERFORMANCE_METER_CONFIG.walkingThreshold).toBeCloseTo(
      DEFAULT_SONG_METER_CONFIG.walkingThreshold / scale,
      12
    );
  });

  it('agrees with songMeter about walking at the threshold', () => {
    const threshold = PERFORMANCE_METER_CONFIG.walkingThreshold;
    expect(isWalking(threshold, PERFORMANCE_METER_CONFIG)).toBe(true);
    expect(isWalking(threshold - 1e-9, PERFORMANCE_METER_CONFIG)).toBe(false);
  });
});

describe('judge', () => {
  it('is exact at the perfect window edges', () => {
    expect(judge(NOTE, 10_000, CONFIG)).toBe('perfect');
    expect(judge(NOTE, 10_000 + CONFIG.perfectWindowMs, CONFIG)).toBe('perfect');
    expect(judge(NOTE, 10_000 - CONFIG.perfectWindowMs, CONFIG)).toBe('perfect');
    expect(judge(NOTE, 10_000 + CONFIG.perfectWindowMs + 1, CONFIG)).toBe('good');
    expect(judge(NOTE, 10_000 - CONFIG.perfectWindowMs - 1, CONFIG)).toBe('good');
  });

  it('is exact at the good window edges', () => {
    expect(judge(NOTE, 10_000 + CONFIG.goodWindowMs, CONFIG)).toBe('good');
    expect(judge(NOTE, 10_000 - CONFIG.goodWindowMs, CONFIG)).toBe('good');
    expect(judge(NOTE, 10_000 + CONFIG.goodWindowMs + 1, CONFIG)).toBe('late');
    // Early beyond the good window is not "late" — it is a tap at nothing.
    expect(judge(NOTE, 10_000 - CONFIG.goodWindowMs - 1, CONFIG)).toBe('miss');
  });

  it('is exact at the far edge of the late tail', () => {
    const tail = lateWindowMs(CONFIG);
    expect(judge(NOTE, 10_000 + tail, CONFIG)).toBe('late');
    expect(judge(NOTE, 10_000 + tail + 1, CONFIG)).toBe('miss');
  });

  it('is forgiving by design: the tail is wide but still on screen', () => {
    // Wider than beats.ts's 90ms single window by a long way...
    expect(CONFIG.perfectWindowMs).toBeGreaterThan(90);
    // ...and the tail closes before a note's ~500ms life past the line ends,
    // so "still visible" and "still counts" mean the same thing.
    expect(lateWindowMs(CONFIG)).toBe(CONFIG.goodWindowMs * LATE_TAIL_WINDOWS);
    expect(lateWindowMs(CONFIG)).toBeLessThan(500);
  });

  it('returns a judgement rather than throwing on nonsense input', () => {
    expect(judge(NOTE, Number.NaN, CONFIG)).toBe('miss');
    expect(judge(NOTE, Infinity, CONFIG)).toBe('miss');
    expect(judge({ hitTimeMs: Number.NaN }, 10_000, CONFIG)).toBe('miss');
  });

  it('degrades a reversed or negative configuration into a sane one', () => {
    const reversed = { perfectWindowMs: 300, goodWindowMs: 50, missPenalty: 0.03 };
    // The good window can never be tighter than the perfect one.
    expect(judge(NOTE, 10_250, reversed)).toBe('perfect');
    expect(judge(NOTE, 10_400, reversed)).toBe('late');

    const negative = { perfectWindowMs: -10, goodWindowMs: -10, missPenalty: -1 };
    expect(judge(NOTE, 10_000, negative)).toBe('perfect');
    expect(judge(NOTE, 10_001, negative)).toBe('miss');
  });
});

describe('pickBeat', () => {
  const beats = expandSong(MARY_HAD_A_LITTLE_LAMB, BPM);

  it('credits a tap to the nearest unresolved beat', () => {
    const state = createPerformance();
    const first = beats[0];
    const picked = pickBeat(state, beats, first.hitTimeMs + 30, CONFIG);
    expect(picked?.index).toBe(first.index);
  });

  it('hands a tap to the next note as soon as that note has a claim on it', () => {
    const state = createPerformance();
    // The next note's early window opens 240ms before it lands; until then
    // the tap can only belong to the note still in its tail.
    const opens = beats[1].hitTimeMs - CONFIG.goodWindowMs;
    expect(pickBeat(state, beats, opens - 1, CONFIG)?.index).toBe(0);
    expect(pickBeat(state, beats, opens + 1, CONFIG)?.index).toBe(1);
  });

  it('gives an ambiguous tap to whichever note is nearer', () => {
    const state = createPerformance();
    // Fast enough (400ms apart) that one note's tail and the next note's
    // early window overlap across the midpoint between them.
    const pair = [
      { index: 0, hitTimeMs: 1000 },
      { index: 1, hitTimeMs: 1400 },
    ];
    expect(pickBeat(state, pair, 1180, CONFIG)?.index).toBe(0);
    expect(pickBeat(state, pair, 1220, CONFIG)?.index).toBe(1);
  });

  it('credits a stray tap to nothing at all', () => {
    const state = createPerformance();
    // Well before the first note has any claim on the screen.
    expect(pickBeat(state, beats, 0, CONFIG)).toBeUndefined();
    expect(pickBeat(state, beats, Number.NaN, CONFIG)).toBeUndefined();
    expect(pickBeat(state, [], 1000, CONFIG)).toBeUndefined();
  });

  it('will not return a beat that has already been resolved', () => {
    const state = createPerformance();
    const first = beats[0];
    applyJudgement(state, 'perfect', CONFIG, { beatIndex: first.index });
    // Same tap time, same array, and now it belongs to nobody: the next note
    // is a whole beat away and has no claim on this tap either.
    expect(pickBeat(state, beats, first.hitTimeMs, CONFIG)).toBeUndefined();

    // But resolving a note must not blind the picker to the one after it.
    const close = [
      { index: 0, hitTimeMs: 1000 },
      { index: 1, hitTimeMs: 1300 },
    ];
    const settled = createPerformance();
    expect(pickBeat(settled, close, 1100, CONFIG)?.index).toBe(0);
    applyJudgement(settled, 'perfect', CONFIG, { beatIndex: 0 });
    expect(pickBeat(settled, close, 1100, CONFIG)?.index).toBe(1);
  });

  it('never offers a rest to be tapped', () => {
    const state = createPerformance();
    const buns = expandSong(HOT_CROSS_BUNS, BPM);
    const rest = buns.find((beat) => beat.rest);
    expect(rest).toBeDefined();
    // Nothing else is near enough to claim a tap on the rest, so it goes
    // nowhere — the rest itself is never a candidate.
    expect(pickBeat(state, buns, rest!.hitTimeMs, CONFIG)).toBeUndefined();

    // The stronger case: a rest that is *nearer* than a real note still loses,
    // because it is not in the running at all rather than merely out-ranked.
    const pair: JudgeableBeat[] = [
      { index: 0, hitTimeMs: 1000, rest: true },
      { index: 1, hitTimeMs: 1150 },
    ];
    expect(pickBeat(state, pair, 1000, CONFIG)?.index).toBe(1);
  });

  it('offers exactly the beats judge would not call a miss', () => {
    const lone = [{ index: 0, hitTimeMs: 10_000 }];
    for (let offset = -900; offset <= 900; offset += 5) {
      const state = createPerformance();
      const at = 10_000 + offset;
      const reachable = pickBeat(state, lone, at, CONFIG) !== undefined;
      expect(reachable).toBe(judge(lone[0], at, CONFIG) !== 'miss');
    }
  });

  it('accepts late taps further out than early ones', () => {
    const state = createPerformance();
    const lone = [{ index: 0, hitTimeMs: 10_000 }];
    expect(pickBeat(state, lone, 10_000 + lateWindowMs(CONFIG), CONFIG)?.index).toBe(0);
    expect(pickBeat(state, lone, 10_000 + lateWindowMs(CONFIG) + 1, CONFIG)).toBeUndefined();
    expect(pickBeat(state, lone, 10_000 - CONFIG.goodWindowMs, CONFIG)?.index).toBe(0);
    expect(pickBeat(state, lone, 10_000 - CONFIG.goodWindowMs - 1, CONFIG)).toBeUndefined();
  });
});

describe('a beat is judged at most once', () => {
  const beats = expandSong(MARY_HAD_A_LITTLE_LAMB, BPM);

  it('moves the watermark past a beat that has been settled', () => {
    const state = createPerformance();
    applyJudgement(state, 'good', CONFIG, { beatIndex: 4 });
    expect(state.noteIndex).toBe(5);
    expect(state.hits).toBe(1);
  });

  it('never moves the watermark backwards', () => {
    const state = createPerformance();
    applyJudgement(state, 'good', CONFIG, { beatIndex: 9 });
    applyJudgement(state, 'good', CONFIG, { beatIndex: 2 });
    expect(state.noteIndex).toBe(10);
    // And the stale one is discarded rather than merely failing to move it.
    expect(state.hits).toBe(1);
  });

  it('discards a judgement that names a beat already settled', () => {
    const state = createPerformance();
    applyJudgement(state, 'perfect', CONFIG, { beatIndex: 0 });
    const coins = state.coins;
    const warmth = state.warmth;
    const meter = state.meter;

    applyJudgement(state, 'perfect', CONFIG, { beatIndex: 0 });
    expect(state.hits).toBe(1);
    expect(state.streak).toBe(1);
    expect(state.coins).toBe(coins);
    expect(state.warmth).toBe(warmth);
    expect(state.meter).toBe(meter);

    // The same protection has to hold for the charge as for the payment,
    // or a stray frame could still charge a note a tap already answered.
    applyJudgement(state, 'miss', CONFIG, { beatIndex: 0 });
    expect(state.misses).toBe(0);
    expect(state.streak).toBe(1);
    expect(state.meter).toBe(meter);
  });

  it('still scores a judgement whose index is nonsense rather than eating it', () => {
    const state = createPerformance();
    applyJudgement(state, 'good', CONFIG, { beatIndex: Number.NaN });
    expect(state.hits).toBe(1);
    expect(state.noteIndex).toBe(0);
  });

  it('cannot be paid twice for the same beat through pickBeat', () => {
    const state = createPerformance();
    const target = beats[3];
    for (let i = 0; i < 5; i++) {
      const beat = pickBeat(state, beats, target.hitTimeMs, CONFIG);
      if (!beat) continue;
      applyJudgement(state, judge(beat, target.hitTimeMs, CONFIG), CONFIG, { beatIndex: beat.index });
    }
    // Only one beat has any claim on that instant, so five taps at it buy
    // exactly one note — not five, and not four rejected plus one.
    expect(state.hits).toBe(1);
    expect(state.misses).toBe(0);
    expect(state.noteIndex).toBe(target.index + 1);
  });

  it('a beat settled by a tap is never charged as a miss afterwards', () => {
    const state = createPerformance();
    const target = beats[0];
    applyJudgement(state, 'perfect', CONFIG, { beatIndex: target.index });
    const last = beats[beats.length - 1].hitTimeMs;
    for (let t = 0; t <= last + 2000; t += 16) tickPerformance(state, t, beats, CONFIG);
    expect(state.misses).toBe(beats.length - 1);
    expect(state.hits).toBe(1);
  });
});

describe('tickPerformance', () => {
  const beats = expandSong(MARY_HAD_A_LITTLE_LAMB, BPM);
  const end = beats[beats.length - 1].hitTimeMs + 2000;

  /** Plays the whole tune touching nothing, at the given frame times. */
  function walkThrough(frames: number[]): PerformanceState {
    const state = createPerformance();
    for (const now of frames) tickPerformance(state, now, beats, CONFIG);
    return state;
  }

  function evenFrames(step: number): number[] {
    const frames: number[] = [];
    for (let t = 0; t <= end; t += step) frames.push(t);
    return frames;
  }

  it('charges each unplayed beat exactly once over a whole tune', () => {
    const state = walkThrough(evenFrames(16));
    expect(state.misses).toBe(beats.length);
    expect(state.noteIndex).toBe(beats.length);
  });

  it('charges the same total no matter the frame rate', () => {
    expect(walkThrough(evenFrames(8)).misses).toBe(beats.length);
    expect(walkThrough(evenFrames(33)).misses).toBe(beats.length);
    expect(walkThrough(evenFrames(120)).misses).toBe(beats.length);
  });

  it('does not charge again when called repeatedly at the same timestamp', () => {
    const state = createPerformance();
    for (let t = 0; t <= 5000; t += 16) tickPerformance(state, t, beats, CONFIG);
    const after = state.misses;
    expect(after).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) tickPerformance(state, 5000, beats, CONFIG);
    expect(state.misses).toBe(after);
  });

  it('does not charge again when timestamps arrive out of order', () => {
    const state = createPerformance();
    for (let t = 0; t <= 6000; t += 16) tickPerformance(state, t, beats, CONFIG);
    const after = state.misses;
    expect(after).toBeGreaterThan(0);
    tickPerformance(state, 3000, beats, CONFIG);
    tickPerformance(state, 100, beats, CONFIG);
    tickPerformance(state, 6000, beats, CONFIG);
    expect(state.misses).toBe(after);
    expect(Number.isFinite(state.warmth)).toBe(true);
    expect(Number.isFinite(state.meter)).toBe(true);
  });

  it('reports the beats it charged, once each, in order', () => {
    const state = createPerformance();
    tickPerformance(state, 0, beats, CONFIG);
    const seen: number[] = [];
    for (let t = 0; t <= end; t += 16) seen.push(...tickPerformance(state, t, beats, CONFIG).missed);
    expect(seen).toEqual(beats.map((beat) => beat.index));
  });

  it('leaves a beat alone until its late tail has closed', () => {
    const state = createPerformance();
    const first = beats[0];
    tickPerformance(state, 0, beats, CONFIG);
    tickPerformance(state, first.hitTimeMs + lateWindowMs(CONFIG), beats, CONFIG);
    expect(state.misses).toBe(0);
    tickPerformance(state, first.hitTimeMs + lateWindowMs(CONFIG) + 1, beats, CONFIG);
    expect(state.misses).toBe(1);
  });

  it('never charges a rest', () => {
    const buns = expandSong(HOT_CROSS_BUNS, BPM);
    const rests = buns.filter((beat) => beat.rest).length;
    const state = createPerformance();
    tickPerformance(state, 0, buns, CONFIG);
    for (let t = 0; t <= buns[buns.length - 1].hitTimeMs + 2000; t += 16) {
      tickPerformance(state, t, buns, CONFIG);
    }
    expect(rests).toBeGreaterThan(0);
    expect(state.misses).toBe(buns.length - rests);
    expect(state.noteIndex).toBe(buns.length);
  });

  it('excuses notes swallowed whole by a frame gap instead of charging them', () => {
    const state = createPerformance();
    tickPerformance(state, 0, beats, CONFIG);
    // A stall long enough to eat several notes end to end.
    const result = tickPerformance(state, 6000, beats, CONFIG);
    expect(result.missed.length).toBe(0);
    expect(result.excused).toBeGreaterThan(0);
    expect(state.misses).toBe(0);
    expect(state.warmth).toBe(0);
  });

  it('excuses a note only when no frame fell inside the window a tap could use', () => {
    // The usable window is asymmetric: it opens 240ms before the beat and
    // closes 480ms after it. A stall that begins after it opened had a frame
    // the player could have tapped on, so the note is charged; a stall that
    // begins before it opened did not, so the note is excused. Judging that
    // by the late tail on both sides would charge the second case, which is
    // the exact unfairness the excuse exists to prevent.
    const lone = [{ index: 0, hitTimeMs: 1000 }];

    const inside = createPerformance();
    tickPerformance(inside, 600, lone, CONFIG);
    tickPerformance(inside, 800, lone, CONFIG);
    const charged = tickPerformance(inside, 1600, lone, CONFIG);
    expect(charged.missed).toEqual([0]);
    expect(charged.excused).toBe(0);
    expect(inside.misses).toBe(1);

    const before = createPerformance();
    tickPerformance(before, 600, lone, CONFIG);
    tickPerformance(before, 700, lone, CONFIG);
    const skipped = tickPerformance(before, 1600, lone, CONFIG);
    expect(skipped.missed.length).toBe(0);
    expect(skipped.excused).toBe(1);
    expect(before.misses).toBe(0);
    expect(before.noteIndex).toBe(1);
  });

  it('excuses notes that were already past before the first frame', () => {
    const state = createPerformance();
    const result = tickPerformance(state, 8000, beats, CONFIG);
    expect(result.missed.length).toBe(0);
    expect(result.excused).toBeGreaterThan(0);
    expect(state.noteIndex).toBeGreaterThan(0);
  });

  it('ignores beats the scene has already dropped from its window', () => {
    const state = createPerformance();
    tickPerformance(state, 0, beats, CONFIG);
    // The scene despawns the first four notes and hands us the rest.
    const window = beats.slice(4);
    for (let t = 0; t <= end; t += 16) tickPerformance(state, t, window, CONFIG);
    expect(state.misses).toBe(window.length);
    expect(state.noteIndex).toBe(beats.length);
  });

  it('is a no-op on an empty schedule or a nonsense timestamp', () => {
    const state = createPerformance();
    expect(tickPerformance(state, 1000, [], CONFIG).missed.length).toBe(0);
    const before = { ...state };
    tickPerformance(state, Number.NaN, beats, CONFIG);
    expect(state.misses).toBe(before.misses);
    expect(Number.isFinite(state.warmth)).toBe(true);
  });
});

describe('warmth', () => {
  it('rises with every decent note and never leaves [0,1]', () => {
    const state = createPerformance();
    let previous = state.warmth;
    for (let i = 0; i < 200; i++) {
      applyJudgement(state, 'perfect', CONFIG);
      expect(state.warmth).toBeGreaterThan(previous);
      expect(state.warmth).toBeLessThanOrEqual(1);
      previous = state.warmth;
    }
  });

  it('plateaus rather than running away: each note adds less than the last', () => {
    const state = createPerformance();
    applyJudgement(state, 'perfect', CONFIG);
    let previousGain = state.warmth;
    for (let i = 0; i < 50; i++) {
      const before = state.warmth;
      applyJudgement(state, 'perfect', CONFIG);
      const gain = state.warmth - before;
      expect(gain).toBeLessThan(previousGain);
      previousGain = gain;
    }
    // A whole tune of flawless play gets a full square within reach but not
    // pinned at the ceiling.
    expect(state.warmth).toBeGreaterThan(0.85);
    expect(state.warmth).toBeLessThan(1);
  });

  it('is slow to earn: a handful of notes is not a crowd', () => {
    const state = createPerformance();
    hit(state, 5);
    expect(state.warmth).toBeLessThan(0.35);
    expect(crowdFor(state.warmth)).not.toBe('crowd');
  });

  it('rewards tighter playing more than loose playing', () => {
    const tight = createPerformance();
    const loose = createPerformance();
    hit(tight, 20, 'perfect');
    hit(loose, 20, 'late');
    expect(tight.warmth).toBeGreaterThan(loose.warmth);
    expect(loose.warmth).toBeGreaterThan(0);
  });

  it('settles at a level that reflects how the busk is going', () => {
    // Alternating hit and miss cannot climb to a full square, and cannot
    // collapse to nothing either: it finds its own level and stays there.
    const state = createPerformance();
    for (let i = 0; i < 400; i++) {
      applyJudgement(state, i % 2 === 0 ? 'perfect' : 'miss', CONFIG);
    }
    expect(state.warmth).toBeGreaterThan(0.3);
    expect(state.warmth).toBeLessThan(0.6);

    const better = createPerformance();
    for (let i = 0; i < 400; i++) {
      applyJudgement(better, i % 5 === 4 ? 'miss' : 'perfect', CONFIG);
    }
    expect(better.warmth).toBeGreaterThan(state.warmth);
  });

  it('is slow to lose while nothing is played', () => {
    const state = createPerformance();
    hit(state, 40);
    const full = state.warmth;
    tickPerformance(state, 0, [], CONFIG);
    for (let t = 0; t <= 10_000; t += 100) tickPerformance(state, t, [], CONFIG);
    // Ten seconds of silence costs a little, not the crowd.
    expect(state.warmth).toBeLessThan(full);
    expect(full - state.warmth).toBeLessThan(0.15);
  });

  it('does not empty the square while the tab is asleep', () => {
    const state = createPerformance();
    hit(state, 40);
    const full = state.warmth;
    tickPerformance(state, 0, [], CONFIG);
    tickPerformance(state, 600_000, [], CONFIG);
    expect(full - state.warmth).toBeLessThan(0.02);
  });

  it('floors at zero however badly it goes', () => {
    const state = createPerformance();
    for (let i = 0; i < 500; i++) applyJudgement(state, 'miss', CONFIG);
    expect(state.warmth).toBe(0);
    expect(state.peakWarmth).toBe(0);
  });

  it('remembers the largest the crowd ever got', () => {
    const state = createPerformance();
    hit(state, 30);
    const peak = state.warmth;
    for (let i = 0; i < 10; i++) applyJudgement(state, 'miss', CONFIG);
    expect(state.warmth).toBeLessThan(peak);
    expect(state.peakWarmth).toBe(peak);
  });
});

describe('streaks', () => {
  it('caps the bonus and holds it flat thereafter', () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(8)).toBeCloseTo(0.5, 12);
    expect(streakBonus(80)).toBeCloseTo(0.5, 12);
    expect(streakBonus(800)).toBe(streakBonus(8));
    expect(streakBonus(-5)).toBe(0);
    expect(streakBonus(Number.NaN)).toBe(0);
  });

  it('records the best run and resets the current one on a miss', () => {
    const state = createPerformance();
    hit(state, 12);
    expect(state.streak).toBe(12);
    expect(state.bestStreak).toBe(12);
    applyJudgement(state, 'miss', CONFIG);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(12);
  });

  it('does not take anything back when a streak breaks', () => {
    const state = createPerformance();
    hit(state, 12);
    const coins = state.coins;
    const delight = state.delight;
    applyJudgement(state, 'miss', CONFIG);
    expect(state.coins).toBe(coins);
    expect(state.delight).toBe(delight);
  });
});

describe('coins and delight', () => {
  it('pay better to a warm crowd than a cold one', () => {
    const cold = createPerformance();
    applyJudgement(cold, 'perfect', CONFIG);
    const first = cold.coins;

    const warm = createPerformance();
    hit(warm, 40);
    const before = warm.coins;
    applyJudgement(warm, 'perfect', CONFIG);
    expect(warm.coins - before).toBeGreaterThan(first);
  });

  it('never take a coin back, whatever happens', () => {
    const state = createPerformance();
    const rand = mulberry32(20260728);
    const judgements: Judgement[] = ['perfect', 'good', 'late', 'miss'];
    let coins = 0;
    let delight = 0;
    for (let i = 0; i < 2000; i++) {
      applyJudgement(state, judgements[Math.floor(rand() * 4)], CONFIG);
      expect(state.coins).toBeGreaterThanOrEqual(coins);
      expect(state.delight).toBeGreaterThanOrEqual(delight);
      coins = state.coins;
      delight = state.delight;
    }
  });

  it('lets a spot or an instrument multiply coins without touching the tune', () => {
    const plain = createPerformance();
    const rich = createPerformance();
    applyJudgement(plain, 'good', CONFIG);
    applyJudgement(rich, 'good', CONFIG, { coinMultiplier: 3 });
    expect(rich.coins).toBeCloseTo(plain.coins * 3, 12);
    expect(rich.warmth).toBe(plain.warmth);
    expect(rich.meter).toBe(plain.meter);
  });

  it('treats a nonsense multiplier as no multiplier', () => {
    const state = createPerformance();
    applyJudgement(state, 'good', CONFIG, { coinMultiplier: Number.NaN });
    expect(state.coins).toBeGreaterThan(0);
    applyJudgement(state, 'good', CONFIG, { coinMultiplier: -10 });
    expect(Number.isFinite(state.coins)).toBe(true);
  });
});

describe('the no-fail invariant', () => {
  it('has no unrecoverable state: a busk is always still playable', () => {
    const state = createPerformance();
    for (let i = 0; i < 500; i++) applyJudgement(state, 'miss', CONFIG);
    expect(state.meter).toBe(0);
    expect(state.warmth).toBe(0);
    expect(isBardWalking(state)).toBe(false);

    // One good note and the bard is moving again with money coming in.
    hit(state, 5);
    expect(isBardWalking(state)).toBe(true);
    expect(state.warmth).toBeGreaterThan(0);
    expect(state.coins).toBeGreaterThan(0);
    expect(performanceSummary(state).line.length).toBeGreaterThan(0);
  });

  it('keeps every number in range under a long random busk', () => {
    const rand = mulberry32(0x5eed);
    const beats = expandSong(MARY_HAD_A_LITTLE_LAMB, BPM);
    const state = createPerformance();
    let now = 0;
    for (let frame = 0; frame < 4000; frame++) {
      // Frame times wobble, occasionally repeat, and occasionally go back.
      now += Math.floor(rand() * 40) - 6;
      tickPerformance(state, now, beats, CONFIG);
      if (rand() < 0.2) {
        const beat = pickBeat(state, beats, now + Math.floor(rand() * 900) - 450, CONFIG);
        if (beat) {
          const at = beat.hitTimeMs + Math.floor(rand() * 700) - 350;
          applyJudgement(state, judge(beat, at, CONFIG), CONFIG, { beatIndex: beat.index });
        }
      }
      expect(state.meter).toBeGreaterThanOrEqual(0);
      expect(state.meter).toBeLessThanOrEqual(1);
      expect(state.warmth).toBeGreaterThanOrEqual(0);
      expect(state.warmth).toBeLessThanOrEqual(1);
      expect(Number.isNaN(state.coins)).toBe(false);
      expect(Number.isNaN(state.delight)).toBe(false);
    }
    // Every note in the tune was accounted for exactly once, no more.
    expect(state.hits + state.misses).toBeLessThanOrEqual(beats.length);
    expect(state.noteIndex).toBeLessThanOrEqual(beats.length);
  });

  it('survives a state that arrived corrupted, rather than spreading NaN', () => {
    const state = createPerformance();
    state.warmth = Number.NaN;
    state.meter = Number.NaN;
    applyJudgement(state, 'good', CONFIG);
    expect(Number.isNaN(state.warmth)).toBe(false);
    expect(Number.isNaN(state.meter)).toBe(false);
    expect(Number.isNaN(state.coins)).toBe(false);
  });
});

describe('crowdFor and warmthLayers', () => {
  it('describes a crowd in order and never skips a step going up', () => {
    const order = ['none', 'passers-by', 'gathering', 'crowd', 'square'];
    let previous = 0;
    for (let w = 0; w <= 1.0001; w += 0.005) {
      const rank = order.indexOf(crowdFor(w));
      expect(rank).toBeGreaterThanOrEqual(previous);
      expect(rank - previous).toBeLessThanOrEqual(1);
      previous = rank;
    }
    expect(crowdFor(0)).toBe('none');
    expect(crowdFor(1)).toBe('square');
    expect(crowdFor(Number.NaN)).toBe('none');
    expect(crowdFor(-5)).toBe('none');
    expect(crowdFor(5)).toBe('square');
  });

  it('steps up exactly at each named threshold, not a hair either side', () => {
    const nudge = 1e-9;
    expect(crowdFor(0.15)).toBe('passers-by');
    expect(crowdFor(0.15 - nudge)).toBe('none');
    expect(crowdFor(0.35)).toBe('gathering');
    expect(crowdFor(0.35 - nudge)).toBe('passers-by');
    expect(crowdFor(0.6)).toBe('crowd');
    expect(crowdFor(0.6 - nudge)).toBe('gathering');
    expect(crowdFor(0.85)).toBe('square');
    expect(crowdFor(0.85 - nudge)).toBe('crowd');
  });

  it('brings layers in one at a time and always leaves the bard playing', () => {
    expect(warmthLayers(0, 4)).toBe(1);
    expect(warmthLayers(1, 4)).toBe(4);
    expect(warmthLayers(0.5, 4)).toBe(3);
    expect(warmthLayers(0.24, 4)).toBe(1);
    expect(warmthLayers(0.25, 4)).toBe(2);
    expect(warmthLayers(Number.NaN, 4)).toBe(1);
    expect(warmthLayers(0.9, 0)).toBe(0);
    expect(warmthLayers(0.9, -3)).toBe(0);
    expect(warmthLayers(0.9, Number.POSITIVE_INFINITY)).toBe(0);
    let previous = 0;
    for (let w = 0; w <= 1.0001; w += 0.01) {
      const layers = warmthLayers(w, 5);
      expect(layers).toBeGreaterThanOrEqual(previous);
      expect(layers).toBeLessThanOrEqual(5);
      previous = layers;
    }
  });
});

describe('performanceSummary', () => {
  function played(hits: number, misses: number, judgement: Judgement = 'perfect'): PerformanceState {
    const state = createPerformance();
    hit(state, hits, judgement);
    for (let i = 0; i < misses; i++) applyJudgement(state, 'miss', CONFIG);
    return state;
  }

  it('never grades: no digits, no percentage, no rank', () => {
    const states = [played(0, 0), played(0, 5), played(3, 0), played(20, 2), played(40, 0), played(6, 30)];
    for (const state of states) {
      const line = performanceSummary(state).line;
      expect(line.length).toBeGreaterThan(20);
      expect(/[0-9%]/.test(line)).toBe(false);
      expect(/score|grade|accuracy|rank|rating/i.test(line)).toBe(false);
    }
  });

  it('keeps the prose plain and the typography like the rest of the game', () => {
    const states = [played(0, 0), played(0, 5), played(3, 0), played(20, 2), played(40, 0), played(6, 30)];
    for (const state of states) {
      const line = performanceSummary(state).line;
      // No cheering at the player, and nothing sold to them.
      expect(line).not.toMatch(/!/);
      expect(/amazing|awesome|incredible|perfect run|epic/i.test(line)).toBe(false);
      // Plain ASCII: every other player-facing string in src uses a straight
      // apostrophe, and one curly one here would render as an odd character
      // beside them.
      expect(/^[\x20-\x7e]+$/.test(line)).toBe(true);
      expect(line.trim()).toBe(line);
      expect(line).toMatch(/[.]$/);
    }
  });

  it('says something different depending on how it actually went', () => {
    const lines = new Set([
      performanceSummary(played(0, 0)).line,
      performanceSummary(played(0, 5)).line,
      performanceSummary(played(3, 0)).line,
      performanceSummary(played(40, 0)).line,
      performanceSummary(played(6, 30)).line,
    ]);
    expect(lines.size).toBe(5);
  });

  it('mentions a long run only when there was one', () => {
    expect(performanceSummary(played(40, 0)).line).toMatch(/carried itself/);
    expect(performanceSummary(played(6, 0)).line).not.toMatch(/carried itself/);
  });

  it('is kind about a busk that wandered', () => {
    expect(performanceSummary(played(6, 30)).line).toMatch(/came back every time/);
  });

  it('has something to say about a busk that never started', () => {
    const summary = performanceSummary(createPerformance());
    expect(summary.notes).toBe(0);
    expect(summary.crowd).toBe('none');
    expect(summary.line).toMatch(/never quite began/);
  });

  it('gives the same evening the same sentence every time', () => {
    const state = played(20, 3);
    expect(performanceSummary(state)).toEqual(performanceSummary(state));
    const twin = played(20, 3);
    expect(performanceSummary(twin).line).toBe(performanceSummary(state).line);
  });

  it('reports counts, not ratios', () => {
    const state = played(20, 3);
    const summary = performanceSummary(state);
    expect(summary.notes).toBe(23);
    expect(summary.hits).toBe(20);
    expect(summary.misses).toBe(3);
    expect(summary.bestStreak).toBe(20);
    expect(summary.crowd).toBe(crowdFor(state.peakWarmth));
    expect(Object.keys(summary)).not.toContain('accuracy');
    expect(Object.keys(summary)).not.toContain('score');
  });

  it('reads a corrupted state without producing NaN', () => {
    const state = createPerformance();
    state.coins = Number.NaN;
    state.hits = Number.NaN;
    const summary = performanceSummary(state);
    expect(summary.coins).toBe(0);
    expect(summary.hits).toBe(0);
    expect(summary.notes).toBe(0);
  });
});
