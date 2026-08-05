/**
 * The campfire postcard's words.
 *
 * A postcard is the one thing this game hands to somebody who is not
 * playing it, and that makes it the one place where the whole design could
 * quietly invert. Every shareable artefact a game has ever made ends up
 * being read as a claim about the player — and the moment a shared card
 * carries a number somebody else can be measured against, the walk stops
 * being a walk and becomes a run. `docs/research/retention-design.md`
 * rejects leaderboards on principle for exactly that reason, and a card
 * with a score on it is a leaderboard with one row.
 *
 * So the card says where you were and what you were carrying, and nothing
 * else. Wordle's real trick was never the grid: it was that the shared
 * square told you somebody had *been there today*, and gave you no way to
 * be better at it than they were. That is the whole brief here. Presence,
 * never performance.
 *
 * The vocabulary ban in `postcardCard.test.ts` is the enforcement — a test
 * rather than a convention, because prose drifts across dozens of runs and
 * "just a small accuracy line" is precisely the edit that would look
 * harmless in isolation. Numbers stay out too: campfires are counted in
 * storybook words, the way `campfirePage.ts` counts legs to the festival,
 * so there is no digit on the card for anyone to read as a total.
 */

/** What the pressed postcard is called when the player saves it. */
export const POSTCARD_FILENAME = 'wandering-bard-postcard.png';

/** The road, when a caller has no name for it. A card is never untitled. */
const UNNAMED_ROAD = 'A road, walked today';

/**
 * Small numbers in a storybook voice, matching `campfirePage.ts`'s list so
 * the two places that count campfires out loud sound like one voice.
 */
const SMALL_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
] as const;

export interface PostcardCard {
  /** The road's name, as the card's heading. */
  title: string;
  /** The card's two lines, in the order they are set beneath the picture. */
  lines: string[];
}

/**
 * The postcard's words for today's road.
 *
 * `songTitle` is the pinned song's display title, or null while wandering —
 * and wandering gets a line of its own rather than an omission, because a
 * card with a blank where a tune should be reads like a card with something
 * missing from it, and nothing is missing.
 *
 * Counts past the word list fall through to a phrase instead of a numeral.
 * A bard who has sat at more fires than the list holds has walked a long
 * way, and "more than a page can hold" is both truer to that and safer than
 * printing a figure somebody could compare against their own.
 */
export function postcardLines(
  roadName: string,
  songTitle: string | null,
  campfires: number,
): PostcardCard {
  const title = roadName.trim() || UNNAMED_ROAD;
  const song = songTitle?.trim();

  const songLine = song
    ? `Carrying ${song} down it.`
    : 'Carrying no tune in particular — whatever the road hummed.';

  return { title, lines: [songLine, closingLine(campfires)] };
}

/**
 * The closer: how many fires this road has behind it, and the road still
 * going. The second half matters as much as the first — a count that ends
 * a sentence reads like a total, and a count followed by "and the road
 * going on" reads like a place in the middle of something.
 */
function closingLine(campfires: number): string {
  const n = Number.isFinite(campfires) ? Math.max(0, Math.floor(campfires)) : 0;

  if (n === 0) {
    return 'No campfire behind it yet — the evening is still ahead.';
  }
  if (n === 1) {
    return 'One campfire behind it, and the road going on.';
  }
  if (n < SMALL_WORDS.length) {
    return `${SMALL_WORDS[n]} campfires behind it, and the road going on.`;
  }
  return 'More campfires behind it than a page can hold, and the road going on.';
}
