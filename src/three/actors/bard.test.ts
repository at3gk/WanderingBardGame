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
import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Bard, SITTING_SEAT_HEIGHT_M } from './Bard';
import { createPainterlyGlobals } from '../painterly';

/** A bard, settled into a pose, with every matrix up to date. */
function seated(pose: 'sitting' | 'walking' = 'sitting'): Bard {
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

  it('leaves the walking arms alone', () => {
    const walking = seated('walking');
    const arm = part(walking, 'leftArm') as unknown as { rotation: { x: number; z: number } };
    // The slung carry's own numbers, with no walk swing at zero speed:
    // rotation.x = -0.1, rotation.z = 0.11. If the seated grip solve ever
    // starts running outside the sitting blend, these move.
    expect(arm.rotation.x).toBeCloseTo(-0.1, 5);
    expect(arm.rotation.z).toBeCloseTo(0.11, 5);
  });
});
