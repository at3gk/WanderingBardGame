/**
 * The staff as a **lane in the world**: a ribbon of parchment floating over
 * the road ahead, carrying real notation toward a barline at the bard.
 *
 * This is the picture the whole game is for, so it is worth saying exactly
 * what it is, what it refuses to be, and — because this file has changed
 * shape twice — what was tried before and why the third answer is different
 * from the first.
 *
 * --- the three shapes, and what each one got wrong ----------------------
 *
 * **One: five ribbons laid down the road.** The staff ran from the bard to a
 * vanishing point and the notes came at you. The instinct was right and the
 * drawing was wrong: five near-parallel lines converging over a landscape are
 * not read as a stave, they are read as **cable**. The eye has a very old
 * rule that says parallel lines shrinking toward a vanishing point are a long
 * thing going away, and no amount of tinting or fading talks it out of that —
 * a fainter wire is still a wire. The lines had nothing *between* them. They
 * were five wires in clear air, and clear air is what made them wires.
 *
 * **Two: a limewashed plank on two legs at the roadside.** Standing the stave
 * up face-on fixed the cabling and bought a great deal besides — the ink
 * became a surface with light on it, the world could pass in front of it, and
 * pitch became exactly readable. What it cost was the arrival. Notes crossed
 * the frame sideways, the plank had to be as wide as the run, and a board
 * wide enough to hold a bar of quavers is a **billboard**: measured on the
 * shipped build it took 29 per cent of the width and 33 per cent of the
 * height of every walking frame, parked just left of the point the road runs
 * to. Six successive critiques called it the composition's biggest problem
 * and the file's own answer each time was that the arithmetic would not let
 * it be smaller. The arithmetic was right. The shape was wrong.
 *
 * **Three, this one: a lane.** The staff runs *away up the road* again, and
 * the notes come at you again — but it is a **ribbon**, not five wires.
 * Between the rules there is paper: a translucent parchment veil that carries
 * them. That single difference is what shape one was missing. A surface
 * receding into the distance is read as a surface receding into the distance;
 * it is only the *lines on their own* that turn into cable. And because the
 * ribbon is a veil rather than a plank, the land reads through it, the road's
 * vanishing point is never occluded, and its far end can simply dissolve into
 * the air instead of converging to a point.
 *
 * --- what holds it up ---------------------------------------------------
 *
 * - **Pitch stays vertical and unforeshortened.** The ribbon is a *vertical*
 *   surface: its cross-section is the staff and distance along it is time. A
 *   receding vertical plane compresses along its length and not across its
 *   height, so the five rules stay five rules at their true spacing and a
 *   note head is on the line it is on. The one axis a child reads is the one
 *   axis perspective does not touch.
 * - **The letters do not foreshorten either, because they are billboards.**
 *   This is the fact that makes the whole shape viable and it took a while to
 *   see: the glyphs face the camera whatever the ribbon does, so the ribbon
 *   may lie at any angle it likes without the notation becoming a smear.
 *   Only *size* costs anything at distance, and size is a number this file
 *   can choose.
 * - **It fans away from the road, not along it.** A ribbon exactly parallel
 *   to the road would be seen edge-on from a camera standing on the road. It
 *   leaves the barline at about forty degrees off the road and straightens as
 *   it goes, so the near stretch — the stretch a player is actually reading —
 *   is turned toward the eye, and the far stretch lies down along the
 *   perspective and reads as depth. Its own vanishing point is well to the
 *   left of the road's, which is what keeps the road running clear past it.
 * - **Both ends dissolve, and so do the top and bottom.** There is no
 *   silhouette anywhere on this object: the paper's opacity falls to nothing
 *   at the far end, just past the barline at the near end, and over a couple
 *   of steps above and below whatever the tune is actually using. A thing
 *   with no hard edge cannot read as signage — and the dissolve has to be
 *   genuinely gradual, because a short one is a dark *band*, and a dark band
 *   parallel to the staff is a sixth rule (see `PAPER_FADE_STEPS` for the
 *   round that proved it). It also means the board's old margin problem — a
 *   fixed reserve of blank plank sized for the highest and lowest notes in
 *   the whole songbook — is gone: the paper is only *there* where the tune on
 *   the road right now needs it. See `paperEdges`.
 * - **The ink is more opaque than the paper.** A veil at forty per cent that
 *   ruled its staff at forty per cent would lose the staff over a bright sky,
 *   which is exactly how shape zero (a translucent card) died. Ink on tracing
 *   paper is not translucent: the rules and the barline carry their own, much
 *   higher opacity, so the pitch scaffold holds against anything behind it
 *   while the paper stays a veil.
 * - **The ink is geometry, not a texture.** Each rule and the barline are
 *   their own narrow bands of dark vertex colour with a shoulder either side,
 *   so they are exactly crisp at any range — the transition is a gradient in
 *   world units rather than in texels. And they are dead straight: rows of a
 *   ruled surface at constant world height. The plank's rules used to acquire
 *   a hand-drawn waver at high pixel ratios, which read as damage; that was
 *   never geometry, it was the painterly material's band-edge noise flipping
 *   across a face with one normal, and this surface does not run that
 *   material.
 *
 * The notation is real and stays real. A glyph sits at its **true staff
 * step** (`core/notation.ts` owns that mapping and this file does not
 * second-guess it), wears its own stem direction by the engraving rule, gets
 * a ledger line when it needs one, and carries its letter name in the head.
 * That predates all three shapes and outranks anything decorative here: if a
 * choice would make a note prettier and wrong, the note stays right.
 *
 * How the notes draw, and why:
 *
 * - **One glyph atlas, generated on a canvas at construction.** Seven letters
 *   times stem-up/stem-down times with/without a ledger, plus a rest. No font
 *   file is fetched — the bundle budget is 5 MB for the whole game and a
 *   webfont for twenty-nine glyphs is a poor way to spend any of it — so the
 *   letters are drawn with whatever serif the device has.
 * - **Two channels, not two textures.** The glyph body is drawn into alpha
 *   and the letter into green, so one sample gives both a coverage mask and a
 *   letter mask. The body is tinted by the instrument and the letter is
 *   cream, which is the one colour DESIGN.md reserves for notation.
 * - **Instanced quads billboarded in view space,** the same trick
 *   `fx/Particles.ts` uses. A dozen notes could be a dozen sprites, but the
 *   burst that follows a hit is a hundred and something, and having one
 *   mechanism for both means one thing to get right.
 * - **The imminent note is the boldest thing on the ribbon.** A note is born
 *   small and faint at the far end, is fully readable for the whole of its
 *   last 1500 ms, and swells to full ink and its largest size exactly at the
 *   barline — see `glyphEnvelope`. The wave-2 critique found the opposite
 *   shipped: mid-flight notes at full strength while the one to tap NOW was
 *   already dissolving, because the fade toward "gone by" started at the hit
 *   moment itself. Urgency must run the same direction as time.
 * - **Lit by the ribbon they are printed on.** Neither the ribbon nor the
 *   glyphs can run `painterly.ts`'s material — the glyphs need an atlas it
 *   has no sampler for, and the ribbon needs per-vertex opacity it has no
 *   attribute for — so the world's own lighting model is evaluated on the CPU
 *   from the scene's shared uniforms, with the shader's own constants read
 *   out of the shader source rather than copied (see `painterlyConstant`),
 *   and handed to both. That keeps a note head at a fixed ratio below the
 *   paper it sits on, which is what holds it legible from noon to dusk
 *   without anyone tuning a second set of colours. What is given up against
 *   the plank, honestly: the world's per-fragment grain, its fresnel rim and
 *   its distance fog. At the five to eleven metres this lane occupies the fog
 *   is arithmetically nothing, a veil has no silhouette for a rim to find,
 *   and the paper carries its own tooth. What is *kept* is everything that
 *   moves with the day — sun colour, sky, bounce, exposure — plus the
 *   foreground value tier, which is now evaluated **per fragment at each
 *   point's own depth** rather than once for the whole object. A lane six
 *   metres long spans enough depth for that to matter, and it is the one
 *   place this arrangement is strictly better than running the shared
 *   material.
 *
 * Nothing here flashes and nothing shakes. A hit blooms and scatters in the
 * instrument's colour along its own `noteMotion`; a miss softens toward paper
 * and fades. There is no red anywhere in this file, and there is not going to
 * be — missing a note in this game costs a little warmth and nothing else,
 * and the visuals are not allowed to say otherwise.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
  type IUniform,
} from 'three';
import { TRAVEL_TIME_MS } from '../../core/beats';
import type { Instrument } from '../../core/instruments';
import { letterForStep, needsLedger, staffStepAt, stemDown } from '../../core/notation';
import type { Judgement } from '../../core/performance';
import type { SongBeat } from '../../core/song';
import {
  createPainterlyGlobals,
  createPainterlyMaterial,
  type PainterlyGlobals,
} from '../painterly';

/**
 * One diatonic step, in metres. Two steps make a staff space, so the printed
 * staff (E4 to F5) is eight steps — just under a metre.
 *
 * Down from the plank's 0.12, and the reason is the shape rather than taste.
 * A receding lane compresses along its length and not across its height, so
 * the ribbon's screen *width* is a fraction of its arc while its height is the
 * whole staff — and at 0.12 that came out as a wedge taller than it was long,
 * which is a panel, not a lane. Measured on the desktop walking frame: 296 px
 * of staff over 224 px of visible run. Bringing the staff down turns that the
 * right way up.
 *
 * The floor on it is set by the letter rather than by the lines: below about
 * 0.07 the letter inside a note head stops being legible on a phone, and the
 * letter is the scaffold the pedagogy rests on. This is not that floor and it
 * is not allowed to become it — see `NOTATION_REFERENCE_PX`, which is what
 * holds a letter legible on a small screen instead of this constant.
 */
const STEP_M = 0.082;

/** The five printed lines of the treble staff: E4 G4 B4 D5 F5. */
const LINE_STEPS = [2, 4, 6, 8, 10];

/** B4, the middle line — the step the whole stave is hung from. */
const MIDDLE_STEP = 6;

/**
 * Height of the middle line above the road, in metres.
 *
 * The lane floats: it is not standing on anything, so this is a clearance as
 * much as a composition choice. At 1.55 the bottom of the paper clears the
 * road by about two thirds of a metre at the near end even when the tune is
 * using its lowest ledger, which is enough that a rise in the road ahead does
 * not eat the staff (the base height is taken as the *highest* road point the
 * lane spans, see `samplePath`, so a lane crossing a crest floats over the
 * crest rather than through it).
 *
 * It is also just under the busking camera's own eye line, which is what
 * makes the lane read as receding *away and slightly down* toward the horizon
 * rather than as a banner hung overhead.
 */
const LANE_LIFT_M = 1.05;

/**
 * Where the barline stands, in metres along the road ahead of the bard.
 *
 * Small and positive. Zero would put the hit moment exactly on the bard's own
 * body and a note would arrive *inside* him; much more than this and "when it
 * reaches the bard" stops being true. Six tenths of a metre puts the arriving
 * note at his leading shoulder.
 */
const LANE_NEAR_M = 0.6;

/**
 * How far ahead the far end of the lane sits, measured along the road from
 * the barline.
 *
 * This and `SIDE_*` below are the shape of the lane, and they were chosen
 * against one number that is easy to get wrong: **how fast a note crosses the
 * screen as it arrives**. The plank ran 1.83 m of screen-parallel travel in
 * `TRAVEL_TIME_MS`, which at its depth was about 11 per cent of the frame's
 * width per second — sedate, and part of why the board felt like a chart. A
 * lane long enough to read as real distance travels much further in the same
 * time, and *all* of that speed lands on the screen if the lane is turned
 * face-on. A first sizing at 7.5 m of arc leaving the barline at 55 degrees
 * came out at 51 per cent of the frame per second, which is a note flicking
 * past rather than arriving.
 *
 * So the lane is sized from the arrival backwards: 6.63 m of arc over 1800 ms,
 * leaving the barline at 29.9 degrees off the road, which puts the
 * screen-parallel speed at the barline at about 25 per cent of the frame per
 * second — twice the plank's, which the arrival wants, and slow enough to aim
 * at.
 *
 * It is scaled down on a narrow screen as well, and that is not a refinement:
 * see `LENGTH_SHARE_MIN`.
 */
const LANE_LENGTH_M = 6.4;

/**
 * How far the lane sits to the road's left, at the barline and at the far
 * end, in metres.
 *
 * Left, and not by taste: the bard stands right of centre in every framing
 * this game uses, so the left of the frame is where the road runs away and
 * there is least going on. The near offset has to clear the bard's own
 * silhouette (he is about 0.45 m across at the shoulder) with room for a note
 * head; the far offset is what turns the lane away from the road's vanishing
 * point, and it is the number that stops this being a strip stuck over the
 * road's own perspective.
 */
const SIDE_NEAR_M = 1.5;
const SIDE_FAR_M = 2.95;

/**
 * How the sideways offset grows along the lane.
 *
 * `1 - (1 - t)^SIDE_EASE_Q` blended with a little straight `t`. The blend is
 * what sets the two angles that matter: the exponent gives the barline its
 * turn toward the camera (steep slope at t=0, so the lane leaves sideways and
 * a note visibly *crosses* the barline rather than merely growing), and the
 * linear term keeps the far end from flattening to exactly road-parallel,
 * where it would be edge-on and invisible.
 */
const SIDE_EASE_Q = 3.2;
const SIDE_EASE_LINEAR = 0.3;

/**
 * How much of the sideways fan a screen actually gets, against its aspect.
 *
 * The fan is what makes the lane readable, and it is also what pushes the far
 * end toward the left edge of the frame. A wide screen has room for it; a
 * phone held upright does not — measured, the full fan puts the far end
 * roughly 4.8 m to the left of the road at a depth where a portrait frame is
 * only 4.7 m wide, so the last third of the lane would be off the picture.
 *
 * On a tall frame the lane instead runs nearly straight up the road, which is
 * the right answer for that shape twice over: there is no width to spend, and
 * the middle of a portrait frame is the dead zone every critique of this game
 * has named. A lane going away up it is exactly what that space wants.
 *
 * The near offset keeps most of its own value at every aspect — it is not
 * composition, it is clearance from the bard — so the two ends are scaled
 * separately.
 */
const FAN_ASPECT_LO = 0.75;
const FAN_ASPECT_HI = 1.72;
const FAN_MIN = 0.34;
const FAN_MAX = 1.06;
/** How much of the fan the *near* offset gives up on a narrow screen. */
const NEAR_FAN_FLOOR = 0.4;

/**
 * How much of the lane's sideways *spread* survives a narrow screen — which
 * is a different question from how far out it starts, and conflating the two
 * cost a round.
 *
 * The first version scaled both ends by the same fan, and on a portrait phone
 * that was very nearly fatal: the near offset kept most of its value through
 * `NEAR_FAN_FLOOR` while the far one was scaled to a third, so the two ends
 * ended up within ten centimetres of each other and the lane came out at
 * three and a half degrees off the road. Three and a half degrees, from a
 * camera standing on the road, is edge-on. Measured, it drew 5.6 per cent of
 * the frame wide — on screen, and useless.
 *
 * The spread is what the angle is made of, so it gets its own floor and a
 * generous one. Whether it *fits* is not this constant's problem: `fitShare`
 * projects the result and closes it if it does not.
 */
const SPREAD_FLOOR = 0.45;

/**
 * How much clear frame the lane keeps between itself and the left edge, in
 * normalised device coordinates — so 0.22 is eleven per cent of the frame's
 * width.
 *
 * The fan above is an *open-loop* answer to a narrow screen: it knows the
 * aspect ratio and guesses how much sideways room that buys. It is not enough
 * on its own, and this project has now paid for that. `CameraRig` owns where
 * the camera stands and how wide it opens, and it moves — during this very
 * piece of work the rig gained a new sideways floor on portrait and the lane
 * went off the left edge of the frame with it. Two constants that had to
 * agree, in two files, with no arithmetic between them, which is the single
 * commonest bug in this codebase's history.
 *
 * So the fan is *closed-loop* as well: the lane's own two ends are projected
 * through whatever camera is actually drawing this frame, and if either has
 * run past this margin the whole fan is scaled back until it has not. That
 * makes the lane correct on a camera nobody has built yet, which is the only
 * kind of correct worth having here. See `fitShare`.
 *
 * The margin is sized on the note, not on the paper: a head at the barline is
 * about nine per cent of a portrait frame's width, so half of one is four and
 * a half, and the rest is the room a letter needs not to sit against a bezel.
 */
const LANE_EDGE_MARGIN = 0.22;

/**
 * How much of the lane's length a screen gets, against its aspect.
 *
 * The fan and the fit check between them keep the lane inside the frame, but
 * there is a shape of screen they cannot both satisfy: a phone held upright.
 * Measured on 390x844, the road point seven metres ahead already projects
 * within a few per cent of the left edge — the frame is that narrow — so
 * there is no fan at all that puts a lane out there on the picture, and the
 * fit check answers the only way it can, by closing the fan until the lane is
 * lying along the road and edge-on. It came back 5.6 per cent of the frame
 * wide: on screen, and useless.
 *
 * The right answer, which `FIT_FLOOR`'s own comment names, is a shorter lane
 * rather than a flatter one. A short lane reaches less far ahead, so its far
 * end has not yet swung out toward the edge, and the fan survives. It also
 * suits the screen: a portrait frame has no width to spend on distance.
 */
const LENGTH_SHARE_MIN = 0.62;

/**
 * The screen width the notation's world size was chosen against, in CSS
 * pixels, and how much bigger it is allowed to be drawn on a smaller one.
 *
 * The lane lives in world metres, so a note's size on screen is its metres
 * over the frame's metres times the frame's pixels — and that last term is
 * the one nothing else in this file can see. Two screens with the same aspect
 * and the same field of view draw the same note at 44 px and at 19 px, and
 * only one of those is a legible letter. The plank this replaced had the same
 * problem and answered it with a floor on its own scale; this is that floor,
 * stated in the units the problem is actually in.
 *
 * The exponent is what keeps it from overcorrecting. A straight ratio would
 * draw the notation more than four times world size on a portrait phone,
 * which is a staff that fills the picture; at 0.6 a phone gets about a half
 * again, which is the difference between a nine-pixel letter and a fourteen.
 * The viewport is read off the renderer at draw time — see `onBeforeRender` —
 * rather than from `window`, because a canvas is not the window and this file
 * has no business knowing about one.
 */
const NOTATION_REFERENCE_PX = 1600;
const NOTATION_SCALE_MAX = 1.3;
const NOTATION_SCALE_FALLOFF = 0.6;

/**
 * The most the fit check is allowed to close the fan.
 *
 * A floor rather than nothing, because the failure it prevents is worse than
 * the one it allows: a fan scaled to near zero is a lane lying exactly along
 * the road, which from a camera standing on the road is exactly edge-on, and
 * an edge-on staff is no staff at all. If a screen is ever narrow enough that
 * this floor still puts the lane off the edge, the right answer is a shorter
 * lane, not a flatter one.
 */
const FIT_FLOOR = 0.3;

/**
 * How far the paper runs *past* the barline, toward the camera, in metres of
 * arc.
 *
 * A note that has gone by drifts to `PAST_DRIFT_M` and comes to rest carrying
 * a head half `HEAD_RX` of a cell wide — 0.147 m through `glyphWorldSize` —
 * so its outer edge reaches 0.397 m. The paper reaches 0.46 and then fades,
 * which is what keeps a gone-by note *on* the staff it belongs to. A critique
 * once measured this exact thing falling off the plank's left edge and had to
 * retract it; the margin is small enough that the next person to shorten this
 * would ship the fault for real.
 */
const TAIL_M = 0.46;

/**
 * How far a note drifts past the barline before it comes to rest.
 *
 * It has to be a small number and there has to be a number at all. The first
 * version simply kept the note travelling at its own speed once the beat had
 * gone, which is what a scrolling 2D chart does and which was catastrophic
 * when the run pointed at the camera: within half a second the glyph had
 * passed the bard, then the camera, and a missed note filled the screen. That
 * failure is the reason a lane needs this more than a face-on board did — the
 * tangent at the barline still carries a component straight at the eye — and
 * it is why the drift is a bounded exponential toward a stop rather than a
 * velocity.
 */
const PAST_DRIFT_M = 0.25;

/** How long a note stays visible after its window has closed, drifting past. */
const PAST_MS = 620;

/**
 * How long an unstruck note keeps its full ink after the hit moment, before
 * it starts to fade toward gone-by.
 *
 * Zero was the urgency inversion the wave-2 critique named: the note AT the
 * barline — the one to tap NOW — began dissolving at the exact moment it
 * mattered most, so the most urgent mark on the ribbon was the least legible
 * one. The judge's own late tail runs about two good-windows past the beat
 * (`core/performance.ts`), and a note the player is still allowed to play is
 * a note that must still look playable. `soften` takes over the moment the
 * judge actually rules it missed; this grace only covers the gap before that
 * ruling, and the fade that follows still completes inside `PAST_MS`, which
 * is when `harvest` culls.
 */
const PAST_GRACE_MS = 260;

/** How long a struck note's bloom lasts. */
const STRIKE_MS = 420;

/**
 * The approach envelope: how a travelling note's ink and size run over its
 * flight. See `glyphEnvelope`, which is the only consumer, and the test that
 * pins its shape.
 *
 * `RUNWAY_MS` is the readability contract: a note is at full readable
 * presence for at least its last 1500 ms, which is the number the portrait
 * phone critique demanded ("readable for ~1.5 s of approach"). Everything
 * before that is birth: the note fades and scales in quickly at the far end,
 * so a newcomer is a small dim thing clearly *behind* its neighbour rather
 * than a translucent full-size twin floating beside it — which is exactly
 * how the wave-2 landscape frame manufactured a ghost duplicate out of two
 * consecutive same-pitch notes. On a lane that recedes upward, depth reads
 * as height, so depth has to be disambiguated the honest way: the nearer of
 * two equal marks is bigger and bolder, always.
 *
 * The urgency ramp is the other half of the same rule: from 55 to 95 per
 * cent of the flight the ink climbs from its cruise value to full and the
 * glyph swells a seventh, so the note at the barline is unmistakably the
 * highest-contrast, largest mark on the ribbon at the moment it asks to be
 * tapped.
 */
const RUNWAY_MS = 1500;
const SPAWN_SHARE = 1 - RUNWAY_MS / TRAVEL_TIME_MS;
const URGENCY_START = 0.55;
const URGENCY_END = 0.95;
const CRUISE_INK = 0.74;
const SPAWN_SCALE = 0.6;
const ARRIVAL_SWELL = 1.14;

/** Instances reserved for glyphs. A bar of eighths at this travel time needs ten. */
const MAX_GLYPHS = 28;

/**
 * Cream. Reserved for notation everywhere in this game, and used here for
 * the letters.
 *
 * It is the lightest albedo in this file and it is still only an albedo —
 * what it actually renders at is whatever the sky is giving the lane that
 * hour. Nothing else in this file is allowed near it: `PAPER` below is
 * deliberately a duller, greyer, cooler thing than cream, because the paper
 * is furniture and DESIGN.md's rule is that furniture may not borrow the
 * notation's colour. The plank broke that rule — it was limewashed in very
 * nearly this exact value — and being the largest cream object in the frame
 * is a good part of why it read as signage.
 */
const INK = 0xfaf1de;

/**
 * How far the note head is darkened from the instrument's own colour.
 *
 * A multiplier rather than a fixed dark brown so the six instruments still
 * differ from each other in hue — a bell's head is a cold dark blue-grey and
 * a drum's a warm near-black — while all of them are dark enough that the
 * cream letter reads. See `setInstrument`.
 */
const HEAD_INK = 0.3;

/**
 * What a softened note's *head* fades toward: the paper, not a warning colour.
 *
 * A missed note is a note that went past, which is a thing that happens
 * while you are learning a tune. It goes quiet and grey-cream and drifts on.
 */
const PALE = 0xbdb3a2;

/**
 * What a softened note's *letter* fades toward, and why there has to be a
 * second colour here at all.
 *
 * A live note is a cream letter inside a dark head. Fading only the head to
 * PALE keeps the letter cream, and cream on grey-cream is nothing: measured
 * on a golden-hour busk, the letter separated from its own head by a ratio of
 * 1.27 against the live note's 5.29. STATE's claim that a miss "costs a
 * dimmed note and never information" was not true — a letter at 1.27 is
 * information lost, and this file is not allowed to lose a pitch.
 *
 * THOSE TWO NUMBERS ARE NOT WCAG RATIOS AND HAVE COST A ROUND EACH. They are
 * recorded here without units, which is the fault; the ninth visual critique
 * read them as WCAG contrast, found 3.67 where this comment says 5.29, and
 * reported the project's number one rule broken. It was not. The metric that
 * lands on 5.25 for that frame is HSP perceived brightness. In WCAG, on the
 * same pixels: live 3.67 before `LIGHT_FLOOR` was raised and 5.93 after, and
 * a fully softened note 2.03 before and about 3.5 after. The argument is
 * unchanged and still correct — the failure it describes was a *ratio near
 * one*, which is a ratio near one in every metric. Quote units next time.
 *
 * Darkening PALE instead was measured and does not reach: PALE and INK are
 * only 1.36 apart as albedos, so no amount of head-darkening that still reads
 * as *faded* can put a cream letter clear of it.
 *
 * So the letter turns over with the head. A gone-past note stops being a
 * lit-up head with a bright letter and becomes ink on paper — which is what
 * notation printed in a book looks like, and is exactly as legible.
 */
const PALE_INK = 0x544d42;

const ATLAS_CELL_PX = 128;
const ATLAS_COLS = 8;
const ATLAS_ROWS = 4;
/** Cell index of the rest, past the twenty-eight pitched cells. */
const REST_CELL = 28;

/**
 * Half-thickness of a staff line, in diatonic steps.
 *
 * Engraving puts a staff line at about an eighth of a staff space, and a
 * space is two steps, so an eighth of a space is 0.125 steps across and this
 * is half of it.
 */
const LINE_HALF_STEPS = 0.062;

/** Half-thickness of the barline, same units. A thin barline is thicker than a rule. */
const BAR_HALF_STEPS = 0.17;

/**
 * How far the ink's edge is allowed to soften, in diatonic steps.
 *
 * Down from 0.10, and that is a fix rather than a taste change. At 0.10 the
 * shoulder was **one and a half times the rule's own half-thickness**: a
 * two-pixel core inside a six-pixel ramp, which is not a printed rule, it is
 * a smudge with a dark middle. Worse, a mark whose edge is mostly ramp has no
 * fixed apparent position — any variation in the value behind it slides the
 * perceived edge — so the plank's rules picked up a hand-drawn waver from the
 * material's own grain and read as damage at high pixel ratios.
 *
 * At 0.05 the ramp is about four fifths of the core, which still resolves the
 * one thing a shoulder is for: a hard edge on a near-horizontal line at this
 * range aliases into a dotted line, and a dotted staff line is worse than a
 * soft one. Written in steps rather than in metres so it keeps its proportion
 * to the rule at every distance the lane is read from.
 */
const INK_SOFT_STEPS = 0.05;

/**
 * The paper.
 *
 * A previous shape of this file stood a strip of pale manuscript behind the
 * stave and it was built and thrown away, correctly: a translucent card
 * cannot be seen against a pale background, so at sunset it vanished over its
 * top half and showed as a patch of fog over its bottom half. The lesson
 * taken from that was "no translucency", and the lesson was wrong twice over.
 *
 * What actually failed was a translucent card *whose ink was as translucent
 * as its paper*, standing face-on in front of a sky. This paper does not have
 * that problem: `INK_ALPHA` is nearly opaque while `PAPER_ALPHA` is a veil, so
 * the thing that has to survive a bright background — the five rules, the
 * barline, and the note heads, which are opaque anyway — does survive it, and
 * the only thing the sunset can wash out is the paper *between* them, which
 * is exactly the part that should give way to the world.
 *
 * The colour is a cooler, greyer thing than the plank's limewash, and it is
 * cool for a reason that took a golden-hour phone frame to find. A veil
 * separates from what is behind it by *difference*, and at golden hour this
 * game's ground and sky are both a warm mid — so a warm paper at any opacity
 * short of complete is a warm mid over a warm mid, and disappears. Neutral
 * grey-green is the one family nothing else in these biomes occupies (see the
 * note in `palette.ts` about no biome containing both a warm and a cool
 * albedo), so the ribbon reads by hue where it cannot read by value.
 *
 * It also keeps the paper clear of cream, which `INK`'s comment explains is
 * not this surface's to borrow.
 */
const PAPER = 0xdcdcd6;

/** How much of the world reads through the paper, and through the ink. */
const PAPER_ALPHA = 0.78;
const INK_ALPHA = 0.9;

/**
 * The ink, as a multiplier on the paper rather than a colour of its own.
 *
 * Written this way because it is a stain in the paper, and a stain is not a
 * different hue from the thing it soaked into. Multiplying means the one
 * number that actually matters — how dark a rule is *relative to its paper* —
 * is stated directly instead of being the accident of two absolute colours.
 *
 * Three plain numbers rather than a hex, because these are linear reflectance
 * ratios and not a colour anyone should be tempted to read off a swatch. A
 * little cooler in blue than in red, which is what a dark stain does on warm
 * paper.
 */
const RULE_INK: readonly [number, number, number] = [0.09, 0.08, 0.085];

/**
 * How far the paper reaches past the notation it is carrying, and how much of
 * that reach is spent dissolving, in diatonic steps.
 *
 * This replaces the plank's `BOARD_MARGIN_STEPS`, and it replaces a whole
 * argument with it. The plank reserved 3.5 steps above the top line and below
 * the bottom one **at all times**, because it had a silhouette and the
 * silhouette had to be big enough for the highest and lowest notes the entire
 * songbook can ask for — Old MacDonald's A5 at step 12 and Mary's C4 at step
 * 0, each with a ledger line and half a note head and a bevel to clear. That
 * reserve was correct and it was also 45 per cent of the plank's height,
 * blank, in every frame where the tune sat inside the staff.
 *
 * A veil does not have that problem, because it has no silhouette to size. The
 * paper is full strength across whatever the tune *currently on the road* is
 * using, and fades to nothing over `PAPER_FADE_STEPS` beyond it. A tune in
 * the middle of the staff gets a narrow ribbon; Old MacDonald's top A gets
 * paper up there when it needs it, and the change between the two is invisible
 * because there is no edge to move — only the point where the paper has
 * already gone.
 *
 * `PAPER_CLEAR_STEPS` is the full-strength reach past the outermost printed
 * thing: half a note head (0.92 steps through `glyphWorldSize`) plus a little,
 * so a head and its ledger line never sit in the dissolving part where the
 * rule under them would be fading. `songNotes.test.ts` pins both against the
 * songbook's actual range.
 *
 * The fade's length is not a taste number — it is the answer to the sixth
 * staff line two critics pixel-counted and three could not see, and the
 * dispute was settled by measurement before this was changed. The ribbon's
 * geometry carries exactly five ink bands (the test below walks it), but at
 * 0.95 steps the dissolve was so short that the boundary where full-strength
 * paper meets the fade rendered as a crisp dark transition two to three
 * pixels tall — the same thickness as a rule, at both counting thresholds.
 * Worse, for a tune that reaches G5 the top boundary sits at step 12.15,
 * which is 2.1 steps above the F5 line: within a few per cent of exactly one
 * staff space. A rule-thick dark band, one rule-gap above the top rule, IS a
 * sixth line to any honest eye, and this is a music-teaching game. The
 * critics who counted five were looking at tunes or hours where the boundary
 * fell elsewhere or against a dim sky.
 *
 * At 2.1 steps, sampled through four intermediate rows, the steepest alpha
 * gradient anywhere in the margin is about 0.55 per step against the 18 per
 * step of a real rule's shoulder — a gradient, not a mark. The test pins the
 * ratio so nobody re-tightens the fade back into a line.
 */
const PAPER_CLEAR_STEPS = 1.15;
const PAPER_FADE_STEPS = 2.1;

/**
 * Where along the lane the paper starts to dissolve, as a share of the arc,
 * and how far past the barline the near end takes to go.
 *
 * The far fade is the term that answers "five converging lines are cable".
 * The ribbon never reaches its own vanishing point: it is gone before it gets
 * there. It also answers the composition brief directly — the road's
 * vanishing point cannot be occluded by something that is no longer being
 * drawn when it gets near it.
 *
 * It sat at 0.5 for a round and that was too greedy, for a reason the ninth
 * critique photographed: the notes are now readable for the whole of their
 * last 1500 ms (`glyphEnvelope`), which begins at 83 per cent of the arc —
 * and at 0.5 the paper out there was down to a fifth. A readable note on
 * paper that has already dissolved is a glyph hanging in mid-air, and a row
 * of them at the far end was read as lollipops floating over the fence. At
 * 0.68 a note entering its readable life stands on paper still above half
 * strength, while the last third of the lane still dissolves before the
 * road's vanishing point.
 *
 * The scaffold arithmetic still holds, with more room than before: the
 * letter reveal bands in `core/scaffold.ts` run 350 to 1800 ms before the
 * hit, and `songNotes.test.ts` pins full-strength paper past the second band
 * and half-strength past the third, against `SUPPORT_LEAD_MS` rather than
 * against numbers written here.
 */
const FAR_FADE_START = 0.68;
const NEAR_FADE_SHARE = 0.88;

/**
 * The value the lane's own light is not allowed to fall below, as relative
 * luminance.
 *
 * This is the one concession in the file and it is worth stating exactly what
 * it is and what bought it.
 *
 * A surface stood on edge and turned across the road is never lit by the sun.
 * Not at dusk, when the sun is behind it; not at noon either, when the sun is
 * overhead and its face is edge-on to the light. Measured against the world's
 * own shared uniforms across the day, the light arriving on that face runs
 * from about 0.14 at midday down to 0.04 at last light, and it is essentially
 * all ambient. That is the correct answer and the rest of the world lives
 * with it — the bard's own front is dark in every one of these frames.
 *
 * The notation cannot. Shot at the dusk key with nothing but the world's
 * light, the contrast between a note's letter and its own head fell to 1.16,
 * with the letter sitting *below* the frame's median value: the pitch letters
 * were gone, and DESIGN's pedagogy section is not a thing that can be traded
 * for a nicer picture. So the light on the lane is given a floor, and the
 * shortfall is made up in the colour of lamplight.
 *
 * --- 0.17 to 0.30, and the arithmetic that forced it -------------------
 *
 * The ninth visual critique returned `pitchReadable: false` — the first false
 * in nine — with a letter-to-head contrast of 3.67:1 against a 7:1 hold.
 * Three things were measured before anything was changed, and all three
 * matter to whoever reads this next.
 *
 * FIRST, 3.67 WAS RIGHT. It is the WCAG ratio, `(L+0.05)/(L+0.05)` on
 * relative luminance, and it reproduced exactly, predicted from this file's
 * own albedos through `uLight`, ACES and the sRGB encode, agreeing to the
 * byte.
 *
 * SECOND, IT WAS NOT A REGRESSION. A control build of the commit whose
 * comment recorded "5.29" measured 3.67 too. There was no good state to
 * restore, which is why this had to be fixed forward rather than reverted.
 *
 * THIRD, 7:1 IS UNREACHABLE AND THE HOLD WAS WRONG, NOT THE GAME. Sweeping
 * the light through every value from a twentieth of today's to twelve times
 * it, the letter-to-head WCAG ratio PEAKS AT 6.46, at about three times the
 * old light, and falls away either side — below, because both terms sink
 * toward the 0.05 in the denominator; above, because ACES compresses the
 * letter into the shoulder while the head is still climbing. No light level
 * reaches 7:1 with a cream letter in a head at `HEAD_INK`. 7:1 is WCAG AAA
 * for *body* text; for large text — which a bold letter about 28 px tall on
 * the desktop frame is — AAA is 4.5:1, and this file is written against a
 * 5.5:1 hold, which is most of the way to the arithmetic ceiling.
 *
 * The plank shipped this at 0.30. The lane carries it at 0.34, and that is a
 * measurement rather than a nudge. With the shell frozen, one note left in
 * flight and the frame differenced against the same frame with the glyphs
 * hidden — so the pixels measured are provably the note's — the letter-to-head
 * WCAG ratio across the day reads:
 *
 *     0.30 floor:  noon 7.01  golden 5.55  dusk 5.50  midnight 5.85  morning 6.53
 *     0.34 floor:  noon 6.58  golden 6.22  dusk 5.74  midnight 6.24  morning 6.48
 *
 * The worst hour comes off the 5.5 hold it was sitting exactly on, and the
 * spread across the day tightens from 1.5 to 0.8 — which is the property this
 * floor exists for: the pitch letter is the same to read at every hour.
 *
 * Those figures run above the 6.46 ceiling quoted above at the top end because
 * they are percentile samples over a whole anti-aliased glyph rather than the
 * two single pixels the original number was read off. Compare them with each
 * other, not with the historical figures.
 *
 * The paper does not pay for it: see `PAPER_FLOOR_SHARE`.
 */
const LIGHT_FLOOR = 0.34;

/**
 * The colour the shortfall is made up in.
 *
 * Warm, and not negotiable: a grey lift would be a second light source of no
 * colour, and the standing rule is that shadows are coloured. DESIGN puts the
 * warmth of this game in the bard and in the music, which is what a staff with
 * a song written on it is lit by when there is nothing else.
 *
 * It is always paid out through `unitLuminance`, and that is not a detail.
 * `LIGHT_FLOOR` is quoted in relative luminance and this colour's own relative
 * luminance is 0.7196, so paying the debt in it straight settled it at 72
 * pence in the pound — worst at the darkest hours, which are the hours the
 * floor exists for. Two constants that had to be in the same units and never
 * were.
 */
export const FLOOR_WARMTH = 0xffd6a2;

/**
 * How much of the floor the paper itself takes, against the notes taking all
 * of it.
 *
 * The first version gave both the same lift and the paper went pale: a
 * warm-white panel standing in a sunset, its hue no longer following the
 * sky's and its ruled lines washed halfway out, which is a good part of the
 * fault this whole file is answering. The notes are what has to stay
 * readable; the paper is what has to belong.
 *
 * Measured on the plank this replaced, and the reason the split exists at
 * all: with the notes on a 0.30 floor and the paper on a 0.14 share, the
 * paper's rendered relative luminance moved by two sRGB levels — invisible —
 * while the pitch letter's contrast against its own head went 4.08 to 5.93.
 */
const PAPER_FLOOR_SHARE = 0.14;

/**
 * How far in front of the paper the notes ride, in metres.
 *
 * Enough to clear the surface without depth-fighting it, and small enough
 * that the parallax between a note head and the line it sits on stays under a
 * pixel at the range the lane is read from. It matters more here than it did
 * on a face-on plank: the paper is turned away from the eye, so a note lifted
 * along the surface normal would slide *along* its own staff line. This is a
 * lift straight toward the camera in view space instead, which cannot.
 */
const GLYPH_FRONT_M = 0.05;

/**
 * How much of the perspective shrink the glyphs are allowed to give back.
 *
 * Down from 0.24, and the reason is the pitch axis rather than taste. The
 * staff compresses honestly with distance — a line-gap at the far end is a
 * third the pixels it is at the barline — but a glyph given back a share of
 * its shrink does not, so the ratio of head to gap grew with distance: 0.92
 * gaps at the barline, 1.1 and more at the far end (measured on the wave-2
 * phone frame). A head noticeably taller than a staff space cannot be seen
 * to sit IN a space or ON a line, which is how a whole critique wave read
 * top-of-staff notes as riding above the fence at "roughly the same height"
 * — vertical-position-equals-pitch, contradicted by the one object that
 * exists to teach it. The anchors were never wrong; the balloons were too
 * big for the fence behind them.
 *
 * At 0.10 a far head stays within four per cent of one staff space, which is
 * engraving-correct at every depth the lane spans. What the far letters lose
 * in size the approach envelope pays back in attention: a note is not asked
 * to be fully read until its last 1500 ms (`glyphEnvelope`), by which point
 * it has most of its perspective size back. A full compensation was tried
 * long ago and is wrong the other way — notes then arrive without appearing
 * to approach at all, and the lane stops reading as depth.
 */
const GLYPH_DEPTH_MAKEUP = 0.1;

const MOTION_INDEX: Record<Instrument['noteMotion'], number> = {
  drift: 0,
  spiral: 1,
  pulse: 2,
  cascade: 3,
};

/** How many points the lane's path is sampled at. */
const PATH_SAMPLES = 30;
/** How far past the barline, as a share of `LANE_LENGTH_M`, the path is sampled. */
const PATH_TAIL_T = 0.16;

/** A note the player can currently see. */
interface LiveNote {
  index: number;
  hitTimeMs: number;
  /** Diatonic step, or null for a rest (which is drawn on the middle line). */
  step: number | null;
  cell: number;
  state: 'travelling' | 'struck' | 'softened';
  /** Busk-clock time the state was entered. */
  changedMs: number;
}

export interface SongNotesOptions {
  /** Burst budget multiplier, from the app's quality tier. */
  particleDensity?: number;
}

/** Where the road is, `ahead` metres in front of the bard. */
export type RoadSampler = (ahead: number, out: Vector3) => void;

export class SongNotes {
  readonly group = new Group();

  private readonly glyphs: Mesh;
  private readonly glyphMaterial: ShaderMaterial;
  private readonly glyphGeometry: InstancedBufferGeometry;
  private readonly aPos: InstancedBufferAttribute;
  private readonly aCell: InstancedBufferAttribute;
  private readonly aScale: InstancedBufferAttribute;
  private readonly aAlpha: InstancedBufferAttribute;
  private readonly aPale: InstancedBufferAttribute;

  private readonly ribbon: Mesh;
  private readonly ribbonMaterial: ShaderMaterial;
  private ribbonGeometry = new BufferGeometry();
  /** Arc coordinates of the ribbon's columns, in metres from the barline. */
  private cols: number[] = [];
  /** Heights of the ribbon's rows, in diatonic steps from the middle line. */
  private rows: number[] = [];
  private ribbonPos = new Float32Array(0);
  /** The printed extent the current geometry was built for, in steps. */
  private printedLow = LINE_STEPS[0];
  private printedHigh = LINE_STEPS[LINE_STEPS.length - 1];

  /**
   * The lighting the world is running.
   *
   * Starts as a private daylight block and is repointed at the scene's shared
   * one the first time this draws; see `adoptWorldLight`. It is kept as a
   * field because both the ribbon and the glyphs read the same numbers on the
   * CPU.
   */
  private globals: PainterlyGlobals = createPainterlyGlobals();

  private readonly sparks: Mesh;
  private readonly sparkMaterial: ShaderMaterial;
  private readonly sparkGeometry: InstancedBufferGeometry;
  private readonly sparkOrigin: InstancedBufferAttribute;
  private readonly sparkBirth: InstancedBufferAttribute;
  private readonly sparkSeed: InstancedBufferAttribute;
  private readonly sparkSize: InstancedBufferAttribute;
  private readonly sparkLife: InstancedBufferAttribute;
  private readonly sparkKind: InstancedBufferAttribute;
  private sparkCursor = 0;
  private readonly sparksPerHit: number;

  private readonly atlas: CanvasTexture;

  private beats: readonly SongBeat[] = [];
  /** Where in `beats` the visible window starts. Only ever moves forward. */
  private cursor = 0;
  private readonly live = new Map<number, LiveNote>();

  private readonly origin = new Vector3();
  private heading = 0;
  private sampler: RoadSampler | null = null;

  // --- the sampled path --------------------------------------------------
  //
  // One polyline per frame, in world space, from a little past the barline
  // out to the far end. Everything on the lane — every ribbon vertex, every
  // note — is placed by arc length along it, so the paper and the notation
  // cannot disagree about where the lane is.
  private readonly pathX = new Float32Array(PATH_SAMPLES);
  private readonly pathZ = new Float32Array(PATH_SAMPLES);
  private readonly pathLeftX = new Float32Array(PATH_SAMPLES);
  private readonly pathLeftZ = new Float32Array(PATH_SAMPLES);
  private readonly pathArc = new Float32Array(PATH_SAMPLES);
  /**
   * How long the lane is this frame, and the arc that goes with it.
   *
   * Both move with the aspect ratio — see `lengthShare` — so they are fields
   * rather than constants, and the ribbon is rebuilt when they change enough
   * to matter. Everything on the lane is placed against `laneArcM`: the
   * paper's columns, its fades, and where a note is at a given moment of its
   * flight. Two of those three measured against different numbers is a note
   * sliding off the end of its own staff.
   */
  private laneLengthM = LANE_LENGTH_M;
  private laneArcM = arcForLength(LANE_LENGTH_M);
  /** The quantised length share the current geometry was built for. */
  private builtLengthStep = 20;
  /**
   * How much bigger the notation is drawn than its world size, to hold a
   * letter legible on a small screen. See `NOTATION_REFERENCE_PX`.
   */
  private notationScale = 1;
  private viewportPx = NOTATION_REFERENCE_PX;
  /** World height of the middle line. One value: the staff has to be level. */
  private middleY = LANE_LIFT_M;

  private readonly scratch = new Vector3();
  private readonly scratchB = new Vector3();
  private readonly sizeScratch = new Vector2();
  private readonly lightScratch = new Color();
  private readonly worldScratch = new Color();
  /**
   * The colour the light floor is paid in, scaled so a unit of it carries a
   * unit of *relative luminance*. See `FLOOR_WARMTH`.
   */
  private readonly floorColor = unitLuminance(new Color(FLOOR_WARMTH));
  private nowMs = 0;

  /**
   * The painterly lighting model's own constants, read off a painterly
   * material's shader source at construction. See `painterlyConstant`.
   */
  private readonly painterly: Record<keyof typeof PAINTERLY_CONSTANTS, number> = {
    ...PAINTERLY_CONSTANTS,
  };

  /**
   * Last camera this drew for, kept so the lane can be fanned to suit it.
   * It is one frame stale — `update` runs before the render that would
   * refresh it — which is invisible at the speeds these cameras move and much
   * cheaper than threading a camera through the whole stage.
   */
  private camera: PerspectiveCamera | null = null;
  private lightSought = false;

  constructor(options: SongNotesOptions = {}) {
    const density = clamp(options.particleDensity ?? 1, 0.25, 1);
    this.sparksPerHit = Math.max(4, Math.round(10 * density));

    this.group.name = 'song-notes';
    this.group.visible = false;
    // Every field here positions itself from world-space attributes rather
    // than from the group's matrix, so a bounding volume on the group could
    // only ever be wrong.
    this.group.frustumCulled = false;

    this.atlas = buildGlyphAtlas();

    // The lighting model is read out of a painterly shader rather than copied
    // into this file. See `painterlyConstant` for the drift that cost.
    const probe = createPainterlyMaterial(createPainterlyGlobals(), { vertexColors: true });
    for (const name of Object.keys(this.painterly) as (keyof typeof PAINTERLY_CONSTANTS)[]) {
      this.painterly[name] = painterlyConstant(probe.fragmentShader, name, PAINTERLY_CONSTANTS[name]);
    }
    probe.dispose();

    // --- the ribbon -----------------------------------------------------
    this.ribbonMaterial = new ShaderMaterial({
      uniforms: {
        // The world's own light, exposed, with neither the foreground tier
        // nor the floor applied — both of those are per-fragment and live in
        // the shader. Starts neutral so a first frame drawn before the
        // world's uniforms have been found is merely unlit rather than black.
        uWorldLight: { value: new Color(1, 1, 1) },
        uFloorColor: { value: this.floorColor.clone() },
        uFloor: { value: LIGHT_FLOOR },
        uFloorShare: { value: PAPER_FLOOR_SHARE },
        uSunHeight: { value: 1 },
        uTierDepth: { value: this.painterly.FG_TIER_DEPTH },
        uTierNear: { value: this.painterly.FG_TIER_NEAR_M },
        uTierFar: { value: this.painterly.FG_TIER_FAR_M },
      },
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      transparent: true,
      // A veil writes no depth: it has to blend with whatever is behind it,
      // and two of its own faces can overlap on a bend. It still *tests*
      // depth, so a tuft of grass between the camera and the lane passes in
      // front of it, which is most of the difference between a thing that is
      // present and a thing that is composited.
      depthWrite: false,
      side: DoubleSide,
    });
    this.ribbon = new Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 10;
    this.ribbon.name = 'song-lane';
    // The ribbon is the first thing in this group to draw, which makes its
    // hook the cheapest place to pick up the two things the apparatus needs
    // from outside and is not handed: the scene's shared lighting, and the
    // camera the lane is fanned for.
    this.ribbon.onBeforeRender = (renderer, scene, camera) => {
      if (!this.lightSought) {
        this.lightSought = true;
        this.adoptWorldLight(scene);
      }
      if ((camera as PerspectiveCamera).isPerspectiveCamera) {
        this.camera = camera as PerspectiveCamera;
      }
      // The one thing about this frame that no camera carries: how many
      // pixels wide it is. See NOTATION_REFERENCE_PX.
      const size = renderer.getSize(this.sizeScratch);
      if (size.x > 0) this.viewportPx = size.x;
    };
    this.group.add(this.ribbon);
    this.buildRibbon();

    // --- the glyphs -----------------------------------------------------
    this.glyphGeometry = new InstancedBufferGeometry();
    this.glyphGeometry.setAttribute('position', quadPositions());
    this.aPos = instanced(MAX_GLYPHS, 3);
    this.aCell = instanced(MAX_GLYPHS, 2);
    this.aScale = instanced(MAX_GLYPHS, 1);
    this.aAlpha = instanced(MAX_GLYPHS, 1);
    this.aPale = instanced(MAX_GLYPHS, 1);
    this.glyphGeometry.setAttribute('aPos', this.aPos);
    this.glyphGeometry.setAttribute('aCell', this.aCell);
    this.glyphGeometry.setAttribute('aScale', this.aScale);
    this.glyphGeometry.setAttribute('aAlpha', this.aAlpha);
    this.glyphGeometry.setAttribute('aPale', this.aPale);
    this.glyphGeometry.instanceCount = MAX_GLYPHS;
    this.glyphGeometry.boundingSphere = null;

    this.glyphMaterial = new ShaderMaterial({
      uniforms: {
        uAtlas: { value: this.atlas },
        uCellSize: { value: [1 / ATLAS_COLS, 1 / ATLAS_ROWS] },
        uColor: { value: new Color(0xc98a4b).multiplyScalar(HEAD_INK) },
        uInk: { value: new Color(INK) },
        uPale: { value: new Color(PALE) },
        uPaleInk: { value: new Color(PALE_INK) },
        uSize: { value: glyphWorldSize() },
        // Shared, term for term, with the ribbon's own material: one lighting
        // model in two shaders rather than two models.
        uWorldLight: { value: new Color(1, 1, 1) },
        uFloorColor: { value: this.floorColor.clone() },
        uFloor: { value: LIGHT_FLOOR },
        uSunHeight: { value: 1 },
        uTierDepth: { value: this.painterly.FG_TIER_DEPTH },
        uTierNear: { value: this.painterly.FG_TIER_NEAR_M },
        uTierFar: { value: this.painterly.FG_TIER_FAR_M },
        uFront: { value: GLYPH_FRONT_M },
        uNearDepth: { value: 6 },
        uMakeup: { value: GLYPH_DEPTH_MAKEUP },
      },
      vertexShader: GLYPH_VERTEX,
      fragmentShader: GLYPH_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.glyphs = new Mesh(this.glyphGeometry, this.glyphMaterial);
    this.glyphs.frustumCulled = false;
    this.glyphs.renderOrder = 11;
    this.glyphs.name = 'song-glyphs';
    this.group.add(this.glyphs);

    // --- the burst ------------------------------------------------------
    const sparkCount = MAX_GLYPHS * (this.sparksPerHit + 1);
    this.sparkGeometry = new InstancedBufferGeometry();
    this.sparkGeometry.setAttribute('position', quadPositions());
    this.sparkOrigin = instanced(sparkCount, 3);
    this.sparkBirth = instanced(sparkCount, 1);
    this.sparkSeed = instanced(sparkCount, 4);
    this.sparkSize = instanced(sparkCount, 1);
    this.sparkLife = instanced(sparkCount, 1);
    this.sparkKind = instanced(sparkCount, 1);
    // Born long ago and already dead, so the first frame draws nothing
    // rather than a full field of sparks at the origin.
    this.sparkBirth.array.fill(-1000);
    this.sparkLife.array.fill(1);
    this.sparkGeometry.setAttribute('aOrigin', this.sparkOrigin);
    this.sparkGeometry.setAttribute('aBirth', this.sparkBirth);
    this.sparkGeometry.setAttribute('aSeed', this.sparkSeed);
    this.sparkGeometry.setAttribute('aSize', this.sparkSize);
    this.sparkGeometry.setAttribute('aLife', this.sparkLife);
    this.sparkGeometry.setAttribute('aKind', this.sparkKind);
    this.sparkGeometry.instanceCount = sparkCount;
    this.sparkGeometry.boundingSphere = null;

    this.sparkMaterial = new ShaderMaterial({
      uniforms: {
        uNow: { value: 0 },
        uColor: { value: new Color(0xc98a4b) },
        uAccent: { value: new Color(0xf2c98a) },
        uMotion: { value: 2 },
      },
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.sparks = new Mesh(this.sparkGeometry, this.sparkMaterial);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 12;
    this.sparks.name = 'song-sparks';
    this.group.add(this.sparks);
  }

  /**
   * Colour and burst behaviour follow whatever is in the bard's hands.
   *
   * The *head* takes a heavily darkened version of the instrument's colour
   * rather than the colour itself. At full strength a lute's rust head sat on
   * a rust sunset with almost no contrast, and the note — the one thing in
   * the frame the player has to read — disappeared into the sky behind it. A
   * dark head carrying the cream letter holds against sky, road and grass
   * alike, which is the pairing engraved music has used for five hundred
   * years for exactly this reason.
   */
  setInstrument(instrument: Instrument): void {
    (this.glyphMaterial.uniforms.uColor.value as Color).setHex(instrument.color).multiplyScalar(
      HEAD_INK,
    );
    (this.sparkMaterial.uniforms.uColor.value as Color).setHex(instrument.color);
    (this.sparkMaterial.uniforms.uAccent.value as Color).setHex(instrument.accent);
    this.sparkMaterial.uniforms.uMotion.value = MOTION_INDEX[instrument.noteMotion] ?? 0;
  }

  /**
   * Where the bard is and which way he faces.
   *
   * `sampler` is how the lane runs along the road rather than in whatever the
   * heading happens to point at on a bend: the caller knows the road and
   * answers where it is `ahead` metres on. Without one the path is taken dead
   * straight along the heading, which is right for a bard standing anywhere
   * but a curve.
   */
  setAnchor(origin: Vector3, heading: number, sampler: RoadSampler | null = null): void {
    this.origin.copy(origin);
    this.heading = heading;
    this.sampler = sampler;
  }

  /**
   * The schedule for this busk or this stretch of walking. Windowed
   * internally; hand over the whole thing.
   *
   * The whole schedule is what lets the paper be sized to the tune rather
   * than to the songbook — see `PAPER_CLEAR_STEPS`. It is done here rather
   * than per frame from the live notes on purpose: sizing to what is in
   * flight would breathe the paper's extent in and out on every note, and a
   * staff that changes shape while a child is reading it is worse than a
   * little spare paper.
   */
  setBeats(beats: readonly SongBeat[]): void {
    this.beats = beats;
    this.cursor = 0;
    this.live.clear();

    let lowest = Infinity;
    let highest = -Infinity;
    for (const beat of beats) {
      if (beat.rest) continue;
      const step = staffStepAt(beat.semitone);
      if (step === null) continue;
      lowest = Math.min(lowest, step);
      highest = Math.max(highest, step);
    }
    const edges = paperEdges(lowest, highest);
    if (edges.low !== this.printedLow || edges.high !== this.printedHigh) {
      this.printedLow = edges.low;
      this.printedHigh = edges.high;
      this.buildRibbon();
    }
  }

  /** Called when the player lands a note. `late` still counts, and still blooms. */
  strike(index: number, judgement: Judgement): void {
    const note = this.live.get(index);
    if (!note || note.state !== 'travelling') return;
    note.state = 'struck';
    note.changedMs = this.nowMs;
    this.burst(note, judgement);
  }

  /** Called when a note's window closed unplayed. It softens; nothing flashes. */
  soften(index: number): void {
    const note = this.live.get(index);
    if (!note || note.state !== 'travelling') return;
    note.state = 'softened';
    note.changedMs = this.nowMs;
  }

  /** Show or hide the whole apparatus. Hidden costs a few draw calls, not thirty. */
  setActive(active: boolean): void {
    this.group.visible = active;
    if (!active) this.live.clear();
    // A busk can begin before any of the world's chunks have been built, so
    // the search for the shared lighting is retried at the start of each one
    // rather than made a constructor-time question with one answer.
    if (active) this.lightSought = false;
  }

  get active(): boolean {
    return this.group.visible;
  }

  /**
   * One frame. `nowMs` is the tune clock — the same clock the beats are
   * scheduled on, so a note is at the barline exactly when the judge says it
   * is. Feeding this a wall clock instead is the bug that makes a rhythm game
   * feel "off" without anyone being able to say why.
   */
  update(nowMs: number): void {
    this.nowMs = nowMs;
    if (!this.group.visible) return;

    this.samplePath();
    this.writeRibbon();
    this.harvest(nowMs);
    this.writeGlyphs(nowMs);
    this.updateLight();
    this.sparkMaterial.uniforms.uNow.value = nowMs / 1000;
  }

  dispose(): void {
    this.glyphGeometry.dispose();
    this.glyphMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.atlas.dispose();
  }

  // --- the lane ----------------------------------------------------------

  /**
   * Lay the lane out along the road for this frame.
   *
   * The path is sampled in *road* distance and then pushed sideways, which is
   * what makes it follow a bend without anything here knowing what a bend is.
   * The sideways push is the shape of the lane; see `SIDE_NEAR_M`.
   *
   * The whole staff sits at one height. That is not laziness about the
   * terrain — it is the notation rule. A ribbon that followed the road's
   * undulation would bend its own five rules, and a bent staff is a staff
   * whose pitch axis lies. So the height is taken from the *highest* road
   * point the lane spans, which is the choice that cannot put the paper
   * underground: over a crest the lane floats a little higher than it needs
   * to, which nobody can see, and over a dip it floats a lot higher than the
   * dip, which is what a floating thing does.
   */
  private samplePath(): void {
    this.fitScreen();
    const fan = this.fanShare();
    const nearSide = SIDE_NEAR_M * (NEAR_FAN_FLOOR + (1 - NEAR_FAN_FLOOR) * fan);
    const farSide =
      nearSide + (SIDE_FAR_M - SIDE_NEAR_M) * (SPREAD_FLOOR + (1 - SPREAD_FLOOR) * fan);

    // First pass: the road itself, and the highest point of it.
    let baseY = -Infinity;
    for (let i = 0; i < PATH_SAMPLES; i++) {
      const t = pathT(i);
      this.pointAt(LANE_NEAR_M + this.laneLengthM * t, this.scratch);
      this.pathX[i] = this.scratch.x;
      this.pathZ[i] = this.scratch.z;
      if (this.scratch.y > baseY) baseY = this.scratch.y;
    }
    this.middleY = baseY + LANE_LIFT_M;

    // Second pass: the road's local left at each point, from its neighbours
    // rather than from a fresh sample — one road evaluation per point instead
    // of three. It has to be its own pass: taken in the same loop as the
    // offsetting below, half the differences would be between a point already
    // pushed sideways and one not yet pushed, which bends the lane.
    for (let i = 0; i < PATH_SAMPLES; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(PATH_SAMPLES - 1, i + 1);
      const fx = this.pathX[b] - this.pathX[a];
      const fz = this.pathZ[b] - this.pathZ[a];
      const len = Math.hypot(fx, fz) || 1;
      // right = forward x up, for a right-handed world with +Y up; the lane
      // takes the other side.
      this.pathLeftX[i] = fz / len;
      this.pathLeftZ[i] = -fx / len;
    }

    // Third pass: push each point out to the lane's own side of the road, and
    // measure the arc as we go. The fan is closed against the frame's own
    // edge first — see `fitShare`.
    const fit = this.fitShare(nearSide, farSide);
    let prevX = 0;
    let prevZ = 0;
    for (let i = 0; i < PATH_SAMPLES; i++) {
      const side = (nearSide + (farSide - nearSide) * sideEase(pathT(i))) * fit;
      const x = this.pathX[i] + this.pathLeftX[i] * side;
      const z = this.pathZ[i] + this.pathLeftZ[i] * side;
      this.pathX[i] = x;
      this.pathZ[i] = z;
      this.pathArc[i] = i === 0 ? 0 : this.pathArc[i - 1] + Math.hypot(x - prevX, z - prevZ);
      prevX = x;
      prevZ = z;
    }

    // Arc is measured from the barline, which is where t = 0 — a little way
    // in from the start, because the path is carried past the barline to give
    // a gone-by note somewhere to rest.
    const zero = arcAtT(this.pathArc, 0);
    for (let i = 0; i < PATH_SAMPLES; i++) this.pathArc[i] -= zero;
  }

  /**
   * How much of the sideways fan this screen gets. See `FAN_ASPECT_LO`.
   *
   * Without a camera yet — the first frame, before `onBeforeRender` has
   * handed one over — the answer is the desktop one, which is the safe way to
   * be wrong: a lane laid out for a wider screen than it is on is merely
   * further left than it wants to be for one frame.
   */
  private fanShare(): number {
    const aspect = this.camera ? this.camera.aspect : 1.778;
    return FAN_MIN + (FAN_MAX - FAN_MIN) * smoothstep(FAN_ASPECT_LO, FAN_ASPECT_HI, aspect);
  }

  /**
   * Fit the lane to the screen it is being drawn on: how long it is, and how
   * large the notation on it is drawn.
   *
   * Both answers come from things the world does not know about — the frame's
   * aspect and its pixel count — so they are worked out once a frame here
   * rather than baked into the constants. The length change rebuilds the
   * ribbon, which is why it is quantised: the columns and the fades are laid
   * out in metres of arc, so a length that drifted continuously would rebuild
   * the geometry on every frame of a rotating phone. Twentieths are finer than
   * anyone can see and coarse enough that the rebuild happens on a resize and
   * not otherwise.
   */
  private fitScreen(): void {
    const share = LENGTH_SHARE_MIN + (1 - LENGTH_SHARE_MIN) * this.fanShare();
    const step = Math.round(clamp(share, LENGTH_SHARE_MIN, 1) * 20);
    if (step !== this.builtLengthStep) {
      this.builtLengthStep = step;
      this.laneLengthM = LANE_LENGTH_M * (step / 20);
      this.laneArcM = arcForLength(this.laneLengthM);
      this.buildRibbon();
    }
    this.notationScale = clamp(
      Math.pow(NOTATION_REFERENCE_PX / Math.max(this.viewportPx, 1), NOTATION_SCALE_FALLOFF),
      1,
      NOTATION_SCALE_MAX,
    );
    this.glyphMaterial.uniforms.uSize.value = glyphWorldSize() * this.notationScale;
  }

  /**
   * How much of the wanted fan actually fits in this frame.
   *
   * Called with the road samples still in `pathX`/`pathZ` and the left
   * vectors already worked out, which is the one moment both are available.
   * It projects the lane's two ends through the live camera and, if either
   * has crossed `LANE_EDGE_MARGIN`, hands back the fraction that puts it back
   * inside. The sideways offset is very nearly linear in the projected x at a
   * fixed depth, so one probe per end is enough to solve it — and the answer
   * is applied to the *whole* fan rather than to the offending end alone,
   * because bending one end and not the other is how a lane gets a kink in
   * it. See `LANE_EDGE_MARGIN` for why this is closed-loop at all.
   */
  private fitShare(nearSide: number, farSide: number): number {
    const camera = this.camera;
    if (!camera) return 1;
    const zeroIndex = Math.round(((PATH_SAMPLES - 1) * PATH_TAIL_T) / (1 + PATH_TAIL_T));
    // The guard has to fit the *notation*, not the lane's centreline: a note
    // at the lane's end carries half a billboarded glyph past it, and the
    // wave-2 portrait frame caught exactly that half-glyph clipped off the
    // screen edge while the centreline sat obediently inside the margin. So
    // each probe is pushed out by half a glyph at the notation's current
    // scale before it is projected.
    const pad = (glyphWorldSize() * this.notationScale) / 2;
    let share = 1;
    for (const [i, side] of [
      [zeroIndex, nearSide + pad],
      [PATH_SAMPLES - 1, farSide + pad],
    ] as const) {
      const base = this.projectedX(camera, this.pathX[i], this.pathZ[i]);
      const out = this.projectedX(
        camera,
        this.pathX[i] + this.pathLeftX[i] * side,
        this.pathZ[i] + this.pathLeftZ[i] * side,
      );
      const travel = out - base;
      // Only the leftward journey can run off the edge this is guarding.
      if (travel > -1e-4) continue;
      const allowed = -1 + LANE_EDGE_MARGIN - base;
      if (travel < allowed) share = Math.min(share, allowed / travel);
    }
    return clamp(share, FIT_FLOOR, 1);
  }

  /** A ground-plane point's x in normalised device coordinates, at lane height. */
  private projectedX(camera: PerspectiveCamera, x: number, z: number): number {
    return this.scratchB.set(x, this.middleY, z).project(camera).x;
  }

  /**
   * A world point at a given arc distance from the barline.
   *
   * Interpolated along the polyline `samplePath` laid down, and extrapolated
   * off either end along the end segment — which the tail needs, because a
   * gone-by note drifts past the last sample the path carries.
   */
  private pointOnLane(arc: number, out: Vector3): void {
    const n = PATH_SAMPLES;
    let i = 0;
    while (i < n - 2 && this.pathArc[i + 1] < arc) i++;
    const a0 = this.pathArc[i];
    const a1 = this.pathArc[i + 1];
    const t = a1 - a0 > 1e-6 ? (arc - a0) / (a1 - a0) : 0;
    out.set(
      this.pathX[i] + (this.pathX[i + 1] - this.pathX[i]) * t,
      this.middleY,
      this.pathZ[i] + (this.pathZ[i + 1] - this.pathZ[i]) * t,
    );
  }

  /**
   * Rebuild the ribbon's rows, columns, colours and opacities.
   *
   * Called once at construction and again whenever the tune's printed extent
   * changes, which is at most once per song. Positions are *not* set here —
   * they are rewritten every frame by `writeRibbon`, because the lane follows
   * a road that is moving underneath it.
   *
   * The face is an irregular grid rather than an even one, and that is the
   * whole idea. A row exists only where the drawing changes value: either
   * side of each staff line's ink, and a shoulder's width outside that. The
   * ink is then exact at every distance because it is a gradient in metres
   * rather than in texels. An evenly tessellated ribbon fine enough to
   * resolve a 7 mm rule would have needed some thousands of quads to say the
   * same thing worse.
   */
  private buildRibbon(): void {
    // The rows, columns, ink pattern and opacities are a pure function of
    // the printed extent and the arc — `ribbonLayout`, which the test walks
    // to assert the staff draws exactly five rules. This method only turns
    // that layout into buffers.
    const layout = ribbonLayout(this.printedLow, this.printedHigh, this.laneArcM);
    this.rows = layout.rows;
    this.cols = layout.cols;

    const rowCount = this.rows.length;
    const colCount = this.cols.length;
    const count = rowCount * colCount;
    this.ribbonPos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const indices: number[] = [];

    const paper = new Color(PAPER);
    for (let r = 0; r < rowCount; r++) {
      const y = this.rows[r];
      for (let c = 0; c < colCount; c++) {
        const a = this.cols[c];
        const ink = layout.ink(r, c);
        const i = r * colCount + c;
        // A slow, shallow value drift along the ribbon so the paper is not a
        // dead flat field. It multiplies the paper, and the ink multiplies
        // that in turn, so a rule keeps exactly its ratio to the paper it is
        // drawn on at every point — the stave's legibility is a ratio, and a
        // multiplier cannot change a ratio.
        const tooth = 1 - 0.09 * (0.5 + 0.5 * Math.sin(a * 1.7 + y * 0.6));
        colors[i * 3] = paper.r * tooth * (ink ? RULE_INK[0] : 1);
        colors[i * 3 + 1] = paper.g * tooth * (ink ? RULE_INK[1] : 1);
        colors[i * 3 + 2] = paper.b * tooth * (ink ? RULE_INK[2] : 1);
        alphas[i] = layout.alpha(r, c);
      }
    }
    for (let r = 0; r + 1 < rowCount; r++) {
      for (let c = 0; c + 1 < colCount; c++) {
        const a = r * colCount + c;
        indices.push(a, a + 1, a + colCount + 1, a, a + colCount + 1, a + colCount);
      }
    }

    this.ribbonGeometry.dispose();
    this.ribbonGeometry = new BufferGeometry();
    const position = new BufferAttribute(this.ribbonPos, 3);
    position.setUsage(DynamicDrawUsage);
    this.ribbonGeometry.setAttribute('position', position);
    this.ribbonGeometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    this.ribbonGeometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1));
    this.ribbonGeometry.setIndex(indices);
    this.ribbonGeometry.boundingSphere = null;
    this.ribbon.geometry = this.ribbonGeometry;
  }

  /** Push this frame's path into the ribbon's vertices. */
  private writeRibbon(): void {
    const rowCount = this.rows.length;
    const colCount = this.cols.length;
    for (let c = 0; c < colCount; c++) {
      this.pointOnLane(this.cols[c], this.scratchB);
      for (let r = 0; r < rowCount; r++) {
        const i = (r * colCount + c) * 3;
        this.ribbonPos[i] = this.scratchB.x;
        this.ribbonPos[i + 1] = this.middleY + this.rows[r] * STEP_M * this.notationScale;
        this.ribbonPos[i + 2] = this.scratchB.z;
      }
    }
    this.ribbonGeometry.getAttribute('position').needsUpdate = true;
  }

  /**
   * Work out the light the lane is standing in, and give it to both shaders.
   *
   * The world's diffuse term is evaluated here on the CPU, from the scene's
   * shared uniforms, with the constants read out of the painterly shader
   * itself. That is one lighting model computed once and handed to two
   * shaders rather than two models: a note keeps a fixed ratio to the paper
   * it is printed on, so a head that reads at noon reads at dusk without a
   * second set of colours being tuned to make it.
   *
   * What is *not* done here, deliberately: the foreground value tier and the
   * light floor. Both are per-fragment now — a lane six metres long spans
   * enough depth for the tier to differ noticeably end to end, and the floor
   * has to be worked out after the tier or the two sides of the board come
   * apart. See the shaders.
   */
  private updateLight(): void {
    const g = this.globals;
    // The lane is vertical, so its normal's Y is zero and the shader's
    // sky-versus-bounce mix lands exactly halfway. Written out rather than
    // folded to a constant because the shader's version reads this way and
    // the two have to stay checkable against each other by eye.
    const skyFacing = 0.5;
    const ambient = this.lightScratch
      .copy(g.uGroundBounce.value)
      .lerp(g.uSkyColor.value, skyFacing)
      .lerp(g.uHorizonColor.value, 0.35)
      .multiplyScalar(this.painterly.AMBIENT_STRENGTH);

    // The face's own bearing, taken at the barline — the stretch a player is
    // reading. The far end lies at a different angle to the sun, and giving
    // the whole ribbon one bearing is the same simplification the plank made
    // and is worth far less argument than it looks: this term is essentially
    // never firing, because a surface stood on edge is not lit by the sun at
    // any hour. See `LIGHT_FLOOR`.
    const fx = this.pathX[1] - this.pathX[0];
    const fz = this.pathZ[1] - this.pathZ[0];
    const flen = Math.hypot(fx, fz) || 1;
    const faceX = fz / flen;
    const faceZ = -fx / flen;

    const sun = g.uSunDirection.value;
    const ndl = faceX * sun.x + faceZ * sun.z;
    const lit = ndl * 0.5 + 0.5;
    const soft = 0.09;
    const sunAmount =
      smoothstep(0.46 - soft, 0.46 + soft, lit) * 0.42 +
      smoothstep(0.62 - soft, 0.62 + soft, lit) * 0.38 +
      smoothstep(0.86 - soft * 0.7, 0.86 + soft * 0.7, lit) * 0.2;

    const world = this.worldScratch
      .copy(g.uSunColor.value)
      .multiplyScalar(sunAmount * this.painterly.SUN_STRENGTH)
      .add(ambient)
      .multiplyScalar(g.uExposure.value);

    const sunHeight = smoothstep(-0.05, 0.32, sun.y);
    for (const material of [this.ribbonMaterial, this.glyphMaterial]) {
      (material.uniforms.uWorldLight.value as Color).copy(world);
      material.uniforms.uSunHeight.value = sunHeight;
    }

    // Where a note at the barline stands, so the glyphs' depth make-up has
    // something to be measured against. See `GLYPH_DEPTH_MAKEUP`.
    if (this.camera) {
      this.pointOnLane(0, this.scratchB);
      this.glyphMaterial.uniforms.uNearDepth.value = Math.max(
        1,
        this.camera.position.distanceTo(this.scratchB),
      );
    }
  }

  /** Bring newly-visible beats into `live`, and retire the ones that are done. */
  private harvest(nowMs: number): void {
    const spawnLead = TRAVEL_TIME_MS;
    while (this.cursor < this.beats.length) {
      const beat = this.beats[this.cursor];
      if (beat.hitTimeMs - spawnLead > nowMs) break;
      // Full means "wait", not "skip": advancing the cursor here would
      // silently drop a note the player is about to be asked to play.
      if (this.live.size >= MAX_GLYPHS) break;
      if (beat.hitTimeMs + PAST_MS > nowMs) this.live.set(beat.index, makeLive(beat));
      this.cursor++;
    }

    for (const [index, note] of this.live) {
      const done =
        note.state === 'struck'
          ? nowMs - note.changedMs > STRIKE_MS
          : nowMs > note.hitTimeMs + PAST_MS;
      if (done) this.live.delete(index);
    }
  }

  private writeGlyphs(nowMs: number): void {
    const pos = this.aPos.array as Float32Array;
    const cell = this.aCell.array as Float32Array;
    const scale = this.aScale.array as Float32Array;
    const alpha = this.aAlpha.array as Float32Array;
    const pale = this.aPale.array as Float32Array;

    let i = 0;
    for (const note of this.live.values()) {
      if (i >= MAX_GLYPHS) break;

      const progress = 1 - (note.hitTimeMs - nowMs) / TRAVEL_TIME_MS;
      const step = note.step ?? MIDDLE_STEP;
      this.pointOnLane(this.arcAt(progress), this.scratchB);

      let y = this.middleY + (step - MIDDLE_STEP) * STEP_M * this.notationScale;

      // Born small and dim, readable through the runway, boldest at the
      // barline. The envelope is a pure function so the test can pin its
      // shape — see `glyphEnvelope` for why each piece exists.
      const env = glyphEnvelope(progress);
      let a = env.alpha;
      let scaleMul = env.scale;
      let paleness = 0;

      if (note.state === 'struck') {
        const t = clamp((nowMs - note.changedMs) / STRIKE_MS, 0, 1);
        // Blooms outward and gives its light to the burst. Alpha falls
        // faster than the scale grows, so it reads as dissolving into the
        // sparks rather than as a balloon.
        scaleMul = env.scale * (1 + t * 0.85);
        a *= (1 - t) * (1 - t);
      } else if (note.state === 'softened') {
        const t = clamp((nowMs - note.changedMs) / PAST_MS, 0, 1);
        paleness = smoothstep(0, 0.35, t);
        a *= 1 - t * t;
        // Sinks a little as it goes past, the way a dropped note feels.
        y -= t * t * 0.22;
      } else if (nowMs > note.hitTimeMs + PAST_GRACE_MS) {
        // The fallback fade for a note the judge never ruled on. It starts
        // only after the grace — an unstruck note at the barline stays fully
        // lit through the moment it asks to be tapped. See PAST_GRACE_MS.
        a *= 1 - clamp((nowMs - note.hitTimeMs - PAST_GRACE_MS) / (PAST_MS - PAST_GRACE_MS), 0, 1);
      }

      const col = note.cell % ATLAS_COLS;
      const row = Math.floor(note.cell / ATLAS_COLS);

      pos[i * 3] = this.scratchB.x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = this.scratchB.z;
      cell[i * 2] = col / ATLAS_COLS;
      // Row 0 of the canvas is the *top*, and texture V runs the other way.
      cell[i * 2 + 1] = 1 - (row + 1) / ATLAS_ROWS;
      scale[i] = scaleMul;
      alpha[i] = clamp(a, 0, 1);
      pale[i] = paleness;
      i++;
    }

    // Everything past the live notes is collapsed rather than left holding
    // last frame's values, which would leave a glyph frozen on the staff.
    for (; i < MAX_GLYPHS; i++) {
      alpha[i] = 0;
      scale[i] = 0;
    }

    this.aPos.needsUpdate = true;
    this.aCell.needsUpdate = true;
    this.aScale.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aPale.needsUpdate = true;
  }

  /**
   * Where a note sits along the lane, in metres of arc from the barline.
   *
   * Against the *nominal* arc rather than the one this frame's path happens
   * to measure. The two differ by whatever the road's own bend adds, which is
   * centimetres — but the paper's columns and its fades are laid out against
   * the nominal figure once, at build time, and a note measured against a
   * second number would drift off the end of its own staff on a curve. One
   * number, used by both.
   */
  private arcAt(progress: number): number {
    if (progress <= 1) return this.laneArcM * (1 - progress);
    return -PAST_DRIFT_M * (1 - Math.exp(-(progress - 1) * 4));
  }

  private burst(note: LiveNote, judgement: Judgement): void {
    const step = note.step ?? MIDDLE_STEP;
    const progress = 1 - (note.hitTimeMs - this.nowMs) / TRAVEL_TIME_MS;
    this.pointOnLane(this.arcAt(progress), this.scratchB);
    const x = this.scratchB.x;
    const y = this.middleY + (step - MIDDLE_STEP) * STEP_M * this.notationScale;
    const z = this.scratchB.z;

    // A dead-centre note is worth a bigger bloom than one caught in the
    // tail. This is the only place in the game that grades anything, and it
    // grades it in light for half a second rather than in a number.
    const weight = judgement === 'perfect' ? 1 : judgement === 'good' ? 0.82 : 0.6;
    const now = this.nowMs / 1000;

    // Sizes are in metres and were set by looking at frames rather than by
    // taste: the first pass used sparks a third this size, and at the five
    // metres the barline sits from the camera they were two or three pixels
    // each and the hit read as nothing happening at all.
    this.emit(x, y, z, now, 0, 0.52 * weight, STRIKE_MS / 1000);
    const count = Math.round(this.sparksPerHit * weight);
    for (let n = 0; n < count; n++) {
      this.emit(x, y, z, now, 1, 0.1 + Math.random() * 0.07, 0.9 + Math.random() * 0.6);
    }
  }

  private emit(
    x: number,
    y: number,
    z: number,
    birthSec: number,
    kind: number,
    size: number,
    lifeSec: number,
  ): void {
    const i = this.sparkCursor;
    this.sparkCursor = (this.sparkCursor + 1) % this.sparkBirth.count;

    const origin = this.sparkOrigin.array as Float32Array;
    origin[i * 3] = x;
    origin[i * 3 + 1] = y;
    origin[i * 3 + 2] = z;
    (this.sparkBirth.array as Float32Array)[i] = birthSec;
    (this.sparkSize.array as Float32Array)[i] = size;
    (this.sparkLife.array as Float32Array)[i] = lifeSec;
    (this.sparkKind.array as Float32Array)[i] = kind;
    const seed = this.sparkSeed.array as Float32Array;
    seed[i * 4] = Math.random();
    seed[i * 4 + 1] = Math.random();
    seed[i * 4 + 2] = Math.random();
    seed[i * 4 + 3] = Math.random();

    this.sparkOrigin.needsUpdate = true;
    this.sparkBirth.needsUpdate = true;
    this.sparkSeed.needsUpdate = true;
    this.sparkSize.needsUpdate = true;
    this.sparkLife.needsUpdate = true;
    this.sparkKind.needsUpdate = true;
  }

  /**
   * Take the scene's own lighting, by reference.
   *
   * The lane has to be lit by the same sky as everything else — one lighting
   * model, no exceptions — and a copy would be a second one, wrong by a whole
   * time of day within a minute of walking. `createPainterlyMaterial` marks
   * every surface it builds and hands them all the *same* uniform objects, so
   * finding any one of them and rebinding to what it is already reading puts
   * the lane on the world's clock for the cost of one traversal per busk.
   *
   * It is done by search rather than by being handed the globals because the
   * alternative is a constructor parameter threaded through the stage for one
   * object's benefit, and because the search has to be repeated anyway: a
   * busk can start before any chunk of the world has been built, and the
   * uniforms only exist once one has.
   */
  private adoptWorldLight(scene: Object3D): void {
    let found: ShaderMaterial | undefined;
    scene.traverse((object) => {
      if (found) return;
      const material = (object as Mesh).material;
      const candidates = Array.isArray(material) ? material : [material];
      for (const candidate of candidates) {
        if (candidate?.userData?.painterly) found = candidate as ShaderMaterial;
      }
    });
    if (!found) return;

    // Repoint this object's own globals block at the world's uniforms, key
    // by key. Anything the world turns out not to have keeps the daylight
    // default it was built with, so a missing uniform is one term being stale
    // rather than a black ribbon.
    const shared = this.globals as unknown as Record<string, IUniform>;
    for (const key of Object.keys(shared)) {
      const uniform = found.uniforms[key];
      if (uniform) shared[key] = uniform;
    }
  }

  /** World point `ahead` metres along the road from the bard. */
  private pointAt(ahead: number, out: Vector3): void {
    if (this.sampler) {
      this.sampler(ahead, out);
      return;
    }
    out.set(
      this.origin.x + Math.sin(this.heading) * ahead,
      this.origin.y,
      this.origin.z + Math.cos(this.heading) * ahead,
    );
  }
}

// ---------------------------------------------------------------------------
// The lane's arithmetic
// ---------------------------------------------------------------------------

/**
 * The arc length of a lane `lengthM` metres long, over dead flat, dead
 * straight road: the distance a note actually travels.
 *
 * It has to be measured rather than assumed, because the lane is a curve and
 * its chord is not its length. Everything on the lane is placed against the
 * answer — the ribbon's columns, the paper's fades, and where a note is at a
 * given moment of its flight — and the one thing that must not happen is two
 * of those three being measured against different numbers, which is why the
 * lane's length is quantised before it gets here rather than after.
 */
export function arcForLength(lengthM: number): number {
  const spread = SIDE_FAR_M - SIDE_NEAR_M;
  let arc = 0;
  let px = 0;
  let pz = 0;
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = SIDE_NEAR_M + spread * sideEase(t);
    const z = lengthM * t;
    if (i > 0) arc += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return arc;
}

/** The path's parameter at sample `i`, running from the tail to the far end. */
function pathT(i: number): number {
  return -PATH_TAIL_T + (1 + PATH_TAIL_T) * (i / (PATH_SAMPLES - 1));
}

/** Cumulative arc at a given path parameter, by interpolation. */
function arcAtT(arc: Float32Array, t: number): number {
  const raw = ((t + PATH_TAIL_T) / (1 + PATH_TAIL_T)) * (PATH_SAMPLES - 1);
  const i = clamp(Math.floor(raw), 0, PATH_SAMPLES - 2);
  return arc[i] + (arc[i + 1] - arc[i]) * (raw - i);
}

/**
 * How far along its sideways journey the lane is at path parameter `t`.
 *
 * Extrapolates cleanly below zero, which the tail needs: the paper reaches
 * past the barline toward the camera, and it has to keep curving the same way
 * when it gets there rather than kinking.
 */
export function sideEase(t: number): number {
  return (1 - SIDE_EASE_LINEAR) * (1 - Math.pow(1 - t, SIDE_EASE_Q)) + SIDE_EASE_LINEAR * t;
}

/**
 * The steps the paper is drawn at full strength between, for a tune that
 * reaches from `lowest` to `highest`.
 *
 * The five printed lines are always inside it: a treble staff with four lines
 * showing is not a treble staff, and a child reading pitch off line positions
 * needs all five whether or not this tune happens to visit them. Past that,
 * the paper reaches `PAPER_CLEAR_STEPS` beyond the outermost note so its head
 * and its ledger line sit on solid paper, and then dissolves.
 *
 * Exported so `songNotes.test.ts` can walk the songbook against it. That test
 * exists because the failure mode here is invisible in nine frames out of ten:
 * a tune sitting inside the staff looks fine on a ribbon that would clip the
 * one bar of the one song that reaches a ledger line, and clipping a pitch is
 * the mechanic failing.
 */
export function paperEdges(lowest: number, highest: number): { low: number; high: number } {
  const lo = Number.isFinite(lowest) ? lowest : LINE_STEPS[0];
  const hi = Number.isFinite(highest) ? highest : LINE_STEPS[LINE_STEPS.length - 1];
  // The clearance is added *outside* the max, not inside it, so the outermost
  // staff line always has clear paper past it too. Written the other way — a
  // `min` of the line and the note-plus-clearance — a tune sitting well above
  // the bottom line would have put the bottom rule exactly on the edge of the
  // dissolve, which reads as the staff running out of paper.
  return {
    low: Math.min(LINE_STEPS[0], lo) - PAPER_CLEAR_STEPS,
    high: Math.max(LINE_STEPS[LINE_STEPS.length - 1], hi) + PAPER_CLEAR_STEPS,
  };
}

/**
 * The ribbon's face, as data: where its rows and columns sit, which cells
 * carry ink, and how present the paper is at each.
 *
 * Pure, and exported, because of a dispute that could not be settled from
 * screenshots: two critics pixel-counted SIX staff lines on the shipped
 * build, three counted five, and both sides had coordinates. The truth
 * needed the geometry itself on the witness stand. The test walks this
 * layout and asserts exactly five contiguous ink bands, centred on the five
 * printed line steps — and separately that no paper fade anywhere is steep
 * enough to counterfeit a sixth (the actual culprit; see
 * `PAPER_FADE_STEPS`). `buildRibbon` consumes the same object, so the thing
 * tested is the thing drawn.
 *
 * The face is an irregular grid rather than an even one, and that is the
 * whole idea. A row exists only where the drawing changes value: either
 * side of each staff line's ink, a shoulder's width outside that, and a few
 * stations through each dissolving margin. The ink is then exact at every
 * distance because it is a gradient in metres rather than in texels. An
 * evenly tessellated ribbon fine enough to resolve a 7 mm rule would have
 * needed some thousands of quads to say the same thing worse.
 */
export interface RibbonLayout {
  /** Row heights, in diatonic steps from the middle line, ascending. */
  rows: number[];
  /** Column positions, in metres of arc from the barline, ascending. */
  cols: number[];
  /** Whether the cell at row r, column c is ink (a rule or the barline). */
  ink(r: number, c: number): boolean;
  /** The cell's opacity: ink or paper strength, through both fades. */
  alpha(r: number, c: number): number;
}

export function ribbonLayout(
  printedLow: number,
  printedHigh: number,
  laneArcM: number,
): RibbonLayout {
  const inkHalf = LINE_HALF_STEPS;
  const soft = INK_SOFT_STEPS;

  // --- rows, in steps from the middle line ---
  const rowSet = new Set<number>();
  const bottom = printedLow - PAPER_FADE_STEPS - MIDDLE_STEP;
  const top = printedHigh + PAPER_FADE_STEPS - MIDDLE_STEP;
  rowSet.add(bottom);
  rowSet.add(top);
  rowSet.add(printedLow - MIDDLE_STEP);
  rowSet.add(printedHigh - MIDDLE_STEP);
  for (const step of LINE_STEPS) {
    const y = step - MIDDLE_STEP;
    rowSet.add(y - inkHalf - soft);
    rowSet.add(y - inkHalf);
    rowSet.add(y + inkHalf);
    rowSet.add(y + inkHalf + soft);
  }
  // Four rows through each dissolving margin, so the fade is a smooth curve
  // rather than a few long linear ramps. They carry no ink — a dark band
  // anywhere out there would be read as a sixth rule, which is the one thing
  // the margin must not grow, and which its own boundary once did when the
  // fade was short. See PAPER_FADE_STEPS.
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    rowSet.add(printedLow - MIDDLE_STEP + (bottom - (printedLow - MIDDLE_STEP)) * t);
    rowSet.add(printedHigh - MIDDLE_STEP + (top - (printedHigh - MIDDLE_STEP)) * t);
  }
  const rows = [...rowSet].sort((a, b) => a - b);

  // --- columns, in metres of arc from the barline ---
  const barHalf = BAR_HALF_STEPS * STEP_M;
  const softM = soft * STEP_M;
  const colSet = new Set<number>([-TAIL_M, -barHalf - softM, -barHalf, barHalf, barHalf + softM]);
  // The rest of the run, biased toward the near end: that is where the
  // curvature is, where the paper is at full strength, and where a player
  // is reading. The far stretch is nearly straight and nearly gone.
  const forwardCols = 26;
  const start = barHalf + softM;
  for (let i = 1; i <= forwardCols; i++) {
    const t = i / forwardCols;
    colSet.add(start + (laneArcM - start) * (0.35 * t + 0.65 * t * t));
  }
  // A couple more through the tail, for the near dissolve.
  colSet.add(-TAIL_M * 0.62);
  colSet.add(-TAIL_M * 0.3);
  const cols = [...colSet].sort((a, b) => a - b);

  // Slack on the band tests, because the rows and columns are *placed* at
  // the band edges and an exact comparison against a float that has been
  // through an addition is a coin toss.
  const eps = 1e-6;
  const staffLow = LINE_STEPS[0] - MIDDLE_STEP - inkHalf;
  const staffHigh = LINE_STEPS[LINE_STEPS.length - 1] - MIDDLE_STEP + inkHalf;

  /** How present the paper is at a height, in steps from the middle line. */
  const fadeV = (y: number): number => {
    const step = y + MIDDLE_STEP;
    if (step < printedLow) return smoothstep(printedLow - PAPER_FADE_STEPS, printedLow, step);
    if (step > printedHigh) return 1 - smoothstep(printedHigh, printedHigh + PAPER_FADE_STEPS, step);
    return 1;
  };
  /** How present the paper is at an arc distance from the barline. */
  const fadeU = (arc: number): number => {
    const near = smoothstep(-TAIL_M, -TAIL_M * (1 - NEAR_FADE_SHARE), arc);
    const far = 1 - smoothstep(laneArcM * FAR_FADE_START, laneArcM, arc);
    return near * far;
  };
  const ink = (r: number, c: number): boolean => {
    const y = rows[r];
    const onRule = LINE_STEPS.some((step) => Math.abs(y - (step - MIDDLE_STEP)) <= inkHalf + eps);
    const inStaff = y >= staffLow - eps && y <= staffHigh + eps;
    return onRule || (inStaff && Math.abs(cols[c]) <= barHalf + eps);
  };

  return {
    rows,
    cols,
    ink,
    alpha: (r, c) => (ink(r, c) ? INK_ALPHA : PAPER_ALPHA) * fadeV(rows[r]) * fadeU(cols[c]),
  };
}

/**
 * Half a note head, in diatonic steps, through the same two constants the
 * atlas is drawn and sized by. Exported for the test that checks a head and
 * its ledger line land on full-strength paper.
 */
export function headHalfSteps(): number {
  return ((HEAD_RY / ATLAS_CELL_PX) * glyphWorldSize()) / STEP_M;
}

/**
 * A travelling note's ink and size over its flight, `progress` running 0 at
 * spawn to 1 at the barline (and past it, where the envelope holds).
 *
 * Three pieces, each answering a named failure from the wave-2 critique:
 *
 * - **Birth** (`SPAWN_SHARE`): alpha and scale climb from nothing/small over
 *   the first sixth of the flight, so a note entering the lane is a small
 *   dim thing behind its neighbour — not a translucent full-size twin, which
 *   is what a landscape frame read as a ghost duplicate of a repeated pitch.
 * - **Cruise** (`CRUISE_INK`): mid-flight notes ride below full ink, so the
 *   eye is not asked to weight the far end of the lane equally with the
 *   barline. They are readable — the runway contract starts here — just not
 *   the boldest thing in view.
 * - **Urgency** (`URGENCY_START..END`, `ARRIVAL_SWELL`): ink climbs to full
 *   and the glyph swells a seventh over the last stretch, so the note AT the
 *   barline is unmistakably the most legible mark on the ribbon. The
 *   shipped inverse — imminent note dissolving, mid-flight notes at full
 *   strength — is the one reading a rhythm game cannot afford.
 *
 * Pure and exported so the test can pin the contract: full presence for the
 * whole runway, boldest exactly at the barline, monotone on the way in.
 */
export function glyphEnvelope(progress: number): { alpha: number; scale: number } {
  const p = Math.min(progress, 1);
  const born = smoothstep(0, SPAWN_SHARE, p);
  const urgency = smoothstep(URGENCY_START, URGENCY_END, p);
  return {
    alpha: born * (CRUISE_INK + (1 - CRUISE_INK) * urgency),
    scale: (SPAWN_SCALE + (1 - SPAWN_SCALE) * born) * (1 + (ARRIVAL_SWELL - 1) * urgency),
  };
}

/**
 * What sets the lane's shape, in the terms that set it.
 *
 * Exported only so a test can pin it. Every critique of the shape this
 * replaced asked for it to be *narrower*, and the reasons it could not be
 * were arithmetic about notation that no screenshot shows. The lane inherits
 * the same arithmetic and three of the same traps:
 *
 * - `gapAtWhichHeadsTouchMs` is the note-to-note spacing, *in milliseconds of
 *   song*, at which two heads print on top of each other. Shortening the lane
 *   raises it, and the songbook's own tightest pair has to stay above it.
 * - `driftedNoteReach` is how far past the barline a gone-by note's outer
 *   edge gets. The tail has to reach further, or a note ends up hanging off
 *   the paper.
 * - `nearSideM` and `farSideM` are what keep the lane off the road. Both are
 *   positive, and that is a contract other files rely on: the lane lives
 *   entirely on the road's left, so anything placed on the road's right — the
 *   bard included — is never behind it.
 * - `nearAngleDeg` and `farAngleDeg` are how far the lane is turned off the
 *   road at each end. The first is what makes an arriving note *cross* the
 *   barline instead of merely growing; the second is what stops the far end
 *   being exactly road-parallel, which from a camera standing on the road is
 *   exactly edge-on, which is how the very first version of this idea failed.
 */
export function laneSpan(): {
  arcM: number;
  tailM: number;
  driftedNoteReach: number;
  headWidth: number;
  gapAtWhichHeadsTouchMs: number;
  narrowGapAtWhichHeadsTouchMs: number;
  nearSideM: number;
  farSideM: number;
  nearAheadM: number;
  farAheadM: number;
  nearAngleDeg: number;
  farAngleDeg: number;
  paperFullShare: number;
  paperHalfShare: number;
} {
  const headWidth = ((HEAD_RX * 2) / ATLAS_CELL_PX) * glyphWorldSize();
  const arc = arcForLength(LANE_LENGTH_M);
  // The worst case a small screen can produce: the shortest lane the aspect
  // fan allows, carrying notation drawn as large as the pixel floor allows.
  // Both push the same way — heads closer together on a shorter run — so this
  // is the pair of numbers the songbook's tightest bar has to survive, and it
  // is not the pair any screenshot is ever taken at.
  const narrowArc = arcForLength(LANE_LENGTH_M * LENGTH_SHARE_MIN);
  const narrowHead = headWidth * NOTATION_SCALE_MAX;
  const spread = (SIDE_FAR_M - SIDE_NEAR_M) / LANE_LENGTH_M;
  const d = 1e-5;
  const slope = (t: number, back: boolean) =>
    spread * (back ? (sideEase(t) - sideEase(t - d)) / d : (sideEase(t + d) - sideEase(t)) / d);
  const deg = (s: number) => (Math.atan(s) * 180) / Math.PI;
  return {
    arcM: arc,
    tailM: TAIL_M,
    driftedNoteReach: PAST_DRIFT_M + headWidth / 2,
    headWidth,
    gapAtWhichHeadsTouchMs: (TRAVEL_TIME_MS * headWidth) / arc,
    narrowGapAtWhichHeadsTouchMs: (TRAVEL_TIME_MS * narrowHead) / narrowArc,
    nearSideM: SIDE_NEAR_M * NEAR_FAN_FLOOR,
    farSideM: SIDE_FAR_M * FAN_MIN,
    nearAheadM: LANE_NEAR_M,
    farAheadM: LANE_NEAR_M + LANE_LENGTH_M,
    nearAngleDeg: deg(slope(0, false)),
    farAngleDeg: deg(slope(1, true)),
    paperFullShare: FAR_FADE_START,
    paperHalfShare: (FAR_FADE_START + 1) / 2,
  };
}

// ---------------------------------------------------------------------------
// The lighting model, read rather than copied
// ---------------------------------------------------------------------------

/**
 * Read a `#define`d constant out of the painterly fragment shader.
 *
 * The lighting model this lane's notes are lit by lives in `painterly.ts` as a
 * handful of `#define`s, and this file has to evaluate the same model because
 * neither a billboarded glyph nor a per-vertex-alpha veil can run that
 * material. For most of this project's life the numbers were *copied* here,
 * with a comment explaining that copying them was deliberate — and then one of
 * them drifted and stayed drifted: `AMBIENT_STRENGTH` came down from 0.32 to
 * 0.27 over there and the copy here never followed, so the notes spent every
 * dark hour predicting a world 19 per cent brighter than the shader was
 * painting, which made `LIGHT_FLOOR` fire later and smaller at exactly the
 * hours it exists for. That is the same class of fault as every structural bug
 * this project has found: two constants that had to agree and were never
 * compared.
 *
 * So they are not copied any more; they are read, once, out of the shader
 * source. That is the single source of truth by construction — the string this
 * parses is the string the GPU is running — and it cannot drift, because there
 * is only one of it.
 *
 * The anchor is `^\s*#define`, with the multiline flag. Deliberately, and for
 * a reason this project has already paid for once: three's own preprocessor
 * only substitutes an `#include` that STARTS a line, and a probe that ignored
 * that quietly measured nothing for a round. A directive that is not at the
 * start of a line is not a directive, and this must not match one.
 *
 * The fallbacks are the shader's current values, so a parse that ever fails
 * degrades to today's behaviour rather than to black — and `songNotes.test.ts`
 * asserts the parse actually finds every one of them in the real material, so
 * a rename over there fails a test here instead of silently falling back.
 */
export function painterlyConstant(source: string, name: string, fallback: number): number {
  const match = new RegExp(`^[ \\t]*#define[ \\t]+${name}[ \\t]+([0-9.eE+-]+)`, 'm').exec(source);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The names and fallbacks of every painterly constant the lane's own lighting
 * has to agree with. Exported so the test can walk them.
 */
export const PAINTERLY_CONSTANTS = {
  AMBIENT_STRENGTH: 0.27,
  SUN_STRENGTH: 0.92,
  FG_TIER_DEPTH: 0.3,
  FG_TIER_NEAR_M: 4.0,
  FG_TIER_FAR_M: 45.0,
} as const;

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------

/**
 * A note head is a little under one staff space tall, as engraved music has
 * it. Everything else in the cell — the stem, the ledger, the letter — is
 * measured against that, so this one number sets the scale of the notation.
 */
function glyphWorldSize(): number {
  const headPx = HEAD_RY * 2;
  return (STEP_M * 2 * 0.92 * ATLAS_CELL_PX) / headPx;
}

const HEAD_RX = 28;
const HEAD_RY = 21;

/**
 * Draw every glyph the songbook can ask for, once, onto one canvas.
 *
 * Twenty-nine cells: seven letter names, each with a stem up and a stem
 * down, each of those with and without a ledger line, plus a rest. The
 * combination is small enough to enumerate and big enough that picking the
 * wrong cell would be visible, so `cellFor` below is the only place allowed
 * to do the arithmetic.
 *
 * Channels: the body goes into alpha (drawn opaque red, though only its
 * coverage is read), the letter is composited in with `lighter` so it lands
 * in green *without* punching a hole in the body underneath. One texture
 * fetch then gives the shader both masks.
 */
function buildGlyphAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * ATLAS_CELL_PX;
  canvas.height = ATLAS_ROWS * ATLAS_CELL_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context for the note atlas');

  for (let cell = 0; cell <= REST_CELL; cell++) {
    const col = cell % ATLAS_COLS;
    const row = Math.floor(cell / ATLAS_COLS);
    ctx.save();
    ctx.translate(col * ATLAS_CELL_PX + ATLAS_CELL_PX / 2, row * ATLAS_CELL_PX + ATLAS_CELL_PX / 2);
    if (cell === REST_CELL) drawRest(ctx);
    else drawNote(ctx, cell);
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  // Linear without mipmaps: the glyphs are drawn at a wide range of sizes
  // and a mip chain built from a sparse atlas bleeds neighbouring cells into
  // each other at distance, which shows up as a faint second letter.
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function drawNote(ctx: CanvasRenderingContext2D, cell: number): void {
  const letterIndex = Math.floor(cell / 4);
  const down = (cell & 2) !== 0;
  const ledger = (cell & 1) !== 0;
  const letter = letterForStep(letterIndex);

  ctx.fillStyle = 'rgb(255,0,0)';

  if (ledger) {
    // Wider than the head on both sides, as engraved. A ledger that stops
    // at the head reads as a smudge.
    ctx.fillRect(-HEAD_RX - 12, -2.75, (HEAD_RX + 12) * 2, 5.5);
  }

  // Stem first so the head covers where the two meet; a stem drawn over the
  // head leaves a visible seam at this size.
  const stemX = down ? -(HEAD_RX - 3) : HEAD_RX - 3;
  ctx.fillRect(stemX - 2.6, down ? 0 : -36, 5.2, 36);

  ctx.save();
  // Engraved note heads lean; an upright ellipse reads as a dot.
  ctx.rotate(-0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The letter, in the green channel. `lighter` keeps the body's coverage
  // underneath instead of replacing it, which is what lets the shader tint
  // the head and the letter differently from one sample.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgb(0,255,0)';
  // Filling more of the head than looks necessary in the atlas. At the size
  // a phone held sideways draws a note — about ten pixels of letter — a
  // third of the glyph's height is lost to the antialiasing at its edges,
  // and the letter is the scaffold the whole pedagogy rests on. Measured, a
  // letter at 36 rather than 33 is worth about a fifth of the contrast
  // between a letter and the head it sits in on that screen.
  ctx.font = 'bold 36px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Optical centre, not geometric: capital letters in most serif faces sit
  // slightly high of the middle baseline.
  ctx.fillText(letter, 0, 1.5);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * The rest.
 *
 * A bar hanging off a line, which is the whole/half rest of real notation
 * rather than the quarter rest the songbook's rests technically are. Drawing
 * a correct quarter rest at 128 pixels of canvas produces a smear at the
 * distance these are read from, and a legible wrong-value rest teaches
 * "nothing is played here", which is the part that matters at this stage.
 */
function drawRest(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgb(255,0,0)';
  ctx.fillRect(-22, -5, 44, 10);
}

/** Which atlas cell a written note wants. The only place this arithmetic lives. */
function cellFor(step: number): number {
  const letterIndex = ((step % 7) + 7) % 7;
  return letterIndex * 4 + (stemDown(step) ? 2 : 0) + (needsLedger(step) ? 1 : 0);
}

function makeLive(beat: SongBeat): LiveNote {
  const step = beat.rest ? null : staffStepAt(beat.semitone);
  return {
    index: beat.index,
    hitTimeMs: beat.hitTimeMs,
    step,
    // An accidental cannot reach here — the songbook is naturals-only and
    // its test says so — but `staffStepAt` is allowed to answer null and
    // guessing a spelling for one would be worse than drawing a rest.
    cell: step === null ? REST_CELL : cellFor(step),
    state: 'travelling',
    changedMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Buffers and small maths
// ---------------------------------------------------------------------------

function quadPositions(): BufferAttribute {
  return new BufferAttribute(
    new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]),
    3,
  );
}

function instanced(count: number, size: number): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(count * size), size);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

/**
 * Scale a colour so one unit of it carries one unit of relative luminance,
 * leaving its hue exactly where it was.
 *
 * Used on `FLOOR_WARMTH`, because `LIGHT_FLOOR` is quoted in relative
 * luminance and a warm colour's own luminance is well under one — paying a
 * luminance debt in un-normalised lamplight settles it at 72 cents in the
 * pound. Mutates and returns the colour it is given; every caller here hands
 * it a fresh one.
 */
export function unitLuminance(color: Color): Color {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  return luma > 1e-4 ? color.multiplyScalar(1 / luma) : color;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

/**
 * The light both surfaces share, as GLSL.
 *
 * One string included by both shaders rather than two copies, for the reason
 * `painterlyConstant` exists: the two halves of this object have to be lit by
 * the same arithmetic, and the only way to guarantee that is for there to be
 * one of it. `uWorldLight` arrives already exposed and *without* the
 * foreground tier or the floor, because both of those depend on where the
 * fragment is:
 *
 * - the tier is `painterly.ts`'s short-range darkening, full at the camera's
 *   feet and gone by forty-five metres. The lane spans five to eleven metres,
 *   which is squarely inside it and enough depth for the two ends to differ.
 * - the floor is worked out *after* the tier, which is what keeps the paper
 *   and the notes consistent rather than merely both darker. The tier makes
 *   the world's contribution smaller, the floor sees a smaller world and pays
 *   a larger lift, and the notes end up in the same place while the paper —
 *   which takes only `uFloorShare` of the lift — moves with the world.
 */
const LIGHT_CHUNK = /* glsl */ `
uniform vec3 uWorldLight;
uniform vec3 uFloorColor;
uniform float uFloor;
uniform float uSunHeight;
uniform float uTierDepth;
uniform float uTierNear;
uniform float uTierFar;

vec3 laneLight(float depth, float floorShare) {
  float nearness = 1.0 - smoothstep(uTierNear, uTierFar, depth);
  vec3 lit = uWorldLight * (1.0 - uTierDepth * nearness * uSunHeight);
  float lum = dot(lit, vec3(0.2126, 0.7152, 0.0722));
  float lift = max(0.0, uFloor - lum);
  return lit + uFloorColor * lift * floorShare;
}
`;

const RIBBON_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;

varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
varying vec3 vWorld;

void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vDepth = length(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const RIBBON_FRAGMENT = /* glsl */ `
uniform float uFloorShare;

varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
varying vec3 vWorld;

${LIGHT_CHUNK}

void main() {
  if (vAlpha < 0.004) discard;
  // The paper's own tooth: a cheap two-octave hash in world space, standing
  // in for the grain the shared material would have given this surface. It
  // multiplies the colour, so — like every other field on this object — it
  // cannot change the ratio between a rule and the paper it is drawn on.
  vec3 p = vWorld * 7.3;
  float tooth = fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float toothB = fract(sin(dot(floor(p * 2.7), vec3(39.346, 11.135, 83.155))) * 24634.6345);
  float paper = 1.0 - 0.07 * (tooth * 0.6 + toothB * 0.4);

  vec3 color = vColor * paper * laneLight(vDepth, uFloorShare);
  gl_FragColor = vec4(color, vAlpha);

  // The two chunks every other surface in this game ends with. Without them
  // this shader would be writing a linear-space colour straight into a
  // framebuffer that is read as sRGB — see the note in the glyph shader,
  // where getting this wrong once cost the pitch letters entirely.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const GLYPH_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aCell;
attribute float aScale;
attribute float aAlpha;
attribute float aPale;

uniform float uSize;
uniform float uFront;
uniform float uNearDepth;
uniform float uMakeup;

varying vec2 vQuad;
varying vec2 vCell;
varying float vAlpha;
varying float vPale;
varying float vDepth;

void main() {
  vQuad = position.xy;
  vCell = aCell;
  vAlpha = aAlpha;
  vPale = aPale;
  vDepth = length(cameraPosition - aPos);

  // Billboarded in view space from the view matrix's own basis, the same way
  // the particle fields do it: a lookAt per glyph would cost a matrix per
  // note for a result the eye cannot tell apart. It is also what keeps the
  // notation readable on a surface that is turned away from the eye — the
  // ribbon foreshortens, the letters do not.
  //
  // The note is then lifted straight toward the camera, off the paper. Doing
  // it here rather than by offsetting the world position is what makes the
  // lift the same for every note whichever way the lane is turned, and it
  // moves the glyph in depth without moving it on the glass — which matters
  // more here than it did on a face-on plank, since a lift along the paper's
  // own normal would slide a note along its staff line.
  //
  // A share of the perspective shrink is given back so a note at the far end
  // still carries a legible letter. See GLYPH_DEPTH_MAKEUP.
  float makeup = mix(1.0, max(vDepth, 0.001) / uNearDepth, uMakeup);
  vec4 view = viewMatrix * vec4(aPos, 1.0);
  view.xy += position.xy * uSize * aScale * makeup;
  view.z += uFront;
  gl_Position = projectionMatrix * view;
}
`;

const GLYPH_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uCellSize;
uniform vec3 uColor;
uniform vec3 uInk;
uniform vec3 uPale;
uniform vec3 uPaleInk;

varying vec2 vQuad;
varying vec2 vCell;
varying float vAlpha;
varying float vPale;
varying float vDepth;

${LIGHT_CHUNK}

void main() {
  if (vAlpha < 0.004) discard;
  vec2 uv = vCell + (vQuad + 0.5) * uCellSize;
  vec4 t = texture2D(uAtlas, uv);
  float cover = t.a;
  if (cover < 0.01) discard;
  vec3 body = mix(uColor, uPale, vPale);
  // The letter is cream on the instrument's colour. Cream is the notation's
  // own colour everywhere in this game, so a note reads as ink on paper
  // rather than as a coloured shape with a hole in it.
  //
  // And it turns over with the head as the note softens, so the letter is
  // always the far end of the head's own value rather than always the light
  // one. See PALE_INK for the measurement that forced this.
  vec3 letter = mix(uInk, uPaleInk, vPale);
  vec3 color = mix(body, letter, clamp(t.g, 0.0, 1.0));
  // The note takes the light falling on the paper it is printed on — the
  // whole floor, not the paper's share of it, because the pitch letter is
  // what has to stay readable and the paper is what has to belong.
  gl_FragColor = vec4(color * laneLight(vDepth, 1.0), cover * vAlpha);

  // The two chunks the rest of the world's surfaces end with, and the reason
  // a note could not be lit before they were here.
  //
  // Without them this shader was writing a linear-space colour straight into
  // a framebuffer that is read as sRGB, and getting away with it: an unlit
  // cream at 0.87 linear was displayed as 0.87 sRGB, which is a bright cream
  // and looked deliberate. It was not. The moment the colour was multiplied
  // by a real lighting term the mistake became a twentieth of the brightness
  // it should have been — measured, the letter's contrast against its own
  // note head fell from 3.8 to 1.1 and the pitch letters became unreadable,
  // which is the one regression this file is not allowed to ship.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SPARK_VERTEX = /* glsl */ `
attribute vec3 aOrigin;
attribute float aBirth;
attribute vec4 aSeed;
attribute float aSize;
attribute float aLife;
attribute float aKind;

uniform float uNow;
uniform float uMotion;

varying vec2 vQuad;
varying float vAlpha;
varying float vTint;

void main() {
  vQuad = position.xy;
  vTint = aSeed.z;

  float t = clamp((uNow - aBirth) / max(aLife, 0.001), 0.0, 1.0);
  float alive = step(0.0, uNow - aBirth) * (1.0 - step(1.0, (uNow - aBirth) / max(aLife, 0.001)));

  vec3 offset = vec3(0.0);
  float size = aSize;

  if (aKind < 0.5) {
    // The bloom: no travel, just a soft swell where the note was struck.
    size *= 0.45 + t * 1.7;
    vAlpha = alive * (1.0 - t) * (1.0 - t);
  } else {
    float ang = aSeed.x * 6.2831853;
    float rise = aSeed.y;
    if (uMotion < 0.5) {
      // drift — the flute. Outward and up, unhurried, barely a direction.
      offset = vec3(cos(ang) * 0.55, 0.5 + rise * 0.5, sin(ang) * 0.55) * t;
    } else if (uMotion < 1.5) {
      // spiral — hurdy-gurdy and bells. A wheel, and a bell's turning ring.
      float a = ang + t * 4.5;
      float r = 0.1 + t * 0.5;
      offset = vec3(cos(a) * r, t * (0.7 + rise * 0.6), sin(a) * r);
    } else if (uMotion < 2.5) {
      // pulse — lute and drum. Out hard, then nothing: a struck thing.
      float r = (1.0 - pow(1.0 - t, 3.0)) * 0.75;
      offset = vec3(cos(ang) * r, (rise - 0.4) * r * 1.2, sin(ang) * r);
    } else {
      // cascade — the harp. Thrown up a little and then let fall.
      offset = vec3(cos(ang) * 0.4 * t, 0.75 * t - 1.5 * t * t, sin(ang) * 0.4 * t);
    }
    size *= 1.0 - t * 0.35;
    vAlpha = alive * (1.0 - t) * (1.0 - t * 0.4);
  }

  vec4 view = viewMatrix * vec4(aOrigin + offset, 1.0);
  view.xy += position.xy * size;
  gl_Position = projectionMatrix * view;
}
`;

const SPARK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;

varying vec2 vQuad;
varying float vAlpha;
varying float vTint;

void main() {
  float d = length(vQuad) * 2.0;
  float core = smoothstep(1.0, 0.0, d);
  float halo = smoothstep(1.0, 0.2, d);
  float a = (core * core * 0.7 + halo * 0.3) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColor, uAccent, vTint), a);
}
`;
