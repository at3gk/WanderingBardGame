import Phaser from 'phaser';
import { AudioEngine } from '../audio/AudioEngine';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { Beat, generateBeatSchedule, isBeatMissed, isWithinHitWindow, scrollProgress } from '../core/beats';
import { applyHit, applyMiss, DEFAULT_SONG_METER_CONFIG, isWalking, SongMeterConfig } from '../core/songMeter';
import { accumulateDistance } from '../core/distance';
import { Biome, BIOMES, biomeBlendAt } from '../core/biome';
import { accumulateCoins } from '../core/coins';

const BPM = 96;
const BEAT_BATCH_SIZE = 32;
const BEAT_LOOKAHEAD_MS = 15000;
const TRAVEL_TIME_MS = 1800;
const HIT_WINDOW_MS = 120;
const MARKER_RADIUS = 18;
const HIT_LINE_HEIGHT = 56;
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
const ROAD_TILE_WIDTH = 64;
const ROAD_TILE_HEIGHT = 48;
const ROAD_SCROLL_PX_PER_SEC = 90;
const ROAD_HEIGHT_BELOW_BARD = 60;
const COIN_RATE_PER_SEC = 5;
const COIN_ICON_RADIUS = 8;
const COIN_ICON_COLOR = 0xe8c157;
const COIN_MARGIN_TOP = 24;
const COIN_MARGIN_RIGHT = 24;
const MUTE_ICON_RADIUS = 10;
const MUTE_ICON_MARGIN_TOP = 24;
const MUTE_ICON_MARGIN_LEFT = 24;
const MUTE_ICON_COLOR_ON = 0xe8d9c0;
const MUTE_ICON_COLOR_MUTED = 0x554e63;
const MUTE_SLASH_COLOR = 0x8a5a5a;
const DISTANCE_MARGIN_LEFT = 24;
const DISTANCE_MARGIN_BOTTOM = 20;
const HINT_TEXT = 'tap to the beat';
const HINT_Y_OFFSET = -70;
const HINT_FADE_MS = 400;

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
  private roadNext!: Phaser.GameObjects.TileSprite;
  private roadFromIndex = 0;
  private roadToIndex = 0;
  private distancePx = 0;
  private totalBeatsGenerated = 0;
  private nextBatchStartTimeMs = 0;
  private coins = 0;
  private coinIcon!: Phaser.GameObjects.Arc;
  private coinText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private hintShown = true;
  private muteIcon!: Phaser.GameObjects.Arc;
  private muteSlash!: Phaser.GameObjects.Rectangle;
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
    this.cameras.main.setBackgroundColor(BIOMES[0].skyColor);
    this.startTimeMs = this.time.now;
    this.meter = this.meterConfig.max;
    this.distancePx = 0;
    this.markers = [];
    this.totalBeatsGenerated = 0;
    this.nextBatchStartTimeMs = 0;
    this.appendBeatBatch();

    this.roadFromIndex = 0;
    this.roadToIndex = 0;
    this.road = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, this.roadTileTexture(BIOMES[0]));
    this.roadNext = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, this.roadTileTexture(BIOMES[0]));
    this.roadNext.setAlpha(0);

    this.hitLine = this.add.rectangle(0, 0, 4, 0, 0xe8d9c0, 0.8);
    this.flash = this.add.rectangle(0, 0, 4, 0, 0xffffff, 0);

    this.hintShown = true;
    this.hintText = this.add.text(this.hitLineX(), this.laneY() + HINT_Y_OFFSET, HINT_TEXT, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#e8d9c0',
    });
    this.hintText.setOrigin(0.5, 0.5);
    this.hintText.setAlpha(0.85);

    this.meterTrack = this.add.rectangle(0, 0, 0, METER_HEIGHT, 0x2c2536, 0.9);
    this.meterFill = this.add.rectangle(0, 0, 0, METER_HEIGHT - 4, 0xe8d9c0, 1);

    this.coins = 0;
    this.coinIcon = this.add.circle(0, 0, COIN_ICON_RADIUS, COIN_ICON_COLOR);
    this.coinText = this.add.text(0, 0, '0', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#e8d9c0',
    });
    this.coinText.setOrigin(0, 0.5);

    this.distanceText = this.add.text(0, 0, '0 steps', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#a89bb5',
    });
    this.distanceText.setOrigin(0, 1);

    this.muteIcon = this.add.circle(0, 0, MUTE_ICON_RADIUS, MUTE_ICON_COLOR_ON);
    this.muteIcon.setInteractive({ useHandCursor: true });
    this.muteSlash = this.add.rectangle(0, 0, 3, MUTE_ICON_RADIUS * 2, MUTE_SLASH_COLOR);
    this.muteSlash.setAngle(45);
    this.muteSlash.setVisible(false);
    const muteIconX = MUTE_ICON_MARGIN_LEFT + MUTE_ICON_RADIUS;
    this.muteIcon.setPosition(muteIconX, MUTE_ICON_MARGIN_TOP);
    this.muteSlash.setPosition(muteIconX, MUTE_ICON_MARGIN_TOP);

    this.bardLegLeft = this.add.rectangle(-6, -11, 6, 22, BARD_LEG_COLOR);
    this.bardLegRight = this.add.rectangle(6, -11, 6, 22, BARD_LEG_COLOR);
    const bardBody = this.add.rectangle(0, -39, 26, 34, BARD_BODY_COLOR);
    const bardHead = this.add.circle(0, -68, 12, BARD_HEAD_COLOR);
    this.bard = this.add.container(0, 0, [this.bardLegLeft, this.bardLegRight, bardBody, bardHead]);
    this.bardWasWalking = this.walking;
    this.setBardAnimState(this.bardWasWalking);

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.includes(this.muteIcon)) {
        this.toggleMute();
        return;
      }
      this.handleInput();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.handleInput());
  }

  /** Procedural ground tile (dashed band) per biome, generated once and reused via TileSprite scrolling. No image assets per CLAUDE.md. */
  private roadTileTexture(biome: Biome): string {
    const key = `roadTile-${biome.id}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(biome.roadBandColor, 1);
      g.fillRect(0, 0, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
      g.fillStyle(biome.roadDashColor, 1);
      g.fillRect(ROAD_TILE_WIDTH * 0.1, ROAD_TILE_HEIGHT * 0.4, ROAD_TILE_WIDTH * 0.3, 4);
      g.generateTexture(key, ROAD_TILE_WIDTH, ROAD_TILE_HEIGHT);
      g.destroy();
    }
    return key;
  }

  /** Linear per-channel RGB blend, used to crossfade the sky color between biomes. */
  private static lerpColor(colorA: number, colorB: number, t: number): number {
    const ar = (colorA >> 16) & 0xff;
    const ag = (colorA >> 8) & 0xff;
    const ab = colorA & 0xff;
    const br = (colorB >> 16) & 0xff;
    const bg = (colorB >> 8) & 0xff;
    const bb = colorB & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const b = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | b;
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

  /** The scenery biome the walk is currently in, per ROADMAP task 16 — used to pick which pattern the audio engine's next batch plays. */
  private currentBiomeId(): string {
    return BIOMES[biomeBlendAt(this.distancePx).fromIndex].id;
  }

  /**
   * Appends the next batch of beats, continuing the schedule seamlessly
   * from wherever the last batch left off (ROADMAP task 13 — the road is
   * meant to be endless, so beats aren't all generated once up front).
   * Extends the audio engine's own note schedule in lockstep so the
   * backing loop never runs out of scheduled notes either — each new batch
   * picks up the biome current at the time it's scheduled, so the melody
   * shifts with the scenery a batch at a time rather than mid-batch
   * (ROADMAP task 16). `BEAT_BATCH_SIZE` is deliberately small (20s worth
   * of beats, well above `BEAT_LOOKAHEAD_MS`) rather than one big upfront
   * batch, so a biome-transition pattern switch lands within ~20s of the
   * visual crossfade instead of waiting for a multi-minute batch boundary
   * (ROADMAP task 17; see STATE.md for the remaining quantization caveat).
   */
  private appendBeatBatch(): void {
    const newBeats = generateBeatSchedule(BPM, BEAT_BATCH_SIZE, this.nextBatchStartTimeMs, this.totalBeatsGenerated);
    for (const beat of newBeats) {
      this.markers.push({ beat, gfx: null, resolved: null });
    }
    this.totalBeatsGenerated += BEAT_BATCH_SIZE;
    this.nextBatchStartTimeMs = newBeats[newBeats.length - 1].hitTimeMs;
    this.audioEngine.extend(BEAT_BATCH_SIZE, this.currentBiomeId());
  }

  private handleInput(): void {
    this.audioEngine.start(BPM, BEAT_BATCH_SIZE, this.currentBiomeId());
    this.dismissHint();
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

  /**
   * Fades out the "tap to the beat" onboarding hint the first time the
   * player interacts, whether that tap lands a hit or a miss — its job is
   * discovery, not accuracy (ROADMAP task 22). No-ops on every input after
   * the first.
   */
  private dismissHint(): void {
    if (!this.hintShown) return;
    this.hintShown = false;
    this.tweens.add({
      targets: this.hintText,
      alpha: 0,
      duration: HINT_FADE_MS,
      onComplete: () => this.hintText.destroy(),
    });
  }

  /** Toggles the audio mute state (ROADMAP task 20). Doesn't touch the beat/meter game state at all — muting is purely an audio-output concern, tapping it never counts as a beat hit/miss. */
  private toggleMute(): void {
    this.audioEngine.setMuted(!this.audioEngine.isMuted);
    this.muteIcon.setFillStyle(this.audioEngine.isMuted ? MUTE_ICON_COLOR_MUTED : MUTE_ICON_COLOR_ON);
    this.muteSlash.setVisible(this.audioEngine.isMuted);
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

    if (this.nextBatchStartTimeMs - nowMs < BEAT_LOOKAHEAD_MS) {
      this.appendBeatBatch();
    }

    this.distancePx = accumulateDistance(this.distancePx, this.walking, delta, ROAD_SCROLL_PX_PER_SEC);
    const blend = biomeBlendAt(this.distancePx);
    this.cameras.main.setBackgroundColor(
      RoadScene.lerpColor(BIOMES[blend.fromIndex].skyColor, BIOMES[blend.toIndex].skyColor, blend.ratio)
    );

    this.updateRoad(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
    this.hitLine.setPosition(hitLineX, laneY);
    this.hitLine.setSize(4, HIT_LINE_HEIGHT);
    this.flash.setPosition(hitLineX, laneY);
    this.flash.setSize(4, HIT_LINE_HEIGHT);
    if (this.hintShown) {
      this.hintText.setPosition(hitLineX, laneY + HINT_Y_OFFSET);
    }

    // Filtered in place (not just gfx-destroyed) so a long/unbounded play
    // session doesn't accumulate every beat ever generated — ROADMAP task 13.
    this.markers = this.markers.filter((marker) => {
      const progress = scrollProgress(marker.beat, nowMs, TRAVEL_TIME_MS);

      if (progress > EXIT_PROGRESS) {
        marker.gfx?.destroy();
        return false;
      }
      if (progress < 0) {
        return true;
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
      return true;
    });

    const meterRatio = this.meter / this.meterConfig.max;
    this.coins = accumulateCoins(this.coins, meterRatio, delta, COIN_RATE_PER_SEC);

    this.updateMeterBar();
    this.updateCoinReadout();
    this.updateDistanceReadout();
    this.updateBard(hitLineX, laneY);
    this.audioEngine.setMeterRatio(meterRatio);
  }

  /**
   * Ground band sits below the bard and scrolls at a fixed rate while
   * walking, freezing when the song stalls (ROADMAP task 6). A second
   * biome tile sits on top and crossfades in via alpha as distance crosses
   * a transition band (ROADMAP task 9; generalized to N biomes in task 15)
   * — both scroll in lockstep so the dashes stay aligned through the fade.
   * Textures only get swapped when the blend's from/to indices actually
   * change (there are more than 2 biomes now, so which pair is blending
   * changes over the course of a walk).
   */
  private updateRoad(laneY: number, delta: number, fromIndex: number, toIndex: number, ratio: number): void {
    if (fromIndex !== this.roadFromIndex) {
      this.roadFromIndex = fromIndex;
      this.road.setTexture(this.roadTileTexture(BIOMES[fromIndex]));
    }
    if (toIndex !== this.roadToIndex) {
      this.roadToIndex = toIndex;
      this.roadNext.setTexture(this.roadTileTexture(BIOMES[toIndex]));
    }

    const roadY = laneY + BARD_GROUND_Y_OFFSET;
    this.road.setPosition(this.scale.width / 2, roadY);
    this.road.setSize(this.scale.width, ROAD_HEIGHT_BELOW_BARD);
    this.roadNext.setPosition(this.scale.width / 2, roadY);
    this.roadNext.setSize(this.scale.width, ROAD_HEIGHT_BELOW_BARD);
    this.roadNext.setAlpha(ratio);
    if (this.walking) {
      const scrollDelta = (ROAD_SCROLL_PX_PER_SEC * delta) / 1000;
      this.road.tilePositionX += scrollDelta;
      this.roadNext.tilePositionX += scrollDelta;
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

  /** Coin count readout — a display of song-meter performance, not an interactive system (ROADMAP task 11). */
  private updateCoinReadout(): void {
    const iconX = this.scale.width - COIN_MARGIN_RIGHT - COIN_ICON_RADIUS;
    this.coinIcon.setPosition(iconX, COIN_MARGIN_TOP);
    this.coinText.setText(Math.floor(this.coins).toString());
    this.coinText.setPosition(iconX - COIN_ICON_RADIUS - this.coinText.width - 8, COIN_MARGIN_TOP);
  }

  /**
   * Distance-walked readout — DESIGN.md names "distance" alongside scenery
   * and coins as a readout of song-meter performance, but until now
   * `distancePx` only drove the biome crossfade internally with nothing
   * shown to the player. Steps are `distancePx` converted through
   * `ROAD_TILE_WIDTH` (the road's own dash-tile size) rather than a new
   * arbitrary unit, so one "step" matches one tile of ground already
   * scrolling past.
   */
  private updateDistanceReadout(): void {
    const steps = Math.floor(this.distancePx / ROAD_TILE_WIDTH);
    this.distanceText.setText(`${steps} steps`);
    this.distanceText.setPosition(DISTANCE_MARGIN_LEFT, this.scale.height - DISTANCE_MARGIN_BOTTOM);
  }
}
