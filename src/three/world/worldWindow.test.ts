/**
 * The streaming window and the deferred boot (task 262).
 *
 * RoadStage's constructor builds only the chunks within BOOT_NEAR_RADIUS of
 * the bard and lets later updates fill the rest, one per call. These pin the
 * pure halves of that: the window itself, the fill order, and that the
 * deferred boot ends on exactly the chunk set the old eager boot built.
 */
import { describe, expect, it } from 'vitest';
import { BOOT_NEAR_RADIUS, CHUNK_LENGTH, chunkWindow, nextMissingChunk } from './WorldStreamer';

const ROAD_M = 2400;

/** Replays WorldStreamer.update's deferred boot plus N later fills. */
function deferredBoot(centre: number, ahead: number, behind: number): { loaded: Set<number>; order: number[] } {
  const window = chunkWindow(centre, ahead, behind, ROAD_M);
  const loaded = new Set(window.filter((i) => Math.abs(i - centre) <= BOOT_NEAR_RADIUS));
  const order: number[] = [];
  for (let n = 0; n < 50; n++) {
    const next = nextMissingChunk(window, (i) => loaded.has(i), centre);
    if (next === undefined) break;
    loaded.add(next);
    order.push(next);
  }
  return { loaded, order };
}

describe('chunkWindow', () => {
  it('spans behind..ahead around the centre', () => {
    expect(chunkWindow(10, 7, 3, ROAD_M)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('clips at the trailhead and one chunk past the road end', () => {
    expect(chunkWindow(0, 7, 3, ROAD_M)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const lastIndex = Math.floor((ROAD_M + CHUNK_LENGTH) / CHUNK_LENGTH);
    const end = chunkWindow(lastIndex, 7, 3, ROAD_M);
    expect(Math.max(...end)).toBe(lastIndex);
  });
});

describe('deferred boot', () => {
  for (const [ahead, behind] of [
    [7, 3],
    [5, 2],
  ]) {
    for (const centre of [0, 1, 6, 20]) {
      it(`reaches the eager window (ahead ${ahead}, behind ${behind}, centre ${centre})`, () => {
        const eager = chunkWindow(centre, ahead, behind, ROAD_M);
        const { loaded, order } = deferredBoot(centre, ahead, behind);
        expect([...loaded].sort((a, b) => a - b)).toEqual(eager);
        // One chunk per later update: the fill takes exactly as many calls
        // as there were chunks left out, no more.
        const near = eager.filter((i) => Math.abs(i - centre) <= BOOT_NEAR_RADIUS).length;
        expect(order.length).toBe(eager.length - near);
      });
    }
  }

  it('builds at most three chunks before the first frame', () => {
    const window = chunkWindow(10, 7, 3, ROAD_M);
    expect(window.filter((i) => Math.abs(i - 10) <= BOOT_NEAR_RADIUS).length).toBeLessThanOrEqual(3);
  });

  it('fills nearest first, ahead before behind at equal distance', () => {
    const { order } = deferredBoot(10, 7, 3);
    expect(order).toEqual([12, 8, 13, 7, 14, 15, 16, 17]);
  });
});
