/**
 * The festival's edge.
 *
 * On the thirteenth campfire the camp is not just a camp — it is pitched at
 * the rim of the festival the whole long way has been walking toward. The
 * mechanics of that night already exist (the page, the chained set); this is
 * the picture that has to agree with them, because a festival eve that looks
 * exactly like the twelve ordinary nights before it makes the page a claim
 * the frame does not support.
 *
 * Three marks, in the order the eye finds them:
 *
 * - **Strung lanterns.** The main light story, and the only one that carries
 *   at night. Three catenary lines between poles, each hung with small warm
 *   emissive lamps in two or three hues. They are deliberately *mid* value,
 *   not hot: the wave-5 critique measured the night frame as undifferentiated
 *   dark (59% of pixels under L*10), and what a dark frame needs is not a
 *   second fire but a ladder — a run of small warm notes sitting between the
 *   fire's hot core and the black field, so the eye has somewhere to travel.
 * - **Stalls.** Closed for the night, so no goods: posts, a sloped awning,
 *   a counter. Silhouettes at the back of the grounds, and the reason the
 *   lantern lines read as *strung across something* rather than as a row of
 *   fireflies.
 * - **A low stage.** Knee-high planks with two banner poles at its back
 *   corners, in the same language as the wayside busk pitch's banner (a thin
 *   prism, not a plane — a single quad is invisible from behind).
 *
 * ## Where it sits, and why not nearer
 *
 * `campfireLayout` owns the camp's ground and states its own clearances; this
 * takes them as given rather than restating them. The grounds' centre is
 * `extent + GROUNDS_GAP_M` further out along the same "straight away from the
 * road" bearing the camp is built on, so everything here is outside the
 * camp's extent by construction and further from the road centreline than the
 * fire is — which is the only two rules it has to obey. Being on that bearing
 * also puts it squarely in what the resting camera is already looking at: the
 * camera stands behind the bard, looking across him and the fire, so the far
 * side of the fire is the picture's own background and the lantern lines land
 * in it without a single prop moving.
 *
 * ## What this is not
 *
 * Not a `Stage`, and not a second campfire. It owns its group, its clock and
 * nothing else — no point light, no hearth term, no touch on the shader's
 * shared globals. The one thing it puts on the ground is an additive pool in
 * the same idiom as the camp lantern's, at a fraction of the strength, whose
 * whole job is to give the stalls and the stage something other than black to
 * be silhouettes *against*.
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
  ShaderMaterial,
} from 'three';
import {
  createPainterlyMaterial,
  type PainterlyGlobals,
  type PainterlyOptions,
} from '../painterly';
import { DEFAULT_PALETTE, mixColor, type BiomePalette } from '../world/palette';
import { mulberry32, randInt, randRange, subSeed, type Rand } from '../../core/rng';
import { campfireLayout } from './campfireLayout';

export interface FestivalGroundsOptions {
  /** Road heading at the stop. Same convention as the camp's. */
  heading?: number;
  /** Ground height in the camp's own (anchor-relative) frame. */
  groundHeightAt?: (x: number, z: number) => number;
  palette?: BiomePalette;
}

// --- placement ---------------------------------------------------------

/**
 * How far past the camp's own extent the grounds begin.
 *
 * `RoadStage.makeCamp` clears scrub to `extent + 1.2`, so anything inside that
 * is standing in ground the camp has already claimed. 3.4 puts the nearest
 * pole a good two metres beyond the clearing's rim — near enough that the
 * lantern lines fill the background of the resting frame, far enough that
 * nothing here is ever mistaken for part of the camp or lands between the
 * camera and the flame.
 */
const GROUNDS_GAP_M = 3.4;

/**
 * Local frame: +Z runs further away from the road, +X across it.
 *
 * Everything below is written in that frame and the group carries the
 * rotation, exactly as the camp folds its heading into its numbers — so
 * "further from the road" is a positive number here rather than a trig
 * identity, and the whole grounds turn rigidly with the road.
 */
const LINE_COUNT = 3;
/** Depth of each lantern line, nearest first. */
const LINE_Z = [-1.1, 1.5, 4.0];
const LINE_SPAN_M: [number, number] = [3.4, 4.6];
const LINE_OFFSET_M = 1.3;
const POLE_HEIGHT_M: [number, number] = [2.5, 3.1];
const POLE_RADIUS_M = 0.055;
/** How far the cord dips at mid-span. A taut line is a washing line. */
const LINE_SAG_M: [number, number] = [0.42, 0.66];
const LANTERNS_PER_LINE: [number, number] = [5, 8];
const CORD_SEGMENTS = 8;
/** How far the lamp hangs below the cord. */
const LANTERN_DROP_M = 0.15;
const LANTERN_SCALE: [number, number] = [0.82, 1.15];

const STALL_COUNT = 3;
/** Stall centres, local. Beyond the lantern lines, spread wide. */
/**
 * The middle stall is off-centre, and for the same reason `campfireLayout`
 * keeps its bedroll off bearing 0: local x ≈ 0 is the axis the resting camera
 * looks *along*, so anything standing there is behind the fire in plan and on
 * top of the bard on screen. The shipped first frame put a stall post a few
 * pixels above his hat brim, which is the "stick growing out of the hat" the
 * camp's own sightline test exists to catch. -2.3 puts the whole stall clear
 * of that column while leaving the three spread across the grounds.
 */
const STALL_SPOTS: readonly (readonly [number, number])[] = [
  [-5.6, 6.4],
  [-2.3, 8.6],
  [5.4, 6.1],
];
const STALL_WIDTH_M: [number, number] = [1.9, 2.5];
const STALL_DEPTH_M = 1.35;
const STALL_POST_H_M: [number, number] = [2.0, 2.3];

const STAGE_Z = 4.9;
const STAGE_WIDTH_M = 3.0;
const STAGE_DEPTH_M = 2.0;
/** Knee-high. A stage you step onto, not one you climb. */
const STAGE_HEIGHT_M = 0.42;
const STAGE_PLANKS = 6;
const STAGE_POLE_H_M = 3.3;
const BANNER_H_M = 1.55;
const BANNER_W_M = 0.5;

/** The warm ground lift under the grounds. See the file note. */
const POOL_CENTRE_Z = 2.8;
const POOL_RADIUS_X_M = 9.5;
const POOL_RADIUS_Z_M = 6.8;
/**
 * Raised from 0.13 after the first shipped frame was read: at that strength
 * the ground under the grounds measured the same near-black as the field
 * beyond it, so the stalls and the stage had nothing to be silhouettes
 * against and the lanterns floated in a void. 0.22 lifts the grounds into a
 * low mid-value without coming anywhere near the fire's own pool, which runs
 * at (0.15 + flame·0.34) over a much smaller disc.
 */
const POOL_STRENGTH = 0.22;

// --- colour ------------------------------------------------------------

const TIMBER_COLOR = 0x6b503a;
const TIMBER_DARK = 0x3f3026;
const LANTERN_METAL = 0x4a4038;
/**
 * The lamps' warm family.
 *
 * Not one uniform orange — a line of identical lights is a string of LEDs,
 * and the whole point of these is to be a *ladder* of small warm values. Each
 * hue is the biome's own accent pulled most of the way to a lamp colour, so
 * a village festival and a riverside one are lit by lamps that still belong
 * to their band rather than by the same three constants.
 */
const LAMP_HUES = [0xffc25e, 0xff9448, 0xffe0a0] as const;
const LAMP_ACCENT_MIX = 0.28;

const PHI = 1.618033988749895;

/**
 * Cloth for the awnings and the banners.
 *
 * Muted on purpose, and for the same reason the camp's canvas is: the fire is
 * the warmest thing in any frame it appears in, and a festival that arrives
 * as a wall of saturated bunting takes that away on the one night it matters
 * most. The awnings are the accent knocked back toward canvas; the banners
 * get the accent nearer full, because there are only two of them and they are
 * the mark that says *stage*.
 */
const AWNING_CANVAS = 0x9a866a;
const AWNING_MIX: readonly number[] = [0.5, 0.34, 0.62];
const BANNER_MIX = 0.78;

interface LanternInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
  /** Irrational-ish per-lantern rate, so no two lamps ever swing in unison. */
  rate: number;
}

export class FestivalGrounds {
  readonly group = new Group();

  private readonly materials: ShaderMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly instanced: InstancedMesh[] = [];

  private readonly lanterns: LanternInstance[] = [];
  private lampMeshes: InstancedMesh[] = [];
  private readonly dummy = new Object3D();

  private readonly globals: PainterlyGlobals;

  constructor(globals: PainterlyGlobals, seed: number, options: FestivalGroundsOptions = {}) {
    const { heading = 0, groundHeightAt = () => 0, palette = DEFAULT_PALETTE } = options;

    this.globals = globals;
    this.group.name = 'festival-grounds';

    // Taken from the camp rather than re-derived: the grounds have to sit
    // beyond *this* camp's extent, on *this* camp's side of the road, and the
    // layout is a pure function of the same seed so asking it costs nothing
    // and cannot disagree with the camp that gets built.
    const layout = campfireLayout(seed, heading);
    const away = heading + (layout.side * Math.PI) / 2;
    const reach = layout.extent + GROUNDS_GAP_M;
    const cx = layout.fire.x + Math.sin(away) * reach;
    const cz = layout.fire.z + Math.cos(away) * reach;
    const cy = groundHeightAt(cx, cz);

    this.group.position.set(cx, cy, cz);
    this.group.rotation.y = away;

    const cos = Math.cos(away);
    const sin = Math.sin(away);
    /** Local (x, z) to the anchor-relative frame `groundHeightAt` speaks. */
    const worldOf = (lx: number, lz: number): [number, number] => [
      cx + lx * cos + lz * sin,
      cz - lx * sin + lz * cos,
    ];
    /** Local ground height, relative to the group's own origin. */
    const localGround = (lx: number, lz: number): number => {
      const [wx, wz] = worldOf(lx, lz);
      return groundHeightAt(wx, wz) - cy;
    };

    const rand = mulberry32(subSeed(seed, 'festival/grounds'));

    this.buildLanternLines(rand, palette, localGround);
    this.buildStage(rand, palette, localGround);
    this.buildStalls(rand, palette, localGround);
    this.buildPool(rand, palette, localGround);
  }

  update(_dt: number, elapsed: number): void {
    // Centimetres, not a dance. A lantern on a line moves because the air
    // moves; anything you can watch swing is a pendulum in a clock.
    for (const mesh of this.lampMeshes) {
      for (let i = 0; i < this.lanterns.length; i++) {
        const lamp = this.lanterns[i];
        const swing = Math.sin(elapsed * lamp.rate + lamp.phase);
        const bob = Math.sin(elapsed * lamp.rate * PHI + lamp.phase * 1.7);
        this.dummy.position.set(
          lamp.x + swing * 0.035,
          lamp.y + bob * 0.012,
          lamp.z + bob * 0.018,
        );
        this.dummy.rotation.set(0, 0, -swing * 0.075);
        this.dummy.scale.setScalar(lamp.scale);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
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

  /** The house material, with the grounds' defaults already applied. */
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

  /**
   * The lantern lines.
   *
   * The construction is the camp lantern's, multiplied: a post at each end, a
   * cord slung between them, and a housing hung off it whose lit part is
   * framed by dark metal above and below. That framing is the whole reason
   * the camp's lantern stopped reading as a glowing quad stuck to a stick,
   * and twenty of them would fail the same way twenty times over without it.
   *
   * Everything is instanced across all three lines — one draw for the posts,
   * one for the cord, one for the caps, one for the glass — because the sway
   * in `update` has to rewrite every lamp's matrix each frame and doing that
   * across twenty separate meshes is twenty matrix uploads.
   */
  private buildLanternLines(
    rand: Rand,
    palette: BiomePalette,
    localGround: (x: number, z: number) => number,
  ): void {
    interface Segment {
      x: number;
      y: number;
      z: number;
      length: number;
      tilt: number;
    }
    interface Post {
      x: number;
      y: number;
      z: number;
      height: number;
    }
    const posts: Post[] = [];
    const cords: Segment[] = [];
    const hues: number[] = [];

    for (let line = 0; line < LINE_COUNT; line++) {
      const z = LINE_Z[line] + randRange(rand, -0.3, 0.3);
      const span = randRange(rand, LINE_SPAN_M[0], LINE_SPAN_M[1]);
      const centre = randRange(rand, -LINE_OFFSET_M, LINE_OFFSET_M);
      const sag = randRange(rand, LINE_SAG_M[0], LINE_SAG_M[1]);
      // The two ends are not the same height. A line strung between two
      // poles somebody drove in by hand never is, and the tilt is most of
      // what keeps three parallel lines from reading as a grid.
      const leftH = randRange(rand, POLE_HEIGHT_M[0], POLE_HEIGHT_M[1]);
      const rightH = randRange(rand, POLE_HEIGHT_M[0], POLE_HEIGHT_M[1]);
      const leftX = centre - span;
      const rightX = centre + span;
      const leftGround = localGround(leftX, z);
      const rightGround = localGround(rightX, z);

      posts.push({ x: leftX, y: leftGround, z, height: leftH });
      posts.push({ x: rightX, y: rightGround, z, height: rightH });

      const leftTop = leftGround + leftH;
      const rightTop = rightGround + rightH;
      /** Parabolic sag: near enough a catenary at this span, and cheaper. */
      const cordAt = (t: number): [number, number] => [
        leftX + (rightX - leftX) * t,
        leftTop + (rightTop - leftTop) * t - sag * 4 * t * (1 - t),
      ];

      for (let s = 0; s < CORD_SEGMENTS; s++) {
        const [x0, y0] = cordAt(s / CORD_SEGMENTS);
        const [x1, y1] = cordAt((s + 1) / CORD_SEGMENTS);
        const dx = x1 - x0;
        const dy = y1 - y0;
        cords.push({
          x: x0,
          y: y0,
          z,
          length: Math.hypot(dx, dy),
          tilt: Math.atan2(-dx, dy),
        });
      }

      const count = randInt(rand, LANTERNS_PER_LINE[0], LANTERNS_PER_LINE[1]);
      for (let i = 0; i < count; i++) {
        // Spread across the inner run of the line, so no lamp ends up
        // jammed against a pole where the cord has nowhere left to hang.
        const t = (i + 1) / (count + 1) + randRange(rand, -0.02, 0.02);
        const [x, y] = cordAt(t);
        const scale = randRange(rand, LANTERN_SCALE[0], LANTERN_SCALE[1]);
        this.lanterns.push({
          x,
          y: y - LANTERN_DROP_M * scale,
          z,
          scale,
          phase: rand() * Math.PI * 2,
          rate: randRange(rand, 0.5, 0.86),
        });
        // Alternating rather than drawn at random: a run of three of the
        // same hue in a row is what a random draw gives you a third of the
        // time, and it reads as a fault in the lights rather than as
        // variety. The line index rolls the start so the three lines do not
        // all begin on the same colour.
        hues.push((i + line) % LAMP_HUES.length);
      }
    }

    // --- posts
    const postGeometry = this.keep(taperedBox(POLE_RADIUS_M * 2, 1, POLE_RADIUS_M * 2, 0.7));
    const postMesh = new InstancedMesh(
      postGeometry,
      this.solid({ color: TIMBER_COLOR, colorVariant: TIMBER_DARK, grain: 0.5, rim: 0.34 }),
      posts.length,
    );
    postMesh.castShadow = true;
    postMesh.name = 'festival-lantern-posts';
    this.instanced.push(postMesh);
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      this.dummy.position.set(post.x, post.y, post.z);
      // A driven post leans a little. Set on the object rather than baked
      // into the geometry so the two ends of a line can disagree.
      this.dummy.rotation.set(randRange(rand, -0.03, 0.03), 0, randRange(rand, -0.04, 0.04));
      this.dummy.scale.set(1, post.height, 1);
      this.dummy.updateMatrix();
      postMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.group.add(postMesh);

    // --- cord
    const cordGeometry = this.keep(taperedBox(0.022, 1, 0.022));
    const cordMesh = new InstancedMesh(
      cordGeometry,
      this.solid({ color: TIMBER_DARK, colorVariant: 0x2c231c, rim: 0.25, grain: 0.2 }),
      cords.length,
    );
    cordMesh.castShadow = false;
    cordMesh.name = 'festival-lantern-cord';
    this.instanced.push(cordMesh);
    for (let i = 0; i < cords.length; i++) {
      const segment = cords[i];
      this.dummy.position.set(segment.x, segment.y, segment.z);
      this.dummy.rotation.set(0, 0, segment.tilt);
      this.dummy.scale.set(1, segment.length, 1);
      this.dummy.updateMatrix();
      cordMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.group.add(cordMesh);

    // --- the lamps themselves
    //
    // Two instanced meshes over the same lantern list: a dark cap and, inside
    // it, the glass. Both are driven from `this.lanterns` in `update`, which
    // is why the geometries are built about the lamp's own hanging point
    // rather than about their own bases — a sway that moved the glass and
    // left the cap behind is worse than no sway at all.
    const capGeometry = this.keep(translatedY(taperedBox(0.19, 0.1, 0.19, 0.22, 0.22), 0.075));
    const capMesh = new InstancedMesh(
      capGeometry,
      this.solid({ color: LANTERN_METAL, colorVariant: 0x6d6053, rim: 0.5, grain: 0.3 }),
      this.lanterns.length,
    );
    capMesh.castShadow = false;
    capMesh.name = 'festival-lantern-caps';
    this.instanced.push(capMesh);
    this.group.add(capMesh);

    const glassGeometry = this.keep(translatedY(taperedBox(0.12, 0.135, 0.12), -0.068));
    const glassMesh = new InstancedMesh(
      glassGeometry,
      this.solid({
        color: 0xffc25e,
        colorVariant: 0xffe0a8,
        emissive: 0xffb347,
        // Higher than the camp lantern's 0.4, and it is a distance argument
        // rather than a taste one: these hang eight to fourteen metres from
        // the resting camera where the camp's own lamp sits at two, and the
        // frame's whole complaint is that there is nothing in the mid values
        // out there. Still well under the flame's, which runs past 1.0.
        emissiveStrength: 0.72,
        rim: 0.1,
        grain: 0.15,
      }),
      this.lanterns.length,
    );
    glassMesh.castShadow = false;
    glassMesh.name = 'festival-lantern-glass';
    this.instanced.push(glassMesh);
    this.group.add(glassMesh);

    const tint = new Color();
    for (let i = 0; i < this.lanterns.length; i++) {
      // The per-instance colour multiplies the emissive as well as the
      // albedo, which is what lets one draw call carry the whole warm family
      // — the same trick the campfire's coal bed uses to be bright in one
      // place and charred right beside it.
      tint.setHex(mixColor(LAMP_HUES[hues[i]], palette.accent, LAMP_ACCENT_MIX));
      glassMesh.setColorAt(i, tint);
    }
    // Placed once here so the first rendered frame is not a pile of lamps at
    // the origin waiting for `update`.
    this.lampMeshes = [capMesh, glassMesh];
    this.update(0, 0);
  }

  /**
   * The stage: planks, and two banners saying which way to face.
   *
   * Knee-high, because that is the height at which a platform reads as a
   * stage rather than as a wall — you can see the whole of somebody standing
   * on it, which is the entire purpose of the thing. Built as separate planks
   * with a hair of gap between them so the top is a run of lines rather than
   * one flat lid, the same note the seat log is built for.
   */
  private buildStage(
    rand: Rand,
    palette: BiomePalette,
    localGround: (x: number, z: number) => number,
  ): void {
    const group = new Group();
    group.name = 'festival-stage';
    const baseY = localGround(0, STAGE_Z);
    // Off the camera's axis by a metre, for the reason `STALL_SPOTS` gives.
    // The stage may sit nearer that axis than anything else here — it is what
    // the whole grounds are pointing at — but its banner poles are the two
    // tallest things in the picture after the trees, and one of those in the
    // bard's own column is the fault this shift exists to avoid.
    group.position.set(-1.0 + randRange(rand, -0.3, 0.3), baseY, STAGE_Z);
    group.rotation.y = randRange(rand, -0.12, 0.12);
    this.group.add(group);

    const timber = this.solid({
      color: TIMBER_COLOR,
      colorVariant: 0x8a6b48,
      grain: 0.5,
      grainScale: 1.4,
      rim: 0.32,
      baseShade: 0.24,
      baseShadeHeight: 0.5,
    });
    const dark = this.solid({
      color: TIMBER_DARK,
      colorVariant: TIMBER_COLOR,
      grain: 0.55,
      rim: 0.3,
    });

    // The frame under the planks: one squat box, slightly inset, so the deck
    // overhangs it and the stage has a shadow line along its front edge.
    const frame = new Mesh(
      this.keep(taperedBox(STAGE_WIDTH_M * 0.94, STAGE_HEIGHT_M - 0.07, STAGE_DEPTH_M * 0.9)),
      dark,
    );
    frame.position.y = -0.03;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const plankDepth = STAGE_DEPTH_M / STAGE_PLANKS;
    const plankGeometry = this.keep(
      taperedBox(STAGE_WIDTH_M, 0.075, plankDepth * 0.88),
    );
    const deck = new InstancedMesh(plankGeometry, timber, STAGE_PLANKS);
    deck.castShadow = true;
    deck.receiveShadow = true;
    deck.name = 'festival-stage-deck';
    this.instanced.push(deck);
    for (let i = 0; i < STAGE_PLANKS; i++) {
      this.dummy.position.set(
        0,
        STAGE_HEIGHT_M - 0.075 + randRange(rand, -0.008, 0.008),
        -STAGE_DEPTH_M / 2 + plankDepth * (i + 0.5),
      );
      this.dummy.rotation.set(0, randRange(rand, -0.012, 0.012), 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      deck.setMatrixAt(i, this.dummy.matrix);
    }
    group.add(deck);

    // The banner poles, at the back corners so the cloth stands behind
    // whoever is on the boards rather than in front of them.
    const poleGeometry = this.keep(taperedBox(0.09, STAGE_POLE_H_M, 0.09, 0.72));
    const bannerCloth = this.solid({
      color: mixColor(AWNING_CANVAS, palette.accent, BANNER_MIX),
      colorVariant: palette.accentAlt,
      rim: 0.55,
      grain: 0.45,
      grainScale: 1.2,
    });
    // A thin prism rather than a plane, for the reason the busk pitch's
    // banner is one: a single quad is invisible from behind, and the resting
    // camera is not the only angle this is ever seen from.
    const bannerGeometry = this.keep(
      translatedY(taperedBox(BANNER_W_M, BANNER_H_M, 0.05, 0.62, 0.62), -BANNER_H_M),
    );
    for (const sx of [-1, 1] as const) {
      const pole = new Mesh(poleGeometry, dark);
      pole.position.set(sx * (STAGE_WIDTH_M / 2 - 0.14), 0, -STAGE_DEPTH_M / 2 + 0.14);
      pole.rotation.z = sx * -0.02;
      pole.castShadow = true;
      group.add(pole);

      const banner = new Mesh(bannerGeometry, bannerCloth);
      banner.position.set(
        sx * (STAGE_WIDTH_M / 2 - 0.14),
        STAGE_POLE_H_M - 0.1,
        -STAGE_DEPTH_M / 2 + 0.14 + 0.05,
      );
      banner.rotation.y = randRange(rand, -0.1, 0.1);
      banner.castShadow = true;
      group.add(banner);
    }
  }

  /**
   * The stalls, shut for the night.
   *
   * No goods, no keeper, no light of their own: a market at midnight is
   * boards and canvas, and drawing it open would say the festival is
   * happening *now* when the whole point of the eve is that it happens
   * tomorrow. What they are for is silhouette — three broad, roofed masses
   * behind the lantern lines, so the lines have depth to be strung across.
   */
  private buildStalls(
    rand: Rand,
    palette: BiomePalette,
    localGround: (x: number, z: number) => number,
  ): void {
    const timber = this.solid({
      color: TIMBER_COLOR,
      colorVariant: TIMBER_DARK,
      grain: 0.5,
      rim: 0.34,
    });

    for (let i = 0; i < STALL_COUNT; i++) {
      const [sx, sz] = STALL_SPOTS[i];
      const x = sx + randRange(rand, -0.4, 0.4);
      const z = sz + randRange(rand, -0.4, 0.4);
      const group = new Group();
      group.name = `festival-stall-${i}`;
      group.position.set(x, localGround(x, z), z);
      // Turned to face roughly back down the grounds, so the awnings are
      // seen from under their slope rather than end-on.
      group.rotation.y = Math.PI + randRange(rand, -0.5, 0.5);
      this.group.add(group);

      const width = randRange(rand, STALL_WIDTH_M[0], STALL_WIDTH_M[1]);
      const front = randRange(rand, STALL_POST_H_M[0], STALL_POST_H_M[1]);
      // The back posts are shorter, which is what tips the awning.
      const back = front - randRange(rand, 0.3, 0.5);
      const halfW = width / 2 - 0.09;
      const halfD = STALL_DEPTH_M / 2;

      const postGeometry = this.keep(taperedBox(0.09, 1, 0.09, 0.8));
      const postMesh = new InstancedMesh(postGeometry, timber, 4);
      postMesh.castShadow = true;
      postMesh.name = `festival-stall-${i}-posts`;
      this.instanced.push(postMesh);
      let p = 0;
      for (const px of [-halfW, halfW] as const) {
        for (const pz of [-halfD, halfD] as const) {
          this.dummy.position.set(px, 0, pz);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, pz < 0 ? front : back, 1);
          this.dummy.updateMatrix();
          postMesh.setMatrixAt(p++, this.dummy.matrix);
        }
      }
      group.add(postMesh);

      // The awning: one slab across the posts, pitched by the height
      // difference between front and back. Two thicknesses of cloth is a
      // tent; one board's worth is a stall.
      const slope = Math.atan2(front - back, STALL_DEPTH_M);
      const awningLength = Math.hypot(STALL_DEPTH_M, front - back) + 0.34;
      const awning = new Mesh(
        this.keep(taperedBox(width + 0.22, 0.06, awningLength)),
        this.solid({
          color: mixColor(AWNING_CANVAS, palette.accent, AWNING_MIX[i % AWNING_MIX.length]),
          colorVariant: mixColor(AWNING_CANVAS, palette.accentAlt, 0.3),
          rim: 0.5,
          grain: 0.5,
          grainScale: 1.3,
        }),
      );
      awning.position.set(0, (front + back) / 2, 0);
      awning.rotation.x = -slope;
      awning.castShadow = true;
      group.add(awning);

      // The counter: a plain box across the front, waist high. It is the
      // one piece that says which side of this a person stands on.
      const counter = new Mesh(
        this.keep(taperedBox(width * 0.9, 0.9, 0.4, 1.05)),
        this.solid({
          color: TIMBER_DARK,
          colorVariant: TIMBER_COLOR,
          grain: 0.55,
          rim: 0.3,
          baseShade: 0.26,
          baseShadeHeight: 0.4,
        }),
      );
      counter.position.set(0, 0, -halfD + 0.1);
      counter.castShadow = true;
      counter.receiveShadow = true;
      group.add(counter);
    }
  }

  /**
   * The ground under the grounds.
   *
   * The same additive, terrain-draped, alpha-falloff disc the camp lantern
   * casts, stretched into an ellipse and run at half its strength. It is not
   * a light — nothing here reads `pointLights[]` and the shader's one hearth
   * term belongs to the fire — it is a painted mark, and it exists because of
   * a measured fault rather than for atmosphere: the night frame's problem is
   * that 59% of it sits under L*10, so the stalls and the stage would be
   * black shapes on black ground and read as nothing at all. A faint warm
   * lift under them puts a mid value behind the silhouettes, which is what
   * makes them silhouettes.
   *
   * Held at a constant strength. It is a field of steady lamps, not a fire,
   * and a second thing pulsing on the flame's rhythm would say the two are
   * the same source.
   */
  private buildPool(
    rand: Rand,
    palette: BiomePalette,
    localGround: (x: number, z: number) => number,
  ): void {
    const segments = 26;
    const rings = 6;
    const positions: number[] = [];
    const falloffs: number[] = [];
    const jitter: number[] = [];
    for (let i = 0; i < (rings + 1) * segments; i++) jitter.push(rand());

    const vertex = (ring: number, segment: number) => {
      const s = ((segment % segments) + segments) % segments;
      const angle = (s / segments) * Math.PI * 2;
      const t = ring / rings;
      const rough = Math.pow(t, 2.2);
      const draw = jitter[ring * segments + s];
      const wobble = 1 + (draw - 0.5) * 0.45 * rough;
      const dx = Math.sin(angle) * t * POOL_RADIUS_X_M * wobble;
      const dz = Math.cos(angle) * t * POOL_RADIUS_Z_M * wobble + POOL_CENTRE_Z;
      positions.push(dx, localGround(dx, dz) + 0.04, dz);
      const f = 1 - t;
      const eased = Math.pow(f, 1.4);
      const close = Math.min(1, f / 0.25);
      const shut = close * close * close * (close * (close * 6 - 15) + 10);
      falloffs.push(eased * shut * (1 - rough * 0.5 * draw));
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

    const material = this.track(
      new ShaderMaterial({
        uniforms: {
          uColor: {
            value: new Color(mixColor(LAMP_HUES[0], palette.accent, 0.35)).multiplyScalar(0.9),
          },
          uStrength: { value: POOL_STRENGTH },
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

    const mesh = new Mesh(geometry, material);
    // Behind both of the camp's pools in the queue, so where any of them
    // overlap the fire is still the one that wins.
    mesh.renderOrder = 2;
    mesh.name = 'festival-grounds-pool';
    this.group.add(mesh);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    // From an explicit list rather than by traversal: several meshes share a
    // geometry, and a traversal would dispose those twice.
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    for (const mesh of this.instanced) mesh.dispose();
    this.instanced.length = 0;
    this.lampMeshes = [];
    this.lanterns.length = 0;
    this.group.clear();
  }
}

// --- geometry ----------------------------------------------------------

/**
 * A tapered box, running from y = 0 to y = height about its own origin.
 *
 * The grounds carry their own copy for the same reason the camp does: a
 * festival stall should not be able to reshape a bedroll as a side effect.
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
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Shift a geometry along Y, so a hanging thing can be built about its hook. */
function translatedY(geometry: BufferGeometry, dy: number): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, position.getY(i) + dy);
  }
  position.needsUpdate = true;
  return geometry;
}
