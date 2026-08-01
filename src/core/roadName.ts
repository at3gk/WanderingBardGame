/**
 * The road's name.
 *
 * Every bard walking today walks the same road (see `rng.ts`), and until
 * this module that sharedness was true but silent — the world was identical
 * and nothing in it ever said so. A name says it: "Larchwind Road, this
 * morning" is a fact two strangers can both hold, which is the whole of
 * what this game wants sharing to be. Presence, never performance — no
 * count of who else walked it, no comparison, nothing to be behind on.
 *
 * Pure and seeded, like everything downstream of the day: no clock, no
 * `Math.random`, no storage. Because the name is a function of a *seed*
 * rather than of the calendar, the moonlit legs an eager player opens past
 * the campfire (`legSeed(day, 1)` and on) name themselves too, and name
 * themselves differently from the morning's road — a second road really is
 * a second place, and says so.
 */

import { mulberry32, pick, subSeed } from './rng';

/**
 * The first element: what the road is *of* — a tree, a weather, a bird, a
 * trade, a tune. Curated by hand rather than assembled from parts, because
 * a generator that welds syllables together eventually welds an ugly or a
 * mournful one, and this list has to be safe on a day nobody is watching.
 */
const ELEMENTS = [
  'Larchwind',
  'Reedwater',
  'Hazelmere',
  'Alderbank',
  'Willowbend',
  'Rowanhill',
  'Bramblegate',
  'Clover',
  'Foxglove',
  'Elderflower',
  'Thistledown',
  'Honeyfield',
  'Barleymow',
  'Meadowlight',
  'Amberleaf',
  'Sunmeadow',
  'Mistbell',
  'Rainbell',
  'Snowdrop',
  'Frostfern',
  'Lantern',
  'Drovers',
  'Pipers',
  'Fiddlehead',
  'Chorushill',
  'Cricketsong',
  'Swallowtail',
  'Quietbrook',
] as const;

/**
 * The way-word. All of these are things a road can honestly be; none of
 * them is a verdict, an ending, or a warning. (No Gallows, no Last, no
 * Lost — the journal's vocabulary rules apply to the map as well.)
 */
const WAYS = ['Road', 'Lane', 'Way', 'Rise', 'Crossing', 'Mile', 'Path', 'Bend'] as const;

/**
 * The name of the road grown from `seed`.
 *
 * Its own sub-stream, so naming the road cannot shift the weather or the
 * travellers by a single draw — the same reason every other system on the
 * day's seed takes a labelled fold of it.
 */
export function roadName(seed: number): string {
  const rand = mulberry32(subSeed(seed, 'road/name'));
  return `${pick(rand, ELEMENTS)} ${pick(rand, WAYS)}`;
}
