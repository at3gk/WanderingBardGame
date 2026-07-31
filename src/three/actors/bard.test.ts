/**
 * The seated pose, pinned.
 *
 * These exist because the seated bard has been re-diagnosed three times off
 * screenshots and twice re-tuned in the wrong place, and nothing in the
 * project could tell anyone what the rig was actually doing. Both facts
 * below were measured off a live frame before they were written down here:
 * the thighs come out within seven degrees of horizontal, and the left hand
 * lands on the neck of the instrument to within two centimetres.
 *
 * They are written against the *world* transform of the parts rather than
 * against the constants, so a change to `SIT_PELVIS`, `SIT_THIGH`, the knee
 * derivation or the pivot hierarchy has to keep the result rather than keep
 * the arithmetic. That is the whole point: an earlier wave changed a camera
 * angle to fix a pose problem that a check like this would have shown was
 * not there.
 */
import { Box3, BufferAttribute, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Bard, SITTING_SEAT_HEIGHT_M } from './Bard';
import { createPainterlyGlobals } from '../painterly';

/** A bard, settled into a pose, with every matrix up to date. */
function seated(pose: 'sitting' | 'walking' | 'playing' = 'sitting'): Bard {
  const bard = new Bard(createPainterlyGlobals());
  bard.setPose(pose, 0.01);
  bard.settlePose();
  // One update to run the pose maths, then again so nothing depends on the
  // very first frame's zeroed state.
  bard.update(1 / 60, 0);
  bard.update(1 / 60, 0);
  bard.object.updateMatrixWorld(true);
  return bard;
}

/** Anything private on the rig, read by name. Tests are allowed to look. */
function part(bard: Bard, name: string): Object3D {
  const found = (bard as unknown as Record<string, unknown>)[name];
  return found as Object3D;
}

function worldPoint(object: Object3D, local: Vector3): Vector3 {
  return local.clone().applyMatrix4(object.matrixWorld);
}

const ORIGIN = new Vector3(0, 0, 0);

describe('the seated bard', () => {
  it('carries both thighs within ten degrees of horizontal', () => {
    const bard = seated();
    const knees = part(bard, 'knees') as unknown as Object3D[];
    const hips = [part(bard, 'leftLeg'), part(bard, 'rightLeg')];
    for (let i = 0; i < 2; i++) {
      const hip = worldPoint(hips[i], ORIGIN);
      const knee = worldPoint(knees[i], ORIGIN);
      const thigh = knee.clone().sub(hip);
      const degreesOffHorizontal = Math.abs((Math.asin(thigh.y / thigh.length()) * 180) / Math.PI);
      expect(degreesOffHorizontal).toBeLessThan(10);
    }
  });

  it('stands the thighs up when he is not sitting, so the check can fail', () => {
    const bard = seated('walking');
    const knees = part(bard, 'knees') as unknown as Object3D[];
    const hip = worldPoint(part(bard, 'leftLeg'), ORIGIN);
    const knee = worldPoint(knees[0], ORIGIN);
    const thigh = knee.clone().sub(hip);
    const degreesOffHorizontal = Math.abs((Math.asin(thigh.y / thigh.length()) * 180) / Math.PI);
    expect(degreesOffHorizontal).toBeGreaterThan(60);
  });

  it('drops the boots to the seat height the campfire builds its log to', () => {
    const bard = seated();
    const knees = part(bard, 'knees') as unknown as Object3D[];
    let lowest = Infinity;
    for (const knee of knees) lowest = Math.min(lowest, worldPoint(knee, new Vector3(0, -0.32, 0)).y);
    // The group origin is the seat surface, so the boots hang below it by
    // about the seat's own height. A hand's width of tolerance: the pose is
    // deliberately asymmetric.
    expect(lowest).toBeLessThan(-SITTING_SEAT_HEIGHT_M * 0.6);
    expect(lowest).toBeGreaterThan(-SITTING_SEAT_HEIGHT_M * 1.9);
  });

  it('puts the left hand on the neck of the instrument', () => {
    const bard = seated();
    const arm = part(bard, 'leftArm');
    const pivot = part(bard, 'instrumentPivot');
    const hand = worldPoint(arm, new Vector3(0, -0.43, 0));
    // Nearest point on the neck segment to the hand, in the instrument's own
    // frame: the neck runs up local +Y from -0.065 to 0.245.
    let best = Infinity;
    for (let t = -0.065; t <= 0.245; t += 0.005) {
      best = Math.min(best, hand.distanceTo(worldPoint(pivot, new Vector3(0, t, 0))));
    }
    expect(best).toBeLessThan(0.05);
  });

  /**
   * The lute rests *on* the lap rather than *in* it.
   *
   * Two waves of critique in a row reported the seated instrument sinking
   * into a knee, and both times it was diagnosed off a screenshot, where the
   * only thing visible is a notch bitten out of the bowl and no way to tell
   * whether the fault is the carry, the pose or the camera. It was the
   * carry, by a centimetre. This measures it directly: every vertex of the
   * instrument, in each leg mesh's own space, against that mesh's own box.
   * A screenshot cannot answer this and a constant cannot be trusted to, so
   * the check is the geometry.
   */
  it('rests the instrument clear of both legs', () => {
    const bard = seated();
    let lute: Mesh | null = null;
    bard.object.traverse((child) => {
      if (child instanceof Mesh && child.name === 'bard-instrument') lute = child;
    });
    expect(lute).not.toBeNull();
    const instrument = lute as unknown as Mesh;
    const legs: Mesh[] = [];
    for (const name of ['knees', 'leftLeg', 'rightLeg']) {
      const found = part(bard, name) as unknown as Object3D | Object3D[];
      for (const root of Array.isArray(found) ? found : [found]) {
        root.traverse((child) => {
          if (child instanceof Mesh) legs.push(child);
        });
      }
    }
    const point = new Vector3();
    const toLeg = new Matrix4();
    let inside = 0;
    const position = instrument.geometry.attributes.position as BufferAttribute;
    for (const leg of legs) {
      const box = new Box3().setFromBufferAttribute(
        leg.geometry.attributes.position as BufferAttribute,
      );
      toLeg.copy(leg.matrixWorld).invert().multiply(instrument.matrixWorld);
      for (let i = 0; i < position.count; i++) {
        point
          .set(position.getX(i), position.getY(i), position.getZ(i))
          .applyMatrix4(toLeg);
        if (box.containsPoint(point)) inside++;
      }
    }
    expect(inside).toBe(0);
  });

  it('leaves the walking arms alone', () => {
    const walking = seated('walking');
    const arm = part(walking, 'leftArm') as unknown as { rotation: { x: number; z: number } };
    // The slung carry's own numbers, with no walk swing at zero speed:
    // rotation.x = -0.1, rotation.z = -ARM_SPLAY. If a grip solve ever starts
    // running outside the sitting and playing blends, these move.
    expect(arm.rotation.x).toBeCloseTo(-0.1, 5);
    expect(arm.rotation.z).toBeCloseTo(-0.26, 5);
  });
});

/**
 * The arms, pinned as *"the cloak is not in front of them"*.
 *
 * This is the check that would have caught the fault three rounds of critique
 * reported and two waves of work missed: the bard had no visible arms in the
 * walking frame, the busking frame or the encounter frame, while a close-up
 * at the campfire showed hands and a strum working perfectly. Nothing was
 * wrong with the arms. They were inside the cloak.
 *
 * Every camera this game has stands behind the bard and off to his right
 * (`CameraRig`'s `side` is positive in all five moods), which is inside the
 * arc of cloth the cloak covers. So for those cameras there is one question
 * that decides whether an arm is in the picture at all: is the arm further
 * from the spine than the cloak is, at the arm's own height? If it is, the
 * cloth cannot be between it and a camera outside the cone. If it is not,
 * no amount of colour, thickness or animation will help.
 *
 * The cloak's radius is measured off the shipped geometry rather than off the
 * constants that built it, and through the mesh's live scale and offset —
 * the sitting pose gathers the skirt by scaling it, so the constants alone
 * would answer for a pose the bard is not in.
 */
describe('the arms clear the cloak', () => {
  /** The cloak's outer radius about the torso axis at a height, in torso space. */
  function cloakRadiusAt(bard: Bard, y: number): number {
    let mesh: Mesh | null = null;
    part(bard, 'group').traverse((child) => {
      if (child instanceof Mesh && child.name === 'bard-cloak') mesh = child;
    });
    if (!mesh) throw new Error('no cloak mesh');
    const cloak = mesh as Mesh;
    const position = cloak.geometry.attributes.position as BufferAttribute;
    const point = new Vector3();
    // The widest ring of cloth within a hand's width of the height asked
    // about: the hem is ragged and the panels are flat, so a single exact
    // height would sample whichever panel edge happened to land there.
    let radius = 0;
    for (let i = 0; i < position.count; i++) {
      point
        .set(position.getX(i), position.getY(i), position.getZ(i))
        .applyMatrix4(cloak.matrix);
      if (Math.abs(point.y - y) > 0.06) continue;
      radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
    return radius;
  }

  for (const pose of ['walking', 'playing', 'sitting'] as const) {
    it(`keeps the hand outside the cloth when ${pose}`, () => {
      const bard = seated(pose);
      for (const side of ['leftArm', 'rightArm']) {
        // The hand's own centre, in torso space. Both the arm pivot and the
        // cloak are direct children of the torso, so their own local
        // matrices put the two in one frame with no world transforms and no
        // dependence on which way the bard happens to be facing.
        const hand = new Vector3(0, -0.43, 0).applyMatrix4(part(bard, side).matrix);
        const reach = Math.hypot(hand.x, hand.z);
        expect(reach).toBeGreaterThan(cloakRadiusAt(bard, hand.y) + 0.02);
      }
    });
  }
});

/**
 * The playing pose, pinned — and pinned as a *fact about which side of him
 * the instrument is on*, not as the Euler angles that put it there.
 *
 * The failure these exist to catch is the one the busking postcards had for
 * four rounds: the instrument brought round to the front of his chest, where
 * the busking camera — which stands behind him and off to his right — cannot
 * see it. Measured on the shipped build before the fix, 18.6 per cent of the
 * instrument's own footprint changed a single pixel of the frame. So what is
 * pinned is that the body of the lute sits well out on the camera's side of
 * the spine and the pegbox does not, which is the geometry that makes it
 * visible; any angles that keep that are free to change.
 */
describe('the playing bard', () => {
  const pivotPoint = (bard: Bard, t: number): Vector3 =>
    worldPoint(part(bard, 'instrumentPivot'), new Vector3(0, t, 0));

  it('carries the instrument out on his strumming side, not across his chest', () => {
    const bard = seated('playing');
    // The widest ring of the body, and the pegbox. See `instrumentGeometry`:
    // the shape spans local y -0.31 to 0.31 about the pivot.
    const body = pivotPoint(bard, -0.185);
    const pegbox = pivotPoint(bard, 0.31);
    // Out past the shoulder joint (0.172) rather than on the centreline.
    expect(body.x).toBeGreaterThan(0.22);
    // The big end of the shape is the outboard end. Flip the carry and this
    // goes negative: the old pose put the body at x -0.14 and the pegbox at
    // +0.18, which is the arrangement that hid it.
    expect(body.x - pegbox.x).toBeGreaterThan(0.18);
    // Being played, not slung: forward of the spine rather than behind it.
    expect(body.z).toBeGreaterThan(0.08);
  });

  it('puts both hands on it', () => {
    const bard = seated('playing');
    const nearest = (arm: string, from: number, to: number): number => {
      const hand = worldPoint(part(bard, arm), new Vector3(0, -0.43, 0));
      let best = Infinity;
      for (let t = from; t <= to; t += 0.005) {
        best = Math.min(best, hand.distanceTo(pivotPoint(bard, t)));
      }
      return best;
    };
    // The fretting hand on the neck, the strumming hand on the belly.
    expect(nearest('leftArm', -0.065, 0.245)).toBeLessThan(0.05);
    expect(nearest('rightArm', -0.25, -0.11)).toBeLessThan(0.06);
  });

  /**
   * The strumming hand has to *move*, and by enough to see.
   *
   * The gesture is made by lifting and dropping the shoulder, because a
   * rigid arm with its hand solved onto the strings physically cannot travel
   * otherwise (see the long note on the strum). That means the whole
   * gesture is one step removed from anything a reader of this file can
   * check by eye, and it has already been silently cancelled once: an
   * earlier version added the swing *after* the grip solve had pinned the
   * hand, so the arm did not move at all and every busking postcard showed a
   * musician not playing.
   *
   * So: run a whole strum cycle and measure how far the hand actually goes.
   * The bard is 1.4 m tall and reads about 380 px in the busking frame, so a
   * centimetre is roughly two and a half pixels; eight centimetres of travel
   * is a stroke you can see in a still.
   */
  it('rakes the strumming hand across the soundboard', () => {
    const bard = seated('playing');
    const low = new Vector3(Infinity, Infinity, Infinity);
    const high = new Vector3(-Infinity, -Infinity, -Infinity);
    // One full period of the triangle: `strumCycle = elapsed * 2.1`.
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      bard.update(1 / 2.1 / steps, 0);
      bard.object.updateMatrixWorld(true);
      const hand = worldPoint(part(bard, 'rightArm'), new Vector3(0, -0.43, 0));
      low.min(hand);
      high.max(hand);
    }
    expect(high.distanceTo(low)).toBeGreaterThan(0.08);
  });

  it('keeps the pegbox below the brim of his hat', () => {
    const bard = seated('playing');
    // The hat sits at HAT_Y = 1.19 and its brim dips about 0.1 below that.
    // A pegbox that climbs past it reads as a stick growing out of the hat,
    // which this project already shipped once at the campfire.
    expect(pivotPoint(bard, 0.31).y).toBeLessThan(1.05);
  });
});
