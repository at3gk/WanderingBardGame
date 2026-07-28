/**
 * The busking visual: a staff laid down the road, and real notes riding it
 * toward the bard.
 *
 * This is the picture the whole game is for, so it is worth saying exactly
 * what it is and what it refuses to be. It is **not** a note highway pasted
 * over the top of a 3D scene. Five staff lines run away from the bard along
 * the road he is standing on, at head height, curving with it; the notes of
 * the tune travel down that staff and are struck as they reach him. The
 * staff is in the world — the light falls past it, the hill it crosses
 * hides its far end — because a rhythm strip stuck to the glass would make
 * the scenery a backdrop, and the scenery is the point.
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
  ShaderMaterial,
  Vector3,
} from 'three';
import { TRAVEL_TIME_MS } from '../../core/beats';
import type { Instrument } from '../../core/instruments';
import { letterForStep, needsLedger, staffStepAt, stemDown } from '../../core/notation';
import type { Judgement } from '../../core/performance';
import type { SongBeat } from '../../core/song';

/**
 * One diatonic step, in metres. Two steps make a staff space, so the staff
 * itself (E4 to F5) is eight steps — a metre and a half, from about the
 * bard's knee to a little above his hat.
 *
 * It was 0.145 and that was too small to read, for a reason that is worth
 * writing down because it is not obvious from the number: the staff is seen
 * almost end-on. The pitch axis is vertical and the time axis runs away from
 * the camera, so perspective is already compressing the *time* axis into
 * nothing near the far end while leaving pitch alone — and at 0.145 the five
 * lines subtended so little angle that they converged into two or three
 * hairlines within four metres. Reading which line a note sits on is the
 * entire pedagogical premise of this game, so the pitch axis has to be given
 * enough room that it survives that convergence. This is paid for by
 * shortening the run (`SPAWN_AHEAD_M`) rather than by moving the camera.
 */
const STEP_M = 0.2;

/**
 * World height of staff step 0 — middle C — above the bard's feet.
 *
 * Set so the **middle line sits at 1.32 m**, the top of the bard's hat. That
 * is the number that matters, not this one: the staff has to be pinned to
 * the figure, because notation floating clear above the horizon reads as
 * signposts rather than as music — it has no ground behind it and nothing to
 * belong to. With the middle line on his hat the lower half crosses the road
 * and the grass and the tune is plainly his, and only the top line (F5, the
 * rarest note in the songbook) climbs past the camera's eye.
 *
 * It fell from 0.45 when `STEP_M` grew; keeping it would have lifted the
 * whole staff a metre into the sky.
 */
const STEP_ZERO_Y = 0.12;

/** The five printed lines of the treble staff: E4 G4 B4 D5 F5. */
const LINE_STEPS = [2, 4, 6, 8, 10];

/**
 * Where a note is struck, in metres ahead of the bard.
 *
 * Not zero. A note resolved exactly on him would be inside his hat from the
 * busking camera, and the moment of the strike is the one thing in the frame
 * that has to be unambiguous.
 */
const HIT_AHEAD_M = 1.05;

/**
 * How far up the road a note appears. Travel time is fixed, so this is also
 * its speed.
 *
 * Shortened from 8.5 along with the staff's growth. The two numbers are one
 * decision: what matters is the *ratio* of the staff's height to the length
 * of road it is stretched over, because that ratio is what decides whether
 * the five lines are still five lines at the far end. Six metres and a
 * metre-and-a-half staff is about two and a half times the old figure, which
 * is the difference between "which line is that" being answerable and not.
 * The notes travel more slowly for it, which is no loss in a game where
 * nothing can be failed.
 */
const SPAWN_AHEAD_M = 6.0;

/** How far *behind* the hit line the staff is drawn, so it does not stop dead at it. */
const TAIL_BEHIND_M = 1.1;

/**
 * How far a note drifts past the barline before it comes to rest.
 *
 * It has to be a small number and there has to be a number at all. The first
 * version simply kept the note travelling at its own speed once the beat had
 * gone, which is what a scrolling 2D chart does and which is catastrophic in
 * three dimensions: within half a second the glyph had passed the bard, then
 * the camera, and a missed note filled the screen. So a note eases to a stop
 * just past the line and fades from there — it went by, it did not charge.
 */
const PAST_DRIFT_M = 0.55;

/** How long a note stays visible after its window has closed, drifting past. */
const PAST_MS = 620;

/** How long a struck note's bloom lasts. */
const STRIKE_MS = 420;

/** Segments along the staff ribbons. Enough that the road's curve is smooth. */
const RIBBON_SEGMENTS = 26;

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
  /** Rebuilt only when the anchor really moves; a busking bard stands still. */
  private ribbonAnchor = new Vector3(Number.NaN, Number.NaN, Number.NaN);
  private ribbonHeading = Number.NaN;

  private readonly scratch = new Vector3();
  private nowMs = 0;

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
    // Five lines plus the barline standing at the hit point.
    const ribbonVerts = (LINE_STEPS.length * RIBBON_SEGMENTS + 1) * 6;
    const staffGeometry = new BufferGeometry();
    this.staffPosition = new BufferAttribute(new Float32Array(ribbonVerts * 3), 3);
    this.staffFade = new BufferAttribute(new Float32Array(ribbonVerts), 1);
    this.staffPosition.setUsage(DynamicDrawUsage);
    this.staffFade.setUsage(DynamicDrawUsage);
    staffGeometry.setAttribute('position', this.staffPosition);
    staffGeometry.setAttribute('aFade', this.staffFade);
    staffGeometry.boundingSphere = null;
    this.staffMaterial = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(INK) },
        // The staff is a guide the eye follows, not furniture — but 0.42 was
        // below the threshold at which a one-pixel line survives being drawn
        // against grass, and five lines that are only *sometimes* there are
        // worse than four. This is as faint as the pitch axis can be and
        // still be counted.
        uOpacity: { value: 0.62 },
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
   * Where the staff starts and which way it runs.
   *
   * `sampler` is how the staff follows the road instead of shooting off
   * across a field on a bend: the caller knows the road and answers where it
   * is `ahead` metres on. Without one the staff runs dead straight along the
   * heading, which is right for a bard standing anywhere but a curve.
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

    this.rebuildRibbonIfMoved();
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
      this.pointAt(aheadAt(progress), this.scratch);

      const step = note.step ?? 6;
      let y = this.scratch.y + STEP_ZERO_Y + step * STEP_M;

      let a = 1;
      let scaleMul = 1;
      let paleness = 0;

      // Fade in over the first two metres of travel so a note arrives
      // rather than appears.
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
        y -= t * t * 0.22;
      } else if (nowMs > note.hitTimeMs) {
        a *= 1 - clamp((nowMs - note.hitTimeMs) / PAST_MS, 0, 1);
      }

      const col = note.cell % ATLAS_COLS;
      const row = Math.floor(note.cell / ATLAS_COLS);

      pos[i * 3] = this.scratch.x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = this.scratch.z;
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
    const step = note.step ?? 6;
    const progress = 1 - (note.hitTimeMs - this.nowMs) / TRAVEL_TIME_MS;
    this.pointAt(aheadAt(progress), this.scratch);
    const x = this.scratch.x;
    const y = this.scratch.y + STEP_ZERO_Y + step * STEP_M;
    const z = this.scratch.z;

    // A dead-centre note is worth a bigger bloom than one caught in the
    // tail. This is the only place in the game that grades anything, and it
    // grades it in light for half a second rather than in a number.
    const weight = judgement === 'perfect' ? 1 : judgement === 'good' ? 0.82 : 0.6;
    const now = this.nowMs / 1000;

    // Sizes are in metres and were set by looking at frames rather than by
    // taste: the first pass used sparks a third this size, and at the four
    // or five metres the busking camera sits from the barline they were two
    // or three pixels each and the hit read as nothing happening at all.
    this.emit(x, y, z, now, 0, 0.68 * weight, STRIKE_MS / 1000);
    const count = Math.round(this.sparksPerHit * weight);
    for (let n = 0; n < count; n++) {
      this.emit(x, y, z, now, 1, 0.13 + Math.random() * 0.09, 0.9 + Math.random() * 0.6);
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

  /** World point `ahead` metres along the road from the anchor. */
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

  private rebuildRibbonIfMoved(): void {
    if (
      this.ribbonAnchor.distanceToSquared(this.origin) < 0.0025 &&
      Math.abs(this.ribbonHeading - this.heading) < 0.01
    ) {
      return;
    }
    this.ribbonAnchor.copy(this.origin);
    this.ribbonHeading = this.heading;
    this.buildRibbon();
  }

  /**
   * Lay the five lines out along the road.
   *
   * Each line is a thin vertical strip so it reads as a drawn line from the
   * busking camera, which sits off to one side and a little above. A flat
   * ribbon would vanish edge-on the moment the camera came down to eye
   * level, which is exactly where this camera goes.
   */
  private buildRibbon(): void {
    const position = this.staffPosition.array as Float32Array;
    const fade = this.staffFade.array as Float32Array;
    const half = STEP_M * 0.075;
    const start = HIT_AHEAD_M - TAIL_BEHIND_M;
    const span = SPAWN_AHEAD_M - start;

    const a = new Vector3();
    const b = new Vector3();
    let v = 0;

    for (const step of LINE_STEPS) {
      const lift = STEP_ZERO_Y + step * STEP_M;
      for (let s = 0; s < RIBBON_SEGMENTS; s++) {
        const t0 = s / RIBBON_SEGMENTS;
        const t1 = (s + 1) / RIBBON_SEGMENTS;
        this.pointAt(start + span * t0, a);
        this.pointAt(start + span * t1, b);
        const f0 = ribbonFade(t0);
        const f1 = ribbonFade(t1);

        // Two triangles, written out rather than indexed: the buffer is
        // rewritten whole whenever the bard moves and an index buffer would
        // only add a second thing to keep in step with it.
        v = pushVertex(position, fade, v, a.x, a.y + lift - half, a.z, f0);
        v = pushVertex(position, fade, v, b.x, b.y + lift - half, b.z, f1);
        v = pushVertex(position, fade, v, b.x, b.y + lift + half, b.z, f1);
        v = pushVertex(position, fade, v, a.x, a.y + lift - half, a.z, f0);
        v = pushVertex(position, fade, v, b.x, b.y + lift + half, b.z, f1);
        v = pushVertex(position, fade, v, a.x, a.y + lift + half, a.z, f0);
      }
    }

    // The barline: a single upright stroke across the staff, standing where
    // the notes are struck. It is the same mark a bar ends with in written
    // music, which is why it is a barline and not a glowing target — the
    // player reads "here" from notation they already understand.
    this.pointAt(HIT_AHEAD_M, a);
    // Weight. A barline is the mark that says *here*, and at a ninth of a
    // step it was thinner than the lines it crosses — the one place in the
    // frame that has to be unambiguous was the faintest thing in it.
    const right = STEP_M * 0.24;
    const low = STEP_ZERO_Y + (LINE_STEPS[0] - 0.35) * STEP_M;
    const high = STEP_ZERO_Y + (LINE_STEPS[LINE_STEPS.length - 1] + 0.35) * STEP_M;
    const tangentX = Math.sin(this.heading) * right;
    const tangentZ = Math.cos(this.heading) * right;
    v = pushVertex(position, fade, v, a.x - tangentX, a.y + low, a.z - tangentZ, 1);
    v = pushVertex(position, fade, v, a.x + tangentX, a.y + low, a.z + tangentZ, 1);
    v = pushVertex(position, fade, v, a.x + tangentX, a.y + high, a.z + tangentZ, 1);
    v = pushVertex(position, fade, v, a.x - tangentX, a.y + low, a.z - tangentZ, 1);
    v = pushVertex(position, fade, v, a.x + tangentX, a.y + high, a.z + tangentZ, 1);
    pushVertex(position, fade, v, a.x - tangentX, a.y + high, a.z - tangentZ, 1);

    this.staffPosition.needsUpdate = true;
    this.staffFade.needsUpdate = true;
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

function pushVertex(
  position: Float32Array,
  fade: Float32Array,
  v: number,
  x: number,
  y: number,
  z: number,
  f: number,
): number {
  position[v * 3] = x;
  position[v * 3 + 1] = y;
  position[v * 3 + 2] = z;
  fade[v] = f;
  return v + 1;
}

/** Where a note sits, in metres ahead of the bard, at a given travel progress. */
function aheadAt(progress: number): number {
  if (progress <= 1) return SPAWN_AHEAD_M + (HIT_AHEAD_M - SPAWN_AHEAD_M) * progress;
  return HIT_AHEAD_M - PAST_DRIFT_M * (1 - Math.exp(-(progress - 1) * 4));
}

/** Strongest where the notes are struck, dissolving into the distance. */
function ribbonFade(t: number): number {
  return smoothstep(1, 0.55, t) * smoothstep(0, 0.06, t);
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
varying float vFade;

void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const STAFF_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;

void main() {
  float a = vFade * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
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
