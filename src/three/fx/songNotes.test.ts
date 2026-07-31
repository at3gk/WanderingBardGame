/**
 * The things about the song lane that cannot be judged from a frame.
 *
 * Most properties of this object — whether it sits well in the light, whether
 * it dominates the composition, whether the ink reads — are questions a
 * screenshot answers, and the visual harness answers them. These are the ones
 * it cannot:
 *
 * - the paper is sized to the *tune currently on the road*, and most frames
 *   show a tune sitting comfortably inside the staff, so paper that has been
 *   trimmed too far looks fine until the one bar that needs a ledger line
 *   arrives. A clipped pitch is the mechanic failing.
 * - the notation's own spacing is set by the fastest bar the songbook can
 *   ask for on the hurrying-est instrument, and nobody poses that bar.
 * - the lane's shape has to keep it off the road and turned enough toward the
 *   eye to be read, at every aspect ratio, and the frame that would show a
 *   violation is the frame nobody shoots.
 *
 * They are written against the songbook and against `core/scaffold.ts` rather
 * than against hardcoded numbers, so adding a tune that reaches higher — or
 * changing how long a letter is revealed for — fails here rather than in a
 * screenshot nobody takes.
 */
import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import {
  FLOOR_WARMTH,
  PAINTERLY_CONSTANTS,
  headHalfSteps,
  laneSpan,
  painterlyConstant,
  paperEdges,
  sideEase,
  unitLuminance,
} from './SongNotes';
import { createPainterlyGlobals, createPainterlyMaterial } from '../painterly';
import { SONGS } from '../../core/songs';
import { staffStepAt } from '../../core/notation';
import { TRAVEL_TIME_MS, beatIntervalMs } from '../../core/beats';
import { INSTRUMENTS } from '../../core/instruments';
import { SUPPORT_LEAD_MS } from '../../core/scaffold';

/**
 * The tempo the tune runs at, which lives in `RoadStage.ts` as `BASE_BPM` and
 * is not exported. Restated here rather than imported because this file is
 * about the *lane*, and reaching into the stage for one number would couple
 * the notation's geometry to the scene that happens to drive it. If the tune
 * is ever re-pitched, this is the line that has to follow it — and the
 * assertions below carry enough margin to say so loudly rather than quietly.
 */
const BASE_BPM = 92;

/** The five printed lines of a treble staff, in diatonic steps. */
const LOWEST_LINE = 2;
const HIGHEST_LINE = 10;

function rangeOf(notes: readonly { semitone: number }[]): { lowest: number; highest: number } {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const note of notes) {
    const step = staffStepAt(note.semitone);
    if (step === null) continue;
    lowest = Math.min(lowest, step);
    highest = Math.max(highest, step);
  }
  return { lowest, highest };
}

function songbookRange(): { lowest: number; highest: number } {
  return rangeOf(SONGS.flatMap((song) => song.notes));
}

describe('the paper is sized to the tune, and never smaller than the tune', () => {
  for (const song of SONGS) {
    it(`carries every note of ${song.title}, head and ledger line and all`, () => {
      const { lowest, highest } = rangeOf(song.notes);
      const edges = paperEdges(lowest, highest);
      // Full-strength paper has to reach past the note's *head*, not just its
      // centre: half a head, and the ledger line a low or high note wears,
      // both live out there. Anything less and a pitch is read off a rule
      // that is already dissolving.
      expect(edges.low).toBeLessThanOrEqual(lowest - headHalfSteps());
      expect(edges.high).toBeGreaterThanOrEqual(highest + headHalfSteps());
    });
  }

  it('always prints all five lines, whatever the tune is doing', () => {
    // A treble staff with four lines showing is not a treble staff. A tune
    // that never leaves the middle of the stave must not shrink the paper
    // onto the notes it happens to use — the child reads pitch off line
    // positions, and that needs the lines it is *not* using too.
    const edges = paperEdges(LOWEST_LINE + 2, HIGHEST_LINE - 2);
    expect(edges.low).toBeLessThanOrEqual(LOWEST_LINE);
    expect(edges.high).toBeGreaterThanOrEqual(HIGHEST_LINE);
  });

  it('is narrower for a mid-staff tune than for the whole songbook', () => {
    // The point of the whole arrangement, and the thing a regression would
    // quietly undo by going back to one fixed reserve. The plank this
    // replaced sized its margins for Old MacDonald's A5 and Mary's C4 at all
    // times, which was 45 per cent of its height blank in most frames.
    const book = paperEdges(songbookRange().lowest, songbookRange().highest);
    const middling = paperEdges(LOWEST_LINE + 1, HIGHEST_LINE - 1);
    expect(middling.high - middling.low).toBeLessThan(book.high - book.low);
  });

  it('degrades to the bare staff when a schedule has no pitched notes at all', () => {
    // `setBeats` hands in ±Infinity when every beat is a rest, which is not a
    // schedule the songbook can produce today and is exactly the sort of
    // thing that reaches a shipped build as a NaN-shaped hole in the geometry.
    const edges = paperEdges(Infinity, -Infinity);
    expect(Number.isFinite(edges.low)).toBe(true);
    expect(Number.isFinite(edges.high)).toBe(true);
    expect(edges.low).toBeLessThan(LOWEST_LINE);
    expect(edges.high).toBeGreaterThan(HIGHEST_LINE);
  });
});

/**
 * The lane's length, which is the number every critique of the shape before
 * this one actually asked to change.
 */
describe('the lane is as short as the notation lets it be', () => {
  it('reaches past where a gone-by note comes to rest', () => {
    // A critic once measured the drifted-past note falling off the old
    // plank's edge and retracted it. It does not fall off — but the margin is
    // small, so anything taken off the tail ships the fault for real.
    const span = laneSpan();
    expect(span.tailM).toBeGreaterThanOrEqual(span.driftedNoteReach);
  });

  it('keeps the tightest pair of note heads the songbook can ask for apart', () => {
    // The tightest pair the game can draw: the shortest note in the book, at
    // the tempo of the instrument that hurries the most.
    let shortestBeats = Infinity;
    for (const song of SONGS) {
      for (const note of song.notes) shortestBeats = Math.min(shortestBeats, note.beats);
    }
    const fastest = Math.max(...INSTRUMENTS.map((i) => i.tempoFeel));
    const tightestGapMs = shortestBeats * beatIntervalMs(BASE_BPM * fastest);

    // Below this gap two heads print on top of each other. Two note heads
    // overlapping is not notation, and the child is being asked to read the
    // pitch off exactly those heads.
    const span = laneSpan();
    expect(span.gapAtWhichHeadsTouchMs).toBeLessThan(tightestGapMs);
    // And with enough daylight left that they read as two marks rather than
    // as a smear: a fifth of a head between them at the worst case. This is
    // the assertion that fails if someone shortens the lane, which is what
    // every composition critique of this object has asked for.
    expect(span.gapAtWhichHeadsTouchMs * 1.2).toBeLessThan(tightestGapMs);
    // And again for the screen that squeezes it hardest: a phone held upright
    // gets the shortest lane the aspect fan allows *and* the largest notation
    // the pixel floor allows, which are the two things that push heads
    // together. Nobody screenshots that bar on that device.
    expect(span.narrowGapAtWhichHeadsTouchMs * 1.2).toBeLessThan(tightestGapMs);
  });
});

/**
 * The lane's shape: where it runs, and how far it is turned toward the eye.
 *
 * Two failures live here and neither is visible in a frame that happens to be
 * posed well. A lane that drifts back onto the road puts notation across the
 * one thing the composition is built around; a lane that straightens out to
 * road-parallel is seen exactly edge-on from a camera standing on the road,
 * and disappears.
 */
describe('the lane stays off the road and turned toward the eye', () => {
  it('runs entirely on the road\'s left, at every aspect ratio', () => {
    // Both figures are the worst case across the aspect fan. Other files rely
    // on this: the lane lives on one side of the road, so anything placed on
    // the other side — the bard included — is never behind it.
    const span = laneSpan();
    expect(span.nearSideM).toBeGreaterThan(0);
    expect(span.farSideM).toBeGreaterThan(0);
  });

  it('clears the bard at the barline even on the narrowest screen', () => {
    // The barline stands where the arriving note has to be readable, which
    // means it cannot be behind the person playing it. Half a bard across the
    // shoulders is about 0.23 m; half a note head is the rest.
    const span = laneSpan();
    expect(span.nearSideM).toBeGreaterThan(0.23 + span.headWidth / 2);
  });

  it('leaves the barline at a real angle to the road, and never straightens to parallel', () => {
    // The angle at the barline is what makes a note *cross* the hit line
    // rather than merely grow on the way in; the angle at the far end is what
    // keeps the ribbon from being edge-on, which is how the very first
    // version of this idea failed.
    const span = laneSpan();
    expect(span.nearAngleDeg).toBeGreaterThan(16);
    expect(span.nearAngleDeg).toBeLessThan(45);
    expect(span.farAngleDeg).toBeGreaterThan(3);
    // And the near end is always the turned-toward-you end. A lane that
    // straightened at the barline and fanned in the distance would put its
    // readable stretch where nobody is reading.
    expect(span.nearAngleDeg).toBeGreaterThan(span.farAngleDeg * 2);
  });

  it('fans out monotonically — a lane that doubled back would fold its own staff', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 40; i++) {
      const value = sideEase(i / 40);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(sideEase(0)).toBeCloseTo(0, 9);
    expect(sideEase(1)).toBeCloseTo(1, 9);
  });
});

/**
 * The one place the lane's geometry touches the learning model.
 *
 * `scaffold.ts` reveals a note's letter somewhere between 350 ms and the whole
 * 1800 ms flight before the hit, depending on how much support that staff
 * position has earned. The letter itself rides on the note head, which is a
 * billboard and is drawn for the whole flight — but the letter is read
 * *against the staff*, and the staff is on paper that dissolves toward the far
 * end. If the paper faded early enough, the top support bands would quietly
 * stop meaning anything.
 */
describe('the paper is present for as much of the flight as the scaffold promises', () => {
  it('carries full-strength staff through the second support band', () => {
    const fullMs = laneSpan().paperFullShare * TRAVEL_TIME_MS;
    expect(fullMs).toBeGreaterThanOrEqual(SUPPORT_LEAD_MS[1]);
  });

  it('carries at least half-strength staff through the third', () => {
    // The paper does not stop where it stops being at full strength — it
    // dissolves over the rest of the lane, and a rule at half opacity is
    // still a rule you can read a note's position off. Half strength is
    // where that stops being obviously true, so that is the point the
    // longer support bands are measured against.
    const halfMs = laneSpan().paperHalfShare * TRAVEL_TIME_MS;
    expect(halfMs).toBeGreaterThanOrEqual(SUPPORT_LEAD_MS[2]);
  });

  it('carries it well past the reveal floor, which is the one that must never be missed', () => {
    // The floor exists so a child always sees the answer in the same glance
    // as the tap. Paper that had gone by then would answer the question into
    // thin air.
    const fullMs = laneSpan().paperFullShare * TRAVEL_TIME_MS;
    expect(fullMs).toBeGreaterThan(SUPPORT_LEAD_MS[0] * 2);
  });
});

/**
 * Whether the two halves of this object are lit by the same model.
 *
 * The paper and the notes run two different shaders — one needs per-vertex
 * opacity, the other needs a glyph atlas, and `painterly.ts`'s material offers
 * neither — so the world's lighting model is evaluated here rather than there.
 * For most of the project's life the constants were copied across, and one of
 * them drifted and stayed drifted: `AMBIENT_STRENGTH` came down to 0.27 in
 * `painterly.ts` while the copy here stayed at 0.32, so the notes predicted a
 * world 19 per cent brighter than the shader was painting and `LIGHT_FLOOR`
 * fired late and small at exactly the dark hours it exists for. Nothing
 * failed, nothing looked obviously wrong, and it survived a wave of visual
 * critique.
 *
 * They are read out of the shader source now rather than copied. These tests
 * are what makes that safe.
 */
describe('the lane reads its lighting model rather than copying it', () => {
  const source = createPainterlyMaterial(createPainterlyGlobals(), {
    vertexColors: true,
  }).fragmentShader;

  for (const [name, recorded] of Object.entries(PAINTERLY_CONSTANTS)) {
    it(`finds ${name} in the painterly shader, and the fallback still matches it`, () => {
      // A sentinel no shader constant would ever be, so "found" and "fell
      // back" cannot be confused — the failure this whole arrangement is
      // guarding against is a silent fallback.
      const sentinel = -12345;
      const found = painterlyConstant(source, name, sentinel);
      expect(found).not.toBe(sentinel);
      expect(found).toBeCloseTo(recorded, 6);
    });
  }

  it('will not match a #define that does not start a line', () => {
    // Three's own preprocessor only substitutes an `#include` that starts a
    // line, and a probe in this project that ignored that quietly measured
    // nothing for a round. A directive mid-line is not a directive, and a
    // reader that matched one would happily pick up a number out of a
    // comment or a string.
    expect(painterlyConstant('float x = 1.0; #define SUN_STRENGTH 9.5', 'SUN_STRENGTH', 0.92)).toBe(
      0.92,
    );
    expect(painterlyConstant('// see #define SUN_STRENGTH 9.5 above', 'SUN_STRENGTH', 0.92)).toBe(
      0.92,
    );
    // …and it must still see its own success case, indented or not.
    expect(painterlyConstant('#define SUN_STRENGTH 9.5', 'SUN_STRENGTH', 0.92)).toBe(9.5);
    expect(painterlyConstant('  #define SUN_STRENGTH 9.5\n', 'SUN_STRENGTH', 0.92)).toBe(9.5);
  });
});

/**
 * The floor is quoted in relative luminance, so it has to be *paid* in
 * relative luminance.
 *
 * It was not. The lift was added as `FLOOR_WARMTH * lift`, and `FLOOR_WARMTH`
 * carries 0.7196 of a unit of luminance per unit of itself, so the surface
 * received 72 per cent of the light `LIGHT_FLOOR` promised — worst at the
 * darkest hours, where the lift is nearly all of the light there is. This is
 * the arithmetic that says so.
 */
describe('the light floor is paid in the units it is quoted in', () => {
  const luma = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it('records the shortfall that made this necessary', () => {
    // The bug, preserved as a number so nobody has to rediscover it.
    expect(luma(new Color(FLOOR_WARMTH))).toBeCloseTo(0.7196, 3);
  });

  it('normalises the lamplight to carry exactly one unit of luminance', () => {
    expect(luma(unitLuminance(new Color(FLOOR_WARMTH)))).toBeCloseTo(1, 6);
  });

  it('leaves the hue exactly where it was — this is a scale, not a tint', () => {
    const raw = new Color(FLOOR_WARMTH);
    const paid = unitLuminance(new Color(FLOOR_WARMTH));
    expect(paid.r / paid.g).toBeCloseTo(raw.r / raw.g, 9);
    expect(paid.g / paid.b).toBeCloseTo(raw.g / raw.b, 9);
  });

  it('cannot divide by a black lamp', () => {
    const black = unitLuminance(new Color(0x000000));
    expect(Number.isFinite(black.r + black.g + black.b)).toBe(true);
  });
});
