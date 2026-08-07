/**
 * Two bookmarks on one bench — the storage half (task 157, piece 1).
 *
 * The retention research's recommendation 6 (the one relatedness channel
 * the constraints allow): a parent and a child on the same device each
 * keep their own song pin and scaffold state. This module is the
 * addressing scheme, and the whole design is one decision:
 *
 * **Bookmark 0 IS the legacy keys, byte for byte.** `wb.journey.v1`,
 * `wb.learn.v1` and `wb.idle.v1` keep their exact names for the first
 * bookmark; only the second gets a suffix (`wb.journey.v1.b1`, …). So an
 * existing family's save is never migrated, moved, or rewritten; a stale
 * service-worker build that predates bookmarks reads and writes the same
 * bytes it always did; and the task-171 keepsake keeps meaning what it
 * meant. There is no migration because there is nothing to migrate — the
 * one way to lose a save here would have been to move it.
 *
 * The active bookmark is a pointer key. Absent means bookmark 0 —
 * enforced by REMOVING the pointer when 0 is chosen rather than writing
 * '0', so a pre-bookmark build (which never reads the pointer) and a
 * post-bookmark build agree about whose save the legacy keys hold.
 *
 * Not here on purpose: any per-bookmark name, avatar, or comparison of
 * anything gradable. The research's ethics rule is "pages, not
 * progress"; the UI piece decides how the second bookmark is offered.
 */

export const BOOKMARK_POINTER_KEY = 'wb.bookmark.v1';

export type BookmarkId = 0 | 1;

/** Matches the storage wrapper idiom in scaffoldStorage.ts. */
function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** Which bench cushion is occupied. Anything unreadable means the first. */
export function activeBookmark(): BookmarkId {
  const store = storage();
  if (!store) return 0;
  try {
    return store.getItem(BOOKMARK_POINTER_KEY) === '1' ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Choose a bookmark. Choosing 0 removes the pointer entirely (absent IS
 * bookmark 0), so a build that predates bookmarks can never disagree
 * with a current one about whose save the legacy keys hold.
 *
 * THE SWITCH CONTRACT, measured before it was written: every save path
 * keys through `bookmarkKey()` at write time, so a pointer moved under a
 * LIVE session makes that session's unload save land in the NEW
 * bookmark's keys — the one data-loss shape this design has. The UI that
 * offers the second bookmark must therefore switch the way the keepsake
 * import restores: force-save the old session first, then move the
 * pointer, then reload immediately — never leave a walking session
 * running across a pointer move.
 */
export function setActiveBookmark(id: BookmarkId): void {
  const store = storage();
  if (!store) return;
  try {
    if (id === 1) store.setItem(BOOKMARK_POINTER_KEY, '1');
    else store.removeItem(BOOKMARK_POINTER_KEY);
  } catch {
    // Quota or private browsing: the switch quietly fails and the game
    // continues on the bookmark it was on, which is the kind failure.
  }
}

/**
 * The storage key for a base name under a bookmark. Bookmark 0 is the
 * passthrough — the legacy name unchanged — which is the design's whole
 * safety argument; see the header.
 */
export function bookmarkKey(base: string, id: BookmarkId = activeBookmark()): string {
  return id === 1 ? `${base}.b1` : base;
}
