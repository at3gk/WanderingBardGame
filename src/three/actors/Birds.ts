/**
 * The owl — the first bird (task 186 piece 4, "the birds").
 *
 * Task 186's remaining creatures were the village/forest quadrupeds (fox,
 * cat, dog — pieces 1-3) and then, by meet-frequency, the birds:
 * `answering-owl`, `nightingale`, `kingfisher`. The three are different
 * enough in behaviour (a perched watcher, a hidden singer, a fast flash
 * downstream) that they are their own pieces rather than one; this is the
 * first, the owl, because its line is the one that describes a creature
 * holding still and looking back rather than moving.
 *
 * Every other staged animal so far reads in profile or three-quarter and
 * carries its identity in an outline mark unique to it (the deer's neck and
 * ears, the fox's brush, the cat's tail, the dog's hanging ears). An owl's
 * identity is different: it is the one thing in the game that looks
 * straight at the bard, and its silhouette break is having almost no neck
 * at all and no visible legs — a compact, rounded mass with a flat pale
 * face-disc and two forward eyes, which is also exactly what "waits to see
 * what you will do about it" asks the figure to do.
 */

import { Group, Mesh, type BufferGeometry, type ShaderMaterial } from 'three';
import { createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import { boxPart } from './Bard';
import type { StagedCreature } from './SmallCreatures';

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

export class Owl implements StagedCreature {
  readonly group = new Group();
  // `group.position` is owned by RoadStage (the ground-height snap in
  // placeMeeting/updateCreature); the breathing bob has to move something
  // *inside* it instead, the same way the fox bobs its head pivot and the
  // dog bobs its body sub-group rather than their own outer group.
  private readonly body = new Group();
  private readonly headPivot = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private elapsed = 0;
  private readonly phase: number;

  constructor(globals: PainterlyGlobals, seed = 0) {
    this.phase = (seed % 73) * 0.59;
    this.group.name = 'owl';
    const solid = solidFactory(globals, this.materials);
    const coat = solid(0x5c4a34, 0.42);
    const face = solid(0xcdbb96, 0.55, 0.72);
    const eye = solid(0x1c140c, 0.15, 0.4);
    const add = adder(this.body);

    // Body: one rounded, tapered-in mass sat flush on the ground — no legs
    // at all, which is the mark itself. A perched owl's feet vanish into
    // its own feathers; a pair of visible stick legs would read as heron
    // before it read as owl.
    add(boxPart(0.22, 0.34, 0.2, 0.72, 0.8), coat, 0, 0, 0);

    // Head, on its own pivot, nested into the top of the body rather than
    // raised on a neck — owls have effectively none, which is the second
    // break from every other staged animal (all of which have one).
    this.headPivot.position.set(0, 0.28, 0.04);
    const headAdd = adder(this.headPivot);
    headAdd(boxPart(0.19, 0.17, 0.17, 0.82), coat, 0, 0, 0);

    // The face-disc: flat, pale, forward — the single mark that reads owl
    // at any distance faster than the tufts do.
    const disc = headAdd(boxPart(0.15, 0.14, 0.04, 0.88), face, 0, 0, 0.085);
    disc.rotation.x = 0.05;

    // Two dark, close-set, forward eyes — the direct stare the line asks
    // for ("waits to see what you will do about it"). No other creature in
    // the game looks at the bard head-on; everything else is profile or
    // three-quarter.
    const eyeGeo = boxPart(0.035, 0.035, 0.02, 0.8);
    headAdd(eyeGeo, eye, -0.045, 0.02, 0.1);
    headAdd(eyeGeo, eye, 0.045, 0.02, 0.1);

    // Ear-tufts: narrow and close together, the opposite arrangement from
    // the fox's tall wide-splayed pair, so the two never read as the same
    // animal at a glance even though both are "pointed ears on a head".
    const tuftGeo = boxPart(0.035, 0.09, 0.025, 0.25);
    const tuftL = headAdd(tuftGeo, coat, -0.04, 0.1, -0.03);
    tuftL.rotation.z = 0.14;
    const tuftR = headAdd(tuftGeo, coat, 0.04, 0.1, -0.03);
    tuftR.rotation.z = -0.14;

    this.body.add(this.headPivot);
    this.group.add(this.body);
  }

  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  /**
   * Almost no motion — the line is one flat-toned phrase back and then
   * watching, not fidgeting. The one gesture is a slow head-tilt, the
   * curious sideways assessment an owl actually makes, on a long clock
   * (~15 s) so it never reads as nervous the way the fox's aside-glance
   * does.
   */
  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    this.headPivot.rotation.z = Math.sin(t * 0.42) * 0.22;
    this.body.position.y = Math.sin(t * 0.85) * 0.004;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
