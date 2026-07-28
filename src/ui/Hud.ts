/**
 * The heads-up chrome: a purse, an instrument, and a journal that speaks
 * when there is something to say.
 *
 * The governing constraint is that this game is *looked at*. A dashboard
 * would be a confession that the scenery is not worth watching, so there is
 * no meter, no combo counter, no score, no streak, and nothing at all in the
 * middle of the screen. Three small things sit in two corners and fade back
 * to almost nothing whenever they have not changed recently; the road gets
 * the rest of the glass.
 *
 * It is DOM rather than drawn into the scene, and that is a considered
 * choice rather than the easy one. Text drawn in WebGL at this size needs a
 * glyph atlas and a font, and the game has neither and does not want either
 * (`fx/SongNotes.ts` generates its own letters precisely to avoid shipping
 * one). A DOM layer gets the device's own serif, subpixel-accurate at any
 * density, for nothing — and it is the one part of the interface that is
 * allowed not to be diegetic, because a player who cannot read their own
 * takings is being kept in the dark for style.
 *
 * Everything positional comes from `hudLayout.ts`, which is pure and tested.
 * Nothing in this file computes a coordinate.
 */

import type { HudBox, HudChrome, SafeAreaInsets } from './hudLayout';
import { hudChrome } from './hudLayout';

/** Where the chrome rests when nothing has happened for a while. */
const IDLE_OPACITY = 0.36;
/** Seconds a change stays bright before easing back down. */
const ATTENTION_SEC = 3.5;
/** How long a journal line stays up if nobody replaces it. */
const DEFAULT_HOLD_SEC = 7.5;

/**
 * The face stack.
 *
 * Local families only, in the order a device is likeliest to have something
 * good: a book serif if there is one, then the platform serif, then whatever
 * `serif` resolves to. No webfont is fetched — see the file header.
 */
const BOOK_FACE =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

/** Parchment and ink. Both are the game's own colours, not new ones. */
const INK = '#f0e2c6';
const INK_SOFT = 'rgba(240, 226, 198, 0.72)';
const PARCHMENT = 'rgba(38, 30, 34, 0.62)';

export type HudMode = 'walking' | 'busking' | 'encounter' | 'resting';

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly probe: HTMLDivElement;
  private readonly coinsBox: HTMLDivElement;
  private readonly coinsValue: HTMLSpanElement;
  private readonly instrumentBox: HTMLDivElement;
  private readonly instrumentName: HTMLSpanElement;
  private readonly journalBox: HTMLDivElement;
  private readonly journalLine: HTMLParagraphElement;

  private chrome: HudChrome;
  private coins = -1;
  private instrument = '';
  private mode: HudMode = 'walking';

  /** Seconds of brightness left on each piece. */
  private coinsAttention = 0;
  private instrumentAttention = 0;
  private journalHold = 0;

  private readonly onResize = () => this.resize();

  constructor(host: HTMLElement) {
    this.root = element('div', {
      position: 'fixed',
      inset: '0',
      // The tap surface is the whole window and belongs to the game. Chrome
      // that ate a tap would eat a note, which is the one thing this
      // interface must never do.
      pointerEvents: 'none',
      zIndex: '3',
      font: `400 16px/1.45 ${BOOK_FACE}`,
      color: INK,
      // A tap that lands on the HUD must not select the text under it.
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });

    // A zero-sized probe whose padding is the safe-area insets. They cannot
    // be read from script any other way — `env()` only resolves in CSS.
    this.probe = element('div', {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
    });
    this.root.appendChild(this.probe);

    // --- the purse ------------------------------------------------------
    this.coinsBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '7px',
      transition: 'opacity 900ms ease',
      textShadow: '0 1px 3px rgba(20, 14, 18, 0.75)',
    });
    this.coinsBox.appendChild(coinMark());
    this.coinsValue = element('span', { letterSpacing: '0.02em' });
    this.coinsValue.textContent = '0';
    this.coinsBox.appendChild(this.coinsValue);
    this.root.appendChild(this.coinsBox);

    // --- what is in your hands -------------------------------------------
    this.instrumentBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      transition: 'opacity 900ms ease',
      textShadow: '0 1px 3px rgba(20, 14, 18, 0.75)',
    });
    this.instrumentName = element('span', {
      fontStyle: 'italic',
      color: INK_SOFT,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    this.instrumentBox.appendChild(this.instrumentName);
    this.root.appendChild(this.instrumentBox);

    // --- the journal ------------------------------------------------------
    this.journalBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box',
      background: PARCHMENT,
      // Uneven radii, and a fraction of a degree off square. A rectangle
      // reads as a dialog box; this reads as a page somebody tore.
      borderRadius: '14px 4px 12px 5px',
      border: '1px solid rgba(240, 226, 198, 0.16)',
      boxShadow: '0 6px 22px rgba(16, 11, 14, 0.4)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      transform: 'rotate(-0.35deg)',
      opacity: '0',
      transition: 'opacity 700ms ease',
    });
    this.journalLine = element('p', {
      margin: '0',
      padding: '0 20px',
      fontStyle: 'italic',
      lineHeight: '1.5',
      textShadow: '0 1px 2px rgba(20, 14, 18, 0.6)',
    });
    this.journalBox.appendChild(this.journalLine);
    this.root.appendChild(this.journalBox);

    host.appendChild(this.root);

    this.chrome = hudChrome({ width: 0, height: 0 });
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  /** Today's takings. Fractional coins are the economy's business, not the player's. */
  setCoins(coins: number): void {
    const whole = Math.max(0, Math.floor(Number.isFinite(coins) ? coins : 0));
    if (whole === this.coins) return;
    this.coins = whole;
    this.coinsValue.textContent = String(whole);
    this.coinsAttention = ATTENTION_SEC;
  }

  setInstrument(name: string): void {
    if (name === this.instrument) return;
    this.instrument = name;
    this.instrumentName.textContent = name;
    this.instrumentAttention = ATTENTION_SEC;
  }

  /**
   * Put a line in the journal.
   *
   * The line is written by whoever knows what happened —
   * `describeIdleYield`, `performanceSummary`, an encounter's own text. This
   * class never composes prose; a UI layer that starts writing sentences is
   * a UI layer that will eventually disagree with the game about what
   * occurred.
   */
  say(line: string, holdSec = DEFAULT_HOLD_SEC): void {
    if (typeof line !== 'string' || line === '') return;
    this.journalLine.textContent = line;
    this.journalHold = Math.max(0.5, holdSec);
    this.journalBox.style.opacity = '1';
  }

  /** Take the card down early, when the moment it described has passed. */
  clearSay(): void {
    this.journalHold = 0;
    this.journalBox.style.opacity = '0';
  }

  /**
   * What the player is doing.
   *
   * Busking is the one mode that gets its own treatment: the corners go all
   * the way down, because during a busk the player is reading notation in
   * the world and a number in the corner is a second thing to look at.
   */
  setMode(mode: HudMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyOpacity();
  }

  update(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const before = this.coinsAttention > 0 || this.instrumentAttention > 0;
    this.coinsAttention = Math.max(0, this.coinsAttention - step);
    this.instrumentAttention = Math.max(0, this.instrumentAttention - step);
    if (before || this.coinsAttention > 0 || this.instrumentAttention > 0) this.applyOpacity();

    if (this.journalHold > 0) {
      this.journalHold -= step;
      if (this.journalHold <= 0) this.journalBox.style.opacity = '0';
    }
  }

  /** Re-measure and re-place. Cheap enough to call on every resize event. */
  resize(): void {
    const insets = this.readInsets();
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    this.chrome = hudChrome({ width, height, insets });

    place(this.coinsBox, this.chrome.coins);
    place(this.instrumentBox, this.chrome.instrument);
    place(this.journalBox, this.chrome.journal);

    const scale = this.chrome.compact ? 0.88 : 1;
    this.coinsBox.style.fontSize = `${Math.round(20 * scale)}px`;
    this.instrumentBox.style.fontSize = `${Math.round(15 * scale)}px`;
    this.journalLine.style.fontSize = `${Math.round(17 * scale)}px`;
    this.applyOpacity();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.root.remove();
  }

  private applyOpacity(): void {
    // During a busk the corners get out of the way entirely but do not
    // vanish: a player checking their takings mid-tune should not have to
    // wonder whether the game has stopped keeping count.
    const floor = this.mode === 'busking' ? IDLE_OPACITY * 0.5 : IDLE_OPACITY;
    this.coinsBox.style.opacity = String(this.coinsAttention > 0 ? 1 : floor);
    this.instrumentBox.style.opacity = String(this.instrumentAttention > 0 ? 0.9 : floor);
  }

  private readInsets(): Partial<SafeAreaInsets> {
    try {
      const style = window.getComputedStyle(this.probe);
      return {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
      };
    } catch {
      // A detached or display:none probe measures as zero, which is exactly
      // what a browser with no safe area reports anyway.
      return {};
    }
  }
}

/**
 * The coin.
 *
 * Drawn as a path with none of its arcs quite matching, so it reads as
 * something inked by hand in a margin rather than as an icon. Inline SVG
 * rather than a glyph because there is no font here to take one from.
 */
function coinMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 22 22');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = '0 0 auto';
  svg.style.opacity = '0.9';

  const rim = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // Four asymmetric arcs. A perfect circle here is instantly a UI icon.
  rim.setAttribute(
    'd',
    'M11 2.2 C15.6 2.1 19.9 5.9 19.8 11.2 C19.7 16.1 15.9 19.9 10.8 19.8 C6.1 19.7 2.2 15.8 2.3 10.9 C2.4 6.2 6.3 2.3 11 2.2 Z',
  );
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', '#e6c98a');
  rim.setAttribute('stroke-width', '1.7');
  rim.setAttribute('stroke-linecap', 'round');

  const face = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  face.setAttribute('d', 'M8.4 11.4 C9.6 8.6 12.6 8.4 13.8 10.6 C12.9 13.6 9.6 13.9 8.4 11.4 Z');
  face.setAttribute('fill', '#e6c98a');
  face.setAttribute('opacity', '0.75');

  svg.appendChild(rim);
  svg.appendChild(face);
  return svg;
}

function place(node: HTMLElement, box: HudBox): void {
  node.style.left = `${box.left}px`;
  node.style.top = `${box.top}px`;
  node.style.width = `${box.width}px`;
  node.style.height = `${box.height}px`;
}

type Style = Partial<Record<string, string>>;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Style,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
