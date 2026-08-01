/**
 * Deterministic randomness.
 *
 * The road is *shared*: every player walking on a given day walks the same
 * road, sees the same travellers at the same bends, meets the same weather.
 * That only works if road generation is a pure function of a seed both
 * clients agree on without ever talking to a server — so the seed is the
 * UTC calendar day, and everything downstream of it is this file's PRNG.
 *
 * `Math.random()` is unusable here for the obvious reason, and so is any
 * hash that depends on engine internals. mulberry32 is 32-bit integer
 * arithmetic only: same seed, same sequence, every browser, forever.
 */

/** A pure 0..1 generator. Calling it advances its own internal state. */
export type Rand = () => number;

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * Chosen over an LCG (visible lattice structure when you use consecutive
 * draws as 2D coordinates, which road placement does constantly) and over
 * xorshift128 (needs four words of state to seed correctly).
 */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a, 32-bit. Used to fold a label into a seed so that independent
 * systems drawing from the same day get *different* streams: the foliage
 * scatter must not correlate with which traveller you meet, or the world
 * starts rhyming with itself in ways players notice.
 */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fold a sub-stream label into a base seed. */
export function subSeed(seed: number, label: string): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ hashString(label)) >>> 0;
}

/**
 * The day's shared key, `YYYY-MM-DD` in **UTC**.
 *
 * UTC rather than local time on purpose: two players in different
 * timezones should be walking the same road when they compare notes, and
 * a local-midnight rollover would also let a player re-roll the day's
 * encounters by changing their system clock's zone.
 */
export function dayKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The seed every client derives the day's road from. */
export function dailySeed(now: Date = new Date()): number {
  return hashString(`wandering-bard/${dayKey(now)}`);
}

/**
 * The seed for one leg of a calendar day's walking (DESIGN.md, "The true
 * goal": hybrid pacing). Leg 0 is the shared daily road — byte-identical to
 * `dailySeed` for that day, which is what keeps the first walk of everyone's
 * day communal. Legs past it are the moonlit roads an eager player opens by
 * walking on from the campfire: still deterministic (the same day and leg
 * always build the same road, so a save can resume one), just not the road
 * anyone else is on. The identity with `dailySeed` at leg 0 is pinned by
 * test — a drift there would quietly fork the shared road.
 */
export function legSeed(dayKey: string, leg: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(leg) ? leg : 0));
  if (n === 0) return hashString(`wandering-bard/${dayKey}`);
  return hashString(`wandering-bard/${dayKey}/leg/${n}`);
}

/**
 * The dayKey-shaped label a leg's road stamps into its stop ids. Stop ids
 * are derived from the key `generateRoad` is given (`road.ts` documents why
 * a caller that overrides the seed must override the key with it) — so a
 * second leg on the same day must carry a distinct key, or its stops would
 * collide with the morning's in the visited list. `~` rather than `/`
 * because `/` is the id's own field separator.
 */
export function legRoadKey(dayKey: string, leg: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(leg) ? leg : 0));
  return n === 0 ? dayKey : `${dayKey}~${n}`;
}

/** Integer in [min, max] inclusive. */
export function randInt(rand: Rand, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Float in [min, max). */
export function randRange(rand: Rand, min: number, max: number): number {
  return min + rand() * (max - min);
}

/** Uniform pick. Throws on an empty list rather than returning undefined. */
export function pick<T>(rand: Rand, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from an empty list');
  return items[Math.floor(rand() * items.length) % items.length];
}

/**
 * Weighted pick. Weights need not sum to anything in particular; zero and
 * negative weights are treated as "never".
 */
export function weightedPick<T>(rand: Rand, items: readonly T[], weightOf: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (total <= 0) return pick(rand, items);
  let roll = rand() * total;
  for (const item of items) {
    roll -= Math.max(0, weightOf(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** Bernoulli trial. */
export function chance(rand: Rand, probability: number): boolean {
  return rand() < probability;
}

/**
 * Fisher-Yates, returning a new array. Used where "one of each, in an
 * unpredictable order" beats independent draws — an encounter list that
 * can repeat the same traveller twice in a row reads as a bug.
 */
export function shuffled<T>(rand: Rand, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Smooth 1D value noise in [-1, 1], seeded and repeatable.
 *
 * The road's curve and elevation are this, not a random walk: a random
 * walk drifts without bound and produces switchbacks no cosy road would
 * have. Interpolated noise gives gentle, readable, *re-derivable* bends —
 * any client can ask "what is the road doing at 4200 m" without having
 * simulated the 4199 m before it, which is what lets the world stream.
 */
export function valueNoise1D(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hashedUnit(seed, i);
  const b = hashedUnit(seed, i + 1);
  // Smoothstep the interpolant so the derivative is continuous at the
  // integer lattice points; plain lerp leaves visible creases in a road.
  const t = f * f * (3 - 2 * f);
  return (a + (b - a) * t) * 2 - 1;
}

/** Fractal (summed-octave) version of the above, still in about [-1, 1]. */
export function fbm1D(seed: number, x: number, octaves = 3, lacunarity = 2, gain = 0.5): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let frequency = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1D(seed + o * 1013, x * frequency) * amplitude;
    total += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total > 0 ? sum / total : 0;
}

function hashedUnit(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i, 0x27d4eb2d)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
