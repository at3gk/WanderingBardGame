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
import type { BufferAttribute, BufferGeometry } from 'three';
import {
  fallenLogGeometry,
  fernGeometry,
  grassTuftGeometry,
  reedClumpGeometry,
  rockGeometry,
  shrubGeometry,
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
