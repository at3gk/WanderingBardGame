/**
 * The busking visual: a songboard standing at the roadside beside the bard,
 * and real notes riding it toward a barline.
 *
 * This is the picture the whole game is for, so it is worth saying exactly
 * what it is and what it refuses to be.
 *
 * For a long time the staff was five ribbons laid **down the road**, running
 * from the bard to a vanishing point. The argument for it was that a rhythm
 * strip stuck to the glass would make the scenery a backdrop and the scenery
 * is the point. The argument was right and the drawing was wrong, and it took
 * a while to see why, so: five near-parallel lines converging over a
 * landscape are not read as a stave. They are read as **cable**. The eye has
 * a very old rule that says parallel lines shrinking toward a vanishing point
 * are a long thing going away, and no amount of tinting or fading talks it
 * out of that — a fainter wire is still a wire.
 *
 * The answer to that was to stand the stave up face-on and short, and it
 * worked: pitch became readable, the cabling went. What it left behind was
 * the fault this file is now built around. Five glowing rules hanging in
 * clear air over a landscape are **not an object**. Nothing was in front of
 * them because nothing *could* be — they floated at chest height in the one
 * volume of the world that is empty. They took no light, so they were the
 * same value at noon and at dusk while everything around them moved. And
 * their cream bloom sat in the top tenth of the frame's values, measured, in
 * a picture whose median value is a twentieth of that. The result was a
 * diagram laid over a painting.
 *
 * So the stave is now painted on **a thing that stands there**: a limewashed
 * plank on two legs pushed into the roadside, a metre or so ahead of the
 * bard and off to the camera's left. It is yawed to face the camera so the
 * five lines stay five parallel rules and the pitch axis stays true world
 * up, and notes still enter at the right and travel left to a barline, which
 * is the direction written music runs.
 *
 * What the board buys, and none of it is decoration:
 *
 * - **It runs the same material as everything else in the world.**
 *   `createPainterlyMaterial`, bound to the scene's own shared uniforms, so
 *   the sun that bands a hillside bands the board, the sky that tints a
 *   shadow tints its shadow, and a golden-hour board is warm because the
 *   golden hour is what is lighting it. There is one lighting model in this
 *   game and the notation is no longer the exception to it.
 * - **The world can get in front of it.** It is opaque and it writes depth,
 *   so a tuft of grass between the camera and the board passes in front of
 *   the board — and, because the ink is the board's own surface rather than
 *   a transparent overlay, in front of the stave with it. That single fact
 *   is most of the difference between a thing that is present and a thing
 *   that is composited.
 * - **It sits in the frame's value range by construction.** The ink is dark
 *   wood-stain and the paper is the plank, and the plank is only as bright
 *   as the light falling on it. Nothing here is emissive and nothing is
 *   drawn in a colour of its own choosing.
 * - **It casts a shadow and has a lit edge.** The face is inset behind a
 *   chamfer, so the top bevel catches sky and the bottom bevel catches the
 *   ground's bounce even when the board is exactly face-on and its sides are
 *   edge-on. A flat plane cannot do that, and a flat plane is what a UI card
 *   is.
 *
 * The ink is *geometry*, not a texture: the front face is tessellated so
 * that each staff line and the barline are their own narrow bands of dark
 * vertex colour with a soft shoulder either side. A texture would have been
 * one more thing to fetch or generate and would have had to be filtered at
 * every distance; bands cost twenty-two rows and eleven columns and are
 * exactly crisp at any range, because the transition is a gradient in world
 * units rather than in texels.
 *
 * The notation is real and stays real. A glyph sits at its **true staff
 * step** (`core/notation.ts` owns that mapping and this file does not
 * second-guess it), wears its own stem direction by the engraving rule,
 * gets a ledger line when it needs one, and carries its letter name in the
 * head. That predates all of this by a long way and outranks anything
 * decorative here: if a choice would make a note prettier and wrong, the
 * note stays right.
 *
 * How the notes draw, and why:
 *
 * - **One glyph atlas, generated on a canvas at construction.** Seven
 *   letters times stem-up/stem-down times with/without a ledger, plus a
 *   rest. No font file is fetched — the bundle budget is 5 MB for the whole
 *   game and a webfont for twenty-nine glyphs is a poor way to spend any of
 *   it — so the letters are drawn with whatever serif the device has.
 * - **Two channels, not two textures.** The glyph body is drawn into alpha
 *   and the letter into green, so one sample gives both a coverage mask and
 *   a letter mask. The body is tinted by the instrument and the letter is
 *   cream, which is the one colour DESIGN.md reserves for notation.
 * - **Instanced quads billboarded in view space,** the same trick
 *   `fx/Particles.ts` uses. A dozen notes could be a dozen sprites, but the
 *   burst that follows a hit is a hundred and something, and having one
 *   mechanism for both means one thing to get right.
 * - **Lit by the board it is painted on.** The glyphs cannot run the
 *   painterly material — they need the atlas, and it has no map — so the
 *   board's own lighting term is evaluated once a frame on the CPU, from the
 *   same shared uniforms and with the same numbers the shader uses, and
 *   handed to them as a multiplier. That keeps a note head at a fixed ratio
 *   below the plank it sits on, which is what holds it legible from noon to
 *   dusk without anyone tuning a second set of colours. See `updateLight`,
 *   and see `LIGHT_FLOOR` for the one place the notation is allowed to stop
 *   following the world down.
 *
 * Nothing here flashes and nothing shakes. A hit blooms and scatters in the
 * instrument's colour along its own `noteMotion`; a miss softens toward
 * paper and fades. There is no red anywhere in this file, and there is not
 * going to be — missing a note in this game costs a little warmth and
 * nothing else, and the visuals are not allowed to say otherwise.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from 'three';
import { TRAVEL_TIME_MS } from '../../core/beats';
import type { Instrument } from '../../core/instruments';
import { letterForStep, needsLedger, staffStepAt, stemDown } from '../../core/notation';
import type { Judgement } from '../../core/performance';
import type { SongBeat } from '../../core/song';
import {
  bindGlobals,
  createPainterlyGlobals,
  createPainterlyMaterial,
  type PainterlyGlobals,
} from '../painterly';

/**
 * One diatonic step, in metres. Two steps make a staff space, so the printed
 * staff (E4 to F5) is eight steps — just under a metre, about the height of
 * the bard from his waist up.
 *
 * It was 0.2 when the staff ran down the road, and the extra height was
 * paying for something that no longer happens: seen almost end-on, the five
 * lines converged into two or three hairlines within a few metres, and the
 * pitch axis had to be given enough room to survive that. Face-on there is
 * nothing to survive, and 0.2 made a stave a quarter of the frame tall
 * standing over the middle distance. The floor is set by the letter rather
 * than by the lines: below about 0.1 the letter inside a note head stops
 * being legible on a phone, and the letter is the scaffold the pedagogy
 * rests on.
 */
const STEP_M = 0.12;

/** The five printed lines of the treble staff: E4 G4 B4 D5 F5. */
const LINE_STEPS = [2, 4, 6, 8, 10];

/** B4, the middle line — the step the whole stave is hung from. */
const MIDDLE_STEP = 6;

/**
 * Height of the middle line above the road, in metres.
 *
 * A little below the bard's shoulder, which is lower than it looks like it
 * should be and was found by shooting it. The busking camera stands at about
 * 1.9 m, so a stave hung at chest height or above lands on the *horizon* —
 * where the distant treeline is, where the haze is brightest, and where five
 * horizontal rules acquire a sixth from the skyline itself. Down here the
 * whole board sits against the road and the near field, which is the
 * quietest and darkest ground in these pictures.
 *
 * It came down from 1.22 when the stave became a board on stakes. The old
 * number was chosen to keep the near grass off the bottom line, and grass
 * crossing the ink was a fault when the ink was five lines hanging in the
 * air. It is not a fault now: a board has a bottom edge and a foot, the
 * grass in front of it is *meant* to cross it, and the printed area starts
 * two staff spaces above the board's own bottom edge. What the drop buys is
 * the thing hanging in the air had no way to buy — stakes short enough to
 * read as something a bard drove in rather than as a gate across the road.
 */
const MIDDLE_LINE_Y = 0.92;

/**
 * Where the stave stands, in metres along the road ahead of the bard.
 *
 * Far enough that the bard's own body never crosses it, near enough that the
 * road under it is the road he is standing on. It is placed off the road
 * sideways as well — see `BAR_LEFT_M`.
 */
const ANCHOR_AHEAD_M = 1.5;

/**
 * How far to the camera's left of that point the barline stands, in metres
 * at full size.
 *
 * This is the number that keeps the stave off the bard. He sits right of
 * centre in both busking framings, so the stave is given the left of the
 * frame — which in this game is where the road runs away and there is least
 * going on. Measured to the *barline* rather than to the middle of the stave
 * because the barline is the mark the eye goes to, and it is the mark that
 * wants a clear background.
 */
const BAR_LEFT_M = 2.1;

/**
 * The length of the run, from where a note appears to the barline, in metres
 * at full size. Travel time is fixed, so this is also the note's speed.
 *
 * At the busking camera this is a little under a third of the frame's width,
 * which leaves the right of the frame to the bard and the left of it to the
 * road. Notes a beat apart at the songbook's tempo land about two and a half
 * note heads apart on it — engraved spacing, near enough, and arrived at by
 * picking a length the frame could afford rather than by choosing it.
 */
const RUN_M = 2.2;

/** How far the staff is drawn past the barline, so it does not stop dead at it. */
const TAIL_M = 0.3;

/**
 * How far a note drifts past the barline before it comes to rest.
 *
 * It has to be a small number and there has to be a number at all. The first
 * version simply kept the note travelling at its own speed once the beat had
 * gone, which is what a scrolling 2D chart does and which was catastrophic
 * when the run pointed at the camera: within half a second the glyph had
 * passed the bard, then the camera, and a missed note filled the screen.
 * Across the frame it is only untidy rather than ruinous, but a note that
 * went by should look like it went by, not like it charged off the edge.
 */
const PAST_DRIFT_M = 0.25;

/** How long a note stays visible after its window has closed, drifting past. */
const PAST_MS = 620;

/** How long a struck note's bloom lasts. */
const STRIKE_MS = 420;

/** Instances reserved for glyphs. A bar of eighths at this travel time needs ten. */
const MAX_GLYPHS = 28;

/**
 * Cream. Reserved for notation everywhere in this game, and used here for
 * the letters.
 *
 * A shade lighter than it was, and for a reason rather than for taste: it is
 * the same limewash the plank is painted with, and a letter written on a
 * board in the board's own paint cannot be darker than the board. It is the
 * lightest albedo in this file and it is still only an albedo — what it
 * actually renders at is whatever the sky is giving the board that hour.
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
 * PALE keeps the letter cream, and cream on grey-cream is nothing: measured on
 * a golden-hour busk, the letter separated from its own head by a ratio of
 * 1.27 against the live note's 5.29. STATE's claim that a miss "costs a dimmed
 * note and never information" was not true — a letter at 1.27 is information
 * lost, and this file is not allowed to lose a pitch.
 *
 * Darkening PALE instead was measured and does not reach: PALE and INK are
 * only 1.36 apart as albedos, so no amount of head-darkening that still reads
 * as *faded* can put a cream letter clear of it. Ratio 4 against a head at
 * this value needs a letter a quarter of it, which is not a pale colour at all.
 *
 * So the letter turns over with the head. A gone-past note stops being a
 * lit-up head with a bright letter and becomes ink on paper — which is what
 * notation printed in a book looks like, and is exactly as legible. It reads
 * as quieter because its whole area is now near the plank's own value instead
 * of being a dark blot on it, and nothing about the pitch has been given up.
 * A soft brown-grey rather than a black: still a faded mark.
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
 * is half of it. Writing it as a fraction of the step rather than in metres
 * is what keeps the stave looking engraved when it is scaled down for a
 * narrow screen.
 */
const LINE_HALF_STEPS = 0.062;

/** Half-thickness of the barline, same units. A thin barline is thicker than a rule. */
const BAR_HALF_STEPS = 0.16;

/**
 * How far the ink's edge is allowed to soften, in diatonic steps.
 *
 * The ink is vertex colour on a tessellated plank, so an edge is a gradient
 * between a dark vertex and a pale one, and this is how far apart those two
 * vertices sit. Zero would give a hard aliasing edge, which is the one thing
 * a painted look cannot have. A twentieth of a staff space reads as a
 * brush-drawn rule at every range the board is seen from — and, the reason
 * it is written in steps rather than in metres, it shrinks with the board on
 * a narrow screen instead of turning a thin rule into a smudge.
 */
const INK_SOFT_STEPS = 0.10;

/**
 * The plank.
 *
 * A previous version stood a strip of pale manuscript behind the stave and
 * it was built and thrown away, correctly: a *translucent* card cannot be
 * seen against a pale background, so at sunset it vanished over its top half
 * and showed as a patch of fog over its bottom half. The lesson taken from
 * that was "no card", and the lesson was wrong. What failed was the
 * translucency, not the card. An opaque plank running the world's own
 * material has no such state — it is exactly as bright as the light falling
 * on it, whatever is behind it, because there is no behind.
 *
 * A weathered warm timber rather than a fresh one. It has to be light enough
 * that dark ink reads on it and dark enough that it is not the brightest
 * thing in a frame whose median value is a twentieth of its sky. Measured
 * against the busking postcards it sits a little above the sunlit road and
 * well below the haze on the treeline.
 */
const BOARD_WOOD = 0xe8d3a8;

/**
 * The ink, as a multiplier on the plank rather than a colour of its own.
 *
 * Written this way because it is a stain soaked into the wood, and a stain
 * is not a different hue from the thing it soaked into. Multiplying means
 * the ink follows the plank through every hour of the day and through its
 * own grain for free, and it means the one number that actually matters —
 * how dark a rule is *relative to its paper* — is stated directly instead of
 * being the accident of two absolute colours.
 *
 * Three plain numbers rather than a hex, because these are linear
 * reflectance ratios and not a colour anyone should be tempted to read off a
 * swatch. A little cooler in blue than in red, which is what a dark stain
 * does on warm timber and what keeps the rules from reading as burnt wood.
 */
const BOARD_INK: readonly [number, number, number] = [0.09, 0.08, 0.085];

/**
 * How far the printed area sits inside the plank, in diatonic steps above
 * the top line and below the bottom one.
 *
 * Engraving leaves about a staff space of margin; a board wants more,
 * because a board has an edge and a bevel and the ink needs to be clear of
 * both or it reads as a label rather than as something written on wood.
 *
 * But the margin that matters is not an aesthetic one, and 1.3 was set as
 * though it were. It has to be derived from the notation the songbook can
 * actually produce: the lowest diatonic step any tune reaches, plus half a
 * note head (1.15 steps), plus room for the ledger line that step needs.
 * Under 1.3 the low notes hung off the bottom edge of the plank, and a
 * pitch you cannot read off a line is the mechanic failing — this game
 * teaches a child to read music, and a prettier board that cannot be read
 * is a regression however well it sits in the light.
 *
 * **It is one number and not two, and that is worth stating because it looks
 * like two.** A critique measured the staff at 55 per cent of the plank's
 * height, called the other 45 per cent blank by construction, and proposed
 * splitting this into 3.5 below and 1.5 above on the grounds that the
 * derivation above is an argument for the bottom margin only. The derivation
 * is symmetric and the songbook says so: `SONGS` spans steps 0 to 12, the
 * printed lines sit at 2 to 10, and `needsLedger` is true at both ends. So
 * the notation reaches two steps past the top line exactly as it reaches two
 * steps past the bottom one, and both ends need the same three terms:
 * `2` steps to that note, `0.92` for half a note head — `HEAD_RY` of a cell,
 * through `glyphWorldSize`, in steps — and `0.42` for the bevel, because the
 * printed face is inset from the silhouette by `BOARD_BEVEL_M` and ink that
 * runs onto the chamfer is ink on an edge. That is 3.34, and 3.5 is it with
 * sixteen hundredths of a step to spare, at both ends. There is nothing here
 * to reclaim: taking the margin to its floor would shorten the plank by four
 * per cent.
 *
 * A margin of 1.5 above would put the plank's top edge at 5.5 steps over the
 * middle line while Old MacDonald's A5 sits at 6, so the head of the highest
 * note in the songbook — and the ledger line that names it — would render
 * off the top of the board entirely. That is the same failure the 1.3 margin
 * shipped at the bottom, and it is the one this file is not allowed to ship.
 * The plank is not 45 per cent blank; it is 45 per cent reserved, and which
 * of the two it looks like on any given frame depends only on where the tune
 * playing at that moment happens to sit. `songNotes.test.ts` pins it.
 */
const BOARD_MARGIN_STEPS = 3.5;

/** The same at the two ends, in metres at full size. */
const BOARD_END_M = 0.12;

/**
 * Width of the chamfer around the front face, in metres at full size.
 *
 * This is why the board reads as solid while facing the camera dead on. Its
 * sides are exactly edge-on in that pose and contribute nothing, so the
 * thickness has to be visible *from the front*: the face is inset and stands
 * proud, and the ring of bevel joining it to the silhouette is angled, so
 * the top of the ring takes sky and the bottom of it takes the ground's
 * bounce. A lit top edge over a shaded bottom edge is what an eye reads as
 * depth, and it costs four quads.
 */
const BOARD_BEVEL_M = 0.05;

/**
 * How much darker a stake is than the plank it holds up, as a vertex-colour
 * multiplier on the shared timber.
 *
 * Rough legs out of the hedge under a plank someone limewashed and wrote on.
 * It is here for a compositional reason as much as a narrative one: at the
 * plank's own value the legs were the brightest uprights in the frame and
 * caught the eye before the notes did.
 */
const STAKE_TONE = 0.6;

/** Half-thickness of a leg, in metres at full size. */
const STAKE_HALF_M = 0.045;

/**
 * How far in from each end of the plank a leg stands, as a share of the
 * plank's width.
 *
 * The first version put them at the very ends and stood them proud of the
 * top edge, and the result was a field gate: two full-height posts with five
 * horizontal rails between them is a gate in any picture book ever printed,
 * and no amount of ink on the rails talked the eye out of it. Inset legs
 * that stop at the plank's top edge — so all you see of them is two feet in
 * the grass — read as what they are, which is a board propped up.
 */
const LEG_INSET_FRACTION = 0.17;

/**
 * How far behind the plank's *face* the legs stand.
 *
 * It has to clear the bevel's outer plane and the leg's own half-thickness
 * together, with room to spare. At six centimetres the leg's front surface
 * finished a centimetre and a half behind the plank and the depth buffer
 * could not separate them at five metres: a hairline of leg came through the
 * plank from top to bottom, dead straight, and read as a crack in it.
 */
const LEG_BEHIND_M = 0.17;

/**
 * How far below the plank's top edge a leg's shoulder sits.
 *
 * Same class of problem seen from above rather than from in front: with the
 * shoulder level with the top edge, and the top edge cut a few millimetres
 * off true, the leg's end showed over the plank as a small dark tab.
 */
const LEG_DROP_M = 0.06;

/** How far a leg's foot is splayed out from under its shoulder, in radians. */
const LEG_SPLAY = 0.075;

/**
 * How far below the sampled road height a leg is pushed.
 *
 * Generously far. The road point is sampled on the road's centreline and the
 * legs stand a couple of metres off it, where the ground can be a good deal
 * lower; a foot buried an extra third of a metre costs nothing and is
 * invisible, and a foot hanging a hand's breadth above the grass costs the
 * whole effect this file exists to produce.
 */
const STAKE_SINK_M = 0.5;

/**
 * The value the songboard's own light is not allowed to fall below, as
 * relative luminance.
 *
 * This is the one concession in the file and it is worth stating exactly
 * what it is and what bought it.
 *
 * A plank standing upright and turned to face the camera is never lit by the
 * sun. Not at dusk, when the sun is behind it; not at noon either, when the
 * sun is overhead and its face is edge-on to the light. Measured against the
 * world's own shared uniforms across the day, the light arriving on that
 * face runs from about 0.14 at midday down to 0.04 at last light, and it is
 * essentially all ambient. That is the correct answer and the rest of the
 * world lives with it — the bard's own front is dark in every one of these
 * frames.
 *
 * The notation cannot. Shot at the dusk key with nothing but the world's
 * light, the contrast between a note's letter and its own head fell to 1.16,
 * with the letter sitting *below* the frame's median value: the pitch
 * letters were gone, and DESIGN's pedagogy section is not a thing that can
 * be traded for a nicer picture. So the light on the board is given a floor,
 * and the shortfall is made up in the colour of lamplight.
 *
 * What it costs and does not cost: the board still swings with the day, in
 * hue and in value, because the floor is only ever the *difference* and it
 * is zero from mid-morning to late afternoon. What it buys is a stave that
 * is as readable at last light as it is at noon, which is a thing a printed
 * page manages and a thing this game has to.
 */
const LIGHT_FLOOR = 0.17;

/**
 * The colour the shortfall is made up in.
 *
 * Warm, and not negotiable: a grey lift would be a second light source of no
 * colour, and the standing rule is that shadows are coloured. DESIGN puts
 * the warmth of this game in the bard and in the music, which is what a
 * board with a song written on it is lit by when there is nothing else.
 */
const FLOOR_WARMTH = 0xffd6a2;

/**
 * How much of the floor the plank itself takes, against the notes taking all
 * of it.
 *
 * The first version gave both the same lift and the plank went pale: a
 * warm-white panel standing in a sunset, its hue no longer following the
 * sky's and its ruled lines washed halfway out, which is a good part of the
 * fault this whole file is answering. The notes are what has to stay
 * readable; the plank is what has to belong. A third is enough to keep the
 * five rules alive against their own paper at last light and little enough
 * that the plank is still the sky's colour.
 */
const BOARD_FLOOR_SHARE = 0.3;

/**
 * How far in front of the board's face the notes ride, in metres.
 *
 * Enough to clear the face and its bevel without depth-fighting either, and
 * small enough that the parallax between a note head and the line it sits on
 * stays under a pixel at the range the board is read from.
 */
const GLYPH_FRONT_M = 0.06;

/**
 * Width of the frame, in metres, at the depth the stave stands, on the
 * screen this was sized for: the busking camera on a 16:9 desktop.
 *
 * Everything above is quoted "at full size", and this is what full size
 * means. See `cardScale`.
 *
 * Raised from 7.6, which is a halving of the board's area on screen. At 7.6
 * the board covered roughly 500x240 of a 1600x900 frame — a third of the
 * width and a quarter of the height, four fifths of it blank plank, parked
 * across the vista in the one frame that shows the core mechanic. A busker's
 * board is a small thing propped at the roadside, not signage. The taller
 * margin above makes the plank bigger in world units, so this has to come
 * back the other way or the two changes fight.
 */
const REFERENCE_FRAME_WIDTH_M = 10.8;

/**
 * Floor on the stave's size, though not on where it stands.
 *
 * A phone held upright is under a third of the reference width, and a stave
 * shrunk to match would put the letters below the size a child can read. So
 * the stave is allowed to take a larger share of a narrow frame than it takes
 * of a wide one, which is the right trade — on a small screen the notation is
 * most of what you are looking at anyway. See `frameShare` for why the
 * sideways offset is measured without this floor.
 */
const CARD_SCALE_MIN = 0.52;

const MOTION_INDEX: Record<Instrument['noteMotion'], number> = {
  drift: 0,
  spiral: 1,
  pulse: 2,
  cascade: 3,
};

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

  private readonly board: Mesh;
  private readonly stakes: readonly Mesh[];
  private readonly timberMaterial: ShaderMaterial;
  /**
   * The lighting the board's own material is running.
   *
   * Starts as a private daylight block and is repointed at the scene's
   * shared one the first time this draws; see `adoptWorldLight`. It is kept
   * as a field because the glyphs need to read the same numbers on the CPU.
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

  /** Where the barline stands. Everything on the card is measured from it. */
  private readonly anchor = new Vector3();
  /** The board's long axis: the camera's right, flattened into the ground plane. */
  private readonly right = new Vector3(1, 0, 0);
  /** The outward normal of the board's face, in the ground plane. */
  private readonly facing = new Vector3(0, 0, 1);
  /** Uniform shrink applied to the whole board on a narrow screen. */
  private scale = 1;

  private readonly scratch = new Vector3();
  private readonly lightScratch = new Color();
  private readonly floorScratch = new Color();
  private readonly floorColor = new Color(FLOOR_WARMTH);
  private nowMs = 0;

  /**
   * Last camera this drew for, kept so the card can be turned to face it.
   * It is one frame stale — `update` runs before the render that would
   * refresh it — which is invisible at the speeds a busking camera moves and
   * much cheaper than threading a camera through the whole stage.
   */
  private camera: PerspectiveCamera | null = null;
  private lightSought = false;

  constructor(options: SongNotesOptions = {}) {
    const density = clamp(options.particleDensity ?? 1, 0.25, 1);
    this.sparksPerHit = Math.max(4, Math.round(10 * density));

    this.group.name = 'song-notes';
    this.group.visible = false;
    // The instanced fields position themselves from world-space attributes
    // rather than from the group's matrix, so a bounding volume on the group
    // could only ever be wrong. The board and its stakes are ordinary meshes
    // with ordinary transforms and cull for themselves.
    this.group.frustumCulled = false;

    this.atlas = buildGlyphAtlas();

    // --- the board ------------------------------------------------------
    //
    // One material for the plank and the stakes both. They are the same
    // timber and there is no reason for them to disagree about it; the ink
    // rides in as vertex colour, which the stakes simply leave white.
    //
    // The options are the ones a piece of dressed wood wants and no others.
    // Grain is up from the default because a plank has visible figure and
    // this is the only texture it gets; the rim is down because a board is a
    // flat slab and a strong fresnel on one turns its whole face into a
    // highlight; `baseShade` is off because the board's own bottom edge is
    // half a metre clear of the ground and there is nothing there to occlude.
    this.timberMaterial = createPainterlyMaterial(this.globals, {
      color: BOARD_WOOD,
      colorVariant: 0xd2b98e,
      vertexColors: true,
      grain: 0.7,
      grainScale: 2.6,
      rim: 0.1,
      rimPower: 3,
      bandSoftness: 0.09,
      shadowDepth: 0.42,
      emissive: FLOOR_WARMTH,
    });

    this.board = new Mesh(buildBoardGeometry(), this.timberMaterial);
    this.board.castShadow = true;
    // It casts but does not receive. A plate four centimetres thick, stood
    // up nearly edge-on to a sun seven degrees above the horizon, is the
    // worst case a shadow map has: the depth comparison lands inside the
    // plate's own thickness and the lower half of the plank came back
    // shadowed by itself, as a hard horizontal band with no caster anywhere
    // near it. What the board actually owed the picture was the shadow it
    // throws on the road, and that is unaffected.
    this.board.receiveShadow = false;
    this.board.name = 'song-board';
    // The board is the first thing in this group to draw, which makes its
    // hook the cheapest place to pick up the two things the apparatus needs
    // from outside and is not handed: the scene's shared lighting, and the
    // camera the board is turned toward.
    this.board.onBeforeRender = (_renderer, scene, camera) => {
      if (!this.lightSought) {
        this.lightSought = true;
        this.adoptWorldLight(scene);
      }
      if ((camera as PerspectiveCamera).isPerspectiveCamera) {
        this.camera = camera as PerspectiveCamera;
      }
    };
    this.group.add(this.board);

    const stakeGeometry = buildStakeGeometry();
    this.stakes = [new Mesh(stakeGeometry, this.timberMaterial), new Mesh(stakeGeometry, this.timberMaterial)];
    for (const stake of this.stakes) {
      stake.castShadow = true;
      stake.receiveShadow = false;
      stake.name = 'song-stake';
      this.group.add(stake);
    }

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
        // The board's own lighting term, evaluated on the CPU each frame.
        // Starts at the neutral value so a first frame drawn before the
        // world's uniforms have been found is merely unlit rather than black.
        uLight: { value: new Color(1, 1, 1) },
        uFront: { value: GLYPH_FRONT_M },
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
   * years for exactly this reason. The instrument's own colour is not lost:
   * it is what the strike blooms in, where it has a black sky of its own to
   * sit against and nothing to be confused with.
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
   * `sampler` is how the stave stands on the road rather than in whatever the
   * heading happens to point at on a bend: the caller knows the road and
   * answers where it is `ahead` metres on. Without one the point is taken
   * dead straight along the heading, which is right for a bard standing
   * anywhere but a curve.
   */
  setAnchor(origin: Vector3, heading: number, sampler: RoadSampler | null = null): void {
    this.origin.copy(origin);
    this.heading = heading;
    this.sampler = sampler;
  }

  /** The schedule for this busk. Windowed internally; hand over the whole thing. */
  setBeats(beats: readonly SongBeat[]): void {
    this.beats = beats;
    this.cursor = 0;
    this.live.clear();
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
   * One frame. `nowMs` is the busk clock — the same clock the beats are
   * scheduled on, so a note is at the hit line exactly when the judge says
   * it is. Feeding this a wall clock instead is the bug that makes a rhythm
   * game feel "off" without anyone being able to say why.
   */
  update(nowMs: number): void {
    this.nowMs = nowMs;
    if (!this.group.visible) return;

    this.placeCard();
    this.harvest(nowMs);
    this.writeGlyphs(nowMs);
    this.sparkMaterial.uniforms.uNow.value = nowMs / 1000;
  }

  dispose(): void {
    this.glyphGeometry.dispose();
    this.glyphMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.board.geometry.dispose();
    this.stakes[0].geometry.dispose();
    this.timberMaterial.dispose();
    this.atlas.dispose();
  }

  // --- internals ---------------------------------------------------------

  /**
   * Stand the board up: where its barline is, which way it faces, how big.
   *
   * The long axis is the camera's right *flattened into the ground plane*
   * rather than the camera's true right. Full billboarding would roll the
   * board whenever the camera pitched or drifted, and a stave that is not
   * level is a stave whose pitch axis is not up — which is the one thing a
   * child is being asked to read off it. Flattened, the board is an upright
   * thing standing on level ground that happens to be turned toward you,
   * which is also what it is.
   */
  private placeCard(): void {
    this.pointAt(ANCHOR_AHEAD_M, this.anchor);
    const groundY = this.anchor.y;

    const camera = this.camera;
    this.scratch.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (camera) {
      const dx = this.anchor.x - camera.position.x;
      const dz = this.anchor.z - camera.position.z;
      if (dx * dx + dz * dz > 1e-4) this.scratch.set(dx, 0, dz);
    }
    this.scratch.normalize();
    // right = forward cross up, for a right-handed world with +Y up.
    this.right.set(-this.scratch.z, 0, this.scratch.x);
    // and the face looks back the way the view came.
    this.facing.set(-this.scratch.x, 0, -this.scratch.z);

    const narrow = camera ? this.frameShare(camera) : 1;
    this.scale = Math.max(narrow, CARD_SCALE_MIN);
    this.anchor.addScaledVector(this.right, -BAR_LEFT_M * narrow);
    this.glyphMaterial.uniforms.uSize.value = glyphWorldSize() * this.scale;

    // The board's own frame: local +X along the run, +Y world up, +Z out of
    // its face toward the camera. The yaw is the only rotation there is —
    // see the note above about rolling the pitch axis.
    const yaw = Math.atan2(-this.scratch.x, -this.scratch.z);
    this.board.position.set(this.anchor.x, groundY + MIDDLE_LINE_Y, this.anchor.z);
    this.board.rotation.set(0, yaw, 0);
    this.board.scale.setScalar(this.scale);

    // The stakes stand at the plank's two ends and are *not* scaled
    // vertically with it: a stake is as long as the ground is far away, and
    // that distance does not shrink when the frame gets narrow. Only their
    // girth and their spacing follow the board.
    const shoulder = MIDDLE_LINE_Y + (boardTopLocal() - LEG_DROP_M) * this.scale;
    const height = shoulder + STAKE_SINK_M;
    const span = (boardRightLocal() - boardLeftLocal()) * this.scale;
    const inset = span * LEG_INSET_FRACTION;
    const feet = [boardLeftLocal() * this.scale + inset, boardRightLocal() * this.scale - inset];
    for (let i = 0; i < this.stakes.length; i++) {
      const stake = this.stakes[i];
      const u = feet[i];
      stake.position.set(
        this.anchor.x + this.right.x * u - this.facing.x * LEG_BEHIND_M * this.scale,
        groundY + shoulder,
        this.anchor.z + this.right.z * u - this.facing.z * LEG_BEHIND_M * this.scale,
      );
      // Z first, then the yaw, which is what the default Euler order does and
      // what puts the splay in the plank's own plane rather than across it.
      stake.rotation.set(0, yaw, i === 0 ? LEG_SPLAY : -LEG_SPLAY);
      stake.scale.set(this.scale, height, this.scale);
    }

    this.updateLight();
  }

  /**
   * Work out the light the board is standing in, and give it to the notes.
   *
   * The glyphs cannot run the painterly material — they are billboarded
   * quads reading a glyph atlas, and that material has no map — so the
   * board's diffuse term is evaluated here on the CPU instead, from the same
   * shared uniforms, with the same constants, for the board's own normal.
   * That is one lighting model computed in two places rather than two
   * models: the note keeps a fixed ratio to the plank it is painted on, so a
   * head that reads at noon reads at dusk without a second set of colours
   * being tuned to make it.
   *
   * The banding is kept, quantised edges and all, because the alternative is
   * a note that slides smoothly through a value the board behind it jumps
   * across, and the two coming apart on a hillside terminator is exactly the
   * kind of disagreement the single-material rule exists to prevent.
   */
  private updateLight(): void {
    const g = this.globals;
    // The board is vertical, so its normal's Y is zero and the shader's
    // sky-versus-bounce mix lands exactly halfway. Written out rather than
    // folded to a constant because the shader's version reads this way and
    // the two have to stay checkable against each other by eye.
    const skyFacing = 0.5;
    const ambient = this.lightScratch
      .copy(g.uGroundBounce.value)
      .lerp(g.uSkyColor.value, skyFacing)
      .lerp(g.uHorizonColor.value, 0.35)
      .multiplyScalar(PAINTERLY_AMBIENT);

    const sun = g.uSunDirection.value;
    const ndl = this.facing.x * sun.x + this.facing.z * sun.z;
    const lit = ndl * 0.5 + 0.5;
    const soft = 0.09;
    const sunAmount =
      smoothstep(0.46 - soft, 0.46 + soft, lit) * 0.42 +
      smoothstep(0.62 - soft, 0.62 + soft, lit) * 0.38 +
      smoothstep(0.86 - soft * 0.7, 0.86 + soft * 0.7, lit) * 0.2;

    const light = this.glyphMaterial.uniforms.uLight.value as Color;
    light.copy(g.uSunColor.value).multiplyScalar(sunAmount * PAINTERLY_SUN).add(ambient);
    light.multiplyScalar(g.uExposure.value);

    // The floor, and how the two halves of the board are given it.
    //
    // The plank takes it through the painterly material's own emissive term,
    // which is added after the albedo and before the exposure — hence the
    // division, so the lift lands at the same strength on both sides. The
    // notes take it as extra *light* rather than as extra colour, which is
    // the difference that matters: added to a note's colour it would lift a
    // near-black head as much as a cream letter and flatten the one contrast
    // the whole mechanic rests on. Folded into the light it leaves the ratio
    // between them exactly where it was and only moves both up together.
    const worldLum = 0.2126 * light.r + 0.7152 * light.g + 0.0722 * light.b;
    const lift = Math.max(0, LIGHT_FLOOR - worldLum);
    this.timberMaterial.uniforms.uEmissiveStrength.value =
      (lift * BOARD_FLOOR_SHARE) / Math.max(g.uExposure.value, 0.01);
    light.add(this.floorScratch.copy(this.floorColor).multiplyScalar(lift));

    this.glyphMaterial.uniforms.uFront.value = GLYPH_FRONT_M * this.scale;
  }

  /**
   * How wide this screen is compared with the one the stave was sized on.
   *
   * The stave is written in world metres because it stands in the world, but
   * what has to stay constant is the share of the *frame* it takes: the run
   * has to fit beside the bard on a phone held sideways and on a desktop
   * alike, and a note head has to stay big enough to read the letter out of.
   * So the frame's width is measured in metres at the depth the stave stands
   * at, and compared with the screen it was tuned on. Wider frames get no
   * more than one — past the reference width the stave is already as large as
   * the picture wants it.
   *
   * The answer is used twice and clamped only once, which is the whole point
   * of returning it raw. The stave's *size* is held above `CARD_SCALE_MIN`,
   * because a stave shrunk to a phone's true share of the reference width has
   * letters no child can read. Its *offset from the road* is not, because
   * that offset is a position in a frame rather than a size in it: floored,
   * a portrait phone put the barline ninety-six per cent of the way to the
   * left edge — the stave was correctly sized and standing off the side of
   * the picture.
   */
  private frameShare(camera: PerspectiveCamera): number {
    const depth = camera.position.distanceTo(this.anchor);
    const halfV = (camera.fov * Math.PI) / 360;
    const frameWidth = 2 * depth * Math.tan(halfV) * camera.aspect;
    return clamp(frameWidth / REFERENCE_FRAME_WIDTH_M, 0.1, 1);
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
      const u = runAt(progress) * this.scale;

      let y = this.stepY(step);

      let a = 1;
      let scaleMul = 1;
      let paleness = 0;

      // Fade in over the first stretch of the run so a note arrives rather
      // than appears.
      a *= smoothstep(0, 0.14, progress);

      if (note.state === 'struck') {
        const t = clamp((nowMs - note.changedMs) / STRIKE_MS, 0, 1);
        // Blooms outward and gives its light to the burst. Alpha falls
        // faster than the scale grows, so it reads as dissolving into the
        // sparks rather than as a balloon.
        scaleMul = 1 + t * 0.85;
        a *= (1 - t) * (1 - t);
      } else if (note.state === 'softened') {
        const t = clamp((nowMs - note.changedMs) / PAST_MS, 0, 1);
        paleness = smoothstep(0, 0.35, t);
        a *= 1 - t * t;
        // Sinks a little as it goes past, the way a dropped note feels.
        y -= t * t * 0.22 * this.scale;
      } else if (nowMs > note.hitTimeMs) {
        a *= 1 - clamp((nowMs - note.hitTimeMs) / PAST_MS, 0, 1);
      }

      const col = note.cell % ATLAS_COLS;
      const row = Math.floor(note.cell / ATLAS_COLS);

      pos[i * 3] = this.anchor.x + this.right.x * u;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = this.anchor.z + this.right.z * u;
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

  private burst(note: LiveNote, judgement: Judgement): void {
    const step = note.step ?? MIDDLE_STEP;
    const progress = 1 - (note.hitTimeMs - this.nowMs) / TRAVEL_TIME_MS;
    const u = runAt(progress) * this.scale;
    const x = this.anchor.x + this.right.x * u;
    const y = this.stepY(step);
    const z = this.anchor.z + this.right.z * u;

    // A dead-centre note is worth a bigger bloom than one caught in the
    // tail. This is the only place in the game that grades anything, and it
    // grades it in light for half a second rather than in a number.
    const weight = judgement === 'perfect' ? 1 : judgement === 'good' ? 0.82 : 0.6;
    const now = this.nowMs / 1000;

    // Sizes are in metres and were set by looking at frames rather than by
    // taste: the first pass used sparks a third this size, and at the four
    // or five metres the busking camera sits from the barline they were two
    // or three pixels each and the hit read as nothing happening at all.
    const size = this.scale;
    this.emit(x, y, z, now, 0, 0.52 * weight * size, STRIKE_MS / 1000);
    const count = Math.round(this.sparksPerHit * weight);
    for (let n = 0; n < count; n++) {
      this.emit(x, y, z, now, 1, (0.1 + Math.random() * 0.07) * size, 0.9 + Math.random() * 0.6);
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

  /** World height of a diatonic step on the card. */
  private stepY(step: number): number {
    return this.anchor.y + MIDDLE_LINE_Y + (step - MIDDLE_STEP) * STEP_M * this.scale;
  }

  /**
   * Take the scene's own lighting, by reference.
   *
   * The board has to be lit by the same sky as everything else — one
   * lighting model, no exceptions — and a copy would be a second one, wrong
   * by a whole time of day within a minute of walking.
   * `createPainterlyMaterial` marks every surface it builds and hands them
   * all the *same* uniform objects, so finding any one of them and rebinding
   * to what it is already reading puts the board on the world's clock for
   * the cost of one traversal per busk.
   *
   * It is done by search rather than by being handed the globals because the
   * alternative is a constructor parameter threaded through the stage for
   * one object's benefit, and because the search has to be repeated anyway:
   * a busk can start before any chunk of the world has been built, and the
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
    // by key, and rebind the material to it. Anything the world turns out
    // not to have keeps the daylight default it was built with, so a missing
    // uniform is one term being stale rather than a black board.
    const shared = this.globals as unknown as Record<string, IUniform>;
    for (const key of Object.keys(shared)) {
      const uniform = found.uniforms[key];
      if (uniform) shared[key] = uniform;
    }
    bindGlobals(this.timberMaterial, this.globals);
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
// The board
// ---------------------------------------------------------------------------

/**
 * The two strengths the painterly fragment shader mixes its light from.
 *
 * Copied here rather than exported from `painterly.ts` on purpose. They are
 * `#define`s over there, described in that file as a property of the
 * lighting model rather than of a moment in the day, and turning them into
 * shared runtime values so one billboard could read them would make it
 * possible for a future edit to change the world's exposure from here. If
 * they ever move, the notes go a shade wrong against a board that did not —
 * which is visible in the first frame anyone looks at.
 */
const PAINTERLY_AMBIENT = 0.32;
const PAINTERLY_SUN = 0.92;

/**
 * The highest and lowest diatonic step whose note head the plank has room to
 * print, with the ledger line it needs and clear of the bevel.
 *
 * Exported only so a test can pin it against the songbook's actual range. The
 * game never asks: the board is built once and the notation is what it is.
 * The test exists because the plank looks 45 per cent empty from any frame
 * where the tune sits inside the staff, and the obvious response to that —
 * take the margin off the top — silently clips the top note in the book. It
 * is the sort of change that type-checks, renders, looks better in nine
 * frames out of ten, and loses a pitch in the tenth.
 */
export function printableSteps(): { lowest: number; highest: number } {
  // Half a note head, in steps, through the same two constants the atlas is
  // drawn and sized by, plus the chamfer the printed face is inset behind.
  const headHalfSteps = ((HEAD_RY / ATLAS_CELL_PX) * glyphWorldSize()) / STEP_M;
  const bevelSteps = BOARD_BEVEL_M / STEP_M;
  const clearance = headHalfSteps + bevelSteps;
  return {
    highest: LINE_STEPS[LINE_STEPS.length - 1] + BOARD_MARGIN_STEPS - clearance,
    lowest: LINE_STEPS[0] - BOARD_MARGIN_STEPS + clearance,
  };
}

/** The plank's own edges, in metres from the barline and the middle line. */
function boardLeftLocal(): number {
  return -(TAIL_M + BOARD_END_M);
}

function boardRightLocal(): number {
  return RUN_M + BOARD_END_M;
}

function boardTopLocal(): number {
  return (LINE_STEPS[LINE_STEPS.length - 1] + BOARD_MARGIN_STEPS - MIDDLE_STEP) * STEP_M;
}

function boardBottomLocal(): number {
  return (LINE_STEPS[0] - BOARD_MARGIN_STEPS - MIDDLE_STEP) * STEP_M;
}

/**
 * The plank, with the stave printed into its vertices.
 *
 * Local space: X runs along the stave with the barline at zero, Y is height
 * above the middle line, Z is out of the face. `placeCard` gives the mesh
 * its position, its yaw and its uniform scale, so nothing here has to know
 * where the road is.
 *
 * The face is an irregular grid rather than an even one, and that is the
 * whole idea. A row exists only where the drawing changes value: either side
 * of each staff line's ink, and a shoulder's width outside that. So five
 * lines and a barline cost twenty-two rows and eleven columns, and the ink
 * is exact at every distance because it is a gradient in metres rather than
 * in texels. An evenly tessellated plank fine enough to resolve a 7 mm rule
 * would have needed some thousands of quads to say the same thing worse.
 *
 * The shading needs no tessellation of its own: the painterly material's
 * banding, grain and fog are all evaluated per fragment from world position,
 * so a quad a metre across shades exactly as well as sixty small ones.
 */
function buildBoardGeometry(): BufferGeometry {
  const bevel = BOARD_BEVEL_M;
  const x0 = boardLeftLocal();
  const x1 = boardRightLocal();
  const y0 = boardBottomLocal();
  const y1 = boardTopLocal();
  // The printed face sits inside the silhouette by the bevel and stands
  // proud of it by the same, so the ring between them is at forty-five
  // degrees and its top catches sky.
  const fx0 = x0 + bevel;
  const fx1 = x1 - bevel;
  const fy0 = y0 + bevel;
  const fy1 = y1 - bevel;

  const inkHalf = STEP_M * LINE_HALF_STEPS;
  const barHalf = STEP_M * BAR_HALF_STEPS;
  const soft = STEP_M * INK_SOFT_STEPS;
  // Where the ruled area stops, short of the face's own edge. Engraving
  // leaves a margin at the ends of a stave and so does a signwriter.
  const ruleEnd = 0.06;
  const ruleX0 = fx0 + ruleEnd;
  const ruleX1 = fx1 - ruleEnd;

  const rows = [fy0];
  for (const step of LINE_STEPS) {
    const y = (step - MIDDLE_STEP) * STEP_M;
    rows.push(y - inkHalf - soft, y - inkHalf, y + inkHalf, y + inkHalf + soft);
  }
  rows.push(fy1);
  rows.sort((a, b) => a - b);

  const cols = [
    fx0,
    ruleX0,
    ruleX0 + soft,
    -barHalf - soft,
    -barHalf,
    barHalf,
    barHalf + soft,
    ruleX1 - soft,
    ruleX1,
    fx1,
  ];
  cols.sort((a, b) => a - b);

  // The barline stops at the outer staff lines, as engraved. Running it past
  // them was tried when it was a transparent overlay, as a way of making it
  // easier to find, and it only made it less like notation.
  const barTop = (LINE_STEPS[LINE_STEPS.length - 1] - MIDDLE_STEP) * STEP_M + inkHalf;
  const barBottom = (LINE_STEPS[0] - MIDDLE_STEP) * STEP_M - inkHalf;

  const inked = new Color().setRGB(BOARD_INK[0], BOARD_INK[1], BOARD_INK[2]);
  const bare = new Color(1, 1, 1);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: Color) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(c.r, c.g, c.b);
    return positions.length / 3 - 1;
  };

  // --- the printed face ---
  const onRule = (x: number, y: number): boolean => {
    if (x >= ruleX0 && x <= ruleX1) {
      for (const step of LINE_STEPS) {
        const ly = (step - MIDDLE_STEP) * STEP_M;
        if (y >= ly - inkHalf && y <= ly + inkHalf) return true;
      }
    }
    return Math.abs(x) <= barHalf && y >= barBottom && y <= barTop;
  };

  const first = positions.length / 3;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      push(cols[c], rows[r], 0, 0, 0, 1, onRule(cols[c], rows[r]) ? inked : bare);
    }
  }
  for (let r = 0; r + 1 < rows.length; r++) {
    for (let c = 0; c + 1 < cols.length; c++) {
      const a = first + r * cols.length + c;
      const b = a + 1;
      const d = a + cols.length;
      const e = d + 1;
      indices.push(a, b, e, a, e, d);
    }
  }

  // --- the bevel ---
  //
  // Four mitred trapezoids from the silhouette, set back at z = -bevel, to
  // the face at z = 0. Their normals are the halfway vectors, which is what
  // makes the top edge take sky and the bottom edge take the ground's bounce
  // even when the plank is exactly face-on.
  //
  // The four outer corners are nudged off true by a centimetre or so each,
  // in different directions. A plank sawn by hand is not a rectangle, and a
  // rectangle is what a UI card is; the ruled face inside is left perfectly
  // square, so the pitch axis and the reading order are untouched and only
  // the silhouette knows about it.
  const k = Math.SQRT1_2;
  const tl: [number, number] = [x0 + 0.011, y1 - 0.015];
  const tr: [number, number] = [x1 - 0.017, y1 + 0.009];
  const br: [number, number] = [x1 + 0.008, y0 + 0.013];
  const bl: [number, number] = [x0 - 0.013, y0 - 0.007];
  const ring = (
    outerA: [number, number], outerB: [number, number],
    ix0: number, iy0: number, ix1: number, iy1: number,
    nx: number, ny: number,
  ): void => {
    const a = push(outerA[0], outerA[1], -bevel, nx * k, ny * k, k, bare);
    const b = push(outerB[0], outerB[1], -bevel, nx * k, ny * k, k, bare);
    const c = push(ix1, iy1, 0, nx * k, ny * k, k, bare);
    const d = push(ix0, iy0, 0, nx * k, ny * k, k, bare);
    // Wound outer, inner, inner, outer. The obvious order — round the
    // trapezoid the way it is written — comes out clockwise seen from the
    // front and the whole ring is back-face culled, which looks exactly like
    // having no bevel at all and cost a round to notice.
    indices.push(a, d, c, a, c, b);
  };
  ring(tl, tr, fx0, fy1, fx1, fy1, 0, 1);
  ring(br, bl, fx1, fy0, fx0, fy0, 0, -1);
  ring(bl, tl, fx0, fy0, fx0, fy1, -1, 0);
  ring(tr, br, fx1, fy1, fx1, fy0, 1, 0);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * A leg: a squared-off post, tapered a little toward the foot.
 *
 * Unit length hanging *down* from the origin, which sits at the shoulder
 * where the leg meets the plank. That way `placeCard` can pin it to the
 * plank and let the far end reach whatever the ground turns out to be, and
 * the splay can be a rotation about a point that does not move.
 *
 * Four sides and no cap at either end: the top is behind the plank and the
 * bottom is half a metre underground.
 */
function buildStakeGeometry(): BufferGeometry {
  const b = STAKE_HALF_M;
  const t = STAKE_HALF_M * 0.72;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    // The face's normal is the outward direction of its own edge, taken at
    // the midpoint. Flat-shaded on purpose: a post with four hard edges
    // reads as split timber, and a smoothed one reads as a dowel.
    const nx = (ax + bx) / 2;
    const nz = (az + bz) / 2;
    const n = Math.hypot(nx, nz) || 1;
    const base = positions.length / 3;
    const put = (x: number, y: number, z: number) => {
      positions.push(x, y, z);
      normals.push(nx / n, 0, nz / n);
      colors.push(STAKE_TONE, STAKE_TONE, STAKE_TONE);
    };
    put(ax * b, 0, az * b);
    put(bx * b, 0, bz * b);
    put(bx * t, -1, bz * t);
    put(ax * t, -1, az * t);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  return geometry;
}

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
 * Where a note sits along the card, in metres right of the barline, at a
 * given travel progress.
 */
function runAt(progress: number): number {
  if (progress <= 1) return RUN_M * (1 - progress);
  return -PAST_DRIFT_M * (1 - Math.exp(-(progress - 1) * 4));
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

const GLYPH_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aCell;
attribute float aScale;
attribute float aAlpha;
attribute float aPale;

uniform float uSize;
uniform float uFront;

varying vec2 vQuad;
varying vec2 vCell;
varying float vAlpha;
varying float vPale;

void main() {
  vQuad = position.xy;
  vCell = aCell;
  vAlpha = aAlpha;
  vPale = aPale;

  // Billboarded in view space from the view matrix's own basis, the same
  // way the particle fields do it: a lookAt per glyph would cost a matrix
  // per note for a result the eye cannot tell apart.
  //
  // The note is then lifted straight toward the camera, off the board's
  // face. Doing it here rather than by offsetting the world position is what
  // makes the lift the same for every note whichever way the board is
  // turned, and it moves the glyph in depth without moving it on the glass.
  vec4 view = viewMatrix * vec4(aPos, 1.0);
  view.xy += position.xy * uSize * aScale;
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
uniform vec3 uLight;

varying vec2 vQuad;
varying vec2 vCell;
varying float vAlpha;
varying float vPale;

void main() {
  if (vAlpha < 0.004) discard;
  vec2 uv = vCell + (vQuad + 0.5) * uCellSize;
  vec4 t = texture2D(uAtlas, uv);
  float cover = t.a;
  if (cover < 0.01) discard;
  vec3 body = mix(uColor, uPale, vPale);
  // The letter is cream on the instrument's colour. Cream is the notation's
  // own colour everywhere in this game, so a note reads as ink on wood
  // rather than as a coloured shape with a hole in it.
  //
  // And it turns over with the head as the note softens, so the letter is
  // always the far end of the head's own value rather than always the light
  // one. See PALE_INK for the measurement that forced this.
  vec3 letter = mix(uInk, uPaleInk, vPale);
  vec3 color = mix(body, letter, clamp(t.g, 0.0, 1.0));
  // And the whole thing takes the light falling on the board it is painted
  // on, so a note is a mark on a plank rather than a lamp hanging in front
  // of one. See updateLight on the class.
  gl_FragColor = vec4(color * uLight, cover * vAlpha);

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
  //
  // With the tone map and the encode in place the note is in the same
  // pipeline as the plank behind it, and the two can be reasoned about in
  // the same numbers.
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
