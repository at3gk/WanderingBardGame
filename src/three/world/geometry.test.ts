/**
 * Geometry shape tests.
 *
 * These exist because of a bug that survived roughly forty runs, several
 * careful readings of this file, a full art critique and a headless shader
 * check: **every blade of grass in the game was concave.**
 *
 * `bladeGeometry` puts a blade's waist at `midY` and its tip at `tipOut`.
 * A blade is straight when its waist sits at the same fraction of the way
 * out as it does up; less than that and the blade hugs the vertical and then
 * hooks outward at the very end, which is the silhouette of a claw, not of a
 * plant. The waist was at 0.24 of the tip's travel with the tip 0.5 of the
 * way up — barely half of straight — so five of them fanned from one root
 * read as a spike-star, and the meadow read as a scattering of asterisks.
 *
 * Nothing caught it. It type-checked, no unit test touched this module, and
 * `shader-check` only ever asked whether pixels drew. The only thing that
 * *could* have caught it was a human looking at a screenshot and saying "why
 * is the grass spiky", which is exactly the review step an autonomous project
 * does not get.
 *
 * So the shape invariants that carry the art direction are pinned here, in
 * arithmetic, where a future change that flattens a silhouette fails a test
 * instead of quietly shipping. These are deliberately loose — they pin the
 * *sign* of a shape decision, not a tuned number, so ordinary art tuning
 * stays free and only a reversal trips them.
 */
import { describe, expect, it } from 'vitest';
// A value import, not a type import: the AO tests below build their own
// geometries rather than measuring the builders', because the shapes that
// pin a bake's behaviour (a bare quad, an inside corner) are ones no builder
// has any reason to make.
import { BufferAttribute, BufferGeometry } from 'three';
import {
  AO_FLOOR,
  AO_VERTEX_BUDGET,
  BUSK_LANTERN_R,
  BUSK_LANTERN_X,
  BUSK_LANTERN_Y,
  BUSK_POLE_HEIGHT_M,
  CAIRN_MARKER_HEIGHT_M,
  SMOKE_HEIGHT_M,
  SMOKE_PUFFS,
  bakeVertexAO,
  buskPitchGeometry,
  fallenLogGeometry,
  fernGeometry,
  grassTuftGeometry,
  lanternGlowGeometry,
  outwardFraction,
  reedClumpGeometry,
  rockGeometry,
  shrubGeometry,
  smokeColumnGeometry,
  waysideCairnGeometry,
} from './geometry';

/**
 * Vertices per blade: four triangles, unindexed.
 *
 * Three, until the blade's tip stopped being a single apex vertex and became
 * a short capping edge. The layout is base-left, base-right, waist-right /
 * base-left, waist-right, waist-left / waist-left, waist-right, tip-right /
 * waist-left, tip-right, tip-left.
 */
const BLADE_VERTS = 12;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function vertexAt(geometry: BufferGeometry, i: number): Vec3 {
  const position = geometry.attributes.position as BufferAttribute;
  return { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * How convex each blade of a fanned tuft is, as the fraction of the tip's
 * horizontal travel already spent by the waist.
 *
 * `bladeGeometry` emits a fixed, unindexed vertex layout per blade (see
 * `BLADE_VERTS`), so the root, the waist and the tip are all recoverable from
 * the merged buffer without the builder exposing anything extra. Reading them
 * positionally is a little blunt, but it means the test measures the geometry
 * that actually ships rather than a parallel re-implementation of the maths,
 * which is the only version worth pinning.
 */
function bladeConvexity(geometry: BufferGeometry): number[] {
  const position = geometry.attributes.position as BufferAttribute;
  const blades = Math.floor(position.count / BLADE_VERTS);
  const out: number[] = [];
  for (let b = 0; b < blades; b++) {
    const base = b * BLADE_VERTS;
    const root = midpoint(vertexAt(geometry, base), vertexAt(geometry, base + 1));
    const waist = midpoint(vertexAt(geometry, base + 6), vertexAt(geometry, base + 7));
    const tip = midpoint(vertexAt(geometry, base + 10), vertexAt(geometry, base + 11));
    const tipTravel = horizontalDistance(tip, root);
    // A blade with no lean at all has nothing to be convex about.
    if (tipTravel < 1e-6) continue;
    out.push(horizontalDistance(waist, root) / tipTravel);
  }
  return out;
}

/** Compass heading of each blade's tip, seen from the tuft's root patch. */
function bladeHeadings(geometry: BufferGeometry): number[] {
  const position = geometry.attributes.position as BufferAttribute;
  const blades = Math.floor(position.count / BLADE_VERTS);
  const out: number[] = [];
  for (let b = 0; b < blades; b++) {
    const base = b * BLADE_VERTS;
    const root = midpoint(vertexAt(geometry, base), vertexAt(geometry, base + 1));
    const tip = midpoint(vertexAt(geometry, base + 10), vertexAt(geometry, base + 11));
    out.push(Math.atan2(tip.z - root.z, tip.x - root.x));
  }
  return out;
}

/** Widest angle between any two headings, going the short way round. */
function headingSpread(headings: number[]): number {
  let widest = 0;
  for (let i = 0; i < headings.length; i++) {
    for (let j = i + 1; j < headings.length; j++) {
      let delta = Math.abs(headings[i] - headings[j]);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      widest = Math.max(widest, delta);
    }
  }
  return widest;
}

/** Enough seeds that one lucky tuft cannot carry the suite. */
const SEEDS = [7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 101, 977];

describe('grassTuftGeometry', () => {
  it('arches every blade outward rather than hooking it at the tip', () => {
    for (const seed of SEEDS) {
      const ratios = bladeConvexity(grassTuftGeometry(seed));
      expect(ratios.length).toBeGreaterThan(0);
      for (const ratio of ratios) {
        // The waist sits at 0.56 of the blade's height, so anything at or
        // below 0.56 of the tip's travel is straight-or-concave. 0.60 is that
        // line with a little air over it. The shipped value is ~0.68-0.72;
        // the bug this test exists for measured 0.24.
        expect(ratio).toBeGreaterThan(0.6);
      }
    }
  });

  it('fans the blades into a wedge, not a full rosette', () => {
    for (const seed of SEEDS) {
      const spread = headingSpread(bladeHeadings(grassTuftGeometry(seed)));
      // A tuft with a prevailing lean keeps its blades inside a wedge. Five
      // blades spread evenly around the whole circle — the old behaviour —
      // put two of them back to back and spread close to pi. The shipped
      // fan is ~1.0-1.5 rad of wedge, widened by per-blade jitter and by the
      // sideways curl at the tip; 2.6 is that total with room to tune inside.
      expect(spread).toBeLessThan(2.6);
    }
  });

  it('keeps every blade tip above the ground it grows out of', () => {
    for (const seed of SEEDS) {
      const geometry = grassTuftGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      let highest = 0;
      for (let i = 0; i < position.count; i++) {
        expect(position.getY(i)).toBeGreaterThanOrEqual(0);
        highest = Math.max(highest, position.getY(i));
      }
      // Ankle-to-shin on a 1.8 m bard, per the builder's own note. A tuft
      // that creeps up toward the knee turns the meadow into a hayfield.
      expect(highest).toBeGreaterThan(0.12);
      expect(highest).toBeLessThan(0.32);
    }
  });

  it('ends each blade in a capping edge rather than a point', () => {
    for (const seed of SEEDS) {
      const geometry = grassTuftGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      const blades = position.count / BLADE_VERTS;
      for (let b = 0; b < blades; b++) {
        const base = b * BLADE_VERTS;
        const tipLeft = vertexAt(geometry, base + 11);
        const tipRight = vertexAt(geometry, base + 10);
        const baseLeft = vertexAt(geometry, base);
        const baseRight = vertexAt(geometry, base + 1);
        const tipWidth = horizontalDistance(tipLeft, tipRight);
        const baseWidth = horizontalDistance(baseLeft, baseRight);
        // A real edge, not two coincident vertices dressed up as one.
        expect(tipWidth).toBeGreaterThan(0);
        // Still tapering — a tip as wide as the base is a ribbon, not a blade.
        expect(tipWidth).toBeLessThan(baseWidth * 0.7);
        // But wide enough to read as a tip. The needle this replaced measured
        // a 2.6:1 spine from a single apex vertex.
        expect(tipWidth).toBeGreaterThan(baseWidth * 0.15);
      }
    }
  });

  it('tilts blade normals toward the sky so a tuft is lit as ground', () => {
    for (const seed of SEEDS) {
      const normal = grassTuftGeometry(seed).attributes.normal as BufferAttribute;
      let sum = 0;
      for (let i = 0; i < normal.count; i++) sum += normal.getY(i);
      const mean = sum / normal.count;
      // A blade is a near-upright plane, so its geometric normal is near
      // horizontal and the lighting model treats it as a wall: the blades
      // facing away from the sun go black and the tuft reads as a dark
      // teepee. Grass has to be lit as a surface instead. Untilted, this mean
      // sits around zero.
      expect(mean).toBeGreaterThan(0.6);
      for (let i = 0; i < normal.count; i++) {
        // Still normalised, and never pointing into the ground.
        expect(normal.getY(i)).toBeGreaterThan(0);
        expect(
          Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)),
        ).toBeCloseTo(1, 5);
      }
    }
  });

  it('costs twenty triangles per tuft', () => {
    // Grass is drawn tens of thousands of times, so this is the one prop where
    // triangle count is a phone-frame-rate decision rather than a detail — and
    // therefore the one that should have to be changed on purpose.
    //
    // 15 until the blade tip stopped being a single apex vertex. That cost one
    // triangle per blade and bought the silhouette fix a critique had scored
    // as the single most damaging thing in the frame; the alternative on the
    // table (a second plane per blade, to stop an edge-on blade being a
    // one-pixel sliver) would have doubled it, and was declined for now.
    for (const seed of SEEDS) {
      const position = grassTuftGeometry(seed).attributes.position as BufferAttribute;
      expect(position.count / 3).toBe(20);
    }
  });
});

describe('ground cover keeps its volume', () => {
  /*
   * Ferns and reeds already arch — `fernGeometry`'s doc comment is where the
   * lesson grass was missing had been written down all along. Pinning them
   * too means the next pass over this file cannot flatten one while fixing
   * another, which is the failure mode of art tuning without tests.
   */
  it('gives a fern volume by lifting geometry off its own base plane', () => {
    for (const seed of [9, 15, 27, 33]) {
      const geometry = fernGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      let highest = 0;
      let above = 0;
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        highest = Math.max(highest, y);
        if (y > 0.02) above++;
      }
      expect(highest).toBeGreaterThan(0.1);
      // A frond built as a flat shard lying at an angle has almost every
      // vertex on the floor. An arching one does not.
      expect(above / position.count).toBeGreaterThan(0.3);
    }
  });

  it('builds a reed clump taller than it is wide', () => {
    for (const seed of [21, 45, 63]) {
      const geometry = reedClumpGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      let highest = 0;
      let widest = 0;
      for (let i = 0; i < position.count; i++) {
        highest = Math.max(highest, position.getY(i));
        widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)));
      }
      // Reeds stand. A clump wider than it is tall is a puddle of leaves.
      expect(highest).toBeGreaterThan(widest);
    }
  });
});

/*
 * The three props the mid-distance has to tell apart.
 *
 * A critique of the walking frames found bush, boulder and log reading as one
 * rounded blob at different tints: all three were built from the same soft
 * primitive (`lumpDome`, or a capless tapered tube, which has a dome's outline
 * from the side), so at forty metres — where every internal detail is gone and
 * only the outline is doing work — the field was a scatter of identical lumps.
 *
 * What is pinned here is one shape *grammar* per prop, not a tuned number:
 * stone is faceted with its mass low, timber is a cylinder with a flat cut end,
 * scrub is a soft mound that sits down in the grass. Ordinary art tuning stays
 * free; a change that collapses two of them back into each other fails.
 */
function bounds(geometry: BufferGeometry): {
  minY: number;
  maxY: number;
  maxX: number;
  radius: number;
} {
  const position = geometry.attributes.position as BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = -Infinity;
  let radius = 0;
  for (let i = 0; i < position.count; i++) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
    maxX = Math.max(maxX, position.getX(i));
    radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
  }
  return { minY, maxY, maxX, radius };
}

/** Unit face normal of triangle `f`, from the geometry's own winding. */
function faceNormal(geometry: BufferGeometry, f: number): Vec3 {
  const a = vertexAt(geometry, f * 3);
  const b = vertexAt(geometry, f * 3 + 1);
  const c = vertexAt(geometry, f * 3 + 2);
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / length, y: ny / length, z: nz / length };
}

describe('props keep three separate silhouettes', () => {
  const PROP_SEEDS = [17, 23, 29, 41, 53, 71];

  it('carries a boulder’s mass in its lower half and caps it with a plane', () => {
    for (const seed of PROP_SEEDS) {
      const geometry = rockGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      const { minY, maxY } = bounds(geometry);
      // Where the widest section of the stone sits, as a fraction of its
      // height. A dome's widest ring is at its equator or above; a stone that
      // has settled carries it low, and that difference is most of what
      // separates the two outlines at distance.
      let widest = 0;
      let widestY = 0;
      for (let i = 0; i < position.count; i++) {
        const r = Math.hypot(position.getX(i), position.getZ(i));
        if (r > widest) {
          widest = r;
          widestY = position.getY(i);
        }
      }
      expect((widestY - minY) / (maxY - minY)).toBeLessThan(0.5);

      // A flat top, not an apex. The cap is a fan around its own centre, so
      // its faces all point within a few degrees of straight up even after
      // the cap is tilted.
      let flatTop = 0;
      const faces = Math.floor(position.count / 3);
      for (let f = 0; f < faces; f++) {
        const normal = faceNormal(geometry, f);
        if (normal.y > 0.8 && vertexAt(geometry, f * 3 + 1).y > minY + (maxY - minY) * 0.75) {
          flatTop++;
        }
      }
      expect(flatTop).toBeGreaterThanOrEqual(4);

      // And still low and wide overall — a boulder standing taller than it is
      // across stops being scatter and becomes a landmark.
      expect(maxY - minY).toBeLessThan(widest * 2);
    }
  });

  it('finishes a fallen log with a flat cut end', () => {
    for (const seed of PROP_SEEDS) {
      const geometry = fallenLogGeometry(seed);
      const position = geometry.attributes.position as BufferAttribute;
      const { maxX } = bounds(geometry);
      // The trunk lies along +X, so its far end is a disc of faces at the
      // extreme X pointing along the axis. Without them the tube is open and
      // renders — under a front-face-only material — as a hole with the ground
      // showing through, which is exactly a dome's outline from the side.
      let cut = 0;
      const faces = Math.floor(position.count / 3);
      for (let f = 0; f < faces; f++) {
        const onEnd =
          vertexAt(geometry, f * 3).x > maxX - 0.02 &&
          vertexAt(geometry, f * 3 + 1).x > maxX - 0.02 &&
          vertexAt(geometry, f * 3 + 2).x > maxX - 0.02;
        if (onEnd && faceNormal(geometry, f).x > 0.9) cut++;
      }
      expect(cut).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps a bush a low mound rather than a standing mass', () => {
    for (const seed of PROP_SEEDS) {
      const { minY, maxY, radius } = bounds(shrubGeometry(seed));
      // Half as tall as it is wide, at most. The bush is the one of the three
      // that stays soft, so the separation it owes the other two has to be
      // bought in height — and a waist-high dome beside a knee-high dome is
      // one shape at forty metres.
      expect(maxY - minY).toBeLessThan(radius);
    }
  });
});

/**
 * Stop dressing, pinned against the one thing it is for: being read from a
 * hundred metres of road away.
 *
 * The walking camera's eye sits about 2.2 m up and the horizon sits at eye
 * level, so that height is the line between "silhouetted against sky" and
 * "lost in the meadow". Every pin below is some version of that sentence —
 * they do not fix a single dimension, they fix which side of the eye line
 * each shape lands on, and the loudness ladder between the three kinds.
 */
describe('stop dressing', () => {
  const EYE_LINE_M = 2.2;
  const MARKER_SEEDS = [211, 223, 233, 359, 601, 749];
  const MARKER_OPTIONS = { timber: 0x6b543a, cloth: 0xc4653a, iron: 0x4a4a48 };
  const STONE_OPTIONS = { stone: 0x8a8f8a, roof: 0x5c6b52 };

  it('stands the busk pole well clear of a walker s eye line', () => {
    for (const seed of MARKER_SEEDS) {
      const { maxY } = bounds(buskPitchGeometry({ ...MARKER_OPTIONS, seed }));
      expect(maxY).toBeCloseTo(BUSK_POLE_HEIGHT_M, 5);
      // A metre of clearance, not a centimetre. The banner and the lantern
      // both hang below the top, so the pole has to overshoot the eye line by
      // enough that they are drawn against sky too.
      expect(maxY).toBeGreaterThan(EYE_LINE_M + 1);
    }
  });

  it('gives the pitch a base with mass in it, not just a line', () => {
    for (const seed of MARKER_SEEDS) {
      const geometry = buskPitchGeometry({ ...MARKER_OPTIONS, seed });
      const position = geometry.attributes.position as BufferAttribute;
      // Something standing away from the pole in the first half-metre of
      // height: the crates and the barrel. A pole on its own is a boundary
      // marker; a pole with things stacked at it is a pitch.
      let wide = 0;
      for (let i = 0; i < position.count; i++) {
        if (position.getY(i) < 0.55 && Math.hypot(position.getX(i), position.getZ(i)) > 0.5) wide++;
      }
      expect(wide).toBeGreaterThan(30);
    }
  });

  it('builds the lantern glass closed and facing outward', () => {
    const glass = lanternGlowGeometry();
    // An emissive mesh with a face turned inside out is a face that gets
    // culled, which puts a hole in the one warm mark in the frame.
    expect(outwardFraction(glass)).toBe(1);
    const { minY, maxY } = bounds(glass);
    expect((minY + maxY) / 2).toBeCloseTo(BUSK_LANTERN_Y, 5);
    expect(maxY - minY).toBeCloseTo(BUSK_LANTERN_R * 2.3, 5);
  });

  it('hangs the glass on the pole s own crossbar, not beside it', () => {
    const glass = lanternGlowGeometry();
    const pitch = buskPitchGeometry({ ...MARKER_OPTIONS, seed: 211 });
    const position = pitch.attributes.position as BufferAttribute;
    // Ironwork within a hand's breadth of the glass, above and below it: the
    // cap and the foot. The two geometries carry no shared transform, so
    // this is the only thing keeping them from drifting apart.
    let above = 0;
    let below = 0;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getX(i) - BUSK_LANTERN_X) > 0.25) continue;
      const dy = position.getY(i) - BUSK_LANTERN_Y;
      if (dy > 0.1 && dy < 0.5) above++;
      if (dy < -0.1 && dy > -0.5) below++;
    }
    expect(above).toBeGreaterThan(0);
    expect(below).toBeGreaterThan(0);
    expect(bounds(glass).maxY).toBeLessThan(BUSK_POLE_HEIGHT_M);
  });

  it('keeps the wayside marker quieter than the busk pitch', () => {
    for (const seed of MARKER_SEEDS) {
      const cairn = bounds(waysideCairnGeometry({ ...STONE_OPTIONS, seed }));
      // Clears the eye line, so it has sky behind its top and can be resolved
      // at a hundred metres...
      expect(cairn.maxY).toBeGreaterThan(EYE_LINE_M * 0.8);
      expect(cairn.maxY).toBeCloseTo(CAIRN_MARKER_HEIGHT_M, 5);
      // ...and no further. An encounter is a meeting, not a stage, and the
      // ladder between the two kinds is the whole of how a player tells at
      // distance which one they are walking toward.
      expect(cairn.maxY).toBeLessThan(BUSK_POLE_HEIGHT_M * 0.65);
    }
  });

  it('swells the smoke plume, then lets it give out, and breaks it up as it climbs', () => {
    const geometry = smokeColumnGeometry({ base: 0xf0e8dc, tip: 0xe4e8ec, seed: 233 });
    const position = geometry.attributes.position as BufferAttribute;
    // Two crossed heptagons per puff, each face doubled and reversed: five
    // triangles a fan, ten a plane, twenty a puff.
    const perPuff = 60;
    expect(position.count).toBe(SMOKE_PUFFS * perPuff);

    const anchors: number[] = [];
    const widths: number[] = [];
    for (let p = 0; p < SMOKE_PUFFS; p++) {
      let sumY = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = p * perPuff; i < (p + 1) * perPuff; i++) {
        sumY += position.getY(i);
        minX = Math.min(minX, position.getX(i));
        maxX = Math.max(maxX, position.getX(i));
      }
      // The mean rather than the mid-extent: the puffs are jittered per
      // corner now, so their extents are not symmetric about their own
      // centres and the mid-extent wobbles by a few centimetres.
      anchors.push(sumY / perPuff);
      widths.push(maxX - minX);
    }

    for (let p = 1; p < SMOKE_PUFFS; p++) {
      expect(anchors[p]).toBeGreaterThan(anchors[p - 1]);
    }
    // The gaps open out. This is the only fade the plume has: the shader
    // carries one opacity for the whole material and no per-vertex alpha, so
    // a column that stayed evenly stacked would end in a hard flat edge
    // eleven metres up and read as a grey monument. Measured over thirds
    // rather than pair by pair, because the per-puff jitter moves an
    // individual anchor further than one step of the profile does.
    const third = Math.floor(SMOKE_PUFFS / 3);
    const low = (anchors[third] - anchors[0]) / third;
    const high = (anchors[SMOKE_PUFFS - 1] - anchors[SMOKE_PUFFS - 1 - third]) / third;
    expect(high).toBeGreaterThan(low * 1.6);

    // It swells and then gives out. A column that is at its widest where it
    // leaves the frame draws a wedge — a thing getting stronger as it goes —
    // which is the opposite of what smoke does.
    const widest = widths.indexOf(Math.max(...widths));
    expect(widest).toBeGreaterThan(SMOKE_PUFFS * 0.4);
    expect(widest).toBeLessThan(SMOKE_PUFFS - 2);
    expect(widths[SMOKE_PUFFS - 1]).toBeLessThan(widths[widest] * 0.92);
    // And it is a thread, not a tower. At the resting camera's four metres a
    // plume four metres across is the second-largest mass in the frame.
    expect(Math.max(...widths)).toBeLessThan(2.8);

    expect(bounds(geometry).maxY).toBeGreaterThan(SMOKE_HEIGHT_M * 0.9);
  });

  it('draws the smoke well below the value it is handed', () => {
    // The caller owns the plume's hue; the module owns its value. Near-white
    // smoke at night was the second-brightest mass in the campfire frame,
    // lighter than the sky it was drawn over.
    const geometry = smokeColumnGeometry({ base: 0xf4ece0, tip: 0xeceef0, seed: 233 });
    const color = geometry.attributes.color as BufferAttribute;
    expect(color).toBeDefined();
    let brightest = 0;
    for (let i = 0; i < color.count; i++) {
      brightest = Math.max(brightest, color.getX(i), color.getY(i), color.getZ(i));
    }
    // 0xf4 is 0.957; anything near it is the old near-white plume.
    expect(brightest).toBeLessThan(0.45);
    expect(brightest).toBeGreaterThan(0.2);
  });

  it('roots the plume at the fire and leaves its top free to wander', () => {
    const geometry = smokeColumnGeometry({ base: 0xf0e8dc, tip: 0xe4e8ec, seed: 359 });
    const position = geometry.attributes.position as BufferAttribute;
    const sway = geometry.attributes.aSway as BufferAttribute;
    expect(sway).toBeDefined();
    let lowest = Infinity;
    let highest = -Infinity;
    let atLowest = 0;
    let atHighest = 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y < lowest) {
        lowest = y;
        atLowest = sway.getX(i);
      }
      if (y > highest) {
        highest = y;
        atHighest = sway.getX(i);
      }
    }
    expect(atLowest).toBeLessThan(0.05);
    expect(atHighest).toBeGreaterThan(0.8);
  });
});

/**
 * Baked vertex occlusion (ROADMAP 170).
 *
 * The bake is the first thing in this file whose output nobody can read off a
 * screenshot: it is a few per cent of albedo, in creases, under a cel ramp
 * that is already stepping the value. A regression in it would not look like
 * a bug — it would look like the art being slightly flatter than last week,
 * which is precisely the class of failure the notes at the top of this file
 * were written about.
 *
 * So four properties are pinned, and they are properties rather than numbers:
 * it is deterministic, it only ever darkens and never past its floor, a
 * surface with nothing to hide behind comes back untouched, and an inside
 * corner comes back darker than the open floor beside it. Tuning `strength`
 * or `samples` leaves all four true; getting the ray maths, the hemisphere or
 * the multiply wrong breaks at least one.
 */
describe('baked vertex occlusion', () => {
  /** Two triangles from four corners, wound so the normal comes out +Y-ish. */
  function quad(corners: number[][]): number[] {
    const [a, b, c, d] = corners;
    return [...a, ...b, ...c, ...a, ...c, ...d];
  }

  function geometryFrom(verts: number[]): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** A flat square metre of floor, facing up. Nothing can occlude anything. */
  function flatQuad(): BufferGeometry {
    return geometryFrom(
      quad([
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 0, 0],
      ]),
    );
  }

  /**
   * An inside corner: a floor with a wall standing across the near end of it.
   *
   * The wall passes *through* the floor's plane rather than meeting its edge,
   * and the floor starts a few centimetres clear of the wall rather than at
   * it. Both are deliberate, and they are how real geometry in this project
   * is built — a cairn's stones interpenetrate, a tree's lobes overlap. Two
   * quads meeting at an exact knife edge is the one arrangement a bake cannot
   * read, because the shared vertices lie *in* the occluder's plane, where
   * every ray either misses it or hits it at t = 0; a corner built that way
   * would come back unshaded and the test would be pinning an artifact.
   *
   * The wall is wider than the floor in x so the corner's shading does not
   * fall off at the ends, which would blur the comparison this makes.
   */
  function insideCorner(): BufferGeometry {
    const floor = quad([
      [0, 0, 0.05],
      [0, 0, 1.5],
      [1, 0, 1.5],
      [1, 0, 0.05],
    ]);
    const wall = quad([
      [-0.5, -0.2, 0],
      [1.5, -0.2, 0],
      [1.5, 1, 0],
      [-0.5, 1, 0],
    ]);
    return geometryFrom([...floor, ...wall]);
  }

  function colorsOf(geometry: BufferGeometry): Float32Array {
    const color = geometry.attributes.color as BufferAttribute;
    return color.array as Float32Array;
  }

  /** Mean AO of the floor vertices within `span` of the wall at z = 0. */
  function meanNear(geometry: BufferGeometry, from: number, to: number): number {
    const position = geometry.attributes.position as BufferAttribute;
    const colors = colorsOf(geometry);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < position.count; i++) {
      // Floor only: the wall's own vertices are a different surface.
      if (Math.abs(position.getY(i)) > 1e-6) continue;
      const z = position.getZ(i);
      if (z < from || z > to) continue;
      sum += colors[i * 3];
      n++;
    }
    expect(n).toBeGreaterThan(0);
    return sum / n;
  }

  it('bakes the same colours every time, from the same seed', () => {
    // The world is a pure function of the day's seed. A bake that wandered
    // between runs would give two players on the same road different trees,
    // and would change them under one player on a reload — a shimmer nobody
    // could ever attribute once they noticed it.
    const first = colorsOf(bakeVertexAO(insideCorner(), { seed: 4242 }));
    const second = colorsOf(bakeVertexAO(insideCorner(), { seed: 4242 }));
    expect(Array.from(second)).toEqual(Array.from(first));

    // And a *different* seed still has to be a valid bake, not a different
    // shape: same geometry, so the same creases, within the noise of sixteen
    // rays.
    const other = colorsOf(bakeVertexAO(insideCorner(), { seed: 9 }));
    for (let i = 0; i < first.length; i++) {
      expect(Math.abs(other[i] - first[i])).toBeLessThan(0.12);
    }
  });

  it('only ever darkens, and never past the floor', () => {
    const geometry = insideCorner();
    // A painted geometry, so the test proves the bake *multiplies* into
    // whatever colour a builder has already laid down rather than replacing
    // it — which is the whole contract with `paint` and `paintGradient`.
    const painted = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < painted.length; i += 3) {
      painted[i] = 0.8;
      painted[i + 1] = 0.6;
      painted[i + 2] = 0.4;
    }
    geometry.setAttribute('color', new BufferAttribute(painted.slice(), 3));

    bakeVertexAO(geometry, { seed: 31 });
    const colors = colorsOf(geometry);
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBeLessThanOrEqual(painted[i] + 1e-6);
      // Cosy games do not use black, and a crevice is not allowed to be the
      // darkest thing in the frame.
      expect(colors[i]).toBeGreaterThanOrEqual(painted[i] * AO_FLOOR - 1e-6);
    }
    // ...and something actually moved, or the two bounds above are vacuous.
    let darkened = 0;
    for (let i = 0; i < colors.length; i++) if (colors[i] < painted[i] - 1e-4) darkened++;
    expect(darkened).toBeGreaterThan(0);
  });

  it('leaves a surface with nothing to hide behind alone', () => {
    const colors = colorsOf(bakeVertexAO(flatQuad(), { seed: 77 }));
    for (let i = 0; i < colors.length; i++) expect(colors[i]).toBeCloseTo(1, 6);
  });

  it('darkens an inside corner and not the open floor beside it', () => {
    const geometry = bakeVertexAO(insideCorner(), { seed: 101 });
    const corner = meanNear(geometry, 0, 0.5);
    const open = meanNear(geometry, 1.4, 2);
    // The open floor is a metre and a half from the only other surface in
    // the scene, which is past the default reach: it should be untouched.
    expect(open).toBeGreaterThan(0.97);
    // And the corner should be visibly, but only visibly, darker. A tenth of
    // the albedo is about what a crease is worth at this scale; if this ever
    // reads as half, the strength dial has run away.
    expect(corner).toBeLessThan(open - 0.06);
    expect(corner).toBeGreaterThan(AO_FLOOR);
  });

  it('leaves a geometry over the vertex budget untouched', () => {
    // The guard is what keeps a future heavy shape from turning a chunk
    // stream into a dropped frame on a phone. It has to be a silent pass, not
    // a partial bake.
    const verts: number[] = [];
    const strips = Math.ceil(AO_VERTEX_BUDGET / 6) + 1;
    for (let i = 0; i < strips; i++) {
      verts.push(
        ...quad([
          [0, 0, i * 0.01],
          [0, 0, i * 0.01 + 0.01],
          [1, 0, i * 0.01 + 0.01],
          [1, 0, i * 0.01],
        ]),
      );
    }
    const geometry = geometryFrom(verts);
    expect(geometry.attributes.position.count).toBeGreaterThan(AO_VERTEX_BUDGET);
    bakeVertexAO(geometry, { seed: 5 });
    expect(geometry.attributes.color).toBeUndefined();
  });
});
