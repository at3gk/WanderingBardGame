/**
 * What the bard can play.
 *
 * Six instruments, described as *numbers an additive synthesiser can be
 * built from* rather than as sample names. That choice is the whole reason
 * this file exists: samples would blow the bundle budget and would have to
 * be sourced CC0 for six distinct timbres across every pitch the songbook
 * uses, whereas a partial stack plus an envelope is about two hundred bytes
 * and plays any note. The cost is that the numbers have to actually be
 * right — a flute built from a lute's partials sounds like a lute, and the
 * player will notice before they can say why.
 *
 * So the voices below are modelled on how the real instruments behave, not
 * tuned by ear against nothing:
 *
 *   - Plucked strings (lute, harp) have every harmonic present with a
 *     roughly 1/n rolloff, no sustain at all, and their whole character in
 *     the decay time and the amount of pick noise.
 *   - Blown pipes (reed flute) are close to a sine with a slow attack; what
 *     makes them recognisable is breath — the chiff at the start and a hand
 *     vibrato that no plucked string has.
 *   - A struck membrane (hand drum) has *inharmonic* modes at 1, 1.59, 2.14,
 *     2.92 (the Bessel ratios of a circular drumhead), which is why a drum
 *     has no clear pitch even though it rings.
 *   - A bell is also inharmonic but in a famous, musical way: a hum an
 *     octave below, a minor third above the prime, and a strong nominal at
 *     the octave. That minor third is why bells sound faintly sad.
 *   - The hurdy-gurdy is a bowed drone: near-saw spectrum, several strings
 *     never quite in tune with each other, and a wheel that buzzes.
 *
 * Envelope convention, stated once because the audio layer synthesises
 * straight from these fields: amplitude rises over `attackMs`, falls over
 * `decayMs` toward `sustain` (a fraction of peak), holds there while the
 * note is held, then falls over `releaseMs` when the note is released. For
 * the struck and plucked voices `sustain` is 0, so `decayMs` *is* the ring
 * and `releaseMs` is how quickly the note can be damped on purpose — a palm
 * on the drum skin, a hand on the harp strings. That is why the drum's
 * release is tiny and the bells' is enormous: you can stop a drum, and you
 * cannot really stop a bell.
 *
 * No randomness in this file, and none wanted: which instruments exist is
 * authored content, not generated. Everything here is static data plus pure
 * predicates over the player's progress.
 */

export type InstrumentId = string;

/** Timbre, as parameters for additive synthesis plus one noise transient. */
export interface InstrumentVoice {
  /**
   * `[frequency ratio, amplitude]` pairs relative to the played pitch.
   * Ratios are strictly ascending and need not be integers — the drum and
   * the bells are inharmonic on purpose. Amplitudes are relative, with the
   * loudest partial normalised to 1.0 so an implementation can scale the
   * whole stack by one gain and get comparable loudness across voices.
   */
  partials: Array<[number, number]>;
  attackMs: number;
  decayMs: number;
  /** Level held after decay, as a fraction of peak. 0 for struck/plucked. */
  sustain: number;
  releaseMs: number;
  /**
   * Spread, in cents, between doubled voices of the same partial stack.
   * Not tuning error: paired lute courses, several hurdy-gurdy strings and
   * the beating partials of a bell all produce slow amplitude beating, and
   * a single-oscillator version of any of them sounds sterile.
   */
  detuneCents: number;
  /** Lowpass corner for the whole voice. The fastest way to say "dark". */
  cutoffHz: number;
  /**
   * How much of the note's start is unpitched noise, 0..1 — pick click,
   * breath chiff, skin slap. Carries more identity than the partials do in
   * the first 30 ms, which is exactly the span a listener identifies an
   * instrument in.
   */
  transient: number;
  /** `[rate Hz, depth cents]`. Depth 0 means none; rate is then unused. */
  vibrato: [number, number];
}

export type UnlockRule =
  | { type: 'start' }
  | { type: 'distance'; metres: number }
  | { type: 'coins'; coins: number }
  | { type: 'encounters'; count: number }
  | { type: 'campfires'; count: number };

export interface Instrument {
  id: InstrumentId;
  name: string;
  /** One line for the unlock card. What it feels like to play, not specs. */
  character: string;
  voice: InstrumentVoice;
  /** Body colour for the bard's instrument and its note glyphs, 0xRRGGBB. */
  color: number;
  /** Lighter partner colour for highlights and particle sparks. */
  accent: number;
  noteMotion: 'drift' | 'spiral' | 'pulse' | 'cascade';
  unlock: UnlockRule;
  /**
   * Multiplier on a song's written tempo when played on this instrument.
   * A bell that rings for four seconds turns a brisk tune into porridge, and
   * a hand drum wants to be pushed; the songbook stays the songbook and the
   * instrument bends the clock around it. The lute is 1.0 by definition —
   * it is the instrument every tune was authored against.
   */
  tempoFeel: number;
}

/**
 * The palette is one family, not six hues picked apart: warm woods for the
 * things made of wood, and muted jewel tones for the rest, all at similar
 * lightness so no instrument's notes shout over another's against the
 * painterly world. Each `accent` is the same hue as its `color`, lifted and
 * desaturated — a highlight, not a second colour. Cream stays reserved for
 * notation (DESIGN.md), so nothing here goes near it.
 */
const LUTE: Instrument = {
  id: 'lute',
  name: "Wayfarer's Lute",
  character: 'Bright and quick to fade, so you keep having to feed it.',
  voice: {
    // Odd partials sit slightly proud of the even ones: a lute is plucked
    // near a third of the string length, which notches the multiples of
    // three and leaves the odd stack ringing. This is the sound of a
    // plectrum on gut, and it is deliberately not the harp's smooth 1/n.
    partials: [
      [1, 1.0],
      [2, 0.5],
      [3, 0.42],
      [4, 0.18],
      [5, 0.16],
      [6, 0.08],
      [7, 0.07],
      [9, 0.04],
    ],
    attackMs: 4,
    decayMs: 850,
    sustain: 0,
    releaseMs: 220,
    detuneCents: 6,
    cutoffHz: 5200,
    transient: 0.3,
    vibrato: [0, 0],
  },
  color: 0xc98a4b,
  accent: 0xf2c98a,
  noteMotion: 'pulse',
  unlock: { type: 'start' },
  tempoFeel: 1.0,
};

const REED_FLUTE: Instrument = {
  id: 'reed-flute',
  name: 'Reed Flute',
  character: 'Barely there. Breath and one clean line, wandering a little.',
  voice: {
    // Nearly a sine. The temptation is to add harmonics so it sounds
    // "fuller" — that is exactly what makes a synth flute sound like a
    // synth. The interest lives in the 45% breath transient and the
    // vibrato, not in the spectrum.
    partials: [
      [1, 1.0],
      [2, 0.14],
      [3, 0.08],
      [4, 0.03],
      [5, 0.015],
    ],
    attackMs: 95,
    decayMs: 160,
    sustain: 0.85,
    releaseMs: 260,
    detuneCents: 0,
    cutoffHz: 3200,
    transient: 0.45,
    // Slow and wide: a player's breath, not an LFO. Anything above about
    // 6 Hz stops reading as a human and starts reading as a effect.
    vibrato: [5.2, 18],
  },
  color: 0x86a06a,
  accent: 0xcfe09e,
  noteMotion: 'drift',
  // Roughly two-thirds of a day's road (1200–1800 m), so the first unlock
  // lands inside the first walk without being handed over at the gate.
  unlock: { type: 'distance', metres: 900 },
  tempoFeel: 0.92,
};

const HAND_DRUM: Instrument = {
  id: 'hand-drum',
  name: 'Hand Drum',
  character: 'No tune in it at all. Pure pulse, and the road walks itself.',
  voice: {
    // Circular membrane modes. These ratios are why a drum reads as
    // pitchless even at a definite tension: nothing lines up in an octave.
    partials: [
      [1, 1.0],
      [1.59, 0.35],
      [2.14, 0.16],
      [2.92, 0.06],
    ],
    attackMs: 1,
    decayMs: 210,
    sustain: 0,
    releaseMs: 80,
    detuneCents: 0,
    // Dark by a wide margin — the lowest cutoff of the six. A drum with the
    // lute's top end sounds like a snare, which is the wrong century.
    cutoffHz: 900,
    // Almost all slap. The pitched part of a hand drum is the smaller half
    // of what you hear.
    transient: 0.95,
    vibrato: [0, 0],
  },
  color: 0xa45a3c,
  accent: 0xe0a07a,
  noteMotion: 'pulse',
  // About four encounters a day, so a day and a half of meeting people.
  unlock: { type: 'encounters', count: 6 },
  tempoFeel: 1.12,
};

const SMALL_HARP: Instrument = {
  id: 'harp',
  name: 'Small Harp',
  character: 'Rings on after you stop. Notes pile up and forgive each other.',
  voice: {
    // Plucked like the lute but by a finger pad, not a plectrum: smooth
    // monotone rolloff, no odd-harmonic tilt, and a much longer ring. The
    // pair (lute, harp) is where the "genuinely distinct" requirement is
    // hardest, so the difference is carried by three things at once —
    // spectrum shape, decay length, and a transient a fifth of the lute's.
    partials: [
      [1, 1.0],
      [2, 0.42],
      [3, 0.22],
      [4, 0.13],
      [5, 0.07],
      [6, 0.04],
      [8, 0.02],
    ],
    attackMs: 6,
    decayMs: 1800,
    sustain: 0,
    releaseMs: 700,
    detuneCents: 2,
    cutoffHz: 4000,
    transient: 0.14,
    vibrato: [0, 0],
  },
  color: 0x4e8c86,
  accent: 0x9fd6ca,
  noteMotion: 'cascade',
  // Coins accrue continuously while busking, so this is the vaguest of the
  // five metrics; 700 is a little over two modest days and well under two
  // thorough ones. See NOMINAL_DAY for what "modest" is calibrated against.
  unlock: { type: 'coins', coins: 700 },
  tempoFeel: 0.88,
};

const HURDY_GURDY: Instrument = {
  id: 'hurdy-gurdy',
  name: 'Hurdy-Gurdy',
  character: 'A wheel you crank. It drones under everything and never stops.',
  voice: {
    // Near-sawtooth: a rosined wheel is a bow that never lifts, and a bowed
    // string is the one acoustic source that really does approximate 1/n
    // across nine partials. This is the richest voice of the six by design.
    partials: [
      [1, 1.0],
      [2, 0.55],
      [3, 0.4],
      [4, 0.3],
      [5, 0.24],
      [6, 0.18],
      [7, 0.14],
      [8, 0.1],
      [9, 0.08],
    ],
    // The wheel has to catch the string, so the attack is audibly slower
    // than a pluck and audibly faster than a breath.
    attackMs: 55,
    decayMs: 110,
    sustain: 0.9,
    releaseMs: 170,
    // The widest detune here: several strings sound at once and a
    // hurdy-gurdy is never quite in tune with itself. Narrowing this to
    // "correct" removes the instrument.
    detuneCents: 14,
    cutoffHz: 4200,
    // The trompette buzzing against its bridge on each stroke.
    transient: 0.55,
    // Faster and shallower than the flute's breath — this is the wheel
    // running slightly out of round, a mechanical wobble rather than a
    // human one.
    vibrato: [6.8, 9],
  },
  color: 0x8b4a63,
  accent: 0xd98fa6,
  noteMotion: 'spiral',
  // Three campfires is three days ended properly, which rewards coming back
  // rather than grinding one long session.
  unlock: { type: 'campfires', count: 3 },
  tempoFeel: 1.04,
};

const BELLS: Instrument = {
  id: 'bells',
  name: 'Ring of Bells',
  character: 'Slow, cold and enormous. One note is a whole bar of music.',
  voice: {
    // Real bell partials, named by their traditional names: hum (0.5),
    // prime (1), tierce (1.19 — the minor third that makes a bell sound
    // sad), quint (1.5), nominal (2, and usually the loudest), plus the
    // upper cluster. The perceived strike note is an octave under the
    // nominal and is not physically present at all, which is why this stack
    // sounds like a bell even though it barely has a fundamental.
    partials: [
      [0.5, 0.3],
      [1, 0.8],
      [1.19, 0.6],
      [1.5, 0.35],
      [2, 1.0],
      [2.5, 0.28],
      [3.0, 0.22],
      [4.2, 0.14],
    ],
    attackMs: 2,
    decayMs: 3000,
    sustain: 0,
    // You cannot damp a bell. The release is nearly as long as the decay on
    // purpose: cutting a bell short is the single most synthetic-sounding
    // thing this file could do.
    releaseMs: 1600,
    detuneCents: 7,
    // The only voice left effectively unfiltered. Bells are all top end,
    // and the lowpass is what would give the game away.
    cutoffHz: 9000,
    transient: 0.4,
    vibrato: [0, 0],
  },
  color: 0x6b7fa8,
  accent: 0xafc4ea,
  noteMotion: 'spiral',
  // Four days of walking. The last instrument should feel like arriving,
  // and four days is still inside "a handful" — nothing here is a grind.
  unlock: { type: 'distance', metres: 6000 },
  tempoFeel: 0.82,
};

/**
 * Ordered by unlock, which is also roughly the order of increasing weight:
 * the road starts with a lute in your hands and ends, days later, with
 * something you have to make room for.
 */
export const INSTRUMENTS: Instrument[] = [LUTE, REED_FLUTE, HAND_DRUM, SMALL_HARP, HURDY_GURDY, BELLS];

/**
 * These objects are handed to scene code and to the audio layer, which hold
 * references to them for the lifetime of a note. Freezing turns "the busk
 * scene nudged cutoffHz for one flourish and every later note stayed
 * nudged" from a subtle, intermittent audio bug into a loud one at the site
 * of the mistake. The declared type stays mutable so the exported shape
 * matches the contract; the runtime object is not.
 */
deepFreeze(INSTRUMENTS);

/** What the player has done, across all days. */
export interface UnlockProgress {
  totalMetres: number;
  totalCoins: number;
  totalEncounters: number;
  campfires: number;
}

/**
 * One ordinary day, used only to reason about pacing.
 *
 * Deliberately a *modest* day rather than an average one: the road is
 * 1200–1800 m so 1500 is a fair middle, but 300 coins assumes busking a
 * few spots rather than every one, and four encounters assumes not
 * detouring for them. Under-estimating the day means every unlock arrives
 * earlier than the estimate says, which is the direction an unlock schedule
 * should be wrong in.
 */
export const NOMINAL_DAY: UnlockProgress = {
  totalMetres: 1500,
  totalCoins: 300,
  totalEncounters: 4,
  campfires: 1,
};

/**
 * Frozen for the same reason INSTRUMENTS is, and more urgently: this object
 * is the denominator of every `unlockDayEstimate`, so a caller that treated
 * it as a scratch progress record — `const p = NOMINAL_DAY; p.totalCoins +=
 * earned` is one keystroke from correct — would silently move the whole
 * unlock schedule for the rest of the session. Callers wanting a day's worth
 * of progress to start from should spread it.
 */
deepFreeze(NOMINAL_DAY);

/** A progress record with everything at zero — a first-ever session. */
export function emptyProgress(): UnlockProgress {
  return { totalMetres: 0, totalCoins: 0, totalEncounters: 0, campfires: 0 };
}

/**
 * Look up by id, throwing rather than returning undefined.
 *
 * An unknown instrument id is always a bug (a stale save, a typo in scene
 * code), and the alternative — silently falling back to the lute — hides it
 * behind "the game keeps playing the wrong instrument". Callers loading
 * untrusted ids from storage should check with `isInstrumentId` first.
 */
export function instrumentById(id: InstrumentId): Instrument {
  const found = INSTRUMENTS.find((i) => i.id === id);
  if (!found) throw new Error(`unknown instrument id: ${id}`);
  return found;
}

/** Whether an arbitrary string names a shipped instrument. */
export function isInstrumentId(id: string): boolean {
  return INSTRUMENTS.some((i) => i.id === id);
}

/** The progress figure a rule is measured against. */
function metricFor(rule: UnlockRule, progress: UnlockProgress): number {
  switch (rule.type) {
    case 'start':
      return 0;
    case 'distance':
      return safe(progress.totalMetres);
    case 'coins':
      return safe(progress.totalCoins);
    case 'encounters':
      return safe(progress.totalEncounters);
    case 'campfires':
      return safe(progress.campfires);
  }
}

/** The figure a rule needs. Zero for `start`, which is why it always fires. */
export function unlockThreshold(rule: UnlockRule): number {
  switch (rule.type) {
    case 'start':
      return 0;
    case 'distance':
      return rule.metres;
    case 'coins':
      return rule.coins;
    case 'encounters':
      return rule.count;
    case 'campfires':
      return rule.count;
  }
}

/**
 * Met exactly is met. A player who has walked precisely 900 m and is told
 * the flute needs 900 m has earned it; a strict inequality here would show
 * a full progress bar and no instrument, which reads as broken.
 */
export function isUnlocked(rule: UnlockRule, progress: UnlockProgress): boolean {
  return metricFor(rule, progress) >= unlockThreshold(rule);
}

/** Progress toward a rule in 0..1, for a HUD ring. 1 once unlocked. */
export function unlockRatio(rule: UnlockRule, progress: UnlockProgress): number {
  const need = unlockThreshold(rule);
  if (need <= 0) return 1;
  return Math.max(0, Math.min(1, metricFor(rule, progress) / need));
}

/** Unlocked instruments, in INSTRUMENTS order. Never empty — the lute is free. */
export function unlockedInstruments(progress: UnlockProgress): Instrument[] {
  return INSTRUMENTS.filter((i) => isUnlocked(i.unlock, progress));
}

/**
 * What `after` unlocked that `before` had not — the campfire's "you found
 * something" list.
 *
 * Only additions, never removals, even if the caller hands over a `before`
 * that is somehow ahead of `after`. Progress cannot really go backwards, but
 * a corrupt save or a cleared storage key can make it look as though it did,
 * and the honest response to that is to award nothing rather than to
 * announce that the player has lost an instrument.
 */
export function newlyUnlocked(before: UnlockProgress, after: UnlockProgress): Instrument[] {
  const had = new Set(unlockedInstruments(before).map((i) => i.id));
  return unlockedInstruments(after).filter((i) => !had.has(i.id));
}

/**
 * The nearest instrument still locked, for a "coming up" line at the
 * campfire. Nearest by fraction of the way there rather than by list order,
 * because the metrics are incommensurable — 200 m short and 200 coins short
 * are not remotely the same distance from the prize.
 */
export function nextLockedInstrument(progress: UnlockProgress): Instrument | null {
  let best: Instrument | null = null;
  let bestRatio = -1;
  for (const instrument of INSTRUMENTS) {
    if (isUnlocked(instrument.unlock, progress)) continue;
    const ratio = unlockRatio(instrument.unlock, progress);
    if (ratio > bestRatio) {
      best = instrument;
      bestRatio = ratio;
    }
  }
  return best;
}

/**
 * How many nominal days of play a rule is expected to take.
 *
 * This exists so the pacing claim is checkable rather than asserted: the
 * unlock schedule is meant to be strictly increasing and to fit in a handful
 * of days, and without a common unit there is no way to compare "6000 m"
 * with "3 campfires" to see whether it does. `instruments.test.ts` holds
 * the schedule to it.
 */
export function unlockDayEstimate(rule: UnlockRule): number {
  if (rule.type === 'start') return 0;
  const perDay = metricFor(rule, NOMINAL_DAY);
  if (perDay <= 0) return Infinity;
  return unlockThreshold(rule) / perDay;
}

/**
 * Short phrase for the unlock card: "900 m walked", "3 nights camped".
 *
 * Every countable branch carries its own singular. The thresholds shipped
 * today are all plural, so the singular arms look like dead code — but this
 * function takes a rule, not one of the six, and the card renders whatever
 * number it is handed. A retuned threshold of 1 that printed "1 coins earned"
 * would be a seam in the one part of the game that is meant to read as
 * hand-written. "m" is a unit symbol and never takes a plural, which is why
 * `distance` is the exception rather than an oversight.
 */
export function describeUnlock(rule: UnlockRule): string {
  switch (rule.type) {
    case 'start':
      return 'yours from the first step';
    case 'distance':
      return `${rule.metres} m walked`;
    case 'coins':
      return rule.coins === 1 ? '1 coin earned' : `${rule.coins} coins earned`;
    case 'encounters':
      // Not "travellers": encounters include creatures and weather, and a
      // player who is one misty morning short should be told so honestly.
      return rule.count === 1 ? '1 meeting on the road' : `${rule.count} meetings on the road`;
    case 'campfires':
      return rule.count === 1 ? '1 night camped' : `${rule.count} nights camped`;
  }
}

/** Non-finite and negative progress is treated as none rather than trusted. */
function safe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
