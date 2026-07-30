/**
 * The bard.
 *
 * There is no skeleton and no imported animation. The figure is a small
 * hierarchy of procedurally-built low-poly parts driven by trigonometry,
 * which is the right call for three reasons: the whole world is procedural
 * so a single imported rig would be the only asset in the game; a hand-
 * driven walk can be *phase-locked to the music*, which a baked clip
 * cannot; and the entire character costs a few kilobytes.
 *
 * Proportions are the first thing to get right and the easiest to get
 * wrong. The figure is roughly five heads tall rather than the seven and a
 * half of an adult human, and the hat is deliberately wider than the
 * shoulders. Low-poly characters that use real proportions read as
 * mannequins: with no face and no cloth simulation, the head and the hat
 * are the only things carrying the character, so they have to be big enough
 * to survive being forty pixels tall on a phone.
 *
 * The animation principles that actually matter here, in rough order of how
 * much each contributes to the character reading as alive:
 *
 * - **The body leads, the extremities follow.** Every limb lags the torso
 *   by a fixed phase. Drive everything from one phase with no offsets and
 *   you get a marching toy.
 * - **Vertical bob is twice the step frequency, and asymmetric.** A body
 *   rises fast on the push and falls slow onto the next foot. A pure sine
 *   at step frequency is the single most common tell of a placeholder walk.
 * - **The head counter-rotates.** It stays pointed where the bard is going
 *   while the shoulders swing under it. This is most of what separates
 *   "person walking" from "object being translated".
 * - **Nothing is symmetrical.** The hat sits at an angle, one arm carries
 *   the instrument, the walk has a slight favour to one side.
 *
 * The cloak is deliberately not simulated. It is geometry with a high sway
 * weight, so the painterly shader's wind moves it for free and it responds
 * to the same gusts as the grass — which is both cheaper than a cloth
 * solver and more *coherent*, because the world's wind and the cloak's wind
 * are then literally the same number.
 *
 * Local +Z is forward, matching the road's heading convention (a heading of
 * h maps local +Z to (sin h, cos h)). Everything that has a front and a
 * back — the cloak's opening, the hat's dip, the slung instrument — depends
 * on that, so it is stated here once rather than rediscovered per part.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Object3D,
  Vector3,
  type ShaderMaterial,
} from 'three';
import { createFoliageMaterial, createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import type { Instrument } from '../../core/instruments';

/** How the bard is currently behaving. Drives which pose blend is active. */
export type BardPose = 'idle' | 'walking' | 'playing' | 'sitting';

export interface BardColors {
  skin: number;
  tunic: number;
  cloak: number;
  cloakLining: number;
  trousers: number;
  boots: number;
  hat: number;
  hatBand: number;
  hair: number;
}

/**
 * The palette. Warm, saturated, and deliberately louder than anything in
 * the landscape — DESIGN.md's standing rule is that warmth belongs to the
 * bard and the music, and in a green world a rust cloak is what makes the
 * character findable at any distance.
 */
export const DEFAULT_BARD_COLORS: BardColors = {
  skin: 0xd9a077,
  tunic: 0xc4694a,
  cloak: 0xa8452f,
  cloakLining: 0xd98a5c,
  trousers: 0x4a5a6b,
  // Leather, not bark. The boots and the instrument strap share this, and
  // both sit in shadow most of the day: at 0x4e3a2c they crushed to flat
  // black, which turned the feet into two holes under the cloak and drew the
  // strap across the chest as a hard ink line.
  boots: 0x6b4a33,
  hat: 0x8c3d33,
  hatBand: 0xe0b463,
  // Not near-black. Under a hat brim that casts a real shadow, a very dark
  // hair colour crushes to a flat black rectangle and the back of the head
  // reads as a hole cut through the character.
  hair: 0x6b4632,
};

/**
 * The figure's skeleton, as plain numbers, in metres above the ground.
 *
 * Collected here rather than sprinkled through the constructor because
 * proportion is the thing most likely to be adjusted, and adjusting it by
 * hunting for magic numbers across a hundred lines is how a character ends
 * up with its hat floating above its head.
 */
const HIP_Y = 0.48;
const SHOULDER_Y = 0.9;
const CHEST_TOP = 0.98;
const HEAD_Y = 0.97;
const HEAD_HEIGHT = 0.28;
const HAT_Y = HEAD_Y + HEAD_HEIGHT - 0.06;

/** Hip to knee, and knee to ankle. They sum to the old one-piece leg. */
const THIGH_LEN = 0.22;
const SHIN_LEN = 0.18;

/**
 * Shoulder pivot to the middle of the hand, in metres.
 *
 * There is no elbow on this figure, so this is a hard constraint rather than
 * a starting length: the hand can only ever be on a sphere of this radius
 * about the shoulder. `gripNeck` solves against that sphere, which is why
 * the number lives here instead of inline — it has to stay equal to the
 * hand mesh's own offset in the constructor or the hand grips thin air.
 */
const ARM_REACH = 0.43;
/**
 * The stretch of the instrument's own +Y axis a hand is allowed to hold.
 *
 * `instrumentGeometry` builds the neck from y 0.245 to 0.555 and then slides
 * the whole instrument down by half its 0.62 length, so the neck ends up
 * spanning -0.065 to 0.245 about the pivot. These are that span pulled in at
 * both ends: off the shoulder joint at the bottom, short of the pegbox at
 * the top, which is where a hand actually goes on a lute.
 */
const NECK_GRIP_MIN = -0.02;
const NECK_GRIP_MAX = 0.2;
/**
 * The stretch of the same axis the *strumming* hand is allowed to hold.
 *
 * The body's rings sit at local y -0.31 to -0.035 about the pivot: bowl to
 * -0.255, belly to -0.185, waist to -0.11, shoulders to -0.035. This is the
 * belly and the waist — the middle of the soundboard, where a soundhole is
 * and where a hand strums. Not the bowl, which is the bottom edge, and not
 * the shoulders, which is where the neck starts.
 */
const STRUM_GRIP_MIN = -0.25;
const STRUM_GRIP_MAX = -0.11;

/**
 * The playing carry: where the instrument sits, in torso space, while it is
 * being played, and the Euler angles that put it there.
 *
 * **This is the fix for the frame the whole game is about.** The busking
 * postcards showed a red cone with a hat and a brown stick emerging from
 * behind its left edge; reduced to twenty pixels the figure was a traffic
 * cone, while the *walking* bard at the same twenty pixels reads instantly.
 * So the fault was the pose, not the model, and it is an occlusion fault
 * rather than a contrast one. Measured on the shipped build, flooding this
 * one mesh and differencing the frame with it shown against the frame with
 * it hidden: **19.4 per cent of the instrument's own footprint changed a
 * single pixel.** The other four fifths were behind the bard.
 *
 * Why. The camera stands *behind* him — `FRAMINGS.busking` is 3.9 m back
 * against 2.7 m of side, which is 35 degrees off his spine, a rear
 * three-quarter — and the old carry brought the instrument round to the
 * front of his chest at z +0.30 with the body swung to x -0.14, his far
 * side. His own torso and the cloak were between it and the lens. Nothing
 * about the instrument's own angles could fix that; a shape held in front of
 * a figure photographed from behind is not visible, however well it is
 * posed.
 *
 * These numbers are therefore solved against that camera, the way the lap
 * carry is solved against the resting one, and the working is worth keeping
 * because it is the only reason they are not round numbers. Projected on the
 * busk shot, the cloak's own silhouette occupies screen x >= 920 at every
 * row of the torso and the hat brim reaches 897; screen x runs
 * `962 - 200·x - 121·z` px in torso space there. So an instrument is clear
 * of the figure's near edge when `200·x + 121·z > 47`. This carry puts the
 * body of the lute at x 0.29, z 0.14 — screen 887, thirty-three pixels
 * outside the cloak — and the pegbox at screen 920, which is the edge
 * itself. The whole instrument is on the camera's side of the cloth.
 *
 * The handedness flipped with it, and that was free: the body now sits at
 * the *right* hip under the strumming hand with the neck rising across to
 * the left, which is how a right-handed player holds a lute and is also the
 * arrangement that puts the big end of the shape on the near side.
 *
 * The `y` here is an offset from `SHOULDER_Y`, matching the slung and lap
 * terms it is summed against.
 */
const PLAY_CARRY_POS: readonly [number, number, number] = [0.198, 0.592 - SHOULDER_Y, 0.192];
const PLAY_CARRY_ROT: readonly [number, number, number] = [0.557, -0.373, 0.566];

/**
 * How far the seated bard's boots reach below his own origin.
 *
 * This is the whole contract between the sitting pose and whatever the bard
 * is sitting on. The pose puts the **group origin at the seat surface** —
 * hips a little above it, thighs forward, shins dropped past it — so a caller
 * that wants the bard seated has to stand him on top of the seat, and a seat
 * this tall is the only one his legs reach the ground from.
 *
 * The number is not free. With the thighs horizontal the seat height is
 * whatever the shin and boot are, less the height of the hip joint above the
 * cushion, and this figure has short legs for its height on purpose. Raising
 * it means sloping the thighs down, which is a different, more hunched pose.
 *
 * `Campfire` builds its seat log to this height. The two feet land within a
 * centimetre or two of each other rather than exactly level, because the
 * pose is deliberately asymmetric and nobody sits with their feet squared.
 */
export const SITTING_SEAT_HEIGHT_M = 0.2;

/**
 * The seated pose, as the numbers it is actually made of.
 *
 * Each pair is left then right. Two things are being solved at once here:
 * the thighs have to come up to roughly horizontal and the shins have to
 * hang back under the seat, and the shin's angle is measured *in the world*,
 * not at the knee — a knee angle alone would swing the feet wherever the
 * thigh happened to be pointing. So the knee below is derived: it is
 * whatever cancels the hip and the pelvis and leaves the shin where it is
 * wanted.
 */
const SIT_HIP_DROP = 0.42;
/** The pelvis rocks back; nobody sits square. Rotates the legs with it. */
const SIT_PELVIS = -0.1;
const SIT_THIGH: [number, number] = [-1.48, -1.36];
/** Shin angle off vertical, positive tucking the foot back under the seat. */
const SIT_SHIN: [number, number] = [0.02, 0.28];

/**
 * A tapered box. Most of the bard is one of these.
 *
 * Exported because the travellers are built from the same primitive. Two
 * figure builders that disagree about how a limb is made would read as two
 * different games standing next to each other, and the whole point of the
 * people on the road is that they belong to the bard's world.
 */
export function boxPart(
  width: number,
  height: number,
  depth: number,
  topScale = 1,
  taperDepth = topScale,
): BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const tw = hw * topScale;
  const td = hd * taperDepth;
  // Corners: bottom then top, counter-clockwise from -x -z.
  const b = [
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [hw, 0, hd],
    [-hw, 0, hd],
  ];
  const t = [
    [-tw, height, -td],
    [tw, height, -td],
    [tw, height, td],
    [-tw, height, td],
  ];
  const quads: number[][][] = [
    [b[0], b[1], t[1], t[0]],
    [b[1], b[2], t[2], t[1]],
    [b[2], b[3], t[3], t[2]],
    [b[3], b[0], t[0], t[3]],
    [t[0], t[1], t[2], t[3]],
    [b[3], b[2], b[1], b[0]],
  ];
  const verts: number[] = [];
  for (const [p0, p1, p2, p3] of quads) {
    verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The cloak: a tapered skirt of quads hanging from the shoulders, split
 * into panels so the wind can move each one differently.
 *
 * The arc is centred on **-Z, the bard's back**. The previous version
 * centred it on +Z, which wrapped the cloak around the front of the figure
 * and turned him into a traffic cone with a hat: no face, no arms, no
 * legs, no instrument, from every angle the camera actually uses. A cloak
 * that hides the character is worse than no cloak.
 *
 * The hem stops around mid-thigh rather than at the ankle. A floor-length
 * cloak reads as a robe and, more importantly, swallows the legs — and the
 * legs are the only part of the figure that says "walking" at a glance.
 */
/**
 * Where the cloak's shoulder line sits above the mesh's own origin.
 *
 * Named because the sitting pose has to scale the skirt about that line and
 * cannot do it by eye: shortening the skirt moves the collar unless the mesh
 * is slid down by the same amount, and the collar riding up over the head is
 * the exact failure the shortening exists to fix.
 */
const CLOAK_TOP = 0.46;

function cloakGeometry(): BufferGeometry {
  const panels = 11;
  const topRadius = 0.155;
  const bottomRadius = 0.33;
  const top = CLOAK_TOP;
  // Six centimetres shorter than it was. The legs are the only part of the
  // figure that says "walking" at a glance and the old hem left them two
  // boot-stumps poking out from under a bell.
  const bottom = -0.1;
  const verts: number[] = [];
  // Wide enough to read as a cloak from behind — which is the angle the
  // walking camera holds — and open enough at the front that the hands and
  // the instrument are never buried.
  const arc = Math.PI * 1.22;
  const back = -Math.PI * 0.5;
  const start = back - arc / 2;

  for (let i = 0; i < panels; i++) {
    const a0 = start + (i / panels) * arc;
    const a1 = start + ((i + 1) / panels) * arc;
    // Ragged hem: each panel hangs to a slightly different length. A sine
    // rather than `i % 3`, which put its deepest panel dead on the centre
    // back — with the two neighbours stepping up either side the hem came to
    // a point and the cloak read as a kite tail.
    const ragged = (n: number) => Math.sin(n * 2.39 + 0.7) * 0.021;
    const drop0 = bottom + ragged(i);
    const drop1 = bottom + ragged(i + 1);
    // The front edges are pulled in and lifted so the cloak falls open off
    // the shoulders instead of ending in two flat vertical planks.
    const edge0 = Math.min(1, (i + 0.5) / 2.2, (panels - i - 0.5) / 2.2);
    const edge1 = Math.min(1, (i + 1.5) / 2.2, (panels - i - 1.5) / 2.2);
    const r0 = topRadius + (bottomRadius - topRadius) * (0.35 + 0.65 * edge0);
    const r1 = topRadius + (bottomRadius - topRadius) * (0.35 + 0.65 * edge1);
    const t0 = [Math.cos(a0) * topRadius, top, Math.sin(a0) * topRadius];
    const t1 = [Math.cos(a1) * topRadius, top, Math.sin(a1) * topRadius];
    const b0 = [Math.cos(a0) * r0, drop0 + (1 - edge0) * 0.14, Math.sin(a0) * r0];
    const b1 = [Math.cos(a1) * r1, drop1 + (1 - edge1) * 0.14, Math.sin(a1) * r1];
    // One sheet, not two, and wound so its normals point *away* from the
    // body. Both of those were wrong before. The material here is
    // `createFoliageMaterial`, which is already `DoubleSide`, so the second
    // set of reversed triangles the old code pushed on top bought nothing —
    // `colorVariant` is a per-fragment grain mix, not a per-side lining
    // colour — and two coincident sheets under a double-sided material just
    // fight for the depth test. Meanwhile the winding that survived that
    // fight faced inward, so the cloak was lit as though the sky were
    // underneath it and came out a flat pale salmon instead of rust.
    verts.push(...t0, ...b1, ...b0, ...t0, ...t1, ...b1);
  }

  // A collar: a short, nearly upright band around the top of the arc,
  // standing up into a low hood at the centre back. Without it the cloak
  // appears to start halfway down the back with nothing holding it on. It
  // has to stay close to vertical — the first attempt flared it out to a
  // third again its radius and, because upward-facing surfaces take the
  // sky's full light under this lighting model, it came back a bright salmon
  // ring and read as a clown's ruff.
  //
  // The rise at the back is small on purpose. `baseShade` darkens this
  // geometry toward its hem, so the collar is the brightest cloth on the
  // figure whatever else happens to it; at 0.085 it stopped being a collar
  // and became a pale bib covering the neck and both shoulders — the ruff
  // again, by another route. Three centimetres reads as a turned-up collar
  // and nothing more, and the black notch it was meant to fill is dealt
  // with where it actually comes from, in the head's shadow depth.
  const collarBase = top + 0.055;
  for (let i = 0; i < panels; i++) {
    const a0 = start + (i / panels) * arc;
    const a1 = start + ((i + 1) / panels) * arc;
    // Peaks at the centre back (-PI/2) and falls away to nothing by the
    // shoulders, so the front of the collar is unchanged.
    const rise = (a: number) => 0.03 * Math.pow(Math.max(0, -Math.sin(a)), 1.5);
    const r = topRadius * 1.07;
    const c0 = [Math.cos(a0) * topRadius, top, Math.sin(a0) * topRadius];
    const c1 = [Math.cos(a1) * topRadius, top, Math.sin(a1) * topRadius];
    const u0 = [Math.cos(a0) * r, collarBase + rise(a0), Math.sin(a0) * r];
    const u1 = [Math.cos(a1) * r, collarBase + rise(a1), Math.sin(a1) * r];
    verts.push(...c0, ...u1, ...u0, ...c0, ...c1, ...u1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  // Inverted weighting: the hem (low Y) moves, the collar (high Y) does not.
  const position = geometry.attributes.position as BufferAttribute;
  const sway = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    sway[i] = Math.pow(Math.min(1, Math.max(0, (top - y) / (top - bottom))), 1.6);
  }
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  return geometry;
}

/**
 * A wide-brimmed, slightly crumpled hat.
 *
 * The brim is wider than the shoulders and the crown is short. The earlier
 * proportions — narrow brim, tall straight crown — read as a stovepipe,
 * and a stovepipe is a different character entirely.
 */
function hatGeometry(): BufferGeometry {
  const segments = 11;
  const brim = 0.315;
  const crownRadius = 0.155;
  // Shorter than it was by three centimetres. At 0.155 the crown was over
  // half a head tall with near-parallel sides and read as a bowler; the
  // charm of this hat is all in the brim, so the crown's job is to be a
  // small soft lump that lets the brim be the shape you remember.
  const crownTop = 0.125;
  const verts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    // The brim dips at the front and lifts at the back; a flat disc reads
    // as a lampshade. The dip is deep enough to shade the face, which is
    // what makes the hat look worn rather than balanced on top.
    const dip = (a: number) => Math.sin(a) * 0.06 - 0.045;
    const rim = (a: number) => brim * (0.86 + Math.abs(Math.cos(a)) * 0.22);
    const c0 = [Math.cos(a0) * crownRadius, 0, Math.sin(a0) * crownRadius];
    const c1 = [Math.cos(a1) * crownRadius, 0, Math.sin(a1) * crownRadius];
    const e0 = [Math.cos(a0) * rim(a0), dip(a0), Math.sin(a0) * rim(a0)];
    const e1 = [Math.cos(a1) * rim(a1), dip(a1), Math.sin(a1) * rim(a1)];
    verts.push(...c0, ...e0, ...e1, ...c0, ...e1, ...c1);
    verts.push(...c0, ...e1, ...e0, ...c0, ...c1, ...e1);

    // The crown leans back a little and tapers, so it has a direction.
    const k = crownRadius * 0.74;
    const k0 = [Math.cos(a0) * k, crownTop, Math.sin(a0) * k - 0.03];
    const k1 = [Math.cos(a1) * k, crownTop, Math.sin(a1) * k - 0.03];
    verts.push(...c0, ...k0, ...k1, ...c0, ...k1, ...c1);
  }
  // Cap the crown.
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const k = crownRadius * 0.74;
    verts.push(
      0, crownTop, -0.03,
      Math.cos(a0) * k, crownTop, Math.sin(a0) * k - 0.03,
      Math.cos(a1) * k, crownTop, Math.sin(a1) * k - 0.03,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  // The brim is the one part of the figure light enough to move in wind.
  // Weighting it by radius rather than height means the tips flutter and
  // the crown stays put.
  const position = geometry.attributes.position as BufferAttribute;
  const sway = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i));
    const above = position.getY(i) > crownTop * 0.4 ? 0 : 1;
    sway[i] = above * Math.min(1, Math.max(0, (r - crownRadius) / (brim - crownRadius)));
  }
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  return geometry;
}

/** The band around the base of the crown. Breaks up the hat's one big mass. */
function hatBandGeometry(): BufferGeometry {
  const segments = 11;
  const radius = 0.163;
  const verts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = [Math.cos(a0) * radius, 0.004, Math.sin(a0) * radius];
    const p1 = [Math.cos(a1) * radius, 0.004, Math.sin(a1) * radius];
    const q0 = [Math.cos(a0) * radius * 0.97, 0.048, Math.sin(a0) * radius * 0.97];
    const q1 = [Math.cos(a1) * radius * 0.97, 0.048, Math.sin(a1) * radius * 0.97];
    verts.push(...p0, ...q0, ...q1, ...p0, ...q1, ...p1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The instrument. One shape, recoloured and reproportioned per instrument,
 * because six modelled instruments is six times the geometry for something
 * carried on the bard's back and seen mostly in silhouette.
 *
 * Silhouette is the whole job here, and the previous proportions failed it
 * badly: a body 0.28 tall and 0.14 deep under a neck only 0.32 long is, at
 * any distance the camera actually holds, a mallet. From the side it read as
 * a handbag on a strap. What makes a lute a lute at forty pixels is one
 * ratio — a *short* body under a *long thin* neck — so the body is now a
 * third of the length and the neck two thirds, and the body is flattened in
 * depth so it lies against the bard's back instead of bulging off it.
 *
 * Built with its base at local zero and translated so the finished shape is
 * centred on its own middle; the carrying pivot then only has to rotate it,
 * and a drum and a lute of different lengths hang from the same pivot
 * without each needing its own offset.
 */
function instrumentGeometry(kind: string): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const isDrum = kind === 'drum' || kind === 'bodhran';
  const isFlute = kind === 'flute' || kind === 'reedflute' || kind === 'pipe';
  let length: number;

  if (isFlute) {
    length = 0.66;
    parts.push(boxPart(0.046, length, 0.046, 0.88));
    // A mouthpiece block, so the pipe has an end and a direction rather than
    // reading as a dropped stick.
    const lip = boxPart(0.062, 0.075, 0.062, 0.9);
    translate(lip, 0, length - 0.075, 0);
    parts.push(lip);
  } else if (isDrum) {
    length = 0.34;
    parts.push(boxPart(0.34, 0.1, 0.34, 1));
    const rim = boxPart(0.36, 0.03, 0.36, 1);
    translate(rim, 0, 0.035, 0);
    parts.push(rim);
  } else {
    // Bowl, belly, waist, shoulders, neck, pegbox. Lute, harp, hurdy-gurdy
    // and bells all read acceptably from this: what the eye picks up is the
    // teardrop-under-a-stick, not which of them it is.
    //
    // Slung, this is seen from directly behind with its soundboard square to
    // the camera, so the body's *outline* is doing all the work and two
    // things decide whether that outline is a lute or a garden tool. The
    // widest ring sits low, a third of the way up rather than at the top; and
    // two rings are spent on a long taper into the neck rather than one short
    // abrupt step. Widest-at-the-top with an abrupt step is a mallet, which
    // is what the first version was.
    //
    // The body is also nearly as deep as it is wide. A plate presented
    // face-on has no volume at all, and a flat plate on the end of a shaft is
    // a spade whatever its outline.
    const bowl = boxPart(0.128, 0.055, 0.086, 1.53, 1.34);
    parts.push(bowl);
    const belly = boxPart(0.196, 0.07, 0.115, 1.07, 1.08);
    translate(belly, 0, 0.055, 0);
    parts.push(belly);
    const waist = boxPart(0.21, 0.075, 0.124, 0.74, 0.81);
    translate(waist, 0, 0.125, 0);
    parts.push(waist);
    const shoulders = boxPart(0.155, 0.075, 0.1, 0.4, 0.5);
    translate(shoulders, 0, 0.2, 0);
    parts.push(shoulders);
    // Long, thin, and a touch tapered. This one part is most of why the
    // shape reads as an instrument at all.
    const neck = boxPart(0.042, 0.31, 0.036, 0.82);
    translate(neck, 0, 0.245, 0);
    parts.push(neck);
    // The pegbox is angled back off the neck in a real lute. Faking that
    // with a wider, shallower block is enough at this size and costs nothing.
    const pegbox = boxPart(0.068, 0.085, 0.031, 0.8);
    translate(pegbox, 0, 0.535, -0.011);
    parts.push(pegbox);
    // Kept to 0.62 rather than the 0.72 of the first attempt. Length is set
    // by where the bowl lands, not by the instrument: slung, the bowl has to
    // sit high enough up the back that the cloak has not yet flared past it,
    // or it hangs clear of the cloth with daylight showing between the two.
    length = 0.62;
  }

  const merged = concat(parts);
  translate(merged, 0, -length / 2, 0);
  merged.computeVertexNormals();
  return merged;
}

function translate(geometry: BufferGeometry, dx: number, dy: number, dz: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) + dx, position.getY(i) + dy, position.getZ(i) + dz);
  }
}

function concat(parts: BufferGeometry[]): BufferGeometry {
  let total = 0;
  for (const part of parts) total += (part.attributes.position as BufferAttribute).count;
  const array = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    const attr = part.attributes.position as BufferAttribute;
    array.set(attr.array as Float32Array, offset);
    offset += attr.count * 3;
    part.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(array, 3));
  return out;
}

export class Bard {
  readonly group = new Group();

  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly headPivot = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  /** Knees, in the same left-then-right order as `boots`. */
  private readonly knees: Group[] = [];
  private readonly instrumentPivot = new Group();
  private instrumentMesh: Mesh | null = null;
  /** Ankles, so the foot can stay flatter than the leg it hangs off. */
  private readonly boots: Mesh[] = [];
  /** The cloak mesh, so the walk can trail it without moving the torso. */
  private readonly cloak: Mesh;
  /** Scratch for `gripNeck`, so the solve allocates nothing per frame. */
  private readonly grip = new Vector3();

  private readonly materials: ShaderMaterial[] = [];
  private readonly globals: PainterlyGlobals;

  private pose: BardPose = 'idle';
  private poseBlend = 1;
  private previousPose: BardPose = 'idle';

  /** Walk phase in radians. Advanced by distance, not by time. */
  private stride = 0;
  private speed = 0;
  private smoothedSpeed = 0;
  private elapsed = 0;

  /** Rises briefly on each note played, and decays. Drives the strum. */
  private strum = 0;
  /** 0..1 crowd warmth; makes the playing bigger and the stance more open. */
  private warmth = 0;

  constructor(globals: PainterlyGlobals, colors: BardColors = DEFAULT_BARD_COLORS) {
    this.globals = globals;
    this.group.name = 'bard';

    /**
     * A rigid body part. `swayAttribute` is off and no `aSway` attribute is
     * built: these are boots and bones, not foliage, and nothing about them
     * should move in the wind. It used to be on, which worked only because
     * an absent vertex attribute reads as zero — true in practice, but a
     * shader compiled to read an attribute nobody supplies is a coincidence
     * rather than a decision. The cloak and the hat brim, which do move,
     * declare it explicitly and ship the attribute to go with it.
     */
    const solid = (color: number, rim = 0.5, shadowDepth = 0.45) =>
      this.track(
        createPainterlyMaterial(globals, {
          color,
          colorVariant: 0xffe0c0,
          grain: 0.3,
          grainScale: 1.8,
          rim,
          rimPower: 2.1,
          bandSoftness: 0.09,
          flatShading: true,
          swayAttribute: false,
          sway: 0,
          shadowDepth,
        }),
      );

    /**
     * Anything that lives under the hat brim.
     *
     * The brim casts a real shadow and the head is the only part of the
     * figure permanently inside one, so at the general 0.45 the whole band
     * between brim and collar went to near-black and read, from directly
     * behind, as a hole punched through the neck. Lifting the shadow floor
     * for these parts alone keeps that band as warm shade. It is the same
     * lighting model — `shadowDepth` is how deep a material lets its own
     * shadows go, and the doc on it says as much: cosy games do not use
     * black. Painting the hair lighter was tried first and only produced a
     * marginally lighter hole, because the problem was the shadow, not the
     * albedo.
     */
    const underBrim = (color: number, rim = 0.5) => solid(color, rim, 0.72);

    /**
     * The legs, which have the same problem the head has and worse.
     *
     * Measured on `07-night-campfire` with the seated pose actually settled:
     * the thighs came back at luminance 21.3 and 17.6 against ground at
     * 41.8-49.1 and the seat log they rest on at 60.8. The one shape in the
     * figure whose job is to say "this person is sitting down" — a
     * horizontal bar of thigh against the log — was the darkest object
     * anywhere near him, more than a stop below everything it had to read
     * against, which is a silhouette you cannot see rather than one that is
     * wrong.
     *
     * The cause is not the pose and not the camera. `trousers` is 0x4a5a6b,
     * a cool slate, deliberately: it is the one cool note on a warm figure
     * and it earns its place in daylight. A campfire is a warm source, and a
     * warm light on a cool albedo cancels — sampled, the rendered pixel was
     * (43,15,17), keeping 58 per cent of the albedo's red and 16 per cent of
     * its green and blue. Repainting the trousers warm would fix the fire
     * and lose the daylight, so the fix is the same one the head already
     * uses: add enough rim that the limb keeps an edge when its faces are
     * turned away from the only light in the scene. Rim is hue-neutral, so
     * the slate stays slate.
     *
     * **The shadow floor was tried here and does nothing — do not try it
     * again.** Measured same-frame, with the thigh's own pixels isolated by
     * flooding its albedo and keeping the mask: `shadowDepth` 0.45 -> 0.72
     * -> 0.90 leaves the thigh at 22.9, 22.9, 22.9. That is the right answer
     * and it says what the real cause is. The head's dark band is genuinely
     * *in shadow* — the brim casts one — so lifting the shadow floor pays
     * there. A seated thigh at a campfire is not in anyone's shadow; its
     * faces are simply turned away from the only light in the scene, which
     * is a `dot(N,L)` term no shadow dial touches. Rim is the one dial that
     * moves it: 0.35 -> 0.62 takes the thigh from 19.3 to 22.9, and 0.90
     * would reach 26.3.
     *
     * 0.62 rather than 0.90 because this material is on the *walking* bard
     * in daylight too, where the legs have no legibility problem and a hard
     * rim on a near-frontlit limb reads as a plastic outline. It buys a
     * quarter of a stop, which is honest but small: the thigh is still 0.85
     * of a stop under the ground behind it, and closing that properly means
     * the albedo, which is a daylight decision and not this wave's to make.
     */
    const legMaterial = () => solid(colors.trousers, 0.62);

    // --- legs ----------------------------------------------------------
    // Pivots sit at the hip so a rotation swings the leg rather than
    // sliding it. This is the one thing that has to be right or the walk
    // is unfixable downstream.
    // The leg is two pieces with a knee between them. It used to be one
    // rigid 0.4 m box, which is enough for a walk — a swing from the hip and
    // a roll at the ankle read as walking at this size — but there is no way
    // to sit on anything with a straight leg: the thigh has to come forward
    // and the shin has to drop away from it, and those are two rotations.
    //
    // The split is placed and tapered so that with the knee at zero the two
    // halves occupy exactly the volume the single box did. That is the point:
    // the walk was tuned against that silhouette and this must not disturb it.
    const thighGeo = boxPart(0.11, THIGH_LEN, 0.124, 0.892);
    const shinGeo = boxPart(0.12, SHIN_LEN, 0.135, 0.919);
    // The boot narrows toward the ankle so the trouser covers its top rim.
    // Left wider, the rim reads as a pale collar of sky-lit sock, which at
    // walking distance is the only thing you notice about the feet.
    const bootGeo = boxPart(0.135, 0.115, 0.185, 0.76, 0.66);
    for (const [side, pivot] of [
      [-1, this.leftLeg],
      [1, this.rightLeg],
    ] as const) {
      const thigh = new Mesh(thighGeo, legMaterial());
      thigh.position.y = -THIGH_LEN;
      thigh.castShadow = true;
      pivot.add(thigh);

      const knee = new Group();
      knee.position.y = -THIGH_LEN;
      const shin = new Mesh(shinGeo, legMaterial());
      shin.position.y = -SHIN_LEN;
      shin.castShadow = true;
      const boot = new Mesh(bootGeo, solid(colors.boots, 0.3));
      boot.position.set(0, -0.26, -0.04);
      boot.castShadow = true;
      knee.add(shin, boot);
      pivot.add(knee);

      pivot.position.set(side * 0.082, HIP_Y, 0);
      this.boots.push(boot);
      this.knees.push(knee);
      this.hips.add(pivot);
    }

    // --- torso ---------------------------------------------------------
    // Tapered outward: narrow at the waist, broad at the shoulders. A box
    // of constant width reads as a crate no matter what is on top of it.
    const torsoMesh = new Mesh(
      boxPart(0.27, CHEST_TOP - HIP_Y, 0.185, 1.28, 1.08),
      solid(colors.tunic, 0.45),
    );
    torsoMesh.position.y = HIP_Y;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    const beltMesh = new Mesh(boxPart(0.285, 0.055, 0.2, 1), solid(colors.hatBand, 0.6));
    beltMesh.position.y = HIP_Y + 0.01;
    beltMesh.castShadow = false;
    this.torso.add(beltMesh);

    // The instrument's strap. It costs twelve triangles and it is the whole
    // explanation for why a lute is riding on the bard's back — without it
    // the instrument looks stuck on rather than carried. Leather, not the
    // belt's gold: in the belt colour it was a bright plank across the chest
    // and pulled more attention than the face.
    const strap = new Mesh(boxPart(0.042, 0.48, 0.028, 1), solid(colors.boots, 0.45));
    strap.position.set(-0.1, HIP_Y + 0.07, 0.094);
    strap.rotation.z = -0.42;
    strap.castShadow = false;
    this.torso.add(strap);

    // --- cloak ---------------------------------------------------------
    // Its own material with a real sway value, so the world's wind moves it.
    const cloakMaterial = this.track(
      createFoliageMaterial(globals, {
        color: colors.cloak,
        colorVariant: colors.cloakLining,
        grain: 0.45,
        grainScale: 1.2,
        rim: 0.34,
        rimPower: 1.9,
        sway: 0.12,
        swaySpeed: 1.35,
        swayAttribute: true,
        bandSoftness: 0.11,
        baseShade: 0.22,
        baseShadeHeight: 0.9,
        shadowDepth: 0.4,
      }),
    );
    this.cloak = new Mesh(cloakGeometry(), cloakMaterial);
    this.cloak.name = 'bard-cloak';
    // High enough that the collar tucks under the jaw. Two centimetres
    // lower and a strip of sky-lit shoulder shows between the hat brim and
    // the cloak, which from behind reads as a gap straight through the
    // character.
    this.cloak.position.y = SHOULDER_Y - 0.4;
    this.cloak.castShadow = true;
    this.torso.add(this.cloak);

    // --- arms ----------------------------------------------------------
    const armGeo = boxPart(0.085, 0.36, 0.095, 0.85);
    const handGeo = boxPart(0.095, 0.095, 0.1, 0.9);
    for (const [side, pivot] of [
      [-1, this.leftArm],
      [1, this.rightArm],
    ] as const) {
      const arm = new Mesh(armGeo, solid(colors.tunic, 0.45));
      arm.position.y = -0.36;
      arm.castShadow = true;
      const hand = new Mesh(handGeo, solid(colors.skin, 0.55));
      hand.position.y = -0.43;
      hand.castShadow = false;
      pivot.add(arm, hand);
      // Slightly narrower and set forward. The cloak's radius grows as it
      // falls, so an arm hanging at a fixed 0.18 started outside the cloth at
      // the shoulder and passed through it at the elbow, stitching a bright
      // sliver of sleeve down the cloak on both sides. Forward of the
      // shoulder line the arm hangs in the cloak's front opening instead.
      pivot.position.set(side * 0.172, SHOULDER_Y, 0.035);
      this.torso.add(pivot);
    }

    // --- head ----------------------------------------------------------
    const head = new Mesh(boxPart(0.25, HEAD_HEIGHT, 0.225, 0.94), underBrim(colors.skin, 0.55));
    head.position.y = HEAD_Y;
    head.castShadow = true;
    // A nose. Four hundred bytes of geometry that does more for the
    // three-quarter read than anything else on the figure, because it is
    // the only thing that tells you which way the head is facing once the
    // hat brim has put the face in shadow.
    const nose = new Mesh(boxPart(0.05, 0.055, 0.05, 0.7), underBrim(colors.skin, 0.6));
    nose.position.set(0, HEAD_Y + 0.11, 0.108);
    nose.castShadow = false;
    // Hair sits low at the back so it shows under the brim; without it the
    // gap between hat and collar reads as a bare tan column, which from
    // behind — the angle the walking camera holds — is most of what you see
    // of the head.
    const hair = new Mesh(boxPart(0.255, 0.115, 0.235, 1.02), underBrim(colors.hair, 0.4));
    hair.position.set(0, HEAD_Y + 0.145, -0.012);
    hair.castShadow = false;
    // The nape reaches down to the collar. It is the surface the player
    // actually looks at for most of the game — the back of a head under a
    // hat — so it gets the height to fill the gap and a rim term to give the
    // shape an edge in the shade.
    const nape = new Mesh(boxPart(0.235, 0.235, 0.078, 1.04, 1.1), underBrim(colors.hair, 0.6));
    nape.position.set(0, HEAD_Y - 0.03, -0.108);
    nape.castShadow = false;
    const hatMaterial = this.track(
      createPainterlyMaterial(globals, {
        color: colors.hat,
        colorVariant: 0xffe0c0,
        grain: 0.3,
        grainScale: 1.8,
        rim: 0.6,
        rimPower: 2.1,
        bandSoftness: 0.09,
        flatShading: true,
        // The brim carries a real sway weight, so it lifts on the same gusts
        // that move the grass. Small: a hat that flapped would pull the eye.
        swayAttribute: true,
        sway: 0.022,
        swaySpeed: 1.5,
        shadowDepth: 0.45,
      }),
    );
    const hat = new Mesh(hatGeometry(), hatMaterial);
    hat.position.y = HAT_Y;
    // Worn at an angle. Nothing about a bard should be square to the world.
    hat.rotation.z = 0.13;
    hat.rotation.x = -0.07;
    hat.castShadow = true;
    const band = new Mesh(hatBandGeometry(), solid(colors.hatBand, 0.5));
    band.position.copy(hat.position);
    band.rotation.copy(hat.rotation);
    band.castShadow = false;
    this.headPivot.add(head, nose, hair, nape, hat, band);
    this.torso.add(this.headPivot);

    // --- instrument ----------------------------------------------------
    this.torso.add(this.instrumentPivot);
    this.setInstrument(null);

    this.hips.add(this.torso);
    this.group.add(this.hips);
  }

  private track(material: ShaderMaterial): ShaderMaterial {
    this.materials.push(material);
    return material;
  }

  /** Swap the carried instrument. Colour and shape both change. */
  setInstrument(instrument: Instrument | null): void {
    if (this.instrumentMesh) {
      this.instrumentPivot.remove(this.instrumentMesh);
      this.instrumentMesh.geometry.dispose();
      // The outgoing material has to leave the tracking list as well as be
      // disposed. Left in, every instrument swap in a session accumulated a
      // compiled shader program that nothing would free until the bard did.
      const stale = this.instrumentMesh.material as ShaderMaterial;
      const at = this.materials.indexOf(stale);
      if (at >= 0) this.materials.splice(at, 1);
      stale.dispose();
      this.instrumentMesh = null;
    }
    const id = instrument?.id ?? 'lute';
    const material = this.track(
      createPainterlyMaterial(this.globals, {
        color: instrument?.color ?? 0xb5773f,
        colorVariant: instrument?.accent ?? 0xe8c98a,
        grain: 0.35,
        grainScale: 2.2,
        rim: 0.32,
        rimPower: 2.0,
        flatShading: true,
        swayAttribute: false,
        sway: 0,
      }),
    );
    const mesh = new Mesh(instrumentGeometry(id), material);
    // Named for the same reason every other prop in this project is: a
    // headless check has to be able to find one object in the scene graph
    // and ask what it looks like on screen. The occlusion measurement that
    // fixed the playing carry floods *this* mesh with a flat colour and
    // counts the pixels that survive the depth test, which is the only way
    // to tell "the instrument projects 150 px" from "you can see it".
    mesh.name = 'bard-instrument';
    mesh.castShadow = true;
    // The pivot handles carrying angle and slinging; the geometry is already
    // centred on its own middle, so the two can be animated independently
    // and a drum can replace a lute without the pose changing.
    this.instrumentPivot.add(mesh);
    this.instrumentMesh = mesh;
  }

  setPose(pose: BardPose, seconds = 0.45): void {
    if (pose === this.pose) return;
    this.previousPose = this.pose;
    this.pose = pose;
    this.poseBlend = 0;
    this.poseBlendRate = 1 / Math.max(0.001, seconds);
  }

  /**
   * Finish whatever pose transition is in flight, now.
   *
   * Nothing in the game calls this: a pose that cut would look like a
   * dropped frame. It exists for `RoadStage.pose`, the handle the postcard
   * tool drives, and it exists because **every campfire postcard this
   * project has ever shot caught this figure part-way out of a walk.**
   *
   * The arithmetic, because it is not obvious and it cost a wave. `App`
   * runs a fixed step with `MAX_CATCHUP_MS = 250`, so one *rendered* frame
   * advances the simulation by at most a quarter second no matter how long
   * the frame took. Under SwiftShader — no GPU, a few hundred thousand
   * triangles — a 1600x900 night frame takes the better part of a second,
   * measured here at about one frame per 600 ms. `setPhase` blends a pose
   * over 0.6 s, which is four sim steps, which is between two and four
   * whole seconds of wall clock; `postcard.mjs` waits 1800 ms. Measured
   * across that wait the blend read 0.417 on one run and 1.0 on the next.
   *
   * At 0.417 the figure is not a seated bard at all. It is 42 per cent of
   * one and 58 per cent of a walker: thighs at 42 per cent of their seated
   * angle so there is no horizontal in the silhouette, the cloak only
   * two-fifths gathered so the hem still swallows the lap, and — this is
   * the one the critics kept describing — the instrument 58 per cent
   * *slung across the back*, where its neck rises past the shoulder on a
   * strap. "A hunched red mass with the lute neck floating detached above
   * his left shoulder" is a literal description of a half-finished blend,
   * and no amount of moving the camera or re-solving the pose can fix a
   * frame that is not showing the pose.
   */
  settlePose(): void {
    this.poseBlend = 1;
  }

  private poseBlendRate = 1;

  /** Called when a note is played, so the strum can kick. */
  pluck(strength = 1): void {
    this.strum = Math.min(1.4, this.strum + strength);
  }

  setWarmth(warmth: number): void {
    this.warmth = Math.min(1, Math.max(0, warmth));
  }

  /**
   * Advance the animation.
   *
   * `distanceDelta` rather than a speed is passed in because the stride has
   * to be locked to *ground travelled*, not to time. Driving a walk cycle
   * from a clock is what produces feet that skate when the walk speed
   * changes — the single most noticeable animation bug there is.
   */
  update(dt: number, distanceDelta: number): void {
    this.elapsed += dt;
    this.poseBlend = Math.min(1, this.poseBlend + this.poseBlendRate * dt);
    this.strum = Math.max(0, this.strum - dt * 3.4);

    this.speed = dt > 0 ? distanceDelta / dt : 0;
    this.smoothedSpeed += (this.speed - this.smoothedSpeed) * Math.min(1, dt * 8);

    // One stride per 0.72 m. Tuned against the figure's leg length: too
    // long and it moonwalks, too short and it scurries.
    this.stride += distanceDelta * (Math.PI / 0.72);

    const walkAmount = this.blendWeight('walking') * Math.min(1, this.smoothedSpeed / 1.4);
    const playAmount = this.blendWeight('playing');
    const sitAmount = this.blendWeight('sitting');
    const idleAmount = Math.max(0, 1 - walkAmount - playAmount - sitAmount);

    const phase = this.stride;
    const breathe = Math.sin(this.elapsed * 1.5);

    // --- legs ----------------------------------------------------------
    const legSwing = 0.72 * walkAmount;
    const leftSwing = Math.sin(phase);
    const rightSwing = Math.sin(phase + Math.PI);
    this.leftLeg.rotation.x = leftSwing * legSwing + sitAmount * SIT_THIGH[0];
    this.rightLeg.rotation.x = rightSwing * legSwing + sitAmount * SIT_THIGH[1];
    // Knees apart, and not evenly. A seated figure with its knees together
    // is sitting for a photograph.
    this.leftLeg.rotation.z = sitAmount * -0.2;
    this.rightLeg.rotation.z = sitAmount * 0.16;
    // The knee cancels the pelvis and the thigh and then puts the shin where
    // it is wanted, which is nearly straight down with the foot drawn back
    // under the seat. Written this way round because the shin's angle is the
    // thing being composed; the joint angle is only how it is reached.
    for (let i = 0; i < this.knees.length; i++) {
      this.knees[i].rotation.x = sitAmount * (SIT_SHIN[i] - SIT_PELVIS - SIT_THIGH[i]);
    }
    // A knee-ish bend on the forward swing, faked by lifting the pivot.
    this.leftLeg.position.y = HIP_Y + Math.max(0, leftSwing) * 0.03 * walkAmount;
    this.rightLeg.position.y = HIP_Y + Math.max(0, rightSwing) * 0.03 * walkAmount;
    // The ankle keeps the boot flatter than the leg, and rolls the toe down
    // on the back half of the step. Rigid feet swinging with the shin is
    // the tell that gives away a jointless character faster than anything
    // else at the size this figure is actually seen. Seated, it does the
    // same job standing still: the sole comes back to level under a shin
    // that is leaning, so the boot sits flat on the ground instead of
    // resting on its heel.
    this.boots[0].rotation.x =
      -leftSwing * legSwing * 0.55 - Math.min(0, leftSwing) * 0.3 - sitAmount * SIT_SHIN[0];
    this.boots[1].rotation.x =
      -rightSwing * legSwing * 0.55 - Math.min(0, rightSwing) * 0.3 - sitAmount * SIT_SHIN[1];

    // --- body bob ------------------------------------------------------
    // Twice step frequency, and skewed: the rise is quicker than the fall.
    const bobPhase = phase * 2;
    const skewed = Math.sin(bobPhase) - 0.22 * Math.sin(bobPhase * 2);
    this.hips.position.y =
      skewed * 0.038 * walkAmount + breathe * 0.008 * idleAmount - sitAmount * SIT_HIP_DROP;
    // Weight shifts side to side, a quarter-phase behind the bob.
    this.hips.position.x = Math.sin(phase - Math.PI * 0.25) * 0.024 * walkAmount;
    this.hips.rotation.z = Math.sin(phase - Math.PI * 0.25) * 0.055 * walkAmount;
    this.hips.rotation.x = sitAmount * SIT_PELVIS;

    // --- torso ---------------------------------------------------------
    // Counter-rotates against the hips, and leans into the direction of
    // travel proportionally to speed.
    this.torso.rotation.y = Math.sin(phase) * 0.16 * walkAmount;
    // Seated, the lean has to pay back the pelvis first: the hips rocked
    // back by SIT_PELVIS and the torso rides on them, so the number here is
    // that debt plus the lean toward the fire that is actually wanted.
    this.torso.rotation.x =
      Math.min(0.1, this.smoothedSpeed * 0.05) * walkAmount +
      playAmount * 0.06 +
      sitAmount * (0.3 - SIT_PELVIS) +
      breathe * 0.01 * idleAmount;
    this.torso.rotation.z = Math.sin(phase - Math.PI * 0.25) * -0.035 * walkAmount;

    // --- cloak ---------------------------------------------------------
    // Trails behind while walking and lags the stride, on top of whatever
    // the wind is already doing to the hem in the shader. Rotating the
    // cloak rather than the torso is what keeps the trail from dragging the
    // shoulders and the head around with it.
    this.cloak.rotation.x =
      -0.11 * walkAmount - Math.sin(phase * 2 - 0.9) * 0.035 * walkAmount + sitAmount * 0.12;
    this.cloak.rotation.z = Math.sin(phase - 0.6) * 0.05 * walkAmount;
    // Gathered up when he sits.
    //
    // This is the single thing that decides whether the seated pose reads at
    // all. The cloak's hem falls to mid-thigh, which standing is exactly
    // right; seated, the hips drop under it and the hem lands level with the
    // seat — so from behind, which is where the resting camera is, a sitting
    // bard and a standing bard are the same cone.
    //
    // Sliding the whole mesh up was the obvious fix and it was the wrong one.
    // It moved the collar too, and the collar is already at the jaw: seventeen
    // centimetres higher it closed over the back of the head and took the
    // hair, the nape and the neck with it, which is where "a red cone with a
    // hat and no head" came from. The hem meanwhile only rose by the same
    // seventeen centimetres and still swallowed the lap.
    //
    // So the skirt is *shortened* instead, and the mesh slid down by exactly
    // what the shorter skirt raised its top by, which pins the collar where it
    // sits standing and lifts only the hem. A cloak gathered at the waist is
    // what happens to a cloak when its owner sits on it anyway.
    //
    // The radius comes in with it. Scaling only the height doubles the flare
    // per unit of drop, and a cone that keeps its full hem radius over half
    // its length is not a cloak, it is a lampshade — which is what the first
    // attempt at this looked like.
    const skirt = 1 - sitAmount * 0.52;
    const gather = 1 - sitAmount * 0.16;
    this.cloak.scale.set(gather, skirt, gather);
    this.cloak.position.y = SHOULDER_Y - 0.4 + CLOAK_TOP * (1 - skirt);

    // --- head ----------------------------------------------------------
    // Counter-rotation is deliberately *not* complete: a head that cancels
    // the shoulders exactly looks gyroscopic. Two-thirds reads as human.
    // Seated, the head also turns. Every camera in the game sits behind the
    // bard and off to his right — walking, busking and resting all do, see
    // `CameraRig`'s `side` — so a head left pointing straight down the
    // heading presents the top of a hat brim and nothing else, and a hat brim
    // seen from above is a disc. Turning it a quarter round toward that
    // camera brings the nose, the jaw and the lit side of the face into the
    // frame while he is still, by any reasonable reading, looking at his own
    // hands and the fire beyond them.
    this.headPivot.rotation.y = -this.torso.rotation.y * 0.66 + sitAmount * 0.7;
    this.headPivot.rotation.x =
      -this.torso.rotation.x * 0.5 +
      Math.sin(bobPhase + 0.6) * 0.02 * walkAmount +
      // Looking down at the hands while playing, less so as the crowd warms
      // and the bard starts performing to them instead of to the strings.
      playAmount * (0.2 - this.warmth * 0.22) +
      // Seated, the counter-rotation above would tip the face at the sky.
      // This puts it back level and a little down, which is where a person
      // sitting at a fire looks: at the fire.
      sitAmount * 0.17;
    // The head tips very slightly against the hips' weight shift, a beat
    // behind it. Small enough to be invisible frame by frame; what it does is
    // stop the hat — the biggest, most readable shape on the figure — from
    // travelling as if it were bolted to a rail.
    this.headPivot.rotation.z =
      Math.sin(this.elapsed * 0.7) * 0.02 * idleAmount -
      Math.sin(phase - Math.PI * 0.6) * 0.035 * walkAmount;

    // --- arms ----------------------------------------------------------
    const armSwing = 0.52 * walkAmount;
    // Arms lag the legs slightly. The lag is small but it is the difference
    // between a walk and a wind-up toy.
    const armPhase = phase - 0.22;
    const carryPose = 0.35 + playAmount * 0.25;

    // The left hand stays on the instrument's neck at all times; it only
    // swings when the instrument is slung and the bard is walking.
    //
    // Three carries, not two: across the back on the road, round to the
    // chest to play, and down across the lap at the fire. They are weights
    // rather than a switch, so a bard who sits down mid-song moves the
    // instrument there instead of teleporting it.
    const lap = sitAmount;
    const slung = Math.max(0, 1 - playAmount - lap);
    // Arms swing slightly *across* the body as well as along it, in time with
    // the shoulder rotation. A pendulum in one plane is the other half of the
    // wind-up-toy read that the phase lag above fixes half of; a real arm on
    // a swinging shoulder traces a shallow arc inward at the front of the
    // step and outward at the back.
    const armCross = Math.sin(armPhase) * 0.09 * walkAmount;
    // Seated, the arms go *back*, not forward, and out rather than in.
    //
    // Forward was the obvious reading of "hands in the lap" and it was wrong
    // twice over. There are no elbows on this figure, so an arm is a rigid
    // forty-three centimetres; the seated torso already leans its shoulders
    // out over the knees, so an arm swung forward from there does not reach
    // the lap, it dangles past the shins. And the resting camera looks in from
    // the bard's right, so those two dangling arms hung directly across the
    // instrument — the lute was posed correctly, projected a hundred and fifty
    // pixels wide, and was invisible anyway because an arm was drawn over the
    // middle of it. Swung back and spread, the hands land beside the hips on
    // the log, which is both where a sitting person puts them and clear of
    // everything in the lap.
    this.leftArm.rotation.x =
      Math.sin(armPhase + Math.PI) * armSwing * slung - carryPose * playAmount - 0.1 + lap * 0.45;
    this.leftArm.rotation.z = 0.11 + playAmount * 0.32 - armCross - lap * 0.15;

    const strumMotion = Math.sin(this.elapsed * 7.5) * 0.1 * playAmount * (0.4 + this.warmth * 0.6);
    this.rightArm.rotation.x = Math.sin(armPhase) * armSwing * slung - carryPose * playAmount + lap * 0.45;
    this.rightArm.rotation.z = -0.11 - playAmount * 0.28 - armCross + lap * 0.15;

    // --- instrument ----------------------------------------------------
    // Two poses, blended rather than switched. Slung it rides across the
    // *back*, outside the cloak, where it is the one thing that identifies
    // the character from the angle the walking camera actually holds.
    // Brought round to the chest to play.
    //
    // The slung tilt is negative so the body hangs on the bard's left and
    // the neck rises past his right shoulder — the way the strap across his
    // chest runs. Hanging it the other way was the first version and looked
    // like the strap belonged to something else.
    //
    // Slung, the depth is bounded on both sides and the window is narrow.
    // The cloak flares as it falls — its back surface is about 0.29 m off
    // the spine where the bowl sits and 0.33 m at the hem — so any nearer
    // and the bowl is *inside* the cloth, showing through it as a ghost
    // because the cloak is double-sided; any further and it stands off the
    // back like a knapsack. An earlier pass hung it 0.30 m out at a
    // 41-degree tilt, which swung the bowl clear of the figure's outline
    // altogether: from the side it read as a bag being carried rather than
    // an instrument being worn.
    //
    // Played, it comes round to the bard's own right rather than round to the
    // front of his chest — see `PLAY_CARRY_POS`, which carries the measurement
    // and the arithmetic. The short version: the busking camera stands behind
    // him, so "clear in front" is the far side of the figure, and the version
    // that put it there had four fifths of the instrument behind his own back.
    //
    // In the lap it comes down to just above the thighs and forward of them,
    // which in this frame is the hip line and a hand's width out. It is not
    // level: an instrument resting across someone's legs leans its face up
    // toward them, and that lean is most of what says "resting" rather than
    // "balanced there".
    this.instrumentPivot.position.set(
      playAmount * PLAY_CARRY_POS[0] - slung * 0.03 + lap * 0.045,
      SHOULDER_Y + playAmount * PLAY_CARRY_POS[1] - slung * 0.12 - lap * 0.219,
      playAmount * PLAY_CARRY_POS[2] - slung * 0.285 + lap * 0.187,
    );
    // Thirty degrees across the back, not forty. The steeper tilt threw the
    // bowl clear of the cloak's outline with daylight showing between the
    // two, and a shape that hangs outside a character's silhouette reads as
    // luggage; this angle keeps the bowl against the small of the back and
    // lets only the neck and pegbox break the outline, which is the part
    // worth seeing. The x tilt leans the foot further off the back than the
    // neck, so the bowl stands proud of the flaring cloak while the pegbox
    // stays in near the shoulder.
    // In the lap the three angles are solved rather than dialled, because the
    // thing that decides whether a lute reads as a lute is the length of its
    // neck on screen, and that is a question about the camera. The resting
    // camera stands behind the bard and off to his right, looking back along
    // roughly a hundred and twenty degrees from his heading. A neck laid
    // straight out to the right — which is what a quarter turn of roll alone
    // gives, and what this used to do — points within thirty degrees of that
    // view axis and collapses to a brown blob the size of a fist. So the neck
    // is aimed forward and right instead, twenty-two degrees off his heading
    // and rising twelve, which is square to the camera and lays the whole
    // length of the instrument across the frame.
    //
    // The shallow rise is the part that took finding. Steeper, and the neck
    // goes up behind the near edge of the cloak — this camera is on that side,
    // and flooding the instrument with a flat colour to find out where it had
    // gone showed the whole neck swallowed. Flat, and it runs behind the near
    // knee instead. Twelve degrees threads between the two: it starts on the
    // far thigh, passes over the near one, and ends beyond both of them out in
    // the pool of firelight on the ground, which is the one place on this side
    // of the frame where the shape has something to be seen against. These
    // three numbers are the Euler angles that put it there once the seated
    // torso's own forward lean is paid back.
    this.instrumentPivot.rotation.set(
      this.strum * 0.07 + slung * 0.15 + playAmount * PLAY_CARRY_ROT[0] + lap * 0.54,
      playAmount * PLAY_CARRY_ROT[1] + slung * 0.08 - lap * 0.889,
      -slung * 0.52 + playAmount * PLAY_CARRY_ROT[2] - lap * 0.62,
    );

    // Both hands go on the instrument, and both are solved rather than
    // dialled — see `gripLine`. The fretting hand takes the neck in the lap
    // pose *and* the playing pose; the strumming hand takes the belly, and
    // only while playing, because the seated bard's right hand belongs on the
    // log beside him and not on the strings.
    const fret = Math.min(1, lap + playAmount);
    if (fret > 0) this.gripLine(this.leftArm, NECK_GRIP_MIN, NECK_GRIP_MAX, fret, true);
    if (playAmount > 0) {
      this.gripLine(this.rightArm, STRUM_GRIP_MIN, STRUM_GRIP_MAX, playAmount, false);
    }
    // The strum kick rides on top of whatever the solve produced, rather than
    // inside it. Folded into the base angles it would be diluted by the
    // solve's own lerp exactly when the bard is playing, which is the one
    // time it exists for: `pluck` is what makes a note land visually at the
    // same instant it lands audibly.
    this.rightArm.rotation.x += strumMotion - this.strum * 0.5;
    this.rightArm.rotation.z -= this.strum * 0.16;
  }

  /**
   * Put a hand *on the instrument the bard is holding*, by solving for it
   * rather than by dialling an angle.
   *
   * The problem this fixes, measured: seated, the left hand sat 0.61 m from
   * the middle of the neck — 132 px apart in a 1600 px frame, on an
   * instrument whose whole neck projects 96 px. The hand was further from
   * the neck than the neck is long, and it was down beside the *body* of the
   * lute, which is the wrong end for a left hand anyway. Four critiques in a
   * row said the instrument looked detached, and it was.
   *
   * Why a solve and not a number. The lap pose's three Euler angles are
   * solved against the resting camera (see the long note above) and they are
   * allowed to keep moving; an arm angle tuned by eye against today's
   * instrument angles separates again the moment either changes, which is
   * how this drifted apart in the first place. Here the arm is aimed at the
   * neck every frame, so the two cannot come apart by construction.
   *
   * How. Both the arm pivot and the instrument pivot are children of the
   * torso, so the whole thing is solvable in torso space with no world
   * matrices. The stretch of instrument being held is the segment `A + t·B`
   * for `t` in `[tMin, tMax]`, `A` being the instrument pivot's origin and
   * `B` its local +Y in torso space. The arm is a rigid rod of `ARM_REACH`
   * from a fixed shoulder `S`, so the hand can only ever land on a sphere of
   * that radius: intersect the sphere with the line, which is a quadratic in
   * `t`, and take the root inside the allowed stretch. If the line misses the
   * sphere entirely — it does not today, but the pose is allowed to move —
   * fall back to the point nearest the shoulder, so the hand still points at
   * the instrument instead of snapping somewhere absurd.
   *
   * `preferFar` breaks the tie when both roots are legal. The fretting hand
   * takes the one further *up* the neck, which is where a fretting hand goes;
   * the strumming hand takes the one further down, which is the near edge of
   * the belly rather than the far one, and keeps the forearm off the
   * soundboard.
   *
   * Then the two Euler angles. With the arm's default hanging direction
   * `(0,-1,0)` and Euler order XYZ with no yaw, the hand direction is
   * `(sin z, -cos x·cos z, -sin x·cos z)`, which inverts in closed form:
   * `z = asin(dx)` and `x = atan2(-dz, -dy)`.
   *
   * Weighted, so a pose that does not hold the instrument does not get its
   * arms moved. The walking arms are still bit-for-bit what they were — the
   * weights are the sitting and playing blends, and both are zero on the
   * road. `bard.test.ts` pins that.
   */
  private gripLine(
    arm: Group,
    tMin: number,
    tMax: number,
    weight: number,
    preferFar: boolean,
  ): void {
    this.instrumentPivot.updateMatrix();
    const m = this.instrumentPivot.matrix.elements;
    // Origin and local +Y of the instrument, in torso space.
    const ax = m[12];
    const ay = m[13];
    const az = m[14];
    const bx = m[4];
    const by = m[5];
    const bz = m[6];
    const sx = arm.position.x;
    const sy = arm.position.y;
    const sz = arm.position.z;
    const ux = ax - sx;
    const uy = ay - sy;
    const uz = az - sz;
    const ub = ux * bx + uy * by + uz * bz;
    const uu = ux * ux + uy * uy + uz * uz;
    const disc = ub * ub - uu + ARM_REACH * ARM_REACH;
    let t: number;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const first = preferFar ? -ub + root : -ub - root;
      const second = preferFar ? -ub - root : -ub + root;
      const inRange = (v: number) => v >= tMin && v <= tMax;
      t = inRange(first) ? first : inRange(second) ? second : Math.min(tMax, Math.max(tMin, first));
    } else {
      t = Math.min(tMax, Math.max(tMin, -ub));
    }
    this.grip.set(ax + bx * t - sx, ay + by * t - sy, az + bz * t - sz);
    const d = this.grip.length();
    if (d < 1e-5) return;
    this.grip.multiplyScalar(1 / d);
    const rz = Math.asin(Math.min(1, Math.max(-1, this.grip.x)));
    const rx = Math.atan2(-this.grip.z, -this.grip.y);
    arm.rotation.x += (rx - arm.rotation.x) * weight;
    arm.rotation.z += (rz - arm.rotation.z) * weight;
  }

  /** How much a pose contributes right now, accounting for the blend. */
  private blendWeight(pose: BardPose): number {
    if (this.pose === pose) return this.poseBlend >= 1 ? 1 : this.poseBlend;
    if (this.previousPose === pose && this.poseBlend < 1) return 1 - this.poseBlend;
    return 0;
  }

  /** Face a heading, in the same convention the road uses. */
  setHeading(heading: number): void {
    this.group.rotation.y = heading;
  }

  get object(): Object3D {
    return this.group;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
  }
}
