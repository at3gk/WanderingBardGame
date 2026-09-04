/**
 * Free play as an actual screen — task 176 piece 3's first slice.
 *
 * `core/freePlay.ts` has held the staff-ladder geometry (`freePlayStaff`,
 * `freePlayStepY`, `freePlayStepAt`) since ROADMAP task 41, and
 * `core/customSongs.ts` has held a recording session's state machine since
 * run 147 — but nothing draws the ladder or lets a finger reach it. This is
 * that draw: a full-screen ladder of the thirteen positions free play
 * offers (one ledger below middle C to one ledger above the staff, per
 * `FREE_PLAY_LOW_STEP`/`FREE_PLAY_HIGH_STEP`), five real staff lines at
 * `STAFF_LINE_STEPS` so the spaces read as spaces, and a tap anywhere on
 * the ladder plays that pitch and shows its letter — "position → sound →
 * name", per `freePlay.ts`'s own header.
 *
 * Deliberately NOT in this piece: recording (the record button, the name
 * prompt, wiring to `customSongs.ts`'s `RecordingSession`) and reachability
 * (no menu offers this screen yet — `App`/`Hud`'s mode machinery is a
 * separate, larger integration left for the next piece, after this piece's
 * shape has had a run to prove itself). This file is additive only: no
 * existing screen imports it yet, so it changes nothing about how the game
 * plays today.
 *
 * Recording taps in as a straight extension when it lands: `tap()` below is
 * already the one place every tapped step passes through, which is exactly
 * where `recordTap` would be called alongside `sound()`.
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

/** Room above/below the ladder for the hint line, the close mark and a phone's notch. */
const TOP_MARGIN = MIN_TOP_MARGIN + 30;
const BOTTOM_MARGIN = MIN_BOTTOM_MARGIN + 24;

const INK = '#f0e2c6';
const STAFF_LINE_COLOR = 'rgba(240, 226, 198, 0.5)';
const LEDGER_COLOR = 'rgba(240, 226, 198, 0.65)';
/** No sky to go quiet behind here — free play owns the whole screen, so it earns a real backdrop. */
const BACKDROP = 'rgba(20, 14, 18, 0.95)';

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
  private readonly host: HTMLElement;
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly opts: FreePlayScreenOptions;
  private staff: FreePlayStaff;
  private labelTimer: ReturnType<typeof setTimeout> | null = null;
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

    const hint = element('div', {
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
    hint.textContent = 'Tap a line or a space to hear it';
    this.root.appendChild(hint);

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

    // `freePlayStepAt` clamps to the nearest step across the whole ladder
    // (see its own header: a tap short of the top or bottom note should
    // still play that note, not nothing) — so one listener on the root,
    // not thirteen per-row hit targets, is the correct shape here.
    this.root.addEventListener('pointerdown', (event) => this.tap(event));

    window.addEventListener('resize', this.onResize);

    this.staff = freePlayStaff(host.clientHeight, TOP_MARGIN, BOTTOM_MARGIN);
    host.appendChild(this.root);
    this.layout();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.labelTimer !== null) clearTimeout(this.labelTimer);
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
}

type Style = Partial<Record<string, string>>;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, style: Style): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
