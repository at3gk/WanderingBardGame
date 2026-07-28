/**
 * The people you meet.
 *
 * Until this file existed the road was empty: an "encounter" printed a line
 * of prose about somebody over a bare field, and a busk was a performance to
 * nobody. That is the difference between a place and a backdrop, and no
 * amount of light or foliage closes it. So there are figures now.
 *
 * The rules they are built under, and why each one:
 *
 * - **Same primitive as the bard.** Every part is `boxPart` from `Bard.ts`
 *   and every surface is the same painterly material. A second figure
 *   builder with its own idea of how a limb is made reads as two games
 *   standing next to each other.
 * - **Four silhouettes, one skeleton.** A walker with a pack, a seated
 *   elder, a child, a pedlar behind a handcart. They differ in *outline* —
 *   height, width, what breaks the top of the shape — because at the forty
 *   pixels these occupy on a phone, outline is all that survives. Colour
 *   variation on identical geometry would have been cheaper and would have
 *   read as one person recoloured four times.
 * - **Cooler and flatter than the bard.** DESIGN.md reserves warmth for the
 *   bard and the music, and it is a rule worth defending precisely here: a
 *   crowd painted in the bard's rust would take the frame off him. These are
 *   slate, moss, oatmeal and dust — clearly people, clearly not the subject.
 * - **They sway and they do not walk.** A standing figure with no motion at
 *   all reads as a statue within about two seconds. A full walk cycle is not
 *   worth it for something seen from twenty metres for six seconds, so they
 *   get a slow weight shift, a breath, and a head that turns to follow the
 *   playing. Nothing here is on a beat: the music is the bard's.
 *
 * Local +Z is forward, matching `Bard` and the road's heading convention.
 */

import { BufferAttribute, BufferGeometry, Group, Mesh, type ShaderMaterial } from 'three';
import { createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import { boxPart } from './Bard';

export type TravellerKind = 'walker' | 'elder' | 'child' | 'pedlar';

/** The four kinds, in the order a seeded pick walks them. */
export const TRAVELLER_KINDS: readonly TravellerKind[] = [
  'walker',
  'elder',
  'child',
  'pedlar',
];

interface TravellerPalette {
  /** The main garment. The largest area on the figure and the one that reads. */
  cloth: number;
  /** Legs, or a skirt. Always darker than `cloth` so the figure has a base. */
  under: number;
  skin: number;
  /** Hair, hood or cap — whatever breaks the top of the silhouette. */
  crown: number;
  /** Pack, shawl, cart. The one part allowed to disagree with the rest. */
  carried: number;
}

/**
 * Palettes, one per kind.
 *
 * Every one of these is inside a narrow band of value as well as of hue: a
 * traveller is meant to be legible as a person and then to stop asking for
 * attention. The saturations are roughly a third of the bard's, and none of
 * them contains a red.
 */
const PALETTES: Record<TravellerKind, TravellerPalette> = {
  walker: {
    cloth: 0x6f7d8a,
    under: 0x4b5560,
    skin: 0xc59a76,
    crown: 0x59636e,
    carried: 0x8a7455,
  },
  elder: {
    // The first pass had this shawl at 0x8a8b95, a pale grey, and the seated
    // figure came out the brightest object on that side of the frame — a
    // chess piece on a plinth. A seated person is a *dark* mass with one
    // light note at the top; that is the whole of the read.
    cloth: 0x5a6270,
    under: 0x424a58,
    skin: 0xc7a488,
    // The hood, a shade off the shawl. Age is carried by the seated,
    // rounded posture rather than by white hair, which as a hood colour was
    // simply the brightest thing in the frame.
    crown: 0x9a958a,
    carried: 0x6a6a63,
  },
  child: {
    cloth: 0x7f9a86,
    under: 0x57675f,
    skin: 0xd3a882,
    crown: 0x6b5540,
    carried: 0x7f9a86,
  },
  pedlar: {
    cloth: 0x7b7360,
    under: 0x544d44,
    skin: 0xc2996f,
    crown: 0x6a6152,
    carried: 0x8a7355,
  },
};

/** A flat-ish low-poly disc, for cart wheels. Eight sides is plenty at this size. */
function wheelGeometry(radius: number, thickness: number): BufferGeometry {
  const sides = 8;
  const verts: number[] = [];
  const half = thickness / 2;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const c0 = [Math.cos(a0) * radius, Math.sin(a0) * radius];
    const c1 = [Math.cos(a1) * radius, Math.sin(a1) * radius];
    // Rim.
    verts.push(c0[0], c0[1], -half, c1[0], c1[1], -half, c1[0], c1[1], half);
    verts.push(c0[0], c0[1], -half, c1[0], c1[1], half, c0[0], c0[1], half);
    // Both faces, so the wheel has a side whichever way the cart is turned.
    verts.push(0, 0, half, c0[0], c0[1], half, c1[0], c1[1], half);
    verts.push(0, 0, -half, c1[0], c1[1], -half, c0[0], c0[1], -half);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class Traveller {
  readonly group = new Group();

  readonly kind: TravellerKind;

  private readonly body = new Group();
  private readonly headPivot = new Group();
  private readonly materials: ShaderMaterial[] = [];

  /** Phase offset so a row of listeners does not breathe in unison. */
  private readonly phase: number;
  private elapsed = 0;
  /** How much the figure is attending to something: turns the head. */
  private attention = 0;

  constructor(globals: PainterlyGlobals, kind: TravellerKind, seed = 0) {
    this.kind = kind;
    this.phase = (seed % 97) * 0.647;
    this.group.name = `traveller-${kind}`;

    const palette = PALETTES[kind];
    const solid = (color: number, rim = 0.4) => {
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
        // The same lifted shadow floor the bard's head uses. These figures
        // are small in frame and a crushed-black one is a hole, not a person.
        shadowDepth: 0.55,
      });
      this.materials.push(material);
      return material;
    };

    const cloth = solid(palette.cloth, 0.45);
    const under = solid(palette.under, 0.32);
    const skin = solid(palette.skin, 0.5);
    const crown = solid(palette.crown, 0.45);
    const carried = solid(palette.carried, 0.4);

    const add = (geometry: BufferGeometry, material: ShaderMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      return mesh;
    };

    if (kind === 'elder') {
      // Seated and hunched, so the outline is a low wide triangle — the one
      // shape in the set that cannot be mistaken for any of the others even
      // in silhouette at eighty metres.
      // A low stone, not a stool. Sat on a tall box the figure reads as
      // enthroned; sat almost on the ground she reads as resting.
      const stone = add(boxPart(0.46, 0.17, 0.4, 0.88), carried, 0, 0, 0);
      // The shawl widens downward and the head sits clear above it, so the
      // outline is a triangle with a pale dot on top — the one shape in the
      // set that cannot be confused with a standing figure.
      const torso = add(boxPart(0.24, 0.44, 0.22, 1.55, 1.5), cloth, 0, 0.6, 0.02);
      torso.rotation.x = Math.PI;
      const lap = add(boxPart(0.4, 0.14, 0.4, 0.86), under, 0, 0.16, 0.09);
      const neck = add(boxPart(0.11, 0.09, 0.11, 1), skin, 0, 0.6, 0.02);
      // Hooded, and only the face shows. Left bare, the head was a skin-
      // coloured box as wide as the shoulders with white hair on top, and at
      // three metres from the busking camera that is not an old woman — it is
      // a pale lump, and the brightest thing on its side of the frame. A hood
      // keeps the top of the silhouette in cloth and lets the face be the one
      // small light note it should be.
      const head = add(boxPart(0.185, 0.19, 0.18, 0.86), crown, 0, 0.67, 0.01);
      const face = add(boxPart(0.1, 0.09, 0.05, 0.95), skin, 0, 0.73, 0.085);
      this.headPivot.add(head, face);
      this.body.add(stone, torso, lap, neck, this.headPivot);
      // Leaning forward toward whatever she is listening to.
      this.body.rotation.x = 0.12;
    } else {
      const tall = kind === 'child' ? 0.66 : 1;
      const hip = 0.42 * tall;
      const shoulder = 0.82 * tall;
      const legGeo = boxPart(0.11 * tall, hip, 0.12 * tall, 0.85);
      this.body.add(
        add(legGeo, under, -0.075 * tall, 0, 0),
        add(legGeo, under, 0.075 * tall, 0, 0),
      );
      const torso = add(
        boxPart(0.25 * tall, shoulder - hip + 0.08 * tall, 0.17 * tall, 1.18, 1.05),
        cloth,
        0,
        hip,
        0,
      );
      this.body.add(torso);
      const armGeo = boxPart(0.075 * tall, 0.34 * tall, 0.085 * tall, 0.85);
      const leftArm = add(armGeo, cloth, -0.15 * tall, shoulder, 0.01);
      const rightArm = add(armGeo, cloth, 0.15 * tall, shoulder, 0.01);
      // Hanging: the geometry grows upward from its origin, so the arm is
      // flipped rather than offset, which keeps the shoulder as the pivot.
      leftArm.rotation.x = Math.PI;
      rightArm.rotation.x = Math.PI;
      leftArm.rotation.z = -0.12;
      rightArm.rotation.z = 0.12;
      this.body.add(leftArm, rightArm);

      // The head is proportionally larger on the child, which is the entire
      // difference between a child and a distant adult.
      const headSize = kind === 'child' ? 0.23 : 0.21;
      const head = add(boxPart(headSize, headSize * 1.05, headSize * 0.92, 0.94), skin, 0, 0, 0);
      const hair = add(
        boxPart(headSize * 1.05, headSize * 0.42, headSize * 0.98, 1.0),
        crown,
        0,
        headSize * 0.86,
        -0.01,
      );
      this.headPivot.position.y = shoulder + 0.06 * tall;
      this.headPivot.add(head, hair);
      this.body.add(this.headPivot);

      if (kind === 'walker') {
        // A tall pack standing above the shoulders. It is the only thing
        // that breaks this outline, so it is deliberately oversized.
        const pack = add(boxPart(0.28, 0.46, 0.2, 0.86), carried, 0, hip + 0.1, -0.16);
        pack.rotation.x = -0.06;
        const roll = add(boxPart(0.3, 0.11, 0.16, 1), under, 0, hip + 0.56, -0.17);
        this.body.add(pack, roll);
      }

      if (kind === 'pedlar') {
        // The cart is the silhouette. It sits beside and slightly behind, so
        // the figure keeps its own outline and the two together read as a
        // wider, busier shape than anything else on the road.
        // A barrow, not a waggon. The first pass built a box 0.6 by 0.86 and
        // it read as a garden bench standing next to a man: bigger than the
        // person pushing it, and squarer. Two thirds of that, set low and
        // half a metre out, reads as luggage on wheels — which is the point,
        // because a pedlar without a load is just a man.
        const cart = new Group();
        cart.position.set(0.46, 0, -0.16);
        cart.add(add(boxPart(0.4, 0.3, 0.56, 1.14, 1), carried, 0, 0.24, 0));
        // The load: one bundle standing proud of the tray, so the cart has a
        // top edge that is not a straight line.
        cart.add(add(boxPart(0.28, 0.17, 0.24, 0.86), cloth, 0, 0.53, -0.06));
        const wheel = wheelGeometry(0.22, 0.06);
        for (const side of [-1, 1]) {
          const disc = new Mesh(wheel, under);
          disc.position.set(side * 0.23, 0.22, -0.04);
          disc.rotation.y = Math.PI / 2;
          disc.castShadow = true;
          cart.add(disc);
        }
        // The shaft the pedlar holds, running forward to the near hand.
        const shaft = add(boxPart(0.045, 0.62, 0.045, 1), under, -0.19, 0.36, 0.26);
        shaft.rotation.x = Math.PI / 2 - 0.3;
        cart.add(shaft);
        this.body.add(cart);
      }
    }

    this.group.add(this.body);
  }

  /** Face a heading, in the same convention the road uses. */
  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  /** 0 is minding their own business, 1 is watching the bard play. */
  setAttention(attention: number): void {
    this.attention = Math.min(1, Math.max(0, attention));
  }

  /**
   * Advance the idle.
   *
   * Deliberately tiny. Everything here is under two centimetres or two
   * degrees; the point is only that the figure is not a prop, and anything
   * larger starts competing with the bard for the eye.
   */
  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    const breathe = Math.sin(t * 1.1);
    this.body.position.y = breathe * 0.008;
    // Weight shifts between the feet on a much slower cycle than the breath,
    // so the two never line up into a single bounce.
    this.body.rotation.z = Math.sin(t * 0.37) * 0.035;
    this.headPivot.rotation.y = Math.sin(t * 0.29 + 1.3) * 0.14 * (1 - this.attention * 0.7);
    this.headPivot.rotation.x = -this.attention * 0.06 + Math.sin(t * 0.83) * 0.012;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
