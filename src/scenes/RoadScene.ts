import Phaser from 'phaser';
import { AudioEngine } from '../audio/AudioEngine';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { Beat, generateBeatSchedule, isBeatMissed, isWithinHitWindow, scrollProgress } from '../core/beats';
import { applyHit, applyMiss, DEFAULT_SONG_METER_CONFIG, isWalking, SongMeterConfig } from '../core/songMeter';
import { accumulateDistance } from '../core/distance';
import { Biome, BIOMES, biomeBlendAt } from '../core/biome';
import { duskShadeAt, nightnessAt } from '../core/dusk';
import { accumulateCoins } from '../core/coins';

const BPM = 96;
const MS_PER_BEAT = 60000 / BPM;
const BEAT_BATCH_SIZE = 32;
const BEAT_LOOKAHEAD_MS = 15000;
const TRAVEL_TIME_MS = 1800;
// Human playtest (2026-07-25): 120ms read as "too loose" — clearly-off taps
// still counted as hits. Tightened to ±90ms.
const HIT_WINDOW_MS = 90;
const MARKER_RADIUS = 18;
// One visual language for everything the player reads or touches
// (ROADMAP task 32): beat markers are eighth notes, the coin is stamped
// with a note, the mute toggle is a note. The glyph texture is drawn
// white and tinted per use.
const NOTE_TINT_UPCOMING = 0xe8d9c0;
const NOTE_TINT_HIT = 0x7fd6a0;
const NOTE_TINT_MISS = 0x8a5a5a;
const HIT_LINE_HEIGHT = 56;
const EXIT_PROGRESS = 1.35;
const METER_HEIGHT = 14;
const METER_MARGIN_TOP = 24;
// Meter as staff (ROADMAP idea backlog): the song meter joins the notation
// language established in task 32 — five faint staff lines across the bar,
// same cream tone as the beat glyphs, sitting on top of the existing
// track/fill so the meter reads as sheet music filling with light rather
// than a plain progress bar.
const METER_STAFF_LINE_COUNT = 5;
// A mid-tone (not the fill's own cream) so the lines stay visible whether
// they sit on the dark track or the bright fill — sheet-music lines read
// the same whether the page under them is blank or inked.
const METER_STAFF_LINE_COLOR = 0xa8842f;
const METER_STAFF_LINE_ALPHA = 0.55;
const METER_STAFF_LINE_THICKNESS = 1;
const BARD_GROUND_Y_OFFSET = 110;
// Warm colors throughout so the bard reads against all three biome skies
// (plum/green/blue — see biome.ts); buckle/feather/strings reuse the UI
// accent colors (coin gold, cream) so the whole screen shares one palette.
const BARD_PALETTE = {
  boot: 0x4a3428,
  trouser: 0x5b4636,
  tunic: 0xc9784a,
  tunicShade: 0xa05c38,
  belt: 0x4a3428,
  buckle: 0xe8c157,
  skin: 0xe8c39e,
  hair: 0x6b4a2f,
  cap: 0xa04e50,
  feather: 0xe8d9c0,
  luteWood: 0xb07a45,
  luteNeck: 0x7a5433,
  luteHole: 0x4a3428,
  string: 0xe8d9c0,
};
const BARD_HIP_Y = -27;
const BARD_SCALE = 1.15;
const BARD_LUTE_ANGLE_DEG = -22;
const BARD_WALK_SWING_DEG = 20;
const BARD_WALK_BOB_PX = 3;
const BARD_WALK_ROCK_DEG = 1.6;
// Human playtest (2026-07-25): legs visibly out of sync with the ground
// scroll (260ms swings over a 90px/s scroll = ~23px per footfall — mincing
// steps under fast legs). Both are now derived from the beat instead of
// eyeballed independently: one footfall per beat (96 steps/min, a normal
// leisurely walking cadence) and one road tile of ground per footfall, so
// legs, ground, the "N steps" readout, and the music all share one clock.
const BARD_WALK_STEP_MS = MS_PER_BEAT;
const BARD_IDLE_BREATH_MS = 1400;
const ROAD_TILE_WIDTH = 64;
const ROAD_TILE_HEIGHT = 48;
const ROAD_SCROLL_PX_PER_SEC = ROAD_TILE_WIDTH / (MS_PER_BEAT / 1000);
const ROAD_HEIGHT_BELOW_BARD = 60;
// Background scenery band (ROADMAP task 31): silhouette features sitting on
// the horizon, scrolling slower than the road so the world reads as having
// depth. One repeating tile per biome, crossfaded exactly like the road.
const SCENERY_TILE_WIDTH = 256;
const SCENERY_TILE_HEIGHT = 120;
const SCENERY_PARALLAX = 0.45;
// Night sky (ROADMAP task 34): a starfield drifting far slower than the
// scenery — three scroll speeds (road 1x, scenery 0.45x, stars 0.08x)
// is what turns two flat bands into a world with depth. The moon doesn't
// move at all; it's the moon.
const STAR_FIELD_HEIGHT = 200;
const STAR_PARALLAX = 0.08;
const MOON_X_FRACTION = 0.78;
const MOON_Y = 84;
const MOON_RADIUS = 24;
const COIN_RATE_PER_SEC = 5;
const COIN_ICON_RADIUS = 8;
const COIN_ICON_COLOR = 0xe8c157;
const COIN_MARGIN_TOP = 24;
const COIN_MARGIN_RIGHT = 24;
const MUTE_ICON_RADIUS = 10;
const MUTE_ICON_MARGIN_TOP = 24;
const MUTE_ICON_MARGIN_LEFT = 24;
// WCAG 2.5.5 / Apple HIG both put the minimum comfortable touch target at
// 44 CSS px — well above the icon's own 20px visual diameter. The zone below
// pads the *tappable* area out to that size without changing how the icon looks.
const MUTE_TOUCH_TARGET_SIZE = 44;
const MUTE_ICON_COLOR_ON = 0xe8d9c0;
const MUTE_ICON_COLOR_MUTED = 0x554e63;
const MUTE_SLASH_COLOR = 0x8a5a5a;
const DISTANCE_MARGIN_LEFT = 24;
const DISTANCE_MARGIN_BOTTOM = 20;
const HINT_TEXT = 'tap to the beat';
const HINT_Y_OFFSET = -70;
const HINT_FADE_MS = 400;
// Strum on hit (ROADMAP idea backlog): the visual twin of AudioEngine.pluck
// — the lute kicks toward the strings and springs back, as if the hit just
// struck a chord. Tiny tween, reuses the existing lute image, no new texture.
const BARD_STRUM_KICK_DEG = 14;
const BARD_STRUM_MS = 140;

interface BeatMarker {
  beat: Beat;
  gfx: Phaser.GameObjects.Image | null;
  resolved: 'hit' | 'miss' | null;
}

export class RoadScene extends Phaser.Scene {
  private startTimeMs = 0;
  private markers: BeatMarker[] = [];
  private hitLine!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private meterConfig: SongMeterConfig = DEFAULT_SONG_METER_CONFIG;
  private meter = DEFAULT_SONG_METER_CONFIG.max;
  private meterTrack!: Phaser.GameObjects.Rectangle;
  private meterFill!: Phaser.GameObjects.Rectangle;
  private meterStaffLines: Phaser.GameObjects.Rectangle[] = [];
  private road!: Phaser.GameObjects.TileSprite;
  private roadNext!: Phaser.GameObjects.TileSprite;
  private roadFromIndex = 0;
  private roadToIndex = 0;
  private scenery!: Phaser.GameObjects.TileSprite;
  private sceneryNext!: Phaser.GameObjects.TileSprite;
  private sceneryFromIndex = 0;
  private sceneryToIndex = 0;
  private stars!: Phaser.GameObjects.TileSprite;
  private moon!: Phaser.GameObjects.Arc;
  private moonGlow!: Phaser.GameObjects.Arc;
  private distancePx = 0;
  private totalBeatsGenerated = 0;
  private nextBatchStartTimeMs = 0;
  private coins = 0;
  private coinIcon!: Phaser.GameObjects.Image;
  private coinText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private hintShown = true;
  private muteIcon!: Phaser.GameObjects.Image;
  private muteSlash!: Phaser.GameObjects.Rectangle;
  private muteZone!: Phaser.GameObjects.Zone;
  private bard!: Phaser.GameObjects.Container;
  private bardLegLeft!: Phaser.GameObjects.Image;
  private bardLegRight!: Phaser.GameObjects.Image;
  private bardUpper!: Phaser.GameObjects.Container;
  private bardLute!: Phaser.GameObjects.Image;
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
    this.createStyleTextures();
    this.cameras.main.setBackgroundColor(BIOMES[0].skyColor);
    this.startTimeMs = this.time.now;
    this.meter = this.meterConfig.max;
    this.distancePx = 0;
    this.markers = [];
    this.totalBeatsGenerated = 0;
    this.nextBatchStartTimeMs = 0;
    this.appendBeatBatch();

    this.stars = this.add.tileSprite(0, 0, this.scale.width, STAR_FIELD_HEIGHT, this.starFieldTexture());
    this.moonGlow = this.add.circle(0, MOON_Y, MOON_RADIUS + 14, 0xe8d9c0, 1);
    this.moon = this.add.circle(0, MOON_Y, MOON_RADIUS, 0xe8d9c0, 1);

    this.sceneryFromIndex = 0;
    this.sceneryToIndex = 0;
    this.scenery = this.add.tileSprite(0, 0, this.scale.width, SCENERY_TILE_HEIGHT, this.sceneryTileTexture(BIOMES[0]));
    this.sceneryNext = this.add.tileSprite(0, 0, this.scale.width, SCENERY_TILE_HEIGHT, this.sceneryTileTexture(BIOMES[0]));
    this.sceneryNext.setAlpha(0);

    this.roadFromIndex = 0;
    this.roadToIndex = 0;
    this.road = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, this.roadTileTexture(BIOMES[0]));
    this.roadNext = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, this.roadTileTexture(BIOMES[0]));
    this.roadNext.setAlpha(0);

    this.hitLine = this.add.image(0, 0, 'hit-line');
    this.hitLine.setTint(NOTE_TINT_UPCOMING);
    this.hitLine.setAlpha(0.8);
    this.flash = this.add.rectangle(0, 0, 6, 0, 0xffffff, 0);

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
    this.meterStaffLines = Array.from({ length: METER_STAFF_LINE_COUNT }, () =>
      this.add.rectangle(0, 0, 0, METER_STAFF_LINE_THICKNESS, METER_STAFF_LINE_COLOR, METER_STAFF_LINE_ALPHA)
    );

    this.coins = 0;
    this.coinIcon = this.add.image(0, 0, 'coin-icon');
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

    this.muteIcon = this.add.image(0, 0, 'note-glyph');
    this.muteIcon.setScale((MUTE_ICON_RADIUS * 2) / 34);
    this.muteIcon.setTint(MUTE_ICON_COLOR_ON);
    this.muteSlash = this.add.rectangle(0, 0, 3, MUTE_ICON_RADIUS * 2 + 6, MUTE_SLASH_COLOR);
    this.muteSlash.setAngle(45);
    this.muteSlash.setVisible(false);
    const muteIconX = MUTE_ICON_MARGIN_LEFT + MUTE_ICON_RADIUS;
    this.muteIcon.setPosition(muteIconX, MUTE_ICON_MARGIN_TOP);
    this.muteSlash.setPosition(muteIconX, MUTE_ICON_MARGIN_TOP);
    this.muteZone = this.add.zone(muteIconX, MUTE_ICON_MARGIN_TOP, MUTE_TOUCH_TARGET_SIZE, MUTE_TOUCH_TARGET_SIZE);
    this.muteZone.setInteractive({ useHandCursor: true });

    this.createBard();
    this.bardWasWalking = this.walking;
    this.setBardAnimState(this.bardWasWalking);

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.includes(this.muteZone)) {
        this.toggleMute();
        return;
      }
      this.handleInput();
    });
    // Without addCapture, Space's default browser action (scroll the page) fires
    // alongside every keyboard beat hit, fighting the "keyboard works on desktop" pillar.
    this.input.keyboard?.addCapture('SPACE');
    this.input.keyboard?.on('keydown-SPACE', () => this.handleInput());

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    });
  }

  /**
   * Backgrounding the tab (app switch, screen lock, an incoming call on
   * mobile) suspends the AudioContext; resume it on return so the backing
   * track doesn't stay silent forever even though gameplay keeps running.
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.audioEngine.resume();
    }
  };

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

  /**
   * Sparse starfield tile (ROADMAP task 34). Fixed positions rather than
   * random so every load (and every screenshot) is identical; denser in
   * the upper half — stars thin out toward the horizon haze. Cream like
   * the rest of the light in this game, never pure white.
   */
  private starFieldTexture(): string {
    const key = 'star-field';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const stars: Array<[number, number, number, number]> = [
      [12, 30, 1.2, 0.9],
      [40, 122, 1.0, 0.5],
      [66, 58, 1.5, 0.8],
      [90, 16, 1.0, 0.6],
      [110, 92, 1.2, 0.7],
      [140, 38, 1.0, 0.9],
      [160, 138, 1.3, 0.5],
      [185, 70, 1.0, 0.8],
      [205, 22, 1.5, 0.6],
      [230, 108, 1.0, 0.7],
      [25, 168, 1.0, 0.4],
      [75, 150, 1.2, 0.6],
      [125, 176, 1.0, 0.5],
      [175, 162, 1.0, 0.45],
      [220, 154, 1.2, 0.55],
      [245, 62, 1.0, 0.75],
    ];
    for (const [x, y, r, a] of stars) {
      g.fillStyle(0xe8d9c0, a);
      g.fillCircle(x, y, r);
    }
    g.generateTexture(key, SCENERY_TILE_WIDTH, STAR_FIELD_HEIGHT);
    g.destroy();
    return key;
  }

  /**
   * Shared UI textures for the "musical notation" visual language
   * (ROADMAP task 32): a white, tintable eighth-note glyph (beat markers,
   * mute toggle), a note-stamped coin, and a soft rounded hit line. Drawn
   * once per texture manager lifetime, Graphics only.
   */
  private createStyleTextures(): void {
    if (!this.textures.exists('note-glyph')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(9, 28, 16, 11);
      g.fillRect(15, 4, 3, 25);
      g.fillTriangle(18, 4, 27, 10, 18, 16);
      g.generateTexture('note-glyph', 28, 34);
      g.destroy();
    }
    if (!this.textures.exists('coin-icon')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xb5923c, 1);
      g.fillCircle(10, 10, 9);
      g.fillStyle(COIN_ICON_COLOR, 1);
      g.fillCircle(10, 10, 7.5);
      g.fillStyle(0xa8842f, 1);
      g.fillEllipse(8, 13, 6, 4.5);
      g.fillRect(10, 5, 1.5, 8.5);
      g.generateTexture('coin-icon', 20, 20);
      g.destroy();
    }
    if (!this.textures.exists('hit-line')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 0, 6, HIT_LINE_HEIGHT, 3);
      g.generateTexture('hit-line', 6, HIT_LINE_HEIGHT);
      g.destroy();
    }
  }

  /**
   * Procedural background scenery tile per biome (ROADMAP task 31):
   * silhouette features drawn against a transparent sky so the camera's
   * blended background color shows through. Each biome gets its own shapes
   * — this is the "three vignettes" of DESIGN.md's concept finally visible
   * as places, not just palette swaps. Silhouettes are anchored to the
   * tile's bottom edge, which sits on the road band's top edge.
   */
  private sceneryTileTexture(biome: Biome): string {
    const key = `scenery-${biome.id}`;
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const H = SCENERY_TILE_HEIGHT;

    if (biome.id === 'village') {
      // Three gabled houses of varying heights, warm lit windows, a chimney.
      g.fillStyle(biome.sceneryColor, 1);
      g.fillRect(24, H - 60, 52, 60);
      g.fillTriangle(18, H - 60, 82, H - 60, 50, H - 90);
      g.fillRect(64, H - 82, 8, 14);
      g.fillRect(124, H - 45, 44, 45);
      g.fillTriangle(118, H - 45, 172, H - 45, 146, H - 70);
      g.fillRect(202, H - 35, 36, 35);
      g.fillTriangle(198, H - 35, 240, H - 35, 220, H - 56);
      g.fillStyle(biome.sceneryAccent, 0.9);
      g.fillRect(34, H - 40, 6, 8);
      g.fillRect(58, H - 40, 6, 8);
      g.fillRect(140, H - 30, 6, 7);
      g.fillRect(216, H - 25, 5, 6);
    } else if (biome.id === 'forest') {
      // Conifer silhouettes, one round-canopy tree, a couple of fireflies.
      g.fillStyle(biome.sceneryColor, 1);
      g.fillTriangle(20, H, 60, H, 40, H - 80);
      g.fillTriangle(70, H, 110, H, 90, H - 55);
      g.fillTriangle(125, H, 175, H, 150, H - 90);
      g.fillRect(211, H - 25, 8, 25);
      g.fillCircle(215, H - 40, 22);
      g.fillStyle(biome.sceneryAccent, 0.8);
      g.fillCircle(70, H - 30, 1.5);
      g.fillCircle(185, H - 50, 1.5);
      g.fillCircle(120, H - 20, 1.2);
    } else {
      // Riverside: water band with glints, a tent, a campfire, reeds.
      g.fillStyle(0x16344a, 1);
      g.fillRect(0, H - 24, SCENERY_TILE_WIDTH, 24);
      g.fillStyle(biome.sceneryAccent, 0.8);
      g.fillRect(20, H - 16, 18, 2);
      g.fillRect(80, H - 10, 14, 2);
      g.fillRect(150, H - 18, 16, 2);
      g.fillRect(210, H - 12, 12, 2);
      g.fillStyle(biome.sceneryColor, 1);
      g.fillTriangle(40, H - 24, 90, H - 24, 65, H - 60);
      g.fillTriangle(58, H - 24, 72, H - 24, 65, H - 46);
      g.fillRect(160, H - 34, 2, 12);
      g.fillRect(166, H - 36, 2, 14);
      g.fillRect(230, H - 32, 2, 10);
      g.fillStyle(0xe8c157, 0.95);
      g.fillCircle(110, H - 28, 3);
      g.fillStyle(0xe8c157, 0.25);
      g.fillCircle(110, H - 28, 7);
    }

    g.generateTexture(key, SCENERY_TILE_WIDTH, SCENERY_TILE_HEIGHT);
    g.destroy();
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

  /**
   * Builds the bard's part textures (once) and assembles the container:
   * two hip-pivoting legs, plus an "upper" sub-container (tunic'd torso,
   * lute, capped head) that bobs/rocks as one piece so the feet never
   * leave the ground (ROADMAP task 30 — replaces the three-rectangle
   * placeholder from task 5). All parts are Graphics-drawn textures, no
   * image assets per CLAUDE.md. The bard faces right, the walk direction.
   */
  private createBard(): void {
    const P = BARD_PALETTE;

    if (!this.textures.exists('bard-leg')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Trouser leg with a boot whose toe points forward (+X).
      g.fillStyle(P.trouser, 1);
      g.fillRoundedRect(2, 0, 8, 24, 3);
      g.fillStyle(P.boot, 1);
      g.fillRoundedRect(2, 22, 10, 8, { tl: 2, tr: 4, bl: 2, br: 2 });
      g.generateTexture('bard-leg', 12, 30);
      g.destroy();
    }

    if (!this.textures.exists('bard-torso')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Tunic: shoulders narrower than the hem so it reads as clothing,
      // not a box; belt + gold buckle break up the silhouette.
      g.fillStyle(P.tunic, 1);
      g.fillPoints(
        [new Phaser.Geom.Point(9, 4), new Phaser.Geom.Point(25, 4), new Phaser.Geom.Point(27, 34), new Phaser.Geom.Point(7, 34)],
        true
      );
      g.fillStyle(P.tunicShade, 1);
      g.fillRect(7, 31, 20, 3);
      g.fillStyle(P.belt, 1);
      g.fillRect(8, 24, 18, 4);
      g.fillStyle(P.buckle, 1);
      g.fillRect(15, 24, 4, 4);
      // Front arm: a sleeve reaching down-left across the body toward the
      // lute's neck, ending in a skin-tone hand.
      g.fillStyle(P.tunicShade, 1);
      g.fillPoints(
        [new Phaser.Geom.Point(22, 6), new Phaser.Geom.Point(26, 9), new Phaser.Geom.Point(15, 21), new Phaser.Geom.Point(12, 17)],
        true
      );
      g.fillStyle(P.skin, 1);
      g.fillCircle(13, 20, 3);
      g.generateTexture('bard-torso', 34, 38);
      g.destroy();
    }

    if (!this.textures.exists('bard-head')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Hair behind, face in front (offset right = facing the walk
      // direction), floppy cap on top with a cream feather.
      g.fillStyle(P.hair, 1);
      g.fillCircle(15, 15, 10);
      g.fillStyle(P.skin, 1);
      g.fillCircle(17, 18, 9);
      g.fillStyle(P.cap, 1);
      g.fillEllipse(15, 9, 24, 12);
      g.fillStyle(P.feather, 1);
      g.fillPoints(
        [new Phaser.Geom.Point(24, 9), new Phaser.Geom.Point(32, 1), new Phaser.Geom.Point(34, 4), new Phaser.Geom.Point(26, 12)],
        true
      );
      g.fillStyle(0x3a2c22, 1);
      g.fillRect(21, 17, 2, 2);
      g.generateTexture('bard-head', 36, 30);
      g.destroy();
    }

    if (!this.textures.exists('bard-lute')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Drawn horizontal (neck left, pear body right); angled at placement.
      g.fillStyle(P.luteNeck, 1);
      g.fillRect(2, 10, 24, 4);
      g.fillRect(0, 8, 5, 8);
      g.fillStyle(P.luteWood, 1);
      g.fillEllipse(31, 12, 18, 16);
      g.fillStyle(P.luteHole, 1);
      g.fillCircle(30, 12, 3);
      g.lineStyle(1, P.string, 0.9);
      g.lineBetween(3, 12, 36, 12);
      g.generateTexture('bard-lute', 40, 24);
      g.destroy();
    }

    this.bardLegLeft = this.add.image(-5, BARD_HIP_Y, 'bard-leg');
    this.bardLegLeft.setOrigin(0.5, 0.08);
    this.bardLegRight = this.add.image(5, BARD_HIP_Y, 'bard-leg');
    this.bardLegRight.setOrigin(0.5, 0.08);

    const torso = this.add.image(0, -44, 'bard-torso');
    this.bardLute = this.add.image(4, -39, 'bard-lute');
    this.bardLute.setAngle(BARD_LUTE_ANGLE_DEG);
    const head = this.add.image(2, -66, 'bard-head');
    this.bardUpper = this.add.container(0, 0, [torso, this.bardLute, head]);

    this.bard = this.add.container(0, 0, [this.bardLegLeft, this.bardLegRight, this.bardUpper]);
    this.bard.setScale(BARD_SCALE);
  }

  /**
   * Swaps the bard's walk/idle animation (ROADMAP task 30). Walking: legs
   * swing at the hips at one footfall per beat (cadence shared with the
   * ground scroll and the music — see BARD_WALK_STEP_MS), while the upper
   * body dips once per footfall (half the leg period) and rocks gently
   * with the stride. Idle: a slow breathing pulse plus a small lute sway,
   * so the bard never reads as frozen.
   */
  private setBardAnimState(walking: boolean): void {
    this.bardTweens.forEach((tween) => tween.stop());
    this.bardTweens = [];
    this.bardLegLeft.setAngle(0);
    this.bardLegRight.setAngle(0);
    this.bardUpper.setPosition(0, 0);
    this.bardUpper.setAngle(0);
    this.bardUpper.setScale(1, 1);
    this.bardLute.setAngle(BARD_LUTE_ANGLE_DEG);

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
          targets: this.bardUpper,
          y: { from: 0, to: -BARD_WALK_BOB_PX },
          duration: BARD_WALK_STEP_MS / 2,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
        this.tweens.add({
          targets: this.bardUpper,
          angle: { from: -BARD_WALK_ROCK_DEG, to: BARD_WALK_ROCK_DEG },
          duration: BARD_WALK_STEP_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      );
    } else {
      this.bardTweens.push(
        this.tweens.add({
          targets: this.bardUpper,
          scaleY: { from: 1, to: 1.03 },
          scaleX: { from: 1, to: 0.99 },
          duration: BARD_IDLE_BREATH_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
        this.startIdleLuteSway()
      );
    }
  }

  /** The lute's slow idle sway, factored out so a hit's one-shot strum tween (which stops it) can restart it afterward. */
  private startIdleLuteSway(): Phaser.Tweens.Tween {
    return this.tweens.add({
      targets: this.bardLute,
      angle: { from: BARD_LUTE_ANGLE_DEG - 2, to: BARD_LUTE_ANGLE_DEG + 2 },
      duration: BARD_IDLE_BREATH_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * A hit's visual twin to AudioEngine.pluck (ROADMAP idea backlog: "strum
   * on hit"): the lute kicks toward the strings and springs back, as if the
   * chord was just struck. Stops whatever's currently animating the lute's
   * angle first (the idle sway, or a previous strum still settling) so the
   * two don't fight over the same property; if the bard is idle when the
   * strum finishes, restarts the idle sway so it doesn't go still.
   */
  private strumLute(): void {
    this.tweens.killTweensOf(this.bardLute);
    this.tweens.add({
      targets: this.bardLute,
      angle: { from: BARD_LUTE_ANGLE_DEG - BARD_STRUM_KICK_DEG, to: BARD_LUTE_ANGLE_DEG },
      duration: BARD_STRUM_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.walking) {
          this.bardTweens.push(this.startIdleLuteSway());
        }
      },
    });
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
    const nowMs = this.time.now - this.startTimeMs;
    this.audioEngine.start(BPM, BEAT_BATCH_SIZE, this.currentBiomeId(), nowMs);
    this.dismissHint();
    const target = this.markers.find(
      (m) => m.resolved === null && isWithinHitWindow(m.beat, nowMs, HIT_WINDOW_MS)
    );
    if (target) {
      target.resolved = 'hit';
      this.meter = applyHit(this.meter, this.meterConfig);
      this.audioEngine.pluck(this.currentBiomeId(), target.beat.index);
      this.strumLute();
      if (target.gfx) {
        // A struck note pulses once — lands big, settles back — so a hit
        // feels like plucking the note out of the air (ROADMAP task 32).
        target.gfx.setTint(NOTE_TINT_HIT);
        this.tweens.add({
          targets: target.gfx,
          scale: { from: 1.35, to: 1 },
          duration: 160,
          ease: 'Sine.easeOut',
        });
      }
    }
    this.flashHitLine(target ? NOTE_TINT_HIT : 0x555555);
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
    this.muteIcon.setTint(this.audioEngine.isMuted ? MUTE_ICON_COLOR_MUTED : MUTE_ICON_COLOR_ON);
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
    // The dusk cycle darkens the world — sky, scenery, road — but never
    // the bard or the notation: warmth belongs to the bard and the music
    // (DESIGN.md art direction), so the character carries their own light
    // through the deepest part of the night (ROADMAP task 36).
    const shade = duskShadeAt(this.distancePx);
    const skyColor = RoadScene.lerpColor(
      BIOMES[blend.fromIndex].skyColor,
      BIOMES[blend.toIndex].skyColor,
      blend.ratio
    );
    this.cameras.main.setBackgroundColor(RoadScene.lerpColor(skyColor, 0x000000, 1 - shade));
    const worldTint = RoadScene.lerpColor(0xffffff, 0x000000, 1 - shade);
    this.scenery.setTint(worldTint);
    this.sceneryNext.setTint(worldTint);
    this.road.setTint(worldTint);
    this.roadNext.setTint(worldTint);

    this.updateSky(delta);
    this.updateScenery(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
    this.updateRoad(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
    this.hitLine.setPosition(hitLineX, laneY);
    this.flash.setPosition(hitLineX, laneY);
    this.flash.setSize(6, HIT_LINE_HEIGHT);
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
        marker.gfx?.setTint(NOTE_TINT_MISS);
        marker.gfx?.setAlpha(0.75);
        this.meter = applyMiss(this.meter, this.meterConfig);
      }

      if (!marker.gfx) {
        const tint =
          marker.resolved === 'hit' ? NOTE_TINT_HIT : marker.resolved === 'miss' ? NOTE_TINT_MISS : NOTE_TINT_UPCOMING;
        marker.gfx = this.add.image(0, laneY, 'note-glyph');
        marker.gfx.setTint(tint);
        if (marker.resolved === 'miss') marker.gfx.setAlpha(0.75);
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

  /**
   * Stars drift at STAR_PARALLAX of road speed while walking; the moon
   * holds still (ROADMAP task 34). As the dusk cycle deepens toward
   * night, the stars and moon brighten while the world darkens — the sky
   * inverts the ground's shade (ROADMAP task 36).
   */
  private updateSky(delta: number): void {
    const nightness = nightnessAt(this.distancePx);
    this.stars.setPosition(this.scale.width / 2, STAR_FIELD_HEIGHT / 2);
    this.stars.setSize(this.scale.width, STAR_FIELD_HEIGHT);
    this.stars.setAlpha(0.75 + 0.25 * nightness);
    const moonX = this.scale.width * MOON_X_FRACTION;
    this.moon.setPosition(moonX, MOON_Y);
    this.moon.setAlpha(0.8 + 0.2 * nightness);
    this.moonGlow.setPosition(moonX, MOON_Y);
    this.moonGlow.setAlpha(0.1 + 0.14 * nightness);
    if (this.walking) {
      this.stars.tilePositionX += (ROAD_SCROLL_PX_PER_SEC * STAR_PARALLAX * delta) / 1000;
    }
  }

  /**
   * Scenery band mirrors updateRoad's two-TileSprite crossfade, but
   * scrolls at SCENERY_PARALLAX of the road speed — background features
   * sliding slower than the ground is what makes the road read as nearer
   * than the houses/trees/water (ROADMAP task 31). Its bottom edge sits on
   * the road band's top edge.
   */
  private updateScenery(laneY: number, delta: number, fromIndex: number, toIndex: number, ratio: number): void {
    if (fromIndex !== this.sceneryFromIndex) {
      this.sceneryFromIndex = fromIndex;
      this.scenery.setTexture(this.sceneryTileTexture(BIOMES[fromIndex]));
    }
    if (toIndex !== this.sceneryToIndex) {
      this.sceneryToIndex = toIndex;
      this.sceneryNext.setTexture(this.sceneryTileTexture(BIOMES[toIndex]));
    }

    const roadTopY = laneY + BARD_GROUND_Y_OFFSET - ROAD_HEIGHT_BELOW_BARD / 2;
    const sceneryY = roadTopY - SCENERY_TILE_HEIGHT / 2;
    this.scenery.setPosition(this.scale.width / 2, sceneryY);
    this.scenery.setSize(this.scale.width, SCENERY_TILE_HEIGHT);
    this.sceneryNext.setPosition(this.scale.width / 2, sceneryY);
    this.sceneryNext.setSize(this.scale.width, SCENERY_TILE_HEIGHT);
    this.sceneryNext.setAlpha(ratio);
    if (this.walking) {
      const scrollDelta = (ROAD_SCROLL_PX_PER_SEC * SCENERY_PARALLAX * delta) / 1000;
      this.scenery.tilePositionX += scrollDelta;
      this.sceneryNext.tilePositionX += scrollDelta;
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

    const lineCount = this.meterStaffLines.length;
    for (let i = 0; i < lineCount; i++) {
      const y = METER_MARGIN_TOP - METER_HEIGHT / 2 + ((i + 1) * METER_HEIGHT) / (lineCount + 1);
      this.meterStaffLines[i].setPosition(centerX, y);
      this.meterStaffLines[i].setSize(trackWidth, METER_STAFF_LINE_THICKNESS);
    }
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
