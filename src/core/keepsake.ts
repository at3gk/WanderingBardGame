/**
 * The keepsake — the save, as a piece of paper.
 *
 * Everything this game remembers lives in three `localStorage` keys, and
 * `localStorage` is not a safe place to keep anything. Safari's Intelligent
 * Tracking Prevention deletes *all* script-writable storage for a site after
 * seven days without interaction; a family that plays every other weekend can
 * lose a summer of walking to a rule that was written about advertisers. An
 * installed home-screen app is exempt, which is why the install prompt exists,
 * but exemption is not recovery: it does nothing for a browser someone
 * cleared, a phone that was replaced, or a second device that never had the
 * save in the first place.
 *
 * So there is one backstop, and this is it. Export writes the whole save out
 * as a short JSON text the player owns — mail it to yourself, drop it in a
 * notes app, print it — and import reads it back. It fits the no-accounts
 * constraint precisely because it is not an account: nothing is uploaded,
 * nothing is signed into, and there is no server that could lose it. It is
 * paper, not login.
 *
 * Deliberately *not* a validator. Every record here already has a load path
 * that version-checks and normalizes on read — `loadJourney`, `loadScaffold`,
 * `loadIdle` — and a keepsake that inspected record contents would become a
 * second validator for the same shapes. Two validators for one shape drift
 * apart, and the one that drifts is always the one nobody exercises by
 * playing (journey.ts says this about its own storage path; it is doubly true
 * of a file a player touches twice a year). So records round-trip raw: this
 * module cares only that a record is JSON and is an object, and lets the
 * loaders judge the rest on the next read, exactly as they would have judged
 * the bytes that were never exported at all.
 */

import { bookmarkKey } from './profiles';
import { IDLE_STORAGE_KEY } from './idle';
import { JOURNEY_STORAGE_KEY } from './journey';

/**
 * Everything the game persists, listed in one place because a key that is
 * missing here is a key a family silently loses.
 *
 * `wb.learn.v1` is private to `scaffoldStorage.ts` — it is not exported there
 * on purpose, since nothing outside that module has any business reading the
 * scaffold record — so it is repeated as a literal rather than imported. If
 * that key is ever versioned up, this line has to move with it.
 */
const KNOWN_KEYS: readonly string[] = [JOURNEY_STORAGE_KEY, 'wb.learn.v1', IDLE_STORAGE_KEY];

/** What the exported file is called when the player saves it. */
export const KEEPSAKE_FILENAME = 'wandering-bard-keepsake.json';

const KEEPSAKE_KIND = 'wandering-bard-keepsake';
const KEEPSAKE_VERSION = 1;

/**
 * The whole save as JSON text, or null when there is nothing to keep.
 *
 * Null covers both "storage is unavailable" and "storage is fine and empty" —
 * two different facts about the machine, but the same fact about the player,
 * who has no keepsake to be offered either way. The caller shows no button.
 *
 * Pretty-printed with two-space indent. This is a file a family is asked to
 * hold on to, and a wall of minified JSON looks like something that went
 * wrong; a readable one looks like a thing worth keeping. It costs a few
 * hundred bytes on a payload measured in kilobytes.
 *
 * A record that will not parse is skipped rather than exported as a string or
 * carried through as-is. A corrupt record is already lost — its loader will
 * discard it on the next read — and copying it into the keepsake would only
 * preserve the corruption across the one operation meant to escape it.
 */
export function exportKeepsake(nowMs: number = Date.now()): string | null {
  const store = storage();
  if (!store) return null;

  const records: Record<string, unknown> = {};
  let found = false;

  for (const key of KNOWN_KEYS) {
    try {
      const raw = store.getItem(bookmarkKey(key));
      if (!raw) continue;
      records[key] = JSON.parse(raw);
      found = true;
    } catch {
      // Unreadable or unparseable. Skip it and keep the healthy records.
    }
  }

  if (!found) return null;

  try {
    return JSON.stringify(
      { kind: KEEPSAKE_KIND, v: KEEPSAKE_VERSION, t: nowMs, records },
      null,
      2
    );
  } catch {
    return null;
  }
}

/**
 * What happened when a keepsake was handed back to the game. Three outcomes,
 * because the player needs three different sentences: it worked, the file was
 * a keepsake but had nothing in it, or that was not a keepsake.
 */
export type KeepsakeImportResult = 'restored' | 'nothing-inside' | 'unreadable';

/**
 * Write a keepsake's records back into storage.
 *
 * Only the three known keys are written. Unknown keys in the file are ignored
 * without comment: a keepsake arrives from outside the game — a text file, a
 * paste, a message forwarded between phones — and a restore that wrote
 * whatever keys it was handed would be a way to put arbitrary values into this
 * origin's `localStorage`. The list above is the whole allowance.
 *
 * A record that is not a plain object is dropped for the same reason a corrupt
 * one is never exported: every loader expects an object, and storing a string
 * or an array under a key would only give the next read something to throw
 * away. Beyond that shape check nothing is inspected — see the file header.
 *
 * `setItem` can throw on quota or in private browsing. If nothing at all got
 * written the file may as well have been empty, and 'nothing-inside' is the
 * honest thing to tell a player who is about to check whether it worked.
 */
export function importKeepsake(text: string): KeepsakeImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'unreadable';
  }

  const file = asRecord(parsed);
  if (!file) return 'unreadable';
  if (file.kind !== KEEPSAKE_KIND) return 'unreadable';
  if (file.v !== KEEPSAKE_VERSION) return 'unreadable';

  const records = asRecord(file.records);
  if (!records) return 'unreadable';

  const store = storage();
  let written = 0;

  if (store) {
    for (const key of KNOWN_KEYS) {
      const value = records[key];
      if (!asRecord(value)) continue;
      try {
        store.setItem(bookmarkKey(key), JSON.stringify(value));
        written += 1;
      } catch {
        // Quota, private browsing, partitioned storage. Try the next record;
        // a partial restore is worth more than none.
      }
    }
  }

  return written > 0 ? 'restored' : 'nothing-inside';
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Matches the wrapper in `journey.ts` and `scaffoldStorage.ts`:
 * `localStorage` can throw on mere property access in private browsing and
 * inside sandboxed iframes, and this ships on GitHub Pages where both happen.
 */
function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** A plain object, or null for anything else — arrays and `null` included. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
