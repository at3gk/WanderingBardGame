/**
 * The wayside sentinel cadence — task 167, "no framing without an anchor".
 *
 * Task 180 put a large verge tree per chunk so frames crop canopy through
 * their edges; the wave-9 panel still found empty edges on eight of ten
 * frames, because the system leaked three ways: 15% of chunks rolled no
 * sentinel, an exclusion collision silently deleted the tree, and a uniform
 * draw let gaps cluster. None of those failures is loud — a missing tree
 * looks exactly like a tree that was never owed — so the guarantee is
 * pinned here in arithmetic: **every chunk holds a sentinel, no two
 * consecutive sentinels are further apart than the band allows, and an
 * exclusion moves a tree rather than deleting it.**
 */
import { describe, expect, it } from 'vitest';
import { generateRoad, type DailyRoad } from '../../core/road';
import {
  CHUNK_LENGTH,
  ROAD_HALF_WIDTH,
  waysideSentinelSites,
  type WaysideSentinelSite,
} from './WorldStreamer';

const never = () => false;

const ROADS: DailyRoad[] = [];
for (let i = 0; i < 24; i++) ROADS.push(generateRoad(4200 + i * 7919, `2026-08-${(i % 28) + 1}`));

function chunksOf(road: DailyRoad): number {
  return Math.floor(road.lengthM / CHUNK_LENGTH);
}

function guaranteedSites(road: DailyRoad): WaysideSentinelSite[] {
  const sites: WaysideSentinelSite[] = [];
  for (let index = 0; index < chunksOf(road); index++) {
    sites.push(...waysideSentinelSites(road, index, never));
  }
  return sites.sort((a, b) => a.s - b.s);
}

describe('the guarantee', () => {
  it('gives every chunk at least one sentinel', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        expect(waysideSentinelSites(road, index, never).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never lets two consecutive sentinels drift further apart than the band allows', () => {
    // The guaranteed slot sits in [0.2, 0.8] of its chunk, so the worst
    // adjacent pair is (1 - 0.2 + 0.8) x CHUNK_LENGTH = 96 m. This is the
    // number that makes the cadence a rule rather than a habit.
    const worst = 1.6 * CHUNK_LENGTH + 1e-6;
    for (const road of ROADS) {
      const sites = guaranteedSites(road);
      for (let i = 1; i < sites.length; i++) {
        expect(sites[i].s - sites[i - 1].s).toBeLessThanOrEqual(worst);
      }
    }
  });

  it('keeps the guaranteed sentinel inside its chunk central band', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        const first = waysideSentinelSites(road, index, never)[0];
        const inChunk = first.s - index * CHUNK_LENGTH;
        expect(inChunk).toBeGreaterThanOrEqual(0.2 * CHUNK_LENGTH);
        expect(inChunk).toBeLessThanOrEqual(0.8 * CHUNK_LENGTH);
      }
    }
  });
});

describe('where a sentinel may stand', () => {
  it('stays off the carriageway and inside the near verge band', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        for (const site of waysideSentinelSites(road, index, never)) {
          expect(Math.abs(site.u)).toBeGreaterThanOrEqual(ROAD_HALF_WIDTH + 2.8);
          expect(Math.abs(site.u)).toBeLessThanOrEqual(ROAD_HALF_WIDTH + 4.2);
        }
      }
    }
  });

  it('stands sentinels on both sides of the road across a day', () => {
    // Sides alternate by chunk parity so the road reads as passing between
    // trees, not along a hedge. If every site came out one side, the parity
    // logic broke.
    for (const road of ROADS) {
      const sites = guaranteedSites(road);
      expect(sites.some((site) => site.u < 0)).toBe(true);
      expect(sites.some((site) => site.u > 0)).toBe(true);
    }
  });
});

describe('exclusions move the tree instead of deleting it', () => {
  it('still finds a site when the first half of the band is excluded', () => {
    for (const road of ROADS) {
      for (let index = 2; index < Math.min(8, chunksOf(road)); index++) {
        const mid = index * CHUNK_LENGTH + 0.5 * CHUNK_LENGTH;
        const sites = waysideSentinelSites(road, index, (s) => s < mid);
        expect(sites.length).toBeGreaterThanOrEqual(1);
        for (const site of sites) expect(site.s).toBeGreaterThanOrEqual(mid);
      }
    }
  });

  it('returns nothing, without spinning, when everything is excluded', () => {
    const road = ROADS[0];
    expect(waysideSentinelSites(road, 3, () => true)).toEqual([]);
  });

  it('cannot let one slot exclusion reshuffle the other slot', () => {
    // Each slot draws from its own subseeded stream, so crowding slot 0
    // may move slot 0 but must leave a second sentinel exactly where the
    // unexcluded road put it.
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        const free = waysideSentinelSites(road, index, never);
        // Needs a second slot, and one the crowding predicate cannot touch.
        if (free.length < 2 || free[1].s < free[0].s + 0.5) continue;
        const crowded = waysideSentinelSites(road, index, (s) => s < free[0].s + 0.5);
        const second = crowded.find((site) => site.seed === free[1].seed);
        expect(second).toBeDefined();
        expect(second!.s).toBe(free[1].s);
        expect(second!.u).toBe(free[1].u);
      }
    }
  });
});

describe('the day is the same for everyone', () => {
  it('returns identical sites for identical inputs', () => {
    for (const road of ROADS.slice(0, 4)) {
      for (let index = 0; index < chunksOf(road); index++) {
        expect(waysideSentinelSites(road, index, never)).toEqual(
          waysideSentinelSites(road, index, never),
        );
      }
    }
  });
});
