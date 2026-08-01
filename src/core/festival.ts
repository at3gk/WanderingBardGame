/**
 * The Festival of the Long Road — the arithmetic and the words of arriving
 * (DESIGN.md, "The true goal": the destination the whole pilgrimage walks
 * toward, where the bard performs the songs the player actually carried).
 *
 * The set list is the honest heart of it. DESIGN says the festival is
 * performed "from the by-heart book", and the kind reading — the only one
 * consistent with no-fail — is that the festival hears what was CARRIED,
 * as it stands: a song at the clean-staff tier is performed from memory,
 * one still wearing its ink is performed with its ink, and a player who
 * wandered the whole way is still met at the gate with the tune they
 * arrived humming. Nobody walks thirteen campfires to be told their book
 * is too thin.
 */

import { festivalReached, type JourneyState } from './journey';

/** The most songs one festival evening asks for. An occasion, not a recital. */
export const FESTIVAL_SET_MAX = 3;

/**
 * Whether tonight's fire is the festival's own: the pilgrimage has covered
 * its distance and no festival has been performed yet. (After the first
 * festival the arc belongs to the post-festival choice — ROADMAP 163's
 * later pieces — and ordinary fires resume.)
 */
export function isFestivalEve(state: JourneyState): boolean {
  return festivalReached(state) && state.festivals === 0;
}

/**
 * The set list: the songs genuinely carried (walk counts from
 * `scaffoldStorage.allSongWalks`), most-carried first, capped. The pinned
 * song leads if it was carried at all — the festival opens with tonight's
 * tune. `fallback` is the id the caller would play anyway (the rotation's
 * song) so an all-wandering player still performs one.
 */
export function festivalSetList(
  walks: Readonly<Record<string, number>>,
  pinned: string | null,
  fallback: string,
): string[] {
  const carried = Object.entries(walks)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  if (pinned && carried.includes(pinned)) {
    carried.splice(carried.indexOf(pinned), 1);
    carried.unshift(pinned);
  }
  const set = carried.slice(0, FESTIVAL_SET_MAX);
  return set.length > 0 ? set : [fallback];
}

/** The page's title, festival line and asking, the night the long way ends. */
export function festivalArrival(setSize: number): {
  title: string;
  festival: string;
  invitation: string;
} {
  const songs = setSize === 1 ? 'the song you carried' : 'the songs you carried';
  return {
    title: 'The Festival of the Long Road',
    festival:
      'The long way ends at lantern light: stalls and banners, and a stage that has waited thirteen campfires for you.',
    invitation: `When you are ready, tap anywhere — the festival would hear ${songs}.`,
  };
}

/** The closing line, written to the journal when the set has been played. */
export function festivalClosingLine(songsPlayed: number): string {
  const count = Math.max(1, Math.floor(Number.isFinite(songsPlayed) ? songsPlayed : 1));
  const songs = count === 1 ? 'one song, carried the whole way' : `${count} songs, carried the whole way`;
  return `The Festival of the Long Road heard ${songs}. The lanterns burned late, and the road is yours now, in any direction.`;
}
