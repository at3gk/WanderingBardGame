/**
 * The letter-reveal schedule for one scheduled tune — the bridge between
 * the scaffold (which knows how well each staff position is known) and the
 * staff renderer (which needs one number per note: how many milliseconds
 * before the barline its letter becomes readable).
 *
 * This is the moment the learning model stops being decorative: it has
 * been complete and tested since v0.4, but until this bridge nothing in
 * the live game asked it anything — every letter simply printed at spawn.
 * The wiring is deliberately computed at schedule time, once per tune,
 * because the model's own contract says display support is derived per
 * note and never written back (`displaySupport`); what changes mid-tune is
 * handled by the answer rule instead (a struck or missed note always shows
 * its letter — the renderer owns that).
 *
 * The kindness default falls out of the arithmetic rather than being a
 * special case: a brand-new scaffold holds every position at full support,
 * full support's lead is the whole flight, so a new player's staff is
 * byte-identical to the old always-labelled one. Fading only ever begins
 * where strength has been earned.
 */

import {
  displaySupport,
  leadMsFor,
  supportFor,
  type ScaffoldState,
} from './scaffold';

export interface TuneContext {
  /** The meter is sagging as this tune is scheduled — one extra band of help. */
  struggling: boolean;
  /** The player is plainly lost — full help, whatever the model says. */
  lost: boolean;
}

/**
 * One reveal lead per beat, in flight milliseconds before the hit.
 *
 * `steps` carries the staff step of each beat in schedule order, or null
 * for a rest (rests carry no letter; they get the full lead so nothing
 * downstream has to special-case them). `notesPerPass` is the song's own
 * note count, so a tune expanded into several passes labels the first
 * sighting of each position *per pass* — these songs are built of exact
 * repeats, and the teacher points at the note once each time through.
 */
export function revealLeads(
  scaffold: ScaffoldState,
  steps: ReadonlyArray<number | null>,
  notesPerPass: number,
  ctx: TuneContext,
): number[] {
  const per = notesPerPass > 0 ? Math.floor(notesPerPass) : steps.length;
  const leads: number[] = [];
  let seen = new Set<number>();
  for (let i = 0; i < steps.length; i++) {
    if (per > 0 && i % per === 0) seen = new Set<number>();
    const step = steps[i];
    if (step === null || !Number.isFinite(step)) {
      leads.push(leadMsFor(4));
      continue;
    }
    const firstInPass = !seen.has(step);
    seen.add(step);
    const support = displaySupport(supportFor(scaffold, step), {
      firstInPass,
      struggling: ctx.struggling,
      lost: ctx.lost,
    });
    leads.push(leadMsFor(support));
  }
  return leads;
}
