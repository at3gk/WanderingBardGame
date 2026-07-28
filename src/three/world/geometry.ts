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
): BufferGeometry {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const sx = -Math.sin(angle);
  const sz = Math.cos(angle);

  const midY = height * 0.5;
  const midOut = lean * height * 0.24;
  const tipOut = lean * height;
  // Half the base width at the bend, so the blade tapers steadily from root
  // to tip. At 0.7 the upper triangle was nearly as wide as the lower quad
  // and every blade read as an arrowhead on a stick.
  const midW = width * 0.48;

  const blx = cx + sx * width;
  const blz = cz + sz * width;
  const brx = cx - sx * width;
  const brz = cz - sz * width;
  const mlx = cx + dx * midOut + sx * midW;
  const mlz = cz + dz * midOut + sz * midW;
  const mrx = cx + dx * midOut - sx * midW;
  const mrz = cz + dz * midOut - sz * midW;
  const tx = cx + dx * tipOut;
  const tz = cz + dz * tipOut;

  // Wound so the face normal points along `angle` — outward from the tuft's
  // centre, the direction the blade is leaning and therefore the direction
  // it should catch light from.
  return fromPositions([
    blx, 0, blz, brx, 0, brz, mrx, midY, mrz,
    blx, 0, blz, mrx, midY, mrz, mlx, midY, mlz,
    mlx, midY, mlz, mrx, midY, mrz, tx, height, tz,
  ]);
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

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + rand() * 1.1;
    // Ankle-to-shin on a 1.8 m bard: 0.17–0.28 m here, and 0.14–0.37 m once
    // the instance scale has had its way. Earlier passes at 0.36 m put the
    // tips at the bard's knee and the meadow read as an uncut hayfield.
    const height = 0.17 + rand() * 0.11;
    const lean = 0.24 + rand() * 0.32;
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
      ),
    );
  }

  const merged = mergeGeometries(blades);
  merged.computeVertexNormals();
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

  for (let f = 0; f < count; f++) {
    const angle = (f / count) * Math.PI * 2 + rand() * 0.8;
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
    const tipDrop = arch * 0.3;

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
        dx * length * 1.25, tipDrop, dz * length * 1.25,
        dx * length * 0.55 - sx * width, arch, dz * length * 0.55 - sz * width,
      ]),
    );
  }

  const merged = mergeGeometries(fronds);
  merged.computeVertexNormals();
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
 */
export function rockGeometry(seed = 17): BufferGeometry {
  const rand = mulberry32(seed);
  const geometry = lumpDome(0.72, 7, 3, 0.62, 0.22, rand);
  translateY(geometry, 0.2);
  geometry.computeVertexNormals();
  paintGradient(geometry, 0x8b877d, 0xffffff, -0.3, 0.5);
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
 */
export function shrubGeometry(seed = 23): BufferGeometry {
  const rand = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const lobes = 3;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rand() * 0.9;
    const r = 0.42 + rand() * 0.24;
    // Seven segments and three rings, not six and two. Two rings puts the
    // pole facet straight onto the widest ring, which gives a hexagonal
    // top and a bush that reads as a pitched tent from any angle.
    const lobe = lumpDome(r, 7, 3, 0.58, 0.26, rand);
    translateY(lobe, r * 0.5 + rand() * 0.1);
    translateXZ(lobe, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    parts.push(paint(lobe, 0xffffff, 0.18, rand));
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  addSway(merged, 0, 1.1, 0.32);
  return merged;
}

/**
 * A fallen trunk, lying along its own X axis. Forest only.
 *
 * Built upright and then rotated a quarter turn, because a tapered cylinder
 * is far easier to reason about along +Y and the rotation is proper (it
 * preserves handedness), so the outward winding survives it.
 */
export function fallenLogGeometry(seed = 29): BufferGeometry {
  const rand = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const length = 2.2 + rand() * 1.6;
  const radius = 0.19 + rand() * 0.09;

  const trunk = taperedCylinder(radius * 0.72, radius, length, 6, rand);
  layDown(trunk, radius);
  parts.push(trunk);

  // One or two broken-off limbs, which is what tells the eye this is a
  // fallen tree rather than a length of pipe.
  const stubs = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < stubs; i++) {
    const stub = taperedCylinder(radius * 0.24, radius * 0.42, 0.4 + rand() * 0.3, 4, rand);
    layDown(stub, radius * 0.42);
    rotateY(stub, 0.7 + rand() * 1.4);
    translateXZ(stub, length * (0.2 + rand() * 0.6), 0);
    parts.push(stub);
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  paintGradient(merged, 0x6e6a5c, 0xffffff, 0, radius * 2.1);
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
  const trunkH = 2.2 + rand() * 1.0;

  parts.push(paint(taperedCylinder(0.17, 0.33, trunkH, 5, rand), options.trunkColor, 0.14, rand));

  // A rounded cap, not the flat plate this had at first. At 0.5 flatten the
  // canopy read as a dinner plate balanced on a pole; a willow's crown is a
  // dome that the fronds fall off the edge of.
  const cap = lumpDome(1.6 + rand() * 0.4, 7, 3, 0.74, 0.16, rand);
  translateY(cap, trunkH + 0.75);
  parts.push(paint(cap, options.canopyColor, 0.13, rand));

  // Two rings of them. One ring leaves gaps you can see the trunk through,
  // and a curtain with gaps in it is a set of separate hanging strips —
  // which is exactly what it looked like.
  const fronds = 22;
  for (let f = 0; f < fronds; f++) {
    const ring = f % 2;
    const a = (f / fronds) * Math.PI * 2 + rand() * 0.25;
    const r = (ring === 0 ? 1.45 : 0.95) + rand() * 0.45;
    const drop = (ring === 0 ? 2.0 : 1.4) + rand() * 0.9;
    const w = 0.3 + rand() * 0.12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sx = -Math.sin(a);
    const sz = Math.cos(a);
    const top = trunkH + (ring === 0 ? 0.85 : 1.15);
    // A tapering strip that also draws slightly inward as it falls, so the
    // curtain hangs rather than flaring out like a lampshade.
    const tipX = x * 0.9;
    const tipZ = z * 0.9;
    const tlx = x + sx * w;
    const tlz = z + sz * w;
    const trx = x - sx * w;
    const trz = z - sz * w;
    const blx = tipX + sx * w * 0.3;
    const blz = tipZ + sz * w * 0.3;
    const brx = tipX - sx * w * 0.3;
    const brz = tipZ - sz * w * 0.3;
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
    verts.push(b0x, 0, b0z, t0x, height, t0z, b1x, 0, b1z);
    verts.push(b1x, 0, b1z, t0x, height, t0z, t1x, height, t1z);
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
  shrubGeometry,
  fallenLogGeometry,
  coniferGeometry,
  broadleafGeometry,
  willowGeometry,
  toNonIndexed,
  outwardFraction,
};
