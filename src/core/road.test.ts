import { describe, expect, it } from 'vitest';
import { BIOMES } from './biome';
import { hashString } from './rng';
import {
  CORRIDOR_FALLOFF_M,
  CORRIDOR_HALF_WIDTH_M,
  CURVE_AMPLITUDE_M,
  MIN_STOP_SPACING_M,
  ROAD_MAX_LENGTH_M,
  ROAD_MIN_LENGTH_M,
  biomeAt,
  generateRoad,
  nextStop,
  sampleRoad,
  terrainHeight,
  type DailyRoad,
  type RoadSample,
} from './road';

const DAY = '2026-07-28';

/** A spread of roads that is itself deterministic, so a sweep failure is reproducible. */
function sweep(count: number): DailyRoad[] {
  const roads: DailyRoad[] = [];
  for (let i = 0; i < count; i++) {
    roads.push(generateRoad(hashString(`sweep/${i}`), DAY));
  }
  return roads;
}

const road = generateRoad(hashString('wandering-bard/2026-07-28'), DAY);

describe('generateRoad determinism', () => {
  it('produces identical output for the same seed and day', () => {
    const a = generateRoad(4242, DAY);
    const b = generateRoad(4242, DAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a different road for a different seed', () => {
    const a = generateRoad(4242, DAY);
    const b = generateRoad(4243, DAY);
    expect(JSON.stringify(a.stops)).not.toBe(JSON.stringify(b.stops));
  });

  it('keeps geometry tied to the seed and identity tied to the day', () => {
    // Geometry from the seed alone is what lets free play dial up an
    // arbitrary road; ids from the day are what make save data self-dating.
    const monday = generateRoad(99, '2026-07-27');
    const tuesday = generateRoad(99, '2026-07-28');
    expect(tuesday.lengthM).toBe(monday.lengthM);
    expect(tuesday.stops.map((s) => s.s)).toEqual(monday.stops.map((s) => s.s));
    expect(tuesday.bands).toEqual(monday.bands);
    expect(tuesday.stops[0].id).not.toBe(monday.stops[0].id);
    expect(tuesday.stops[0].seed).not.toBe(monday.stops[0].seed);
  });

  it('samples the same points no matter which road was sampled last', () => {
    // The internal seed memo is keyed on road.seed; if it ever failed to
    // invalidate, the second road would silently inherit the first's terrain.
    const a = generateRoad(11, DAY);
    const b = generateRoad(12, DAY);
    const first = terrainHeight(a, 3, 400);
    terrainHeight(b, 3, 400);
    expect(terrainHeight(a, 3, 400)).toBe(first);
    expect(terrainHeight(b, 3, 400)).not.toBe(first);
    expect(sampleRoad(a, 250).x).toBe(sampleRoad(a, 250).x);
  });
});

describe('road length', () => {
  it('stays inside the designed range', () => {
    for (const r of sweep(200)) {
      expect(r.lengthM).toBeGreaterThanOrEqual(ROAD_MIN_LENGTH_M);
      expect(r.lengthM).toBeLessThanOrEqual(ROAD_MAX_LENGTH_M);
      expect(r.lengthM % 10).toBe(0);
    }
  });

  it('actually varies from day to day', () => {
    const lengths = new Set(sweep(40).map((r) => r.lengthM));
    expect(lengths.size).toBeGreaterThan(10);
  });
});

describe('centreline', () => {
  it('never drifts beyond the noise amplitude', () => {
    // The reason for noise over a random walk. A walk would fail this.
    for (const r of sweep(60)) {
      for (let s = -200; s <= r.lengthM + 200; s += 7) {
        expect(Math.abs(sampleRoad(r, s).x)).toBeLessThanOrEqual(CURVE_AMPLITUDE_M + 1e-9);
      }
    }
  });

  it('bends gently — a country lane, not a switchback', () => {
    // Both ends of this are load-bearing. The upper bound is what makes
    // `s` usable as a stand-in for arc length (see the module header): the
    // stretch factor is sqrt(1 + steepest^2), so 0.45 caps the speed error at
    // about 10%. The mean is the number the header's "about 0.4% typically"
    // claim actually rests on, so it is asserted rather than assumed. And the
    // lower bounds are there because a dead straight road passes every upper
    // bound trivially.
    let steepest = 0;
    let total = 0;
    let samples = 0;
    for (const r of sweep(40)) {
      let previous = sampleRoad(r, 0).x;
      for (let s = 0.5; s <= r.lengthM; s += 0.5) {
        const x = sampleRoad(r, s).x;
        const slope = Math.abs(x - previous) / 0.5;
        steepest = Math.max(steepest, slope);
        total += slope;
        samples++;
        previous = x;
      }
    }
    expect(steepest).toBeLessThan(0.45);
    expect(steepest).toBeGreaterThan(0.25);
    expect(total / samples).toBeLessThan(0.12);
    expect(total / samples).toBeGreaterThan(0.04);
  });

  it('reports the real tangent, not merely its own epsilon back again', () => {
    // Measured at a different baseline from the implementation's on purpose.
    // Comparing against the same +/-0.5 m central difference the function
    // uses would pass for any heading at all as long as the epsilon matched,
    // and fail for a perfectly good heading whenever that constant was
    // retuned — precisely backwards. An 8 m baseline is an independent
    // estimate of the same derivative; at this curvature the two agree to a
    // few thousandths.
    let worst = 0;
    for (const r of sweep(20)) {
      for (let s = 0; s <= r.lengthM; s += 11) {
        const here = sampleRoad(r, s);
        const coarse = (sampleRoad(r, s + 4).x - sampleRoad(r, s - 4).x) / 8;
        worst = Math.max(worst, Math.abs(Math.tan(here.heading) - coarse));
        expect(Math.abs(here.heading)).toBeLessThan(Math.PI / 4);
      }
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('points the heading the way the road actually goes', () => {
    // Sign, not just magnitude: a heading with the wrong sign passes every
    // tolerance test above and turns the bard to face across the road.
    for (let s = 20; s < road.lengthM - 20; s += 7) {
      const here = sampleRoad(road, s);
      const drift = sampleRoad(road, s + 6).x - sampleRoad(road, s - 6).x;
      if (Math.abs(drift) < 0.5) continue;
      expect(Math.sign(here.heading)).toBe(Math.sign(drift));
    }
  });

  it('is defined beyond both ends so the mesh can overhang', () => {
    for (const s of [-300, -1, 0, road.lengthM, road.lengthM + 300]) {
      const sample = sampleRoad(road, s);
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(Number.isFinite(sample.heading)).toBe(true);
      expect(sample.s).toBe(s);
    }
  });

  it('fills a caller-supplied sample instead of allocating', () => {
    const scratch: RoadSample = { s: 0, x: 0, y: 0, heading: 0 };
    const returned = sampleRoad(road, 512, scratch);
    expect(returned).toBe(scratch);
    const fresh = sampleRoad(road, 512);
    expect(scratch).toEqual(fresh);
  });
});

describe('terrainHeight', () => {
  it('agrees with the centreline sample it is supposed to share', () => {
    // A prop placed by terrain height and a bard placed by road sample must
    // stand on the same ground, or everything floats.
    for (let s = 0; s <= road.lengthM; s += 17) {
      const sample = sampleRoad(road, s);
      expect(terrainHeight(road, sample.x, s)).toBeCloseTo(sample.y, 9);
    }
  });

  it('is exactly flat across the carriageway', () => {
    for (let s = 0; s <= road.lengthM; s += 53) {
      const cx = sampleRoad(road, s).x;
      const centre = terrainHeight(road, cx, s);
      for (const d of [-CORRIDOR_HALF_WIDTH_M, -3, -1, 0, 1, 3, CORRIDOR_HALF_WIDTH_M]) {
        expect(terrainHeight(road, cx + d, s)).toBe(centre);
      }
    }
  });

  it('has no cliff anywhere across the corridor falloff', () => {
    const step = 0.25;
    for (const r of sweep(20)) {
      for (let s = 100; s < r.lengthM; s += 211) {
        const cx = sampleRoad(r, s).x;
        let previous = terrainHeight(r, cx, s);
        for (let d = step; d <= CORRIDOR_HALF_WIDTH_M + CORRIDOR_FALLOFF_M + 40; d += step) {
          const h = terrainHeight(r, cx + d, s);
          expect(Math.abs(h - previous)).toBeLessThan(0.25);
          previous = h;
        }
      }
    }
  });

  it('has no crease at either end of the corridor falloff', () => {
    // The cliff test above only checks the height is continuous, which a
    // linear ramp satisfies just as well as a smoothstep — swapping one for
    // the other passes it untouched. What a linear ramp gets wrong is the
    // *slope*: it jumps by (lane - natural) / falloff at the edge of the
    // verge and again where the falloff ends, and low-poly flat shading draws
    // those two jumps as a pair of hard lines running the length of the road.
    // A second difference sees the jump; the height difference alone does not.
    // Measured: smoothstep peaks around 0.005 here, a linear ramp around 0.17.
    const step = 0.5;
    let worst = 0;
    for (const r of sweep(20)) {
      for (let s = 200; s < r.lengthM; s += 173) {
        const cx = sampleRoad(r, s).x;
        const at = (d: number): number => terrainHeight(r, cx + d, s);
        for (let d = step; d < CORRIDOR_HALF_WIDTH_M + CORRIDOR_FALLOFF_M + 10; d += step) {
          worst = Math.max(worst, Math.abs(at(d - step) - 2 * at(d) + at(d + step)));
        }
      }
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('has no cliff along the direction of travel either', () => {
    let previous = terrainHeight(road, sampleRoad(road, 0).x, 0);
    for (let s = 0.5; s <= road.lengthM; s += 0.5) {
      const h = terrainHeight(road, sampleRoad(road, s).x, s);
      expect(Math.abs(h - previous)).toBeLessThan(0.2);
      previous = h;
    }
  });

  it('releases the ground back to natural well away from the road', () => {
    // Two things at once: the far ground is not clamped to the lane height,
    // and the surface detail the corridor suppresses is present out there.
    let laneDeviation = 0;
    let farRoughness = 0;
    let laneRoughness = 0;
    for (let s = 0; s <= road.lengthM; s += 23) {
      const cx = sampleRoad(road, s).x;
      const lane = terrainHeight(road, cx, s);
      const far = terrainHeight(road, cx + 200, s);
      laneDeviation = Math.max(laneDeviation, Math.abs(far - lane));
      farRoughness += Math.abs(terrainHeight(road, cx + 201, s) - far);
      laneRoughness += Math.abs(terrainHeight(road, cx, s + 1) - lane);
    }
    expect(laneDeviation).toBeGreaterThan(2);
    expect(farRoughness).toBeGreaterThan(laneRoughness);
  });

  it('is finite for coordinates far outside the playable world', () => {
    for (const [x, z] of [
      [0, 0],
      [-1e5, 1e5],
      [1e6, -1e6],
      [0.5, 1e9],
    ]) {
      expect(Number.isFinite(terrainHeight(road, x, z))).toBe(true);
    }
  });
});

describe('bands', () => {
  it('cover the whole road with no gap, overlap or zero-length stretch', () => {
    for (const r of sweep(300)) {
      expect(r.bands.length).toBeGreaterThanOrEqual(3);
      expect(r.bands.length).toBeLessThanOrEqual(5);
      expect(r.bands[0].startS).toBe(0);
      expect(r.bands[r.bands.length - 1].endS).toBe(r.lengthM);
      for (let i = 0; i < r.bands.length; i++) {
        expect(r.bands[i].endS).toBeGreaterThan(r.bands[i].startS);
        if (i > 0) expect(r.bands[i].startS).toBe(r.bands[i - 1].endS);
      }
    }
  });

  it('only ever names a biome that exists', () => {
    const ids = new Set(BIOMES.map((b) => b.id));
    for (const r of sweep(200)) {
      for (const band of r.bands) expect(ids.has(band.biomeId)).toBe(true);
    }
  });

  it('never repeats a biome back to back', () => {
    // Two identical bands in a row is a transition the player cannot see,
    // which reads as the biome system being broken.
    for (const r of sweep(300)) {
      for (let i = 1; i < r.bands.length; i++) {
        expect(r.bands[i].biomeId).not.toBe(r.bands[i - 1].biomeId);
      }
    }
  });

  it('gives every band a walkable share of the day', () => {
    for (const r of sweep(200)) {
      for (const band of r.bands) {
        expect(band.endS - band.startS).toBeGreaterThan(100);
      }
    }
  });
});

describe('biomeAt', () => {
  it('matches the band a point sits in', () => {
    for (const band of road.bands) {
      expect(biomeAt(road, (band.startS + band.endS) / 2)).toBe(band.biomeId);
    }
  });

  it('hands a seam to the band being walked into', () => {
    for (let i = 1; i < road.bands.length; i++) {
      expect(biomeAt(road, road.bands[i].startS)).toBe(road.bands[i].biomeId);
    }
  });

  it('clamps outside the road rather than returning nothing', () => {
    expect(biomeAt(road, -500)).toBe(road.bands[0].biomeId);
    expect(biomeAt(road, road.lengthM)).toBe(road.bands[road.bands.length - 1].biomeId);
    expect(biomeAt(road, road.lengthM + 500)).toBe(road.bands[road.bands.length - 1].biomeId);
  });
});

describe('stops', () => {
  it('are sorted, on the road, and never crowd each other', () => {
    for (const r of sweep(300)) {
      for (let i = 0; i < r.stops.length; i++) {
        const stop = r.stops[i];
        expect(Number.isFinite(stop.s)).toBe(true);
        expect(stop.s).toBeGreaterThanOrEqual(0);
        expect(stop.s).toBeLessThanOrEqual(r.lengthM);
        if (i > 0) {
          // The spacing rule is the one thing that keeps a busk from opening
          // on top of the encounter the player is still in the middle of.
          expect(stop.s - r.stops[i - 1].s).toBeGreaterThanOrEqual(MIN_STOP_SPACING_M - 1e-9);
        }
      }
    }
  });

  it('end the day at exactly one campfire, and end there', () => {
    for (const r of sweep(300)) {
      const campfires = r.stops.filter((s) => s.kind === 'campfire');
      expect(campfires).toHaveLength(1);
      expect(campfires[0].s).toBe(r.lengthM);
      expect(r.stops[r.stops.length - 1]).toBe(campfires[0]);
    }
  });

  it('give the day a full spread of things to do', () => {
    for (const r of sweep(300)) {
      const count = (kind: string): number => r.stops.filter((s) => s.kind === kind).length;
      expect(count('busk')).toBeGreaterThanOrEqual(3);
      expect(count('vista')).toBeGreaterThanOrEqual(1);
      expect(count('vista')).toBeLessThanOrEqual(2);
      expect(count('encounter')).toBeGreaterThanOrEqual(1);
      expect(count('crossroads')).toBeLessThanOrEqual(2);
    }
  });

  it('space busking spots the way the design asks', () => {
    for (const r of sweep(100)) {
      const busks = r.stops.filter((s) => s.kind === 'busk').map((s) => s.s);
      for (let i = 1; i < busks.length; i++) {
        expect(busks[i] - busks[i - 1]).toBeGreaterThanOrEqual(150);
        expect(busks[i] - busks[i - 1]).toBeLessThanOrEqual(250);
      }
    }
  });

  it('interleave encounters rather than bunching them', () => {
    // Encounters are placed one per gap between already-placed stops, so two
    // of them can never end up side by side no matter how the dice fall —
    // there is always something else to walk past in between.
    for (const r of sweep(200)) {
      for (let i = 1; i < r.stops.length; i++) {
        const pair = [r.stops[i - 1].kind, r.stops[i].kind];
        expect(pair).not.toEqual(['encounter', 'encounter']);
      }
      const busks = r.stops.filter((s) => s.kind === 'busk').map((s) => s.s);
      for (const e of r.stops.filter((s) => s.kind === 'encounter')) {
        // Never before the day has properly started, and never past the fire.
        expect(busks.some((b) => b < e.s)).toBe(true);
        expect(e.s).toBeLessThan(r.lengthM);
      }
    }
  });

  it('put crossroads on a biome seam', () => {
    for (const r of sweep(200)) {
      const seams = r.bands.slice(1).map((b) => b.startS);
      for (const stop of r.stops) {
        if (stop.kind === 'crossroads') expect(seams).toContain(stop.s);
      }
    }
  });

  it('give every stop a unique id and its own seed', () => {
    for (const r of sweep(100)) {
      const ids = new Set(r.stops.map((s) => s.id));
      const seeds = new Set(r.stops.map((s) => s.seed));
      expect(ids.size).toBe(r.stops.length);
      expect(seeds.size).toBe(r.stops.length);
      for (const stop of r.stops) {
        expect(stop.id.startsWith(`${DAY}/${stop.kind}/`)).toBe(true);
        expect(Number.isInteger(stop.seed)).toBe(true);
        expect(stop.seed).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('number each kind from zero in the order the player meets them', () => {
    const busks = road.stops.filter((s) => s.kind === 'busk');
    busks.forEach((stop, i) => expect(stop.id).toBe(`${DAY}/busk/${i}`));
  });

  it('keep the two vistas of a day a real walk apart', () => {
    // Local maxima of a profile probed every 15 m include the shoulders of a
    // single broad summit, and the generic 60 m stop spacing accepts them, so
    // without this rule one road in six put both viewpoints inside 100 m of
    // each other — the same view twice.
    for (const r of sweep(400)) {
      const vistas = r.stops.filter((s) => s.kind === 'vista').map((s) => s.s);
      if (vistas.length < 2) continue;
      expect(vistas[1] - vistas[0]).toBeGreaterThanOrEqual(300);
    }
  });

  it('actually fill most of the gaps with encounters', () => {
    // The "at least one encounter" assertion above is satisfied by the
    // forced-fallback encounter alone, so it holds even if the per-gap roll
    // almost never fires — dropping the chance from 0.8 to 0.05 passes it.
    // The average is what tells you encounters are the norm rather than the
    // consolation prize. A day offers about five and a half gaps, so at a 0.8
    // chance the mean lands near 4.6; the fallback floor alone would sit near
    // 1.3, and a chance of 1 would sit near 5.7. Both bounds therefore bite.
    const roads = sweep(300);
    const mean = roads.reduce((n, r) => n + r.stops.filter((s) => s.kind === 'encounter').length, 0) / roads.length;
    expect(mean).toBeGreaterThan(3.5);
    expect(mean).toBeLessThan(5.2);
  });

  it('reuse ids across roads that share a day key, which is why the two must travel together', () => {
    // Not a nicety: RoadStage persists `stop.id` into the journey's `visited`
    // list. Two different roads under one day key hand the same id to
    // different places, so a saved visit on one would silently mark a stop on
    // the other as already played. Anything overriding the seed has to
    // override the day key with it, and this test is here so that a change to
    // the id format is a deliberate act rather than a surprise.
    const a = generateRoad(1, DAY);
    const b = generateRoad(2, DAY);
    expect(b.stops[0].id).toBe(a.stops[0].id);
    expect(b.stops[0].seed).not.toBe(a.stops[0].seed);
    expect(generateRoad(2, '2026-07-29').stops[0].id).not.toBe(a.stops[0].id);
  });
});

describe('nextStop', () => {
  it('finds the first stop strictly beyond a position', () => {
    const first = nextStop(road, -1);
    expect(first).toBe(road.stops[0]);
    expect(nextStop(road, road.stops[0].s - 0.001)).toBe(road.stops[0]);
  });

  it('never hands back the stop you are standing on', () => {
    // Otherwise a scene that resumes the walk at the stop it just finished
    // gets that stop again, forever.
    road.stops.forEach((stop, i) => {
      // Asserting the exact successor rather than "not this one": at the
      // campfire `nextStop` returns null, and `null !== stop` would have
      // satisfied a weaker assertion no matter what the function did there.
      const expected = i + 1 < road.stops.length ? road.stops[i + 1] : null;
      expect(nextStop(road, stop.s)).toBe(expected);
    });
  });

  it('walks the whole road in order and then stops', () => {
    const seen: string[] = [];
    let s = -1;
    for (;;) {
      const stop = nextStop(road, s);
      if (stop === null) break;
      seen.push(stop.id);
      s = stop.s;
    }
    expect(seen).toEqual(road.stops.map((st) => st.id));
    expect(nextStop(road, road.lengthM)).toBeNull();
    expect(nextStop(road, road.lengthM + 1000)).toBeNull();
  });

  it('filters by kind', () => {
    const busk = nextStop(road, 0, 'busk');
    expect(busk?.kind).toBe('busk');
    expect(busk).toBe(road.stops.find((s) => s.kind === 'busk' && s.s > 0));
    expect(nextStop(road, road.lengthM - 1, 'campfire')).toBe(road.stops[road.stops.length - 1]);
    expect(nextStop(road, 0, 'campfire')?.kind).toBe('campfire');
    expect(nextStop(road, road.lengthM, 'busk')).toBeNull();
  });
});

describe('the road is the same road', () => {
  // Everything above checks that generation obeys its rules. None of it
  // notices if the rules stay satisfied while the output changes: renaming a
  // sub-seed label, reordering two draws, retuning a constant. Each of those
  // silently hands every player a different road from the one the last build
  // shipped, which for a game whose whole premise is a shared daily walk is
  // the worst failure it has. Three deliberate mutations — renaming
  // 'road/shape', dropping the encounter chance from 0.8 to 0.05, and
  // replacing the corridor smoothstep with a linear ramp — passed the entire
  // suite before this block existed.
  //
  // These numbers were read off the implementation, so they prove nothing
  // about correctness; the tests above are what argue the road is good. This
  // one only asks whether it is the *same* road, and a deliberate change to
  // the generator is expected to update it in the same commit.
  //
  // Updated twice on 2026-07-28. The second time: a frame-by-frame critique
  // found the land reading as a plate with no midground, so the cross-road
  // hills went from 9 m to 15 m and the surface hummocks roughly doubled.
  // The along-road amplitude was deliberately NOT raised — see the note on
  // the constants — and the roughness test above caught two attempts that
  // did raise it before either reached a screenshot.
  //
  // The first time, and this is what that looks like in practice: the
  // 3D world went in and the land it was built on was too flat to see. The
  // corridor falloff came in from 30 m to 18 m and the cross-road hills
  // shortened from a 520 m wavelength to 190 m, so the ground now rises
  // within sight of the road instead of a quarter-kilometre from it. The
  // hills *along* the road were left long on purpose — an earlier attempt
  // shortened them to 165 m and turned a country lane into a 30% climb,
  // which the roughness test above caught before any of it was seen.
  const pinned = generateRoad(20260728, '2026-07-28');

  it('lays out the pinned day exactly as it did', () => {
    expect(pinned.lengthM).toBe(1320);
    expect(pinned.bands.map((b) => [b.startS, b.endS, b.biomeId])).toEqual([
      [0, 265.69037710572394, 'forest'],
      [265.69037710572394, 550.5611917200555, 'riverside'],
      [550.5611917200555, 814.0071387087421, 'forest'],
      [814.0071387087421, 1098.455287486514, 'village'],
      [1098.455287486514, 1320, 'forest'],
    ]);
    expect(pinned.stops.map((s) => [s.s, s.kind, s.id, s.seed])).toEqual([
      [142.85020551178604, 'busk', '2026-07-28/busk/0', 3514572248],
      [210, 'vista', '2026-07-28/vista/0', 1387528194],
      [281.4769762288116, 'encounter', '2026-07-28/encounter/0', 1699331970],
      [366.0124420421198, 'busk', '2026-07-28/busk/1', 3531349067],
      [494.9035118538423, 'encounter', '2026-07-28/encounter/1', 1716109813],
      [587.2728376183659, 'busk', '2026-07-28/busk/2', 3548126910],
      [660, 'vista', '2026-07-28/vista/1', 1404306037],
      [723.2728187798986, 'encounter', '2026-07-28/encounter/2', 1665776300],
      [788.2052101427689, 'busk', '2026-07-28/busk/3', 3564904737],
      [910.0974212703767, 'encounter', '2026-07-28/encounter/3', 1682554143],
      [1011.3831164082512, 'busk', '2026-07-28/busk/4', 3581682580],
      [1320, 'campfire', '2026-07-28/campfire/0', 4175580662],
    ]);
  });

  it('puts the ground in the pinned day exactly where it did', () => {
    // Geometry is pinned separately from placement because they come from
    // different seed streams and can break independently.
    expect([0, 137.5, 600, 1201.25].map((s) => {
      const p = sampleRoad(pinned, s);
      return [p.x, p.y, p.heading];
    })).toEqual([
      [19.981959401363778, -0.5369609510896687, -0.00029478312836629775],
      [11.213712036576762, -1.6283862908394964, -0.11911369426792423],
      [7.949019031112194, -9.873596482697042, 0.06080879867127515],
      [-6.453527006656186, -9.099596530541028, -0.2522464440326799],
    ]);
    expect([[0, 0], [40, 250], [-120, 900], [12, 1500]].map(([x, z]) => terrainHeight(pinned, x, z))).toEqual([
      -1.4152063112379198, -9.307262736356128, 3.5418769765363303, -9.977719550029818,
    ]);
  });
});

describe('no hidden state between roads', () => {
  it('generates the same roads whatever order they are asked for in', () => {
    // The module keeps a one-slot memo of the per-road field seeds, and vista
    // placement reads the elevation profile through it during generation. If
    // that memo ever failed to invalidate, a road's vistas would depend on
    // which road was generated before it — a determinism bug that no
    // single-road test can see, because every road is self-consistent.
    const forward: string[] = [];
    for (let i = 0; i < 40; i++) forward.push(JSON.stringify(generateRoad(hashString(`order/${i}`), DAY)));

    const backward: string[] = [];
    for (let i = 39; i >= 0; i--) {
      const r = generateRoad(hashString(`order/${i}`), DAY);
      // Churn the memo between generations, the way a real frame loop would.
      terrainHeight(r, 900, 900);
      backward[i] = JSON.stringify(r);
    }
    expect(backward).toEqual(forward);
  });

  it('hands out fresh arrays and leaves the biome table alone', () => {
    const before = JSON.stringify(BIOMES);
    const a = generateRoad(5150, DAY);
    const b = generateRoad(5150, DAY);
    expect(a.bands).not.toBe(b.bands);
    expect(a.stops).not.toBe(b.stops);
    expect(a.stops[0]).not.toBe(b.stops[0]);
    a.stops.length = 0;
    a.bands[0].endS = -1;
    expect(b.stops.length).toBeGreaterThan(0);
    expect(b.bands[0].endS).toBeGreaterThan(0);
    expect(JSON.stringify(BIOMES)).toBe(before);
  });
});

describe('a few hundred days', () => {
  it('never produce a NaN in the geometry', () => {
    for (const r of sweep(300)) {
      for (let s = 0; s <= r.lengthM; s += 97) {
        const sample = sampleRoad(r, s);
        expect(Number.isNaN(sample.x)).toBe(false);
        expect(Number.isNaN(sample.y)).toBe(false);
        expect(Number.isNaN(sample.heading)).toBe(false);
        expect(Number.isNaN(terrainHeight(r, sample.x + 40, s))).toBe(false);
      }
    }
  });

  it('keep the ground within a walkable range of elevations', () => {
    for (const r of sweep(100)) {
      for (let s = 0; s <= r.lengthM; s += 31) {
        expect(Math.abs(sampleRoad(r, s).y)).toBeLessThan(25);
      }
    }
  });
});
