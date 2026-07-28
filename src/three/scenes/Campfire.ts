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
import { campfireLayout, type CampfireLayout, type PropPlacement } from './campfireLayout';

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
 * 2.6 m out, so a 4.6 m pool covers the whole camp with room to spare. It
 * does not stop short of the road — the fire is 5.8 m off the centreline at
 * its closest and the packed surface is 2.3 m wide, so the pool's rim laps
 * about a metre onto it — but the falloff below is cubic, and by that radius
 * it is carrying a few per cent of its centre strength. The composition
 * still reads: the camp is warm, the road it came off is still blue.
 */
const POOL_RADIUS_M = 4.6;

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
    this.coalMaterial = this.buildCoals(rand);
    this.buildLaidFire(rand);
    this.buildFlame();
    this.buildCamp(rand, groundHeightAt, fireY);

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

  /** Where the bard should sit, in the camp's own frame, and which way to face. */
  get seat(): { x: number; y: number; z: number; heading: number } {
    const { seat } = this.layout;
    return { x: seat.x, y: 0, z: seat.z, heading: seat.heading };
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

    // The pool is a shade more responsive than the light, because it is the
    // part anyone actually sees move.
    this.glowMaterial.uniforms.uStrength.value =
      (0.3 + flame * 0.7) * (0.82 + (this.lit - 1) * 0.7 + sparkle * 0.06);
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
          placeProp(prop, this.buildLantern(rand));
          break;
        case 'firewood':
          placeProp(prop, this.buildFirewood(rand));
          break;
        default:
          break;
      }
    }
  }

  private buildBedroll(): Object3D {
    const group = new Group();
    group.name = 'campfire-bedroll';

    const roll = new Mesh(
      this.keep(bedrollGeometry(1.55, 0.56, 0.19)),
      this.solid({ color: CANVAS_COLOR, colorVariant: 0xbda882, rim: 0.45, grain: 0.5 }),
    );
    roll.castShadow = true;
    roll.receiveShadow = true;
    group.add(roll);

    // A blanket folded back at one end. It costs six triangles and it is the
    // difference between a laid bed and a sack.
    const blanket = new Mesh(
      this.keep(taperedBox(0.5, 0.13, 0.42, 0.86, 0.9)),
      this.solid({ color: BLANKET_COLOR, colorVariant: 0xd0996a, rim: 0.5 }),
    );
    blanket.position.set(0, 0.13, 0.46);
    blanket.rotation.y = 0.16;
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

    const body = new Mesh(
      this.keep(taperedBox(0.4, 0.5, 0.32, 0.82, 0.88)),
      this.solid({ color: LEATHER_COLOR, colorVariant: 0x8f6c48, rim: 0.42 }),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    lean.add(body);

    const flap = new Mesh(
      this.keep(taperedBox(0.42, 0.12, 0.34, 1, 1)),
      this.solid({ color: STRAP_COLOR, colorVariant: 0x6b5340, rim: 0.35 }),
    );
    flap.position.y = 0.44;
    flap.rotation.x = 0.24;
    flap.castShadow = true;
    lean.add(flap);

    const strap = new Mesh(
      this.keep(taperedBox(0.08, 0.46, 0.06, 1, 1)),
      this.solid({ color: STRAP_COLOR, colorVariant: 0x7a5c40, rim: 0.35 }),
    );
    strap.position.set(0.09, 0.04, 0.17);
    strap.rotation.z = 0.12;
    lean.add(strap);

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
    // clear 0.9 m from the stones — stood beside the fire, not propped on it.
    const reach = prop.radius - this.layout.ringRadius;
    const drop = groundHeightAt(prop.x, prop.z) - fireY;
    lean.rotation.x = Math.min(1.0, Math.max(0.5, Math.atan2(reach, 0.85 + drop)));

    return group;
  }

  private buildLantern(rand: Rand): Object3D {
    const group = new Group();
    group.name = 'campfire-lantern';
    const lean = new Group();
    // Driven into the ground at an angle so the lantern hangs clear of it.
    lean.rotation.x = 0.26;
    group.add(lean);

    const pole = new Mesh(
      this.keep(stickGeometry(1.24, 0.028, 0.042, 5, rand)),
      this.solid({ color: WOOD_COLOR, colorVariant: 0x8a6b48, rim: 0.35 }),
    );
    pole.castShadow = true;
    lean.add(pole);

    const cage = new Mesh(
      this.keep(taperedBox(0.15, 0.2, 0.15, 0.72, 0.72)),
      this.solid({ color: LANTERN_METAL, colorVariant: 0x6d6053, rim: 0.55 }),
    );
    cage.position.set(0, 1.02, 0.13);
    cage.castShadow = true;
    lean.add(cage);

    // The glass is emissive but carries no light of its own — one point
    // light is the budget, and a lantern that lit the camp would compete
    // with the fire for the thing the fire is here to do.
    const glass = new Mesh(
      this.keep(taperedBox(0.11, 0.12, 0.11, 1, 1)),
      this.solid({
        color: LANTERN_GLASS,
        colorVariant: LANTERN_GLASS,
        emissive: 0xffb347,
        emissiveStrength: 0.7,
        rim: 0.1,
      }),
    );
    glass.position.set(0, 1.06, 0.13);
    lean.add(glass);

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
   * into it on one side and hover on the other. The rim is jittered per
   * segment so the pool is not a perfect circle — a perfect circle is the
   * tell that it is a decal.
   */
  private buildGlow(
    rand: Rand,
    groundHeightAt: (x: number, z: number) => number,
    fireY: number,
  ): ShaderMaterial {
    const segments = 28;
    const rings = 5;
    const { fire } = this.layout;

    const positions: number[] = [];
    const falloffs: number[] = [];
    const rimScale: number[] = [];
    for (let s = 0; s < segments; s++) rimScale.push(randRange(rand, 0.82, 1.06));

    const vertex = (ring: number, segment: number) => {
      const s = ((segment % segments) + segments) % segments;
      const angle = (s / segments) * Math.PI * 2;
      const t = ring / rings;
      const radius = t * POOL_RADIUS_M * rimScale[s];
      const dx = Math.sin(angle) * radius;
      const dz = Math.cos(angle) * radius;
      positions.push(
        dx,
        // Lifted clear of the ground so it never z-fights the terrain it is
        // draped over; low enough that nothing can walk under it.
        groundHeightAt(fire.x + dx, fire.z + dz) - fireY + 0.035,
        dz,
      );
      // Squared, then eased, so the centre is a broad warm flood and the
      // edge dissolves rather than ending on a line.
      const falloff = 1 - t;
      falloffs.push(falloff * falloff * (3 - 2 * falloff) * falloff);
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

    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: LIGHT_BLAZE.clone() },
        uStrength: { value: 0 },
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
  const parts = [
    taperedBox(0.3, 0.3, 0.17, 0.6, 0.66),
    translated(taperedBox(0.07, 0.46, 0.055, 0.86), 0, 0.28, 0),
    translated(taperedBox(0.1, 0.11, 0.055, 0.72), 0, 0.72, 0),
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
