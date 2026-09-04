/**
 * Free play as an actual screen — task 176 piece 3's first slice, plus
 * piece 4's recording door (2026-09-04, run 150).
 *
 * `core/freePlay.ts` has held the staff-ladder geometry (`freePlayStaff`,
 * `freePlayStepY`, `freePlayStepAt`) since ROADMAP task 41, and
 * `core/customSongs.ts` has held a recording session's state machine since
 * run 147 — but nothing drew the ladder or let a finger reach it, and
 * nothing called the state machine. This file is that draw: a full-screen
 * ladder of the thirteen positions free play offers (one ledger below
 * middle C to one ledger above the staff, per
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
 * problem (`recordingProblem`, the same words `engravingProblem` would
 * decline a save with) shows that message and a single "keep tapping"
 * button — `resumeRecording`, the module's own declined-kindly path — with
 * no separate "discard" concept: pressing record again from that state
 * calls `startRecording` again, which the module already documents as a
 * silent discard of the earlier take. A frozen take with no problem opens
 * the name dialog automatically; "Cancel" there also calls
 * `resumeRecording` rather than losing the take.
 *
 * Deliberately NOT in this piece: the "my songs" shelf in
 * `songChoice.ts`'s picker, so a saved tune has nowhere to be walked with
 * yet — reachability for *playing* a custom song, not for *making* one,
 * remains piece 4's last remaining slice.
 */
import {
  FREE_PLAY_LOW_STEP,
  FREE_PLAY_HIGH_STEP,
  MIN_TOP_MARGIN,
  MIN_BOTTOM_MARGIN,
  freePlayStaff,
  freePlayStepY,
  freePlayStepAt,
  FreePlayStaff,
} from '../core/freePlay';
import { STAFF_LINE_STEPS, needsLedger, letterForStep, semitoneAtStep } from '../core/notation';
import { semitoneToFrequency } from '../audio/baseLoop';
import { playVoiceNote } from '../audio/instrumentVoice';
import type { InstrumentVoice } from '../core/instruments';
import { AUDIO_MANIFEST } from '../audio/manifest';
import { BOOK_FACE } from './Hud';
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

export interface FreePlayScreenOptions {
  /** Which instrument's voice a tap sounds through — the one currently in hand, once wired. */
  voice: InstrumentVoice;
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
  private readonly host: HTMLElement;
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly opts: FreePlayScreenOptions;
  private staff: FreePlayStaff;
  private labelTimer: ReturnType<typeof setTimeout> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private session: RecordingSession = EMPTY_RECORDING;
  private naming = false;
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
      padding: '16px 12px 0',
      fontStyle: 'italic',
      letterSpacing: '0.02em',
      pointerEvents: 'none',
    });
    this.hint.textContent = DEFAULT_HINT;
    this.root.appendChild(this.hint);

    this.controlsRow = element('div', {
      position: 'absolute',
      top: '44px',
      left: '0',
      right: '0',
      textAlign: 'center',
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
    close.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.opts.onClose();
    });
    this.root.appendChild(close);

    this.staffLayer = element('div', { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.root.appendChild(this.staffLayer);

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
    cancelButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onCancelName();
    });

    this.nameScrim.appendChild(panel);
    this.root.appendChild(this.nameScrim);

    // `freePlayStepAt` clamps to the nearest step across the whole ladder
    // (see its own header: a tap short of the top or bottom note should
    // still play that note, not nothing) — so one listener on the root,
    // not thirteen per-row hit targets, is the correct shape here.
    this.root.addEventListener('pointerdown', (event) => this.tap(event));

    window.addEventListener('resize', this.onResize);

    this.staff = freePlayStaff(host.clientHeight, TOP_MARGIN, BOTTOM_MARGIN);
    host.appendChild(this.root);
    this.layout();
    this.renderRecordUI();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.labelTimer !== null) clearTimeout(this.labelTimer);
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.root.remove();
  }

  private layout(): void {
    const h = this.root.clientHeight || this.host.clientHeight || window.innerHeight;
    this.staff = freePlayStaff(h, TOP_MARGIN, BOTTOM_MARGIN);
    this.drawStaffLines();
  }

  private drawStaffLines(): void {
    this.staffLayer.replaceChildren();
    const width = Math.min(260, (this.root.clientWidth || 320) * 0.6);
    for (const step of STAFF_LINE_STEPS) {
      this.staffLayer.appendChild(this.ledgerMark(step, width, STAFF_LINE_COLOR));
    }
    // The ladder's own two ends double as the beginner's first ledger
    // lines (middle C below, A5 above) — `needsLedger` names exactly
    // those two steps.
    for (const step of [FREE_PLAY_LOW_STEP, FREE_PLAY_HIGH_STEP]) {
      if (!needsLedger(step)) continue;
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
    this.showLabel(step);
    if (this.session.recording) {
      this.session = recordTap(this.session, step);
      this.renderRecordUI();
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

  private showLabel(step: number): void {
    this.noteLabel.style.top = `${freePlayStepY(step, this.staff)}px`;
    this.noteLabel.textContent = letterForStep(step);
    this.noteLabel.style.opacity = '1';
    if (this.labelTimer !== null) clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => {
      this.noteLabel.style.opacity = '0';
    }, 900);
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

    if (this.hintTimer !== null) return; // a flashed confirmation is still showing itself out

    if (this.naming) {
      this.recordButton.textContent = '■';
      this.hint.textContent = 'Name your song to save it';
      return;
    }

    if (this.session.recording) {
      this.recordButton.textContent = '■';
      const n = this.session.steps.length;
      this.hint.textContent = recordingProblem(this.session.steps) ?? `${n} notes — tap ■ to stop and save`;
      return;
    }

    this.recordButton.textContent = '●';

    if (this.session.steps.length === 0) {
      this.hint.textContent = DEFAULT_HINT;
      return;
    }

    // Stopped with a take that still can't be saved (too short, etc.) —
    // `onRecordButton` already sent a clean take straight to the name
    // dialog, so reaching here means a problem is still open.
    this.hint.textContent = recordingProblem(this.session.steps) ?? DEFAULT_HINT;
    const keepTapping = element('div', {
      pointerEvents: 'auto',
      display: 'inline-block',
      marginTop: '6px',
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
    this.controlsRow.appendChild(keepTapping);
  }
}

type Style = Partial<Record<string, string>>;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, style: Style): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
