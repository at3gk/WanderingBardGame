/**
 * Where the people stand when the road stops for something.
 *
 * `RoadStage` owns *when* a crowd gathers and *who* is in it; this owns
 * **where they stand**, and it is a separate file for the same reason
 * `campfireLayout` is: an arrangement that only exists inside a scene class
 * can only be judged by looking at a screenshot, and every wave of critique
 * this game has had about its figures has been a placement fault rather than
 * a modelling one.
 *
 * Everything here is stated as a **bearing off the bard's own heading** and a
 * **radius in metres**, which is how you would describe an arrangement out
 * loud — "one at three metres, half a turn to the right". `RoadStage.stand`
 * turns that into world space and, critically, puts each figure's feet on
 * `roadSurfaceHeight` **at that figure's own x and z**, so a listener who
 * stops on a slope stands on the slope.
 *
 * ## The one thing that makes these numbers non-obvious
 *
 * The camera is not behind the bard. It is behind him *and off to one side* —
 * `CameraRig`'s `busking.side` is 2.7 m and `encounter.side` is 1.5 m, both
 * positive — and that single fact inverts the intuition about which bearing
 * lands where on screen. Working it through for the busk: the camera sits at
 * lateral +2.7 m, 3.9 m back, looking at a point 1.6 m *ahead* of the bard on
 * his own centreline. Its screen-right axis therefore points toward lateral
 * **negative**. So:
 *
 * - a listener at a **positive** bearing (the camera's own side) projects to
 *   the **left** of the frame, which is where the staff ribbon lives, and
 * - a listener at a **negative** bearing projects to the **right**, into the
 *   half of the frame that has nothing in it.
 *
 * That is the whole of what was wrong before. The old slot list ran
 * `[-0.62, 0.72, -1.15, 1.25]` with the comment "left of the road first: that
 * is the side of the frame the camera's own offset leaves empty" — the
 * reasoning was right and the sign was not. Measured through the live camera
 * at 1600x900, the busking staff ribbon occupies x 0.128..0.406 and y
 * 0.341..0.691 of the frame, and the two positive slots put listeners at
 * x 0.16 and x 0.10 — inside it, with staff lines drawn across their faces.
 *
 * The second failure is quieter and cost a whole listener: the bard himself
 * sits at x 0.60, and the projection is compressed enough that **every**
 * bearing from about -0.45 to -0.75 lands on top of him at every radius. The
 * old `-0.62` slot was in that band, so on a three-listener busk one of the
 * three was simply invisible behind the performer.
 *
 * ## What replaces it
 *
 * A loose arc through the bard's front-right quadrant, chosen against the
 * measured projection rather than by feel, so that every slot is
 *
 * - inside the frame with a margin,
 * - clear of the staff ribbon's screen share (the worst corner of the worst
 *   slot lands at x 0.47 and the ribbon ends at 0.406),
 * - clear of the bard's own column (x 0.57..0.64), and
 * - at a *different distance* from its neighbours, so the group has depth
 *   instead of being a chorus line.
 *
 * Facing is not a decision this file has to make: a figure standing at a
 * bearing faces the bard by turning back down that same bearing, which
 * `RoadStage.stand` does for every one of them.
 */

/** One place to stand, relative to the bard. */
export interface StagedSpot {
  /** Radians off the bard's forward direction. Negative is his right. */
  bearing: number;
  /** Metres from the bard. */
  radius: number;
}

/**
 * Where the busk's listeners stand, in the order the crowd model counts.
 *
 * Index 0 is the first to have stopped and the last who would ever leave, so
 * it gets the plainest spot; the last entry is the first to drift away, so it
 * gets the one the frame can most afford to lose. A two-person crowd is
 * therefore one either side of the bard, and each further listener widens the
 * arc rather than rearranging it.
 *
 * The screen positions in the table are the figure's feet, measured through
 * the live busking camera at 1600x900 with the rig posed and settled and the
 * jitter below applied — the numbers a shipped frame actually produced, not
 * the ones the centres would produce. The bard's own feet land at x 0.60 and
 * the staff ribbon ends at 0.406, which are the two things every row has to
 * clear.
 *
 * | # | bearing | radius | feet x | feet y | reads as                    |
 * | - | ------- | ------ | ------ | ------ | --------------------------- |
 * | 0 |  -0.95  |  3.40  |  0.70  |  0.64  | nearest, right of the bard  |
 * | 1 |  -0.20  |  3.30  |  0.48  |  0.62  | in front of him, frame left |
 * | 2 |  -1.35  |  2.90  |  0.82  |  0.70  | downstage, largest in frame |
 * | 3 |  -1.05  |  4.60  |  0.77  |  0.60  | a second rank, further off  |
 *
 * Slot 3 sits between 0 and 2 horizontally on purpose. It is a metre and a
 * half further back, so it reads as somebody standing *behind* the front two
 * rather than beside them — which is what turns four figures into a small
 * crowd instead of four figures.
 */
export const BUSK_LISTENER_SLOTS: readonly StagedSpot[] = [
  { bearing: -0.95, radius: 3.4 },
  { bearing: -0.2, radius: 3.3 },
  { bearing: -1.35, radius: 2.9 },
  { bearing: -1.05, radius: 4.6 },
];

/**
 * How far a slot is allowed to wander, so the same square does not draw the
 * same photograph twice.
 *
 * Deliberately small. The jitter used to be ±0.14 rad on a bearing and a
 * radius drawn independently over a 1.8 m range, which meant a slot's screen
 * position varied by more than the gap between two slots — an arrangement
 * that is only true on average is not an arrangement. At these amounts the
 * worst corner of every slot is still clear of the ribbon, of the bard's
 * column and of the frame edge; see `roadStaging.test.ts`, which sweeps them.
 */
export const BUSK_SLOT_JITTER = { bearing: 0.07, radius: 0.25 } as const;

/**
 * Where somebody met at a crossroads stands.
 *
 * Two changes from the band this replaced (-0.95..-0.7 rad, 4.2..5.2 m), and
 * only the second is a change of *kind*.
 *
 * The bearing band is widened slightly and re-centred, which is cosmetic: the
 * encounter camera swings its look 0.22 rad toward negative bearings, so this
 * side is already the side the frame is pointed at, and the old band was
 * pointed at correctly.
 *
 * The distance is the real fix. At 4.2 to 5.2 m the figure came out 0.23 of
 * the frame's height with four metres of empty ground between the two of
 * them, which is not a meeting — it is somebody visible in the same field.
 * Three metres is the distance two people actually stop at to talk, and it
 * takes the figure to 0.28 of frame height without moving them across the
 * frame at all (measured: x 0.71 before, x 0.73 after).
 */
export const MEETING_BEARING: readonly [number, number] = [-1.15, -0.85];
export const MEETING_RADIUS: readonly [number, number] = [2.7, 3.2];

/**
 * How far the bard turns off the road toward whoever he is with.
 *
 * This is a rotation of the *figure* and not of the camera's subject, and the
 * distinction is the whole reason it works. The rig derives its whole pose
 * from the subject's heading, so turning the subject rotates the camera, the
 * road and the figure together and changes nothing at all about how the frame
 * reads. Turning the model alone is what puts his shoulders square to the
 * person he is talking to.
 *
 * **The encounter takes the full turn**, and the reason is not obvious. The
 * encounter camera stands 2.75 rad round from the bard's forward — already
 * most of the way behind him — so turning him *part* of the way toward a
 * traveller at about -1 rad walks that number toward pi, which is the one
 * value where the camera is dead behind him and the instrument he is carrying
 * disappears into his own silhouette. Turning him the *whole* way carries it
 * past pi and out the other side to 3.75 rad, which is the same three-quarter
 * view he had before, mirrored. So the full turn is both the honest one and
 * the one that costs nothing.
 *
 * **The busk takes a small one.** The same arithmetic runs the other way
 * there: the busking camera is 2.54 rad round, so any turn toward the arc's
 * centre at about -0.8 rad moves toward dead-behind, and the busk is the one
 * frame in the game whose subject is the instrument being played. A tenth of
 * a turn angles his shoulders into the group without spending the lute on it.
 */
export const BUSK_FACING_OFFSET = -0.24;

/** Uniformly pick inside a band, given a 0..1 sample. */
export function withinBand(band: readonly [number, number], t: number): number {
  return band[0] + (band[1] - band[0]) * t;
}
