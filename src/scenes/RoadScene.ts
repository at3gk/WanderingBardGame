import Phaser from 'phaser';
import { Beat, generateBeatSchedule, isBeatMissed, isWithinHitWindow, scrollProgress } from '../core/beats';

const BPM = 96;
const BEAT_COUNT = 300;
const TRAVEL_TIME_MS = 1800;
const HIT_WINDOW_MS = 120;
const MARKER_RADIUS = 18;
const EXIT_PROGRESS = 1.35;

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

  constructor() {
    super('RoadScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1621');
    this.startTimeMs = this.time.now;
    this.markers = generateBeatSchedule(BPM, BEAT_COUNT).map((beat) => ({
      beat,
      gfx: null,
      resolved: null,
    }));

    this.hitLine = this.add.rectangle(0, 0, 4, 0, 0xe8d9c0, 0.8);
    this.flash = this.add.rectangle(0, 0, 4, 0, 0xffffff, 0);

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

  private handleInput(): void {
    const nowMs = this.time.now - this.startTimeMs;
    const target = this.markers.find(
      (m) => m.resolved === null && isWithinHitWindow(m.beat, nowMs, HIT_WINDOW_MS)
    );
    if (target) {
      target.resolved = 'hit';
      target.gfx?.setFillStyle(0x7fd6a0, 1);
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
      }

      if (!marker.gfx) {
        const color = marker.resolved === 'hit' ? 0x7fd6a0 : marker.resolved === 'miss' ? 0x8a5a5a : 0xe8d9c0;
        marker.gfx = this.add.circle(0, laneY, MARKER_RADIUS, color);
      }
      marker.gfx.setPosition(this.markerX(progress), laneY);
    }
  }
}
