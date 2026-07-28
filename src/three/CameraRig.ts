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
 * Two numbers decide whether this is a game about a person or a game about
 * some scenery, and both are worth stating as arithmetic rather than taste.
 *
 * **How tall he reads.** The bard is about 1.4 m. The frame is
 * `2 * range * tan(fov/2)` metres high where he stands, `range` being the
 * true camera-to-bard distance — `sqrt(distance² + side² + (height - 0.7)²)`,
 * not `distance`, which is why raising `side` quietly shrinks him. Walking's
 * 4.0 m / 2.4 m / 42 degrees puts him at 0.37 of frame height. The previous
 * numbers (4.6 m, 1.5 m, 50 degrees) read 0.29, and 0.29 against busy grass
 * is a figure you have to go looking for.
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
 * paid back in side. Every framing here is aimed at roughly 0.3 of a half
 * frame — clearly out of the middle, nowhere near the edge.
 */
const FRAMINGS: Record<CameraMood, MoodFraming> = {
  // Close enough that the bard is unmistakably the subject, high enough to
  // show the road ahead and the land it crosses. The whole appeal of the
  // walk is seeing what is coming, so the lead still carries the frame
  // forward — just not so far that it pushes him into the bottom edge.
  walking: {
    distance: 4.0,
    height: 2.05,
    lookHeight: 1.15,
    lead: 2.4,
    side: 2.4,
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
    side: 2.1,
    fov: 43,
    positionSmoothing: 1.1,
    targetSmoothing: 1.3,
    drift: 0.14,
  },
  // Pulled back and up to hand the landscape the frame. Narrower FOV
  // compresses the distance and makes the hills read as bigger. The bard is
  // small here on purpose, but he is kept well off-centre so he still reads
  // as the figure in the landscape rather than a speck in the middle of it.
  vista: {
    distance: 7.5,
    height: 3.6,
    // Low for the distance: the look target has to sit *below* the bard's
    // chest here or the long lead drops him onto the bottom edge of the frame.
    lookHeight: 1.6,
    lead: 6.0,
    side: 3.2,
    fov: 38,
    positionSmoothing: 1.2,
    targetSmoothing: 1.4,
    drift: 0.1,
  },
  // Slightly further back than walking and led less, so the thing you have
  // met shares the frame instead of sliding out of it.
  encounter: {
    distance: 4.3,
    height: 2.05,
    lookHeight: 1.2,
    lead: 2.0,
    side: 2.4,
    fov: 44,
    positionSmoothing: 0.7,
    targetSmoothing: 0.9,
    drift: 0.09,
  },
};

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
    const driftX = Math.sin(this.elapsed * 0.23) * Math.cos(this.elapsed * 0.11);
    const driftY = Math.sin(this.elapsed * 0.31 + 1.7);
    this.scratchGoal.x += driftX * framing.drift;
    this.scratchGoal.y += driftY * framing.drift * 0.6;

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
   * the view axis. The half below is worthless: it is more of the road
   * surface the bard is already standing on, and on a 9:19.5 portrait frame
   * it was over half the picture — the bard ended up a small figure floating
   * in a field of dirt.
   *
   * Tilting the camera up by exactly the angle the widening added puts the
   * bottom edge back where the unwidened framing had it and hands the whole
   * gain to the sky, which is what the widening was for. It is done by
   * moving the *look target*, not by adding a pitch offset, so it damps with
   * everything else and cannot fight the target smoothing.
   */
  private widenRise(framing: MoodFraming): number {
    if (this.fovWiden <= 1) return 0;
    const half = MathUtils.degToRad(framing.fov) * 0.5;
    const widened = Math.atan(Math.tan(half) * this.fovWiden);
    return Math.tan(widened - half) * (framing.distance + framing.lead);
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
   * edge in the world. 1.28 buys back a useful margin at the sides and still
   * leaves him readable, which is the trade this game wants.
   */
  applyAspect(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const reference = 16 / 9;
    this.fovWiden = aspect < reference ? MathUtils.clamp(reference / aspect, 1, 1.28) : 1;
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
  reset(): void {
    this.initialised = false;
    this.groundLift = 0;
    this.moodBlend = 1;
  }
}
