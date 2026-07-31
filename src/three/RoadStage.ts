/**
 * The road — the stage the game actually happens on.
 *
 * This is the integration point: it owns the day's road, the streamed
 * world, the bard, the camera and the sky, and it sequences them against
 * the journey state machine. It deliberately owns no *rules*. Where to walk
 * comes from `core/road`, whether the day is over comes from `core/journey`,
 * what a busk is worth comes from `core/performance`. If a rule appears in
 * this file it is in the wrong place and the tests cannot see it.
 *
 * The walk is steered by the tune, not by a key (v0.8). The player's input
 * goes into the *music*, and the music is what keeps the bard moving: notes
 * scroll toward the barline while he walks, exactly as they do at a busk,
 * and the song meter those taps feed is what sets the stride. Nobody holds
 * a key to walk — but nobody walks for free either, because a walk that
 * plays itself is a walk being watched, and DESIGN.md's core-mechanic
 * section never sanctioned that.
 *
 * ## The one verb
 *
 * Tap, or press anything. That is the entire input surface, and it means
 * different things in only two places: while a tune is running — walking or
 * busking — it plays the note that has reached the barline, and while the
 * road is holding on something — a vista, somebody met at a crossroads — it
 * means "walk on". Nothing else in the game is clickable, so nothing has to
 * be found.
 *
 * ## Two clocks
 *
 * A tune is scheduled on the *audio* clock whenever there is one, and on the
 * simulation clock before the player has touched the screen (browsers will
 * not give out an AudioContext until then). `tuneNowMs` is the only place
 * that knows which, and everything downstream — the judge, the notes, the
 * adaptive backing — reads that one number. The two clocks drift by a
 * measurable amount over a session and a rhythm game is where that is
 * audible, so having a single answer to "what time is it in this tune"
 * matters more here than anywhere else in the codebase.
 */

import { Group, Scene, Vector3 } from 'three';
import type { App, Stage } from './App';
import { CameraRig, type CameraMood } from './CameraRig';
import { Sky, applyTimeOfDay, skyStateAt } from './sky';
import { roadSurfaceHeight, TERRAIN_REACH, WorldStreamer } from './world/WorldStreamer';
import { Bard } from './actors/Bard';
import { TRAVELLER_KINDS, Traveller } from './actors/Traveller';
import { Campfire } from './scenes/Campfire';
import { ParticleField, fallingLeaves, fireflies, seedFluff, sunDust } from './fx/Particles';
import { SongNotes } from './fx/SongNotes';
import { BIOME_PALETTES, DEFAULT_PALETTE } from './world/palette';
import { Hud } from '../ui/Hud';
import { dailySeed, dayKey, mulberry32, randRange, subSeed } from '../core/rng';
import {
  biomeAt,
  generateRoad,
  nextStop,
  sampleRoad,
  terrainHeight,
  type DailyRoad,
  type RoadSample,
  type RoadStop,
} from '../core/road';
import {
  advance,
  canEnter,
  chooseInstrument,
  chooseSong,
  createJourney,
  earn,
  enterPhase,
  loadJourney,
  recordEntry,
  saveJourney,
  unlockInstrument,
  type JourneyState,
  type Phase,
} from '../core/journey';
import {
  instrumentById,
  isInstrumentId,
  unlockedInstruments,
  type Instrument,
} from '../core/instruments';
import { beatIntervalMs } from '../core/beats';
import { expandSong, songDurationMs, type SongBeat } from '../core/song';
import { SONGS } from '../core/songs';
import { songForPass } from '../core/songChoice';
import {
  extendWalkTune,
  startWalkTune as newWalkTune,
  walkPaceFactor,
  type WalkTune,
} from '../core/walk';
import {
  applyJudgement,
  createBuskCrowd,
  crowdFarewellLine,
  DEFAULT_PERFORMANCE_CONFIG,
  WALK_PERFORMANCE_CONFIG,
  type BuskCrowd,
  type PerformanceConfig,
  createPerformance,
  judge,
  lateWindowMs,
  performanceSummary,
  pickBeat,
  tickBuskCrowd,
  tickPerformance,
  type PerformanceState,
} from '../core/performance';
import { resolveAsk, rollAsk, rollEncounter, type EncounterAsk } from '../core/encounters';
import { describeIdleYield, idleYield, loadIdle, saveIdle } from '../core/idle';
import { Ambience, dayShape } from '../audio/ambience';
import {
  adaptiveDrive,
  initialAdaptiveState,
  updateAdaptive,
  type AdaptiveLayerId,
  type AdaptiveMode,
  type AdaptiveState,
} from '../audio/adaptive';
import { ambienceBusGain, melodyGain, musicBusGain, type MixInput } from '../audio/mix';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { semitoneToFrequency } from '../audio/baseLoop';
import { playVoiceNote } from '../audio/instrumentVoice';

/** Metres per second at a comfortable walk. */
const WALK_SPEED = 2.2;
/** How close to a stop counts as arriving. */
const ARRIVE_RADIUS = 4;

/**
 * The songbook's written tempo, before the instrument bends it.
 *
 * Ninety-two is a walking pace and a little under a heartbeat. The songbook
 * carries no tempo of its own — a written melody is pitches and durations —
 * so this is the one place the game decides how fast a quarter note is, and
 * `Instrument.tempoFeel` is what makes a bell's version of the same tune
 * unhurried and a drum's brisk.
 */
const BASE_BPM = 92;

/**
 * Roughly how long a busk should last, in milliseconds.
 *
 * A busk is a whole number of passes through the tune — stopping mid-phrase
 * would be the one ugly edit in a game with no cuts in it — so this is a
 * floor rather than a length: the songbook's tunes run from about fifteen
 * seconds to about half a minute at walking tempo, and this sends the short
 * ones round twice and the long ones round once.
 *
 * Half a minute is the number that matters and it was chosen against the
 * warmth curve rather than by feel: at four hundredths of the remaining
 * headroom per note, thirty seconds of quarter notes is about forty notes,
 * which is where the crowd reaches the top of its range. A busk much
 * shorter than that could never fill a square; much longer and the road —
 * which is the thing the game is actually about — is out of sight for too
 * long. The busk ends by itself because there is no fail state to end it
 * and no button worth adding.
 */
const MIN_BUSK_MS = 30_000;
/** However short the tune, and however long. */
const MIN_BUSK_PASSES = 1;
const MAX_BUSK_PASSES = 3;

/** Quiet beat after the last note before the bard picks the case up. */
const BUSK_TAIL_MS = 1400;

/** How long the road holds on a vista or on somebody met, unless tapped. */
const VISTA_HOLD_SEC = 6;
const ENCOUNTER_HOLD_SEC = 7;

const PHASE_TO_MOOD: Record<Phase, CameraMood> = {
  waking: 'walking',
  walking: 'walking',
  busking: 'busking',
  encounter: 'encounter',
  resting: 'resting',
};

/** The layer voices the adaptive backing is built from. See `startAudio`. */
const LAYER_WAVEFORMS: Record<AdaptiveLayerId, OscillatorType> = {
  drone: 'sawtooth',
  pulse: 'triangle',
  harmony: 'sine',
  counter: 'triangle',
  shimmer: 'sine',
};

interface LayerVoice {
  gain: GainNode;
  oscillators: OscillatorNode[];
  filter: BiquadFilterNode;
}

export interface RoadStageOptions {
  /** Override the day, for the postcard tool and for tests. */
  dayKeyOverride?: string;
  seedOverride?: number;
  /** Where the DOM chrome is attached. Defaults to the document body. */
  hudHost?: HTMLElement;
}

export class RoadStage implements Stage {
  readonly scene = new Scene();
  readonly road: DailyRoad;

  private readonly app: App;
  private readonly rig: CameraRig;
  private readonly sky = new Sky();
  private readonly world: WorldStreamer;
  private readonly bard: Bard;
  /**
   * The people on the road. One of each silhouette, built once and moved
   * around, because a busk needs three or four of them for six seconds and
   * building figures at the moment the music starts is the one place in the
   * frame budget where a hitch would actually be heard.
   */
  private readonly people: Traveller[] = [];
  private readonly shown: Traveller[] = [];
  private readonly actors = new Group();
  private readonly notes: SongNotes;
  private readonly hud: Hud;

  private journey: JourneyState;
  /**
   * The time of day the sky is *currently* showing. Damped toward the
   * journey's dayFraction so that warping the player along the road (the
   * postcard tool, or an idle catch-up) does not strobe the sky.
   */
  private shownDayFraction: number;
  private walking = false;
  private saveTimer = 0;

  /** The stop the bard is currently stood at, if any. */
  private currentStop: RoadStop | null = null;
  /** Seconds left on a held moment — a vista, or somebody met. */
  private holdSec = 0;

  private readonly subject = { position: new Vector3(), heading: 0 };
  private readonly sample: RoadSample = { s: 0, x: 0, y: 0, heading: 0 };

  // --- the tune (the busk's, or the walk's) -------------------------------
  //
  // One performance at a time, whichever kind it is: `tuneMode` says whether
  // the notes in the air belong to a busk or to the walk itself (v0.8 — the
  // walk carries the tune too). The clock, the judge and the staff are
  // shared; what differs is what a note is worth (a busk pays coins, the
  // walk moves the bard) and how the schedule ends (a busk ends, the walk's
  // is extended for ever).
  private performance: PerformanceState | null = null;
  private tuneMode: 'busk' | 'walk' | null = null;
  private beats: SongBeat[] = [];
  private tuneBpm = BASE_BPM;
  private tuneBeatsPerBar = 4;
  private buskEndMs = 0;
  /** Simulation-clock fallback for the tune, used before audio exists. */
  private tuneSimMs = 0;
  /**
   * Audio-clock time of tune-clock zero, or NaN when there is no audio yet.
   *
   * NaN rather than a negative sentinel, which is what this was first and
   * which was wrong: a busk that started before the audio did anchors at
   * `currentTime - elapsed`, and on a context a second old that is a
   * perfectly ordinary *negative* number. With -1 as the sentinel the busk
   * silently stayed on the simulation clock for the rest of the tune.
   */
  private tuneAnchorSec = Number.NaN;
  private creditedCoins = 0;
  private creditedDelight = 0;
  private busksToday = 0;
  private everHinted = false;
  private readonly metToday: string[] = [];
  /**
   * The busk's crowd as individuals (core/performance's `BuskCrowd`), and
   * where each of them is standing. `listenerSlots` is ordered the way the
   * model counts: index 0 is the first to have stopped and the last who
   * would ever leave, so the model's `present` is always a prefix of it.
   */
  private buskCrowd: BuskCrowd | null = null;
  private readonly listenerSlots: Array<{
    person: Traveller;
    /** World bearing from the bard, fixed at gather time. */
    angle: number;
    /** Where they listen from. */
    radius: number;
    /** Where they are drawn right now — eases out when leaving, in when returning. */
    shownRadius: number;
    away: boolean;
  }> = [];
  /**
   * A traveller's request, carried from the encounter into the walk that
   * follows and settled against its first notes. Deliberately not
   * persisted: a reload mid-ask lets the moment go quietly, which costs
   * nothing and claims nothing.
   */
  private pendingAsk: EncounterAsk | null = null;

  // --- the walk's own tune -----------------------------------------------
  private walkTune: WalkTune | null = null;
  /** Rotation cursor for the wandering songbook, one step per walking stretch. */
  private walkPasses = 0;
  /**
   * Smoothed walking-speed multiplier. The *target* is `walkPaceFactor` of
   * the meter — instant, so recovery is instant — and this eases toward it
   * over a fraction of a second purely so the bard decelerates rather than
   * freezing mid-stride. Presentation, not rules.
   */
  private pace = 1;
  /** Whether the bard is stood playing in place because the tune lapsed. */
  private halted = false;

  // --- the camp ----------------------------------------------------------
  private campfire: Campfire | null = null;

  // --- weather in a small way --------------------------------------------
  private readonly fields: Array<{ id: string; field: ParticleField; opacity: number }> = [];

  // --- audio -------------------------------------------------------------
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambience: Ambience | null = null;
  private adaptive: AdaptiveState = initialAdaptiveState();
  private readonly layers = new Map<AdaptiveLayerId, LayerVoice>();
  /** Set once if the browser refuses an AudioContext. The walk continues silently. */
  private audioFailed = false;

  private readonly onPointerDown = (event: PointerEvent) => {
    // Only the primary contact. A second finger landing mid-tune is a hand
    // shifting grip, not a second note.
    if (event.isPrimary === false) return;
    this.tap();
  };
  private readonly onKeyDown = (event: KeyboardEvent) => {
    // "Any key" excludes the ones the browser needs: Tab still moves focus
    // and a shortcut still works, because a game that eats those is a game
    // somebody cannot get out of.
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Tab') return;
    this.tap();
  };
  private readonly onPageHide = () => this.persist();

  constructor(app: App, options: RoadStageOptions = {}) {
    this.app = app;

    const key = options.dayKeyOverride ?? dayKey();
    const seed = options.seedOverride ?? dailySeed();
    this.road = generateRoad(seed, key);

    this.journey = loadJourney(key) ?? createJourney(key, this.road.lengthM);
    // `waking` is a state with one exit and nothing in it, and a walk
    // reloaded mid-busk should resume on the road rather than in the middle
    // of somebody else's tune — the stop has not been marked visited yet, so
    // the bard simply arrives at it again, which is the kind version.
    // `resting` is the exception: the day is over and the fire is lit.
    if (this.journey.phase !== 'resting' && this.journey.phase !== 'walking') {
      this.journey = enterPhase(this.journey, 'walking');
    }
    this.walking = this.journey.phase === 'walking';
    this.shownDayFraction = this.journey.dayFraction;

    this.scene.add(this.sky.mesh);

    this.world = new WorldStreamer(this.road, app.globals, {
      foliageDensity: app.quality.foliageDensity,
      castShadows: app.quality.shadows,
      ahead: app.quality.tier === 'low' ? 5 : 7,
      behind: app.quality.tier === 'low' ? 2 : 3,
    });
    this.scene.add(this.world.group);

    this.bard = new Bard(app.globals);
    this.actors.add(this.bard.group);
    this.scene.add(this.actors);

    this.bard.setInstrument(this.instrument());
    this.bard.setPose('walking', 0);

    for (let i = 0; i < TRAVELLER_KINDS.length; i++) {
      const person = new Traveller(app.globals, TRAVELLER_KINDS[i], this.road.seed + i * 17);
      person.group.visible = false;
      this.people.push(person);
      this.actors.add(person.group);
    }

    this.notes = new SongNotes({ particleDensity: app.quality.particleDensity });
    this.scene.add(this.notes.group);
    this.notes.setInstrument(this.instrument());

    this.buildFields(app.quality.particleDensity);

    this.rig = new CameraRig();
    this.rig.setMood(PHASE_TO_MOOD[this.journey.phase], 0);

    // Aerial perspective, stated against the ground's own reach rather than
    // against the quality tier.
    //
    // This has been tuned twice by moving a multiplier on `viewDistance`,
    // once to 0.55 and once to 1.1, and neither did anything, because the
    // terrain ribbon only reaches 165 m: at 0.55 the near plane landed on
    // the last metre of ground and at 1.1 it landed a hundred and sixty-five
    // metres past it. Both settings meant the same thing — smoothstep's
    // lower edge at or beyond the furthest fragment, so `distanceFog` was
    // zero on every surface in the world. The four plain daylight frames
    // therefore had no distance term of any kind, which is most of why they
    // measured a total value range of about 1.3:1 from near grass to far
    // ridge. There is nothing to compose with in 1.3:1.
    //
    // The two ends are solved for, not chosen: the sixty-metre treeline is
    // to keep nearly all of its own tone (about a twelfth veiled) and the
    // hundred-and-sixty-metre edge of the ribbon is to be mostly air (about
    // three quarters), and there is exactly one pair of smoothstep edges
    // that does both. It comes out at twenty metres and two hundred and
    // forty. That shape — nothing near, a little at the treeline, a great
    // deal at the limit — is the shape aerial perspective actually has, and
    // it is the only term in a plain daylight frame that tells the near
    // ground from the far: both are the same green under the same sun, so
    // the entire value range between them is made here.
    app.globals.uFogNear.value = TERRAIN_REACH * 0.12;
    app.globals.uFogFar.value = TERRAIN_REACH * 1.47;

    this.world.update(this.journey.s);
    this.syncSubject();

    this.hud = new Hud(options.hudHost ?? document.body);
    this.hud.setCoins(this.journey.coins);
    this.hud.setInstrument(this.instrument().name);
    this.hud.onInstrumentChosen((id) => this.takeOut(id));
    this.hud.onSongChosen((id) => this.pinSong(id));
    this.hud.setMode(this.journey.phase === 'resting' ? 'resting' : 'walking');
    if (this.journey.phase === 'resting') this.makeCamp();
    this.collectIdle();
    // After the camp, which is where an unlock is named and where the case
    // therefore gains its entries.
    this.refreshCase();
    this.refreshSongbook();
    // A day loaded mid-road opens with its tune already in the air: the
    // constructor never goes through `setPhase`, so the walk's tune has to
    // be raised here or the road is silent until the first stop.
    if (this.journey.phase === 'walking') this.startWalkingTune();

    app.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pagehide', this.onPageHide);
  }

  get camera() {
    return this.rig.camera;
  }

  get state(): JourneyState {
    return this.journey;
  }

  /** The bard's world position, for anything that wants to sit near them. */
  get bardPosition(): Vector3 {
    return this.subject.position;
  }

  private instrument(): Instrument {
    // A save can name an instrument this build has never heard of, or one
    // the player has not earned. Either way the lute is what is in the case.
    const unlocked = unlockedInstruments(this.journey);
    const held = unlocked.find((i) => i.id === this.journey.instrumentId);
    return held ?? unlocked[0] ?? instrumentById('lute');
  }

  private syncSubject(): void {
    if (this.campfire && this.journey.phase === 'resting') {
      // At the fire the bard sits where the camp says, not where the road
      // does. The camp's layout put a seat by the coals and the whole scene
      // is built around it.
      const seat = this.campfire.seat;
      const anchor = this.campfire.group.position;
      this.subject.position.set(anchor.x + seat.x, anchor.y + seat.y, anchor.z + seat.z);
      this.subject.heading = seat.heading;
    } else {
      sampleRoad(this.road, this.journey.s, this.sample);
      // The road's `s` is its world Z by construction (see WorldStreamer).
      this.subject.position.set(this.sample.x, this.sample.y, this.sample.s);
      this.subject.heading = this.sample.heading;
    }
    this.bard.group.position.copy(this.subject.position);
    this.bard.setHeading(this.subject.heading);
  }

  update(dt: number): void {
    const before = this.journey.s;

    if (this.walking && this.journey.phase === 'walking') {
      // The tune gates the stride (v0.8): a healthy meter is a full walk, a
      // drained one slows the bard to a stop where he plays quietly in place.
      // The target is a pure function of the meter, so the first hit out of
      // a stall moves him on the same frame; the easing below is only so the
      // stop is a wind-down rather than a freeze. No tune — a hold, a phase
      // the walk passes through — means a full stride, never a penalty.
      const target =
        this.tuneMode === 'walk' && this.performance
          ? walkPaceFactor(this.performance.meter)
          : 1;
      this.pace += (target - this.pace) * Math.min(1, dt * 2.5);
      const stopped = this.tuneMode === 'walk' && target === 0 && this.pace < 0.05;
      if (stopped !== this.halted) {
        this.halted = stopped;
        this.bard.setPose(stopped ? 'playing' : 'walking', 0.8);
      }
      this.journey = advance(this.journey, WALK_SPEED * this.pace * dt, this.road.lengthM);
      this.checkArrivals();
    }

    const travelled = this.journey.s - before;
    this.syncSubject();
    this.bard.update(dt, travelled);
    for (const person of this.shown) person.update(dt);

    if (this.holdSec > 0) {
      this.holdSec -= dt;
      if (this.holdSec <= 0) this.resume();
    }

    if (this.performance) {
      if (this.tuneMode === 'busk') {
        this.tuneSimMs += dt * 1000;
        this.updateBusk(dt);
      } else if (this.tuneMode === 'walk' && this.walking && this.journey.phase === 'walking') {
        this.tuneSimMs += dt * 1000;
        this.updateWalkTune();
      }
    }

    this.updateAudio();

    // The sky follows the journey's day fraction, damped. The damping
    // constant is long on purpose: the light should change at the pace of
    // an afternoon, and a player who notices the sun moving is watching the
    // wrong thing.
    const target = this.journey.dayFraction;
    this.shownDayFraction += (target - this.shownDayFraction) * Math.min(1, dt * 0.9);

    this.world.update(this.journey.s);
    this.campfire?.update(dt, this.app.globals.uTime.value);
    this.updateFields(dt);
    this.hud.update(dt);

    this.saveTimer += dt;
    if (this.saveTimer > 5) {
      this.saveTimer = 0;
      saveJourney(this.journey);
    }
  }

  /**
   * Has the bard reached the next thing worth stopping for?
   *
   * Visited stops are recorded in the journey rather than here, so that
   * walking back and forth over a busking spot cannot farm it and so that
   * a reload does not re-trigger the stop you just left.
   */
  private checkArrivals(): void {
    const stop = nextStop(this.road, this.journey.s - ARRIVE_RADIUS);
    if (!stop) return;
    if (this.journey.visited.includes(stop.id)) return;
    if (Math.abs(stop.s - this.journey.s) > ARRIVE_RADIUS) return;
    this.arriveAt(stop);
  }

  private arriveAt(stop: RoadStop): void {
    this.currentStop = stop;
    switch (stop.kind) {
      case 'campfire':
        this.setPhase('resting');
        break;
      case 'busk':
        this.setPhase('busking');
        break;
      case 'vista':
        // A vista is a place you look at, not a state the game enters. The
        // walk simply stops for a moment and the camera hands the frame to
        // the landscape. The tune rests with it — a bar of silence with a
        // view — so that the one tap the moment accepts means "walk on"
        // rather than being spent on a note.
        this.closeWalkTune();
        this.fadeLayers();
        this.walking = false;
        this.rig.setMood('vista', 1.8);
        this.holdSec = VISTA_HOLD_SEC;
        break;
      default:
        this.setPhase('encounter');
        break;
    }
  }

  /**
   * Move the whole stage to a phase, or leave it exactly as it was.
   *
   * The phase graph is a star around `walking`, so anything that is not a
   * legal move from here is a legal move from there. Routing through the hub
   * rather than refusing keeps the postcard tool — which poses the game from
   * a standing start — able to ask for any phase it likes.
   *
   * There is one move even that cannot make: `resting` has no successors,
   * because a day ends once and the way to the next one is a new day, not a
   * transition. So the journey is advanced into a *local* value first and
   * the scene only follows if the machine actually agreed. The alternative,
   * which this file did first, tore the camp down and left the journey
   * sitting in `resting` — the scene and the state machine disagreeing about
   * what was happening, which is the exact failure the header's "it owns no
   * rules" is meant to prevent.
   */
  setPhase(phase: Phase): void {
    const previous = this.journey.phase;
    if (previous === phase) return;

    let next = this.journey;
    if (!canEnter(next, phase)) next = enterPhase(next, 'walking');
    next = enterPhase(next, phase);
    if (next.phase !== phase) return;

    // The new state is committed before the old phase is torn down, because
    // tearing a busk down banks the last fraction of a coin into the journey
    // and committing afterwards would throw that write away.
    this.journey = next;
    if (previous === 'busking') this.closeBusk();
    if (previous === 'walking') this.closeWalkTune();
    if (previous === 'resting') this.strikeCamp();
    this.disperse();

    this.rig.setMood(PHASE_TO_MOOD[phase], 1.6);
    this.walking = phase === 'walking';
    this.holdSec = 0;
    this.bard.setPose(
      phase === 'busking' ? 'playing' : phase === 'resting' ? 'sitting' : 'walking',
      0.6,
    );
    this.hud.setMode(phase === 'waking' ? 'walking' : phase);

    if (phase === 'busking') {
      this.startBusk();
      this.gatherListeners();
    }
    if (phase === 'encounter') {
      this.startEncounter();
      this.placeMeeting();
      this.fadeLayers();
    }
    if (phase === 'resting') {
      // A request still open at the fire goes quietly with the day. No
      // journal line: an opportunity that passed unplayed is not an event,
      // and writing it down would make silence read as a verdict.
      this.pendingAsk = null;
      this.makeCamp();
      this.fadeLayers();
    }
    if (phase === 'walking') {
      this.hud.clearSay();
      this.startWalkingTune();
    }
  }

  /** Leave the current stop and start walking again. */
  resume(): void {
    if (this.currentStop) {
      this.journey = {
        ...this.journey,
        visited: [...this.journey.visited, this.currentStop.id],
      };
      this.currentStop = null;
    }
    if (this.journey.phase === 'walking') {
      // A vista never left `walking`, so there is no transition to make —
      // only the pause to lift, the camera to hand back, and the tune to
      // pick up again.
      this.walking = true;
      this.holdSec = 0;
      this.rig.setMood('walking', 1.8);
      this.startWalkingTune();
      return;
    }
    this.setPhase('walking');
  }

  // --- input -------------------------------------------------------------

  /**
   * The one verb.
   *
   * Every tap starts the audio if it has not started, because a browser
   * only hands out an AudioContext inside a gesture and this is the only
   * gesture the game has.
   */
  private tap(): void {
    this.startAudio();
    // A held moment answers first: while the road is holding on a vista or
    // on somebody met there is no tune running, and the tap means "walk on".
    if (this.holdSec > 0) {
      this.resume();
      return;
    }
    if (this.performance) this.playNote();
  }

  private playNote(): void {
    const performance = this.performance;
    if (!performance) return;
    const now = this.tuneNowMs();
    const beat = pickBeat(performance, this.beats, now);
    // A tap between notes is not charged and not answered. There is no
    // penalty for drumming along, and no sound either — a click with no
    // note behind it would teach the player that the tune is somewhere it
    // is not.
    if (!beat) return;

    const judgement = judge(beat, now);
    applyJudgement(performance, judgement, this.judgingConfig(), { beatIndex: beat.index });
    if (judgement === 'miss') {
      this.notes.soften(beat.index);
      return;
    }

    this.notes.strike(beat.index, judgement);
    this.bard.pluck(judgement === 'perfect' ? 1 : 0.75);
    this.sound(beat);
  }

  // --- busking -----------------------------------------------------------

  private startBusk(): void {
    const instrument = this.instrument();
    const biome = biomeAt(this.road, this.journey.s);
    const song = songForPass(this.journey.songChoice, biome, this.busksToday);
    this.busksToday += 1;

    // The instrument bends the clock around the songbook rather than the
    // other way about: the tune is the tune, and a bell plays it slowly.
    this.tuneBpm = BASE_BPM * instrument.tempoFeel;
    this.tuneBeatsPerBar = song.beatsPerBar;

    const passLength = songDurationMs(song, this.tuneBpm);
    const passes = Math.max(
      MIN_BUSK_PASSES,
      Math.min(MAX_BUSK_PASSES, Math.ceil(MIN_BUSK_MS / Math.max(1, passLength))),
    );
    this.beats = [];
    for (let pass = 0; pass < passes; pass++) {
      this.beats.push(
        ...expandSong(song, this.tuneBpm, passLength * pass, song.notes.length * pass),
      );
    }

    this.performance = createPerformance();
    this.tuneMode = 'busk';
    this.walkTune = null;
    this.creditedCoins = 0;
    this.creditedDelight = 0;
    this.tuneSimMs = 0;
    this.tuneAnchorSec = this.ctx ? this.ctx.currentTime + 0.2 : Number.NaN;
    this.buskEndMs = this.beats[this.beats.length - 1].hitTimeMs + lateWindowMs() + BUSK_TAIL_MS;

    this.notes.setInstrument(instrument);
    this.notes.setBeats(this.beats);
    this.notes.setAnchor(this.subject.position, this.subject.heading, this.roadSampler);
    this.notes.setActive(true);
    this.bard.setWarmth(0);

    if (!this.everHinted) {
      this.everHinted = true;
      this.hud.say('Tap as each note reaches the barline. Nothing here can be failed.', 9);
    } else {
      this.hud.say(song.title, 4);
    }
  }

  private updateBusk(dt: number): void {
    const performance = this.performance;
    if (!performance) return;

    const now = this.tuneNowMs();
    const result = tickPerformance(performance, now, this.beats, this.judgingConfig());
    for (const index of result.missed) this.notes.soften(index);

    // The crowd as individuals: sustained low warmth loses the marginal
    // listener, warmth recovered brings them back. The model owns the when;
    // this scene only walks the figures (see `updateListeners`). After a
    // departure the model's `present` is the index of the one now leaving,
    // and after a return it is one past the one coming back.
    if (this.buskCrowd) {
      const drift = tickBuskCrowd(this.buskCrowd, performance.warmth, now);
      if (drift.departed) {
        const slot = this.listenerSlots[this.buskCrowd.present];
        if (slot) slot.away = true;
      }
      if (drift.returned) {
        const slot = this.listenerSlots[this.buskCrowd.present - 1];
        if (slot) slot.away = false;
      }
    }
    this.updateListeners(dt);

    this.bard.setWarmth(performance.warmth);
    this.notes.setAnchor(this.subject.position, this.subject.heading, this.roadSampler);
    this.notes.update(now);

    // Coins are banked a whole coin at a time rather than every frame. The
    // journey's `earn` copies its lists on every call, and sixty copies a
    // second of a growing journal to move a hundredth of a coin is the kind
    // of waste that only shows up on the phone it ruins.
    const owedCoins = Math.floor(performance.coins) - this.creditedCoins;
    const owedDelight = Math.floor(performance.delight) - this.creditedDelight;
    if (owedCoins > 0 || owedDelight > 0) {
      this.journey = earn(this.journey, Math.max(0, owedCoins), Math.max(0, owedDelight));
      this.creditedCoins += Math.max(0, owedCoins);
      this.creditedDelight += Math.max(0, owedDelight);
    }
    this.hud.setCoins(this.journey.coins + (performance.coins - this.creditedCoins));

    if (now > this.buskEndMs) this.finishBusk();
  }

  /** The tune is over. Bank what is left, write the evening down, walk on. */
  private finishBusk(): void {
    const performance = this.performance;
    if (!performance) return;
    const summary = performanceSummary(performance);
    // The crowd's own half-sentence, when it has one: who drifted, who
    // stayed. Read before `resume` tears the busk down and the record with
    // it. Same kindness rules as the summary — see `crowdFarewellLine`.
    const farewell = this.buskCrowd ? crowdFarewellLine(this.buskCrowd) : null;
    const line = farewell ? `${summary.line} ${farewell}` : summary.line;
    this.journey = recordEntry(this.journey, { kind: 'busk', line });
    this.resume();
    this.hud.say(line, 9);
  }

  /**
   * Tear the busk down without judging it.
   *
   * Separate from `finishBusk` on purpose: this runs whenever the phase
   * leaves busking for any reason, including a pose driven by the postcard
   * tool, and it must never write a journal entry for a busk that did not
   * happen.
   */
  private closeBusk(): void {
    const performance = this.performance;
    if (performance) {
      const owed = performance.coins - this.creditedCoins;
      if (owed > 0) this.journey = earn(this.journey, owed, 0);
    }
    this.performance = null;
    this.tuneMode = null;
    this.beats = [];
    this.buskCrowd = null;
    this.listenerSlots.length = 0;
    this.notes.setActive(false);
    this.bard.setWarmth(0);
    // The band plays on. The walk picks the tune straight back up, and the
    // mode flip trims the busk-only layers on the next bar line — fading
    // everything here was what made leaving a busk sound like the game
    // switching off (see audio/mix.ts's bus layout).
  }

  /**
   * The judging contract for whichever tune is in the air. One place, so a
   * tap and a lapsed note can never be charged against different meters.
   */
  private judgingConfig(): PerformanceConfig {
    return this.tuneMode === 'walk' ? WALK_PERFORMANCE_CONFIG : DEFAULT_PERFORMANCE_CONFIG;
  }

  private tuneNowMs(): number {
    if (this.ctx && Number.isFinite(this.tuneAnchorSec)) {
      return (this.ctx.currentTime - this.tuneAnchorSec) * 1000;
    }
    return this.tuneSimMs;
  }

  // --- the walk's tune ----------------------------------------------------

  /**
   * Put the current song's notes in the air over the road (v0.8 item 1).
   *
   * The walk is played, not watched: the same staff, the same generous
   * windows and the same one tap as a busk, running continuously while the
   * bard walks. What differs from a busk is what it is *for* — no coins, no
   * crowd to gather, no end. The meter is the whole readout, and the stride
   * is the meter's (see `update`).
   *
   * The song comes from the player's pinned choice when there is one, and
   * from the biome rotation when they are wandering, one song per stretch of
   * walking. A pinned song repeats for as long as it is pinned, which is the
   * point — repetition is how the letters come off the notes.
   */
  private startWalkingTune(): void {
    // Never stomp a running tune: entering `walking` twice, or from a pose,
    // must not restart the schedule under the notes already flying.
    if (this.performance) return;
    const instrument = this.instrument();
    const biome = biomeAt(this.road, this.journey.s);
    const song = songForPass(this.journey.songChoice, biome, this.walkPasses);
    this.walkPasses += 1;

    this.tuneBpm = BASE_BPM * instrument.tempoFeel;
    this.tuneBeatsPerBar = song.beatsPerBar;
    this.walkTune = newWalkTune(song, this.tuneBpm);
    this.beats = this.walkTune.beats;

    this.performance = createPerformance();
    this.tuneMode = 'walk';
    this.tuneSimMs = 0;
    this.tuneAnchorSec = this.ctx ? this.ctx.currentTime + 0.2 : Number.NaN;

    this.notes.setInstrument(instrument);
    this.notes.setBeats(this.beats);
    this.notes.setAnchor(this.subject.position, this.subject.heading, this.roadSampler);
    this.notes.setActive(true);
    this.bard.setWarmth(0);

    if (this.pendingAsk) {
      // The traveller's request, restated over the notes it is about. It
      // survives interruptions (a vista, a stop) with a fresh window each
      // time, which is the generous reading of "the next few notes".
      this.hud.say(this.pendingAsk.line, 8);
    } else if (!this.everHinted) {
      this.everHinted = true;
      this.hud.say(
        'Tap as each note reaches the barline — the tune is what keeps the walk going. Nothing here can be failed.',
        9,
      );
    }
  }

  /**
   * One frame of the walking tune: keep the endless schedule ahead of the
   * clock, charge lapsed notes to the meter (and to nothing else), and move
   * the staff along the road with the bard.
   */
  private updateWalkTune(): void {
    const performance = this.performance;
    const tune = this.walkTune;
    if (!performance || !tune) return;

    const now = this.tuneNowMs();
    // In place, so the judge and the staff keep reading the same array.
    extendWalkTune(tune, now);

    const result = tickPerformance(performance, now, this.beats, this.judgingConfig());
    for (const index of result.missed) this.notes.soften(index);

    // A traveller's request rides the walk's first notes. It settles early
    // the moment enough have landed — a request granted should not wait for
    // the window to close — and otherwise when the window has been used up.
    // The walk's performance is fresh each stretch, so the counts *are* the
    // window.
    if (this.pendingAsk) {
      const done =
        performance.hits >= this.pendingAsk.needed ||
        performance.hits + performance.misses >= this.pendingAsk.notes;
      if (done) this.settleAsk(performance.hits);
    }

    this.bard.setWarmth(performance.warmth);
    this.notes.setAnchor(this.subject.position, this.subject.heading, this.roadSampler);
    this.notes.update(now);
  }

  /**
   * Settle a traveller's request, either way.
   *
   * The two outcomes differ only in what is added: a granted request pays
   * and a passed one does not, and both write one true, kind line. Nothing
   * is subtracted anywhere — that is DESIGN.md item 8's whole contract, and
   * `resolveAsk` (which owns the judgement) is tested to keep it.
   */
  private settleAsk(hits: number): void {
    const ask = this.pendingAsk;
    if (!ask) return;
    this.pendingAsk = null;
    const outcome = resolveAsk(ask, hits);
    if (outcome.coins > 0 || outcome.delight > 0) {
      this.journey = earn(this.journey, outcome.coins, outcome.delight);
      this.hud.setCoins(this.journey.coins);
    }
    this.journey = recordEntry(this.journey, { kind: 'encounter', line: outcome.line });
    this.hud.say(outcome.line, 8);
    saveJourney(this.journey, true);
  }

  /**
   * Take the walk's notes out of the air, without judging anything.
   *
   * Runs whenever the walk hands the frame to something else — a busk, an
   * encounter, a vista, the camp. Nothing is banked because the walk banks
   * nothing: its tune pays in stride, and the stride has already happened.
   */
  private closeWalkTune(): void {
    if (this.tuneMode !== 'walk') return;
    this.performance = null;
    this.tuneMode = null;
    this.walkTune = null;
    this.beats = [];
    this.halted = false;
    this.pace = 1;
    this.notes.setActive(false);
    this.bard.setWarmth(0);
    // Deliberately no `fadeLayers()` here: a pin-swap or an arriving busk
    // closes this tune and raises another within a frame, and the band
    // should carry across that seam. The moments that really are tune-less
    // — a vista, somebody met, the camp — fade the band at their own call
    // sites, where the decision reads as what it is.
  }

  // --- the people on the road ---------------------------------------------

  /**
   * Stand somebody on the ground near the bard.
   *
   * `bearing` is measured from the bard's own forward direction and `radius`
   * in metres, so a caller describes an arrangement the way you would
   * describe it out loud — "one at four metres, half a turn to the left" —
   * rather than in world coordinates that stop meaning anything the moment
   * the road bends.
   */
  private stand(person: Traveller, bearing: number, radius: number, attention: number): void {
    const angle = this.subject.heading + bearing;
    const x = this.subject.position.x + Math.sin(angle) * radius;
    const z = this.subject.position.z + Math.cos(angle) * radius;
    // The drawn surface, not the landform: a listener who stops in a wheel
    // rut stands in it rather than on the flat road that used to be there.
    person.group.position.set(x, roadSurfaceHeight(this.road, x, z), z);
    // Facing back down their own bearing, which is the bard.
    person.setHeading(angle + Math.PI);
    person.setAttention(attention);
    person.group.visible = true;
    this.shown.push(person);
  }

  /** Everybody goes on their way. Called on every phase change. */
  private disperse(): void {
    for (const person of this.shown) person.group.visible = false;
    this.shown.length = 0;
  }

  /**
   * Who stopped to listen.
   *
   * Placed in a loose arc in front of the bard rather than a ring around
   * him: the busking camera sits behind and to his right, so anyone directly
   * behind would be a shoulder in the lens and anyone directly ahead would
   * stand in the staff. The bearings below keep the road's centreline — where
   * the notation runs — clear, and they are deliberately uneven, because
   * evenly-spaced listeners read as a chorus line.
   *
   * The arrangement is seeded from the stop, so the same square draws the
   * same crowd for every player on the same day. That matters more than it
   * sounds: the road is shared, and a crowd that differed between two people
   * standing in the same place would be the one thing in the day that did.
   */
  private gatherListeners(): void {
    const rand = mulberry32(
      subSeed(this.currentStop ? this.currentStop.seed : this.road.seed, 'busk/listeners'),
    );
    const order = this.people.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const count = 2 + Math.floor(rand() * 3);
    // Left of the road first: that is the side of the frame the camera's own
    // offset leaves empty, and filling it is what turns a busk from a figure
    // in a field into a scene.
    const slots = [-0.62, 0.72, -1.15, 1.25];
    this.listenerSlots.length = 0;
    for (let i = 0; i < count; i++) {
      const bearing = slots[i] + randRange(rand, -0.14, 0.14);
      const radius = randRange(rand, 3.2, 5.0);
      this.stand(this.people[order[i]], bearing, radius, 1);
      // Recorded in gather order, which is also the crowd model's order of
      // faithfulness: the widest, latest slot is the first to drift.
      this.listenerSlots.push({
        person: this.people[order[i]],
        angle: this.subject.heading + bearing,
        radius,
        shownRadius: radius,
        away: false,
      });
    }
    this.buskCrowd = createBuskCrowd(count);
  }

  /**
   * Walk the listeners to wherever the crowd model says they should be.
   *
   * A departing listener turns and strolls off up their own bearing at an
   * unhurried pace — somewhere to be, not offence taken — and disappears a
   * few metres out; a returning one strolls back in and turns to listen.
   * Nothing here flashes, hurries, or reddens: the whole consequence is a
   * person quietly deciding, which is the honest size of it.
   */
  private updateListeners(dt: number): void {
    /** How far out a leaver walks before they are simply gone. */
    const DRIFT_OUT_M = 7;
    /** A stroll. The bard can watch them go and win them back. */
    const DRIFT_SPEED = 1.1;
    for (const slot of this.listenerSlots) {
      const target = slot.away ? slot.radius + DRIFT_OUT_M : slot.radius;
      const gap = target - slot.shownRadius;
      if (gap !== 0) {
        const step = Math.min(Math.abs(gap), DRIFT_SPEED * dt);
        slot.shownRadius += Math.sign(gap) * step;
      }
      const gone = slot.away && slot.shownRadius >= slot.radius + DRIFT_OUT_M - 0.05;
      slot.person.group.visible = !gone;
      if (gone) continue;
      const x = this.subject.position.x + Math.sin(slot.angle) * slot.shownRadius;
      const z = this.subject.position.z + Math.cos(slot.angle) * slot.shownRadius;
      slot.person.group.position.set(x, roadSurfaceHeight(this.road, x, z), z);
      // Leaving, they face out along their own bearing; listening (or on
      // the way back), they face the bard, which is back down it.
      slot.person.setHeading(slot.away ? slot.angle : slot.angle + Math.PI);
      slot.person.setAttention(slot.away ? 0 : 1);
    }
  }

  /**
   * Somebody met at a crossroads.
   *
   * One figure, standing a little further up the road than the bard has got
   * to and turned back toward him, so the frame reads as two people who have
   * just stopped walking rather than as a person and a bystander.
   */
  private placeMeeting(): void {
    const rand = mulberry32(
      subSeed(this.currentStop ? this.currentStop.seed : this.road.seed, 'meeting'),
    );
    const person = this.people[Math.floor(rand() * this.people.length)];
    // Well out to the bard's left. The encounter camera sits behind him and
    // off to the *right*, so a figure only a fifth of a radian off the road's
    // centreline stands directly behind his hat and is not in the picture at
    // all — which was the first tuning, and it wasted the whole point of
    // putting somebody there. Two metres of clear air is the minimum.
    // Widened after a frame showed the traveller's shoulder touching the
    // bard's. The bands were independent, so the unlucky corner — the
    // shallowest angle at the nearest distance — left only about 1.78 m of
    // lateral clearance, and because the camera is behind and to the right, a
    // figure ahead-and-left at that clearance projects almost onto him. Both
    // ends move rather than one: pushing the distance alone would have put
    // the shallow-angle case further away without separating it.
    this.stand(person, randRange(rand, -0.95, -0.7), randRange(rand, 4.2, 5.2), 1);
  }

  // --- meetings and camp -------------------------------------------------

  private startEncounter(): void {
    const stop = this.currentStop;
    const roll = rollEncounter(
      stop ? stop.seed : this.road.seed,
      biomeAt(this.road, this.journey.s),
      this.journey.dayFraction,
      { exclude: this.metToday },
    );
    this.metToday.push(roll.def.id);
    this.journey = earn(this.journey, roll.coins, roll.delight);
    this.journey = recordEntry(this.journey, { kind: 'encounter', line: roll.def.line });
    this.hud.setCoins(this.journey.coins);
    this.hud.say(roll.gift ? `${roll.def.line} ${roll.gift}` : roll.def.line, ENCOUNTER_HOLD_SEC + 2);
    this.holdSec = ENCOUNTER_HOLD_SEC;
    // Some travellers want something (v0.8 item 8). The request shows when
    // the walk resumes and its tune is in the air — see `startWalkingTune`
    // — and settles against that tune's first notes in `updateWalkTune`.
    this.pendingAsk = rollAsk(stop ? stop.seed : this.road.seed, roll.def);
  }

  private makeCamp(): void {
    if (this.campfire) return;
    const stop = this.road.stops[this.road.stops.length - 1];
    const at = sampleRoad(this.road, stop ? stop.s : this.journey.s);
    const anchor = new Vector3(at.x, at.y, at.s);
    const palette = BIOME_PALETTES[biomeAt(this.road, at.s)] ?? DEFAULT_PALETTE;

    this.campfire = new Campfire(this.app.globals, stop ? stop.seed : this.road.seed, {
      heading: at.heading,
      palette,
      particleDensity: this.app.quality.particleDensity,
      // The camp is laid out in its own frame around the anchor, so the
      // ground query has to be translated into world space to match.
      groundHeightAt: (x, z) => terrainHeight(this.road, anchor.x + x, anchor.z + z) - anchor.y,
      burn: 1,
    });
    this.campfire.group.position.copy(anchor);
    this.scene.add(this.campfire.group);
    // Clear the scrub off the camp. Centred on the *fire*, not the anchor —
    // the layout's extent is measured from the fire and the fire sits six
    // metres or so off the road point this group is placed at. The margin
    // past that extent is what stops a shrub standing just outside the ring
    // and still landing between the resting camera and the flame.
    const { fire, extent } = this.campfire.layout;
    this.world.addClearing(anchor.x + fire.x, anchor.z + fire.z, extent + 1.2);
    this.syncSubject();

    // What the day turned up is named here, and only here.
    //
    // The alternative was to announce an instrument the moment its threshold
    // was crossed, and that moment is always a bad one: thresholds are
    // lifetime totals, so they are crossed mid-tune, mid-hill, or three
    // seconds after a stranger has finished talking. The fire is the one
    // place in the day the game already stops and accounts for itself, and a
    // thing you found is exactly what belongs in that accounting.
    const found = this.noteUnlocks();
    for (const instrument of found) {
      this.journey = recordEntry(this.journey, {
        kind: 'unlock',
        line: `${instrument.name}. ${instrument.character}`,
      });
    }
    if (found.length > 0) this.refreshCase();

    const coins = Math.floor(this.journey.coins);
    // The empty-purse line used to read "Nothing in the case tonight", which
    // was fine until the case could also gain an instrument: "nothing in the
    // case tonight, and a Reed Flute travels with you" is a sentence
    // disagreeing with itself. Naming the coins instead costs nothing and
    // makes both halves true at once.
    const camp =
      coins > 0
        ? `Camp, and ${coins} coins in the case.`
        : 'Camp, and not a coin earned today, which the fire does not mind.';
    const tail =
      found.length > 0 ? describeFound(found) : 'The road will still be there in the morning.';
    this.hud.say(`${camp} ${tail}`, 14);
  }

  /**
   * Which instruments the player has earned but has not been told about.
   *
   * `unlockedInstruments()` derives the answer from lifetime totals every
   * time it is asked, so an earned instrument is *playable* the instant the
   * total crosses; `journey.unlockedInstruments` is the separate, narrower
   * question of which ones have been named to the player, and it is the list
   * `chooseInstrument` will let them pick from. Keeping them apart is what
   * lets the campfire be the moment of finding rather than a report of
   * something that already quietly happened.
   *
   * Appending is this file's job rather than the journey's, because the
   * journey deliberately does not import the instrument catalogue — see its
   * header. It is idempotent, so a camp entered twice names nothing twice.
   *
   * A save made before any of this existed has only the lute in its list and
   * may have thousands of lifetime metres behind it. Such a player is told
   * about several instruments at one fire, which is a slightly crowded line
   * and the honest one: they did earn them all.
   */
  private noteUnlocks(): Instrument[] {
    const found = unlockedInstruments(this.journey).filter(
      (instrument) => !this.journey.unlockedInstruments.includes(instrument.id),
    );
    for (const instrument of found) {
      this.journey = unlockInstrument(this.journey, instrument.id);
    }
    return found;
  }

  /** Hand the HUD the contents of the case, and which one is in hand. */
  private refreshCase(): void {
    this.hud.setCase(
      this.journey.unlockedInstruments
        .filter(isInstrumentId)
        .map((id) => ({ id, name: instrumentById(id).name })),
      this.journey.instrumentId,
    );
  }

  /**
   * Take an instrument out of the case.
   *
   * Refused during a busk, and refused twice over: the HUD stops taking taps
   * on the corner in that mode as well. `tempoFeel` is baked into every beat
   * time when the busk is built, so swapping voices mid-tune would leave the
   * staff flying at one tempo and the music sounding at another for the rest
   * of the pass — which is the one kind of wrongness a game about reading
   * notation cannot afford.
   *
   * The save is forced rather than throttled. This is a deliberate choice the
   * player made about their own bard, and it is the sort of thing that must
   * survive the tab being closed a second later.
   */
  private takeOut(id: string): void {
    // Only a busk locks the case (see the doc above). The walk's own tune is
    // restarted below instead: unlike a busk it has no crowd, no takings and
    // no end to protect, so the kind answer to "new instrument, new tempo"
    // is a fresh schedule rather than a refusal.
    if (this.tuneMode === 'busk') return;
    const before = this.journey.instrumentId;
    this.journey = chooseInstrument(this.journey, id);
    if (this.journey.instrumentId === before) return;

    const instrument = this.instrument();
    this.bard.setInstrument(instrument);
    this.notes.setInstrument(instrument);
    this.hud.setInstrument(instrument.name);
    this.refreshCase();
    saveJourney(this.journey, true);
    if (this.tuneMode === 'walk') {
      this.closeWalkTune();
      this.startWalkingTune();
    }
  }

  /**
   * Pin one song for the road to play, or hand the rotation back (v0.8
   * item 3 — the songbook choice, made diegetic). Refused mid-busk for the
   * same reason the case is: the tune in the air is the tune being judged.
   * The walking tune restarts at once on the new song, because a choice
   * that only takes effect at the next stop reads as a broken button.
   */
  private pinSong(id: string | null): void {
    if (this.tuneMode === 'busk') return;
    const before = this.journey.songChoice;
    this.journey = chooseSong(this.journey, id);
    if (this.journey.songChoice === before) return;

    this.refreshSongbook();
    saveJourney(this.journey, true);
    if (this.tuneMode === 'walk') {
      this.closeWalkTune();
      this.startWalkingTune();
    }
  }

  /** Hand the HUD the songbook and which tune is pinned. */
  private refreshSongbook(): void {
    this.hud.setSongbook(
      SONGS.map((song) => ({ id: song.id, name: song.title })),
      this.journey.songChoice,
    );
  }

  private strikeCamp(): void {
    if (!this.campfire) return;
    this.scene.remove(this.campfire.group);
    this.campfire.dispose();
    this.campfire = null;
    this.world.clearClearings();
  }

  // --- idle --------------------------------------------------------------

  /**
   * What the case caught while nobody was here.
   *
   * Collected once, at boot, and the open-case record is cleared the moment
   * it pays out so a crash between here and the next save cannot pay twice.
   */
  private collectIdle(): void {
    const yielded = idleYield(loadIdle(), Date.now());
    saveIdle(null);
    if (yielded.coins <= 0 && yielded.delight <= 0) return;
    this.journey = earn(this.journey, yielded.coins, yielded.delight);
    const line = describeIdleYield(yielded);
    this.journey = recordEntry(this.journey, { kind: 'idle', line });
    this.hud.setCoins(this.journey.coins);
    this.hud.say(line, 11);
  }

  private persist(): void {
    saveJourney(this.journey, true);
    saveIdle({
      since: Date.now(),
      instrumentId: this.journey.instrumentId,
      // The busk's crowd, when there is one. The walk's tune also carries a
      // warmth, but it has no crowd, and letting it stand in here would
      // quietly halve the idle yield of anyone who closed the tab mid-road.
      quality: this.tuneMode === 'busk' && this.performance ? this.performance.peakWarmth : 0.5,
    });
  }

  // --- particles ---------------------------------------------------------

  private buildFields(density: number): void {
    const budget = (n: number) => Math.max(6, Math.round(n * density));
    const palette = DEFAULT_PALETTE;
    const add = (id: string, field: ParticleField) => {
      field.setOpacity(0);
      this.scene.add(field.mesh);
      this.fields.push({ id, field, opacity: 0 });
    };
    add('fluff', new ParticleField(seedFluff(budget(90)), this.road.seed));
    add(
      'leaf',
      new ParticleField(
        fallingLeaves(budget(70), palette.canopy, palette.accentAlt),
        this.road.seed + 3,
      ),
    );
    add('dust', new ParticleField(sunDust(budget(120)), this.road.seed + 7));
    add('firefly', new ParticleField(fireflies(budget(80)), this.road.seed + 11));
  }

  /**
   * Which motes belong here, now.
   *
   * Keyed to biome and to the light rather than switched on by a flag: seed
   * fluff over open pasture in the middle of the day, leaves under the
   * forest canopy, dust where the sun rakes low, and fireflies only once it
   * is properly late. Targets are crossfaded over a couple of seconds so
   * walking out of a wood does not switch the air off.
   */
  private updateFields(dt: number): void {
    const biome = biomeAt(this.road, this.journey.s);
    const shape = dayShape(this.shownDayFraction);
    const targets: Record<string, number> = {
      fluff: biome === 'village' ? shape.daylight * 0.85 : 0,
      leaf: biome === 'forest' ? 0.75 : 0,
      dust: shape.twilight * 0.8,
      // Dusk, and not a moment before. A firefly at noon is a bug in both
      // senses; the ramp starts after the light has properly gone amber.
      firefly: smoothstep(0.8, 0.88, this.shownDayFraction),
    };

    const wind = this.app.globals.uWindDirection.value;
    const strength = this.app.globals.uWindStrength.value;
    const time = this.app.globals.uTime.value;
    const blend = Math.min(1, dt * 0.5);

    for (const entry of this.fields) {
      const target = targets[entry.id] ?? 0;
      entry.opacity += (target - entry.opacity) * blend;
      entry.field.setOpacity(entry.opacity);
      if (entry.opacity > 0.001) {
        entry.field.update(this.subject.position, time, wind, strength);
      }
    }
  }

  // --- audio -------------------------------------------------------------

  /**
   * Bring the audio up, inside a gesture.
   *
   * Every browser refuses an AudioContext outside one, and a game that
   * discovers this by throwing on frame one is a game that is silent for
   * the whole session. So this is called from the tap handler, is safe to
   * call on every tap, and gives up quietly and permanently if the browser
   * says no — the walk is still worth taking without sound.
   */
  private startAudio(): void {
    if (this.audioFailed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      // The music and the outdoors are separate buses on purpose: the whole
      // "the walk sounds like white noise" failure was ambience sharing a
      // level with a music bed that was not there. `ambienceBusGain` is the
      // enforced ceiling (never more than half the music bus) and the only
      // legal way to set the ambience level — see audio/mix.ts.
      const musicBus = ctx.createGain();
      musicBus.gain.value = musicBusGain();
      musicBus.connect(master);
      this.musicBus = musicBus;
      this.ambience = new Ambience(ctx, master, {
        seed: this.road.seed,
        masterGain: ambienceBusGain(this.mixInput()),
      });
      this.buildLayers(ctx, musicBus);
      if (this.performance) {
        // A busk already running keeps its clock: the anchor is set so that
        // the audio clock agrees with the simulation clock the notes have
        // been flying on, rather than restarting the tune.
        this.tuneAnchorSec = ctx.currentTime - this.tuneSimMs / 1000;
      }
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    } catch {
      this.audioFailed = true;
      this.ctx = null;
      this.master = null;
    }
  }

  /**
   * The backing band, as five held voices.
   *
   * `audio/adaptive.ts` decides *membership* — who has joined in and when —
   * and hands back bar-aligned ramps. All this has to provide is something
   * for those ramps to move: one filtered pair of detuned oscillators per
   * layer, running continuously at zero gain. Continuous rather than started
   * and stopped per phrase because starting an oscillator is a
   * discontinuity, and a crowd joining in should not click.
   */
  private buildLayers(ctx: AudioContext, destination: AudioNode): void {
    for (const id of Object.keys(LAYER_WAVEFORMS) as AdaptiveLayerId[]) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Dark. These sit under a melody and under the outdoors; anything
      // with top end on it stops being a backing and starts being a synth.
      filter.frequency.value = id === 'shimmer' ? 3200 : 1400;
      filter.Q.value = 0.6;
      filter.connect(gain).connect(destination);

      const oscillators: OscillatorNode[] = [];
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = LAYER_WAVEFORMS[id];
        osc.frequency.value = 110;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start();
        oscillators.push(osc);
      }
      this.layers.set(id, { gain, oscillators, filter });
    }
  }

  /**
   * The one description of the moment the whole mix keys off — mode, drive,
   * scene. `adaptiveDrive` picks the mode's own signal (crowd warmth in the
   * square, song meter on the road) so no second file re-invents the ternary.
   */
  private mixInput(): MixInput {
    const mode: AdaptiveMode = this.journey.phase === 'busking' ? 'busking' : 'walking';
    return {
      mode,
      drive: adaptiveDrive({
        mode,
        warmth: this.performance?.warmth ?? 0,
        meter: this.performance?.meter ?? 0,
      }),
      instrument: this.instrument(),
      dayFraction: this.shownDayFraction,
      biomeId: biomeAt(this.road, this.journey.s),
      weather: this.app.globals.uWindStrength.value > 0.95 ? 'breezy' : 'clear',
    };
  }

  private updateAudio(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const mix = this.mixInput();
    this.ambience?.setScene({
      biomeId: mix.biomeId,
      dayFraction: mix.dayFraction,
      weather: mix.weather,
    });
    this.ambience?.update(ctx.currentTime);
    // Ducked, not fixed: as the arrangement fills, the outdoors steps back;
    // when the bard stops playing, the outdoors comes up. Safe every frame —
    // setMasterGain no-ops on sub-1e-4 changes.
    this.ambience?.setMasterGain(ambienceBusGain(mix));

    // The arrangement runs in every phase — gating it on a live performance
    // was exactly the "walk is silent" bug. The only real requirement is a
    // bar grid for layers to enter on.
    const barSec = (beatIntervalMs(this.tuneBpm) * this.tuneBeatsPerBar) / 1000;
    if (!Number.isFinite(this.tuneAnchorSec) || !(barSec > 0)) return;

    const update = updateAdaptive(this.adaptive, {
      mode: mix.mode,
      meter: this.performance?.meter ?? 0,
      warmth: this.performance?.warmth ?? 0,
      biomeId: mix.biomeId,
      instrument: mix.instrument,
      dayFraction: mix.dayFraction,
      nowSec: ctx.currentTime,
      barSec,
      barAnchorSec: this.tuneAnchorSec,
    });
    this.adaptive = update.state;

    for (const command of update.changes) {
      const voice = this.layers.get(command.id);
      if (!voice) continue;
      const at = Math.max(command.startAtSec, ctx.currentTime);
      const hz = semitoneToFrequency(AUDIO_MANIFEST.rootFrequencyHz, command.semitoneOffset);
      for (const osc of voice.oscillators) {
        osc.frequency.cancelScheduledValues(at);
        osc.frequency.setValueAtTime(osc.frequency.value, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, hz), at + command.rampSec);
      }
      voice.gain.gain.cancelScheduledValues(at);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
      voice.gain.gain.linearRampToValueAtTime(command.targetGain, at + command.rampSec);
    }
  }

  /** One played note, at the pitch the staff is showing. */
  private sound(beat: SongBeat): void {
    const ctx = this.ctx;
    const destination = this.musicBus ?? this.master;
    if (!ctx || !destination || beat.rest) return;
    const instrument = this.instrument();
    const holdSec = (beat.beats * beatIntervalMs(this.tuneBpm)) / 1000;
    const mix = this.mixInput();
    try {
      playVoiceNote(
        ctx,
        destination,
        instrument.voice,
        semitoneToFrequency(AUDIO_MANIFEST.rootFrequencyHz, beat.semitone),
        // A hair ahead of now: a note asked to sound in the past is a note
        // some browsers drop outright.
        ctx.currentTime + 0.005,
        // `melodyGain` is what makes a stopped bard noodle quietly in place:
        // 0.10 at an empty meter, 0.22 in full stride, smoothstepped so a
        // jittering meter does not tremolo the tune.
        { holdSec, gain: melodyGain(mix.mode, mix.drive) },
      );
    } catch {
      // A voice that will not build is one silent note, not a broken busk.
    }
  }

  /** Send the whole backing away over a few seconds. Never a cut. */
  private fadeLayers(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const voice of this.layers.values()) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 3);
    }
    this.adaptive = initialAdaptiveState(now);
  }

  // --- frame -------------------------------------------------------------

  render(_alpha: number, frameDt: number): void {
    const state = skyStateAt(this.shownDayFraction);
    applyTimeOfDay(this.app.globals, state, this.app.sun);
    this.sky.apply(state, this.app.globals.uTime.value);
    // The journal card takes its wash from the sky it is floating in. It is
    // the only piece of DOM in the game that overlaps the world, and a fixed
    // neutral behind it was the one grey in a game that does not use grey.
    this.hud.setTone(state.horizon.r, state.horizon.g, state.horizon.b);

    // Wind gusts on a slow cycle, shared by grass, trees and the cloak.
    const t = this.app.globals.uTime.value;
    this.app.globals.uWindStrength.value =
      0.7 + Math.sin(t * 0.11) * 0.25 + Math.sin(t * 0.037 + 2.1) * 0.18;

    this.rig.update(this.subject, frameDt, (x, z) => terrainHeight(this.road, x, z));
    this.app.aimSunAt(this.subject.position);
    this.sky.mesh.position.copy(this.rig.camera.position);
  }

  resize(width: number, height: number): void {
    this.rig.applyAspect(width, height);
    this.hud.resize();
  }

  /** Where the road is, `ahead` metres in front of the bard. */
  private readonly roadSampler = (ahead: number, out: Vector3): void => {
    sampleRoad(this.road, this.journey.s + ahead, this.sample);
    out.set(this.sample.x, this.sample.y, this.sample.s);
  };

  // --- debug / tooling handles ------------------------------------------

  /**
   * Pose the game for a screenshot. Used by `tools/postcard.mjs`, which
   * cannot play the game and therefore needs it to hold still somewhere
   * specific. Kept deliberately small and side-effect-light: it moves the
   * bard and the clock and nothing else, so a posed frame is the same
   * frame a player would see standing there.
   */
  pose(options: { s?: number; dayFraction?: number; phase?: Phase | 'vista'; mood?: CameraMood }): void {
    if (options.s !== undefined) {
      this.journey = { ...this.journey, s: Math.max(0, Math.min(this.road.lengthM, options.s)) };
      this.world.update(this.journey.s);
      this.syncSubject();
      this.rig.reset();
    }
    if (options.dayFraction !== undefined) {
      this.journey = { ...this.journey, dayFraction: options.dayFraction };
      this.shownDayFraction = options.dayFraction;
    }
    // 'vista' is a camera framing, not a journey phase — a vista is a place
    // you walk past and look at, not a state the game enters. Accepting it
    // here anyway, and translating it, is worth the two lines: it is the
    // obvious thing for a caller to ask for and silently crashing on
    // `FRAMINGS[undefined]` is a poor way to explain the distinction.
    if (options.phase === 'vista') {
      this.setPhase('walking');
      // A posed vista matches a real one: the tune rests while the camera
      // hands the frame to the landscape (see `arriveAt`).
      this.closeWalkTune();
      this.fadeLayers();
      this.walking = false;
      this.rig.setMood('vista', 0);
    } else if (options.phase !== undefined) {
      this.setPhase(options.phase);
    }
    if (options.mood !== undefined) this.rig.setMood(options.mood, 0);
    // A posed busk has to have notes in the air by the time the shutter
    // opens, and the tool only waits a couple of seconds. Winding the busk
    // clock to the second bar puts a full staff of notes on screen without
    // touching anything a player would experience differently.
    if (options.phase === 'busking' && this.performance) {
      this.tuneSimMs = beatIntervalMs(this.tuneBpm) * 3;
      if (this.ctx) this.tuneAnchorSec = this.ctx.currentTime - this.tuneSimMs / 1000;
      this.notes.update(this.tuneNowMs());
    }
    // Land the pose and the framing, rather than starting them easing.
    //
    // Everything above sets a *transition* going: `setPhase` blends the
    // bard's pose over 0.6 s and the rig's mood over 1.6 s. A player never
    // notices, because a player's browser runs sixty of those steps a
    // second. The screenshot harness does not: `App` caps a frame's
    // simulation at `MAX_CATCHUP_MS` (250 ms) and SwiftShader takes roughly
    // 600 ms to draw one of these frames, so the whole 1800 ms the tool
    // waits buys about three sim steps — 0.75 s. Measured on the campfire
    // shot, the bard's pose blend came back 0.417 on one run and 1.0 on the
    // next, off the same build. Every postcard of the seated bard has been
    // a coin toss between the pose and a crouch half-way out of a walk, and
    // that is what four rounds of critique described as a hunched red mass
    // with a lute floating off his shoulder. See `Bard.settlePose`.
    //
    // Note the `reset` moved down here from the `s` branch, where it ran
    // *before* `setPhase` started the mood transition and so was undone by
    // it. That is why a posed 'resting' frame was shot from a camera still
    // most of the way back at the walking framing, and it means any earlier
    // sweep of a `resting` framing constant was measured through the wrong
    // lens as well as at the wrong pose.
    this.bard.settlePose();
    this.rig.reset();
  }

  /** What the world looks like here, for the debug overlay. */
  describe(): string {
    return `${this.road.dayKey} · ${Math.round(this.journey.s)}/${Math.round(this.road.lengthM)} m · ${biomeAt(this.road, this.journey.s)} · ${skyStateAt(this.shownDayFraction).label}`;
  }

  dispose(): void {
    this.persist();
    this.app.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pagehide', this.onPageHide);
    this.hud.dispose();
    this.notes.dispose();
    for (const entry of this.fields) {
      this.scene.remove(entry.field.mesh);
      entry.field.dispose();
    }
    this.strikeCamp();
    this.ambience?.dispose();
    for (const voice of this.layers.values()) {
      for (const osc of voice.oscillators) {
        try {
          osc.stop();
        } catch {
          // Already stopped; there is nothing left to silence.
        }
        osc.disconnect();
      }
      voice.filter.disconnect();
      voice.gain.disconnect();
    }
    this.layers.clear();
    void this.ctx?.close().catch(() => undefined);
    this.world.dispose();
    this.bard.dispose();
    for (const person of this.people) person.dispose();
    this.people.length = 0;
    this.shown.length = 0;
    this.sky.dispose();
  }
}

/**
 * The half-sentence the campfire adds when the day turned something up.
 *
 * One line, no fanfare, and phrased so it can be read as a fact about the
 * evening rather than as an award: the instrument is simply travelling with
 * you now. It deliberately does not quote the instrument's `character` — that
 * belongs in the journal entry, where a player who wants to know what a
 * hurdy-gurdy is like can find it, and not in a card the player is reading
 * while looking at a fire.
 *
 * The article is computed rather than written into the names because the six
 * shipped instruments all begin with a consonant and the seventh might not,
 * and "a Ocarina" is the sort of seam that makes a hand-written line stop
 * reading as one.
 */
function describeFound(found: Instrument[]): string {
  const names = found.map((instrument) => `${article(instrument.name)} ${instrument.name}`);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const subject = list.charAt(0).toUpperCase() + list.slice(1);
  return names.length === 1
    ? `${subject} travels with you from tonight. Take it out whenever you like.`
    : `${subject} travel with you from tonight. Take them out whenever you like.`;
}

function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
