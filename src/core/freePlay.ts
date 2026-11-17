/**
 * Free play: the staff as an instrument.
 *
 * The walk hands a child notes and asks for timing. That teaches the beat
 * and, through the fading letters, the position→name association — but
 * DESIGN.md is honest that a tap proves timing rather than reading, because
 * knowing the tune tells you when to tap whatever is written.
 *
 * This is the inverse, and the point of having both. Nothing scrolls,
 * nothing is asked, nothing can be missed. The child points at a line or a
 * space and hears what it is. Position → sound → name, at their own pace,
 * chosen by them rather than presented to them — which is the one direction
 * the walk cannot exercise.
 *
 * It deliberately does **not** feed the learning model. A note the child
 * picked is not evidence that they can read one the game picked, and
 * quietly fading letters on the strength of poking about would corrupt the
 * only signal the scaffold has.
 *
 * With a song chosen it becomes **practice** (see `songStepSequence` and
 * `advanceSequence` below): the tune as a list of positions to find, one at
 * a time, at whatever pace suits. That is the only place in the game where
 * *reading the staff* — rather than remembering how the tune goes — is what
 * moves you forward, which is precisely the gap the walk cannot close.
 */

import { Song, songKey } from './song';
import {
  type KeySignature,
  FLAT_SIGNATURE_STEPS,
  SHARP_SIGNATURE_STEPS,
  alteredLetters,
  letterForStep,
  semitoneAtStep,
  spellInKey,
  staffStepAt,
} from './notation';

/**
 * B3, hanging under the middle-C ledger, up to A5 on the ledger above the
 * staff — every position the songbooks write. The ladder started at middle
 * C; run 311 added B3 because *My Bonnie* and *Amazing Grace* both write it,
 * and a child who meets that low note on the walk should be able to find it
 * here. (A3, the drawable floor, is written by no tune, so it stays off.)
 */
export const FREE_PLAY_LOW_STEP = -1;
export const FREE_PLAY_HIGH_STEP = 12;

/**
 * The minimum a touch target may shrink to. Well under the 44px Apple asks
 * for, because fourteen of them have to share a phone's height — but a
 * deliberate poke at a stationary target is a far easier gesture than a
 * timed tap, and the alternative is offering fewer notes than the songs
 * use.
 */
export const MIN_STEP_BAND = 26;

/**
 * How far the margins may be squeezed before the ladder is allowed to
 * overflow. The top margin holds the song title and the bottom one the
 * hint; both have somewhere else to be on a short screen, and an
 * unreachable note does not.
 */
export const MIN_TOP_MARGIN = 34;
export const MIN_BOTTOM_MARGIN = 16;

export interface FreePlayStaff {
  /** Vertical distance between adjacent steps (a line to its neighbouring space). */
  stepGap: number;
  /** Screen y of the lowest offered step. */
  bottomY: number;
  /** Screen y of the highest offered step. */
  topY: number;
}

/**
 * Lays the free-play staff out to fill the height available.
 *
 * During the walk the steps sit 9px apart, which is fine to read and
 * impossible to aim at — a fingertip covers four of them. With nothing
 * scrolling there is no reason to be that small, so free play spreads the
 * same fourteen positions over whatever room the screen has.
 */
export function freePlayStaff(viewportH: number, topMargin: number, bottomMargin: number): FreePlayStaff {
  const steps = FREE_PLAY_HIGH_STEP - FREE_PLAY_LOW_STEP;
  const needed = steps * MIN_STEP_BAND;

  // Give back margin before giving up on target size, and give up on target
  // size before running off the screen. A short landscape phone has 260px
  // between the default margins for the ladder's gaps, which is under the
  // floor — and simply overflowing put middle C at y=386 on a 390px screen,
  // clipped at the edge and unreachable. Squeezing the margins first buys
  // just over 26px a step across thirteen gaps (B3 to A5), which clears the
  // floor and keeps every note on screen.
  let top = topMargin;
  let bottom = bottomMargin;
  if (viewportH - top - bottom < needed) {
    top = Math.min(top, Math.max(MIN_TOP_MARGIN, viewportH - bottom - needed));
    bottom = Math.min(bottom, Math.max(MIN_BOTTOM_MARGIN, viewportH - top - needed));
  }

  const usable = Math.max(steps * MIN_STEP_BAND, viewportH - top - bottom);
  const stepGap = usable / steps;
  const bottomY = top + usable;
  return { stepGap, bottomY, topY: top };
}

/** The hint line's usual distance from the top of the screen. */
export const HINT_TOP_PAD = 16;
/** One line of the hint at the screen's 16px/1.4 book face. */
export const HINT_LINE_HEIGHT = 22.4;
/**
 * Clear air between the bottom of the hint's line box and the top rung.
 * Any closer and A5's short ledger, centred under centred words, reads as
 * an underline — which is what run 312 found on a 664×390 phone, where the
 * squeezed ladder put that ledger at y=34, through the hint's descenders.
 */
export const HINT_CLEARANCE = 10;

/**
 * How far down the hint line may start so it stays clear of the top rung.
 *
 * On a tall screen the ladder's top margin leaves room and this is the
 * usual 16px. On a short landscape phone `freePlayStaff` squeezes the top
 * margin to its floor, and the hint gives up its padding (down to the
 * screen edge) rather than share a line with A5's ledger.
 */
export function hintTopPad(staff: FreePlayStaff): number {
  const room = staff.topY - HINT_LINE_HEIGHT - HINT_CLEARANCE;
  return Math.max(0, Math.min(HINT_TOP_PAD, Math.floor(room)));
}

/** Screen y of a staff step in free play. */
export function freePlayStepY(step: number, staff: FreePlayStaff): number {
  return staff.bottomY - (step - FREE_PLAY_LOW_STEP) * staff.stepGap;
}

/**
 * Which step a tap at `y` means — the nearest one, clamped to the range.
 *
 * Nearest rather than "inside a band" on purpose: a tap slightly above the
 * top note or below the bottom one should play that note, not nothing. In
 * a mode with no failure state, an input that does nothing is the only
 * thing that can feel like a mistake.
 */
export function freePlayStepAt(y: number, staff: FreePlayStaff): number {
  const raw = FREE_PLAY_LOW_STEP + (staff.bottomY - y) / staff.stepGap;
  // `+ 0` folds -0 into 0: with the ladder reaching below middle C, a tap
  // just under it rounds to -0, which is equal but not `Object.is`-equal
  // to the middle C the rest of the game names (and would be stored as-is
  // in a recorded take).
  return Math.max(FREE_PLAY_LOW_STEP, Math.min(FREE_PLAY_HIGH_STEP, Math.round(raw))) + 0;
}

/**
 * Which staff positions a song actually uses.
 *
 * Free play on its own is a ladder with no suggestion of where to start.
 * Marking the notes of the tune the child chose turns it into "here are
 * the ones in Twinkle, try those" — a pointer rather than an instruction,
 * which matters when the player cannot read.
 */
export function stepsUsedBy(song: Song | null | undefined): Set<number> {
  return new Set(songStepSequence(song));
}

/**
 * A note's staff step as its song writes it. Book One (keyless) keeps the
 * naturals-only refusal — an accidental is null — exactly as before. A
 * keyed Book Two song spells through its key (task 236), so *Yankee
 * Doodle*'s F♯ sits on the F line and *Amazing Grace*'s E♭ on the E line,
 * the way the walk's notes draw them; before this, practice silently
 * dropped every one of those notes.
 */
function writtenStep(semitone: number, key: KeySignature | null): number | null {
  return key ? spellInKey(semitone, key).step : staffStepAt(semitone);
}

/** The key practice tunes the ladder to: the song's own, or null for a keyless (Book One / family) tune. */
export function practiceKey(song: Song | null | undefined): KeySignature | null {
  if (!song || song.key === undefined) return null;
  return songKey(song);
}

/**
 * What a rung sounds while practising a keyed tune (task 236): its letter
 * as the key signature alters it — in G every F rung plays F♯, in E♭ every
 * B, E and A rung is flat. That is what a key signature *means*, and a
 * Book Two tune only ever uses its key's own notes (songs.test.ts pins
 * "no shown accidental"), so every right tap sounds the tune exactly.
 * Without a key, the plain natural.
 */
export function practiceSemitoneAt(step: number, key: KeySignature | null): number {
  const natural = semitoneAtStep(step);
  if (!key || !alteredLetters(key).includes(letterForStep(step))) return natural;
  return natural + (key.fifths > 0 ? 1 : -1);
}

/** The accidental a rung carries in a practised key, as a reader writes it: '♯', '♭', or '' for none. */
export function practiceAccidentalAt(step: number, key: KeySignature | null): string {
  const shift = practiceSemitoneAt(step, key) - semitoneAtStep(step);
  return shift > 0 ? '♯' : shift < 0 ? '♭' : '';
}

/**
 * The chosen song as a plain sequence of staff positions to find.
 *
 * This is what turns free play from a ladder into practice. Rests are
 * dropped: a silence is part of reading rhythm, and rhythm is what the
 * *walk* teaches — here there is no clock at all, so a rest is just a step
 * with nothing to press, which would read as the game having stopped
 * responding.
 */
export function songStepSequence(song: Song | null | undefined): number[] {
  if (!song) return [];
  const key = practiceKey(song);
  const steps: number[] = [];
  for (const note of song.notes) {
    if (note.rest) continue;
    const step = writtenStep(note.semitone, key);
    if (step !== null) steps.push(step);
  }
  return steps;
}

/**
 * Where the sequence goes after a tap.
 *
 * The rule that makes this practice rather than a test: a wrong note
 * *sounds* and costs nothing — you simply have not moved on yet. There is
 * no penalty to apply, no streak to break and nothing to undo, so a child
 * exploring around the right answer is doing the thing this mode is for.
 * Reaching the end wraps to the beginning, because a tune you have just
 * finished is the one you are most likely to want again.
 */
export function advanceSequence(index: number, tappedStep: number, sequence: number[]): number {
  if (!sequence.length) return 0;
  const here = ((index % sequence.length) + sequence.length) % sequence.length;
  if (sequence[here] !== tappedStep) return here;
  return (here + 1) % sequence.length;
}

/**
 * Where a correct note goes when the tune is being written out.
 *
 * In practice the notes the child finds are laid left to right instead of
 * appearing wherever their finger landed, so the phrase accumulates across
 * the staff the way it would on paper. Reading order is not obvious to a
 * beginner — it has to be shown, and this shows it every time they play a
 * bar.
 *
 * Long tunes do not fit on one screen, so it wraps like a line of sheet
 * music: when the line is full the next note starts a fresh one. `column`
 * is the position within the line and `line` counts how many have been
 * filled, so the caller can clear the previous line as a new one starts.
 */
export function writtenNoteSlot(
  index: number,
  availableW: number,
  spacing = 30
): { column: number; line: number; perLine: number } {
  const perLine = Math.max(1, Math.floor(availableW / spacing));
  const i = Math.max(0, index);
  return { column: i % perLine, line: Math.floor(i / perLine), perLine };
}

/**
 * The chosen song as practice on the free-play ladder (task 233): its
 * positions in order, keeping only the ones the ladder actually offers.
 *
 * Every songbook position sits between B3 and A5 today, but a recorded or
 * imported tune is not bound by that, and a pip parked on a rung the ladder
 * doesn't draw would leave the child with nothing to tap — practice would
 * simply stop. Dropping an unreachable note skips it, which is the kinder
 * failure. Fewer than two findable notes is not a tune to practise, so the
 * screen stays plain free play.
 */
export function practiceSequence(song: Song | null | undefined): number[] {
  const steps = songStepSequence(song).filter(
    (step) => step >= FREE_PLAY_LOW_STEP && step <= FREE_PLAY_HIGH_STEP
  );
  return steps.length >= 2 ? steps : [];
}

/** The songbook's door to the ladder when there is nothing to practise. */
export const MAKE_A_SONG_LABEL = 'Make a song ♪';
/** The same door while a pinned tune will open as practice (task 238). */
export const PRACTISE_LABEL = 'Practise this tune ♪';

/**
 * What the songbook's ladder row says (task 238). With a tune pinned the
 * row opens practice, not a blank page, so "Make a song" hid the one place
 * in the game where reading moves you forward. The row names what it
 * opens: practice exactly when `practiceSequence` would give the screen a
 * pip, so a pinned tune with fewer than two findable notes (which opens
 * plain free play) never promises practice it won't deliver.
 */
export function freePlayRowLabel(song: Song | null | undefined): string {
  return practiceSequence(song).length > 0 ? PRACTISE_LABEL : MAKE_A_SONG_LABEL;
}

/**
 * One tap in practice: where the pip goes next, and whether that tap just
 * finished the tune (so the screen can sound its soft chime as the pip
 * wraps back to the first note). A wrong tap leaves the pip where it was
 * and is never `finished` — there is nothing to count, by design.
 */
export function practiceTap(
  index: number,
  tappedStep: number,
  sequence: number[]
): { index: number; finished: boolean } {
  if (!sequence.length) return { index: 0, finished: false };
  const here = ((index % sequence.length) + sequence.length) % sequence.length;
  const next = advanceSequence(here, tappedStep, sequence);
  return { index: next, finished: next !== here && next === 0 };
}

/** Horizontal room each written note takes on the practice line (task 234). */
export const WRITTEN_NOTE_SPACING = 30;

/**
 * The line of sheet music practice is writing right now (task 234): the
 * notes already found on it, each in its column, and the column the pip
 * waits in for the next one. Derived purely from where the pip is, so a
 * wrong tap (which leaves the pip) changes nothing on the page, finishing
 * the tune (which wraps the pip to 0) starts a clean page, and filling a
 * line starts the next one clean — like turning to a fresh line on paper.
 *
 * `offsetX(column)` places a column relative to the ladder's centre, so the
 * whole line of `perLine` notes sits centred under the staff lines.
 */
export function practiceLine(
  index: number,
  sequence: number[],
  availableW: number,
  spacing = WRITTEN_NOTE_SPACING,
  leftReserve = 0
): { written: { step: number; column: number }[]; pipColumn: number; perLine: number; offsetX: (column: number) => number } {
  const here = sequence.length ? ((index % sequence.length) + sequence.length) % sequence.length : 0;
  const reserve = Math.max(0, Math.min(leftReserve, availableW - spacing));
  const slot = writtenNoteSlot(here, availableW - reserve, spacing);
  const lineStart = here - slot.column;
  const written = sequence.slice(lineStart, here).map((step, column) => ({ step, column }));
  const perLine = slot.perLine;
  return {
    written,
    pipColumn: slot.column,
    perLine,
    offsetX: (column: number) => reserve / 2 + (column - (perLine - 1) / 2) * spacing,
  };
}

/** Horizontal room each mark of practice's key signature takes (task 237). */
export const SIGNATURE_MARK_SPACING = 11;
/** Room between the staff's left end and the first mark, and between the last mark and the written notes. */
export const SIGNATURE_PAD = 8;

/**
 * Practice's key signature (task 237): the sharps or flats a keyed tune
 * carries, drawn at the ladder's left edge where the walk's staff and any
 * printed page put them. Run 319 tuned the rungs to the key, so in G the F
 * line sounds and names F♯ — this shows *why*, the way sheet music does,
 * without a word of theory. Same engraving positions as the walk
 * (`SHARP_SIGNATURE_STEPS` / `FLAT_SIGNATURE_STEPS`: F♯ on F5's line, B♭ on
 * B4's), same order.
 *
 * `x` is each mark's centre measured from the staff's left end; `width`
 * is the room the signature claims there (0 for a keyless tune), which the
 * written line gives up via `practiceLine`'s `leftReserve` so a note head
 * never lands on a sharp.
 */
export function practiceSignature(key: KeySignature | null): {
  marks: { step: number; glyph: '♯' | '♭'; x: number }[];
  width: number;
} {
  if (!key || !Number.isFinite(key.fifths) || key.fifths === 0) return { marks: [], width: 0 };
  const sharp = key.fifths > 0;
  const steps = sharp ? SHARP_SIGNATURE_STEPS : FLAT_SIGNATURE_STEPS;
  const count = Math.min(alteredLetters(key).length, steps.length);
  const marks = steps.slice(0, count).map((step, i) => ({
    step,
    glyph: (sharp ? '♯' : '♭') as '♯' | '♭',
    x: SIGNATURE_PAD + SIGNATURE_MARK_SPACING * (i + 0.5),
  }));
  return { marks, width: count ? SIGNATURE_PAD * 2 + SIGNATURE_MARK_SPACING * count : 0 };
}

/** By heart (task 235): this many wrong taps in a row bring the pip back. */
export const BY_HEART_MISSES = 3;
/** …and once back, it stays for this many right notes before it quietly goes again. */
export const BY_HEART_HELP_NOTES = 4;

/**
 * By heart's help, the road's rule on the ladder: quick to help, slow to
 * withdraw. `misses` counts wrong taps in a row while the pip is away;
 * `helping` is how many more right notes the pip stays shown for. There is
 * nothing here to keep or show the child — no count of misses survives a
 * right tap, and the pip coming back is the whole reply.
 */
export interface ByHeartHelp {
  misses: number;
  helping: number;
}

export const NO_HELP: ByHeartHelp = { misses: 0, helping: 0 };

/** One tap in by-heart practice: `right` is whether it moved the pip on. */
export function byHeartTap(help: ByHeartHelp, right: boolean): ByHeartHelp {
  if (right) return { misses: 0, helping: Math.max(0, help.helping - 1) };
  if (help.helping > 0) return { misses: 0, helping: help.helping };
  const misses = help.misses + 1;
  return misses >= BY_HEART_MISSES ? { misses: 0, helping: BY_HEART_HELP_NOTES } : { misses, helping: 0 };
}

/** Whether practice shows the pip: always when guided; by heart, only while helping. */
export function pipShown(byHeart: boolean, help: ByHeartHelp): boolean {
  return !byHeart || help.helping > 0;
}
