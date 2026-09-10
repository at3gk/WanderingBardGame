/**
 * The large-form scatter anchor guarantee — task 190 piece 1, "no side
 * without an anchor" for rock/shrub/log, the wayside-sentinel treatment
 * `waysideSentinels.test.ts` already pins for trees. See
 * `largeFormAnchorSites`'s own section comment in WorldStreamer.ts for why
 * this exists and what it deliberately does not promise (no camera-aware
 * placement, no guarantee inside a specific screen quadrant — only a
 * cadence, exactly like the tree guarantee it mirrors).
 */
import { describe, expect, it } from 'vitest';
import { generateRoad, type DailyRoad } from '../../core/road';
import {
  CHUNK_LENGTH,
  ROAD_HALF_WIDTH,
  largeFormAnchorSites,
  type LargeFormAnchorSite,
} from './WorldStreamer';

const never = () => false;

const ROADS: DailyRoad[] = [];
for (let i = 0; i < 24; i++) ROADS.push(generateRoad(4200 + i * 7919, `2026-08-${(i % 28) + 1}`));

function chunksOf(road: DailyRoad): number {
  return Math.floor(road.lengthM / CHUNK_LENGTH);
}

function guaranteedSites(road: DailyRoad): LargeFormAnchorSite[] {
  const sites: LargeFormAnchorSite[] = [];
  for (let index = 0; index < chunksOf(road); index++) {
    sites.push(...largeFormAnchorSites(road, index, never));
  }
  return sites.sort((a, b) => a.s - b.s);
}

describe('the guarantee', () => {
  it('gives every chunk at least one large-form anchor', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        expect(largeFormAnchorSites(road, index, never).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never lets two consecutive anchors drift further apart than the band allows', () => {
    // Same arithmetic as the tree guarantee: the slot sits in [0.2, 0.8] of
    // its chunk, so the worst adjacent pair is (1 - 0.2 + 0.8) x CHUNK_LENGTH.
    const worst = 1.6 * CHUNK_LENGTH + 1e-6;
    for (const road of ROADS) {
      const sites = guaranteedSites(road);
      for (let i = 1; i < sites.length; i++) {
        expect(sites[i].s - sites[i - 1].s).toBeLessThanOrEqual(worst);
      }
    }
  });

  it('keeps the anchor inside its chunk central band', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        const [site] = largeFormAnchorSites(road, index, never);
        const inChunk = site.s - index * CHUNK_LENGTH;
        expect(inChunk).toBeGreaterThanOrEqual(0.2 * CHUNK_LENGTH);
        expect(inChunk).toBeLessThanOrEqual(0.8 * CHUNK_LENGTH);
      }
    }
  });
});

describe('where an anchor may stand', () => {
  it('stays past the sentinel band, inside the shared large-form clearance range', () => {
    for (const road of ROADS) {
      for (let index = 0; index < chunksOf(road); index++) {
        for (const site of largeFormAnchorSites(road, index, never)) {
          expect(Math.abs(site.u)).toBeGreaterThanOrEqual(ROAD_HALF_WIDTH + 5.3);
          expect(Math.abs(site.u)).toBeLessThanOrEqual(ROAD_HALF_WIDTH + 13.3);
        }
      }
    }
  });

  it('stands anchors on both sides of the road across a day', () => {
    for (const road of ROADS) {
      const sites = guaranteedSites(road);
      expect(sites.some((site) => site.u < 0)).toBe(true);
      expect(sites.some((site) => site.u > 0)).toBe(true);
    }
  });
});

describe('exclusions move the anchor instead of deleting it', () => {
  it('still finds a site when the first half of the band is excluded', () => {
    for (const road of ROADS) {
      for (let index = 2; index < Math.min(8, chunksOf(road)); index++) {
        const mid = index * CHUNK_LENGTH + 0.5 * CHUNK_LENGTH;
        const sites = largeFormAnchorSites(road, index, (s) => s < mid);
        expect(sites.length).toBeGreaterThanOrEqual(1);
        for (const site of sites) expect(site.s).toBeGreaterThanOrEqual(mid);
      }
    }
  });

  it('returns nothing, without spinning, when everything is excluded', () => {
    const road = ROADS[0];
    expect(largeFormAnchorSites(road, 3, () => true)).toEqual([]);
  });
});

describe('the day is the same for everyone', () => {
  it('returns identical sites for identical inputs', () => {
    for (const road of ROADS.slice(0, 4)) {
      for (let index = 0; index < chunksOf(road); index++) {
        expect(largeFormAnchorSites(road, index, never)).toEqual(
          largeFormAnchorSites(road, index, never),
        );
      }
    }
  });
});
