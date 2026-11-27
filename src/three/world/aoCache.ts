/**
 * Ambient occlusion baked at dev time, for the shapes the boot can't wait for
 * (task 264).
 *
 * `bakeVertexAO` ray-casts 16 rays a vertex, and that is ~90% of building a
 * tree: the trailhead chunk's first-use trees cost ~0.33 s of the phone
 * profile's ~0.5 s first world stream, before the first frame. The bake is
 * deterministic, so its answer for a given shape never changes. This module
 * keeps those answers in `aoTable.generated.ts` and hands them back instead
 * of re-casting.
 *
 * **It can never be wrong, only slow.** An entry is keyed by a hash of the
 * exact vertex positions, normals, index and bake parameters it was made
 * from. Change a tree's shape, a seed or a bake setting and the key misses,
 * and the bake runs live as it always did. `aoTable.test.ts` fails when the
 * table has gone stale (a listed shape missing, a value disagreeing with the
 * live bake, an entry nothing uses) and says how to regenerate it.
 *
 * Values are stored as 16-bit fixed point (error under 8e-6 of a colour
 * channel, well under one 8-bit display step), base64, little-endian.
 */
import { STORED_AO } from './aoTable.generated';

/** FNV-1a over 32-bit words, two lanes with different offsets: a 64-bit key. */
function hashWords(words: Uint32Array, h: [number, number]): void {
  let a = h[0];
  let b = h[1];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    a = Math.imul(a ^ w, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((w << 13) | (w >>> 19)), 0x01000193) >>> 0;
  }
  h[0] = a;
  h[1] = b;
}

function float32Words(values: ArrayLike<number>): Uint32Array {
  const f = values instanceof Float32Array ? values : Float32Array.from(values as ArrayLike<number>);
  return new Uint32Array(f.buffer, f.byteOffset, f.length);
}

/**
 * The key for one bake: everything its output depends on. `params` must
 * include every option and constant the bake reads (samples, maxDist,
 * strength, seed, floor, ray epsilon).
 */
export function aoKey(
  position: ArrayLike<number>,
  normal: ArrayLike<number>,
  index: ArrayLike<number> | null,
  params: number[],
): string {
  const h: [number, number] = [0x811c9dc5, 0x2f1a7c3b];
  hashWords(float32Words(position), h);
  hashWords(float32Words(normal), h);
  if (index) hashWords(Uint32Array.from(index as ArrayLike<number>), h);
  hashWords(float32Words(params), h);
  const count = Math.floor(position.length / 3);
  return `${count.toString(36)}-${h[0].toString(16).padStart(8, '0')}${h[1].toString(16).padStart(8, '0')}`;
}

export function encodeAO(factors: ArrayLike<number>): string {
  let text = '';
  for (let i = 0; i < factors.length; i++) {
    const q = Math.round(Math.min(1, Math.max(0, factors[i])) * 65535);
    text += String.fromCharCode(q & 0xff, q >>> 8);
  }
  return btoa(text);
}

export function decodeAO(encoded: string): Float64Array {
  const text = atob(encoded);
  const out = new Float64Array(text.length >>> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = (text.charCodeAt(i * 2) | (text.charCodeAt(i * 2 + 1) << 8)) / 65535;
  }
  return out;
}

/** Stored factors for a key, or null to bake live. */
export function storedAO(key: string, count: number): Float64Array | null {
  const encoded = STORED_AO[key];
  if (encoded === undefined) return null;
  const factors = decodeAO(encoded);
  return factors.length === count ? factors : null;
}

/**
 * Test-only: while a recorder is set, every bake runs live (the table is
 * bypassed) and reports its key and factors, which is how the table is made
 * and checked.
 */
export type AORecorder = (key: string, factors: Float64Array) => void;
let recorder: AORecorder | null = null;
export function setAORecorder(next: AORecorder | null): void {
  recorder = next;
}
export function aoRecorder(): AORecorder | null {
  return recorder;
}

/** How many bakes have run the ray caster since load (the table's misses). */
let liveBakes = 0;
export function countLiveBake(): void {
  liveBakes++;
}
export function liveBakeCount(): number {
  return liveBakes;
}
