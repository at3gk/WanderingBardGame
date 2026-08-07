/**
 * The deer — the first creature the road actually shows.
 *
 * Wave 17's emotion lens found the game's most-quoted journal line and
 * held it up: "06 says a deer held still through the whole verse — there
 * is no deer in the frame." It was worse than unstaged: every encounter,
 * creature and weather alike, stood a random HUMAN through `placeMeeting`,
 * so on a deer day the prose said deer and the picture showed a walker
 * playing understudy. The caption was carrying feeling the frame actively
 * contradicted.
 *
 * The build rules are the travellers' own (same primitive, same painterly
 * material, outline-first at forty pixels), with the deer's identity
 * carried by the two marks no other silhouette in the game has: a long
 * alert NECK rising from a horizontal body, and two splayed EARS. At
 * eighty metres a head-high quadruped with tall ears cannot be read as
 * anything else — which is the entire design, exactly as the elder's
 * low-triangle and the pedlar's cart are theirs.
 *
 * It does almost nothing, on purpose. The encounter line is about
 * stillness; a deer that fidgeted would unwrite it. It breathes, and now
 * and then one ear flicks — the cheapest signature of a live animal there
 * is, and the only motion a still deer actually makes.
 */

import { Group, Mesh, type BufferGeometry, type ShaderMaterial } from 'three';
import { createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import { boxPart } from './Bard';

/** Quiet russet family — warm the way a deer is, valued the way a traveller is. */
const COAT = 0x8a6647;
const BELLY = 0x63492f;
const EAR_LINING = 0xc7a488;

export class Deer {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly headPivot = new Group();
  private readonly earLeft = new Group();
  private readonly earRight = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private elapsed = 0;
  private readonly phase: number;

  constructor(globals: PainterlyGlobals, seed = 0) {
    this.phase = (seed % 89) * 0.71;
    this.group.name = 'deer';

    const solid = (color: number, rim = 0.4, shadowDepth = 0.6) => {
      const material = createPainterlyMaterial(globals, {
        color,
        colorVariant: 0xf0e0cc,
        grain: 0.3,
        grainScale: 1.8,
        rim,
        rimPower: 2.1,
        bandSoftness: 0.09,
        flatShading: true,
        swayAttribute: false,
        sway: 0,
        // The travellers' own lifted floor: small in frame and often met at
        // dusk, a crushed-black deer is a hole, not an animal.
        shadowDepth,
      });
      this.materials.push(material);
      return material;
    };
    const coat = solid(COAT, 0.5);
    const belly = solid(BELLY, 0.32);
    const lining = solid(EAR_LINING, 0.6, 0.7);

    const add = (
      parent: Group,
      geometry: BufferGeometry,
      material: ShaderMaterial,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Legs: four thin columns. Deliberately in the darker belly tone so the
    // body reads as a mass standing OVER them — the same value-break rule
    // the travellers' under/cloth split follows.
    const legGeo = boxPart(0.05, 0.56, 0.05, 0.85);
    for (const [lx, lz] of [
      [-0.09, 0.21],
      [0.09, 0.21],
      [-0.09, -0.23],
      [0.09, -0.23],
    ] as const) {
      add(this.body, legGeo, belly, lx, 0, lz);
    }

    // The body: a horizontal box, longer than tall, +Z forward with the
    // road's convention. Slight taper toward the rear haunch.
    const torso = add(this.body, boxPart(0.24, 0.62, 0.3, 0.88), coat, 0, 0.56, 0);
    torso.rotation.x = Math.PI / 2;

    // Tail: a small pale flag at the rear — the second thing anyone knows
    // about a deer from behind.
    add(this.body, boxPart(0.06, 0.1, 0.05, 0.7), lining, 0, 0.62, -0.34);

    // The neck rises steeply from the front of the body: ALERT, head up —
    // the pose of the line ("holds still"), and the outline that separates
    // a deer from a dog or a sheep at any distance.
    const neck = add(this.body, boxPart(0.09, 0.4, 0.11, 0.82), coat, 0, 0.62, 0.26);
    neck.rotation.x = 0.32;

    // Head, on its own pivot so it can be aimed at the bard.
    this.headPivot.position.set(0, 0.98, 0.38);
    const head = add(this.headPivot, boxPart(0.12, 0.13, 0.2, 0.85), coat, 0, 0.02, 0.03);
    head.rotation.x = Math.PI / 2 - 0.35;
    // Muzzle: a smaller, paler step forward of the head.
    add(this.headPivot, boxPart(0.07, 0.1, 0.07, 0.8), belly, 0, -0.015, 0.14);

    // Ears: two tall thin boxes, splayed. THE deer mark. Lined pale so the
    // inner face catches light the way real ears do at dusk.
    const earGeo = boxPart(0.05, 0.16, 0.03, 0.6);
    const earL = add(this.earLeft, earGeo, lining, 0, 0, 0);
    earL.rotation.z = 0.42;
    this.earLeft.position.set(-0.07, 0.1, -0.02);
    const earR = add(this.earRight, earGeo, lining, 0, 0, 0);
    earR.rotation.z = -0.42;
    this.earRight.position.set(0.07, 0.1, -0.02);
    this.headPivot.add(this.earLeft, this.earRight);

    this.body.add(this.headPivot);
    this.group.add(this.body);
  }

  /** Face a heading, in the road's convention. */
  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  /**
   * Advance the stillness. Breath, and an occasional single ear flick —
   * nothing else, because the encounter line is about a creature that
   * holds still, and the flick is what says "alive" without moving.
   */
  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    this.body.position.y = Math.sin(t * 0.9) * 0.006;
    // The flick: a sharp 220 ms pulse roughly every five seconds, one ear
    // at a time. Built from the fractional part of a slow clock so it is
    // deterministic and needs no state.
    const cycle = (t * 0.19) % 1;
    const flick = cycle < 0.042 ? Math.sin((cycle / 0.042) * Math.PI) : 0;
    const which = Math.floor(t * 0.19) % 2 === 0;
    this.earLeft.rotation.x = which ? flick * 0.5 : 0;
    this.earRight.rotation.x = which ? 0 : flick * 0.5;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
