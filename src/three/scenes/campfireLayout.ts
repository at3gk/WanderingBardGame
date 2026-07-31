/**
 * Where everything in the camp sits.
 *
 * The arrangement is the picture. A campfire scene is carried almost
 * entirely by composition — a readable ring, a bedroll far enough back that
 * the firelight only just reaches it, an instrument propped where the eye
 * lands after the flame — and none of that survives being improvised inside
 * a constructor next to a pile of `new Mesh` calls. So the placement is a
 * pure function here, and `Campfire.ts` is left with nothing to decide.
 *
 * Being pure buys three things that matter:
 *
 * - **The invariants are testable.** Nothing may sit in the fire, nothing
 *   may sit on the road, nothing may stand inside anything else, and the
 *   bedroll must be on the far side of the fire from the road. Those are
 *   claims about geometry, and a few hundred seeds either satisfy them or
 *   they don't. Eyeballing one camp proves nothing about the next.
 * - **It is the same camp for everyone.** The road is shared (see
 *   `core/rng`), and a camp that differed between two players standing at
 *   the same stop would be the one place in the day the shared road broke.
 * - **The road stage can ask questions before building anything** — where
 *   the bard should sit, how much ground the camp covers — without paying
 *   for geometry to find out.
 *
 * ## The frame
 *
 * All coordinates are metres in a **world-aligned frame centred on the road
 * point** the camp belongs to: +Z is world +Z, not road-forward. The
 * heading is folded into the numbers instead of into a parent rotation, so
 * that "how far is this from the road" is a question this file can answer
 * and a test can check. Bearings use the road's own convention —
 * `atan2(x, z)`, zero pointing down +Z — so a bearing can be handed
 * straight to `Object3D.rotation.y`.
 *
 * Rotating the heading rotates the whole camp rigidly and changes nothing
 * else; that is a tested property, and it is what lets the road stage place
 * the group with a plain translation.
 */

import { mulberry32, pick, randInt, randRange, subSeed } from '../../core/rng';

export type CampPropKind =
  | 'stone'
  | 'pebble'
  | 'bedroll'
  | 'pack'
  | 'instrument'
  | 'lantern'
  | 'firewood';

export interface PropPlacement {
  kind: CampPropKind;
  /** Index within its own kind, so the builder can vary stones one by one. */
  index: number;
  /** Anchor-relative position, metres. */
  x: number;
  z: number;
  /** Distance from the fire centre. */
  radius: number;
  /** Bearing from the fire, radians, in the road's heading convention. */
  angle: number;
  /** Yaw for the built object, radians. */
  rotation: number;
  scale: number;
  /**
   * Radius of the disc this prop owns. Deliberately generous — it is a
   * personal-space bubble for a low-poly lump, not a collision hull, and
   * props that merely *nearly* touch read as a spilled crate.
   */
  footprint: number;
}

/**
 * A stick in the laid fire. Offsets are from the fire centre, not the anchor.
 *
 * `dx, dz` is the stick's **middle**, not one of its ends. That is a contract
 * with the builder rather than a detail: the ring-containment check below
 * measures half a length either side of it, so a builder that hangs a whole
 * length off the point silently doubles the reach the check thinks it has —
 * and the check passes anyway, because half of a log fits comfortably.
 */
export interface LogPlacement {
  dx: number;
  dz: number;
  /** Yaw of the stick's long axis. */
  rotation: number;
  /** Tilt off horizontal. A laid fire is crossed sticks, not a stack. */
  tilt: number;
  length: number;
  radius: number;
}

export interface SeatPlacement {
  x: number;
  z: number;
  /** Facing, radians. Always toward the fire. */
  heading: number;
  footprint: number;
}

export interface CampfireLayout {
  seed: number;
  heading: number;
  /** Which side of the road the camp is on. +1 is the road's right. */
  side: 1 | -1;
  /** Fire centre, anchor-relative. */
  fire: { x: number; z: number };
  /** The flame's own footprint. Only the logs are allowed inside it. */
  flameRadius: number;
  /** Where the ring stones sit. */
  ringRadius: number;
  logs: LogPlacement[];
  props: PropPlacement[];
  seat: SeatPlacement;
  /** Furthest any part of the camp reaches from the fire. */
  extent: number;
}

/**
 * How far a prop must stay from the road centreline.
 *
 * The packed surface is 2.3 m either side and the worn shoulder finishes
 * blending into grass at 4.2 m (`WorldStreamer`). 3.0 puts the camp clear of
 * the ruts and just inside the shoulder, which is where anyone actually
 * pitches: off the road, but not out in the field. The number is repeated
 * here rather than imported because importing it would drag the whole
 * streamer — three, the terrain builder and the scatter tables — into a
 * module whose entire value is being cheap and pure.
 */
export const ROAD_CLEARANCE_M = 3.0;

/** Nothing but the logs may be inside this. */
const FLAME_RADIUS_M = 0.34;

const RING_RADIUS_M: [number, number] = [0.82, 0.92];
const STONE_COUNT: [number, number] = [7, 9];
const STONE_FOOTPRINT_M: [number, number] = [0.22, 0.42];
/** `rockGeometry` reaches about 1.15 units at its widest wobble. */
const STONE_FOOTPRINT_PER_SCALE = 1.15;

/**
 * How far off the centreline the fire sits.
 *
 * Driven by the far edge of the camp, not by taste: the seat is the prop
 * nearest the road, and the fire has to be far enough out that the seat
 * still clears `ROAD_CLEARANCE_M`. Everything else follows from that.
 */
const CAMP_OFFSET_M: [number, number] = [5.8, 7.4];

/** A little along the road as well, so the fire is never exactly abeam. */
const CAMP_ALONG_M = 1.4;

const SIDES = [-1, 1] as const;

/**
 * The angular budget.
 *
 * Bearings are measured from *straight away from the road*, so 0 is the far
 * side of the fire and ±π is the road side. Six slots spread about 1.05 rad
 * apart, with the jitter kept well inside half that gap: this is why the
 * arrangement can be guaranteed non-overlapping by construction instead of
 * by a rejection loop, and a rejection loop is exactly the thing that would
 * make the camp stop being a pure function of its seed the day someone
 * changed a radius.
 *
 * The slot assignment is not arbitrary. The seat takes ±π, which puts the
 * bard between the road and the fire — so the resting camera, which sits
 * behind the bard, looks across them into the light rather than at their
 * back with the fire out of frame.
 *
 * That framing decides everything else, and it is why the bedroll is *not*
 * at bearing 0. Bearing 0 is the far side of the fire on exactly the axis
 * the resting camera is looking along, so anything standing there is behind
 * the flame in plan and *on top of* it on screen — and the bedroll is the
 * bulkiest thing in the camp. The first version put it there and the
 * campfire scene, which is the day's emotional anchor, showed a dark green
 * lump with one triangle of flame poking over the top and an orange splat
 * leaking round the side. DESIGN.md's rule that the warmest light in any
 * frame comes from the music or the fire cannot survive an occluder.
 *
 * So bearing 0 goes to the firewood, which is the flattest thing here and
 * reads well as a dark silhouette against the light, and the bedroll moves
 * one slot round — still comfortably on the far side of the fire from the
 * road, which is the invariant that matters, but out of the sightline.
 */
interface Slot {
  bearing: number;
  jitter: number;
  radius: [number, number];
  footprint: number;
}

const FIREWOOD: Slot = { bearing: 0, jitter: 0.2, radius: [2.0, 2.28], footprint: 0.42 };
/**
 * Tighter jitter than its neighbours. It is the biggest disc in the camp and
 * the slot either side of it has to stay clear, so it is the one placement
 * that cannot afford a fifth of a radian of slop.
 */
const BEDROLL: Slot = { bearing: 1.05, jitter: 0.12, radius: [2.3, 2.65], footprint: 0.8 };
const PACK: Slot = { bearing: 2.2, jitter: 0.2, radius: [1.85, 2.1], footprint: 0.34 };
const LANTERN: Slot = { bearing: -2.2, jitter: 0.2, radius: [2.15, 2.45], footprint: 0.28 };
const SEAT: Slot = { bearing: Math.PI, jitter: 0.2, radius: [1.95, 2.15], footprint: 0.45 };

/**
 * How long the log at the seat is.
 *
 * The seat stopped being a bare patch of ground the day the bard learned to
 * sit down: there is a felled log there now, laid across the sightline to
 * the fire, and he sits astride it. `Campfire` builds it, but the length
 * belongs here, because length is a claim about ground — the log lies within
 * the seat's own footprint disc and everything that keeps props off the road,
 * out of the fire and clear of each other is stated in terms of that disc.
 * Grow this past twice `SEAT.footprint` and the ends start reaching into
 * ground no test is watching.
 */
export const SEAT_LOG_LENGTH_M = 0.86;
/**
 * Radius is measured out from the stone ring; see `campfireLayout`.
 *
 * **Moved from -1.1, and the reason is a number rather than a preference.**
 * At -1.1 this prop stood in the column the resting camera sees the bard in:
 * over 400 seeds and headings, 393 of them put it inside
 * `sightlineViolations`' threshold, and on the shipped frame its screen box
 * ended three pixels from the bard's and its top rose twenty-eight pixels
 * above his hat. What that draws is a brown stick growing out of the brim.
 *
 * 1.65 is the only bearing that is clear of the sightline *and* keeps every
 * prop off every other prop. The camp is a tight six slots and the search was
 * exhaustive: bearing swept 0.30 to 2.35 at 0.025, jitter over
 * {0.06, 0.10, 0.14, 0.18}, radius draw over six ranges, against the same
 * 400 seeds `campfireLayout.test.ts` uses. Exactly one combination came back
 * clean.
 * Everything clear of the sightline collided with the bedroll (footprint 0.8,
 * so nothing may come within 1.06 m of it) or the pack, except this one, and
 * only with the draw pulled in from 0.85-0.95 to 0.72-0.82 and the jitter
 * from 0.18 to 0.06 — tighter even than the bedroll's, and for the same
 * reason its own note gives: there is one lane free and no room to wander in
 * it. Both of those are the price, not a separate opinion.
 *
 * It also lands the instrument on the far side of the fire, where — like the
 * firewood at bearing 0 — it reads as a dark silhouette against the glow
 * instead of as a second vertical beside a figure who already has one.
 */
const INSTRUMENT: Slot = { bearing: 1.65, jitter: 0.06, radius: [0.72, 0.82], footprint: 0.26 };

/**
 * The scatter on the ground inside the firelight.
 *
 * This is not decoration, and it is the answer to a specific complaint about
 * a specific frame: the fire's pool of light read as an airbrushed wash. The
 * diagnosis is worth keeping because it was not the obvious one. The pool is
 * draped over the terrain, its falloff is graded and its rim is broken up —
 * all the things you would reach for first were already true. What was
 * missing was on the *ground*, not in the light: a few square metres of
 * unbroken flat terrain with nothing on it to catch a lit side and cast a
 * small shadow, so a carefully graded pool had nothing to grade *over* and
 * came back as paint.
 *
 * Stones an inch or two proud of the grass fix that for a few dozen
 * triangles. Each one gets a bright fire-facing face, a dark side and a
 * shadow, so the eye reads modelled ground instead of a coloured plane —
 * and, because they are scattered rather than ringed, they also break the
 * pool's outline where they cross it.
 *
 * They are placed by a bounded scan rather than by slots, unlike everything
 * else here: a dozen small things distributed through the *gaps* between six
 * big ones is not an arrangement, it is a filter, and giving each one a slot
 * would mean re-solving the slot geometry every time a prop moved. The scan
 * is a fixed number of candidates from a fixed seed with a pure test, so the
 * camp remains exactly reproducible; what it is not is *stable* under an edit
 * to any other radius, which is the price and is the reason the count below
 * is a floor the test checks rather than a promise.
 */
const PEBBLE_TARGET = 13;
/** Candidates offered to the filter. Bounded, so this stays a pure function. */
const PEBBLE_CANDIDATES = 64;
/** How far out from the stone ring the scatter is allowed to start and stop. */
const PEBBLE_BAND_M: [number, number] = [0.5, 2.15];
const PEBBLE_FOOTPRINT_M: [number, number] = [0.085, 0.2];
/**
 * The golden angle. Successive candidates land a bit over half a turn apart,
 * so the scan spreads round the camp from the first few draws instead of
 * filling one side and then finding the other side full.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Where the resting camera stands, in the camp's own frame.
 *
 * `CameraRig.FRAMINGS.resting` puts it `distance` back along the subject's
 * heading and `side` across it, and the subject at a camp is the seat. The
 * two numbers are repeated rather than imported for the same reason
 * `ROAD_CLEARANCE_M` is: importing them would drag the rig, the app and three
 * itself into a module whose whole value is being cheap and pure. They are
 * checked against the live rig by `campfireLayout.test.ts`'s own comment
 * and, more usefully, by having been *measured* — a shot of the shipped camp
 * put the camera 1.0 m from where these produce it, the difference being the
 * rig's ground-clearance lift and idle drift. Every threshold below carries
 * far more margin than that.
 */
const RESTING_CAMERA_DISTANCE_M = 3.8;
const RESTING_CAMERA_SIDE_M = 2.6;
/**
 * Half the width of the seated bard on the ground, hat brim included.
 *
 * `hatGeometry`'s brim reaches 0.315 of a unit and the figure is built at
 * unit scale, so this is the widest thing about him.
 */
const BARD_HALF_WIDTH_M = 0.35;
/**
 * How near the seat a prop may come to *not* being called an occluder.
 *
 * Anything nearer the camera than this is in front of the bard rather than
 * behind him, and a thing in front of him is a foreground element, not a
 * spike out of his hat.
 */
const IN_FRONT_MARGIN_M = 0.3;

export function restingCameraStandpoint(seat: SeatPlacement): { x: number; z: number } {
  const s = Math.sin(seat.heading);
  const c = Math.cos(seat.heading);
  return {
    x: seat.x - s * RESTING_CAMERA_DISTANCE_M + c * RESTING_CAMERA_SIDE_M,
    z: seat.z - c * RESTING_CAMERA_DISTANCE_M - s * RESTING_CAMERA_SIDE_M,
  };
}

/**
 * Signed distance from the road centreline, positive on the road's right.
 *
 * The centreline through the anchor runs along `(sin h, cos h)`; the normal
 * is `(cos h, -sin h)`. Exported because the invariant "nothing sits on the
 * road" is stated in these terms and the test should not restate the maths.
 */
export function roadOffset(x: number, z: number, heading: number): number {
  return x * Math.cos(heading) - z * Math.sin(heading);
}

/**
 * Fold an angle into (-pi, pi].
 *
 * Bearings here are built by adding slot offsets to a heading, which walks
 * them off the end of the circle — a seat facing the fire can come out at
 * 8.36 radians. `rotation.y` does not care, but a caller comparing two
 * headings or damping toward one does, and handing out an angle that needs
 * the reader to know it might be unwrapped is a trap.
 */
function wrapAngle(angle: number): number {
  const wrapped = angle % (Math.PI * 2);
  if (wrapped > Math.PI) return wrapped - Math.PI * 2;
  if (wrapped <= -Math.PI) return wrapped + Math.PI * 2;
  return wrapped;
}

/**
 * Lay out a camp.
 *
 * The order of the draws below is load-bearing. Every camp in the game is
 * reproduced from this sequence, so inserting a draw anywhere but the end
 * re-rolls every campfire that has ever been generated — harmless, but it
 * means a screenshot in a design note stops matching the seed beside it.
 */
export function campfireLayout(seed: number, heading: number): CampfireLayout {
  const rand = mulberry32(subSeed(seed, 'campfire/layout'));

  const side = pick(rand, SIDES);
  // The bearing pointing straight away from the road, on the camp's side.
  const away = heading + (side * Math.PI) / 2;
  const offset = randRange(rand, CAMP_OFFSET_M[0], CAMP_OFFSET_M[1]);
  const along = randRange(rand, -CAMP_ALONG_M, CAMP_ALONG_M);

  const fire = {
    x: Math.sin(away) * offset + Math.sin(heading) * along,
    z: Math.cos(away) * offset + Math.cos(heading) * along,
  };

  const ringRadius = randRange(rand, RING_RADIUS_M[0], RING_RADIUS_M[1]);

  const props: PropPlacement[] = [];

  const place = (
    kind: CampPropKind,
    index: number,
    angle: number,
    radius: number,
    rotation: number,
    scale: number,
    footprint: number,
  ): PropPlacement => {
    const placement: PropPlacement = {
      kind,
      index,
      x: fire.x + Math.sin(angle) * radius,
      z: fire.z + Math.cos(angle) * radius,
      radius,
      angle: wrapAngle(angle),
      rotation: wrapAngle(rotation),
      scale,
      footprint,
    };
    props.push(placement);
    return placement;
  };

  // --- the ring ----------------------------------------------------------
  // Stones are laid at even spacing and then nudged. They are the one thing
  // in the camp allowed to touch its neighbours: a ring whose stones are
  // politely spaced is a decorative border, not a windbreak someone built.
  //
  // Which is why the sizing is a second pass. Drawing a stone's size
  // independently of where it landed leaves gaps wherever the angular
  // jitter happened to spread two neighbours apart, and a ring with a hole
  // in it stops reading as a ring at all. So each stone is instead sized to
  // the gap it has to fill — a ring of seven is built from bigger stones
  // than a ring of nine, which is also what anyone gathering them would do.
  const stoneCount = randInt(rand, STONE_COUNT[0], STONE_COUNT[1]);
  const spacing = (Math.PI * 2) / stoneCount;
  const stoneAngles: number[] = [];
  const stoneRadii: number[] = [];
  const stoneYaws: number[] = [];
  for (let i = 0; i < stoneCount; i++) {
    stoneAngles.push(away + i * spacing + randRange(rand, -spacing * 0.09, spacing * 0.09));
    stoneRadii.push(ringRadius + randRange(rand, -0.04, 0.05));
    // The yaw is measured from the camp's own frame so that turning the
    // heading turns the whole ring rather than re-seating every stone.
    stoneYaws.push(away + randRange(rand, 0, Math.PI * 2));
  }

  const stoneAt = (i: number) => {
    const k = (i + stoneCount) % stoneCount;
    return {
      x: Math.sin(stoneAngles[k]) * stoneRadii[k],
      z: Math.cos(stoneAngles[k]) * stoneRadii[k],
    };
  };

  for (let i = 0; i < stoneCount; i++) {
    const here = stoneAt(i);
    const before = stoneAt(i - 1);
    const after = stoneAt(i + 1);
    const halfGap =
      (Math.hypot(here.x - before.x, here.z - before.z) +
        Math.hypot(here.x - after.x, here.z - after.z)) /
      4;
    // Clamped so that a freak wide gap cannot grow a boulder big enough to
    // reach the bedroll, and a freak tight one cannot shrink to a pebble.
    const footprint = Math.min(
      STONE_FOOTPRINT_M[1],
      Math.max(STONE_FOOTPRINT_M[0], halfGap * randRange(rand, 0.95, 1.08)),
    );
    place(
      'stone',
      i,
      stoneAngles[i],
      stoneRadii[i],
      stoneYaws[i],
      footprint / STONE_FOOTPRINT_PER_SCALE,
      footprint,
    );
  }

  // --- the laid fire -----------------------------------------------------
  // Crossed, not stacked. Three or four sticks leaning through each other
  // read as something a person arranged; a tidy pyramid reads as a prop.
  const logCount = randInt(rand, 3, 4);
  const logs: LogPlacement[] = [];
  for (let i = 0; i < logCount; i++) {
    const spread = Math.PI / logCount;
    logs.push({
      dx: randRange(rand, -0.09, 0.09),
      dz: randRange(rand, -0.09, 0.09),
      rotation: i * spread + randRange(rand, -0.22, 0.22),
      tilt: randRange(rand, 0.1, 0.3),
      length: randRange(rand, 0.74, 0.94),
      radius: randRange(rand, 0.045, 0.065),
    });
  }

  // --- the camp ----------------------------------------------------------
  const slotAngle = (slot: Slot) => away + slot.bearing + randRange(rand, -slot.jitter, slot.jitter);
  const slotRadius = (slot: Slot) => randRange(rand, slot.radius[0], slot.radius[1]);

  // The bedroll lies tangentially — you sleep alongside a fire, not pointing
  // into it — so its yaw is a quarter turn off its own bearing.
  const bedrollAngle = slotAngle(BEDROLL);
  place(
    'bedroll',
    0,
    bedrollAngle,
    slotRadius(BEDROLL),
    bedrollAngle + Math.PI / 2 + randRange(rand, -0.12, 0.12),
    1,
    BEDROLL.footprint,
  );

  const packAngle = slotAngle(PACK);
  place(
    'pack',
    0,
    packAngle,
    slotRadius(PACK),
    packAngle + Math.PI + randRange(rand, -0.4, 0.4),
    randRange(rand, 0.92, 1.08),
    PACK.footprint,
  );

  const firewoodAngle = slotAngle(FIREWOOD);
  place(
    'firewood',
    0,
    firewoodAngle,
    slotRadius(FIREWOOD),
    firewoodAngle + Math.PI / 2 + randRange(rand, -0.3, 0.3),
    1,
    FIREWOOD.footprint,
  );

  const lanternAngle = slotAngle(LANTERN);
  place(
    'lantern',
    0,
    lanternAngle,
    slotRadius(LANTERN),
    lanternAngle + Math.PI,
    randRange(rand, 0.94, 1.06),
    LANTERN.footprint,
  );

  // The instrument is propped against the ring, so its radius is measured
  // out from the stones rather than from the fire — otherwise widening the
  // ring would quietly bury it.
  const instrumentAngle = slotAngle(INSTRUMENT);
  place(
    'instrument',
    0,
    instrumentAngle,
    ringRadius + slotRadius(INSTRUMENT),
    instrumentAngle + Math.PI,
    1,
    INSTRUMENT.footprint,
  );

  // --- the seat ----------------------------------------------------------
  const seatAngle = slotAngle(SEAT);
  const seatRadius = slotRadius(SEAT);
  const seat: SeatPlacement = {
    x: fire.x + Math.sin(seatAngle) * seatRadius,
    z: fire.z + Math.cos(seatAngle) * seatRadius,
    heading: wrapAngle(seatAngle + Math.PI),
    footprint: SEAT.footprint,
  };

  // --- the scatter -------------------------------------------------------
  // Last, and it has to stay last: every draw above is reproduced in order
  // from the seed, so a scan that consumed random numbers before them would
  // re-roll every camp in the game.
  const bigDiscs = props
    .map((p) => ({ x: p.x, z: p.z, footprint: p.footprint }))
    .concat([{ x: seat.x, z: seat.z, footprint: seat.footprint }]);
  let placedPebbles = 0;
  for (let i = 0; i < PEBBLE_CANDIDATES && placedPebbles < PEBBLE_TARGET; i++) {
    const angle = away + i * GOLDEN_ANGLE + randRange(rand, -0.1, 0.1);
    const radius =
      ringRadius + randRange(rand, PEBBLE_BAND_M[0], PEBBLE_BAND_M[1]);
    const footprint = randRange(rand, PEBBLE_FOOTPRINT_M[0], PEBBLE_FOOTPRINT_M[1]);
    // Measured from the camp's own frame, like the ring stones', so turning
    // the heading turns the scatter rather than re-seating every stone in it.
    const yaw = away + randRange(rand, 0, Math.PI * 2);
    const x = fire.x + Math.sin(angle) * radius;
    const z = fire.z + Math.cos(angle) * radius;
    // Same three rules everything else in the camp obeys, applied as a
    // filter rather than designed around: off the road, clear of every
    // other footprint, and — since these are the only props allowed to sit
    // this near the stones — clear of the ring itself.
    if (Math.abs(roadOffset(x, z, heading)) - footprint < ROAD_CLEARANCE_M) continue;
    if (bigDiscs.some((d) => Math.hypot(x - d.x, z - d.z) < d.footprint + footprint)) continue;
    bigDiscs.push({ x, z, footprint });
    place(
      'pebble',
      placedPebbles,
      angle,
      radius,
      yaw,
      footprint / STONE_FOOTPRINT_PER_SCALE,
      footprint,
    );
    placedPebbles++;
  }

  let extent = ringRadius;
  for (const prop of props) extent = Math.max(extent, prop.radius + prop.footprint);
  extent = Math.max(extent, seatRadius + seat.footprint);

  return {
    seed,
    heading,
    side,
    fire,
    flameRadius: FLAME_RADIUS_M,
    ringRadius,
    logs,
    props,
    seat,
    extent,
  };
}

/**
 * Every way a layout can be wrong, in one place.
 *
 * This is exported rather than living in the test file because it is also
 * the honest description of the contract: a caller placing something extra
 * in the camp can check it against the same rules, and the rules cannot
 * drift away from the test that enforces them.
 */
export function layoutViolations(layout: CampfireLayout): string[] {
  const problems: string[] = [];
  const { heading, fire, props, seat } = layout;

  const fireOffset = roadOffset(fire.x, fire.z, heading);
  const campSide = Math.sign(fireOffset);

  interface Disc {
    label: string;
    /** 'seat' is not a prop, but it occupies ground exactly like one. */
    kind: CampPropKind | 'seat';
    x: number;
    z: number;
    footprint: number;
  }

  const discs: Disc[] = props.map((p) => ({
    label: `${p.kind}[${p.index}]`,
    kind: p.kind,
    x: p.x,
    z: p.z,
    footprint: p.footprint,
  }));
  discs.push({
    label: 'seat',
    kind: 'seat',
    x: seat.x,
    z: seat.z,
    footprint: seat.footprint,
  });

  for (const disc of discs) {
    const toFire = Math.hypot(disc.x - fire.x, disc.z - fire.z);
    if (toFire - disc.footprint < layout.flameRadius) {
      problems.push(`${disc.label} reaches into the fire`);
    }
    const lateral = Math.abs(roadOffset(disc.x, disc.z, heading));
    if (lateral - disc.footprint < ROAD_CLEARANCE_M) {
      problems.push(`${disc.label} sits on the road`);
    }
  }

  // Stones are a ring and rings touch; everything else keeps its distance.
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      const a = discs[i];
      const b = discs[j];
      if (a.kind === 'stone' && b.kind === 'stone') continue;
      const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.footprint - b.footprint;
      if (gap < 0) problems.push(`${a.label} overlaps ${b.label}`);
    }
  }

  const bedroll = props.find((p) => p.kind === 'bedroll');
  if (!bedroll) {
    problems.push('no bedroll');
  } else if (
    campSide * roadOffset(bedroll.x, bedroll.z, heading) <= campSide * fireOffset
  ) {
    problems.push('bedroll is not on the far side of the fire from the road');
  }

  // The seat log lies inside the seat's disc, so every check above already
  // covers it — but only for as long as that stays true.
  if (SEAT_LOG_LENGTH_M / 2 > seat.footprint) {
    problems.push('the seat log is longer than the seat it lies in');
  }

  for (let i = 0; i < layout.logs.length; i++) {
    const log = layout.logs[i];
    const reach = Math.hypot(log.dx, log.dz) + (log.length / 2) * Math.cos(log.tilt);
    if (reach > layout.ringRadius) problems.push(`log[${i}] sticks out past the ring`);
  }

  problems.push(...sightlineViolations(layout));

  return problems;
}

/**
 * Props that stand behind the bard, in the column the camera sees him in.
 *
 * The camp already reasons about the camera once — bearing 0 is kept clear of
 * the bedroll because it is the axis the lens looks along — but it did so in
 * prose, and prose does not fail a build. This states it as arithmetic, and
 * it exists because the propped instrument spent every shipped campfire frame
 * three pixels from the bard's silhouette with its neck above his hat brim.
 *
 * The test is an angle at the lens, not a distance on the ground, because
 * that is what an occluder actually is: two things a metre apart in plan can
 * be on top of each other on screen if the near one is nearer. So each prop's
 * bearing from the camera is compared with the seat's, and it has to clear
 * the bard's own angular half-width plus its own. Props *nearer* the camera
 * than the bard are skipped: those are foreground, which is a composition
 * question and not this function's business.
 *
 * Only the tall props are tested. A bedroll or a pack behind him reads as
 * ground he is sitting in front of; a lute on end and a lantern on a staff
 * read as things growing out of him.
 */
const STANDING_PROPS: ReadonlySet<CampPropKind> = new Set(['instrument', 'lantern']);

export function sightlineViolations(layout: CampfireLayout): string[] {
  const problems: string[] = [];
  const camera = restingCameraStandpoint(layout.seat);
  const toSeat = Math.hypot(layout.seat.x - camera.x, layout.seat.z - camera.z);
  const seatBearing = Math.atan2(layout.seat.x - camera.x, layout.seat.z - camera.z);
  for (const prop of layout.props) {
    if (!STANDING_PROPS.has(prop.kind)) continue;
    const range = Math.hypot(prop.x - camera.x, prop.z - camera.z);
    if (range <= toSeat - IN_FRONT_MARGIN_M) continue;
    const bearing = Math.atan2(prop.x - camera.x, prop.z - camera.z);
    const apart = Math.abs(wrapAngle(bearing - seatBearing));
    const needed = Math.atan2(BARD_HALF_WIDTH_M, toSeat) + Math.atan2(prop.footprint, range);
    if (apart < needed) {
      problems.push(`${prop.kind}[${prop.index}] stands behind the bard from the resting camera`);
    }
  }
  return problems;
}
