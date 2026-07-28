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
import { cachedGeometry, fernGeometry, flowerGeometry, grassTuftGeometry, rockGeometry, treeGeometry } from './geometry';
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
/** Samples along the road within a chunk. */
const ALONG_SAMPLES = 13;
/** Samples across the ribbon. Odd, so one lands exactly on the centreline. */
const ACROSS_SAMPLES = 31;
/** Half-width of the packed road surface, metres. */
export const ROAD_HALF_WIDTH = 2.3;
/** Where the worn shoulder finishes blending back into grass. */
const SHOULDER = 4.2;

/**
 * Lateral sample offsets, precomputed once.
 *
 * The power curve is the whole reason this looks dense near the player and
 * still reaches the horizon: with an exponent of 2.6, half the samples fall
 * within about 18 m of the road while the outermost still reaches 165 m.
 */
const ACROSS_OFFSETS = (() => {
  const offsets: number[] = [];
  const half = (ACROSS_SAMPLES - 1) / 2;
  for (let i = 0; i < ACROSS_SAMPLES; i++) {
    const t = (i - half) / half;
    offsets.push(Math.sign(t) * Math.pow(Math.abs(t), 2.6) * HALF_WIDTH);
  }
  return offsets;
})();

interface ScatterKind {
  key: string;
  geometry: () => BufferGeometry;
  /** Instances per square metre at density 1. */
  perSquareMetre: number;
  /** Which palette density multiplier applies. */
  densityKey: keyof BiomePalette['density'];
  /** How far either side of the road this kind is scattered. */
  spread: number;
  /** Minimum distance from the road centreline. */
  clearance: number;
  scale: [number, number];
  /** Only drawn on chunks within this many metres of the bard. */
  lodRange: number;
  castShadow: boolean;
  material: 'foliage' | 'solid';
  colorOf: (palette: BiomePalette, rand: Rand) => number;
  sway: number;
}

const SCATTER_KINDS: ScatterKind[] = [
  {
    key: 'grass',
    geometry: () => cachedGeometry('grass', () => grassTuftGeometry(7)),
    perSquareMetre: 0.75,
    densityKey: 'grass',
    spread: 34,
    // Grass grows right up to the wheel ruts, so the clearance is small —
    // a bare margin either side of the road is what makes it read as a
    // *worn path* rather than a strip laid on top of a lawn.
    clearance: ROAD_HALF_WIDTH - 0.3,
    scale: [0.75, 1.35],
    lodRange: 78,
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => mixColor(p.grass, p.grassVariant, rand()),
    sway: 0.16,
  },
  {
    key: 'fern',
    geometry: () => cachedGeometry('fern', () => fernGeometry(9)),
    perSquareMetre: 0.06,
    densityKey: 'fern',
    spread: 30,
    clearance: ROAD_HALF_WIDTH + 0.6,
    scale: [0.8, 1.7],
    lodRange: 85,
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => mixColor(p.canopy, p.grass, 0.3 + rand() * 0.5),
    sway: 0.1,
  },
  {
    key: 'flower',
    geometry: () => cachedGeometry('flower', () => flowerGeometry(13)),
    perSquareMetre: 0.05,
    densityKey: 'flower',
    spread: 22,
    clearance: ROAD_HALF_WIDTH + 0.2,
    scale: [0.8, 1.6],
    lodRange: 60,
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => (rand() < 0.5 ? p.accent : p.accentAlt),
    sway: 0.13,
  },
  {
    key: 'rock',
    geometry: () => cachedGeometry('rock', () => rockGeometry(17)),
    perSquareMetre: 0.008,
    densityKey: 'rock',
    spread: 70,
    clearance: ROAD_HALF_WIDTH + 1.2,
    scale: [0.4, 1.9],
    lodRange: 150,
    castShadow: true,
    material: 'solid',
    colorOf: (p, rand) => mixColor(p.rock, p.grass, rand() * 0.25),
    sway: 0,
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
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchPos = new Vector3();
  private readonly scratchQuat = new Quaternion();
  private readonly scratchScale = new Vector3();
  private readonly scratchColor = new Color();
  private readonly upAxis = new Vector3(0, 1, 0);

  private lastCentre = Number.NaN;

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
      bandSoftness: 0.13,
      shadowDepth: 0.42,
    });

    this.foliageMaterial = createFoliageMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xe4dd9a,
      grain: 0.55,
      grainScale: 0.5,
      sway: 0.2,
      swaySpeed: 1.5,
      swayAttribute: true,
      vertexColors: false,
      flatShading: true,
      shadowDepth: 0.5,
    });

    this.solidMaterial = createPainterlyMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xbfae94,
      grain: 0.6,
      grainScale: 0.7,
      rim: 0.16,
      baseShade: 0.16,
      baseShadeHeight: 0.3,
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
      const mesh = this.buildScatter(index, kind);
      if (mesh) {
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
      const roadColor = mixColor(palette.road, blendPalette.road, bandBlend);
      const shoulderColor = mixColor(palette.roadShoulder, blendPalette.roadShoulder, bandBlend);

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
          // reads as travelled rather than paved because of these.
          const rut = Math.abs(absU - ROAD_HALF_WIDTH * 0.55);
          if (rut < 0.35) color = mixColor(color, 0x000000, 0.16 * (1 - rut / 0.35));
        } else if (absU <= SHOULDER) {
          const t = (absU - ROAD_HALF_WIDTH) / (SHOULDER - ROAD_HALF_WIDTH);
          color = mixColor(shoulderColor, mixColor(grassA, grassB, 0.4), t * t);
        } else {
          // Large-scale variation so the meadow has drifts of colour in it
          // rather than an even tone.
          const drift = 0.5 + 0.5 * Math.sin(x * 0.031 + z * 0.017);
          color = mixColor(grassA, grassB, drift);
        }

        // A little per-vertex value noise on top of everything.
        const lift = 0.92 + wobble() * 0.16;
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

  private buildScatter(index: number, kind: ScatterKind): InstancedMesh | null {
    const s0 = index * CHUNK_LENGTH;
    const rand = mulberry32(subSeed(this.road.seed, `scatter:${kind.key}:${index}`));
    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));

    const area = CHUNK_LENGTH * (kind.spread * 2 - kind.clearance * 2);
    const count = Math.max(
      0,
      Math.round(area * kind.perSquareMetre * palette.density[kind.densityKey] * this.density),
    );
    if (count === 0) return null;

    const geometry = kind.geometry();
    const material = kind.material === 'foliage' ? this.foliageMaterial : this.solidMaterial;
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.castShadow = this.castShadows && kind.castShadow;
    mesh.receiveShadow = false;
    mesh.name = `${kind.key}-${index}`;

    for (let i = 0; i < count; i++) {
      const s = s0 + rand() * CHUNK_LENGTH;
      const side = rand() < 0.5 ? -1 : 1;
      const u = side * randRange(rand, kind.clearance, kind.spread);
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
      // is a scaled copy of one tuft reads as wallpaper.
      this.scratchScale.set(scale, scale * randRange(rand, 0.8, 1.3), scale);
      this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      mesh.setMatrixAt(i, this.scratchMatrix);
      mesh.setColorAt(i, this.scratchColor.setHex(kind.colorOf(palette, rand)));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
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
    const clearance = ROAD_HALF_WIDTH + 2.6;
    const area = CHUNK_LENGTH * (spread - clearance) * 2;
    const count = Math.max(0, Math.round(area * 0.0042 * palette.density.tree * this.density));
    if (count === 0) return [];

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

      const color = mixColor(palette.canopy, palette.canopyVariant, rand());
      const list = buckets.get(key);
      if (list) list.push({ matrix, color });
      else buckets.set(key, [{ matrix, color }]);
    }

    const meshes: InstancedMesh[] = [];
    for (const [key, list] of buckets) {
      const [kind, variantText] = key.split(':');
      const variant = Number(variantText);
      const geometry = cachedGeometry(`tree:${key}`, () =>
        treeGeometry(kind, {
          trunkColor: palette.trunk,
          canopyColor: 0xffffff,
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
