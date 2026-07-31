/**
 * The staging, checked through the camera that actually shoots it.
 *
 * A placement test that only asserts things about bearings and radii would
 * have passed every version of this arrangement that has ever been wrong,
 * because every one of them was defensible in metres and broken in pixels.
 * So this drives the real `CameraRig` into the real mood, settles it, and
 * projects each staged figure through the real projection matrix.
 *
 * The two screen constants below are measurements off the live game, taken
 * with `tools/staging-probe.mjs` at the poses `tools/postcard.mjs` shoots
 * (`05-golden-busk`, s = 940, and `06-dusk-encounter`, s = 1120). Nothing in
 * this file can measure the staff ribbon itself — it is drawn from a live
 * tune's schedule — so its screen box is pinned here as data, and the probe
 * is what re-measures it if the notation ever moves.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CameraRig, type CameraMood } from './CameraRig';
import {
  BUSK_FACING_OFFSET,
  BUSK_LISTENER_SLOTS,
  BUSK_SLOT_JITTER,
  MEETING_BEARING,
  MEETING_RADIUS,
  withinBand,
  type StagedSpot,
} from './roadStaging';

/** The shot every busk framing decision in this project has been judged on. */
const VIEWPORT = { width: 1600, height: 900 };

/**
 * The staff ribbon's share of the busking frame, measured through the live
 * camera. Anything landing inside this has notation drawn across it.
 */
const STAFF_BOX = { x0: 0.128, x1: 0.406, y0: 0.341, y1: 0.691 };

/** Half the width of the bard's own column in the frame, measured. */
const BARD_COLUMN_HALF = 0.055;

/**
 * Settle the rig into a mood over a subject standing still on flat ground.
 *
 * Six seconds at 60 Hz is far past the slowest smoothing in the file (1.6 s)
 * and matches what the postcard harness gets after `rig.reset()`. `posed` is
 * not available from here, so the drift and sway are still running; they are
 * under 0.15 m and 0.05 rad and every margin asserted below is far larger.
 */
function settled(mood: CameraMood, heading: number) {
  const rig = new CameraRig();
  rig.applyAspect(VIEWPORT.width, VIEWPORT.height);
  const subject = { position: new Vector3(0, 0, 0), heading };
  rig.setMood(mood, 0);
  for (let i = 0; i < 360; i++) rig.update(subject, 1 / 60, null);
  rig.camera.updateMatrixWorld(true);
  return rig.camera;
}

/** Where a figure standing at `spot` lands in the frame, 0..1 from top left. */
function screen(
  camera: ReturnType<typeof settled>,
  heading: number,
  spot: StagedSpot,
  height: number,
) {
  const angle = heading + spot.bearing;
  const v = new Vector3(
    Math.sin(angle) * spot.radius,
    height,
    Math.cos(angle) * spot.radius,
  );
  v.project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, depth: v.z };
}

/** Every corner of a slot's jitter box, plus its centre. */
function corners(spot: StagedSpot): StagedSpot[] {
  const out: StagedSpot[] = [];
  for (const db of [-BUSK_SLOT_JITTER.bearing, 0, BUSK_SLOT_JITTER.bearing]) {
    for (const dr of [-BUSK_SLOT_JITTER.radius, 0, BUSK_SLOT_JITTER.radius]) {
      out.push({ bearing: spot.bearing + db, radius: spot.radius + dr });
    }
  }
  return out;
}

/**
 * Headings covering both signs and the wrap. The whole arrangement is stated
 * relative to the bard, so nothing here may depend on which way the road runs
 * — and an arrangement that only composes on a north-south road is a bug that
 * would show up as "the crowd is wrong on some days".
 */
const HEADINGS = [0, 0.4, -0.4, 1.1, -1.1, 2.9, -2.9, Math.PI];

describe('the busk crowd, through the busking camera', () => {
  it('stands every listener inside the frame with a margin', () => {
    for (const heading of HEADINGS) {
      const camera = settled('busking', heading);
      for (const slot of BUSK_LISTENER_SLOTS) {
        for (const spot of corners(slot)) {
          const chest = screen(camera, heading, spot, 0.85);
          const feet = screen(camera, heading, spot, 0);
          const head = screen(camera, heading, spot, 1.5);
          expect(chest.depth).toBeLessThan(1);
          expect(chest.x).toBeGreaterThan(0.05);
          expect(chest.x).toBeLessThan(0.95);
          expect(head.y).toBeGreaterThan(0.05);
          expect(feet.y).toBeLessThan(0.95);
        }
      }
    }
  });

  it('keeps every listener clear of the staff ribbon', () => {
    // Stated as "right of the ribbon" rather than "outside its box": the
    // ribbon runs up the road into the distance, so a figure level with it
    // vertically is the normal case and the horizontal clearance is the only
    // one worth having.
    for (const heading of HEADINGS) {
      const camera = settled('busking', heading);
      for (const slot of BUSK_LISTENER_SLOTS) {
        for (const spot of corners(slot)) {
          const chest = screen(camera, heading, spot, 0.85);
          expect(chest.x).toBeGreaterThan(STAFF_BOX.x1 + 0.02);
        }
      }
    }
  });

  it('never hides a listener behind the bard', () => {
    for (const heading of HEADINGS) {
      const camera = settled('busking', heading);
      const bard = screen(camera, heading, { bearing: 0, radius: 0 }, 0.85);
      for (const slot of BUSK_LISTENER_SLOTS) {
        for (const spot of corners(slot)) {
          const chest = screen(camera, heading, spot, 0.85);
          expect(Math.abs(chest.x - bard.x)).toBeGreaterThan(BARD_COLUMN_HALF);
        }
      }
    }
  });

  it('separates the slots from each other on screen', () => {
    // Two figures at the same screen position are one figure. Depth is what
    // makes slot 3 legal at a smaller horizontal gap than the rest: it stands
    // a metre and a half further back than its neighbours, so it reads as a
    // second rank rather than as an overlap.
    const heading = 0.4;
    const camera = settled('busking', heading);
    for (let i = 0; i < BUSK_LISTENER_SLOTS.length; i++) {
      for (let j = i + 1; j < BUSK_LISTENER_SLOTS.length; j++) {
        const a = BUSK_LISTENER_SLOTS[i];
        const b = BUSK_LISTENER_SLOTS[j];
        const gap = Math.abs(
          screen(camera, heading, a, 0.85).x - screen(camera, heading, b, 0.85).x,
        );
        const depth = Math.abs(a.radius - b.radius);
        expect(gap > 0.09 || depth > 1).toBe(true);
      }
    }
  });

  it('grows the arc outward as listeners arrive', () => {
    // The crowd model fills slots in order, so the *first* two have to be the
    // pair that composes on their own — one either side of the bard — and
    // every later one has to widen the group rather than move it.
    const heading = 0;
    const camera = settled('busking', heading);
    const bard = screen(camera, heading, { bearing: 0, radius: 0 }, 0.85).x;
    const first = screen(camera, heading, BUSK_LISTENER_SLOTS[0], 0.85).x;
    const second = screen(camera, heading, BUSK_LISTENER_SLOTS[1], 0.85).x;
    expect(Math.sign(first - bard)).not.toBe(Math.sign(second - bard));
  });

  it('turns the bard toward the arc without putting the camera behind him', () => {
    // The busking camera stands this far round from the bard's forward. The
    // turn must not carry it to pi, which is where the instrument he is
    // playing disappears into his own silhouette.
    const cameraBearing = Math.atan2(2.7, -3.9);
    const behind = Math.abs(cameraBearing - BUSK_FACING_OFFSET);
    expect(behind).toBeLessThan(Math.PI - 0.25);
    // And it has to be a turn *into* the group, not away from it.
    const centre =
      BUSK_LISTENER_SLOTS.reduce((sum, s) => sum + s.bearing, 0) / BUSK_LISTENER_SLOTS.length;
    expect(Math.sign(BUSK_FACING_OFFSET)).toBe(Math.sign(centre));
    expect(Math.abs(BUSK_FACING_OFFSET)).toBeLessThan(Math.abs(centre));
  });
});

describe('somebody met, through the encounter camera', () => {
  const band = (t: number): StagedSpot => ({
    bearing: withinBand(MEETING_BEARING, t),
    radius: withinBand(MEETING_RADIUS, t),
  });
  /** Both ends of each band and the unlucky corners where they disagree. */
  const CASES: StagedSpot[] = [
    band(0),
    band(0.5),
    band(1),
    { bearing: MEETING_BEARING[0], radius: MEETING_RADIUS[1] },
    { bearing: MEETING_BEARING[1], radius: MEETING_RADIUS[0] },
  ];

  it('stands them where the frame is already looking', () => {
    // `CameraRig`'s encounter framing swings its look target toward negative
    // bearings. A traveller placed on the other side is a traveller the shot
    // was composed to exclude.
    for (const spot of CASES) expect(spot.bearing).toBeLessThan(0);
  });

  it('puts them in frame, clear of the bard, at a legible size', () => {
    for (const heading of HEADINGS) {
      const camera = settled('encounter', heading);
      const bard = screen(camera, heading, { bearing: 0, radius: 0 }, 0.85);
      for (const spot of CASES) {
        const feet = screen(camera, heading, spot, 0);
        const head = screen(camera, heading, spot, 1.5);
        const chest = screen(camera, heading, spot, 0.85);
        expect(chest.depth).toBeLessThan(1);
        expect(chest.x).toBeGreaterThan(0.08);
        expect(chest.x).toBeLessThan(0.94);
        expect(head.y).toBeGreaterThan(0.05);
        expect(feet.y).toBeLessThan(0.95);
        // Two people in a frame, not a person and a speck: a metre and a half
        // of figure has to be worth at least a quarter of the frame's height.
        expect(feet.y - head.y).toBeGreaterThan(0.25);
        // And they must not be standing on him.
        expect(Math.abs(chest.x - bard.x)).toBeGreaterThan(0.09);
      }
    }
  });

  it('is a conversational distance rather than a wave across a field', () => {
    expect(MEETING_RADIUS[0]).toBeGreaterThan(2.2);
    expect(MEETING_RADIUS[1]).toBeLessThan(3.6);
  });
});
