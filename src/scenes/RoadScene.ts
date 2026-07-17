import Phaser from 'phaser';
import { AudioEngine } from '../audio/AudioEngine';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { Beat, generateBeatSchedule, isBeatMissed, isWithinHitWindow, scrollProgress } from '../core/beats';
import { applyHit, applyMiss, DEFAULT_SONG_METER_CONFIG, isWalking, SongMeterConfig } from '../core/songMeter';

const BPM = 96;
const BEAT_COUNT = 300;
const TRAVEL_TIME_MS = 1800;
const HIT_WINDOW_MS = 120;
const MARKER_RADIUS = 18;
const EXIT_PROGRESS = 1.35;
const METER_HEIGHT = 14;
const METER_MARGIN_TOP = 24;
const BARD_GROUND_Y_OFFSET = 110;
const BARD_LEG_COLOR = 0x5b4636;
const BARD_BODY_COLOR = 0xc98a5b;
const BARD_HEAD_COLOR = 0xe8c39e;
const BARD_WALK_SWING_DEG = 20;
const BARD_WALK_STEP_MS = 260;
const BARD_IDLE_BREATH_MS = 1400;
const ROAD_TILE_KEY = 'roadTile';
const ROAD_TILE_WIDTH = 64;
const ROAD_TILE_HEIGHT = 48;
const ROAD_BAND_COLOR = 0x3a2f3f;
const ROAD_DASH_COLOR = 0x4d3f52;
const ROAD_SCROLL_PX_PER_SEC = 90;
const ROAD_HEIGHT_BELOW_BARD = 60;

interface BeatMarker {
  beat: Beat;
  gfx: Phaser.GameObjects.Arc | null;
  resolved: 'hit' | 'miss' | null;
}

export class RoadScene extends Phaser.Scene {
  private startTimeMs = 0;
  private markers: BeatMarker[] = [];
  private hitLine!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private meterConfig: SongMeterConfig = DEFAULT_SONG_METER_CONFIG;
  private meter = DEFAULT_SONG_METER_CONFIG.max;
  private meterTrack!: Phaser.GameObjects.Rectangle;
  private meterFill!: Phaser.GameObjects.Rectangle;
  private road!: Phaser.GameObjects.TileSprite;
  private bard!: Phaser.GameObjects.Container;
  private bardLegLeft!: Phaser.GameObjects.Rectangle;
  private bardLegRight!: Phaser.GameObjects.Rectangle;
  private bardTweens: Phaser.Tweens.Tween[] = [];
  private bardWasWalking: boolean | null = null;
  private audioEngine = new AudioEngine(AUDIO_MANIFEST);

  constructor() {
    super('RoadScene');
  }

  /** Walking-vs-stopped state derived from the song meter, per DESIGN.md. Read by later tasks (bard sprite, road scroll). */
  get walking(): boolean {
    return isWalking(this.meter, this.meterConfig);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1621');
    this.startTimeMs = this.time.now;
    this.meter = this.meterConfig.max;
    this.markers = generateBeatSchedule(BPM, BEAT_COUNT).map((beat) => ({
      beat,
      gfx: null,
      resolved: null,
    }));

    this.road = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, this.roadTileTexture());

    this.hitLine = this.add.rectangle(0, 0, 4, 0, 0xe8d9c0, 0.8);
    this.flash = this.add.rectangle(0, 0, 4, 0, 0xffffff, 0);

    this.meterTrack = this.add.rectangle(0, 0, 0, METER_HEIGHT, 0x2c2536, 0.9);
    this.meterFill = this.add.rectangle(0, 0, 0, METER_HEIGHT - 4, 0xe8d9c0, 1);

    this.bardLegLeft = this.add.rectangle(-6, -11, 6, 22, BARD_LEG_COLOR);
    this.bardLegRight = this.add.rectangle(6, -11, 6, 22, BARD_LEG_COLOR);
    const bardBody = this.add.rectangle(0, -39, 26, 34, BARD_BODY_COLOR);
    const bardHead = this.add.circle(0, -68, 12, BARD_HEAD_COLOR);
    this.bard = this.add.container(0, 0, [this.bardLegLeft, this.bardLegRight, bardBody, bardHead]);
    this.bardWasWalking = this.walking;
    this.setBardAnimState(this.bardWasWalking);

    this.input.on('pointerdown', () => this.handleInput());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleInput());
  }

  /** Procedural ground tile (dashed band), generated once and reused via TileSprite scrolling. No image assets per CLAUDE.md. */
  private roadTileTexture(): string {
    if (!this.textures.exists(ROAD_TILE_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(ROAD_BAND_COLOR, 1);
      g.fillRect(0, 0, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
      g.fillStyle(ROAD_DASH_COLOR, 1);
      g.fillRect(ROAD_TILE_WIDTH * 0.1, ROAD_TILE_HEIGHT * 0.4, ROAD_TILE_WIDTH * 0.3, 4);
      g.generateTexture(ROAD_TILE_KEY, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
      g.destroy();
    }
    return ROAD_TILE_KEY;
  }

  /** Swaps the bard's walk/idle animation. Placeholder procedural sprite per ROADMAP task 5. */
  private setBardAnimState(walking: boolean): void {
    this.bardTweens.forEach((tween) => tween.stop());
    this.bardTweens = [];
    this.bardLegLeft.setAngle(0);
    this.bardLegRight.setAngle(0);
    this.bard.setScale(1, 1);

    if (walking) {
      this.bardTweens.push(
        this.tweens.add({
          targets: this.bardLegLeft,
          angle: { from: -BARD_WALK_SWING_DEG, to: BARD_WALK_SWING_DEG },
          duration: BARD_WALK_STEP_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
        this.tweens.add({
          targets: this.bardLegRight,
          angle: { from: BARD_WALK_SWING_DEG, to: -BARD_WALK_SWING_DEG },
          duration: BARD_WALK_STEP_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
        this.tweens.add({
          targets: this.bard,
          scaleY: { from: 1, to: 0.94 },
          duration: BARD_WALK_STEP_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      );
    } else {
      this.bardTweens.push(
        this.tweens.add({
          targets: this.bard,
          scaleY: { from: 1, to: 1.03 },
          scaleX: { from: 1, to: 0.98 },
          duration: BARD_IDLE_BREATH_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      );
    }
  }

  private laneY(): number {
    return this.scale.height / 2;
  }

  private hitLineX(): number {
    return this.scale.width * 0.25;
  }

  private spawnX(): number {
    return this.scale.width + MARKER_RADIUS * 2;
  }

  private markerX(progress: number): number {
    const spawn = this.spawnX();
    return spawn + progress * (this.hitLineX() - spawn);
  }

  private meterTrackWidth(): number {
    return this.scale.width * 0.6;
  }

  private handleInput(): void {
    this.audioEngine.start(BPM, BEAT_COUNT);
    const nowMs = this.time.now - this.startTimeMs;
    const target = this.markers.find(
      (m) => m.resolved === null && isWithinHitWindow(m.beat, nowMs, HIT_WINDOW_MS)
    );
    if (target) {
      target.resolved = 'hit';
      target.gfx?.setFillStyle(0x7fd6a0, 1);
      this.meter = applyHit(this.meter, this.meterConfig);
    }
    this.flashHitLine(target ? 0x7fd6a0 : 0x555555);
  }

  private flashHitLine(color: number): void {
    this.flash.setFillStyle(color, 0.6);
    this.tweens.add({
      targets: this.flash,
      alpha: { from: 0.6, to: 0 },
      duration: 180,
      onComplete: () => this.flash.setAlpha(0),
    });
  }

  update(_time: number, delta: number): void {
    const nowMs = this.time.now - this.startTimeMs;
    const laneY = this.laneY();
    const hitLineX = this.hitLineX();

    this.updateRoad(laneY, delta);
    this.hitLine.setPosition(hitLineX, laneY);
    this.hitLine.setSize(4, 120);
    this.flash.setPosition(hitLineX, laneY);
    this.flash.setSize(4, 120);

    for (const marker of this.markers) {
      const progress = scrollProgress(marker.beat, nowMs, TRAVEL_TIME_MS);

      if (progress < 0 || progress > EXIT_PROGRESS) {
        if (marker.gfx && progress > EXIT_PROGRESS) {
          marker.gfx.destroy();
          marker.gfx = null;
        }
        continue;
      }

      if (marker.resolved === null && isBeatMissed(marker.beat, nowMs, HIT_WINDOW_MS)) {
        marker.resolved = 'miss';
        marker.gfx?.setFillStyle(0x8a5a5a, 0.7);
        this.meter = applyMiss(this.meter, this.meterConfig);
      }

      if (!marker.gfx) {
        const color = marker.resolved === 'hit' ? 0x7fd6a0 : marker.resolved === 'miss' ? 0x8a5a5a : 0xe8d9c0;
        marker.gfx = this.add.circle(0, laneY, MARKER_RADIUS, color);
      }
      marker.gfx.setPosition(this.markerX(progress), laneY);
    }

    this.updateMeterBar();
    this.updateBard(hitLineX, laneY);
  }

  /** Ground band sits below the bard and scrolls at a fixed rate while walking, freezing when the song stalls (ROADMAP task 6). */
  private updateRoad(laneY: number, delta: number): void {
    const roadY = laneY + BARD_GROUND_Y_OFFSET;
    this.road.setPosition(this.scale.width / 2, roadY);
    this.road.setSize(this.scale.width, ROAD_HEIGHT_BELOW_BARD);
    if (this.walking) {
      this.road.tilePositionX += (ROAD_SCROLL_PX_PER_SEC * delta) / 1000;
    }
  }

  private updateBard(hitLineX: number, laneY: number): void {
    this.bard.setPosition(hitLineX, laneY + BARD_GROUND_Y_OFFSET);

    const walking = this.walking;
    if (walking !== this.bardWasWalking) {
      this.bardWasWalking = walking;
      this.setBardAnimState(walking);
    }
  }

  private updateMeterBar(): void {
    const trackWidth = this.meterTrackWidth();
    const centerX = this.scale.width / 2;
    const fillRatio = this.meter / this.meterConfig.max;
    const walking = this.walking;

    this.meterTrack.setPosition(centerX, METER_MARGIN_TOP);
    this.meterTrack.setSize(trackWidth, METER_HEIGHT);

    this.meterFill.setSize(Math.max(0, trackWidth * fillRatio), METER_HEIGHT - 4);
    this.meterFill.setFillStyle(walking ? 0xe8d9c0 : 0x7a6f85, 1);
    this.meterFill.setPosition(centerX - trackWidth / 2 + this.meterFill.width / 2, METER_MARGIN_TOP);
  }
}
