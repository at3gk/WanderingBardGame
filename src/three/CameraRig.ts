/**
 * The camera.
 *
 * More of this game's "feel" lives here than in any other single file. A
 * cosy walking game is watched, not driven, and the camera is the only
 * thing standing between "a pleasant stroll" and "motion sickness at 40
 * km/h". Everything here is in service of one rule: **the camera never
 * moves for a reason the player cannot feel.**
 *
 * How it works:
 *
 * - The rig tracks a *goal* pose derived from the bard's position and the
 *   road's heading, then critically-damps toward it. Critical damping
 *   rather than a lerp because a lerp's response depends on frame rate —
 *   the same follow constant gives a different feel at 60 and 120 Hz,
 *   which is exactly the sort of thing that makes a game feel "off" on
 *   someone else's device without anyone being able to say why.
 * - Position and look-at are damped **separately and at different rates**.
 *   The look target leads the position slightly, so on a bend the camera
 *   turns to see where you are going a beat before it swings around. This
 *   one detail is most of what reads as "a camera operator" rather than
 *   "a rig bolted to the character".
 * - Heading is damped in *angle* space with proper wrapping. Damping the
 *   direction vector instead would slow down through the turn and cut the
 *   corner, and damping a raw angle spins the long way round at ±π.
 * - A gentle idle drift — a slow, low-amplitude figure-of-eight — keeps
 *   the frame alive when the bard stands still busking. Without it a
 *   stopped camera looks like a crashed game.
 * - Framing shifts with the phase: walking sits back and high, busking
 *   comes in closer and lower to put the crowd in frame, resting pulls
 *   right in on the fire. Transitions are eased over seconds, never cut.
 *
 * Shake is deliberately absent. There is nothing in this game that should
 * shake a camera.
 */

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export type CameraMood = 'walking' | 'busking' | 'resting' | 'vista' | 'encounter';

interface MoodFraming {
  /** Metres behind the subject, along its heading. */
  distance: number;
  /** Metres above the subject's feet. */
  height: number;
  /** Metres above the subject's feet that the camera looks at. */
  lookHeight: number;
  /** How far ahead of the subject the look target leads, in metres. */
  lead: number;
  /** Lateral offset, metres. A little off-centre is friendlier than dead-on. */
  side: number;
  fov: number;
  /** Seconds for the position to close most of the gap to its goal. */
  positionSmoothing: number;
  /** Seconds for the look target. Slower than position on purpose. */
  targetSmoothing: number;
  /** Idle drift amplitude in metres. */
  drift: number;
}

/**
 * The framings. These numbers were tuned by looking at frames, not derived
 * — the notes say what each one is *for* so a later change can tell
 * whether it is breaking something deliberate.
 */
/**
 * Three numbers decide whether this is a game about a person or a game about
 * some scenery, and all three are worth stating as arithmetic rather than
 * taste.
 *
 * **How tall he reads.** The bard is about 1.4 m. The frame is
 * `2 * range * tan(fov/2)` metres high where he stands, `range` being the
 * true camera-to-bard distance — `sqrt(distance² + side² + (height - 0.7)²)`,
 * not `distance`, which is why raising `side` quietly shrinks him, and why
 * lowering the camera quietly grows him. Walking's 4.0 m / 1.85 m / 42
 * degrees puts him at 0.42 of frame height. The numbers before the 3D work
 * (4.6 m, 1.5 m, 50 degrees) read 0.29, and 0.29 against busy grass is a
 * figure you have to go looking for.
 *
 * Note the trade in the FOV rather than the distance. Closing the distance
 * to get the same size would have put the camera on his heels, lost the road
 * ahead, and pushed the near scatter into the lens; a narrower FOV buys the
 * height back, compresses the land behind him — which suits the storybook
 * look — and stops straight edges bending at the frame corners.
 *
 * **How far off-centre.** `side` reads as a much smaller screen offset than
 * its value suggests, because the look target sits on the subject's own
 * forward line rather than beside it: the offset in tangent space is
 * `side * lead / (distance * (distance + lead))`, divided by `tan(fov/2) *
 * aspect` to land in NDC. So shortening the lead shrinks it and it has to be
 * paid back in side.
 *
 * That arithmetic is only half the story, though, and the missing half is
 * what `side` used to get wrong. `side` does not slide the subject across a
 * fixed frame; it swings the *camera* around him, and the road swings with
 * it. The road's vanishing point lands at `-atan(side / (distance + lead))`
 * from the camera's axis and the subject at `atan(side / distance)` minus the
 * same term — opposite sides of centre, and the vanishing point moves nearly
 * three times as fast. Walking's old `side` of 2.4 put the subject at 0.63 of
 * the frame and the vanishing point at 0.23: the strongest leading line in
 * the picture ran from the subject to the far edge, pointing away from him.
 * On a portrait phone it was worse than lopsided — the vanishing point was
 * off the left edge entirely, so the road simply left the frame and the whole
 * left half was empty rut.
 *
 * So the walking and vista framings now aim at about half the old offset.
 * That puts the subject a little right of centre with the road converging
 * inside the frame and sweeping up past his shoulder, which is the leading
 * line doing its job. It also grows him: the true camera-to-subject range
 * falls with `side`, which is where most of the climb from 0.37 to 0.41 came
 * from, the rest arriving later with the camera height.
 *
 * Note what is *not* done here. The alternative was to flip the sign of
 * `side` with the road's curvature so the subject always sits on the inside
 * of the bend. It composes beautifully and it cannot be had: `WorldStreamer`
 * places every skyline landmark by scoring candidates against the camera's
 * axis, and its `LANDMARK_VIEW_BIAS` is one constant precisely because that
 * axis sits at a fixed angle to the road on every stretch of every road. A
 * `side` that changed sign would make the bias indeterminate and landmarks
 * would drift to whichever edge the last bend chose, with nothing failing
 * loudly.
 *
 * **How far down the frame he lands.** This is the third number and it was
 * the one nobody had written down, which is how the walk and the vista both
 * ended up with the bard shoved against the bottom edge while reading a
 * perfectly respectable height. Two angles decide it. The camera is pitched
 * below horizontal by `d = atan((height - lookHeight) / Rt)` where
 * `Rt = sqrt((distance + lead)² + side²)`, and that alone fixes the horizon
 * at `0.5 - tan(d) / (2 tan(fov/2))` of the way down. The subject's chest is
 * below horizontal by `b = atan((height - 0.7) / Rh)` where
 * `Rh = sqrt(distance² + side²)`, and lands at
 * `0.5 + tan(b - d) / (2 tan(fov/2))`.
 *
 * The two are pulled apart by `height` and pushed back together by `lead`,
 * and until this was measured every framing here had been tuned by raising
 * the camera — which raises `b` fast and `d` slowly, so each adjustment that
 * showed more landscape also drove the figure further down the picture.
 * Walking's old 2.05 m with a 1.15 m look target put his chest at 0.73 and
 * his feet at 0.94, half a boot from the edge; the vista's 3.6 m put his
 * chest at 0.82 with the whole middle of the frame empty field. Both are now
 * lower and looking lower, which holds the horizon exactly where it was and
 * lifts him — walking's chest to 0.67 and the vista's to 0.70 — for nothing
 * except a camera a little nearer his own height, which is where a camera
 * following a person on foot ought to be anyway.
 */
const FRAMINGS: Record<CameraMood, MoodFraming> = {
  // Close enough that the bard is unmistakably the subject, high enough to
  // show the road ahead and the land it crosses. The whole appeal of the
  // walk is seeing what is coming, so the lead still carries the frame
  // forward — just not so far that it pushes him into the bottom edge.
  walking: {
    distance: 4.0,
    // Was 2.05 m looking at 1.15. Both came down together, which is what
    // keeps the horizon at 0.32 while the bard climbs from 0.73 of the frame
    // to 0.67 — see the arithmetic above. 1.85 is still well clear of the top
    // of his hat, so this is a camera walking behind him rather than one
    // riding above him.
    height: 1.85,
    lookHeight: 0.95,
    lead: 2.4,
    // Was 2.4. `WorldStreamer.LANDMARK_VIEW_BIAS` is measured from this
    // number and this framing — it is the one the player is in while a
    // landmark is being approached — so the two move together or not at all.
    side: 1.2,
    fov: 42,
    positionSmoothing: 0.55,
    targetSmoothing: 0.85,
    drift: 0.06,
  },
  // Closer, lower, and swung further round to the side so the bard is in
  // three-quarter view rather than seen from behind — you want to see the
  // playing, and you want room in frame for whoever stopped to listen.
  busking: {
    distance: 3.9,
    height: 1.9,
    lookHeight: 1.1,
    lead: 1.6,
    side: 2.7,
    fov: 43,
    positionSmoothing: 0.75,
    targetSmoothing: 1.0,
    drift: 0.11,
  },
  // In on the fire, low, wide-ish. This is the one moment the game asks you
  // to stop moving, so the camera stops too — and it has to hold two things
  // at once, the bard and the fire he is sitting at. The first pass came in
  // to 3.2 m with 2.2 m of side, which read him at nearly half the frame
  // height and pushed him against the right edge with the fire alone in the
  // middle: two subjects, neither of them framed.
  resting: {
    distance: 3.8,
    height: 1.6,
    lookHeight: 0.85,
    lead: 1.4,
    // 2.6. This has been 2.1 and it has been 3.3, and this is the first time
    // it has been swept through a lens that was holding still — see `reset`,
    // which had to be fixed before any of these numbers meant anything.
    //
    // What the previous pass measured is real and it reproduces: the thigh's
    // *horizontal* extent — the part that says "this limb goes forward"
    // rather than "this is another shin" — grows monotonically with `side`,
    // 0.36 of its true length at 1.6, 0.46 at 2.1, 0.54 at 2.6, 0.63 at 3.3,
    // 0.69 at 3.9 (mean of the two thighs, seated pose settled). Against
    // that, it quoted a seat log foreshortening from 195 px to 137. Both
    // curves are confirmed here at 252 -> 160 px.
    //
    // What it did not measure is the price, and the price is in this file's
    // own header: the true camera-to-subject range is
    // `sqrt(distance² + side² + (height - 0.7)²)`, so `side` is a distance
    // like any other and **raising it shrinks the subject**. From 2.1 to 3.3
    // that is sqrt(15.25 + 4.41) = 4.43 m to sqrt(15.25 + 10.89) = 5.11 m,
    // 15 per cent further away; measured, the seated figure went from 0.339
    // of frame height to 0.298, a 12 per cent loss, and the instrument in his
    // lap went from 2201 visible pixels to 1536, a 30 per cent loss. The
    // complaint the swing was meant to answer was that the subject of the
    // best-lit frame in the game is illegible. Twelve per cent of his height
    // and a third of his instrument is a steep way to pay for thigh angle.
    //
    // Nor can it be paid back by closing the distance: holding the range at
    // 4.43 m with `side` at 3.3 needs `distance` = sqrt(19.66 - 10.89) =
    // 2.96 m, and 3 m behind a seated figure is where the fire leaves the
    // frame, which is the constraint that set this framing in the first
    // place.
    //
    // So 2.6 takes 47 per cent of the thigh's available gain for 40 per cent
    // of the size loss, and keeps the seat log 206 px across — the log being,
    // per the last two waves of notes, the thing that actually reads as
    // "seated" here. Distance, height and fov stay as they are; the fire's
    // screen position moves by under thirty pixels across the whole sweep,
    // so it is not the binding constraint anywhere in this range.
    side: 2.6,
    fov: 43,
    positionSmoothing: 1.1,
    targetSmoothing: 1.3,
    drift: 0.14,
  },
  // Pulled well back to hand the landscape the frame. Narrower FOV compresses
  // the distance and makes the hills read as bigger. The bard is small here on
  // purpose, but he is kept well off-centre so he still reads as the figure in
  // the landscape rather than a speck in the middle of it.
  vista: {
    distance: 7.5,
    // Was 3.6 m, and that was the worst offender in the game: at seven and a
    // half metres back it put the bard's chest at 0.82 of the frame with an
    // empty field filling the middle, so the shot meant to hand the landscape
    // the frame handed it to nothing in particular. The distance is what
    // makes a vista, not the altitude — pulling the height down to 2.9 keeps
    // every hill and every landmark in shot and moves him to 0.70.
    height: 2.9,
    // Low for the distance: the look target has to sit *below* the bard's
    // chest here or the long lead drops him onto the bottom edge of the frame.
    lookHeight: 1.05,
    // Shortened with the height so the camera still tips far enough down to
    // hold the horizon near 0.29; a six-metre lead at 2.9 m would have
    // levelled it out and given half the frame to sky.
    lead: 5.0,
    // Was 3.2. A little more than walking's, because a vista is the one shot
    // where the figure is meant to be small in the land and so has to be
    // firmly out of the middle to be found at all; the long lead dilutes it
    // anyway, so 1.5 here reads about as far off-centre as 1.2 does walking.
    side: 1.5,
    fov: 38,
    positionSmoothing: 1.2,
    targetSmoothing: 1.4,
    drift: 0.1,
  },
  // Slightly further back than walking and led less, so the thing you have
  // met shares the frame instead of sliding out of it.
  encounter: {
    distance: 4.3,
    // Follows walking's down, and for the same reason it followed walking's
    // `side` down: an encounter arrives during a walk and eases over a second
    // and a half, so a framing that differed here by a quarter of a metre of
    // camera height would be a visible lift every time the bard met somebody.
    height: 1.9,
    lookHeight: 1.05,
    lead: 2.0,
    // Was 2.4, and had to come down with walking's whether or not the two
    // are the same shot. An encounter arrives during a walk and the mood
    // eases over a second and a half; leaving this one at the old offset
    // meant the road slid back out to the left edge every time the bard met
    // somebody, which is a worse fault than the lopsided frame it came from —
    // it is a lopsided frame you can watch the camera arrive at. A little
    // above walking's, because the traveller stands off the road and the
    // wider angle is what keeps both of them in shot.
    side: 1.6,
    fov: 44,
    positionSmoothing: 0.7,
    targetSmoothing: 0.9,
    drift: 0.09,
  },
};

/**
 * How much of the narrow-screen widening is handed back to the sky rather
 * than to the ground. See `widenRise`, which is where the number is argued.
 *
 * Negative, which is not a typo. It used to be +0.25 — a quarter of the added
 * angle given to the sky — and going the other way is the change.
 */
const WIDEN_RISE_SHARE = -0.35;

/**
 * Ceiling on the narrow-screen FOV widening, in tangent space.
 *
 * Was 1.28. Every degree of vertical FOV bought here is spent on sky above
 * and road below, and on the two aspect ratios that reach the clamp — phone
 * portrait and tablet — those are the two regions of this picture carrying
 * the least information. 1.14 still buys back a useful margin at the sides,
 * which is what the widening is for, without turning the frame into a
 * letterbox of scenery with a strip of world in it.
 */
const FOV_WIDEN_MAX = 1.14;

/** Blend two framings. Used while a mood transition is in flight. */
function blendFraming(a: MoodFraming, b: MoodFraming, t: number): MoodFraming {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    distance: mix(a.distance, b.distance),
    height: mix(a.height, b.height),
    lookHeight: mix(a.lookHeight, b.lookHeight),
    lead: mix(a.lead, b.lead),
    side: mix(a.side, b.side),
    fov: mix(a.fov, b.fov),
    positionSmoothing: mix(a.positionSmoothing, b.positionSmoothing),
    targetSmoothing: mix(a.targetSmoothing, b.targetSmoothing),
    drift: mix(a.drift, b.drift),
  };
}

/**
 * Frame-rate-independent exponential smoothing.
 *
 * `smoothing` is the time in seconds to close ~63% of the remaining gap.
 * The exp() form is the whole point: `lerp(current, goal, 0.1)` closes a
 * fixed *fraction per frame*, so at 120 Hz it converges twice as fast as
 * at 60 Hz and the camera feels tighter on better hardware.
 */
function damp(current: number, goal: number, smoothing: number, dt: number): number {
  if (smoothing <= 0) return goal;
  return goal + (current - goal) * Math.exp(-dt / smoothing);
}

/** As above, in angle space, taking the short way round the circle. */
function dampAngle(current: number, goal: number, smoothing: number, dt: number): number {
  let delta = goal - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-dt / Math.max(smoothing, 1e-4)));
}

export interface CameraSubject {
  /** Feet position. */
  position: Vector3;
  /** Facing, radians, measured the same way as the road's heading. */
  heading: number;
}

export class CameraRig {
  readonly camera: PerspectiveCamera;

  /** Where the camera actually is and looks; damped toward the goal. */
  private readonly position = new Vector3();
  private readonly target = new Vector3();
  private heading = 0;

  private mood: CameraMood = 'walking';
  /**
   * The framing the current transition started from — a *snapshot* of the
   * interpolated pose, not a mood name. Storing a name here was the first
   * version and it was wrong: interrupting a half-finished transition
   * would blend from the previous mood's endpoint, snapping the camera
   * back to a pose it had already left.
   */
  private fromFraming: MoodFraming = FRAMINGS.walking;
  private moodBlend = 1;
  private moodBlendRate = 1;
  private elapsed = 0;
  private initialised = false;
  /** Posed for a screenshot: snapped to the goal and not drifting. */
  private posed = false;

  /**
   * Extra height added when the ground under the camera would otherwise
   * clip through it. Damped separately so cresting a hill lifts the camera
   * smoothly rather than popping it.
   */
  private groundLift = 0;

  /**
   * Multiplier on the *tangent* of the half vertical FOV, set from the
   * screen's aspect. 1 on anything 16:9 or wider. See `applyAspect`.
   */
  private fovWiden = 1;

  /**
   * Multiplier on every framing's `side`, set from the screen's aspect.
   * 1 on anything 16:9 or wider. See `applyAspect`.
   */
  private sideNarrow = 1;

  private readonly scratchGoal = new Vector3();
  private readonly scratchTarget = new Vector3();

  constructor(aspect = 1) {
    this.camera = new PerspectiveCamera(FRAMINGS.walking.fov, aspect, 0.1, 700);
  }

  /**
   * Change framing. `seconds` is how long the transition takes; it is
   * never instant unless explicitly asked, because a camera cut in a game
   * with no cuts anywhere else reads as a bug.
   */
  setMood(mood: CameraMood, seconds = 1.4): void {
    if (mood === this.mood) return;
    // A real framing change means the game is being played, not posed.
    this.posed = false;
    // Blend from wherever the current blend has actually got to.
    this.fromFraming = this.blendedFraming();
    this.mood = mood;
    this.moodBlend = 0;
    this.moodBlendRate = 1 / Math.max(0.0001, seconds);
  }

  get currentMood(): CameraMood {
    return this.mood;
  }

  private blendedFraming(): MoodFraming {
    const to = FRAMINGS[this.mood];
    if (this.moodBlend >= 1) return to;
    // Smoothstep the blend so the transition eases in and out instead of
    // starting and stopping at full speed.
    const t = this.moodBlend * this.moodBlend * (3 - 2 * this.moodBlend);
    return blendFraming(this.fromFraming, to, t);
  }

  /**
   * Advance the rig.
   *
   * `groundHeightAt` lets the rig avoid burying itself in a hillside: it
   * is sampled at the camera's own XZ, and the camera is pushed up to stay
   * a little clear of the terrain. Passing null disables the check (the
   * campfire scene, which sits on known-flat ground).
   */
  update(
    subject: CameraSubject,
    dt: number,
    groundHeightAt: ((x: number, z: number) => number) | null,
  ): void {
    this.elapsed += dt;
    this.moodBlend = Math.min(1, this.moodBlend + this.moodBlendRate * dt);
    const framing = this.blendedFraming();

    // Damp the heading first: the goal position is derived from it, so a
    // damped heading means the camera arcs around the subject on a bend
    // rather than sliding sideways through the world.
    this.heading = dampAngle(this.heading, subject.heading, framing.positionSmoothing * 1.35, dt);

    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);

    // Goal position: back along the heading, up, and a little to the side.
    const side = framing.side * this.sideNarrow;
    this.scratchGoal.set(
      subject.position.x - sin * framing.distance + cos * side,
      subject.position.y + framing.height,
      subject.position.z - cos * framing.distance - sin * side,
    );

    // Goal look target: ahead of the subject along its *own* heading, not
    // the camera's. That difference is what makes the camera look into a
    // bend rather than at the outside of it.
    const subjectSin = Math.sin(subject.heading);
    const subjectCos = Math.cos(subject.heading);
    this.scratchTarget.set(
      subject.position.x + subjectSin * framing.lead,
      subject.position.y + framing.lookHeight + this.widenRise(framing),
      subject.position.z + subjectCos * framing.lead,
    );

    // Idle drift. Two incommensurable frequencies so it never visibly
    // repeats; scaled by the framing so the close shots breathe more.
    const drift = this.posed ? 0 : framing.drift;
    const driftX = Math.sin(this.elapsed * 0.23) * Math.cos(this.elapsed * 0.11);
    const driftY = Math.sin(this.elapsed * 0.31 + 1.7);
    this.scratchGoal.x += driftX * drift;
    this.scratchGoal.y += driftY * drift * 0.6;

    if (!this.initialised) {
      // First frame: snap. Damping in from wherever a default-constructed
      // camera happened to be would fly the player across the map.
      this.position.copy(this.scratchGoal);
      this.target.copy(this.scratchTarget);
      this.heading = subject.heading;
      this.initialised = true;
    } else {
      this.position.x = damp(this.position.x, this.scratchGoal.x, framing.positionSmoothing, dt);
      this.position.y = damp(this.position.y, this.scratchGoal.y, framing.positionSmoothing, dt);
      this.position.z = damp(this.position.z, this.scratchGoal.z, framing.positionSmoothing, dt);
      this.target.x = damp(this.target.x, this.scratchTarget.x, framing.targetSmoothing, dt);
      this.target.y = damp(this.target.y, this.scratchTarget.y, framing.targetSmoothing, dt);
      this.target.z = damp(this.target.z, this.scratchTarget.z, framing.targetSmoothing, dt);
    }

    // Keep clear of the ground. The lift is damped upward quickly (you
    // must never see through a hill) and released slowly (so dropping off
    // a crest does not yank the camera down).
    if (groundHeightAt) {
      const clearance = 1.1;
      const ground = groundHeightAt(this.position.x, this.position.z);
      const needed = Math.max(0, ground + clearance - this.position.y);
      this.groundLift =
        needed > this.groundLift
          ? damp(this.groundLift, needed, 0.12, dt)
          : damp(this.groundLift, needed, 0.9, dt);
    } else {
      this.groundLift = damp(this.groundLift, 0, 0.9, dt);
    }

    this.camera.position.set(
      this.position.x,
      this.position.y + this.groundLift,
      this.position.z,
    );
    this.camera.lookAt(this.target);

    const goalFov = this.goalFov(framing.fov);
    if (Math.abs(this.camera.fov - goalFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, goalFov, framing.positionSmoothing, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * How far to lift the look target to pay for the narrow-screen widening.
   *
   * `applyAspect` buys back the width a phone crops away by opening the
   * vertical FOV, and that added angle arrives split evenly above and below
   * the view axis. Neither half is worth much: below is more of the road
   * surface the bard is already standing on, above is more empty sky.
   *
   * This used to tilt up by *exactly* the angle the widening added, which
   * put the bottom edge back where the unwidened framing had it and handed
   * the entire gain to the sky. The arithmetic of what that did is worth
   * writing down, because it is not visible in the code: the horizon sits at
   * `(1 - tan(d)/tan(halfFov)) / 2` of the way down the frame, where `d` is
   * how far the camera is pitched below horizontal. On a desktop 16:9 that
   * is 0.32 — a third sky, two thirds land, which is the composition every
   * framing here was tuned for. Full compensation dropped `d` from eight
   * degrees to under three and pushed the horizon to 0.45, so a portrait
   * phone — the framing most players see first — was very nearly half empty
   * sky with everything of interest squeezed into a band at the skyline.
   *
   * A quarter share, with the widening itself pulled back to 1.14, landed the
   * horizon at 0.35 on both phone portrait and tablet: still a little more
   * sky than the desktop framing, which is right for a tall frame, and
   * nowhere near half of it. The bottom edge picked up about two degrees more
   * road, which read as a price worth paying and much the smaller of the two.
   *
   * **That last judgement was wrong, and the share is now negative.** The
   * reason is a measurement the argument above never made: how big the largest
   * *connected* patch of one value in the frame is. On the tall aspects it was
   * the sky, and the sky is not a price worth paying, because a flat sky is
   * flat everywhere while a flat road has grass, ruts, stones and a shadow
   * across it and therefore breaks into small patches at the same bucket
   * share. Measured on 08-phone-portrait, largest flat region as a share of
   * frame: 12.1 per cent at +0.25, 10.6 per cent at -0.35, against 8 to 13.5
   * per cent on the desktop frames — so a tall frame stops being the outlier.
   * The treeline band, which is the one carrying the midground, went from 61
   * per cent of its pixels in a single ten-level bucket to 49; the near road
   * gave up 25 to 30 the other way, which is the trade being made on purpose.
   *
   * A note on what this fixes and what it does not. The critique that prompted
   * it asked for the skyline to sit *nearer 0.45* of frame height rather than
   * 0.37 — that is, for more sky, not less — while also naming the flat sky as
   * a quarter of the frame and the answer as "not more scatter". Those two
   * cannot both be had, and the arithmetic above says which one to keep. The
   * bottom third of a portrait frame is still one brown plane; that is the
   * ground's own business and not something a camera can fix.
   *
   * It is done by moving the *look target*, not by adding a pitch offset, so
   * it damps with everything else and cannot fight the target smoothing. That
   * is also why a negative value is safe: it is a look target a little below
   * the one the desktop framing uses, not a rotation bolted on afterwards.
   */
  private widenRise(framing: MoodFraming): number {
    if (this.fovWiden <= 1) return 0;
    const half = MathUtils.degToRad(framing.fov) * 0.5;
    const widened = Math.atan(Math.tan(half) * this.fovWiden);
    return Math.tan(widened - half) * (framing.distance + framing.lead) * WIDEN_RISE_SHARE;
  }

  /** A framing's vertical FOV after the narrow-screen widening. */
  private goalFov(base: number): number {
    if (this.fovWiden <= 1) return base;
    const half = MathUtils.degToRad(base) * 0.5;
    return MathUtils.radToDeg(Math.atan(Math.tan(half) * this.fovWiden)) * 2;
  }

  /**
   * Widen the field of view on a narrow screen.
   *
   * A phone in portrait is a tall keyhole; keeping the horizontal FOV of a
   * desktop framing would crop the road away at the sides. Vertical FOV is
   * raised as the aspect narrows so more *width* of world stays in frame.
   *
   * This used to be done by scaling `filmGauge`, which did nothing at all:
   * three's `updateProjectionMatrix` derives the frustum from `fov` and
   * `aspect` alone and only consults the film gauge to interpret a non-zero
   * `filmOffset`. Every phone has been playing with the desktop horizontal
   * FOV cropped down to its own width since the rig was written.
   *
   * The widening is applied in *tangent* space — doubling the angle is not
   * doubling the view — and clamped hard. Preserving the desktop width on a
   * 9:19.5 phone would need a vertical FOV over 120 degrees, which fixes the
   * cropping by making the bard forty pixels tall and bending every straight
   * edge in the world. See `FOV_WIDEN_MAX` for where the ceiling sits and
   * why it came down.
   */
  applyAspect(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const reference = 16 / 9;
    this.fovWiden =
      aspect < reference ? MathUtils.clamp(reference / aspect, 1, FOV_WIDEN_MAX) : 1;
    // A metre of `side` is worth about three times as much screen offset on
    // a portrait phone as on a 16:9 desktop, because the horizontal half
    // angle is `tan(fov/2) * aspect` and the aspect has collapsed. Left
    // alone, the framing that reads as pleasantly off-centre on a desktop
    // walks the bard into the right-hand edge on a phone the moment the road
    // bends. The square root rather than the full ratio on purpose: full
    // compensation puts the camera directly behind him, and a portrait frame
    // still wants him out of the middle, just not by as many metres.
    this.sideNarrow =
      aspect < reference ? MathUtils.clamp(Math.sqrt(aspect / reference), 0.6, 1) : 1;
    // Before the first update there is nothing to ease from, and a rotate
    // or a first paint should not be watched zooming into place.
    if (!this.initialised) this.camera.fov = this.goalFov(this.blendedFraming().fov);
    this.camera.updateProjectionMatrix();
  }

  /** Drop the smoothing state, e.g. when teleporting to a new scene. */
  /**
   * Put the rig into a *posed* state: snapped to its goal, and held there.
   *
   * The only caller is `RoadStage.pose`, which is how the screenshot harness
   * asks the game to hold still. That makes this the right place to solve a
   * problem the harness had no way to solve for itself.
   *
   * Measured before this: three shoots of one unchanged build, all posed
   * `07-night-campfire`, put the camera at x = -13.29, -14.15 and -14.11, a
   * spread of 0.86 m. The whole difference between the two candidate values
   * of `resting.side` that this project has argued about for two waves is
   * 1.2 m. The thigh's projected horizontal extent came back 0.735, 0.551
   * and 0.571 of its length off those same three shoots — a spread three
   * times the size of the effect the last wave swept for and reasoned from.
   *
   * Two causes, both fixed here rather than worked around:
   *
   * - **The rig is damped on `frameDt`, not on the fixed step.** That is
   *   correct for play — the camera should move in wall-clock time — but
   *   under SwiftShader a frame is anywhere between 0.3 and 5 seconds, so
   *   how far the damping has converged when the shutter opens is luck.
   *   Probed directly, a shot frame sat 0.27 m short of its own goal.
   *   `initialised = false` makes the next update snap exactly onto it.
   * - **The idle drift keeps running.** It is 0.14 m of lateral sway at
   *   this framing and its phase at the shutter is set by how long the page
   *   took to boot. `posed` holds it at zero, and `elapsed` goes back to
   *   zero with it.
   *
   * `posed` clears itself on the next real mood change (`setMood` with a
   * duration), so a game that somehow reached this path would get its drift
   * back the next time the camera changed framing rather than losing it for
   * the session.
   */
  reset(): void {
    this.initialised = false;
    this.groundLift = 0;
    this.moodBlend = 1;
    this.elapsed = 0;
    this.posed = true;
    // The FOV damps like everything else and is the one channel `initialised`
    // never snapped, so a posed 'resting' frame was shot through a lens
    // somewhere between walking's 42 and resting's 43 depending on frame
    // timing. Small, but it scales every pixel measurement taken off the
    // frame, including the thigh extents above.
    this.camera.fov = this.goalFov(this.blendedFraming().fov);
    this.camera.updateProjectionMatrix();
  }
}
