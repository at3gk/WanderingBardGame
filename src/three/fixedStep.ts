/**
 * The fixed-timestep accumulator that decouples simulation time from the
 * browser's actual `requestAnimationFrame` cadence (task 173: "the beat
 * clock must stay honest at 30fps").
 *
 * `App.ts`'s frame loop has always fed `Stage.update()` a constant
 * `FIXED_STEP_MS / 1000` — never the raw, frame-rate-dependent delta — but
 * that guarantee lived only inside `frame()`'s own `while` loop, which
 * touches a live `WebGLRenderer` and so cannot run under this project's
 * Node-environment `vitest` config (see `vitest.config.ts`; there is
 * deliberately no `App.test.ts`, the same reason `SongNotes`'s canvas code
 * has none). Pulled out here as pure arithmetic, the actual claim — that a
 * slow, irregular sequence of real frame gaps still advances simulated time
 * at the same rate as the wall clock, not the frame count — becomes
 * something `fixedStep.test.ts` can assert directly, at a real 30fps
 * cadence, without a renderer.
 */

/** Simulated milliseconds per fixed step (60 Hz). `Stage.update()`'s `dt`. */
export const FIXED_STEP_MS = 1000 / 60;

/**
 * If the tab is backgrounded or the main thread stalls, don't try to catch
 * up on minutes of simulation at once — that spikes a frame to seconds and
 * on a rhythm game it would fire every missed beat in one burst. Clamp and
 * let the accumulated time go.
 */
export const MAX_CATCHUP_MS = 250;

export interface FixedStepResult {
  /** How many `FIXED_STEP_MS` steps `frame()` should run this callback. */
  steps: number;
  /** Leftover time below one step, carried into the next callback. */
  accumulatorMs: number;
}

/**
 * Given the accumulator carried from the previous callback and how long
 * (real, wall-clock) the last frame actually took, decide how many fixed
 * steps to run now.
 *
 * This is the whole mechanism that makes a slow frame rate run the
 * simulation *more times per callback* rather than *once, more slowly*: at
 * a steady 30fps (~33.3ms real frames) this returns 2 steps almost every
 * call, so two 16.7ms fixed steps of game logic run per callback and the
 * cumulative simulated time still tracks the cumulative real time — the
 * note ribbon and the hit judging never find out the display is at half
 * its usual rate. Above `maxCatchupMs` of accumulated real time (a
 * backgrounded tab, a long GC pause), the excess is dropped rather than
 * simulated in one burst; the ratio holds up to that cap and gives way
 * cleanly, not silently, past it.
 */
export function computeFixedSteps(
  accumulatorMs: number,
  frameDtMs: number,
  fixedStepMs: number = FIXED_STEP_MS,
  maxCatchupMs: number = MAX_CATCHUP_MS,
): FixedStepResult {
  let acc = Math.min(accumulatorMs + frameDtMs, maxCatchupMs);
  let steps = 0;
  while (acc >= fixedStepMs) {
    acc -= fixedStepMs;
    steps++;
  }
  return { steps, accumulatorMs: acc };
}
