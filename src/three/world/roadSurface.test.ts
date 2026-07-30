/**
 * The carriageway's cross-section: the rut's shape, and where the ribbon
 * samples it.
 *
 * These exist because of a bug that was built, shipped into a screenshot and
 * measured as *nothing* before a probe of the live scene found it.
 *
 * The rut is a raised cosine cut into the road, and the first version put the
 * ribbon's three carriageway columns on its inner lip, its floor and its
 * outer lip. Those are precisely the three offsets where a raised cosine has
 * **zero slope**. The ground's normals are built from the height field, so
 * every column across the road reported the same 5.3-degree tilt with the rut
 * in and with the rut out, while the vertex positions differed by the full
 * 7 cm: a shape that existed in the mesh and did not exist in any pixel. Two
 * A/B shoots came back identical, which is exactly what a feature that is not
 * being drawn looks like.
 *
 * So what is pinned here is not the depth or the width — those are art and
 * should stay free to move — but the relationship that made the feature real:
 * **wherever the profile is steepest, the ribbon has a column**. Change the
 * profile and this test tells you the mesh has to follow.
 */
import { describe, expect, it } from 'vitest';
import {
  ACROSS_OFFSETS,
  FOOTFALL_HALF,
  ROAD_HALF_WIDTH,
  RUT_CENTRE,
  RUT_DEPTH_M,
  RUT_HALF,
  rutDrop,
  rutSlope,
} from './WorldStreamer';

describe('the rut profile', () => {
  it('is a hollow: deepest on its centre, flat by its lips', () => {
    expect(rutDrop(RUT_CENTRE)).toBeCloseTo(-RUT_DEPTH_M, 6);
    expect(rutDrop(-RUT_CENTRE)).toBeCloseTo(-RUT_DEPTH_M, 6);
    expect(rutDrop(RUT_CENTRE - RUT_HALF)).toBeCloseTo(0, 6);
    expect(rutDrop(RUT_CENTRE + RUT_HALF)).toBeCloseTo(0, 6);
    // Nowhere else on the road, and nothing at all off it.
    expect(rutDrop(0)).toBe(0);
    expect(rutDrop(ROAD_HALF_WIDTH + 3)).toBe(0);
  });

  it('meets flat ground and its own floor with zero slope', () => {
    expect(rutSlope(RUT_CENTRE)).toBeCloseTo(0, 6);
    expect(rutSlope(RUT_CENTRE - RUT_HALF)).toBeCloseTo(0, 6);
    expect(rutSlope(RUT_CENTRE + RUT_HALF)).toBeCloseTo(0, 6);
    expect(rutSlope(0)).toBe(0);
  });

  it('is steepest half way up each wall, and the walls face opposite ways', () => {
    const inner = rutSlope(RUT_CENTRE - RUT_HALF * 0.5);
    const outer = rutSlope(RUT_CENTRE + RUT_HALF * 0.5);
    // pi * depth / (2 * half): the maximum of the raised cosine's derivative.
    const peak = (Math.PI * RUT_DEPTH_M) / (2 * RUT_HALF);
    expect(Math.abs(inner)).toBeCloseTo(peak, 6);
    expect(Math.abs(outer)).toBeCloseTo(peak, 6);
    expect(Math.sign(inner)).toBe(-Math.sign(outer));
  });

  it('is mirrored about the centreline', () => {
    for (const u of [0.3, 0.7, 0.99, 1.3, 2.4]) {
      expect(rutDrop(-u)).toBeCloseTo(rutDrop(u), 6);
      expect(rutSlope(-u)).toBeCloseTo(-rutSlope(u), 6);
    }
  });
});

describe('the ribbon across the road', () => {
  it('is strictly increasing', () => {
    // A ribbon whose lateral offsets are out of order folds two strips of
    // ground back on themselves, and a folded quad's normal points anywhere
    // at all. That shipped once, as a hairline of wrongly-lit ground running
    // from the bard's feet to the vanishing point.
    for (let i = 1; i < ACROSS_OFFSETS.length; i++) {
      expect(ACROSS_OFFSETS[i]).toBeGreaterThan(ACROSS_OFFSETS[i - 1]);
    }
  });

  it('puts a column where the rut is steepest, or the rut is not drawn', () => {
    // The bug this whole file exists for. A column has to sit near enough to
    // each wall's steepest point that the interpolated normal carries most of
    // the real slope; a tenth of the rut's half-width is the tolerance, which
    // is about 4 cm.
    const tolerance = RUT_HALF * 0.1;
    for (const wall of [RUT_CENTRE - RUT_HALF * 0.5, RUT_CENTRE + RUT_HALF * 0.5]) {
      const nearest = ACROSS_OFFSETS.reduce((best, u) =>
        Math.abs(u - wall) < Math.abs(best - wall) ? u : best,
      );
      expect(Math.abs(nearest - wall)).toBeLessThan(tolerance);
    }
  });

  it('puts a column on the rut floor and on both its lips', () => {
    for (const feature of [RUT_CENTRE, RUT_CENTRE - RUT_HALF, RUT_CENTRE + RUT_HALF]) {
      const nearest = ACROSS_OFFSETS.reduce((best, u) =>
        Math.abs(u - feature) < Math.abs(best - feature) ? u : best,
      );
      expect(nearest).toBeCloseTo(feature, 6);
    }
  });
});

describe('what the rut must stay clear of', () => {
  it('never reaches the strip the bard walks on', () => {
    // He walks the centreline exactly, so the crown has to stay flat: a rut
    // under his feet is a rut he wades through, and it would also put the
    // ground the camera follows out of step with `terrainHeight`, which is
    // what places him.
    expect(RUT_CENTRE - RUT_HALF).toBeGreaterThan(FOOTFALL_HALF);
    expect(rutDrop(FOOTFALL_HALF)).toBe(0);
    expect(rutDrop(0)).toBe(0);
  });

  it('stays inside the packed surface', () => {
    expect(RUT_CENTRE + RUT_HALF).toBeLessThan(ROAD_HALF_WIDTH);
  });
});
