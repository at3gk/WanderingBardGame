import Phaser from 'phaser';
import { AudioEngine } from '../audio/AudioEngine';
import { AUDIO_MANIFEST } from '../audio/manifest';
import {
  HIT_WINDOW_MS,
  isBeatMissed,
  isWithinHitWindow,
  scrollProgress,
  TRAVEL_TIME_MS,
  wasUnplayable,
} from '../core/beats';
import { expandSong, Song, SongBeat, songDurationMs } from '../core/song';
import { homeBiomeOf, SongChoice, songForPass } from '../core/songChoice';
import { FreePlayStaff } from '../core/freePlay';
import { HUD_TOUCH_TARGET, hudLayout } from '../core/hud';
import { ROAD_HEIGHT, worldLayout } from '../core/worldLayout';
import { applyHit, applyMiss, DEFAULT_SONG_METER_CONFIG, isWalking, SongMeterConfig } from '../core/songMeter';
import { accumulateDistance } from '../core/distance';
import { BIOMES, biomeBlendAt, BIOME_TRANSITIONS, signpostDistanceAt } from '../core/biome';
import { duskShadeAt, nightnessAt } from '../core/dusk';
import { accumulateCoins, crossedCoinMilestone } from '../core/coins';
import { noteNameAt, staffStepAt, STAFF_LINE_STEPS, stemDown } from '../core/notation';
import {
  NOTE_HEAD_INSET_Y,
  NOTE_ORIGIN_X,
  NOTE_TEX_H,
  NOTE_TINT_HIT,
  NOTE_TINT_MISS,
  NOTE_TINT_UPCOMING,
  noteTexture,
  restTexture,
  STAFF_LINE_GAP,
} from '../render/engraving';
import {
  FAR_TILE_HEIGHT,
  farTileTexture,
  nearTileTexture,
  NEAR_TILE_HEIGHT,
  glintTexture,
  moonTexture,
  ROAD_TILE_WIDTH,
  roadTileTexture,
  SCENERY_TILE_HEIGHT,
  sceneryTileTexture,
  SIGNPOST_WIDTH,
  signpostTexture,
  STAR_FIELD_HEIGHT,
  starFieldTexture,
} from '../render/scenery';
import { createStyleTextures, freePlayTexture, HIT_LINE_HEIGHT, songbookTexture } from '../render/ui';
import { displaySupport, encounter, leadMsFor, ScaffoldState, supportFor } from '../core/scaffold';
import { getSongChoice, loadScaffold, saveScaffold, setSongChoice } from '../core/scaffoldStorage';
import { closePicker as closePickerOverlay, openPicker as openPickerOverlay, PICKER_CHOSEN_BG } from './picker';
import {
  buildFreeStaff as buildFreeStaffOverlay,
  dropScrim as dropScrimOverlay,
  fadeInFreeStaff as fadeInFreeStaffOverlay,
  FREEPLAY_DEPTH,
  layoutScrim as layoutScrimOverlay,
  playFreeNote as playFreeNoteOverlay,
  raiseScrim as raiseScrimOverlay,
  tearDownFreeStaff as tearDownFreeStaffOverlay,
} from './freePlayOverlay';
import { createMeterBar, layoutMeterBar, setMeterBarVisible } from './meterBar';

const BPM = 96;
const MS_PER_BEAT = 60000 / BPM;
// How far ahead of the music the next song pass is queued. Comfortably
// more than one frame and less than the shortest song, so there is always
// runway without the schedule running far ahead of the walk.
const BEAT_LOOKAHEAD_MS = 15000;
// TRAVEL_TIME_MS and HIT_WINDOW_MS (±90ms — human playtest 2026-07-25 found
// 120ms read as "too loose") now live in core/beats.ts, because the
// scaffold's reveal schedule is measured against them and the relationship
// between the two is a tested invariant rather than a coincidence.
const MARKER_RADIUS = 18;
// One visual language for everything the player reads or touches
// (ROADMAP task 32): beat markers are eighth notes, the coin is stamped
// with a note, the mute toggle is a note. The glyph texture is drawn
// white and tinted per use. NOTE_TINT_* live in render/engraving.ts,
// shared with free play's own notes (src/scenes/freePlayOverlay.ts).
// The staff lane (ROADMAP task 42; DESIGN.md Pedagogy): the lane is a real
// treble staff. Markers are quarter notes at their true pitch position,
// letters baked dark into the heads so tints never eat them. The staff's
// middle line (B4, step 6) sits on laneY; steps come from
// core/notation.ts (STAFF_LINE_STEPS is shared with free play's ladder).
// Notation is never darkened by the dusk cycle and never wrong — kids
// learn from this screen.
// Roomy for young eyes: the staff gap sets the size of everything on it
// (heads are one gap tall, as in real engraving), so this is the single
// dial for notation legibility. 18px keeps the whole staff inside a phone
// viewport while making letters comfortably readable.
const STAFF_HALF_GAP = STAFF_LINE_GAP / 2;
const STAFF_MIDDLE_STEP = 6;
const STAFF_LINE_ALPHA = 0.22;
const SONG_TITLE_HOLD_MS = 2600;
// A note fades out once it's past the line and is gone before it reaches
// the clef — on a narrow phone the lane's left end is only a few dozen
// pixels past the hit line, and played notes used to pile over the clef.
const EXIT_PROGRESS = 1.28;
/** Mute, songbook, lute — the whole of the game's chrome. */
const HUD_BUTTON_COUNT = 3;
// The meter's own constants (METER_HEIGHT, METER_FILL_COLOR*, METER_STAFF_LINE_*)
// live in ./meterBar alongside the three GameObjects and functions that use
// them (ROADMAP task 111) — see that module's header for why it split out.
// A contact shadow. Without one the bard reads as pasted on top of the road
// rather than standing on it — the single cheapest thing that grounds a
// character. It is a soft ellipse in the road's own darker dash colour, not
// black: nothing else in this world is black, and a black smudge under a
// warm little figure looks like a hole.
const BARD_SHADOW_W = 34;
const BARD_SHADOW_H = 8;
const BARD_SHADOW_ALPHA = 0.32;
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
/**
 * How long the limbs take to ease into the next cycle's opening pose.
 * Well under one beat (625ms at 96 BPM), so starting to walk still looks
 * immediate — it is the jolt that is being removed, not the response.
 */
const BARD_SETTLE_MS = 150;
const ROAD_SCROLL_PX_PER_SEC = ROAD_TILE_WIDTH / (MS_PER_BEAT / 1000);
// The verge is nearer the camera than the road, so it has to move faster —
// that difference is the whole depth cue. 1.35 rather than a round number
// so the 448px near tile and the 64px road tile never settle into a shared
// period: 448 / (64 * 1.35) is 5.19 beats, which does not line up with
// anything else on screen.
const NEAR_PARALLAX = 1.35;
// Background scenery band (ROADMAP task 31): silhouette features sitting on
// the horizon, scrolling slower than the road so the world reads as having
// depth. One repeating tile per biome, crossfaded exactly like the road.
const SCENERY_PARALLAX = 0.45;
// Riverside water shimmer (ROADMAP idea backlog): the glints live in two
// layers pulsed at opposite phases, slow enough to read as water moving
// rather than a light blinking.
const GLINT_PERIOD_MS = 3400;
const GLINT_ALPHA = 0.85;
const GLINT_MIN_ALPHA = 0.25;
const RIVERSIDE_GLINT_COLOR = 0x5da8c9;
// Night sky (ROADMAP task 34): a starfield drifting far slower than the
// scenery — three scroll speeds (road 1x, scenery 0.45x, stars 0.08x)
// is what turns two flat bands into a world with depth. The moon doesn't
// move at all; it's the moon.
const STAR_PARALLAX = 0.08;
// The far ridge sits between the stars and the scenery, filling what was a
// conspicuous gap in the depth range (0.08 -> 0.45). Its rate is chosen NOT
// to divide neatly into the scenery's: two backgrounds repeating at rates
// with no common period never line up into a visible beat, which is the
// cheapest way to stop a tiled background looking tiled.
const FAR_PARALLAX = 0.19;
// Signposts at transitions (idea backlog): a small silhouette marker spawns
// at the screen's right edge the instant a biome transition starts and
// scrolls by at the scenery band's own parallax rate — the world announcing
// the next vignette. A pool of 2 is comfortably more than the 1 that's ever
// on screen at once (transitions are 5000px apart; a signpost takes far less
// distance than that to cross the screen at SCENERY_PARALLAX), so no
// unbounded array is needed.
const SIGNPOST_POOL_SIZE = 2;
const MOON_X_FRACTION = 0.78;
const MOON_RADIUS = 24;
/** The soft halo drawn around the moon, which is what actually collides. */
const MOON_GLOW_PAD = 14;
/** Half the song title's line height — enough to find its lower edge. */
const SONG_TITLE_HALF_HEIGHT = 8;
/** Breathing room between the moon and whatever it is avoiding. */
const SKY_CLEARANCE = 10;
/** Highest staff line (F5), the top of the notation. */
const STAFF_TOP_LINE_STEP = 10;
const COIN_RATE_PER_SEC = 5;
const COIN_CHIME_EVERY = 25;
const COIN_ICON_RADIUS = 8;
const COIN_MARGIN_TOP = 24;
const COIN_MARGIN_RIGHT = 24;
const MUTE_ICON_RADIUS = 10;
const MUTE_ICON_COLOR_ON = 0xe8d9c0;
const MUTE_ICON_COLOR_MUTED = 0x554e63;
const MUTE_SLASH_COLOR = 0x8a5a5a;
const DISTANCE_MARGIN_LEFT = 24;
const DISTANCE_MARGIN_BOTTOM = 20;
// Now that the lane is a staff, the instruction can name what the player
// is actually looking at — and it doubles as the first thing that tells a
// new reader those shapes are notes.
const HINT_TEXT = 'tap when a note reaches the line';
// Songbook picker (choose one song to learn instead of letting them
// rotate). Sits beside the mute toggle, same 44px touch target — the two
// are the only chrome in the game and they belong together.
const BOOK_ICON_RADIUS = 11;
// PICKER_* constants (backdrop, layout, depth, fade) live in ./picker
// alongside the overlay itself; PICKER_CHOSEN_BG is imported above since
// it is also reused as a general "highlight gold" outside the picker.
// Free play's own chrome (staff, scrim, hint text — FREEPLAY_* /
// FREE_HINT_TEXT*) lives in ./freePlayOverlay; FREEPLAY_DEPTH is imported
// above since HUD_DEPTH below is defined relative to it.
/**
 * The heads-up chrome rides above the practice scrim. The lute button is
 * the way *back* to the walk, so dimming it by 62% would dim the exit; the
 * song title names the tune being practised and has to stay readable. The
 * world is what steps back in this mode, not the controls.
 */
const HUD_DEPTH = FREEPLAY_DEPTH + 50;
const HINT_Y_OFFSET = -92;
const HINT_FADE_MS = 400;
// Strum on hit (ROADMAP idea backlog): the visual twin of AudioEngine.pluck
// — the lute kicks toward the strings and springs back, as if the hit just
// struck a chord. Tiny tween, reuses the existing lute image, no new texture.
// A child whose meter has been on the floor this long isn't struggling with
// one note, they're lost — every letter comes back until they're walking.
const LOST_GRACE_MS = 4000;
// More misses than this in a single frame means the tab was asleep, not that
// the child forgot a fistful of notes at once.
const MASS_MISS_LIMIT = 2;
const BARD_STRUM_KICK_DEG = 14;
const BARD_STRUM_MS = 140;

interface BeatMarker {
  beat: SongBeat;
  gfx: Phaser.GameObjects.Image | null;
  /** A rest is born resolved: it scrolls past like a note but is never tapped and never missed. */
  resolved: 'hit' | 'miss' | 'rest' | null;
  /** Diatonic staff step (core/notation.ts) — fixes the marker's y on the staff. */
  step: number;
  /** Texture key for this marker's engraved note (head, letter, stem, ledger baked). */
  texKey: string;
  /** Same note engraved without its letter — the faded-scaffold variant. */
  bareTexKey?: string;
  /** Game time at which this note's letter becomes readable (see core/scaffold.ts). */
  revealAtMs?: number;
  /** Whether the letter is currently showing, so the swap happens once. */
  lettered?: boolean;
  /** First sighting of this staff position within the current pass of the tune. */
  firstInPass?: boolean;
}

/**
 * The learning record outlives the scene. This was built on the assumption
 * that `create()` re-runs on a resize (main.ts uses Scale.RESIZE, so an
 * orientation change was believed enough) — `tools/rotate-check.mjs` now
 * verifies that assumption directly and it does not hold in headless
 * testing (`create()` fires exactly once). Kept at module scope anyway:
 * it costs nothing, and this can't rule out a real device behaving
 * differently under actual WebGL context loss. Resetting a child's
 * progress because they turned the phone would be a silent, invisible
 * bug either way.
 */
const scaffold: ScaffoldState = loadScaffold();

export class RoadScene extends Phaser.Scene {
  private startTimeMs = 0;
  private markers: BeatMarker[] = [];
  private hitLine!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private meterConfig: SongMeterConfig = DEFAULT_SONG_METER_CONFIG;
  private meter = DEFAULT_SONG_METER_CONFIG.max;
  /**
   * The song meter's three parts. Not `private` — `./meterBar`'s functions
   * read and write these directly via the `MeterBarHost` interface (a
   * private class field can't satisfy a plain interface type, same reason
   * as `pickerParts`/`freeParts` below), and `tools/hud-check.mjs` also
   * reaches `meterTrack` directly to check the chrome doesn't overlap
   * itself.
   */
  meterTrack!: Phaser.GameObjects.Rectangle;
  meterFill!: Phaser.GameObjects.Rectangle;
  meterStaffLines: Phaser.GameObjects.Rectangle[] = [];
  private staffLines: Phaser.GameObjects.Rectangle[] = [];
  private clef!: Phaser.GameObjects.Image;
  private road!: Phaser.GameObjects.TileSprite;
  private roadNext!: Phaser.GameObjects.TileSprite;
  private roadFromIndex = 0;
  private roadToIndex = 0;
  private scenery!: Phaser.GameObjects.TileSprite;
  private sceneryNext!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private nearNext!: Phaser.GameObjects.TileSprite;
  private nearFromIndex = 0;
  private nearToIndex = 0;
  private farNext!: Phaser.GameObjects.TileSprite;
  private farFromIndex = 0;
  private farToIndex = 0;
  private sceneryFromIndex = 0;
  private sceneryToIndex = 0;
  private sceneryGlints: Phaser.GameObjects.TileSprite[] = [];
  private signposts: Phaser.GameObjects.Image[] = [];
  private signpostSpawnDistancePx: number[] = [];
  private nextSignpostCount = 0;
  private stars!: Phaser.GameObjects.TileSprite;
  private moon!: Phaser.GameObjects.Image;
  private moonGlow!: Phaser.GameObjects.Arc;
  private distancePx = 0;
  /**
   * The song the child is learning, or null to wander. Held at scene level
   * (not module level like the scaffold) because unlike learning progress
   * it is cheap to re-read from storage — kept that way even though
   * `tools/rotate-check.mjs` no longer supports the "create() re-runs on
   * resize" premise this was written under (see the scaffold's own
   * comment above `scaffold`).
   */
  /**
   * Not `private` — `./freePlayOverlay`'s `buildFreeStaff` reads this
   * directly via the `FreePlayOverlayHost` interface, same reason as the
   * free-play fields below.
   */
  songChoice: SongChoice = null;
  private bookIcon!: Phaser.GameObjects.Image;
  private bookZone!: Phaser.GameObjects.Zone;
  /**
   * Every object making up the picker overlay, so it can be torn down as
   * one. Not `private` — `./picker`'s `openPicker`/`closePicker` read and
   * write these directly via the `PickerHost` interface, which is a plain
   * object type and so cannot accept a private class member.
   */
  pickerParts: Phaser.GameObjects.GameObject[] = [];
  pickerOpen = false;
  /** 'walk' is the road; 'play' is the staff as an instrument. */
  private mode: 'walk' | 'play' = 'walk';
  private luteIcon!: Phaser.GameObjects.Image;
  private luteZone!: Phaser.GameObjects.Zone;
  /**
   * The free-play staff's own state. Not `private` — `./freePlayOverlay`'s
   * functions read and write these directly via the `FreePlayOverlayHost`
   * interface, the same shape of split as the picker above.
   */
  freeParts: Phaser.GameObjects.GameObject[] = [];
  freeStaff: FreePlayStaff | null = null;
  freeScrim: Phaser.GameObjects.Rectangle | null = null;
  /** The chosen song as positions to find, and how far through it the child is. */
  freeSequence: number[] = [];
  freeIndex = 0;
  /** The pip marking the note to look for, kept so it can be moved rather than rebuilt. */
  freeCursor: Phaser.GameObjects.Arc | null = null;
  /** The song's note markers, kept so finishing the tune can ripple through them. */
  freePips: Phaser.GameObjects.Arc[] = [];
  freeHint: Phaser.GameObjects.Text | null = null;
  /** Notes written out so far in practice, and which line they belong to. */
  freeWritten: Phaser.GameObjects.Image[] = [];
  freeWrittenLine = 0;
  private totalNotesGenerated = 0;
  private nextPassStartTimeMs = 0;
  private currentSongId: string | null = null;
  /** How many passes each biome has played, so its set rotates rather than repeating one tune. */
  private passesByBiome = new Map<string, number>();
  /** When the meter first fell below walking, so "lost" can be distinguished from "one bad note". */
  private lostSinceMs: number | null = null;
  /** Not `private` — the free-play overlay also names the tune being practised here. */
  songTitleText!: Phaser.GameObjects.Text;
  private pendingAnnounce: Array<{ atMs: number; title: string }> = [];
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
  private bardShadow!: Phaser.GameObjects.Ellipse;
  private bardWasWalking: boolean | null = null;
  private bardAnimToken = 0;
  /** Not `private` — `./freePlayOverlay`'s functions call `pluck`/`chime` on this directly. */
  audioEngine = new AudioEngine(AUDIO_MANIFEST);

  constructor() {
    super('RoadScene');
  }

  /** Walking-vs-stopped state derived from the song meter, per DESIGN.md. Read by later tasks (bard sprite, road scroll). */
  get walking(): boolean {
    // The bard stands still to play. Free play has no beat to keep, so
    // there is nothing for walking to mean — and a bard striding along
    // while the child picks notes off a stationary staff would be the
    // world contradicting what they are doing.
    if (this.mode === 'play') return false;
    return isWalking(this.meter, this.meterConfig);
  }

  create(): void {
    createStyleTextures(this);
    this.cameras.main.setBackgroundColor(BIOMES[0].skyColor);
    this.startTimeMs = this.time.now;
    this.meter = this.meterConfig.max;
    this.distancePx = 0;
    this.markers = [];
    // Read back the song the child last chose. `loadScaffold` runs once per
    // page (module scope, so a resize cannot wipe progress), and it parses
    // the choice out of the same record — so this is just picking it up.
    this.songChoice = getSongChoice();
    this.pickerOpen = false;
    this.pickerParts = [];
    this.totalNotesGenerated = 0;
    this.nextPassStartTimeMs = 0;
    this.currentSongId = null;
    this.passesByBiome.clear();

    this.stars = this.add.tileSprite(0, 0, this.scale.width, STAR_FIELD_HEIGHT, starFieldTexture(this));
    this.moonGlow = this.add.circle(0, 0, MOON_RADIUS + MOON_GLOW_PAD, 0xe8d9c0, 1);
    this.moon = this.add.image(0, 0, moonTexture(this, MOON_RADIUS));

    this.sceneryFromIndex = 0;
    this.sceneryToIndex = 0;
    this.far = this.add.tileSprite(0, 0, this.scale.width, FAR_TILE_HEIGHT, farTileTexture(this, BIOMES[0]));
    this.farNext = this.add.tileSprite(0, 0, this.scale.width, FAR_TILE_HEIGHT, farTileTexture(this, BIOMES[0]));
    this.farNext.setAlpha(0);
    this.scenery = this.add.tileSprite(0, 0, this.scale.width, SCENERY_TILE_HEIGHT, sceneryTileTexture(this, BIOMES[0]));
    this.sceneryNext = this.add.tileSprite(0, 0, this.scale.width, SCENERY_TILE_HEIGHT, sceneryTileTexture(this, BIOMES[0]));
    this.sceneryNext.setAlpha(0);
    this.sceneryGlints = [0, 1].map((half) => {
      const t = this.add.tileSprite(0, 0, this.scale.width, SCENERY_TILE_HEIGHT, glintTexture(this, half as 0 | 1));
      t.setAlpha(0);
      return t;
    });

    // Created here (after the scenery band, before the road) so their display-list
    // position — not an explicit depth — paints them in front of the scenery
    // silhouettes and behind the road/bard/UI, matching every other layer in this scene.
    this.nextSignpostCount = 0;
    this.signposts = Array.from({ length: SIGNPOST_POOL_SIZE }, () => {
      const img = this.add.image(0, 0, signpostTexture(this));
      img.setOrigin(0.5, 1);
      img.setVisible(false);
      return img;
    });
    this.signpostSpawnDistancePx = this.signposts.map(() => -Infinity);

    this.roadFromIndex = 0;
    this.roadToIndex = 0;
    this.road = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT, roadTileTexture(this, BIOMES[0]));
    this.roadNext = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT, roadTileTexture(this, BIOMES[0]));
    this.roadNext.setAlpha(0);

    // After the road, so the display list paints the near band in front of
    // it — it is the one plane closer to the camera than the road — and
    // still behind the bard, who walks on the road rather than in the verge.
    this.nearFromIndex = 0;
    this.nearToIndex = 0;
    this.near = this.add.tileSprite(0, 0, this.scale.width, NEAR_TILE_HEIGHT, nearTileTexture(this, BIOMES[0]));
    this.nearNext = this.add.tileSprite(0, 0, this.scale.width, NEAR_TILE_HEIGHT, nearTileTexture(this, BIOMES[0]));
    this.nearNext.setAlpha(0);

    this.staffLines = STAFF_LINE_STEPS.map(() =>
      this.add.rectangle(0, 0, this.scale.width, 1.5, 0xe8d9c0, STAFF_LINE_ALPHA)
    );
    this.clef = this.add.image(0, 0, 'treble-clef');
    this.clef.setOrigin(0.5, 12 / 104);
    // The clef texture is drawn against a 7px half-gap staff; scale it to
    // whatever the staff actually uses so its spiral keeps sitting on G.
    this.clef.setScale(STAFF_HALF_GAP / 7);
    this.clef.setTint(NOTE_TINT_UPCOMING);
    this.clef.setAlpha(0.5);

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

    this.pendingAnnounce = [];
    this.songTitleText = this.add.text(0, hudLayout(this.scale.width, HUD_BUTTON_COUNT).titleY, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'italic',
      color: '#e8d9c0',
    });
    this.songTitleText.setOrigin(0.5, 0.5);
    this.songTitleText.setAlpha(0);
    this.appendSongPass();

    createMeterBar(this);

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
    // One rule for the whole bar (see core/hud.ts). The buttons used to
    // count pixels from the left while the meter centred itself at 60%
    // width; on a phone those two rules put the meter track straight over
    // the songbook and lute buttons.
    const hud = hudLayout(this.scale.width, HUD_BUTTON_COUNT);
    const [muteIconX, bookX, luteX] = hud.iconXs;

    this.muteIcon.setPosition(muteIconX, hud.iconY);
    this.muteSlash.setPosition(muteIconX, hud.iconY);
    this.muteZone = this.add.zone(muteIconX, hud.iconY, HUD_TOUCH_TARGET, HUD_TOUCH_TARGET);
    this.muteZone.setInteractive({ useHandCursor: true });

    this.bookIcon = this.add.image(bookX, hud.iconY, songbookTexture(this));
    this.bookIcon.setScale((BOOK_ICON_RADIUS * 2) / 26);
    this.bookIcon.setTint(MUTE_ICON_COLOR_ON);
    this.bookZone = this.add.zone(bookX, hud.iconY, HUD_TOUCH_TARGET, HUD_TOUCH_TARGET);
    this.bookZone.setInteractive({ useHandCursor: true });

    this.luteIcon = this.add.image(luteX, hud.iconY, freePlayTexture(this));
    this.luteIcon.setScale((BOOK_ICON_RADIUS * 2) / 26);
    this.luteIcon.setTint(this.mode === 'play' ? PICKER_CHOSEN_BG : MUTE_ICON_COLOR_ON);
    this.luteZone = this.add.zone(luteX, hud.iconY, HUD_TOUCH_TARGET, HUD_TOUCH_TARGET);
    this.luteZone.setInteractive({ useHandCursor: true });

    // One plane for the whole bar, above the practice scrim (see HUD_DEPTH).
    for (const part of [this.muteIcon, this.muteSlash, this.bookIcon, this.luteIcon,
                        this.coinIcon, this.coinText, this.songTitleText, this.distanceText]) {
      part.setDepth(HUD_DEPTH);
    }

    this.createBard();
    this.bardWasWalking = this.walking;
    this.setBardAnimState(this.bardWasWalking);

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      // The picker swallows every tap while it is open — a child poking at
      // a song list must not be playing notes through it, and must not be
      // charged misses for the ones scrolling past behind it.
      if (this.pickerOpen) return;
      if (currentlyOver.includes(this.muteZone)) {
        this.toggleMute();
        return;
      }
      if (currentlyOver.includes(this.bookZone)) {
        this.openPicker();
        return;
      }
      if (currentlyOver.includes(this.luteZone)) {
        if (this.mode === 'play') this.exitFreePlay();
        else this.enterFreePlay();
        return;
      }
      if (this.mode === 'play') {
        this.playFreeNote(_pointer.y, _pointer.x);
        return;
      }
      this.handleInput();
    });
    // Without addCapture, Space's default browser action (scroll the page) fires
    // alongside every keyboard beat hit, fighting the "keyboard works on desktop" pillar.
    this.input.keyboard?.addCapture('SPACE');
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.pickerOpen || this.mode === 'play') return;
      this.handleInput();
    });

    // The free-play staff is laid out once, from the height available. The
    // walk's own staff is recomputed every frame so it rides a resize for
    // free; this one does not, and after a rotation into landscape it was
    // still spread for a portrait screen — the lowest notes ran off the
    // bottom and could not be reached at all.
    //
    // The picker is closed rather than re-laid-out: a rotation is a big
    // enough change of context that reappearing in a new shape is more
    // startling than simply being dismissed, and it is one tap to reopen.
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      if (this.pickerOpen) this.closePicker();
      if (this.mode === 'play') {
        layoutScrimOverlay(this);
        buildFreeStaffOverlay(this, false);
      }
    });

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
    } else {
      // Leaving may be the last chance to write; the throttle doesn't apply.
      saveScaffold(scaffold, true);
    }
  };



  /**
   * How much of the riverside is on screen right now (0–1), so its water
   * only glints while there is water to glint on — including part-way
   * through a crossfade.
   */
  private riversidePresence(fromIndex: number, toIndex: number, ratio: number): number {
    const isRiver = (i: number) => BIOMES[i]?.id === 'riverside';
    if (isRiver(fromIndex) && isRiver(toIndex)) return 1;
    if (isRiver(toIndex)) return ratio;
    if (isRiver(fromIndex)) return 1 - ratio;
    return 0;
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

    // Added before the bard so it sits under him in the display list.
    this.bardShadow = this.add.ellipse(0, 0, BARD_SHADOW_W, BARD_SHADOW_H, 0x000000, BARD_SHADOW_ALPHA);
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
  /**
   * Changes what the bard is doing, without the jolt.
   *
   * This used to snap every limb to neutral on the same frame the state
   * changed, then start the new cycle — so stopping froze him mid-stride
   * with his legs slamming shut, and starting teleported a leg out to a
   * full swing before the first step. The meter empties and refills often
   * enough that both were visible several times a minute.
   *
   * Now the limbs are eased to wherever the next cycle begins, and the
   * cycle starts from there. Settling toward the *walk's* starting pose
   * rather than toward neutral is what keeps the first stride from
   * teleporting: the tween that follows begins at exactly the angles the
   * settle left the legs at.
   */
  private setBardAnimState(walking: boolean): void {
    this.bardTweens.forEach((tween) => tween.stop());
    this.bardTweens = [];
    this.bardLute.setAngle(BARD_LUTE_ANGLE_DEG);

    // A later state change must not have its cycle started by an earlier
    // settle finishing — the meter can cross the walking threshold twice
    // inside one settle.
    const token = ++this.bardAnimToken;
    const begin = () => {
      if (this.bardAnimToken === token) this.beginBardCycle(walking);
    };

    this.bardTweens.push(
      this.tweens.add({
        targets: this.bardLegLeft,
        angle: walking ? -BARD_WALK_SWING_DEG : 0,
        duration: BARD_SETTLE_MS,
        ease: 'Sine.easeOut',
      }),
      this.tweens.add({
        targets: this.bardLegRight,
        angle: walking ? BARD_WALK_SWING_DEG : 0,
        duration: BARD_SETTLE_MS,
        ease: 'Sine.easeOut',
      }),
      this.tweens.add({
        targets: this.bardUpper,
        y: 0,
        angle: walking ? -BARD_WALK_ROCK_DEG : 0,
        scaleX: 1,
        scaleY: 1,
        duration: BARD_SETTLE_MS,
        ease: 'Sine.easeOut',
        onComplete: begin,
      })
    );
  }

  /** The steady-state loop, once the limbs have been eased into position. */
  private beginBardCycle(walking: boolean): void {
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
  /** Not `private` — `./freePlayOverlay`'s `playFreeNote` calls this on the host. */
  strumLute(): void {
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
    return worldLayout(this.scale.height).laneY;
  }

  /** The bard's feet, and the road's vertical centre (core/worldLayout). */
  private groundY(): number {
    return worldLayout(this.scale.height).groundY;
  }

  /** Y of a diatonic staff step: the staff's middle line (B4, step 6) sits on laneY; each step is half a line gap. */
  private staffY(step: number, laneY: number): number {
    return laneY + (STAFF_MIDDLE_STEP - step) * STAFF_HALF_GAP;
  }

  /**
   * Names the tune as it begins (ROADMAP task 46). Passes are queued a
   * lookahead ahead of time, so the title is held until playback actually
   * reaches the song's first note — then it fades up and away. Knowing
   * you're playing "Twinkle Twinkle Little Star" is most of why a real
   * song teaches better than a pattern.
   */
  private announceSong(song: Song): void {
    if (song.id === this.currentSongId) return;
    this.currentSongId = song.id;
    this.pendingAnnounce.push({ atMs: this.nextPassStartTimeMs - songDurationMs(song, BPM), title: song.title });
  }

  private updateSongTitle(nowMs: number): void {
    this.songTitleText.setPosition(this.scale.width / 2, hudLayout(this.scale.width, HUD_BUTTON_COUNT).titleY);
    while (this.pendingAnnounce.length > 0 && this.pendingAnnounce[0].atMs <= nowMs) {
      const announcement = this.pendingAnnounce.shift()!;
      this.songTitleText.setText(announcement.title);
      this.songTitleText.setAlpha(0);
      this.tweens.killTweensOf(this.songTitleText);
      this.tweens.add({
        targets: this.songTitleText,
        alpha: { from: 0, to: 0.75 },
        duration: 700,
        yoyo: true,
        hold: SONG_TITLE_HOLD_MS,
      });
    }
  }

  /**
   * Puts the letter back on a note — instantly, because it should feel
   * plucked out of the note along with its pitch. Called when a note is
   * struck, when it is missed, and when its scheduled reveal time arrives.
   *
   * In practice only the scheduled path ever reaches a lettered=false
   * marker: the reveal lead floor (350ms) is larger than the hit window
   * (90ms), so the letter is always already showing by the time a tap can
   * register or a miss can be declared. Measured, not assumed — 86 reveals
   * over a 90s walk, all scheduled, none from strike or miss
   * (tools/reveal-check.mjs). The other two calls are backstops kept for
   * the day those constants change; the relationship between them is
   * pinned by scaffold.test.ts, "the answer always beats the tap".
   */
  private revealLetter(marker: BeatMarker): void {
    if (marker.lettered || !marker.gfx || marker.resolved === 'rest') return;
    marker.lettered = true;
    marker.gfx.setTexture(marker.texKey);
  }

  /**
   * Feeds one played note to the learning model, unless the page was
   * hidden — a throttled requestAnimationFrame in a background tab
   * produces bursts that mean nothing about what a child knows.
   */
  private recordEncounter(step: number, outcome: 'hit' | 'miss', walking: boolean): void {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    encounter(scaffold, step, outcome, walking);
    saveScaffold(scaffold);
  }

  /** Resting alpha for a marker: a miss dims, a rest sits back a little (there's nothing to do about it), a live note is full. */
  private markerBaseAlpha(marker: BeatMarker): number {
    if (marker.resolved === 'miss') return 0.75;
    if (marker.resolved === 'rest') return 0.7;
    return 1;
  }

  /**
   * Origin that puts the note *head* (not the texture center) on the staff
   * position. Not `private` — `./freePlayOverlay` calls this on the host.
   */
  noteOriginY(step: number): number {
    return (stemDown(step) ? NOTE_HEAD_INSET_Y : NOTE_TEX_H - NOTE_HEAD_INSET_Y) / NOTE_TEX_H;
  }

  /** Not `private` — `./freePlayOverlay`'s `playFreeNote` calls this on the host. */
  hitLineX(): number {
    return this.scale.width * 0.25;
  }

  private spawnX(): number {
    return this.scale.width + MARKER_RADIUS * 2;
  }

  private markerX(progress: number): number {
    const spawn = this.spawnX();
    return spawn + progress * (this.hitLineX() - spawn);
  }

  /** The scenery biome the walk is currently in, per ROADMAP task 16 — used to pick which pattern the audio engine's next batch plays. */
  private currentBiomeId(): string {
    return BIOMES[this.currentBlend().fromIndex].id;
  }

  /**
   * Which biome the scenery is showing.
   *
   * Choosing a song settles the road in that song's home biome instead of
   * cycling. The three biomes are the three registers — village around
   * middle C, forest mid-staff, riverside its upper half — so leaving the
   * scenery to wander while the staff stays put would have the world
   * disagree with what the child is reading. Settling somewhere to
   * practise one tune is also just what a bard would do.
   */
  private currentBlend(): { fromIndex: number; toIndex: number; ratio: number } {
    const home = homeBiomeOf(this.songChoice);
    if (home !== null) {
      const idx = Math.max(0, BIOMES.findIndex((b) => b.id === home));
      return { fromIndex: idx, toIndex: idx, ratio: 0 };
    }
    return biomeBlendAt(this.distancePx);
  }

  /**
   * Free play: stop the road, spread the staff out, and let the child pick
   * notes instead of catching them.
   *
   * Entering clears the lane. Notes already in flight belong to a schedule
   * that is about to stop existing, and leaving them to scroll into a
   * stationary staff would be two games at once.
   */
  private enterFreePlay(): void {
    if (this.mode === 'play') return;
    this.mode = 'play';
    this.audioEngine.cancelPending();
    for (const m of this.markers) m.gfx?.destroy();
    this.markers = [];
    this.pendingAnnounce = [];
    this.currentSongId = null;
    this.dismissHint();
    this.luteIcon.setTint(PICKER_CHOSEN_BG);
    this.setWalkChromeVisible(false);
    raiseScrimOverlay(this);
    buildFreeStaffOverlay(this);
    fadeInFreeStaffOverlay(this);
  }

  private exitFreePlay(): void {
    if (this.mode !== 'play') return;
    this.mode = 'walk';
    this.luteIcon.setTint(MUTE_ICON_COLOR_ON);
    dropScrimOverlay(this);
    this.setWalkChromeVisible(true);
    this.songTitleText.setAlpha(0);
    tearDownFreeStaffOverlay(this);
    // Pick the schedule back up from here rather than from wherever it
    // stopped, so the road does not resume with a backlog of notes that
    // were due while the child was playing.
    const nowMs = this.time.now - this.startTimeMs;
    this.nextPassStartTimeMs = nowMs + TRAVEL_TIME_MS;
    this.passesByBiome.clear();
    this.appendSongPass();
  }

  /**
   * Shows or hides the chrome that only means something while walking: the
   * small staff and its clef, the hit line, the meter. Leaving them up
   * behind the big staff drew two staves at once, which is exactly the
   * confusion this mode exists to avoid.
   */
  private setWalkChromeVisible(visible: boolean): void {
    for (const line of this.staffLines) line.setVisible(visible);
    this.clef.setVisible(visible);
    this.hitLine.setVisible(visible);
    this.flash.setVisible(visible);
    setMeterBarVisible(this, visible);
    // Steps and coins are both counts of walking. Leaving them on screen
    // while the road is stopped invites a child to wonder why they are not
    // going up.
    this.distanceText.setVisible(visible);
    this.coinText.setVisible(visible);
    this.coinIcon.setVisible(visible);
  }

  private playFreeNote(y: number, x: number): void {
    playFreeNoteOverlay(this, y, x);
  }

  /**
   * The songbook overlay itself lives in `./picker` (see its header for
   * why that split out as a scene module rather than a `render/` one).
   * These two stay as scene methods only because they're what the rest of
   * RoadScene calls by name (input handling, resize).
   */
  private openPicker(): void {
    openPickerOverlay(this, this.songChoice, (choice) => this.chooseSong(choice));
  }

  private closePicker(): void {
    closePickerOverlay(this);
  }

  /**
   * Switches to a song (or back to wandering) and starts it *now*.
   *
   * "Now" is the whole point. Passes are queued up to a song ahead, so
   * simply changing which song the next pass picks would leave a child who
   * pressed a button waiting out the rest of the previous tune — up to half
   * a minute. So everything not yet played is taken back: pending audio is
   * cancelled, markers that have not reached the line are dropped, and the
   * chosen song is queued from just ahead of the playhead.
   *
   * Notes already past the line are left where they are. They are the bar
   * the child just played; yanking them off the staff would read as a
   * glitch, and they scroll away on their own in half a second.
   */
  private chooseSong(choice: SongChoice): void {
    if (choice === this.songChoice) return;
    this.songChoice = choice;
    setSongChoice(choice, scaffold);

    // The songbook is reachable from free play, so a choice can land while
    // there is no road running. Rebuilding the staff is the whole job
    // there: it re-reads the song for the pips, the practice sequence and
    // the cursor, and renames the title.
    //
    // Falling through to the road path instead did two wrong things at
    // once — it left the staff showing the *previous* song's notes, and it
    // queued a pass of road notes that then scrolled invisibly behind the
    // staff, went missed, drained the meter and fed the learning model
    // with misses the child never had a chance at.
    if (this.mode === 'play') {
      buildFreeStaffOverlay(this);
      return;
    }

    const nowMs = this.time.now - this.startTimeMs;
    this.audioEngine.cancelPending();
    this.markers = this.markers.filter((m) => {
      if (m.beat.hitTimeMs <= nowMs) return true;
      m.gfx?.destroy();
      return false;
    });
    // Far enough ahead that the first note still gets its full flight to be
    // read, rather than appearing already at the line.
    this.nextPassStartTimeMs = nowMs + TRAVEL_TIME_MS;
    this.passesByBiome.clear();
    this.currentSongId = null;
    this.pendingAnnounce = [];
    this.appendSongPass();
  }

  /**
   * Queues the next pass of the current biome's song, seamlessly after the
   * last one (ROADMAP task 46 — the road is endless, so the songbook keeps
   * playing). One whole song is appended at a time, and the biome is read
   * once per pass: a walk that crosses into the forest finishes the tune
   * it's on and *then* starts the new one, which is how a musician would
   * do it — never a cut mid-phrase.
   *
   * Markers and audio are built from the same `SongBeat`s, so the staff and
   * the sound can't disagree (this replaced the old two-sided pattern
   * plumbing and its batch-quantization caveat, ROADMAP tasks 16–17).
   */
  private appendSongPass(): void {
    const biomeId = this.currentBiomeId();
    const pass = this.passesByBiome.get(biomeId) ?? 0;
    this.passesByBiome.set(biomeId, pass + 1);
    const song = songForPass(this.songChoice, biomeId, pass);
    const notes = expandSong(song, BPM, this.nextPassStartTimeMs, this.totalNotesGenerated);
    // These tunes are built of exact repeats, so the first sighting of each
    // position in a pass keeps its letter and the repeats are left to the
    // child — the teacher points at the note, then lets you try the next
    // three (core/scaffold.ts, displaySupport).
    const seenSteps = new Set<number>();
    for (const beat of notes) {
      if (beat.rest) {
        this.markers.push({
          beat,
          gfx: null,
          resolved: 'rest',
          step: STAFF_MIDDLE_STEP,
          texKey: restTexture(this, beat.beats),
        });
        continue;
      }
      const name = noteNameAt(beat.semitone);
      const step = staffStepAt(beat.semitone);
      // Naturals are enforced by songs.test.ts; the fallback exists so a
      // hypothetical accidental degrades to an unlabeled mid-staff note
      // rather than a crash.
      const resolvedStep = step ?? STAFF_MIDDLE_STEP;
      const firstInPass = !seenSteps.has(resolvedStep);
      seenSteps.add(resolvedStep);
      this.markers.push({
        beat,
        gfx: null,
        resolved: null,
        step: resolvedStep,
        firstInPass,
        texKey: name !== null && step !== null ? noteTexture(this, name, step, beat.beats) : 'note-glyph',
        bareTexKey: name !== null && step !== null ? noteTexture(this, name, step, beat.beats, false) : undefined,
      });
    }
    this.totalNotesGenerated += notes.length;
    this.nextPassStartTimeMs += songDurationMs(song, BPM);
    this.announceSong(song);
    // Pass the current visual time: it drops notes already past *and*
    // re-anchors the audio clock to the visual one, so drift between the
    // two is bounded to a single song rather than a whole sitting.
    this.audioEngine.schedule(notes, this.time.now - this.startTimeMs);
  }

  private handleInput(): void {
    const nowMs = this.time.now - this.startTimeMs;
    if (!this.audioEngine.isStarted) {
      // The first gesture unlocks audio; hand it everything already queued
      // so the performance picks up mid-song rather than restarting.
      this.audioEngine.start(
        this.markers.map((m) => m.beat),
        nowMs
      );
    }
    this.dismissHint();
    const target = this.markers.find(
      (m) => m.resolved === null && isWithinHitWindow(m.beat, nowMs, HIT_WINDOW_MS)
    );
    if (target) {
      target.resolved = 'hit';
      this.meter = applyHit(this.meter, this.meterConfig);
      this.audioEngine.pluck(target.beat.semitone);
      this.strumLute();
      this.recordEncounter(target.step, 'hit', true);
      // Backstop only: the letter is already showing by now, because the
      // reveal lead floor clears the hit window. What actually keeps a
      // faded letter from being a dead end is that scheduled reveal — the
      // answer lands on a bright, upright note the child is still about to
      // play, rather than on one already scrolling away. See revealLetter.
      this.revealLetter(target);
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
    // Where the clock stood on the previous frame, so a note that was never
    // reachable can be told apart from one the child genuinely dropped.
    const previousMs = nowMs - delta;
    const laneY = this.laneY();
    const hitLineX = this.hitLineX();

    // Free play stops the schedule entirely: no new passes are queued, no
    // markers move, and nothing can be missed. The world keeps going —
    // scenery, dusk, the bard's idle — because the mode is a change of what
    // the child is doing, not a pause screen.
    if (this.mode === 'walk' && this.nextPassStartTimeMs - nowMs < BEAT_LOOKAHEAD_MS) {
      this.appendSongPass();
    }

    this.distancePx = accumulateDistance(this.distancePx, this.walking, delta, ROAD_SCROLL_PX_PER_SEC);
    const blend = this.currentBlend();
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
    this.far.setTint(worldTint);
    this.farNext.setTint(worldTint);
    this.road.setTint(worldTint);
    this.roadNext.setTint(worldTint);
    this.near.setTint(worldTint);
    this.nearNext.setTint(worldTint);
    for (const signpost of this.signposts) signpost.setTint(worldTint);
    // Glints are drawn white so they can carry the riverside's own accent,
    // dimmed by the same dusk shade as everything else in the world layer.
    const glintTint = RoadScene.lerpColor(RIVERSIDE_GLINT_COLOR, 0x000000, 1 - shade);
    for (const glint of this.sceneryGlints) glint.setTint(glintTint);

    this.updateSky(delta);
    this.updateScenery(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
    this.updateSignposts(laneY);
    this.updateRoad(delta, blend.fromIndex, blend.toIndex, blend.ratio);
    for (let i = 0; i < this.staffLines.length; i++) {
      this.staffLines[i].setPosition(this.scale.width / 2, this.staffY(STAFF_LINE_STEPS[i], laneY));
      this.staffLines[i].setSize(this.scale.width, 1.5);
    }
    this.clef.setPosition(30, this.staffY(10, laneY));
    // Silent metronome (ROADMAP task 43): the hit line brightens on every
    // beat and fades until the next, so a pre-reader can feel where taps
    // belong without reading the hint. Derived from the same clock as the
    // beats, so it is never out of step with them.
    const beatPhase = (((nowMs % MS_PER_BEAT) + MS_PER_BEAT) % MS_PER_BEAT) / MS_PER_BEAT;
    this.hitLine.setAlpha(0.45 + 0.4 * (1 - beatPhase));
    this.hitLine.setPosition(hitLineX, laneY);
    this.flash.setPosition(hitLineX, laneY);
    this.flash.setSize(6, HIT_LINE_HEIGHT);
    if (this.hintShown) {
      // Sits over the hit line so it points at what it's describing, but
      // never so far left that a narrow phone clips it.
      const hintX = Math.max(hitLineX, this.hintText.width / 2 + 12);
      this.hintText.setPosition(hintX, laneY + HINT_Y_OFFSET);
    }

    // A tab that was backgrounded resumes with every overdue note going
    // missed in a single frame. That's harmless for the meter, but it must
    // never be read as "this child forgot ten notes at once".
    const missedThisFrame: Array<{ step: number; walking: boolean; isRest: boolean }> = [];

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
        const wasWalking = this.walking;
        marker.resolved = 'miss';
        marker.gfx?.setTint(NOTE_TINT_MISS);
        marker.gfx?.setAlpha(0.75);
        this.meter = applyMiss(this.meter, this.meterConfig);
        this.revealLetter(marker);
        // Only real notes reach here — a rest is born resolved, so it never
        // enters this branch and can never be credited to a position.
        //
        // A note whose entire hit window elapsed inside this one frame gap
        // was never on screen to be played — a GC pause, a throttled tab, a
        // stalling device. It still misses (the tune drops a note, the meter
        // dips, and that recovers in a hit or two), but it is not evidence
        // about what the child knows, so it is kept out of the learning
        // model. This closes the band between the two guards already here:
        // wider than a hidden tab, narrower than MASS_MISS_LIMIT.
        if (!wasUnplayable(marker.beat, nowMs, previousMs, HIT_WINDOW_MS)) {
          missedThisFrame.push({ step: marker.step, walking: wasWalking, isRest: false });
        }
      }

      if (!marker.gfx) {
        const tint =
          marker.resolved === 'hit' ? NOTE_TINT_HIT : marker.resolved === 'miss' ? NOTE_TINT_MISS : NOTE_TINT_UPCOMING;
        // How much help this note gets is decided once, here, as it enters
        // the lane — never re-read afterwards. A letter appearing on notes
        // already in flight would be the game visibly reacting to a miss,
        // which is punishment however gently it's drawn.
        if (marker.bareTexKey && marker.resolved === null) {
          const support = displaySupport(supportFor(scaffold, marker.step), {
            firstInPass: marker.firstInPass ?? true,
            struggling: !this.walking,
            lost: this.lostSinceMs !== null && nowMs - this.lostSinceMs >= LOST_GRACE_MS,
          });
          marker.revealAtMs = marker.beat.hitTimeMs - leadMsFor(support);
        } else {
          marker.revealAtMs = -Infinity;
        }
        marker.lettered = nowMs >= (marker.revealAtMs ?? -Infinity);
        marker.gfx = this.add.image(0, 0, marker.lettered ? marker.texKey : marker.bareTexKey ?? marker.texKey);
        // A rest glyph is drawn around the middle of its texture; a note is
        // anchored by its head.
        marker.gfx.setOrigin(NOTE_ORIGIN_X, marker.resolved === 'rest' ? 0.5 : this.noteOriginY(marker.step));
        marker.gfx.setTint(tint);
        marker.gfx.setAlpha(this.markerBaseAlpha(marker));
      }
      // Fade the prompt, never the answer. This is the line that delivers
      // that rule: every hidden letter surfaces here, mid-flight, at full
      // brightness and always before the note reaches the line.
      if (!marker.lettered && nowMs >= (marker.revealAtMs ?? Infinity)) {
        this.revealLetter(marker);
      }
      marker.gfx.setPosition(this.markerX(progress), this.staffY(marker.step, laneY));
      if (progress > 1) {
        const base = this.markerBaseAlpha(marker);
        marker.gfx.setAlpha(base * Math.max(0, 1 - (progress - 1) / (EXIT_PROGRESS - 1)));
      }
      return true;
    });

    // Only an isolated miss during otherwise-good play is evidence that a
    // note asked too much. A fistful of them in one frame means the tab was
    // asleep, or the child put the phone down — never that they unlearned.
    if (missedThisFrame.length > 0 && missedThisFrame.length <= MASS_MISS_LIMIT) {
      for (const miss of missedThisFrame) {
        if (!miss.isRest) this.recordEncounter(miss.step, 'miss', miss.walking);
      }
    }

    this.lostSinceMs = this.walking ? null : this.lostSinceMs ?? nowMs;

    const meterRatio = this.meter / this.meterConfig.max;
    // Coins are the road's reward for keeping the song alive. In free play
    // there is no road and no meter to keep up, but the meter keeps
    // whatever value it had — so without this they would tick up while the
    // child sat poking at a stationary staff, which is paying them for
    // nothing.
    if (this.mode === 'walk') {
      const prevCoins = this.coins;
      this.coins = accumulateCoins(this.coins, meterRatio, delta, COIN_RATE_PER_SEC);
      if (crossedCoinMilestone(prevCoins, this.coins, COIN_CHIME_EVERY)) {
        this.audioEngine.chime();
      }
    }

    this.updateSongTitle(nowMs);
    this.updateMeterBar();
    this.updateCoinReadout();
    this.updateDistanceReadout();
    this.updateBard(hitLineX);
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
  private updateRoad(delta: number, fromIndex: number, toIndex: number, ratio: number): void {
    if (fromIndex !== this.roadFromIndex) {
      this.roadFromIndex = fromIndex;
      this.road.setTexture(roadTileTexture(this, BIOMES[fromIndex]));
    }
    if (toIndex !== this.roadToIndex) {
      this.roadToIndex = toIndex;
      this.roadNext.setTexture(roadTileTexture(this, BIOMES[toIndex]));
    }

    const roadY = this.groundY();
    this.road.setPosition(this.scale.width / 2, roadY);
    this.road.setSize(this.scale.width, ROAD_HEIGHT);
    this.roadNext.setPosition(this.scale.width / 2, roadY);
    this.roadNext.setSize(this.scale.width, ROAD_HEIGHT);
    this.roadNext.setAlpha(ratio);
    this.roadNext.setVisible(ratio > 0);
    if (this.walking) {
      const scrollDelta = (ROAD_SCROLL_PX_PER_SEC * delta) / 1000;
      this.road.tilePositionX += scrollDelta;
      this.roadNext.tilePositionX += scrollDelta;
    }

    this.updateNear(delta, fromIndex, toIndex, ratio);
  }

  /**
   * The near band: the ground under the road and what grows at its verge.
   *
   * The one plane closer to the camera than the road, so it is the only
   * thing in the scene that scrolls *faster* than the surface the bard
   * walks on. Everything else runs at or below the road's rate (stars 0.08,
   * far ridge 0.19, scenery 0.45, road 1.0), which is why the road never
   * quite read as a surface going away from you.
   *
   * It sits flush under the road and runs to the bottom of the screen —
   * which used to be sky, because the camera's background colour was all
   * there was down there.
   */
  private updateNear(delta: number, fromIndex: number, toIndex: number, ratio: number): void {
    if (fromIndex !== this.nearFromIndex) {
      this.nearFromIndex = fromIndex;
      this.near.setTexture(nearTileTexture(this, BIOMES[fromIndex]));
    }
    if (toIndex !== this.nearToIndex) {
      this.nearToIndex = toIndex;
      this.nearNext.setTexture(nearTileTexture(this, BIOMES[toIndex]));
    }

    const layout = worldLayout(this.scale.height);
    // Tall enough to reach the bottom on any viewport, never shorter than
    // the tile — on a tablet there is 300px of it to fill.
    const height = Math.max(NEAR_TILE_HEIGHT, this.scale.height - layout.roadBottom + 2);
    const y = layout.roadBottom + height / 2;

    for (const band of [this.near, this.nearNext]) {
      band.setPosition(this.scale.width / 2, y);
      band.setSize(this.scale.width, height);
    }
    this.nearNext.setAlpha(ratio);
    this.nearNext.setVisible(ratio > 0);

    if (this.walking) {
      const scrollDelta = (ROAD_SCROLL_PX_PER_SEC * NEAR_PARALLAX * delta) / 1000;
      this.near.tilePositionX += scrollDelta;
      this.nearNext.tilePositionX += scrollDelta;
    }
  }

  /**
   * Stars drift at STAR_PARALLAX of road speed while walking; the moon
   * holds still (ROADMAP task 34). As the dusk cycle deepens toward
   * night, the stars and moon brighten while the world darkens — the sky
   * inverts the ground's shade (ROADMAP task 36).
   */
  /**
   * The moon sits in whatever sky is left between the song title and the
   * top of the staff.
   *
   * It used to be pinned at y=84, which put its glow straight through the
   * title on portrait phones — "Twinkle Twinkle Little Star" overlapped it
   * by 34px on a 320px screen. That was true before the meter moved to its
   * own row too; the title had simply always been inside the moon's
   * vertical span, and only landscape (where the title is far narrower
   * than the screen) escaped it.
   *
   * Portrait has sky to spare, so the moon drops into the middle of the
   * empty band. Landscape does not — there the clamp pins it just under
   * the title, which is where it already was, so nothing moves.
   */
  private moonY(): number {
    const glowRadius = MOON_RADIUS + MOON_GLOW_PAD;
    const titleBottom = hudLayout(this.scale.width, HUD_BUTTON_COUNT).titleY + SONG_TITLE_HALF_HEIGHT;
    const highest = titleBottom + SKY_CLEARANCE + glowRadius;
    // Top staff line, which is as high as the notation itself ever reaches.
    const staffTop = this.staffY(STAFF_TOP_LINE_STEP, this.laneY());
    const lowest = staffTop - SKY_CLEARANCE - glowRadius;
    // When the band is too short to satisfy both — landscape, where the
    // staff is barely below the chrome — the staff wins, because a bright
    // disc behind a note head costs contrast on the one thing the game is
    // teaching. The title is safe there anyway: it is centred and narrow
    // enough on a wide screen that it never reaches the moon horizontally.
    return Math.min(Math.max(highest, (highest + lowest) / 2), lowest);
  }

  private updateSky(delta: number): void {
    const nightness = nightnessAt(this.distancePx);
    this.stars.setPosition(this.scale.width / 2, STAR_FIELD_HEIGHT / 2);
    this.stars.setSize(this.scale.width, STAR_FIELD_HEIGHT);
    this.stars.setAlpha(0.75 + 0.25 * nightness);
    const moonX = this.scale.width * MOON_X_FRACTION;
    const moonY = this.moonY();
    this.moon.setPosition(moonX, moonY);
    this.moon.setAlpha(0.8 + 0.2 * nightness);
    this.moonGlow.setPosition(moonX, moonY);
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
      this.scenery.setTexture(sceneryTileTexture(this, BIOMES[fromIndex]));
    }
    if (toIndex !== this.sceneryToIndex) {
      this.sceneryToIndex = toIndex;
      this.sceneryNext.setTexture(sceneryTileTexture(this, BIOMES[toIndex]));
    }

    if (fromIndex !== this.farFromIndex) {
      this.farFromIndex = fromIndex;
      this.far.setTexture(farTileTexture(this, BIOMES[fromIndex]));
    }
    if (toIndex !== this.farToIndex) {
      this.farToIndex = toIndex;
      this.farNext.setTexture(farTileTexture(this, BIOMES[toIndex]));
    }
    // The far ridge's feet sit a little above the road, so the near
    // silhouettes overlap it and the two planes read as stacked rather than
    // as two strips drawn side by side.
    const farY = this.roadTopY(laneY) - FAR_TILE_HEIGHT / 2 - 18;
    for (const layer of [this.far, this.farNext]) {
      layer.setPosition(this.scale.width / 2, farY);
      layer.setSize(this.scale.width, FAR_TILE_HEIGHT);
      layer.tilePositionX += (ROAD_SCROLL_PX_PER_SEC * FAR_PARALLAX * delta) / 1000 * (this.walking ? 1 : 0);
    }
    // Alpha 0 still costs a draw. Outside a transition — which is most of
    // the time, and *all* of the time once a song is chosen and the biome
    // is pinned — the second layer of each crossfading pair contributes
    // nothing but fill rate, so take it out of the display list entirely.
    this.farNext.setAlpha(ratio);
    this.farNext.setVisible(ratio > 0);

    const sceneryY = this.roadTopY(laneY) - SCENERY_TILE_HEIGHT / 2;
    this.scenery.setPosition(this.scale.width / 2, sceneryY);
    this.scenery.setSize(this.scale.width, SCENERY_TILE_HEIGHT);
    this.sceneryNext.setPosition(this.scale.width / 2, sceneryY);
    this.sceneryNext.setSize(this.scale.width, SCENERY_TILE_HEIGHT);
    this.sceneryNext.setAlpha(ratio);
    this.sceneryNext.setVisible(ratio > 0);

    // Water glints breathe at opposite phases, and only while there is
    // riverside on screen to glint on.
    const presence = this.riversidePresence(fromIndex, toIndex, ratio);
    for (let i = 0; i < this.sceneryGlints.length; i++) {
      const glint = this.sceneryGlints[i];
      glint.setPosition(this.scale.width / 2, sceneryY);
      glint.setSize(this.scale.width, SCENERY_TILE_HEIGHT);
      const phase = (this.time.now / GLINT_PERIOD_MS) * Math.PI * 2 + i * Math.PI;
      const pulse = GLINT_MIN_ALPHA + (1 - GLINT_MIN_ALPHA) * (0.5 + 0.5 * Math.sin(phase));
      glint.setAlpha(presence * pulse * GLINT_ALPHA);
    }

    if (this.walking) {
      const scrollDelta = (ROAD_SCROLL_PX_PER_SEC * SCENERY_PARALLAX * delta) / 1000;
      this.scenery.tilePositionX += scrollDelta;
      this.sceneryNext.tilePositionX += scrollDelta;
      for (const glint of this.sceneryGlints) glint.tilePositionX += scrollDelta;
    }
  }

  private roadTopY(_laneY: number): number {
    return worldLayout(this.scale.height).roadTop;
  }

  /**
   * Spawns a signpost the instant `distancePx` crosses each transition's
   * start (per `signpostDistanceAt`, which already accounts for the loop
   * wrapping forever), then scrolls every active one at the scenery band's
   * own parallax rate so it reads as part of that layer. Reuses a small
   * fixed pool rather than an unbounded array (see SIGNPOST_POOL_SIZE).
   */
  private updateSignposts(laneY: number): void {
    if (BIOME_TRANSITIONS.length === 0) return;
    while (this.distancePx >= signpostDistanceAt(this.nextSignpostCount)) {
      const poolIdx = this.nextSignpostCount % this.signposts.length;
      this.signpostSpawnDistancePx[poolIdx] = signpostDistanceAt(this.nextSignpostCount);
      this.signposts[poolIdx].setVisible(true);
      this.nextSignpostCount++;
    }

    const y = this.roadTopY(laneY);
    for (let i = 0; i < this.signposts.length; i++) {
      const img = this.signposts[i];
      if (!img.visible) continue;
      const x =
        this.scale.width + SIGNPOST_WIDTH - SCENERY_PARALLAX * (this.distancePx - this.signpostSpawnDistancePx[i]);
      if (x < -SIGNPOST_WIDTH) {
        img.setVisible(false);
        continue;
      }
      img.setPosition(x, y);
    }
  }

  private updateBard(hitLineX: number): void {
    const groundY = this.groundY();
    this.bard.setPosition(hitLineX, groundY);

    const walking = this.walking;
    // The shadow tightens as he rises on each step and spreads when he
    // lands, which is what sells a walk as having weight. Derived from the
    // upper body's own bob so it can never fall out of step with it.
    const bob = Math.max(0, -this.bardUpper.y);
    const lift = Math.min(1, bob / 6);
    this.bardShadow.setPosition(hitLineX, groundY - 1);
    this.bardShadow.setScale(1 - lift * 0.22, 1 - lift * 0.3);
    this.bardShadow.setAlpha(BARD_SHADOW_ALPHA * (1 - lift * 0.35));

    if (walking !== this.bardWasWalking) {
      this.bardWasWalking = walking;
      this.setBardAnimState(walking);
    }
  }

  private updateMeterBar(): void {
    const hud = hudLayout(this.scale.width, HUD_BUTTON_COUNT);
    layoutMeterBar(this, hud.meterCenterX, hud.meterY, hud.meterWidth, this.meter / this.meterConfig.max, this.walking);
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
