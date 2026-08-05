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
  type RoadStopKind,
} from '../../core/road';

import { fbm1D, mulberry32, randRange, subSeed, weightedPick, type Rand } from '../../core/rng';
import { createFoliageMaterial, createPainterlyMaterial, type PainterlyGlobals } from '../painterly';
import { campfireLayout, roadOffset } from '../scenes/campfireLayout';
import {
  buskPitchGeometry,
  cachedGeometry,
  chapelGeometry,
  fallenLogGeometry,
  fernGeometry,
  flowerGeometry,
  grassTuftGeometry,
  lanternGlowGeometry,
  pebbleGeometry,
  puddleGeometry,
  reedClumpGeometry,
  rockGeometry,
  shrubGeometry,
  smokeColumnGeometry,
  standingStoneGeometry,
  treeGeometry,
  trilithonGeometry,
  waysideCairnGeometry,
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

/** Metres of road per chunk. Exported for the wayside-sentinel cadence test. */
export const CHUNK_LENGTH = 60;
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
 * Where the wheels have been, as a lateral offset and a half-width.
 *
 * Defined here rather than beside the scatter bands that used to own them,
 * because the mesh needs them before `NEAR_OFFSETS` is built: the rut is now
 * a shape in the ground and not only a stripe painted on it, so the ribbon
 * has to put a column on its floor and one on each of its lips.
 *
 * `0.58`, and the ribbon's own rut column used to be `0.55`. That is the
 * whole reason the rut never quite read: the darkest point of the painted
 * ramp sat 5 cm off the nearest vertex, so the tent the mesh interpolated
 * peaked at 88 per cent of the ramp's depth and a little to the inside of
 * where the scatter's keep-out band and the puddles thought the rut was.
 * Three constants for one rut; they agree now.
 */
export const RUT_CENTRE = ROAD_HALF_WIDTH * 0.58;
export const RUT_HALF = 0.42;

/**
 * How deep the worn rut is cut into the carriageway, metres.
 *
 * The arithmetic that sets it, because the obvious instinct is to make it
 * bigger and the obvious instinct is wrong twice over.
 *
 * What a rut is for here is a *normal*, not a hole. The profile below is a
 * raised cosine, so its steepest wall has slope `pi * depth / (2 * half)` =
 * 0.26 at 7 cm, which tilts the ground 14.7 degrees away from flat — enough
 * to move a fragment across one of the shader's diffuse band edges, which is
 * how a low-poly world shows form at all. Doubling the depth would double
 * the tilt and start reading as a trench dug across the country rather than
 * as a lane two carts a day have worn.
 *
 * And it must stay small next to what walks on it. The bard walks the crown
 * (`FOOTFALL_HALF` = 0.29 m either side of the centreline) and the ruts
 * start at 0.57, so his feet never enter one — but the camera does pass over
 * them, and a 7 cm dip under a camera 1.9 m up is invisible as a *bump* and
 * visible only as shading, which is exactly the division of labour wanted.
 */
export const RUT_DEPTH_M = 0.07;

/** The steepest a bedded prop is laid over, as a slope. tan(30 deg). */
const BEDDED_MAX_SLOPE = 0.577;

/**
 * The rut's profile: how far the carriageway drops at lateral offset `u`,
 * and the slope of that drop.
 *
 * A raised cosine rather than a linear V, for the reason this file has now
 * learned twice about clamped ramps: a V has a corner at its floor and two
 * more at its lips, and a corner in a height field sampled at vertices is a
 * crease that survives every amount of tuning. The cosine meets flat ground
 * with zero slope at both lips and has zero slope at its floor, so the rut
 * has no edge anywhere except the one its own shading draws.
 *
 * `rutSlope` is `d(drop)/du` and exists because the ribbon's normals are
 * taken by central difference at a one-metre step — which is wider than the
 * whole rut, and would therefore smooth a feature 0.84 m across into
 * precisely nothing. The rut's contribution to the normal is added
 * analytically instead. See `buildTerrain`.
 */
export function rutDrop(u: number): number {
  const d = Math.abs(Math.abs(u) - RUT_CENTRE);
  if (d >= RUT_HALF) return 0;
  return -RUT_DEPTH_M * 0.5 * (1 + Math.cos((Math.PI * d) / RUT_HALF));
}

/**
 * The height of the ground *as drawn*, at any world point.
 *
 * `terrainHeight` stays the one authority on the landform and is what places
 * the bard, the camera and everything off the road. This is that plus the
 * rut, and it is what anything standing on the carriageway has to use — a
 * figure who stops in a wheel rut is otherwise standing 7 cm above the ground
 * the player can see under their boots.
 *
 * The lateral offset is taken as the horizontal distance from the centreline,
 * which is the same approximation `terrainHeight` makes for the corridor: it
 * differs from the true perpendicular by cos(heading), a couple of per cent
 * through the sharpest bend this road can make.
 */
export function roadSurfaceHeight(road: DailyRoad, x: number, z: number): number {
  return terrainHeight(road, x, z) + rutDrop(x - sampleRoad(road, z).x);
}

export function rutSlope(u: number): number {
  const au = Math.abs(u);
  const d = Math.abs(au - RUT_CENTRE);
  if (d >= RUT_HALF) return 0;
  // d(drop)/dd, then chained through the two absolute values.
  const dDrop = RUT_DEPTH_M * 0.5 * (Math.PI / RUT_HALF) * Math.sin((Math.PI * d) / RUT_HALF);
  return dDrop * Math.sign(au - RUT_CENTRE) * Math.sign(u || 1);
}

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
  // The wheel rut: lip, wall, floor, wall, lip. All five are derived from the
  // same two constants the rut's own profile uses, so the ribbon cannot drift
  // away from the shape it is meant to be carrying.
  //
  // The two WALL columns are the ones that matter and they are the ones the
  // first version left out. A raised cosine has zero slope at its floor and
  // zero slope at both lips — those are exactly the three places a rut's
  // shading has nothing to say — so a ribbon sampled only there carries a
  // 7 cm dip in its positions and a dead flat normal everywhere, and renders
  // as ground that is not there. Measured off the live scene before the walls
  // went in: every column across the carriageway reported the same 5.3 degree
  // normal tilt, in the build with the rut and in the build without it, while
  // the positions differed by the full 7 cm. The walls are where the slope
  // reaches its maximum, 0.26, and they are the whole feature.
  RUT_CENTRE - RUT_HALF,
  RUT_CENTRE - RUT_HALF * 0.5,
  RUT_CENTRE,
  RUT_CENTRE + RUT_HALF * 0.5,
  RUT_CENTRE + RUT_HALF,
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

export const ACROSS_OFFSETS = (() => {
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
 * Relative luminance of a colour whose channels are already linear.
 *
 * Rec. 709 weights, and linear rather than the eye-matched sRGB version on
 * purpose: this is used to compare a mirror's brightness against the ground's,
 * which is a question about light arriving and not about how a screen encodes
 * it.
 */
function luminanceOf(c: Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
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

/*
 * The rut the scatter keeps out of is the same rut the ground is cut into
 * and the same rut the shader darkens: `RUT_CENTRE` and `RUT_HALF` are
 * defined once, up beside `rutDrop`. Nothing grows in a wheel rut and
 * nothing loose stays in one, so anything the scatter puts there reads as
 * the bard wading rather than walking.
 */
/**
 * Where the bard's boots fall.
 *
 * He walks the centreline exactly — `RoadStage` puts him on `sampleRoad`'s
 * own `x` with no lateral offset — so the middle of the crown is the one
 * strip of road that must stay bare however much the rest of it gains.
 */
export const FOOTFALL_HALF = 0.29;

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
/**
 * The floor of the rut, the one part of the carriageway a puddle sits in.
 *
 * Every other kind here treats the rut as a keep-out zone — a wheel rut is
 * where nothing grows and nothing loose stays put. Standing water is the
 * exception, because a wheel rut is exactly where real rain collects: it is
 * the lowest ground on the whole cross-section, worn in by the same wheels
 * that keep it bare of everything else.
 *
 * The band used to be the whole rut, and that was right while the rut was a
 * stripe of paint on flat ground. Now that it is a shape, a puddle placed
 * halfway up a wall would be a level surface on a 15-degree slope: buried on
 * one side, in the air on the other. Water finds the bottom.
 */
const RUT_FLOOR_BAND: [number, number] = [RUT_CENTRE - 0.12, RUT_CENTRE + 0.12];

/* ======================================================================
 * The river.
 *
 * DESIGN.md has called the third band "Riverside Camp" since v0.3 and the
 * riverside palette's own comment has said "a bank of verticals at the
 * roadside says water is near without a drop of it having to be drawn". That
 * was a defensible dodge in 2D and it is not one here: a human watched the 3D
 * game and the first thing they said was that the riverside has no river, and
 * v0.8 item 4 makes it scope.
 *
 * Four decisions, and the first is the one everything else follows from.
 *
 * **The river is a ribbon in road space, like the terrain.** Its centreline is
 * a lateral offset from the road's own, so it meanders because the road
 * meanders and it can never, at any `s`, cross the lane — the clearance is
 * arithmetic rather than something a noise field has to be trusted not to
 * violate. It also means the whole thing streams with the chunk system for
 * free and needs no second spatial structure.
 *
 * **The water is level and the ground is carved to meet it**, not the other
 * way round. The surface height at `s` is the terrain along the river's own
 * course *averaged over ~100 m*, which throws away `core/road`'s two bump
 * octaves (52 m and 31 m) and leaves only the landform — so the surface drifts
 * with the valley over hundreds of metres and is flat across the channel and
 * over any one frame, which is what "level" has to mean for a river that runs
 * downhill. The channel is then cut *relative to that surface*: a flat bed a
 * fixed depth below it, banks rising to a crest a fixed freeboard above it,
 * and a skirt blending the crest back into whatever the untouched ground was
 * doing. Cutting relative to the water rather than relative to the ground is
 * what guarantees the water is never left floating over a hollow the noise
 * happened to put beside it.
 *
 * **The carve is applied to the drawn mesh, not to `terrainHeight`.** That is
 * the same division of labour the wheel rut already uses and for the same
 * reason: `core/road`'s height field stays the one authority on where the
 * ground is, so the bard's footing, the camera and every prop keep agreeing
 * with each other. Anything that has to stand *in* the channel asks for the
 * carved height explicitly, exactly as anything standing in the rut asks
 * `roadSurfaceHeight`.
 *
 * **The terrain ribbon grows columns where the river is.** The lateral sample
 * curve puts vertices at 12.5, 14.2, 18.6, 25.1 and 33.6 m — four to six
 * metres apart across exactly the band a river lives in, which would describe
 * an eighteen-metre channel with three vertices and render it as a coarse V.
 * So each row inserts a fixed set of columns positioned from the river's own
 * profile at that `s`. They are inserted at *every* `s`, river or no river,
 * because the count has to be constant for the index buffer and because a
 * layout that is a pure function of `s` is what keeps two chunks agreeing on
 * the row they share.
 * ====================================================================== */

/** Half-width of open water, before the per-course variation below. */
const RIVER_HALF_M = 5.6;
const RIVER_HALF_VARY_M = 1.4;
const RIVER_WIDTH_WAVELENGTH_M = 137;
/** Water's edge to the top of the bank. */
const RIVER_BANK_M = 4.4;
/** Top of the bank to where the ground is untouched again. */
const RIVER_SKIRT_M = 4.2;
/** Water surface to the bed. */
const RIVER_DEPTH_M = 1.45;
/*
 * Water surface to the crest of the bank, and how far the surface sits below
 * the ground's own local average.
 *
 * Both are small, and the reason is sightlines rather than hydrology. The
 * camera's eye is about 2.2 m above the water and the crest of the near bank
 * is thirteen metres away, so a crest standing 0.6 m proud of the surface hides
 * the first three metres of water from anyone walking the road — and since the
 * near water is the only part of it with any size in the frame, a bank that
 * tall costs most of what the river is for. At 0.35 the sightline clears the
 * crest within a metre of the waterline. The exposed bank is still a real bank
 * (the bed is 1.45 m below the surface, so it is 1.8 m from bed to crest over
 * 4.4 m of slope) and the silt band painted on it is what actually carries the
 * edge; what has gone is only the part of it that was standing in the way.
 */
const RIVER_FREEBOARD_M = 0.35;
const RIVER_SURFACE_DROP_M = 0.16;
/**
 * Untouched ground between the outside of the river's skirt and the road.
 *
 * This is the constant that makes "never across the walking lane" a proof
 * rather than a hope: the course is clamped so that `|u|` is at least
 * `half + bank + skirt + this`, and the carve is exactly zero beyond
 * `half + bank + skirt`. The road corridor's own falloff ends at 11.5 m, so
 * at this clearance the two shapings never even touch.
 */
const RIVER_ROAD_CLEARANCE_M = 6.2;
/*
 * How far off the road the channel runs, and how far that wanders.
 *
 * The meander amplitude is more than half the base on purpose, and it is what
 * turns a canal into a river. A watercourse held at a constant offset is
 * always in the same place in the frame — and because the camera looks *down*
 * the road, that place is a thin sliver near the vanishing point whatever
 * distance is chosen: at this field of view the frame is only 0.68 metres wide
 * per metre of depth, so anything parallel to the lane enters the picture at
 * about `1.5 * offset` metres ahead and is already foreshortened when it does.
 *
 * Swinging the offset instead gives the walk a rhythm — the road meets the
 * water every couple of hundred metres, runs beside it, and drifts away —
 * and it is the near passages that make the river read, because they are the
 * only frames where it is close enough to have a bank with size in it. For
 * today's road the course sits at 21.5 m at its nearest tenth, 27 m in the
 * middle and 32 m at its furthest.
 */
const RIVER_COURSE_M = 24;
const RIVER_MEANDER_M = 12;
/*
 * 240 m, not the 190 first tried, and the wavelength turned out to matter more
 * than the amplitude.
 *
 * At 190 the course moved about ten metres across a single sixty-metre chunk,
 * which is a bend tighter than the road's own — so in a walking frame the far
 * shore swung out of the picture within one chunk and what the eye read was a
 * bay, or a pond, rather than a watercourse running somewhere. Stretched out,
 * the same amplitude drifts about a metre every twenty, the two banks stay
 * roughly parallel across everything one frame can see, and the near passages
 * still arrive — just as a long approach rather than as a kink.
 */
const RIVER_MEANDER_WAVELENGTH_M = 240;
/**
 * How long the river takes to arrive and leave at a band boundary.
 *
 * A river that stops dead at a band edge is a wall of water; one that fades
 * over 55 m shallows out, narrows and is gone, which is what a watercourse
 * leaving the road looks like. The fade scales the whole carve, so the bed
 * rises toward the surface as it goes and the open water closes from both
 * banks — no term has to be special-cased for it.
 */
const RIVER_FADE_M = 55;
/** Along-course span averaged for the water's level. See the note above. */
const RIVER_LEVEL_SPAN_M = 96;

/**
 * The river's cross-section at one point along the road, as everything the
 * ground, the water and the reeds all have to agree about.
 */
interface RiverProfile {
  /** Signed lateral offset of the channel's centreline from the road's. */
  u: number;
  /** Half-width of the flat bed. */
  half: number;
  /** 0 where there is no river; ramps at band boundaries. */
  strength: number;
  /** How far the carve reaches from the centreline. Zero effect beyond it. */
  reach: number;
  surfaceY: number;
  bedY: number;
  crestY: number;
}

/** Lateral columns the terrain ribbon grows around the channel, per side. */
const RIVER_COLUMN_STOPS = 9;
/** Columns across the water's own strip. */
const RIVER_SURFACE_COLS = 7;
/**
 * How far the water's colour is pulled from the sky toward its own depth, in
 * the middle of the channel and at its rim.
 *
 * The rim is *lighter*, which is a stylisation and not physics: real shallows
 * show you the bed and go browner. But the bed here is silt the same warm tone
 * as the bank, so a darkening rim would close the value gap the waterline
 * needs, and every reference this project is aimed at — A Short Hike's ponds,
 * Spiritfarer's sea — paints a bright edge and a deep middle for exactly that
 * reason. The gap between these two numbers is what makes a flat plane read as
 * having volume under it.
 */
const RIVER_MIX_CENTRE = 0.85;
const RIVER_MIX_EDGE = 0.55;

/**
 * The ground's height inside the river's cross-section.
 *
 * `natural` is what `terrainHeight` said; `d` is the distance from the
 * channel's centreline. Both blends are smoothsteps meeting with zero slope,
 * for the reason this file has learned three times over: a corner in a height
 * field sampled at vertices comes back as a crease no amount of tuning
 * removes.
 */
function riverShape(profile: RiverProfile, d: number, natural: number): number {
  if (profile.strength <= 0 || d >= profile.reach) return natural;
  const bankOuter = profile.half + RIVER_BANK_M;
  let shaped: number;
  if (d <= profile.half) shaped = profile.bedY;
  else if (d >= bankOuter) shaped = profile.crestY;
  else {
    shaped =
      profile.bedY +
      (profile.crestY - profile.bedY) * smoothstep(profile.half, bankOuter, d);
  }
  const weight = d <= bankOuter ? 1 : 1 - smoothstep(bankOuter, profile.reach, d);
  return natural + (shaped - natural) * weight * profile.strength;
}

/**
 * Where the ribbon puts its extra columns, as distances from the channel's
 * centreline. Crowded on the bank, because the bank is the only part of this
 * shape with any curvature in it — the bed is flat and the skirt is nearly so.
 */
/**
 * `ACROSS_OFFSETS` with the river's own columns folded into it, still sorted.
 *
 * Sorted is load-bearing and this file has paid for learning that once
 * already: an unsorted offset list folds two strips of ground back on
 * themselves, and a folded quad has a normal pointing anywhere at all. Both
 * inputs are ascending, so this is a straight merge and cannot produce one.
 */
function mergeRiverColumns(
  profile: RiverProfile,
  distances: readonly number[],
  out: Float64Array,
): void {
  let a = 0;
  let b = 0;
  let n = 0;
  const extra = distances.length * 2 - 1;
  const columnAt = (i: number): number =>
    profile.u + (i < distances.length - 1 ? -distances[distances.length - 1 - i] : distances[i - distances.length + 1]);
  while (a < ACROSS_SAMPLES || b < extra) {
    if (b >= extra || (a < ACROSS_SAMPLES && ACROSS_OFFSETS[a] <= columnAt(b))) {
      out[n++] = ACROSS_OFFSETS[a++];
    } else {
      out[n++] = columnAt(b++);
    }
  }
}

/**
 * How dry the meadow's own drift says this patch of ground is, 0..1.
 *
 * The two sines are `buildTerrain`'s `broad`, verbatim and deliberately so:
 * that expression decides how far the ground is mixed toward its pale tone,
 * so it already *is* the map of where the field is bleached and where it is
 * deep. Reading it here rather than rolling a second field is the whole
 * point — the cover thins on exactly the ground the eye can see is thin.
 *
 * Kept as a free function beside the profile helpers rather than a method
 * because it is arithmetic on a world position and nothing else.
 */
function meadowDryness(x: number, z: number): number {
  const broad =
    0.3 + 0.22 * Math.sin(x * 0.038 + z * 0.027 + 2.1) + 0.15 * Math.sin(x * 0.071 - z * 0.059 + 4.7);
  return smoothstep(0.28, 0.62, broad);
}

function riverColumnDistances(profile: RiverProfile, out: number[]): void {
  const h = profile.half;
  const b = RIVER_BANK_M;
  out.length = 0;
  out.push(0, h * 0.6, h, h + b * 0.3, h + b * 0.6, h + b * 0.85, h + b, h + b + RIVER_SKIRT_M * 0.45, profile.reach);
}

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
  /**
   * How far a clump's members spread from its centre, metres.
   *
   * Defaults to `0.55 + clump * 0.22`, which grows with the member count —
   * and that default is backwards for anything meant to read as a *patch*.
   * Seven tufts over two metres is still an even scatter; it is an even
   * scatter of seven. Seven over three quarters of a metre is a clump of
   * grass, and the difference between the two is the whole of what a critique
   * meant by "clump tufts rather than scatter them evenly". The default is
   * kept because the kinds that use it — ferns, flowers, roadside stones —
   * are things that genuinely do stand a metre or two apart.
   */
  clumpRadius?: number;
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
   * Place this kind relative to the *river's* centreline rather than the
   * road's, as a band measured from the edge of the open water in multiples
   * of `RIVER_BANK_M`.
   *
   * A waterline is the one place in this world where the vegetation has a
   * reason to crowd, and it is what makes a river read as a river rather than
   * as a blue stripe: reeds standing in the shallows, then a thick fringe up
   * the bank, then the ordinary meadow. `[0.4, 1.2]` therefore straddles the
   * waterline — the ground crosses the surface at about 0.6 of the bank — so
   * some of the clump is in the water and some is out of it, which is exactly
   * where reeds grow.
   *
   * A kind with this set is skipped entirely wherever the river's strength is
   * low, so it costs nothing in the two bands that have no water.
   */
  riverBand?: [number, number];
  /**
   * How hard this kind thins out where the ground itself is dry, 0..1.
   *
   * The meadow's own colour drift — the pair of ~170 m sines `buildTerrain`
   * uses to mix between the two grass tones — is a lushness field that was
   * being ignored by everything that grows on it, so the cover was uniform
   * over ground that visibly was not. A critique put it bluntly: the tufts
   * read as litter scattered on a lawn, because litter is what an even
   * scatter *is*. Thinning whole clumps (not individual plants) against the
   * same field the ground is painted from is what gives the eye somewhere to
   * rest — bare pale ground where the ground is pale, thick cover where it is
   * deep — and it costs two sines per clump.
   */
  thin?: number;
  /**
   * Exponent on the lateral placement. 1 is uniform across the band; above
   * 1 crowds the kind against its clearance, which is how a hedgerow ends
   * up following the road instead of speckling the field.
   */
  edgeBias?: number;
  /**
   * Lay this kind along the ground rather than standing it upright.
   *
   * For the flat-bottomed things only. A tree, a tuft and a fern grow
   * vertically whatever the hillside does — that is what "grows" means — but
   * a fallen trunk and a bedded boulder take the slope they are lying on,
   * and until this existed every one of them was placed with its own up
   * pointing at the sky and one end left in the air.
   *
   * The arithmetic that made it worth doing, measured against the ground the
   * road corridor actually produces since its falloff came in from 18 m to
   * 7 m: at 7 to 9 m off the centreline — which is where `VERGE.log` puts
   * the first logs — the tilt is 8 degrees at the median and 19 at the 95th
   * percentile, against 1.5 degrees on the flat inside the corridor. A log
   * is 2.2 to 3.8 m long before its 0.8-1.4 scale and 0.19-0.28 m in radius,
   * so a median bank lifts one end 0.33 m clear of the ground and a bad one
   * 0.78 m: two-thirds of a diameter and a diameter and a half. That is a
   * floating log, and it is not something the eye forgives.
   */
  bedded?: boolean;
  /**
   * Metres above the ground surface this kind's origin sits.
   *
   * One user: standing water, which is a *level* surface in a hollow and not
   * a decal on the ground. Left at the floor of the rut a puddle would be
   * cut away by the rut's own walls within 12 cm of its centre — the walls
   * climb 1 cm in the first 10 cm — so what shipped as a lozenge would come
   * back as a sliver. Filled to 0.7 of the rut's depth it reaches 0.27 m
   * either side of the floor before the earth rises through it, which is a
   * puddle half a metre across lying the length of the groove.
   */
  lift?: number;
  scale: [number, number];
  /** Only drawn on chunks within this many metres of the bard. */
  lodRange: number;
  castShadow: boolean;
  material: 'foliage' | 'solid';
  colorOf?: (palette: BiomePalette, rand: Rand) => number;
  /**
   * This kind's colour comes from the sky, not from the palette.
   *
   * Standing water is the only surface in the world that is a mirror, and a
   * mirror has no albedo of its own — so it is the one kind whose instance
   * colours have to be rewritten as the day turns rather than baked when the
   * chunk is built. A kind with this set has no `colorOf`; `paintWater`
   * supplies its colours instead, and the one random draw `colorOf` would
   * have made is still made, so placement is untouched.
   */
  skyLit?: boolean;
}

/** Seeds for the four grass silhouettes and the four ferns. Arbitrary primes. */
const GRASS_SEEDS = [7, 11, 19, 23];
const FERN_SEEDS = [9, 13, 29, 37];
const PEBBLE_SEEDS = [41, 53, 67];
const PUDDLE_SEEDS = [71, 79, 83];

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
  /**
   * Standing water, in the rut and nowhere else.
   *
   * Every other carriageway kind keeps out of the rut band; this is the one
   * thing placed *because* of it rather than despite it. Rare and clumped —
   * a real cart track has a handful of wet stretches, not a continuous
   * ribbon of water — so at `clump: 2` a puddle usually has one small
   * companion a little further along the same rut rather than standing
   * alone.
   */
  {
    key: 'puddle',
    geometry: (v) => cachedGeometry(`puddle:${v}`, () => puddleGeometry(PUDDLE_SEEDS[v])),
    variants: 3,
    clump: 2,
    perSquareMetre: 0.12,
    densityKey: 'puddle',
    zones: [RUT_FLOOR_BAND],
    clearance: RUT_FLOOR_BAND[0],
    spread: RUT_FLOOR_BAND[1],
    // Filled to 0.7 of the rut's depth: see `lift`.
    lift: RUT_DEPTH_M * 0.7,
    scale: [0.7, 1.3],
    lodRange: CHUNK_LENGTH * 2.6,
    castShadow: false,
    material: 'solid',
    /*
     * Was a fixed cool grey-blue mixed toward the road, and that was the
     * wrong lever. Measured off the frames it shipped in: at dusk the puddle
     * read L18.8 against a carriageway of L22.6 beside it — darker than the
     * earth — and on the tablet frame L74.5 against a road whose own sunlit
     * patches reach L118. A dark blue lozenge on brown ground is a hole, or
     * a shard of something; standing water is the one thing on a road that
     * is *lighter* than the road, at every hour, because it is not showing
     * you its own colour at all. It is showing you the sky.
     *
     * There is still no real-time reflection here and there does not need to
     * be. A puddle two or three metres from a walking camera is seen at
     * fifteen or twenty degrees off flat, and what a horizontal mirror
     * returns at that angle is the sky just above the horizon — which is a
     * uniform the shader already carries. So the colour is derived from
     * `uHorizonColor` in `paintWater` and rewritten as the day turns.
     */
    skyLit: true,
  },
  {
    key: 'grass',
    // Four seeds, four silhouettes. The seeds are arbitrary primes; what
    // matters is only that they differ.
    geometry: (v) => cachedGeometry(`grass:${v}`, () => grassTuftGeometry(GRASS_SEEDS[v])),
    variants: 4,
    // Seven, not four, and the count per square metre is unchanged — so this
    // is a redistribution rather than more grass. Bigger clumps at the same
    // total means fewer patches with more in each, which is the whole shape
    // of the fix: an even scatter of small clumps is still an even scatter,
    // and the eye reads evenness as texture rather than as plants. What makes
    // a meadow read is the *bare ground between the patches*.
    clump: 7,
    clumpRadius: 0.8,
    // Was 1.15, which had been doubled once to stop the meadow reading as
    // "a scattering of individual plants on bare earth". It fixed that and
    // overshot into the opposite failure: unbroken cover from the verge to the
    // treeline, which is what every critique since has called litter. The
    // count comes down about a tenth and the clumping above concentrates what
    // is left, so the same ground carries fewer, denser, more obviously
    // plant-shaped patches with bare field between them. Not further: 0.92 was
    // tried and the phone-portrait framing — which is almost all foreground and
    // is the pose the mobile pillar is judged on — came back with a bare verge
    // beside a bare road, which trades one empty frame for another.
    perSquareMetre: 1.05,
    densityKey: 'grass',
    thin: 0.72,
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
     * Drawn from the same two greens the ground drifts between, pulled a
     * little way toward the deep tone. Mixing in the dry tone as well turned
     * every tuft into straw standing on green, so the meadow read as stubble
     * in a mown field.
     *
     * **The pull toward the shade was 0.2 to 0.65 and it was too much.** The
     * argument for it was real and is recorded here because it is still half
     * true: this scatter exists only inside `lodRange`, so it is almost
     * exactly the near and middle ground of every frame, which makes it the
     * one surface that can carry the picture's darks without touching the
     * treeline. What that reasoning missed is that a *foreground* and a
     * *scatter of individual objects* are not the same thing. Ground carrying
     * the darks is a field with shadow in it. Twenty thousand separate objects
     * each carrying the darks is twenty thousand dark marks on a light ground,
     * and every critique of the frames said the same word for it: litter. At
     * night, against the fire, they went further and called them black spikes.
     *
     * Measured against village's own palette the old range put a tuft at
     * 0.55 to 0.85 of the grass it stands in — up to a full stop below the
     * ground, per object, at the scale of a hand. The range is now 0.06 to
     * 0.32, which is 0.78 to 0.96 of the ground: still darker, still enough
     * to read as a plant on a surface, and inside the ground's own value
     * neighbourhood rather than a separate tier of marks laid over it. This
     * is the same argument `skywardNormals` makes about the *lighting* of a
     * blade, applied to its albedo, and the two have to agree or one undoes
     * the other.
     */
    colorOf: (p, rand) =>
      mixColor(
        mixColor(p.grass, p.grassVariant, rand() * 0.45),
        p.grassShade,
        0.06 + rand() * 0.26,
      ),
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
    clumpRadius: 0.55,
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
  /**
   * Reeds standing in the shallows and up the first metre of bank.
   *
   * Its own kind rather than a wider band on `reed`, because the two are
   * describing different things: `reed` above says "there is a ditch beside
   * this road", which is true in the riverside band whether or not the river
   * is in frame, while this one is the river's own fringe and is placed from
   * the channel's profile. It is also much denser — a waterline is the one
   * edge in this world that vegetation genuinely crowds, and the thickening
   * is most of what stops a river reading as a painted stripe.
   */
  {
    key: 'bankreed',
    geometry: () => cachedGeometry('reed', () => reedClumpGeometry(21)),
    clump: 5,
    clumpRadius: 0.85,
    perSquareMetre: 0.55,
    densityKey: 'reed',
    riverBand: [0.4, 1.2],
    spread: 0,
    clearance: 0,
    lodRange: 150,
    scale: [0.75, 1.15],
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) => mixColor(p.grassShade, p.canopy, 0.2 + rand() * 0.5),
  },
  /** The thick grass above the reeds, from the bank's shoulder outward. */
  {
    key: 'bankgrass',
    geometry: (v) => cachedGeometry(`grass:${v}`, () => grassTuftGeometry(GRASS_SEEDS[v])),
    variants: 4,
    clump: 6,
    clumpRadius: 0.85,
    perSquareMetre: 1.5,
    densityKey: 'grass',
    riverBand: [0.75, 2.0],
    spread: 0,
    clearance: 0,
    lodRange: CHUNK_LENGTH * 1.6,
    scale: [0.9, 1.4],
    castShadow: false,
    material: 'foliage',
    colorOf: (p, rand) =>
      mixColor(mixColor(p.grass, p.grassVariant, rand() * 0.45), p.grassShade, 0.1 + rand() * 0.3),
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
    /*
     * Pulled a fifth of the way toward the meadow, where this used to be pure
     * canopy.
     *
     * A canopy colour is chosen to read as a mass of leaves seen against the
     * SKY at eighty metres, and a shrub is the same albedo seen against the
     * GROUND at twenty. Against a sky it is a silhouette; against a lit field
     * it is a hole — and once the shrub was lowered to break the blob
     * silhouette it shares with the boulder, it stopped being a mass with a
     * lit top and became a dark pad lying on bright grass, which is the
     * loudest possible mark in the one part of the frame the eye is supposed
     * to be able to rest on. A tenth of the way, not the fifth first tried: at 0.16-0.36 the frame
     * quality gate's noon pose fell from 2.7 stops of value range to 2.25 and
     * went red, because a shrub is one of the few LARGE dark shapes a flat
     * midday field has and the picture was relying on it for its darks. That
     * is the honest version of the trade the whole of this pass is making —
     * darks belong to big shapes and to shadow, not to twenty thousand little
     * marks — and it only works if the big shapes keep theirs.
     */
    colorOf: (p, rand) =>
      mixColor(mixColor(p.canopy, p.canopyVariant, 0.25 + rand() * 0.75), p.grass, 0.06 + rand() * 0.15),
  },
  {
    key: 'log',
    geometry: () => cachedGeometry('log', () => fallenLogGeometry(29)),
    perSquareMetre: 0.006,
    densityKey: 'log',
    spread: 44,
    clearance: VERGE.log,
    bedded: true,
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
    bedded: true,
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

/* ======================================================================
 * Wayside sentinels as a guarantee (task 167, hardening task 180's system).
 *
 * Task 180 put one large verge tree per chunk on its own seeded stream so
 * frames crop canopy through their edges the way every reference does. The
 * wave-9 panel still found "four unused edges" on eight of ten frames, and
 * the cause is arithmetic, not taste: 15% of chunks rolled no sentinel at
 * all, an exclusion collision (river, landmark, stop dressing) silently
 * deleted the tree rather than moving it, and a uniform draw across the
 * chunk lets gaps cluster. Three independent leaks in what was meant to be
 * a cadence.
 *
 * So the placement is now a *rule* rather than a probability — "no framing
 * without an anchor" — and it lives in a pure exported function for the
 * same reason `stopDressingSites` does: nothing fails loudly when a
 * placement system leaks, so the guarantee has to be pinned headlessly.
 *
 * The guarantee: every chunk holds at least one sentinel, placed in the
 * chunk's central band, so two consecutive sentinels are never more than
 * ~96 m apart on any road. Exclusions no longer delete it — the site is
 * redrawn (bounded tries) until it stands clear. Each slot draws from its
 * own subseeded stream, so a landmark that crowds out slot 0's first
 * candidate cannot reshuffle slot 1, and neither slot can shift any other
 * chunk's trees.
 *
 * What is deliberately NOT guaranteed: an anchor in the frame at every
 * instant. That would need a tree every ~45 m on the camera's side, which
 * is an avenue — and the sides alternate by parity precisely so the road
 * reads as passing between trees rather than along a hedge. One per chunk
 * bounds the gap; if wave 10 still reads empty edges, the dial is
 * SENTINEL_BAND (narrower band, tighter cadence), not more trees.
 * ====================================================================== */

/**
 * Where in its chunk the guaranteed sentinel may stand, as fractions of
 * CHUNK_LENGTH. The band is what turns "one per chunk" into a cadence: a
 * uniform draw allows 12 m and 108 m gaps in equal measure; this bounds the
 * worst pair at (1 - 0.2 + 0.8) x 60 = 96 m.
 */
const SENTINEL_BAND: [number, number] = [0.2, 0.8];
/**
 * Redraws allowed against the static exclusions before a slot gives up.
 * Twelve, because the guarantee has to survive a *structured* exclusion,
 * not a speck: half a band excluded (a landmark clearing) leaves 1/4096;
 * six tries left 1/64, which the cadence test promptly hit on a fixed
 * seed. The last half of the attempts alternate sides deterministically,
 * so a river drowning one whole verge still finds the opposite one. The
 * cap only exists so a chunk with both verges excluded gives up honestly.
 */
const SENTINEL_TRIES = 12;
/** Chance of a second sentinel, roaming the whole chunk. Task 180's number. */
const SENTINEL_SECOND_CHANCE = 0.3;
/** Chance a slot stands opposite its parity side. Task 180's number. */
const SENTINEL_FLIP_CHANCE = 0.25;
/** Lateral band, metres off the centreline. Task 180's: between the shrub
 * verge and the ordinary tree verge — near enough to cross a frame edge at
 * walk-by, far enough that the road ahead stays clear. */
const SENTINEL_OFFSET_MIN_M = ROAD_HALF_WIDTH + 2.8;
const SENTINEL_OFFSET_SPREAD_M = 1.4;

/** One wayside sentinel, resolved to a place on the road. */
export interface WaysideSentinelSite {
  /** Metres along the road. */
  s: number;
  /** Signed lateral offset from the centreline, metres. */
  u: number;
  x: number;
  z: number;
  /** Seed for the tree's own appearance draws (species, scale, shade). */
  seed: number;
}

/**
 * The sentinels for one chunk.
 *
 * `excluded` is the *static* world only — river water, landmark clearings,
 * stop dressings, everything knowable from the seed — so the returned sites
 * are a property of the day. The camp clearing is dynamic (it appears at
 * dusk and rebuilds the chunk) and is deliberately not consulted here: a
 * sentinel that *moved* on that rebuild would be a tree jumping the road,
 * so the caller drops it at build time instead, the way every tree yields.
 */
export function waysideSentinelSites(
  road: DailyRoad,
  index: number,
  excluded: (s: number, u: number, x: number, z: number) => boolean,
): WaysideSentinelSite[] {
  const s0 = index * CHUNK_LENGTH;
  const baseRand = mulberry32(subSeed(road.seed, `sentinel:${index}`));
  const slots = baseRand() < SENTINEL_SECOND_CHANCE ? 2 : 1;
  const sites: WaysideSentinelSite[] = [];
  for (let i = 0; i < slots; i++) {
    const rand = mulberry32(subSeed(road.seed, `sentinel:${index}:${i}`));
    const parity = (index + i) % 2 === 0 ? 1 : -1;
    // Slot 0 is the guarantee and stays in the band; the second is texture
    // and may roam the whole chunk.
    const [lo, hi] = i === 0 ? SENTINEL_BAND : [0, 1];
    for (let attempt = 0; attempt < SENTINEL_TRIES; attempt++) {
      const s = s0 + (lo + (hi - lo) * rand()) * CHUNK_LENGTH;
      // Early attempts keep the seeded flip (variety); late ones alternate
      // sides outright, so an exclusion that owns one whole verge cannot
      // starve the slot. The flip draw happens either way — see the file's
      // standing rule: stream position must not depend on content.
      const flip = rand() < SENTINEL_FLIP_CHANCE;
      const side =
        attempt < SENTINEL_TRIES / 2
          ? flip
            ? -parity
            : parity
          : attempt % 2 === 0
            ? parity
            : -parity;
      const u = side * (SENTINEL_OFFSET_MIN_M + rand() * SENTINEL_OFFSET_SPREAD_M);
      const sample = sampleRoad(road, s);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      const x = sample.x + nx * u;
      const z = roadZ(sample) + nz * u;
      if (excluded(s, u, x, z)) continue;
      sites.push({ s, u, x, z, seed: subSeed(road.seed, `sentinel-look:${index}:${i}`) });
      break;
    }
  }
  return sites;
}

/* ======================================================================
 * Stop dressing: seeing the event before you reach it.
 *
 * DESIGN.md v0.8 item 7, human-set: "A stop should announce itself down the
 * road before you reach it — a lit signpost, listeners already gathered at a
 * busk spot, campfire smoke on the evening sky — so walking toward something
 * is anticipation, not surprise."
 *
 * The listeners are `RoadStage`'s and appear when you arrive. What is here is
 * the other half: **static world geometry standing at the stop all day**, so
 * that the thing you are walking toward is visible from a hundred metres out
 * rather than assembling itself at your feet.
 *
 * It lives in the streamer rather than in the stage for the same reason the
 * landmarks do: it is a property of the day's seed, it belongs to a place on
 * the road and not to a moment in the walk, and it has to stream in and out
 * with the chunk that contains it. `RoadStage` is untouched by any of this.
 *
 * Three kinds, and one deliberate absence.
 *
 * - **Busk** gets the loudest mark in the set: a banner pole with a lit
 *   lantern and a stack of crates. It is announcing a stage, and it is the
 *   only dressing carrying its own light — which the art rules allow,
 *   because a lantern is fire.
 * - **Encounter** (and the crossroads that shares its phase) gets a cool
 *   stone cairn under a leaning marker. An encounter is a meeting, not a
 *   stage; it should read as *something is here* and not as *come and see*.
 * - **Campfire** gets no object at all — only its smoke, which is the one
 *   thing in this file legible from the far end of the streamer's reach and
 *   is exactly what the human asked for by name.
 * - **Vista** gets nothing, on purpose. A vista *is* the view; furniture
 *   standing in front of it would be competing with the thing it announces.
 * ====================================================================== */

/**
 * How far off the centreline the nearest dressing may be pitched.
 *
 * The promise is that nothing here ever stands on the walking lane, and this
 * is where it is kept — not by a test on the finished mesh but by the offset
 * every site is drawn from. The packed carriageway is 1.7 m either side and
 * the worn shoulder finishes at 2.9; the widest footprint any of these
 * shapes reaches from its own origin is about 1.1 m (the busk pitch's
 * crates), so a marker centred at 3.6 m leaves 0.8 m of untouched shoulder
 * even at its nearest corner, and the busk pitch — pushed a further 1.6 m out
 * because it is the wide one — leaves more than three.
 */
export const STOP_DRESSING_CLEARANCE_M = SHOULDER + 0.7;
/** Lateral offsets, as a band. Camera-left; see `dressingSide` below. */
const BUSK_OFFSET_M: [number, number] = [STOP_DRESSING_CLEARANCE_M + 1.6, STOP_DRESSING_CLEARANCE_M + 3.0];
const CAIRN_OFFSET_M: [number, number] = [STOP_DRESSING_CLEARANCE_M, STOP_DRESSING_CLEARANCE_M + 1.2];
/** Distinct base shapes per dressing kind, so two busk pitches are not twins. */
const DRESSING_VARIANTS = 3;

/**
 * Which side of the road dressing stands on: camera-left, always.
 *
 * The same rule and the same reason as `LANDMARK_VIEW_BIAS` — the rig stands
 * the camera to one side of the bard and aims it ahead of him, so the road
 * occupies the right of the frame and the *left* is the part with nothing in
 * it. A marker on the right is a marker that is never in shot until you are
 * standing on it, which is the precise failure this feature exists to fix.
 * `roadOffset`'s sign convention (positive on the road's right) makes this
 * negative.
 */
const DRESSING_SIDE = -1;

/** What a stop's dressing is made of. Not the stop kind: two kinds share one. */
type DressingShape = 'pitch' | 'wayside' | 'smoke';

function dressingShapeFor(kind: RoadStopKind): DressingShape | null {
  if (kind === 'busk') return 'pitch';
  if (kind === 'encounter' || kind === 'crossroads') return 'wayside';
  if (kind === 'campfire') return 'smoke';
  return null;
}

/** One dressed stop, resolved to a world position. */
export interface StopDressingSite {
  shape: DressingShape;
  /** Distance along the road, for the biome the dressing is painted from. */
  s: number;
  seed: number;
  /** Signed lateral offset from the centreline. Negative is camera-left. */
  u: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  variant: number;
  /** Ground kept clear of trees and big scatter, so nothing stands in front. */
  radius: number;
}

/**
 * Every dressed stop on a day's road, in road order.
 *
 * A pure function of the road, which is what makes it testable and what makes
 * it deterministic in the way this game means the word: two players walking
 * the same day see the same banner on the same pole. Each site draws from its
 * own stop's `seed` — never from a shared stream — so adding a kind here can
 * never re-roll the stops around it.
 *
 * Cheap enough to call once and keep: a day has fifteen or so stops.
 */
export function stopDressingSites(road: DailyRoad): StopDressingSite[] {
  const sites: StopDressingSite[] = [];
  for (const stop of road.stops) {
    const shape = dressingShapeFor(stop.kind);
    if (!shape) continue;
    const rand = mulberry32(subSeed(stop.seed, 'dressing'));
    const variant = Math.floor(rand() * DRESSING_VARIANTS);

    if (shape === 'smoke') {
      // Placed from the camp's *own* layout rather than from a guess, so the
      // plume stands over the fire it belongs to when the camp is finally
      // pitched. `campfireLayout` is pure and is the one authority on where
      // that fire is; asking it here is what stops the smoke and the flame
      // being two independent opinions about the same camp.
      const at = sampleRoad(road, stop.s);
      const layout = campfireLayout(stop.seed, at.heading);
      const x = at.x + layout.fire.x;
      const z = roadZ(at) + layout.fire.z;
      sites.push({
        shape,
        s: stop.s,
        seed: stop.seed,
        u: roadOffset(layout.fire.x, layout.fire.z, at.heading),
        x,
        y: terrainHeight(road, x, z),
        z,
        rotation: rand() * Math.PI * 2,
        variant,
        radius: 3.2,
      });
      continue;
    }

    const band = shape === 'pitch' ? BUSK_OFFSET_M : CAIRN_OFFSET_M;
    const at = sampleRoad(road, stop.s + randRange(rand, -1.6, 1.6));
    const u = DRESSING_SIDE * randRange(rand, band[0], band[1]);
    const nx = Math.cos(at.heading);
    const nz = -Math.sin(at.heading);
    const x = at.x + nx * u;
    const z = roadZ(at) + nz * u;
    sites.push({
      shape,
      s: at.s,
      seed: stop.seed,
      u,
      x,
      y: terrainHeight(road, x, z),
      z,
      // A pitch is turned to face along the road, because that is where the
      // people it is advertising to are coming from — and because its
      // crossbar reaches out in local +X, which that turn points at the lane,
      // so the lantern hangs over the verge rather than out in the field. A
      // cairn has no front and faces anywhere.
      rotation: shape === 'pitch' ? at.heading + randRange(rand, -0.3, 0.3) : rand() * Math.PI * 2,
      variant,
      radius: shape === 'pitch' ? 3.6 : 2.0,
    });
  }
  return sites;
}

/**
 * One body of water, with what `paintWater` needs to recolour it as the day
 * turns: what to pull the sky's colour toward, how far to pull it per entry,
 * and the tone it must never be allowed to sink below.
 *
 * Two shapes of water use this. A puddle field is an `InstancedMesh` and its
 * entries are instances; the river is an ordinary `Mesh` and its entries are
 * vertices, which is how one surface carries a gradient from a bright rim to
 * a deep middle. Everything else about them is the same question — what
 * colour is a mirror at this hour — so they share the answer.
 */
interface WaterField {
  mesh: InstancedMesh | Mesh;
  /** What the sky's colour is pulled toward: earth for a puddle, depth for a river. */
  toward: Color;
  /** How far, per instance or per vertex. */
  mix: Float32Array;
  /** Never darker than `floorScale` times this colour's own luminance. */
  floorFrom: Color;
  floorScale: number;
}

interface Chunk {
  index: number;
  group: Group;
  meshes: Array<Mesh | InstancedMesh>;
  /** Standing water in this chunk, empty for all but a few. */
  water: WaterField[];
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
  /** Open water: the one surface in the world with no albedo of its own. */
  private readonly waterMaterial: ShaderMaterial;
  /** solidMaterial with the haze halved, for the things the road aims at. */
  private readonly landmarkMaterial: ShaderMaterial;
  /** Stop dressing: the landmark treatment, with less haze again. */
  private readonly dressingMaterial: ShaderMaterial;
  /** The busk lantern's glass: the one roadside surface lit from inside. */
  private readonly lanternMaterial: ShaderMaterial;
  /** The camp's plume. The only translucent thing in the world. */
  private readonly smokeMaterial: ShaderMaterial;
  private readonly trunkMaterials = new Map<string, ShaderMaterial>();

  /** Scratch objects; the chunk builder runs on a walking player's frame. */
  private readonly scratchPos = new Vector3();
  private readonly scratchQuat = new Quaternion();
  private readonly scratchScale = new Vector3();
  private readonly scratchColor = new Color();
  private readonly upAxis = new Vector3(0, 1, 0);
  private readonly scratchNormal = new Vector3();
  private readonly scratchTilt = new Quaternion();

  private lastCentre = Number.NaN;
  /** The horizon colour the standing water was last painted for. */
  private readonly paintedHorizon = new Color(-1, -1, -1);

  /**
   * The river, as the two things that are constant for a whole day's road.
   *
   * One river, one side, all day. The alternative — a side chosen per band —
   * puts a discontinuity in the channel's own centreline at every boundary,
   * and since the terrain ribbon grows its columns around that centreline a
   * jump would tear the mesh across the row the two bands share. One river
   * that the road meets, leaves and meets again is also the better reading:
   * it is the same water, and the walk is going somewhere.
   */
  private readonly riverSide: number;
  private readonly riverCourseSeed: number;
  private readonly riverWidthSeed: number;
  /**
   * Profiles by whole metre of `s`.
   *
   * Quantised on purpose rather than as an optimisation that happens to be
   * lossy: every consumer — the ribbon's columns, the water strip, the reeds,
   * the suppression test — has to be looking at the *same* channel, and the
   * cheapest way to guarantee that across three call sites with three
   * different sampling rates is to make the profile a function of `round(s)`
   * by construction. The level drifts by under two centimetres across a
   * bucket.
   */
  private readonly riverProfiles = new Map<number, RiverProfile>();
  private readonly riverScratch: RoadSample = { s: 0, x: 0, y: 0, heading: 0 };
  private readonly riverColumns: number[] = [];

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

  /**
   * Every dressed stop on the day's road, resolved once.
   *
   * Not memoised per chunk like the landmarks are, because there is no search
   * to amortise: a site is a couple of road samples and a day has fifteen of
   * them, so the whole set costs less than one landmark's ridge hunt.
   */
  private readonly dressings: StopDressingSite[];

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

    this.riverSide = mulberry32(subSeed(road.seed, 'river/side'))() < 0.5 ? -1 : 1;
    this.riverCourseSeed = subSeed(road.seed, 'river/course');
    this.riverWidthSeed = subSeed(road.seed, 'river/width');
    this.dressings = stopDressingSites(road);

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
      /*
       * Down from 0.42 (task 183's depth lever, wave 8's value lens
       * concurring from the other direction). Measured on final frames
       * (tools/shadowcast.mjs): a cast shadow on this ground dropped the
       * surface 0.08-0.12 in V against a lit value of 0.31-0.6 — 18-29% of
       * lit — while the reference's shadowed ground drops 0.31 against 0.77,
       * a 40% bite. "Blurred and only one step dark... they read as smudges
       * of dirt rather than as shapes with a caster" is four lenses saying
       * that same ratio in words. The colour side was fixed first
       * (CAST_SHADOW_HUE's chroma restore), so what deepens here deepens as
       * COLOUR, not as grey — the order of those two changes matters.
       * Depth only, one variable: the fray/edge work is untouched, and if
       * the next wave still reads smear, softness is its own run.
       */
      shadowDepth: 0.14,
    });

    // Vertex colours are on for the scatter materials too, and they are not
    // carrying the plant's colour — the instance colour does that. They
    // carry a *vertical gradient*, painted into each geometry, so a blade of
    // grass is dark where it meets the soil and a boulder is dark where it
    // is bedded in. It is the cheapest available substitute for contact
    // occlusion on meshes that cannot afford to receive a shadow map.
    /*
     * The grain came down from 0.55 to 0.26 and got four times coarser
     * (`grainScale` 0.5 to 0.13), and the variant it swings toward was pulled
     * most of the way back to white.
     *
     * This is the "dark stipple that reads as compression noise" three
     * separate critiques named in the same frames. The arithmetic behind the
     * complaint: `grainScale` 0.5 puts the noise's period at about two metres,
     * which is *smaller than the clumps it lands on* and, past twenty metres,
     * smaller than a pixel — so what it does at any distance the player
     * actually looks at is dither the value of every tuft independently. That
     * is the definition of speckle. Meanwhile `uGrain` 0.55 toward a variant
     * whose blue channel is 0.60 meant the dark end of the dither cost a tuft
     * a fifth of its value, per plant, at random.
     *
     * Coarse and gentle is what the term is for. At 0.13 the period is about
     * eight metres, so a whole patch of meadow drifts together and the drift
     * reads as ground varying rather than as plants disagreeing — which is
     * also what the terrain's own grain is set up to do (0.11, for exactly
     * this reason, and the two are now within a hair of each other on purpose).
     */
    this.foliageMaterial = createFoliageMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xefe9cf,
      grain: 0.26,
      grainScale: 0.13,
      sway: 0.2,
      swaySpeed: 1.5,
      swayAttribute: true,
      vertexColors: true,
      /*
       * **Flat shading off, and this is the fix the other two were waiting
       * for.**
       *
       * `PAINTERLY_FLAT_SHADING` derives the normal from the screen-space
       * derivative of the world position — `cross(dFdx(P), dFdy(P))`. That is
       * exact for a surface that covers several pixels and it is *noise* for
       * one that does not: a blade of grass is two or three centimetres wide,
       * so past a few metres it covers one or two pixels, and the neighbouring
       * fragments the derivative is taken against belong to a different blade,
       * to a different triangle of the same blade, or to the ground behind it.
       * Every blade was therefore being lit by an essentially arbitrary normal.
       *
       * That is why the meadow read as litter at every hour and under every
       * palette, and why two rounds of fixing it from the albedo side barely
       * moved: `skywardNormals` has been carefully tilting these normals toward
       * the sky since Run 45, `bandSoftness` was widened to stop the bands
       * stepping between them, and the shader was throwing both away before
       * the light was ever evaluated. Measured at noon, with the sun
       * overhead and every blade's true normal within eight degrees of
       * vertical, one tuft still ran from near-white to dark forest green.
       *
       * Nothing loses its facets for this. Every geometry here is non-indexed
       * and calls `computeVertexNormals`, which writes the FACE normal into
       * each of a triangle's three vertices — so the interpolated normal is
       * already constant across a face, and a shrub or a fern keeps exactly
       * the hard low-poly facets it had. The only shapes that change are the
       * ones `skywardNormals` deliberately edited, which is the whole point.
       */
      flatShading: false,
      shadowDepth: 0.5,
      /*
       * Soft bands, where every other opaque surface in the world takes the
       * default 0.07.
       *
       * A cel terminator is a stylisation of a *large* surface turning away
       * from the light, and the ground already has its own softness (0.45) for
       * exactly the reason that the band edge has to be small against the
       * thing it crosses. A blade of grass is the opposite case and the
       * default was failing it in the other direction: the whole blade is
       * narrower than one band edge, so each triangle landed wholly inside one
       * band or another and neighbouring blades came out a full light-step
       * apart. That is the per-blade flicker every critique of these frames
       * described — pale shard, dark shard, pale shard — and it is why a tuft
       * read as a handful of scattered debris rather than as one plant. With
       * a soft ramp a tuft varies across itself instead of stepping.
       */
      bandSoftness: 0.3,
      /*
       * Almost no rim, where the default is 0.2.
       *
       * `painterly.ts` already records that a flat additive rim turns grass
       * white, "because blades are thin and seen edge-on, so fresnel sits near
       * 1 across the whole blade rather than at its edge", and scales the term
       * by albedo to stop it. Scaling by albedo bounds the damage; it does not
       * remove it, because the term is still applied at full fresnel to every
       * fragment of every blade. At golden hour, where `rimColor` is two
       * thirds sun and `sunWrap` is at its highest, that measured as the whole
       * meadow coming out as pale straw shards over dark olive ground — a
       * value break of a stop and a half between a plant and the ground it
       * grows in, which is the litter read arriving by a third route after the
       * albedo and the band edges were both fixed.
       *
       * Grass does not need a rim to separate from the background; it needs to
       * NOT separate from the ground it belongs to. Kept just above zero so a
       * shrub against a bright sky still has an edge.
       */
      rim: 0.07,
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

    /*
     * The same material as the scatter above, with the haze turned down.
     *
     * A landmark exists to be walked toward, and measured against the frames
     * it was failing at exactly that: a chapel on a ridge at 150 m sat within
     * a few per cent of the sky behind it and read as less visible than a
     * nearby tree. The landmark system was placing it correctly — on a ridge,
     * biased to the side of the road the camera can see — and then the fog was
     * dissolving it.
     *
     * 0.5, not 0: a destination that ignores the atmosphere entirely detaches
     * from the country around it and reads as a decal pasted on the sky, which
     * is worse than being faint. Half the haze keeps it sitting in the same
     * air as the ridge it stands on while holding a value step against it.
     */
    this.landmarkMaterial = createPainterlyMaterial(globals, {
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
      fogScale: 0.5,
    });

    /*
     * Stop dressing, which is the landmark material's argument taken one step
     * further because the objects are one step smaller.
     *
     * A landmark is a chapel on a ridge and gets half the world's haze. A
     * busk pole is five metres of timber and half a metre of cloth standing
     * in a hollow, and at 0.5 the frame came back with a *pale post*: the
     * banner had lost its colour entirely, which is the one thing on the
     * marker doing any identifying work. Fog is a mix toward the sky, so what
     * it takes first is chroma, and chroma is exactly what a small distant
     * mark has instead of size.
     *
     * The rest of the treatment is the landmark's, unchanged. These are the
     * two categories of object in this world whose *purpose* is to be seen
     * from far away, and they should not disagree about anything else.
     */
    this.dressingMaterial = createPainterlyMaterial(globals, {
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
      fogScale: 0.28,
    });

    /*
     * The busk lantern's glass.
     *
     * The only light in the world that is not the fire and not the music, and
     * it is allowed under the art rules for the reason the brief states: a
     * lantern *is* fire. It behaves like one too — the emissive is the same
     * family the campfire uses, and the strength is set so the glass reads as
     * a source rather than as a pale object, which is the difference between
     * "there is a lantern there" and "there is a white blob there".
     *
     * `fogScale` is lower than the landmarks' because this is the smallest
     * thing in the game asked to be seen from the furthest away: four pixels
     * at 120 m, and haze at the scenery's rate would take most of them.
     */
    this.lanternMaterial = createPainterlyMaterial(globals, {
      color: 0xffca88,
      colorVariant: 0xffab5c,
      grain: 0.18,
      grainScale: 1.1,
      rim: 0.4,
      rimPower: 2,
      emissive: 0xffb163,
      emissiveStrength: 1.4,
      // A lamp does not have a shaded side worth speaking of.
      shadowDepth: 0.9,
      bandSoftness: 0.8,
      fogScale: 0.26,
    });

    /*
     * The camp's smoke.
     *
     * Three settings here are not taste and would break the plume if moved.
     *
     * `uOpacity` is reached into directly because `PainterlyOptions` has no
     * door for it — the uniform exists and is pinned at 1 for every other
     * material in the world, and this is the only surface that has any reason
     * to be see-through. `depthWrite` off, because a stack of translucent
     * puffs that writes depth punches its own neighbours out of the frame and
     * the column comes back as a lattice.
     *
     * And the sway is the strongest in the game. Every other swaying thing is
     * anchored at both ends by being a plant; a plume is anchored only at the
     * fire, and the whole of what makes it read as smoke rather than as a
     * grey monument is that its top wanders while its root does not.
     */
    this.smokeMaterial = createPainterlyMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xe8e2d8,
      grain: 0.3,
      grainScale: 0.16,
      rim: 0,
      vertexColors: true,
      swayAttribute: true,
      // Soft puff edges (task 181): per-vertex fade, 1 at each puff's
      // centre to 0 at its rim. See fadeAttribute in painterly.ts.
      fadeAttribute: true,
      sway: 0.85,
      swaySpeed: 0.32,
      shadowDepth: 0.88,
      bandSoftness: 1,
      transparent: true,
      fogScale: 0.7,
    });
    // Up from 0.36 with the fade: a squared centre-to-rim falloff halves a
    // puff's average coverage, and 0.36 of that made the 400 m telegraph
    // too faint to read. 0.52 keeps the plume's centre density where the
    // old flat plates sat while the rims now dissolve.
    this.smokeMaterial.uniforms.uOpacity.value = 0.52;
    this.smokeMaterial.depthWrite = false;

    /*
     * Open water, and the one place a fresnel rim is doing physics rather
     * than drawing an outline.
     *
     * A level surface seen from a camera 1.9 m up at twenty to eighty metres
     * is being looked at within a few degrees of grazing, and at grazing
     * incidence a dielectric returns nearly all of the light that reaches it.
     * `rim` in this shader is `pow(1 - dot(N, V), rimPower)` scaled by the
     * surface's own albedo and tinted between sky and sun — which is, near
     * enough, that. So a strong broad rim on a horizontal plane gives water
     * that brightens toward the far bank and toward the distance without a
     * reflection pass, a second camera, or a line of new shader code.
     *
     * `grainScale` is an order of magnitude coarser than anything else in the
     * world: a twenty-metre period, so the noise reads as slicks and currents
     * across the whole channel rather than as texture on it. And the bands are
     * softened almost flat, because a cel terminator on water is the one place
     * the stylisation reads as a mistake — water has no facets for a hard edge
     * to sit on.
     */
    this.waterMaterial = createPainterlyMaterial(globals, {
      color: 0xffffff,
      colorVariant: 0xdce8ee,
      grain: 0.24,
      grainScale: 0.05,
      // 0.28, not the 0.62 the argument above talks itself into. The physics
      // is right and the amount was not: at grazing incidence `fresnel` is
      // near 1 across the *whole* surface, so a strong rim is not a highlight
      // on water, it is a flat additive wash in sky colour over every pixel of
      // it — measured, the first build came back as a sheet of white paper
      // with no colour and no gradient left in it at all. This is the same
      // mistake the rim term's own comment in `painterly.ts` records being
      // made with grass, for the same reason: a thing seen edge-on has no
      // edge. Turned down until it reads as sheen rather than as light.
      rim: 0.28,
      rimPower: 1.5,
      vertexColors: true,
      flatShading: false,
      bandSoftness: 0.4,
      shadowDepth: 0.55,
      sway: 0,
      // Water is the one surface whose *colour* is the whole of what it says.
      // At full haze a channel forty metres off is mixed most of the way to
      // the sky and stops being blue, which is exactly the failure the
      // landmark material exists to fix — and for the same reason: this is a
      // thing the walk is meant to see.
      fogScale: 0.6,
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

  /**
   * Tilt an instance's rotation from "up" to the ground's own normal.
   *
   * Two details worth stating, because both were choices.
   *
   * The normal comes from `terrainHeight` by central difference at the same
   * one-metre step the terrain ribbon's own normals use. That is not an
   * approximation of the mesh, it *is* what the mesh is shaded by, so a log
   * lying here is lit as though it belongs to the ground under it rather
   * than to a slightly different surface.
   *
   * And the tilt is capped. The bank the road cuts reaches 32 degrees at its
   * very worst, and while a trunk really does lie at whatever angle it fell
   * on, past about a third of a right angle a low-poly log stops reading as
   * lying and starts reading as sliding. The cap costs nothing on the ground
   * that actually exists — the 95th percentile is 19 degrees — and bounds
   * what happens if the landform is ever made wilder than it is today.
   */
  private bedInGround(quat: Quaternion, x: number, z: number): void {
    const eps = 1;
    const dhdx = (terrainHeight(this.road, x + eps, z) - terrainHeight(this.road, x - eps, z)) / (2 * eps);
    const dhdz = (terrainHeight(this.road, x, z + eps) - terrainHeight(this.road, x, z - eps)) / (2 * eps);
    const slope = Math.hypot(dhdx, dhdz);
    if (slope < 1e-4) return;
    const capped = Math.min(slope, BEDDED_MAX_SLOPE);
    const k = capped / slope;
    this.scratchNormal.set(-dhdx * k, 1, -dhdz * k).normalize();
    this.scratchTilt.setFromUnitVectors(this.upAxis, this.scratchNormal);
    quat.premultiply(this.scratchTilt);
  }

  /**
   * The river's cross-section at `s`, memoised per whole metre.
   *
   * The cache is bounded by the road's own length in the ordinary case and
   * cleared rather than grown if a session ever walks far enough past it to
   * matter; a profile is six numbers, so a day's road is a few tens of
   * kilobytes.
   */
  private riverAt(s: number): RiverProfile {
    const key = Math.round(s);
    const cached = this.riverProfiles.get(key);
    if (cached) return cached;
    if (this.riverProfiles.size > 8192) this.riverProfiles.clear();
    const profile = this.buildRiverProfile(key);
    this.riverProfiles.set(key, profile);
    return profile;
  }

  private buildRiverProfile(s: number): RiverProfile {
    const half =
      RIVER_HALF_M + RIVER_HALF_VARY_M * fbm1D(this.riverWidthSeed, s / RIVER_WIDTH_WAVELENGTH_M, 2);
    const reach = half + RIVER_BANK_M + RIVER_SKIRT_M;
    // The clamp, not a hope: see RIVER_ROAD_CLEARANCE_M.
    const magnitude = Math.max(
      reach + RIVER_ROAD_CLEARANCE_M,
      RIVER_COURSE_M + RIVER_MEANDER_M * fbm1D(this.riverCourseSeed, s / RIVER_MEANDER_WAVELENGTH_M, 2),
    );
    const u = magnitude * this.riverSide;
    const strength = this.riverStrengthAt(s);
    const surfaceY = this.riverLevelAt(s, u) - RIVER_SURFACE_DROP_M;
    return {
      u,
      half,
      strength,
      reach,
      surfaceY,
      bedY: surfaceY - RIVER_DEPTH_M,
      crestY: surfaceY + RIVER_FREEBOARD_M,
    };
  }

  /**
   * How much river there is at `s`: none outside a riverside band, ramping in
   * and out over `RIVER_FADE_M` at its edges.
   *
   * The road's very first band does not fade in. A player opens the game at
   * `s = 0` and the whole point of the item this builds is that the riverside
   * has a river; starting them fifty-five metres short of one to satisfy a
   * symmetry nobody can see would be the wrong trade.
   */
  private riverStrengthAt(s: number): number {
    const band = this.road.bands.find((b) => s >= b.startS && s < b.endS);
    if (!band || band.biomeId !== 'riverside') return 0;
    const arriving = band.startS <= 0 ? 1 : smoothstep(0, RIVER_FADE_M, s - band.startS);
    const leaving = smoothstep(0, RIVER_FADE_M, band.endS - s);
    return Math.min(arriving, leaving);
  }

  /**
   * The water's level: the ground along the river's own course, averaged over
   * `RIVER_LEVEL_SPAN_M`.
   *
   * Averaging is the whole of it. `core/road`'s height field is a landform
   * (330 m and 205 m) plus two bump octaves at 52 m and 31 m, and it is the
   * bumps that would make a "level" surface visibly climb and fall along its
   * own length. Five stations spanning ~96 m sit close enough to a whole
   * period of both bumps to cancel most of them while leaving the landform
   * almost untouched — so the surface still follows the valley, which is what
   * a river does, and is flat across anything one frame can see.
   */
  private riverLevelAt(s: number, u: number): number {
    let sum = 0;
    for (let k = -2; k <= 2; k++) {
      const sample = sampleRoad(this.road, s + (k * RIVER_LEVEL_SPAN_M) / 4, this.riverScratch);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      sum += terrainHeight(this.road, sample.x + nx * u, roadZ(sample) + nz * u);
    }
    return sum / 5;
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

    this.refreshWater();
  }

  /**
   * Standing water, repainted when the sky it is reflecting has moved.
   *
   * A chunk bakes its instance colours once, and for everything else in the
   * world that is right — a tuft of grass has the same albedo all day and the
   * shader does the rest. Water does not: it has no albedo, and a puddle built
   * at golden hour and still on screen at dusk would be reflecting an hour
   * that has gone. The visible puddles are never more than about two and a
   * half chunks old, which at this road's pace is enough of the day for a
   * dusk sky to move a long way.
   *
   * Gated on the horizon colour actually having changed rather than run every
   * frame, so a walk at a steady hour costs one colour comparison per frame
   * and nothing else. The threshold is a quarter of a level in eight-bit
   * terms, well below anything visible, so this repaints often enough that
   * no two puddles on screen disagree about the hour.
   */
  private refreshWater(): void {
    const horizon = this.globals.uHorizonColor.value;
    const moved =
      Math.abs(horizon.r - this.paintedHorizon.r) +
      Math.abs(horizon.g - this.paintedHorizon.g) +
      Math.abs(horizon.b - this.paintedHorizon.b);
    if (moved < 0.001) return;
    this.paintedHorizon.copy(horizon);
    for (const chunk of this.chunks.values()) {
      for (const field of chunk.water) this.paintWater(field);
    }
  }

  /**
   * The colour of standing water at this hour.
   *
   * Two rules, and the second is the one that matters. First, the hue is the
   * sky's: a horizontal mirror seen from a walking camera returns the band of
   * sky just above the horizon, so this starts at `uHorizonColor` and is
   * pulled a little way back toward the road so that a puddle still belongs
   * to the earth it is lying in. Second, and regardless of what the first
   * rule produced, it is never dark: a puddle is the lightest thing on the
   * carriageway at every hour of the day, and the floor here is what
   * guarantees that at the hours when the sky itself has gone dim. Without
   * it, dusk and night hand back exactly the navy shard this replaced.
   *
   * The two numbers turn out to divide the day cleanly between them, which is
   * why both are here rather than one being tuned to cover both cases. At the
   * bright hours the mix sets the value and the floor never binds: shot at
   * 0.34 the tablet frame's puddle came back at L135.9 against a road of
   * L68.4, which reads less as water than as a spill of milk, so the mix is
   * most of the way to the earth now and lands the same puddle at about half
   * again the road rather than double it. At dusk the horizon has so little
   * value left that the mix falls below the floor and the floor sets the
   * value instead — measured, a dusk puddle sits at 1.3 times its road before
   * the floor and 1.75 after. So the mix is the bright hours' dial and the
   * floor is the dark hours', and neither reaches into the other's half of
   * the day.
   */
  private paintWater(field: WaterField): void {
    const horizon = this.globals.uHorizonColor.value;
    const floor = luminanceOf(field.floorFrom) * field.floorScale;

    /*
     * The floor is one scale for the whole field, taken from its mean mix,
     * rather than a clamp applied per entry.
     *
     * A puddle field barely notices the difference — its entries span 0.14 of
     * mix and land within a couple of per cent of each other. The river does:
     * its entries span a deliberate gradient from a bright rim to a deep
     * middle, and a per-entry clamp is exactly the operation that would flatten
     * it, because at the hours the floor binds it binds on the dark end first
     * and lifts it to meet the light one. Scaling the whole field preserves
     * every ratio inside it and still guarantees the promise the floor exists
     * to make: water is never the dark thing in the frame.
     */
    let meanMix = 0;
    for (let i = 0; i < field.mix.length; i++) meanMix += field.mix[i];
    meanMix /= Math.max(1, field.mix.length);
    const reference = this.scratchColor.copy(horizon).lerp(field.toward, meanMix);
    const referenceLum = luminanceOf(reference);
    const lift = referenceLum < floor ? floor / Math.max(referenceLum, 0.0001) : 1;

    const instanced = field.mesh instanceof InstancedMesh ? field.mesh : null;
    const vertexColor = instanced
      ? null
      : (field.mesh.geometry.attributes.color as BufferAttribute);

    for (let i = 0; i < field.mix.length; i++) {
      const water = this.scratchColor.copy(horizon).lerp(field.toward, field.mix[i]);
      water.multiplyScalar(lift);
      water.r = Math.min(1, water.r);
      water.g = Math.min(1, water.g);
      water.b = Math.min(1, water.b);
      if (instanced) instanced.setColorAt(i, water);
      else vertexColor?.setXYZ(i, water.r, water.g, water.b);
    }
    if (instanced) {
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    } else if (vertexColor) {
      vertexColor.needsUpdate = true;
    }
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

    const water: WaterField[] = [];

    // Before the scatter, because the reeds on its banks are placed from the
    // same profile and it is the one thing in the chunk they all defer to.
    const river = this.buildRiverSurface(index);
    if (river) {
      group.add(river.mesh);
      meshes.push(river.mesh);
      water.push(river.field);
    }

    for (const kind of SCATTER_KINDS) {
      if (distanceM > kind.lodRange) continue;
      for (const mesh of this.buildScatter(index, kind, landmarks, water)) {
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

    // Last, and at full detail whatever the chunk's LOD: a marker exists to
    // be seen from four hundred metres, so the one place it must not be
    // thinned is the distance it is for.
    for (const site of this.dressings) {
      if (Math.floor(site.z / CHUNK_LENGTH) !== index) continue;
      for (const mesh of this.dressStop(site)) {
        group.add(mesh);
        meshes.push(mesh);
      }
    }

    this.group.add(group);
    return { index, group, meshes, water, detail: detailAt(distanceM) };
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
    // Every row grows the same number of extra columns around the river's
    // centreline, whether or not there is a river there. Constant, because the
    // index buffer is built once for the whole chunk; a pure function of `s`,
    // because two neighbouring chunks share a row and would otherwise tear.
    const cols = ACROSS_SAMPLES + RIVER_COLUMN_STOPS * 2 - 1;
    const vertexCount = rows * cols;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const toneLo = new Float32Array(vertexCount * 3);
    const toneHi = new Float32Array(vertexCount * 3);
    /** `d(rut drop)/du` per vertex, and the road's lateral direction per row. */
    const lateralSlope = new Float32Array(vertexCount);
    const rowNx = new Float32Array(rows);
    const rowNz = new Float32Array(rows);
    const rowX = new Float64Array(rows);
    const rowZ = new Float64Array(rows);
    const rowRiver: RiverProfile[] = [];
    /** Which lateral offset each vertex was built at, for the normal pass. */
    const rowOffsets = new Float64Array(vertexCount);
    const merged = new Float64Array(cols);

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
      rowNx[r] = nx;
      rowNz[r] = nz;

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
      const bankColor = mixColor(palette.bank, blendPalette.bank, bandBlend);
      const laneY = sample.y;

      const river = this.riverAt(s);
      rowRiver.push(river);
      rowX[r] = sample.x;
      rowZ[r] = roadZ(sample);
      riverColumnDistances(river, this.riverColumns);
      mergeRiverColumns(river, this.riverColumns, merged);

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
        const u = merged[c];
        const x = sample.x + nx * u;
        const z = roadZ(sample) + nz * u;
        // The rut and the river channel are both cut into the graded surface
        // rather than into `terrainHeight`, which stays the one authority on
        // where the ground is: the bard's footing, the camera's clearance and
        // every prop in the world are placed by it. Everything that stands
        // *in* the rut band is placed through `roadSurfaceAt` instead, and
        // everything in the channel through `riverShape` — see `buildScatter`.
        const riverD = Math.abs(u - river.u);
        const y = riverShape(river, riverD, terrainHeight(this.road, x, z)) + rutDrop(u);

        const i = (r * cols + c) * 3;
        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;
        // Kept for the normal pass below, where the rut has to be added
        // analytically because the pass's own step is wider than the rut.
        lateralSlope[r * cols + c] = rutSlope(u);
        rowOffsets[r * cols + c] = u;

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
          // Deepened again (0.46 -> 0.58) on 2026-07-31: the carriageway fills
          // the near half of every walking frame, so its ruts are the largest
          // dark mark available in the one part of the picture that most needs
          // one — and they are structure rather than speckle, which is the
          // whole distinction the grass work in this file rests on.
          const rut = Math.abs(absU - ROAD_HALF_WIDTH * 0.58);
          if (rut < 0.42) track = mixColor(track, 0x2a1d12, 0.58 * (1 - rut / 0.42));
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
          lo = mixColor(color, 0x36291c, 0.64);
          hi = mixColor(color, dryColor, 0.3);
        } else if (absU <= SHOULDER) {
          const t = (absU - ROAD_HALF_WIDTH) / (SHOULDER - ROAD_HALF_WIDTH);
          const w = t * t;
          const meadow = meadowAt(x, z, y);
          const track = trackAt();
          color = mixColor(track, meadow, w);
          lo = mixColor(mixColor(track, 0x36291c, 0.64), shadeColor, w);
          hi = mixColor(mixColor(track, dryColor, 0.3), dryColor, w);
        } else {
          color = meadowAt(x, z, y);
          lo = shadeColor;
          hi = dryColor;
        }

        /*
         * The bank is a different material from the meadow it interrupts.
         *
         * Without this the channel is a green trench with blue in the bottom,
         * and a river drawn on grass reads as a ribbon of paint. Silt is what
         * actually lines a watercourse, and the value break between a warm
         * pale bank and the cool greens either side of it is what makes the
         * waterline a real edge rather than a change of tint. Weighted to the
         * bed and the lower bank and gone by the outside of the skirt, so
         * there is no line where the mud stops.
         */
        if (river.strength > 0 && riverD < river.reach) {
          // Held at full strength across the bed and the bank and gone a third
          // of the way up the skirt, rather than fading from the water's edge
          // outward. Faded from the edge, the silt was already half meadow by
          // the time it reached the waterline — which is the one place it has
          // to be unambiguous, because that line is the whole read.
          const wet =
            (1 -
              smoothstep(
                river.half + RIVER_BANK_M,
                river.half + RIVER_BANK_M + RIVER_SKIRT_M * 0.75,
                riverD,
              )) *
            river.strength;
          color = mixColor(color, bankColor, wet * 0.92);
          lo = mixColor(lo, mixColor(bankColor, shadeColor, 0.45), wet * 0.92);
          hi = mixColor(hi, mixColor(bankColor, dryColor, 0.4), wet * 0.92);
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
      //
      // The rut cannot come through this difference and must not be asked
      // to: the step is a metre and the whole rut is 0.84 m across, so a
      // central difference straddles it and reports the flat ground on
      // either side. Its slope is added analytically instead — the drop is a
      // function of the lateral offset alone, so its gradient is
      // `d(drop)/du` pointed along the road's own lateral direction.
      const row = Math.floor(i / cols);
      /*
       * The channel cannot come through the difference above either, and for
       * the opposite reason to the rut: it is eighteen metres across against a
       * one-metre step, so the step resolves it perfectly well — but the carve
       * is not *in* `terrainHeight` at all, by the design decision at the top
       * of this file. So its own lateral gradient is differenced separately,
       * at a step short enough to sit inside the bank, and added along the
       * road's lateral direction exactly as the rut's is. Only the vertices
       * the channel actually reaches pay for it.
       */
      const river = rowRiver[row];
      let riverSlope = 0;
      const u = rowOffsets[i];
      if (river.strength > 0 && Math.abs(u - river.u) < river.reach) {
        const step = 0.4;
        const nx = rowNx[row];
        const nz = rowNz[row];
        let carved = 0;
        let natural = 0;
        for (const dir of [-1, 1]) {
          const uu = u + dir * step;
          const raw = terrainHeight(this.road, rowX[row] + nx * uu, rowZ[row] + nz * uu);
          natural += dir * raw;
          carved += dir * riverShape(river, Math.abs(uu - river.u), raw);
        }
        riverSlope = (carved - natural) / (2 * step);
      }
      const slope = lateralSlope[i] + riverSlope;
      const dhdx =
        (terrainHeight(this.road, x + eps, z) - terrainHeight(this.road, x - eps, z)) / (2 * eps) +
        slope * rowNx[row];
      const dhdz =
        (terrainHeight(this.road, x, z + eps) - terrainHeight(this.road, x, z - eps)) / (2 * eps) +
        slope * rowNz[row];
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
   * Where the open water ends on one side of the channel: the first place,
   * going outward, that the carved ground rises through the surface.
   *
   * Found by walking out rather than by solving the profile, and that is the
   * point. The bank's own shape is analytic and could be inverted, but the
   * ground it is blended into is not — a bank that runs into a natural rise
   * meets the water sooner on that side than on the other, and a river whose
   * two edges are always the same distance from its centre is a canal. This
   * gives the waterline the irregularity for free, out of terrain the world
   * already has.
   */
  private waterEdge(
    profile: RiverProfile,
    sample: RoadSample,
    nx: number,
    nz: number,
    dir: number,
  ): number {
    if (profile.strength <= 0) return 0;
    const step = 0.5;
    for (let d = 0; d <= profile.reach; d += step) {
      const u = profile.u + dir * d;
      const ground = riverShape(
        profile,
        d,
        terrainHeight(this.road, sample.x + nx * u, roadZ(sample) + nz * u),
      );
      if (ground >= profile.surfaceY) return Math.max(0, d - step * 0.5);
    }
    return profile.reach;
  }

  /**
   * The river's surface for one chunk: one strip, level across every row.
   *
   * Two things are worth stating because both were choices.
   *
   * The strip is drawn *wider than the water actually is* — half a metre past
   * where the bank was found to rise through it — and the terrain is left to
   * hide the excess. A strip cut exactly to the waterline leaves a hairline of
   * dry bank showing wherever the mesh's own linear interpolation disagrees
   * with the search's step, all the way along both banks; overshooting into
   * ground that is already above the water costs nothing, because the depth
   * buffer resolves it, and it is the only version with no seam.
   *
   * And the surface's height is one number per row, not per vertex. That is
   * the entire definition of "level" here, and it is what makes this read as
   * water rather than as a blue-tinted piece of terrain: the ground under it
   * rolls, the surface does not, and the varying gap between them is what the
   * eye reads as depth.
   */
  private buildRiverSurface(index: number): { mesh: Mesh; field: WaterField } | null {
    const s0 = index * CHUNK_LENGTH;
    // Cheap gate first: three probes across the chunk, so a forest chunk pays
    // three band lookups instead of a thousand height samples.
    if (
      this.riverStrengthAt(s0) <= 0 &&
      this.riverStrengthAt(s0 + CHUNK_LENGTH / 2) <= 0 &&
      this.riverStrengthAt(s0 + CHUNK_LENGTH) <= 0
    ) {
      return null;
    }

    const rows = ALONG_SAMPLES;
    const cols = RIVER_SURFACE_COLS;
    const count = rows * cols;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const mix = new Float32Array(count);
    let open = false;

    for (let r = 0; r < rows; r++) {
      const s = s0 + (r / (rows - 1)) * CHUNK_LENGTH;
      const sample = sampleRoad(this.road, s);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      const river = this.riverAt(s);
      const inner = this.waterEdge(river, sample, nx, nz, -1);
      const outer = this.waterEdge(river, sample, nx, nz, 1);
      if (inner + outer > 0.9) open = true;
      // A slow drift along the course, so the channel is not one flat wash
      // from the first chunk to the last. Two octaves at a ~35 m period: long
      // enough to read as the water changing rather than as noise on it.
      const drift = 0.05 * fbm1D(this.riverWidthSeed, s / 35, 2);
      const left = river.u - (inner + 0.5);
      const right = river.u + (outer + 0.5);

      for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1);
        const u = left + t * (right - left);
        const i = (r * cols + c) * 3;
        positions[i] = sample.x + nx * u;
        positions[i + 1] = river.surfaceY;
        positions[i + 2] = roadZ(sample) + nz * u;
        // A level plane has one normal, and saying so is cheaper and steadier
        // than computing it: `computeVertexNormals` on a strip whose width
        // changes row to row would tilt the ends of every row a little.
        normals[i] = 0;
        normals[i + 1] = 1;
        normals[i + 2] = 0;
        const centre = 1 - Math.abs(t * 2 - 1);
        mix[r * cols + c] = clamp01(
          RIVER_MIX_EDGE +
            (RIVER_MIX_CENTRE - RIVER_MIX_EDGE) * centre * centre * (3 - 2 * centre) +
            drift,
        );
      }
    }
    if (!open) return null;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
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
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mesh = new Mesh(geometry, this.waterMaterial);
    mesh.name = `river-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = this.castShadows;

    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));
    const field: WaterField = {
      mesh,
      toward: new Color().setHex(palette.waterDeep),
      mix,
      // Floored against the shallow tone rather than against the grass: it is
      // the palette's own statement of how bright this water is allowed to
      // get, and flooring against a *ground* colour would tie the river's
      // night value to a ground albedo that has been retuned twice.
      floorFrom: new Color().setHex(palette.waterShallow),
      floorScale: 0.62,
    };
    this.paintWater(field);
    return { mesh, field };
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
    water: WaterField[],
  ): InstancedMesh[] {
    const s0 = index * CHUNK_LENGTH;
    const rand = mulberry32(subSeed(this.road.seed, `scatter:${kind.key}:${index}`));
    const palette = paletteFor(biomeAt(this.road, s0 + CHUNK_LENGTH / 2));

    const zones = kind.zones ?? [[kind.clearance, kind.spread] as [number, number]];
    let bandWidth = 0;
    for (const zone of zones) bandWidth += zone[1] - zone[0];

    if (kind.riverBand) {
      // Same cheap gate the water surface uses: a kind that grows on a
      // riverbank costs nothing at all in the two bands that have no river.
      if (
        this.riverStrengthAt(s0) <= 0 &&
        this.riverStrengthAt(s0 + CHUNK_LENGTH / 2) <= 0 &&
        this.riverStrengthAt(s0 + CHUNK_LENGTH) <= 0
      ) {
        return [];
      }
      bandWidth = (kind.riverBand[1] - kind.riverBand[0]) * RIVER_BANK_M;
    }

    const area = CHUNK_LENGTH * bandWidth * 2;
    const count = Math.max(
      0,
      Math.round(area * kind.perSquareMetre * palette.density[kind.densityKey] * this.density),
    );
    if (count === 0) return [];

    const variants = Math.max(1, kind.variants ?? 1);
    const bias = kind.edgeBias ?? 1;
    const clump = kind.clump ?? 0;
    const buckets: Array<Array<{ matrix: Matrix4; color: number; variation: number }>> = [];
    for (let v = 0; v < variants; v++) buckets.push([]);

    // Clump state: where the current group is centred, which side and which
    // band it belongs to, and how many are left in it. A clump is a handful
    // of plants sharing one patch of ground, so members are jittered around
    // the centre rather than re-drawn from the whole band.
    let clumpS = 0;
    let clumpMagnitude = 0;
    let clumpSide = 1;
    let clumpZone = zones[0];
    let clumpScale = 1;
    let clumpDropped = false;
    let clumpRiver: RiverProfile | null = null;
    let remaining = 0;

    for (let i = 0; i < count; i++) {
      if (remaining <= 0) {
        clumpS = s0 + rand() * CHUNK_LENGTH;
        clumpSide = rand() < 0.5 ? -1 : 1;
        clumpZone = pickZone(rand, zones, bandWidth);
        const t = bias === 1 ? rand() : Math.pow(rand(), bias);
        clumpMagnitude = clumpZone[0] + t * (clumpZone[1] - clumpZone[0]);
        remaining = clump > 0 ? 1 + Math.floor(rand() * clump * 1.5) : 1;
        // One size per patch, on top of the per-plant variation below. A
        // clump whose members are drawn independently from the full range has
        // the same average size as its neighbours; one that is small all over
        // reads as younger, thinner ground, and that difference between
        // patches is a second axis of variation for one random draw.
        clumpScale = randRange(rand, 0.82, 1.16);
        clumpRiver = kind.riverBand ? this.riverAt(clumpS) : null;
        if (kind.riverBand) {
          const profile = clumpRiver as RiverProfile;
          clumpDropped = profile.strength <= 0.2;
          const lo = profile.half + kind.riverBand[0] * RIVER_BANK_M;
          const hi = profile.half + kind.riverBand[1] * RIVER_BANK_M;
          clumpMagnitude = lo + t * (hi - lo);
          clumpZone = [lo, hi];
        } else if (kind.thin) {
          // Thinned against the ground's own lushness field, not against a
          // fresh noise: the pale ground and the bare ground have to be the
          // same ground or the cover argues with what it is standing on.
          const centre = sampleRoad(this.road, clumpS, this.riverScratch);
          const cx = centre.x + Math.cos(centre.heading) * clumpSide * clumpMagnitude;
          const cz = roadZ(centre) - Math.sin(centre.heading) * clumpSide * clumpMagnitude;
          clumpDropped = rand() < meadowDryness(cx, cz) * kind.thin;
        } else {
          clumpDropped = false;
        }
      }
      remaining--;
      if (clumpDropped) continue;

      // The clump radius grows with the plant unless the kind says otherwise:
      // a stand of ferns is two metres across, a patch of grass is not.
      const spreadIn = clump > 0 ? (kind.clumpRadius ?? 0.55 + clump * 0.22) : 0;
      // Sideways, a clump can never be wider than the band it grows in. Let
      // it be, and every member lands on one edge or the other and the band
      // fills with two lines instead of a patch — which is what the crown of
      // the road did on the first attempt, since a metre-wide clump does not
      // fit in a quarter-metre strip. The meadow bands are tens of metres
      // across and never reach this.
      const lateral = Math.min(spreadIn, (clumpZone[1] - clumpZone[0]) * 0.5);
      /*
       * Members fall on a *radius* with density falling off from the middle,
       * not on a square of uniform jitter.
       *
       * This is the second half of "clump, don't scatter", and without it the
       * first half buys almost nothing: a uniform box of jitter is an even
       * scatter over a small area, so a clump of seven reads as seven separate
       * plants that happen to be near each other. `pow(rand, 0.8)` on the
       * radius puts the density highest at the centre and trailing off at the
       * rim, which is a patch with a middle — and a patch with a middle is
       * what the eye reads as one plant colony rather than as debris.
       */
      const spin = rand() * Math.PI * 2;
      const reach = clump > 0 ? Math.pow(rand(), 0.8) : 0;
      const s = clumpS + Math.cos(spin) * reach * spreadIn;
      // Held inside the band it was drawn from, rather than merely pushed
      // off the centreline. That is how a tuft used to end up growing in a
      // wheel rut: the jitter is free to leave the band, so the only
      // correction that works is one the band itself defines.
      const magnitude = clamp(
        clumpMagnitude + Math.sin(spin) * reach * lateral,
        clumpZone[0],
        clumpZone[1],
      );

      const sample = sampleRoad(this.road, s);
      const nx = Math.cos(sample.heading);
      const nz = -Math.sin(sample.heading);
      // A riverbank kind measures its offset from the channel's centreline;
      // everything else measures it from the road's.
      const river = clumpRiver ?? this.riverAt(s);
      const u = clumpRiver ? river.u + clumpSide * magnitude : clumpSide * magnitude;
      const x = sample.x + nx * u;
      const z = roadZ(sample) + nz * u;
      // Carriageway kinds stand on the graded surface, rut and all; anything
      // in the channel stands on the carved bank. Off the road `rutDrop` is
      // zero and away from the river `riverShape` is the identity, so for most
      // of the world this is still plainly `terrainHeight` — and a puddle,
      // which is the one kind placed *in* the rut, sits on its floor instead
      // of hovering where the flat road used to be.
      const riverD = Math.abs(u - river.u);
      const ground = riverShape(river, riverD, terrainHeight(this.road, x, z));
      const y = ground + rutDrop(u) + (kind.lift ?? 0);
      // Nothing that is not a reed grows under water. Tested here rather than
      // by narrowing every kind's band, because the waterline is a property of
      // the ground and not of the scatter: it moves with the terrain, and a
      // band wide enough to be safe everywhere would be a bare margin around
      // the whole river.
      // The bank belongs to the kinds placed for it. A meadow tuft on a silt
      // bank is not merely wrong about the ground it is standing on — it is
      // what closed the one value break the waterline has to hold, because the
      // cover carried its own colour over the top of the mud.
      const drowned =
        !kind.riverBand &&
        river.strength > 0 &&
        riverD < river.reach &&
        (ground < river.surfaceY + 0.12 || riverD < river.half + RIVER_BANK_M * 1.5);

      this.scratchPos.set(x, y, z);
      this.scratchQuat.setFromAxisAngle(this.upAxis, rand() * Math.PI * 2);
      if (kind.bedded) this.bedInGround(this.scratchQuat, x, z);
      const scale = randRange(rand, kind.scale[0], kind.scale[1]) * clumpScale;
      // Non-uniform scaling on the vertical axis: a field where every tuft
      // is a scaled copy of one tuft reads as wallpaper. Kept narrow —
      // at 1.3 the tallest grass came out half again as tall as the
      // geometry was drawn to be, which is how the ankle-high tufts ended
      // up at the bard's knee.
      this.scratchScale.set(scale, scale * randRange(rand, 0.85, 1.15), scale);
      const variant = variants === 1 ? 0 : Math.floor(rand() * variants);
      // One draw either way, so a sky-lit kind places exactly where it placed
      // when it had a colorOf. White is a placeholder: paintWater writes the
      // real instance colours before the mesh is ever drawn.
      const variation = kind.skyLit ? rand() : 0;
      const color = kind.colorOf ? kind.colorOf(palette, rand) : 0xffffff;
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
      if (drowned) continue;
      if (
        kind.castShadow &&
        (this.inClearing(x, z) || insideLandmark(landmarks, x, z) || this.insideDressing(x, z))
      ) {
        continue;
      }
      buckets[variant].push({
        matrix: new Matrix4().compose(this.scratchPos, this.scratchQuat, this.scratchScale),
        color,
        variation,
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
      if (kind.skyLit) {
        const road = new Color().setHex(palette.road);
        const field: WaterField = {
          mesh,
          toward: road,
          mix: new Float32Array(list.map((entry) => 0.72 + entry.variation * 0.14)),
          floorFrom: road,
          floorScale: 1.75,
        };
        water.push(field);
        this.paintWater(field);
      }
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
      const river = this.riverAt(s);
      const riverD = Math.abs(u - river.u);
      const y = riverShape(river, riverD, terrainHeight(this.road, x, z));
      // Willows lean over water; nothing grows *in* it. A tree standing on the
      // bed with its trunk through the surface is the single most obvious way
      // to make a river read as a texture rather than as a place.
      const drowned = river.strength > 0 && riverD < river.reach && y < river.surfaceY + 0.4;

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
      if (drowned || this.inClearing(x, z) || insideLandmark(landmarks, x, z) || this.insideDressing(x, z)) {
        continue;
      }
      const list = buckets.get(key);
      if (list) list.push({ matrix, color });
      else buckets.set(key, [{ matrix, color }]);
    }

    /*
     * The wayside sentinels (task 180, guaranteed by task 167): one large
     * tree per stretch stood INSIDE the ordinary tree verge, close enough to
     * the road that walking past it puts a trunk or a canopy mass across the
     * frame's edge.
     *
     * Every A Short Hike reference frame crops canopy, cliff or rock through
     * its edges; every one of this game's postcards opened on a clean ground
     * plane, and two critique waves running named it — "frame edges left
     * untouched" (wave 8, seven frames), with 04's tent the sole exception
     * and explicitly kept. A composed near mass is the cheapest depth the
     * frame can buy, and it has to be a WORLD object, not a camera-attached
     * wing: the walk is live, and a mass that moves with the camera is a
     * sticker on the lens.
     *
     * Placement lives in `waysideSentinelSites` — pure, exported, and pinned
     * by its own tests, because the wave-9 panel showed this system leaking
     * silently. Scale runs above the ordinary spread's top: a sentinel is
     * composition, and a small one is just a misplaced tree. The static
     * exclusions (river, landmarks, stop dressings) redraw the site rather
     * than deleting it; the camp clearing is dynamic and is the one check
     * that still simply drops the tree, so a dusk rebuild never moves one.
     */
    const sentinelSites = waysideSentinelSites(this.road, index, (s, u, x, z) => {
      const river = this.riverAt(s);
      const riverD = Math.abs(u - river.u);
      const y = riverShape(river, riverD, terrainHeight(this.road, x, z));
      const drowned = river.strength > 0 && riverD < river.reach && y < river.surfaceY + 0.4;
      return drowned || insideLandmark(landmarks, x, z) || this.insideDressing(x, z);
    });
    for (const site of sentinelSites) {
      if (this.inClearing(site.x, site.z)) continue;
      const look = mulberry32(site.seed);
      const kind = weightedPick(look, palette.trees, (entry) => entry.weight).kind;
      const variant = Math.floor(look() * TREE_VARIANTS);
      const key = `${kind}:${variant}`;

      const river = this.riverAt(site.s);
      const riverD = Math.abs(site.u - river.u);
      const y = riverShape(river, riverD, terrainHeight(this.road, site.x, site.z));
      this.scratchPos.set(site.x, y - 0.15, site.z);
      this.scratchQuat.setFromAxisAngle(this.upAxis, look() * Math.PI * 2);
      const scale = randRange(look, 1.35, 1.7);
      this.scratchScale.set(scale, scale * randRange(look, 1.0, 1.3), scale);
      const matrix = new Matrix4().compose(this.scratchPos, this.scratchQuat, this.scratchScale);

      const shade =
        kind === 'conifer'
          ? look() * 0.4
          : kind === 'willow'
            ? 0.35 + look() * 0.5
            : 0.3 + look() * 0.7;
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
      material = this.landmarkMaterial;
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

  /**
   * Build one stop's dressing. One mesh, except the busk pitch, which is two:
   * the pole and everything on it, plus the lantern's lit glass on its own
   * emissive material.
   *
   * The two share a transform rather than a group, because the glass's
   * geometry is already built at its anchor in the pole's frame — so the
   * lantern cannot come adrift from the crossbar it hangs on, however either
   * shape is retuned.
   */
  private dressStop(site: StopDressingSite): Mesh[] {
    const palette = paletteFor(biomeAt(this.road, site.s));
    const seed = 600 + site.variant * 149;
    const meshes: Mesh[] = [];

    if (site.shape === 'smoke') {
      const mesh = new Mesh(
        cachedGeometry(`smoke:${palette.id}:${site.variant}`, () =>
          smokeColumnGeometry({
            // Near-white, warmed at the mouth and cooled as it goes: smoke is
            // the one surface in the world whose albedo is genuinely neutral,
            // and the band's own tones are borrowed only far enough that a
            // forest plume and a riverside plume are not the same grey.
            base: mixColor(0xf4ece0, palette.grassDry, 0.3),
            tip: mixColor(0xeceef0, palette.rock, 0.2),
            lean: site.rotation,
            seed,
          }),
        ),
        this.smokeMaterial,
      );
      mesh.position.set(site.x, site.y, site.z);
      // No shadow, either way. A translucent plume has no business stamping
      // one on the camp it is rising out of.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.name = 'stop-smoke';
      meshes.push(mesh);
      return meshes;
    }

    if (site.shape === 'pitch') {
      const pitch = new Mesh(
        cachedGeometry(`buskpitch:${palette.id}:${site.variant}`, () =>
          buskPitchGeometry({
            timber: mixColor(palette.trunk, palette.rock, 0.22),
            // Undiluted accent, for the reason the chapel roof records: a
            // marker is seen through eighty metres of haze, haze is already a
            // mix toward grey, and anything pre-greyed arrives as slate.
            cloth: palette.accent,
            iron: mixColor(palette.rock, palette.trunk, 0.55),
            seed,
          }),
        ),
        this.dressingMaterial,
      );
      pitch.position.set(site.x, site.y, site.z);
      pitch.rotation.y = site.rotation;
      pitch.castShadow = this.castShadows;
      pitch.receiveShadow = this.castShadows;
      pitch.name = 'stop-busk';
      meshes.push(pitch);

      const glass = new Mesh(
        cachedGeometry('busklantern', () => lanternGlowGeometry()),
        this.lanternMaterial,
      );
      glass.position.copy(pitch.position);
      glass.rotation.y = site.rotation;
      glass.name = 'stop-busk-lantern';
      meshes.push(glass);
      return meshes;
    }

    const cairn = new Mesh(
      cachedGeometry(`wayside:${palette.id}:${site.variant}`, () =>
        waysideCairnGeometry({
          // The cool counterpart to the ridge landmarks' stone, which is
          // pulled toward the dry grass. Same rock, opposite direction, and
          // the difference is the whole of what says "meeting" rather than
          // "monument".
          stone: mixColor(palette.rock, palette.grassShade, 0.28),
          roof: mixColor(palette.canopy, palette.rock, 0.45),
          seed,
        }),
      ),
      this.dressingMaterial,
    );
    cairn.position.set(site.x, site.y - 0.12, site.z);
    cairn.rotation.y = site.rotation;
    cairn.castShadow = this.castShadows;
    cairn.receiveShadow = this.castShadows;
    cairn.name = 'stop-wayside';
    meshes.push(cairn);
    return meshes;
  }

  /**
   * Ground a stop's dressing has claimed.
   *
   * Its own list rather than `clearings`, and that is load-bearing: the camp
   * strikes its clearing at the end of the day with `clearClearings`, and a
   * marker that gave its ground back would find a shrub planted in front of
   * it. This ground is a property of the seed and is claimed for the whole
   * day, exactly as a landmark's is.
   *
   * Scanned in full rather than indexed by chunk, because it is only ever
   * asked about the few kinds big enough to hide something — shrubs, logs,
   * boulders and trees — and a day has fifteen stops.
   */
  private insideDressing(x: number, z: number): boolean {
    for (const site of this.dressings) {
      const dz = z - site.z;
      if (dz > site.radius || dz < -site.radius) continue;
      const dx = x - site.x;
      if (dx * dx + dz * dz < site.radius * site.radius) return true;
    }
    return false;
  }

  private disposeChunk(chunk: Chunk): void {
    this.group.remove(chunk.group);
    for (const mesh of chunk.meshes) {
      // Terrain geometry is unique per chunk and must go. Scatter geometry
      // is shared out of the cache and must NOT — disposing it would blank
      // every other chunk using the same grass tuft.
      if (mesh.name.startsWith('terrain-') || mesh.name.startsWith('river-')) {
        mesh.geometry.dispose();
      }
      if (mesh instanceof InstancedMesh) mesh.dispose();
    }
    chunk.meshes.length = 0;
    chunk.water.length = 0;
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.foliageMaterial.dispose();
    this.solidMaterial.dispose();
    this.waterMaterial.dispose();
    this.landmarkMaterial.dispose();
    this.dressingMaterial.dispose();
    this.lanternMaterial.dispose();
    this.smokeMaterial.dispose();
    for (const material of this.trunkMaterials.values()) material.dispose();
    this.trunkMaterials.clear();
  }
}
