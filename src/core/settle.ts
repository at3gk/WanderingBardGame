/**
 * Wait for something, but never forever (task 263).
 *
 * The boot waits for the shader warm-up before it starts the loop, and a
 * warm-up is exactly the kind of thing that can hang (a driver that never
 * reports a program ready) or reject (a context lost mid-compile). Neither
 * may keep the road from opening: whatever happens, this resolves, at the
 * latest after `ms`, and tells the caller which way it went.
 */

export type Settled = 'ready' | 'timeout' | 'failed';

export function settleWithin(
  work: () => PromiseLike<unknown>,
  ms: number,
  wait: (fn: () => void, ms: number) => unknown = setTimeout,
): Promise<Settled> {
  return new Promise<Settled>((resolve) => {
    let done = false;
    const finish = (how: Settled) => {
      if (done) return;
      done = true;
      resolve(how);
    };
    wait(() => finish('timeout'), ms);
    try {
      Promise.resolve(work()).then(
        () => finish('ready'),
        () => finish('failed'),
      );
    } catch {
      finish('failed');
    }
  });
}
