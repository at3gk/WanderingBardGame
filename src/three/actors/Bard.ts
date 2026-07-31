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
  /**
   * The sleeves, and they are a separate colour from the tunic on purpose.
   *
   * An arm is only ever seen against the cloak — it hangs off the shoulder
   * with the cloth immediately behind it at every camera this game holds —
   * so the one measurement that decides whether it reads is the sleeve's
   * value against `cloak`. In the tunic's own 0xc4694a that gap is 0.46 of
   * a stop, and at the twenty to forty pixels of figure height the walking
   * and busking frames give it, 0.46 of a stop between two warm reds is
   * nothing: three rounds of critique in a row have reported this figure as
   * having no arms at all. Lifted here to 0.63 of a stop, and the cuff and
   * the hand carry the rest — sleeve, dark cuff, light skin is three values
   * inside fifteen centimetres, which survives being small.
   */
  sleeve: number;
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
  sleeve: 0xd2794e,
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
/**
 * Two and a half centimetres higher than it sat, and the reason is the face.
 *
 * The brim is what shades the face, and once its dip was turned the right way
 * round (see `hatGeometry`) the front edge came down across the eye line.
 * Riding the whole hat up until the brim clears the eyes by about a
 * centimetre and a half keeps the shade — a brim that overhangs the eyes is
 * the whole idea — without cutting the one band of the head that has anything
 * in it.
 */
const HAT_Y = HEAD_Y + HEAD_HEIGHT - 0.035;

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
 * The shoulder joint, off the spine and forward of it.
 *
 * Named because three separate places have to agree on it — the constructor
 * that builds the pivot, the strum in `update` which rewrites the right
 * shoulder's position every frame, and the test that checks the arm clears
 * the cloak. They disagreed once already: a previous wave moved the pivot in
 * the constructor and the strum quietly put it back.
 */
const ARM_ROOT_X = 0.178;
const ARM_ROOT_Z = 0.085;
/**
 * How far the hanging arms splay off vertical, in radians.
 *
 * Fifteen degrees, and it is a clearance before it is a pose. The cloak's
 * hem stands 0.285 m off the spine; an arm dropped straight down from a
 * shoulder 0.178 m out ends *inside* that, so the hand has to travel
 * outward as it falls or it is behind cloth by the time it is a hand. At
 * 0.26 rad the wrist sits about 0.30 m out — three centimetres proud of the
 * hem, which holds through the walk's fore-and-aft swing as well, since
 * that swing moves the hand in depth and leaves this offset alone.
 *
 * It also happens to be what a relaxed arm does over a bulky cloak, which
 * is the only reason a number chosen for clearance is allowed to stay.
 */
const ARM_SPLAY = 0.26;
/**
 * The stretch of the instrument's own +Y axis a hand is allowed to hold.
 *
 * `instrumentGeometry` builds the neck from y 0.245 to 0.555 and then slides
 * the whole instrument down by half its 0.62 length, so the neck ends up
 * spanning -0.065 to 0.245 about the pivot. These are that span pulled in at
 * both ends: off the shoulder joint at the bottom, short of the pegbox at
 * the top, which is where a hand actually goes on a lute.
 */
/**
 * Three centimetres lower than it was, and the reason is that the shoulder
 * moved.
 *
 * Bringing the shoulder joints forward off the spine (see `ARM_ROOT_Z`)
 * shortened the run from the left shoulder to the instrument's neck: its
 * closest approach is now 0.317 m against an arm of 0.43, so the two points
 * where a rigid arm can actually touch that line spread apart to t 0.553 and
 * t -0.028 — one past the pegbox, the other eight millimetres below the old
 * floor. With neither legal the solve clamped, and a clamped grip is a hand
 * *pointing at* the instrument rather than on it: measured, eleven
 * centimetres off, which is the "detached instrument" fault this whole solve
 * exists to prevent. Lowering the floor to the neck's own base gives the
 * solve back a legal root, and the hand lands at the foot of the
 * fingerboard, which is where a lute is fretted when it is held high.
 */
const NECK_GRIP_MIN = -0.05;
const NECK_GRIP_MAX = 0.23;
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
const STRUM_GRIP_MAX = -0.1;

/**
 * The playing carry: where the instrument sits, in torso space, while it is
 * being played, and the Euler angles that put it there.
 *
 * **This is the frame the whole game is about, and it has now been solved
 * twice against two different faults.**
 *
 * The first was occlusion by the *bard*. The busking postcards showed a red
 * cone with a hat and a brown stick emerging from behind its left edge,
 * because the carry brought the instrument round to the front of his chest
 * while `FRAMINGS.busking` stands 3.9 m behind him against 2.7 m of side —
 * a rear three-quarter. Measured by flooding the mesh and differencing the
 * frame against one with it hidden: 19.4 per cent of the instrument's own
 * footprint changed a single pixel. Swinging the body out to his right hip
 * with the neck rising across him fixed that and is still the arrangement
 * here — it is also how a right-handed player holds a lute.
 *
 * The second only appeared once this wave gave the bard visible arms, and it
 * is the same class of fault one layer in: **the arm was standing on the
 * instrument.** Flooded the same way, the strumming arm lay along the whole
 * length of the lute — neck, soundhole and bridge — leaving a rim of bowl
 * showing round a plank. It is a screen-space coincidence, not a modelling
 * error: the shoulder sits 13 cm above the instrument's own pivot, so the
 * two shapes start from nearly the same point on screen, and the old carry
 * hung the body down at 31 degrees off vertical while the arm hangs at 24.
 * Two lines from one origin, seven degrees apart, are one line.
 *
 * So these six numbers were swept — 5,400 combinations of position and
 * Euler, each one built, posed and measured — against four things at once,
 * all of them properties of the *busk camera's* view rather than of the
 * model:
 *
 * - both grip solves still land (fretting hand within 5 cm of the neck, the
 *   strumming hand within 5 cm of the belly);
 * - the instrument's projected length stays near its true 0.62 m, so the
 *   neck lies across the frame instead of pointing at the lens — the failure
 *   the lap carry's note records, and the one that turns a lute into a blob;
 * - the pegbox stays below the hat brim and above the chest;
 * - and the arm's drawn line passes as far as possible from the soundhole.
 *
 * The winner clears the soundhole by 5.6 cm — about fifteen pixels at this
 * framing — with the full length of the instrument projected and the pegbox
 * at 0.96 m. In the shot that means the bowl, the rose and all three courses
 * are in the open with the forearm crossing them, which is the picture the
 * game has been trying to take for five rounds.
 *
 * The `y` here is an offset from `SHOULDER_Y`, matching the slung and lap
 * terms it is summed against. The half-turn that faces the soundboard at the
 * camera is applied in `update` and is still exact: adding pi to the Y term
 * while negating Z leaves the neck axis these numbers were solved for
 * bit-for-bit alone.
 */
const PLAY_CARRY_ROT: readonly [number, number, number] = [0.25, -0.6, 0.566];
const PLAY_CARRY_POS: readonly [number, number, number] = [0.28, 0.70 - SHOULDER_Y, 0.25];

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
/**
 * Where the instrument rests when he is sitting, as an offset from the
 * shoulder — and these three are a *measured clearance*, not a look.
 *
 * The report was that the lute sinks into his knee, and it was true: with the
 * seated pose settled, the instrument's own vertices were tested against each
 * leg's box and sixteen of the 396 lay inside the far thigh, up to a
 * centimetre deep, so the thigh cut a notch out of the bowl in the one frame
 * where the instrument is the subject. The three numbers were swept against
 * that count. Out to 0.08 and up to 0.19 takes it to zero from every
 * direction at once; further out (0.115) is much worse, because the lute
 * swings its bowl back into the *near* thigh instead. The forward term is
 * unchanged in spirit — an instrument across someone's legs sits in front of
 * the knees — and the pegbox still lands well below the hat brim, which
 * `bard.test.ts` keeps checking.
 */
const LAP_X = 0.18;
const LAP_Y = 0.16;
const LAP_Z = 0.17;
const LAP_ROT: readonly [number, number, number] = [0.78, Math.PI - 0.889, 0.2];
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
    // **Wound outward. It was wound inward, and it had been since the file
    // was written.**
    //
    // Measured rather than argued: build any `boxPart` and compare each
    // triangle's normal against the vector from the shape's centroid to its
    // own centre, and *zero per cent* of them agreed. Every box on this
    // figure and on every traveller had its normals pointing into itself.
    //
    // The materials here are `FrontSide`, so what that meant is not a
    // subtle shading error — it is that the renderer culled the near wall
    // of every limb and drew the far one. The player has been looking at
    // the *inside* of the bard. The silhouette is identical, which is why
    // it survived so long; everything else about it is wrong. Interior
    // faces show through outer ones, because there is no outer one to win
    // the depth test. Caps that ought to be hidden inside a joint are drawn
    // over the limb that contains them — the flat plate across each knee in
    // every walking frame is the thigh's own bottom cap, seen from above
    // through a thigh that is not being drawn. And the lighting is
    // inverted, since the surface you see is lit by a normal aimed at the
    // camera rather than by its own.
    //
    // "Geometry decomposes at inspection distance", "overlapping boot boxes
    // with stray wedge fragments", "reads as z-fighting debris" — three
    // separate critiques, one cause, and it is this line. The winding is
    // now such that a box seen from outside shows its outside.
    verts.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A boot, as rings about the **ankle**: height, half-width, and how far the
 * sole runs behind and in front of the leg.
 *
 * **This replaced a single tapered box and the box was on backwards.** It was
 * `boxPart(0.135, 0.115, 0.185, 0.76, 0.66)` set at z -0.04, which centres a
 * 0.185 m foot four centimetres *behind* the ankle: thirteen centimetres of
 * sole trailing back and five in front, a heel where the toe should be. Every
 * camera in this game stands behind the bard, so what those frames showed was
 * the sky-lit top of that trailing sole sticking out from under each leg —
 * two pale wedges where the feet ought to be, plus the pale bottom cap of the
 * trouser bursting out of the boot's narrow rim in front. Three fragments per
 * foot, six in the frame, moving independently as the ankles rolled. The
 * critique called it z-fighting debris twice; it was neither z-fighting nor
 * debris, it was a foot built pointing the wrong way.
 *
 * So: one closed hull per foot, and the length of the foot in *front* of the
 * leg where a toe goes. The rings run bottom-up so the winding matches
 * `boxPart`'s, which is the one convention every other part of this figure
 * is built to.
 *
 * **The top ring sits exactly on the ankle joint, and it is small enough to
 * live inside the trouser.** Both halves of that matter and the second one is
 * the rule this figure did not have:
 *
 * > *Every upward-facing cap has to be buried inside the part above it.*
 *
 * The materials are single-sided and every camera in this game looks down at
 * the bard, so a downward cap is culled and costs nothing while an upward cap
 * is a flat plate pointed straight at the sky — the brightest surface this
 * lighting model can produce. An exposed one does not read as a mistake in
 * the geometry; it reads as a loose bright shape sitting on the character,
 * which is precisely the report this task was written from. The boot's rim is
 * therefore 0.076 by 0.088 against a trouser cuff of 0.090 by 0.102 that runs
 * three and a half centimetres past it, so the rim is never seen. Putting the
 * ring *on* the joint rather than above it is what keeps that true while the
 * ankle rolls: a ring at the pivot rotates in place, so it cannot swing out
 * of the leg however hard the roll goes.
 */
const BOOT_RINGS: readonly (readonly [number, number, number, number])[] = [
  // y, half-width, sole back, sole front.
  [-0.080, 0.062, -0.064, 0.104],
  [-0.050, 0.069, -0.072, 0.098],
  [-0.010, 0.068, -0.072, 0.066],
  // The cuff flares out through the trouser here, which is where the boot's
  // outline starts — about ten centimetres of visible boot on a forty
  // centimetre leg, against the seven the old box managed.
  [0.022, 0.052, -0.058, 0.056],
  [0.038, 0.028, -0.034, 0.034],
];

function bootGeometry(): BufferGeometry {
  const ring = (index: number): number[][] => {
    const [y, hw, back, front] = BOOT_RINGS[index];
    return [
      [-hw, y, back],
      [hw, y, back],
      [hw, y, front],
      [-hw, y, front],
    ];
  };
  const verts: number[] = [];
  // Outward, matching the corrected `boxPart`. See the note there.
  const quad = (p0: number[], p1: number[], p2: number[], p3: number[]) =>
    verts.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
  for (let i = 0; i < BOOT_RINGS.length - 1; i++) {
    const b = ring(i);
    const t = ring(i + 1);
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      quad(b[k], b[k1], t[k1], t[k]);
    }
  }
  const sole = ring(0);
  const cuff = ring(BOOT_RINGS.length - 1);
  quad(cuff[0], cuff[1], cuff[2], cuff[3]);
  quad(sole[3], sole[2], sole[1], sole[0]);
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
  /**
   * Four and a half centimetres in from where it hung, and the number is a
   * clearance rather than a taste.
   *
   * The arms hang from shoulders 0.178 m off the spine and splay fifteen
   * degrees as they fall, so the hand ends about 0.30 m out. At 0.33 the
   * hem stood *further* from the spine than the hand did, which put the
   * whole arm — sleeve, cuff and hand — inside a solid cone of cloth from
   * every bearing the cloak covers. Every game camera stands in that arc
   * (see `CameraRig`: walking, busking and resting are all behind him and
   * off to his right), so "inside the cone" meant invisible in every frame
   * the player ever sees, which is exactly what three rounds of critique
   * reported. `bard.test.ts` now pins the hand outside this radius in all
   * three poses so it cannot silently close again.
   */
  const bottomRadius = 0.285;
  const top = CLOAK_TOP;
  // Six centimetres shorter than it was. The legs are the only part of the
  // figure that says "walking" at a glance and the old hem left them two
  // boot-stumps poking out from under a bell.
  const bottom = -0.1;
  const verts: number[] = [];
  // Wide enough to read as a cloak from behind — which is the angle the
  // walking camera holds — and open enough at the front that the hands and
  // the instrument are never buried.
  //
  // 1.04 turns rather than 1.22. At 1.22 the cloth wrapped 20 degrees past
  // each side of him and closed over the front of both shoulders; the
  // cameras stand about 17 degrees off his spine, so the near edge of that
  // wrap sat between the lens and his whole near arm. This stops the cloth
  // just short of his sides, which from those cameras reads as a cloak
  // falling open on the near side with an arm in the gap — and from
  // directly behind, which is the only place the difference could show as a
  // loss, still covers past both silhouette edges.
  const arc = Math.PI * 1.04;
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
    //
    // **The sign was wrong for the whole life of this file, and it is the
    // reason the head disappeared.** Local +Z is forward, so `sin(a)` is the
    // *front* of the brim: `sin(a) * 0.06 - 0.045` lifted the front by 1.5 cm
    // and hung the back down by 10.5 cm — the exact opposite of the sentence
    // above it. From the three-quarter rear the walking and busking cameras
    // hold, that back edge came down over the hair, the nape and the collar,
    // and the figure read as a hat on a cloak with no head between them. It
    // was diagnosed twice as a hair-value problem and painted lighter twice.
    // It was never an albedo problem; the head was behind a plank.
    const dip = (a: number) => -Math.sin(a) * 0.038 - 0.022;
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
 * The plane the soundboard lies in, in the instrument's own build space.
 *
 * A real lute has a flat top and a round back, and building it that way round
 * matters here for a reason beyond accuracy: the strings, the bridge and the
 * soundhole all have to sit on one plane a few millimetres proud of the
 * timber, and the neck's own front face has to be level with it or the
 * strings visibly float off the fingerboard at the nut.
 */
const SOUNDBOARD_Z = 0.023;

/**
 * The body of the lute, as rings up its length: height, half-width, and how
 * far the bowl bulges behind the soundboard.
 *
 * **This replaced four stacked tapered boxes, and the reason is the frame.**
 * Slung on the bard's back the camera looks straight at the *back* of the
 * instrument, and a stack of boxes seen from behind presents the top face of
 * every box in the stack as a separate bright rung. Shot and measured, the
 * walking postcard's instrument read as a golden rake: four flat tines and a
 * handle. No amount of recolouring fixes that, because the rungs are the
 * geometry.
 *
 * So the body is one hull. The widest ring still sits low — a third of the
 * way up, which is what makes a teardrop rather than a mallet — and the taper
 * into the neck still takes three rings rather than one step. What is new is
 * that there are no horizontal faces anywhere on it.
 */
const BODY_RINGS: readonly (readonly [number, number, number])[] = [
  [0.0, 0.062, 0.046],
  [0.03, 0.098, 0.068],
  [0.072, 0.122, 0.083],
  [0.118, 0.128, 0.086],
  [0.17, 0.11, 0.076],
  [0.222, 0.076, 0.054],
  [0.276, 0.032, 0.032],
];

/**
 * The body's cross-section, as fractions of a ring's half-width and of its
 * bowl depth. The first two entries are the flat soundboard; the other five
 * are the staves of the bowl behind it.
 *
 * Five staves rather than a smooth curve on purpose. Flat-shaded, each stave
 * takes its own value, so the back of the instrument — the side the walking
 * camera actually sees — reads as the ribbed bowl of a lute instead of as a
 * plain lozenge. It is the cheapest identifying mark the shape has from that
 * angle and it costs nothing but winding.
 */
const BODY_SECTION: readonly (readonly [number, number])[] = [
  [0.7, 1],
  [-0.7, 1],
  [-1, -0.22],
  [-0.72, -0.75],
  [-0.3, -1.1],
  [0.3, -1.1],
  [0.72, -0.75],
  [1, -0.22],
];

/** A hull through `BODY_RINGS`, wound so its faces point outward. */
function luteBodyGeometry(): BufferGeometry {
  const verts: number[] = [];
  const n = BODY_SECTION.length;
  const point = (ring: readonly [number, number, number], k: number): number[] => {
    const [y, w, d] = ring;
    const [sx, sz] = BODY_SECTION[k];
    // A positive depth marks the soundboard, which is a plane and not a
    // profile — the whole point of it is that the strings, the bridge and the
    // soundhole all lie on one flat surface.
    return [sx * w, y, sz > 0 ? SOUNDBOARD_Z : SOUNDBOARD_Z + sz * d];
  };
  for (let i = 0; i < BODY_RINGS.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const p = point(BODY_RINGS[i], k);
      const q = point(BODY_RINGS[i], k1);
      const pUp = point(BODY_RINGS[i + 1], k);
      const qUp = point(BODY_RINGS[i + 1], k1);
      verts.push(...p, ...pUp, ...qUp, ...p, ...qUp, ...q);
    }
  }
  // The two ends. The bottom is seen — it is the lowest point of the whole
  // instrument in every carry — and an open hull there would show the inside
  // of the bowl, which under a front-face-only material is a hole.
  const low = BODY_RINGS[0];
  const high = BODY_RINGS[BODY_RINGS.length - 1];
  for (let k = 1; k < n - 1; k++) {
    verts.push(...point(low, 0), ...point(low, k), ...point(low, k + 1));
    verts.push(...point(high, 0), ...point(high, k + 1), ...point(high, k));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

/** A flat disc facing +Z. The soundhole, and nothing else needs one. */
function discGeometry(radius: number, sides: number): BufferGeometry {
  const verts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    verts.push(
      0, 0, 0,
      Math.cos(a0) * radius, Math.sin(a0) * radius, 0,
      Math.cos(a1) * radius, Math.sin(a1) * radius, 0,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

/**
 * The instrument, in three value tiers rather than one.
 *
 * One shape, recoloured and reproportioned per instrument, because six
 * modelled instruments is six times the geometry for something carried on the
 * bard's back and seen mostly in silhouette. What is *not* shared is the
 * value: a lute the player cannot identify is the standing complaint about
 * this game's own subject, and a single flat timber colour is most of why.
 * The timber carries the shape, a dark tier carries the soundhole and the
 * bridge — the two marks that say the thing is hollow — and a bright tier
 * carries the strings and the nut.
 *
 * That split is also the figure-to-ground lever. At the hour the busk frames
 * are shot the sun is behind the bard, so the instrument is on the shade side
 * and renders within a couple of levels of the ground behind it; three thin
 * bright edges running the length of the neck put a hard value break inside
 * the silhouette that survives being twenty pixels tall, which no amount of
 * albedo on one flat material can.
 *
 * Built with its base at local zero and translated so the finished shape is
 * centred on its own middle; the carrying pivot then only has to rotate it,
 * and a drum and a lute of different lengths hang from the same pivot
 * without each needing its own offset.
 */
interface InstrumentParts {
  /** The timber. Carries the name every headless check looks the shape up by. */
  body: BufferGeometry;
  /** Soundhole and bridge. */
  dark: BufferGeometry | null;
  /** Strings and nut. */
  bright: BufferGeometry | null;
}

function instrumentGeometry(kind: string): InstrumentParts {
  const parts: BufferGeometry[] = [];
  const dark: BufferGeometry[] = [];
  const bright: BufferGeometry[] = [];
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
    // Finger holes, in the one tier that reads at distance. A pipe with no
    // holes is a stick, which is the same complaint the lute had.
    for (let i = 0; i < 4; i++) {
      const hole = discGeometry(0.011, 6);
      translate(hole, 0, 0.2 + i * 0.075, 0.024);
      dark.push(hole);
    }
  } else if (isDrum) {
    length = 0.34;
    parts.push(boxPart(0.34, 0.1, 0.34, 1));
    const rim = boxPart(0.36, 0.03, 0.36, 1);
    translate(rim, 0, 0.035, 0);
    parts.push(rim);
  } else {
    parts.push(luteBodyGeometry());
    // Long, thin, and untapered in depth so its front face stays level with
    // the soundboard the strings are stretched over. This one part is most of
    // why the shape reads as an instrument at all.
    const neck = boxPart(0.042, 0.31, 0.05, 0.82, 1);
    translate(neck, 0, 0.245, 0);
    parts.push(neck);
    // The pegbox is angled back off the neck in a real lute. Faking that
    // with a wider, shallower block is enough at this size and costs nothing.
    const pegbox = boxPart(0.072, 0.085, 0.038, 0.8);
    translate(pegbox, 0, 0.535, -0.014);
    parts.push(pegbox);

    // The soundhole. A round dark facet in the middle of a pale board is the
    // single mark that turns a wooden shape into an instrument, and it is
    // worth twelve triangles at any distance the camera holds.
    const rose = discGeometry(0.04, 10);
    translate(rose, 0, 0.104, SOUNDBOARD_Z + 0.0015);
    dark.push(rose);
    const bridge = boxPart(0.074, 0.011, 0.008, 1);
    translate(bridge, 0, 0.046, SOUNDBOARD_Z + 0.001);
    dark.push(bridge);

    // Three courses, from the bridge to the nut. Deliberately thicker than a
    // real string: at the size this is seen a physically-scaled string is a
    // third of a pixel and simply is not there.
    for (const x of [-0.014, 0, 0.014]) {
      const string = boxPart(0.008, 0.492, 0.006, 1);
      translate(string, x, 0.052, SOUNDBOARD_Z + 0.005);
      bright.push(string);
    }
    const nut = boxPart(0.046, 0.012, 0.012, 1);
    translate(nut, 0, 0.545, SOUNDBOARD_Z - 0.002);
    bright.push(nut);

    // Kept to 0.62 rather than the 0.72 of the first attempt. Length is set
    // by where the bowl lands, not by the instrument: slung, the bowl has to
    // sit high enough up the back that the cloak has not yet flared past it,
    // or it hangs clear of the cloth with daylight showing between the two.
    length = 0.62;
  }

  /**
   * How far the built shape has to move to sit where the carrying pivot's
   * offsets expect it in depth.
   *
   * Every one of those offsets was solved against the old body, which was
   * four boxes centred on z zero and reaching 0.062 behind the axis; slung,
   * that 0.062 is what put the bowl on the camera's side of the cloak. This
   * body is built forward of its axis instead — a soundboard plane at +0.023
   * with the bowl hanging behind it — so without a shift its deepest point
   * lands somewhere else entirely, and the first build of it disappeared
   * into the cloth in the walking frame. Measured with the geometry as
   * built: the bowl bottoms out at `SOUNDBOARD_Z - 1.1 * 0.086`, and this is
   * the number that brings that back to the old 0.062.
   */
  const depthCentre = isFlute || isDrum ? 0 : -0.062 - (SOUNDBOARD_Z - 1.1 * 0.086);
  const finish = (pieces: BufferGeometry[]): BufferGeometry | null => {
    if (pieces.length === 0) return null;
    const merged = concat(pieces);
    translate(merged, 0, -length / 2, depthCentre);
    merged.computeVertexNormals();
    return merged;
  };

  return {
    body: finish(parts) as BufferGeometry,
    dark: finish(dark),
    bright: finish(bright),
  };
}

/** Move a colour's value without moving its hue. */
function scaleHex(hex: number, k: number): number {
  const ch = (shift: number) =>
    Math.min(255, Math.round(((hex >> shift) & 0xff) * k)) << shift;
  return ch(16) | ch(8) | ch(0);
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
  /** Timber, dark facets and strings. Swapped together, disposed together. */
  private readonly instrumentMeshes: Mesh[] = [];
  /** Ankles, so the foot can stay flatter than the leg it hangs off. */
  private readonly boots: Group[] = [];
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
    /**
     * The shin, and its taper is the other way round from how it was built.
     *
     * `boxPart` grows along +Y and the mesh is hung so that y 0 is the
     * *ankle*, so the third argument's `topScale` is the knee end. It used
     * to read `boxPart(0.12, SHIN_LEN, 0.135, 0.919)`: 0.12 by 0.135 at the
     * ankle tapering *up* to 0.110 by 0.124 at the knee — a calf thinner
     * than the ankle it stands on, which is not a leg, and worse, it made
     * the ankle the widest point of the whole limb. The boot it had to fit
     * inside was 0.103 by 0.122 at its rim, so the trouser burst out of the
     * boot on all four sides and its flat, sky-facing bottom cap showed as a
     * pale wedge under a dark box. That is most of the "overlapping boot
     * boxes with stray wedge fragments" the critique reported.
     *
     * Worse, it matched the thigh's knee end *exactly* — 0.110 by 0.124 at
     * both — and the two met at one plane, so the shin's upward top cap and
     * the thigh's downward bottom cap were coincident. The downward one is
     * culled, so what every camera in this game saw at each knee was a
     * flat, sky-lit 0.11 by 0.124 plate: thirty pixels by thirty-three in
     * the walking frame, a bright rung across the leg with nothing to
     * explain it. Half of the "overlapping boxes with stray wedge
     * fragments" is that plate, on both legs.
     *
     * Now it narrows downward the way a calf does, and — the part that
     * actually fixes the frame — it runs three centimetres *past* the knee
     * joint into the thigh and three and a half past the ankle into the
     * boot, staying narrower than the thigh over the whole overlap. Its own
     * upward cap is therefore inside the thigh and the boot's is inside it:
     * see `BOOT_RINGS` for the rule and why it is a rule. Nothing about the
     * walk changes; the silhouette it was tuned against is set by the limb's
     * length and swing and both are untouched.
     */
    const SHIN_INTO_THIGH = 0.03;
    const SHIN_INTO_BOOT = 0.035;
    const shinGeo = boxPart(
      0.088,
      SHIN_LEN + SHIN_INTO_THIGH + SHIN_INTO_BOOT,
      0.1,
      1.136,
      1.14,
    );
    const bootGeo = bootGeometry();
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
      shin.position.y = -SHIN_LEN - SHIN_INTO_BOOT;
      shin.castShadow = true;
      /**
       * The ankle is a joint now, not an offset.
       *
       * The boot used to be a mesh whose origin was its own *sole*, so the
       * roll that keeps a foot flatter than the leg above it pivoted the
       * boot about the ground and swung its shaft away from the shin —
       * opening and closing the intersection above differently on each foot
       * on every frame, which is the flicker that reads as z-fighting.
       * Hung off a joint at the ankle instead, the roll does what an ankle
       * does and the shaft never leaves the leg.
       */
      const ankle = new Group();
      ankle.position.y = -SHIN_LEN;
      const boot = new Mesh(bootGeo, solid(colors.boots, 0.45));
      boot.name = `bard-boot-${side < 0 ? 'left' : 'right'}`;
      boot.castShadow = true;
      ankle.add(boot);
      knee.add(shin, ankle);
      pivot.add(knee);

      // Six millimetres wider than it stood. The boots are 0.138 across and
      // were 0.026 apart, which at any distance the game's cameras hold
      // closes into one block — `Traveller` learned the same lesson about
      // its own legs and wrote it down. Nearly four centimetres of daylight
      // between them is what makes them two feet.
      pivot.position.set(side * 0.088, HIP_Y, 0);
      this.boots.push(ankle);
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
        // Half again what it was. The cloak is the largest single area on the
        // figure and at the hour the busk frames are shot it is on the sun's
        // far side, where it measured two sRGB levels off the ground behind
        // it at twenty pixels. Rim does not care where the sun is; it lights
        // the grazing edge, which for a cone-shaped cloth is its whole
        // outline. Kept well under the hat's 0.6 because the cloak is broad
        // and softly curved, and a hard rim on a broad curve reads as a
        // plastic highlight rather than as an edge.
        rim: 0.5,
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
    const armGeo = boxPart(0.092, 0.36, 0.1, 0.85);
    const handGeo = boxPart(0.1, 0.098, 0.104, 0.9);
    for (const [side, pivot] of [
      [-1, this.leftArm],
      [1, this.rightArm],
    ] as const) {
      pivot.name = `bard-arm-${side < 0 ? 'left' : 'right'}`;
      const arm = new Mesh(armGeo, solid(colors.sleeve, 0.5));
      arm.position.y = -0.36;
      arm.castShadow = true;
      const hand = new Mesh(handGeo, solid(colors.skin, 0.55));
      hand.position.y = -0.43;
      hand.castShadow = false;
      // A cuff, and it is a joint rather than a decoration.
      //
      // The sleeve ends at -0.36 and the hand begins at -0.43, so between
      // them is two and a half centimetres of nothing. Standing, the arm hangs
      // straight and the gap is invisible; the moment a pose swings the arm —
      // the seated carry sends both hands back and out — the hand separates
      // from the sleeve on screen and reads as a loose skin-coloured block
      // beside the hip, which is one of the three "geometry decomposes at
      // inspection distance" faults named against this figure. A band that
      // overlaps both ends closes it in every pose at once, which a tuned
      // offset for one pose would not.
      const cuff = new Mesh(boxPart(0.1, 0.062, 0.108, 0.95), solid(colors.boots, 0.4));
      cuff.position.y = -0.408;
      cuff.castShadow = false;
      pivot.add(arm, cuff, hand);
      /**
       * Where the shoulder joint sits, and it is the second half of the fix
       * the cloak's hem is the first half of.
       *
       * The old (0.172, ·, 0.035) hung the arm on a 0.175 m radius about the
       * spine, five centimetres inside a cloak whose hem reached 0.33. Half
       * a metre of arm and hand, wholly inside a cone of cloth, at every
       * bearing the game's cameras use. Five centimetres further forward
       * puts the shoulder in front of the cloak's own front edge rather
       * than under it; the splay in `update` does the rest, and between
       * them the sleeve, the cuff and the hand are outside the cloth at
       * every height. That is a geometric fact rather than a hope, and it
       * is what `bard.test.ts` pins.
       */
      pivot.position.set(side * ARM_ROOT_X, SHOULDER_Y, ARM_ROOT_Z);
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
    //
    // Dropped five centimetres and given a sharper taper, to make room above
    // it for the eyes. A nose set level with the eyes is a snout.
    const nose = new Mesh(boxPart(0.048, 0.062, 0.058, 0.52, 0.6), underBrim(colors.skin, 0.6));
    nose.position.set(0, HEAD_Y + 0.052, 0.104);
    nose.castShadow = false;

    /**
     * Two eyes, and they are the largest single thing this figure was
     * missing.
     *
     * Every critique of this game has ranked "the character never becomes a
     * person" first, and the specific complaint is that the near-profile
     * campfire frame — the one shot where the face is square to the lens —
     * shows a blank tan plane. The references it is judged against sell an
     * entire character on two dots and a beak, and this figure had the beak.
     *
     * Geometry, not a texture: the art direction forbids image maps and one
     * lighting model means a painted face would have to be a second one. Two
     * small blocks set five millimetres proud of the face plane cost twenty-
     * four triangles, read as dark facets at portrait distance, and at
     * twenty pixels vanish into the shade under the brim, which is exactly
     * what a face should do at twenty pixels.
     *
     * Not black — the shadow floor under the brim is already lifted for
     * everything up here, and the eyes take the same floor, so they stay a
     * warm dark rather than punching two holes through the head.
     */
    const eyeGeo = boxPart(0.044, 0.036, 0.014, 0.92);
    const eyeMaterial = underBrim(0x33241d, 0.16);
    const eyes: Mesh[] = [];
    for (const side of [-1, 1]) {
      const eye = new Mesh(eyeGeo, eyeMaterial);
      // Set very slightly asymmetrically, like everything else on him.
      eye.position.set(side * 0.056, HEAD_Y + 0.118 + side * 0.002, 0.1);
      eye.rotation.z = side * 0.06;
      eye.castShadow = false;
      eyes.push(eye);
    }
    // Hair sits low at the back so it shows under the brim; without it the
    // gap between hat and collar reads as a bare tan column, which from
    // behind — the angle the walking camera holds — is most of what you see
    // of the head.
    //
    // Raised two centimetres so its front edge is a hairline above the eyes
    // rather than a fringe across them.
    //
    // Narrower than the head, and that is the whole of the second fix. At
    // 0.255 by 0.235 it was *wider* than the skull it sits on — the head has
    // tapered to 0.241 by 0.217 at that height — so seven millimetres of
    // dark hair stood proud of the cheek on both sides. Square to the lens
    // that is invisible; at the near-profile the campfire camera holds it is
    // a hard horizontal slab cutting across the face at brow height, which
    // is what the critique saw. Hair belongs *behind* a face: this is inside
    // the head on every side but the back, where it still stands two
    // centimetres proud and does the job it was added for.
    const hair = new Mesh(boxPart(0.228, 0.095, 0.222, 1.0), underBrim(colors.hair, 0.4));
    hair.position.set(0, HEAD_Y + 0.165, -0.02);
    hair.castShadow = false;
    // The nape reaches down to the collar. It is the surface the player
    // actually looks at for most of the game — the back of a head under a
    // hat — so it gets the height to fill the gap and a rim term to give the
    // shape an edge in the shade.
    // Kept inside the head's width for the same reason the hair is: at 0.235
    // widening to 1.04 it cleared the skull by three millimetres at its top,
    // which from the side is a second dark edge running down past the ear.
    const nape = new Mesh(boxPart(0.222, 0.235, 0.078, 1.02, 1.1), underBrim(colors.hair, 0.6));
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
    // Tipped *back*, not forward. Together with the brim's own dip this
    // raises the rear edge about three centimetres clear of the crown of the
    // head, which is what lets the hair and the nape survive the rear
    // three-quarter the walking and busking cameras hold; the old -0.07
    // pushed the same edge down into them.
    hat.rotation.x = 0.085;
    hat.castShadow = true;
    const band = new Mesh(hatBandGeometry(), solid(colors.hatBand, 0.5));
    band.position.copy(hat.position);
    band.rotation.copy(hat.rotation);
    band.castShadow = false;
    this.headPivot.add(head, nose, ...eyes, hair, nape, hat, band);
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
    for (const mesh of this.instrumentMeshes) {
      this.instrumentPivot.remove(mesh);
      mesh.geometry.dispose();
      // The outgoing material has to leave the tracking list as well as be
      // disposed. Left in, every instrument swap in a session accumulated a
      // compiled shader program that nothing would free until the bard did.
      const stale = mesh.material as ShaderMaterial;
      const at = this.materials.indexOf(stale);
      if (at >= 0) this.materials.splice(at, 1);
      stale.dispose();
    }
    this.instrumentMeshes.length = 0;

    const id = instrument?.id ?? 'lute';
    const color = instrument?.color ?? 0xb5773f;
    const accent = instrument?.accent ?? 0xe8c98a;
    const parts = instrumentGeometry(id);

    /**
     * The timber.
     *
     * `rim` is nearly three times what it was, and it is the one dial STATE
     * names as the lever for the frame this game is about. At day 0.82 the
     * sun stands on the far side of the bard from the busking camera, so the
     * only side of him an instrument can be carried on and still be seen is
     * his shade side — the lute rendered L49 against a backdrop of L36-45,
     * two levels of separation at twenty pixels. A rim term is the only part
     * of the lighting model that does not care which way the sun is: it
     * fires on the grazing edges, which for a body held out from the torso
     * are exactly the edges that have to survive.
     */
    const bodyMaterial = this.track(
      createPainterlyMaterial(this.globals, {
        color,
        colorVariant: accent,
        grain: 0.28,
        grainScale: 2.2,
        rim: 0.9,
        rimPower: 1.7,
        flatShading: true,
        swayAttribute: false,
        sway: 0,
        shadowDepth: 0.6,
      }),
    );
    const body = new Mesh(parts.body, bodyMaterial);
    // Named for the same reason every other prop in this project is: a
    // headless check has to be able to find one object in the scene graph
    // and ask what it looks like on screen. The occlusion measurement that
    // fixed the playing carry floods *this* mesh with a flat colour and
    // counts the pixels that survive the depth test, which is the only way
    // to tell "the instrument projects 150 px" from "you can see it".
    body.name = 'bard-instrument';
    body.castShadow = true;
    // The pivot handles carrying angle and slinging; the geometry is already
    // centred on its own middle, so the two can be animated independently
    // and a drum can replace a lute without the pose changing.
    this.instrumentPivot.add(body);
    this.instrumentMeshes.push(body);

    if (parts.dark) {
      // A third of the timber's value, hue kept. Not black: this is a hole
      // into a lit box, and cosy games do not use black for holes.
      const hole = new Mesh(
        parts.dark,
        this.track(
          createPainterlyMaterial(this.globals, {
            color: scaleHex(color, 0.34),
            colorVariant: scaleHex(color, 0.5),
            grain: 0.2,
            grainScale: 2.6,
            rim: 0.12,
            rimPower: 2.4,
            flatShading: true,
            swayAttribute: false,
            sway: 0,
            shadowDepth: 0.55,
          }),
        ),
      );
      hole.name = 'bard-instrument-voice';
      hole.castShadow = false;
      this.instrumentPivot.add(hole);
      this.instrumentMeshes.push(hole);
    }

    if (parts.bright) {
      const strings = new Mesh(
        parts.bright,
        this.track(
          createPainterlyMaterial(this.globals, {
            color: accent,
            colorVariant: 0xfff0d6,
            grain: 0.12,
            grainScale: 3,
            // The hardest rim on the figure, on the thinnest geometry there
            // is. Strings seen nearly edge-on are almost entirely grazing
            // angle, so this is what makes them a line of light rather than
            // three slivers of the same value as the board behind them.
            rim: 1.15,
            rimPower: 1.3,
            flatShading: true,
            swayAttribute: false,
            sway: 0,
            shadowDepth: 0.75,
          }),
        ),
      );
      strings.name = 'bard-instrument-strings';
      strings.castShadow = false;
      this.instrumentPivot.add(strings);
      this.instrumentMeshes.push(strings);
    }
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
    //
    // The amplitude came down by a third, from a peak of forty degrees to
    // twenty-three, and that is a clearance as much as a taste. The boot's
    // rim is buried 0.038 m up inside the trouser; a roll of r slides it
    // `0.038 · sin r` sideways, and at forty degrees that is more than the
    // eighteen millimetres of trouser it has to hide behind — the cuff came
    // out through the leg at the top of each step. Twenty-three degrees is
    // still a real ankle and it stays inside.
    this.boots[0].rotation.x =
      -leftSwing * legSwing * 0.35 - Math.min(0, leftSwing) * 0.15 - sitAmount * SIT_SHIN[0];
    this.boots[1].rotation.x =
      -rightSwing * legSwing * 0.35 - Math.min(0, rightSwing) * 0.15 - sitAmount * SIT_SHIN[1];
    // Seated, the ankles go forward six centimetres, and that is a clearance
    // rather than a pose. The seat log is a cylinder of 0.115 m radius lying
    // under the bard's own origin, and the boot's heel now reaches only
    // 0.066 m behind the ankle rather than the old box's 0.13, so the same
    // shift clears it with room to spare. Standing, the ankle sits on the
    // shin's own axis: the old -0.04 was what pushed a whole foot out behind
    // the leg, and it is gone with the box it belonged to.
    for (const boot of this.boots) boot.position.z = sitAmount * 0.06;

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
    // **The sign of the splay was inverted, on both arms, for the whole life
    // of this file.** `gripLine`'s own derivation states the convention —
    // the hand direction is `(sin z, ...)` — so a positive roll carries a
    // hand toward +x, which on the *left* arm is toward the middle of the
    // chest. The old base of `+0.11` left and `-0.11` right therefore pulled
    // both arms four centimetres *into* the torso rather than out of it,
    // pressing each sleeve flat against a tunic of nearly its own value
    // inside a cloak of nearly its own value. Out is negative on the left.
    this.leftArm.rotation.z = -ARM_SPLAY - playAmount * 0.32 - armCross - lap * 0.1;

    // Seated, the free hand goes *back* rather than out, and that is a
    // measurement now rather than a preference. The resting camera stands
    // behind the bard and off to his right, so his right arm is the nearest
    // thing to the lens; splayed outward it hung flat across the lute in the
    // lap — flooded and shot, the instrument came back as a sliver behind a
    // solid plank of sleeve, which is the same "arm standing on the
    // instrument" fault the playing carry has its own long note about.
    // Swung back to 0.62 and brought in to 0.12, the hand lands beside the
    // hip on the log where a sitting person's hand goes, the forearm leaves
    // the lap alone, and it is still outside the gathered cloak — which
    // `bard.test.ts` checks, because "in" is the direction that would bury
    // it in the cloth.
    this.rightArm.rotation.x = Math.sin(armPhase) * armSwing * slung - carryPose * playAmount + lap * 0.62;
    this.rightArm.rotation.z = ARM_SPLAY + playAmount * 0.28 - armCross - lap * 0.14;

    // --- the strum ------------------------------------------------------
    //
    // **The busking bard has to be visibly playing in a still frame**, and
    // this is what makes that true. What was here before was a six-degree
    // sine added *after* the grip solve had already pinned the hand on the
    // belly, so the arm was, to any frame that caught it, hanging. Every
    // postcard of the one moment this game is about showed a musician not
    // playing.
    //
    // Two decisions, both forced.
    //
    // The gesture is made by moving the SHOULDER rather than the hand. There
    // is no elbow on this figure, so the hand can only ever lie on a sphere
    // of `ARM_REACH` about the shoulder; with the shoulder fixed, a hand
    // solved onto the strings has at most two legal positions on them and
    // physically cannot travel. Lift and drop the shoulder and the sphere
    // travels with it, `gripLine` slides its intersection along the
    // soundboard, and the arm rakes across the strings while the hand stays
    // on them — which is what a strumming arm does and the only version of
    // it this rig can express honestly.
    //
    // And the wave is a triangle, not a sine. A sine spends most of its
    // period near the two ends of the stroke, so a frame shot at a random
    // instant catches the arm parked at the top or the bottom; a triangle is
    // uniform over the sweep, which is the property that actually matters
    // when the thing being judged is a photograph.
    const strumCycle = this.elapsed * 2.1;
    const stroke = Math.abs((strumCycle - Math.floor(strumCycle)) * 2 - 1) * 2 - 1;
    const strumSwing = stroke * playAmount * (0.6 + this.warmth * 0.4);
    this.rightArm.position.set(
      ARM_ROOT_X,
      // A centimetre and a half more lift than before. The carry was
      // re-solved to keep the arm off the soundhole (see `PLAY_CARRY_ROT`),
      // which brought the instrument nearer the shoulder and shortened the
      // stroke the same solve produces — measured, eight centimetres of hand
      // travel fell to under seven. The gesture is the point; the extra
      // shoulder movement pays it back.
      SHOULDER_Y + strumSwing * 0.105,
      ARM_ROOT_Z + strumSwing * 0.07,
    );

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
      playAmount * PLAY_CARRY_POS[0] - slung * 0.03 + lap * LAP_X,
      // The lap term came up seven millimetres and forward eighteen, which
      // is the whole of the "the lute sinks into his knee" report. Measured
      // rather than eyeballed: with the seated pose settled, sixteen of the
      // instrument's 396 vertices lay *inside* the far thigh's box, up to a
      // centimetre deep, so the thigh's silhouette cut a notch out of the
      // bowl. Forward is the direction that pays, because an instrument
      // resting across someone's legs sits in front of the knees; up alone
      // would have walked the pegbox toward the hat brim, which this file
      // has a separate note and a separate test about.
      SHOULDER_Y + playAmount * PLAY_CARRY_POS[1] - slung * 0.12 - lap * LAP_Y,
      // Six centimetres further off the spine than it hung, and the reason is
      // a depth test rather than a taste. The old body was four boxes, so its
      // rear face was a flat slab a hand's width across sitting at one depth;
      // it won the depth test against the cloak over that whole area even
      // though it barely cleared it. A bowl only touches its deepest point
      // along one ridge and curves away either side, so the same offset put
      // ninety per cent of it inside the cloth. Measured: at 0.285 the
      // instrument projected 100 px wide against a cloak 138 px wide and ten
      // of those pixels were outside it.
      playAmount * PLAY_CARRY_POS[2] - slung * 0.345 + lap * LAP_Z,
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
    //
    // **The playing and lap carries are spun a half turn about the neck, so
    // the soundboard faces the camera instead of the bard.** This is the
    // difference between an instrument that can be identified and one that
    // cannot, and it is worth stating exactly what it does and does not
    // change.
    //
    // Every camera in this game stands behind the bard. Carried the way a
    // player really holds a lute — face outward, away from the chest — the
    // side presented to the lens is therefore always the back of the bowl,
    // and the three marks that say "lute" rather than "wooden object" (the
    // soundhole, the bridge, the strings) all live on the face. Four rounds
    // of critique in a row have said the instrument is unidentifiable in a
    // game about one instrument. It is unidentifiable because it is facing
    // away.
    //
    // The spin is exact rather than approximate, and that is what makes it
    // safe: adding pi to the Y term while negating the Z term leaves the
    // instrument's own +Y — the neck axis, which every solved number in this
    // file is expressed against — bit-for-bit where it was, and flips only
    // which face is outward. `Rz(c)·(0,1,0) = (-sin c, cos c, 0)` and
    // `Ry(pi)·Rz(-c)·(0,1,0) = Ry(pi)·(sin c, cos c, 0) = (-sin c, cos c, 0)`.
    // So the lap carry's three solved angles still lay the neck across the
    // resting camera exactly as their note describes, the pegbox still ends
    // up below the hat brim, and the grip solves still find the same points.
    //
    // The slung carry is deliberately NOT spun. The bowl has to lie against
    // the small of the back — the cloak's rear surface is only 0.29 m off the
    // spine there — and turning the face outward would either bury the bowl
    // inside the cloth as a ghost or stand the whole instrument off the back
    // like a knapsack, which is a failure this file already records. Slung,
    // the identification is carried by the outline and by the bowl's five
    // staves instead.
    this.instrumentPivot.rotation.set(
      this.strum * 0.07 + slung * 0.15 + playAmount * PLAY_CARRY_ROT[0] + lap * LAP_ROT[0],
      playAmount * (PLAY_CARRY_ROT[1] + Math.PI) + slung * 0.08 + lap * LAP_ROT[1],
      -slung * 0.52 - playAmount * PLAY_CARRY_ROT[2] + lap * LAP_ROT[2],
    );

    // Both hands go on the instrument, and both are solved rather than
    // dialled — see `gripLine`. The fretting hand takes the neck in the lap
    // pose *and* the playing pose; the strumming hand takes the belly, and
    // only while playing, because the seated bard's right hand belongs on the
    // log beside him and not on the strings.
    const fret = Math.min(1, lap + playAmount);
    if (fret > 0) this.gripLine(this.leftArm, NECK_GRIP_MIN, NECK_GRIP_MAX, fret, true, 0.035);
    if (playAmount > 0) {
      // The strum grip is a moving target rather than a range: the triangle
      // above walks it from the bowl end of the soundboard to the shoulders
      // and back, and the pair of bounds is kept an inch wide so the solve
      // still lands the hand on the line rather than snapping to an end.
      const reach = STRUM_GRIP_MIN + (STRUM_GRIP_MAX - STRUM_GRIP_MIN) * (0.5 + stroke * 0.5);
      this.gripLine(this.rightArm, reach - 0.012, reach + 0.012, playAmount, false, 0.05);
    }
    // The pluck kick rides on top of whatever the solve produced, rather than
    // inside it. Folded into the base angles it would be diluted by the
    // solve's own lerp exactly when the bard is playing, which is the one
    // time it exists for: `pluck` is what makes a note land visually at the
    // same instant it lands audibly.
    //
    // Smaller than it was, because the sweep above now carries the gesture.
    // At 0.5 a full-strength pluck threw the hand thirty centimetres clear of
    // an instrument the rest of this file works hard to keep it on.
    this.rightArm.rotation.x -= this.strum * 0.24;
    this.rightArm.rotation.z -= this.strum * 0.1;
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
    /**
     * How far in front of the instrument's own axis the hand should land,
     * along its local +Z — which, since the playing and lap carries are spun
     * face-out, is the soundboard side.
     *
     * Zero was the old behaviour and it aimed the hand at the *middle* of the
     * instrument, so a hand solved onto the belly was buried up to the wrist
     * in the body it was supposed to be strumming. It did not show while the
     * bowl faced the camera; it shows immediately now that the face does.
     */
    offset = 0,
  ): void {
    this.instrumentPivot.updateMatrix();
    const m = this.instrumentPivot.matrix.elements;
    // Origin and local +Y of the instrument, in torso space, with the origin
    // lifted off the axis toward the soundboard.
    const ax = m[12] + m[8] * offset;
    const ay = m[13] + m[9] * offset;
    const az = m[14] + m[10] * offset;
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
