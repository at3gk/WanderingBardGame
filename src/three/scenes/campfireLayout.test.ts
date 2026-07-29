import { describe, expect, it } from 'vitest';
import {
  ROAD_CLEARANCE_M,
  SEAT_LOG_LENGTH_M,
  campfireLayout,
  layoutViolations,
  roadOffset,
  type CampfireLayout,
} from './campfireLayout';

/** A spread of headings covering both signs and the quadrant boundaries. */
const HEADINGS = [0, 0.31, -0.47, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, 2.8, -3.0];

/** Enough seeds that a one-in-a-hundred bad slot cannot hide. */
const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 13);

function shortestAngle(a: number, b: number): number {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** Rotate an anchor-relative point about the anchor, road-heading convention. */
function rotate(x: number, z: number, heading: number): { x: number; z: number } {
  return {
    x: x * Math.cos(heading) + z * Math.sin(heading),
    z: -x * Math.sin(heading) + z * Math.cos(heading),
  };
}

describe('campfireLayout — determinism', () => {
  it('is a pure function of its seed and heading', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const a = campfireLayout(seed, 0.4);
      const b = campfireLayout(seed, 0.4);
      expect(b).toEqual(a);
    }
  });

  it('gives different seeds different camps', () => {
    const fires = new Set(
      SEEDS.map((seed) => {
        const layout = campfireLayout(seed, 0);
        return `${layout.fire.x.toFixed(4)},${layout.fire.z.toFixed(4)}`;
      }),
    );
    expect(fires.size).toBe(SEEDS.length);
  });

  it('rotates rigidly with the heading and changes nothing else', () => {
    // The whole point of folding the heading into the coordinates: a camp on
    // a bend is the same camp, turned. If this ever fails, some slot has
    // started measuring from the world instead of from the road.
    for (const seed of SEEDS.slice(0, 40)) {
      const base = campfireLayout(seed, 0);
      for (const heading of HEADINGS) {
        const turned = campfireLayout(seed, heading);
        expect(turned.side).toBe(base.side);
        expect(turned.ringRadius).toBeCloseTo(base.ringRadius, 12);
        expect(turned.props.length).toBe(base.props.length);

        const fire = rotate(base.fire.x, base.fire.z, heading);
        expect(turned.fire.x).toBeCloseTo(fire.x, 9);
        expect(turned.fire.z).toBeCloseTo(fire.z, 9);

        for (let i = 0; i < base.props.length; i++) {
          const expected = rotate(base.props[i].x, base.props[i].z, heading);
          expect(turned.props[i].x).toBeCloseTo(expected.x, 9);
          expect(turned.props[i].z).toBeCloseTo(expected.z, 9);
          expect(turned.props[i].radius).toBeCloseTo(base.props[i].radius, 12);
          expect(
            shortestAngle(turned.props[i].rotation, base.props[i].rotation + heading),
          ).toBeCloseTo(0, 9);
        }

        const seat = rotate(base.seat.x, base.seat.z, heading);
        expect(turned.seat.x).toBeCloseTo(seat.x, 9);
        expect(turned.seat.z).toBeCloseTo(seat.z, 9);
        expect(shortestAngle(turned.seat.heading, base.seat.heading + heading)).toBeCloseTo(0, 9);
      }
    }
  });
});

describe('campfireLayout — invariants', () => {
  const layouts: CampfireLayout[] = [];
  for (const seed of SEEDS) {
    for (const heading of HEADINGS) layouts.push(campfireLayout(seed, heading));
  }

  it('produces a valid camp for every seed and heading', () => {
    const failures: string[] = [];
    for (const layout of layouts) {
      for (const problem of layoutViolations(layout)) {
        failures.push(`seed ${layout.seed} @ ${layout.heading.toFixed(2)}: ${problem}`);
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it('keeps every prop out of the fire', () => {
    for (const layout of layouts) {
      for (const prop of layout.props) {
        const toFire = Math.hypot(prop.x - layout.fire.x, prop.z - layout.fire.z);
        expect(toFire - prop.footprint).toBeGreaterThan(layout.flameRadius);
      }
    }
  });

  it('keeps the whole camp off the road', () => {
    for (const layout of layouts) {
      for (const prop of layout.props) {
        const lateral = Math.abs(roadOffset(prop.x, prop.z, layout.heading));
        expect(lateral - prop.footprint).toBeGreaterThan(ROAD_CLEARANCE_M);
      }
      const seatLateral = Math.abs(roadOffset(layout.seat.x, layout.seat.z, layout.heading));
      expect(seatLateral - layout.seat.footprint).toBeGreaterThan(ROAD_CLEARANCE_M);
    }
  });

  it('never overlaps two props, except stones with stones', () => {
    // The violations are collected and asserted once, rather than an
    // `expect` per pair. Four hundred seeds times every pair of props is a
    // few hundred thousand assertions, and building a matcher is far more
    // expensive than the arithmetic it checks: this test took 2.5 s alone
    // and 13.5 s when the suite ran it alongside everything else, against
    // vitest's 5 s default. It failed in CI as a timeout, which reads
    // exactly like a broken invariant and is not one.
    //
    // Coverage is unchanged — same seeds, same pairs. The failure message is
    // better for it too: a bare `expect(gap).toBeGreaterThan(0)` inside the
    // loop said only that some gap somewhere was negative.
    const overlaps: string[] = [];
    for (const layout of layouts) {
      const props = layout.props;
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          if (props[i].kind === 'stone' && props[j].kind === 'stone') continue;
          const gap =
            Math.hypot(props[i].x - props[j].x, props[i].z - props[j].z) -
            props[i].footprint -
            props[j].footprint;
          if (gap <= 0) {
            overlaps.push(`${props[i].kind}/${props[j].kind} overlap by ${(-gap).toFixed(3)} m`);
          }
        }
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('leaves the seat clear of everything', () => {
    for (const layout of layouts) {
      for (const prop of layout.props) {
        const gap =
          Math.hypot(prop.x - layout.seat.x, prop.z - layout.seat.z) -
          prop.footprint -
          layout.seat.footprint;
        expect(gap).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the seat log inside the seat it lies in', () => {
    // The seat holds a felled log now, laid across the line to the fire so
    // the bard sits astride it facing the flame. Every other check in this
    // file measures the seat as a disc of `footprint`, so the log is only
    // covered by them for as long as it fits inside that disc — and the ends
    // are what leave it. Checked against the real end points rather than
    // against the length alone, because "it fits in the disc" and "the ends
    // are where the disc says" are two claims and only the second one is
    // what the built camp actually depends on.
    expect(SEAT_LOG_LENGTH_M / 2).toBeLessThanOrEqual(0.45);
    // Collected and asserted once, for the same reason as the overlap check
    // above: an expect per prop per end per seed is what made this file time
    // out under a loaded suite.
    const escapes: string[] = [];
    for (const layout of layouts) {
      const { seat, fire, heading } = layout;
      if (SEAT_LOG_LENGTH_M / 2 > seat.footprint) escapes.push('log longer than its seat');
      // Across the facing, which is the axis the builder lays it along.
      const across = seat.heading + Math.PI / 2;
      for (const end of [1, -1]) {
        const x = seat.x + Math.sin(across) * end * (SEAT_LOG_LENGTH_M / 2);
        const z = seat.z + Math.cos(across) * end * (SEAT_LOG_LENGTH_M / 2);
        if (Math.abs(roadOffset(x, z, heading)) <= ROAD_CLEARANCE_M) escapes.push('log end on the road');
        if (Math.hypot(x - fire.x, z - fire.z) <= layout.flameRadius) escapes.push('log end in the fire');
        for (const prop of layout.props) {
          if (prop.kind === 'stone') continue;
          if (Math.hypot(x - prop.x, z - prop.z) <= prop.footprint) {
            escapes.push(`log end inside the ${prop.kind}`);
          }
        }
      }
    }
    expect(escapes).toEqual([]);
  });

  it('puts the bedroll on the far side of the fire from the road', () => {
    for (const layout of layouts) {
      const fireOffset = roadOffset(layout.fire.x, layout.fire.z, layout.heading);
      const bedroll = layout.props.find((p) => p.kind === 'bedroll');
      expect(bedroll).toBeDefined();
      const bedrollOffset = roadOffset(bedroll!.x, bedroll!.z, layout.heading);
      // Signed, so this is "further out", not merely "further away".
      expect(Math.sign(fireOffset) * (bedrollOffset - fireOffset)).toBeGreaterThan(0.5);
    }
  });

  it('puts the seat between the road and the fire, facing the fire', () => {
    for (const layout of layouts) {
      const fireOffset = roadOffset(layout.fire.x, layout.fire.z, layout.heading);
      const seatOffset = roadOffset(layout.seat.x, layout.seat.z, layout.heading);
      expect(Math.abs(seatOffset)).toBeLessThan(Math.abs(fireOffset));

      // The seat heading must point at the fire, within the slot's jitter.
      const toFire = Math.atan2(layout.fire.x - layout.seat.x, layout.fire.z - layout.seat.z);
      expect(Math.abs(shortestAngle(layout.seat.heading, toFire))).toBeLessThan(1e-9);
    }
  });

  it('lays the fire inside its own ring', () => {
    for (const layout of layouts) {
      expect(layout.logs.length).toBeGreaterThanOrEqual(3);
      for (const log of layout.logs) {
        const reach = Math.hypot(log.dx, log.dz) + (log.length / 2) * Math.cos(log.tilt);
        expect(reach).toBeLessThan(layout.ringRadius);
      }
    }
  });

  it('builds a ring that actually closes', () => {
    // Consecutive stones must be near enough to read as one ring. Without
    // this the "stones may touch" exemption above would silently allow a
    // scatter of pebbles to pass every other test.
    for (const layout of layouts) {
      const stones = layout.props.filter((p) => p.kind === 'stone');
      expect(stones.length).toBeGreaterThanOrEqual(7);
      for (let i = 0; i < stones.length; i++) {
        const a = stones[i];
        const b = stones[(i + 1) % stones.length];
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.footprint - b.footprint;
        expect(gap).toBeLessThan(0.14);
      }
    }
  });

  it('reports an extent that covers the camp', () => {
    // Callers use `extent` to decide what to keep out of the camp — trees
    // are scattered as close as 4.9 m to the centreline, which is inside it.
    // So this checks every term, not just the props: dropping the seat would
    // let the streamer plant a tree on the bard and every other test here
    // would still pass.
    for (const layout of layouts) {
      for (const prop of layout.props) {
        expect(prop.radius + prop.footprint).toBeLessThanOrEqual(layout.extent + 1e-9);
      }
      const seatRadius = Math.hypot(
        layout.seat.x - layout.fire.x,
        layout.seat.z - layout.fire.z,
      );
      expect(seatRadius + layout.seat.footprint).toBeLessThanOrEqual(layout.extent + 1e-9);
      expect(layout.ringRadius).toBeLessThanOrEqual(layout.extent + 1e-9);
    }
  });
});

