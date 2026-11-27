/**
 * The dev-time AO table (task 264, aoCache.ts): fresh, complete, used.
 *
 * Regenerate after changing any shape listed in `SOURCES` (or the bake):
 *
 *     UPDATE_AO=1 npx vitest run src/three/world/aoTable.test.ts
 *
 * A stale table is never wrong in the game (a miss bakes live), only slow,
 * so these tests are what keep the boot fast.
 */
// @ts-expect-error node builtin: the project has no @types/node, and this is the one test that writes a file
import { writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { aoKey, decodeAO, encodeAO, liveBakeCount, setAORecorder, storedAO } from './aoCache';
import { STORED_AO } from './aoTable.generated';
import {
  bakeVertexAO,
  fallenLogGeometry,
  pebbleGeometry,
  rockGeometry,
  shrubGeometry,
  treeGeometry,
} from './geometry';
import { BIOME_PALETTES } from './palette';
import {
  LOG_SEED,
  PEBBLE_SEEDS,
  ROCK_SEEDS,
  SHRUB_SEEDS,
  TREE_KINDS,
  TREE_VARIANTS,
  treeSeed,
  WorldStreamer,
} from './WorldStreamer';
import { createPainterlyGlobals } from '../painterly';
import { generateRoad } from '../../core/road';
import { Bard, instrumentGeometry } from '../actors/Bard';
import { INSTRUMENTS } from '../../core/instruments';

/**
 * Every shape the world streamer bakes in its scatter and ordinary trees:
 * the first-use builds the trailhead chunk pays before frame 1. Landmarks
 * and stop dressings are not here: they stand 140 m out and later, and
 * bake live when their chunk streams in.
 *
 * Plus the Bard's three baked parts (task 265): the cloak, the hat and the
 * instrument's timber. None of them depends on the road or the colours, so
 * one entry each serves every boot. The instrument body has three shapes
 * (lute-family, flute-family, drum-family); all three are listed so a swap
 * mid-session never casts rays either.
 */
const SOURCES: Array<() => void> = [
  ...TREE_KINDS.flatMap((kind) =>
    Array.from({ length: TREE_VARIANTS }, (_, v) => () =>
      void treeGeometry(kind, { trunkColor: 0x6b5a40, canopyColor: 0x5a8a40, seed: treeSeed(kind, v) }),
    ),
  ),
  ...SHRUB_SEEDS.map((seed) => () => void shrubGeometry(seed)),
  ...ROCK_SEEDS.map((seed) => () => void rockGeometry(seed)),
  ...PEBBLE_SEEDS.map((seed) => () => void pebbleGeometry(seed)),
  () => void fallenLogGeometry(LOG_SEED),
  () => void new Bard(createPainterlyGlobals()),
  ...['lute', 'flute', 'drum'].map((kind) => () => void instrumentGeometry(kind)),
];

function recordAll(): Map<string, Float64Array> {
  const recorded = new Map<string, Float64Array>();
  setAORecorder((key, factors) => recorded.set(key, factors));
  try {
    for (const build of SOURCES) build();
  } finally {
    setAORecorder(null);
  }
  return recorded;
}

afterEach(() => setAORecorder(null));

describe('aoCache', () => {
  it('round-trips factors within one 16-bit step', () => {
    const factors = [0, 0.55, 0.731234, 0.999999, 1];
    const back = decodeAO(encodeAO(factors));
    expect(back.length).toBe(factors.length);
    for (let i = 0; i < factors.length; i++) expect(Math.abs(back[i] - factors[i])).toBeLessThan(1 / 65535);
  });

  it('keys on every input: shape, normals, index and parameters', () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const nor = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const base = aoKey(pos, nor, null, [16, 1, 0.45, 1]);
    expect(aoKey(pos, nor, null, [16, 1, 0.45, 1])).toBe(base);
    expect(aoKey(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1.001, 0]), nor, null, [16, 1, 0.45, 1])).not.toBe(base);
    expect(aoKey(pos, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 0]), null, [16, 1, 0.45, 1])).not.toBe(base);
    expect(aoKey(pos, nor, [0, 1, 2], [16, 1, 0.45, 1])).not.toBe(base);
    expect(aoKey(pos, nor, null, [16, 1, 0.45, 2])).not.toBe(base);
    expect(aoKey(pos, nor, null, [8, 1, 0.45, 1])).not.toBe(base);
  });

  it('ignores an entry whose length does not match the geometry', () => {
    const [key, encoded] = Object.entries(STORED_AO)[0] ?? ['', ''];
    if (!key) return;
    const n = decodeAO(encoded).length;
    expect(storedAO(key, n)).not.toBeNull();
    expect(storedAO(key, n + 1)).toBeNull();
    expect(storedAO('no-such-key', n)).toBeNull();
  });

  it('a stored answer colours the geometry as the live bake does', () => {
    // Same shape twice: once forced live through the recorder, once from
    // the table. The table stores 16-bit factors, so allow one step.
    const build = () => treeGeometry('broadleaf', { trunkColor: 0x6b5a40, canopyColor: 0x5a8a40, seed: treeSeed('broadleaf', 2) });
    setAORecorder(() => {});
    const live = build().attributes.color.array as Float32Array;
    setAORecorder(null);
    const before = liveBakeCount();
    const cached = build().attributes.color.array as Float32Array;
    expect(liveBakeCount()).toBe(before);
    expect(cached.length).toBe(live.length);
    let worst = 0;
    for (let i = 0; i < live.length; i++) worst = Math.max(worst, Math.abs(live[i] - cached[i]));
    expect(worst).toBeLessThan(2e-5);
  });

  it('the bake is untouched for shapes that are not in the table', () => {
    // An inside corner the table has never seen: bakes live, darkens.
    const g = treeGeometry('conifer', { trunkColor: 0xffffff, canopyColor: 0xffffff, seed: 777 });
    expect(g.attributes.color).toBeDefined();
    const before = liveBakeCount();
    bakeVertexAO(g.clone(), { seed: 4242, maxDist: 0.3 });
    expect(liveBakeCount()).toBe(before + 1);
  });
});

describe('aoTable.generated', () => {
  it('is fresh: every listed shape is stored, agrees with the live bake, and nothing else is stored', () => {
    const recorded = recordAll();
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
    if (env?.UPDATE_AO) {
      const lines = [...recorded.keys()].sort().map((key) => `  '${key}': '${encodeAO(recorded.get(key)!)}',`);
      const text = [
        '// Generated by `UPDATE_AO=1 npx vitest run src/three/world/aoTable.test.ts`.',
        '// Do not edit by hand. See aoCache.ts.',
        'export const STORED_AO: Readonly<Record<string, string>> = {',
        ...lines,
        '};',
        '',
      ].join('\n');
      writeFileSync(new URL('./aoTable.generated.ts', import.meta.url), text);
      return;
    }
    const hint = 'stale AO table: run UPDATE_AO=1 npx vitest run src/three/world/aoTable.test.ts';
    expect(Object.keys(STORED_AO).sort(), hint).toEqual([...recorded.keys()].sort());
    for (const [key, factors] of recorded) {
      const stored = storedAO(key, factors.length);
      expect(stored, `${hint} (${key})`).not.toBeNull();
      for (let i = 0; i < factors.length; i++) {
        expect(Math.abs(stored![i] - factors[i]), `${hint} (${key}[${i}])`).toBeLessThan(1 / 65535);
      }
    }
  });

  it('tree shapes do not depend on the biome, so one entry serves every palette', () => {
    const keys = (trunkColor: number, canopyColor: number): string[] => {
      const out: string[] = [];
      setAORecorder((key) => out.push(key));
      for (const kind of TREE_KINDS) treeGeometry(kind, { trunkColor, canopyColor, seed: treeSeed(kind, 1) });
      setAORecorder(null);
      return out;
    };
    const palettes = Object.values(BIOME_PALETTES);
    const first = keys(palettes[0].trunk, palettes[0].canopyVariant);
    for (const p of palettes.slice(1)) expect(keys(p.trunk, p.canopyVariant)).toEqual(first);
  });

  it('the trailhead boot casts no AO rays (the point of the table)', () => {
    for (const seed of [1, 20261127, 987654321]) {
      const road = generateRoad(seed, '2026-11-27');
      const before = liveBakeCount();
      const world = new WorldStreamer(road, createPainterlyGlobals(), { foliageDensity: 1, castShadows: true });
      world.update(0, true);
      expect(liveBakeCount() - before, `road seed ${seed}`).toBe(0);
    }
  });

  it('the bard boots, and changes into every instrument, without casting AO rays', () => {
    const before = liveBakeCount();
    const bard = new Bard(createPainterlyGlobals());
    for (const instrument of INSTRUMENTS) bard.setInstrument(instrument);
    bard.setInstrument(null);
    expect(liveBakeCount() - before).toBe(0);
  });
});
