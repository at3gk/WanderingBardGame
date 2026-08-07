/**
 * Encounters — the reason a day's walk is worth taking.
 *
 * Busking is the skill; encounters are the *surprise*. They are what makes
 * the shared daily road something two players can compare notes about ("did
 * you get the hares?"), and they are the only place in the game where the
 * payout is not a straight function of how well you played.
 *
 * Two rules shape everything below.
 *
 * First, rarity has to be felt, not read. A rare encounter that pays a flat
 * 3x a common one is just a common one with a bigger number on it: the
 * player learns the multiplier in an afternoon and the surprise is spent.
 * So each rarity gets its own *shape* of payout — commons are tight and
 * dependable, and the rarer tiers get progressively longer tails, so a rare
 * can occasionally pay like nothing you have seen. See `PAYOUTS`.
 *
 * Second, the candidate set must never be empty. This module is called from
 * world generation, which cannot handle a null and cannot stop to ask. Every
 * filter here is therefore a *preference* that gets relaxed in a fixed order
 * rather than a hard constraint, and the relaxation order is part of the
 * design, not an error path — see `candidatesFor`.
 *
 * Pure and deterministic: the caller passes a seed (derive it with
 * `subSeed(dailySeed(), 'encounter/' + siteIndex)`) and gets the same roll on
 * every device, forever. Nothing in here reads the clock.
 */

import { chance, mulberry32, pick, randInt, randRange, subSeed, weightedPick, type Rand } from './rng';

export type EncounterKind = 'traveller' | 'creature' | 'weather';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'wondrous';

export interface EncounterDef {
  id: string;
  kind: EncounterKind;
  rarity: Rarity;
  name: string;
  /** One line, shown as-is. Under ~120 characters so it fits two lines on a narrow phone. */
  line: string;
  /** Biome ids from `biome.ts`, or `ANY_BIOME` for something that happens everywhere. */
  biomes: string[];
  /** Optional [open, close] as a fraction of the day, 0 = setting out, 1 = campfire. */
  window?: [number, number];
}

export interface EncounterRoll {
  def: EncounterDef;
  coins: number;
  delight: number;
  /** A keepsake line, or null. Most encounters give nothing; that is what makes a gift worth having. */
  gift: string | null;
  /** 0..VARIANT_COUNT-1. A presentation hint (which side of the road, which pose) — stable for a seed. */
  variant: number;
}

/** Wildcard biome id. A rain shower does not need three biome ids listed on it, and would need a fourth the day a biome is added. */
export const ANY_BIOME = '*';

/** How many presentation variations the renderer is promised. Four is enough to stop a repeat looking like a copy-paste. */
export const VARIANT_COUNT = 4;

/**
 * Draw weights, applied *per definition* rather than per tier.
 *
 * That distinction is the whole story and it is easy to get wrong. These are
 * not the odds of drawing a tier — the odds of a tier are its weight times
 * how many of its entries survived the biome and window filters. The table
 * runs ten commons to four wondrous, and filtering usually trims the wondrous
 * side harder (three of the four are windowed), so the realised share of
 * wondrous is far below 2/145. Measured over the current table it is about
 * one encounter in a hundred and sixty, not one in twenty-five.
 *
 * That is a deliberate record of what the numbers *do*, because an earlier
 * version of this comment claimed one in twenty-five and nothing tested it.
 * If one in a hundred and sixty turns out to be too thin in playtest, the
 * lever is these weights, and `encounters.test.ts` pins the realised shares
 * so a retune has to be an intentional edit rather than a drift.
 */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 34,
  rare: 9,
  wondrous: 2,
};

// ---------------------------------------------------------------------------
// The writing
// ---------------------------------------------------------------------------
//
// These lines are the game's tone in the same way the songs are its subject.
// The rule while writing them was: no adjectives doing work a noun could do,
// no exclamation marks (the road is quiet), and every entry has to contain one
// specific observed thing rather than a category. "A merchant" is a category.
// "A tinker whose cart sings with hanging pans" is a thing you saw.
//
// Windows are set where the time of day is part of the observation — the
// lamplighter is meaningless at noon — and left off otherwise. Most entries
// have no window, which keeps the candidate set healthy at every hour.
//
// One known thin spot, recorded rather than papered over. Every kind has a
// wondrous entry, but the creature one (`hares-meeting`) is both windowed to
// the first third of the day and limited to village and forest. So a
// creature-only scene can reach wondrous in a village or a wood at dawn and
// nowhere else — a riverside creature scene has no top tier at any hour, at
// any luck. That is a content gap, not a filtering bug: the fix is a wondrous
// riverside creature, which is a writing job for whoever next opens this
// table. `encounters.test.ts` pins the current reachability so the gap stays
// visible instead of being rediscovered.

export const ENCOUNTERS: EncounterDef[] = [
  // --- Village ---
  {
    id: 'pan-cart-tinker',
    kind: 'traveller',
    rarity: 'common',
    name: 'The Pan-Cart Tinker',
    line: 'A tinker whose cart sings with hanging pans, and who slows down so that it sings in time.',
    biomes: ['village'],
  },
  {
    id: 'lamplighter',
    kind: 'traveller',
    rarity: 'common',
    name: 'The Lamplighter',
    line: 'She works down the lane a pole-length at a time and leaves the street warmer behind her.',
    biomes: ['village'],
    window: [0.55, 1],
  },
  {
    id: 'wall-cat',
    kind: 'creature',
    rarity: 'common',
    name: 'The Wall Cat',
    line: 'A cat on a garden wall, tail going, deciding whether you are worth getting up for.',
    biomes: ['village'],
  },
  {
    id: 'late-baker',
    kind: 'traveller',
    rarity: 'uncommon',
    name: 'The Late Baker',
    line: 'Flour to the elbows and closing up. He gives away whatever will not keep until morning.',
    biomes: ['village'],
    window: [0.5, 0.95],
  },
  {
    id: 'upstairs-window',
    kind: 'traveller',
    rarity: 'uncommon',
    name: 'Two Sent To Bed',
    line: 'Two children lean out of an upstairs window until a hand draws them gently back in.',
    biomes: ['village'],
    window: [0.65, 0.95],
  },
  {
    id: 'escort-dog',
    kind: 'creature',
    rarity: 'uncommon',
    name: 'The Escort',
    line: 'A grey-muzzled dog walks you to the end of his street and no further. That is the job.',
    biomes: ['village'],
  },

  // --- Forest ---
  {
    id: 'listening-fox',
    kind: 'creature',
    rarity: 'common',
    name: 'The Fox Who Was Not Listening',
    line: 'A fox sits down to listen, and pretends when you look that it was only resting there.',
    biomes: ['forest'],
  },
  {
    id: 'glow-beetles',
    kind: 'creature',
    rarity: 'common',
    name: 'Glow-Beetles',
    line: 'Beetles come up out of the bracken with their small green lights, about one to a bar.',
    biomes: ['forest'],
    window: [0.55, 1],
  },
  {
    id: 'charcoal-burner',
    kind: 'traveller',
    rarity: 'uncommon',
    name: 'The Charcoal Burner',
    line: 'He has not spoken aloud in four days and answers you in careful, rusty sentences.',
    biomes: ['forest'],
  },
  {
    id: 'still-deer',
    kind: 'creature',
    rarity: 'uncommon',
    name: 'The Deer That Stayed',
    line: 'A deer holds still through the whole verse, then leaves without hurrying, which is rarer.',
    biomes: ['forest'],
  },
  {
    id: 'canopy-rain',
    kind: 'weather',
    rarity: 'uncommon',
    name: 'Rain Above, Dry Below',
    line: 'The rain finds the canopy and not you. The whole wood keeps a steady brushed rhythm.',
    biomes: ['forest'],
  },
  {
    id: 'answering-owl',
    kind: 'creature',
    rarity: 'rare',
    name: 'The Answering Owl',
    line: 'An owl gives a phrase back a tone flat, and waits to see what you will do about it.',
    biomes: ['forest'],
    window: [0.65, 1],
  },
  {
    id: 'hedge-fiddler',
    kind: 'traveller',
    rarity: 'rare',
    name: 'The Hedge Fiddler',
    line: 'An old fiddler asleep under a hedge with his instrument tuned. He wakes for the second verse.',
    biomes: ['forest'],
  },
  {
    id: 'nightingale',
    kind: 'creature',
    rarity: 'rare',
    name: "The Nightingale's Argument",
    line: 'A nightingale takes your last phrase and returns it improved, which you may take how you like.',
    biomes: ['forest'],
    window: [0.7, 1],
  },

  // --- Riverside ---
  {
    id: 'ferryman-off-duty',
    kind: 'traveller',
    rarity: 'common',
    name: 'The Ferryman Off Duty',
    line: 'The ferry is moored for the night. He sits on the gunwale and keeps time on the hull.',
    biomes: ['riverside'],
    window: [0.5, 1],
  },
  {
    id: 'standing-heron',
    kind: 'creature',
    rarity: 'common',
    name: 'The Standing Heron',
    line: 'A heron in the shallows, so still that you find yourself playing quietly around it.',
    biomes: ['riverside'],
  },
  {
    id: 'late-washing',
    kind: 'traveller',
    rarity: 'uncommon',
    name: 'The Late Washing',
    line: 'Two women wringing linen at the edge, arguing about a tune you have not played yet.',
    biomes: ['riverside'],
  },
  {
    id: 'following-otter',
    kind: 'creature',
    rarity: 'uncommon',
    name: 'The Otter Who Follows',
    line: 'An otter keeps pace under the surface for a hundred yards, then remembers something else.',
    biomes: ['riverside'],
  },
  {
    id: 'barge-family',
    kind: 'traveller',
    rarity: 'rare',
    name: 'The Lit Barge',
    line: 'A barge slides past. Somebody aboard finds your key on a whistle and holds it a while.',
    biomes: ['riverside'],
    window: [0.55, 1],
  },
  {
    id: 'kingfisher',
    kind: 'creature',
    rarity: 'rare',
    name: "The Kingfisher's One Note",
    line: 'A kingfisher goes downstream like a thrown stone and leaves one blue note behind it.',
    biomes: ['riverside'],
  },

  // --- Anywhere on the road ---
  {
    id: 'sun-shower',
    kind: 'weather',
    rarity: 'common',
    name: 'Sun Shower',
    line: 'Rain falls through low sun for the length of a verse and stops as if it had come only to look.',
    biomes: [ANY_BIOME],
    window: [0.1, 0.65],
  },
  {
    id: 'seed-fluff',
    kind: 'weather',
    rarity: 'common',
    name: 'Drifting Seed-Fluff',
    line: 'Seed-fluff crosses the road in a slow tide and takes a great deal of time about it.',
    biomes: [ANY_BIOME],
    window: [0.15, 0.75],
  },
  {
    id: 'knee-mist',
    kind: 'weather',
    rarity: 'common',
    name: 'The Floating Road',
    line: 'Mist lies at knee height, so the road looks as though it is floating and taking you with it.',
    biomes: [ANY_BIOME],
  },
  {
    id: 'far-bells',
    kind: 'weather',
    rarity: 'uncommon',
    name: 'Bells, Far Off',
    line: 'Bells from a village you cannot see, three fields away, and not quite in your key.',
    biomes: [ANY_BIOME],
  },
  {
    id: 'first-star',
    kind: 'weather',
    rarity: 'uncommon',
    name: 'First Star',
    line: 'The first star arrives while you are tuning, and you take longer over the tuning than you need.',
    biomes: [ANY_BIOME],
    window: [0.6, 1],
  },
  {
    id: 'three-pilgrims',
    kind: 'traveller',
    rarity: 'uncommon',
    name: 'Three Pilgrims',
    line: 'Three pilgrims walking in step, too tired to talk, glad of somebody else making the noise.',
    biomes: [ANY_BIOME],
  },
  {
    id: 'still-hour',
    kind: 'weather',
    rarity: 'rare',
    name: 'The Still Hour',
    line: 'The wind stops altogether. For a few minutes the road holds whatever sound you put into it.',
    biomes: [ANY_BIOME],
  },
  {
    id: 'moon-ring',
    kind: 'weather',
    rarity: 'rare',
    name: 'Ring Around the Moon',
    line: 'A ring stands around the moon. Road wisdom says weather; tonight it only says look up.',
    biomes: [ANY_BIOME],
    window: [0.75, 1],
  },
  {
    id: 'night-post',
    kind: 'traveller',
    rarity: 'rare',
    name: 'The Night Post',
    line: 'A rider slows to a walk to hear the chorus out, then goes on faster to make the time back.',
    biomes: [ANY_BIOME],
    window: [0.6, 1],
  },
  {
    id: 'hares-meeting',
    kind: 'creature',
    rarity: 'wondrous',
    name: "The Hares' Meeting",
    line: 'Nine hares sit in a field in a rough circle. They do not scatter, and they do not explain.',
    biomes: ['village', 'forest'],
    window: [0, 0.3],
  },
  {
    id: 'green-light',
    kind: 'weather',
    rarity: 'wondrous',
    name: 'The Green Light',
    line: 'A green light stands in the north for a while, moving the way slow water moves.',
    biomes: [ANY_BIOME],
    window: [0.8, 1],
  },
  {
    id: 'unseasonal-snow',
    kind: 'weather',
    rarity: 'wondrous',
    name: 'Snow Out of Season',
    line: 'Snow falls for one verse in the wrong month, settles on nothing, and is gone by the last bar.',
    biomes: [ANY_BIOME],
  },
  {
    id: 'old-teacher',
    kind: 'traveller',
    rarity: 'wondrous',
    name: 'The Woman Who Taught Your Teacher',
    line: 'She listens with her eyes shut, corrects exactly one note, and will not stay to be thanked.',
    biomes: [ANY_BIOME],
  },
];

/**
 * Keepsakes, kept per kind so nothing incongruous can come out of a roll —
 * a pinecone from a rain shower would undo the line that earned it. They are
 * flavour only; nothing in the game consumes them, and that is deliberate,
 * because the moment a keepsake has a use the player starts farming for it.
 */
const GIFTS: Record<EncounterKind, readonly string[]> = {
  traveller: [
    'a heel of bread wrapped in cloth',
    'a bent coin from a country that no longer exists',
    'a spare string, oiled and coiled',
    'directions to a better inn than the one you were headed for',
    'a pear that has been kept warm in a coat pocket',
    'a name to ask for in the next town',
  ],
  creature: [
    'a feather laid on your bag, apparently on purpose',
    'a snail shell, empty and clean',
    'a tuft of grey fur caught on your sleeve',
    'a pinecone opened by a fire long ago',
    'a fish scale the size of a thumbnail',
  ],
  weather: [
    'a stone the rain washed clean',
    'seed-fluff still in your hatband come morning',
    'the smell of rain kept in your coat for a day',
    'a leaf pressed flat into your songbook by the weather',
    'frost-lace peeled off the songbook in one piece',
  ],
};

/** How often a tier leaves you something. Steep on purpose: a gift should read as the encounter's own decision. */
export const GIFT_CHANCE: Record<Rarity, number> = {
  common: 0.05,
  uncommon: 0.15,
  rare: 0.35,
  wondrous: 0.7,
};

/** Exported because `PAYOUTS` is exported: a consumer that wants to hold one of these needs to be able to name its type. */
export interface PayoutProfile {
  /** Never pays less than this before the kind tilt. A tier's floor is what stops a rare feeling like a waste. */
  floor: number;
  /** Width of the ordinary band above the floor. Drawn triangular, so the middle of the band is the usual result. */
  spread: number;
  /** Probability the encounter goes beyond its ordinary band at all. */
  tailChance: number;
  /** Scale of that overshoot when it happens. */
  tailScale: number;
}

/**
 * The payout curves, one per tier.
 *
 * The tiers differ in *shape*, not scale. A common is a tight little band
 * with a 5% flicker above it; a wondrous has a floor higher than a common's
 * best day and a tail that fires two times in three. So the tiers are told
 * apart by how they behave over a week of walking, not by their averages:
 *
 *   common     ~4      dependable, forgettable, and that is the point
 *   uncommon   ~10     noticeably better, still ordinary
 *   rare       ~22     usually good, sometimes absurd
 *   wondrous   ~50     never disappoints, occasionally makes the week
 *
 * Rejected: a single profile with a per-tier multiplier. It produces exactly
 * the same ordering of averages and none of the texture — every tier feels
 * like the same event at a different volume, and the tail (the only part a
 * player actually tells stories about) scales away to nothing at the bottom.
 *
 * The floors are set so the tiers do not overlap except through the tail:
 * each tier's floor is at or above the ceiling of the tier below's ordinary
 * band. An overlapping band would make a good common and a poor rare
 * indistinguishable, which is the same failure as the flat multiplier by
 * another route. `encounters.test.ts` pins it.
 *
 * Note carefully what that non-overlap is a property *of*: the internal
 * `value` below, which the player never sees. By the time it reaches the
 * screen it has been through `KIND_TILT` (coins swing 0.35x to 1.25x across
 * kinds, a 3.6x spread — wider than a whole tier step) and a +/-15% jitter,
 * and those do overlap the tiers back together. A common traveller's good day
 * pays more coins than a wondrous rain shower's, and that is fine and even
 * correct: coins are what travellers are for. The property that survives to
 * the player is the weaker and more honest one — within a single kind, and on
 * coins plus delight together, rarity orders the payout. Do not read the
 * non-overlap test as a promise about the coin number on screen.
 */
export const PAYOUTS: Record<Rarity, PayoutProfile> = {
  common: { floor: 2, spread: 4, tailChance: 0.05, tailScale: 3 },
  uncommon: { floor: 6, spread: 7, tailChance: 0.18, tailScale: 6 },
  rare: { floor: 13, spread: 10, tailChance: 0.4, tailScale: 14 },
  wondrous: { floor: 26, spread: 14, tailChance: 0.65, tailScale: 30 },
};

/**
 * What each kind is *for*. Travellers carry money and tip; weather cannot
 * tip at all but is the thing you remember. Splitting the two currencies
 * along the kind axis means the player has a reason to want a misty morning
 * even though it pays nearly nothing, and stops delight from being a second
 * name for coins.
 */
const KIND_TILT: Record<EncounterKind, { coins: number; delight: number }> = {
  traveller: { coins: 1.25, delight: 0.8 },
  creature: { coins: 0.7, delight: 1.15 },
  weather: { coins: 0.35, delight: 1.4 },
};

/**
 * How far past its band an encounter can go, in units of `tailScale`. The
 * cap exists because the tail draw is unbounded in principle: one roll in a
 * few million would otherwise return a five-figure coin payout and wreck the
 * economy for that save. Four is high enough that the cap is invisible
 * (about 1.8% of tail draws touch it) and low enough to bound the worst case.
 */
const TAIL_CAP = 4;

export interface RollOptions {
  /**
   * Ids already met today. These are not removed — removing them can empty
   * the set on a long walk — but weighted down hard, so a repeat is possible
   * and unlikely, which is also how the road actually behaves.
   */
  exclude?: readonly string[];
  /**
   * Multiplier on the rare and wondrous weights only. Luck should not make a
   * fox less likely to sit down; it should make the owl answer. Clamped to
   * [0, 8]; 0 is a legitimate request for an ordinary day, and NaN is read as
   * 1 rather than clamped — see `clampLuck`.
   */
  luck?: number;
  /** Restrict to one kind. The campfire scene asks for weather; a village square asks for travellers. */
  kind?: EncounterKind;
}

/** Whether `dayFraction` falls inside a definition's window. Windows given backwards are read as wrapping past the campfire. */
export function matchesWindow(def: EncounterDef, dayFraction: number): boolean {
  if (!def.window) return true;
  const t = clamp01(dayFraction);
  const [open, close] = def.window;
  if (open <= close) return t >= open && t <= close;
  return t >= open || t <= close;
}

/** Whether a definition can appear in a biome. */
export function matchesBiome(def: EncounterDef, biomeId: string): boolean {
  return def.biomes.includes(ANY_BIOME) || def.biomes.includes(biomeId);
}

/**
 * The candidate set, with constraints relaxed in a fixed order until
 * something survives.
 *
 * The order encodes which constraint the game would rather break. The window
 * goes first: a fox turning up an hour early is not a bug anyone can see.
 * Biome goes second: scenery mismatch is noticeable but survivable. The
 * caller's `kind` goes last, because a scene that asked for weather has
 * usually built itself around weather and would rather show the wrong
 * weather than a traveller. The final fallback is everything, which is only
 * reachable if a kind has no definitions at all.
 *
 * Returning a filtered array (rather than the shared `ENCOUNTERS`) at every
 * level keeps callers from mutating the table by accident.
 *
 * `from` exists so the relaxation ladder can be exercised against small
 * deliberate tables. With the real table the last two rungs are unreachable
 * — no biome-and-kind group is entirely windowed, and no kind is empty —
 * and an unreachable safety net that has never been tripped is not one.
 */
export function candidatesFor(
  biomeId: string,
  dayFraction: number,
  kind?: EncounterKind,
  from: EncounterDef[] = ENCOUNTERS
): EncounterDef[] {
  const ofKind = kind ? from.filter((d) => d.kind === kind) : from.slice();
  if (ofKind.length === 0) return from.slice();

  const inBiome = ofKind.filter((d) => matchesBiome(d, biomeId));
  if (inBiome.length === 0) return ofKind;

  const inWindow = inBiome.filter((d) => matchesWindow(d, dayFraction));
  return inWindow.length > 0 ? inWindow : inBiome;
}

/**
 * Roll one encounter.
 *
 * `seed` should be specific to the site being filled — the road's third
 * encounter stop, say — because the whole roll (which encounter, how it
 * went, what it left behind) is drawn from that one seed's stream. Two
 * stops that share a seed will produce the same encounter whenever their
 * candidate sets agree, which is a mistake that reads as a bug.
 */
export function rollEncounter(
  seed: number,
  biomeId: string,
  dayFraction: number,
  opts: RollOptions = {}
): EncounterRoll {
  const rand = mulberry32(subSeed(seed, 'encounter'));
  const candidates = candidatesFor(biomeId, dayFraction, opts.kind);

  const luck = clampLuck(opts.luck);
  const seen = opts.exclude && opts.exclude.length > 0 ? new Set(opts.exclude) : null;

  const def = weightedPick(rand, candidates, (d) => {
    let weight = RARITY_WEIGHT[d.rarity];
    if (d.rarity === 'rare' || d.rarity === 'wondrous') weight *= luck;
    if (seen && seen.has(d.id)) weight *= 0.08;
    return weight;
  });

  const variant = randInt(rand, 0, VARIANT_COUNT - 1);

  // One shared quality draw feeding both currencies, rather than two
  // independent rolls. Independent rolls let an encounter pay well and land
  // flat at the same time, which reads as noise; a shared "how it went"
  // keeps coins and delight telling the same story, and the per-currency
  // jitter below stops them being visibly the same number twice.
  const profile = PAYOUTS[def.rarity];
  const quality = triangular(rand);
  const shine = chance(rand, profile.tailChance) ? profile.tailScale * tailDraw(rand) : 0;
  const value = profile.floor + profile.spread * quality + shine;

  const tilt = KIND_TILT[def.kind];
  const coins = Math.max(0, Math.round(value * tilt.coins * randRange(rand, 0.85, 1.15)));
  const delight = Math.max(0, Math.round(value * tilt.delight * randRange(rand, 0.85, 1.15)));

  const gift = chance(rand, GIFT_CHANCE[def.rarity]) ? pick(rand, GIFTS[def.kind]) : null;

  return { def, coins, delight, gift, variant };
}

/**
 * The journal `kind` a lovely encounter is written under, so the campfire
 * page can press a mark beside it. Exported because two files have to agree
 * on the word and neither should own it alone.
 */
export const MEMENTO_KIND = 'memento';

/**
 * Whether this meeting is worth pressing into the page like a flower.
 *
 * Two things qualify, and they are both the module's own existing notions of
 * lovely rather than a new tier invented for the mark:
 *
 * - The top two rarities. `PAYOUTS` already says what those are for — a rare
 *   is "usually good, sometimes absurd" and a wondrous "never disappoints" —
 *   and the realised share of the table (see `RARITY_WEIGHT`) keeps them
 *   scarce enough that a mark stays a surprise.
 * - Anything that left a gift, at any rarity. `GIFTS` are already called
 *   keepsakes in this file, and `GIFT_CHANCE` is deliberately steep so that a
 *   gift "read as the encounter's own decision". A common that hands you a
 *   feather has made exactly the decision this mark records; refusing it on
 *   tier would be reading the table over the encounter's own head.
 *
 * What it is emphatically not: a count, a set, or a thing with slots. Nothing
 * anywhere totals these, and a mark missed today is only a road not walked —
 * the table reseeds daily, so every lovely thing comes round again.
 */
export function leavesMemento(roll: EncounterRoll): boolean {
  return roll.gift !== null || roll.def.rarity === 'rare' || roll.def.rarity === 'wondrous';
}

// ---------------------------------------------------------------------------
// The road, spoken (ROADMAP 152)
// ---------------------------------------------------------------------------
//
// Everyone walking today walks the same road — same seed, same name (see
// `roadName.ts`) — and the world has been quietly certain of that without
// anybody in it ever saying so. These asides let a traveller say it: other
// people are out on this road today, warmly, in passing.
//
// Three rules, and they are the whole design:
//
// - A minority. `ROAD_ASIDE_CHANCE` is deliberately about one meeting in
//   five, because a road that announces itself at every meeting stops being
//   a place and starts being a banner.
// - Travellers only. "They say everyone is out on Bramblegate Way" needs a
//   speaker; a fox has no news and a rain shower cannot gossip. Same reason
//   `rollAsk` refuses the other two kinds.
// - Presence, never comparison. No count of who else walked it, nothing
//   anyone else has already done, nothing to be behind on — the same rule
//   `roadName.ts` opens with.
//
// On its own sub-stream (`encounter/road`) for the reason spelled out under
// Asks: `rollEncounter`'s draw order is pinned by tests, and taking one more
// number from it would have reshuffled every meeting in the game.

/** How often a traveller mentions the road by name. A minority on purpose. */
export const ROAD_ASIDE_CHANCE = 0.22;

/**
 * The asides. `{road}` is the day's name. Written to the encounter table's
 * rules — no exclamation marks, no adjective doing a noun's work — and to
 * the journal's: nothing here is an instruction, a comparison, or a count.
 * Time-neutral, because a meeting can land at any hour of the walk.
 */
const ROAD_ASIDES: readonly string[] = [
  'Half the county is out on {road} today, they say.',
  'Everyone seems to be walking {road} today, and they seem glad of it.',
  'They came the other way down {road}, and pass on that it is a good day for it.',
  'There are others on {road} today, they mention, each at their own pace.',
  'They have been hearing music up and down {road} all day.',
];

/**
 * The line a meeting shows: the encounter's own writing, and sometimes the
 * road named aloud after it.
 *
 * `road` null, empty, or whitespace gives back `roll.def.line` untouched and
 * unwrapped — a caller that has no name for the road (or is a test pinning
 * the old prose) sees exactly what it saw before this function existed.
 */
export function encounterLine(seed: number, roll: EncounterRoll, road: string | null): string {
  if (roll.def.kind !== 'traveller') return roll.def.line;
  const name = road === null ? '' : road.trim();
  if (name === '') return roll.def.line;

  const rand = mulberry32(subSeed(seed, 'encounter/road'));
  if (!chance(rand, ROAD_ASIDE_CHANCE)) return roll.def.line;
  return `${roll.def.line} ${pick(rand, ROAD_ASIDES).replace('{road}', name)}`;
}

// ---------------------------------------------------------------------------
// Asks (v0.8 item 8 — stakes, not failure)
// ---------------------------------------------------------------------------
//
// Some travellers want something: the next stretch of the tune, played with
// care. This is the game's one missable side quest, and it is built exactly
// on DESIGN.md's contract — the *moment* can be failed, the player cannot.
// Play the asked notes well and the traveller pays for them; fumble them and
// the traveller smiles, wishes you well, and the moment passes. Missing pays
// nothing and costs nothing: no coins leave the purse, no warmth, no meter,
// no journal scolding. The passed line is written to be true and kind at
// once, because "you lost a chance" and "you were punished" are different
// sentences and this module only ever says the first.
//
// Only travellers ask. A fox does not commission music and a rain shower
// cannot, and keeping the ask on the one kind that carries money (see
// `KIND_TILT`) means the payoff reads as what it is: a person paying a
// musician for a request.
//
// Deterministic per seed, on its *own* sub-stream. `rollEncounter` draws a
// fixed sequence from `subSeed(seed, 'encounter')`, and the realised rarity
// shares of that stream are pinned by tests; the ask drawing from the same
// stream would have shifted every roll in the game. `subSeed(seed,
// 'encounter/ask')` is a different stream by construction, so adding an ask
// to a stop changes nothing about who you meet there.

/** How many of the walk's next notes the ask covers. About six seconds at walking tempo. */
export const ASK_NOTES = 8;
/** Hits (of any judgement) among those notes for the moment to land. Generous: two of eight can go astray. */
export const ASK_NEEDED = 6;
/** How often a traveller has an ask in them. */
export const ASK_CHANCE = 0.35;

export interface EncounterAsk {
  /** The window, in resolved notes of the tune that follows. */
  notes: number;
  /** Hits needed within the window. Always <= notes. */
  needed: number;
  /** The request, one diegetic line shown while the notes fly. */
  line: string;
  /** Paid only if the moment lands. */
  coins: number;
  delight: number;
  /** The journal line either way. Both are kind; only one pays. */
  fulfilledLine: string;
  passedLine: string;
}

/**
 * The writing, same rules as the encounter table: no exclamation marks, no
 * adjectives doing a noun's work. The passed lines get the extra rule from
 * DESIGN.md's pedagogy section — no-fail language everywhere. The moment
 * passes; nothing and nobody fails.
 */
const ASK_LINES: readonly string[] = [
  'They ask, before the road takes them, for the next few notes played true, just for them.',
  'One request, they say: the next stretch of the tune, played with care.',
  'They stop a moment longer and ask for the next few bars the way they are written.',
];

const FULFILLED_LINES: readonly string[] = [
  'You play it true. They stand a moment with their eyes shut, then press a few coins on you.',
  'It comes out whole. They pay for it the way you pay for bread, and go on humming it.',
];

const PASSED_LINES: readonly string[] = [
  'The tune wanders a little. They smile, wish you a good road, and walk on; the moment goes with them.',
  'It comes out a little sideways tonight. They wave anyway and take the rest of the road gently.',
];

/**
 * Whether this encounter carries an ask, and what it is. Null for most.
 *
 * The payout is drawn from the same tier profile as the encounter itself so
 * a rare traveller's request is worth more than a common one's, tilted
 * toward coins because a request honoured is a transaction, not a mood. It
 * is a *bonus* on top of the encounter's own roll — the roll was already
 * paid on meeting; the ask is the part that can be missed.
 */
export function rollAsk(seed: number, def: EncounterDef): EncounterAsk | null {
  if (def.kind !== 'traveller') return null;
  const rand = mulberry32(subSeed(seed, 'encounter/ask'));
  if (!chance(rand, ASK_CHANCE)) return null;

  const profile = PAYOUTS[def.rarity];
  const value = profile.floor + profile.spread * triangular(rand);
  return {
    notes: ASK_NOTES,
    needed: ASK_NEEDED,
    line: pick(rand, ASK_LINES),
    coins: Math.max(1, Math.round(value * 1.1)),
    delight: Math.max(1, Math.round(value * 0.7)),
    fulfilledLine: pick(rand, FULFILLED_LINES),
    passedLine: pick(rand, PASSED_LINES),
  };
}

export interface AskOutcome {
  fulfilled: boolean;
  /** Zero when the moment passed. Never negative: nothing is ever taken. */
  coins: number;
  delight: number;
  /** The journal line for what happened. */
  line: string;
}

/**
 * Settle an ask against how the asked notes went.
 *
 * Pure and total: `hits` is however many of the window's notes landed (any
 * judgement — a late note answered is a note played), and the only question
 * is whether it reached the ask's bar. A passed ask pays nothing and costs
 * nothing, and says so in the tone it happened in.
 */
export function resolveAsk(ask: EncounterAsk, hits: number): AskOutcome {
  const landed = Math.max(0, Math.floor(Number.isFinite(hits) ? hits : 0));
  const fulfilled = landed >= ask.needed;
  return {
    fulfilled,
    coins: fulfilled ? Math.max(0, ask.coins) : 0,
    delight: fulfilled ? Math.max(0, ask.delight) : 0,
    line: fulfilled ? ask.fulfilledLine : ask.passedLine,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Luck, clamped, with NaN sent back to 1 rather than through the clamp.
 *
 * `Math.max(0, Math.min(8, NaN))` is NaN, and a NaN luck is not a loud
 * failure — it is a silent, deterministic, catastrophic one. It poisons the
 * rare and wondrous weights, which makes `weightedPick`'s running total NaN,
 * which makes every `roll <= 0` comparison false, so the loop falls off the
 * end and returns the last item in the candidate list. Every roll comes back
 * as the same encounter, and because the last entry in this table happens to
 * be wondrous, every roll also pays like one. Measured before this guard: 400
 * rolls across three biomes returned `old-teacher` 400 times.
 *
 * NaN is not a contrived input either. Luck is the sort of thing that ends up
 * computed from a ratio (`charms / total`) or read back out of storage, and
 * both of those produce NaN on an empty or corrupt day. `dayFraction` already
 * defends against exactly this via `clamp01`; luck was the one that did not,
 * which is why it is a named function now instead of an inline clamp.
 *
 * 1 rather than 0 as the fallback: an unreadable luck value should give an
 * ordinary day, not silently switch the top two tiers off.
 *
 * Only NaN takes the fallback. The infinities are a coherent request — "as
 * lucky as you allow" and "no luck at all" — and the clamp already answers
 * both correctly, so they keep going through it.
 */
function clampLuck(luck: number | undefined): number {
  if (luck === undefined || Number.isNaN(luck)) return 1;
  return Math.max(0, Math.min(8, luck));
}

/**
 * Two draws averaged: a triangular distribution over [0, 1). Used for the
 * ordinary band because a flat uniform makes the bottom of a tier as common
 * as its middle, and the bottom of a tier is the one result nobody wants to
 * see often.
 */
function triangular(rand: Rand): number {
  const a = rand();
  const b = rand();
  return (a + b) / 2;
}

/**
 * An exponential draw, capped. Exponential rather than uniform because a
 * uniform tail has a maximum the player learns in a week; an exponential one
 * keeps producing results a little past whatever they have seen before,
 * which is the feeling this whole module exists to buy.
 *
 * `Math.log` is the one thing in this module that is not bit-identical across
 * engines: the spec only requires it to be implementation-approximated, so
 * two browsers may disagree in the last bit or so. That is survivable here,
 * and deliberately so, on two counts. It cannot change *which* encounter you
 * meet or its variant — both are drawn before this runs — and it cannot
 * change how many values are pulled from the stream, because the tail is
 * gated by a `chance()` that consumes one draw either way and this consumes
 * exactly one more when it fires. So the worst a disagreement can do is move
 * a coin count by one, on a roll that sits exactly on a rounding boundary.
 * Two players comparing notes still meet the same hares.
 */
function tailDraw(rand: Rand): number {
  return Math.min(TAIL_CAP, -Math.log(1 - rand()));
}

/**
 * What figure the stage should stand for an encounter, if any.
 *
 * For most of the game's life every encounter — creature and weather
 * included — stood a random HUMAN, so on a deer day the prose said deer
 * and the frame showed a walker playing understudy (wave 17's emotion
 * lens: "06 says a deer held still through the whole verse — there is no
 * deer in the frame"). The staging now follows the writing:
 *
 * - a traveller encounter stands a person, exactly as before;
 * - a creature encounter stands its OWN figure where one exists ('deer'
 *   so far), and deliberately nothing where one does not yet — an
 *   unstaged line is honest, a mis-staged one is a contradiction;
 * - weather stands nothing: the sky is not a figure.
 *
 * Pure, so the routing is pinned by test rather than by screenshot.
 */
export type MeetingFigure = 'person' | 'deer' | null;

export function meetingFigureFor(def: EncounterDef): MeetingFigure {
  if (def.kind === 'traveller') return 'person';
  if (def.kind === 'creature') return def.id === 'still-deer' ? 'deer' : null;
  return null;
}
