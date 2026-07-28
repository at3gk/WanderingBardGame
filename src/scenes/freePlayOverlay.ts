import Phaser from 'phaser';
import {
  advanceSequence,
  FREE_PLAY_HIGH_STEP,
  FREE_PLAY_LOW_STEP,
  freePlayStaff,
  FreePlayStaff,
  freePlayStepAt,
  freePlayStepY,
  songStepSequence,
  stepsUsedBy,
  writtenNoteSlot,
} from '../core/freePlay';
import { noteNameAt, noteNameAtStep, semitoneAtStep, STAFF_LINE_STEPS } from '../core/notation';
import { SongChoice } from '../core/songChoice';
import { SONGS } from '../core/songs';
import { NOTE_ORIGIN_X, NOTE_TINT_HIT, noteTexture } from '../render/engraving';

/**
 * Free play: the staff spread out big and still, as an instrument rather
 * than a scroll. Split out of RoadScene (2172 lines — see ROADMAP task
 * 108) as its own scene module, the same shape as `picker.ts`: not a pure
 * function of its inputs, because the staff persists across frames and a
 * rotation mid-practice has to rebuild it in place rather than redraw it
 * from scratch. `FreePlayOverlayHost` is the minimal slice of RoadScene
 * these functions read and write — including `songTitleText`, which the
 * walk mode also owns (there this fades an announcement; here it is a
 * held label naming the tune being practised), and three small callbacks
 * (`hitLineX`, `noteOriginY`, `strumLute`) for the handful of things that
 * are genuinely the scene's own layout/animation, not the staff's.
 */
export interface FreePlayOverlayHost {
  add: Phaser.GameObjects.GameObjectFactory;
  make: Phaser.GameObjects.GameObjectCreator;
  textures: Phaser.Textures.TextureManager;
  tweens: Phaser.Tweens.TweenManager;
  scale: { width: number; height: number };
  audioEngine: { pluck(semitoneFromC4: number): void; chime(): void };
  songChoice: SongChoice;
  songTitleText: Phaser.GameObjects.Text;
  freeParts: Phaser.GameObjects.GameObject[];
  freeStaff: FreePlayStaff | null;
  freeScrim: Phaser.GameObjects.Rectangle | null;
  freeSequence: number[];
  freeIndex: number;
  freeCursor: Phaser.GameObjects.Arc | null;
  freePips: Phaser.GameObjects.Arc[];
  freeHint: Phaser.GameObjects.Text | null;
  freeWritten: Phaser.GameObjects.Image[];
  freeWrittenLine: number;
  hitLineX(): number;
  noteOriginY(step: number): number;
  strumLute(): void;
}

export const FREEPLAY_DEPTH = 500;
const FREEPLAY_SCRIM_DEPTH = FREEPLAY_DEPTH - 1;
const FREEPLAY_SCRIM_ALPHA = 0.62;
const FREEPLAY_TOP_MARGIN = 74;
const FREEPLAY_BOTTOM_MARGIN = 56;
const FREEPLAY_LINE_COLOR = 0xe8d9c0;
const FREEPLAY_LINE_ALPHA = 0.44;
const FREEPLAY_LEDGER_ALPHA = 0.11;
const FREEPLAY_NOTE_MS = 900;
const FREEPLAY_FADE_MS = 220;
const FREE_HINT_TEXT = 'tap a line to hear it';
const FREE_HINT_TEXT_SONG = 'find the glowing note';
// Reused outside this module — RoadScene's own gold accent (coin, lit
// windows). Duplicated rather than imported from picker.ts to avoid a
// scene-module-to-scene-module dependency for one color; picker.ts already
// documents the same value as PICKER_CHOSEN_BG.
const FREE_PLAY_ACCENT = 0xe8c157;

/**
 * Dims the world while practising.
 *
 * The staff spreads over the whole screen in this mode, so its lowest
 * steps — middle C and the two above it — lie across the road, which is
 * the brightest band in the scene. Cream lines at 0.55 alpha over a lit
 * road is the one place in the game where the notation is hard to read,
 * and it is the mode whose entire purpose is reading it.
 *
 * Dimming rather than hiding: the walk is still there, waiting, and a
 * child should be able to see what they are going back to. It is the
 * same principle as the letter scaffold — fade what is not the answer.
 */
export function raiseScrim(host: FreePlayOverlayHost): void {
  if (!host.freeScrim) {
    host.freeScrim = host.add.rectangle(0, 0, 10, 10, 0x120d16, 1);
    host.freeScrim.setDepth(FREEPLAY_SCRIM_DEPTH);
  }
  const scrim = host.freeScrim;
  layoutScrim(host);
  scrim.setVisible(true);
  scrim.setAlpha(0);
  host.tweens.killTweensOf(scrim);
  host.tweens.add({ targets: scrim, alpha: FREEPLAY_SCRIM_ALPHA, duration: FREEPLAY_FADE_MS, ease: 'Quad.easeOut' });
}

/**
 * Sizes the scrim to the screen. Separate from raising it because a
 * rotation mid-practice has to resize it *without* re-running the fade —
 * the same split the staff itself needed, and for the same reason: the
 * scrim is already on screen, and flashing it would read as a fault.
 */
export function layoutScrim(host: FreePlayOverlayHost): void {
  if (!host.freeScrim) return;
  host.freeScrim.setPosition(host.scale.width / 2, host.scale.height / 2);
  host.freeScrim.setSize(host.scale.width, host.scale.height);
}

/** Drops the scrim on the same frame the road comes back — see RoadScene.exitFreePlay. */
export function dropScrim(host: FreePlayOverlayHost): void {
  if (!host.freeScrim) return;
  host.tweens.killTweensOf(host.freeScrim);
  host.freeScrim.setVisible(false);
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
export function fadeInFreeStaff(host: FreePlayOverlayHost): void {
  for (const part of host.freeParts) {
    // freeParts is typed as bare GameObject because it is a teardown list;
    // everything actually in it is an Alpha component (rectangle, circle,
    // text), so narrow rather than widen the field's type.
    const fadeable = part as Phaser.GameObjects.GameObject & { alpha: number; setAlpha(v: number): unknown };
    if (typeof fadeable.alpha !== 'number') continue;
    const target = fadeable.alpha;
    fadeable.setAlpha(0);
    host.tweens.add({ targets: fadeable, alpha: target, duration: FREEPLAY_FADE_MS, ease: 'Quad.easeOut' });
  }
}

export function tearDownFreeStaff(host: FreePlayOverlayHost): void {
  // Kill the tweens before destroying the targets. fadeInFreeStaff adds
  // one per part on every entry, and destroying a target does not remove
  // a tween that points at it — so toggling between the walk and practice
  // left them behind at about half a tween per toggle: 5 at the start, 19
  // after thirty toggles, 44 after eighty. Objects and staff parts stayed
  // flat the whole time, which is why nothing else caught it.
  for (const part of host.freeParts) {
    host.tweens.killTweensOf(part);
    part.destroy();
  }
  host.freeParts = [];
  host.freePips = [];
  host.freeCursor = null;
  host.freeHint = null;
  host.freeStaff = null;
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
function celebrateTune(host: FreePlayOverlayHost): void {
  host.audioEngine.chime();
  // The phrase written out so far goes with it — the tune is complete,
  // and the next pass starts on a clean staff.
  for (const note of host.freeWritten) {
    host.tweens.add({ targets: note, alpha: 0, duration: 420, onComplete: () => note.destroy() });
  }
  host.freeWritten = [];
  host.freeWrittenLine = 0;
  const pips = [...host.freePips].sort((a, b) => b.y - a.y);
  pips.forEach((pip, i) => {
    host.tweens.add({
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
export function buildFreeStaff(host: FreePlayOverlayHost, resetProgress = true): void {
  tearDownFreeStaff(host);
  const w = host.scale.width;
  const staff = freePlayStaff(host.scale.height, FREEPLAY_TOP_MARGIN, FREEPLAY_BOTTOM_MARGIN);
  host.freeStaff = staff;

  // Which positions the tune the child is learning actually uses. Free
  // play on its own is a ladder with no suggestion of where to start;
  // marking the song's own notes turns it into "here are the ones in
  // Twinkle, try those" without adding an instruction nobody can read.
  // Wandering marks nothing — there is no one tune to point at.
  const chosen = host.songChoice ? SONGS.find((song) => song.id === host.songChoice) ?? null : null;
  const inSong = stepsUsedBy(chosen);

  for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
    const y = freePlayStepY(step, staff);
    const isStaffLine = STAFF_LINE_STEPS.includes(step);
    const used = inSong.has(step);
    const line = host.add.rectangle(
      w / 2,
      y,
      w - 24,
      isStaffLine ? 2.5 : 1,
      FREEPLAY_LINE_COLOR,
      isStaffLine ? FREEPLAY_LINE_ALPHA : FREEPLAY_LEDGER_ALPHA
    );
    line.setDepth(FREEPLAY_DEPTH);
    host.freeParts.push(line);

    // A warm dot beside the notes this song uses — the same gold as the
    // lit windows and the coin, which is this world's colour for "look
    // here".
    if (used) {
      const pip = host.add.circle(30, y, 3.5, FREE_PLAY_ACCENT, 0.95);
      pip.setDepth(FREEPLAY_DEPTH + 1);
      host.freeParts.push(pip);
      host.freePips.push(pip);
    }

    // The letter, always. Nothing is being asked here, so nothing is
    // withheld — this is the reference the walk deliberately fades.
    const label = host.add.text(14, y, noteNameAtStep(step), {
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
    host.freeParts.push(label);
  }

  // With a song chosen, free play stops being a ladder and becomes
  // practice: the tune is a list of positions to find, one at a time, at
  // whatever pace the child wants. Wandering leaves the sequence empty
  // and every marked note simply stays marked.
  // Name the tune being practised, and leave it up. On the road the
  // title is an announcement that fades; here it is a label — a child
  // hunting for the next note should not have to remember which song
  // they picked, and there is no beat for it to distract from.
  host.tweens.killTweensOf(host.songTitleText);
  host.songTitleText.setText(chosen ? chosen.title : '');
  host.songTitleText.setAlpha(chosen ? 0.6 : 0);

  host.freeSequence = songStepSequence(chosen);
  // A rebuild caused by a rotation must not throw away how far through
  // the tune the child had got — turning the phone is not starting again.
  if (resetProgress) host.freeIndex = 0;
  if (host.freeSequence.length) host.freeIndex %= host.freeSequence.length;
  else host.freeIndex = 0;
  host.freePips = host.freePips.filter((p) => p.active);
  for (const note of host.freeWritten) {
    host.tweens.killTweensOf(note);
    note.destroy();
  }
  host.freeWritten = [];
  host.freeWrittenLine = 0;
  host.freeCursor = null;
  if (host.freeSequence.length) {
    const cursor = host.add.circle(30, freePlayStepY(host.freeSequence[host.freeIndex], staff), 6, FREE_PLAY_ACCENT, 1);
    cursor.setDepth(FREEPLAY_DEPTH + 2);
    host.freeCursor = cursor;
    host.freeParts.push(cursor);
    // A slow breath, so the eye finds it without it ever nagging.
    host.tweens.add({
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
  const hint = host.add.text(
    host.scale.width / 2,
    Math.min(host.scale.height - 18, staff.bottomY + 30),
    host.freeSequence.length ? FREE_HINT_TEXT_SONG : FREE_HINT_TEXT,
    { fontFamily: 'sans-serif', fontSize: '13px', color: '#e8d9c0' }
  );
  hint.setOrigin(0.5, 0.5);
  hint.setAlpha(0.7);
  hint.setDepth(FREEPLAY_DEPTH + 2);
  host.freeHint = hint;
  host.freeParts.push(hint);

  // No fade here. Building the staff and lying it in are separate jobs,
  // and this function has two callers that want opposite things: entering
  // free play (fade, via fadeInFreeStaff) and a resize mid-practice
  // (rebuild in place, no fade — the staff is already on screen and
  // flashing it out and back would read as a fault).
  //
  // They used to be one thing, and doing both was what made the whole
  // practice staff invisible: this function ended by zeroing every alpha
  // and tweening back, then fadeInFreeStaff ran on the very same frame,
  // read those alphas — now 0 — captured 0 as each part's *target*, and
  // tweened 0 to 0. The second tween won. Nothing ever appeared.
}

/** Sounds the note a tap landed on, and draws it where it was played. */
export function playFreeNote(host: FreePlayOverlayHost, y: number, x: number): void {
  const staff = host.freeStaff;
  if (!staff) return;
  const step = freePlayStepAt(y, staff);
  const semitone = semitoneAtStep(step);
  if (host.freeHint) {
    const hint = host.freeHint;
    host.freeHint = null;
    host.tweens.add({ targets: hint, alpha: 0, duration: 320, onComplete: () => hint.destroy() });
  }
  // A wrong note sounds and costs nothing — you just have not moved on.
  // There is no penalty to apply and no streak to break, so a child
  // hunting around the right answer is doing exactly what this is for.
  let wasCorrect = false;
  let writtenIndex = 0;
  if (host.freeSequence.length) {
    writtenIndex = host.freeIndex;
    const next = advanceSequence(host.freeIndex, step, host.freeSequence);
    const found = next !== host.freeIndex;
    const finished = found && next === 0;
    wasCorrect = found;
    host.freeIndex = next;
    if (finished) celebrateTune(host);
    if (host.freeCursor) {
      host.freeCursor.setPosition(30, freePlayStepY(host.freeSequence[next], staff));
      if (found) {
        // A brief brightening on the note you were looking for, so
        // finding it feels like finding it.
        host.tweens.add({ targets: host.freeCursor, alpha: { from: 0.25, to: 1 }, duration: 260, ease: 'Quad.easeOut' });
      }
    }
  }
  const name = noteNameAt(semitone) ?? '';
  host.audioEngine.pluck(semitone);
  host.strumLute();

  const noteY = freePlayStepY(step, staff);
  // In practice a *correct* note is written out left to right, so the
  // phrase accumulates across the staff the way it would on paper.
  // Reading order is not obvious to a beginner; it has to be shown, and
  // this shows it every time they play a bar. A wrong note still appears
  // where the finger landed and fades, so the two are never confused.
  const writing = host.freeSequence.length > 0 && wasCorrect;
  let noteX = Math.max(60, Math.min(host.scale.width - 40, x));
  if (writing) {
    // Clear of the bard. He stands at the hit line, and starting the
    // phrase at the screen edge ran the first two notes straight through
    // him — the tune being written out is the thing to look at here, and
    // it cannot be half-hidden behind a character.
    const leftX = host.hitLineX() + 46;
    const slot = writtenNoteSlot(writtenIndex, host.scale.width - leftX - 24);
    if (slot.line !== host.freeWrittenLine) {
      host.freeWrittenLine = slot.line;
      for (const note of host.freeWritten) {
        host.tweens.add({ targets: note, alpha: 0, duration: 260, onComplete: () => note.destroy() });
      }
      host.freeWritten = [];
    }
    noteX = leftX + slot.column * ((host.scale.width - leftX - 24) / slot.perLine) + 12;
  }
  // noteTexture takes a full Phaser.Scene (it needs scene.make and
  // scene.textures, both already on the host); the cast only narrows the
  // host's own type down to that, and the real object passed in is always
  // RoadScene, which is a Scene.
  const img = host.add.image(noteX, noteY, noteTexture(host as unknown as Phaser.Scene, name, step, 1));
  img.setOrigin(NOTE_ORIGIN_X, host.noteOriginY(step));
  img.setTint(NOTE_TINT_HIT);
  img.setDepth(FREEPLAY_DEPTH + 2);
  host.tweens.add({
    targets: img,
    scale: { from: 1.4, to: 1 },
    duration: 170,
    ease: 'Sine.easeOut',
  });
  if (writing) {
    // Written notes stay: they are the phrase so far, and watching it
    // build is the point. They clear a line at a time, and all together
    // when the tune comes round.
    host.freeWritten.push(img);
  } else {
    // A freely-explored note fades on its own. One that stayed would turn
    // the staff into a drawing the child has to clear.
    host.tweens.add({
      targets: img,
      alpha: { from: 1, to: 0 },
      duration: FREEPLAY_NOTE_MS,
      delay: 220,
      onComplete: () => img.destroy(),
    });
  }
}
