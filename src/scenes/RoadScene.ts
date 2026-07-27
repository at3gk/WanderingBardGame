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
import { SONGS } from '../core/songs';
import { homeBiomeOf, SongChoice, songForPass, songGridLayout } from '../core/songChoice';
import {
  advanceSequence,
  FREE_PLAY_HIGH_STEP,
  FREE_PLAY_LOW_STEP,
  freePlayStaff,
  FreePlayStaff,
  freePlayStepAt,
  freePlayStepY,
  songStepSequence,
  writtenNoteSlot,
  stepsUsedBy,
} from '../core/freePlay';
import { HUD_TOUCH_TARGET, hudLayout } from '../core/hud';
import { applyHit, applyMiss, DEFAULT_SONG_METER_CONFIG, isWalking, SongMeterConfig } from '../core/songMeter';
import { accumulateDistance } from '../core/distance';
import { BIOMES, biomeBlendAt, BIOME_TRANSITIONS, signpostDistanceAt } from '../core/biome';
import { duskShadeAt, nightnessAt } from '../core/dusk';
import { accumulateCoins, crossedCoinMilestone } from '../core/coins';
import { noteNameAt, noteNameAtStep, semitoneAtStep, staffStepAt, stemDown } from '../core/notation';
import {
  NOTE_HEAD_INSET_Y,
  NOTE_ORIGIN_X,
  NOTE_TEX_H,
  noteTexture,
  restTexture,
  STAFF_LINE_GAP,
} from '../render/engraving';
import {
  FAR_TILE_HEIGHT,
  farTileTexture,
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
// white and tinted per use.
const NOTE_TINT_UPCOMING = 0xe8d9c0;
const NOTE_TINT_HIT = 0x7fd6a0;
const NOTE_TINT_MISS = 0x8a5a5a;
// The staff lane (ROADMAP task 42; DESIGN.md Pedagogy): the lane is a real
// treble staff. Markers are quarter notes at their true pitch position,
// letters baked dark into the heads so tints never eat them. The staff's
// middle line (B4, step 6) sits on laneY; steps come from
// core/notation.ts. Notation is never darkened by the dusk cycle and never
// wrong — kids learn from this screen.
// Roomy for young eyes: the staff gap sets the size of everything on it
// (heads are one gap tall, as in real engraving), so this is the single
// dial for notation legibility. 18px keeps the whole staff inside a phone
// viewport while making letters comfortably readable.
const STAFF_HALF_GAP = STAFF_LINE_GAP / 2;
const STAFF_MIDDLE_STEP = 6;
const STAFF_LINE_STEPS = [2, 4, 6, 8, 10];
const STAFF_LINE_ALPHA = 0.22;
const SONG_TITLE_HOLD_MS = 2600;
// A note fades out once it's past the line and is gone before it reaches
// the clef — on a narrow phone the lane's left end is only a few dozen
// pixels past the hit line, and played notes used to pile over the clef.
const EXIT_PROGRESS = 1.28;
const METER_HEIGHT = 14;
/** Mute, songbook, lute — the whole of the game's chrome. */
const HUD_BUTTON_COUNT = 3;
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
// Grew with the staff (tasks 42, 46): the bard walks below the notation, so
// this offset has to clear the lowest note the songbook can write plus its
// ledger line — middle C's head bottom now sits ~63px under the lane.
const BARD_GROUND_Y_OFFSET = 178;
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
const ROAD_SCROLL_PX_PER_SEC = ROAD_TILE_WIDTH / (MS_PER_BEAT / 1000);
const ROAD_HEIGHT_BELOW_BARD = 60;
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
// Free play has to say what it is, once. The two modes ask for opposite
// things — catch what arrives, versus go and find one — and a child who
// pressed the lute button expecting the road would otherwise be looking at
// a ladder with no idea it responds to anything.
const FREE_HINT_TEXT = 'tap a line to hear it';
const FREE_HINT_TEXT_SONG = 'find the glowing note';
// Songbook picker (choose one song to learn instead of letting them
// rotate). Sits beside the mute toggle, same 44px touch target — the two
// are the only chrome in the game and they belong together.
const BOOK_ICON_RADIUS = 11;
const PICKER_BACKDROP_COLOR = 0x120d16;
const PICKER_BACKDROP_ALPHA = 0.93;
const PICKER_PAD = 18;
const PICKER_TITLE_H = 34;
const PICKER_ROW_MIN_H = 38;
const PICKER_ROW_MAX_W = 250;
const PICKER_TEXT_COLOR = '#e8d9c0';
const PICKER_TEXT_COLOR_CHOSEN = '#2a1a2e';
const PICKER_CHOSEN_BG = 0xe8c157;
const PICKER_ROW_BG = 0x2c2233;
// Above everything. Notes are added to the display list as they spawn, so
// without an explicit depth a note that appears while the picker is open
// draws straight over the song list — which it did, first try.
const PICKER_DEPTH = 1000;
// Free play (the staff as an instrument). Its own chrome sits below the
// picker but above the world.
const FREEPLAY_DEPTH = 500;
const FREEPLAY_TOP_MARGIN = 74;
const FREEPLAY_BOTTOM_MARGIN = 56;
const FREEPLAY_LINE_COLOR = 0xe8d9c0;
// The five real staff lines have to stay legible as *the staff* inside the
// wider ladder of guides, or the child learns a thirteen-line instrument
// that does not exist on paper.
const FREEPLAY_LINE_ALPHA = 0.44;
const FREEPLAY_LEDGER_ALPHA = 0.11;
const FREEPLAY_NOTE_MS = 900;
const PICKER_FADE_MS = 130;
const FREEPLAY_FADE_MS = 220;
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
 * The learning record outlives the scene. `create()` re-runs on a resize
 * (main.ts uses Scale.RESIZE, so an orientation change is enough), and
 * resetting a child's progress because they turned the phone would be a
 * silent, invisible bug — so this is loaded once per page, not per scene.
 */
const scaffold: ScaffoldState = loadScaffold();

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
  private staffLines: Phaser.GameObjects.Rectangle[] = [];
  private clef!: Phaser.GameObjects.Image;
  private road!: Phaser.GameObjects.TileSprite;
  private roadNext!: Phaser.GameObjects.TileSprite;
  private roadFromIndex = 0;
  private roadToIndex = 0;
  private scenery!: Phaser.GameObjects.TileSprite;
  private sceneryNext!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
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
   * it is cheap to re-read from storage, and `create()` re-runs on resize.
   */
  private songChoice: SongChoice = null;
  private bookIcon!: Phaser.GameObjects.Image;
  private bookZone!: Phaser.GameObjects.Zone;
  /** Every object making up the picker overlay, so it can be torn down as one. */
  private pickerParts: Phaser.GameObjects.GameObject[] = [];
  private pickerOpen = false;
  /** 'walk' is the road; 'play' is the staff as an instrument. */
  private mode: 'walk' | 'play' = 'walk';
  private luteIcon!: Phaser.GameObjects.Image;
  private luteZone!: Phaser.GameObjects.Zone;
  private freeParts: Phaser.GameObjects.GameObject[] = [];
  private freeStaff: FreePlayStaff | null = null;
  /** The chosen song as positions to find, and how far through it the child is. */
  private freeSequence: number[] = [];
  private freeIndex = 0;
  /** The pip marking the note to look for, kept so it can be moved rather than rebuilt. */
  private freeCursor: Phaser.GameObjects.Arc | null = null;
  /** The song's note markers, kept so finishing the tune can ripple through them. */
  private freePips: Phaser.GameObjects.Arc[] = [];
  private freeHint: Phaser.GameObjects.Text | null = null;
  /** Notes written out so far in practice, and which line they belong to. */
  private freeWritten: Phaser.GameObjects.Image[] = [];
  private freeWrittenLine = 0;
  private totalNotesGenerated = 0;
  private nextPassStartTimeMs = 0;
  private currentSongId: string | null = null;
  /** How many passes each biome has played, so its set rotates rather than repeating one tune. */
  private passesByBiome = new Map<string, number>();
  /** When the meter first fell below walking, so "lost" can be distinguished from "one bad note". */
  private lostSinceMs: number | null = null;
  private songTitleText!: Phaser.GameObjects.Text;
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
  private audioEngine = new AudioEngine(AUDIO_MANIFEST);

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
    this.road = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, roadTileTexture(this, BIOMES[0]));
    this.roadNext = this.add.tileSprite(0, 0, this.scale.width, ROAD_HEIGHT_BELOW_BARD, roadTileTexture(this, BIOMES[0]));
    this.roadNext.setAlpha(0);

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
      if (this.mode === 'play') this.buildFreeStaff(false);
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

  /** Origin that puts the note *head* (not the texture center) on the staff position. */
  private noteOriginY(step: number): number {
    return (stemDown(step) ? NOTE_HEAD_INSET_Y : NOTE_TEX_H - NOTE_HEAD_INSET_Y) / NOTE_TEX_H;
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
    this.buildFreeStaff();
    this.fadeInFreeStaff();
  }

  /**
   * Lays the staff in rather than cutting to it. Each line, pip and letter
   * rises from nothing to its own intended alpha — which differs per part,
   * since the line-notes are landmarks and the spaces between them are
   * not — so the hierarchy the staff is built with survives the fade.
   *
   * Entry only. Leaving fades nothing: the road is the game, and a child
   * asking for it back should get it on the same frame they asked.
   */
  private fadeInFreeStaff(): void {
    for (const part of this.freeParts) {
      // freeParts is typed as bare GameObject because it is a teardown list;
      // everything actually in it is an Alpha component (rectangle, circle,
      // text), so narrow rather than widen the field's type.
      const fadeable = part as Phaser.GameObjects.GameObject & { alpha: number; setAlpha(v: number): unknown };
      if (typeof fadeable.alpha !== 'number') continue;
      const target = fadeable.alpha;
      fadeable.setAlpha(0);
      this.tweens.add({ targets: fadeable, alpha: target, duration: 220, ease: 'Quad.easeOut' });
    }
  }

  private exitFreePlay(): void {
    if (this.mode !== 'play') return;
    this.mode = 'walk';
    this.luteIcon.setTint(MUTE_ICON_COLOR_ON);
    this.setWalkChromeVisible(true);
    this.songTitleText.setAlpha(0);
    this.tearDownFreeStaff();
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
    for (const line of this.meterStaffLines) line.setVisible(visible);
    this.clef.setVisible(visible);
    this.hitLine.setVisible(visible);
    this.flash.setVisible(visible);
    this.meterTrack.setVisible(visible);
    this.meterFill.setVisible(visible);
    // Steps and coins are both counts of walking. Leaving them on screen
    // while the road is stopped invites a child to wonder why they are not
    // going up.
    this.distanceText.setVisible(visible);
    this.coinText.setVisible(visible);
    this.coinIcon.setVisible(visible);
  }

  private tearDownFreeStaff(): void {
    for (const part of this.freeParts) part.destroy();
    this.freeParts = [];
    this.freePips = [];
    this.freeCursor = null;
    this.freeHint = null;
    this.freeStaff = null;
  }

  /**
   * Reaching the end of the tune.
   *
   * Deliberately not a score, a star or a "well done" — DESIGN.md's no-fail
   * stance cuts both ways, and a game that celebrates loudly has started
   * grading quietly. A chime and a ripple up the notes the child just
   * played says "that was the whole song" and then gets out of the way, so
   * the tune simply comes round again.
   */
  private celebrateTune(): void {
    this.audioEngine.chime();
    // The phrase written out so far goes with it — the tune is complete,
    // and the next pass starts on a clean staff.
    for (const note of this.freeWritten) {
      this.tweens.add({ targets: note, alpha: 0, duration: 420, onComplete: () => note.destroy() });
    }
    this.freeWritten = [];
    this.freeWrittenLine = 0;
    const pips = [...this.freePips].sort((a, b) => b.y - a.y);
    pips.forEach((pip, i) => {
      this.tweens.add({
        targets: pip,
        scale: { from: 1, to: 1.9 },
        duration: 190,
        delay: i * 70,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    });
  }

  /**
   * Draws the big staff. Five real lines, plus a faint guide at every
   * *space* and ledger position too — without them a child aiming at a
   * space is aiming at nothing, and the whole mode is aiming.
   */
  private buildFreeStaff(resetProgress = true): void {
    this.tearDownFreeStaff();
    const w = this.scale.width;
    const staff = freePlayStaff(this.scale.height, FREEPLAY_TOP_MARGIN, FREEPLAY_BOTTOM_MARGIN);
    this.freeStaff = staff;

    // Which positions the tune the child is learning actually uses. Free
    // play on its own is a ladder with no suggestion of where to start;
    // marking the song's own notes turns it into "here are the ones in
    // Twinkle, try those" without adding an instruction nobody can read.
    // Wandering marks nothing — there is no one tune to point at.
    const chosen = this.songChoice ? SONGS.find((song) => song.id === this.songChoice) ?? null : null;
    const inSong = stepsUsedBy(chosen);

    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      const y = freePlayStepY(step, staff);
      const isStaffLine = STAFF_LINE_STEPS.includes(step);
      const used = inSong.has(step);
      const line = this.add.rectangle(
        w / 2,
        y,
        w - 24,
        isStaffLine ? 2.5 : 1,
        FREEPLAY_LINE_COLOR,
        isStaffLine ? FREEPLAY_LINE_ALPHA : FREEPLAY_LEDGER_ALPHA
      );
      line.setDepth(FREEPLAY_DEPTH);
      this.freeParts.push(line);

      // A warm dot beside the notes this song uses — the same gold as the
      // lit windows and the coin, which is this world's colour for "look
      // here".
      if (used) {
        const pip = this.add.circle(30, y, 3.5, PICKER_CHOSEN_BG, 0.95);
        pip.setDepth(FREEPLAY_DEPTH + 1);
        this.freeParts.push(pip);
        this.freePips.push(pip);
      }

      // The letter, always. Nothing is being asked here, so nothing is
      // withheld — this is the reference the walk deliberately fades.
      const label = this.add.text(14, y, noteNameAtStep(step), {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e8d9c0',
      });
      label.setOrigin(0.5, 0.5);
      // Letters follow the same hierarchy: the five line-notes are the
      // landmarks a reader actually navigates by.
      label.setAlpha(used ? 1 : isStaffLine ? 0.9 : 0.55);
      label.setDepth(FREEPLAY_DEPTH + 1);
      this.freeParts.push(label);
    }

    // With a song chosen, free play stops being a ladder and becomes
    // practice: the tune is a list of positions to find, one at a time, at
    // whatever pace the child wants. Wandering leaves the sequence empty
    // and every marked note simply stays marked.
    // Name the tune being practised, and leave it up. On the road the
    // title is an announcement that fades; here it is a label — a child
    // hunting for the next note should not have to remember which song
    // they picked, and there is no beat for it to distract from.
    this.tweens.killTweensOf(this.songTitleText);
    this.songTitleText.setText(chosen ? chosen.title : '');
    this.songTitleText.setAlpha(chosen ? 0.6 : 0);

    this.freeSequence = songStepSequence(chosen);
    // A rebuild caused by a rotation must not throw away how far through
    // the tune the child had got — turning the phone is not starting again.
    if (resetProgress) this.freeIndex = 0;
    if (this.freeSequence.length) this.freeIndex %= this.freeSequence.length;
    else this.freeIndex = 0;
    this.freePips = this.freePips.filter((p) => p.active);
    for (const note of this.freeWritten) note.destroy();
    this.freeWritten = [];
    this.freeWrittenLine = 0;
    this.freeCursor = null;
    if (this.freeSequence.length) {
      const cursor = this.add.circle(30, freePlayStepY(this.freeSequence[this.freeIndex], staff), 6, PICKER_CHOSEN_BG, 1);
      cursor.setDepth(FREEPLAY_DEPTH + 2);
      this.freeCursor = cursor;
      this.freeParts.push(cursor);
      // A slow breath, so the eye finds it without it ever nagging.
      this.tweens.add({
        targets: cursor,
        scale: { from: 1, to: 1.45 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Say what this is, once. It fades on the first tap, exactly like the
    // road's own hint — its job is discovery, not instruction, and a child
    // who has understood it should not have to keep reading it.
    // Below the staff, not above it: the song title already lives at the
    // top of the screen, and the first attempt put these two lines of text
    // straight through each other.
    const hint = this.add.text(
      this.scale.width / 2,
      Math.min(this.scale.height - 18, staff.bottomY + 30),
      this.freeSequence.length ? FREE_HINT_TEXT_SONG : FREE_HINT_TEXT,
      { fontFamily: 'sans-serif', fontSize: '13px', color: '#e8d9c0' }
    );
    hint.setOrigin(0.5, 0.5);
    hint.setAlpha(0.7);
    hint.setDepth(FREEPLAY_DEPTH + 2);
    this.freeHint = hint;
    this.freeParts.push(hint);

    // Fade the staff up, for the same reason the picker fades: a
    // full-height ladder appearing between two frames reads as a glitch.
    for (const part of this.freeParts) {
      const target = part as Phaser.GameObjects.GameObject & { alpha: number };
      const to = target.alpha;
      target.alpha = 0;
      this.tweens.add({ targets: target, alpha: to, duration: FREEPLAY_FADE_MS, ease: 'Quad.easeOut' });
    }
  }

  /** Sounds the note a tap landed on, and draws it where it was played. */
  private playFreeNote(y: number, x: number): void {
    const staff = this.freeStaff;
    if (!staff) return;
    const step = freePlayStepAt(y, staff);
    const semitone = semitoneAtStep(step);
    if (this.freeHint) {
      const hint = this.freeHint;
      this.freeHint = null;
      this.tweens.add({ targets: hint, alpha: 0, duration: 320, onComplete: () => hint.destroy() });
    }
    // A wrong note sounds and costs nothing — you just have not moved on.
    // There is no penalty to apply and no streak to break, so a child
    // hunting around the right answer is doing exactly what this is for.
    let wasCorrect = false;
    let writtenIndex = 0;
    if (this.freeSequence.length) {
      writtenIndex = this.freeIndex;
      const next = advanceSequence(this.freeIndex, step, this.freeSequence);
      const found = next !== this.freeIndex;
      const finished = found && next === 0;
      wasCorrect = found;
      this.freeIndex = next;
      if (finished) this.celebrateTune();
      if (this.freeCursor) {
        this.freeCursor.setPosition(30, freePlayStepY(this.freeSequence[next], staff));
        if (found) {
          // A brief brightening on the note you were looking for, so
          // finding it feels like finding it.
          this.tweens.add({ targets: this.freeCursor, alpha: { from: 0.25, to: 1 }, duration: 260, ease: 'Quad.easeOut' });
        }
      }
    }
    const name = noteNameAt(semitone) ?? '';
    this.audioEngine.pluck(semitone);
    this.strumLute();

    const noteY = freePlayStepY(step, staff);
    // In practice a *correct* note is written out left to right, so the
    // phrase accumulates across the staff the way it would on paper.
    // Reading order is not obvious to a beginner; it has to be shown, and
    // this shows it every time they play a bar. A wrong note still appears
    // where the finger landed and fades, so the two are never confused.
    const writing = this.freeSequence.length > 0 && wasCorrect;
    let noteX = Math.max(60, Math.min(this.scale.width - 40, x));
    if (writing) {
      // Clear of the bard. He stands at the hit line, and starting the
      // phrase at the screen edge ran the first two notes straight through
      // him — the tune being written out is the thing to look at here, and
      // it cannot be half-hidden behind a character.
      const leftX = this.hitLineX() + 46;
      const slot = writtenNoteSlot(writtenIndex, this.scale.width - leftX - 24);
      if (slot.line !== this.freeWrittenLine) {
        this.freeWrittenLine = slot.line;
        for (const note of this.freeWritten) {
          this.tweens.add({ targets: note, alpha: 0, duration: 260, onComplete: () => note.destroy() });
        }
        this.freeWritten = [];
      }
      noteX = leftX + slot.column * ((this.scale.width - leftX - 24) / slot.perLine) + 12;
    }
    const img = this.add.image(noteX, noteY, noteTexture(this, name, step, 1));
    img.setOrigin(NOTE_ORIGIN_X, this.noteOriginY(step));
    img.setTint(NOTE_TINT_HIT);
    img.setDepth(FREEPLAY_DEPTH + 2);
    this.tweens.add({
      targets: img,
      scale: { from: 1.4, to: 1 },
      duration: 170,
      ease: 'Sine.easeOut',
    });
    if (writing) {
      // Written notes stay: they are the phrase so far, and watching it
      // build is the point. They clear a line at a time, and all together
      // when the tune comes round.
      this.freeWritten.push(img);
    } else {
      // A freely-explored note fades on its own. One that stayed would turn
      // the staff into a drawing the child has to clear.
      this.tweens.add({
        targets: img,
        alpha: { from: 1, to: 0 },
        duration: FREEPLAY_NOTE_MS,
        delay: 220,
        onComplete: () => img.destroy(),
      });
    }
  }

  /**
   * The songbook. A full-screen panel listing every tune plus "wander",
   * because eleven entries plus a heading is more than fits beside the
   * staff on a phone, and half-covering the game would leave notes
   * scrolling past under the child's thumb.
   *
   * Nothing here is a menu the game waits behind: the walk is already
   * running before this can be opened, which is the "playable in under
   * five seconds" pillar. Opening it simply stops taps reaching the lane.
   */
  private openPicker(): void {
    if (this.pickerOpen) return;
    this.pickerOpen = true;

    const w = this.scale.width;
    const h = this.scale.height;
    const backdrop = this.add.rectangle(w / 2, h / 2, w, h, PICKER_BACKDROP_COLOR, PICKER_BACKDROP_ALPHA);
    backdrop.setInteractive();
    backdrop.setDepth(PICKER_DEPTH);
    this.pickerParts.push(backdrop);

    const heading = this.add.text(w / 2, PICKER_PAD + PICKER_TITLE_H / 2, 'choose a song', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: PICKER_TEXT_COLOR,
    });
    heading.setOrigin(0.5, 0.5);
    heading.setDepth(PICKER_DEPTH + 2);
    this.pickerParts.push(heading);

    const entries: Array<{ id: SongChoice; label: string }> = [
      { id: null, label: 'wander (all songs)' },
      ...SONGS.map((song) => ({ id: song.id as SongChoice, label: song.title })),
    ];

    const panelTop = PICKER_PAD + PICKER_TITLE_H;
    const panelH = Math.max(PICKER_ROW_MIN_H, h - panelTop - PICKER_PAD);
    const panelW = Math.max(60, w - PICKER_PAD * 2);
    const layout = songGridLayout(entries.length, panelW, panelH, PICKER_ROW_MIN_H, PICKER_ROW_MAX_W);
    const gridW = layout.cols * layout.cellW;
    const originX = (w - gridW) / 2;

    entries.forEach((entry, i) => {
      const col = Math.floor(i / layout.rows);
      const row = i % layout.rows;
      const cx = originX + col * layout.cellW + layout.cellW / 2;
      const cy = panelTop + row * layout.cellH + layout.cellH / 2;
      const chosen = entry.id === this.songChoice;

      const bg = this.add.rectangle(
        cx,
        cy,
        layout.cellW - 8,
        Math.max(24, layout.cellH - 6),
        chosen ? PICKER_CHOSEN_BG : PICKER_ROW_BG,
        1
      );
      bg.setDepth(PICKER_DEPTH + 1);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.chooseSong(entry.id);
        this.closePicker();
      });
      this.pickerParts.push(bg);

      const label = this.add.text(cx, cy, entry.label, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: chosen ? PICKER_TEXT_COLOR_CHOSEN : PICKER_TEXT_COLOR,
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(PICKER_DEPTH + 2);
      this.pickerParts.push(label);
    });

    // Tapping the backdrop closes without choosing — the way out for a
    // child who opened this by accident.
    backdrop.on('pointerdown', () => this.closePicker());

    // Fade the whole panel up rather than snapping it on. A full-screen
    // overlay appearing between two frames reads as the game breaking;
    // 130ms is enough to say "this slid in front" and short enough that
    // nobody is waiting for it.
    for (const part of this.pickerParts) {
      const target = part as Phaser.GameObjects.GameObject & { alpha: number };
      const to = target.alpha;
      target.alpha = 0;
      this.tweens.add({ targets: target, alpha: to, duration: PICKER_FADE_MS, ease: 'Quad.easeOut' });
    }
  }

  private closePicker(): void {
    if (!this.pickerOpen) return;
    this.pickerOpen = false;
    // Fade out and destroy on completion. `pickerOpen` goes false straight
    // away, so taps reach the lane again the instant the choice is made
    // rather than after the animation — the input model must never wait on
    // a transition.
    const parts = this.pickerParts;
    this.pickerParts = [];
    for (const part of parts) {
      this.tweens.add({
        targets: part,
        alpha: 0,
        duration: PICKER_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => part.destroy(),
      });
    }
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
      this.buildFreeStaff();
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
    for (const signpost of this.signposts) signpost.setTint(worldTint);
    // Glints are drawn white so they can carry the riverside's own accent,
    // dimmed by the same dusk shade as everything else in the world layer.
    const glintTint = RoadScene.lerpColor(RIVERSIDE_GLINT_COLOR, 0x000000, 1 - shade);
    for (const glint of this.sceneryGlints) glint.setTint(glintTint);

    this.updateSky(delta);
    this.updateScenery(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
    this.updateSignposts(laneY);
    this.updateRoad(laneY, delta, blend.fromIndex, blend.toIndex, blend.ratio);
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
      this.road.setTexture(roadTileTexture(this, BIOMES[fromIndex]));
    }
    if (toIndex !== this.roadToIndex) {
      this.roadToIndex = toIndex;
      this.roadNext.setTexture(roadTileTexture(this, BIOMES[toIndex]));
    }

    const roadY = laneY + BARD_GROUND_Y_OFFSET;
    this.road.setPosition(this.scale.width / 2, roadY);
    this.road.setSize(this.scale.width, ROAD_HEIGHT_BELOW_BARD);
    this.roadNext.setPosition(this.scale.width / 2, roadY);
    this.roadNext.setSize(this.scale.width, ROAD_HEIGHT_BELOW_BARD);
    this.roadNext.setAlpha(ratio);
    this.roadNext.setVisible(ratio > 0);
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

  private roadTopY(laneY: number): number {
    return laneY + BARD_GROUND_Y_OFFSET - ROAD_HEIGHT_BELOW_BARD / 2;
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

  private updateBard(hitLineX: number, laneY: number): void {
    const groundY = laneY + BARD_GROUND_Y_OFFSET;
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
    const trackWidth = hud.meterWidth;
    const centerX = hud.meterCenterX;
    const meterY = hud.meterY;
    const fillRatio = this.meter / this.meterConfig.max;
    const walking = this.walking;

    this.meterTrack.setPosition(centerX, meterY);
    this.meterTrack.setSize(trackWidth, METER_HEIGHT);

    this.meterFill.setSize(Math.max(0, trackWidth * fillRatio), METER_HEIGHT - 4);
    this.meterFill.setFillStyle(walking ? 0xe8d9c0 : 0x7a6f85, 1);
    this.meterFill.setPosition(centerX - trackWidth / 2 + this.meterFill.width / 2, meterY);

    const lineCount = this.meterStaffLines.length;
    for (let i = 0; i < lineCount; i++) {
      const y = meterY - METER_HEIGHT / 2 + ((i + 1) * METER_HEIGHT) / (lineCount + 1);
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
