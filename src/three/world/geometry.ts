/**
 * Procedural geometry for everything that grows.
 *
 * No modelled assets, no texture maps — partly because CLAUDE.md's asset
 * rule says procedural or CC0, and partly because a game whose whole world
 * is generated from a daily seed cannot ship a fixed set of models without
 * the world starting to repeat visibly within a week.
 *
 * Two things every geometry here has to get right:
 *
 * 1. **A silhouette that survives being small.** Most of these are seen at
 *    twenty to eighty metres, where all internal detail is gone and only
 *    the outline is doing any work. So the shapes are built from a few
 *    large, clearly-angled facets rather than smooth revolutions. A
 *    16-segment cylinder and a 6-segment cylinder look identical at that
 *    range and one of them costs nearly three times as much.
 *
 * 2. **A sway weight per vertex.** The painterly shader reads an `aSway`
 *    attribute to decide how much wind moves each vertex. Getting this
 *    right is the difference between a tree that bends and a tree that
 *    slides through the ground: roots are 0, tips are 1, and the curve
 *    between them is quadratic rather than linear because a real branch is
 *    stiffer at the base than a lerp implies.
 */

import { BufferAttribute, BufferGeometry } from 'three';
import { mulberry32, type Rand } from '../../core/rng';

/**
 * Attach an `aSway` attribute derived from height.
 *
 * `rootY` is where the sway is zero and `tipY` where it reaches one, which
 * lets a merged tree geometry have its trunk stiff and its canopy loose
 * without building the attribute by hand twice.
 */
export function addSway(
  geometry: BufferGeometry,
  rootY: number,
  tipY: number,
  maxWeight = 1,
): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute;
  const sway = new Float32Array(position.count);
  const span = Math.max(1e-4, tipY - rootY);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) - rootY) / span));
    sway[i] = t * t * maxWeight;
  }
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  return geometry;
}

/** Merge geometries that all share the same attribute set. */
function mergeGeometries(parts: BufferGeometry[]): BufferGeometry {
  // three ships a BufferGeometryUtils for this, but it lives under
  // examples/jsm and pulls in a surprising amount for what is, in our case,
  // always a handful of non-indexed geometries with identical attributes.
  const names = ['position', 'normal', 'color', 'aSway'];
  const present = names.filter((n) => parts.every((p) => p.attributes[n] !== undefined));
  const out = new BufferGeometry();
  for (const name of present) {
    const itemSize = (parts[0].attributes[name] as BufferAttribute).itemSize;
    let total = 0;
    for (const part of parts) total += (part.attributes[name] as BufferAttribute).count;
    const array = new Float32Array(total * itemSize);
    let offset = 0;
    for (const part of parts) {
      const attr = part.attributes[name] as BufferAttribute;
      array.set(attr.array as Float32Array, offset);
      offset += attr.count * itemSize;
    }
    out.setAttribute(name, new BufferAttribute(array, itemSize));
  }
  for (const part of parts) part.dispose();
  return out;
}

/** Everything here is non-indexed so merging is a straight concatenation. */
function toNonIndexed(geometry: BufferGeometry): BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

/** Paint a uniform colour into a geometry's vertex colours. */
function paint(geometry: BufferGeometry, hex: number, jitter = 0, rand?: Rand): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  // Jitter per *triangle*, not per vertex: per-vertex jitter interpolates
  // across the face and turns crisp low-poly facets into mush, which is
  // exactly the readability the faceting was bought for.
  //
  // The wobble is drawn once per face into a local array. An earlier
  // version memoised it in a module-level map keyed by face index, which
  // meant every geometry in the game shared face 0's wobble and the map
  // grew for the life of the page — the same value, applied everywhere, is
  // no variation at all.
  const faces = Math.ceil(position.count / 3);
  const wobbles = new Float32Array(faces);
  for (let f = 0; f < faces; f++) {
    wobbles[f] = jitter > 0 && rand ? 1 + (rand() - 0.5) * jitter : 1;
  }

  for (let i = 0; i < position.count; i++) {
    const wobble = wobbles[Math.floor(i / 3)];
    colors[i * 3] = Math.min(1, r * wobble);
    colors[i * 3 + 1] = Math.min(1, g * wobble);
    colors[i * 3 + 2] = Math.min(1, b * wobble);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A tuft of grass: three or four blades fanning from one root.
 *
 * Blades are tapered quads rather than the usual cross-billboards. Cross
 * billboards need an alpha-tested texture to not look like intersecting
 * cards, and an alpha test on a mesh drawn tens of thousands of times is
 * one of the more expensive things you can do to a phone. Solid tapered
 * geometry costs six triangles and never has an alpha problem.
 */
export function grassTuftGeometry(seed = 1): BufferGeometry {
  const rand = mulberry32(seed);
  const blades: BufferGeometry[] = [];
  const bladeCount = 4;

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + rand() * 0.9;
    const lean = 0.18 + rand() * 0.35;
    const height = 0.2 + rand() * 0.18;
    const width = 0.035 + rand() * 0.02;

    // Each blade is two stacked tapered segments so it can curve, rather
    // than one flat quad which reads as a shard of glass.
    const midY = height * 0.55;
    const tipX = Math.cos(angle) * lean * height;
    const tipZ = Math.sin(angle) * lean * height;
    const midX = tipX * 0.35;
    const midZ = tipZ * 0.35;

    const verts = new Float32Array([
      // lower segment, two triangles
      -Math.sin(angle) * width, 0, Math.cos(angle) * width,
      Math.sin(angle) * width, 0, -Math.cos(angle) * width,
      midX + Math.sin(angle) * width * 0.6, midY, midZ - Math.cos(angle) * width * 0.6,

      -Math.sin(angle) * width, 0, Math.cos(angle) * width,
      midX + Math.sin(angle) * width * 0.6, midY, midZ - Math.cos(angle) * width * 0.6,
      midX - Math.sin(angle) * width * 0.6, midY, midZ + Math.cos(angle) * width * 0.6,

      // upper segment, tapering to a point
      midX - Math.sin(angle) * width * 0.6, midY, midZ + Math.cos(angle) * width * 0.6,
      midX + Math.sin(angle) * width * 0.6, midY, midZ - Math.cos(angle) * width * 0.6,
      tipX, height, tipZ,
    ]);

    const blade = new BufferGeometry();
    blade.setAttribute('position', new BufferAttribute(verts, 3));
    blade.computeVertexNormals();
    blades.push(blade);
  }

  const merged = mergeGeometries(blades);
  // Grass sways from the very base — it has no stiff trunk to resist.
  addSway(merged, 0, 0.38, 1);
  merged.computeVertexNormals();
  return merged;
}

/**
 * A fern / low shrub: broader, darker, and much stiffer than grass. Used to
 * break up the forest floor, where uniform grass reads as a golf course.
 */
export function fernGeometry(seed = 2): BufferGeometry {
  const rand = mulberry32(seed);
  const fronds: BufferGeometry[] = [];
  const count = 5;
  for (let f = 0; f < count; f++) {
    const angle = (f / count) * Math.PI * 2 + rand() * 0.5;
    const length = 0.42 + rand() * 0.3;
    const height = 0.3 + rand() * 0.22;
    const width = 0.11 + rand() * 0.05;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const verts = new Float32Array([
      0, 0.04, 0,
      dirX * length - dirZ * width, height * 0.55, dirZ * length + dirX * width,
      dirX * length + dirZ * width, height * 0.55, dirZ * length - dirX * width,

      dirX * length - dirZ * width, height * 0.55, dirZ * length + dirX * width,
      dirX * length * 1.5, height, dirZ * length * 1.5,
      dirX * length + dirZ * width, height * 0.55, dirZ * length - dirX * width,
    ]);
    const frond = new BufferGeometry();
    frond.setAttribute('position', new BufferAttribute(verts, 3));
    fronds.push(frond);
  }
  const merged = mergeGeometries(fronds);
  merged.computeVertexNormals();
  addSway(merged, 0, 0.6, 0.55);
  return merged;
}

/**
 * A small flower: a stem and a four-petal head. Deliberately tiny — these
 * are colour accents scattered thinly, and anything bigger starts to read
 * as a crop rather than a wildflower.
 */
export function flowerGeometry(seed = 3): BufferGeometry {
  const rand = mulberry32(seed);
  const height = 0.22 + rand() * 0.14;
  const petal = 0.055;
  const parts: BufferGeometry[] = [];

  const stem = new BufferGeometry();
  stem.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([
        -0.008, 0, 0, 0.008, 0, 0, 0, height, 0,
        0, 0, -0.008, 0, 0, 0.008, 0, height, 0,
      ]),
      3,
    ),
  );
  parts.push(stem);

  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const head = new BufferGeometry();
    head.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([
          0, height, 0,
          nx * petal - nz * petal * 0.6, height + 0.02, nz * petal + nx * petal * 0.6,
          nx * petal + nz * petal * 0.6, height + 0.02, nz * petal - nx * petal * 0.6,
        ]),
        3,
      ),
    );
    parts.push(head);
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, height, 0.85);
  return merged;
}

/** A low-poly boulder: an irregular, flat-shaded lump. */
export function rockGeometry(seed = 4): BufferGeometry {
  const rand = mulberry32(seed);
  // An icosahedron-ish hull built by pushing a coarse sphere's vertices
  // around. Irregularity is what stops a field of rocks reading as a field
  // of identical pebbles even before per-instance scaling.
  const rings = 3;
  const segments = 6;
  const points: number[][] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const wobble = 0.72 + rand() * 0.5;
      points.push([
        Math.sin(phi) * Math.cos(theta) * wobble,
        Math.cos(phi) * wobble * 0.62 + 0.3,
        Math.sin(phi) * Math.sin(theta) * wobble,
      ]);
    }
  }

  const verts: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = points[r * segments + s];
      const b = points[r * segments + ((s + 1) % segments)];
      const c = points[(r + 1) * segments + s];
      const d = points[(r + 1) * segments + ((s + 1) % segments)];
      verts.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geometry.computeVertexNormals();
  // Rocks do not sway. The attribute still has to exist so this geometry can
  // share a material with things that do.
  addSway(geometry, 0, 1, 0);
  return geometry;
}

export interface TreeOptions {
  trunkColor: number;
  canopyColor: number;
  seed?: number;
}

/**
 * A conifer: a tapered trunk under two or three stacked, offset cones.
 *
 * Stacked and *offset* matters. A single cone is a party hat; two cones
 * whose axes disagree by a few degrees read as a tree that grew, and the
 * cost is one extra ring of triangles.
 */
export function coniferGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 11);
  const parts: BufferGeometry[] = [];
  const height = 4.2 + rand() * 2.4;
  const trunkH = height * 0.34;

  parts.push(paint(taperedCylinder(0.1, 0.19, trunkH, 5, rand), options.trunkColor, 0.14, rand));

  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const radius = 1.35 * (1 - f * 0.55) * (0.85 + rand() * 0.3);
    const coneH = height * 0.32 * (1 - f * 0.18);
    const baseY = trunkH + f * height * 0.24;
    const cone = coneAt(radius, coneH, 6, baseY, rand);
    // Lean each tier slightly, in a different direction each time.
    const lean = 0.06 + rand() * 0.06;
    const leanAngle = rand() * Math.PI * 2;
    translateXZ(cone, Math.cos(leanAngle) * lean * (t + 1), Math.sin(leanAngle) * lean * (t + 1));
    parts.push(paint(cone, options.canopyColor, 0.2, rand));
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, trunkH * 0.5, height, 0.5);
  return merged;
}

/**
 * A broadleaf: a forked trunk under a cluster of overlapping blobs.
 *
 * The clustered canopy is what makes this read as a different *species*
 * from the conifer at distance rather than just a differently-scaled cone —
 * the silhouette is lumpy and horizontal instead of pointed and vertical.
 */
export function broadleafGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 12);
  const parts: BufferGeometry[] = [];
  const height = 3.6 + rand() * 2.2;
  const trunkH = height * 0.45;

  parts.push(paint(taperedCylinder(0.12, 0.24, trunkH, 5, rand), options.trunkColor, 0.14, rand));

  // Two short limbs angling out of the trunk, which the canopy blobs sit on.
  for (let limb = 0; limb < 2; limb++) {
    const a = rand() * Math.PI * 2;
    const branch = taperedCylinder(0.05, 0.1, trunkH * 0.5, 4, rand);
    translateY(branch, trunkH * 0.6);
    translateXZ(branch, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
    parts.push(paint(branch, options.trunkColor, 0.12, rand));
  }

  const blobs = 4;
  for (let b = 0; b < blobs; b++) {
    const a = (b / blobs) * Math.PI * 2 + rand() * 0.7;
    const spread = 0.5 + rand() * 0.65;
    const radius = 0.95 + rand() * 0.6;
    const blob = blobGeometry(radius, 5, rand);
    translateY(blob, trunkH + 0.5 + rand() * 0.7);
    translateXZ(blob, Math.cos(a) * spread, Math.sin(a) * spread);
    parts.push(paint(blob, options.canopyColor, 0.22, rand));
  }
  const crown = blobGeometry(1.05 + rand() * 0.35, 5, rand);
  translateY(crown, trunkH + 1.3);
  parts.push(paint(crown, options.canopyColor, 0.2, rand));

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, trunkH * 0.4, height + 1, 0.65);
  return merged;
}

/**
 * A willow: a short trunk under a dome, with long drooping fronds.
 *
 * Riverside's signature shape. The fronds carry a much higher sway weight
 * than anything else in the world, which is the point — a willow that does
 * not move looks dead, and it is the one plant whose *motion* is its
 * silhouette.
 */
export function willowGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 13);
  const parts: BufferGeometry[] = [];
  const trunkH = 1.9 + rand() * 0.9;

  parts.push(paint(taperedCylinder(0.16, 0.3, trunkH, 5, rand), options.trunkColor, 0.14, rand));

  const dome = blobGeometry(1.5 + rand() * 0.4, 6, rand);
  translateY(dome, trunkH + 0.5);
  parts.push(paint(dome, options.canopyColor, 0.16, rand));

  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rand() * 0.4;
    const r = 1.15 + rand() * 0.55;
    const drop = 1.5 + rand() * 1.1;
    const w = 0.11;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const top = trunkH + 0.75;
    const frond = new BufferGeometry();
    frond.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([
          x - w, top, z,
          x + w, top, z,
          x * 1.18, top - drop, z * 1.18,

          x, top, z - w,
          x, top, z + w,
          x * 1.18, top - drop, z * 1.18,
        ]),
        3,
      ),
    );
    parts.push(paint(frond, options.canopyColor, 0.25, rand));
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // Create the attribute before overriding it. mergeGeometries only keeps
  // attributes that *every* part carries, and none of the willow's parts
  // carry aSway — so reaching straight for `merged.attributes.aSway` found
  // undefined and took the whole world down with it.
  addSway(merged, 0, 1, 0);
  // Weight by *inverted* height: on a willow it is the low, hanging tips
  // that move most, which is the opposite of every other plant here.
  const position = merged.attributes.position as BufferAttribute;
  const sway = merged.attributes.aSway as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y < trunkH + 0.6) {
      // Trunk and low hanging fronds: distinguish them by radius, since the
      // trunk is the only thing near the axis.
      const radius = Math.hypot(position.getX(i), position.getZ(i));
      sway.setX(i, radius > 0.8 ? 1.0 : 0.05);
    } else {
      sway.setX(i, 0.35);
    }
  }
  sway.needsUpdate = true;
  return merged;
}

// --- primitives --------------------------------------------------------

function taperedCylinder(
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments: number,
  rand: Rand,
): BufferGeometry {
  const verts: number[] = [];
  // A per-instance twist so two trunks built from the same call do not line
  // their facets up when they happen to stand next to each other.
  const twist = rand() * Math.PI * 2;
  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2 + twist;
    const a1 = ((s + 1) / segments) * Math.PI * 2 + twist;
    const b0x = Math.cos(a0) * bottomRadius;
    const b0z = Math.sin(a0) * bottomRadius;
    const b1x = Math.cos(a1) * bottomRadius;
    const b1z = Math.sin(a1) * bottomRadius;
    const t0x = Math.cos(a0) * topRadius;
    const t0z = Math.sin(a0) * topRadius;
    const t1x = Math.cos(a1) * topRadius;
    const t1z = Math.sin(a1) * topRadius;
    verts.push(b0x, 0, b0z, b1x, 0, b1z, t0x, height, t0z);
    verts.push(b1x, 0, b1z, t1x, height, t1z, t0x, height, t0z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

function coneAt(radius: number, height: number, segments: number, baseY: number, rand: Rand): BufferGeometry {
  const verts: number[] = [];
  const twist = rand() * Math.PI * 2;
  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2 + twist;
    const a1 = ((s + 1) / segments) * Math.PI * 2 + twist;
    // Ragged the base radius per facet so the cone's bottom edge is not a
    // perfect circle — a perfect circle is the tell that it is a primitive.
    const r0 = radius * (0.86 + rand() * 0.28);
    const r1 = radius * (0.86 + rand() * 0.28);
    verts.push(
      Math.cos(a0) * r0, baseY, Math.sin(a0) * r0,
      Math.cos(a1) * r1, baseY, Math.sin(a1) * r1,
      0, baseY + height, 0,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

function blobGeometry(radius: number, segments: number, rand: Rand): BufferGeometry {
  const rings = 3;
  const points: number[][] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const wobble = radius * (0.78 + rand() * 0.42);
      points.push([
        Math.sin(phi) * Math.cos(theta) * wobble,
        Math.cos(phi) * wobble * 0.82,
        Math.sin(phi) * Math.sin(theta) * wobble,
      ]);
    }
  }
  const verts: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = points[r * segments + s];
      const b = points[r * segments + ((s + 1) % segments)];
      const c = points[(r + 1) * segments + s];
      const d = points[(r + 1) * segments + ((s + 1) % segments)];
      verts.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

function translateY(geometry: BufferGeometry, dy: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + dy);
}

function translateXZ(geometry: BufferGeometry, dx: number, dz: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setX(i, position.getX(i) + dx);
    position.setZ(i, position.getZ(i) + dz);
  }
}

/** Build a tree of the requested kind. */
export function treeGeometry(kind: string, options: TreeOptions): BufferGeometry {
  if (kind === 'conifer') return coniferGeometry(options);
  if (kind === 'willow') return willowGeometry(options);
  return broadleafGeometry(options);
}

/**
 * Geometries are built once per (kind, seed) and shared by every instance
 * that uses them. Building a fresh tree per instance would be both slow and
 * pointless: variation comes from per-instance rotation, scale and colour,
 * and a handful of distinct base shapes is enough to break up a forest.
 */
const cache = new Map<string, BufferGeometry>();

export function cachedGeometry(key: string, build: () => BufferGeometry): BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = build();
    cache.set(key, geometry);
  }
  return geometry;
}

export function clearGeometryCache(): void {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
}

/** Exposed for the proof-sheet tool, which bakes every shape in one grid. */
export const GEOMETRY_BUILDERS = {
  grassTuftGeometry,
  fernGeometry,
  flowerGeometry,
  rockGeometry,
  coniferGeometry,
  broadleafGeometry,
  willowGeometry,
  toNonIndexed,
};
