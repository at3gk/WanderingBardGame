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
import { hudChrome, instrumentCaseBox, songBookBox } from './hudLayout';

/** Where the chrome rests when nothing has happened for a while. */
const IDLE_OPACITY = 0.36;
/** Seconds a change stays bright before easing back down. */
const ATTENTION_SEC = 3.5;
/** How long a journal line stays up if nobody replaces it. */
const DEFAULT_HOLD_SEC = 7.5;
/**
 * How long an open case waits before shutting itself again.
 *
 * There is no scrim behind it and no close control, on purpose: a full-screen
 * catcher would have to swallow a tap to dismiss, and in this game a swallowed
 * tap is a missed note or a vista you asked to leave and did not. So the case
 * closes on a choice, on the corner being tapped again, on the phase changing,
 * and otherwise on its own after a while — which is also what an actual case
 * left open on the roadside would not do, but is the closest a screen gets.
 */
const CASE_HOLD_SEC = 7;

/** What the case can hold: an instrument's id and what it is called. */
export interface CaseEntry {
  id: string;
  name: string;
}

/** A song the book can offer: its id and its title. */
export interface SongEntry {
  id: string;
  name: string;
}

/** The songbook's endpaper actions: press the journey into a keepsake file, or unfold one. */
export type KeepsakeAction = 'save' | 'restore';

/** One moment on tonight's page, with the sky it happened under. */
export interface PageMoment {
  text: string;
  dayFraction: number;
}

/** Tonight's page, composed by `core/campfirePage.ts`. */
export interface PageContent {
  title: string;
  moments: PageMoment[];
  festival: string;
  /** The fire's asking, when a rehearsal is on offer. */
  invitation?: string;
  /** The moonlit road's door — its own tappable row, unlike every other line. */
  walkOn?: string;
}

/**
 * Ink for a moment, tinted by the sky it happened under: moonlight blue
 * through dawn rose, day cream, golden amber, dusk, and back to moonlight.
 * The page's one indulgence — a day read back in its own light — and cheap,
 * because the journal already stamps every entry with its `dayFraction`
 * precisely so a recap could do this (journey.ts said so before any recap
 * existed).
 */
const PAGE_INK_STOPS: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
  [0.0, [174, 184, 216]],
  [0.22, [240, 203, 166]],
  [0.5, [240, 226, 198]],
  [0.82, [243, 198, 143]],
  [0.95, [217, 163, 160]],
  [1.0, [174, 184, 216]],
];

function pageInk(dayFraction: number): string {
  const f = Number.isFinite(dayFraction) ? Math.min(1, Math.max(0, dayFraction)) : 0.5;
  for (let i = 1; i < PAGE_INK_STOPS.length; i++) {
    const [f1, c1] = PAGE_INK_STOPS[i];
    if (f > f1) continue;
    const [f0, c0] = PAGE_INK_STOPS[i - 1];
    const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
    const ch = (k: 0 | 1 | 2) => Math.round(c0[k] + (c1[k] - c0[k]) * t);
    return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
  }
  return INK;
}

/** What the song corner says while no song is pinned. */
const WANDERING_LABEL = 'Wandering';
/** The row that hands the rotation back. */
const WANDER_ROW_LABEL = 'Wander the songbook';

/**
 * The face stack.
 *
 * Local families only, in the order a device is likeliest to have something
 * good: a book serif if there is one, then the platform serif, then whatever
 * `serif` resolves to. No webfont is fetched — see the file header.
 */
const BOOK_FACE =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

/** Ink. Cream, the game's notation colour, at two strengths. */
const INK = '#f0e2c6';
const INK_SOFT = 'rgba(240, 226, 198, 0.72)';

/**
 * What sits behind a journal line.
 *
 * A soft radial smudge rather than a panel. The first version was a
 * rounded rectangle with a border and a backdrop blur, and against a bright
 * dawn sky it read as a grey dialog box dropped on top of a painting — the
 * one hard edge in a frame that has none.
 *
 * The radii are the whole trick and they are easy to get wrong: a
 * radial-gradient is *clipped* by its element, so an ellipse wider than the
 * box has its sides cut off at whatever opacity it had reached there, and
 * the result is a rectangle again. Just under half the width and half the
 * height put the transparent stop right on every edge, so there is nothing
 * to clip and no edge to see.
 *
 * What it is *made of* is the second half of the problem and it was wrong
 * for longer. It was a fixed rgba(28, 21, 26) — a neutral grey-purple, and
 * the only neutral grey in a game whose standing rule is that shadows are
 * never grey. Floating in a pink dusk sky it read as a smear on the lens.
 * So the wash now takes its hue from the sky the card is sitting in (see
 * `setTone`) and its peak alpha has come down from 0.55 to 0.34, with the
 * two-layer text shadow underneath doing more of the contrast work. The card
 * should read as the sky going quiet behind the words, not as a panel.
 */
function journalWash(r: number, g: number, b: number): string {
  const stop = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return (
    `radial-gradient(49% 50% at 50% 50%, ${stop(0.34)} 0%, ${stop(0.2)} 46%, ${stop(0)} 100%)`
  );
}

/** Before the sky has said anything: a warm dusk, not a grey. */
const JOURNAL_WASH = journalWash(34, 22, 24);

export type HudMode = 'walking' | 'busking' | 'encounter' | 'resting';

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly probe: HTMLDivElement;
  private readonly coinsBox: HTMLDivElement;
  private readonly coinsValue: HTMLSpanElement;
  private readonly instrumentBox: HTMLDivElement;
  private readonly instrumentName: HTMLSpanElement;
  private readonly caseCatch: SVGSVGElement;
  private readonly caseBox: HTMLDivElement;
  private readonly songBox: HTMLDivElement;
  private readonly songName: HTMLSpanElement;
  private readonly songCatch: SVGSVGElement;
  private readonly bookBox: HTMLDivElement;
  private readonly journalBox: HTMLDivElement;
  private readonly journalLine: HTMLParagraphElement;
  private readonly pageBox: HTMLDivElement;
  private pageShown = false;

  private chrome: HudChrome;
  private coins = -1;
  private instrument = '';
  private mode: HudMode = 'walking';

  /** Everything the bard could take out, the one in hand included. */
  private caseEntries: CaseEntry[] = [];
  private heldId = '';
  private caseOpen = false;
  private caseHold = 0;
  private chosen: ((id: string) => void) | null = null;

  /** Every song the road could play, and which one is pinned (or null). */
  private songEntries: SongEntry[] = [];
  private pinnedSongId: string | null = null;
  private bookOpen = false;
  private bookHold = 0;
  private songChosen: ((id: string | null) => void) | null = null;
  private keepsakeCb: ((action: KeepsakeAction) => void) | null = null;
  private walkOnCb: (() => void) | null = null;

  /** Seconds of brightness left on each piece. */
  private coinsAttention = 0;
  private instrumentAttention = 0;
  private songAttention = 0;
  private journalHold = 0;
  /** Last sky colour the wash was built from, quantised. See `setTone`. */
  private toneKey = -1;

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

    // --- what is in your hands, and what else is in the case ---------------
    //
    // The corner is a readout until there is more than one instrument in the
    // case, and then it is also the handle that opens it. That is the whole
    // interface: this game has no menus and does not want one, so choosing an
    // instrument is the same gesture as reading which one you are holding.
    //
    // It is the only thing on the screen that takes a tap away from the game.
    // The rule everywhere else is that the whole window belongs to the road,
    // and carving 164 by 44 out of the bottom corner is a real cost — a vista
    // dismissed by tapping there does not dismiss. It is the smallest area
    // that can hold the name that has to be there anyway, and the corner
    // stops taking taps entirely during a busk, which is the moment where a
    // swallowed tap is a missed note rather than a second attempt.
    // `flex-start`, not `flex-end`, though the rows grow up from the bottom:
    // the box is sized by the layout to exactly the rows that fit, so there
    // is never free space to justify away — and when more rows are given
    // than fit, `flex-end` puts the overflow *above* the box, where CSS
    // provides no way to scroll to it. Found live: a 12-row songbook on a
    // desktop rendered its first four rows over the sky, untappable.
    this.caseBox = element('div', {
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      boxSizing: 'border-box',
      overflowY: 'auto',
      overflowX: 'hidden',
      pointerEvents: 'none',
      // The journal's wash, not one of its own. A second wash was tried with
      // its ellipse pushed out sideways so the shorter rows had ink under
      // them, and it made the mistake that function's header warns about: an
      // ellipse wider than its box is clipped at the box's edge, so the case
      // gained a hard vertical border down one side — the only straight edge
      // in a frame that has none. One wash, and the text shadows carry the
      // rows that fall outside it, exactly as they do in the card.
      background: JOURNAL_WASH,
      opacity: '0',
      transition: 'opacity 320ms ease',
    });
    this.root.appendChild(this.caseBox);

    this.instrumentBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
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
    this.caseCatch = caseMark();
    this.caseCatch.style.display = 'none';
    this.instrumentBox.appendChild(this.caseCatch);
    this.instrumentBox.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.setCaseOpen(!this.caseOpen);
    });
    this.root.appendChild(this.instrumentBox);

    // --- the song being learnt, and the rest of the songbook ---------------
    //
    // The instrument corner's mirror image, in the opposite bottom corner and
    // built by exactly the same rules: a readout that is also the handle, a
    // stack of rows that reads as the corner opened, and no scrim. The one
    // structural difference is that the book always has somewhere to go —
    // "wander" is a choice too — so its catch shows whenever the moment
    // allows choosing at all, rather than waiting for a second entry.
    this.bookBox = element('div', {
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      // See the case above for why this is not `flex-end`.
      justifyContent: 'flex-start',
      boxSizing: 'border-box',
      overflowY: 'auto',
      overflowX: 'hidden',
      pointerEvents: 'none',
      background: JOURNAL_WASH,
      opacity: '0',
      transition: 'opacity 320ms ease',
    });
    this.root.appendChild(this.bookBox);

    this.songBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '8px',
      transition: 'opacity 900ms ease',
      textShadow: '0 1px 3px rgba(20, 14, 18, 0.75)',
    });
    this.songName = element('span', {
      fontStyle: 'italic',
      color: INK_SOFT,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    this.songName.textContent = WANDERING_LABEL;
    this.songBox.appendChild(this.songName);
    this.songCatch = caseMark();
    this.songCatch.style.display = 'none';
    this.songBox.appendChild(this.songCatch);
    this.songBox.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.setBookOpen(!this.bookOpen);
    });
    this.root.appendChild(this.songBox);

    // --- the journal ------------------------------------------------------
    this.journalBox = element('div', {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box',
      justifyContent: 'center',
      background: JOURNAL_WASH,
      // A fraction of a degree off square, so the line sits on the page the
      // way handwriting does rather than the way a caption does.
      transform: 'rotate(-0.35deg)',
      opacity: '0',
      transition: 'opacity 700ms ease',
    });
    this.journalLine = element('p', {
      margin: '0',
      padding: '0 24px',
      fontStyle: 'italic',
      lineHeight: '1.5',
      textAlign: 'center',
      // Two shadows: a tight one for edge contrast and a wide soft one that
      // does the work when the line falls over a bright sky.
      textShadow: '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 14px rgba(20, 14, 18, 0.7)',
    });
    this.journalBox.appendChild(this.journalLine);
    this.root.appendChild(this.journalBox);

    // --- tonight's page ---------------------------------------------------
    //
    // The campfire's read-back of the day (core/campfirePage.ts composes it;
    // this only sets it in type). A column above the instrument corner: the
    // fire and the seated bard hold the frame's centre and right, so the
    // left margin is the page's to use, and growing from the corner keeps
    // it in the same family as the case and the book — the HUD's one idiom,
    // a corner opened. Tap to fold it away.
    this.pageBox = element('div', {
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      boxSizing: 'border-box',
      padding: '18px 22px',
      background: JOURNAL_WASH,
      opacity: '0',
      transition: 'opacity 700ms ease',
      pointerEvents: 'none',
      cursor: 'pointer',
    });
    this.pageBox.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.hidePage();
    });
    this.root.appendChild(this.pageBox);

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
   * What is in the case, and which one is in the bard's hands.
   *
   * The open case lists everything *except* the one being held, because the
   * one being held is already named in the corner directly beneath it. A list
   * that repeated it would need a tick or a highlight to say which row was
   * the current one, and this way the question does not come up: the corner
   * is what you have out, the rows above are what else you could.
   */
  setCase(entries: readonly CaseEntry[], heldId: string): void {
    this.caseEntries = Array.isArray(entries)
      ? entries.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
      : [];
    this.heldId = typeof heldId === 'string' ? heldId : '';
    this.buildCase();
    if (this.caseRows().length === 0) this.setCaseOpen(false);
    this.layoutCase();
    this.applyPickable();
  }

  /** Called with an instrument id when the player takes one out of the case. */
  onInstrumentChosen(handler: (id: string) => void): void {
    this.chosen = handler;
  }

  /**
   * The songbook, and which tune is pinned for the walk (null while
   * wandering). The corner names the pinned song, or says "Wandering"; the
   * open book lists everything else, with the wander row on top whenever a
   * song is pinned.
   */
  setSongbook(entries: readonly SongEntry[], pinnedId: string | null): void {
    this.songEntries = Array.isArray(entries)
      ? entries.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
      : [];
    this.pinnedSongId = typeof pinnedId === 'string' && pinnedId !== '' ? pinnedId : null;
    const pinned = this.songEntries.find((e) => e.id === this.pinnedSongId);
    const label = pinned ? pinned.name : WANDERING_LABEL;
    if (label !== this.songName.textContent) {
      this.songName.textContent = label;
      this.songAttention = ATTENTION_SEC;
    }
    this.buildBook();
    if (this.bookRows().length === 0) this.setBookOpen(false);
    this.layoutBook();
    this.applyPickable();
  }

  /** Called with a song id when the player pins one, or null for wander. */
  onSongChosen(handler: (id: string | null) => void): void {
    this.songChosen = handler;
  }

  /**
   * Called when the player presses the journey into a keepsake file or
   * unfolds one back into the game. Registering the handler is also what
   * makes the endpaper rows appear at all — a book with nobody listening
   * offers no keepsake, so tests and any host that never wires it see the
   * songbook exactly as it always was.
   */
  onKeepsake(handler: (action: KeepsakeAction) => void): void {
    this.keepsakeCb = handler;
    this.buildCase();
    this.applyPickable();
  }

  /**
   * Called when the player takes the page's walk-on door — the moonlit
   * road. Same contract as `onKeepsake`: registering the handler is what
   * makes the door render at all, so a host that never wires it (tests,
   * the proof sheets) sees the page exactly as it always was.
   */
  onWalkOn(handler: () => void): void {
    this.walkOnCb = handler;
  }

  /** Whether tonight's page is open. The stage re-opens it on a tap at the fire. */
  get isPageOpen(): boolean {
    return this.pageShown;
  }

  /**
   * Open tonight's page — the campfire's read-back of the day. The rows
   * reveal one by one, the way a page is read aloud, and each moment is
   * inked in the light it happened under. A tap folds it away; `strikeCamp`
   * folds it away too, so it cannot outlive the fire.
   */
  showPage(page: PageContent): void {
    this.pageShown = true;
    this.pageBox.replaceChildren();

    const shadow = '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 12px rgba(20, 14, 18, 0.7)';
    const rows: HTMLElement[] = [];

    const title = element('div', {
      color: INK_SOFT,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontSize: '0.72em',
      textShadow: shadow,
    });
    title.textContent = page.title;
    rows.push(title);

    for (const moment of page.moments) {
      const row = element('div', {
        marginTop: '8px',
        fontStyle: 'italic',
        lineHeight: '1.45',
        color: pageInk(moment.dayFraction),
        textShadow: shadow,
      });
      row.textContent = moment.text;
      rows.push(row);
    }

    const festival = element('div', {
      marginTop: '16px',
      fontStyle: 'italic',
      lineHeight: '1.45',
      color: INK,
      textShadow: shadow,
    });
    festival.textContent = page.festival;
    rows.push(festival);

    if (page.invitation) {
      const invitation = element('div', {
        marginTop: '12px',
        fontStyle: 'italic',
        fontSize: '0.9em',
        lineHeight: '1.45',
        color: INK_SOFT,
        textShadow: shadow,
      });
      invitation.textContent = page.invitation;
      rows.push(invitation);
    }

    // The one row that is a door rather than a line: tapping it walks on
    // instead of folding the page, so it stops the fold from hearing the
    // tap. Vertical padding is the touch target (the text alone would be
    // under WCAG's 24px); full ink rather than soft, because a door should
    // read a shade firmer than the prose around it.
    if (page.walkOn && this.walkOnCb) {
      const door = element('div', {
        marginTop: '10px',
        padding: '12px 0 4px',
        fontStyle: 'italic',
        fontSize: '0.9em',
        lineHeight: '1.45',
        color: INK,
        textShadow: shadow,
        cursor: 'pointer',
      });
      door.textContent = page.walkOn;
      door.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.hidePage();
        this.walkOnCb?.();
      });
      rows.push(door);
    }

    for (const [i, row] of rows.entries()) {
      row.style.opacity = '0';
      row.style.transition = 'opacity 900ms ease';
      row.style.transitionDelay = `${400 + i * 420}ms`;
      this.pageBox.appendChild(row);
    }

    this.layoutPage();
    this.pageBox.style.opacity = '1';
    this.pageBox.style.pointerEvents = 'auto';
    // Two frames, so the rows' transitions start from their styled zero
    // rather than being collapsed into the same style flush.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const row of rows) row.style.opacity = '1';
      }),
    );
  }

  /** Open the songbook as if its corner had been tapped. For the title card's second door. */
  openBook(): void {
    this.setBookOpen(true);
  }

  /**
   * A quiet sheet in the title card's family: a veil, a heading, optional
   * body lines, and doors. Tap on the veil (outside any door) dismisses.
   * Serves the post-festival choice and Book Two's invitation — the two
   * moments the game asks a question instead of taking a tap.
   */
  showSheet(options: {
    title: string;
    glyph?: string;
    lines?: readonly string[];
    doors?: ReadonlyArray<{ label: string; onPick?: () => void }>;
  }): void {
    const veil = element('div', {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      background:
        'radial-gradient(120% 90% at 50% 40%, rgba(26, 22, 33, 0.62) 0%, rgba(26, 22, 33, 0.88) 100%)',
      pointerEvents: 'auto',
      cursor: 'pointer',
      opacity: '0',
      transition: 'opacity 500ms ease',
      zIndex: '4',
      font: `400 17px/1.55 ${BOOK_FACE}`,
      textAlign: 'center',
      padding: '0 24px',
    });
    const shadow = '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 14px rgba(20, 14, 18, 0.7)';
    const dismiss = () => {
      veil.style.opacity = '0';
      veil.style.pointerEvents = 'none';
      window.setTimeout(() => veil.remove(), 600);
    };
    veil.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      dismiss();
    });

    const rows: HTMLElement[] = [];
    const title = element('div', { fontSize: '24px', color: INK, textShadow: shadow });
    title.textContent = options.title;
    rows.push(title);
    if (options.glyph) {
      const glyph = element('div', { fontSize: '64px', color: INK, textShadow: shadow, margin: '6px 0' });
      glyph.textContent = options.glyph;
      rows.push(glyph);
    }
    for (const text of options.lines ?? []) {
      const line = element('div', {
        fontStyle: 'italic',
        color: INK_SOFT,
        textShadow: shadow,
        maxWidth: '560px',
      });
      line.textContent = text;
      rows.push(line);
    }
    for (const [i, door] of (options.doors ?? []).entries()) {
      const row = element('div', {
        fontStyle: 'italic',
        fontSize: i === 0 ? '20px' : '16px',
        color: i === 0 ? INK : INK_SOFT,
        textShadow: shadow,
        padding: '12px 26px',
        cursor: 'pointer',
        marginTop: i === 0 ? '18px' : '0',
      });
      row.textContent = door.label;
      row.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        door.onPick?.();
      });
      rows.push(row);
    }

    for (const [i, row] of rows.entries()) {
      row.style.opacity = '0';
      row.style.transition = 'opacity 700ms ease';
      row.style.transitionDelay = `${180 + i * 220}ms`;
      veil.appendChild(row);
    }
    this.root.appendChild(veil);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        veil.style.opacity = '1';
        for (const row of rows) row.style.opacity = '1';
      }),
    );
  }

  /**
   * The title card (DESIGN.md, "A small title card"): one warm sheet for a
   * returning player — continue with a tap anywhere, or step into the
   * songbook. A brand-new player never sees it, and the game is loading
   * and live underneath it the whole time, so playable-in-five-seconds
   * holds either way: the card costs exactly one tap.
   */
  showTitleCard(onSongbook: () => void): void {
    const veil = element('div', {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      // The game's own dark plum, deep enough to read as a book cover but
      // thin enough that the dawn road glows through — the card should
      // feel like a bookmark lifted, not a menu.
      background:
        'radial-gradient(120% 90% at 50% 40%, rgba(26, 22, 33, 0.62) 0%, rgba(26, 22, 33, 0.88) 100%)',
      pointerEvents: 'auto',
      cursor: 'pointer',
      opacity: '0',
      transition: 'opacity 600ms ease',
      zIndex: '4',
      font: `400 17px/1.5 ${BOOK_FACE}`,
      textAlign: 'center',
    });

    const shadow = '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 14px rgba(20, 14, 18, 0.7)';
    const rows: HTMLElement[] = [];

    const title = element('div', {
      fontSize: '34px',
      letterSpacing: '0.04em',
      color: INK,
      textShadow: shadow,
    });
    title.textContent = 'The Wandering Bard';
    rows.push(title);

    const sub = element('div', {
      fontStyle: 'italic',
      color: INK_SOFT,
      textShadow: shadow,
      marginBottom: '26px',
    });
    sub.textContent = 'The road kept your place.';
    rows.push(sub);

    const doorStyle = {
      fontStyle: 'italic',
      color: INK,
      textShadow: shadow,
      padding: '12px 26px',
      cursor: 'pointer',
    } as const;

    const go = element('div', { ...doorStyle, fontSize: '21px' });
    go.textContent = 'Continue the journey';
    rows.push(go);

    const book = element('div', { ...doorStyle, fontSize: '16px', color: INK_SOFT });
    book.textContent = 'The songbook';
    rows.push(book);

    const dismiss = () => {
      veil.style.opacity = '0';
      veil.style.pointerEvents = 'none';
      window.setTimeout(() => veil.remove(), 700);
    };
    // The whole sheet is the default door — one tap, anywhere.
    veil.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      dismiss();
    });
    book.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      onSongbook();
    });

    for (const [i, row] of rows.entries()) {
      row.style.opacity = '0';
      row.style.transition = 'opacity 800ms ease';
      row.style.transitionDelay = `${200 + i * 260}ms`;
      veil.appendChild(row);
    }
    this.root.appendChild(veil);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        veil.style.opacity = '1';
        for (const row of rows) row.style.opacity = '1';
      }),
    );
  }

  /** Fold tonight's page away. */
  hidePage(): void {
    if (!this.pageShown) return;
    this.pageShown = false;
    this.pageBox.style.opacity = '0';
    this.pageBox.style.pointerEvents = 'none';
  }

  /**
   * Above the instrument corner, flush with its left edge (minus the pad,
   * so the type aligns with the corner's own), growing upward. The fire and
   * the seated bard hold the middle and right of the resting frame; the
   * left margin is the page's.
   */
  private layoutPage(): void {
    const { instrument } = this.chrome;
    const height = window.innerHeight || 0;
    this.pageBox.style.left = `${Math.max(0, instrument.left - 22)}px`;
    this.pageBox.style.bottom = `${height - instrument.top + 10}px`;
    this.pageBox.style.width = 'min(430px, 52vw)';
    this.pageBox.style.fontSize = `${Math.round(15 * (this.chrome.compact ? 0.88 : 1))}px`;
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

  /**
   * Tell the card what colour the sky is.
   *
   * Takes the world's current horizon colour, in 0..1 channels, and darkens
   * it hard to make the wash. Darkening rather than tinting a fixed grey:
   * the card has to read as *this* sky at a lower brightness, so at dusk it
   * is a deep plum and at noon a cool slate, and it never becomes the one
   * neutral in the frame.
   *
   * The string is only rebuilt when the colour has actually moved a step,
   * because assigning `style.background` is a style recalculation and the
   * sky moves by a hundredth of a channel per frame.
   */
  setTone(r: number, g: number, b: number): void {
    const quantise = (v: number) => Math.max(0, Math.min(60, Math.round(v * 60)));
    const key = (quantise(r) << 16) | (quantise(g) << 8) | quantise(b);
    if (key === this.toneKey) return;
    this.toneKey = key;
    const wash = journalWash(quantise(r) + 8, quantise(g) + 6, quantise(b) + 8);
    this.journalBox.style.background = wash;
    this.caseBox.style.background = wash;
    this.bookBox.style.background = wash;
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
    // Whatever else changes, the case shuts. Starting a tune with the case
    // open would leave a column of names over the road for as long as the
    // timer had left, and it is the wrong moment to be choosing anyway.
    this.setCaseOpen(false);
    this.setBookOpen(false);
    this.applyPickable();
    this.applyOpacity();
  }

  update(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const before =
      this.coinsAttention > 0 || this.instrumentAttention > 0 || this.songAttention > 0;
    this.coinsAttention = Math.max(0, this.coinsAttention - step);
    this.instrumentAttention = Math.max(0, this.instrumentAttention - step);
    this.songAttention = Math.max(0, this.songAttention - step);
    if (before || this.coinsAttention > 0 || this.instrumentAttention > 0 || this.songAttention > 0)
      this.applyOpacity();

    if (this.journalHold > 0) {
      this.journalHold -= step;
      if (this.journalHold <= 0) this.journalBox.style.opacity = '0';
    }

    if (this.caseHold > 0) {
      this.caseHold -= step;
      if (this.caseHold <= 0) this.setCaseOpen(false);
    }

    if (this.bookHold > 0) {
      this.bookHold -= step;
      if (this.bookHold <= 0) this.setBookOpen(false);
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
    place(this.songBox, this.chrome.song);
    place(this.journalBox, this.chrome.journal);

    const scale = this.chrome.compact ? 0.88 : 1;
    this.coinsBox.style.fontSize = `${Math.round(20 * scale)}px`;
    this.instrumentBox.style.fontSize = `${Math.round(15 * scale)}px`;
    this.caseBox.style.fontSize = `${Math.round(15 * scale)}px`;
    this.songBox.style.fontSize = `${Math.round(15 * scale)}px`;
    this.bookBox.style.fontSize = `${Math.round(15 * scale)}px`;
    this.journalLine.style.fontSize = `${Math.round(17 * scale)}px`;
    this.layoutCase();
    this.layoutBook();
    this.layoutPage();
    this.applyOpacity();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.root.remove();
  }

  /** What the open case would list: everything bar the one already in hand. */
  private caseRows(): CaseEntry[] {
    return this.caseEntries.filter((entry) => entry.id !== this.heldId);
  }

  private buildCase(): void {
    this.caseBox.replaceChildren();
    for (const entry of this.caseRows()) {
      const row = element('div', {
        display: 'flex',
        alignItems: 'center',
        flex: '0 0 auto',
        boxSizing: 'border-box',
        // Flush with the corner label below rather than indented from it.
        // The case and the name in hand are one column read from the bottom
        // up, and an indent turns them into a heading and a submenu.
        padding: '0',
        fontStyle: 'italic',
        color: INK_SOFT,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        textShadow: '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 12px rgba(20, 14, 18, 0.7)',
      });
      row.textContent = entry.name;
      // pointerdown rather than click, to match the game's own input: a tap
      // that has to wait for pointerup before anything moves feels like the
      // interface is thinking about it.
      row.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.setCaseOpen(false);
        this.chosen?.(entry.id);
      });
      this.caseBox.appendChild(row);
    }

    // The case's lining: two quiet rows for pressing the whole journey into
    // a keepsake file and unfolding one back in. They live in the case, not
    // the songbook, for a size reason that is also a story reason: the book
    // holds enough songs that anything after them sits below the layout's
    // whole-rows fold and is never seen, while the case holds a handful of
    // instruments at most — and the case is the bard's own luggage, which is
    // where a family keeps the things it cannot lose. Smaller, dimmer type
    // so a player scanning for an instrument reads past them; full row
    // height, because shrinking the *target* would trade the 44 pt touch
    // floor for typography.
    if (this.keepsakeCb) {
      for (const [action, label] of [
        ['save', 'Press a keepsake'],
        ['restore', 'Unfold a keepsake'],
      ] as const) {
        const row = element('div', {
          display: 'flex',
          alignItems: 'center',
          flex: '0 0 auto',
          boxSizing: 'border-box',
          padding: '0',
          fontStyle: 'italic',
          fontSize: '0.85em',
          color: 'rgba(240, 226, 198, 0.55)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          textShadow: '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 12px rgba(20, 14, 18, 0.7)',
        });
        row.textContent = label;
        row.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          this.setCaseOpen(false);
          this.keepsakeCb?.(action);
        });
        this.caseBox.appendChild(row);
      }
    }
    this.layoutCase();
  }

  /**
   * Size and place the case.
   *
   * The row height comes from the layout rather than from the type, so a row
   * is exactly as tall as the instrument corner it grew out of — which is a
   * touch target by construction, and which keeps the stack reading as one
   * ruled column rather than as text that happens to be listed.
   */
  private layoutCase(): void {
    const rows = this.caseBox.children;
    place(this.caseBox, instrumentCaseBox(this.chrome, rows.length));
    const height = this.chrome.instrument.height;
    for (const row of Array.from(rows)) {
      (row as HTMLElement).style.height = `${height}px`;
    }
  }

  /**
   * Whether the corner is a handle at the moment, or only a readout. The
   * keepsake rows count toward openability: a brand-new device has one
   * instrument and no case rows, and that is exactly the device that most
   * needs "Unfold a keepsake" to be reachable.
   */
  private pickable(): boolean {
    if (this.caseRows().length === 0 && !this.keepsakeCb) return false;
    return this.mode === 'walking' || this.mode === 'resting';
  }

  private applyPickable(): void {
    const handle = this.pickable();
    this.instrumentBox.style.pointerEvents = handle ? 'auto' : 'none';
    this.instrumentBox.style.cursor = handle ? 'pointer' : 'default';
    this.caseCatch.style.display = handle ? 'block' : 'none';

    const book = this.bookPickable();
    this.songBox.style.pointerEvents = book ? 'auto' : 'none';
    this.songBox.style.cursor = book ? 'pointer' : 'default';
    this.songCatch.style.display = book ? 'block' : 'none';
  }

  private setCaseOpen(open: boolean): void {
    const next = open && this.pickable();
    if (next === this.caseOpen) return;
    // One stack at a time: a case and a book both open is two columns of
    // choices over the road, which is a menu by another name.
    if (next) this.setBookOpen(false);
    this.caseOpen = next;
    this.caseHold = next ? CASE_HOLD_SEC : 0;
    this.caseBox.style.opacity = next ? '1' : '0';
    this.caseBox.style.pointerEvents = next ? 'auto' : 'none';
    // Bring the corner up with the case: the label and the rows above it are
    // one object while it is open, and a handle at idle opacity with a lit
    // stack over it reads as two.
    this.instrumentAttention = next ? Math.max(this.instrumentAttention, CASE_HOLD_SEC) : 0;
    this.applyOpacity();
  }

  /** What the open book would list: wander (when pinned), then every other song. */
  private bookRows(): Array<{ id: string | null; name: string }> {
    const rows: Array<{ id: string | null; name: string }> = [];
    if (this.pinnedSongId !== null) rows.push({ id: null, name: WANDER_ROW_LABEL });
    for (const entry of this.songEntries) {
      if (entry.id !== this.pinnedSongId) rows.push(entry);
    }
    return rows;
  }

  private buildBook(): void {
    this.bookBox.replaceChildren();
    for (const entry of this.bookRows()) {
      const row = element('div', {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: '0 0 auto',
        boxSizing: 'border-box',
        padding: '0',
        fontStyle: 'italic',
        color: INK_SOFT,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        textShadow: '0 1px 2px rgba(20, 14, 18, 0.85), 0 0 12px rgba(20, 14, 18, 0.7)',
      });
      row.textContent = entry.name;
      row.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.setBookOpen(false);
        this.songChosen?.(entry.id);
      });
      this.bookBox.appendChild(row);
    }
    this.layoutBook();
  }

  private layoutBook(): void {
    const rows = this.bookBox.children;
    place(this.bookBox, songBookBox(this.chrome, rows.length));
    const height = this.chrome.song.height;
    for (const row of Array.from(rows)) {
      (row as HTMLElement).style.height = `${height}px`;
    }
  }

  /**
   * Whether the song corner is a handle at the moment. Same moments as the
   * case — never during a busk, where a swallowed tap is a missed note —
   * but with no two-entry requirement, because wandering is always on offer.
   */
  private bookPickable(): boolean {
    if (this.songEntries.length === 0) return false;
    return this.mode === 'walking' || this.mode === 'resting';
  }

  private setBookOpen(open: boolean): void {
    const next = open && this.bookPickable();
    if (next === this.bookOpen) return;
    if (next) this.setCaseOpen(false);
    this.bookOpen = next;
    this.bookHold = next ? CASE_HOLD_SEC : 0;
    this.bookBox.style.opacity = next ? '1' : '0';
    this.bookBox.style.pointerEvents = next ? 'auto' : 'none';
    this.songAttention = next ? Math.max(this.songAttention, CASE_HOLD_SEC) : 0;
    this.applyOpacity();
  }

  private applyOpacity(): void {
    // During a busk the corners get out of the way entirely but do not
    // vanish: a player checking their takings mid-tune should not have to
    // wonder whether the game has stopped keeping count.
    const floor = this.mode === 'busking' ? IDLE_OPACITY * 0.5 : IDLE_OPACITY;
    this.coinsBox.style.opacity = String(this.coinsAttention > 0 ? 1 : floor);
    this.instrumentBox.style.opacity = String(this.instrumentAttention > 0 ? 0.9 : floor);
    this.songBox.style.opacity = String(this.songAttention > 0 ? 0.9 : floor);
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

/**
 * The catch on the case.
 *
 * Two short strokes leaning up toward each other, drawn slightly off true and
 * with unequal arms so it reads as a mark made with a pen rather than as a
 * disclosure triangle out of a settings screen. It is the only affordance the
 * interface has, and it appears only while the case has something in it and
 * the moment allows opening it — so its presence is the whole message.
 */
function caseMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 14 10');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '9');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = '0 0 auto';
  svg.style.opacity = '0.65';

  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stroke.setAttribute('d', 'M1.8 7.4 L6.9 2.4 L12.3 6.9');
  stroke.setAttribute('fill', 'none');
  stroke.setAttribute('stroke', '#f0e2c6');
  stroke.setAttribute('stroke-width', '1.5');
  stroke.setAttribute('stroke-linecap', 'round');
  stroke.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(stroke);
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
