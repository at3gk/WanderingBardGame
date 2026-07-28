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
 */

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Object3D,
  type ShaderMaterial,
} from 'three';
import { addSway } from '../world/geometry';
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
  boots: 0x4e3a2c,
  hat: 0x8c3d33,
  hatBand: 0xe0b463,
  hair: 0x3d2a22,
};

/** A tapered box. Every part of the bard is one of these. */
function boxPart(
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
 */
function cloakGeometry(): BufferGeometry {
  const panels = 9;
  const topRadius = 0.19;
  const bottomRadius = 0.38;
  const top = 0.62;
  const bottom = -0.28;
  const verts: number[] = [];
  // Only the back three-quarters — a full cone would bury the instrument
  // and the hands, which are the two things the player needs to see.
  const arc = Math.PI * 1.55;
  const start = Math.PI * 0.5 - arc / 2;

  for (let i = 0; i < panels; i++) {
    const a0 = start + (i / panels) * arc;
    const a1 = start + ((i + 1) / panels) * arc;
    // Ragged hem: each panel hangs to a slightly different length.
    const drop0 = bottom - (i % 3) * 0.035;
    const drop1 = bottom - ((i + 1) % 3) * 0.035;
    const t0 = [Math.cos(a0) * topRadius, top, Math.sin(a0) * topRadius];
    const t1 = [Math.cos(a1) * topRadius, top, Math.sin(a1) * topRadius];
    const b0 = [Math.cos(a0) * bottomRadius, drop0, Math.sin(a0) * bottomRadius];
    const b1 = [Math.cos(a1) * bottomRadius, drop1, Math.sin(a1) * bottomRadius];
    verts.push(...t0, ...b0, ...b1, ...t0, ...b1, ...t1);
    // Double-sided by hand rather than with DoubleSide, so the lining can
    // be a different colour from the outside without a second material.
    verts.push(...t0, ...b1, ...b0, ...t0, ...t1, ...b1);
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

/** A wide-brimmed, slightly crumpled hat. */
function hatGeometry(): BufferGeometry {
  const segments = 9;
  const brim = 0.27;
  const crownRadius = 0.135;
  const crownTop = 0.2;
  const verts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    // The brim dips at the front and lifts at the back; a flat disc reads
    // as a lampshade.
    const dip0 = Math.cos(a0) * 0.035 - 0.02;
    const dip1 = Math.cos(a1) * 0.035 - 0.02;
    const r0 = brim * (0.9 + Math.abs(Math.sin(a0)) * 0.18);
    const r1 = brim * (0.9 + Math.abs(Math.sin(a1)) * 0.18);
    const c0 = [Math.cos(a0) * crownRadius, 0, Math.sin(a0) * crownRadius];
    const c1 = [Math.cos(a1) * crownRadius, 0, Math.sin(a1) * crownRadius];
    const e0 = [Math.cos(a0) * r0, dip0, Math.sin(a0) * r0];
    const e1 = [Math.cos(a1) * r1, dip1, Math.sin(a1) * r1];
    verts.push(...c0, ...e0, ...e1, ...c0, ...e1, ...c1);
    verts.push(...c0, ...e1, ...e0, ...c0, ...c1, ...e1);

    const k0 = [Math.cos(a0) * crownRadius * 0.72, crownTop, Math.sin(a0) * crownRadius * 0.72];
    const k1 = [Math.cos(a1) * crownRadius * 0.72, crownTop, Math.sin(a1) * crownRadius * 0.72];
    verts.push(...c0, ...k0, ...k1, ...c0, ...k1, ...c1);
  }
  // Cap the crown.
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    verts.push(
      0, crownTop, 0,
      Math.cos(a0) * crownRadius * 0.72, crownTop, Math.sin(a0) * crownRadius * 0.72,
      Math.cos(a1) * crownRadius * 0.72, crownTop, Math.sin(a1) * crownRadius * 0.72,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  addSway(geometry, 0, 1, 0);
  return geometry;
}

/**
 * The instrument. One shape, recoloured and reproportioned per instrument,
 * because six modelled instruments is six times the geometry for something
 * held at chest height and seen mostly in silhouette.
 */
function instrumentGeometry(kind: string): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const isDrum = kind === 'drum' || kind === 'bodhran';
  const isFlute = kind === 'flute' || kind === 'reedflute' || kind === 'pipe';

  if (isFlute) {
    const body = boxPart(0.05, 0.62, 0.05, 0.9);
    parts.push(body);
  } else if (isDrum) {
    const body = boxPart(0.34, 0.1, 0.34, 1);
    parts.push(body);
  } else {
    // A rounded body and a neck: lute, harp, hurdy-gurdy and bells all read
    // acceptably from this at the distance the camera holds.
    const body = boxPart(0.3, 0.26, 0.16, 0.62, 0.7);
    parts.push(body);
    const neck = boxPart(0.06, 0.44, 0.05, 0.85);
    translate(neck, 0, 0.24, 0);
    parts.push(neck);
    const head = boxPart(0.09, 0.1, 0.05, 0.7);
    translate(head, 0, 0.66, 0);
    parts.push(head);
  }

  const merged = concat(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, 1, 0);
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
  private readonly instrumentPivot = new Group();
  private instrumentMesh: Mesh | null = null;

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

    const solid = (color: number, rim = 0.5) =>
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
          swayAttribute: true,
          sway: 0,
          shadowDepth: 0.45,
        }),
      );

    // --- legs ----------------------------------------------------------
    // Pivots sit at the hip so a rotation swings the leg rather than
    // sliding it. This is the one thing that has to be right or the walk
    // is unfixable downstream.
    const legGeo = boxPart(0.115, 0.46, 0.13, 0.85);
    const bootGeo = boxPart(0.14, 0.12, 0.2, 0.9);
    for (const [side, pivot] of [
      [-1, this.leftLeg],
      [1, this.rightLeg],
    ] as const) {
      const thigh = new Mesh(legGeo, solid(colors.trousers, 0.35));
      thigh.position.y = -0.46;
      thigh.castShadow = true;
      const boot = new Mesh(bootGeo, solid(colors.boots, 0.3));
      boot.position.y = -0.55;
      boot.position.z = 0.02;
      boot.castShadow = true;
      pivot.add(thigh, boot);
      pivot.position.set(side * 0.075, 0.5, 0);
      this.hips.add(pivot);
    }

    // --- torso ---------------------------------------------------------
    const torsoMesh = new Mesh(boxPart(0.3, 0.44, 0.19, 1.12, 1.05), solid(colors.tunic, 0.45));
    torsoMesh.position.y = 0.5;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    const beltMesh = new Mesh(boxPart(0.31, 0.06, 0.2, 1), solid(colors.hatBand, 0.6));
    beltMesh.position.y = 0.5;
    beltMesh.castShadow = false;
    this.torso.add(beltMesh);

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
    const cloak = new Mesh(cloakGeometry(), cloakMaterial);
    cloak.position.y = 0.42;
    cloak.castShadow = true;
    this.torso.add(cloak);

    // --- arms ----------------------------------------------------------
    const armGeo = boxPart(0.09, 0.4, 0.1, 0.85);
    const handGeo = boxPart(0.09, 0.09, 0.1, 0.9);
    for (const [side, pivot] of [
      [-1, this.leftArm],
      [1, this.rightArm],
    ] as const) {
      const arm = new Mesh(armGeo, solid(colors.tunic, 0.45));
      arm.position.y = -0.4;
      arm.castShadow = true;
      const hand = new Mesh(handGeo, solid(colors.skin, 0.55));
      hand.position.y = -0.46;
      hand.castShadow = false;
      pivot.add(arm, hand);
      pivot.position.set(side * 0.19, 0.9, 0);
      this.torso.add(pivot);
    }

    // --- head ----------------------------------------------------------
    const head = new Mesh(boxPart(0.2, 0.21, 0.19, 0.95), solid(colors.skin, 0.55));
    head.position.y = 0.94;
    head.castShadow = true;
    const hair = new Mesh(boxPart(0.215, 0.09, 0.2, 1), solid(colors.hair, 0.4));
    hair.position.y = 1.06;
    hair.castShadow = false;
    const hat = new Mesh(hatGeometry(), solid(colors.hat, 0.6));
    hat.position.y = 1.15;
    // Worn at an angle. Nothing about a bard should be square to the world.
    hat.rotation.z = 0.15;
    hat.rotation.x = -0.08;
    hat.castShadow = true;
    this.headPivot.add(head, hair, hat);
    this.torso.add(this.headPivot);

    // --- instrument ----------------------------------------------------
    this.instrumentPivot.position.set(0.02, 0.6, 0.17);
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
        swayAttribute: true,
        sway: 0,
      }),
    );
    const mesh = new Mesh(instrumentGeometry(id), material);
    mesh.castShadow = true;
    // Carried across the body at an angle, the way anyone actually holds a
    // lute — square-on it reads as a shield.
    mesh.rotation.z = -0.5;
    mesh.rotation.x = 0.22;
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

    // One stride per 0.78 m. Tuned against the figure's leg length: too
    // long and it moonwalks, too short and it scurries.
    this.stride += distanceDelta * (Math.PI / 0.78);

    const walkAmount = this.blendWeight('walking') * Math.min(1, this.smoothedSpeed / 1.4);
    const playAmount = this.blendWeight('playing');
    const sitAmount = this.blendWeight('sitting');
    const idleAmount = Math.max(0, 1 - walkAmount - playAmount - sitAmount);

    const phase = this.stride;
    const breathe = Math.sin(this.elapsed * 1.5);

    // --- legs ----------------------------------------------------------
    const legSwing = 0.62 * walkAmount;
    this.leftLeg.rotation.x = Math.sin(phase) * legSwing + sitAmount * -1.25;
    this.rightLeg.rotation.x = Math.sin(phase + Math.PI) * legSwing + sitAmount * -1.05;
    // A knee-ish bend on the forward swing, faked by lifting the pivot.
    this.leftLeg.position.y = 0.5 + Math.max(0, Math.sin(phase)) * 0.03 * walkAmount;
    this.rightLeg.position.y = 0.5 + Math.max(0, Math.sin(phase + Math.PI)) * 0.03 * walkAmount;

    // --- body bob ------------------------------------------------------
    // Twice step frequency, and skewed: the rise is quicker than the fall.
    const bobPhase = phase * 2;
    const skewed = Math.sin(bobPhase) - 0.22 * Math.sin(bobPhase * 2);
    this.hips.position.y =
      skewed * 0.035 * walkAmount + breathe * 0.008 * idleAmount - sitAmount * 0.42;
    // Weight shifts side to side, a quarter-phase behind the bob.
    this.hips.position.x = Math.sin(phase - Math.PI * 0.25) * 0.022 * walkAmount;
    this.hips.rotation.z = Math.sin(phase - Math.PI * 0.25) * 0.05 * walkAmount;

    // --- torso ---------------------------------------------------------
    // Counter-rotates against the hips, and leans into the direction of
    // travel proportionally to speed.
    this.torso.rotation.y = Math.sin(phase) * 0.14 * walkAmount;
    this.torso.rotation.x =
      Math.min(0.1, this.smoothedSpeed * 0.05) * walkAmount +
      playAmount * 0.06 +
      sitAmount * 0.16 +
      breathe * 0.01 * idleAmount;
    this.torso.rotation.z = Math.sin(phase - Math.PI * 0.25) * -0.03 * walkAmount;

    // --- head ----------------------------------------------------------
    // Counter-rotation is deliberately *not* complete: a head that cancels
    // the shoulders exactly looks gyroscopic. Two-thirds reads as human.
    this.headPivot.rotation.y = -this.torso.rotation.y * 0.66;
    this.headPivot.rotation.x =
      -this.torso.rotation.x * 0.5 +
      Math.sin(bobPhase + 0.6) * 0.02 * walkAmount +
      // Looking down at the hands while playing, less so as the crowd warms
      // and the bard starts performing to them instead of to the strings.
      playAmount * (0.2 - this.warmth * 0.22);
    this.headPivot.rotation.z = Math.sin(this.elapsed * 0.7) * 0.02 * idleAmount;

    // --- arms ----------------------------------------------------------
    const armSwing = 0.46 * walkAmount;
    // Arms lag the legs slightly. The lag is small but it is the difference
    // between a walk and a wind-up toy.
    const armPhase = phase - 0.22;
    const carryPose = 0.35 + playAmount * 0.25;

    // The left hand stays on the instrument's neck at all times; it only
    // swings when the instrument is slung and the bard is walking.
    const slung = 1 - playAmount;
    this.leftArm.rotation.x =
      Math.sin(armPhase + Math.PI) * armSwing * slung - carryPose * playAmount - 0.15;
    this.leftArm.rotation.z = 0.12 + playAmount * 0.32;

    // The right hand strums. The kick from `pluck` is what makes a note
    // land visually at the same instant it lands audibly.
    const strumMotion = Math.sin(this.elapsed * 7.5) * 0.1 * playAmount * (0.4 + this.warmth * 0.6);
    this.rightArm.rotation.x =
      Math.sin(armPhase) * armSwing * slung -
      carryPose * playAmount -
      this.strum * 0.5 +
      strumMotion;
    this.rightArm.rotation.z = -0.12 - playAmount * 0.28 - this.strum * 0.16;

    // --- instrument ----------------------------------------------------
    // Brought up across the body while playing, dropped to the hip while
    // walking. Blending the position rather than snapping is what stops the
    // instrument teleporting when a busk starts.
    this.instrumentPivot.position.set(
      0.02 + playAmount * 0.02,
      0.6 - slung * 0.14,
      0.17 + playAmount * 0.05,
    );
    this.instrumentPivot.rotation.z = slung * 0.55;
    this.instrumentPivot.rotation.y = playAmount * -0.35 + slung * 0.2;
    // Resonance: the instrument shivers a little on each pluck.
    this.instrumentPivot.rotation.x = this.strum * 0.07;
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
