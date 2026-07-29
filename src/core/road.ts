/**
 * The day's road.
 *
 * Everything else in the game asks this module questions: where am I, what
 * does the ground do here, which biome is this, what is coming up. So it is
 * a pure function of a seed and nothing else — no clock, no storage, no
 * accumulated walk state. Two players on opposite sides of the world walk
 * the same road on the same day because they both call `generateRoad` with
 * `dailySeed()` and get byte-identical output.
 *
 * ## The one geometric decision everything hangs off
 *
 * The road runs along +Z. Arc distance `s` **is** the world Z coordinate;
 * the centreline only moves in X. That is why `RoadSample` carries no `z` —
 * `z === s`, always, and `terrainHeight(road, x, z)` can treat its `z`
 * argument as an `s` when it needs to know where the road corridor is.
 *
 * The honest cost of that choice: `s` is not *exactly* arc length, because
 * a road that leans sideways covers slightly more ground than it covers Z.
 * The stretch factor is `sqrt(1 + (dx/ds)^2)`. Measured across eighty seeds
 * at a half-metre step, `|dx/ds|` averages 0.085, sits under 0.21 for 95% of
 * the road and peaks around 0.37 — so the speed error is about 0.4% on a
 * typical stretch and about 6% at the sharpest bend the noise produces. A
 * bard walking at "4 m/s" is really walking at 4.02 m/s most of the time and
 * 4.25 m/s through the worst corner. That is a rounding error against a
 * distance readout in tens of metres, and nothing in the game measures speed
 * against a clock. The alternative was an arc-length reparameterisation
 * table, which means storing a table on `DailyRoad` (the interface is fixed,
 * and other modules build road objects in their own tests) and a binary
 * search in a function called every frame. Not worth it.
 *
 * ## Why noise and not a walk
 *
 * The centreline is `fbm1D`, not an accumulated random step. A random walk
 * has no restoring force: it drifts arbitrarily far from the axis and, worse,
 * its bends get sharper the more steps you take. Noise is bounded by
 * construction, so `|x|` never exceeds `CURVE_AMPLITUDE_M`, and it is
 * *re-derivable* — the renderer can ask what the road does at 1400 m without
 * having simulated the 1399 m before it, which is what lets the world stream
 * in and out around the player.
 */

import { BIOMES } from './biome';
import { chance, fbm1D, mulberry32, pick, randInt, randRange, subSeed, type Rand } from './rng';

/** A point on the centreline. `z` is omitted because `z === s`. */
export interface RoadSample {
  /** Arc distance in metres, echoed back so a sample is self-describing. */
  s: number;
  /** World X of the centreline. */
  x: number;
  /** Ground height at the centreline — the same value `terrainHeight` gives. */
  y: number;
  /**
   * Tangent angle in radians, measured from +Z toward +X, i.e.
   * `atan2(dx/ds, dz/ds)`. Zero means "straight down the road". Because
   * `dz/ds` is 1 by construction this is always in (-pi/2, pi/2), so a
   * consumer never has to worry about the branch cut.
   */
  heading: number;
}

export type RoadStopKind = 'busk' | 'encounter' | 'vista' | 'crossroads' | 'campfire';

export interface RoadStop {
  s: number;
  kind: RoadStopKind;
  /**
   * Stable across a day and unique within it, of the form
   * `2026-07-28/busk/2`. The day is baked in so that save data can say "you
   * already played this spot" without also having to record which day it
   * belonged to.
   *
   * The id is derived from `dayKey`, the kind and the walk-order index — not
   * from `seed`. That makes `dayKey` load-bearing for anything that persists
   * ids: two roads built from different seeds under the *same* `dayKey` hand
   * out the same ids to different places, so a saved "already visited" list
   * would suppress stops the player has never seen. A caller that overrides
   * the seed must override the day key with it. Left this way rather than
   * folding the seed into the id because the id is what a player-facing save
   * file is keyed on and it should stay legible; the coupling is cheap to
   * honour and `road.test.ts` pins it.
   */
  id: string;
  /**
   * A stream of its own, derived from the road seed and the stop id. This is
   * the whole reason downstream systems can generate a stop's contents — the
   * traveller you meet, the tune the crowd wants — without threading any
   * state through the walk, and out of order.
   */
  seed: number;
}

export interface RoadBand {
  startS: number;
  endS: number;
  biomeId: string;
}

export interface DailyRoad {
  seed: number;
  dayKey: string;
  lengthM: number;
  /** Contiguous and gapless: `bands[0].startS === 0`, each band's `endS` is the next one's `startS`, and the last ends at `lengthM`. */
  bands: RoadBand[];
  /** Sorted by `s` ascending. The last entry is always the campfire, at `lengthM`. */
  stops: RoadStop[];
}

// A day's walk. Long enough that the biome changes read as travel, short
// enough that a player who wants to reach the campfire in one sitting can.
export const ROAD_MIN_LENGTH_M = 1200;
export const ROAD_MAX_LENGTH_M = 1800;

// Curve shape. Amplitude over wavelength is what sets how hard the road
// leans: at 38/320 the measured tangent averages about 5 degrees, stays under
// 12 for 95% of the road and tops out near 20. A country lane, not a rally
// stage. (Earlier revisions of this comment guessed at these numbers and
// guessed low; they are now measured, and `road.test.ts` pins the maximum.)
/** The centreline never leaves `[-CURVE_AMPLITUDE_M, +CURVE_AMPLITUDE_M]` in X — terrain chunking can rely on it. */
export const CURVE_AMPLITUDE_M = 38;
const CURVE_WAVELENGTH_M = 320;
const CURVE_OCTAVES = 2;
// Lacunarity above 2 keeps the second octave from beating in phase with the
// first at the lattice points, where value noise is most obviously gridded.
const CURVE_LACUNARITY = 2.5;
// Gain well under 0.5 so the second octave adds a lean, not a wiggle.
const CURVE_GAIN = 0.4;

// Central-difference step for the tangent. Large enough that subtracting two
// nearby noise samples does not lose its significant digits, small enough
// that it still tracks the tightest bend the constants above allow.
const HEADING_EPSILON_M = 0.5;

// Landform. Three long bands at different orientations; see `hills`.
/*
 * Relief, retuned 2026-07-28 after a frame-by-frame critique found the land
 * reading as a plate: no midground, nowhere for the eye to go, and a "vista"
 * framing indistinguishable from an ordinary one.
 *
 * The obvious fix was rejected. The critique proposed 22 m of along-road
 * amplitude at a 180 m wavelength, which is a peak gradient of 2*pi*22/180 —
 * about 77%, a cliff rather than a country lane. An earlier attempt at
 * 9 m / 165 m already reached 30% and was caught by the roughness test
 * below before anyone saw it. Along-road amplitude is the one number here
 * that has to stay modest, because the lane follows the landform and the
 * player walks it.
 *
 * So the relief is bought *across* the road instead, where it costs the
 * gradient almost nothing: a cross-road ridge only tilts the lane through
 * the centreline's own drift (about 0.19 m of X per metre of Z), so 15 m of
 * cross amplitude adds roughly 8% to the walk while putting a genuine ridge
 * across the view. The diagonal term is raised with it — it is what stops
 * the two axis-aligned bands reading as corduroy.
 */
const HILL_ALONG_M = 9;
const HILL_ALONG_WAVELENGTH_M = 330;
const HILL_ACROSS_M = 15;
const HILL_ACROSS_WAVELENGTH_M = 205;
const HILL_DIAGONAL_M = 5;
const HILL_DIAGONAL_WAVELENGTH_M = 165;

// Surface texture, deliberately an order of magnitude smaller than the
// landform. This is the part the road corridor erases.
// Raised with the landform above, and for the same reason. Taller ridges
// with the same fine detail on them read as smooth modelled shapes rather
// than as ground; the hummocks are what a hillside is actually made of at
// the scale the camera sees. This is also the term the roughness test
// below is really about — it asks whether the wild ground carries detail
// the graded corridor does not, and raising the ridges alone had narrowed
// that margin to almost nothing.
const BUMP_A_M = 2.1;
const BUMP_A_WAVELENGTH_M = 52;
const BUMP_B_M = 1.4;
const BUMP_B_WAVELENGTH_M = 31;

/** Half-width of the flat carriageway plus its verges. */
export const CORRIDOR_HALF_WIDTH_M = 4.5;
/** How far beyond the verge the ground takes to become natural again. */
export const CORRIDOR_FALLOFF_M = 18;

/** No two stops are ever closer than this. */
export const MIN_STOP_SPACING_M = 60;

const FIRST_STOP_MIN_M = 90;
const FIRST_STOP_MAX_M = 160;
const BUSK_GAP_MIN_M = 150;
const BUSK_GAP_MAX_M = 250;
/**
 * No busking spot within this much of the campfire. Arriving at camp straight
 * off a performance robs the rest scene of its contrast; a last stretch of
 * plain walking is what makes the fire feel like the end of something. An
 * encounter may still fall in there — meeting someone on the way to camp is a
 * quiet beat, not a working one.
 */
const TAIL_QUIET_M = 140;
/** Vistas want a view, which means not standing at either end of the day. */
const VISTA_MARGIN_M = 150;
/**
 * Two vistas must be a real walk apart.
 *
 * The elevation profile is probed every 15 m, so the shoulders either side of
 * a broad summit are separate local maxima and the generic 60 m stop spacing
 * happily accepts both. Measured over three thousand roads, that put the day's
 * two viewpoints within 100 m of each other on one road in six, and 60 m apart
 * at worst — the same view twice, half a minute apart, which reads as the
 * generator stuttering rather than as two places worth stopping. Deduplicating
 * the profile into prominent peaks would be the thorough fix; a flat minimum
 * separation gets the same result here because the road is only long enough
 * for two vistas anyway.
 */
const VISTA_SEPARATION_M = 300;
/** Elevation profile resolution used to find local high points. */
const VISTA_PROBE_STEP_M = 15;
const ENCOUNTER_CHANCE = 0.8;
const CROSSROADS_CHANCE = 0.5;
const MAX_CROSSROADS = 2;

/**
 * Per-road derived seeds.
 *
 * These come from `subSeed`, which hashes a string label. That is nothing in
 * isolation and real money inside `terrainHeight`, which a terrain mesh calls
 * once per vertex — re-hashing six labels per vertex would cost more than the
 * noise the function exists to evaluate. Hence the one-slot memo below.
 */
interface RoadField {
  curve: number;
  hillAlong: number;
  hillAcross: number;
  hillDiagonal: number;
  bumpA: number;
  bumpB: number;
}

// One slot rather than a map: terrain is built for one road at a time, so the
// hit rate is effectively 100% and there is nothing to evict or grow. The
// memo is invisible from outside — same seed in, same numbers out — so the
// functions that use it are still pure in every sense a caller can observe.
let memoSeed = -1;
let memoField: RoadField | null = null;

function fieldFor(seed: number): RoadField {
  if (memoField !== null && memoSeed === seed) return memoField;
  const field: RoadField = {
    curve: subSeed(seed, 'road/curve'),
    hillAlong: subSeed(seed, 'road/hill/along'),
    hillAcross: subSeed(seed, 'road/hill/across'),
    hillDiagonal: subSeed(seed, 'road/hill/diagonal'),
    bumpA: subSeed(seed, 'road/bump/a'),
    bumpB: subSeed(seed, 'road/bump/b'),
  };
  memoSeed = seed;
  memoField = field;
  return field;
}

/** Lateral offset of the centreline at arc distance `s`. */
function centreX(field: RoadField, s: number): number {
  return (
    CURVE_AMPLITUDE_M *
    fbm1D(field.curve, s / CURVE_WAVELENGTH_M, CURVE_OCTAVES, CURVE_LACUNARITY, CURVE_GAIN)
  );
}

/**
 * The landform: big, slow, walkable.
 *
 * `rng.ts` only offers 1D noise, and adding a 2D generator to it is not this
 * module's call. Summing three 1D bands taken along different directions —
 * down the road, across it, and diagonally — gets there anyway. Two bands
 * would read as corduroy, since the sum of a function of X and a function of
 * Z has ridges locked to the axes; the diagonal term is what breaks that up
 * and makes the result look like hills.
 */
function hills(field: RoadField, x: number, z: number): number {
  return (
    HILL_ALONG_M * fbm1D(field.hillAlong, z / HILL_ALONG_WAVELENGTH_M, 2) +
    HILL_ACROSS_M * fbm1D(field.hillAcross, x / HILL_ACROSS_WAVELENGTH_M, 2) +
    HILL_DIAGONAL_M * fbm1D(field.hillDiagonal, (x + z) / HILL_DIAGONAL_WAVELENGTH_M, 2)
  );
}

/** Small surface detail, present everywhere except on the road itself. */
function bumps(field: RoadField, x: number, z: number): number {
  return (
    BUMP_A_M * fbm1D(field.bumpA, (x - z) / BUMP_A_WAVELENGTH_M, 2) +
    BUMP_B_M * fbm1D(field.bumpB, x / BUMP_B_WAVELENGTH_M, 2)
  );
}

/** Untouched ground: landform plus surface detail, the way it would be if no road ran through it. */
function naturalHeight(field: RoadField, x: number, z: number): number {
  return hills(field, x, z) + bumps(field, x, z);
}

/**
 * How much the road corridor owns the ground at lateral distance `d`.
 * 1 on the carriageway, 0 past the falloff, smoothstepped between.
 *
 * Smoothstep rather than a linear ramp because the derivative has to be
 * continuous at *both* ends: a linear blend leaves a crease along the edge of
 * the verge and another where the falloff ends, and low-poly flat shading
 * shows creases far more clearly than a smooth mesh does.
 */
function corridorWeight(d: number): number {
  if (d <= CORRIDOR_HALF_WIDTH_M) return 1;
  const t = (d - CORRIDOR_HALF_WIDTH_M) / CORRIDOR_FALLOFF_M;
  if (t >= 1) return 0;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Ground height at the centreline. The road follows the landform but ignores
 * the surface detail — that is what "graded" means, and it is why the lane
 * never has a 1 m hummock in the middle of it.
 */
function laneHeight(field: RoadField, s: number): number {
  return hills(field, centreX(field, s), s);
}

/**
 * Ground height anywhere in the world.
 *
 * Pure, cheap, and safe to call per vertex: the terrain mesh builder and the
 * bard's footing use the same function, so a prop placed by height never
 * floats or sinks relative to the ground the player walks on.
 *
 * The corridor flattening is the important part. Without it the road happily
 * runs up the side of a hill the noise happened to put there. With it, the
 * ground is pulled toward the lane's own height near the road and released
 * back to natural over `CORRIDOR_FALLOFF_M` — which reads as a cutting where
 * the road passes through a rise and an embankment where it crosses a dip,
 * both of which are what a real lane does.
 */
export function terrainHeight(road: DailyRoad, x: number, z: number): number {
  const field = fieldFor(road.seed);
  // `z` doubles as `s` here; see the header note on the parameterisation.
  const cx = centreX(field, z);
  // Horizontal offset rather than true perpendicular distance. They differ by
  // a factor of cos(heading), so the corridor is at most a few per cent wider
  // through the sharpest bend — invisible, and it saves two noise evaluations
  // per vertex.
  const w = corridorWeight(Math.abs(x - cx));
  // The two early-outs come before the work they would make redundant, and
  // the far one comes first: the corridor is 69 m wide against a terrain mesh
  // hundreds of metres across, so the overwhelming majority of vertices are
  // natural ground and would otherwise pay for a `hills` call at the lane that
  // is then multiplied by a weight of zero. Six wasted noise evaluations per
  // vertex is more than the string hashing the memo above exists to avoid.
  if (w <= 0) return naturalHeight(field, x, z);
  const lane = hills(field, cx, z);
  if (w >= 1) return lane;
  const natural = naturalHeight(field, x, z);
  return natural + (lane - natural) * w;
}

/**
 * The centreline at arc distance `s`. Defined for any `s`, including negative
 * and past the campfire: the mesh builder needs a little road beyond both ends
 * or the world visibly stops.
 *
 * `out` exists because this is called several times a frame and the result is
 * read and discarded. Pass a scratch object to keep the walk allocation-free;
 * omit it and you get a fresh one, which is what most callers want.
 */
export function sampleRoad(road: DailyRoad, s: number, out?: RoadSample): RoadSample {
  const field = fieldFor(road.seed);
  const x = centreX(field, s);
  const y = hills(field, x, s);
  const ahead = centreX(field, s + HEADING_EPSILON_M);
  const behind = centreX(field, s - HEADING_EPSILON_M);
  const heading = Math.atan2(ahead - behind, 2 * HEADING_EPSILON_M);
  if (out) {
    out.s = s;
    out.x = x;
    out.y = y;
    out.heading = heading;
    return out;
  }
  return { s, x, y, heading };
}

/**
 * Which biome stretch `s` falls in. A band owns `[startS, endS)`, so a stop
 * sitting exactly on a seam belongs to the band it is walking into — which is
 * the one the player can see. The last band owns its end point too, so the
 * campfire at `lengthM` has a biome.
 */
export function biomeAt(road: DailyRoad, s: number): string {
  const bands = road.bands;
  for (let i = 0; i < bands.length; i++) {
    if (s < bands[i].endS) return bands[i].biomeId;
  }
  return bands[bands.length - 1].biomeId;
}

/**
 * The first stop strictly beyond `s`, optionally of one kind only.
 *
 * Strictly beyond, not at-or-beyond, and that matters: a scene that busks
 * when the player reaches a stop and then resumes the walk from exactly that
 * `s` would otherwise be handed the same stop again forever. Arrival is a
 * proximity test on the returned stop, not an equality test.
 *
 * Linear rather than binary search — a day has fifteen or so stops, and the
 * scan stops at the first hit, so it is a handful of comparisons.
 */
export function nextStop(road: DailyRoad, s: number, kind?: RoadStopKind): RoadStop | null {
  for (let i = 0; i < road.stops.length; i++) {
    const stop = road.stops[i];
    if (stop.s <= s) continue;
    if (kind === undefined || stop.kind === kind) return stop;
  }
  return null;
}

interface PlacedStop {
  s: number;
  kind: RoadStopKind;
}

/**
 * Build a day's road.
 *
 * `seed` alone decides the geometry — length, bends, hills, bands, stop
 * positions. `dayKey` only labels the result and seasons the stop ids. The
 * split is deliberate: free play and tests want to dial up an arbitrary road
 * without inventing a fake calendar date, and the daily walk gets its shared
 * road by passing `dailySeed()` and `dayKey()` from the same instant.
 */
export function generateRoad(seed: number, dayKey: string): DailyRoad {
  if (BIOMES.length === 0) throw new Error('generateRoad needs at least one biome');

  // Separate streams per system. If length, bands and stops all drew from one
  // generator, changing how many bands a day has would silently reshuffle
  // every stop on it, and the day-to-day variety would start to rhyme.
  const shapeRand = mulberry32(subSeed(seed, 'road/shape'));
  const bandRand = mulberry32(subSeed(seed, 'road/bands'));
  const stopRand = mulberry32(subSeed(seed, 'road/stops'));
  const field = fieldFor(seed);

  // Round numbers because the length is shown to the player at the campfire.
  const lengthM = Math.round(randRange(shapeRand, ROAD_MIN_LENGTH_M, ROAD_MAX_LENGTH_M) / 10) * 10;

  const bands = buildBands(bandRand, lengthM);
  const stops = buildStops(stopRand, field, lengthM, seed, dayKey, bands);

  return { seed, dayKey, lengthM, bands, stops };
}

function buildBands(rand: Rand, lengthM: number): RoadBand[] {
  const count = randInt(rand, 3, Math.min(5, 3 + BIOMES.length));

  // Weights rather than random cut points: independent cut points can land
  // arbitrarily close together and produce a band the player crosses in three
  // strides. A weight floor of 1 against a ceiling of 1.9 keeps the shortest
  // band at worst about half the length of the longest.
  const weights: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = 1 + rand() * 0.9;
    weights.push(w);
    total += w;
  }

  // Boundaries are computed once and shared by the band on either side, so
  // contiguity is exact rather than approximately true.
  const boundaries: number[] = [0];
  let acc = 0;
  for (let i = 0; i < count - 1; i++) {
    acc += weights[i];
    boundaries.push((acc / total) * lengthM);
  }
  boundaries.push(lengthM);

  const bands: RoadBand[] = [];
  let previous = -1;
  for (let i = 0; i < count; i++) {
    const options: number[] = [];
    for (let b = 0; b < BIOMES.length; b++) if (b !== previous) options.push(b);
    // A single-biome world cannot alternate; take it rather than throw.
    const chosen = options.length > 0 ? pick(rand, options) : 0;
    previous = chosen;
    bands.push({ startS: boundaries[i], endS: boundaries[i + 1], biomeId: BIOMES[chosen].id });
  }
  return bands;
}

function buildStops(
  rand: Rand,
  field: RoadField,
  lengthM: number,
  seed: number,
  dayKey: string,
  bands: RoadBand[]
): RoadStop[] {
  const placed: PlacedStop[] = [];
  const taken: number[] = [];

  const fits = (s: number): boolean => {
    if (s < 0 || s > lengthM) return false;
    for (let i = 0; i < taken.length; i++) {
      if (Math.abs(taken[i] - s) < MIN_STOP_SPACING_M) return false;
    }
    return true;
  };
  const place = (kind: RoadStopKind, s: number): boolean => {
    if (!fits(s)) return false;
    placed.push({ kind, s });
    taken.push(s);
    return true;
  };

  // The campfire goes down first and everything else has to work around it.
  // It is the one stop whose position is a promise rather than a preference.
  place('campfire', lengthM);

  // Busking spots are the spine of the day, so they claim their ground next.
  let s = randRange(rand, FIRST_STOP_MIN_M, FIRST_STOP_MAX_M);
  while (s <= lengthM - TAIL_QUIET_M) {
    place('busk', s);
    s += randRange(rand, BUSK_GAP_MIN_M, BUSK_GAP_MAX_M);
  }

  // Vistas third, because unlike an encounter a vista cannot be moved — the
  // whole point is that it sits on a high point. Encounters go last for the
  // same reason in reverse: they fit anywhere, so they fill what is left.
  placeVistas(rand, field, lengthM, place);

  // A crossroads at a biome seam. Putting it anywhere else makes it scenery;
  // putting it exactly where the country changes makes it a junction, and
  // gives the player a readable reason the world just looked different.
  let crossroads = 0;
  for (let i = 1; i < bands.length && crossroads < MAX_CROSSROADS; i++) {
    if (!chance(rand, CROSSROADS_CHANCE)) continue;
    if (place('crossroads', bands[i].startS)) crossroads++;
  }

  placeEncounters(rand, taken, place);

  // Sorted by distance, with a total order even for coincident stops so that
  // two engines cannot disagree about which came first. `localeCompare` would
  // reintroduce exactly the machine dependence this is here to remove.
  placed.sort((a, b) => a.s - b.s || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));

  const counters = new Map<RoadStopKind, number>();
  return placed.map((p) => {
    const n = counters.get(p.kind) ?? 0;
    counters.set(p.kind, n + 1);
    const id = `${dayKey}/${p.kind}/${n}`;
    return { s: p.s, kind: p.kind, id, seed: subSeed(seed, `stop/${id}`) };
  });
}

function placeVistas(
  rand: Rand,
  field: RoadField,
  lengthM: number,
  place: (kind: RoadStopKind, s: number) => boolean
): void {
  const wanted = randInt(rand, 1, 2);

  const probes: number[] = [];
  const heights: number[] = [];
  for (let s = VISTA_MARGIN_M; s <= lengthM - VISTA_MARGIN_M; s += VISTA_PROBE_STEP_M) {
    probes.push(s);
    heights.push(laneHeight(field, s));
  }

  const byHeight = (a: number, b: number): number => heights[b] - heights[a] || probes[a] - probes[b];

  const summits: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < probes.length; i++) {
    const isSummit = i > 0 && i < probes.length - 1 && heights[i] > heights[i - 1] && heights[i] > heights[i + 1];
    (isSummit ? summits : rest).push(i);
  }
  summits.sort(byHeight);
  rest.sort(byHeight);

  // Summits first, then any remaining ground by height. A vista on a shoulder
  // is a weaker beat than one on a summit, but a day with nowhere to stop and
  // look is worse than either, and the busk spacing can genuinely leave every
  // summit blocked on a short road.
  const order = summits.concat(rest);

  const chosen: number[] = [];
  for (let i = 0; i < order.length && chosen.length < wanted; i++) {
    const s = probes[order[i]];
    if (chosen.some((other) => Math.abs(other - s) < VISTA_SEPARATION_M)) continue;
    if (place('vista', s)) chosen.push(s);
  }
}

function placeEncounters(
  rand: Rand,
  taken: number[],
  place: (kind: RoadStopKind, s: number) => boolean
): void {
  let count = 0;
  // First pass leaves gaps empty sometimes, so the walk has quiet stretches.
  for (const gap of gapsIn(taken)) {
    if (!chance(rand, ENCOUNTER_CHANCE)) continue;
    if (place('encounter', encounterSpot(rand, gap))) count++;
  }
  if (count > 0) return;

  // A day with nothing but busking on it has no story in it, so if the dice
  // emptied every gap, take the roomiest one for certain.
  const width = (g: Gap): number => g.to - g.from;
  const gaps = gapsIn(taken).sort((a, b) => width(b) - width(a) || a.from - b.from);
  for (const gap of gaps) {
    if (place('encounter', encounterSpot(rand, gap))) return;
  }
}

interface Gap {
  from: number;
  to: number;
}

/** Gaps between consecutive occupied points that are wide enough to host one more stop. */
function gapsIn(taken: number[]): Gap[] {
  const sorted = taken.slice().sort((a, b) => a - b);
  const gaps: Gap[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] >= 2 * MIN_STOP_SPACING_M + 6) {
      gaps.push({ from: sorted[i], to: sorted[i + 1] });
    }
  }
  return gaps;
}

/**
 * A spot inside a gap, jittered off dead centre so that a road of evenly
 * spaced busking spots does not also have evenly spaced encounters between
 * them. The jitter is bounded by whatever room the spacing rule leaves, with
 * 3 m held back so the result is never exactly on the limit.
 */
function encounterSpot(rand: Rand, gap: Gap): number {
  const room = gap.to - gap.from - 2 * MIN_STOP_SPACING_M;
  const swing = Math.max(0, room / 2 - 3);
  return (gap.from + gap.to) / 2 + randRange(rand, -swing, swing);
}
