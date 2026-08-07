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

import { IDLE_JOURNAL_KIND } from './idle';
import { FESTIVAL_LEGS, legsToFestival, type JourneyState, type PeekedJournal } from './journey';
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
  /**
   * The moonlit road's door (DESIGN.md, "The true goal": hybrid pacing) —
   * walking on past the campfire opens another leg tonight. Always offered
   * at an ordinary fire; the caller removes it on the festival eve, where
   * the page's one asking is the performance. The wording carries the whole
   * mechanic — more road tonight, under the moon — and nothing beyond the
   * walk itself is promised, because nothing beyond the walk is given.
   */
  walkOn?: string;
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
 * The welcome — tonight's page opening on a day that began with a coming
 * back (retention-design.md, recommendation 5: absence becomes story, not
 * debt).
 *
 * The title card already says "The road kept your place." at boot; this is
 * its campfire sibling, said hours later by the fire rather than the road,
 * so it deliberately shares none of that sentence's words. What it says is
 * that the playing carried on without anybody watching and that the company
 * is welcome — which is true, and is the entire emotional content the
 * feature is allowed to have.
 *
 * What it must never do is measure. There is no number here and no input
 * that could become one: the composer knows only *that* the day held a
 * coming-back, never how long the away was. No "you were gone", no
 * "finally", no counting of days kept or missed — the absence cost nothing,
 * so the line owes nothing back.
 */
export const WELCOME_LINE =
  'The fire is glad of the company — there was noodling at the roadside all the while, and the tunes kept warm.';

/** The mark a welcome moment carries, so a caller can tell it from a lived one. */
export const WELCOME_KIND = 'welcome';

/**
 * The walk-on door's line. "Tap here" because the page's other rows fold it
 * away when tapped — this is the one row that does something else, and a
 * child should not have to discover that. "A little further" keeps the
 * offer's size honest: another leg, not another day.
 */
export const WALK_ON_LINE =
  'Or tap here to walk on — the road goes a little further beneath the moon.';

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
 *
 * `roadNameText` is the day's road, named (`roadName.ts`), and when it is
 * given the page is headed with it — the page a bard closes is the page of
 * a *place*, and that place is the one everyone else walked today. Passed
 * in rather than derived here for the same boundary reason: this module
 * knows the journey, not which seed built it.
 */
export function campfirePage(
  state: JourneyState,
  carriedTitle: string | null = null,
  roadNameText: string | null = null,
): CampfirePage {
  const journal = Array.isArray(state.journal) ? state.journal : [];

  // Searched across the whole journal rather than the page window: the
  // coming-back is written at dawn, and a day with any life in it will have
  // pushed that line off the end long before the fire. Only its existence
  // is read — the entry's own numbers are never consulted, which is what
  // makes it impossible for a day count to leak into the welcome.
  const returned = journal.find((entry) => entry && entry.kind === IDLE_JOURNAL_KIND);

  // The welcome takes a moment's room rather than adding one, so the page
  // stays the handful of lines a child gets read at a real fire.
  const room = returned ? PAGE_MOMENTS_MAX - 1 : PAGE_MOMENTS_MAX;
  const kept = journal.slice(Math.max(0, journal.length - room));
  const lived: CampfirePageLine[] =
    kept.length > 0
      ? kept.map((entry) => ({
          text: entry.line,
          dayFraction: entry.dayFraction,
          kind: entry.kind,
        }))
      : [{ text: QUIET_LINE, dayFraction: state.dayFraction, kind: 'note' }];

  // Under the sky the return happened under, which is the dawn one — the
  // fire says hello about the morning, then reads the day it opened.
  const moments: CampfirePageLine[] = returned
    ? [{ text: WELCOME_LINE, dayFraction: returned.dayFraction, kind: WELCOME_KIND }, ...lived]
    : lived;

  const page: CampfirePage = {
    title: roadNameText ? `${roadNameText} — tonight's page` : "Tonight's page",
    moments,
    festival: festivalLine(state),
    walkOn: WALK_ON_LINE,
  };
  if (carriedTitle && !state.rehearsed) {
    page.invitation = rehearsalInvitation(carriedTitle);
  }
  return page;
}


/**
 * The other bookmark's page (task 157 piece 3) — what one bench cushion
 * may read of the other. Composed from a `peekJournal` result, so by
 * construction it can only ever hold the day's name and the prose lines:
 * no festival distance (that is THEIR progress), no invitation, no
 * walk-on door (their road is not yours to walk), no welcome logic. A
 * bookmark with no moments yet still gets the quiet line — an empty page
 * would read as a verdict on a day that simply had no audience.
 */
export function otherBookmarkPage(
  peeked: PeekedJournal,
  roadNameText: string | null = null,
): CampfirePage {
  const kept = peeked.entries.slice(Math.max(0, peeked.entries.length - PAGE_MOMENTS_MAX));
  const moments: CampfirePageLine[] =
    kept.length > 0
      ? kept.map((entry) => ({
          text: entry.line,
          dayFraction: entry.dayFraction,
          kind: entry.kind,
        }))
      : [{ text: QUIET_LINE, dayFraction: 0.5, kind: 'note' }];
  return {
    title: roadNameText
      ? `${roadNameText} — the other bookmark's page`
      : "The other bookmark's page",
    moments,
    festival: '',
  };
}

/**
 * Re-exported so the one place that words the pilgrimage and the one
 * place that measures it cannot drift apart silently in a caller's eyes.
 */
export { FESTIVAL_LEGS };
