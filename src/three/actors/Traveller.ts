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

/** Move a colour's value without moving its hue. */
function scaleHex(hex: number, k: number): number {
  const ch = (shift: number) => Math.min(255, Math.round(((hex >> shift) & 0xff) * k)) << shift;
  return ch(16) | ch(8) | ch(0);
}

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
  /**
   * Pack, satchel, staff, cart. Written as the colour the *thing* wants; what
   * is actually used is `carriedTone`, which forces it off the figure's own
   * value. See that function for why it cannot be left to taste.
   */
  carried: number;
  /**
   * What the elder is sitting on, and the reason it is not `carried`.
   *
   * A stone is not a thing she is carrying, and the one-stop rule that pulls a
   * load away from its owner is wrong for it: applied to the stone it produced
   * a dark seat under a dark figure, which is the opposite of what a seat is
   * for. Only the elder has one.
   */
  seat?: number;
}

/**
 * Force a value break between a traveller and whatever they carry.
 *
 * Measured on a golden-hour busk, the pedlar's cloth and his handcart were at
 * luminance 115 and 118 — three levels apart out of 255. At that separation
 * the man and the cart are one lump with no silhouette between them, and a
 * pedlar whose cart is not a separate shape is not a pedlar, he is a
 * rectangular blob beside a road. The bard reads instantly at the same size
 * because every part of him is a stop off its neighbour.
 *
 * The break is always taken *downward*. A load is a dusty thing in the shade
 * of the person carrying it, so darker is what it looks like anyway; and this
 * file has already learned twice (see the elder's `cloth` and `crown` notes)
 * that lightening a traveller's part turns it into the brightest object on its
 * side of the frame, which takes the picture off the bard.
 *
 * Hue is preserved: the three channels are scaled together, so a warm cart
 * stays warm and only its value moves.
 */
function carriedTone(cloth: number, carried: number): number {
  const lum = (hex: number) =>
    0.2126 * ((hex >> 16) & 0xff) + 0.7152 * ((hex >> 8) & 0xff) + 0.0722 * (hex & 0xff);
  const ceiling = lum(cloth) / 2;
  const own = lum(carried);
  if (own <= ceiling) return carried;
  const k = ceiling / own;
  const ch = (shift: number) => Math.round(((carried >> shift) & 0xff) * k) << shift;
  return ch(16) | ch(8) | ch(0);
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
    // The hood, only a shade off the shawl. Age is carried by the seated,
    // rounded posture rather than by white hair. It has been down twice: at
    // 0xd8d3c8 as hair and at 0x9a958a as a hood it was still the lightest
    // value on that side of the frame, which turned a dark seated figure
    // with a pale top into a lamp rather than a person.
    crown: 0x6e6a61,
    carried: 0x6a6a63,
    seat: 0x8b8579,
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
    const solid = (color: number, rim = 0.4, shadowDepth = 0.55) => {
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
        shadowDepth,
      });
      this.materials.push(material);
      return material;
    };

    const cloth = solid(palette.cloth, 0.45);
    const under = solid(palette.under, 0.32);
    /**
     * The face, and it gets its own settings rather than the general ones.
     *
     * Every moment in this game that puts a traveller on screen turns them to
     * face the bard, and every camera in the game stands behind the bard — so
     * the side of these figures the lens sees is always the front, and the
     * front is always the side away from a sun that is low and behind. Shot
     * and measured, the head came back as a black box under a lit brim: the
     * ranked complaint against them is that they read as rocks, and a person
     * whose head is a hole is a rock. A lifted shadow floor and a harder rim
     * are what put light back on a face that no `dot(N,L)` term will ever
     * reach at this hour.
     */
    const skin = solid(palette.skin, 0.72, 0.72);
    const crown = solid(palette.crown, 0.45);
    const carried = solid(carriedTone(palette.cloth, palette.carried), 0.4);
    const seat = solid(palette.seat ?? palette.carried, 0.4);
    /**
     * Eyes. Two dark facets, and they are the whole difference between a
     * figure and a prop at the distance these are seen.
     *
     * Set five millimetres proud of the face so they catch their own edge,
     * and taken off the figure's own skin rather than painted black, so a
     * traveller in shade keeps a warm dark face rather than gaining two
     * punched holes.
     */
    const gaze = solid(scaleHex(palette.skin, 0.24), 0.14);

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
      const stone = add(boxPart(0.46, 0.17, 0.4, 0.88), seat, 0, 0, 0);
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
      const eyes = [-1, 1].map((side) =>
        add(boxPart(0.026, 0.022, 0.012, 0.9), gaze, side * 0.024, 0.775, 0.106),
      );
      this.headPivot.add(head, face, ...eyes);
      // The staff. Everything else about this figure is horizontal — a low
      // wide triangle is the whole idea — and a shape made only of horizontals
      // has nothing that reads at distance except its width, which is the one
      // measurement that changes with the camera. One long vertical leaning
      // past the head fixes that, and it costs twelve triangles. It reaches a
      // third of her own height above her: level with the head it would only
      // have thickened the head, which is the mistake this is the fix for.
      // It leans *in*, over her shoulder, not out. Tilted the other way it
      // stood clear of the figure and read as a fence post that happened to be
      // behind an old woman rather than as something she is holding.
      const staff = add(boxPart(0.05, 1.06, 0.05, 0.84), carried, 0.33, 0, 0.05);
      staff.rotation.z = 0.19;
      this.body.add(stone, torso, lap, neck, staff, this.headPivot);
      // Leaning forward toward whatever she is listening to.
      this.body.rotation.x = 0.12;
    } else {
      // The child is six tenths of an adult, not two thirds. At 0.66 the head
      // came out at three quarters of adult height, and three quarters of a
      // grown person standing next to a grown person is a short adult. The
      // head does not scale with this — it is set flat below — so shrinking
      // the body is also what makes the head read as a child's head.
      const tall = kind === 'child' ? 0.6 : 1;
      const hip = 0.42 * tall;
      const shoulder = 0.82 * tall;
      // Narrower legs, set further apart. They used to be two 0.11 boxes four
      // centimetres apart, which at any distance the camera holds closes up
      // into one block, and a figure with one block for a base has no base:
      // the whole thing reads as a slab standing on the ground. Eight and a
      // half centimetres of daylight between them is what buys the legs back.
      const legGeo = boxPart(0.085 * tall, hip, 0.115 * tall, 0.9);
      this.body.add(
        add(legGeo, under, -0.088 * tall, 0, 0),
        add(legGeo, under, 0.088 * tall, 0, 0),
      );
      // Narrow at the waist and broad at the shoulders, and narrower at the
      // waist than the legs are wide. That last part is the point: it puts a
      // notch in the outline at the hip, which is the only thing that tells
      // you where a torso ends and a pair of legs begins once the figure is
      // forty pixels tall and every part of it is the same value.
      const torso = add(
        boxPart(0.19 * tall, shoulder - hip + 0.1 * tall, 0.15 * tall, 1.52, 1.24),
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
      // A brim, and it is the single most valuable twelve triangles in this
      // file, because it is the one mark the bard has that these did not.
      //
      // The critique's suggestion was a shoulder cape instead, and a cape was
      // built and thrown away, correctly. These figures are a column of boxes
      // and every box's top face catches a light-value edge, so the outline
      // already reads as a ladder of horizontal rungs; a cape at the shoulder
      // adds a rung, and in the re-shot frame it made the walker *more* of a
      // totem, not less. The head-to-shoulder step the critique blamed is not
      // the fault either — the torso tapers out to 1.52 of its waist, so the
      // shoulders are already wider than the head.
      //
      // What was actually missing is a mark that says "person" before any
      // proportion is read at all, and at twenty pixels that mark is a hat.
      // Twice the head's width, a tenth of its height, and set just above the
      // eye line so the face sits under it in shade — which is how a brim
      // works and why the bard's is the first thing anyone sees of him. All
      // three standing kinds get one; the four silhouettes stay distinct on
      // what is *above* and *beside* them (a bedroll standing proud, a
      // satchel, a handcart) rather than on having no head.
      //
      // Raised from 0.66 to 0.82 of a head, because the mark had started
      // eating the thing it was meant to mark. Set at 0.66 the brim's
      // underside sat level with the eye line, so the one band of the head
      // with anything in it was permanently in the brim's own shade, and the
      // measured result was a lit plank with a black box under it — the
      // "headless box stack" the critique named. A brim belongs *above* the
      // eyes; it shades them, it does not replace them.
      const brim = add(
        boxPart(headSize * 1.9, headSize * 0.1, headSize * 1.72, 1),
        crown,
        0,
        headSize * 0.82,
        -0.005,
      );
      /**
       * A face. Two eyes and a nose, twenty-four triangles between them.
       *
       * These figures were built to be legible as people and then to stop
       * asking for attention, and the first half quietly failed: a column of
       * boxes with a hat on it is a scarecrow, and every critique of this
       * game has said so — the busk audience "reads as rocks", the dusk
       * encounter as "a headless box stack". Nothing about the silhouette was
       * wrong. What was missing is the mark that says *person* rather than
       * *object*, and it is the same two dots the bard just got.
       */
      const eyeGeo = boxPart(headSize * 0.19, headSize * 0.16, headSize * 0.05, 0.9);
      const eyes = [-1, 1].map((side) =>
        add(eyeGeo, gaze, side * headSize * 0.21, headSize * 0.53, headSize * 0.465),
      );
      const nose = add(
        boxPart(headSize * 0.15, headSize * 0.15, headSize * 0.11, 0.55),
        skin,
        0,
        headSize * 0.34,
        headSize * 0.47,
      );
      this.headPivot.position.y = shoulder + 0.06 * tall;
      this.headPivot.add(head, hair, brim, nose, ...eyes);
      this.body.add(this.headPivot);

      if (kind === 'walker') {
        // A tall pack, and a bedroll lashed across the top of it that stands
        // clear above the head.
        //
        // The pack alone was the previous answer and it did nothing, for two
        // reasons that only show up in a frame. It topped out level with the
        // head rather than above it, so it added width to the head instead of
        // height to the figure; and it sits behind the shoulders, while every
        // moment in the game that puts a traveller on screen has them turned
        // to face the bard — so the camera, which is behind the bard, was
        // looking at the one side of this figure the pack cannot be seen from.
        // A roll standing proud of the head reads from every side there is.
        const pack = add(boxPart(0.26, 0.5, 0.19, 0.9), carried, 0, hip + 0.14, -0.15);
        pack.rotation.x = -0.06;
        const roll = add(boxPart(0.36, 0.13, 0.15, 1), under, 0, hip + 0.72, -0.12);
        roll.rotation.z = 0.13;
        this.body.add(pack, roll);

        // A walking staff, and the point of it is that it is on ONE side.
        //
        // Measured before it existed: reduced to twenty pixels the walker is
        // twenty cells wide and forty-four tall, and its width per row runs
        // 9,9,9,9,9,10,10,11,11,12,12,12 — the same nine to twelve cells from
        // the boots to the shoulders, with a straight left edge at cell 4-6 on
        // thirty-eight of forty-four rows. That is a bar, and the pack and the
        // bedroll cannot fix it: both sit on the centreline, so the pack adds
        // depth the camera cannot see and the roll adds height, and neither
        // adds a side.
        //
        // A staff does, for twelve triangles. It stands outboard of the boots,
        // leans its head back in over the shoulder, and passes the hanging
        // hand on the way — so it reads as *held* rather than as a post the
        // figure happens to be standing next to, which is the failure the
        // elder's staff note already records from the other direction.
        //
        // Deliberately not a second vertical of the same height: it finishes
        // above the hat, so the top of the silhouette gains a notch on one
        // side as well as a bump at the hip.
        const staff = add(boxPart(0.038, 1.26, 0.038, 0.86), under, 0.33, 0, 0.05);
        staff.rotation.z = 0.16;
        staff.rotation.x = -0.04;
        this.body.add(staff);
        // And the hand goes out to meet it. A staff the figure is not holding
        // is a fence post it is standing beside — the elder's note records the
        // same trap from the other end.
        rightArm.rotation.z = 0.24;
      }

      if (kind === 'child') {
        // A satchel slung across, hanging well outside the body box, and the
        // strap that explains it. This is the only part of the child that
        // leaves the silhouette, and it is deliberately too big for the
        // wearer: a bag the right size for a child is, at this distance, a
        // slightly wider hip.
        const satchel = add(boxPart(0.17, 0.15, 0.11, 0.92), carried, 0.155, hip - 0.02, 0.03);
        satchel.rotation.z = -0.1;
        // The strap runs *down* from the shoulder to the bag, which is not
        // what it did. `boxPart` grows along +Y from its origin, so a strap
        // placed at the shoulder and merely rolled stood forty centimetres
        // straight up out of it — clear over the top of the child's head and,
        // shot from the front, drawn as a diagonal plank across the face. It
        // has been in every encounter frame this project has taken, and it is
        // half of why these figures read as scarecrows.
        const strap = add(boxPart(0.04, 0.31, 0.025, 1), crown, 0.02, shoulder + 0.02, 0.05);
        strap.rotation.x = Math.PI;
        strap.rotation.z = -0.45;
        this.body.add(satchel, strap);
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
        // Two shafts and the cross grip between them, running forward out of
        // the tray to the pedlar's hand.
        //
        // One shaft was there before and it was tucked inside the cart's own
        // footprint, where it did nothing an outline could see. Handles are
        // the only part of a barrow that leaves the box the barrow is, and at
        // the size these figures occupy the outline is the object: a tray on
        // wheels beside a man is a crate, a tray on wheels with two poles
        // running forward to a grip is unmistakably being pulled.
        const shaftGeo = boxPart(0.04, 0.5, 0.04, 1);
        for (const side of [-1, 1]) {
          const shaft = add(shaftGeo, under, side * 0.15, 0.38, 0.22);
          shaft.rotation.x = Math.PI / 2 - 0.22;
          cart.add(shaft);
        }
        cart.add(add(boxPart(0.34, 0.04, 0.045, 1), under, 0, 0.49, 0.71));
        // The cart toes in toward its owner, which brings the grip to his hand
        // instead of leaving it pointing off into the field.
        cart.rotation.y = -0.26;
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
    //
    // The second term only exists while somebody is listening, and it is
    // deliberately the largest thing this file does. A crowd standing
    // perfectly square while a bard plays is the reason these figures were
    // called rocks: a still frame has no way to tell a person who is not
    // moving from a stone that cannot. Rocking does not need to be big to
    // read — it needs to be *off vertical*, and four degrees is enough for
    // that while staying under the two-degree-per-figure budget the rest of
    // this idle keeps for anyone merely standing about.
    this.body.rotation.z =
      Math.sin(t * 0.37) * 0.035 + Math.sin(t * 0.93 + this.phase) * 0.038 * this.attention;
    this.headPivot.rotation.y = Math.sin(t * 0.29 + 1.3) * 0.14 * (1 - this.attention * 0.7);
    // A nod, on a slower cycle than the rock so the two do not lock into one
    // bob. Nothing here is on the beat: the music is the bard's, and a crowd
    // nodding in time with it would read as choreography.
    this.headPivot.rotation.x =
      -this.attention * 0.06 +
      Math.sin(t * 0.83) * 0.012 +
      Math.sin(t * 1.37 + this.phase * 0.6) * 0.05 * this.attention;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
