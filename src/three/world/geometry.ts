/**
 * Procedural geometry for everything that grows.
 *
 * No modelled assets, no texture maps — partly because CLAUDE.md's asset
 * rule says procedural or CC0, and partly because a game whose whole world
 * is generated from a daily seed cannot ship a fixed set of models without
 * the world starting to repeat visibly within a week.
 *
 * Three things every geometry here has to get right:
 *
 * 1. **A silhouette that survives being small.** Most of these are seen at
 *    twenty to eighty metres, where all internal detail is gone and only
 *    the outline is doing any work. So the shapes are built from a few
 *    large, clearly-angled facets rather than smooth revolutions. A
 *    16-segment cylinder and a 6-segment cylinder look identical at that
 *    range and one of them costs nearly three times as much.
 *
 * 2. **Outward-facing winding.** Everything here is counter-clockwise seen
 *    from outside, so `computeVertexNormals` produces outward normals. This
 *    is not a style note: for months every closed shape in this file was
 *    wound the other way, which meant the solid material's backface culling
 *    threw away the near surface and drew the *inside* of the far one, lit
 *    by a normal pointing away from the sun. Rocks came out as black holes
 *    in the ground and tree canopies came out as crumpled paper bags. The
 *    winding of a triangle is load-bearing; see `outwardFraction` below.
 *
 * 3. **A sway weight per vertex.** The painterly shader reads an `aSway`
 *    attribute to decide how much wind moves each vertex. Getting this
 *    right is the difference between a tree that bends and a tree that
 *    slides through the ground: roots are 0, tips are 1, and the curve
 *    between them is quadratic rather than linear because a real branch is
 *    stiffer at the base than a lerp implies.
 *
 * Scale discipline: the bard is 1.8 m. Grass is ankle-to-shin (0.2–0.35 m),
 * ferns and shrubs are knee-to-waist, reeds are chest-high, and a tree is
 * three to five times his height. Every literal in this file is metres, and
 * getting one of them wrong is the fastest way to make the world read as a
 * scale model rather than a place.
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

function fromPositions(verts: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

/**
 * Fraction of a closed hull's faces whose normal points away from the
 * centroid. Exported for the proof-sheet tool, which is where a regression
 * in winding should be caught — reading it off a screenshot means noticing
 * that something is *slightly* too dark, which is exactly the observation
 * that went unmade for months.
 */
export function outwardFraction(geometry: BufferGeometry): number {
  const position = geometry.attributes.position as BufferAttribute;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < position.count; i++) {
    cx += position.getX(i);
    cy += position.getY(i);
    cz += position.getZ(i);
  }
  cx /= position.count;
  cy /= position.count;
  cz /= position.count;

  let outward = 0;
  const faces = Math.floor(position.count / 3);
  for (let f = 0; f < faces; f++) {
    const i = f * 3;
    const ax = position.getX(i);
    const ay = position.getY(i);
    const az = position.getZ(i);
    const ux = position.getX(i + 1) - ax;
    const uy = position.getY(i + 1) - ay;
    const uz = position.getZ(i + 1) - az;
    const vx = position.getX(i + 2) - ax;
    const vy = position.getY(i + 2) - ay;
    const vz = position.getZ(i + 2) - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * (ax - cx) + ny * (ay - cy) + nz * (az - cz) > 0) outward++;
  }
  return faces === 0 ? 1 : outward / faces;
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
 * Paint a vertical gradient into vertex colours.
 *
 * These colours *multiply* the per-instance colour, so the top of the
 * gradient is white (leave the instance colour alone) and the bottom is a
 * darkening, usually warm. That is what turns a field of uniformly-lit
 * blades into a field with shadow in the bottom of it — the one cheap trick
 * that makes low grass read as a mat rather than as loose cutlery.
 *
 * Smooth per-vertex interpolation is wanted here, unlike in `paint`: a
 * gradient that steps at every facet is just banding.
 */
function paintGradient(
  geometry: BufferGeometry,
  rootHex: number,
  tipHex: number,
  rootY: number,
  tipY: number,
): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const span = Math.max(1e-4, tipY - rootY);
  const r0 = ((rootHex >> 16) & 0xff) / 255;
  const g0 = ((rootHex >> 8) & 0xff) / 255;
  const b0 = (rootHex & 0xff) / 255;
  const r1 = ((tipHex >> 16) & 0xff) / 255;
  const g1 = ((tipHex >> 8) & 0xff) / 255;
  const b1 = (tipHex & 0xff) / 255;
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) - rootY) / span));
    colors[i * 3] = r0 + (r1 - r0) * t;
    colors[i * 3 + 1] = g0 + (g1 - g0) * t;
    colors[i * 3 + 2] = b0 + (b1 - b0) * t;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

// --- baked occlusion ---------------------------------------------------

/**
 * Options for `bakeVertexAO`. Every one of them is a *look* dial rather than
 * a quality dial — see the notes on the function itself.
 */
export interface VertexAOOptions {
  /** Hemisphere rays per vertex. 16 is the point of diminishing returns. */
  samples?: number;
  /** How far a surface has to be before it stops shading this vertex, metres. */
  maxDist?: number;
  /** How much of the albedo a fully-occluded vertex may lose. */
  strength?: number;
  /** Seeds the ray directions. Give each builder its own. */
  seed?: number;
}

/**
 * The most a baked crevice is allowed to take off a vertex's albedo.
 *
 * 0.55 of the albedo survives at the very darkest, which is far short of
 * what a physically-plausible bake would do to an inside corner. That is the
 * whole point: the lighting model in `painterly.ts` is a three-band cel ramp
 * over a shadow floor that never reaches black, on the stated grounds that
 * cosy games do not use black — and an AO term that undercuts that floor
 * would put the deepest thing in the frame in the crease of a shrub rather
 * than under the trees, which is the tonal inversion that makes stylised art
 * read as "3D render with dirt on it".
 *
 * So this is a *drawn* occlusion: enough to tell the eye that two forms meet
 * here, not enough to model the light that does not reach.
 */
export const AO_FLOOR = 0.55;

/**
 * Above this many vertices a geometry is left unbaked, silently.
 *
 * The bake is O(vertices x samples x nearby-triangles) and it runs on the
 * main thread inside a builder, which means it runs during the frame that
 * streams a chunk in — on a phone. Every shape this file makes is comfortably
 * under the budget (the heaviest is a broadleaf at about 700 vertices), so the
 * guard never fires today; it exists so that a future shape that *is* heavy
 * degrades by losing a subtle darkening rather than by dropping a frame, and
 * so nobody has to remember to think about it. Silent rather than warning
 * because there is no console anyone reads on the platform that would care.
 */
export const AO_VERTEX_BUDGET = 6000;

/** Ignore hits closer than this: they are the vertex's own neighbourhood. */
const AO_RAY_EPSILON = 1e-4;

/**
 * Bake ambient occlusion into a geometry's vertex colours.
 *
 * ROADMAP 170's argument for this being the strongest available "crafted"
 * signal at close range: everything in this world is untextured flat-shaded
 * facets, so the only thing that can say *this object has depth* at two
 * metres is how the light falls into the places where two of its forms meet.
 * A shadow map cannot do it — the creases are centimetres across and the map
 * covers hundreds of metres — and a screen-space pass costs a full-frame
 * buffer on hardware that does not have one to spare. Baking it into the
 * vertex colours costs three floats a vertex that most of these geometries
 * are already carrying, needs no UVs, no textures and no shader change, and
 * feeds straight into the multiply `painterly.ts` already does with
 * `PAINTERLY_VERTEX_COLORS`.
 *
 * **Determinism is not negotiable here.** The whole world is a pure function
 * of a day's seed (see `core/rng.ts`), and a bake that drew its ray
 * directions from `Math.random` would give two players on the same road
 * subtly different rocks — and would give the same player different rocks on
 * a reload, which is the kind of shimmer that is impossible to attribute once
 * noticed. So the directions come from `mulberry32`, seeded once per bake,
 * and are drawn in a fixed order: same geometry in, byte-identical colours
 * out, on every machine, forever.
 *
 * The rays are cast against the geometry's *own* triangles with a hand-rolled
 * Möller-Trumbore rather than three's `Raycaster`, which allocates a `Ray`,
 * a `Matrix4` and an intersection record per test and would turn a few
 * hundred thousand ray-triangle tests into a few hundred thousand objects.
 * Occluders are pre-filtered per vertex by bounding sphere against `maxDist`,
 * which is what keeps a willow's 48-strip curtain affordable: a frond only
 * ever tests the handful of strips actually beside it.
 *
 * Two consequences of the geometry style are worth stating so they do not
 * read as bugs. These meshes are non-indexed with a duplicated vertex per
 * face, so AO is per *face corner* and steps between facets rather than
 * blending across them — which is exactly the faceted look everything else
 * here is built for. And a closed convex hull occludes nothing at all, so a
 * boulder comes out unchanged; the darkening only appears where forms
 * genuinely meet, which is the honest answer.
 */
export function bakeVertexAO(
  geometry: BufferGeometry,
  options: VertexAOOptions = {},
): BufferGeometry {
  const position = geometry.attributes.position as BufferAttribute | undefined;
  if (!position) return geometry;
  const count = position.count;
  if (count === 0 || count > AO_VERTEX_BUDGET) return geometry;

  const samples = Math.max(1, Math.floor(options.samples ?? 16));
  const maxDist = Math.max(1e-4, options.maxDist ?? 1.6);
  const strength = Math.min(1, Math.max(0, options.strength ?? 0.45));
  const floor = Math.max(AO_FLOOR, 1 - strength);

  // Normals decide the hemisphere, so a geometry that has not computed them
  // yet would scatter its rays around a zero vector and come back unshaded.
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const normal = geometry.attributes.normal as BufferAttribute;

  // Triangles, flattened. Indexed geometries are rare in this file but the
  // bard's parts are built by hand elsewhere, so read through the index when
  // one is present rather than quietly baking the wrong triangles.
  const index = geometry.index;
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(count / 3);
  if (triCount === 0) return geometry;

  const ia = new Int32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    if (index) {
      ia[t * 3] = index.getX(t * 3);
      ia[t * 3 + 1] = index.getX(t * 3 + 1);
      ia[t * 3 + 2] = index.getX(t * 3 + 2);
    } else {
      ia[t * 3] = t * 3;
      ia[t * 3 + 1] = t * 3 + 1;
      ia[t * 3 + 2] = t * 3 + 2;
    }
  }

  // Per triangle: corner A, the two edge vectors Möller-Trumbore wants, and a
  // bounding sphere for the distance pre-filter.
  const ax = new Float32Array(triCount);
  const ay = new Float32Array(triCount);
  const az = new Float32Array(triCount);
  const e1x = new Float32Array(triCount);
  const e1y = new Float32Array(triCount);
  const e1z = new Float32Array(triCount);
  const e2x = new Float32Array(triCount);
  const e2y = new Float32Array(triCount);
  const e2z = new Float32Array(triCount);
  const lox = new Float32Array(triCount);
  const loy = new Float32Array(triCount);
  const loz = new Float32Array(triCount);
  const hix = new Float32Array(triCount);
  const hiy = new Float32Array(triCount);
  const hiz = new Float32Array(triCount);

  for (let t = 0; t < triCount; t++) {
    const i0 = ia[t * 3];
    const i1 = ia[t * 3 + 1];
    const i2 = ia[t * 3 + 2];
    const p0x = position.getX(i0);
    const p0y = position.getY(i0);
    const p0z = position.getZ(i0);
    const p1x = position.getX(i1);
    const p1y = position.getY(i1);
    const p1z = position.getZ(i1);
    const p2x = position.getX(i2);
    const p2y = position.getY(i2);
    const p2z = position.getZ(i2);
    ax[t] = p0x;
    ay[t] = p0y;
    az[t] = p0z;
    e1x[t] = p1x - p0x;
    e1y[t] = p1y - p0y;
    e1z[t] = p1z - p0z;
    e2x[t] = p2x - p0x;
    e2y[t] = p2y - p0y;
    e2z[t] = p2z - p0z;
    lox[t] = Math.min(p0x, p1x, p2x);
    loy[t] = Math.min(p0y, p1y, p2y);
    loz[t] = Math.min(p0z, p1z, p2z);
    hix[t] = Math.max(p0x, p1x, p2x);
    hiy[t] = Math.max(p0y, p1y, p2y);
    hiz[t] = Math.max(p0z, p1z, p2z);
  }

  const rand = mulberry32((options.seed ?? 1) >>> 0);
  const candidates = new Int32Array(triCount);

  const existing = geometry.attributes.color as BufferAttribute | undefined;
  const colors = new Float32Array(count * 3);
  if (existing) {
    for (let i = 0; i < count; i++) {
      colors[i * 3] = existing.getX(i);
      colors[i * 3 + 1] = existing.getY(i);
      colors[i * 3 + 2] = existing.getZ(i);
    }
  } else {
    colors.fill(1);
  }

  for (let i = 0; i < count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    const nLen = Math.hypot(nx, ny, nz);
    // Draw the sample directions regardless, so the PRNG advances by the same
    // amount per vertex whether or not this one is shadeable. A stream whose
    // position depends on the geometry's content is a determinism trap the
    // first time somebody adds an early return above it.
    const skip = nLen < 1e-6;
    const unx = skip ? 0 : nx / nLen;
    const uny = skip ? 1 : ny / nLen;
    const unz = skip ? 0 : nz / nLen;

    // Origin lifted off the surface, so the vertex's own faces (and the
    // coplanar half of a split quad) sit at or behind t = 0.
    const ox = position.getX(i) + unx * 1e-3;
    const oy = position.getY(i) + uny * 1e-3;
    const oz = position.getZ(i) + unz * 1e-3;

    /*
     * Pre-filter once per vertex, not once per ray. The two tests below are
     * the whole reason this is affordable: without them a broadleaf's 660
     * vertices would each run 16 rays against all 220 triangles, and the
     * intersection maths is fifty times the cost of a rejection.
     *
     * The first is distance to the triangle's AABB, which is the exact
     * question `maxDist` asks. (A bounding sphere was tried and is
     * meaningfully worse here: a canopy facet is a wide flat triangle, so its
     * circumradius inflates its reach by half a metre for nothing.)
     *
     * The second is a tangent-plane reject — a triangle entirely at or below
     * the plane the hemisphere sits on cannot be hit by any ray in that
     * hemisphere. On a rounded form this throws away the whole far side of
     * the shape, which is most of it, and it is exact rather than
     * conservative, so nothing that could have occluded is lost.
     */
    let nCandidates = 0;
    if (!skip) {
      const maxSq = maxDist * maxDist;
      for (let t = 0; t < triCount; t++) {
        if (ia[t * 3] === i || ia[t * 3 + 1] === i || ia[t * 3 + 2] === i) continue;
        const dx = Math.max(lox[t] - ox, 0, ox - hix[t]);
        const dy = Math.max(loy[t] - oy, 0, oy - hiy[t]);
        const dz = Math.max(loz[t] - oz, 0, oz - hiz[t]);
        if (dx * dx + dy * dy + dz * dz > maxSq) continue;
        const d0 = (ax[t] - ox) * unx + (ay[t] - oy) * uny + (az[t] - oz) * unz;
        const d1 = d0 + e1x[t] * unx + e1y[t] * uny + e1z[t] * unz;
        const d2 = d0 + e2x[t] * unx + e2y[t] * uny + e2z[t] * unz;
        if (d0 <= 0 && d1 <= 0 && d2 <= 0) continue;
        candidates[nCandidates++] = t;
      }
    }

    // An orthonormal frame around the normal. The helper axis is chosen away
    // from the normal so the cross product never degenerates.
    const hx = Math.abs(unx) < 0.9 ? 1 : 0;
    const hy = Math.abs(unx) < 0.9 ? 0 : 1;
    let tx = hy * unz - 0 * uny;
    let ty = 0 * unx - hx * unz;
    let tz = hx * uny - hy * unx;
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;
    const bx = uny * tz - unz * ty;
    const by = unz * tx - unx * tz;
    const bz = unx * ty - uny * tx;

    let occluded = 0;
    for (let s = 0; s < samples; s++) {
      // Cosine-weighted: concentrating the rays around the normal is what
      // makes 16 of them enough, because that is also where the incoming
      // light this is approximating is weighted.
      const u = rand();
      const v = rand();
      const r = Math.sqrt(u);
      const phi = v * Math.PI * 2;
      const lx = r * Math.cos(phi);
      const ly = r * Math.sin(phi);
      const lz = Math.sqrt(Math.max(0, 1 - u));
      const dx = tx * lx + bx * ly + unx * lz;
      const dy = ty * lx + by * ly + uny * lz;
      const dz = tz * lx + bz * ly + unz * lz;

      let nearest = maxDist;
      for (let c = 0; c < nCandidates; c++) {
        const t = candidates[c];
        // Möller-Trumbore, two-sided. Backface culling would be wrong here:
        // an inside corner is often approached from behind the occluder's
        // winding, and a one-sided test would leave exactly the creases this
        // exists for unshaded.
        const px = dy * e2z[t] - dz * e2y[t];
        const py = dz * e2x[t] - dx * e2z[t];
        const pz = dx * e2y[t] - dy * e2x[t];
        const det = e1x[t] * px + e1y[t] * py + e1z[t] * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const inv = 1 / det;
        const sx = ox - ax[t];
        const sy = oy - ay[t];
        const sz = oz - az[t];
        const bu = (sx * px + sy * py + sz * pz) * inv;
        if (bu < 0 || bu > 1) continue;
        const qx = sy * e1z[t] - sz * e1y[t];
        const qy = sz * e1x[t] - sx * e1z[t];
        const qz = sx * e1y[t] - sy * e1x[t];
        const bv = (dx * qx + dy * qy + dz * qz) * inv;
        if (bv < 0 || bu + bv > 1) continue;
        const hit = (e2x[t] * qx + e2y[t] * qy + e2z[t] * qz) * inv;
        if (hit > AO_RAY_EPSILON && hit < nearest) nearest = hit;
      }
      // Attenuated by distance: a surface at arm's length is ambient
      // occlusion, a surface touching this one is contact shadow, and only
      // the second should be visible as a line.
      if (nearest < maxDist) occluded += 1 - nearest / maxDist;
    }

    const ao = Math.max(floor, 1 - strength * (occluded / samples));
    colors[i * 3] *= ao;
    colors[i * 3 + 1] *= ao;
    colors[i * 3 + 2] *= ao;
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

// --- blades and fronds -------------------------------------------------

/**
 * One tapered blade, rising from `(cx, 0, cz)` and leaning along `angle`.
 *
 * Three triangles: a quad from the root to the bend, then a taper to a
 * point. The bend is the whole reason this reads as a blade of grass and
 * not a shard of glass — a single flat quad has no curvature to catch a
 * different band of the light than its neighbour, so a field of them
 * flashes as one surface.
 */
function bladeGeometry(
  cx: number,
  cz: number,
  angle: number,
  height: number,
  lean: number,
  width: number,
  curl = 0,
): BufferGeometry {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const sx = -Math.sin(angle);
  const sz = Math.cos(angle);

  /*
   * The blade ARCHES. This is the whole difference between grass and a
   * caltrop, and it was wrong here for a long time in a way the arithmetic
   * makes obvious once it is written down.
   *
   * A blade leaning to `tipOut` at its tip, with its waist at half its
   * height, is *straight* when `midOut` is half of `tipOut`. Below that it is
   * concave — it stays near the vertical and then hooks outward at the end,
   * which is the silhouette of a claw. Above it, it is convex: it leaves the
   * root already bending and flattens as it goes, which is the silhouette of
   * a grass blade with its own weight on it.
   *
   * `midOut` was `0.24 * lean * height` against a `tipOut` of
   * `lean * height` — well under the straight-line 0.5, so every blade in
   * the game was concave, and a tuft of five of them fanned radially read as
   * a spike-star sitting on the ground rather than as a plant. It is now
   * comfortably over the line, and the waist is a little higher up the blade
   * so the bend reads as a bend rather than as a kink.
   *
   * `fernGeometry` immediately below has carried the same lesson in its
   * doc comment ("a frond that rises, widens and then droops has volume")
   * since it was written. Grass simply never had it applied.
   */
  const midY = height * 0.56;
  const tipOut = lean * height;
  const midOut = tipOut * 0.72;
  /*
   * Sideways sweep, so the blades of one tuft are not five copies of the
   * same curve rotated. Applied along the blade's own side vector and
   * strongest at the tip, which turns a flat fan into something that reads
   * as a handful of grass with a direction to it.
   *
   * Scaled against `tipOut` rather than against `width`, which matters: a
   * curl measured in blade-widths is a fixed number of centimetres, and on a
   * short blade with little lean that is a larger sideways move than the
   * blade makes outward — the sweep then dominates the arch and the tuft
   * twists. Proportional to the lean, it stays a minority component of the
   * blade's travel at every size, so the arch above always reads first.
   */
  const midCurl = curl * tipOut * 0.13;
  const tipCurl = curl * tipOut * 0.32;
  // Wider at the waist than it used to be (0.48). The upper triangle is the
  // part that carries the tip, and a waist at half the base width leaves it
  // a needle; at 0.62 the blade still tapers cleanly but its point is broad
  // enough to read as a tip rather than as a spine. Going past ~0.7 is the
  // other failure the old comment here warned about — the blade turns into
  // an arrowhead on a stick.
  const midW = width * 0.62;

  /*
   * The tip is a short EDGE, not a point.
   *
   * Arching the blade fixed its middle and left its end alone, and a critique
   * of the re-shot frames went straight to what was left: the terminal
   * triangle ran from the waist to a single apex vertex on a base of about
   * 1.2 widths — a 2.6:1 spine — so a blade was still a needle however
   * nicely the section below it curved. Every tuft kept one hard point aimed
   * at the camera and the meadow still squinted down to a bed of nails.
   *
   * Capping it with a narrow quad costs one triangle per blade and is the
   * difference between a spine and a strap. `grassTuftGeometry`'s triangle
   * budget moves from 15 to 20 deliberately, and its test moves with it.
   */
  const tipW = width * 0.3;

  const blx = cx + sx * width;
  const blz = cz + sz * width;
  const brx = cx - sx * width;
  const brz = cz - sz * width;
  const mlx = cx + dx * midOut + sx * (midW + midCurl);
  const mlz = cz + dz * midOut + sz * (midW + midCurl);
  const mrx = cx + dx * midOut - sx * (midW - midCurl);
  const mrz = cz + dz * midOut - sz * (midW - midCurl);
  const tcx = cx + dx * tipOut + sx * tipCurl;
  const tcz = cz + dz * tipOut + sz * tipCurl;
  const tlx = tcx + sx * tipW;
  const tlz = tcz + sz * tipW;
  const trx = tcx - sx * tipW;
  const trz = tcz - sz * tipW;

  // Wound so the face normal points along `angle` — outward from the tuft's
  // centre, the direction the blade is leaning and therefore the direction
  // it should catch light from.
  return fromPositions([
    blx, 0, blz, brx, 0, brz, mrx, midY, mrz,
    blx, 0, blz, mrx, midY, mrz, mlx, midY, mlz,
    mlx, midY, mlz, mrx, midY, mrz, trx, height, trz,
    mlx, midY, mlz, trx, height, trz, tlx, height, tlz,
  ]);
}

/**
 * Tilt a blade's normals toward the sky.
 *
 * A blade is a single plane standing nearly upright, so its true normal is
 * nearly horizontal — which means the lighting model treats it as a wall. Two
 * things follow, and both were named in the critique of the frames: a blade
 * turned away from the sun goes almost black, so a tuft reads as a dark
 * teepee rather than as grass; and thin near-vertical planes seen edge-on
 * alternate between lit and unlit from blade to blade, which is the
 * "hairline antennae" flicker across the middle distance.
 *
 * Real grass does not read that way because a lawn is lit as a *surface*:
 * light comes down onto the mass of it, and individual blades borrow the
 * ground's response rather than each arguing with it. Blending each normal
 * toward +Y is the standard stylised-grass answer and it costs nothing —
 * no extra geometry, no shader change, no second plane per blade. It also
 * pulls ground cover closer in value to the ground it grows out of, which is
 * the other half of why the tufts read as dark litter scattered on a field.
 */
function skywardNormals(geometry: BufferGeometry, amount: number): void {
  const normal = geometry.attributes.normal as BufferAttribute;
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i) * (1 - amount);
    const ny = normal.getY(i) * (1 - amount) + amount;
    const nz = normal.getZ(i) * (1 - amount);
    const length = Math.hypot(nx, ny, nz) || 1;
    normal.setXYZ(i, nx / length, ny / length, nz / length);
  }
  normal.needsUpdate = true;
}

/**
 * A tuft of grass: five blades fanning from a small root patch.
 *
 * Blades are solid tapered geometry rather than the usual alpha-tested
 * cross-billboards. An alpha test on a mesh drawn twenty thousand times is
 * one of the more expensive things you can do to a phone, and solid
 * geometry never has an alpha sorting problem.
 *
 * The roots are spread over a few centimetres instead of all meeting at a
 * point. A tuft whose blades converge exactly reads as a firework; real
 * grass comes up in a patch.
 */
export function grassTuftGeometry(seed = 7): BufferGeometry {
  const rand = mulberry32(seed);
  const blades: BufferGeometry[] = [];
  const bladeCount = 5;
  let tallest = 0.2;

  /*
   * One prevailing direction per tuft, with the blades spread inside a wedge
   * around it rather than around the whole circle.
   *
   * Five blades at even 72° spacing over a full turn is a radial star, and a
   * radial star is what the meadow read as: every tuft had a blade pointing
   * at the camera, and the near foreground came out as a scattering of
   * asterisks. Real grass has weight and weather in it — a clump leans
   * somewhere. Confining the fan to a wedge gives the tuft a front and a
   * back, so it reads as a handful of grass, and it also means neighbouring
   * tufts (which get their own random heading from the instance rotation)
   * disagree with each other instead of all being the same rosette.
   */
  const prevailing = rand() * Math.PI * 2;
  // About sixty to ninety degrees of fan. Wider than this and the wedge stops
  // being a wedge: at 2.2 rad, plus the per-blade jitter and the sideways
  // curl, the tips of one tuft spanned 163° — near enough a half-circle that
  // it read as the rosette this is meant to replace. The variety between
  // tufts comes from `prevailing` and from each instance's own rotation, not
  // from opening this angle up.
  const wedge = 1.0 + rand() * 0.5;

  for (let b = 0; b < bladeCount; b++) {
    // -0.5 .. +0.5 across the fan, so the wedge is centred on `prevailing`.
    const spread = b / (bladeCount - 1) - 0.5;
    const angle = prevailing + spread * wedge + (rand() - 0.5) * 0.36;
    // Ankle-to-shin on a 1.8 m bard: 0.17–0.28 m here, and 0.14–0.37 m once
    // the instance scale has had its way. Earlier passes at 0.36 m put the
    // tips at the bard's knee and the meadow read as an uncut hayfield.
    const height = 0.17 + rand() * 0.11;
    // Pulled in from 0.24–0.56. Combined with the arch in `bladeGeometry`,
    // the old range threw tips almost as far sideways as the blade was tall,
    // which is what splayed the tuft flat against the ground. Standing the
    // blades up is most of what makes a tuft read as growing rather than as
    // something dropped there.
    const lean = 0.16 + rand() * 0.24;
    // Wide enough to survive being one or two pixels across at twenty
    // metres. A narrower blade aliases into a dotted line, which is what
    // made the meadow read as stubble rather than as grass.
    const width = 0.023 + rand() * 0.010;
    const rootA = rand() * Math.PI * 2;
    // A wider root patch than the blades are tall. Five blades out of a
    // point is a spray; five out of a hand's width of ground is a tuft, and
    // it covers three times the area for the same triangle count.
    const rootR = rand() * 0.11;
    tallest = Math.max(tallest, height);
    blades.push(
      bladeGeometry(
        Math.cos(rootA) * rootR,
        Math.sin(rootA) * rootR,
        angle,
        height,
        lean,
        width,
        (rand() - 0.5) * 2,
      ),
    );
  }

  const merged = mergeGeometries(blades);
  merged.computeVertexNormals();
  // Strongly skyward: grass is the one prop that should be lit as ground
  // rather than as a set of little walls. See `skywardNormals`.
  //
  /*
   * 0.92, up from 0.72, in two steps and with the arithmetic written down
   * because the first step was not enough and it was not obvious why.
   *
   * At 0.72 a blade keeps 0.28 of its true, near-horizontal normal. Take a
   * golden-hour sun a few degrees above the horizon, so `L` is nearly
   * horizontal: a blade turned toward it lands at `ndl` ~ 0.27 and one turned
   * away at ~ -0.09, which the shader's three bands turn into a sun term of
   * 0.55 against 0.25. That is a factor of two BETWEEN TWO BLADES OF THE SAME
   * TUFT, at the hour with the warmest and strongest sun in the game — pale
   * straw beside near-black, which is exactly what every critique has meant by
   * calling the meadow litter. Softening the band edges (see the foliage
   * material) halves the harshness of the step and cannot touch its size.
   *
   * At 0.92 the same two blades land at 0.168 and 0.008, and the sun term goes
   * to 0.44 against 0.33 — a third rather than a factor of two. What is given
   * up is modelling within the tuft, and for grass specifically that is the
   * right trade and always was: a lawn is lit as a surface, not as twenty
   * thousand little walls each arguing with the sun.
   */
  skywardNormals(merged, 0.92);
  paintGradient(merged, 0xb2ab8b, 0xffffff, 0, tallest * 0.85);
  // Grass sways from the very base — it has no stiff trunk to resist.
  addSway(merged, 0, tallest, 1);
  return merged;
}

/**
 * A fern / low shrub: arching fronds, knee-high, much darker than grass.
 *
 * The arch matters more than anything else here. A frond built as a flat
 * triangle lying at an angle is a pale shard — that is precisely what the
 * forest floor used to be carpeted in — whereas a frond that rises, widens
 * and then droops has a top surface facing the sky and an underside facing
 * away, so the two catch different bands of the light and the plant has
 * volume at a distance of one triangle's worth of extra cost.
 */
export function fernGeometry(seed = 9): BufferGeometry {
  const rand = mulberry32(seed);
  const fronds: BufferGeometry[] = [];
  const count = 6;
  let tallest = 0.2;

  /*
   * Fronds fan into a wedge, for the same reason grass tufts do — and a
   * critique of the frames caught this one being *worse* than the grass was.
   * Spread over a full circle (`f / count * 2pi`), with each frond reaching
   * 1.25 lengths outward while rising only a third of that, the plant was a
   * flat radial star by construction: limbs projecting sideways and downward
   * from a common root, which is the dictionary definition of a caltrop. In
   * the foreground of the dawn frame — the nearest and largest band in the
   * picture — there were dozens of them, and at night they read as broken
   * glass.
   *
   * The arch below was always right; what was wrong was that six arches
   * pointing every way cancel each other out into a rosette. Confined to a
   * wedge, with the overshoot at the tip pulled in so a frond rises about as
   * much as it reaches, the same six arches read as one plant leaning.
   */
  const prevailing = rand() * Math.PI * 2;
  const wedge = 1.7 + rand() * 0.6;

  for (let f = 0; f < count; f++) {
    const angle = prevailing + (f / (count - 1) - 0.5) * wedge + (rand() - 0.5) * 0.5;
    // Length and arch vary hard from frond to frond. Six fronds of equal
    // length and equal rise is a cone, and a cone on the forest floor reads
    // as a tent — which is precisely what the first attempt looked like.
    const length = 0.28 + rand() * 0.26;
    const arch = 0.14 + rand() * 0.18;
    const width = 0.07 + rand() * 0.04;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const sx = -Math.sin(angle);
    const sz = Math.cos(angle);
    tallest = Math.max(tallest, arch);

    const rootW = width * 0.28;
    // Was `arch * 0.3`, which dropped the tip to under a third of the height
    // it had just reached while still travelling outward — the frond spent
    // most of its length going sideways-and-down. A tip that settles just
    // below the waist of the arch still droops, without the plant lying down.
    const tipDrop = arch * 0.62;

    fronds.push(
      fromPositions([
        // root quad, opening out to the widest point of the arch
        sx * rootW, 0.03, sz * rootW,
        dx * length * 0.55 + sx * width, arch, dz * length * 0.55 + sz * width,
        dx * length * 0.55 - sx * width, arch, dz * length * 0.55 - sz * width,

        sx * rootW, 0.03, sz * rootW,
        dx * length * 0.55 - sx * width, arch, dz * length * 0.55 - sz * width,
        -sx * rootW, 0.03, -sz * rootW,

        // the drooping tip
        dx * length * 0.55 + sx * width, arch, dz * length * 0.55 + sz * width,
        // 1.0, not 1.25. The frond should reach about as far as it rises;
        // beyond that it stops being an arch and becomes a spear.
        dx * length, tipDrop, dz * length,
        dx * length * 0.55 - sx * width, arch, dz * length * 0.55 - sz * width,
      ]),
    );
  }

  const merged = mergeGeometries(fronds);
  merged.computeVertexNormals();
  // Gentler than grass: a fern's fronds are broad and near-horizontal already,
  // so they have a real top surface to catch the sky. This is only here to
  // stop the ones facing away from the sun going to black.
  skywardNormals(merged, 0.4);
  paintGradient(merged, 0x8f9576, 0xffffff, 0, tallest);
  addSway(merged, 0, tallest * 1.4, 0.5);
  return merged;
}

/**
 * A small flower: a green stalk and a four-petal head.
 *
 * The stalk is painted almost to black-green so that the instance colour —
 * which is the *petal* colour, an accent chosen to dissent from the biome's
 * greens — does not also paint a bright orange stem. Vertex colour
 * multiplies the instance colour, so darkening is the only move available;
 * it happens to be the right one, because a stem in grass is in shadow.
 */
export function flowerGeometry(seed = 13): BufferGeometry {
  const rand = mulberry32(seed);
  const height = 0.20 + rand() * 0.13;
  const petal = 0.058;
  const parts: BufferGeometry[] = [];

  parts.push(
    paint(
      fromPositions([
        -0.009, 0, 0, 0, height, 0, 0.009, 0, 0,
        0, 0, -0.009, 0, height, 0, 0, 0, 0.009,
      ]),
      0x4e5a3c,
    ),
  );

  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + rand() * 0.3;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    parts.push(
      paint(
        fromPositions([
          0, height - 0.012, 0,
          nx * petal - nz * petal * 0.6, height + 0.022, nz * petal + nx * petal * 0.6,
          nx * petal + nz * petal * 0.6, height + 0.022, nz * petal - nx * petal * 0.6,
        ]),
        0xffffff,
      ),
    );
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, height, 0.85);
  return merged;
}

/**
 * A clump of reeds: riverside's signature ground cover.
 *
 * Chest-high and almost vertical, which is the entire point — it is the one
 * thing in the world whose silhouette is a bundle of verticals, so a bank of
 * it reads as "water is near" from a long way off without a drop of water
 * having to be drawn.
 */
export function reedClumpGeometry(seed = 21): BufferGeometry {
  const rand = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const stalks = 11;
  let tallest = 1;

  for (let i = 0; i < stalks; i++) {
    const angle = rand() * Math.PI * 2;
    const rootR = Math.sqrt(rand()) * 0.22;
    const height = 0.62 + rand() * 0.45;
    tallest = Math.max(tallest, height);
    const blade = bladeGeometry(
      Math.cos(angle) * rootR,
      Math.sin(angle) * rootR,
      angle,
      height,
      0.05 + rand() * 0.12,
      0.017 + rand() * 0.008,
    );
    paintGradient(blade, 0x87895e, 0xffffff, 0, height);
    parts.push(blade);

    // A seed head on roughly a third of the stalks, painted brown so it
    // reads against the greens without needing its own instance colour.
    if (rand() < 0.35) {
      const hx = Math.cos(angle) * (rootR + 0.05 * height);
      const hz = Math.sin(angle) * (rootR + 0.05 * height);
      const w = 0.028;
      parts.push(
        paint(
          fromPositions([
            hx - w, height - 0.16, hz, hx + w, height - 0.16, hz, hx, height + 0.05, hz,
            hx, height - 0.16, hz - w, hx, height - 0.16, hz + w, hx, height + 0.05, hz,
          ]),
          0x6f5c3e,
        ),
      );
    }
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, tallest, 1);
  return merged;
}

// --- closed hulls ------------------------------------------------------

/**
 * A faceted dome — the one closed-hull primitive, used for boulders,
 * shrubs and every broadleaf canopy.
 *
 * The lumpiness comes from two low harmonics of the azimuth rather than
 * per-vertex noise. That is the whole difference between a canopy and a
 * paper bag: a lump has to be wider than a single facet or it is not a
 * lump, it is a spike, and a hull full of independent per-vertex spikes has
 * no readable outline at all once it is forty metres away.
 *
 * Poles are single vertices with triangle fans rather than a degenerate
 * ring, which removes the pinched crease that used to make every canopy
 * look like a pitched roof.
 */
function lumpDome(
  radius: number,
  segments: number,
  rings: number,
  flatten: number,
  lumpiness: number,
  rand: Rand,
): BufferGeometry {
  const twist = rand() * Math.PI * 2;
  const phaseA = rand() * Math.PI * 2;
  const phaseB = rand() * Math.PI * 2;
  const lumpAt = (theta: number): number =>
    1 + lumpiness * (Math.sin(theta * 2 + phaseA) * 0.62 + Math.sin(theta * 3 + phaseB) * 0.38);

  const ringPts: number[][][] = [];
  for (let r = 0; r < rings; r++) {
    const phi = ((r + 1) / (rings + 1)) * Math.PI;
    // Fuller than a sphere near the poles. Plain sin(phi) pinches a
    // three-ring dome into a lens, and a lens has no mass at eighty metres.
    const profile = Math.pow(Math.sin(phi), 0.62);
    const ringLump = 0.92 + rand() * 0.16;
    const y = Math.cos(phi) * flatten * radius;
    const pts: number[][] = [];
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2 + twist;
      const rr = radius * profile * ringLump * lumpAt(theta);
      pts.push([Math.cos(theta) * rr, y, Math.sin(theta) * rr]);
    }
    ringPts.push(pts);
  }

  const top = [0, radius * flatten * (0.94 + rand() * 0.14), 0];
  const bottom = [0, -radius * flatten * (0.88 + rand() * 0.12), 0];

  const verts: number[] = [];
  const first = ringPts[0];
  for (let s = 0; s < segments; s++) {
    verts.push(...top, ...first[(s + 1) % segments], ...first[s]);
  }
  for (let r = 0; r < rings - 1; r++) {
    const upper = ringPts[r];
    const lower = ringPts[r + 1];
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      verts.push(...upper[s], ...upper[s1], ...lower[s]);
      verts.push(...upper[s1], ...lower[s1], ...lower[s]);
    }
  }
  const last = ringPts[rings - 1];
  for (let s = 0; s < segments; s++) {
    verts.push(...bottom, ...last[s], ...last[(s + 1) % segments]);
  }
  return fromPositions(verts);
}

/**
 * A low-poly boulder: a wide, flat-shaded lump bedded into the ground.
 *
 * Wider than it is tall and sunk below its own origin, so an instance
 * dropped on the terrain looks half-buried rather than balanced on the
 * surface. The vertical gradient is doing the rest of that work: the
 * underside is painted well down, which fakes the occlusion where stone
 * meets turf.
 *
 * **It is not a dome, and that is the point.** A critique of the mid-distance
 * found bush, boulder and log sharing one silhouette: all three were rounded
 * lumps at different tints, so at forty metres the field read as a scattering
 * of identical blobs and the eye could not tell scrub from stone. `lumpDome`
 * is right for a bush — a bush *is* a soft mass — and wrong for rock, which
 * splits along flat planes and sits on the ground with its weight low.
 *
 * So this is three irregular rings joined by flat quads: a base a little
 * narrower than the shoulder, the shoulder at two fifths of the height (which
 * is what "weighted base" means arithmetically — the widest section is in the
 * bottom half), and a small tilted cap. The cap is the whole silhouette cue.
 * A dome's outline is an arc from any angle; this one has a shoulder, a
 * slanted top plane and a corner between them, and it holds all three at the
 * distance where the dome had already collapsed to a semicircle.
 *
 * Deliberately *not* the other failure the same critique named — a crumpled
 * pancake of independent per-vertex spikes, which has no readable outline at
 * all. Every facet here is a whole quad between two rings.
 */
export function rockGeometry(seed = 17): BufferGeometry {
  const rand = mulberry32(seed);
  const sides = 6;
  const baseY = -0.26;
  const topY = 0.66;

  const angles: number[] = [];
  const radii: number[] = [];
  const twist = rand() * Math.PI * 2;
  for (let i = 0; i < sides; i++) {
    // Angles jittered as well as radii: an even hexagon reads as a primitive
    // however irregular its radius is, because the eye reads the corners.
    angles.push(twist + (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.44);
    radii.push(0.58 + rand() * 0.28);
  }

  // Where the cap sits, and how it leans. A cap centred and level is a
  // pedestal; offset and tilted, the stone reads as having settled.
  const capX = (rand() - 0.5) * 0.34;
  const capZ = (rand() - 0.5) * 0.34;
  const tiltX = (rand() - 0.5) * 0.34;
  const tiltZ = (rand() - 0.5) * 0.34;

  const ring = (y: number, shrink: number, offset: number, tilt: number): number[][] =>
    angles.map((a, i) => {
      const r = radii[i] * shrink;
      const x = Math.cos(a) * r + capX * offset;
      const z = Math.sin(a) * r + capZ * offset;
      return [x, y + (tiltX * x + tiltZ * z) * tilt, z];
    });

  const span = topY - baseY;
  // Top to bottom, because that is the order the winding convention below
  // (shared with `lumpDome`) expects.
  const rings = [
    ring(topY, 0.46, 1, 1),
    ring(baseY + span * 0.42, 1.0, 0.3, 0.35),
    ring(baseY, 0.86, 0, 0),
  ];

  const verts: number[] = [];
  // The cap: a fan around the ring's own centre rather than a raised apex, so
  // the top is a plane and not a point.
  const capCentre = [capX, topY + (tiltX * capX + tiltZ * capZ), capZ];
  for (let s = 0; s < sides; s++) {
    verts.push(...capCentre, ...rings[0][(s + 1) % sides], ...rings[0][s]);
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const upper = rings[r];
    const lower = rings[r + 1];
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      verts.push(...upper[s], ...upper[s1], ...lower[s]);
      verts.push(...upper[s1], ...lower[s1], ...lower[s]);
    }
  }
  const floor = [0, baseY, 0];
  for (let s = 0; s < sides; s++) {
    verts.push(...floor, ...rings[2][s], ...rings[2][(s + 1) % sides]);
  }

  const geometry = fromPositions(verts);
  geometry.computeVertexNormals();
  paintGradient(geometry, 0x8b877d, 0xffffff, -0.3, 0.5);
  // A single closed hull occludes nothing, so this is very nearly a no-op
  // today — kept anyway so that the day the boulder grows a second lobe or a
  // split, the crease is already lit for it.
  bakeVertexAO(geometry, { maxDist: 0.6, seed: 1017 });
  // Rocks do not sway. The attribute still has to exist so this geometry can
  // share a material with things that do.
  addSway(geometry, 0, 1, 0);
  return geometry;
}

/**
 * A rounded bush. Village hedgerow when it is lined up along a verge,
 * scrub when it is not.
 *
 * Deliberately a low, wide mound rather than a ball. A bush as tall as it
 * is wide standing at the roadside is a wall, and a line of them is a
 * hedge you cannot see the country over — which defeats the point of the
 * verge existing at all.
 *
 * Lowered again (`flatten` 0.58 -> 0.40, lobes seated at 0.28 of their own
 * radius rather than 0.5) when a critique found bush, boulder and log sharing
 * one blob silhouette. The bush is the one of the three that *should* stay
 * soft — the separation has to be bought somewhere else, and height is where
 * it is cheapest: a rounded mass that sits down in the grass and a faceted
 * stone that stands up out of it are two shapes at forty metres, where a
 * waist-high dome and a knee-high dome were one.
 */
export function shrubGeometry(seed = 23): BufferGeometry {
  const rand = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const lobes = 3;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rand() * 0.9;
    const r = 0.46 + rand() * 0.26;
    // Seven segments and three rings, not six and two. Two rings puts the
    // pole facet straight onto the widest ring, which gives a hexagonal
    // top and a bush that reads as a pitched tent from any angle.
    const lobe = lumpDome(r, 7, 3, 0.47, 0.26, rand);
    translateY(lobe, r * 0.36 + rand() * 0.09);
    translateXZ(lobe, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    parts.push(paint(lobe, 0xffffff, 0.18, rand));
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // Three lobes seated into each other, which is exactly the case baked AO is
  // for: the valleys between them are the only thing saying this is a mass of
  // foliage rather than one smooth blob.
  bakeVertexAO(merged, { maxDist: 0.5, seed: 1023 });
  addSway(merged, 0, 1.1, 0.32);
  return merged;
}

/**
 * A fallen trunk, lying along its own X axis. Forest only.
 *
 * Built upright and then rotated a quarter turn, because a tapered cylinder
 * is far easier to reason about along +Y and the rotation is proper (it
 * preserves handedness), so the outward winding survives it.
 *
 * **The cut ends are the whole silhouette.** `taperedCylinder` draws sides and
 * nothing else, so for as long as this shape has existed both ends of every
 * log in the world have been open tubes — and `solidMaterial` is front-face
 * only, so what an open end actually rendered was a hole with the ground
 * showing through it. That is most of why a critique found bush, boulder and
 * log reading as one rounded blob at mid distance: from the side a capless
 * tapered tube has exactly a dome's outline, and the one feature that says
 * *log* rather than *lump* — a flat disc of pale sawn timber at each end —
 * was missing.
 *
 * So the ends are capped, painted separately from the bark (heartwood is much
 * lighter than a weathered trunk, and that value break is what carries at
 * distance), and the taper is pulled in from 0.72 to 0.88 so the shape reads
 * as a cylinder rather than as a carrot.
 */
export function fallenLogGeometry(seed = 29): BufferGeometry {
  const rand = mulberry32(seed);
  const bark: BufferGeometry[] = [];
  const cuts: BufferGeometry[] = [];
  const length = 2.2 + rand() * 1.6;
  const radius = 0.19 + rand() * 0.09;
  const segments = 6;

  const twist = rand() * Math.PI * 2;
  const topRadius = radius * 0.88;
  const trunk = taperedCylinder(topRadius, radius, length, segments, rand, twist);
  layDown(trunk, radius);
  bark.push(trunk);

  for (const [r, y, up] of [
    [radius, 0, false],
    [topRadius, length, true],
  ] as Array<[number, number, boolean]>) {
    const cap = polyDisc(r, y, segments, twist, up);
    layDown(cap, radius);
    cuts.push(cap);
  }

  // One or two broken-off limbs, which is what tells the eye this is a
  // fallen tree rather than a length of pipe.
  const stubs = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < stubs; i++) {
    const stubTwist = rand() * Math.PI * 2;
    const stubLength = 0.4 + rand() * 0.3;
    const stubTop = radius * 0.24;
    const stubBottom = radius * 0.42;
    const swing = 0.7 + rand() * 1.4;
    const along = length * (0.2 + rand() * 0.6);
    const place = (geometry: BufferGeometry): void => {
      layDown(geometry, stubBottom);
      rotateY(geometry, swing);
      translateXZ(geometry, along, 0);
    };
    const stub = taperedCylinder(stubTop, stubBottom, stubLength, 4, rand, stubTwist);
    place(stub);
    bark.push(stub);
    const snap = polyDisc(stubTop, stubLength, 4, stubTwist, true);
    place(snap);
    cuts.push(snap);
  }

  const sides = mergeGeometries(bark);
  sides.computeVertexNormals();
  paintGradient(sides, 0x6e6a5c, 0xffffff, 0, radius * 2.1);

  const ends = mergeGeometries(cuts);
  ends.computeVertexNormals();
  // Sawn or snapped timber, well above the bark's own value. Painted flat
  // rather than graded: an end grain is one plane and a gradient across it
  // would only argue with the flat shading.
  paint(ends, 0xcbb289, 0.08, rand);

  const merged = mergeGeometries([sides, ends]);
  // Baked after the merge, not per part: the darkening worth having here is
  // in the armpit where a snapped limb leaves the trunk, and neither half of
  // that crease can see the other until the two buffers are one.
  bakeVertexAO(merged, { maxDist: 0.5, seed: 1029 });
  addSway(merged, 0, 1, 0);
  return merged;
}

export interface TreeOptions {
  trunkColor: number;
  canopyColor: number;
  seed?: number;
}

/**
 * A conifer: a tapered trunk under four stacked, offset cones.
 *
 * Stacked and *offset* matters. A single cone is a party hat; cones whose
 * axes disagree by a few degrees read as a tree that grew, and the cost is
 * one extra ring of triangles. The tiers overlap generously so the
 * silhouette is one continuous ragged triangle rather than a stack of
 * separate skirts — at eighty metres a gap between tiers reads as a
 * rendering error.
 */
export function coniferGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 11);
  const parts: BufferGeometry[] = [];
  const height = 4.8 + rand() * 2.4;
  const trunkH = height * 0.22;

  parts.push(paint(taperedCylinder(0.1, 0.21, trunkH * 1.4, 5, rand), options.trunkColor, 0.14, rand));

  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const radius = 1.5 * (1 - f * 0.68) * (0.9 + rand() * 0.2);
    const coneH = height * 0.36 * (1 - f * 0.24);
    const baseY = trunkH + f * height * 0.62;
    const cone = coneAt(radius, coneH, 7, baseY, rand);
    // Lean each tier slightly, in a different direction each time.
    const lean = 0.05 + rand() * 0.06;
    const leanAngle = rand() * Math.PI * 2;
    translateXZ(cone, Math.cos(leanAngle) * lean * (t + 1), Math.sin(leanAngle) * lean * (t + 1));
    parts.push(paint(cone, options.canopyColor, 0.16, rand));
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // The tiers overlap, so each skirt sits in the shade of the one above it.
  // That stack of soft dark rings is what stops four cones reading as one
  // smooth triangle when the tree is close enough to see the tiers at all.
  bakeVertexAO(merged, { maxDist: 1.0, seed: 1011 });
  addSway(merged, trunkH * 0.5, height, 0.45);
  return merged;
}

/**
 * A broadleaf: a forked trunk under three big overlapping domes and a crown.
 *
 * Three large domes, not the five small ones this used to have. Small blobs
 * give a busy outline that turns to mush the moment the tree is more than
 * twenty metres away; large ones keep a readable mushroom silhouette all
 * the way to the fog. Silhouette before detail, and at this distance
 * silhouette is *all* there is.
 */
export function broadleafGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 12);
  const parts: BufferGeometry[] = [];
  const height = 4.2 + rand() * 2.4;
  const trunkH = height * 0.42;

  parts.push(paint(taperedCylinder(0.13, 0.27, trunkH * 1.25, 5, rand), options.trunkColor, 0.14, rand));

  // No visible limbs. Two branches poking sideways out of the trunk under
  // the canopy read, at any distance, as legs — the tree came out looking
  // like a jellyfish. Real branches are inside the foliage where nobody
  // sees them, so the cheapest correct answer is not to build them.

  const lobes = 4;
  for (let b = 0; b < lobes; b++) {
    const a = (b / lobes) * Math.PI * 2 + rand() * 0.6;
    const spread = 0.75 + rand() * 0.4;
    const radius = 1.0 + rand() * 0.3;
    const lobe = lumpDome(radius, 7, 3, 0.85, 0.24, rand);
    translateY(lobe, trunkH + radius * 0.66 + rand() * 0.35);
    translateXZ(lobe, Math.cos(a) * spread, Math.sin(a) * spread);
    parts.push(paint(lobe, options.canopyColor, 0.18, rand));
  }
  const crown = lumpDome(1.1 + rand() * 0.28, 7, 3, 0.8, 0.2, rand);
  translateY(crown, trunkH + 1.5 + rand() * 0.35);
  parts.push(paint(crown, options.canopyColor, 0.14, rand));

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // The heaviest bake in the file — 660 vertices against 220 triangles — and
  // the one that pays best: four lobes and a crown all overlapping means the
  // canopy's *underside* comes back a good deal darker than its top, which is
  // the single cue that turns a cluster of domes into a tree with mass under
  // it. Measured at about 7 ms once per (biome, variant) and cached from then
  // on, which is the trade this budget was set to allow.
  bakeVertexAO(merged, { maxDist: 0.9, seed: 1012 });
  addSway(merged, trunkH * 0.4, height + 1, 0.6);
  return merged;
}

/**
 * A willow: a short trunk under a wide flat cap, with a curtain of fronds.
 *
 * Riverside's signature shape. The fronds are wide overlapping strips
 * rather than the thin sticks this used to hang — sixteen sticks read as a
 * parasol that has lost its fabric, whereas overlapping strips close into a
 * continuous skirt and give the tree the one silhouette in the world that
 * is wider at the bottom than the top.
 *
 * They also carry a much higher sway weight than anything else here, which
 * is the point: a willow that does not move looks dead, and it is the one
 * plant whose *motion* is its silhouette.
 */
export function willowGeometry(options: TreeOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 13);
  const parts: BufferGeometry[] = [];
  // Shorter than it was by about a metre. A pale wide canopy on a long clear
  // trunk, seen at sixty metres with daylight between the fronds, read
  // unmistakably as an elephant — a flat-topped body on four dangling legs.
  // Half of that fix is here: bring the crown down so the curtain starts
  // near the height of the surrounding scrub instead of standing clear above
  // it. The other half is the frond count below.
  const trunkH = 1.6 + rand() * 0.6;

  parts.push(paint(taperedCylinder(0.17, 0.33, trunkH, 5, rand), options.trunkColor, 0.14, rand));

  // A rounded cap, not the flat plate this had at first. At 0.5 flatten the
  // canopy read as a dinner plate balanced on a pole; a willow's crown is a
  // dome that the fronds fall off the edge of.
  // Narrower than the ring the fronds hang on, so the curtain falls from the
  // dome's *edge* rather than from somewhere inside it. Overhanging cap plus
  // gappy curtain is precisely the elephant: a wide pale body with legs
  // underneath.
  const cap = lumpDome(1.42 + rand() * 0.22, 7, 3, 0.74, 0.16, rand);
  translateY(cap, trunkH + 0.75);
  parts.push(paint(cap, options.canopyColor, 0.13, rand));

  // Two rings of them. One ring leaves gaps you can see the trunk through,
  // and a curtain with gaps in it is a set of separate hanging strips —
  // which is exactly what it looked like.
  //
  // Forty-eight, not twenty-two, and each half as wide. The arithmetic is
  // the whole argument: the outer ring is nine metres round, so eleven
  // strips 0.6 m wide left a quarter of a metre of daylight between each
  // pair — and at any distance over forty metres those gaps stop reading as
  // texture and start reading as *legs*. Twenty-four strips 0.35 m wide
  // close the curtain with a little overlap, which is what makes the shape
  // one continuous skirt rather than a set of straps. Ninety-six extra
  // triangles on a tree that appears a handful of times per band is not a
  // cost worth thinking about.
  const fronds = 48;
  for (let f = 0; f < fronds; f++) {
    const ring = f % 2;
    const a = (f / fronds) * Math.PI * 2 + rand() * 0.14;
    // The radius is nearly fixed per ring now. It used to wander by 0.45 m,
    // which sounds like pleasant variation and is in fact what opened the
    // gaps: strips at different radii no longer overlap their neighbours,
    // and the curtain came apart into separate straps.
    const r = (ring === 0 ? 1.5 : 1.0) + rand() * 0.12;
    // Hanging further, so the curtain finishes near the grass instead of
    // half a tree's height above it. A skirt that stops short is a valance.
    const drop = (ring === 0 ? 2.2 : 1.85) + rand() * 0.7;
    // Sized to the gap it has to fill, like the campfire's stones: twenty-
    // four strips round a ring of this radius sit about 0.4 m apart, so a
    // strip 0.53 m across overlaps its neighbours by a quarter and the ring
    // closes whichever way the tree is turned.
    const w = (ring === 0 ? 0.265 : 0.175) + rand() * 0.03;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sx = -Math.sin(a);
    const sz = Math.cos(a);
    const top = trunkH + (ring === 0 ? 0.85 : 1.15);
    // A tapering strip that also draws slightly inward as it falls, so the
    // curtain hangs rather than flaring out like a lampshade.
    // Drawn well inward as it falls. With the curtain closed and the strips
    // hanging vertically the tree stopped being an elephant and became a
    // grain silo — a flat-topped cylinder. A willow's skirt is a bell: widest
    // a third of the way down and gathering in toward the trunk at the hem.
    // The overlap survives the taper because the strips narrow more slowly
    // than the ring they sit on does.
    const tipX = x * 0.66;
    const tipZ = z * 0.66;
    const tlx = x + sx * w;
    const tlz = z + sz * w;
    const trx = x - sx * w;
    const trz = z - sz * w;
    // The taper stops at two thirds rather than a third. A strip that
    // narrows almost to a point leaves a triangle of daylight between it and
    // its neighbour for the whole lower half of the curtain, which is the
    // part of the tree nearest the ground and so the part that decides
    // whether it has a skirt or legs.
    const blx = tipX + sx * w * 0.66;
    const blz = tipZ + sz * w * 0.66;
    const brx = tipX - sx * w * 0.66;
    const brz = tipZ - sz * w * 0.66;
    parts.push(
      paint(
        fromPositions([
          tlx, top, tlz, blx, top - drop, blz, trx, top, trz,
          trx, top, trz, blx, top - drop, blz, brx, top - drop, brz,
        ]),
        options.canopyColor,
        0.12,
        rand,
      ),
    );
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // Baked before the sway work below, because the sway pass rewrites `aSway`
  // in place and never touches `color` — the two are independent and the
  // order only matters for the reader.
  //
  // The curtain is where this lands: forty-eight strips overlapping their
  // neighbours by a quarter, so every strip is partly behind another one and
  // the skirt gains the depth it has been faking with a flat colour.
  bakeVertexAO(merged, { maxDist: 0.8, seed: 1013 });
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

// --- the road surface --------------------------------------------------

/**
 * A few small stones, half-buried, spread over about half a metre.
 *
 * One instance is a *scatter* of stones rather than a single pebble, and
 * that is the whole economy of it. The carriageway is the surface nearest
 * the camera at every moment of the game, so it is also the easiest place
 * in the world to spend a phone's whole triangle budget on things a metre
 * across. Three stones in one instance costs one matrix and thirty
 * triangles where three instances would cost three matrices for the same
 * picture — and a scatter placed as a scatter clusters the way loose stone
 * actually lies, instead of speckling evenly like a texture.
 *
 * Six segments and one ring, which is twelve triangles per stone. A pebble
 * is never more than a few pixels across; what it has to do is catch a
 * slightly different band of the light than the packed earth around it, and
 * for that any faceted lump will do.
 *
 * The proportions are the part that took two goes. At `flatten` 0.5 a
 * one-ring dome is a bipyramid as tall as it is wide, and a scatter of
 * five-sided bipyramids on a road does not read as stones at all — it reads
 * as a row of little tents, or caltrops. A stone lying on a track is three
 * or four times wider than it is high, and it is bedded in, so the flatten
 * comes down to a third and the whole shape is then lifted until its lower
 * apex is under the ground and only the cap shows.
 */
export function pebbleGeometry(seed = 41): BufferGeometry {
  const rand = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const count = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.05 + rand() * 0.07;
    const stone = lumpDome(r, 6, 1, 0.3, 0.3, rand);
    translateY(stone, r * 0.26);
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.3;
    translateXZ(stone, Math.cos(a) * d, Math.sin(a) * d);
    parts.push(stone);
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // A shallow gradient over the few centimetres the stone actually occupies.
  // Painted over a taller span the whole pebble came out at the dark end and
  // a gravelled verge read as a scatter of holes.
  paintGradient(merged, 0x968f84, 0xffffff, -0.01, 0.07);
  // Centimetres, not metres: the stones in a scatter are a hand's width
  // apart, and at the file's default reach every stone would shade every
  // other one and the whole patch would come back uniformly grey.
  bakeVertexAO(merged, { maxDist: 0.14, seed: 1041 });
  addSway(merged, 0, 1, 0);
  return merged;
}

/**
 * A shallow puddle, sat in the wheel rut.
 *
 * An ellipse, not a circle: a perfect disc laid flat on the ground reads as
 * a coin dropped on the road, and the long axis is what tells the eye this
 * particular pool of water followed the shape of the rut it collected in.
 * Nine or fewer irregular sides keep it from reading as a stamped-out
 * primitive the way a real circle would.
 *
 * Sits a hair above the terrain rather than on it, for the same reason as
 * `pebbleGeometry` — the ground under it is not perfectly flat, and a puddle
 * pinned exactly to one sampled height would clip through a slope at its own
 * edges. Windless and flat-shaded: nothing about still water sways.
 */
export function puddleGeometry(seed = 71): BufferGeometry {
  const rand = mulberry32(seed);
  const sides = 7 + Math.floor(rand() * 3);
  const rx = 0.45 + rand() * 0.35;
  const rz = 0.22 + rand() * 0.14;
  const y = 0.012;
  const ring: Array<[number, number]> = [];
  for (let s = 0; s < sides; s++) {
    const a = (s / sides) * Math.PI * 2;
    const wobble = 1 + (rand() - 0.5) * 0.3;
    ring.push([Math.cos(a) * rx * wobble, Math.sin(a) * rz * wobble]);
  }
  const verts: number[] = [];
  for (let s = 0; s < sides; s++) {
    const [x0, z0] = ring[s];
    const [x1, z1] = ring[(s + 1) % sides];
    // Wound (centre, ring[s+1], ring[s]) rather than the more obvious
    // (centre, ring[s], ring[s+1]): with the ring built at increasing angle
    // in the XZ plane, that order is the one whose face normal works out to
    // +Y. `solidMaterial` is front-face-only, and the camera only ever
    // looks down at this surface, so the wrong order would render an
    // invisible puddle rather than a visible one.
    verts.push(0, y, 0, x1, y, z1, x0, y, z0);
  }
  const geometry = fromPositions(verts);
  geometry.computeVertexNormals();
  /*
   * Bright at the middle, dark at the rim, rather than a flat fill.
   *
   * The fill version read as a plate laid on the road: a hard pale edge all
   * the way round, which is the one thing standing water does not have. A
   * real puddle is deep enough to mirror the sky in the middle and shallow
   * enough at the edge that you are looking at wet earth through a film, so
   * the edge is the earth's value and the transition is where the water gets
   * thin. Every triangle here is (centre, ring, ring), so darkening the two
   * ring vertices gives exactly that gradient for the cost of writing the
   * colours directly instead of calling `paint`.
   *
   * The per-face wobble `paint` was doing is kept — a dead-uniform surface on
   * a shape this simple reads as a sticker — and applied to both ends of the
   * gradient so a facet stays one facet.
   */
  const count = (geometry.attributes.position as BufferAttribute).count;
  const colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v += 3) {
    const wobble = 1 + (rand() - 0.5) * 0.08;
    for (let k = 0; k < 3; k++) {
      // k === 0 is the fan's centre vertex; the other two are on the rim.
      const shade = (k === 0 ? 1 : 0.6) * wobble;
      const i = (v + k) * 3;
      colors[i] = shade;
      colors[i + 1] = shade;
      colors[i + 2] = shade;
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  addSway(geometry, 0, 1, 0);
  return geometry;
}

// --- landmarks ---------------------------------------------------------

export interface LandmarkOptions {
  /** Dressed or weathered stone: walls, menhirs, lintels. */
  stone: number;
  /** The one part allowed to dissent — a tiled roof, a mossed capstone. */
  roof: number;
  seed?: number;
}

/**
 * A standing stone with two or three companions.
 *
 * Everything about this shape is aimed at one job: being recognisable as a
 * made thing when it is a dark mark eighty metres away on a ridge. So it is
 * a single vertical far taller than anything else on that skyline, leaning
 * a few degrees off true — a perfectly upright slab reads as a rendering
 * primitive, and the lean is the cheapest available signal that somebody
 * put it there a long time ago and the ground has moved since.
 *
 * The companions are not decoration. One vertical alone is ambiguous at
 * distance (a dead tree, a post); a tall one with low ones around it is
 * unmistakably a group, and a group is a place.
 */
export function standingStoneGeometry(options: LandmarkOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 101);
  const parts: BufferGeometry[] = [];

  const raise = (height: number, width: number, lean: number): BufferGeometry => {
    const slab = taperedCylinder(width * (0.55 + rand() * 0.2), width, height, 5, rand);
    // Flattened in Z so the pentagon becomes a slab. A stone with a round
    // plan reads as a pillar, which is architecture; a slab reads as
    // something split off a hillside, which is what a menhir is.
    scaleXZ(slab, 1, 0.42 + rand() * 0.14);
    shearX(slab, lean);
    rotateY(slab, rand() * Math.PI * 2);
    return slab;
  };

  const height = 5.0 + rand() * 2.6;
  parts.push(paint(raise(height, 0.62 + rand() * 0.26, (rand() - 0.5) * 0.17), options.stone, 0.13, rand));

  const companions = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < companions; i++) {
    const a = (i / companions) * Math.PI * 2 + rand() * 1.2;
    const d = 2.4 + rand() * 1.9;
    const stone = raise(1.3 + rand() * 1.5, 0.42 + rand() * 0.2, (rand() - 0.5) * 0.3);
    translateXZ(stone, Math.cos(a) * d, Math.sin(a) * d);
    parts.push(paint(stone, options.stone, 0.15, rand));
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // Reaches further than the shrub's because the shapes are metres apart
  // rather than centimetres: a companion standing close to the great stone
  // should pick up a little of its shade at the base and nothing higher.
  bakeVertexAO(merged, { maxDist: 1.4, seed: 1101 });
  addSway(merged, 0, 1, 0);
  return merged;
}

/**
 * A trilithon: two uprights carrying a lintel, with a hole of sky through
 * the middle.
 *
 * The hole is the entire point and the only reason this exists alongside the
 * standing stone. Every other silhouette in this game is solid, so the eye
 * has never once been asked to read *through* something — and a gap of bright
 * sky enclosed by dark stone is the most legible shape available at any
 * distance, which is why real gateways have looked like this for five
 * thousand years.
 */
export function trilithonGeometry(options: LandmarkOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 103);
  const parts: BufferGeometry[] = [];
  const height = 4.1 + rand() * 1.5;
  const gap = 1.5 + rand() * 0.7;
  const pierW = 0.72 + rand() * 0.24;
  const depth = 0.66 + rand() * 0.2;

  for (const side of [-1, 1]) {
    // The two uprights differ in height by up to a third of a metre, and the
    // lintel sits on the lower of them. Matched piers read as a goalpost.
    const h = height * (side < 0 ? 1 : 0.94 + rand() * 0.1);
    const pier = box(pierW, h, depth);
    shearX(pier, (rand() - 0.5) * 0.06);
    translateXZ(pier, side * (gap * 0.5 + pierW * 0.5), 0);
    parts.push(paint(pier, options.stone, 0.12, rand));
  }

  const span = gap + pierW * 2.1;
  const lintel = box(span, 0.62 + rand() * 0.18, depth * 1.12);
  translateY(lintel, height * 0.9);
  parts.push(paint(lintel, options.roof, 0.1, rand));

  // A block that came down at some point, lying where it fell.
  const fallen = box(1.1 + rand() * 0.5, 0.42, depth);
  rotateY(fallen, rand() * Math.PI);
  translateXZ(fallen, (rand() - 0.5) * 1.4, gap * 0.9 + rand() * 1.4);
  parts.push(paint(fallen, options.stone, 0.14, rand));

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // The seat of the lintel on each pier is the one joint on this shape, and
  // it is the joint that says the thing was *built*. A shadow line under the
  // lintel is worth more here than anywhere else in the file.
  bakeVertexAO(merged, { maxDist: 1.4, seed: 1103 });
  addSway(merged, 0, 1, 0);
  return merged;
}

/**
 * A wayside chapel: a small nave under a pitched roof, with a bell gable at
 * the west end.
 *
 * This is the one landmark that is unambiguously *inhabited*, which is why
 * the village band leans on it. The bell gable does all the identifying
 * work — a box under a pitched roof is a barn, and it is the narrow tower
 * breaking the ridge line at one end that says somebody comes here.
 *
 * The roof is the only part painted from the biome's accent rather than its
 * stone. One dissenting colour in a silhouette is enough to tell the eye
 * this is not another rock, and it lands in the frame the same way the
 * bard's cloak does.
 */
export function chapelGeometry(options: LandmarkOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 107);
  const parts: BufferGeometry[] = [];

  const length = 4.8 + rand() * 1.4;
  const width = 3.1 + rand() * 0.6;
  const wallH = 2.7 + rand() * 0.5;
  const rise = 1.5 + rand() * 0.5;

  parts.push(paint(box(length, wallH, width), options.stone, 0.09, rand));
  // The eaves overhang by a little. Flush walls and roof read as one solid
  // block; the overhang is what puts a line of shadow under the roof and
  // separates the two.
  parts.push(paint(gableRoof(length * 1.06, width * 0.58, rise, wallH), options.roof, 0.1, rand));

  const towerW = 1.05 + rand() * 0.2;
  const towerH = wallH + rise + 1.5 + rand() * 0.8;
  const tower = box(towerW, towerH, towerW);
  translateXZ(tower, -(length * 0.5 - towerW * 0.4), 0);
  parts.push(paint(tower, options.stone, 0.09, rand));

  const cap = pyramid(towerW * 0.62, 0.95 + rand() * 0.35, towerH);
  translateXZ(cap, -(length * 0.5 - towerW * 0.4), 0);
  parts.push(paint(cap, options.roof, 0.1, rand));

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // The eaves overhang exists to put a line of shadow under the roof (see the
  // note where it is built) and until now that line only appeared when the
  // sun happened to be in the right quarter. Baked, it is always there — and
  // so is the crease where the tower meets the nave.
  bakeVertexAO(merged, { maxDist: 1.6, seed: 1107 });
  addSway(merged, 0, 1, 0);
  return merged;
}

// --- stop dressing -----------------------------------------------------

/*
 * Dressing that announces a stop from down the road.
 *
 * DESIGN.md v0.8 item 7: "A stop should announce itself down the road before
 * you reach it ... so walking toward something is anticipation, not surprise."
 * Everything in this section is therefore designed backwards from a single
 * viewing condition — **a hundred and twenty metres of road, at a 42-degree
 * vertical field of view** — rather than from how it looks in a turntable.
 *
 * Two numbers fall out of that and they set every dimension below. One pixel
 * of a 900-line frame is 0.098 m at that range, so anything under about a
 * third of a metre does not exist; and the horizon sits at the walking
 * camera's own eye height, about 2.2 m, so anything shorter than that is read
 * against ground and anything taller is read against sky. A marker meant to
 * be seen from far away has to cross that line — which is why the busk pole
 * is 3.6 m and the wayside marker is 1.95 m and neither is a round number.
 *
 * The kinds are deliberately unlike each other in silhouette *and* in
 * loudness, because they are announcing different promises: a busk pitch is a
 * stage and gets a banner and a lit lantern, an encounter is a meeting and
 * gets a cool stone that barely clears the eye line, and the camp gets no
 * object at all — only its smoke, which is the one thing here that can be
 * read from four hundred metres.
 */

export interface StopMarkerOptions {
  /** Post, crates, barrel: the worked wood of a pitch somebody plays at. */
  timber: number;
  /** The one dissenting colour, the banner cloth. */
  cloth: number;
  /** Fittings: the crossbar, the lantern's frame, the barrel's hoops. */
  iron: number;
  seed?: number;
}

/**
 * The busk pole's height.
 *
 * **This was 3.6 m and 3.6 m did not work, and the reason is the one thing
 * the eye-line arithmetic above leaves out: the road goes downhill.** Shot at
 * 120 m on today's road, the stop sat 7.1 m below the camera — a 3.2 degree
 * drop, which puts the marker's whole 33 pixels seventy pixels *under* the
 * horizon, against hazed field rather than against sky. It was not faint. It
 * was not there.
 *
 * A stop is where the day's seed put it and cannot be moved onto a brow the
 * way a landmark can (see `findCrest`), so the only levers left are size and
 * contrast. 5.4 m is what the frame asked for: it is fairground scale rather
 * than fencepost scale, which is what a banner pole at a pitch actually is,
 * and it puts fifty pixels of pole and twenty-four of banner into the frame
 * at the range this exists for.
 */
export const BUSK_POLE_HEIGHT_M = 5.4;
const BUSK_BAR_Y = 5.05;
const BUSK_BANNER_X = -0.42;
const BUSK_BANNER_TOP_Y = 5.0;
const BUSK_BANNER_H = 2.6;
/**
 * Where the lantern hangs, in the pole's own frame.
 *
 * Exported so `lanternGlowGeometry` and the pitch agree without either owning
 * the other: the glow is a *separate mesh* because it is the only thing in
 * this world lit from inside, and a second material is the cheapest way to
 * say that. Baking the anchor into both geometries means the two meshes share
 * one transform and cannot drift apart.
 */
export const BUSK_LANTERN_X = 0.68;
export const BUSK_LANTERN_Y = 4.35;
/**
 * The lit glass, as a radius.
 *
 * 0.19 m puts about four pixels of warm light on the screen at 120 m. That
 * sounds like nothing and is in fact the entire signal — at dusk it is the
 * only warm mark in a cool frame, and the eye finds a warm dot on a blue road
 * long before it resolves what is holding it up. Bigger and a roadside
 * lantern starts reading as a bonfire, which would break the rule that the
 * warmest light in the frame belongs to the music or the fire.
 */
export const BUSK_LANTERN_R = 0.26;

/**
 * A busking pitch: a banner pole with a lantern on its crossbar, and the
 * crates and barrel of somewhere people put their things down.
 *
 * The crates are not filler. A bare pole beside a road is a boundary marker;
 * a pole with things stacked at its foot is a place someone *uses*, and the
 * difference costs six boxes. They also give the base of the pole a mass to
 * sit on, so the silhouette is a shape rather than a line.
 */
export function buskPitchGeometry(options: StopMarkerOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 211);
  const parts: BufferGeometry[] = [];

  const poleTwist = rand() * Math.PI * 2;
  parts.push(
    paint(taperedCylinder(0.07, 0.115, BUSK_POLE_HEIGHT_M, 6, rand, poleTwist), options.timber, 0.1, rand),
  );
  parts.push(paint(polyDisc(0.07, BUSK_POLE_HEIGHT_M, 6, poleTwist, true), options.timber, 0, rand));

  const bar = box(1.42, 0.09, 0.1);
  translateY(bar, BUSK_BAR_Y);
  translateXZ(bar, (BUSK_BANNER_X + BUSK_LANTERN_X) * 0.5, 0);
  parts.push(paint(bar, options.iron, 0.08, rand));

  // A thin prism rather than a plane: the banner has to read from both ends
  // of the road, and a single quad is invisible from behind.
  const banner = box(0.86, BUSK_BANNER_H, 0.06);
  translateY(banner, BUSK_BANNER_TOP_Y - BUSK_BANNER_H);
  translateXZ(banner, BUSK_BANNER_X, 0);
  parts.push(paint(banner, options.cloth, 0.16, rand));

  const hangerH = BUSK_BAR_Y - (BUSK_LANTERN_Y + BUSK_LANTERN_R * 1.15);
  const hanger = box(0.035, hangerH, 0.035);
  translateY(hanger, BUSK_LANTERN_Y + BUSK_LANTERN_R * 1.15);
  translateXZ(hanger, BUSK_LANTERN_X, 0);
  parts.push(paint(hanger, options.iron, 0.05, rand));

  const cap = pyramid(0.2, 0.16, BUSK_LANTERN_Y + BUSK_LANTERN_R * 0.9);
  translateXZ(cap, BUSK_LANTERN_X, 0);
  parts.push(paint(cap, options.iron, 0.06, rand));

  const foot = box(0.26, 0.06, 0.26);
  translateY(foot, BUSK_LANTERN_Y - BUSK_LANTERN_R * 1.4);
  translateXZ(foot, BUSK_LANTERN_X, 0);
  parts.push(paint(foot, options.iron, 0.06, rand));

  const crate = box(0.66, 0.5, 0.5);
  rotateY(crate, 0.3 + rand() * 0.5);
  translateXZ(crate, -1.02, 0.44);
  parts.push(paint(crate, options.timber, 0.13, rand));

  const stacked = box(0.42, 0.34, 0.4);
  rotateY(stacked, -0.7 + rand() * 0.5);
  translateY(stacked, 0.5);
  translateXZ(stacked, -0.92, 0.3);
  parts.push(paint(stacked, options.timber, 0.13, rand));

  const barrelTwist = rand() * Math.PI * 2;
  const barrel = taperedCylinder(0.21, 0.25, 0.76, 8, rand, barrelTwist);
  translateXZ(barrel, 0.88, -0.55);
  parts.push(paint(barrel, options.timber, 0.11, rand));
  const lid = polyDisc(0.21, 0.76, 8, barrelTwist, true);
  translateXZ(lid, 0.88, -0.55);
  parts.push(paint(lid, options.iron, 0.06, rand));

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, 1, 0);
  return merged;
}

/**
 * The lantern's lit glass, already sitting at its anchor on the pole.
 *
 * A squat octahedron — eight triangles — because the shape is irrelevant at
 * the range this exists for and what matters is that it is *closed and
 * correctly wound*: it is drawn with an emissive material, and a face turned
 * inside out is a face that gets culled, which would put a hole in the one
 * warm mark in the frame.
 */
export function lanternGlowGeometry(): BufferGeometry {
  const r = BUSK_LANTERN_R;
  const top = BUSK_LANTERN_Y + r * 1.15;
  const bottom = BUSK_LANTERN_Y - r * 1.15;
  const ring: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ring.push([BUSK_LANTERN_X + Math.cos(a) * r, BUSK_LANTERN_Y, Math.sin(a) * r]);
  }
  const verts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % 4];
    // (p1, p0, apex) is the winding whose normal points out and up; (p0, p1,
    // apex) is its mirror and points down. Same lesson as `polyDisc`.
    verts.push(...p1, ...p0, BUSK_LANTERN_X, top, 0);
    verts.push(...p0, ...p1, BUSK_LANTERN_X, bottom, 0);
  }
  const geometry = fromPositions(verts);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The wayside marker's height.
 *
 * The smallest mark that can still be *resolved* from a hundred metres, which
 * is a lower bar than the busk pole's and a much higher one than "waist
 * high". 1.95 m was tried first, on the reasoning that just clearing a
 * walker's eye line was enough; it is not, for the same reason the pole's own
 * note records — the road falls away, so the marker is read against hazed
 * field and not against sky, and at that range twenty pixels of grey stone on
 * grey-green field is nothing at all.
 *
 * 2.9 m is a wayside menhir rather than a milestone, and it keeps the ladder
 * the two kinds are supposed to make: a little over half the busk pole, no
 * banner, no light, no colour that dissents from the rock it is cut from. An
 * encounter is somebody you meet, not a stage.
 */
export const CAIRN_MARKER_HEIGHT_M = 2.9;

/**
 * A wayside cairn under a leaning marker slab.
 *
 * Boxes throughout, and that is not laziness: a stack of open cylinders is
 * open at the top, and this is looked *down* on from a camera 2.2 m up on the
 * road beside it, so the one shape whose interior would show is exactly the
 * one a walker sees. `box` is closed on all six faces and a stack of flat
 * rotated slabs is what a cairn is anyway.
 */
export function waysideCairnGeometry(options: LandmarkOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 223);
  const parts: BufferGeometry[] = [];

  const layers = 4 + Math.floor(rand() * 2);
  let y = 0;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const w = 0.52 * (1 - t * 0.55);
    const stone = box(w, 0.12 + rand() * 0.07, w * (0.72 + rand() * 0.25));
    rotateY(stone, rand() * Math.PI);
    translateY(stone, y);
    translateXZ(stone, (rand() - 0.5) * 0.07, (rand() - 0.5) * 0.07);
    // The top stone takes the dissenting colour — moss, on the one face of
    // this that has been open to the weather longest.
    parts.push(paint(stone, i === layers - 1 ? options.roof : options.stone, 0.13, rand));
    y += 0.115 + rand() * 0.06;
  }

  /*
   * The marker is a tapered pentagon flattened into a slab, not a box.
   *
   * A box was tried and the frame called it: at twelve metres a square prism
   * with a pyramid on top reads as a *chimney*, because right angles and a
   * constant cross-section are what building materials have and split rock
   * does not. Tapering it and squashing the plan is the whole difference, and
   * it is the same treatment `standingStoneGeometry` gives its menhirs.
   *
   * The cap disc is not decoration either — this is 2.9 m of stone looked
   * down on from a camera 2.2 m up, so the open top of a tube is exactly what
   * a walker beside it would see through.
   */
  const lean = 0.05 + rand() * 0.05;
  const turn = 0.2 + rand() * 0.6;
  const twist = rand() * Math.PI * 2;
  const topR = 0.17 + rand() * 0.04;
  const botR = 0.27 + rand() * 0.05;
  const place = (piece: BufferGeometry): BufferGeometry => {
    scaleXZ(piece, 1.25, 0.62);
    shearX(piece, lean);
    rotateY(piece, turn);
    translateXZ(piece, 0.46, -0.18);
    return piece;
  };
  parts.push(
    paint(
      place(taperedCylinder(topR, botR, CAIRN_MARKER_HEIGHT_M, 5, rand, twist)),
      options.stone,
      0.11,
      rand,
    ),
  );
  parts.push(
    paint(place(polyDisc(topR, CAIRN_MARKER_HEIGHT_M, 5, twist, true)), options.roof, 0.07, rand),
  );

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  // A cairn *is* a pile of contact shadows — five slabs stacked with their
  // edges a few centimetres apart. Half a metre of reach keeps each stone
  // shading only the one it sits on rather than the whole heap.
  bakeVertexAO(merged, { maxDist: 0.5, seed: 1223 });
  addSway(merged, 0, 1, 0);
  return merged;
}

export interface SmokeColumnOptions {
  /** Colour at the fire's mouth, where the plume is dense and fire-lit. */
  base: number;
  /** Colour where it gives out into the sky. */
  tip: number;
  height?: number;
  /** Which way the plume leans off vertical, radians in the XZ plane. */
  lean?: number;
  seed?: number;
}

/**
 * How high the plume climbs, and how many puffs it climbs in.
 *
 * Eleven metres is the number that makes the camp legible from four hundred
 * metres away — the chunk streamer's whole reach — because at that range the
 * camp itself is two pixels of ground and its smoke is a mark a hundred
 * pixels tall standing on the horizon. It is also the height at which the
 * plume stops competing: at dusk the top of it sits high in the frame, in the
 * empty part of the sky, rather than across the road it is announcing.
 */
export const SMOKE_HEIGHT_M = 11;
/**
 * Fourteen, and every one of them a different shape.
 *
 * Nine was enough at a hundred and twenty metres and not at thirty: shot on
 * the approach to camp, the plume came back visibly *beaded* — a stack of
 * separate hexagons with their edges showing. Twelve fixed the beading and
 * introduced the failure that replaced it: at four metres, in the campfire
 * frame, the column read as a tower of stacked translucent plates, because
 * every puff was the same regular octagon on the same axis and each one's
 * edge lay parallel to the one below. More puffs cannot fix that; only
 * breaking their agreement can, which is what the jitter below is for.
 */
export const SMOKE_PUFFS = 14;
/**
 * Sides per puff. Seven, not eight: an odd polygon has no two parallel
 * edges, so the two crossed planes of a puff cannot line up with each other
 * and the puff above cannot line up with the puff below.
 */
const SMOKE_PUFF_SIDES = 7;

/**
 * How much of the caller's colour actually reaches the plume.
 *
 * The caller owns the smoke's **hue** — a forest plume and a riverside plume
 * borrow their own band's tones — and this module owns its **value**, because
 * value is the whole of whether a thing reads as smoke. Shot at night against
 * a deep violet sky, near-white puffs at 0.36 opacity came back as the
 * second-brightest mass in the frame: a pale column dividing the composition,
 * lighter than the sky it was drawn over and lighter than everything but the
 * fire. Real smoke at night is a hole in the stars. Scaled to a little over a
 * third, each layer now *darkens* the sky it composites over at dusk and
 * night, and is still a legible pale smudge against a bright daytime sky —
 * which is the one direction the telegraph has to survive in both.
 */
const SMOKE_VALUE = 0.38;

/**
 * A smoke column, as a stack of crossed polygonal puffs.
 *
 * Four decisions, and the last two are what make it read as a wisp rather
 * than as a monument.
 *
 * **Crossed planes, not billboards.** A billboard has to be turned toward the
 * camera every frame by something that knows where the camera is, and nothing
 * in the world streamer does. Two polygons at right angles give a shape with
 * no silhouette worth speaking of from any horizontal direction, which is all
 * a plume needs — and it costs nothing per frame.
 *
 * **The plume breaks up as it climbs.** The puffs grow *and* their spacing
 * grows, so the bottom of the column is a rope and the top is separated blobs
 * with sky between them. That is the only fade available: the painterly
 * shader carries one opacity for a whole material and no per-vertex alpha, so
 * a continuous tapering ribbon would end in a hard flat edge eleven metres up.
 * Dissolving it *geometrically* costs a few triangles and needs no shader.
 *
 * **It swells and then gives out.** The width used to climb monotonically to
 * its widest at the very top, which draws a wedge — the exact silhouette of a
 * thing getting stronger as it leaves. Smoke does the opposite: it opens out
 * where the heat runs out and then thins to nothing. So the profile peaks
 * around three quarters of the way up and tapers above it, and the whole
 * column is under half the girth it was, because a camp fire makes a thread
 * of smoke and not a cooling tower.
 *
 * **No two puffs agree.** Each puff gets its own rotation, its own vertical
 * squash, and a per-vertex radial jitter, so no edge is parallel to any other
 * edge in the column. Without this the stack is a diagram of smoke: regular
 * polygons, coincident axes, and every silhouette repeating the one below it.
 * The lateral wander starts low and grows nearly linearly, so the plume leans
 * off its own root from the first puff instead of standing straight up a
 * third of its height and then bending.
 *
 * **Every face is doubled and reversed.** The material is front-faced, so of
 * each coincident pair exactly one passes the winding test from any viewpoint
 * — which means the puff is lit as though facing the viewer wherever the
 * viewer stands, and no `DoubleSide` flag (which would light the back faces
 * by the front's normals) is needed.
 */
export function smokeColumnGeometry(options: SmokeColumnOptions): BufferGeometry {
  const rand = mulberry32(options.seed ?? 233);
  const height = options.height ?? SMOKE_HEIGHT_M;
  const lean = options.lean ?? rand() * Math.PI * 2;
  const lx = Math.cos(lean);
  const lz = Math.sin(lean);

  const verts: number[] = [];
  const baseY = 0.85;
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const t = i / (SMOKE_PUFFS - 1);
    // Linear near the fire, quadratic above it: smoke leaves the flame as a
    // rope and only opens out once it has lost the heat driving it.
    const y = baseY + (height - baseY) * (t * 0.42 + t * t * 0.58);
    // Swell, then give out. The cubic term is what takes the top back in.
    const halfW = 0.15 + 1.42 * Math.pow(t, 0.6) * (1 - 0.46 * t * t * t);
    const halfH = halfW * (0.86 - 0.26 * t);
    // Nearly linear, so the column is off its own axis from the bottom.
    const drift = height * 0.3 * Math.pow(t, 1.15);
    const cx = lx * drift + (rand() - 0.5) * halfW * 0.9;
    const cz = lz * drift + (rand() - 0.5) * halfW * 0.9;
    // One rotation and one squash per puff, shared by both of its planes so
    // the pair still reads as one blob rather than as two.
    const spin = rand() * Math.PI * 2;
    const squash = 0.78 + rand() * 0.5;
    // A radius per corner, reused by both planes for the same reason.
    // Floored at 0.68 rather than 0.6: a corner drawn much shorter than its
    // neighbours pulls the puff's vertical reach below the step to the next
    // one, and the column beads — which at a hundred and twenty metres is the
    // stacked-plates failure again, smaller.
    const jitter: number[] = [];
    for (let k = 0; k < SMOKE_PUFF_SIDES; k++) jitter.push(0.68 + rand() * 0.62);
    puffPlane(verts, cx, y, cz, halfW, halfH * squash, spin, jitter, false);
    puffPlane(verts, cx, y, cz, halfW, halfH * squash, spin, jitter, true);
  }

  const geometry = fromPositions(verts);
  paintGradient(
    geometry,
    scaleHex(options.base, SMOKE_VALUE),
    scaleHex(options.tip, SMOKE_VALUE),
    baseY,
    height,
  );
  geometry.computeVertexNormals();
  // Rooted at the fire and loose at the top, so the world's own wind bends
  // the plume over instead of sliding the whole column sideways.
  addSway(geometry, baseY, height, 1);
  return geometry;
}

/** Multiply a packed hex colour's value, channel by channel. */
function scaleHex(hex: number, scale: number): number {
  const r = Math.round(Math.min(255, ((hex >> 16) & 0xff) * scale));
  const g = Math.round(Math.min(255, ((hex >> 8) & 0xff) * scale));
  const b = Math.round(Math.min(255, (hex & 0xff) * scale));
  return (r << 16) | (g << 8) | b;
}

/** One puff face and its mirror, in the XY or the ZY plane. */
function puffPlane(
  out: number[],
  cx: number,
  cy: number,
  cz: number,
  halfW: number,
  halfH: number,
  spin: number,
  jitter: readonly number[],
  acrossZ: boolean,
): void {
  const n = SMOKE_PUFF_SIDES;
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + spin;
    const px = Math.cos(a) * halfW * jitter[i];
    const py = Math.sin(a) * halfH * jitter[i];
    pts.push(acrossZ ? [cx, cy + py, cz + px] : [cx + px, cy + py, cz]);
  }
  for (let i = 1; i < n - 1; i++) {
    out.push(...pts[0], ...pts[i], ...pts[i + 1]);
    out.push(...pts[0], ...pts[i + 1], ...pts[i]);
  }
}

// --- primitives --------------------------------------------------------

/**
 * An axis-aligned box, base on y = 0, centred in X and Z.
 *
 * Written out rather than taken from three's BoxGeometry because that one
 * arrives indexed and centred on its own origin, and both would have to be
 * undone before it could be merged with anything else here.
 */
function box(w: number, h: number, d: number): BufferGeometry {
  const x = w * 0.5;
  const z = d * 0.5;
  const quad = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
  ): number[] => [ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz];

  return fromPositions([
    ...quad(x, 0, z, x, 0, -z, x, h, -z, x, h, z),
    ...quad(-x, 0, -z, -x, 0, z, -x, h, z, -x, h, -z),
    ...quad(-x, 0, z, x, 0, z, x, h, z, -x, h, z),
    ...quad(x, 0, -z, -x, 0, -z, -x, h, -z, x, h, -z),
    ...quad(-x, h, -z, -x, h, z, x, h, z, x, h, -z),
    ...quad(-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z),
  ]);
}

/** A gable roof: ridge along X, eaves at ±halfWidth, springing from `baseY`. */
function gableRoof(length: number, halfWidth: number, rise: number, baseY: number): BufferGeometry {
  const l = length * 0.5;
  const top = baseY + rise;
  return fromPositions([
    // the two slopes
    -l, baseY, halfWidth, l, baseY, halfWidth, l, top, 0,
    -l, baseY, halfWidth, l, top, 0, -l, top, 0,
    l, baseY, -halfWidth, -l, baseY, -halfWidth, -l, top, 0,
    l, baseY, -halfWidth, -l, top, 0, l, top, 0,
    // the gable ends
    l, baseY, halfWidth, l, baseY, -halfWidth, l, top, 0,
    -l, baseY, -halfWidth, -l, baseY, halfWidth, -l, top, 0,
  ]);
}

/** A square pyramid, base at `baseY`, apex `height` above it. */
function pyramid(halfWidth: number, height: number, baseY: number): BufferGeometry {
  const w = halfWidth;
  const top = baseY + height;
  return fromPositions([
    -w, baseY, w, w, baseY, w, 0, top, 0,
    w, baseY, w, w, baseY, -w, 0, top, 0,
    w, baseY, -w, -w, baseY, -w, 0, top, 0,
    -w, baseY, -w, -w, baseY, w, 0, top, 0,
  ]);
}

function taperedCylinder(
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments: number,
  rand: Rand,
  fixedTwist?: number,
): BufferGeometry {
  const verts: number[] = [];
  // A per-instance twist so two trunks built from the same call do not line
  // their facets up when they happen to stand next to each other. Passed in
  // by the one caller that has to build a matching end cap.
  const twist = fixedTwist ?? rand() * Math.PI * 2;
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
    verts.push(b0x, 0, b0z, t0x, height, t0z, b1x, 0, b1z);
    verts.push(b1x, 0, b1z, t0x, height, t0z, t1x, height, t1z);
  }
  return fromPositions(verts);
}

/**
 * A flat polygonal disc in the XZ plane, wound to face up or down.
 *
 * Built to line up with `taperedCylinder`'s facets, which is why both take
 * the same twist: a cap whose corners miss the tube's corners leaves a
 * hairline of background showing at every seam.
 */
function polyDisc(
  radius: number,
  y: number,
  segments: number,
  twist: number,
  up: boolean,
): BufferGeometry {
  const verts: number[] = [];
  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2 + twist;
    const a1 = ((s + 1) / segments) * Math.PI * 2 + twist;
    const p0 = [Math.cos(a0) * radius, y, Math.sin(a0) * radius];
    const p1 = [Math.cos(a1) * radius, y, Math.sin(a1) * radius];
    // (centre, p1, p0) is the order whose face normal works out to +Y; see
    // the same note in `puddleGeometry`.
    if (up) verts.push(0, y, 0, ...p1, ...p0);
    else verts.push(0, y, 0, ...p0, ...p1);
  }
  return fromPositions(verts);
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
      0, baseY + height, 0,
      Math.cos(a1) * r1, baseY, Math.sin(a1) * r1,
    );
  }
  return fromPositions(verts);
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

/**
 * Scale in the horizontal plane only. Both factors are positive at every
 * call site here, which is what keeps this from flipping any winding — a
 * negative factor would mirror the shape and turn every face inside out.
 */
function scaleXZ(geometry: BufferGeometry, sx: number, sz: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setX(i, position.getX(i) * sx);
    position.setZ(i, position.getZ(i) * sz);
  }
}

/**
 * Lean a shape over: displace X in proportion to height, leaving the base
 * where it stands. A shear has determinant 1, so unlike a mirror it is safe
 * to apply after the winding has been decided.
 */
function shearX(geometry: BufferGeometry, slope: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setX(i, position.getX(i) + position.getY(i) * slope);
  }
}

function rotateY(geometry: BufferGeometry, angle: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setX(i, x * c + z * s);
    position.setZ(i, -x * s + z * c);
  }
}

/** Tip a +Y shape onto its side along +X and lift it clear of the ground. */
function layDown(geometry: BufferGeometry, lift: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    position.setX(i, y);
    position.setY(i, -x + lift);
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
  reedClumpGeometry,
  rockGeometry,
  pebbleGeometry,
  shrubGeometry,
  fallenLogGeometry,
  standingStoneGeometry,
  trilithonGeometry,
  chapelGeometry,
  buskPitchGeometry,
  waysideCairnGeometry,
  smokeColumnGeometry,
  coniferGeometry,
  broadleafGeometry,
  willowGeometry,
  toNonIndexed,
  outwardFraction,
};
