/**
 * Where a stop's dressing stands.
 *
 * DESIGN.md v0.8 item 7 asks that a stop announce itself down the road, and
 * the whole of that promise is a placement question rather than a modelling
 * one: a banner on the wrong side of the lane is never in frame (see
 * `LANDMARK_VIEW_BIAS`, which cost a whole feature the first time it was
 * missed), and a crate on the carriageway is something the bard walks through.
 *
 * Neither failure is loud. A marker that never appears looks exactly like a
 * marker that was never built, and a prop the bard clips looks like a bug in
 * the walk. So the three things the feature cannot survive losing are pinned
 * here in arithmetic: **off the lane, on the camera's side, and the same for
 * every player walking the same day.**
 */
import { describe, expect, it } from 'vitest';
import { generateRoad, sampleRoad, type DailyRoad } from '../../core/road';
import { campfireLayout, ROAD_CLEARANCE_M } from '../scenes/campfireLayout';
import { ROAD_HALF_WIDTH, STOP_DRESSING_CLEARANCE_M, stopDressingSites } from './WorldStreamer';

const ROADS: DailyRoad[] = [];
for (let i = 0; i < 24; i++) ROADS.push(generateRoad(9000 + i * 7919, `2026-07-${(i % 28) + 1}`));

describe('which stops get dressed', () => {
  it('dresses busks, encounters, crossroads and the camp, and never a vista', () => {
    for (const road of ROADS) {
      const dressed = new Map(stopDressingSites(road).map((site) => [site.seed, site]));
      for (const stop of road.stops) {
        const site = dressed.get(stop.seed);
        if (stop.kind === 'vista') {
          expect(site).toBeUndefined();
        } else {
          expect(site).toBeDefined();
        }
      }
    }
  });

  it('gives every dressed stop exactly one site', () => {
    for (const road of ROADS) {
      const sites = stopDressingSites(road);
      expect(new Set(sites.map((s) => s.seed)).size).toBe(sites.length);
    }
  });
});

describe('what the walking lane must stay clear of', () => {
  /**
   * The claim the constant makes, restated as a bound the geometry has to
   * live inside: the widest thing any of these shapes reaches from its own
   * origin is the busk pitch's crates, a little over a metre.
   */
  const WIDEST_FOOTPRINT_M = 1.15;

  it('never puts a marker on the carriageway', () => {
    for (const road of ROADS) {
      for (const site of stopDressingSites(road)) {
        const floor = site.shape === 'smoke' ? ROAD_CLEARANCE_M : STOP_DRESSING_CLEARANCE_M;
        expect(Math.abs(site.u)).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('leaves the packed surface untouched even at a marker s widest corner', () => {
    for (const road of ROADS) {
      for (const site of stopDressingSites(road)) {
        if (site.shape === 'smoke') continue;
        expect(Math.abs(site.u) - WIDEST_FOOTPRINT_M).toBeGreaterThan(ROAD_HALF_WIDTH);
      }
    }
  });

  it('stands the markers on the side of the road the camera can see', () => {
    for (const road of ROADS) {
      for (const site of stopDressingSites(road)) {
        // The camp picks its own side and is allowed to; everything placed by
        // this file goes camera-left, which `roadOffset` makes negative.
        if (site.shape === 'smoke') continue;
        expect(site.u).toBeLessThan(0);
      }
    }
  });
});

describe('the camp s plume', () => {
  it('stands over the fire the camp will actually build', () => {
    for (const road of ROADS) {
      const camp = road.stops.find((stop) => stop.kind === 'campfire');
      if (!camp) continue;
      const site = stopDressingSites(road).find((s) => s.shape === 'smoke');
      expect(site).toBeDefined();
      const at = sampleRoad(road, camp.s);
      const layout = campfireLayout(camp.seed, at.heading);
      expect(site?.x).toBeCloseTo(at.x + layout.fire.x, 6);
      expect(site?.z).toBeCloseTo(at.s + layout.fire.z, 6);
    }
  });
});

describe('the same day gives the same dressing', () => {
  it('is a pure function of the road', () => {
    for (const road of ROADS.slice(0, 6)) {
      expect(stopDressingSites(road)).toEqual(stopDressingSites(road));
    }
  });

  it('is reproduced from the seed rather than carried in the object', () => {
    const again = generateRoad(ROADS[0].seed, ROADS[0].dayKey);
    expect(stopDressingSites(again)).toEqual(stopDressingSites(ROADS[0]));
  });
});
