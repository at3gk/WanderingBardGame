/**
 * The multi-touch/palm-rejection guard `RoadStage.onPointerDown` has always
 * applied inline (ROADMAP task 175, `docs/research/mobile-friendly.md`
 * finding 4: "a second thumb or a resting palm costs a player nothing").
 * The check itself lived only inside a `PointerEvent` listener — DOM-
 * dependent, so it could never run under this project's Node-environment
 * `vitest` config (the same reason `RoadStage.ts` has no dedicated test
 * file). Pulled out here as a pure predicate, the same split `fixedStep.ts`
 * gave the frame accumulator and `audioSession.ts` gave the mute-switch fix,
 * so the claim itself — not just the one-line call site — is something
 * `inputGesture.test.ts` can assert directly.
 */

/**
 * Whether a pointer event is the single contact a tap should register for,
 * rather than a second finger landing mid-tune (a hand shifting grip, a
 * resting palm, a stray thumb).
 *
 * `PointerEvent.isPrimary` is the browser's own answer to "is this the
 * first active contact of its type" — `false` for every contact after the
 * first in a multi-touch gesture. A real single-touch tap, a mouse click,
 * and a pen input are always `isPrimary: true`; only a synthetic event that
 * never sets the field at all reads `undefined`, which is treated as
 * primary here so a plain constructed event (this file's own tests, or any
 * caller that doesn't bother setting a field with only one real value in a
 * single-touch scene) is not mistaken for a second contact.
 */
export function isPrimaryContact(event: { isPrimary?: boolean }): boolean {
  return event.isPrimary !== false;
}
