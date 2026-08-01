/**
 * Tonight's page — what the campfire reads back from the day.
 *
 * The journal has been written all day (`recordEntry`), and until this
 * module nothing ever read it back: the fire said one line about coins and
 * the day's story stayed in storage. This composes the page the campfire
 * opens — the day's last moments, and the festival named with the legs
 * that remain — as pure data for the HUD to set in type. No DOM here, and
 * no prose invented here either beyond the fixed frame lines: the moments
 * themselves were already written by whoever lived them.
 *
 * The festival line is the pilgrimage's public face (DESIGN.md, "The true
 * goal": the first campfire is where the festival is named), so its
 * vocabulary is bound by the same kindness rules as the journal: distance,
 * never deadline; anticipation, never debt. There is deliberately no
 * calendar in it — legs are walked days, and a family that stays away a
 * month comes back the same number of campfires from the gate.
 */

import { FESTIVAL_LEGS, legsToFestival, type JourneyState } from './journey';
import { rehearsalInvitation } from './rehearsal';

export interface CampfirePageLine {
  text: string;
  /** The sky the moment happened under, so the page can tint it. */
  dayFraction: number;
  kind: string;
}

export interface CampfirePage {
  title: string;
  /** The day's last few moments, oldest first. */
  moments: CampfirePageLine[];
  /** The festival, named. Always present — the destination is standing. */
  festival: string;
  /**
   * The fire's asking — the rehearsal invitation, when a song is carried
   * and this leg's attempt has not been played. Absent otherwise. This is
   * the "rehearsal is introduced" beat of the first-campfire promise: it
   * is introduced by being offered, on the page, in the fire's own voice.
   */
  invitation?: string;
}

/**
 * How many moments fit on the page. The end of the day reads best (the
 * journal cap already keeps the newest for the same reason), and a child
 * being read to at a real fire gets a handful of moments, not an
 * inventory.
 */
export const PAGE_MOMENTS_MAX = 6;

/** The quiet-day line. A day with no moments still deserves a page. */
const QUIET_LINE = 'A quiet road, walked the whole way.';

/**
 * Small numbers in a storybook voice. Digits past the festival's own span,
 * which the page never reaches — but a defensive caller should still get
 * something readable.
 */
const SMALL_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
] as const;

function words(n: number): string {
  return n >= 0 && n < SMALL_WORDS.length ? SMALL_WORDS[n] : String(n);
}

/**
 * The festival, named for tonight.
 *
 * Three registers, one per stage of the pilgrimage:
 * - The first fire a bard ever sits at is the naming — the fuller
 *   sentence, because DESIGN's first-campfire promise is that the
 *   destination is *revealed* here, not recited.
 * - Every later fire keeps the count warm in one line. Distance, not
 *   time: "campfires on", never "days left".
 * - At the gate the line goes anticipatory and stays general — the
 *   arrival itself belongs to the festival scene (ROADMAP task 163), and
 *   this line must read true whether that scene ships tomorrow or later.
 */
export function festivalLine(state: JourneyState): string {
  const remaining = legsToFestival(state);
  if (remaining === 0) {
    return 'The road hums with festival talk tonight. The gate cannot be far now.';
  }
  if (state.campfires <= 1) {
    return (
      'And the fire has news: down this road, ' +
      `${words(remaining)} more campfires on, waits the Festival of the Long Road.`
    );
  }
  if (remaining === 1) {
    return 'The Festival of the Long Road is one campfire on.';
  }
  return `The Festival of the Long Road: ${words(remaining)} campfires on.`;
}

/**
 * Compose tonight's page from the journey as it sits at the fire.
 *
 * `carriedTitle` is the pinned song's display title, resolved by the
 * caller (this module stays loadable without the songbook, the same
 * boundary journey.ts keeps): given while an attempt is still open, it
 * becomes the fire's asking.
 */
export function campfirePage(state: JourneyState, carriedTitle: string | null = null): CampfirePage {
  const journal = Array.isArray(state.journal) ? state.journal : [];
  const kept = journal.slice(Math.max(0, journal.length - PAGE_MOMENTS_MAX));
  const moments: CampfirePageLine[] =
    kept.length > 0
      ? kept.map((entry) => ({
          text: entry.line,
          dayFraction: entry.dayFraction,
          kind: entry.kind,
        }))
      : [{ text: QUIET_LINE, dayFraction: state.dayFraction, kind: 'note' }];

  const page: CampfirePage = {
    title: "Tonight's page",
    moments,
    festival: festivalLine(state),
  };
  if (carriedTitle && !state.rehearsed) {
    page.invitation = rehearsalInvitation(carriedTitle);
  }
  return page;
}

/**
 * Re-exported so the one place that words the pilgrimage and the one
 * place that measures it cannot drift apart silently in a caller's eyes.
 */
export { FESTIVAL_LEGS };
