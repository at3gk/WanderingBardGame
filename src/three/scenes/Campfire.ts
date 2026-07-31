/**
 * The campfire.
 *
 * The player walks all day and arrives here at dusk, so this is the one
 * image in the game that has to land. Everything below is arranged around
 * three things that carry a campfire and a fourth that ruins one:
 *
 * - **A warm pool falling off into blue dusk.** The rest of the world is lit
 *   by a low, cold sky; the camp is a hole in that. The falloff is the
 *   picture — a fire that lights everything evenly is a lamp.
 * - **A readable silhouette.** A ring, a shape rising out of it, and three
 *   or four upright objects around it. At the resting camera's four metres
 *   the detail is gone and only that outline is working.
 * - **Small specific things.** A ring of stones and a flame is a campfire.
 *   A bedroll, a propped pack, and an instrument leaned against a stone is
 *   somebody's camp, and the difference between those two is the whole
 *   emotional job of this file.
 * - **And nothing that visibly loops.** A flame on a two-second cycle is
 *   worse than a still one: a still flame reads as stylisation, a looping
 *   one reads as a texture. So every animated quantity here is a sum of
 *   sines at irrational frequency ratios, which has no period at all.
 *
 * ## What this is not
 *
 * It is not a `Stage`. It is a prop cluster the road stage places at a point
 * on the road, and it owns nothing but its own group, its light and its
 * clock. Where each piece *sits* is not decided here either — that is
 * `campfireLayout`, so the arrangement can be tested without a renderer.
 *
 * ## The second light source
 *
 * This is the only place in the game with two lights, and the exception is
 * spent deliberately. Note the honest limitation: the painterly shader's
 * lighting model is sun plus directional sky ambient and it does not read
 * `pointLights[]`, so the `PointLight` below warms anything drawn with a
 * stock three material and nothing else. Until painterly grows a fire term,
 * what actually makes the light read is the ground pool — a soft additive
 * disc draped over the terrain, whose brightness follows the same signal
 * the light does. DESIGN.md's art direction has always allowed "a faint
 * radial glow around literal light sources like the campfire", and this is
 * that, in three dimensions.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  PointLight,
  ShaderMaterial,
  Vector3,
} from 'three';
import {
  createPainterlyMaterial,
  type PainterlyGlobals,
  type PainterlyOptions,
} from '../painterly';
import { ParticleField, embers } from '../fx/Particles';
import { rockGeometry } from '../world/geometry';
import { DEFAULT_PALETTE, type BiomePalette } from '../world/palette';
import { mulberry32, randRange, subSeed, type Rand } from '../../core/rng';
import {
  SEAT_LOG_LENGTH_M,
  campfireLayout,
  type CampfireLayout,
  type PropPlacement,
} from './campfireLayout';
import { SITTING_SEAT_HEIGHT_M } from '../actors/Bard';

export interface CampfireOptions {
  /** Road heading at the stop. The camp is laid out relative to it. */
  heading?: number;
  /**
   * Ground height at a point in the camp's own (anchor-relative) frame.
   * Props are seated on it and the light pool is draped over it, so a camp
   * on a crowned road does not float on one side. Defaults to flat.
   */
  groundHeightAt?: (x: number, z: number) => number;
  /** The biome the camp is in; the stones borrow its rock colour. */
  palette?: BiomePalette;
  /** Ember budget multiplier, from the app's quality tier. */
  particleDensity?: number;
  /** Starting burn, applied without a fade. */
  burn?: number;
}

// --- palette -----------------------------------------------------------
// The fire is the warmest thing in any frame it appears in, which is the
// standing rule. Cream (0xe8d9c0) belongs to the notation and is not used
// here — the hot end of the flame goes to gold instead, which is the colour
// the rest of the game's warm furniture already uses.
const FLAME_STEPS = [
  { color: 0xd8481c, emissive: 0xff5e1e, strength: 0.5 },
  { color: 0xf07a24, emissive: 0xff8a2e, strength: 0.8 },
  { color: 0xffa53a, emissive: 0xffb44a, strength: 1.0 },
  { color: 0xffc75c, emissive: 0xffd06a, strength: 1.15 },
];

const COAL_COLOR = 0x2a1a14;
const COAL_EMISSIVE = 0xff4a12;
const WOOD_COLOR = 0x6b503a;
const WOOD_CHAR = 0x3a2e26;
/**
 * Camp cloth is dusty and desaturated on purpose. A bright bedroll would
 * compete with the bard's rust cloak, and the bard is meant to be the
 * warmest thing in frame after the fire itself.
 */
const CANVAS_COLOR = 0x8f7a5c;
const BLANKET_COLOR = 0xa8734f;
const LEATHER_COLOR = 0x6f5238;
const STRAP_COLOR = 0x4e3a2c;
const INSTRUMENT_COLOR = 0xb5773f;
const INSTRUMENT_ACCENT = 0xe8c98a;
const LANTERN_METAL = 0x4a4038;
const LANTERN_GLASS = 0xffc25e;

const LIGHT_EMBER = new Color(0xff5a24);
const LIGHT_BLAZE = new Color(0xffa552);

/**
 * How far the fire's light reaches.
 *
 * Sized against the layout, not against physics: the bedroll sits about
 * 2.6 m out, so this covers the whole camp with room to spare. It does not
 * stop short of the road — the fire is 5.8 m off the centreline at its
 * closest and the packed surface is 2.3 m wide, so the pool's rim laps onto
 * it — but by that radius the ramp below has run all the way down to its
 * dark red. The composition still reads: the camp is warm, the road it came
 * off is still blue.
 *
 * **Measured, not chosen.** The resting camera stands 3.8 m back from a seat
 * that is about 2 m from the fire, looking at it, so *the whole of the
 * visible foreground is within about six metres of the flame*. A pool sized
 * generously — 4.6 m, and then 5.6 m when the hue ramp was first added —
 * therefore fills the entire lower half of the frame with its inner, orange
 * half and pushes everything interesting past the frame edge. That is the
 * mechanical reason the pool read as "one uniform saturated orange": not
 * that it had no ramp, but that the frame only ever showed the top of it.
 * 4.4 m puts the far corners of the picture *outside* the pool, which is
 * where the night gets to be night.
 */
const POOL_RADIUS_M = 4.4;

/**
 * The fire's radial hue journey, as multipliers on the light's own colour.
 *
 * This is the whole fix for "one uniform saturated orange with a hard rim".
 * A fire does not light the ground evenly and then stop; it grades — a
 * yellow-white core where the coals are, orange out to arm's reach, deep red
 * where it is only just reaching, and then a bruised violet-brown as the last
 * of it meets the blue of the night. Painting that ramp *into the pool* is
 * cheaper and more controllable than trying to get it out of a falloff curve,
 * and it means the rim is a colour change rather than a brightness edge —
 * which is why it stops reading as the boundary of a decal.
 *
 * Multipliers, not colours, so the ramp stays coupled to the flame: as the
 * fire banks down and `lightColor` slides from blaze to ember, the whole
 * journey slides with it instead of a painted gradient sitting on top of a
 * dying fire. Against `LIGHT_BLAZE` (1.00, 0.65, 0.32) these give, in order:
 * warm cream, gold, orange, red-orange, deep red, and a dark red-violet that
 * — added onto blue night ground — comes out as the violet-brown the last of
 * a fire actually makes.
 *
 * The stops are bunched hard toward the middle, which looks wrong written
 * down and is right on screen, for a reason that was measured rather than
 * guessed. Sampled at sixteen bearings per radius on `07-night-campfire`,
 * the ground *without* this pool is flat: luminance 50 to 64 from half a
 * metre out to seven and a half, with a red/green ratio of about 1.35. So
 * the pool is not grading over darkness, it is grading over an unchanging
 * ochre — and the moment its own contribution drops below roughly the
 * ground's own value, the ground's hue wins and the journey stops. The first
 * version of this ramp reached red at 0.62 of the radius, by which point the
 * pool was adding 51 to red and 5 to green over a ground already sitting at
 * 81/59: a strongly red *addition* that came out, composited, at the same
 * orange as everywhere else.
 *
 * The fix is not more light — that undoes the darkness the frame needs. It
 * is to strip the green out earlier, while there is still enough of the pool
 * left to be seen doing it. Red arrives at 0.36 of the radius here, about a
 * metre and a half from the coals.
 */
const POOL_TINT: readonly (readonly [number, number, number, number])[] = [
  [0.0, 1.14, 1.36, 1.66],
  [0.08, 1.06, 1.08, 0.98],
  [0.2, 1.0, 0.78, 0.55],
  [0.36, 0.99, 0.44, 0.2],
  [0.55, 0.95, 0.21, 0.1],
  [0.75, 0.78, 0.11, 0.16],
  [1.0, 0.5, 0.07, 0.32],
];

/**
 * How far the *shader's* hearth term reaches, metres.
 *
 * Distinct from the pool: the pool is a mark on the ground and this is the
 * light on everything standing in it. The painterly falloff is
 * `1/(1 + d²/r²)`, which never reaches zero, so `r` is the only thing
 * deciding how much of the world the fire washes.
 *
 * Down from the shader's own 4.2 default, and the reason is the second half
 * of the campfire critique: the night never darkened. At 4.2 the term still
 * carries fifteen per cent of its strength twelve metres out — past the
 * camp, past the road, out to the frame edge — so every olive-grey mid-value
 * in the picture was being lifted warm and there was nothing dark left for
 * the fire to be precious against. At 3.0 the same distance carries six per
 * cent. The cost is at the bard, two metres away, who loses about a sixth of
 * his firelight; `HEARTH_GAIN` hands that back, and only that, so the trade
 * is local warmth kept and distant wash removed.
 */
const HEARTH_RADIUS_M = 3.0;
/** Restores the near-field loss from the tighter radius above. Nothing more. */
const HEARTH_GAIN = 1.18;

/** Irrational, so sums built from them have no period. */
const PHI = 1.618033988749895;
const SILVER = 2.414213562373095;

/**
 * Base frequencies, one per flame segment, in radians per second. No two
 * are in a small-integer ratio, so segments never gutter in unison; and
 * because each segment's own wobble mixes `f`, `f*PHI` and `f*SILVER`, its
 * individual motion is genuinely aperiodic rather than merely long.
 */
const SEGMENT_FREQ = [1.73, 2.29, 3.11, 4.07];

/** Upper segments move more than the base. Fire is stiff at the coals. */
const SEGMENT_AMPLITUDE = [0.55, 0.78, 1.0, 1.25];

/** Vertical layout of the flame, metres. Segments overlap so gaps can't open. */
const SEGMENT_BASE_Y = [0.02, 0.2, 0.4, 0.6];
const SEGMENT_HEIGHT = [0.44, 0.4, 0.34, 0.26];
const SEGMENT_RADIUS = [0.3, 0.25, 0.19, 0.13];

function wobble(t: number, frequency: number, phase: number): number {
  // Three partials rather than one: a single sine is instantly readable as a
  // machine, and two beat visibly against each other. Weights fall off so
  // the result stays inside [-1, 1].
  return (
    Math.sin(t * frequency + phase) * 0.5 +
    Math.sin(t * frequency * PHI + phase * 1.7) * 0.32 +
    Math.sin(t * frequency * SILVER + phase * 2.9) * 0.18
  );
}

export class Campfire {
  readonly group = new Group();
  readonly layout: CampfireLayout;
  /**
   * The fire's own light. No shadows: a second shadow-casting light doubles
   * the shadow-map cost for a pool of light four metres across, and the
   * one thing a stylised fire must not do is stamp a hard second shadow
   * behind everything the sun already shadowed.
   */
  readonly light: PointLight;

  private readonly globals: PainterlyGlobals;
  private readonly fireGroup = new Group();
  private readonly flameGroup = new Group();
  private readonly segments: Mesh[] = [];
  private readonly coalMaterial: ShaderMaterial;
  private readonly glowMaterial: ShaderMaterial;
  private readonly emberField: ParticleField;

  private readonly materials: ShaderMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  /**
   * An InstancedMesh's per-instance matrix and colour buffers hang off the
   * *mesh*, not off its geometry, and three only frees them from the mesh's
   * own `dispose`. So the geometry list above cannot reach them and they
   * need a list of their own; `WorldStreamer` does the same when it drops a
   * chunk.
   */
  private readonly instanced: InstancedMesh[] = [];

  private readonly emberOrigin = new Vector3();
  private readonly lightColor = new Color();

  /** Top of the seat log, in the camp's frame. What `seat` hands out. */
  private readonly seatSurfaceY: number;

  private burn: number;
  private burnTarget: number;
  /** The flame's smoothed bulk. Drives the light; see `update`. */
  private lit = 1;

  constructor(globals: PainterlyGlobals, seed: number, options: CampfireOptions = {}) {
    const {
      heading = 0,
      groundHeightAt = () => 0,
      palette = DEFAULT_PALETTE,
      particleDensity = 1,
      burn = 1,
    } = options;

    this.globals = globals;
    this.burn = burn;
    this.burnTarget = burn;
    this.layout = campfireLayout(seed, heading);
    this.group.name = 'campfire';

    const rand = mulberry32(subSeed(seed, 'campfire/build'));
    const { fire } = this.layout;
    const fireY = groundHeightAt(fire.x, fire.z);
    this.fireGroup.position.set(fire.x, fireY, fire.z);
    this.group.add(this.fireGroup);

    this.buildRing(palette, rand, groundHeightAt);
    this.buildScatter(palette, rand, groundHeightAt);
    this.coalMaterial = this.buildCoals(rand);
    this.buildLaidFire(rand);
    this.buildFlame();
    this.buildCamp(rand, groundHeightAt, fireY);
    this.seatSurfaceY =
      groundHeightAt(this.layout.seat.x, this.layout.seat.z) + SITTING_SEAT_HEIGHT_M;
    this.buildSeatLog(rand, groundHeightAt);

    this.light = new PointLight(LIGHT_BLAZE.getHex(), 0, 16, 1.7);
    this.light.castShadow = false;
    // Above the coals rather than in them: a light at ground level rakes
    // everything from underneath and turns friendly faces into ghost stories.
    this.light.position.set(0, 0.55, 0);
    this.fireGroup.add(this.light);

    this.glowMaterial = this.buildGlow(rand, groundHeightAt, fireY);

    // The particle shader positions each mote from a world-space uniform and
    // never reads the model matrix, so this parenting is for lifetime and
    // visibility only — the field's actual position is set in `update`.
    this.emberField = new ParticleField(embers(Math.max(8, Math.round(26 * particleDensity))), seed);
    this.fireGroup.add(this.emberField.mesh);

    this.applyBurn(0);
  }

  /**
   * Where the bard should sit, in the camp's own frame, and which way to face.
   *
   * `y` is the top of the seat log, not the ground: the sitting pose is built
   * around its origin being the seat surface (see `SITTING_SEAT_HEIGHT_M`),
   * so a caller that stands the bard here gets him sitting on the log rather
   * than standing through it. It also follows the terrain, which the old
   * flat zero did not — a camp on a slope had the bard at the road's height
   * and the fire at its own.
   */
  get seat(): { x: number; y: number; z: number; heading: number } {
    const { seat } = this.layout;
    return { x: seat.x, y: this.seatSurfaceY, z: seat.z, heading: seat.heading };
  }

  /** 0 leaves glowing coals, 1 is a full blaze. Faded, never cut. */
  setBurn(amount: number): void {
    this.burnTarget = Math.min(1, Math.max(0, amount));
  }

  update(dt: number, elapsed: number): void {
    // A fire banks down over seconds, never between two frames. Exponential
    // rather than a fixed step per frame so the fade takes the same wall
    // time on a 60 Hz phone and a 120 Hz tablet.
    this.burn = this.burnTarget + (this.burn - this.burnTarget) * Math.exp(-dt / 2.5);

    let bulk = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const amplitude = SEGMENT_AMPLITUDE[i];
      const frequency = SEGMENT_FREQ[i];
      const stretch = wobble(elapsed, frequency, i * 0.7);
      const turn = wobble(elapsed, frequency * 0.61, i * 2.1 + 1.3);
      const lean = wobble(elapsed, frequency * 1.37, i * 4.3 + 0.4);

      // Taller means thinner. Scaling one axis alone makes the flame pump
      // like a bellows; trading height against width reads as a tongue of
      // fire being drawn upward, which is what is actually happening.
      const sy = 1 + stretch * 0.2 * amplitude;
      const sxz = 1 - stretch * 0.12 * amplitude;
      const segment = this.segments[i];
      segment.scale.set(sxz, sy, sxz);
      segment.rotation.y = turn * 0.42 * amplitude;
      segment.rotation.z = lean * 0.1 * amplitude;
      segment.rotation.x = turn * 0.07 * amplitude;
      bulk += sy;
    }
    bulk /= this.segments.length || 1;

    // Sympathy, not identity. The light follows the flame's *bulk* through a
    // short lag, because a fire lights a clearing with its whole body and the
    // body settles slower than the tips do. On top of that goes a sparkle at
    // a frequency none of the segments use, so the light and the geometry can
    // never lock together. Driving the light straight off the same numbers as
    // the geometry was the first attempt and it reads as a lamp on a dimmer
    // wired to the animation, which is a stranger effect than no flicker.
    this.lit += (bulk - this.lit) * (1 - Math.exp(-dt / 0.11));
    const sparkle = wobble(elapsed, 5.9, 2.6);

    this.applyBurn(sparkle);

    this.emberField.mesh.getWorldPosition(this.emberOrigin);
    // Embers rise out of a fire far more than they blow sideways, so they
    // take a fraction of the wind the grass and the cloak are getting.
    this.emberField.update(
      this.emberOrigin,
      elapsed,
      this.globals.uWindDirection.value,
      this.globals.uWindStrength.value * 0.3,
    );
  }

  /**
   * Push the current burn and flicker into everything that reads them.
   *
   * Split out because the constructor needs it too. The light is built at
   * zero intensity and the pool at zero strength, so without a pass here
   * the camp's first rendered frame would be unlit and the second one would
   * not be — a flash, on arrival, at the one moment in the day the game is
   * asking the player to settle.
   */
  private applyBurn(sparkle: number): void {
    const burn = this.burn;
    // Squared, so the last of the flame goes quickly and the coals linger.
    // A linear fade leaves a stubby half-height flame sitting there for
    // seconds, which reads as a bug rather than as a fire going out.
    const flame = burn * burn;

    this.flameGroup.scale.set(0.42 + flame * 0.58, 0.18 + flame * 0.82, 0.42 + flame * 0.58);
    this.flameGroup.visible = flame > 0.01;
    // The tip is the first thing to go and the last to come back.
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].visible = flame > i * 0.17;
    }

    const pulse = 0.86 + (this.lit - 1) * 0.55 + sparkle * 0.07;

    this.light.intensity = (1.6 + flame * 13) * pulse;
    this.lightColor.copy(LIGHT_EMBER).lerp(LIGHT_BLAZE, flame);
    this.light.color.copy(this.lightColor);

    // The same fire, told to the painterly shader.
    //
    // The PointLight above only reaches three's own materials, and nothing
    // in this world uses one — so before this the bard sat at his own fire
    // as a near-black mass, in the single frame DESIGN.md says is allowed to
    // be genuinely warm. The shader's hearth term is a shared global, and
    // driving it from here rather than from the road stage keeps the fire's
    // light and the fire's flicker as one number: they cannot drift apart,
    // and there is no second lighting model.
    const hearth = this.globals.uHearthPosition.value;
    this.group.getWorldPosition(hearth);
    hearth.y += 0.35;
    this.globals.uHearthColor.value.copy(this.lightColor);
    this.globals.uHearthRadius.value = HEARTH_RADIUS_M;
    this.globals.uHearthStrength.value = (0.25 + flame * 1.15) * pulse * HEARTH_GAIN;

    // The pool is a shade more responsive than the light, because it is the
    // part anyone actually sees move.
    //
    // Cut from (0.3 + 0.7·flame), and the cut is what lets the ramp read.
    // Measured on `07-night-campfire` with the shader's hearth term switched
    // off, the pool alone was pinning the red channel at 255 across roughly a
    // metre and a half of ground either side of the coals — and a clipped
    // channel has no hue, so the brightest, most-looked-at part of the pool
    // was the part with the least colour in it. The spike in the falloff
    // above gives the coals their heat back over a much smaller area.
    this.glowMaterial.uniforms.uStrength.value =
      (0.22 + flame * 0.5) * (0.82 + (this.lit - 1) * 0.7 + sparkle * 0.06);
    this.glowMaterial.uniforms.uColor.value.copy(this.lightColor);

    // Coals are brightest when the flame is low — that is when you can see
    // them at all — so their emissive runs opposite to it, not with it.
    this.coalMaterial.uniforms.uEmissiveStrength.value =
      (0.34 + (1 - flame) * 0.26) * (0.9 + sparkle * 0.12);

    this.emberField.setOpacity(0.25 + flame * 0.75);
  }

  // --- construction ------------------------------------------------------

  private track<T extends ShaderMaterial>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private keep(geometry: BufferGeometry): BufferGeometry {
    this.geometries.push(geometry);
    return geometry;
  }

  /** The house material, with the camp's defaults already applied. */
  private solid(options: PainterlyOptions): ShaderMaterial {
    return this.track(
      createPainterlyMaterial(this.globals, {
        grain: 0.35,
        grainScale: 1.6,
        rim: 0.4,
        rimPower: 2.2,
        bandSoftness: 0.09,
        flatShading: true,
        shadowDepth: 0.42,
        ...options,
      }),
    );
  }

  private buildRing(
    palette: BiomePalette,
    rand: Rand,
    groundHeightAt: (x: number, z: number) => number,
  ): void {
    const stones = this.layout.props.filter((p) => p.kind === 'stone');
    // Built here rather than taken from the shared geometry cache: this
    // object disposes what it owns, and disposing a cached geometry would
    // pull the ground out from under every rock in the world.
    const geometry = this.keep(rockGeometry(Math.floor(rand() * 0xffff) + 1));

    const mesh = new InstancedMesh(
      geometry,
      this.solid({
        color: palette.rock,
        colorVariant: 0xcbbba4,
        rim: 0.3,
        baseShade: 0.25,
        baseShadeHeight: 0.4,
      }),
      stones.length,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'campfire-ring';
    this.instanced.push(mesh);

    const dummy = new Object3D();
    const tint = new Color();
    const soot = new Color(0x6d6257);
    for (let i = 0; i < stones.length; i++) {
      const stone = stones[i];
      // Sunk a little, because a ring stone was set into the ground by
      // hand and one resting exactly on the surface reads as dropped.
      dummy.position.set(
        stone.x,
        groundHeightAt(stone.x, stone.z) - stone.scale * 0.12,
        stone.z,
      );
      dummy.rotation.set(randRange(rand, -0.16, 0.16), stone.rotation, randRange(rand, -0.16, 0.16));
      dummy.scale.set(stone.scale, stone.scale * randRange(rand, 0.62, 0.86), stone.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Fire-blackened on the inside faces of the ring is a detail nobody
      // will name and everybody will feel; approximated by darkening a
      // random share of the stones rather than by a per-face mask.
      tint.setScalar(1).lerp(soot, rand() * 0.45);
      mesh.setColorAt(i, tint);
    }
    this.group.add(mesh);
  }

  /**
   * The stones scattered through the firelight, as opposed to the ring.
   *
   * `campfireLayout`'s note on the scatter explains why these exist at all;
   * this is what they have to *be* to do that job. Flat and half-buried, not
   * cobbles: the point is a lit face and a small cast shadow on ground that
   * otherwise has neither, and a rounded stone standing proud of the grass
   * would read as a second, badly-built ring. Each one is squashed to
   * between a fifth and a half of its width in height and sunk a third of
   * the way in, so what shows is a plate tilted a few degrees out of the
   * ground — which is what a stone in a worn verge actually looks like.
   *
   * They take the biome's own rock colour like the ring does, darkened a
   * little: these sit *outside* the ring in the part of the pool where the
   * light has gone deep orange and red, so a stone drawn at the ring's value
   * out here would pop out of the ramp as a bright fleck.
   */
  private buildScatter(
    palette: BiomePalette,
    rand: Rand,
    groundHeightAt: (x: number, z: number) => number,
  ): void {
    const pebbles = this.layout.props.filter((p) => p.kind === 'pebble');
    if (pebbles.length === 0) return;
    const geometry = this.keep(rockGeometry(Math.floor(rand() * 0xffff) + 1));

    const mesh = new InstancedMesh(
      geometry,
      this.solid({
        color: palette.rock,
        colorVariant: 0x9c8d78,
        rim: 0.22,
        grain: 0.45,
        grainScale: 2.4,
        baseShade: 0.3,
        baseShadeHeight: 0.2,
      }),
      pebbles.length,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'campfire-scatter';
    this.instanced.push(mesh);

    const dummy = new Object3D();
    const tint = new Color();
    const earth = new Color(0x6a5b4a);
    for (let i = 0; i < pebbles.length; i++) {
      const pebble = pebbles[i];
      const flat = randRange(rand, 0.2, 0.5);
      dummy.position.set(
        pebble.x,
        groundHeightAt(pebble.x, pebble.z) - pebble.scale * flat * 0.34,
        pebble.z,
      );
      // A few degrees of tilt, so no two catch the fire at the same angle
      // and the scatter has a range of values rather than one.
      dummy.rotation.set(
        randRange(rand, -0.3, 0.3),
        pebble.rotation,
        randRange(rand, -0.3, 0.3),
      );
      dummy.scale.set(pebble.scale, pebble.scale * flat, pebble.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.setScalar(1).lerp(earth, randRange(rand, 0.1, 0.55));
      mesh.setColorAt(i, tint);
    }
    this.group.add(mesh);
  }

  private buildCoals(rand: Rand): ShaderMaterial {
    // A squashed rock is exactly the right shape for a bed of ash and
    // embers, and it comes with the same flat facets everything else has.
    const geometry = this.keep(rockGeometry(Math.floor(rand() * 0xffff) + 1));
    const material = this.solid({
      color: COAL_COLOR,
      colorVariant: 0x7a4a30,
      emissive: COAL_EMISSIVE,
      emissiveStrength: 0.34,
      rim: 0.2,
      grain: 0.6,
      grainScale: 3.2,
    });
    const mesh = new Mesh(geometry, material);
    mesh.scale.set(this.layout.ringRadius * 0.8, 0.14, this.layout.ringRadius * 0.8);
    mesh.position.y = -0.02;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.fireGroup.add(mesh);
    return material;
  }

  private buildLaidFire(rand: Rand): void {
    const { logs } = this.layout;
    const geometry = this.keep(stickGeometry(1, 0.5, 0.42, 5, rand));
    const mesh = new InstancedMesh(
      geometry,
      this.solid({ color: WOOD_COLOR, colorVariant: WOOD_CHAR, grain: 0.55, rim: 0.28 }),
      logs.length,
    );
    mesh.castShadow = true;
    mesh.name = 'campfire-logs';
    this.instanced.push(mesh);

    const dummy = new Object3D();
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      // The stick geometry runs from its origin along +Y rather than
      // straddling it, so a log left at its own point lies entirely to one
      // side of the fire. Backing it off by half its horizontal run is what
      // makes the sticks cross over the coals, and it is also the geometry
      // `layoutViolations` assumes when it checks a log against the ring —
      // placed the other way the check measures half the stick it draws.
      const half = (log.length / 2) * Math.cos(log.tilt);
      dummy.position.set(
        log.dx - Math.sin(log.rotation) * half,
        0.06 + i * 0.035,
        log.dz - Math.cos(log.rotation) * half,
      );
      // Laying the stick down is a quarter turn about X, and the tilt is
      // what stops the pile being a flat mat. The order has to be YXZ and
      // not the default XYZ: with X outermost the yaw turns the stick about
      // its own length and never moves the length itself, so every log in
      // the fire comes out pointing the same way.
      dummy.rotation.set(Math.PI / 2 - log.tilt, log.rotation, 0, 'YXZ');
      dummy.scale.set(log.radius * 2, log.length, log.radius * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    this.fireGroup.add(mesh);
  }

  private buildFlame(): void {
    this.fireGroup.add(this.flameGroup);
    for (let i = 0; i < FLAME_STEPS.length; i++) {
      const step = FLAME_STEPS[i];
      const material = this.solid({
        color: step.color,
        colorVariant: step.color,
        grain: 0.25,
        grainScale: 4.5,
        emissive: step.emissive,
        emissiveStrength: step.strength,
        // A fire lights itself. A sky rim on a flame reads as a plastic
        // shell around it, so the fresnel is nearly off and the bands are
        // soft enough that the shading never fights the emissive.
        rim: 0.12,
        bandSoftness: 0.3,
      });
      const geometry = this.keep(
        flameGeometry(SEGMENT_RADIUS[i], SEGMENT_HEIGHT[i], 5, i * 0.4),
      );
      const mesh = new Mesh(geometry, material);
      mesh.position.y = SEGMENT_BASE_Y[i];
      // A flame casts light, not shadow.
      mesh.castShadow = false;
      this.flameGroup.add(mesh);
      this.segments.push(mesh);
    }
  }

  private buildCamp(
    rand: Rand,
    groundHeightAt: (x: number, z: number) => number,
    fireY: number,
  ): void {
    const placeProp = (prop: PropPlacement, object: Object3D) => {
      object.position.set(prop.x, groundHeightAt(prop.x, prop.z), prop.z);
      object.rotation.y = prop.rotation;
      object.scale.setScalar(prop.scale);
      this.group.add(object);
    };

    for (const prop of this.layout.props) {
      switch (prop.kind) {
        case 'bedroll':
          placeProp(prop, this.buildBedroll());
          break;
        case 'pack':
          placeProp(prop, this.buildPack());
          break;
        case 'instrument':
          placeProp(prop, this.buildInstrument(prop, fireY, groundHeightAt));
          break;
        case 'lantern':
          placeProp(prop, this.buildLantern(rand, prop, groundHeightAt));
          break;
        case 'firewood':
          placeProp(prop, this.buildFirewood(rand));
          break;
        default:
          break;
      }
    }
  }

  /**
   * The log the bard sits on.
   *
   * Somebody dragged this here, which is the whole reason it is worth its
   * triangles: a bard sitting on bare ground reads as a bard who has fallen
   * over, and the first thing anyone does at a camp is find something to sit
   * on. It lies *across* the line to the fire so he sits astride it facing
   * the flame, and it is sunk a couple of centimetres into the grass — a log
   * resting exactly on a surface reads as dropped, the same note the ring
   * stones are set for.
   *
   * Its height is not a matter of taste. `SITTING_SEAT_HEIGHT_M` is how far
   * the seated pose's boots reach below his origin, so the top of this log
   * has to be exactly that, or the bard is perched above it or shin-deep in
   * it. Length comes from the layout, which owns how much ground the seat is
   * allowed.
   */
  private buildSeatLog(rand: Rand, groundHeightAt: (x: number, z: number) => number): void {
    const { seat } = this.layout;
    const group = new Group();
    group.name = 'campfire-seat-log';
    const groundY = groundHeightAt(seat.x, seat.z);
    group.position.set(seat.x, groundY, seat.z);
    group.rotation.y = seat.heading + Math.PI / 2;
    this.group.add(group);

    const sink = 0.03;
    const radius = (SITTING_SEAT_HEIGHT_M + sink) / 2;
    const log = new Mesh(
      this.keep(stickGeometry(1, 0.5, 0.44, 7, rand)),
      this.solid({
        color: WOOD_COLOR,
        colorVariant: 0x8a6b48,
        grain: 0.5,
        grainScale: 1.4,
        rim: 0.3,
        baseShade: 0.2,
        baseShadeHeight: 0.5,
      }),
    );
    log.castShadow = true;
    log.receiveShadow = true;
    // Laid along the group's +Z the same way the fire's sticks are, and
    // backed off half its length so the seat is its middle rather than one
    // end — the layout's footprint is a disc about that middle.
    log.rotation.set(Math.PI / 2, 0, 0, 'YXZ');
    log.position.set(0, radius - sink, -SEAT_LOG_LENGTH_M / 2);
    log.scale.set(radius * 2, SEAT_LOG_LENGTH_M, radius * 2);
    group.add(log);

    // One stub of a branch left on, at the end away from the fire. It is the
    // difference between a log and a cylinder, and it costs nothing.
    const stub = new Mesh(
      this.keep(stickGeometry(0.22, 0.05, 0.035, 5, rand)),
      this.solid({ color: WOOD_CHAR, colorVariant: WOOD_COLOR, grain: 0.6, rim: 0.3 }),
    );
    stub.position.set(0, radius - sink, SEAT_LOG_LENGTH_M / 2 - 0.08);
    stub.rotation.set(0.9, 0.6, 0, 'YXZ');
    stub.castShadow = true;
    group.add(stub);
  }

  /**
   * The bedroll: a bed made up on the ground, not a sack.
   *
   * What was here before was a long low mound with a flat red box sitting on
   * top of it, and from the resting camera that draws a table with a cloth on
   * it — which is exactly what the critique named it. Two things were wrong
   * and neither was the mound. The blanket was a *box*, so it had a hard
   * horizontal top edge and four vertical corners, which is furniture; and
   * the bed had no head, so nothing said which way a person lies in it.
   *
   * So: the roll is taller and narrower (a mat is a mat, bedding is bedding),
   * the blanket is now a soft mound of its own that is *wider* than the roll
   * and so hangs over its sides, and there is a bunched pillow at the far end.
   * A long shape with a lump at one end and a cover over the other is read as
   * a bed by anyone who has ever seen one, at any distance where the outline
   * survives at all.
   */
  private buildBedroll(): Object3D {
    const group = new Group();
    group.name = 'campfire-bedroll';

    // Sunk, like the ring stones and the seat log. `bedrollGeometry` closes
    // flat at y = 0 and the prop is seated on a *single* ground sample, so on
    // the roadside crown a metre and a half of bedding stands off the grass
    // at one end and hovers. Shot at the resting camera it read as furniture
    // on legs, which is half of why the critique called it a table.
    const sink = -0.035;

    const roll = new Mesh(
      // Taller and narrower than the mat it was. Seen from a camera three
      // metres up, a flat shape shows the viewer nothing but its top face,
      // and a top face lit by a low fire is lit by the *sky* — which is
      // exactly how the bedding came back mauve in a warm frame. Height is
      // what turns a plan view into a form.
      this.keep(bedrollGeometry(1.4, 0.46, 0.31)),
      // A stronger rim than the rest of the camp carries, and it is not
      // decoration. The bedroll's slot puts its fire-facing flank away from
      // the resting camera, so the side anybody sees is the shaded one, and
      // it sits in knee-high grass that is the same value as its shadow. The
      // fresnel edge is the only thing that draws a line between the two.
      this.solid({ color: CANVAS_COLOR, colorVariant: 0xbda882, rim: 0.62, grain: 0.5 }),
    );
    roll.position.y = sink;
    roll.castShadow = true;
    roll.receiveShadow = true;
    group.add(roll);

    // The pillow, across the head end rather than along it — which is how a
    // pillow lies, and the crossways axis is what makes it read as a
    // *different* thing from the roll it sits on rather than as another
    // section of the same sausage.
    // `bedrollGeometry` runs its *length* along local Z, so a pillow lying
    // across the bed is a long one turned a quarter turn — not a short one,
    // which is what the first attempt built and which came out as one more
    // section of the same sausage.
    //
    // It is also the lightest thing in the camp on purpose. The bed is read
    // by its ends: a pale lump at the head against a dark cover at the foot
    // is a bed at any size where either survives, and two masses of the same
    // value in a row are a log.
    const pillow = new Mesh(
      this.keep(bedrollGeometry(0.46, 0.3, 0.19)),
      this.solid({ color: 0xa8957a, colorVariant: 0xe0cfae, rim: 0.7, grain: 0.55 }),
    );
    pillow.position.set(0, 0.15 + sink, -0.45);
    pillow.rotation.y = Math.PI / 2 + 0.12;
    pillow.castShadow = true;
    group.add(pillow);

    // The blanket, over the foot two thirds. Wider than the roll on purpose:
    // the overhang is what makes it a cover thrown over something rather than
    // a lid resting on it, and the long run of it is what stops the bed
    // reading as three separate lumps in a row.
    const blanket = new Mesh(
      this.keep(bedrollGeometry(0.98, 0.52, 0.22)),
      this.solid({ color: BLANKET_COLOR, colorVariant: 0xd0996a, rim: 0.6, grain: 0.45 }),
    );
    // Lifted so its crown clears the roll's rather than sitting level with
    // it. Two soft mounds of the same height, overlapping, merge into one
    // lumpy mass with a colour change across the middle — which is what the
    // bed came back as. A cover has to be *on* the thing it covers.
    blanket.position.set(0, 0.135 + sink, 0.3);
    blanket.rotation.y = -0.06;
    blanket.castShadow = true;
    group.add(blanket);

    return group;
  }

  private buildPack(): Object3D {
    const group = new Group();
    group.name = 'campfire-pack';
    // The tilt lives on an inner node so the yaw the layout hands out stays a
    // clean turn about the world's up axis. Setting both on one Euler makes
    // the lean swing round with the yaw, which is how props end up leaning
    // uphill on one side of the road and downhill on the other.
    const lean = new Group();
    // Propped, not stood. Nothing in a camp is square to the world, and a
    // pack that stands perfectly upright reads as furniture in a showroom.
    lean.rotation.x = -0.22;
    group.add(lean);

    const leather = this.solid({ color: LEATHER_COLOR, colorVariant: 0x8f6c48, rim: 0.42 });
    const strapping = this.solid({ color: STRAP_COLOR, colorVariant: 0x7a5c40, rim: 0.35 });

    // Two stacked tapers rather than one box: the lower one widens and the
    // upper one narrows, so the pack has a belly. This is the whole reason
    // it stopped reading as a crate. A single tapered box seen at two metres
    // in firelight is four flat planes and a lid, and no amount of strapping
    // on the front of it changes what the outline says.
    const belly = new Mesh(this.keep(taperedBox(0.34, 0.2, 0.27, 1.18, 1.14)), leather);
    belly.castShadow = true;
    belly.receiveShadow = true;
    lean.add(belly);

    const body = new Mesh(this.keep(taperedBox(0.4, 0.34, 0.31, 0.72, 0.8)), leather);
    body.position.y = 0.2;
    body.castShadow = true;
    body.receiveShadow = true;
    lean.add(body);

    /*
     * The top of the pack, and the two failures it has to avoid.
     *
     * At night, two metres away, this prop is a dark mass against bright
     * firelit ground: nothing inside its outline survives, so its *outline*
     * is the whole of what it says. Two outlines have been tried and both
     * were named something else by a critic.
     *
     * A box that narrows and then finishes in a broad flat lid with an
     * overhang is a **mailbox** — that was the first one, and no amount of
     * strapping on the front argues with it. Replacing the lid with a wide
     * bedding roll laid across the top made it a **cauldron**: same overhang,
     * rounder. What both share is a horizontal thing wider than the body
     * sitting on top of the body.
     *
     * So nothing up here is allowed to be wider than the belly. A narrow
     * cinched collar, a soft bunched mouth *inside* that width, the bedding
     * roll short enough to sit within it, and — the one piece doing real
     * work — a **carry loop** arching over the top. A closed loop with
     * daylight through it is the single most nameable thing a pack has in
     * silhouette, and it is the only mark here that cannot be read as a lid.
     */
    const collar = new Mesh(this.keep(taperedBox(0.29, 0.07, 0.24, 0.78, 0.8)), strapping);
    collar.position.y = 0.5;
    collar.castShadow = true;
    lean.add(collar);

    const mouth = new Mesh(this.keep(bedrollGeometry(0.19, 0.23, 0.1)), leather);
    mouth.position.set(0, 0.56, 0);
    mouth.castShadow = true;
    lean.add(mouth);

    // The bedding roll lashed on. Cloth against leather, round against
    // square — kept narrower than the body, and set back so it reads as
    // strapped to the pack rather than balanced on it.
    const roll = new Mesh(
      this.keep(bedrollGeometry(0.3, 0.15, 0.075)),
      this.solid({ color: BLANKET_COLOR, colorVariant: 0xd0996a, rim: 0.5, grain: 0.5 }),
    );
    roll.position.set(0, 0.6, -0.06);
    roll.rotation.y = Math.PI / 2;
    roll.castShadow = true;
    lean.add(roll);

    // The carry loop: two short uprights and a bar across them.
    const loopPost = this.keep(taperedBox(0.032, 0.11, 0.03, 0.9, 1));
    for (const sx of [-0.075, 0.075] as const) {
      const post = new Mesh(loopPost, strapping);
      post.position.set(sx, 0.55, 0.045);
      post.rotation.z = sx > 0 ? -0.22 : 0.22;
      post.castShadow = true;
      lean.add(post);
    }
    const bar = new Mesh(this.keep(taperedBox(0.14, 0.03, 0.035, 1, 1)), strapping);
    bar.position.set(0, 0.655, 0.045);
    bar.castShadow = true;
    lean.add(bar);

    // Two straps down the front, not one down the side, each finishing in a
    // buckle at the belly.
    for (const sx of [-0.1, 0.11] as const) {
      const strap = new Mesh(this.keep(taperedBox(0.055, 0.42, 0.05, 1, 1)), strapping);
      strap.position.set(sx, 0.13, 0.15);
      strap.rotation.z = sx > 0 ? 0.09 : -0.07;
      lean.add(strap);
      const over = new Mesh(this.keep(taperedBox(0.05, 0.15, 0.045, 1, 1)), strapping);
      over.position.set(sx, 0.52, 0.075);
      over.rotation.x = 1.0;
      lean.add(over);
    }

    // The shoulder straps, arcing off the back.
    //
    // A pack with nothing to carry it by is luggage; a pack with two loops
    // over its back is a thing a person wears. The gap between strap and body
    // is what survives at four metres, because it puts firelit ground
    // *inside* the silhouette where a box has none.
    //
    // Two segments each, not three: the third ran down past the base of the
    // pack and, seen from the resting camera, the pair of them stuck out
    // below it as two dark feet — which turned the whole prop into a small
    // standing animal. A shoulder strap that disappears into the bottom of
    // the bag is right anyway; that is where they are sewn on.
    const backZ = -0.17;
    for (const sx of [-0.1, 0.1] as const) {
      const upper = new Mesh(this.keep(taperedBox(0.05, 0.22, 0.032, 0.9, 1)), strapping);
      upper.position.set(sx, 0.4, backZ);
      upper.rotation.set(-0.66, 0, sx > 0 ? 0.1 : -0.1);
      upper.castShadow = true;
      lean.add(upper);

      const bow = new Mesh(this.keep(taperedBox(0.048, 0.26, 0.03, 0.85, 1)), strapping);
      bow.position.set(sx * 1.1, 0.2, backZ - 0.11);
      bow.rotation.set(0.42, 0, sx > 0 ? 0.06 : -0.06);
      bow.castShadow = true;
      lean.add(bow);
    }

    return group;
  }

  private buildInstrument(
    prop: PropPlacement,
    fireY: number,
    groundHeightAt: (x: number, z: number) => number,
  ): Object3D {
    const group = new Group();
    group.name = 'campfire-instrument';
    const lean = new Group();
    group.add(lean);

    const body = new Mesh(
      this.keep(luteGeometry()),
      this.solid({ color: INSTRUMENT_COLOR, colorVariant: INSTRUMENT_ACCENT, rim: 0.6 }),
    );
    body.castShadow = true;
    lean.add(body);

    // Leaned toward the ring. The layout already put the base outside the
    // stones and pointed the yaw at the fire, so the tilt is all that is
    // left — and it is what makes this read as "put down carefully" rather
    // than "dropped".
    //
    // Note what the angle is *not*: the gap below is `prop.radius` minus the
    // ring, and the layout builds that radius as the ring plus a draw, so
    // the subtraction gives back the draw and the ring cancels out. The only
    // live term is the ground drop. It is left this way because the numbers
    // it produces are the ones the camp was composed around, but it is not
    // the ring-following behaviour it looks like, and the instrument is a
    // clear 0.72-0.82 m from the stones — stood beside the fire, not propped
    // on it. That draw came in from 0.85-0.95 when the slot moved off the
    // camera's line to the bard (see `INSTRUMENT` in `campfireLayout`), which
    // stands this a few degrees more upright than it was: `atan2(0.77, 0.85)`
    // rather than `atan2(0.90, 0.85)`, 42 degrees off vertical rather than
    // 47, and still well inside the clamp below.
    const reach = prop.radius - this.layout.ringRadius;
    const drop = groundHeightAt(prop.x, prop.z) - fireY;
    lean.rotation.x = Math.min(1.0, Math.max(0.5, Math.atan2(reach, 0.85 + drop)));

    return group;
  }

  /**
   * The camp lantern: a staff driven into the ground, a hook, and a lantern
   * hanging off it.
   *
   * The version before this one was a bare post with a bright cube stuck to
   * the side of a slightly larger dark cube. At night the glass was the only
   * part that carried, so what the frame actually showed was a small glowing
   * quad floating beside a stick — a stray primitive in the one picture the
   * whole day is walking toward.
   *
   * What fixes that is not more brightness, it is a housing. The glass is
   * now narrower than both the cap above it and the base below it, so the
   * lit part is framed by dark metal on every side and reads as a light
   * *inside* something. The cap is a real little roof with a peak, which is
   * the silhouette that says lantern at a distance where none of the rest
   * survives. And it hangs from a hook by a bail, because a lantern balanced
   * on top of a pole is a streetlamp.
   *
   * The staff is shorter than it was, and the lantern hangs low on it. At
   * 1.24 m with the light at the very top it was a spire standing over a
   * camp whose next tallest thing is knee-high, and the eye went to it
   * instead of to the fire.
   */
  private buildLantern(
    rand: Rand,
    prop: PropPlacement,
    groundHeightAt: (x: number, z: number) => number,
  ): Object3D {
    const group = new Group();
    group.name = 'campfire-lantern';
    const lean = new Group();
    // Driven into the ground at an angle so the lantern hangs clear of it.
    lean.rotation.x = 0.24;
    group.add(lean);

    const metal = this.solid({
      color: LANTERN_METAL,
      colorVariant: 0x6d6053,
      rim: 0.5,
      grain: 0.3,
    });

    const staffHeight = 0.88;
    const staff = new Mesh(
      this.keep(stickGeometry(staffHeight, 0.032, 0.024, 5, rand)),
      this.solid({ color: WOOD_COLOR, colorVariant: 0x8a6b48, rim: 0.35 }),
    );
    staff.castShadow = true;
    lean.add(staff);

    // The hook: a short arm off the top of the staff and a lip turned down
    // at its end. Two thin boxes, and between them they are the reason the
    // lantern is where it is instead of simply being there.
    const arm = new Mesh(this.keep(taperedBox(0.034, 0.125, 0.03, 1, 1)), metal);
    arm.position.set(0, staffHeight - 0.035, 0.006);
    arm.rotation.x = Math.PI / 2;
    arm.castShadow = true;
    lean.add(arm);

    const hook = new Mesh(this.keep(taperedBox(0.028, 0.062, 0.028, 1, 1)), metal);
    hook.position.set(0, staffHeight - 0.077, 0.112);
    hook.castShadow = true;
    lean.add(hook);

    // Everything below hangs off the hook, in its own group, so the lantern
    // can be positioned as one object rather than four coincidences.
    const lamp = new Group();
    lamp.position.set(0, staffHeight - 0.077, 0.112);
    lean.add(lamp);

    const bail = new Mesh(this.keep(taperedBox(0.075, 0.055, 0.016, 0.5, 1)), metal);
    bail.position.y = -0.055;
    lamp.add(bail);

    // A roof, not a lid: it comes to a narrow ridge and overhangs the glass,
    // and the overhang is what puts a dark edge along the top of the lit
    // part instead of letting it run out into the sky.
    const cap = new Mesh(this.keep(taperedBox(0.152, 0.096, 0.152, 0.2, 0.2)), metal);
    cap.position.y = -0.151;
    cap.castShadow = true;
    lamp.add(cap);

    const base = new Mesh(this.keep(taperedBox(0.13, 0.042, 0.13, 0.86, 0.86)), metal);
    base.position.y = -0.27;
    base.castShadow = true;
    lamp.add(base);

    // The glass carries no light of its own — one point light is the budget,
    // and a lantern that lit the camp would compete with the fire for the
    // thing the fire is here to do. What it has instead is the emissive
    // term, kept low: the failure this replaces was a pane blown out to flat
    // yellow with no shading left on it. Framed by metal it can afford a
    // little more than the 0.32 it was cut to, because the frame is now
    // doing the work that dimming it was doing before.
    const glass = new Mesh(
      this.keep(taperedBox(0.096, 0.105, 0.096, 1, 1)),
      this.solid({
        color: LANTERN_GLASS,
        colorVariant: 0xffe0a8,
        emissive: 0xffb347,
        emissiveStrength: 0.4,
        rim: 0.1,
        grain: 0.15,
      }),
    );
    glass.position.y = -0.228;
    lamp.add(glass);

    // Two uprights at the corners nearest the camera-ish side, so the glass
    // is broken by something vertical rather than reading as one lit slab.
    const postGeo = this.keep(taperedBox(0.016, 0.105, 0.016, 1, 1));
    for (const sx of [-1, 1] as const) {
      const upright = new Mesh(postGeo, metal);
      upright.position.set(sx * 0.052, -0.228, 0.052);
      lamp.add(upright);
      const back = new Mesh(postGeo, metal);
      back.position.set(sx * 0.052, -0.228, -0.052);
      lamp.add(back);
    }

    // The ground under it.
    //
    // The housing above fixed the lantern's *shape*; this is about what it
    // is for. A lamp that lights nothing is a decal, and every frame of the
    // camp showed one: the glass carried an emissive term and the metre of
    // ground beneath it was the same value as the ground four metres away,
    // so the eye read a bright rectangle stuck to a stick rather than a lamp
    // burning. Measured on `07-night-campfire`, the ground at the staff's
    // foot came back within a luminance point of open ground outside the
    // camp entirely.
    //
    // This is the fire's own pool, small: the same additive disc with the
    // same squared-and-eased falloff, at a fifth of `POOL_RADIUS_M` and
    // about a third of the strength the fire's runs at. Note what it is
    // *not* — it is not a second light. There is one point light in this
    // scene and the comment on the glass above explains why it stays that
    // way; a pool is a painted mark on the ground, it costs one draw, and it
    // cannot compete with the fire because it does not reach anything the
    // fire is lighting.
    //
    // What it buys, measured on `07-night-campfire`: the ground at the
    // staff's foot goes from luminance 49.6 to 77.8 and the ground a metre
    // out from 52.5 to 61.8, while a control patch four metres away is
    // unchanged at 39.9 -> 39.4. So the lift is local to the lamp, which is
    // the whole claim.
    //
    // Held at a constant strength rather than flickering. A candle inside
    // glass is the steadiest flame at a camp, and a second pool pulsing on
    // the fire's rhythm would say the two are the same source.
    const poolRadius = 0.95;
    const poolSegments = 18;
    const poolRings = 4;
    const positions: number[] = [];
    const falloffs: number[] = [];
    const rimScale: number[] = [];
    for (let s = 0; s < poolSegments; s++) rimScale.push(randRange(rand, 0.84, 1.08));
    // Draped over the terrain, exactly as the fire's pool is, and for a
    // reason worth writing down: the first version of this was flat and
    // almost all of it was underground. Measured, a flat disc lifted 3 cm
    // showed a 40-pixel contact spot at the staff's foot where the geometry
    // predicts about 250 — the camp is on a roadside verge with a few
    // centimetres of crown across a metre, which is more than enough to bury
    // a disc that does not follow it. The prop group carries the lantern's
    // own yaw and scale, so the sample has to be taken at the *world* point
    // each vertex lands on and brought back through both.
    const groundY = groundHeightAt(prop.x, prop.z);
    const cos = Math.cos(prop.rotation);
    const sin = Math.sin(prop.rotation);
    const scale = Math.max(0.01, prop.scale);
    const vertex = (ring: number, segment: number) => {
      const s = ((segment % poolSegments) + poolSegments) % poolSegments;
      const angle = (s / poolSegments) * Math.PI * 2;
      const t = ring / poolRings;
      const radius = t * poolRadius * rimScale[s];
      const dx = Math.sin(angle) * radius;
      const dz = Math.cos(angle) * radius;
      const wx = prop.x + scale * (dx * cos + dz * sin);
      const wz = prop.z + scale * (-dx * sin + dz * cos);
      positions.push(dx, (groundHeightAt(wx, wz) - groundY) / scale + 0.035, dz);
      const falloff = 1 - t;
      falloffs.push(falloff * falloff * (3 - 2 * falloff) * falloff);
    };
    for (let ring = 0; ring < poolRings; ring++) {
      for (let s = 0; s < poolSegments; s++) {
        vertex(ring, s);
        vertex(ring + 1, s);
        vertex(ring + 1, s + 1);
        vertex(ring, s);
        vertex(ring + 1, s + 1);
        vertex(ring, s + 1);
      }
    }
    const poolGeometry = this.keep(new BufferGeometry());
    poolGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    poolGeometry.setAttribute('aFalloff', new BufferAttribute(new Float32Array(falloffs), 1));
    const poolMaterial = this.track(
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(LANTERN_GLASS).lerp(new Color(0xffb347), 0.6) },
          uStrength: { value: 0.26 },
        },
        vertexShader: /* glsl */ `
          attribute float aFalloff;
          varying float vFalloff;
          void main() {
            vFalloff = aFalloff;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uStrength;
          varying float vFalloff;
          void main() {
            gl_FragColor = vec4(uColor, vFalloff * uStrength);
          }
        `,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const pool = new Mesh(poolGeometry, poolMaterial);
    // Behind the fire's own pool in the queue, so where the two overlap the
    // fire is the one that wins.
    pool.renderOrder = 3;
    pool.name = 'campfire-lantern-pool';
    // On the group, not on `lean`: the staff is driven in at an angle and a
    // pool of light does not lean with the thing casting it.
    group.add(pool);

    return group;
  }

  private buildFirewood(rand: Rand): Object3D {
    const group = new Group();
    group.name = 'campfire-firewood';

    const count = 5;
    const mesh = new InstancedMesh(
      this.keep(stickGeometry(1, 0.5, 0.4, 5, rand)),
      this.solid({ color: WOOD_COLOR, colorVariant: WOOD_CHAR, grain: 0.55, rim: 0.3 }),
      count,
    );
    mesh.castShadow = true;
    mesh.name = 'campfire-firewood-sticks';
    this.instanced.push(mesh);

    const dummy = new Object3D();
    for (let i = 0; i < count; i++) {
      // Two on the ground, three thrown across them. A tidy cord of wood
      // belongs to a woodshed; this is what a night's worth looks like.
      const upper = i >= 2;
      const radius = randRange(rand, 0.05, 0.075);
      const x = randRange(rand, -0.16, 0.16);
      const z = randRange(rand, -0.1, 0.1);
      // The three on top are the ones allowed to lie across the pile, so
      // they get the wide yaw and the only tilt off horizontal.
      const yaw = upper ? randRange(rand, -0.5, 0.5) : randRange(rand, -0.12, 0.12);
      const tilt = upper ? randRange(rand, -0.2, 0.2) : 0;
      const length = randRange(rand, 0.62, 0.86);
      // Centred on its own point, and yawed under the tilt rather than over
      // it, for the reasons given in `buildLaidFire`. Left uncentred a stick
      // runs a full length out from the placement the layout chose, which is
      // twice the footprint the layout promised the neighbouring props.
      const half = (length / 2) * Math.cos(tilt);
      dummy.position.set(
        x - Math.sin(yaw) * half,
        radius + (upper ? 0.11 : 0),
        z - Math.cos(yaw) * half,
      );
      dummy.rotation.set(Math.PI / 2 - tilt, yaw, 0, 'YXZ');
      dummy.scale.set(radius * 2, length, radius * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
    return group;
  }

  /**
   * The pool of firelight on the ground.
   *
   * Draped over the terrain rather than laid flat, because the ground under
   * a camp beside a crowned road is not level and a flat disc would sink
   * into it on one side and hover on the other.
   *
   * Three things carry it, and the first two are the fix for the frame that
   * read as "one uniform saturated orange with a hard rim":
   *
   * - **The hue journey** (`POOL_TINT`), baked per vertex. Colour does the
   *   work brightness was being asked to do alone.
   * - **A rim that is not a shape.** The old pool jittered its radius once
   *   per segment and used the same jitter at every ring, which draws a
   *   slightly wobbly circle — still a circle, still a decal. Here the
   *   jitter is per *vertex*, it only bites on the outer rings (a wobbly
   *   core would read as a flickering fault), and the falloff itself is
   *   jittered alongside it, so the last of the light breaks into patches
   *   rather than ending on a contour.
   * - **A core, then a long tail.** The falloff is an eased ramp with a
   *   sharp bright peak added at the very middle, so the coals are hot and
   *   the outer two metres still carry enough alpha for the red and the
   *   violet to be visible at all. The old cubic ramp put ninety per cent of
   *   the light inside half the radius and left the rest with nothing to
   *   grade *with*.
   */
  private buildGlow(
    rand: Rand,
    groundHeightAt: (x: number, z: number) => number,
    fireY: number,
  ): ShaderMaterial {
    const segments = 34;
    const rings = 9;
    const { fire } = this.layout;

    const positions: number[] = [];
    const falloffs: number[] = [];
    const tints: number[] = [];
    // One draw per vertex of the grid, taken up front so the shared corners
    // between two triangles get the same jitter and the mesh does not tear.
    const jitter: number[] = [];
    for (let i = 0; i < (rings + 1) * segments; i++) jitter.push(rand());

    const tintAt = (t: number): [number, number, number] => {
      let i = 1;
      while (i < POOL_TINT.length - 1 && POOL_TINT[i][0] < t) i++;
      const [t0, r0, g0, b0] = POOL_TINT[i - 1];
      const [t1, r1, g1, b1] = POOL_TINT[i];
      const k = Math.min(1, Math.max(0, (t - t0) / Math.max(1e-4, t1 - t0)));
      return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k];
    };

    const vertex = (ring: number, segment: number) => {
      const s = ((segment % segments) + segments) % segments;
      const angle = (s / segments) * Math.PI * 2;
      const t = ring / rings;
      // Ragged only where it is dissolving. Nothing at the core, everything
      // by the rim.
      const rough = Math.pow(t, 2.2);
      const draw = jitter[ring * segments + s];
      const radius = t * POOL_RADIUS_M * (1 + (draw - 0.5) * 0.5 * rough);
      const dx = Math.sin(angle) * radius;
      const dz = Math.cos(angle) * radius;
      positions.push(
        dx,
        // Lifted clear of the ground so it never z-fights the terrain it is
        // draped over; low enough that nothing can walk under it.
        groundHeightAt(fire.x + dx, fire.z + dz) - fireY + 0.035,
        dz,
      );
      const f = 1 - t;
      // A long tail with a hot spike at the coals, and a soft close at the
      // very edge.
      //
      // The shape matters more than the numbers. The old curve was a cubic:
      // it put nine tenths of its light inside half the radius and left the
      // outer half nothing to grade *with*, so however the colours were
      // ramped there was no alpha out there to show them. This one falls
      // gently (1.7, not 3), which keeps enough light in the outer half for
      // the reds and the violet to register, and takes the brightness back at
      // the middle with an eighth-power spike that is gone within half a
      // metre — a bright core without a broad blown-out plateau, which is the
      // other half of why the pool used to have no hue: a clipped red channel
      // is the same colour everywhere.
      // One shallow bump where the ramp turns red. Not brightness for its own
      // sake: the red band is the part of the journey with the least alpha
      // behind it and the most ground showing through, so without a little
      // extra presence exactly there the pool goes gold, orange, and then
      // straight back to the colour of the field.
      const band = Math.max(0, 1 - Math.abs(t - 0.52) / 0.3);
      const eased = Math.pow(f, 1.35) * (1 + 1.0 * Math.pow(f, 8) + 0.42 * band * band);
      // And a smootherstep over the last fifth, so the outermost ring reaches
      // zero flat instead of arriving at it with a slope still on.
      const close = Math.min(1, f / 0.2);
      const shut = close * close * close * (close * (close * 6 - 15) + 10);
      // Patchy at the rim, for the same reason the radius is.
      falloffs.push(eased * shut * (1 - rough * 0.55 * draw));
      // The colour is a function of the *nominal* radius, not the jittered
      // one, so the ramp's bands stay concentric while its edge does not.
      const [r, g, b] = tintAt(t);
      tints.push(r, g, b);
    };

    for (let ring = 0; ring < rings; ring++) {
      for (let s = 0; s < segments; s++) {
        vertex(ring, s);
        vertex(ring + 1, s);
        vertex(ring + 1, s + 1);
        vertex(ring, s);
        vertex(ring + 1, s + 1);
        vertex(ring, s + 1);
      }
    }

    const geometry = this.keep(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('aFalloff', new BufferAttribute(new Float32Array(falloffs), 1));
    geometry.setAttribute('aTint', new BufferAttribute(new Float32Array(tints), 3));

    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: LIGHT_BLAZE.clone() },
        uStrength: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aFalloff;
        attribute vec3 aTint;
        varying float vFalloff;
        varying vec3 vTint;
        void main() {
          vFalloff = aFalloff;
          vTint = aTint;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        varying float vFalloff;
        varying vec3 vTint;
        void main() {
          gl_FragColor = vec4(uColor * vTint, vFalloff * uStrength);
        }
      `,
      transparent: true,
      // Additive and depth-write-off: the pool has to build up over the
      // grass tufts and the road's shoulder without hiding either, and
      // writing depth would punch a hole in the particles drawn after it.
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.track(material);

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 4;
    mesh.name = 'campfire-glow';
    this.fireGroup.add(mesh);
    return material;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    // Disposed from an explicit list rather than by traversing the group:
    // several meshes deliberately share one geometry, and a traversal would
    // dispose those twice.
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    for (const mesh of this.instanced) mesh.dispose();
    this.instanced.length = 0;
    this.emberField.dispose();
    this.group.clear();
    // Put the hearth out. The strength is a *shared* global, so a camp that
    // tears itself down without clearing it leaves the entire daylit world
    // lit by a fire that is no longer there — and because the term falls off
    // with distance, the symptom would be a warm patch following the player
    // around the map rather than anything that looks like a bug.
    this.globals.uHearthStrength.value = 0;
  }
}

// --- geometry ----------------------------------------------------------

/**
 * A tapered box.
 *
 * The bard is built from its own copy of this primitive. The two are kept
 * separate on purpose: re-proportioning the bard should not be able to
 * reshape the camp's luggage as a side effect.
 */
function taperedBox(
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
  const quads = [
    [b[0], b[1], t[1], t[0]],
    [b[1], b[2], t[2], t[1]],
    [b[2], b[3], t[3], t[2]],
    [b[3], b[0], t[0], t[3]],
    [t[0], t[1], t[2], t[3]],
    [b[3], b[2], b[1], b[0]],
  ];
  const verts: number[] = [];
  for (const [p0, p1, p2, p3] of quads) verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  return finish(verts);
}

/**
 * A branch: a slightly bent, slightly irregular prism along +Y.
 *
 * Built at unit length so one geometry serves the laid fire and the spare
 * wood at whatever scale each wants. Five sides, because at the size these
 * are drawn a sixth is a triangle nobody sees.
 */
function stickGeometry(
  length: number,
  bottomRadius: number,
  topRadius: number,
  sides: number,
  rand: Rand,
): BufferGeometry {
  const verts: number[] = [];
  const twist = randRange(rand, 0, Math.PI * 2);
  // A single kink partway up. A perfectly straight stick is a dowel.
  const kink = randRange(rand, 0.35, 0.6);
  const bendX = randRange(rand, -0.07, 0.07);
  const bendZ = randRange(rand, -0.07, 0.07);
  const levels = [
    { y: 0, r: bottomRadius, x: 0, z: 0 },
    { y: length * kink, r: (bottomRadius + topRadius) * 0.5, x: bendX, z: bendZ },
    { y: length, r: topRadius, x: bendX * 1.3, z: bendZ * 1.3 },
  ];

  for (let l = 0; l < levels.length - 1; l++) {
    const lower = levels[l];
    const upper = levels[l + 1];
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2 + twist;
      const a1 = ((s + 1) / sides) * Math.PI * 2 + twist;
      const p = (level: typeof lower, a: number) => [
        level.x + Math.cos(a) * level.r,
        level.y,
        level.z + Math.sin(a) * level.r,
      ];
      const b0 = p(lower, a0);
      const b1 = p(lower, a1);
      const t0 = p(upper, a0);
      const t1 = p(upper, a1);
      verts.push(...b0, ...b1, ...t0, ...b1, ...t1, ...t0);
    }
  }

  // Cap both ends: a log seen end-on in a fire shows its cut face.
  for (const [level, flip] of [
    [levels[0], true],
    [levels[levels.length - 1], false],
  ] as const) {
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2 + twist;
      const a1 = ((s + 1) / sides) * Math.PI * 2 + twist;
      const centre = [level.x, level.y, level.z];
      const e0 = [level.x + Math.cos(a0) * level.r, level.y, level.z + Math.sin(a0) * level.r];
      const e1 = [level.x + Math.cos(a1) * level.r, level.y, level.z + Math.sin(a1) * level.r];
      if (flip) verts.push(...centre, ...e1, ...e0);
      else verts.push(...centre, ...e0, ...e1);
    }
  }

  return finish(verts);
}

/**
 * One tongue of flame: a twisted, bulging taper that comes to a point.
 *
 * The bulge matters. A plain cone is a party hat and a plain cylinder is a
 * candle; a shape that swells just above its base and then narrows fast is
 * what the eye recognises as fire. Each ring is rotated against the one
 * below so the facets zigzag up the shape instead of forming clean vertical
 * seams, which is what keeps it low-poly-stylised rather than lathed.
 */
function flameGeometry(radius: number, height: number, sides: number, twist: number): BufferGeometry {
  const rings = [
    { t: 0, r: 0.72 },
    { t: 0.22, r: 1.0 },
    { t: 0.52, r: 0.78 },
    { t: 0.78, r: 0.4 },
  ];
  const verts: number[] = [];

  const point = (ring: (typeof rings)[number], index: number, s: number) => {
    const a = (s / sides) * Math.PI * 2 + twist + index * 0.42;
    return [Math.cos(a) * radius * ring.r, height * ring.t, Math.sin(a) * radius * ring.r];
  };

  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const b0 = point(rings[i], i, s);
      const b1 = point(rings[i], i, s + 1);
      const t0 = point(rings[i + 1], i + 1, s);
      const t1 = point(rings[i + 1], i + 1, s + 1);
      verts.push(...b0, ...b1, ...t0, ...b1, ...t1, ...t0);
    }
  }

  const apex = [0, height, 0];
  const top = rings[rings.length - 1];
  for (let s = 0; s < sides; s++) {
    verts.push(...point(top, rings.length - 1, s), ...point(top, rings.length - 1, s + 1), ...apex);
  }
  // Closed underneath so a segment seen from below is not a hollow shell.
  const base = rings[0];
  for (let s = 0; s < sides; s++) {
    verts.push(0, 0, 0, ...point(base, 0, s + 1), ...point(base, 0, s));
  }

  return finish(verts);
}

/**
 * A bedroll: a long, low, rounded mound with tapered ends.
 *
 * Five facets over the top rather than a half-cylinder — enough to read as
 * soft at four metres, few enough that the flat shading still gives it
 * crisp planes for the firelight to catch one side of.
 */
function bedrollGeometry(length: number, width: number, height: number): BufferGeometry {
  const sections = [
    { z: -length / 2, scale: 0.42 },
    { z: -length * 0.32, scale: 0.9 },
    { z: 0, scale: 1 },
    { z: length * 0.32, scale: 0.96 },
    { z: length / 2, scale: 0.5 },
  ];
  const arc = 5;
  const verts: number[] = [];

  const rib = (index: number, step: number) => {
    const section = sections[index];
    const a = Math.PI * (step / arc);
    return [
      Math.cos(a) * (width / 2) * section.scale,
      Math.sin(a) * height * section.scale,
      section.z,
    ];
  };

  for (let i = 0; i < sections.length - 1; i++) {
    for (let s = 0; s < arc; s++) {
      const a0 = rib(i, s);
      const a1 = rib(i, s + 1);
      const b0 = rib(i + 1, s);
      const b1 = rib(i + 1, s + 1);
      verts.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
    }
    // The flat underside, so the roll is closed where it meets the grass.
    const a0 = rib(i, 0);
    const a1 = rib(i, arc);
    const b0 = rib(i + 1, 0);
    const b1 = rib(i + 1, arc);
    verts.push(...a1, ...b1, ...a0, ...a0, ...b1, ...b0);
  }

  return finish(verts);
}

/**
 * The instrument, stood on its end. A rounded body, a neck and a head — the
 * same three shapes the bard carries, at the same silhouette, because the
 * player has to recognise it as *their* instrument sitting there.
 */
function luteGeometry(): BufferGeometry {
  /**
   * The body, as a hull rather than as a box.
   *
   * A tapered box seen from any of the angles the resting camera holds is a
   * blade on a shaft, and that is exactly what this prop read as in every
   * campfire frame: a spade stood beside the fire. The bard's own instrument
   * had the same fault and was rebuilt for the same reason; the two have to
   * agree, because the whole point of this prop is that the player
   * recognises it as *their* instrument put down for the night. Rings and a
   * section, in the same language as `BODY_RINGS` in `Bard.ts`, and the five
   * staves of the bowl are what carry it once the silhouette is round.
   */
  const rings: [number, number, number][] = [
    [0.0, 0.072, 0.05],
    [0.034, 0.114, 0.076],
    [0.082, 0.142, 0.092],
    [0.134, 0.148, 0.096],
    [0.194, 0.128, 0.085],
    [0.252, 0.088, 0.06],
    [0.31, 0.038, 0.036],
  ];
  const section: [number, number][] = [
    [0.7, 1],
    [-0.7, 1],
    [-1, -0.22],
    [-0.72, -0.75],
    [-0.3, -1.1],
    [0.3, -1.1],
    [0.72, -0.75],
    [1, -0.22],
  ];
  const board = 0.026;
  const at = (ring: [number, number, number], k: number): number[] => {
    const [y, w, d] = ring;
    const [sx, sz] = section[k];
    return [sx * w, y, sz > 0 ? board : board + sz * d];
  };
  const hull: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < section.length; k++) {
      const k1 = (k + 1) % section.length;
      hull.push(...at(rings[i], k), ...at(rings[i + 1], k), ...at(rings[i + 1], k1));
      hull.push(...at(rings[i], k), ...at(rings[i + 1], k1), ...at(rings[i], k1));
    }
  }
  for (let k = 1; k < section.length - 1; k++) {
    hull.push(...at(rings[0], 0), ...at(rings[0], k), ...at(rings[0], k + 1));
  }
  const bodyGeometry = new BufferGeometry();
  bodyGeometry.setAttribute('position', new BufferAttribute(new Float32Array(hull), 3));

  const parts = [
    bodyGeometry,
    translated(taperedBox(0.07, 0.46, 0.055, 0.86), 0, 0.28, board - 0.0275),
    translated(taperedBox(0.1, 0.11, 0.055, 0.72), 0, 0.72, board - 0.038),
    // Three strings and the nut, standing a few millimetres off the board.
    // They are the same mark the carried instrument has, and at this size
    // they are the only thing that separates a lute from a mandolin-shaped
    // lump of timber once the soundhole is on the side facing the fire.
    ...[-0.017, 0, 0.017].map((x) =>
      translated(taperedBox(0.009, 0.66, 0.006), x, 0.06, board + 0.006),
    ),
    translated(taperedBox(0.055, 0.014, 0.014), 0, 0.715, board + 0.002),
  ];
  const verts: number[] = [];
  for (const part of parts) {
    const attribute = part.attributes.position as BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < array.length; i++) verts.push(array[i]);
    part.dispose();
  }
  return finish(verts);
}

function translated(geometry: BufferGeometry, dx: number, dy: number, dz: number): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) + dx, position.getY(i) + dy, position.getZ(i) + dz);
  }
  return geometry;
}

/** Everything above builds a raw triangle soup; this is the one exit. */
function finish(verts: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}
