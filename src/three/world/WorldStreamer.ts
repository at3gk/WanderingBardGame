/**
 * The world, built in chunks along the road and streamed as the bard walks.
 *
 * The central decision here is that the terrain is a **ribbon in road
 * space**, not a heightmap in world space. Each chunk is a grid of
 * (distance-along-road, offset-across-road) samples pushed out to world
 * positions. Three things fall out of that for free:
 *
 * - The road corridor is *always* covered at full resolution, however the
 *   road bends. A world-space grid has to either be uniformly dense
 *   everywhere (wasteful) or risk the road crossing a coarse cell.
 * - Detail can be concentrated where the player looks. The lateral samples
 *   are distributed on a power curve, so the first ten metres either side
 *   of the road get most of the vertices and the far hills get very few.
 * - Streaming is one-dimensional. "Which chunks do I need" is a range on
 *   `s`, not a quadtree.
 *
 * Scatter (grass, ferns, flowers, rocks, trees) is GPU-instanced, one draw
 * call per kind per chunk, with per-instance colour so a single call can
 * cover a whole biome's worth of greens. Instances are placed from a
 * chunk-derived seed, so chunk 12 contains exactly the same trees whether
 * you walked to it or the camera streamed it in from behind you — which
 * matters because a player who turns around must not find a different wood.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type ShaderMaterial,
} from 'three';
import {
  biomeAt,
  sampleRoad,
  terrainHeight,
  type DailyRoad,
  type RoadSample,
} from '../../core/road';

import { mulberry32, randRange, subSeed, weightedPick, type Rand } from '../../core/rng';
import { createFoliageMaterial, createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import {
  cachedGeometry,
  chapelGeometry,
  fallenLogGeometry,
  fernGeometry,
  flowerGeometry,
  grassTuftGeometry,
  pebbleGeometry,
  reedClumpGeometry,
  rockGeometry,
  shrubGeometry,
  standingStoneGeometry,
  treeGeometry,
  trilithonGeometry,
  type LandmarkOptions,
} from './geometry';
import { mixColor, paletteFor, type BiomePalette, type LandmarkKind } from './palette';

/**
 * The road's world Z.
 *
 * `core/road` parameterises the centreline so that `dz/ds` is 1 by
 * construction — the road runs down +Z and meanders in X — which means a
 * sample's world Z *is* its `s`. That also means `s` is strictly a Z
 * coordinate rather than a true arc length (the real arc is longer by
 * `sqrt(1 + (dx/ds)^2)`, at most a fraction of a percent at this curvature).
 * Nothing here needs true arc length, and the simplification is what lets
 * terrain sampling invert position to `s` for free. This accessor exists so
 * the assumption is stated in one place rather than assumed in twenty.
 */
function roadZ(sample: RoadSample): number {
  return sample.s;
}

/** Metres of road per chunk. */
const CHUNK_LENGTH = 60;
/**
 * Half-width of the terrain ribbon, metres — and, since the ribbon is the
 * furthest built thing in the world, how far the ground reaches before the
 * sky dome takes over.
 *
 * Exported because the aerial perspective has to be stated against it. Fog
 * range was previously set as a multiple of the quality tier's view
 * distance, and both settings it has had put the near plane at or beyond
 * this number: at 0.55x it was 165 m and at 1.1x it was 330, so on the
 * high tier the world had *no* aerial perspective at all — smoothstep's
 * lower edge sat exactly where the geometry ran out. Air is a property of
 * the place, not of the machine drawing it.
 */
export const TERRAIN_REACH = 165;
const HALF_WIDTH = TERRAIN_REACH;
/**
 * Samples along the road within a chunk.
 *
 * Seventeen rather than thirteen, which is 3.75 m apart. The ground's
 * colour drift is carried in vertex colour and so is limited by this
 * spacing: at 5 m the mid-range patches were aliasing into a flat wash,
 * which is most of why the meadow used to have nothing in it at any scale.
 */
const ALONG_SAMPLES = 17;
/**
 * Half-width of the packed road surface, metres.
 *
 * Narrowed from 2.3 m after a phone-portrait frame showed the road as a
 * featureless tan expanse filling the lower half of the picture. Some of
 * that is unavoidable perspective — a camera 2.4 m up and 4 m back sees the
 * ground a couple of metres in front of it, and at a portrait field of view
 * that is a strip barely a metre wide, so whatever is underfoot fills the
 * bottom of the frame whatever its width.
 *
 * The fix is therefore not only to narrow it but to make sure the thing
 * underfoot has something *in* it. A 3.4 m cart track with grass reaching
 * the ruts reads as a path worn by use; a 4.6 m one with a bare shoulder
 * either side reads as a beach, which is the note the frame earned.
 */
export const ROAD_HALF_WIDTH = 1.7;
/** Where the worn shoulder finishes blending back into grass. */
const SHOULDER = 2.9;

/**
 * Lateral sample offsets, precomputed once.
 *
 * The near half is a hand-placed list, not a curve. The road's colour is
 * carried in vertex colour (so it cannot z-fight the ground it lies on),
 * which means the edge of the carriageway is only as sharp as the vertex
 * nearest to it — and under the old power curve the nearest vertices to a
 * 2.3 m road edge sat at 0.87 m and 2.53 m, so the road faded out over
 * nearly two metres and read as a stain rather than as a lane. Placing
 * vertices *on* the rut, the carriageway edge and the end of the shoulder
 * costs eight more columns and buys a road with an edge.
 *
 * Past the verge a power curve takes over, which is what lets this stay
 * dense where the player looks and still reach the horizon.
 *
 * It has to be sorted, and it was not. When the carriageway was narrowed
 * from 2.3 m to 1.7 m the two named offsets moved and the hand-placed ones
 * around them did not, which left the list running 1.85, 1.70, 2.90, 3.55,
 * 2.90 — two strips of ground folded back on themselves. A folded quad has a
 * normal pointing anywhere at all, so each fold came out as a hairline of
 * wrongly-lit ground running from the bard's feet to the vanishing point:
 * dead straight, crossing most of the frame, and with no landform under it.
 * Anything added here has to keep the order.
 */
const NEAR_OFFSETS = [
  0,
  0.6,
  // the wheel ruts
  ROAD_HALF_WIDTH * 0.55,
  1.3,
  // the edge of the packed surface, and the worn shoulder beyond it
  ROAD_HALF_WIDTH,
  2.1,
  2.5,
  SHOULDER,
  3.7,
  5.3,
  7.0,
  9.5,
  12.5,
];
const FAR_SAMPLES = 12;
/**
 * Exponent on the far half of the curve. At 2.6 — which is what the whole
 * ribbon used to use — the samples between twenty and seventy metres were
 * thirty metres apart, so a forty-metre patch of colour drift fell between
 * two vertices and simply did not exist. 1.8 puts a sample every four to
 * twelve metres out to seventy, which is the band the eye actually reads,
 * and still lets the outermost reach the horizon.
 */
const FAR_FALLOFF = 1.8;

const ACROSS_OFFSETS = (() => {
  const half = NEAR_OFFSETS.slice();
  const last = half[half.length - 1];
  for (let i = 1; i <= FAR_SAMPLES; i++) {
    const t = i / FAR_SAMPLES;
    half.push(last + Math.pow(t, FAR_FALLOFF) * (HALF_WIDTH - last));
  }
  const offsets: number[] = [];
  for (let i = half.length - 1; i >= 1; i--) offsets.push(-half[i]);
  for (const u of half) offsets.push(u);
  return offsets;
})();
const ACROSS_SAMPLES = ACROSS_OFFSETS.length;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The per-channel ratio `a / b`, as a colour.
 *
 * This exists to get the tree trunks out of a hole. A tree is one instanced
 * mesh, so its per-instance colour multiplies *every* vertex — trunk
 * included. When that colour was the canopy green, bark came out as green
 * times brown, which is near black, and every tree in the world stood on a
 * charred stick.
 *
 * The fix is to bake both real colours into the geometry's vertex colours
 * and let the instance colour be a near-white *tint* instead. This function
 * gives the dark end of that tint: multiply it by the lighter canopy colour
 * and you land exactly on the darker one, so the full canopy spread is
 * still reachable while the trunk only ever gets scaled between its own
 * colour and a shaded version of it.
 */
function channelRatio(a: number, b: number): number {
  const channel = (shift: number): number => {
    const denominator = (b >> shift) & 0xff;
    if (denominator === 0) return 0xff;
    return Math.max(0, Math.min(255, Math.round((((a >> shift) & 0xff) / denominator) * 255)));
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Choose one of a kind's allowed bands, weighted by how wide it is, so a
 * band twice as wide gets twice the plants and the density figure means the
 * same thing in every band.
 *
 * The single-band case returns without drawing at all. That is deliberate:
 * every kind that existed before bands did takes this path, so their random
 * streams are untouched and the meadow does not reshuffle itself the day
 * the road gains a crown.
 */
function pickZone(
  rand: Rand,
  zones: Array<[number, number]>,
  totalWidth: number,
): [number, number] {
  if (zones.length === 1) return zones[0];
  let remaining = rand() * totalWidth;
  for (const zone of zones) {
    remaining -= zone[1] - zone[0];
    if (remaining <= 0) return zone;
  }
  return zones[zones.length - 1];
}

function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * The verge.
 *
 * Everything scattered here keeps at least this far off the centreline, and
 * the taller a thing is the further out it starts. Without it, scatter sat
 * against the carriageway and the first ten metres of the view were blocked
 * by a fern — which is a shame in a game whose whole subject is the road
 * ahead. Grass comes right up to the packed edge, flowers a metre further,
 * anything knee-high or taller stands back beyond the shoulder.
 */
const VERGE = {
  grass: ROAD_HALF_WIDTH + 0.15,
  flower: ROAD_HALF_WIDTH + 1.0,
  rock: ROAD_HALF_WIDTH + 2.4,
  fern: ROAD_HALF_WIDTH + 2.6,
  reed: ROAD_HALF_WIDTH + 3.0,
  shrub: ROAD_HALF_WIDTH + 3.6,
  log: ROAD_HALF_WIDTH + 4.6,
  tree: ROAD_HALF_WIDTH + 5.5,
};

/**
 * Where the wheels have been.
 *
 * The terrain shader darkens a rut centred on `ROAD_HALF_WIDTH * 0.58`, and
 * these two numbers are the same rut expressed as a keep-out band. Nothing
 * grows in a wheel rut and nothing loose stays in one, so anything the
 * scatter puts there reads as the bard wading rather than walking.
 */
const RUT_CENTRE = ROAD_HALF_WIDTH * 0.58;
const RUT_HALF = 0.42;
/**
 * Where the bard's boots fall.
 *
 * He walks the centreline exactly — `RoadStage` puts him on `sampleRoad`'s
 * own `x` with no lateral offset — so the middle of the crown is the one
 * strip of road that must stay bare however much the rest of it gains.
 */
const FOOTFALL_HALF = 0.29;

/**
 * The carriageway, as the bands that are left once the ruts and the bard's
 * own feet are taken out of it.
 *
 * The crown band is only a quarter of a metre wide per side, which sounds
 * like nothing until you remember that this is the surface two metres from
 * the camera at all times: at a portrait field of view a strip that narrow
 * still crosses a good fraction of the frame. It is also exactly where
 * grass survives on a real cart track, between the wheels and beside the
 * walker, which is the whole reason a worn lane reads as worn rather than
 * as a trench dug through a field.
 */
const CROWN_BAND: [number, number] = [FOOTFALL_HALF, RUT_CENTRE - RUT_HALF];
/** The outer lip of the packed surface, out to where the meadow takes over. */
const EDGE_BAND: [number, number] = [RUT_CENTRE + RUT_HALF, VERGE.grass];
/** Loose stone spills a little further onto the shoulder than grass does. */
const STONE_BAND: [number, number] = [RUT_CENTRE + RUT_HALF, SHOULDER - 0.35];

interface ScatterKind {
  key: string;
  /**
   * The shapes this kind draws from. More than one entry costs one draw call
   * per shape per chunk and buys the difference between a meadow and a
   * stamp: a field built from a single tuft repeated to the horizon reads as
   * a texture of identical shark fins, which is exactly what this one did.
   */
  geometry: (variant: number) => BufferGeometry;
  /** How many distinct shapes `geometry` can build. */
  variants?: number;
  /**
   * Average number of instances per clump, or 0 for an even spread.
   *
   * Plants do not distribute themselves by rejection sampling. An even
   * spread is the other half of why the meadow read as wallpaper — every
   * tuft the same distance from its neighbours is a pattern, and the eye
   * finds patterns instantly. Clumps of a few leave bare ground between
   * them, and bare ground is what makes the clumps read as plants.
   */
  clump?: number;
  /** Instances per square metre at density 1. */
  perSquareMetre: number;
  /** Which palette density multiplier applies. */
  densityKey: keyof BiomePalette['density'];
  /** How far either side of the road this kind is scattered. */
  spread: number;
  /** Minimum distance from the road centreline. */
  clearance: number;
  /**
   * Allowed bands of `|u|`, when the kind lives somewhere more complicated
   * than "everything past a clearance".
   *
   * Only the carriageway kinds need this, and they need it badly: their
   * ground is two thin strips with a wheel rut between them, and a single
   * `clearance..spread` range cannot describe a hole in the middle. A clump
   * picks one band and stays inside it, so a tuft that was placed on the
   * crown can never wander into the rut.
   *
   * Defaults to the single band `clearance..spread`, which is what every
   * other kind means.
   */
  zones?: Array<[number, number]>;
  /**
   * Exponent on the lateral placement. 1 is uniform across the band; above
   * 1 crowds the kind against its clearance, which is how a hedgerow ends
   * up following the road instead of speckling the field.
   */
  edgeBias?: number;
  scale: [number, number];
  /** Only drawn on chunks within this many metres of the bard. */
  lodRange: number;
  castShadow: boolean;
  material: 'foliage' | 'solid';
  colorOf: (palette: BiomePalette, rand: Rand) => number;
}

/** Seeds for the four grass silhouettes and the four ferns. Arbitrary primes. */
const GRASS_SEEDS = [7, 11, 19, 23];
const FERN_SEEDS = [9, 13, 29, 37];
const PEBBLE_SEEDS = [41, 53, 67];

const SCATTER_KINDS: ScatterKind[] = [
  /**
   * Grass surviving on the road: the crown between the ruts, and the lip at
   * the outer edge of the packed surface.
   *
   * Small — a third to two thirds of the meadow tuft's size, so ankle-high
   * becomes a few centimetres. It is not a lawn breaking through, it is the
   * stuff that gets trodden back down every few days, and at that scale it
   * reads as texture on the road rather than as the road being reclaimed.
   *
   * The arithmetic, because this is the surface nearest the camera and the
   * easiest place in the world to waste a phone's budget: the two bands are
   * about 0.72 m wide per side, so 60 m of chunk offers 86 m² and 2.2 per
   * square metre is under 200 instances of a fifteen-triangle tuft. Five
   * chunks carry it, which is 14 000 triangles — against the 300 000 the
   * meadow grass alone already spends on the three chunks nearest the bard.
   */
  {
    key: 'roadgrass',
    geometry: (v) => cachedGeometry(`grass:${v}`, () => grassTuftGeometry(GRASS_SEEDS[v])),
    variants: 4,
    clump: 3,
    perSquareMetre: 2.6,
    densityKey: 'road',
    zones: [CROWN_BAND, EDGE_BAND],
    clearance: CROWN_BAND[0],
    spread: EDGE_BAND[1],
    scale: [0.32, 0.6],
    lodRange: CHUNK_LENGTH * 2.6,
    castShadow: false,
    material: 'foliage',
    // Drier and paler than the meadow it borders. Road grass lives on
    // packed earth in full sun with cart wheels either side of it; drawn
    // from the same greens as the field, it read as a strip of lawn laid
    // down the middle of the track.
    colorOf: (p, rand) =>
      mixColor(mixColor(p.grass, p.grassVariant, 0.4 + rand() * 0.6), p.grassDry, 0.2 + rand() * 0.3),
  },
  /**
   * Loose stone, on the crown and spilling onto the shoulder.
   *
   * The one kind here whose job is *value* rather than shape: a scatter of
   * small hard lumps is the only thing that gives a low sun something to
   * break on, and without it the carriageway is a gradient however many
   * tones are painted into it.
   */
  {
    key: 'roadstone',
    geometry: (v) => cachedGeometry(`pebble:${v}`, () => pebbleGeometry(PEBBLE_SEEDS[v])),
    variants: 3,
    perSquareMetre: 0.5,
    densityKey: 'road',
    zones: [[FOOTFALL_HALF, RUT_CENTRE - RUT_HALF], STONE_BAND],
    clearance: FOOTFALL_HALF,
    spread: STONE_BAND[1],
    scale: [0.55, 1.25],
    lodRange: CHUNK_LENGTH * 2.6,
    castShadow: false,
    material: 'solid',
    // Pulled well toward the road's own earth. Drawn nearer the field's
    // boulder grey the stones came out lighter than the track they lie on,
    // and a handful of them at the bard's feet read as spilled chalk.
    colorOf: (p, rand) => mixColor(p.rock, p.road, 0.4 + rand() * 0.45),
  },
  {
    key: 'grass',
    // Four seeds, four silhouettes. The seeds are arbitrary primes; what
    // matters is only that they differ.
    geometry: (v) => cachedGeometry(`grass:${v}`, () => grassTuftGeometry(GRASS_SEEDS[v])),
    variants: 4,
    clump: 4,
    // Twice the old figure, and biased hard toward the road so most of it
    // lands where the camera is. Grass at 0.75 tufts per square metre is not
    // a lawn, it is a scattering of individual plants on bare earth, and
    // that is exactly how it read.
    perSquareMetre: 1.15,
    densityKey: 'grass',
    // Reaches much further than it needs to be dense at. A tight spread was
    // cheaper but drew a hard circle of green around the road with bare
    // ground outside it — which, in a view that spends half its time
    // looking sideways across a field, is worse than sparse grass
    // everywhere. The bias does the real work: about a third of the
    // instances land in the first five metres of verge, and the rest thin
    // out to nothing rather than stopping at a line.
    spread: 48,
    clearance: VERGE.grass,
    edgeBias: 1.9,
    scale: [0.8, 1.25],
    // This LOD is quantised to whole chunks — the test is
    // `|chunk - centre| * CHUNK_LENGTH > lodRange` — so any value from 60 to
    // 119 means exactly the same thing: the chunk the bard is in and the one
    // either side. It was briefly set to 55 to thin the far field and that
    // dropped it to the centre chunk *alone*, which took all the grass out of
    // the foreground whenever the bard stood near a chunk boundary. Stated as
    // a multiple of the chunk length so the relationship survives a change to
    // either number.
    lodRange: CHUNK_LENGTH * 1.6,
    castShadow: false,
    material: 'foliage',
    /*
     * Drawn from the same two greens the ground drifts between, pulled well
     * toward the deep tone. Mixing in the dry tone as well turned every tuft
     * into straw standing on green, so the meadow read as stubble in a mown
     * field.
     *
     * The reach toward the pale variant was 0.85 and the pull toward the
     * shade was 0.35, which put about half the blades *above* the ground they
     * stand in. That is the one thing this scatter must not do. It exists
     * only inside `lodRange` — ninety-six metres — so it is almost exactly
     * the near and middle ground of every frame and nothing else, which
     * makes it the one surface in the world that can be darkened without
     * touching the treeline or the distance. A foreground that carries the
     * frame's darks is most of what makes a landscape recede; a foreground
     * the same value as the hillside behind it is why these frames did not.
     */
    colorOf: (p, rand) =>
      mixColor(mixColor(p.grass, p.grassVariant, rand() * 0.5), p.grassShade, 0.2 + rand() * 0.45),
  },
  {
    key: 'fern',
    geometry: (v) => cachedGeometry(`fern:${v}`, () => fernGeometry(FERN_SEEDS[v])),
    variants: 4,
    clump: 3,
    perSquareMetre: 0.1,
    densityKey: 'fern',
    spread: 30,
    clearance: VERGE.fern,
    // Tightened hard. At 1.7 a fern frond was nearly two metres of flat
    // pale triangle lying on the ground; the forest floor was carpeted in
    // what looked like broken glass.
    scale: [0.7, 1.05],
    lodRange: 85,
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => mixColor(p.canopy, p.grassShade, 0.2 + rand() * 0.5),
  },
  {
    key: 'flower',
    geometry: () => cachedGeometry('flower', () => flowerGeometry(13)),
    clump: 3,
    perSquareMetre: 0.07,
    densityKey: 'flower',
    spread: 20,
    clearance: VERGE.flower,
    edgeBias: 1.4,
    scale: [0.85, 1.5],
    lodRange: 60,
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => (rand() < 0.55 ? p.accent : p.accentAlt),
  },
  {
    key: 'reed',
    geometry: () => cachedGeometry('reed', () => reedClumpGeometry(21)),
    perSquareMetre: 0.04,
    densityKey: 'reed',
    spread: 22,
    clearance: VERGE.reed,
    // Reeds crowd the roadside because that is where the ditch is.
    edgeBias: 2.1,
    scale: [0.7, 1.0],
    lodRange: 110,
    castShadow: false,
    material: 'foliage',
    // Deep and blue-green, borrowed from the canopy rather than from the
    // meadow. Mixed toward the pale ground tones they came out as straw,
    // and a field of straw verticals reads as a wheat crop rather than as
    // a wet bank — the one thing the reeds exist to say.
    colorOf: (p, rand) => mixColor(p.grassShade, p.canopy, 0.25 + rand() * 0.55),
  },
  {
    key: 'shrub',
    geometry: () => cachedGeometry('shrub', () => shrubGeometry(23)),
    perSquareMetre: 0.024,
    densityKey: 'shrub',
    spread: 46,
    clearance: VERGE.shrub,
    // Enough bias to follow the lane like a hedgerow, not so much that the
    // bushes queue up into an unbroken wall with the country hidden behind
    // it. 2.4 was a wall.
    edgeBias: 1.7,
    scale: [0.85, 1.5],
    lodRange: 120,
    castShadow: true,
    material: 'foliage',
    colorOf: (p, rand) => mixColor(p.canopy, p.canopyVariant, rand() * 0.7),
  },
  {
    key: 'log',
    geometry: () => cachedGeometry('log', () => fallenLogGeometry(29)),
    perSquareMetre: 0.006,
    densityKey: 'log',
    spread: 44,
    clearance: VERGE.log,
    scale: [0.8, 1.4],
    lodRange: 120,
    castShadow: true,
    material: 'solid',
    colorOf: (p, rand) => mixColor(p.trunk, p.rock, 0.15 + rand() * 0.35),
  },
  {
    key: 'rock',
    geometry: () => cachedGeometry('rock', () => rockGeometry(17)),
    perSquareMetre: 0.009,
    densityKey: 'rock',
    spread: 70,
    clearance: VERGE.rock,
    // A boulder taller than the bard is a landmark, not scatter, and three
    // of them per chunk turned every field into a quarry.
    scale: [0.45, 1.25],
    lodRange: 150,
    castShadow: true,
    material: 'solid',
    colorOf: (p, rand) => mixColor(p.rock, p.grassShade, rand() * 0.18),
  },
];

const TREE_KINDS = ['conifer', 'broadleaf', 'willow'] as const;
/** Distinct base shapes per species. Four is enough to stop a wood repeating. */
const TREE_VARIANTS = 4;

/**
 * Landmarks: the one thing in the world placed for the walk.
 *
 * Everything else here is scattered — it is where it is because the ground
 * under it said so. A landmark is chosen instead, from the road's own seed,
 * so that every player walking today's road passes the same chapel on the
 * same hill; and it is placed on a ridge, because a landmark not silhouetted
 * against sky is just another prop on a plain and gives the walk nothing to
 * be going toward.
 *
 * Roughly one every three hundred metres, which on a 1200–1800 m road is
 * four to six in a day. More often and they stop being events; less often
 * and most of the walk has an empty skyline, which is what it had before.
 */
const LANDMARK_SPACING_M = 300;
/**
 * How far off the road a landmark may stand.
 *
 * The near limit keeps it out of the bard's own frame — at thirty metres a
 * chapel is beside him rather than ahead of him, and the point of the thing
 * is to be somewhere he has not got to yet.
 *
 * The far limit is about the field of view, not the fog. The camera sees 34
 * degrees either side of the road; something a hundred metres out to the
 * side has already left the frame by the time the bard is a hundred metres
 * short of it, so it is only ever glimpsed at extreme range and then gone.
 * Sixty-eight metres holds a landmark in shot for the whole approach, which
 * is the entire point of putting one there.
 */
const LANDMARK_NEAR_M = 34;
const LANDMARK_FAR_M = 60;
/** Where the sight-line test stands: far enough back to be the first sight of it. */
const LANDMARK_APPROACH_M = 220;
/**
 * Where the camera is actually pointing, relative to the lane.
 *
 * It tracks the rig, and it is the single most surprising number in this
 * file: the camera's axis sits to the *left* of the road's heading, and does
 * so on every stretch of every road — because `CameraRig` stands the camera
 * to one side of the bard and aims it at a point that leads him, and neither
 * of those flips sign with the bend.
 *
 * The consequence is that the frame is not centred on the lane. Of the
 * thirty-four degrees the camera shows either side of its axis, the road
 * ahead occupies the right-hand part, and the *left* of the picture — the
 * part with nothing in it, which is exactly the complaint a landmark exists
 * to answer — is the country beside the road. So landmarks go on the left,
 * every time. That reads as a rule with no reason behind it right up until
 * you put one on the right and watch it never once appear in a frame.
 *
 * Being a property of the rig, it has to be retuned whenever the rig's
 * walking framing changes — that is the framing the player is in on the
 * approach, and `LANDMARK_APPROACH_M` below is where the test stands. The
 * rig's own arithmetic puts its axis at `-atan(side / (distance + lead))`,
 * which is -0.186 at walking's current 1.2 / 4.0 / 2.4 and was -0.359 at the
 * old side of 2.4.
 *
 * This sits a little to the left of that axis rather than on it, and the
 * reason is worth writing down because the number will not survive being
 * "corrected" to the formula. The search below is coarse — two sides, four
 * metre steps, nine metre steps along — so it does not return the centre of
 * the admitted window, it returns whichever of a handful of candidate hills
 * scores highest inside it. Move the window by a few hundredths and nothing
 * happens; move it far enough to admit or drop a candidate and the landmark
 * jumps across the frame. Measured on shots 03 and 10, anything from -0.24 to
 * -0.33 picks the same sites and puts them on the skyline near the road's
 * convergence; -0.19 picks different ones and pushes them to the left edge.
 * So this is the middle of the plateau, not the answer to a sum.
 *
 * Nothing fails loudly when it drifts out of step — the landmarks simply stop
 * appearing in frames — so it is checked by shooting the approach.
 */
const LANDMARK_VIEW_BIAS = -0.26;
/** How far off that axis a landmark may sit, seen from the approach. */
const LANDMARK_MAX_OFF_AXIS = 0.28;
/** Distinct base shapes per landmark kind. */
const LANDMARK_VARIANTS = 3;

interface Landmark {
  kind: LandmarkKind;
  /** Nominal distance along the road. Decides which chunk builds it. */
  s: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  variant: number;
  /** Ground kept clear of trees and shrubs, so the thing keeps its sky. */
  radius: number;
}

/**
 * Ground a landmark has claimed.
 *
 * Shares the shape of `inClearing` but not its list, because the two are
 * asking different questions: a camp clearing appears once, at dusk, and
 * rebuilds the world when it does, whereas a landmark's clearing is a
 * property of the seed and is known before its chunk is ever built.
 */
function insideLandmark(landmarks: Landmark[], x: number, z: number): boolean {
  for (const landmark of landmarks) {
    const dx = x - landmark.x;
    const dz = z - landmark.z;
    if (dx * dx + dz * dz < landmark.radius * landmark.radius) return true;
  }
  return false;
}

interface Chunk {
  index: number;
  group: Group;
  meshes: Array<Mesh | InstancedMesh>;
  /**
   * Which scatter kinds this chunk was built with, one bit each.
   *
   * A chunk is born seven chunks ahead of the bard — four hundred metres —
   * where every kind is out of LOD range, and until this existed it kept
   * that emptiness for the rest of its life. The effect was that the meadow
   * had grass in it for the first two chunks of a walk and never again:
   * everything the player ever walked through had been built at four hundred
   * metres and carried nothing but trees. It survived this long because the
   * screenshot tool jumps the bard by hundreds of metres at a time, which
   * happens to rebuild the chunks around him at the right detail, so posed
   * frames looked right and play did not.
   */
  detail: number;
}

/** Which kinds are in range at this distance, as a bit per kind. */
function detailAt(distanceM: number): number {
  let detail = 0;
  for (let i = 0; i < SCATTER_KINDS.length; i++) {
    if (distanceM <= SCATTER_KINDS[i].lodRange) detail |= 1 << i;
  }
  return detail;
}

export interface WorldStreamerOptions {
  /** Chunks kept loaded ahead of the bard. */
  ahead?: number;
  /** Chunks kept loaded behind. Fewer than ahead: you rarely look back. */
  behind?: number;
  foliageDensity?: number;
  castShadows?: boolean;
}

export class WorldStreamer {
  readonly group = new Group();

  private readonly road: DailyRoad;
  private readonly globals: PainterlyGlobals;
  private readonly chunks = new Map<number, Chunk>();
  private readonly ahead: number;
  private readonly behind: number;
  private readonly density: number;
  private readonly castShadows: boolean;

  private readonly terrainMaterial: ShaderMaterial;
  private readonly foliageMaterial: ShaderMaterial;
  private readonly solidMaterial: ShaderMaterial;
  private readonly trunkMaterials = new Map<string, ShaderMaterial>();

  /** Scratch objects; the chunk builder runs on a walking player's frame. */
  private readonly scratchPos = new Vector3();
  private readonly scratchQuat = new Quaternion();
  private readonly scratchScale = new Vector3();
  private readonly scratchColor = new Color();
  private readonly upAxis = new Vector3(0, 1, 0);

  private lastCentre = Number.NaN;

  /**
   * Patches of ground the scatter keeps out of.
   *
   * The camp is the only thing that asks for one, and it has to ask, because
   * the streamer places shrubs from 5.9 m off the centreline outward and the
   * layout puts the fire between 5.8 and 7.4 m out — so a camp is pitched
   * *in the bushes* by construction. What that looked like was worse than it
   * sounds: at the resting framing a single waist-high shrub stood between
   * the camera and the flame, and the day's emotional anchor was a dark green
   * lump with one triangle of fire showing over the top. Nobody pitches a
   * camp in a thicket, and the rule that the warmest light in a frame comes
   * from the fire cannot survive an occluder.
   */
  private readonly clearings: Array<{ x: number; z: number; radius: number }> = [];

  /** Resolved landmarks by slot; null means "this stretch has no brow". */
  private readonly landmarkSlots = new Map<number, Landmark | null>();

  /** Chunks waiting to be rebuilt at a higher level of detail. */
  private readonly pending: number[] = [];

  constructor(
    road: DailyRoad,
    globals: PainterlyGlobals,
    options: WorldStreamerOptions = {},
  ) {
    this.road = road;
    this.globals = globals;
    this.ahead = options.ahead ?? 7;
    this.behind = options.behind ?? 3;
    this.density = options.foliageDensity ?? 1;
    this.castShadows = options.castShadows ?? true;
    this.group.name = 'world';

    // Three materials for the whole world. Vertex and instance colours carry
    // every difference between a village oak and a riverside willow, which
    // is what keeps this at three shader programs instead of thirty.
    this.terrainMaterial = createPainterlyMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xd8c98f,
      grain: 0.55,
      grainScale: 0.11,
      rim: 0.05,
      rimPower: 3.5,
      vertexColors: true,
      groundTones: 1,
      /**
       * Wide enough that the ground does not band at all.
       *
       * This was 0.13 and it produced the worst artifact in the game: three
       * soft-edged slabs the size of buildings lying across the fields, which
       * read as broken shadow maps. The cause is that the banding is a
       * *screen-space* effect being applied to a surface whose normal varies
       * over hundreds of metres — the band edges are only 0.07 wide in `lit`,
       * but on a near-flat plane 0.07 of `lit` is a hundred metres of ground,
       * so an edge meant to read as a brush stroke spreads into a stripe
       * across the whole frame.
       *
       * The fix is per-material rather than in the shader, because the
       * banding is right everywhere else: a tree trunk or a rock crosses the
       * same 0.07 within a few centimetres and gets exactly the crisp toon
       * terminator it is meant to. Only the ground is big and flat enough to
       * be a problem, so only the ground gets a softness wide enough to
       * collapse the three bands into the smooth ramp they are approximating.
       * Cast shadows are untouched by this — they multiply `sunAmount` after
       * the bands — so the long raking dawn shadows still land.
       */
      bandSoftness: 0.45,
      shadowDepth: 0.42,
    });

    // Vertex colours are on for the scatter materials too, and they are not
    // carrying the plant's colour — the instance colour does that. They
    // carry a *vertical gradient*, painted into each geometry, so a blade of
    // grass is dark where it meets the soil and a boulder is dark where it
    // is bedded in. It is the cheapest available substitute for contact
    // occlusion on meshes that cannot afford to receive a shadow map.
    this.foliageMaterial = createFoliageMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xe4dd9a,
      grain: 0.55,
      grainScale: 0.5,
      sway: 0.2,
      swaySpeed: 1.5,
      swayAttribute: true,
      vertexColors: true,
      flatShading: true,
      shadowDepth: 0.5,
      // The gradient already darkens the base; doubling up on baseShade
      // buried the bottom third of every tuft in near-black.
      baseShade: 0.12,
      baseShadeHeight: 0.25,
    });

    this.solidMaterial = createPainterlyMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xbfae94,
      grain: 0.6,
      grainScale: 0.7,
      rim: 0.16,
      baseShade: 0.16,
      baseShadeHeight: 0.3,
      vertexColors: true,
      flatShading: true,
      swayAttribute: true,
      sway: 0,
    });
  }

  /** A tree material per species: they need different sway characteristics. */
  private treeMaterial(kind: string): ShaderMaterial {
    let material = this.trunkMaterials.get(kind);
    if (!material) {
      material = createFoliageMaterial(this.globals, {
        color: 0xffffff,
        colorVariant: 0xd9d07e,
        grain: 0.5,
        grainScale: 0.4,
        // A willow's fronds are long and light and move a great deal; a
        // conifer's are short and stiff and barely move at all. Using one
        // sway figure for both was the first version and made the whole
        // wood breathe in unison like a single animated object.
        sway: kind === 'willow' ? 0.42 : kind === 'conifer' ? 0.1 : 0.2,
        swaySpeed: kind === 'willow' ? 0.75 : 1.15,
        swayAttribute: true,
        vertexColors: true,
        flatShading: true,
        rim: 0.2,
        baseShade: 0.28,
        baseShadeHeight: 1.4,
        shadowDepth: 0.42,
      });
      this.trunkMaterials.set(kind, material);
    }
    return material;
  }

  /**
   * Ask for a patch of ground to be left bare of scatter, and rebuild.
   *
   * Rebuilding everything currently loaded is the whole cost, and it is the
   * right call: a clearing is asked for once a day, when the camp is made,
   * and the chunk it falls in has certainly already been built by then.
   * Filtering the existing instance buffers in place would mean tracking
   * which instance is where, which is bookkeeping for a case that happens
   * once. `lastCentre` is cleared so the very next `update` refills.
   */
  addClearing(x: number, z: number, radius: number): void {
    this.clearings.push({ x, z, radius });
    for (const [index, chunk] of this.chunks) {
      this.disposeChunk(chunk);
      this.chunks.delete(index);
    }
    this.lastCentre = Number.NaN;
  }

  /** Give the ground back, when the camp is struck. */
  clearClearings(): void {
    if (this.clearings.length === 0) return;
    this.clearings.length = 0;
    for (const [index, chunk] of this.chunks) {
      this.disposeChunk(chunk);
      this.chunks.delete(index);
    }
    this.lastCentre = Number.NaN;
  }

  private inClearing(x: number, z: number): boolean {
    for (const c of this.clearings) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.radius * c.radius) return true;
    }
    return false;
  }

  /** Stream chunks so the window is centred on the bard's distance `s`. */
  update(s: number): void {
    const centre = Math.floor(s / CHUNK_LENGTH);
    if (centre !== this.lastCentre) {
      this.lastCentre = centre;

      const first = centre - this.behind;
      const last = centre + this.ahead;

      for (const [index, chunk] of this.chunks) {
        if (index < first || index > last) {
          this.disposeChunk(chunk);
          this.chunks.delete(index);
        }
      }

      for (let i = first; i <= last; i++) {
        if (i < 0) continue;
        if (i * CHUNK_LENGTH > this.road.lengthM + CHUNK_LENGTH) continue;
        if (!this.chunks.has(i)) this.chunks.set(i, this.buildChunk(i, centre));
      }

      // Anything that has come close enough to deserve more than it was born
      // with. Only gains are queued: a chunk falling behind keeps whatever
      // detail it has, because throwing detail away costs exactly as much as
      // building it and buys nothing the player is looking at.
      this.pending.length = 0;
      for (const [index, chunk] of this.chunks) {
        const wanted = detailAt(Math.abs(index - centre) * CHUNK_LENGTH);
        if ((wanted & ~chunk.detail) !== 0) this.pending.push(index);
      }
      this.pending.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
    }

    // One per frame, nearest first. Crossing a chunk boundary can promote
    // three chunks at once, and building three chunks of meadow grass in the
    // same frame is a visible stall on a phone; spread over three frames it
    // is three ordinary chunk builds, which the walk already does.
    this.promoteOne(centre);
  }

  private promoteOne(centre: number): void {
    while (this.pending.length > 0) {
      const index = this.pending.shift() as number;
      const chunk = this.chunks.get(index);
      if (!chunk) continue;
      this.disposeChunk(chunk);
      this.chunks.set(index, this.buildChunk(index, centre));
      return;
    }
  }

  private buildChunk(index: number, centreIndex: number): Chunk {
    const group = new Group();
    group.name = `chunk-${index}`;
    const meshes: Array<Mesh | InstancedMesh> = [];

    const terrain = this.buildTerrain(index);
    group.add(terrain);
    meshes.push(terrain);

    const distanceChunks = Math.abs(index - centreIndex);
    const distanceM = distanceChunks * CHUNK_LENGTH;

    // Resolved once and handed down, because every scatter kind and the
    // trees all have to keep out of the same patches of ground.
    const landmarks = this.landmarksNear(index);

    for (const kind of SCATTER_KINDS) {
      if (distanceM > kind.lodRange) continue;
      for (const mesh of this.buildScatter(index, kind, landmarks)) {
        group.add(mesh);
        meshes.push(mesh);
      }
    }

    for (const treeMesh of this.buildTrees(index, landmarks)) {
      group.add(treeMesh);
      meshes.push(treeMesh);
    }

    for (const landmark of this.landmarksInChunk(index)) {
      const mesh = this.raiseLandmark(landmark);
      group.add(mesh);
      meshes.push(mesh);
    }

    this.group.add(group);
    return { index, group, meshes, detail: detailAt(distanceM) };
  }

  /**
   * One chunk of ground.
   *
   * Vertex colours carry the biome (blended across band boundaries so a
   * transition is a gradual change of green rather than a seam) and the road
   * surface (blended out through the shoulder). Carrying the road in vertex
   * colour rather than in a second mesh is what keeps it from z-fighting the
   * ground it is lying on, which is the classic way this goes wrong.
   *
   * What vertex colour deliberately no longer carries is the meadow's
   * *drift* — the patchiness, the bleached ground, the damp in the ruts.
   * Every one of those is a clamped ramp, and a clamp sampled every few
   * metres and interpolated across quads up to fifteen metres wide came out
   * as a crease along the mesh's triangulation, which read as a hard-edged
   * tonal wedge lying across the field with nothing under it. It is now two
   * extra attributes — the dark and pale ends of the ground palette here —
   * and world-space noise in the fragment shader. What is left in vertex
   * colour varies over a hundred metres or more, which no tessellation this
   * mesh will ever have can turn into an edge.
   */
  private buildTerrain(index: number): Mesh {
    const s0 = index * CHUNK_LENGTH;
    const rows = ALONG_SAMPLES;
    const cols = ACROSS_SAMPLES;
    const vertexCount = rows * cols;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const toneLo = new Float32Array(vertexCount * 3);
    const toneHi = new Float32Array(vertexCount * 3);

    for (let r = 0; r < rows; r++) {
      // Overlap the last row of one chunk with the first of the next by
      // sampling the full CHUNK_LENGTH inclusive, or a hairline crack of
      // background shows through at every chunk boundary.
      const s = s0 + (r / (rows - 1)) * CHUNK_LENGTH;
      const sample = sampleRoad(this.road, s);
      // The road's normal on the XZ plane. heading is the tangent angle, so
      // the normal is that rotated a quarter turn.
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);

      const palette = paletteFor(biomeAt(this.road, s));
      // Blend toward the neighbouring band's palette across the boundary.
      const blendPalette = paletteFor(biomeAt(this.road, s + 30));
      const bandBlend = this.bandBlendAt(s);

      const grassA = mixColor(palette.grass, blendPalette.grass, bandBlend);
      const grassB = mixColor(palette.grassVariant, blendPalette.grassVariant, bandBlend);
      const shadeColor = mixColor(palette.grassShade, blendPalette.grassShade, bandBlend);
      const dryColor = mixColor(palette.grassDry, blendPalette.grassDry, bandBlend);
      const roadColor = mixColor(palette.road, blendPalette.road, bandBlend);
      const shoulderColor = mixColor(palette.roadShoulder, blendPalette.roadShoulder, bandBlend);
      const laneY = sample.y;

      /**
       * The meadow's base tone at a point: the slow drift, plus the landform.
       *
       * Everything here has to survive being sampled at the mesh's spacing
       * and linearly interpolated between, which rules out anything with a
       * kink in it. What is left is one sine at about a 170 m wavelength —
       * curved so gently that a fifteen-metre quad across it is a straight
       * line anyway — and the height term, which is what puts colour on the
       * landform itself so a rise a hundred metres off is dry and pale and
       * the hollow beside it is deep and cool.
       *
       * The height term is written as a pair of smoothsteps meeting at the
       * lane's own height rather than as the more obvious `rise > 0 ? … : …`.
       * Both are continuous, but the branch has a corner in it at the point
       * where half the ground in an open frame happens to sit, and a corner
       * is precisely what comes back as a crease. Two smoothsteps meet with
       * zero slope on both sides, so the seam has nothing to show.
       */
      const meadowAt = (mx: number, mz: number, my: number): number => {
        // Centred well below halfway on purpose: `grassVariant` is the pale
        // end of the pair and the drift in the shader reaches for a paler
        // tone still, so a meadow that sits at the midpoint of these two
        // comes out as straw everywhere and the road loses its value break
        // against the field it crosses.
        const broad =
          0.3 +
          0.22 * Math.sin(mx * 0.038 + mz * 0.027 + 2.1) +
          0.15 * Math.sin(mx * 0.071 - mz * 0.059 + 4.7);
        let color = mixColor(grassA, grassB, broad);
        // Divided by a long enough span that a field which simply slopes
        // away from the road does not come out uniformly dry, and passed
        // through a saturating map so that a cliff and a bank differ only
        // in degree.
        const rise = (my - laneY) / 14;
        const k = 0.5 + 0.5 * (rise / (1 + Math.abs(rise)));
        color = mixColor(color, dryColor, smoothstep(0.5, 1, k) * 0.42);
        color = mixColor(color, shadeColor, smoothstep(0.5, 0, k) * 0.5);
        return color;
      };

      for (let c = 0; c < cols; c++) {
        const u = ACROSS_OFFSETS[c];
        const x = sample.x + nx * u;
        const z = roadZ(sample) + nz * u;
        const y = terrainHeight(this.road, x, z);

        const i = (r * cols + c) * 3;
        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;

        const absU = Math.abs(u);

        // The packed earth's own base, before the road's structure is drawn
        // on it. Split out so the shoulder has something to blend toward.
        const trackAt = (): number => {
          let track = roadColor;
          // Two wheel ruts, darker and slightly sunken-looking. The road
          // reads as travelled rather than paved because of these, and
          // there is now a vertex sitting exactly on each one.
          // Deepened along with the narrowing. The ruts are the only thing
          // giving the carriageway any structure at all in a close frame,
          // and at the old strength they were invisible under a low sun.
          const rut = Math.abs(absU - ROAD_HALF_WIDTH * 0.58);
          if (rut < 0.42) track = mixColor(track, 0x2a1d12, 0.46 * (1 - rut / 0.42));
          // A crown down the middle, where nothing drives and the grass
          // has not quite given up.
          if (absU < 0.7) track = mixColor(track, shoulderColor, 0.35 * (1 - absU / 0.7));
          return track;
        };

        let color: number;
        // The dark and pale ends the fragment shader is allowed to drift to.
        // For the meadow they are the palette's own two outer tones; for the
        // road they are wet earth and sun-baked dust, pulled back toward the
        // surface's own colour so a track stays a track. The pale end is
        // kept well short of `grassDry` — at the full tone the bleached
        // patches met the field either side of the lane at the same value
        // and the road stopped reading as a road.
        let lo: number;
        let hi: number;
        if (absU <= ROAD_HALF_WIDTH) {
          color = trackAt();
          lo = mixColor(color, 0x36291c, 0.52);
          hi = mixColor(color, dryColor, 0.3);
        } else if (absU <= SHOULDER) {
          const t = (absU - ROAD_HALF_WIDTH) / (SHOULDER - ROAD_HALF_WIDTH);
          const w = t * t;
          const meadow = meadowAt(x, z, y);
          const track = trackAt();
          color = mixColor(track, meadow, w);
          lo = mixColor(mixColor(track, 0x36291c, 0.52), shadeColor, w);
          hi = mixColor(mixColor(track, dryColor, 0.3), dryColor, w);
        } else {
          color = meadowAt(x, z, y);
          lo = shadeColor;
          hi = dryColor;
        }

        this.scratchColor.setHex(color);
        colors[i] = this.scratchColor.r;
        colors[i + 1] = this.scratchColor.g;
        colors[i + 2] = this.scratchColor.b;
        this.scratchColor.setHex(lo);
        toneLo[i] = this.scratchColor.r;
        toneLo[i + 1] = this.scratchColor.g;
        toneLo[i + 2] = this.scratchColor.b;
        this.scratchColor.setHex(hi);
        toneHi[i] = this.scratchColor.r;
        toneHi[i + 1] = this.scratchColor.g;
        toneHi[i + 2] = this.scratchColor.b;
      }
    }

    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aToneLo', new BufferAttribute(toneLo, 3));
    geometry.setAttribute('aToneHi', new BufferAttribute(toneHi, 3));
    geometry.setIndex(indices);

    /*
     * Normals from the landform, not from the mesh.
     *
     * `computeVertexNormals` averages the faces meeting at a vertex, so the
     * normal it produces depends on how far apart the ribbon's columns
     * happen to be. This ribbon's columns are deliberately non-uniform —
     * hand-placed near the road, a power curve beyond it — so the averaging
     * is lopsided exactly where the spacing changes fastest, and it tilts a
     * strip of ground along the verge by a degree or two. A degree or two is
     * nothing on a rock and everything on a surface lit by a low sun across
     * sixty metres: it came out as a hard-edged tonal wedge running from the
     * bard's feet to the vanishing point, in eight frames out of ten.
     *
     * That wedge was declared fixed twice, because both earlier diagnoses
     * were of real defects that were also there (clamped ramps baked into
     * vertex colour; an unsorted offset list folding two strips back on
     * themselves). It survived both, and the evidence that it was never a
     * shadow was available the whole time: it does not move when the sun
     * moves ninety degrees, and it persists with the shadow map disabled.
     *
     * Sampling `terrainHeight` by central difference makes the normal a
     * property of the ground itself. Same answer at any mesh density, so the
     * whole class of defect goes rather than this instance of it. The cost
     * is four extra height samples per vertex at chunk build, which is
     * nothing next to the scatter placement already happening alongside.
     */
    const normals = new Float32Array(vertexCount * 3);
    const eps = 1;
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      // Gradient of the height field. The normal is (-dh/dx, 1, -dh/dz),
      // normalised — the standard result for a heightfield, and the reason
      // a flat plain gives exactly (0, 1, 0) however the ribbon is cut.
      const dhdx = (terrainHeight(this.road, x + eps, z) - terrainHeight(this.road, x - eps, z)) / (2 * eps);
      const dhdz = (terrainHeight(this.road, x, z + eps) - terrainHeight(this.road, x, z - eps)) / (2 * eps);
      const inv = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
      normals[i * 3] = -dhdx * inv;
      normals[i * 3 + 1] = inv;
      normals[i * 3 + 2] = -dhdz * inv;
    }
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();

    const mesh = new Mesh(geometry, this.terrainMaterial);
    mesh.receiveShadow = this.castShadows;
    mesh.name = `terrain-${index}`;
    return mesh;
  }

  /**
   * How far through a band transition `s` is, 0..1.
   *
   * Bands meet at a hard boundary in the data because a band *is* a range;
   * the softness is entirely a rendering decision, applied over the last
   * 40 m of a band so the ground has changed colour by the time the tree
   * species do.
   */
  private bandBlendAt(s: number): number {
    const band = this.road.bands.find((b) => s >= b.startS && s < b.endS);
    if (!band) return 0;
    const fade = 40;
    const remaining = band.endS - s;
    if (remaining >= fade) return 0;
    const t = 1 - remaining / fade;
    return t * t * (3 - 2 * t) * 0.5;
  }

  /**
   * One kind of scatter for one chunk, as one instanced mesh per silhouette.
   *
   * Placements are drawn first, in a single stream, and only then bucketed by
   * silhouette — the same shape `buildTrees` uses. Drawing per bucket instead
   * would make the *positions* depend on how many shapes a kind happens to
   * have, so adding a fifth grass would move every tuft in the world.
   */
  private buildScatter(
    index: number,
    kind: ScatterKind,
    landmarks: Landmark[],
  ): InstancedMesh[] {
    const s0 = index * CHUNK_LENGTH;
    const rand = mulberry32(subSeed(this.road.seed, `scatter:${kind.key}:${index}`));
    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));

    const zones = kind.zones ?? [[kind.clearance, kind.spread] as [number, number]];
    let bandWidth = 0;
    for (const zone of zones) bandWidth += zone[1] - zone[0];

    const area = CHUNK_LENGTH * bandWidth * 2;
    const count = Math.max(
      0,
      Math.round(area * kind.perSquareMetre * palette.density[kind.densityKey] * this.density),
    );
    if (count === 0) return [];

    const variants = Math.max(1, kind.variants ?? 1);
    const bias = kind.edgeBias ?? 1;
    const clump = kind.clump ?? 0;
    const buckets: Array<Array<{ matrix: Matrix4; color: number }>> = [];
    for (let v = 0; v < variants; v++) buckets.push([]);

    // Clump state: where the current group is centred, which side and which
    // band it belongs to, and how many are left in it. A clump is a handful
    // of plants sharing one patch of ground, so members are jittered around
    // the centre rather than re-drawn from the whole band.
    let clumpS = 0;
    let clumpMagnitude = 0;
    let clumpSide = 1;
    let clumpZone = zones[0];
    let remaining = 0;

    for (let i = 0; i < count; i++) {
      if (remaining <= 0) {
        clumpS = s0 + rand() * CHUNK_LENGTH;
        clumpSide = rand() < 0.5 ? -1 : 1;
        clumpZone = pickZone(rand, zones, bandWidth);
        const t = bias === 1 ? rand() : Math.pow(rand(), bias);
        clumpMagnitude = clumpZone[0] + t * (clumpZone[1] - clumpZone[0]);
        remaining = clump > 0 ? 1 + Math.floor(rand() * clump * 1.5) : 1;
      }
      remaining--;

      // The clump radius grows with the plant: a patch of grass is a metre
      // across, a stand of ferns two.
      const spreadIn = clump > 0 ? 0.55 + clump * 0.22 : 0;
      // Sideways, a clump can never be wider than the band it grows in. Let
      // it be, and every member lands on one edge or the other and the band
      // fills with two lines instead of a patch — which is what the crown of
      // the road did on the first attempt, since a metre-wide clump does not
      // fit in a quarter-metre strip. The meadow bands are tens of metres
      // across and never reach this.
      const lateral = Math.min(spreadIn, (clumpZone[1] - clumpZone[0]) * 0.5);
      const s = clumpS + (clump > 0 ? randRange(rand, -spreadIn, spreadIn) : 0);
      // Held inside the band it was drawn from, rather than merely pushed
      // off the centreline. That is how a tuft used to end up growing in a
      // wheel rut: the jitter is free to leave the band, so the only
      // correction that works is one the band itself defines.
      const magnitude = clamp(
        clumpMagnitude + (clump > 0 ? randRange(rand, -lateral, lateral) : 0),
        clumpZone[0],
        clumpZone[1],
      );
      const u = clumpSide * magnitude;

      const sample = sampleRoad(this.road, s);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      const x = sample.x + nx * u;
      const z = roadZ(sample) + nz * u;
      const y = terrainHeight(this.road, x, z);

      this.scratchPos.set(x, y, z);
      this.scratchQuat.setFromAxisAngle(this.upAxis, rand() * Math.PI * 2);
      const scale = randRange(rand, kind.scale[0], kind.scale[1]);
      // Non-uniform scaling on the vertical axis: a field where every tuft
      // is a scaled copy of one tuft reads as wallpaper. Kept narrow —
      // at 1.3 the tallest grass came out half again as tall as the
      // geometry was drawn to be, which is how the ankle-high tufts ended
      // up at the bard's knee.
      this.scratchScale.set(scale, scale * randRange(rand, 0.85, 1.15), scale);
      const variant = variants === 1 ? 0 : Math.floor(rand() * variants);
      const color = kind.colorOf(palette, rand);
      // Tested last, after every draw this instance was going to make, so a
      // clearing removes plants without moving the ones around it. Skipping
      // earlier would leave the random stream short and reshuffle the whole
      // chunk the moment a camp appeared.
      //
      // Only the kinds that cast shadows are cleared. That is not a
      // coincidence dressed up as a rule: a thing big enough to be worth
      // giving a shadow map is a thing big enough to stand in front of a
      // campfire, and grass and flowers growing up to the stone ring are
      // exactly what a camp in a meadow should look like.
      if (kind.castShadow && (this.inClearing(x, z) || insideLandmark(landmarks, x, z))) continue;
      buckets[variant].push({
        matrix: new Matrix4().compose(this.scratchPos, this.scratchQuat, this.scratchScale),
        color,
      });
    }

    const material = kind.material === 'foliage' ? this.foliageMaterial : this.solidMaterial;
    const meshes: InstancedMesh[] = [];
    for (let v = 0; v < variants; v++) {
      const list = buckets[v];
      if (list.length === 0) continue;
      const mesh = new InstancedMesh(kind.geometry(v), material, list.length);
      mesh.castShadow = this.castShadows && kind.castShadow;
      mesh.receiveShadow = false;
      mesh.name = `${kind.key}-${index}`;
      for (let i = 0; i < list.length; i++) {
        mesh.setMatrixAt(i, list[i].matrix);
        mesh.setColorAt(i, this.scratchColor.setHex(list[i].color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
    return meshes;
  }

  /**
   * Trees, one instanced mesh per species present in the chunk.
   *
   * Species is chosen per *instance* from the palette's weights rather than
   * per chunk, so a band boundary produces a genuinely mixed wood for a
   * stretch instead of a line where oaks stop and pines start.
   */
  private buildTrees(index: number, landmarks: Landmark[]): InstancedMesh[] {
    const s0 = index * CHUNK_LENGTH;
    const rand = mulberry32(subSeed(this.road.seed, `trees:${index}`));
    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));

    const spread = 78;
    const clearance = VERGE.tree;
    const area = CHUNK_LENGTH * (spread - clearance) * 2;
    const count = Math.max(0, Math.round(area * 0.0042 * palette.density.tree * this.density));
    if (count === 0) return [];

    // Instance colours run from this to white, and the geometry is painted
    // with the *lighter* canopy colour, so the pair still spans the whole
    // canopy..canopyVariant range while leaving the trunk recognisably bark.
    const canopyTint = channelRatio(palette.canopy, palette.canopyVariant);

    // Bucket the placements by (species, variant) first, then build one
    // InstancedMesh per bucket. Building a mesh per tree would be hundreds
    // of draw calls; a single mesh for all species is impossible because
    // they are different geometries.
    const buckets = new Map<string, Array<{ matrix: Matrix4; color: number }>>();

    for (let i = 0; i < count; i++) {
      const s = s0 + rand() * CHUNK_LENGTH;
      const side = rand() < 0.5 ? -1 : 1;
      // Trees thin out with distance from the road rather than filling the
      // plain evenly — the road should feel like it is passing through
      // country, not tunnelling through a hedge.
      const t = Math.pow(rand(), 0.62);
      const u = side * (clearance + t * (spread - clearance));
      const sample = sampleRoad(this.road, s);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      const x = sample.x + nx * u;
      const z = roadZ(sample) + nz * u;
      const y = terrainHeight(this.road, x, z);

      const kind = weightedPick(rand, palette.trees, (entry) => entry.weight).kind;
      const variant = Math.floor(rand() * TREE_VARIANTS);
      const key = `${kind}:${variant}`;

      this.scratchPos.set(x, y - 0.15, z);
      this.scratchQuat.setFromAxisAngle(this.upAxis, rand() * Math.PI * 2);
      const scale = randRange(rand, 0.75, 1.35);
      this.scratchScale.set(scale, scale * randRange(rand, 0.85, 1.25), scale);
      const matrix = new Matrix4().compose(this.scratchPos, this.scratchQuat, this.scratchScale);

      // Species biases where in the canopy range it draws its colour from,
      // rather than every species drawing from the whole spread. A conifer
      // that can come out the same green as the broadleaf beside it loses
      // half the distinction its silhouette was working for — at eighty
      // metres, "darker and bluer" is as much of a species cue as "pointed".
      const shade =
        kind === 'conifer'
          ? rand() * 0.4
          : kind === 'willow'
            ? 0.35 + rand() * 0.5
            : 0.3 + rand() * 0.7;
      const color = mixColor(canopyTint, 0xffffff, shade);
      // Last, after every draw, for the reason given in `buildScatter`.
      if (this.inClearing(x, z) || insideLandmark(landmarks, x, z)) continue;
      const list = buckets.get(key);
      if (list) list.push({ matrix, color });
      else buckets.set(key, [{ matrix, color }]);
    }

    const meshes: InstancedMesh[] = [];
    for (const [key, list] of buckets) {
      const [kind, variantText] = key.split(':');
      const variant = Number(variantText);
      // The biome is part of the cache key because the trunk and canopy
      // colours are baked in now. Without it, whichever band happened to
      // build `broadleaf:2` first lent its bark to every other band.
      const geometry = cachedGeometry(`tree:${palette.id}:${key}`, () =>
        treeGeometry(kind, {
          trunkColor: palette.trunk,
          canopyColor: palette.canopyVariant,
          seed: 1000 + variant * 37 + TREE_KINDS.indexOf(kind as never) * 911,
        }),
      );
      const mesh = new InstancedMesh(geometry, this.treeMaterial(kind), list.length);
      mesh.castShadow = this.castShadows;
      mesh.receiveShadow = false;
      mesh.name = `tree-${kind}-${index}`;
      for (let i = 0; i < list.length; i++) {
        mesh.setMatrixAt(i, list[i].matrix);
        mesh.setColorAt(i, this.scratchColor.setHex(list[i].color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
    return meshes;
  }

  /**
   * The landmark for one slot, or null if this stretch does not get one.
   *
   * Memoised, and it has to be: three chunks either side of a landmark ask
   * about it while deciding where their trees may stand, and the answer
   * involves a couple of hundred terrain samples. Memoising also makes the
   * null answer cheap, which matters because most slots on a flat road
   * return one.
   */
  private landmarkSlot(slot: number): Landmark | null {
    const cached = this.landmarkSlots.get(slot);
    if (cached !== undefined) return cached;
    const found = this.chooseLandmark(slot);
    this.landmarkSlots.set(slot, found);
    return found;
  }

  private chooseLandmark(slot: number): Landmark | null {
    // Nothing in the first hundred and forty metres — the opening frame of
    // the day is the road and the bard, and it should stay that — and
    // nothing on top of the campfire at the far end.
    const from = Math.max(140, slot * LANDMARK_SPACING_M + 40);
    const to = Math.min(this.road.lengthM - 90, (slot + 1) * LANDMARK_SPACING_M - 40);
    if (to <= from) return null;

    const rand = mulberry32(subSeed(this.road.seed, `landmark:${slot}`));
    const s = this.findCrest(from, to);
    const ridge = this.findRidge(s);
    if (!ridge) return null;

    const palette = paletteFor(biomeAt(this.road, s));
    const kind = weightedPick(rand, palette.landmarks, (entry) => entry.weight).kind;
    // Bigger than the geometry is drawn, in every case. A landmark that
    // measures the same as the trees around it is a tree: the first pass
    // stood a seven-metre chapel among eight-metre broadleaves eighty metres
    // off and it read as a farm building nobody would walk toward. Scale is
    // the cheapest possible fix and the right one — these are single meshes
    // seen at distance, so there is no detail to stretch.
    const scale =
      kind === 'tree'
        ? randRange(rand, 2.1, 2.7)
        : kind === 'chapel'
          ? randRange(rand, 1.25, 1.55)
          : randRange(rand, 1.3, 1.65);

    // How the thing is turned is not decoration. A trilithon whose opening
    // faces along the road is a pair of separate stones; turned across it,
    // the gap of sky between the piers is the whole silhouette. A chapel
    // square-on is a rectangle, so it gets a three-quarter turn that shows
    // the long wall, one gable and the tower breaking the ridge. Only the
    // standing stones are free to face anywhere, because a menhir has no
    // front.
    const heading = sampleRoad(this.road, s).heading;
    const rotation =
      kind === 'trilithon'
        ? heading + randRange(rand, -0.3, 0.3)
        : kind === 'chapel'
          ? heading + (rand() < 0.5 ? Math.PI : 0) + randRange(rand, 0.45, 0.85)
          : rand() * Math.PI * 2;

    return {
      kind,
      s,
      x: ridge.x,
      y: ridge.y,
      z: ridge.z,
      rotation,
      scale,
      variant: Math.floor(rand() * LANDMARK_VARIANTS),
      // Wide enough that nothing stands in front of it. Nine metres was not:
      // the wood keeps its own trees back but says nothing about the ones
      // fifteen metres nearer the camera, and the first chapel raised had a
      // broadleaf planted squarely across it.
      radius: kind === 'tree' ? 16 : 14,
    };
  }

  /**
   * The brow of the road between `from` and `to`, or null if there isn't
   * one worth walking toward.
   *
   * This is the second answer to "where is the high ground". The first — the
   * highest ground in a band either side of the road — measured out to be
   * *below* the lane at every point of every road tried, which sounds like a
   * bug and is in fact geometry. The cross-road relief has a two-hundred
   * metre wavelength and the centreline never leaves ±38 m of the axis, so
   * the road spends the whole day inside a fifth of one wave of it: whether
   * the land beside the road rises or falls is decided once per seed and
   * then holds for twelve hundred metres. On this seed it falls, and it
   * falls on both sides, because x = 0 happens to sit near a crest of that
   * wave.
   *
   * The high ground near a road that follows the landform is therefore the
   * road's own summits, and that is a better place for a landmark anyway:
   * something standing beside the brow you are climbing toward, with the
   * lane running out of sight underneath it, is the composition the whole
   * feature was asked for.
   *
   * There is deliberately no minimum on how much of a brow it has to be.
   * The first version demanded three and a half metres of rise over the
   * approach and got two landmarks on a twelve-hundred-metre road, which is
   * not "one every few hundred metres", it is one twice a day. It was also
   * asking the wrong question: the horizon sits at eye level, so *anything*
   * whose top clears 2.4 m above the ground the player is standing on is
   * already drawn against sky — which is exactly why the ordinary roadside
   * trees in every frame of this game are silhouetted. What the rise buys is
   * not visibility but composition, the lane running out of sight underneath
   * the thing, and taking the highest road in a two-hundred-metre window
   * gets as much of that as the landform has to give.
   */
  private findCrest(from: number, to: number): number {
    let crestS = from;
    let crestY = -Infinity;
    for (let s = from; s <= to; s += 12) {
      const y = sampleRoad(this.road, s).y;
      if (y > crestY) {
        crestY = y;
        crestS = s;
      }
    }
    return crestS;
  }

  /**
   * Where to stand the landmark, given the brow it belongs to.
   *
   * Off to one side, on the highest ground within reach, and on the *near*
   * side of the summit.
   *
   * The first version put it thirty metres past, reasoning that the far
   * slope would put sky behind the base. It does — and it also puts the brow
   * itself between the landmark and everyone approaching, so a five-metre
   * trilithon standing forty metres beyond the crest was invisible from a
   * hundred metres back and then appeared, fully formed, as the bard came
   * over the top. A landmark that cannot be seen from the approach is not a
   * landmark. Sky behind it was never in doubt anyway: the horizon sits at
   * eye level, so anything on the summit clears it by its own height.
   *
   * The distance term in the score has to be *strong*, and that took a
   * measurement to believe. At two centimetres per metre it was worth 1.2 m
   * of height across the whole band, and the landform swings further than
   * that over sixty metres — so the search marched to the far limit almost
   * every time.
   *
   * The sight-line test is the other half of the same lesson, and it is the
   * one that is easy to leave out. A landmark is not placed relative to the
   * road, it is placed relative to *the view down the road*, and those two
   * are not the same thing — see `LANDMARK_VIEW_BIAS`. The first trilithon
   * raised here was a perfectly good arch on a perfectly good ridge that
   * never once appeared in a frame. So every candidate is checked from a
   * point two hundred and twenty metres back, against the camera's axis
   * there rather than the road's, and ground that fails is not a landmark
   * site on this road however high it is.
   */
  private findRidge(s: number): { x: number; y: number; z: number } | null {
    const view = sampleRoad(this.road, s - LANDMARK_APPROACH_M);
    const viewZ = roadZ(view);
    let best: { x: number; y: number; z: number } | null = null;
    let bestScore = -Infinity;

    for (let ds = -30; ds <= 6; ds += 9) {
      const sample = sampleRoad(this.road, s + ds);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      for (let side = -1; side <= 1; side += 2) {
        for (let d = LANDMARK_NEAR_M; d <= LANDMARK_FAR_M; d += 4) {
          const u = side * d;
          const x = sample.x + nx * u;
          const z = roadZ(sample) + nz * u;
          const offAxis =
            Math.atan2(x - view.x, z - viewZ) - view.heading - LANDMARK_VIEW_BIAS;
          if (Math.abs(offAxis) > LANDMARK_MAX_OFF_AXIS) continue;
          const y = terrainHeight(this.road, x, z);
          const score = y - d * 0.05;
          if (score > bestScore) {
            bestScore = score;
            best = { x, y, z };
          }
        }
      }
    }

    return best;
  }

  /** Landmarks whose nominal `s` falls in this chunk, so it builds them. */
  private landmarksInChunk(index: number): Landmark[] {
    const s0 = index * CHUNK_LENGTH;
    // A slot's brow never leaves the slot's own three hundred metres, so at
    // most two slots can reach into a sixty-metre chunk.
    const first = Math.floor(s0 / LANDMARK_SPACING_M);
    const last = Math.floor((s0 + CHUNK_LENGTH) / LANDMARK_SPACING_M);
    const found: Landmark[] = [];
    for (let slot = first; slot <= last; slot++) {
      const landmark = this.landmarkSlot(slot);
      // Hosting is decided by the brow's own `s`, before the lateral search
      // moves the thing sideways and up to thirty metres along. That is what
      // makes "exactly one chunk builds this" true wherever it ends up.
      if (landmark && Math.floor(landmark.s / CHUNK_LENGTH) === index) found.push(landmark);
    }
    return found;
  }

  /** Landmarks close enough to this chunk to be claiming ground in it. */
  private landmarksNear(index: number): Landmark[] {
    const found: Landmark[] = [];
    for (let i = index - 2; i <= index + 2; i++) {
      if (i < 0) continue;
      for (const landmark of this.landmarksInChunk(i)) found.push(landmark);
    }
    return found;
  }

  private raiseLandmark(landmark: Landmark): Mesh {
    const palette = paletteFor(biomeAt(this.road, landmark.s));
    const seed = 400 + landmark.variant * 131;
    let geometry: BufferGeometry;
    let material: ShaderMaterial;

    if (landmark.kind === 'tree') {
      // The band's own dominant species, so the lone tree on the ridge is
      // recognisably the same tree as the wood it stands apart from.
      const species = palette.trees[0].kind;
      geometry = cachedGeometry(`landmark:tree:${palette.id}:${species}:${landmark.variant}`, () =>
        treeGeometry(species, {
          trunkColor: palette.trunk,
          // Baked at the darker end of the canopy range rather than the
          // lighter one the instanced woods use. Those get their spread from
          // a per-instance tint; a single mesh has no instance colour, so
          // baking the light end would put the palest foliage in the frame on
          // the horizon — the exact mistake the riverside willows made.
          canopyColor: mixColor(palette.canopy, palette.canopyVariant, 0.4),
          seed,
        }),
      );
      material = this.treeMaterial(species);
    } else {
      const options: LandmarkOptions = {
        stone: mixColor(palette.rock, palette.grassDry, 0.18),
        // The chapel roof takes the biome's accent undiluted. Mixed a third
        // of the way toward stone it was the right colour in the material
        // and the wrong one in the frame: a landmark is seen through eighty
        // metres of fog, and fog is already a mix toward grey, so anything
        // pre-greyed arrives at the eye as slate.
        roof:
          landmark.kind === 'chapel'
            ? palette.accent
            : mixColor(palette.rock, palette.trunk, 0.4),
        seed,
      };
      const build =
        landmark.kind === 'chapel'
          ? chapelGeometry
          : landmark.kind === 'trilithon'
            ? trilithonGeometry
            : standingStoneGeometry;
      // The palette is in the key because the colours are baked in, exactly
      // as they are for trees.
      geometry = cachedGeometry(
        `landmark:${landmark.kind}:${palette.id}:${landmark.variant}`,
        () => build(options),
      );
      material = this.solidMaterial;
    }

    const mesh = new Mesh(geometry, material);
    // Sunk a little, so a base cut square across a sloping ridge does not
    // show daylight under one corner.
    mesh.position.set(landmark.x, landmark.y - 0.25 * landmark.scale, landmark.z);
    mesh.rotation.y = landmark.rotation;
    mesh.scale.setScalar(landmark.scale);
    mesh.castShadow = this.castShadows;
    mesh.receiveShadow = this.castShadows;
    mesh.name = `landmark-${landmark.kind}`;
    return mesh;
  }

  private disposeChunk(chunk: Chunk): void {
    this.group.remove(chunk.group);
    for (const mesh of chunk.meshes) {
      // Terrain geometry is unique per chunk and must go. Scatter geometry
      // is shared out of the cache and must NOT — disposing it would blank
      // every other chunk using the same grass tuft.
      if (mesh.name.startsWith('terrain-')) mesh.geometry.dispose();
      if (mesh instanceof InstancedMesh) mesh.dispose();
    }
    chunk.meshes.length = 0;
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.foliageMaterial.dispose();
    this.solidMaterial.dispose();
    for (const material of this.trunkMaterials.values()) material.dispose();
    this.trunkMaterials.clear();
  }
}
