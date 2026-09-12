import { describe, expect, it } from 'vitest';
import { computeFixedSteps, FIXED_STEP_MS, MAX_CATCHUP_MS } from './fixedStep';

/**
 * Task 173's testable slice: prove the fixed-step accumulator keeps
 * simulated time locked to real (wall-clock) time regardless of how often
 * `requestAnimationFrame` actually fires, which is the property "the beat
 * clock must stay honest at 30fps" (WebKit 168837, Low Power Mode) depends
 * on. A regression here — someone swapping the accumulator for "just pass
 * the raw frame delta as dt" — would make the note ribbon and hit judging
 * run at half speed on a throttled device; that is exactly the bug class
 * this guards.
 */

/** Run a whole session through the accumulator and total the simulated ms. */
function simulate(frameDtsMs: number[]): { totalSteps: number; totalSimMs: number } {
  let accumulatorMs = 0;
  let totalSteps = 0;
  for (const frameDtMs of frameDtsMs) {
    const result = computeFixedSteps(accumulatorMs, frameDtMs);
    accumulatorMs = result.accumulatorMs;
    totalSteps += result.steps;
  }
  return { totalSteps, totalSimMs: totalSteps * FIXED_STEP_MS };
}

describe('computeFixedSteps', () => {
  it('runs exactly one step per callback at a steady 60fps', () => {
    const frames = Array(120).fill(FIXED_STEP_MS);
    const { totalSteps } = simulate(frames);
    expect(totalSteps).toBe(120);
  });

  it('runs about two steps per callback at a steady 30fps — the Low Power Mode case', () => {
    // 30fps real frames are twice as long, so each callback should on
    // average advance the simulation by two fixed steps, not one step run
    // "slower". Over many frames the count converges on exactly 2x.
    const thirtyFpsMs = 1000 / 30;
    const frames = Array(300).fill(thirtyFpsMs);
    const { totalSteps } = simulate(frames);
    expect(totalSteps).toBe(600);
  });

  it('keeps simulated time within one step of real elapsed time at any steady frame rate', () => {
    for (const fps of [24, 27, 30, 45, 48, 55, 60, 90, 120, 144]) {
      const frameDtMs = 1000 / fps;
      const frameCount = 500;
      const { totalSimMs } = simulate(Array(frameCount).fill(frameDtMs));
      const realElapsedMs = frameDtMs * frameCount;
      expect(Math.abs(totalSimMs - realElapsedMs), `at ${fps}fps`).toBeLessThan(FIXED_STEP_MS);
    }
  });

  it('tracks real elapsed time under an irregular, stalling frame sequence', () => {
    // A phone that isn't holding any one rate: some 60fps frames, some
    // 30fps ones, a couple of longer hitches short of the catch-up cap.
    const frames = [16.7, 16.7, 33.3, 16.7, 50, 33.3, 16.7, 16.7, 200, 16.7, 33.3];
    const realElapsedMs = frames.reduce((a, b) => a + b, 0);
    const { totalSimMs } = simulate(frames);
    expect(Math.abs(totalSimMs - realElapsedMs)).toBeLessThan(FIXED_STEP_MS);
  });

  it('caps catch-up so a long stall does not simulate the whole gap at once', () => {
    // A backgrounded tab or a multi-second GC pause: don't fire hundreds of
    // beats in a single callback, drop the excess instead (the comment in
    // App.ts explains why). MAX_CATCHUP_MS / FIXED_STEP_MS is exactly 15,
    // but computed via float division rather than accumulator.ts's own
    // repeated subtraction; asserted with a tolerance so this test doesn't
    // itself trip over the fp boundary it is checking.
    const result = computeFixedSteps(0, 5000);
    const expectedSteps = Math.round(MAX_CATCHUP_MS / FIXED_STEP_MS);
    expect(result.steps).toBe(expectedSteps);
    expect(result.accumulatorMs).toBeLessThan(FIXED_STEP_MS);
    expect(result.accumulatorMs).toBeGreaterThanOrEqual(0);
  });

  it('carries a sub-step remainder into the next callback rather than dropping it', () => {
    // A 25ms frame is one full step (16.7ms) plus a remainder; that
    // remainder must still count next callback, or simulated time would
    // quietly run slow.
    const first = computeFixedSteps(0, 25);
    expect(first.steps).toBe(1);
    expect(first.accumulatorMs).toBeCloseTo(25 - FIXED_STEP_MS, 5);

    // 8.33ms carried + 30ms new = 38.3ms, comfortably two full steps (kept
    // clear of the 2-step boundary at 33.3ms, which is a known fp edge —
    // see the catch-up test above).
    const second = computeFixedSteps(first.accumulatorMs, 30);
    expect(second.steps).toBe(2);
  });

  it('never returns a step for a zero-length frame', () => {
    expect(computeFixedSteps(0, 0).steps).toBe(0);
  });

  it('never returns a negative accumulator', () => {
    for (let ms = 0; ms <= 1000; ms += 3.7) {
      expect(computeFixedSteps(0, ms).accumulatorMs).toBeGreaterThanOrEqual(0);
    }
  });
});
