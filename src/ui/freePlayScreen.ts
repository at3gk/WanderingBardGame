/**
 * Free play as an actual screen — task 176 piece 3's first slice, plus
 * piece 4's recording door (2026-09-04, run 150).
 *
 * `core/freePlay.ts` has held the staff-ladder geometry (`freePlayStaff`,
 * `freePlayStepY`, `freePlayStepAt`) since ROADMAP task 41, and
 * `core/customSongs.ts` has held a recording session's state machine since
 * run 147 — but nothing drew the ladder or let a finger reach it, and
 * nothing called the state machine. This file is that draw: a full-screen
 * ladder of the fourteen positions free play offers (B3 under the
 * middle-C ledger up to A5 on the ledger above the staff, per
 * `FREE_PLAY_LOW_STEP`/`FREE_PLAY_HIGH_STEP`), five real staff lines at
 * `STAFF_LINE_STEPS` so the spaces read as spaces, a tap anywhere on the
 * ladder plays that pitch and shows its letter — "position → sound →
 * name", per `freePlay.ts`'s own header — and now the record toggle and
 * name-prompt dialog that turn a run of taps into a saved `Song`.
 *
 * The record button reuses `customSongs.ts`'s own documented semantics
 * rather than inventing new ones: pressing it while idle calls
 * `startRecording` (a fresh take); pressing it while recording calls
 * `stopRecording` (freezes the take). A frozen take that still has a
 * problem (`recordingProblem`: the save gate's verdict, said in tapping
 * words — "tap more notes — a tune needs 16", "tap 2 more to finish
 * the bar") shows that message and a single "keep tapping"
 * button — `resumeRecording`, the module's own declined-kindly path — with
 * no separate "discard" concept: pressing record again from that state
 * calls `startRecording` again, which the module already documents as a
 * silent discard of the earlier take. A frozen take with no problem opens
 * the name dialog automatically; "Cancel" there also calls
 * `resumeRecording` rather than losing the take.
 *
 * The "my songs" shelf that lets a saved tune actually be walked with lives
 * in `RoadStage.ts`'s `refreshSongbook` (task 176's last piece, run 151),
 * not here — this file only makes the tune, `songChoice.ts`'s `songForPass`
 * and the songbook resolve it.
 *
 * The label-style toggle (ROADMAP task 191 piece 2b, run 171) lives here
 * rather than behind a settings screen this game doesn't have: free play is
 * already the "position → sound → name" teaching screen, so a family
 * choosing how names are spoken is choosing it exactly where they are
 * reading them. It changes `scaffoldStorage.ts`'s one saved field
 * (piece 2a), which `RoadStage.ts`'s walk staff will also read once
 * `SongNotes.ts`'s fixed single-character glyph cells get the layout
 * change multi-letter syllables need — deliberately not attempted here,
 * since this DOM label has no such constraint and the walk staff does.
 */
import {
  FREE_PLAY_LOW_STEP,
  FREE_PLAY_HIGH_STEP,
  MIN_TOP_MARGIN,
  MIN_BOTTOM_MARGIN,
  freePlayStaff,
  HINT_TOP_PAD,
  hintTopPad,
  freePlayStepY,
  freePlayStepAt,
  FreePlayStaff,
  practiceSequence,
  practiceTap,
  practiceLine,
  byHeartTap,
  NO_HELP,
  pipShown,
} from '../core/freePlay';
import type { ByHeartHelp } from '../core/freePlay';
import type { Song } from '../core/song';
import { STAFF_LINE_STEPS, ledgerLineSteps, letterForStep, solfegeAtStep, semitoneAtStep } from '../core/notation';
import { semitoneToFrequency } from '../audio/baseLoop';
import { playVoiceNote } from '../audio/instrumentVoice';
import type { InstrumentVoice } from '../core/instruments';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { BOOK_FACE, bindRowActivation } from './Hud';
import {
  RecordingSession,
  EMPTY_RECORDING,
  startRecording,
  recordTap,
  stopRecording,
  resumeRecording,
  recordingProblem,
  finishRecording,
} from '../core/customSongs';
import { currentLabelStyle, setLabelStyle } from '../core/scaffoldStorage';
import type { ScaffoldState } from '../core/scaffold';

/** Room above/below the ladder for the hint line, the close mark and a phone's notch. */
const TOP_MARGIN = MIN_TOP_MARGIN + 30;
const BOTTOM_MARGIN = MIN_BOTTOM_MARGIN + 24;

const INK = '#f0e2c6';
const STAFF_LINE_COLOR = 'rgba(240, 226, 198, 0.5)';
const LEDGER_COLOR = 'rgba(240, 226, 198, 0.65)';
/** No sky to go quiet behind here — free play owns the whole screen, so it earns a real backdrop. */
const BACKDROP = 'rgba(20, 14, 18, 0.95)';
const RECORD_RED = '#d1503a';

const DEFAULT_HINT = 'Tap a line or a space to hear it';
/** Practice's resting hint: the instruction, not the tune's name (titles run long on a 320px phone). */
const PRACTICE_HINT = 'Tap the line or space by the dot';
/** By heart's resting hint (task 235): the dot is away, the tune is the child's to find. */
const BY_HEART_HINT = 'Find the tune by heart';
/** The pip: a warm note head where the next note of the chosen tune is written. */
const PIP_COLOR = '#e8b85a';
/** The found notes written out (task 234): ink heads, a touch softer than the tapped letter. */
const WRITTEN_COLOR = 'rgba(240, 226, 198, 0.88)';
/** A practised note's letter sits this far above (or, near the top, below) its head, so it never covers it. */
const PRACTICE_LABEL_LIFT = 26;
/** From this step up, the practice letter goes under the head instead — above A5 is the hint line. */
const PRACTICE_LABEL_FLIP_STEP = 9;

export interface FreePlayScreenOptions {
  /** Which instrument's voice a tap sounds through — the one currently in hand, once wired. */
  voice: InstrumentVoice;
  /** The saved scaffold record, so the label-style toggle can persist through it (scaffoldStorage.ts). */
  scaffold: ScaffoldState;
  /**
   * The tune pinned in the songbook, if any (task 233). With one, the ladder
   * becomes practice: a pip on the next note's position, a right tap moves
   * it on, a wrong tap just sounds. Null/absent is plain free play.
   */
  practice?: Song | null;
  onClose: () => void;
}

/** The staff-ladder screen. `mount()`ed onto a host element; call `destroy()` to remove it. */
export class FreePlayScreen {
  private readonly root: HTMLDivElement;
  private readonly staffLayer: HTMLDivElement;
  private readonly noteLabel: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly recordButton: HTMLDivElement;
  private readonly controlsRow: HTMLDivElement;
  private readonly nameScrim: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly nameError: HTMLDivElement;
  private readonly labelToggle: HTMLDivElement;
  private readonly host: HTMLElement;
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly opts: FreePlayScreenOptions;
  private staff: FreePlayStaff;
  private labelTimer: ReturnType<typeof setTimeout> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private session: RecordingSession = EMPTY_RECORDING;
  private naming = false;
  private readonly pip: HTMLDivElement;
  private readonly writtenLayer: HTMLDivElement;
  private readonly practiceSteps: number[];
  private practiceIndex = 0;
  /** By heart (task 235): the pip stays away unless a few misses in a row call it back. */
  private byHeart = false;
  private help: ByHeartHelp = NO_HELP;
  private pipPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onResize = () => this.layout();

  constructor(host: HTMLElement, ctx: AudioContext, destination: AudioNode, opts: FreePlayScreenOptions) {
    this.host = host;
    this.ctx = ctx;
    this.destination = destination;
    this.opts = opts;

    this.root = element('div', {
      position: 'fixed',
      inset: '0',
      zIndex: '5',
      background: BACKDROP,
      touchAction: 'none',
      font: `400 16px/1.4 ${BOOK_FACE}`,
      color: INK,
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });

    this.hint = element('div', {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      textAlign: 'center',
      padding: `${HINT_TOP_PAD}px 12px 0`,
      fontStyle: 'italic',
      letterSpacing: '0.02em',
      pointerEvents: 'none',
    });
    this.hint.textContent = DEFAULT_HINT;
    this.root.appendChild(this.hint);

    // The "keep tapping" link's home: the bottom-right corner, mirroring the
    // label toggle in the bottom-left. Until run 313 it was a centred row at
    // top 44px, which put the link's box (y≈50-72) across the A5/G5 rungs on
    // every screen size, so a tap aimed at those notes pressed the link. In
    // the corner it sizes to its own words and sits off the ladder's centre.
    this.controlsRow = element('div', {
      position: 'absolute',
      right: '14px',
      bottom: '10px',
      textAlign: 'right',
      pointerEvents: 'none',
    });
    this.root.appendChild(this.controlsRow);

    this.recordButton = element('div', {
      position: 'absolute',
      top: '6px',
      left: '10px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      lineHeight: '1',
      cursor: 'pointer',
      color: RECORD_RED,
    });
    this.recordButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onRecordButton();
    });
    bindRowActivation(this.recordButton, true, () => this.onRecordButton());
    this.root.appendChild(this.recordButton);

    const close = element('div', {
      position: 'absolute',
      top: '6px',
      right: '10px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      lineHeight: '1',
      cursor: 'pointer',
    });
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close free play');
    close.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.opts.onClose();
    });
    bindRowActivation(close, true, () => this.opts.onClose());
    this.root.appendChild(close);

    this.staffLayer = element('div', { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.root.appendChild(this.staffLayer);

    // Practice's pip (task 233): a filled, slightly tilted note head where
    // the next note of the pinned tune is written, left of centre so the
    // letter a tap shows (centred) never sits on it. Nothing else marks
    // progress — no count, no score; the pip moving on is the whole reply.
    this.practiceSteps = practiceSequence(opts.practice);
    // The found notes (task 234): every right tap writes its note head into
    // the next column, left to right, so the phrase builds across the staff
    // the way it reads on paper. The pip waits in the column after the last
    // one written — where the next note will go.
    this.writtenLayer = element('div', { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.writtenLayer.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.writtenLayer);
    this.pip = element('div', {
      position: 'absolute',
      left: '50%',
      width: '17px',
      height: '12px',
      borderRadius: '50%',
      background: PIP_COLOR,
      boxShadow: '0 0 10px rgba(232, 184, 90, 0.55)',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%) rotate(-20deg) scale(1)',
      transition: 'top 180ms ease, left 180ms ease, transform 140ms ease',
      display: 'none',
    });
    this.pip.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.pip);

    this.noteLabel = element('div', {
      position: 'absolute',
      left: '50%',
      pointerEvents: 'none',
      fontStyle: 'italic',
      fontSize: '22px',
      transform: 'translate(-50%, -50%)',
      opacity: '0',
      transition: 'opacity 160ms ease',
      textShadow: '0 1px 2px rgba(20, 14, 18, 0.85)',
    });
    this.root.appendChild(this.noteLabel);

    // The label-style toggle: in the bottom-left corner, styled like
    // `keepTapping` below (italic, underlined, self-describing text rather
    // than an icon a family would have to learn). It was a full-width strip
    // centred under the ladder until run 311; on a short landscape phone
    // `freePlayStaff` squeezes the bottom margin to fit every rung, which
    // put the lowest note (B3) under that strip, so a tap aimed at it
    // toggled the labels instead. In the corner it sizes to its own words
    // and sits clear of the ladder, which is centred and at most 260px wide.
    this.labelToggle = element('div', {
      position: 'absolute',
      left: '14px',
      bottom: '10px',
      textAlign: 'left',
      fontStyle: 'italic',
      fontSize: '13px',
      letterSpacing: '0.02em',
      textDecoration: 'underline',
      cursor: 'pointer',
      opacity: '0.8',
    });
    this.labelToggle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onToggleLabelStyle();
    });
    bindRowActivation(this.labelToggle, true, () => this.onToggleLabelStyle());
    this.root.appendChild(this.labelToggle);

    // The name dialog: a scrim (blocks staff taps underneath, per its own
    // pointerdown stop below) plus a centered panel. Hidden by default —
    // `renderRecordUI` toggles `display` rather than this ever being built
    // twice.
    this.nameScrim = element('div', {
      position: 'absolute',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.45)',
    });
    this.nameScrim.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    const panel = element('div', {
      width: 'min(320px, 84vw)',
      background: '#241a1f',
      border: `1px solid ${STAFF_LINE_COLOR}`,
      borderRadius: '10px',
      padding: '18px 20px',
      textAlign: 'center',
    });
    const panelTitle = element('div', { fontStyle: 'italic', marginBottom: '10px' });
    panelTitle.textContent = 'Name your song';
    panel.appendChild(panelTitle);

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = 30;
    this.nameInput.placeholder = 'My song';
    Object.assign(this.nameInput.style, {
      width: '100%',
      boxSizing: 'border-box',
      font: `400 16px/1.4 ${BOOK_FACE}`,
      color: INK,
      background: 'rgba(240, 226, 198, 0.1)',
      border: `1px solid ${STAFF_LINE_COLOR}`,
      borderRadius: '6px',
      padding: '8px 10px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.onSaveName();
    });
    panel.appendChild(this.nameInput);

    this.nameError = element('div', {
      fontSize: '13px',
      color: RECORD_RED,
      marginTop: '8px',
      minHeight: '16px',
    });
    panel.appendChild(this.nameError);

    const buttonRow = element('div', {
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      marginTop: '14px',
      cursor: 'pointer',
    });
    const saveButton = element('div', { textDecoration: 'underline' });
    saveButton.textContent = 'Save';
    const cancelButton = element('div', {});
    cancelButton.textContent = 'Cancel';
    buttonRow.appendChild(saveButton);
    buttonRow.appendChild(cancelButton);
    panel.appendChild(buttonRow);

    panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    saveButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onSaveName();
    });
    bindRowActivation(saveButton, true, () => this.onSaveName());
    cancelButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onCancelName();
    });
    bindRowActivation(cancelButton, true, () => this.onCancelName());

    this.nameScrim.appendChild(panel);
    this.root.appendChild(this.nameScrim);

    // `freePlayStepAt` clamps to the nearest step across the whole ladder
    // (see its own header: a tap short of the top or bottom note should
    // still play that note, not nothing) — so one listener on the root,
    // not fourteen per-row hit targets, is the correct shape here.
    this.root.addEventListener('pointerdown', (event) => this.tap(event));

    // Keyboard/screen-reader reach, matching Hud.ts's veil pattern (task
    // 195 piece 2d) and importSongDialog.ts's overlay (task 198): Escape
    // dismisses this screen from any focused child, since it bubbles here.
    // While the name dialog is open, Escape cancels naming (resuming the
    // take, same as the Cancel button) rather than leaving free play
    // outright — the take shouldn't vanish on one stray keypress.
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      event.preventDefault();
      if (this.naming) this.onCancelName();
      else this.opts.onClose();
    });

    window.addEventListener('resize', this.onResize);

    this.staff = freePlayStaff(host.clientHeight, TOP_MARGIN, BOTTOM_MARGIN);
    host.appendChild(this.root);
    this.layout();
    this.renderRecordUI();
    this.renderLabelToggle();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.labelTimer !== null) clearTimeout(this.labelTimer);
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    if (this.pipPulseTimer !== null) clearTimeout(this.pipPulseTimer);
    this.root.remove();
  }

  private layout(): void {
    const h = this.root.clientHeight || this.host.clientHeight || window.innerHeight;
    this.staff = freePlayStaff(h, TOP_MARGIN, BOTTOM_MARGIN);
    // On a short landscape phone the ladder's top rung climbs to y=34; the
    // hint gives up its padding so A5's ledger doesn't underline its words.
    this.hint.style.paddingTop = `${hintTopPad(this.staff)}px`;
    this.drawStaffLines();
    this.renderPip();
  }

  /** Practice is live whenever a tune came with the ladder and no take is being recorded or named. */
  private get practising(): boolean {
    return this.practiceSteps.length > 0 && !this.session.recording && !this.naming;
  }

  /** The staff lines' width: the ladder is centred and at most 260px wide. */
  private ladderWidth(): number {
    return Math.min(260, (this.root.clientWidth || 320) * 0.6);
  }

  private currentLine() {
    return practiceLine(this.practiceIndex, this.practiceSteps, this.ladderWidth());
  }

  /**
   * The practice page, all from `practiceIndex`: the notes found so far on
   * this line written in ink, and the pip in the next column. Hidden
   * (both) while a take is being recorded or named.
   */
  private renderPip(): void {
    this.writtenLayer.replaceChildren();
    if (!this.practising) {
      this.pip.style.display = 'none';
      return;
    }
    const line = this.currentLine();
    for (const note of line.written) {
      const x = line.offsetX(note.column);
      this.writtenLayer.appendChild(this.noteLedgers(note.step, x));
      const head = element('div', {
        position: 'absolute',
        left: `calc(50% + ${x}px)`,
        top: `${freePlayStepY(note.step, this.staff)}px`,
        width: '15px',
        height: '11px',
        borderRadius: '50%',
        background: WRITTEN_COLOR,
        transform: 'translate(-50%, -50%) rotate(-20deg)',
      });
      this.writtenLayer.appendChild(head);
    }
    if (!pipShown(this.byHeart, this.help)) {
      this.pip.style.display = 'none';
      return;
    }
    const pipStep = this.practiceSteps[this.practiceIndex];
    const pipX = line.offsetX(line.pipColumn);
    this.writtenLayer.appendChild(this.noteLedgers(pipStep, pipX));
    this.pip.style.display = 'block';
    this.pip.style.left = `calc(50% + ${pipX}px)`;
    this.pip.style.top = `${freePlayStepY(pipStep, this.staff)}px`;
  }

  /** A written note's own short ledger lines (middle C, B3, A5), so a head at the line's ends isn't left floating past the centred ones. */
  private noteLedgers(step: number, x: number): DocumentFragment {
    const out = document.createDocumentFragment();
    for (const ledger of ledgerLineSteps(step)) {
      out.appendChild(element('div', {
        position: 'absolute',
        left: `calc(50% + ${x}px)`,
        top: `${freePlayStepY(ledger, this.staff)}px`,
        width: '24px',
        height: '1px',
        transform: 'translate(-50%, -50%)',
        background: LEDGER_COLOR,
      }));
    }
    return out;
  }

  /** A right tap: the pip swells for a moment, so a repeated note (E E E) still visibly moves on. */
  private pulsePip(): void {
    this.pip.style.transform = 'translate(-50%, -50%) rotate(-20deg) scale(1.35)';
    if (this.pipPulseTimer !== null) clearTimeout(this.pipPulseTimer);
    this.pipPulseTimer = setTimeout(() => {
      this.pipPulseTimer = null;
      this.pip.style.transform = 'translate(-50%, -50%) rotate(-20deg) scale(1)';
    }, 140);
  }

  private drawStaffLines(): void {
    this.staffLayer.replaceChildren();
    const width = this.ladderWidth();
    for (const step of STAFF_LINE_STEPS) {
      this.staffLayer.appendChild(this.ledgerMark(step, width, STAFF_LINE_COLOR));
    }
    // The beginner's first ledger lines: middle C's below the staff and
    // A5's above it. `ledgerLineSteps` puts them where the staff would —
    // the ladder's bottom rung, B3, hangs under middle C's line rather than
    // wearing one through itself (the same rule the walk's atlas follows).
    const ledgers = new Set([...ledgerLineSteps(FREE_PLAY_LOW_STEP), ...ledgerLineSteps(FREE_PLAY_HIGH_STEP)]);
    for (const step of ledgers) {
      this.staffLayer.appendChild(this.ledgerMark(step, width * 0.3, LEDGER_COLOR));
    }
  }

  private ledgerMark(step: number, width: number, color: string): HTMLDivElement {
    const y = freePlayStepY(step, this.staff);
    return element('div', {
      position: 'absolute',
      left: '50%',
      top: `${y}px`,
      width: `${width}px`,
      height: '1px',
      transform: 'translate(-50%, -50%)',
      background: color,
    });
  }

  private tap(event: PointerEvent): void {
    const rect = this.root.getBoundingClientRect();
    const step = freePlayStepAt(event.clientY - rect.top, this.staff);
    this.sound(step);
    // In practice the letter belongs to the column being written (the pip's,
    // before this tap moves it), lifted clear of the head; otherwise centred.
    this.showLabel(step, this.practising ? this.currentLine() : null);
    if (this.session.recording) {
      this.session = recordTap(this.session, step);
      this.renderRecordUI();
    } else if (this.practising) {
      const before = this.practiceIndex;
      const result = practiceTap(this.practiceIndex, step, this.practiceSteps);
      this.practiceIndex = result.index;
      const right = result.index !== before || result.finished;
      const wasShown = pipShown(this.byHeart, this.help);
      if (this.byHeart) this.help = byHeartTap(this.help, right);
      if (right && wasShown) this.pulsePip();
      if (result.finished) this.chime();
      this.renderPip();
    }
  }

  /**
   * The end of the tune in practice: two soft notes above its first one,
   * as the pip wraps home. A chime, not a grade — it says "from the top",
   * never how well.
   */
  private chime(): void {
    const home = semitoneAtStep(this.practiceSteps[0]) + 12;
    const t = this.ctx.currentTime + 0.35;
    try {
      for (const [offset, at] of [[0, 0], [7, 0.16]] as const) {
        playVoiceNote(
          this.ctx,
          this.destination,
          this.opts.voice,
          semitoneToFrequency(AUDIO_MANIFEST.rootFrequencyHz, home + offset),
          t + at,
          { holdSec: 0.9, gain: 0.1 },
        );
      }
    } catch {
      // A missing chime is a smaller failure than a broken screen.
    }
  }

  private sound(step: number): void {
    try {
      playVoiceNote(
        this.ctx,
        this.destination,
        this.opts.voice,
        semitoneToFrequency(AUDIO_MANIFEST.rootFrequencyHz, semitoneAtStep(step)),
        this.ctx.currentTime + 0.005,
        { holdSec: 0.7, gain: 0.22 },
      );
    } catch {
      // A silent tap is a smaller failure than a broken screen.
    }
  }

  private showLabel(step: number, line: ReturnType<typeof practiceLine> | null): void {
    const y = freePlayStepY(step, this.staff);
    if (line) {
      const below = step >= PRACTICE_LABEL_FLIP_STEP;
      this.noteLabel.style.left = `calc(50% + ${line.offsetX(line.pipColumn)}px)`;
      this.noteLabel.style.top = `${below ? y + PRACTICE_LABEL_LIFT : y - PRACTICE_LABEL_LIFT}px`;
    } else {
      this.noteLabel.style.left = '50%';
      this.noteLabel.style.top = `${y}px`;
    }
    this.noteLabel.textContent =
      currentLabelStyle() === 'solfege' ? solfegeAtStep(step) : letterForStep(step);
    this.noteLabel.style.opacity = '1';
    if (this.labelTimer !== null) clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => {
      this.noteLabel.style.opacity = '0';
    }, 900);
  }

  /** Switches and persists the label style, then redraws the toggle's own text. */
  private onToggleLabelStyle(): void {
    setLabelStyle(currentLabelStyle() === 'solfege' ? 'letter' : 'solfege', this.opts.scaffold);
    this.renderLabelToggle();
  }

  /** The toggle always names the style tapping it would switch TO, like `keepTapping`'s own link. */
  private renderLabelToggle(): void {
    this.labelToggle.textContent =
      currentLabelStyle() === 'solfege' ? 'Back to letters (A B C)' : 'Try solfège (do re mi)';
  }

  /** The record button: starts a fresh take, or freezes the one in progress. */
  private onRecordButton(): void {
    if (this.naming) return;
    if (this.session.recording) {
      this.session = stopRecording(this.session);
      if (recordingProblem(this.session.steps) === null) this.openNaming();
    } else {
      // Per `customSongs.ts`'s own doc comment on `startRecording`: any
      // earlier take not yet saved is simply gone. Pressing record again
      // from the "stopped, still has a problem" state IS the discard.
      this.session = startRecording();
    }
    this.renderRecordUI();
  }

  /**
   * By heart's way in and out (task 235), in the bottom-right corner while
   * practising: "play by heart" sends the dot away, "show the dot" brings it
   * back for good. Named for what tapping it does, like the label toggle.
   */
  private byHeartLink(): HTMLDivElement {
    const link = element('div', {
      pointerEvents: 'auto',
      display: 'inline-block',
      fontSize: '13px',
      letterSpacing: '0.02em',
      textDecoration: 'underline',
      fontStyle: 'italic',
      cursor: 'pointer',
      opacity: '0.8',
    });
    link.textContent = this.byHeart ? 'show the dot' : 'play by heart';
    link.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onToggleByHeart();
    });
    bindRowActivation(link, true, () => this.onToggleByHeart());
    return link;
  }

  private onToggleByHeart(): void {
    this.byHeart = !this.byHeart;
    this.help = NO_HELP;
    this.renderRecordUI();
  }

  /** "Not yet, keep tapping" — the declined-kindly path back into capture, nothing already tapped lost. */
  private onKeepTapping(): void {
    this.session = resumeRecording(this.session);
    this.renderRecordUI();
  }

  private openNaming(): void {
    this.naming = true;
    this.nameInput.value = '';
    this.nameError.textContent = '';
    this.renderRecordUI();
    this.nameInput.focus();
  }

  private onCancelName(): void {
    this.naming = false;
    this.session = resumeRecording(this.session);
    this.renderRecordUI();
  }

  private onSaveName(): void {
    const result = finishRecording(this.session, this.nameInput.value);
    if ('error' in result) {
      this.nameError.textContent = result.error;
      return;
    }
    this.naming = false;
    this.session = EMPTY_RECORDING;
    this.renderRecordUI();
    this.flashHint(`Saved "${result.song.title}" — find it in your songbook.`);
  }

  /** Shows a temporary message in the hint line, then reverts to whatever `renderRecordUI` would otherwise show. */
  private flashHint(message: string): void {
    this.hint.textContent = message;
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.renderRecordUI();
    }, 2600);
  }

  /** Redraws the record button, hint line and controls row from `session`/`naming` — the one place all of that state becomes pixels. */
  private renderRecordUI(): void {
    this.nameScrim.style.display = this.naming ? 'flex' : 'none';
    this.recordButton.style.visibility = this.naming ? 'hidden' : 'visible';
    this.controlsRow.replaceChildren();
    this.renderPip();

    if (this.hintTimer !== null) return; // a flashed confirmation is still showing itself out

    if (this.naming) {
      this.recordButton.textContent = '■';
      this.recordButton.setAttribute('aria-label', 'Stop and save recording');
      this.hint.textContent = 'Name your song to save it';
      return;
    }

    if (this.session.recording) {
      this.recordButton.textContent = '■';
      this.recordButton.setAttribute('aria-label', 'Stop and save recording');
      const n = this.session.steps.length;
      this.hint.textContent = recordingProblem(this.session.steps) ?? `${n} notes — tap ■ to stop and save`;
      return;
    }

    this.recordButton.textContent = '●';
    this.recordButton.setAttribute('aria-label', 'Start recording');

    if (this.session.steps.length === 0) {
      this.hint.textContent = !this.practiceSteps.length ? DEFAULT_HINT : this.byHeart ? BY_HEART_HINT : PRACTICE_HINT;
      if (this.practiceSteps.length) this.controlsRow.appendChild(this.byHeartLink());
      return;
    }

    // Stopped with a take that still can't be saved (too short, etc.) —
    // `onRecordButton` already sent a clean take straight to the name
    // dialog, so reaching here means a problem is still open.
    this.hint.textContent = recordingProblem(this.session.steps) ?? DEFAULT_HINT;
    const keepTapping = element('div', {
      pointerEvents: 'auto',
      display: 'inline-block',
      fontSize: '13px',
      letterSpacing: '0.02em',
      textDecoration: 'underline',
      fontStyle: 'italic',
      cursor: 'pointer',
    });
    keepTapping.textContent = 'keep tapping';
    keepTapping.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onKeepTapping();
    });
    bindRowActivation(keepTapping, true, () => this.onKeepTapping());
    this.controlsRow.appendChild(keepTapping);
  }
}

type Style = Partial<Record<string, string>>;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, style: Style): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
