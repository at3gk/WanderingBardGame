/**
 * The fox and the cat — creature staging, second piece (task 186).
 *
 * Same rules as the deer: the travellers' primitive and material, the
 * outline as the whole identity, and almost no motion — each animal gets
 * the one life signature its encounter line implies and nothing else.
 *
 * - The FOX ("sits down to listen, and pretends when you look that it
 *   was only resting"): a seated triangle — haunches down, chest up —
 *   with the two marks that read fox at any distance: tall pointed ears
 *   and the brush TAIL curled round the feet, pale-tipped. Its life is
 *   an occasional slow head-turn aside: the pretending, staged.
 * - The CAT ("on a garden wall, tail going, deciding whether you are
 *   worth getting up for"): a small loaf — the most compact silhouette
 *   in the game — whose life is the tail, going. The tail is the only
 *   part that moves at all, which is the entire character.
 *
 * - The DOG ("a grey-muzzled dog walks you to the end of his street and
 *   no further") stands, four-square, village-street sized: between the
 *   fox and the deer, which is the size the line needs — an animal with
 *   a job. Two marks carry him. The EARS hang DOWN, which is the whole
 *   difference from the fox at forty pixels (the fox's point up), and
 *   the MUZZLE is pale grey against a warm-brown coat, because the line
 *   named that detail before the model existed. His life is the tail:
 *   a wag that arrives every six seconds, swings twice, and stops. An
 *   old dog's acknowledgment, not a puppy's greeting.
 *
 * All three are quiet-valued like the travellers. The fox leans rust
 * because a fox IS rust — but held well under the bard's saturation;
 * warmth belongs to him, and a fox six metres off in the verge is an
 * accent, not a rival.
 */

import { Group, Mesh, type BufferGeometry, type ShaderMaterial } from 'three';
import { createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import { boxPart } from './Bard';

function solidFactory(globals: PainterlyGlobals, materials: ShaderMaterial[]) {
  return (color: number, rim = 0.4, shadowDepth = 0.6) => {
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
      shadowDepth,
    });
    materials.push(material);
    return material;
  };
}

function adder(parent: Group) {
  return (geometry: BufferGeometry, material: ShaderMaterial, x: number, y: number, z: number) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
}

/** What RoadStage needs of any staged creature. The deer satisfies it too. */
export interface StagedCreature {
  group: Group;
  setHeading(heading: number): void;
  update(dt: number): void;
  dispose(): void;
}

export class Fox implements StagedCreature {
  readonly group = new Group();
  private readonly headPivot = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private elapsed = 0;
  private readonly phase: number;

  constructor(globals: PainterlyGlobals, seed = 0) {
    this.phase = (seed % 83) * 0.53;
    this.group.name = 'fox';
    const solid = solidFactory(globals, this.materials);
    const coat = solid(0x9a5f38, 0.5);
    const cream = solid(0xc9a488, 0.6, 0.7);
    const dark = solid(0x4a3526, 0.32);
    const add = adder(this.group);

    // Seated: haunches a low wide box, chest a taller narrow one leaning
    // back onto them — the sitting-dog triangle, read in one glance.
    add(boxPart(0.2, 0.2, 0.24, 0.85), coat, 0, 0, -0.05);
    const chest = add(boxPart(0.14, 0.3, 0.15, 0.78), coat, 0, 0.16, 0.08);
    chest.rotation.x = -0.28;
    // Front legs: two straight sticks down from the chest.
    const legGeo = boxPart(0.045, 0.24, 0.045, 0.85);
    add(legGeo, dark, -0.05, 0, 0.13);
    add(legGeo, dark, 0.05, 0, 0.13);
    // The brush, curled round the feet: a fat tapered box lying on the
    // ground, pale at the tip. The one mark no other silhouette has.
    const brush = add(boxPart(0.09, 0.34, 0.09, 0.6), coat, 0.14, 0.03, 0.02);
    brush.rotation.z = Math.PI / 2 - 0.25;
    brush.rotation.y = 0.9;
    add(boxPart(0.08, 0.09, 0.08, 0.7), cream, 0.28, 0.035, 0.14);

    // Head on its pivot: small, with the pointed muzzle and TALL ears.
    this.headPivot.position.set(0, 0.44, 0.14);
    const headAdd = adder(this.headPivot);
    headAdd(boxPart(0.13, 0.12, 0.14, 0.8), coat, 0, 0, 0);
    headAdd(boxPart(0.06, 0.09, 0.06, 0.55), cream, 0, -0.02, 0.1);
    const earGeo = boxPart(0.05, 0.13, 0.03, 0.35);
    const earL = headAdd(earGeo, coat, -0.05, 0.09, -0.01);
    earL.rotation.z = 0.3;
    const earR = headAdd(earGeo, coat, 0.05, 0.09, -0.01);
    earR.rotation.z = -0.3;
    this.group.add(this.headPivot);
  }

  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    // Breath.
    this.group.position.y += 0;
    this.headPivot.position.y = 0.44 + Math.sin(t * 0.9) * 0.005;
    // The pretending: every ~9 seconds the head turns slowly aside and
    // back — caught looking, resuming not-looking. Smooth, not a flick.
    const cycle = (t * 0.11) % 1;
    const aside = cycle < 0.3 ? Math.sin((cycle / 0.3) * Math.PI) : 0;
    this.headPivot.rotation.y = aside * 0.55;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}

export class Dog implements StagedCreature {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly tail = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private elapsed = 0;
  private readonly phase: number;

  constructor(globals: PainterlyGlobals, seed = 0) {
    this.phase = (seed % 71) * 0.47;
    this.group.name = 'dog';
    const solid = solidFactory(globals, this.materials);
    // Warm brown, and the line's own detail: a muzzle in pale grey. The
    // grey is the only cool value on him, so it reads as age rather than
    // as a second coat colour.
    const coat = solid(0x7d5a3e, 0.45);
    const under = solid(0x4e3a2a, 0.32);
    const grey = solid(0xaea79c, 0.6, 0.72);
    const add = adder(this.body);

    // Standing: four columns, in the darker tone so the body reads as a
    // mass over them — the deer's value-break rule.
    const legGeo = boxPart(0.055, 0.32, 0.055, 0.85);
    for (const [lx, lz] of [
      [-0.085, 0.17],
      [0.085, 0.17],
      [-0.085, -0.19],
      [0.085, -0.19],
    ] as const) {
      add(legGeo, under, lx, 0, lz);
    }

    // Body along +Z, with the CHEST a deeper box than the haunches: the
    // working-dog outline, heavy at the front, light behind.
    add(boxPart(0.19, 0.2, 0.44, 0.86), coat, 0, 0.31, -0.05);
    add(boxPart(0.21, 0.26, 0.2, 0.8), coat, 0, 0.29, 0.14);

    // Head: squarish, low-slung — no deer neck. Grey muzzle stepped
    // forward of it.
    add(boxPart(0.15, 0.15, 0.18, 0.85), coat, 0, 0.55, 0.22);
    add(boxPart(0.095, 0.09, 0.11, 0.8), grey, 0, 0.57, 0.36);

    // The ears HANG. Two small boxes rotated past horizontal so they fall
    // beside the head — the one mark that says dog and not fox at range.
    const earGeo = boxPart(0.045, 0.13, 0.035, 0.5);
    const earL = add(earGeo, under, -0.075, 0.67, 0.22);
    earL.rotation.z = 2.6;
    const earR = add(earGeo, under, 0.075, 0.67, 0.22);
    earR.rotation.z = -2.6;

    // A plain tail — no brush — held low and relaxed, on its own pivot so
    // the wag can swing the whole thing.
    this.tail.position.set(0, 0.44, -0.26);
    const tailMesh = adder(this.tail)(boxPart(0.05, 0.24, 0.05, 0.62), coat, 0, 0, 0);
    tailMesh.rotation.x = -2.3;
    this.body.add(this.tail);
    this.group.add(this.body);
  }

  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    this.body.position.y = Math.sin(t * 0.8) * 0.005;
    // The wag, rationed. A six-second clock; the tail is live for the
    // first 30% of it (1.8 s) and dead still for the other 4.2. Inside
    // the burst: two full swings under a sine envelope, so it starts and
    // finishes at rest instead of snapping on. Old dog, brief opinion.
    const cycle = (t / 6) % 1;
    if (cycle < 0.3) {
      const p = cycle / 0.3;
      this.tail.rotation.y = Math.sin(p * Math.PI) * Math.sin(p * Math.PI * 4) * 0.5;
    } else {
      this.tail.rotation.y = 0;
    }
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}

export class Cat implements StagedCreature {
  readonly group = new Group();
  private readonly tail = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private elapsed = 0;
  private readonly phase: number;

  constructor(globals: PainterlyGlobals, seed = 0) {
    this.phase = (seed % 79) * 0.61;
    this.group.name = 'cat';
    const solid = solidFactory(globals, this.materials);
    const coat = solid(0x6e6258, 0.45);
    const dark = solid(0x453c34, 0.32);
    const add = adder(this.group);

    // The loaf: one rounded-ish box, paws tucked. Deliberately the
    // smallest staged silhouette in the game.
    add(boxPart(0.18, 0.14, 0.3, 0.8), coat, 0, 0.02, 0);
    // Head: proportionally big, with the two small triangle ears that
    // say cat before anything else does.
    const head = add(boxPart(0.13, 0.12, 0.12, 0.85), coat, 0, 0.14, 0.14);
    head.rotation.x = -0.1;
    const earGeo = boxPart(0.045, 0.07, 0.03, 0.3);
    const earL = add(earGeo, dark, -0.045, 0.24, 0.12);
    earL.rotation.z = 0.25;
    const earR = add(earGeo, dark, 0.045, 0.24, 0.12);
    earR.rotation.z = -0.25;
    // The tail, going: hangs off the wall-or-whatever edge behind and
    // sways. Its own pivot so the whole thing can swing.
    this.tail.position.set(0.07, 0.06, -0.15);
    const tailAdd = adder(this.tail);
    const tailMesh = tailAdd(boxPart(0.045, 0.3, 0.045, 0.6), dark, 0, -0.12, 0);
    tailMesh.rotation.x = 0.35;
    this.group.add(this.tail);
  }

  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    // The tail goes — a slow figure-of-sway, never still, never fast.
    // It is the entire performance ("deciding whether you are worth
    // getting up for"), so it is the only motion the cat makes.
    this.tail.rotation.z = Math.sin(t * 1.7) * 0.35 + Math.sin(t * 0.6) * 0.15;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
