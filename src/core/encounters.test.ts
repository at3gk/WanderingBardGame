import { describe, expect, it } from 'vitest';
import { BIOMES } from './biome';
import {
  ANY_BIOME,
  ASK_CHANCE,
  ASK_NEEDED,
  ASK_NOTES,
  ENCOUNTERS,
  meetingFigureFor,
  EncounterAsk,
  EncounterDef,
  EncounterKind,
  EncounterRoll,
  GIFT_CHANCE,
  PAYOUTS,
  RARITY_WEIGHT,
  Rarity,
  RollOptions,
  MEMENTO_KIND,
  VARIANT_COUNT,
  ROAD_ASIDE_CHANCE,
  candidatesFor,
  encounterLine,
  leavesMemento,
  matchesBiome,
  matchesWindow,
  resolveAsk,
  rollAsk,
  rollEncounter,
} from './encounters';

const BIOME_IDS = BIOMES.map((b) => b.id);
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'wondrous'];
const KINDS: EncounterKind[] = ['traveller', 'creature', 'weather'];

/** A spread of seeds walking a mixed road, so no test leans on one biome's table. */
function rollMany(count: number, opts?: RollOptions, dayFraction = 0.5): EncounterRoll[] {
  const out: EncounterRoll[] = [];
  for (let i = 0; i < count; i++) {
    out.push(rollEncounter(i, BIOME_IDS[i % BIOME_IDS.length], dayFraction, opts));
  }
  return out;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

describe('the encounter table', () => {
  it('is big enough to keep a week of walking varied', () => {
    expect(ENCOUNTERS.length).toBeGreaterThanOrEqual(24);
    expect(ENCOUNTERS.length).toBeLessThanOrEqual(36);
  });

  it('has unique ids and unique names', () => {
    const ids = new Set(ENCOUNTERS.map((d) => d.id));
    const names = new Set(ENCOUNTERS.map((d) => d.name));
    expect(ids.size).toBe(ENCOUNTERS.length);
    expect(names.size).toBe(ENCOUNTERS.length);
  });

  it('uses kebab-case ids', () => {
    for (const def of ENCOUNTERS) expect(def.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('has lines that fit on a phone and keep their voice', () => {
    for (const def of ENCOUNTERS) {
      expect(def.line.length).toBeGreaterThan(40);
      expect(def.line.length).toBeLessThanOrEqual(120);
      expect(def.line).not.toContain('!');
      expect(def.line.trim()).toBe(def.line);
      expect(def.line.endsWith('.')).toBe(true);
      expect(def.name.length).toBeGreaterThan(2);
      expect(def.name.endsWith('.')).toBe(false);
    }
  });

  it('only names biomes that exist', () => {
    for (const def of ENCOUNTERS) {
      expect(def.biomes.length).toBeGreaterThan(0);
      for (const biome of def.biomes) {
        if (biome === ANY_BIOME) continue;
        expect(BIOME_IDS).toContain(biome);
      }
      // A wildcard alongside a specific biome would be a contradiction the
      // filter silently resolves in the wildcard's favour.
      if (def.biomes.includes(ANY_BIOME)) expect(def.biomes).toEqual([ANY_BIOME]);
    }
  });

  it('has sane windows', () => {
    for (const def of ENCOUNTERS) {
      if (!def.window) continue;
      expect(def.window).toHaveLength(2);
      for (const edge of def.window) {
        expect(edge).toBeGreaterThanOrEqual(0);
        expect(edge).toBeLessThanOrEqual(1);
      }
      expect(def.window[0]).toBeLessThan(def.window[1]);
    }
  });

  it('covers every rarity and every kind, and every kind reaches wondrous', () => {
    for (const rarity of RARITIES) {
      expect(ENCOUNTERS.some((d) => d.rarity === rarity)).toBe(true);
    }
    for (const kind of KINDS) {
      expect(ENCOUNTERS.filter((d) => d.kind === kind).length).toBeGreaterThanOrEqual(5);
      expect(ENCOUNTERS.some((d) => d.kind === kind && d.rarity === 'wondrous')).toBe(true);
    }
  });

  it('records where a kind-filtered scene can and cannot reach wondrous', () => {
    // The test above proves a wondrous row *exists* per kind, which is not
    // the same as a kind-filtered scene being able to draw one — the row
    // still has to survive the biome and window filters. It mostly does not
    // for creatures, and that gap is worth stating out loud rather than
    // leaving for someone to find in playtest.
    const reachable = (kind: EncounterKind, biomeId: string, t: number) =>
      candidatesFor(biomeId, t, kind).some((d) => d.rarity === 'wondrous');

    // Travellers and weather carry an unwindowed wildcard wondrous, so they
    // can surprise anywhere, at any hour.
    for (const biomeId of BIOME_IDS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(reachable('traveller', biomeId, t)).toBe(true);
        expect(reachable('weather', biomeId, t)).toBe(true);
      }
    }

    // Creatures cannot, and this is the shape of the hole: the only wondrous
    // creature is windowed to the first third of the day and is not written
    // for riverside. Writing one wondrous riverside creature closes it, and
    // will flip these expectations — that is the intended way to fail here.
    expect(ENCOUNTERS.filter((d) => d.kind === 'creature' && d.rarity === 'wondrous')).toHaveLength(1);
    expect(reachable('creature', 'village', 0.1)).toBe(true);
    expect(reachable('creature', 'forest', 0.1)).toBe(true);
    expect(reachable('creature', 'riverside', 0.1)).toBe(false);
    for (const biomeId of BIOME_IDS) {
      expect(reachable('creature', biomeId, 0.5)).toBe(false);
      expect(reachable('creature', biomeId, 0.9)).toBe(false);
    }
  });

  it('leaves enough unwindowed entries that any hour has something to show', () => {
    for (const biomeId of BIOME_IDS) {
      for (let t = 0; t <= 1.0001; t += 0.05) {
        for (const kind of KINDS) {
          const set = candidatesFor(biomeId, t, kind);
          expect(set.length).toBeGreaterThan(0);
          // The relaxation ladder should not be load-bearing in normal play:
          // every kind has a genuine, in-window, in-biome option all day.
          expect(set.every((d) => d.kind === kind)).toBe(true);
          expect(set.every((d) => matchesWindow(d, t))).toBe(true);
        }
      }
    }
  });
});

describe('rarity tuning', () => {
  it('gets rarer and more generous in the same direction', () => {
    for (let i = 1; i < RARITIES.length; i++) {
      const lower = RARITIES[i - 1];
      const higher = RARITIES[i];
      expect(RARITY_WEIGHT[higher]).toBeLessThan(RARITY_WEIGHT[lower]);
      expect(PAYOUTS[higher].floor).toBeGreaterThan(PAYOUTS[lower].floor);
      expect(PAYOUTS[higher].tailChance).toBeGreaterThan(PAYOUTS[lower].tailChance);
      expect(GIFT_CHANCE[higher]).toBeGreaterThan(GIFT_CHANCE[lower]);
    }
  });

  it('gives a higher tier a floor above the tier below its ordinary ceiling', () => {
    // What makes a rare feel rare: its worst result beats the tier below's
    // best ordinary one, so tiers do not overlap except through the tail.
    for (let i = 1; i < RARITIES.length; i++) {
      const lower = PAYOUTS[RARITIES[i - 1]];
      const higher = PAYOUTS[RARITIES[i]];
      expect(higher.floor).toBeGreaterThanOrEqual(lower.floor + lower.spread);
    }
  });
});

describe('filtering', () => {
  it('keeps a biome to its own cast plus the wildcards', () => {
    // Checking the roll against the biome it was actually asked for. The
    // obvious version of this loop — asserting every result has a non-empty
    // `biomes` — is true of every row in the table by construction and so
    // cannot fail whatever the filter does.
    for (const biomeId of BIOME_IDS) {
      const seen = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const roll = rollEncounter(i, biomeId, 0.5);
        expect(matchesBiome(roll.def, biomeId)).toBe(true);
        seen.add(roll.def.id);
      }
      // And the filter is doing work rather than letting everything through:
      // each biome should be missing the other biomes' exclusive cast.
      const foreign = ENCOUNTERS.filter((d) => !matchesBiome(d, biomeId));
      expect(foreign.length).toBeGreaterThan(0);
      for (const def of foreign) expect(seen.has(def.id)).toBe(false);
    }
  });

  it('honours the time-of-day window', () => {
    const owl = ENCOUNTERS.find((d) => d.id === 'answering-owl');
    expect(owl).toBeDefined();
    expect(owl?.window).toBeDefined();

    const morning = new Set<string>();
    for (let i = 0; i < 800; i++) morning.add(rollEncounter(i, 'forest', 0.05).def.id);
    expect(morning.has('answering-owl')).toBe(false);

    // And is reachable at all — a window test that only proves absence would
    // also pass if the entry were unreachable everywhere.
    const night = new Set<string>();
    for (let i = 0; i < 4000; i++) night.add(rollEncounter(i, 'forest', 0.9).def.id);
    expect(night.has('answering-owl')).toBe(true);
  });

  it('reads a backwards window as wrapping past the campfire', () => {
    const wrapping: EncounterDef = {
      id: 'x',
      kind: 'weather',
      rarity: 'common',
      name: 'x',
      line: 'x',
      biomes: [ANY_BIOME],
      window: [0.9, 0.1],
    };
    expect(matchesWindow(wrapping, 0.95)).toBe(true);
    expect(matchesWindow(wrapping, 0.05)).toBe(true);
    expect(matchesWindow(wrapping, 0.5)).toBe(false);
  });

  it('clamps a day fraction outside 0..1 rather than throwing', () => {
    const owl = ENCOUNTERS.find((d) => d.id === 'answering-owl') as EncounterDef;
    expect(matchesWindow(owl, -3)).toBe(matchesWindow(owl, 0));
    expect(matchesWindow(owl, 4)).toBe(matchesWindow(owl, 1));
    expect(matchesWindow(owl, Number.NaN)).toBe(matchesWindow(owl, 0));
    expect(rollEncounter(7, 'forest', -3)).toEqual(rollEncounter(7, 'forest', 0));
    expect(rollEncounter(7, 'forest', 9)).toEqual(rollEncounter(7, 'forest', 1));
    expect(rollEncounter(7, 'forest', Number.NaN)).toEqual(rollEncounter(7, 'forest', 0));
    // A whole walk's worth, not one seed: a NaN that only survives on some
    // seeds is the kind of thing a single spot check misses.
    for (let i = 0; i < 200; i++) {
      const roll = rollEncounter(i, BIOME_IDS[i % BIOME_IDS.length], Number.NaN);
      expect(Number.isInteger(roll.coins)).toBe(true);
      expect(Number.isInteger(roll.delight)).toBe(true);
      expect(roll.variant).toBeLessThan(VARIANT_COUNT);
    }
  });

  it('restricts to a requested kind', () => {
    for (const kind of KINDS) {
      for (const roll of rollMany(300, { kind })) expect(roll.def.kind).toBe(kind);
    }
  });
});

describe('the fallback ladder', () => {
  const table: EncounterDef[] = [
    {
      id: 'a',
      kind: 'traveller',
      rarity: 'common',
      name: 'a',
      line: 'a',
      biomes: ['village'],
      window: [0, 0.2],
    },
    { id: 'b', kind: 'traveller', rarity: 'common', name: 'b', line: 'b', biomes: ['village'], window: [0.8, 1] },
    { id: 'c', kind: 'creature', rarity: 'common', name: 'c', line: 'c', biomes: ['forest'] },
  ];

  it('takes the exact match when there is one', () => {
    expect(candidatesFor('village', 0.1, 'traveller', table).map((d) => d.id)).toEqual(['a']);
  });

  it('drops the window before it drops the biome', () => {
    const set = candidatesFor('village', 0.5, 'traveller', table);
    expect(set.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('drops the biome before it drops the kind', () => {
    const set = candidatesFor('riverside', 0.5, 'traveller', table);
    expect(set.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('drops the kind only when the kind is empty, and returns everything', () => {
    const set = candidatesFor('riverside', 0.5, 'weather', table);
    expect(set.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('never returns an empty set for any biome, hour or kind', () => {
    const biomes = [...BIOME_IDS, 'nowhere-at-all', ''];
    for (const biomeId of biomes) {
      for (let t = -0.5; t <= 1.5; t += 0.1) {
        expect(candidatesFor(biomeId, t).length).toBeGreaterThan(0);
        for (const kind of KINDS) expect(candidatesFor(biomeId, t, kind).length).toBeGreaterThan(0);
      }
    }
  });

  it('still rolls something in a biome nobody wrote for', () => {
    for (let i = 0; i < 200; i++) {
      const roll = rollEncounter(i, 'nowhere-at-all', 0.5);
      expect(roll.def.biomes).toEqual([ANY_BIOME]);
    }
    // Creatures are all place-specific, so this exercises the biome rung.
    for (let i = 0; i < 200; i++) {
      expect(rollEncounter(i, 'nowhere-at-all', 0.5, { kind: 'creature' }).def.kind).toBe('creature');
    }
  });

  it('does not mutate the shared table', () => {
    const before = ENCOUNTERS.length;
    candidatesFor('forest', 0.5).push(ENCOUNTERS[0]);
    expect(ENCOUNTERS.length).toBe(before);
  });

  it('hands back a fresh array on every rung, not the table it filtered', () => {
    // The rung that returns everything is the one that could plausibly return
    // the input by reference, and a caller that then sorted or pushed to it
    // would corrupt the table for the rest of the session.
    const tiny: EncounterDef[] = [
      { id: 'z', kind: 'weather', rarity: 'common', name: 'z', line: 'z', biomes: ['village'] },
    ];
    expect(candidatesFor('village', 0.5, 'traveller', tiny)).not.toBe(tiny); // kind rung
    expect(candidatesFor('nowhere', 0.5, 'weather', tiny)).not.toBe(tiny); // biome rung
    expect(candidatesFor('village', 0.5, 'weather', tiny)).not.toBe(tiny); // exact match
    expect(candidatesFor('forest', 0.5)).not.toBe(ENCOUNTERS);

    const length = tiny.length;
    candidatesFor('village', 0.5, 'traveller', tiny).push(tiny[0]);
    expect(tiny.length).toBe(length);
  });
});

describe('determinism', () => {
  it('gives the same roll for the same seed', () => {
    for (const seed of [0, 1, 99, 123456, 0xffffffff]) {
      expect(rollEncounter(seed, 'forest', 0.4)).toEqual(rollEncounter(seed, 'forest', 0.4));
    }
  });

  it('gives the same roll for the same options object contents', () => {
    const a = rollEncounter(42, 'village', 0.6, { luck: 2, exclude: ['listening-fox'] });
    const b = rollEncounter(42, 'village', 0.6, { luck: 2, exclude: ['listening-fox'] });
    expect(a).toEqual(b);
  });

  it('does not collapse to one answer across seeds', () => {
    const ids = new Set(rollMany(300).map((r) => r.def.id));
    expect(ids.size).toBeGreaterThan(8);
    const coins = new Set(rollMany(300).map((r) => r.coins));
    expect(coins.size).toBeGreaterThan(6);
  });

  it('varies the presentation variant within range', () => {
    const variants = new Set<number>();
    for (const roll of rollMany(400)) {
      expect(Number.isInteger(roll.variant)).toBe(true);
      expect(roll.variant).toBeGreaterThanOrEqual(0);
      expect(roll.variant).toBeLessThan(VARIANT_COUNT);
      variants.add(roll.variant);
    }
    expect(variants.size).toBe(VARIANT_COUNT);
  });
});

describe('payouts', () => {
  const rolls = rollMany(30000);
  const byRarity = (rarity: Rarity) => rolls.filter((r) => r.def.rarity === rarity);

  it('always pays a whole, non-negative, finite amount', () => {
    // Collected then asserted once, rather than five expects per roll across
    // the whole sample: the assertion is the expensive part, and a failure
    // that names the offending roll is more use than one that names the
    // twelve-thousandth iteration of a loop.
    const bad = rolls.filter(
      (r) =>
        !Number.isInteger(r.coins) ||
        !Number.isInteger(r.delight) ||
        r.coins < 0 ||
        r.delight < 0 ||
        !Number.isFinite(r.coins + r.delight)
    );
    expect(bad).toEqual([]);
  });

  it('never actually pays a bare zero, even at the worst kind tilt', () => {
    // The contract only promises non-negative, and the `Math.max(0, ...)` in
    // the roll is there to keep that promise. But the promise the *scene*
    // needs is stronger: an encounter that pays literally nothing reads as a
    // dropped frame, not as a quiet moment. The thinnest case in the table is
    // a common weather moment (floor 2, coins tilt 0.35, jitter down to
    // 0.85 — about 0.6, which rounds to 1), so the floor holds by a hair. If
    // a future tilt or floor edit breaks it, this is where it shows up.
    expect(Math.min(...rolls.map((r) => r.coins))).toBeGreaterThan(0);
    expect(Math.min(...rolls.map((r) => r.delight))).toBeGreaterThan(0);
  });

  it('draws the rarer tiers rarer', () => {
    const counts = RARITIES.map((r) => byRarity(r).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]);
    expect(counts[3]).toBeGreaterThan(0);
  });

  it('pins what the tiers actually come up at, not what the weights suggest', () => {
    // RARITY_WEIGHT is per definition, not per tier, so the realised share of
    // a tier is its weight times how many of its rows survived the biome and
    // window filters. With ten commons and four wondrous — three of the four
    // windowed — the wondrous share lands nowhere near 2/145. Measured, it is
    // about one in a hundred and sixty.
    //
    // Pinned in a band rather than asserted loosely: a `< 0.09` bound would
    // have passed at one in eleven and at one in a thousand alike, so it
    // could not tell anyone the balance had moved. These bounds are tight
    // enough that retuning the weights or adding rows to the table fails this
    // test on purpose — that is a conversation, not a regression.
    const share = (rarity: Rarity) => byRarity(rarity).length / rolls.length;
    expect(share('common')).toBeGreaterThan(0.68);
    expect(share('common')).toBeLessThan(0.79);
    expect(share('uncommon')).toBeGreaterThan(0.19);
    expect(share('uncommon')).toBeLessThan(0.28);
    expect(share('rare')).toBeGreaterThan(0.015);
    expect(share('rare')).toBeLessThan(0.032);
    expect(share('wondrous')).toBeGreaterThan(0.003);
    expect(share('wondrous')).toBeLessThan(0.011);
  });

  it('pays the rarer tiers better on average', () => {
    const means = RARITIES.map((r) => mean(byRarity(r).map((x) => x.coins + x.delight)));
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeGreaterThan(means[i - 1]);
    // Not a flat multiplier: the gap between tiers widens as you go up.
    expect(means[3] - means[2]).toBeGreaterThan(means[1] - means[0]);
  });

  it('keeps commons tight and lets the top tiers run', () => {
    const value = (r: EncounterRoll) => r.coins + r.delight;
    const common = byRarity('common').map(value);
    const rare = byRarity('rare').map(value);
    const wondrous = byRarity('wondrous').map(value);

    // A common's good day should not reach a rare's ordinary one.
    expect(quantile(common, 0.9)).toBeLessThan(quantile(rare, 0.5));

    // And each tier above should have a tail: the top of the sample well
    // clear of its own median, which a uniform band could not produce.
    expect(Math.max(...rare)).toBeGreaterThan(quantile(rare, 0.5) * 2.5);
    expect(Math.max(...wondrous)).toBeGreaterThan(quantile(wondrous, 0.5) * 2);

    // The tail is capped, so no single roll can wreck a save.
    expect(Math.max(...wondrous)).toBeLessThan(600);
  });

  it('is not a flat multiplier across kinds either', () => {
    const travellers = rolls.filter((r) => r.def.kind === 'traveller');
    const weather = rolls.filter((r) => r.def.kind === 'weather');
    expect(mean(travellers.map((r) => r.coins))).toBeGreaterThan(mean(travellers.map((r) => r.delight)));
    expect(mean(weather.map((r) => r.delight))).toBeGreaterThan(mean(weather.map((r) => r.coins)) * 2);
  });

  it('raises coins with rarity within a single kind', () => {
    const travellers = rollMany(20000, { kind: 'traveller' });
    const coinsAt = (rarity: Rarity) =>
      mean(travellers.filter((r) => r.def.rarity === rarity).map((r) => r.coins));
    expect(coinsAt('uncommon')).toBeGreaterThan(coinsAt('common'));
    expect(coinsAt('rare')).toBeGreaterThan(coinsAt('uncommon'));
    expect(coinsAt('wondrous')).toBeGreaterThan(coinsAt('rare'));
  });

  it('gives gifts rarely, and more often the rarer the encounter', () => {
    const rate = (rarity: Rarity) => {
      const set = byRarity(rarity);
      return set.filter((r) => r.gift !== null).length / set.length;
    };
    expect(rate('common')).toBeLessThan(0.12);
    expect(rate('common')).toBeLessThan(rate('uncommon'));
    expect(rate('uncommon')).toBeLessThan(rate('rare'));
    expect(rate('rare')).toBeLessThan(rate('wondrous'));
    expect(rate('wondrous')).toBeGreaterThan(0.5);
  });

  it('never hands out a gift that belongs to another kind of moment', () => {
    // Checked against the whole per-kind vocabulary rather than by spotting a
    // couple of banned words. Two `not.toContain` probes would still pass if
    // a rain shower started handing out spare fiddle strings.
    const gifted = rolls.filter((r) => r.gift !== null);
    expect(gifted.length).toBeGreaterThan(100);

    const vocabulary = new Map<EncounterKind, Set<string>>();
    for (const kind of KINDS) vocabulary.set(kind, new Set());
    for (const roll of gifted) vocabulary.get(roll.def.kind)?.add(roll.gift as string);

    // Every kind has its own pool and the pools are disjoint.
    for (const kind of KINDS) {
      const own = vocabulary.get(kind) as Set<string>;
      expect(own.size).toBeGreaterThanOrEqual(5);
      for (const other of KINDS) {
        if (other === kind) continue;
        for (const gift of vocabulary.get(other) as Set<string>) expect(own.has(gift)).toBe(false);
      }
    }

    for (const roll of gifted) {
      expect(typeof roll.gift).toBe('string');
      expect((roll.gift as string).length).toBeGreaterThan(10);
      expect(roll.gift).not.toContain('!');
      expect((roll.gift as string).trim()).toBe(roll.gift);
    }
  });
});

describe('roll options', () => {
  it('luck lifts the top tiers and leaves the bottom alone', () => {
    const share = (opts: RollOptions) => {
      const set = rollMany(8000, opts);
      return set.filter((r) => r.def.rarity === 'rare' || r.def.rarity === 'wondrous').length / set.length;
    };
    const plain = share({});
    const lucky = share({ luck: 4 });
    expect(lucky).toBeGreaterThan(plain * 2);
  });

  it('luck of zero is an ordinary day, not an empty one', () => {
    const set = rollMany(2000, { luck: 0 });
    expect(set.length).toBe(2000);
    expect(set.every((r) => r.def.rarity === 'common' || r.def.rarity === 'uncommon')).toBe(true);
  });

  it('clamps absurd luck instead of trusting it', () => {
    // The clamp is what stops a charm stacking bug turning every encounter
    // wondrous: even at the ceiling the commons still outweigh the top tiers.
    const share = (luck: number) => {
      const set = rollMany(4000, { luck });
      return set.filter((r) => r.def.rarity === 'rare' || r.def.rarity === 'wondrous').length / set.length;
    };
    expect(share(8)).toBeGreaterThan(share(4));
    expect(share(1e9)).toBeLessThan(0.5);
    for (let i = 0; i < 50; i++) {
      expect(rollEncounter(i, 'forest', 0.5, { luck: 8 })).toEqual(rollEncounter(i, 'forest', 0.5, { luck: 1e9 }));
      expect(rollEncounter(i, 'forest', 0.5, { luck: 0 })).toEqual(rollEncounter(i, 'forest', 0.5, { luck: -5 }));
    }
  });

  it('reads a NaN luck as an ordinary day instead of collapsing the table', () => {
    // Regression. NaN survived the old `Math.max(0, Math.min(8, luck))`
    // clamp, poisoned the rare/wondrous weights, and made weightedPick's
    // running total NaN — so every `roll <= 0` test failed and the loop fell
    // through to the last candidate. Every roll returned the same encounter,
    // and the last row of this table is wondrous, so it paid like one too.
    // The failure was silent and deterministic, which is the bad kind.
    const spoiled = rollMany(400, { luck: Number.NaN });
    const ids = new Set(spoiled.map((r) => r.def.id));
    expect(ids.size).toBeGreaterThan(8);
    expect(spoiled.some((r) => r.def.rarity === 'common')).toBe(true);
    for (const roll of spoiled) {
      expect(Number.isInteger(roll.coins)).toBe(true);
      expect(Number.isFinite(roll.delight)).toBe(true);
    }
    // Specifically luck 1, not luck 0 — an unreadable value should not
    // quietly switch the top two tiers off either.
    for (let i = 0; i < 60; i++) {
      expect(rollEncounter(i, 'forest', 0.5, { luck: Number.NaN })).toEqual(rollEncounter(i, 'forest', 0.5));
    }
  });

  it('treats the infinities as the ends of the luck range, not as errors', () => {
    for (let i = 0; i < 60; i++) {
      expect(rollEncounter(i, 'forest', 0.5, { luck: Infinity })).toEqual(
        rollEncounter(i, 'forest', 0.5, { luck: 8 })
      );
      expect(rollEncounter(i, 'forest', 0.5, { luck: -Infinity })).toEqual(
        rollEncounter(i, 'forest', 0.5, { luck: 0 })
      );
    }
  });

  it('pushes already-met encounters down without removing them', () => {
    const met = ['listening-fox', 'glow-beetles'];
    const withMet = rollMany(4000, { exclude: met, kind: 'creature' });
    const without = rollMany(4000, { kind: 'creature' });
    const rate = (set: EncounterRoll[]) => set.filter((r) => met.includes(r.def.id)).length / set.length;
    expect(rate(withMet)).toBeLessThan(rate(without) / 3);
  });

  it('still rolls when every encounter has already been met', () => {
    const all = ENCOUNTERS.map((d) => d.id);
    for (let i = 0; i < 300; i++) {
      const roll = rollEncounter(i, 'village', 0.5, { exclude: all });
      expect(ENCOUNTERS).toContain(roll.def);
      expect(roll.coins).toBeGreaterThanOrEqual(0);
    }
  });

  it('treats an empty exclude list as no exclusion at all', () => {
    expect(rollEncounter(11, 'riverside', 0.7, { exclude: [] })).toEqual(rollEncounter(11, 'riverside', 0.7));
  });
});

describe("a traveller's ask (stakes, not failure)", () => {
  const travellers = ENCOUNTERS.filter((d) => d.kind === 'traveller');

  /** Every ask the first `seeds` seeds produce, across the whole traveller table. */
  function allAsks(seeds: number): Array<{ def: EncounterDef; ask: EncounterAsk }> {
    const out: Array<{ def: EncounterDef; ask: EncounterAsk }> = [];
    for (let seed = 0; seed < seeds; seed++) {
      for (const def of travellers) {
        const ask = rollAsk(seed, def);
        if (ask) out.push({ def, ask });
      }
    }
    return out;
  }

  it('is deterministic: the same stop asks the same thing forever', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const def of travellers) {
        expect(rollAsk(seed, def)).toEqual(rollAsk(seed, def));
      }
    }
  });

  it('only travellers ever ask', () => {
    for (const def of ENCOUNTERS) {
      if (def.kind === 'traveller') continue;
      for (let seed = 0; seed < 50; seed++) expect(rollAsk(seed, def)).toBeNull();
    }
  });

  it('turns up on roughly a third of travellers, not all of them', () => {
    // A missable moment on every meeting stops being a moment. The share is
    // pinned loosely so a retune of ASK_CHANCE is a decision, not a drift.
    let asks = 0;
    let met = 0;
    for (let seed = 0; seed < 600; seed++) {
      for (const def of travellers) {
        met += 1;
        if (rollAsk(seed, def)) asks += 1;
      }
    }
    const share = asks / met;
    expect(share).toBeGreaterThan(ASK_CHANCE - 0.08);
    expect(share).toBeLessThan(ASK_CHANCE + 0.08);
  });

  it('asks for a window a child can actually play', () => {
    for (const { ask } of allAsks(200)) {
      expect(ask.notes).toBe(ASK_NOTES);
      expect(ask.needed).toBe(ASK_NEEDED);
      expect(ask.needed).toBeLessThan(ask.notes);
      expect(ask.needed).toBeGreaterThan(0);
      expect(ask.coins).toBeGreaterThanOrEqual(1);
      expect(ask.delight).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the table voice, and the no-fail language, in every line', () => {
    for (const { ask } of allAsks(200)) {
      for (const line of [ask.line, ask.fulfilledLine, ask.passedLine]) {
        expect(line.length).toBeGreaterThan(40);
        expect(line.length).toBeLessThanOrEqual(120);
        expect(line).not.toContain('!');
        expect(line.endsWith('.')).toBe(true);
        expect(line).not.toMatch(/fail|lose|lost|wrong|penalt/i);
      }
    }
  });

  it('pays a rarer traveller better for the same request', () => {
    const byRarity = new Map<Rarity, number[]>();
    for (const { def, ask } of allAsks(800)) {
      const list = byRarity.get(def.rarity) ?? [];
      list.push(ask.coins);
      byRarity.set(def.rarity, list);
    }
    const avg = (r: Rarity) => mean(byRarity.get(r) ?? [0]);
    expect(avg('uncommon')).toBeGreaterThan(avg('common'));
    expect(avg('rare')).toBeGreaterThan(avg('uncommon'));
    expect(avg('wondrous')).toBeGreaterThan(avg('rare'));
  });

  it('settles fulfilled at the bar and passed below it, and the lines match', () => {
    const { ask } = allAsks(50)[0];
    const passed = resolveAsk(ask, ask.needed - 1);
    expect(passed.fulfilled).toBe(false);
    expect(passed.line).toBe(ask.passedLine);
    const landed = resolveAsk(ask, ask.needed);
    expect(landed.fulfilled).toBe(true);
    expect(landed.coins).toBe(ask.coins);
    expect(landed.delight).toBe(ask.delight);
    expect(landed.line).toBe(ask.fulfilledLine);
  });

  it('a passed ask pays nothing and takes nothing, whatever the input', () => {
    // Item 8's contract: a child can lose a chance, never progress. Zero,
    // negative and unreadable hit counts all resolve to the kind zero.
    const { ask } = allAsks(50)[0];
    for (const hits of [0, -3, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const outcome = resolveAsk(ask, hits);
      expect(outcome.fulfilled).toBe(false);
      expect(outcome.coins).toBe(0);
      expect(outcome.delight).toBe(0);
      expect(outcome.line).toBe(ask.passedLine);
    }
  });

  it('drawing an ask does not disturb who you meet at the stop', () => {
    // The ask reads its own sub-stream. If it shared the roll's, adding it
    // would silently reshuffle every encounter in the shipped game.
    for (let seed = 0; seed < 60; seed++) {
      const before = rollEncounter(seed, 'village', 0.5);
      rollAsk(seed, before.def);
      expect(rollEncounter(seed, 'village', 0.5)).toEqual(before);
    }
  });
});

describe('mementos', () => {
  it('writes lovely meetings under their own journal kind', () => {
    // Two files agree on this word; a rename that touched only one would
    // silently stop the page marking anything, with no test to notice.
    expect(MEMENTO_KIND).toBe('memento');
  });

  it('presses one for the top two rarities, whatever they left behind', () => {
    const rolls = rollMany(600);
    const top = rolls.filter((r) => r.def.rarity === 'rare' || r.def.rarity === 'wondrous');
    expect(top.length).toBeGreaterThan(0);
    for (const roll of top) expect(leavesMemento(roll)).toBe(true);
  });

  it('presses one for a gift at any rarity, because the gift is the keepsake', () => {
    const rolls = rollMany(600);
    const gifted = rolls.filter(
      (r) => r.gift !== null && (r.def.rarity === 'common' || r.def.rarity === 'uncommon'),
    );
    // The branch has to be reachable, or this rule is decoration.
    expect(gifted.length).toBeGreaterThan(0);
    for (const roll of gifted) expect(leavesMemento(roll)).toBe(true);
  });

  it('leaves an ordinary meeting unmarked', () => {
    const rolls = rollMany(600);
    const ordinary = rolls.filter(
      (r) => r.gift === null && (r.def.rarity === 'common' || r.def.rarity === 'uncommon'),
    );
    expect(ordinary.length).toBeGreaterThan(0);
    for (const roll of ordinary) expect(leavesMemento(roll)).toBe(false);
  });

  it('keeps the mark scarce enough to stay a surprise', () => {
    // Not a target the game shows anyone — a page holds six moments, and a
    // mark on most of them is wallpaper rather than a kept flower. If a
    // table edit or a GIFT_CHANCE retune pushes this share up, that should
    // be an intentional edit here rather than a drift nobody saw.
    const rolls = rollMany(1200);
    const marked = rolls.filter(leavesMemento).length / rolls.length;
    expect(marked).toBeGreaterThan(0.02);
    expect(marked).toBeLessThan(0.3);
  });
});

describe('the road, spoken', () => {
  const NAME = 'Bramblegate Way';
  /** Rolls that can carry an aside at all: travellers, the one kind with news. */
  const travellers = rollMany(1200).filter((r) => r.def.kind === 'traveller');

  const named = (i: number, roll: EncounterRoll, name: string | null = NAME) =>
    encounterLine(i, roll, name);

  it('names the road for a minority of meetings, and never for most', () => {
    const rolls = rollMany(1200);
    const spoken = rolls.filter((r, i) => named(i, r).includes(NAME));
    // A share of the *whole* day's meetings: travellers are only part of the
    // table, and only some of those speak. Wide band on purpose — the point
    // is that the road is mentioned sometimes and is quiet most of the time.
    const share = spoken.length / rolls.length;
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.25);
  });

  it('is a seeded minority among travellers, near ROAD_ASIDE_CHANCE', () => {
    const spoken = travellers.filter((r, i) => named(i, r).includes(NAME)).length;
    const share = spoken / travellers.length;
    expect(travellers.length).toBeGreaterThan(200);
    expect(share).toBeGreaterThan(ROAD_ASIDE_CHANCE - 0.1);
    expect(share).toBeLessThan(ROAD_ASIDE_CHANCE + 0.1);
  });

  it('keeps the same seed saying the same thing', () => {
    for (let i = 0; i < 60; i++) {
      const roll = rollEncounter(i, BIOME_IDS[i % BIOME_IDS.length], 0.5);
      expect(encounterLine(i, roll, NAME)).toBe(encounterLine(i, roll, NAME));
    }
  });

  it('gives back the nameless line byte for byte when there is no road name', () => {
    const rolls = rollMany(600);
    rolls.forEach((roll, i) => {
      expect(named(i, roll, null)).toBe(roll.def.line);
      expect(named(i, roll, '')).toBe(roll.def.line);
      expect(named(i, roll, '   ')).toBe(roll.def.line);
    });
  });

  it('leaves the encounter its own opening words, always', () => {
    const rolls = rollMany(600);
    rolls.forEach((roll, i) => {
      expect(named(i, roll).startsWith(roll.def.line)).toBe(true);
    });
  });

  it('does not let a fox or a rain shower carry the news', () => {
    const others = rollMany(900).filter((r) => r.def.kind !== 'traveller');
    expect(others.length).toBeGreaterThan(100);
    others.forEach((roll, i) => expect(encounterLine(i, roll, NAME)).toBe(roll.def.line));
  });

  it('speaks the road the way the journal speaks', () => {
    // The journal's bans, plus the two this line could invent on its own:
    // an obligation ("you should") and a comparison ("everyone else already").
    const banned = /\bfail|\blose|\blost\b|\bwrong\b|\bmiss(ed)?\b|streak|score|!/i;
    const pressure = /\bshould\b|\bmust\b|\bahead of\b|\bbehind\b|\belse already\b|\bonly you\b|\d/i;

    const lines = new Set<string>();
    const rolls = rollMany(2000);
    rolls.forEach((roll, i) => {
      const line = named(i, roll);
      if (line !== roll.def.line) lines.add(line.slice(roll.def.line.length).trim());
    });
    // Every aside in the pool gets swept, not just the ones a short run drew.
    expect(lines.size).toBeGreaterThanOrEqual(5);

    for (const aside of lines) {
      expect(aside).not.toMatch(banned);
      expect(aside).not.toMatch(pressure);
      expect(aside).toContain(NAME);
      expect(aside.length).toBeLessThan(120);
    }
  });
});

describe('meetingFigureFor', () => {
  it('stands a person for travellers, the deer for the deer, nothing else', () => {
    for (const def of ENCOUNTERS) {
      const figure = meetingFigureFor(def);
      if (def.kind === 'traveller') expect(figure).toBe('person');
      else if (def.id === 'still-deer') expect(figure).toBe('deer');
      // A creature without its own figure stands NOTHING: for most of the
      // game's life every encounter stood a random human, so a deer day
      // showed a walker playing understudy. Unstaged is honest; mis-staged
      // contradicts the caption.
      else expect(figure).toBeNull();
    }
  });
});
