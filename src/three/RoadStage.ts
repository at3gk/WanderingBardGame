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
 * The walk itself is auto-forward. That is a design decision, not a
 * shortcut: this is a game about looking at things while music plays, and
 * asking a player to hold a key to keep walking taxes exactly the attention
 * the scenery is asking for. The player's input goes into the *music*.
 */

import { Group, Scene, Vector3 } from 'three';
import type { App, Stage } from './App';
import { CameraRig, type CameraMood } from './CameraRig';
import { Sky, applyTimeOfDay, skyStateAt } from './sky';
import { WorldStreamer } from './world/WorldStreamer';
import { Bard } from './actors/Bard';
import { dailySeed, dayKey } from '../core/rng';
import {
  biomeAt,
  generateRoad,
  nextStop,
  sampleRoad,
  terrainHeight,
  type DailyRoad,
  type RoadStop,
} from '../core/road';
import {
  advance,
  createJourney,
  enterPhase,
  loadJourney,
  saveJourney,
  type JourneyState,
  type Phase,
} from '../core/journey';
import { instrumentById, unlockedInstruments } from '../core/instruments';

/** Metres per second at a comfortable walk. */
const WALK_SPEED = 2.2;
/** How close to a stop counts as arriving. */
const ARRIVE_RADIUS = 4;

const PHASE_TO_MOOD: Record<Phase, CameraMood> = {
  waking: 'walking',
  walking: 'walking',
  busking: 'busking',
  encounter: 'encounter',
  resting: 'resting',
};

export interface RoadStageOptions {
  /** Override the day, for the postcard tool and for tests. */
  dayKeyOverride?: string;
  seedOverride?: number;
}

export class RoadStage implements Stage {
  readonly scene = new Scene();
  readonly road: DailyRoad;

  private readonly app: App;
  private readonly rig: CameraRig;
  private readonly sky = new Sky();
  private readonly world: WorldStreamer;
  private readonly bard: Bard;
  private readonly actors = new Group();

  private journey: JourneyState;
  /**
   * The time of day the sky is *currently* showing. Damped toward the
   * journey's dayFraction so that warping the player along the road (the
   * postcard tool, or an idle catch-up) does not strobe the sky.
   */
  private shownDayFraction: number;
  private walking = true;
  private saveTimer = 0;

  /** The stop the bard is currently stood at, if any. */
  private currentStop: RoadStop | null = null;

  private readonly subject = { position: new Vector3(), heading: 0 };

  constructor(app: App, options: RoadStageOptions = {}) {
    this.app = app;

    const key = options.dayKeyOverride ?? dayKey();
    const seed = options.seedOverride ?? dailySeed();
    this.road = generateRoad(seed, key);

    this.journey = loadJourney(key) ?? createJourney(key, this.road.lengthM);
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

    const instrument = unlockedInstruments(this.journey).some(
      (i) => i.id === this.journey.instrumentId,
    )
      ? instrumentById(this.journey.instrumentId)
      : null;
    this.bard.setInstrument(instrument);
    this.bard.setPose('walking', 0);

    this.rig = new CameraRig();
    this.rig.setMood(PHASE_TO_MOOD[this.journey.phase], 0);

    // Fog is pushed out past the terrain ribbon's own reach on high tier
    // and pulled in on low, which is both a performance lever and — since
    // the fog colour is the sky's — a legitimate mood one.
    // Aerial perspective, not weather. The first tuning had fog starting a
    // quarter of the way to the horizon and reaching full strength at it,
    // which flattened every distant hill into the sky and took all the
    // depth cues with it. It starts well out now and never fully closes.
    app.globals.uFogNear.value = app.quality.viewDistance * 0.55;
    app.globals.uFogFar.value = app.quality.viewDistance * 2.4;

    this.world.update(this.journey.s);
    this.syncSubject();
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

  private syncSubject(): void {
    const sample = sampleRoad(this.road, this.journey.s);
    // The road's `s` is its world Z by construction (see WorldStreamer).
    this.subject.position.set(sample.x, sample.y, sample.s);
    this.subject.heading = sample.heading;
    this.bard.group.position.copy(this.subject.position);
    this.bard.setHeading(sample.heading);
  }

  update(dt: number): void {
    const before = this.journey.s;

    if (this.walking && this.journey.phase === 'walking') {
      this.journey = advance(this.journey, WALK_SPEED * dt, this.road.lengthM);
      this.checkArrivals();
    }

    const travelled = this.journey.s - before;
    this.syncSubject();
    this.bard.update(dt, travelled);

    // The sky follows the journey's day fraction, damped. The damping
    // constant is long on purpose: the light should change at the pace of
    // an afternoon, and a player who notices the sun moving is watching the
    // wrong thing.
    const target = this.journey.dayFraction;
    this.shownDayFraction += (target - this.shownDayFraction) * Math.min(1, dt * 0.9);

    this.world.update(this.journey.s);

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
    const phase: Phase =
      stop.kind === 'campfire' ? 'resting' : stop.kind === 'busk' ? 'busking' : 'encounter';
    this.setPhase(phase);
  }

  setPhase(phase: Phase): void {
    this.journey = enterPhase(this.journey, phase);
    this.rig.setMood(PHASE_TO_MOOD[phase], 1.6);
    this.walking = phase === 'walking';
    this.bard.setPose(
      phase === 'busking' ? 'playing' : phase === 'resting' ? 'sitting' : 'walking',
      0.6,
    );
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
    this.setPhase('walking');
  }

  render(_alpha: number, frameDt: number): void {
    const state = skyStateAt(this.shownDayFraction);
    applyTimeOfDay(this.app.globals, state, this.app.sun);
    this.sky.apply(state, this.app.globals.uTime.value);

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
  }

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
      this.rig.setMood('vista', 0);
    } else if (options.phase !== undefined) {
      this.setPhase(options.phase);
    }
    if (options.mood !== undefined) this.rig.setMood(options.mood, 0);
  }

  /** What the world looks like here, for the debug overlay. */
  describe(): string {
    return `${this.road.dayKey} · ${Math.round(this.journey.s)}/${Math.round(this.road.lengthM)} m · ${biomeAt(this.road, this.journey.s)} · ${skyStateAt(this.shownDayFraction).label}`;
  }

  dispose(): void {
    saveJourney(this.journey);
    this.world.dispose();
    this.bard.dispose();
    this.sky.dispose();
  }
}
