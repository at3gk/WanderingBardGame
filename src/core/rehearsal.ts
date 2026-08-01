/**
 * The campfire rehearsal's words (DESIGN.md, "The true goal": at each
 * campfire the player may attempt the carried song without the notes —
 * rehearsal for the festival, no-fail, journalled warmly).
 *
 * All the rehearsal's prose lives here so it can be tested against the
 * journal's vocabulary rules in one place. Three registers by how much of
 * the tune came from memory, and none of them is a verdict: the whole
 * mechanic is no-fail, the notes come back on a stumble, and every line
 * has to read true and kind at every skill level — including to the child
 * whose tune needed all its ink back, because that is how tunes are
 * learned and the line says so.
 */

export function rehearsalInvitation(songTitle: string): string {
  return `When you are ready, tap anywhere — the fire would hear ${songTitle}, from memory.`;
}

/** The journal's line for tonight's attempt. `hits` of `total` notes landed. */
export function rehearsalLine(songTitle: string, hits: number, total: number): string {
  const played = Math.max(0, Math.floor(Number.isFinite(hits) ? hits : 0));
  const asked = Math.max(1, Math.floor(Number.isFinite(total) ? total : 1));
  const share = Math.min(1, played / asked);

  if (share >= 0.8) {
    return `${songTitle}, whole, from memory. The fire crackled along.`;
  }
  if (share >= 0.4) {
    return `${songTitle} found its way home, the notes helping at the turns.`;
  }
  return `The fire heard the shape of ${songTitle}, and the notes came back to walk alongside. Tunes are learned exactly this way.`;
}
