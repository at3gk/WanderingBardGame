import { bookmarkKey } from './profiles';
import { beginSession, createScaffold, decayForDaysAway, ScaffoldState } from './scaffold';

/**
 * The only thing this game persists. ~200 bytes: how familiar each staff
 * position has become, so the letter-fading in `scaffold.ts` can span
 * sessions — without it the per-session cap would keep every position
 * near full support forever and the model would be decorative.
 *
 * No login, no menu, no identifiers, no network. Every access is wrapped:
 * `localStorage` can throw on mere property access in private browsing and
 * in sandboxed iframes, and this ships inside GitHub Pages. When it throws
 * the game plays identically and simply starts each session fresh.
 */

const KEY = 'wb.learn.v1';
const SAVE_THROTTLE_MS = 5000;

interface Stored {
  v: 1;
  t: number;
  p: Record<string, [number, number, number]>;
  /** Chosen song id, or absent when wandering. See core/songChoice.ts. */
  s?: string;
  /**
   * Passes walked with each song pinned — the diary fact the by-heart
   * ladder reads (core/mastery.ts). In the same record as the scaffold
   * for the same reason the song choice is: one small anonymous key.
   * Absent in older saves, which reads as never-carried — the safe
   * answer, since it can only mean more help, never less.
   */
  w?: Record<string, number>;
}

/**
 * The chosen song rides in the *same* record as the scaffold rather than a
 * second key. That is deliberate: the design's promise is one small
 * anonymous key, and a settings key alongside it would quietly become two
 * things to keep in sync and two things to explain. It is held here in
 * module scope so `saveScaffold` can write it back without every caller
 * having to know about it.
 */
let songChoice: string | null = null;

/** Held beside `songChoice` for the same module-scope reason it is. */
let songWalks: Record<string, number> = {};

/** Every carried song's walk count — the festival's set list is drawn from this. */
export function allSongWalks(): Readonly<Record<string, number>> {
  return { ...songWalks };
}

/** How many walking passes this song has been carried through, lifetime. */
export function songWalksFor(songId: string): number {
  const n = songWalks[songId];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * One completed pass with `songId` pinned. Writes through on the ordinary
 * throttle — a lost pass or two at a closed tab only ever means a little
 * more help next time, which is the direction this model is allowed to
 * err in.
 */
export function recordSongWalk(songId: string, state: ScaffoldState): void {
  if (typeof songId !== 'string' || songId === '') return;
  songWalks[songId] = Math.min(9999, songWalksFor(songId) + 1);
  saveScaffold(state);
}

/** The song the child chose to learn, or null to wander. Reflects the last load or set. */
export function getSongChoice(): string | null {
  return songChoice;
}

/** Chooses a song (or null to wander) and writes it out immediately — a choice must survive a closed tab. */
export function setSongChoice(choice: string | null, state: ScaffoldState): void {
  songChoice = choice;
  saveScaffold(state, true);
}

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** Loads the record and applies time-away decay. Always returns a usable state. */
export function loadScaffold(nowMs: number = Date.now()): ScaffoldState {
  const state = createScaffold();
  // A fresh load must not inherit another record's walks — the early
  // returns below (no storage, no record) all mean "never carried".
  songWalks = {};
  const store = storage();
  if (!store) return state;

  try {
    const raw = store.getItem(bookmarkKey(KEY));
    if (!raw) return state;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || parsed.v !== 1 || typeof parsed.p !== 'object') return state;

    for (const [step, tuple] of Object.entries(parsed.p)) {
      if (!Array.isArray(tuple)) continue;
      const [strength, peak, band] = tuple;
      if (!Number.isFinite(strength) || !Number.isFinite(peak) || !Number.isFinite(band)) continue;
      state.positions[Number(step)] = { strength, peak, band, gained: 0 };
    }

    songChoice = typeof parsed.s === 'string' ? parsed.s : null;

    songWalks = {};
    if (parsed.w && typeof parsed.w === 'object' && !Array.isArray(parsed.w)) {
      for (const [id, n] of Object.entries(parsed.w)) {
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
          songWalks[id] = Math.min(9999, Math.floor(n));
        }
      }
    }

    const hoursAway = Math.max(0, (nowMs - (parsed.t ?? nowMs)) / 3_600_000);
    decayForDaysAway(state, Math.floor(hoursAway / 24));
  } catch {
    return createScaffold();
  }
  return beginSession(state);
}

let lastSaveMs = 0;

/** Writes the record, throttled. `force` is for page-hide, where the next chance may not come. */
export function saveScaffold(state: ScaffoldState, force = false, nowMs: number = Date.now()): void {
  if (!force && nowMs - lastSaveMs < SAVE_THROTTLE_MS) return;
  const store = storage();
  if (!store) return;
  lastSaveMs = nowMs;
  try {
    const p: Stored['p'] = {};
    for (const [step, s] of Object.entries(state.positions)) {
      p[step] = [Math.round(s.strength * 10) / 10, Math.round(s.peak * 10) / 10, s.band];
    }
    const record: Stored = { v: 1, t: nowMs, p };
    if (songChoice) record.s = songChoice;
    if (Object.keys(songWalks).length > 0) record.w = songWalks;
    store.setItem(bookmarkKey(KEY), JSON.stringify(record));
  } catch {
    // Quota, private browsing, partitioned storage — the game is unaffected.
  }
}
