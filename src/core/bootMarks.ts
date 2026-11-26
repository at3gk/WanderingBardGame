/**
 * Boot timing marks (task 261).
 *
 * Pillar 1 says the game is playable in under five seconds, and task 259
 * measured ~2.85 s of CPU between the bundle arriving and the road being
 * ready on a throttled phone. These marks say which part of the boot owns
 * that time: `tools/first-tap.mjs` reads them back with
 * `performance.getEntriesByType('mark')` and prints the gap between each
 * mark and the one before it.
 *
 * A mark is a timestamp in the browser's own timeline and nothing else: no
 * network, no storage, no analytics, nothing leaves the page. Every name is
 * prefixed `boot:` so the reader can filter them, and a missing or throwing
 * `performance.mark` (old WebKit, a test runner) is simply skipped.
 */

export const BOOT_MARK_PREFIX = 'boot:';

export function bootMark(name: string): void {
  try {
    globalThis.performance?.mark?.(BOOT_MARK_PREFIX + name);
  } catch {
    // Timing is a diagnostic; it must never be the thing that breaks boot.
  }
}

/** Mark entries as [name, ms] in timeline order, each with its gap from the previous one. */
export function bootSpans(
  marks: ReadonlyArray<{ name: string; startTime: number }>,
): Array<{ name: string; at: number; took: number }> {
  const boot = marks
    .filter((m) => m.name.startsWith(BOOT_MARK_PREFIX))
    .slice()
    .sort((a, b) => a.startTime - b.startTime);
  return boot.map((m, i) => ({
    name: m.name.slice(BOOT_MARK_PREFIX.length),
    at: m.startTime,
    took: m.startTime - (i === 0 ? 0 : boot[i - 1].startTime),
  }));
}
