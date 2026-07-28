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
  fallenLogGeometry,
  fernGeometry,
  flowerGeometry,
  grassTuftGeometry,
  reedClumpGeometry,
  rockGeometry,
  shrubGeometry,
  treeGeometry,
} from './geometry';
import { mixColor, paletteFor, type BiomePalette } from './palette';

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
/** Half-width of the terrain ribbon, metres. */
const HALF_WIDTH = 165;
/**
 * Samples along the road within a chunk.
 *
 * Seventeen rather than thirteen, which is 3.75 m apart. The ground's
 * colour drift is carried in vertex colour and so is limited by this
 * spacing: at 5 m the mid-range patches were aliasing into a flat wash,
 * which is most of why the meadow used to have nothing in it at any scale.
 */
const ALONG_SAMPLES = 17;
/** Half-width of the packed road surface, metres. */
export const ROAD_HALF_WIDTH = 2.3;
/** Where the worn shoulder finishes blending back into grass. */
const SHOULDER = 4.2;

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
 */
const NEAR_OFFSETS = [
  0,
  0.6,
  // the wheel ruts
  ROAD_HALF_WIDTH * 0.55,
  1.85,
  // the edge of the packed surface, and the worn shoulder beyond it
  ROAD_HALF_WIDTH,
  2.9,
  3.55,
  SHOULDER,
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

const SCATTER_KINDS: ScatterKind[] = [
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
    // Drawn from the same two greens the ground drifts between, pulled a
    // little toward the deep tone. Mixing in the dry tone as well turned
    // every tuft into straw standing on green, so the meadow read as
    // stubble in a mown field.
    colorOf: (p, rand) =>
      mixColor(mixColor(p.grass, p.grassVariant, rand() * 0.85), p.grassShade, rand() * 0.35),
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

interface Chunk {
  index: number;
  group: Group;
  meshes: Array<Mesh | InstancedMesh>;
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
    if (centre === this.lastCentre) return;
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

    for (const kind of SCATTER_KINDS) {
      if (distanceM > kind.lodRange) continue;
      for (const mesh of this.buildScatter(index, kind)) {
        group.add(mesh);
        meshes.push(mesh);
      }
    }

    for (const treeMesh of this.buildTrees(index)) {
      group.add(treeMesh);
      meshes.push(treeMesh);
    }

    this.group.add(group);
    return { index, group, meshes };
  }

  /**
   * One chunk of ground.
   *
   * Vertex colours carry three things at once: the biome (blended across
   * band boundaries so a transition is a gradual change of green rather
   * than a seam), the road surface (blended out through the shoulder), and
   * a per-vertex noise wobble. Doing all three in vertex colour rather than
   * with separate meshes is what keeps the road from z-fighting the ground
   * it is lying on, which is the classic way this goes wrong.
   */
  private buildTerrain(index: number): Mesh {
    const s0 = index * CHUNK_LENGTH;
    const rows = ALONG_SAMPLES;
    const cols = ACROSS_SAMPLES;
    const vertexCount = rows * cols;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    const wobble = mulberry32(subSeed(this.road.seed, `terrain:${index}`));

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
       * The meadow at a point: three scales of drift plus the landform.
       *
       * One sine at one frequency — which is what this used to be — is a
       * gradient, and a gradient across a whole valley is indistinguishable
       * from a flat wash once fog has been applied to it. Three octaves
       * give patches at roughly 80 m, 25 m and 8 m, and the height term on
       * top puts colour on the landform itself, so a rise a hundred metres
       * off is dry and pale and the hollow beside it is deep and cool.
       * That is the whole of what the mid-distance had to offer the eye.
       */
      const meadowAt = (mx: number, mz: number, my: number): number => {
        // Wavelengths of roughly 170 m and 45 m. The first pass used 500 m
        // and 130 m, which across a single view is one smooth gradient —
        // indistinguishable from a flat wash once the fog has had its say.
        const broad = 0.5 + 0.5 * Math.sin(mx * 0.038 + mz * 0.027 + 2.1);
        const patch = 0.5 + 0.5 * Math.sin(mx * 0.115 - mz * 0.148 + 0.7);
        const fine = 0.5 + 0.5 * Math.sin(mx * 0.22 + mz * 0.19 + 5.2);
        const t = clamp01(broad * 0.5 + patch * 0.32 + fine * 0.18);
        // Three tones out of one noise value, not two. A meadow that only
        // ever blends between its two mid greens has no dark in it, and
        // without dark there is no drift to see — which is why an open
        // field a hundred metres wide still read as one flat wash after the
        // frequencies were fixed. The deep tone comes in only at the bottom
        // of the range, so it reads as damp hollows rather than as dirt.
        let color = mixColor(grassA, grassB, smoothstep(0.28, 1, t));
        color = mixColor(color, shadeColor, smoothstep(0.3, 0, t) * 0.6);
        // Divided by a long enough span that a field which simply slopes
        // away from the road does not come out uniformly dry. At /8 the
        // whole of an open village hillside sat at the pale end of the
        // palette and every other term was drowned out by it.
        const rise = (my - laneY) / 14;
        if (rise > 0) color = mixColor(color, dryColor, Math.min(1, rise) * 0.4);
        else color = mixColor(color, shadeColor, Math.min(1, -rise) * 0.55);
        // Worn, sun-bleached patches, on their own slow rhythm so they do
        // not line up with the drift underneath them. Kept rare enough to
        // read as patches rather than as the ground's base colour.
        const bleach = smoothstep(0.7, 0.99, 0.5 + 0.5 * Math.sin(mx * 0.062 - mz * 0.045 + 4.3));
        return mixColor(color, dryColor, bleach * 0.5);
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
        let color: number;
        if (absU <= ROAD_HALF_WIDTH) {
          color = roadColor;
          // Two wheel ruts, darker and slightly sunken-looking. The road
          // reads as travelled rather than paved because of these, and
          // there is now a vertex sitting exactly on each one.
          const rut = Math.abs(absU - ROAD_HALF_WIDTH * 0.55);
          if (rut < 0.5) color = mixColor(color, 0x2a1d12, 0.3 * (1 - rut / 0.5));
          // A crown down the middle, where nothing drives and the grass
          // has not quite given up.
          if (absU < 0.7) color = mixColor(color, shoulderColor, 0.35 * (1 - absU / 0.7));
        } else if (absU <= SHOULDER) {
          const t = (absU - ROAD_HALF_WIDTH) / (SHOULDER - ROAD_HALF_WIDTH);
          color = mixColor(shoulderColor, meadowAt(x, z, y), t * t);
        } else {
          color = meadowAt(x, z, y);
        }

        // A little per-vertex value noise on top of everything.
        const lift = 0.94 + wobble() * 0.12;
        this.scratchColor.setHex(color);
        colors[i] = Math.min(1, this.scratchColor.r * lift);
        colors[i + 1] = Math.min(1, this.scratchColor.g * lift);
        colors[i + 2] = Math.min(1, this.scratchColor.b * lift);
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
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
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
  private buildScatter(index: number, kind: ScatterKind): InstancedMesh[] {
    const s0 = index * CHUNK_LENGTH;
    const rand = mulberry32(subSeed(this.road.seed, `scatter:${kind.key}:${index}`));
    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));

    const area = CHUNK_LENGTH * (kind.spread * 2 - kind.clearance * 2);
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

    // Clump state: where the current group is centred and how many are left
    // in it. A clump is a handful of plants sharing one patch of ground, so
    // members are jittered around the centre rather than re-drawn from the
    // whole band.
    let clumpS = 0;
    let clumpU = 0;
    let remaining = 0;

    for (let i = 0; i < count; i++) {
      if (remaining <= 0) {
        clumpS = s0 + rand() * CHUNK_LENGTH;
        const side = rand() < 0.5 ? -1 : 1;
        const t = bias === 1 ? rand() : Math.pow(rand(), bias);
        clumpU = side * (kind.clearance + t * (kind.spread - kind.clearance));
        remaining = clump > 0 ? 1 + Math.floor(rand() * clump * 1.5) : 1;
      }
      remaining--;

      // The clump radius grows with the plant: a patch of grass is a metre
      // across, a stand of ferns two.
      const spreadIn = clump > 0 ? 0.55 + clump * 0.22 : 0;
      const s = clumpS + (clump > 0 ? randRange(rand, -spreadIn, spreadIn) : 0);
      let u = clumpU + (clump > 0 ? randRange(rand, -spreadIn, spreadIn) : 0);
      // The jitter can push a member back over the verge it was placed
      // outside of, which is how a tuft ends up growing in the wheel rut.
      if (Math.abs(u) < kind.clearance) u = Math.sign(u || 1) * kind.clearance;

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
      buckets[variant].push({
        matrix: new Matrix4().compose(this.scratchPos, this.scratchQuat, this.scratchScale),
        color: kind.colorOf(palette, rand),
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
  private buildTrees(index: number): InstancedMesh[] {
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
