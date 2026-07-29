/**
 * The busking visual: a stave standing in the world beside the bard, and
 * real notes riding it toward a barline.
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
 * out of that — a fainter wire is still a wire. The busking frame was a
 * cosy sunset with telegraph poles strung across it, and it is the frame this
 * game is most likely to be seen in.
 *
 * So the staff is now **face-on and short**: a flat card standing upright in
 * the world, a metre or so ahead of the bard and off to the camera's left,
 * yawed to face the camera so the five lines are five parallel rules and the
 * pitch axis is true world up. Notes enter at the right-hand end and travel
 * left to a barline, which is the direction written music runs and the
 * direction every scrolling display of it has run since. It is still *in* the
 * world — it stands at a place, it is depth-tested against the hill and the
 * trees, it takes the sky's own colour — but it no longer pretends to be
 * three-dimensional in its long axis, because that pretence is what turned
 * notation into scenery.
 *
 * Two things fell out of the change rather than being designed in, and both
 * are worth keeping. Perspective no longer eats the time axis, so two notes a
 * beat apart are two notes a beat apart on screen and the screen-space
 * spacing search that used to hold them apart could go. And it is small
 * enough now to be placed rather than merely aimed: it sits low over the road
 * to the bard's left, clear of the treeline, clear of the skyline and clear
 * of his silhouette, which is the shape the whole frame is built on.
 *
 * The notation is real and stays real. A glyph sits at its **true staff
 * step** (`core/notation.ts` owns that mapping and this file does not
 * second-guess it), wears its own stem direction by the engraving rule,
 * gets a ledger line when it needs one, and carries its letter name in the
 * head. That predates the 3D work by a long way and outranks anything
 * decorative here: if a choice would make a note prettier and wrong, the
 * note stays right.
 *
 * How it draws, and why:
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
  Vector3,
  type IUniform,
} from 'three';
import { TRAVEL_TIME_MS } from '../../core/beats';
import type { Instrument } from '../../core/instruments';
import { letterForStep, needsLedger, staffStepAt, stemDown } from '../../core/notation';
import type { Judgement } from '../../core/performance';
import type { SongBeat } from '../../core/song';

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
 * A little above the bard's shoulder, which is lower than it looks like it
 * should be and was found by shooting it. The busking camera stands at about
 * 1.9 m, so a stave hung at chest height or above lands on the *horizon* —
 * where the distant treeline is, where the haze is brightest, and where five
 * horizontal rules acquire a sixth from the skyline itself. Dropped to here
 * the whole stave sits against the road and the near field, which is the
 * quietest and darkest ground in these pictures and the only place the ink
 * and its bloom both read. Lower again and the near grass starts eating the
 * bottom line.
 */
const MIDDLE_LINE_Y = 1.22;

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

/** Cream. Reserved for notation everywhere in this game, and used here for the letters. */
const INK = 0xf0e2c6;

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
 * What a softened note fades toward: the paper, not a warning colour.
 *
 * A missed note is a note that went past, which is a thing that happens
 * while you are learning a tune. It goes quiet and grey-cream and drifts on.
 */
const PALE = 0xbdb3a2;

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
 * The paper, and where it is.
 *
 * The obvious thing was a strip of manuscript standing behind the stave, and
 * it was built and thrown away. A pale translucent card cannot be seen
 * against a pale background, and the two busking postcards are a sunset: the
 * band of land the stave hangs in front of is the brightest, haziest part of
 * the picture, so the strip vanished over its top half and showed as a patch
 * of fog over its bottom half. Making it strong enough to read there would
 * have made it a panel bolted over the landscape at every other hour of the
 * day.
 *
 * So the paper hugs the ink instead. Each line and the barline carry a soft
 * cream bloom a few times their own thickness, which is what ink does on real
 * paper and what makes a printed page legible on a photograph of anything.
 * Where the background is dark the bloom reads and the stave sits on a scrap
 * of light; where the background is bright the bloom disappears and the dark
 * rule carries it on its own. There is no state in which both fail.
 *
 * The values turn over with it. Cream on cream is invisible, so the stave is
 * now drawn as engraving has always drawn it: dark ink, light paper. The
 * cream that DESIGN.md reserves for notation is still doing that job — it is
 * the bloom and the letter in the note head, which is where a printed page
 * puts it.
 */
const PAPER = 0xf3e6c8;

/**
 * How much of the sky's own colour the bloom takes.
 *
 * All of it would be a hole in the picture at dusk; none of it would be white
 * light coming from nowhere, which is the one lighting model this game does
 * not have.
 */
const PAPER_HORIZON_TINT = 0.3;

/** Alpha of the bloom where it touches the ink. */
const PAPER_OPACITY = 0.55;

/** How far the bloom spreads either side of a staff line, in diatonic steps. */
const LINE_GLOW_HALF_STEPS = 0.30;

/** The same for the barline, across its width. */
const BAR_GLOW_HALF_STEPS = 0.45;

/** The ink. Dark warm brown rather than black; nothing in this game is black. */
const STAFF_INK = 0x503c27;

/** Peak alpha of the five lines, at the barline. Falls away with the run. */
const LINE_OPACITY = 0.70;

/**
 * Alpha of the barline, which never fades.
 *
 * Level with the lines rather than above them. It was 0.8 and it read as a
 * post standing in the road — the one hard black vertical in a picture that
 * has no other. A barline is found by being the only upright among five
 * horizontals, not by being darker than any of them.
 */
const BAR_OPACITY = 0.70;

/**
 * What each of the stave's six-vertex pieces is, written into `aKind`.
 *
 * This used to be a sentinel value smuggled into the fade attribute, on the
 * argument that a second buffer was too much for one bit. The two kinds want
 * different colours, different fade curves and the bloom measured across
 * different axes, so it is no longer one bit and the honest attribute is
 * cheaper to read than the arithmetic that avoided it.
 */
const KIND_LINE = 0;
const KIND_BARLINE = 1;

/**
 * Width of the frame, in metres, at the depth the stave stands, on the
 * screen this was sized for: the busking camera on a 16:9 desktop.
 *
 * Everything above is quoted "at full size", and this is what full size
 * means. See `cardScale`.
 */
const REFERENCE_FRAME_WIDTH_M = 7.6;

/**
 * Floor on that scale.
 *
 * A phone held upright is under a third of the reference width, and a stave
 * shrunk to match would put the letters below the size a child can read. So
 * the stave is allowed to take a larger share of a narrow frame than it takes
 * of a wide one, which is the right trade — on a small screen the notation is
 * most of what you are looking at anyway.
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

  private readonly staff: Mesh;
  private readonly staffMaterial: ShaderMaterial;
  private readonly staffPosition: BufferAttribute;
  private readonly staffFade: BufferAttribute;
  private readonly staffKind: BufferAttribute;
  private readonly staffSpan: BufferAttribute;

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
  /** The card's long axis: the camera's right, flattened into the ground plane. */
  private readonly right = new Vector3(1, 0, 0);
  /** Uniform shrink applied to the whole card on a narrow screen. */
  private scale = 1;

  private readonly scratch = new Vector3();
  private nowMs = 0;

  /**
   * Last camera this drew for, kept so the card can be turned to face it.
   * It is one frame stale — `update` runs before the render that would
   * refresh it — which is invisible at the speeds a busking camera moves and
   * much cheaper than threading a camera through the whole stage.
   */
  private camera: PerspectiveCamera | null = null;
  private horizonSought = false;

  constructor(options: SongNotesOptions = {}) {
    const density = clamp(options.particleDensity ?? 1, 0.25, 1);
    this.sparksPerHit = Math.max(4, Math.round(10 * density));

    this.group.name = 'song-notes';
    this.group.visible = false;
    // Nothing in here is ever behind the camera when the busk is running,
    // and the instanced fields position themselves from world-space
    // attributes rather than from the group's matrix, so a bounding volume
    // could only ever be wrong.
    this.group.frustumCulled = false;

    this.atlas = buildGlyphAtlas();

    // --- the staff ------------------------------------------------------
    // Five lines plus the barline. Each is one quad: the card is flat, so
    // there is no curve to follow and nothing to subdivide for. What used to
    // need twenty-six segments a line to ride the road now needs one, and
    // the whole buffer is small enough to rewrite every frame — which it has
    // to be, because the card turns with the camera.
    const ribbonVerts = (LINE_STEPS.length + 1) * 6;
    const staffGeometry = new BufferGeometry();
    this.staffPosition = new BufferAttribute(new Float32Array(ribbonVerts * 3), 3);
    this.staffFade = new BufferAttribute(new Float32Array(ribbonVerts), 1);
    this.staffKind = new BufferAttribute(new Float32Array(ribbonVerts), 1);
    this.staffSpan = new BufferAttribute(new Float32Array(ribbonVerts), 1);
    this.staffPosition.setUsage(DynamicDrawUsage);
    this.staffFade.setUsage(DynamicDrawUsage);
    this.staffKind.setUsage(DynamicDrawUsage);
    this.staffSpan.setUsage(DynamicDrawUsage);
    staffGeometry.setAttribute('position', this.staffPosition);
    staffGeometry.setAttribute('aFade', this.staffFade);
    staffGeometry.setAttribute('aKind', this.staffKind);
    staffGeometry.setAttribute('aSpan', this.staffSpan);
    staffGeometry.boundingSphere = null;
    this.staffMaterial = new ShaderMaterial({
      uniforms: {
        uInk: { value: new Color(STAFF_INK) },
        uPaper: { value: new Color(PAPER) },
        // Replaced by the scene's own shared horizon colour the first time
        // this draws; see `adoptHorizon`. The literal is the daylight value
        // from `createPainterlyGlobals`, so a staff that never finds the
        // world's uniforms is wrong at dusk rather than wrong always.
        uHorizon: { value: new Color(0xf2d6b8) } as IUniform<Color>,
        uOpacity: { value: LINE_OPACITY },
        uBarOpacity: { value: BAR_OPACITY },
        uPaperOpacity: { value: PAPER_OPACITY },
        uPaperTint: { value: PAPER_HORIZON_TINT },
        // Where the ink stops and the bloom begins, as a fraction of the
        // quad's half-width. One number for both pieces because both are
        // drawn at their bloom's size and cut in the middle.
        uLineInk: { value: LINE_HALF_STEPS / LINE_GLOW_HALF_STEPS },
        uBarInk: { value: BAR_HALF_STEPS / BAR_GLOW_HALF_STEPS },
      },
      vertexShader: STAFF_VERTEX,
      fragmentShader: STAFF_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.staff = new Mesh(staffGeometry, this.staffMaterial);
    this.staff.frustumCulled = false;
    this.staff.renderOrder = 8;
    this.staff.name = 'song-staff';
    // The staff is the first thing in this group to draw, which makes its
    // hook the cheapest place to pick up the two things the apparatus needs
    // from outside and is not handed: the scene's shared sky colour, and the
    // camera the card is turned toward.
    this.staff.onBeforeRender = (_renderer, scene, camera) => {
      if (!this.horizonSought) {
        this.horizonSought = true;
        this.adoptHorizon(scene);
      }
      if ((camera as PerspectiveCamera).isPerspectiveCamera) {
        this.camera = camera as PerspectiveCamera;
      }
    };
    this.group.add(this.staff);

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
        uSize: { value: glyphWorldSize() },
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

  /** Show or hide the whole apparatus. Hidden costs three draw calls, not thirty. */
  setActive(active: boolean): void {
    this.group.visible = active;
    if (!active) this.live.clear();
    // A busk can begin before any of the world's chunks have been built, so
    // the search for the shared sky colour is retried at the start of each
    // one rather than made a constructor-time question with one answer.
    if (active) this.horizonSought = false;
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
    this.buildStaff();
    this.harvest(nowMs);
    this.writeGlyphs(nowMs);
    this.sparkMaterial.uniforms.uNow.value = nowMs / 1000;
  }

  dispose(): void {
    this.glyphGeometry.dispose();
    this.glyphMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.staff.geometry.dispose();
    this.staffMaterial.dispose();
    this.atlas.dispose();
  }

  // --- internals ---------------------------------------------------------

  /**
   * Stand the card up: where its barline is, which way it lies, how big.
   *
   * The long axis is the camera's right *flattened into the ground plane*
   * rather than the camera's true right. Full billboarding would roll the
   * stave whenever the camera pitched or drifted, and a stave that is not
   * level is a stave whose pitch axis is not up — which is the one thing a
   * child is being asked to read off it.
   */
  private placeCard(): void {
    this.pointAt(ANCHOR_AHEAD_M, this.anchor);

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

    this.scale = camera ? this.cardScale(camera) : 1;
    this.anchor.addScaledVector(this.right, -BAR_LEFT_M * this.scale);
    this.glyphMaterial.uniforms.uSize.value = glyphWorldSize() * this.scale;
  }

  /**
   * How much to shrink the whole card for this screen.
   *
   * The stave is written in world metres because it stands in the world, but
   * what has to stay constant is the share of the *frame* it takes: the run
   * has to fit beside the bard on a phone held sideways and on a desktop
   * alike, and a note head has to stay big enough to read the letter out of.
   * So the frame's width is measured in metres at the depth the card stands
   * at, and the card is scaled by how that compares with the screen it was
   * tuned on. Wider frames do not grow it — past the reference width the
   * stave is already as large as the picture wants it.
   */
  private cardScale(camera: PerspectiveCamera): number {
    const depth = camera.position.distanceTo(this.anchor);
    const halfV = (camera.fov * Math.PI) / 360;
    const frameWidth = 2 * depth * Math.tan(halfV) * camera.aspect;
    return clamp(frameWidth / REFERENCE_FRAME_WIDTH_M, CARD_SCALE_MIN, 1);
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
   * Take the scene's own horizon colour, by reference.
   *
   * The staff has to be lit by the same sky as everything else — one lighting
   * model, no exceptions — and a copy would be a second one, wrong by a whole
   * time of day within a minute of walking. `createPainterlyMaterial` marks
   * every surface it builds and hands them all the *same* uniform object, so
   * finding any one of them and binding to what it is already reading keeps
   * the staff on the world's clock for the cost of one traversal per busk.
   */
  private adoptHorizon(scene: Object3D): void {
    let found: IUniform<Color> | undefined;
    scene.traverse((object) => {
      if (found) return;
      const material = (object as Mesh).material;
      const candidates = Array.isArray(material) ? material : [material];
      for (const candidate of candidates) {
        if (!candidate?.userData?.painterly) continue;
        const uniform = (candidate as ShaderMaterial).uniforms?.uHorizonColor;
        if (uniform) found = uniform as IUniform<Color>;
      }
    });
    if (found) this.staffMaterial.uniforms.uHorizon = found;
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

  /**
   * Lay the five lines and the barline out across the card.
   *
   * Each line is a flat quad in the card's plane, and the card faces the
   * camera, so there is no edge-on case to defend against and one quad a line
   * is enough. The fade along the run is done in the fragment shader from a
   * parameter carried on the vertices rather than by subdividing until the
   * gradient is smooth, which is what the old road-borne ribbon had to do.
   */
  private buildStaff(): void {
    const position = this.staffPosition.array as Float32Array;
    const fade = this.staffFade.array as Float32Array;
    const kind = this.staffKind.array as Float32Array;
    const span = this.staffSpan.array as Float32Array;
    const s = this.scale;
    const uStart = -TAIL_M * s;
    const uEnd = RUN_M * s;

    // Every quad is drawn at the *bloom's* size, not the ink's. The ink is a
    // band in the middle of it, cut by the shader — which is the only way to
    // get a soft edge out of two triangles.
    const glow = STEP_M * LINE_GLOW_HALF_STEPS * s;
    const ax = this.anchor.x + this.right.x * uStart;
    const az = this.anchor.z + this.right.z * uStart;
    const bx = this.anchor.x + this.right.x * uEnd;
    const bz = this.anchor.z + this.right.z * uEnd;

    let v = 0;
    for (const step of LINE_STEPS) {
      const y = this.stepY(step);
      v = quad(position, fade, kind, span, v, KIND_LINE, ax, az, bx, bz, y - glow, y + glow, false);
    }

    // The barline: a single upright stroke across the five lines, standing
    // where the notes are struck. It is the same mark a bar ends with in
    // written music, which is why it is a barline and not a glowing target —
    // the player reads "here" from notation they already understand. It stops
    // at the outer lines, as engraved; running it past them was an attempt to
    // make it more visible that only made it less like notation.
    const barGlow = STEP_M * BAR_GLOW_HALF_STEPS * s;
    const inkHalf = STEP_M * LINE_HALF_STEPS * s;
    quad(
      position,
      fade,
      kind,
      span,
      v,
      KIND_BARLINE,
      this.anchor.x - this.right.x * barGlow,
      this.anchor.z - this.right.z * barGlow,
      this.anchor.x + this.right.x * barGlow,
      this.anchor.z + this.right.z * barGlow,
      this.stepY(LINE_STEPS[0]) - inkHalf,
      this.stepY(LINE_STEPS[LINE_STEPS.length - 1]) + inkHalf,
      true,
    );

    this.staffPosition.needsUpdate = true;
    this.staffFade.needsUpdate = true;
    this.staffKind.needsUpdate = true;
    this.staffSpan.needsUpdate = true;
  }
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
  ctx.font = 'bold 33px Georgia, "Times New Roman", serif';
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
 * One upright rectangle on the stave, as two triangles.
 *
 * `a` and `b` are its ends in the ground plane and `low`/`high` its height;
 * both pieces of the stave are that shape, which is why the whole thing is
 * thirty-six vertices with no index buffer to keep in step with them.
 *
 * Two parameters ride on the vertices. `aFade` is where the vertex sits along
 * the run, 0 at the near end and 1 at the far one. `aSpan` runs -1 to 1
 * across whichever axis the ink is thin in — the height of a staff line, the
 * width of a barline — and `spanAcrossLength` is which of the two that is.
 */
function quad(
  position: Float32Array,
  fade: Float32Array,
  kind: Float32Array,
  span: Float32Array,
  v: number,
  k: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  low: number,
  high: number,
  spanAcrossLength: boolean,
): number {
  const write = (x: number, y: number, z: number, f: number, up: number): void => {
    position[v * 3] = x;
    position[v * 3 + 1] = y;
    position[v * 3 + 2] = z;
    fade[v] = f;
    kind[v] = k;
    span[v] = spanAcrossLength ? f * 2 - 1 : up;
    v++;
  };
  write(ax, low, az, 0, -1);
  write(bx, low, bz, 1, -1);
  write(bx, high, bz, 1, 1);
  write(ax, low, az, 0, -1);
  write(bx, high, bz, 1, 1);
  write(ax, high, az, 0, 1);
  return v;
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

const STAFF_VERTEX = /* glsl */ `
attribute float aFade;
attribute float aKind;
attribute float aSpan;
varying float vFade;
varying float vKind;
varying float vSpan;

void main() {
  vFade = aFade;
  vKind = aKind;
  vSpan = aSpan;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

/**
 * Ink, and the paper it soaked into.
 *
 * Across the thin axis: a band of ink with a cream bloom either side of it,
 * which is what a printed line looks like close up and what makes one legible
 * against a photograph of anything. The bloom is squared so it falls away
 * fast — a linear falloff at this width reads as a glow, and glowing notation
 * belongs to a different game.
 *
 * Along the run: strongest at the barline and thinnest at the far end,
 * because that is the order the eye is asked to read it in, and both ends go
 * to nothing rather than stopping square. The lines do not fall all the way,
 * because the far end is where the notes the player has not yet played are
 * travelling and pitch is unreadable with no line under the head.
 */
const STAFF_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uHorizon;
uniform float uOpacity;
uniform float uBarOpacity;
uniform float uPaperOpacity;
uniform float uPaperTint;
uniform float uLineInk;
uniform float uBarInk;
varying float vFade;
varying float vKind;
varying float vSpan;

void main() {
  float bar = step(0.5, vKind);
  float t = clamp(vFade, 0.0, 1.0);

  float ends = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.90, t);
  float along = mix(ends * (0.66 + 0.34 * smoothstep(0.95, 0.12, t)), 1.0, bar);

  float edge = mix(uLineInk, uBarInk, bar);
  float d = abs(vSpan);
  float core = smoothstep(edge, edge * 0.45, d);
  float bloom = (1.0 - d) * (1.0 - d);

  vec3 paper = mix(uPaper, uHorizon, uPaperTint);
  vec3 color = mix(paper, uInk, core);
  float a = mix(uPaperOpacity * bloom, mix(uOpacity, uBarOpacity, bar), core) * along;

  if (a < 0.004) discard;
  gl_FragColor = vec4(color, a);
}
`;

const GLYPH_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aCell;
attribute float aScale;
attribute float aAlpha;
attribute float aPale;

uniform float uSize;

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
  vec4 view = viewMatrix * vec4(aPos, 1.0);
  view.xy += position.xy * uSize * aScale;
  gl_Position = projectionMatrix * view;
}
`;

const GLYPH_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uCellSize;
uniform vec3 uColor;
uniform vec3 uInk;
uniform vec3 uPale;

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
  vec3 color = mix(body, uInk, clamp(t.g, 0.0, 1.0));
  gl_FragColor = vec4(color, cover * vAlpha);
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
