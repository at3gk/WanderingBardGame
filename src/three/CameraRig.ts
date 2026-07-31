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
 *   stopped camera looks like a crashed game. A second, even slower term
 *   (`sway`) swings the camera a couple of degrees *around* the bard, so
 *   two moments a minute apart on the same straight road are not the same
 *   photograph. Both are held at zero while posed for a screenshot.
 * - Framing shifts with the phase: walking sits back and high, busking
 *   comes in closer and lower to put the crowd in frame, resting pulls
 *   right in on the fire. Transitions are eased over seconds, never cut.
 *   The moods are meant to be *different pictures*, not one picture at
 *   different times of day — see `FRAMINGS`, where the vista and the
 *   encounter were rebuilt for exactly that reason.
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
  /**
   * Radians to swing the *look target* off the subject's own heading.
   *
   * Zero everywhere except `encounter`, which turns the frame toward
   * whoever has been met. The rig is given a subject, not a scene, so it
   * cannot be told where that person is standing — but `RoadStage.stand`
   * places them in a fixed band of bearings, and half of that band's
   * middle is a perfectly good thing to aim at. See `encounter`.
   */
  lookYaw: number;
  fov: number;
  /** Seconds for the position to close most of the gap to its goal. */
  positionSmoothing: number;
  /** Seconds for the look target. Slower than position on purpose. */
  targetSmoothing: number;
  /** Idle drift amplitude in metres. */
  drift: number;
  /**
   * Idle *orbit* amplitude, radians, added to the camera's goal heading.
   *
   * Distinct from `drift`, which slides the camera in world space. This one
   * arcs it around the subject, so the road's vanishing point and the
   * bard's offset from it both move a little — which is what makes two
   * moments differ *compositionally* rather than just by a few centimetres.
   * A couple of degrees over a minute and a half is well under the
   * threshold where a slow camera move becomes a camera move you notice.
   */
  sway: number;
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
    lookYaw: 0,
    fov: 42,
    positionSmoothing: 0.55,
    targetSmoothing: 0.85,
    // Was 0.06. The walk is the framing the player spends nearly all of
    // their time in, and it was the one shot with nothing to distinguish
    // one minute of it from the next: fixed distance, fixed side, a dead
    // straight relationship to the road. Ten centimetres of breathing plus
    // the sway below moves the bard about three per cent of the frame's
    // width and the vanishing point about twice that, over a minute — too
    // slow to read as motion, fast enough that two screenshots taken a
    // little apart are not the same picture.
    drift: 0.1,
    sway: 0.05,
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
    lookYaw: 0,
    fov: 43,
    positionSmoothing: 0.75,
    targetSmoothing: 1.0,
    drift: 0.11,
    // Small: the staff is a *readable object* in this framing and the
    // listeners are arranged around a camera that is assumed to be where
    // `side` puts it. Two degrees is all the life this shot needs.
    sway: 0.035,
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
    lookYaw: 0,
    fov: 43,
    positionSmoothing: 1.1,
    targetSmoothing: 1.3,
    drift: 0.14,
    // Smallest of the five. `campfireLayout` chooses where every prop
    // stands by sighting along the line from this camera to the seat, and
    // an orbit large enough to see is an orbit large enough to swing a
    // bedroll into that line.
    sway: 0.02,
  },
  // Pulled well back to hand the landscape the frame. Narrower FOV compresses
  // the distance and makes the hills read as bigger. The bard is small here on
  // purpose, but he is kept well off-centre so he still reads as the figure in
  // the landscape rather than a speck in the middle of it.
  //
  // **Rebuilt, because it was not a different picture.** Measured off the
  // postcards, the old vista put the bard at 0.22 of the frame's height with
  // his chest at 0.70 and the road's vanishing point at 0.36 of its width;
  // the walk put him at 0.42, chest 0.67, vanishing point 0.36. Change the
  // hour and recolour and the two frames are the same photograph — which is
  // exactly what the critique said when it called every road shot one
  // composition. Three numbers of the five that matter were within a few per
  // cent of the walking framing's, and a "vista" that differs from a walk
  // only by lens length is a zoom, not a shot.
  //
  // What separates them now, in the order the eye notices:
  //
  // - **How much of the frame is land.** The horizon goes from 0.32 — the
  //   walking composition, which this shot simply inherited — to 0.25. Three
  //   quarters of a vista is now the country it is named after. This is the
  //   biggest single change and it is bought with camera height, which tips
  //   the view down without moving the camera an inch further away.
  // - **Size.** 3.5 m up rather than 2.9 takes the true range from 7.96 m to
  //   8.45 and the figure from 0.26 of frame height to 0.24, against the
  //   walk's 0.42. Not the halving the first draft of this framing went for
  //   — see the constraint below.
  // - **Where he sits in the frame.** He no longer spans the middle of it.
  //   The walk gives him 0.40 to 0.82, top to bottom of the central band;
  //   this gives him 0.60 to 0.87, entirely inside the lower third, with the
  //   whole middle of the picture handed to land seen from above.
  // - **Where he sits across it.** 0.63 of the frame's width against the
  //   walk's 0.58, which is less than it sounds and is bought entirely by
  //   the long lead — see the header's arithmetic, where `side` is diluted
  //   by `lead / (distance * (distance + lead))`.
  //
  // **The constraint that shaped all of the above, which is not obvious from
  // anywhere else in this file.** `tools/frame-quality.mjs` holds every one
  // of its six poses in `phase: 'vista'` — not because a vista is
  // representative, but because it is the only mood that stops the walk and
  // therefore the only one that lets a posed time of day survive. So these
  // constants are the lens the game's whole tonal gate is shot through, and
  // the gate's tightest pose (noon, 2.60 stops against a 2.5 floor) has ten
  // hundredths of headroom. Measured, one change at a time, off that pose:
  //
  // | change                        | stops | p10   |
  // | ----------------------------- | ----- | ----- |
  // | unchanged                     | 2.60  | 0.103 |
  // | distance 7.5 -> 9.0, alone    | 2.42  | 0.117 |
  // | fov 38 -> 44, alone           | 2.43  | 0.115 |
  // | height 2.9 -> 3.9, in context | 2.30  | 0.126 |
  // | ... and back to 3.3           | 2.31  | 0.126 |
  // | side 3.2 -> 1.5, in context   | +0.08 |       |
  //
  // The first three rows are single changes off the unchanged framing; the
  // last three were taken while the rest of a much larger rewrite was in the
  // tree, so read them as deltas rather than as absolutes. What they say
  // together is unambiguous. Every way of showing *more world* — further
  // back, wider lens — raises the darkest tenth of the frame, because what
  // leaves the picture is near shadowed undergrowth and what arrives is
  // haze-lit distance. Camera height alone costs nothing at all: it changes
  // the *angle* on the same slab of world rather than trading near for far.
  // That is why this framing is now a tall shot from where it always stood
  // rather than the long pull-back the composition notes above were first
  // written for, and it is the reason to reach for `height` and not
  // `distance` if a later wave wants more of this.
  //
  // A note on the landmark bias, since the header makes a promise about it:
  // this camera's axis sits atan(2.6 / 14.5) = 10.2 degrees off the road,
  // against the walk's atan(1.2 / 6.4) = 10.6, where the old vista sat at
  // 6.8. `WorldStreamer.LANDMARK_VIEW_BIAS` is one constant measured from
  // the walking framing, so it is more nearly right during a vista than it
  // has ever been — which matters, because the vista is the one shot whose
  // subject is the skyline that constant places.
  vista: {
    // Unchanged, and see the table above before changing it.
    distance: 7.5,
    // Was 3.6 m, and that was the worst offender in the game: at seven and a
    // half metres back it put the bard's chest at 0.82 of the frame with an
    // empty field filling the middle, so the shot meant to hand the landscape
    // the frame handed it to nothing in particular. The distance is what
    // makes a vista, not the altitude — pulling the height down to 2.9 keeps
    // every hill and every landmark in shot and moves him to 0.70.
    //
    // 3.5 now, which is most of the way back to the number that paragraph
    // rejected — and it is right this time for a reason that paragraph did
    // not have. 3.6 failed *with a 1.05 m look target*: the camera rose and
    // its aim did not, so it tipped down and dropped the bard to 0.82 while
    // leaving the middle of the frame empty field. The two numbers move
    // together here, and it is the pair that composes, not either alone.
    // At 3.5 looking at 1.0 the horizon comes up to 0.25 and the bard sits
    // at 0.60 to 0.87 — the tip is the *point*, and what fills the middle is
    // the land it uncovers.
    //
    // 4.5 was tried and cannot be had at this distance: the feet reach the
    // bottom edge at 1.005 of frame height. Height and distance are a pair
    // too, and this distance is fixed by the tonal gate above.
    height: 3.5,
    // Up from 0.85, which put the horizon at 0.21 — under a fifth of the
    // frame for the sky, which stops reading as a wide view of somewhere and
    // starts reading as a camera pointed at the ground.
    lookHeight: 1.0,
    // Was 5.0. It is the only lever that moves the bard off the middle of
    // the frame — his offset from the axis is atan(side/distance) minus
    // atan(side/(distance + lead)), which goes to zero as the lead shortens
    // — and it also holds the horizon up while the camera climbs.
    lead: 7.0,
    // Was 1.5. Most of the increase is paid straight back to the lead
    // dilution above: 2.6 at this lead buys 8.9 degrees off the axis where
    // 1.5 at the old lead bought 4.9. It costs 0.08 stops on the noon gate
    // (table above), which is the largest bill this framing pays for
    // composition and the only one worth paying.
    side: 2.6,
    lookYaw: 0,
    // Unchanged, and deliberately so: the narrowest lens in the set is what
    // compresses the distance and makes the hills read big, and every
    // degree of widening costs the tonal gate about 0.03 stops.
    fov: 38,
    // Slower than the old 1.2. Coming here from a walk is 3.5 m back, 1.65 m
    // up and 1.4 m across — half a metre more of climb and swing than it used
    // to be — and the whole point of a vista is that the camera *withdraws*
    // to show you something. Damping it harder turns the 1.8-second mood
    // blend into a three-second reveal, comfortably inside the six seconds
    // `RoadStage.VISTA_HOLD_SEC` holds the moment for.
    positionSmoothing: 1.4,
    targetSmoothing: 1.6,
    drift: 0.1,
    // Long lens, small subject: a degree here is worth more screen than a
    // degree anywhere else in the set.
    sway: 0.02,
  },
  // Slightly further back than walking and led less, so the thing you have
  // met shares the frame instead of sliding out of it.
  //
  // **That description was the whole problem.** "Slightly further back than
  // walking" is a walking shot, and that is what the frames showed: the same
  // camera, the same horizon at 0.34, the same figure at 0.37 of frame
  // height, with a stranger the size of a thumbnail out near the right edge.
  // Nothing in the picture said a meeting was happening.
  //
  // This one now goes the other way — in, down, and turned. In and down
  // because that is what a camera does when two people stop to talk; turned
  // because the person met is not on the road and the road is no longer the
  // subject. The measured result: the bard grows to 0.41 of frame height,
  // the camera drops to 1.65 m so his hat breaks the skyline instead of
  // sitting a tenth of a frame below it, and the axis swings 12 degrees off
  // the road so the traveller comes in from 0.71 of the frame's width toward
  // 0.70 with a great deal more of the frame between them and the edge.
  //
  // The move is deliberately small in metres — 0.7 m in, 0.25 m down — for
  // the reason the old comment gives below and which still holds: an
  // encounter arrives *during* a walk and eases over a second and a half, so
  // whatever this framing does it must be able to do without the player
  // feeling the camera relocate. Almost all of the difference above is
  // bought with the lens and the yaw, which cost no travel at all.
  encounter: {
    distance: 3.6,
    // Below walking's rather than following it. The original argument — that
    // a quarter of a metre of camera height would read as a visible lift —
    // is right about the *rate* and wrong about the conclusion: a quarter of
    // a metre eased over a second and a half is 17 cm/s, which is slower
    // than the bard's own bob. What it buys is the one thing that makes this
    // read as a meeting rather than a walk with a bystander: from 1.65 m the
    // camera is at the bard's own eye level, so both figures stand *against
    // the sky* instead of against the ground plane.
    height: 1.65,
    lookHeight: 0.9,
    // Longer than walking's, not shorter. A short lead here would swing the
    // road's vanishing point off the left edge — see the note on `side` — and
    // it is also what stops `lookYaw` below from taking the road with it.
    lead: 2.4,
    // Was 2.4, and had to come down with walking's whether or not the two
    // are the same shot. An encounter arrives during a walk and the mood
    // eases over a second and a half; leaving this one at the old offset
    // meant the road slid back out to the left edge every time the bard met
    // somebody, which is a worse fault than the lopsided frame it came from —
    // it is a lopsided frame you can watch the camera arrive at. A little
    // above walking's, because the traveller stands off the road and the
    // wider angle is what keeps both of them in shot.
    //
    // 1.5, a shade under walking's, because the yaw below is now doing the
    // work `side` was being asked to do and doing it better. Swinging the
    // camera further round moves the bard right and the traveller *left*,
    // toward each other — at side 2.2 the two overlap. Turning the look
    // instead moves them together across the frame without closing the gap
    // between them.
    side: 1.5,
    /**
     * Turn the frame toward whoever has been met.
     *
     * `RoadStage.placeMeeting` stands the traveller inside `roadStaging`'s
     * `MEETING_BEARING` and `MEETING_RADIUS` — currently -1.15 to -0.85
     * radians from the bard's heading, 2.7 to 3.2 m out — a band narrow
     * enough to aim at from here without the rig needing to be told where
     * anybody is. This is about a fifth of the way round to the middle of
     * that band. (The band was -0.95..-0.7 at 4.2..5.2 m when this number
     * was chosen. Pulling the traveller in to conversational distance moved
     * their screen position by 0.02 of the frame's width, which is why the
     * yaw did not have to move with it — see `roadStaging`.)
     *
     * A quarter and not a half. Aiming *at* the traveller centres them, and
     * two figures either side of the axis are closer together on screen
     * than the same two off to one side of it — tan is convex, so the
     * separation the shot depends on is largest when the pair sits off
     * centre. Measured across the traveller's whole placement band, this
     * value keeps them between 0.65 and 0.77 of the frame's width with the
     * bard at 0.54, and it leaves the road's vanishing point at 0.27
     * rather than pushing it off the edge, which a half turn does.
     */
    lookYaw: -0.22,
    // Widest in the set. Two figures 4.7 m apart, a camera 3.6 m from one of
    // them, and a road that still has to be in the picture: this is the one
    // framing with three things to fit rather than one.
    fov: 46,
    positionSmoothing: 0.7,
    targetSmoothing: 0.9,
    drift: 0.09,
    // Smaller than walking's. The traveller's screen position is not under
    // this file's control and the placement band is already 0.12 of the
    // frame's width wide; an orbit on top of that is variance nobody asked
    // for.
    sway: 0.015,
  },
};

/**
 * Metres the camera rises on the tallest screen this game will meet.
 *
 * This replaces `WIDEN_RISE_SHARE`, and the replacement is the answer to a
 * question that constant was asked twice and correctly refused twice: stop
 * spending the narrow-screen FOV widening on empty sky and bare road, and
 * give it to the middle of the picture instead.
 *
 * The refusal was sound and is worth keeping. The widening adds angle at the
 * top and bottom *edges* of the frustum; the mid band is by definition at
 * neither edge, so no setting of a constant that divides the added angle
 * between sky and road can send any of it to the middle. Both extremes were
 * shot — all to the sky, then all to the road — and there is nothing hiding
 * between them.
 *
 * What that argument then said, in a sentence, and never acted on: *"what
 * would grow the mid band is a higher camera, which spreads the same slab of
 * world over more angle."* That is this constant. It is not a share of
 * anything; it is a tripod, raised as the screen gets taller.
 *
 * The arithmetic, on the walking framing at 390x844 (the frame the phone
 * complaint is about). Raising the camera by 0.45 m and leaving the look
 * target where it is tips the view down by 3.9 degrees, because the pitch is
 * `atan((height - lookHeight) / Rt)` and only the numerator moved. Every
 * boundary in the frame then moves, and they do not move together:
 *
 * | band                       | before      | after       |
 * | -------------------------- | ----------- | ----------- |
 * | sky, top of frame to horizon | 0 .. 0.32 | 0 .. 0.26   |
 * | midground, horizon to hat  | 0.32 .. 0.39 | 0.26 .. 0.46 |
 * | the bard                   | 0.39 .. 0.82 | 0.46 .. 0.86 |
 * | near ground, below his feet | 0.82 .. 1  | 0.86 .. 1   |
 *
 * The midground — the band that carries the road's convergence, the
 * treeline, the landmark and everything else a player actually looks at —
 * goes from a seventh of the frame to a fifth, and it takes it from the two
 * bands the critique called dead. The bard does not shrink to pay for it: the
 * true camera-to-subject range goes 4.22 m to 4.34, three per cent.
 *
 * That table is arithmetic on flat ground. Measured off `08-phone-portrait`,
 * where the road is on a slope and the far land is raised, the skyline went
 * 0.29 to 0.21 and the midground band from about a fourteenth of the frame to
 * a quarter of it — the same trade, a little larger, because real ground
 * amplifies a downward tilt. If a later wave finds a fifth of the frame too
 * little sky for a phone, this constant is the one dial: it is very nearly
 * linear, a tenth of a metre being worth about 0.015 of frame height.
 *
 * Note what is *not* claimed. The bottom of a portrait frame is still ground
 * seen from close up, because a camera four metres behind a walking figure
 * has ground under it however high it stands; the near edge of the view moves
 * out only from 2.91 m to 3.22, a third of a metre. What changed is how much
 * of the frame that slab is allowed to have.
 *
 * Applied through the goal position, so it damps with everything else and a
 * device rotation eases rather than cuts.
 */
const TALL_LIFT_MAX = 0.45;

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
    lookYaw: mix(a.lookYaw, b.lookYaw),
    fov: mix(a.fov, b.fov),
    positionSmoothing: mix(a.positionSmoothing, b.positionSmoothing),
    targetSmoothing: mix(a.targetSmoothing, b.targetSmoothing),
    drift: mix(a.drift, b.drift),
    sway: mix(a.sway, b.sway),
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
   * Multiplier on every framing's `side` and `lookYaw`, set from the
   * screen's aspect. 1 on anything 16:9 or wider. See `applyAspect`.
   */
  private sideNarrow = 1;

  /**
   * How tall the screen is, 0 on 16:9 and 1 on a phone held upright.
   * Scales `TALL_LIFT_MAX`. See `applyAspect`.
   */
  private tallness = 0;

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
    //
    // The sway rides on the *goal*, not on the result, so it goes through
    // the same damping as a real bend and can never outrun it. Two periods,
    // 88 s and 33 s, neither a multiple of the other or of the drift's, so
    // the combined figure never repeats and no beat frequency appears.
    const sway = this.posed
      ? 0
      : (Math.sin(this.elapsed * 0.071) * 0.7 + Math.sin(this.elapsed * 0.19 + 2.1) * 0.3) *
        framing.sway;
    this.heading = dampAngle(
      this.heading,
      subject.heading + sway,
      framing.positionSmoothing * 1.35,
      dt,
    );

    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);

    // Goal position: back along the heading, up, and a little to the side.
    const side = framing.side * this.sideNarrow;
    this.scratchGoal.set(
      subject.position.x - sin * framing.distance + cos * side,
      subject.position.y + framing.height + TALL_LIFT_MAX * this.tallness,
      subject.position.z - cos * framing.distance - sin * side,
    );

    // Goal look target: ahead of the subject along its *own* heading, not
    // the camera's. That difference is what makes the camera look into a
    // bend rather than at the outside of it.
    //
    // `lookYaw` turns it off that heading — only the encounter does, and
    // only by a fifth of a radian. It is narrowed with `side` on a tall
    // screen for exactly the reason `side` is: a degree of yaw is worth
    // three times as much screen offset on a portrait phone, and the road
    // has already left the frame by the time it has been paid twice.
    const aim = subject.heading + framing.lookYaw * this.sideNarrow;
    this.scratchTarget.set(
      subject.position.x + Math.sin(aim) * framing.lead,
      subject.position.y + framing.lookHeight,
      subject.position.z + Math.cos(aim) * framing.lead,
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
   *
   * The widening is only half the tall-screen story and the smaller half.
   * The other is `TALL_LIFT_MAX`, which raises the tripod as the screen gets
   * taller — that is what decides how much of a portrait frame is worth
   * looking at, and the argument is there rather than here.
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
    //
    // The floor was 0.6, which is above what the square root asks for on a
    // 9:19.5 phone (0.51) and so was the number actually in force there. It
    // came down because it stopped being one framing's business: the vista's
    // `side` is now 3.2 m, and a multiplier tuned against the walk's 1.2 put
    // that shot's bard at 0.78 of the frame's width on a phone — a hand's
    // breadth from the edge. Letting the square root apply as written puts
    // him at 0.72 and, incidentally, brings the walking framing's own
    // vanishing point back from 0.22 of the frame to 0.26, which was the
    // other half of the same complaint. 0.42 is left as a guard for aspects
    // narrower than anything sold.
    this.sideNarrow =
      aspect < reference ? MathUtils.clamp(Math.sqrt(aspect / reference), 0.42, 1) : 1;
    // How tall the screen is, on a scale where 16:9 is 0 and a phone held
    // upright is 1. Linear in aspect rather than in the FOV ratio, because
    // the thing being scaled is a camera height and not an angle, and
    // because the FOV ratio is clamped at 1.14 — every aspect from 4:3 down
    // would otherwise get the same lift. The 0.55 puts the top of the ramp a
    // little past the narrowest phone in circulation, so nothing real sits
    // on the clamp.
    this.tallness =
      aspect < reference ? MathUtils.clamp((reference - aspect) / (reference - 0.55), 0, 1) : 0;
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
