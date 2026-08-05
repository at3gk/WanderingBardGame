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
  glyphEnvelope,
  headHalfSteps,
  laneSpan,
  painterlyConstant,
  paperBottomClearanceM,
  paperEdges,
  ribbonLayout,
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
 * The staff draws exactly five rule lines. Not four, and not six.
 *
 * This exists to settle a dispute no screenshot could: two visual critics
 * pixel-counted SIX staff lines on the shipped build, with coordinates, and
 * three counted five. Both were looking at real pixels. The geometry was the
 * only witness that could rule — so it is walked here, for every tune the
 * songbook can put on the road, at EVERY column of the ribbon and through
 * both margins, and asserted to carry exactly five ink bands, each centred
 * on a printed line step.
 *
 * The sixth "line" has now been settled twice, and the two verdicts differ,
 * which is why this block grew:
 *
 * - At the TOP it was the paper's own dissolve boundary rendered crisp
 *   enough to counterfeit a rule (for a G5 tune it sat almost exactly one
 *   staff space above the top line). The slope test keeps any fade from
 *   ever being that steep again.
 * - At the BOTTOM, the wave-3 panel counted six while every test here
 *   passed — because the stroke was never the ribbon's. Ablation proved it:
 *   hide the ribbon and the stroke stays, same row, same darkness. It is
 *   the road's dark wheel-rut, WRAPPED by the translucent bottom margin,
 *   and a dark stroke framed by ruled paper reads as a rule whoever drew
 *   it. No walk of this geometry can see that composite — what it CAN see
 *   is the reach that made it possible, so the clearance test at the end
 *   pins the paper's bottom edge clear of the road and the strokes the road
 *   carries.
 */
describe('the ribbon prints exactly five staff lines', () => {
  /** B4, the middle line — rows are measured in steps from it. */
  const MIDDLE = 6;
  const LINE_STEPS = [2, 4, 6, 8, 10];
  const arcM = laneSpan().arcM;

  const cases: Array<[string, { low: number; high: number }]> = [
    ['the bare staff', paperEdges(Infinity, -Infinity)],
    ...SONGS.map((song): [string, { low: number; high: number }] => {
      const { lowest, highest } = rangeOf(song.notes);
      return [song.title, paperEdges(lowest, highest)];
    }),
  ];

  /** Contiguous runs of ink rows at a column, as [firstRow, lastRow] heights. */
  function inkBands(layout: ReturnType<typeof ribbonLayout>, c: number): Array<[number, number]> {
    const bands: Array<[number, number]> = [];
    let start: number | null = null;
    for (let r = 0; r < layout.rows.length; r++) {
      if (layout.ink(r, c)) {
        if (start === null) start = layout.rows[r];
      } else if (start !== null) {
        bands.push([start, layout.rows[r - 1]]);
        start = null;
      }
    }
    if (start !== null) bands.push([start, layout.rows[layout.rows.length - 1]]);
    return bands;
  }

  /** The column nearest a given share of the arc. */
  function colNear(cols: number[], arc: number): number {
    let best = 0;
    for (let c = 0; c < cols.length; c++) if (Math.abs(cols[c] - arc) < Math.abs(cols[best] - arc)) best = c;
    return best;
  }

  for (const [name, edges] of cases) {
    it(`draws five rules and only five for ${name}, at every column of the run`, () => {
      // Every column, not a sampled one: the wave-3 bottom stroke taught
      // that a test which walks less than the eye sees settles nothing.
      // Each column is either open run — exactly five bands, each centred
      // on a printed line — or the barline, one band spanning the staff
      // and stopping at its outer lines. There is no third shape a column
      // is allowed to have.
      const layout = ribbonLayout(edges.low, edges.high, arcM);
      for (let c = 0; c < layout.cols.length; c++) {
        const bands = inkBands(layout, c);
        if (bands.length === 1) {
          // The barline. Ink past the outer lines would BE a sixth line.
          expect(bands[0][0]).toBeGreaterThanOrEqual(LINE_STEPS[0] - MIDDLE - 0.2);
          expect(bands[0][1]).toBeLessThanOrEqual(LINE_STEPS[4] - MIDDLE + 0.2);
          expect(bands[0][0]).toBeLessThanOrEqual(LINE_STEPS[0] - MIDDLE + 0.2);
          expect(bands[0][1]).toBeGreaterThanOrEqual(LINE_STEPS[4] - MIDDLE - 0.2);
        } else {
          expect(bands.length).toBe(5);
          for (let b = 0; b < 5; b++) {
            const centre = (bands[b][0] + bands[b][1]) / 2 + MIDDLE;
            expect(centre).toBeCloseTo(LINE_STEPS[b], 5);
          }
        }
      }
    });

    it(`dissolves its margins too gently to counterfeit a rule, for ${name}`, () => {
      // A rule's shoulder climbs about 18 units of alpha per step; the fade
      // that once read as a sixth line climbed 1.2. Everything outside the
      // ink must stay an order of magnitude below the shoulder — a gradient
      // the eye reads as dissolve, never as mark. Checked at every column,
      // both margins: the bottom fade is shorter than the top's and has to
      // clear the same pin.
      const layout = ribbonLayout(edges.low, edges.high, arcM);
      for (let c = 0; c < layout.cols.length; c++) {
        for (let r = 0; r + 1 < layout.rows.length; r++) {
          if (layout.ink(r, c) || layout.ink(r + 1, c)) continue;
          const dy = layout.rows[r + 1] - layout.rows[r];
          if (dy < 1e-6) continue;
          const slope = Math.abs(layout.alpha(r + 1, c) - layout.alpha(r, c)) / dy;
          expect(slope).toBeLessThanOrEqual(0.65);
        }
      }
    });

    it(`fades both margins monotonically for ${name} — no structure out there to count`, () => {
      // A margin that dipped and recovered would put a dark band over a
      // bright sky, or a bright band over dark ground — either is a mark,
      // and a mark parallel to the staff is a line. Above the top rule the
      // paper may only ever get thinner going up; below the bottom rule,
      // only thinner going down.
      const layout = ribbonLayout(edges.low, edges.high, arcM);
      const c = colNear(layout.cols, arcM * 0.3);
      const topRule = LINE_STEPS[4] - MIDDLE;
      const bottomRule = LINE_STEPS[0] - MIDDLE;
      for (let r = 0; r + 1 < layout.rows.length; r++) {
        if (layout.rows[r] >= topRule) {
          expect(layout.alpha(r + 1, c)).toBeLessThanOrEqual(layout.alpha(r, c) + 1e-9);
        }
        if (layout.rows[r + 1] <= bottomRule) {
          expect(layout.alpha(r, c)).toBeLessThanOrEqual(layout.alpha(r + 1, c) + 1e-9);
        }
      }
    });
  }

  it('keeps the paper\'s bottom edge clear of the road, at every notation scale', () => {
    // The wave-3 "sixth line at the bottom" was the road's own dark
    // wheel-rut showing through the translucent bottom margin — the ribbon's
    // geometry was clean both times it was put on the witness stand, and no
    // walk of it can see a composite of paper over world. What the geometry
    // CAN promise is reach: the paper's lowest dissolving row stays high
    // enough above the road that the road's ink is never wrapped in ruled
    // paper. Measured on the wave-3 frames, the rut band the panel counted
    // sat in the screen band the margin vacates at 0.40 m of clearance.
    const { lowest } = songbookRange();
    // Desktop draws the notation at scale 1; the pin is against the frames
    // the panel actually photographs.
    expect(paperBottomClearanceM(lowest, 1)).toBeGreaterThanOrEqual(0.4);
    // A phone's enlarged staff reaches proportionally further down. It may
    // come nearer the road than the desktop staff, but never touch it —
    // paper meeting the ground would read as a fence with its feet in the
    // mud, and would wrap every stroke the roadside carries.
    expect(paperBottomClearanceM(lowest, 1.3)).toBeGreaterThanOrEqual(0.15);
  });
});

/**
 * The approach envelope: the note at the barline is the boldest thing on the
 * ribbon, and a note is readable for the whole of its final approach.
 *
 * The wave-2 critique found the inverse shipped — the note to tap NOW was
 * the least legible mark on the lane, half-dissolved at the hit moment,
 * while mid-flight notes rode at full strength — and separately that a note
 * fading in at full size next to its same-pitch predecessor read as a ghost
 * duplicate. These pin the envelope that answers both.
 *
 * The old blanket pin here — full nominal presence (alpha 0.7, scale 0.95)
 * for the entire last 1500 ms — was re-derived by task 184's headgap
 * measurement: it held the envelope saturated through the lane's
 * perspective-compressed far stretch, where a nominal 0.95 projects too
 * small to read anyway, and full-size fully-lit heads there measured as
 * geometrically fused pairs on every viewport. Nominal-space blanket
 * claims measure the wrong space (the same failure the laneSpan spacing
 * claim died of). The contract is now tiered the way the eye actually
 * meets an approaching note: legible-and-climbing at 1000 ms out, plainly
 * readable at 600 ms, near-full through the scaffold's 350 ms answer
 * window (`SUPPORT_LEAD_MS`'s floor — the reveal must land on a strong
 * head). Each tier stated against TRAVEL_TIME_MS so a re-timed flight
 * moves the pins with it.
 */
describe('the imminent note is the most legible thing on the ribbon', () => {
  const atLeadMs = (ms: number) => 1 - ms / TRAVEL_TIME_MS;

  it('arrives at full ink and its largest size exactly at the barline', () => {
    const atBar = glyphEnvelope(1);
    expect(atBar.alpha).toBeCloseTo(1, 6);
    const cruise = glyphEnvelope(0.5);
    expect(atBar.alpha).toBeGreaterThan(cruise.alpha);
    expect(atBar.scale).toBeGreaterThan(cruise.scale);
  });

  it('is legible and climbing from 1000 ms out', () => {
    for (let p = atLeadMs(1000); p <= 1.0001; p += 0.01) {
      const env = glyphEnvelope(p);
      expect(env.alpha).toBeGreaterThanOrEqual(0.55);
      expect(env.scale).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('is plainly readable from 600 ms out', () => {
    for (let p = atLeadMs(600); p <= 1.0001; p += 0.01) {
      const env = glyphEnvelope(p);
      expect(env.alpha).toBeGreaterThanOrEqual(0.7);
      expect(env.scale).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('is at near-full presence through the scaffold answer window', () => {
    for (let p = atLeadMs(350); p <= 1.0001; p += 0.01) {
      const env = glyphEnvelope(p);
      expect(env.alpha).toBeGreaterThanOrEqual(0.85);
      expect(env.scale).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('never carries a full-size head through the far half, where projection compresses', () => {
    // The task-184 lever: nominal growth must still be under way while the
    // projection is compressing, or full-size heads fuse in the far lane.
    expect(glyphEnvelope(0.5).scale).toBeLessThanOrEqual(0.8);
    expect(glyphEnvelope(0.25).alpha).toBeLessThanOrEqual(0.45);
  });

  it('only ever grows on the way in — urgency runs the same direction as time', () => {
    let prev = glyphEnvelope(0);
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const env = glyphEnvelope(p);
      expect(env.alpha).toBeGreaterThanOrEqual(prev.alpha - 1e-9);
      expect(env.scale).toBeGreaterThanOrEqual(prev.scale - 1e-9);
      prev = env;
    }
  });

  it('is born small and dim, so a newcomer cannot ghost its neighbour', () => {
    const born = glyphEnvelope(0.03);
    expect(born.alpha).toBeLessThan(0.25);
    expect(born.scale).toBeLessThan(0.8);
  });

  it('holds its arrival strength past the barline rather than snapping back', () => {
    const past = glyphEnvelope(1.2);
    const atBar = glyphEnvelope(1);
    expect(past.alpha).toBeCloseTo(atBar.alpha, 9);
    expect(past.scale).toBeCloseTo(atBar.scale, 9);
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

// ---------------------------------------------------------------------------
// Book Two: the signature on the paper (task 165)
// ---------------------------------------------------------------------------

import { signatureGlyphs } from './SongNotes';
import { majorKey } from '../../core/notation';

describe('the key signature is engraved, not improvised', () => {
  it('draws nothing for Book One — null or C major', () => {
    expect(signatureGlyphs(null)).toEqual([]);
    expect(signatureGlyphs({ fifths: 0 })).toEqual([]);
  });

  it('engraves G major as one sharp on the F5 line', () => {
    expect(signatureGlyphs(majorKey('G'))).toEqual([{ cell: 29, step: 10 }]);
  });

  it('engraves the sharps in entry order at the standard treble steps', () => {
    const steps = signatureGlyphs(majorKey('E')).map((m) => m.step);
    expect(steps).toEqual([10, 7, 11, 8]); // F5 C5 G5 D5
    expect(new Set(signatureGlyphs(majorKey('E')).map((m) => m.cell))).toEqual(new Set([29]));
  });

  it('engraves the flats in entry order, all with the flat mark', () => {
    const marks = signatureGlyphs(majorKey('Ab'));
    expect(marks.map((m) => m.step)).toEqual([6, 9, 5, 8]); // B4 E5 A4 D5
    expect(new Set(marks.map((m) => m.cell))).toEqual(new Set([30]));
  });

  it('never carries more marks than the paper reserves instances for', () => {
    for (const name of ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab']) {
      expect(signatureGlyphs(majorKey(name)).length).toBeLessThanOrEqual(4);
    }
  });
});
