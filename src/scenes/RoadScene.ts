import Phaser from 'phaser';
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

    this.hitLine = this.add.rectangle(0, 0, 4, 0, 0xe8d9c0, 0.8);
    this.flash = this.add.rectangle(0, 0, 4, 0, 0xffffff, 0);

    this.meterTrack = this.add.rectangle(0, 0, 0, METER_HEIGHT, 0x2c2536, 0.9);
    this.meterFill = this.add.rectangle(0, 0, 0, METER_HEIGHT - 4, 0xe8d9c0, 1);

    this.input.on('pointerdown', () => this.handleInput());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleInput());
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

  update(): void {
    const nowMs = this.time.now - this.startTimeMs;
    const laneY = this.laneY();
    const hitLineX = this.hitLineX();

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
