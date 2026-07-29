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
import { grassTuftGeometry, fernGeometry, reedClumpGeometry } from './geometry';

/** Vertices per blade: three triangles, unindexed. */
const BLADE_VERTS = 9;

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
 * `bladeGeometry` emits a fixed, unindexed vertex layout per blade —
 * base-left, base-right, waist-right / base-left, waist-right, waist-left /
 * waist-left, waist-right, tip — so the root, the waist and the tip are all
 * recoverable from the merged buffer without the builder exposing anything
 * extra. Reading them positionally is a little blunt, but it means the test
 * measures the geometry that actually ships rather than a parallel
 * re-implementation of the maths, which is the only version worth pinning.
 */
function bladeConvexity(geometry: BufferGeometry): number[] {
  const position = geometry.attributes.position as BufferAttribute;
  const blades = Math.floor(position.count / BLADE_VERTS);
  const out: number[] = [];
  for (let b = 0; b < blades; b++) {
    const base = b * BLADE_VERTS;
    const root = midpoint(vertexAt(geometry, base), vertexAt(geometry, base + 1));
    const waist = midpoint(vertexAt(geometry, base + 6), vertexAt(geometry, base + 7));
    const tip = vertexAt(geometry, base + 8);
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
    const tip = vertexAt(geometry, base + 8);
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

  it('costs the same fifteen triangles it always did', () => {
    // The silhouette fix was explicitly required to be free: grass is drawn
    // tens of thousands of times and this is the one prop where triangle
    // count is a phone-frame-rate decision rather than a detail. If a future
    // pass wants more geometry per tuft it should have to change this number
    // deliberately.
    for (const seed of SEEDS) {
      const position = grassTuftGeometry(seed).attributes.position as BufferAttribute;
      expect(position.count / 3).toBe(15);
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
