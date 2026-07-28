/**
 * Playing one note on one instrument.
 *
 * `core/instruments.ts` describes six voices as numbers — a partial stack, an
 * ADSR, a detune spread, a lowpass corner, a noise transient, a vibrato. This
 * file is the other half of that bargain: it turns those numbers into a Web
 * Audio node graph and nothing else. It holds no state about the performance,
 * no tempo, no song; the busk scene decides *what* to play and this decides
 * what it sounds like.
 *
 * The split that matters here is between the *plan* and the *graph*. Every
 * decision — which partials survive, how loud each is, where the envelope
 * breakpoints fall, whether there is a transient at all — is made by pure
 * functions that never touch an AudioContext, and `playVoiceNote` is a thin
 * shell that walks the plan and creates nodes. That is not tidiness for its
 * own sake: there is no AudioContext under vitest, so a decision made inside
 * the node-building code is a decision that can never be tested, and voicing
 * arithmetic is exactly the sort of thing that goes quietly wrong.
 *
 * Three correctness rules run through all of it, each learned the hard way in
 * browser audio:
 *
 * 1. **Everything created is stopped and disconnected.** A busking session
 *    triggers notes several times a second for minutes at a time. An
 *    oscillator that is never stopped is never collected, and the tab dies
 *    slowly enough that it looks like a rendering problem. Each source gets a
 *    `stop()` at a known time and the last one to end tears the graph down.
 * 2. **No exponential ramp ever targets zero.** `exponentialRampToValueAtTime`
 *    is the natural shape for a decay and it is undefined at 0 — browsers
 *    variously throw or silently drop the ramp, and a dropped ramp means a
 *    note that never stops sounding. Decays land on `VOICE_SILENCE` and a
 *    `setValueAtTime(0)` finishes the job.
 * 3. **All times are relative to the caller's `whenSec`,** which is an
 *    `AudioContext.currentTime`. Nothing here reads `Date.now()` or
 *    `performance.now()`. The two clocks are driven by different hardware and
 *    drift apart by a measurable amount over a session (see the note in
 *    `AudioEngine.schedule`), and a rhythm game is where that is audible.
 */

import type { InstrumentVoice } from '../core/instruments';

/**
 * The floor an exponential ramp is allowed to reach. Low enough to be
 * inaudible under any sensible master gain, high enough to be a legal
 * exponential target.
 */
export const VOICE_SILENCE = 1e-4;

/**
 * Ceiling on oscillators per note.
 *
 * The hurdy-gurdy has nine partials and a detune spread, which is eighteen
 * oscillators if taken literally; at twenty notes a second with a second of
 * ring that is several hundred live nodes and a phone starts crackling. The
 * cap is spent on the loudest partials, because the quiet top of a stack is
 * the part a listener would not miss.
 */
const DEFAULT_MAX_OSCILLATORS = 12;

/** A pluck with a zero-length attack clicks. Two milliseconds does not. */
const MIN_ATTACK_SEC = 0.002;
const MIN_SEGMENT_SEC = 0.001;
/** Slack between the envelope reaching zero and the source being stopped. */
const STOP_PADDING_SEC = 0.02;
/** How long `cancel` takes to get out of the way. Short, but never a cut. */
const CANCEL_FADE_SEC = 0.03;
/** Length of the shared noise buffer. Long enough that a loop is not a pitch. */
const NOISE_BUFFER_SEC = 2;

export interface PartialPlan {
  frequencyHz: number;
  /** Share of the tonal bus. Across a plan these sum to 1. */
  gain: number;
  /** Chorus offset for this copy of the stack, in cents. */
  detuneCents: number;
}

export type RampShape = 'step' | 'linear' | 'exponential';

/** One breakpoint of the amplitude envelope, in seconds from note start. */
export interface EnvelopePoint {
  timeSec: number;
  /** 0..1. The overall level lives on a separate node. */
  value: number;
  /** How the parameter gets here from the previous point. */
  shape: RampShape;
}

export interface EnvelopePlan {
  points: EnvelopePoint[];
  /** When the envelope has finished, in seconds from note start. */
  endSec: number;
}

export interface TransientPlan {
  /** Level of the noise burst relative to a full-scale note. */
  gain: number;
  durationSec: number;
  /** Bandpass centre for the burst. */
  centreHz: number;
  q: number;
}

export interface VibratoPlan {
  rateHz: number;
  depthCents: number;
}

export interface VoicePlan {
  partials: PartialPlan[];
  envelope: EnvelopePlan;
  /** Null when the voice has no noise in it at all. */
  transient: TransientPlan | null;
  vibrato: VibratoPlan | null;
  cutoffHz: number;
  /** How much of the note is pitched, once the transient has taken its share. */
  tonalGain: number;
  /** Final output level for the whole note. */
  gain: number;
  /** Seconds from note start until everything has fallen silent. */
  endSec: number;
}

export interface VoiceNoteOptions {
  /** How long the note is held before its release begins. */
  holdSec?: number;
  /** Peak output level. */
  gain?: number;
  maxOscillators?: number;
  /** Partials above this are dropped as inaudible or aliasing. */
  nyquistHz?: number;
}

/** A note that has been handed to the audio clock and can still be taken back. */
export interface ScheduledNote {
  /** Audio-clock time the note falls silent. */
  endSec: number;
  /**
   * Fade the note out early. Used when a scene tears down mid-phrase — a hard
   * stop is a click, and this game does not click.
   */
  cancel(atSec: number): void;
}

/** Total ring of one note left to itself: attack, decay and release. */
export function voiceRingSec(voice: InstrumentVoice): number {
  return (safe(voice.attackMs) + safe(voice.decayMs) + safe(voice.releaseMs)) / 1000;
}

/**
 * Share of a voice's energy sitting on partials that are not whole multiples
 * of the fundamental, 0..1.
 *
 * This is what separates a drum or a bell from a string, and it is derived
 * rather than declared so that adding a seventh instrument cannot forget to
 * label itself. Used by `adaptive.ts` to decide how much of the backing needs
 * to carry a tune the instrument itself cannot.
 */
export function voiceInharmonicity(voice: InstrumentVoice): number {
  let total = 0;
  let off = 0;
  for (const [ratio, amplitude] of voice.partials) {
    const amp = Math.max(0, safe(amplitude));
    total += amp;
    // A tenth of a semitone is about 0.006 in ratio at the octave; anything
    // inside that reads as a harmonic that is slightly out, not as a mode.
    if (Math.abs(ratio - Math.round(ratio)) > 0.02) off += amp;
  }
  return total > 0 ? off / total : 0;
}

/**
 * How long a note of this voice wants to sound when nobody says otherwise.
 *
 * Callers with a written note length should pass their own `holdSec` — the
 * songbook's half notes are twice its quarters and that has to survive into
 * the sound. This is the fallback for one-off flourishes.
 */
export function defaultHoldSec(voice: InstrumentVoice): number {
  const attackSec = safe(voice.attackMs) / 1000;
  const decaySec = safe(voice.decayMs) / 1000;
  // A struck or plucked voice has already died away by the end of its decay,
  // so holding it any longer changes nothing; a sustained one has to be told
  // when to stop, and a quarter second is a comfortable spoken syllable.
  return voice.sustain > 0 ? attackSec + decaySec + 0.25 : attackSec + decaySec;
}

/**
 * Which oscillators to run, at what frequency and level.
 *
 * Gains are normalised to sum to exactly 1 so that a nine-partial hurdy-gurdy
 * and a four-partial drum arrive at the mixer at comparable loudness. Without
 * that, `instruments.ts`'s promise that amplitudes are relative would quietly
 * become "the richer instruments are louder", and every unlock would need its
 * own volume trim.
 */
export function planPartials(
  voice: InstrumentVoice,
  frequencyHz: number,
  options: { maxOscillators?: number; nyquistHz?: number } = {}
): PartialPlan[] {
  const maxOscillators = Math.max(1, Math.floor(options.maxOscillators ?? DEFAULT_MAX_OSCILLATORS));
  const nyquistHz = options.nyquistHz ?? 20000;
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return [];

  const chorus = safe(voice.detuneCents) > 0;
  const offsets = chorus ? [-voice.detuneCents / 2, voice.detuneCents / 2] : [0];
  const perStack = Math.max(1, Math.floor(maxOscillators / offsets.length));

  const usable = voice.partials
    .filter(([ratio, amplitude]) => ratio > 0 && amplitude > 0 && ratio * frequencyHz < nyquistHz)
    // Loudest first, so the cap spends its budget where it is heard, then
    // back into ascending order because a stack is easier to read that way.
    .slice()
    .sort((a, b) => b[1] - a[1])
    .slice(0, perStack)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  for (const [, amplitude] of usable) total += amplitude;
  if (total <= 0) return [];

  const scale = 1 / (total * offsets.length);
  const plan: PartialPlan[] = [];
  for (const [ratio, amplitude] of usable) {
    for (const detuneCents of offsets) {
      plan.push({ frequencyHz: ratio * frequencyHz, gain: amplitude * scale, detuneCents });
    }
  }
  return plan;
}

/**
 * The amplitude envelope as an ordered list of breakpoints.
 *
 * Emitted as data rather than written straight onto an `AudioParam` because
 * the ordering constraints are the fiddly part and they are worth testing: a
 * note shorter than its own decay has to have that decay *truncated* — with
 * the level it had actually reached carried over — or the automation events
 * arrive out of order and the browser's interpretation stops being anybody's
 * intent.
 *
 * Attack is linear and everything after it is exponential. A linear attack
 * starts from a true zero (no click, and no illegal exponential-from-zero),
 * and an exponential decay is what a struck thing actually does.
 */
export function planEnvelope(voice: InstrumentVoice, holdSec: number): EnvelopePlan {
  const attackSec = Math.max(MIN_ATTACK_SEC, safe(voice.attackMs) / 1000);
  const decaySec = Math.max(MIN_SEGMENT_SEC, safe(voice.decayMs) / 1000);
  const releaseSec = Math.max(MIN_SEGMENT_SEC, safe(voice.releaseMs) / 1000);
  const sustain = clamp01(safe(voice.sustain));

  const attackEndSec = attackSec;
  const releaseStartSec = Math.max(safe(holdSec), attackEndSec);
  const decayFloor = Math.max(sustain, VOICE_SILENCE);
  const decayEndSec = Math.min(attackEndSec + decaySec, releaseStartSec);

  const points: EnvelopePoint[] = [
    { timeSec: 0, value: 0, shape: 'step' },
    { timeSec: attackEndSec, value: 1, shape: 'linear' },
  ];

  // Peak is 1, so an exponential from 1 to `decayFloor` over the decay has
  // value `decayFloor^fraction` part of the way through it.
  let releaseLevel = 1;
  if (decayEndSec > attackEndSec) {
    const fraction = (decayEndSec - attackEndSec) / decaySec;
    releaseLevel = Math.pow(decayFloor, fraction);
    points.push({ timeSec: decayEndSec, value: releaseLevel, shape: 'exponential' });
  }
  if (releaseStartSec > decayEndSec) {
    points.push({ timeSec: releaseStartSec, value: releaseLevel, shape: 'step' });
  }

  const endSec = releaseStartSec + releaseSec;
  points.push({ timeSec: endSec, value: VOICE_SILENCE, shape: 'exponential' });
  points.push({ timeSec: endSec, value: 0, shape: 'step' });

  return { points, endSec };
}

/**
 * The unpitched burst at the start of a note.
 *
 * `instruments.ts` argues that the first thirty milliseconds carry more
 * identity than the spectrum does, so this is not garnish. Its length is
 * taken from the attack where the attack is long — a flute's chiff lasts as
 * long as the breath does — and from the transient amount where it is short,
 * so a drum gets a slap and a harp gets a fingernail.
 */
export function planTransient(
  voice: InstrumentVoice,
  frequencyHz: number,
  nyquistHz = 20000
): TransientPlan | null {
  const amount = clamp01(safe(voice.transient));
  if (amount <= 0) return null;

  const attackSec = safe(voice.attackMs) / 1000;
  const durationSec = clamp(Math.max(attackSec * 1.2, 0.018 + 0.05 * amount), 0.018, 0.16);
  // Centred above the played pitch, because a pick click and a breath chiff
  // both live over the note rather than under it, then held under the voice's
  // own lowpass so the drum's dark corner still governs the drum's slap.
  const ceilingHz = Math.min(safe(voice.cutoffHz) * 1.6, nyquistHz * 0.45);
  const centreHz = clamp(frequencyHz * 3, 320, Math.max(360, ceilingHz));

  return { gain: 0.9 * amount, durationSec, centreHz, q: 0.7 };
}

/** Everything `playVoiceNote` needs, decided without an AudioContext. */
export function planVoice(
  voice: InstrumentVoice,
  frequencyHz: number,
  options: VoiceNoteOptions = {}
): VoicePlan {
  const nyquistHz = options.nyquistHz ?? 20000;
  const holdSec = options.holdSec ?? defaultHoldSec(voice);
  const envelope = planEnvelope(voice, holdSec);
  const transient = planTransient(voice, frequencyHz, nyquistHz);
  const amount = clamp01(safe(voice.transient));

  return {
    partials: planPartials(voice, frequencyHz, {
      maxOscillators: options.maxOscillators,
      nyquistHz,
    }),
    envelope,
    transient,
    // The noise takes its share out of the pitched part rather than being
    // added on top, so a hand drum reads as mostly slap (which it is) and a
    // note does not get louder simply for having a transient.
    tonalGain: 1 - 0.6 * amount,
    vibrato: safe(voice.vibrato[1]) > 0 && safe(voice.vibrato[0]) > 0
      ? { rateHz: voice.vibrato[0], depthCents: voice.vibrato[1] }
      : null,
    cutoffHz: Math.max(80, Math.min(safe(voice.cutoffHz) || 20000, nyquistHz)),
    gain: options.gain ?? 0.2,
    endSec: Math.max(envelope.endSec, transient ? transient.durationSec : 0),
  };
}

/**
 * One buffer of white noise per context, shared by every transient and every
 * ambience bed.
 *
 * Filling a fresh buffer per note is a few thousand `Math.random()` calls in
 * the middle of a frame; at twenty notes a second that is the difference
 * between a smooth walk and a stuttering one. Held in a `WeakMap` so a
 * discarded context takes its buffer with it.
 */
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const existing = noiseBuffers.get(ctx);
  if (existing) return existing;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

/**
 * Write an envelope plan onto an `AudioParam`, offset to `whenSec`.
 *
 * Exported because the ambience grains want the same careful treatment of
 * exponential targets, and there should be exactly one place in this codebase
 * that knows how to avoid ramping to zero.
 */
export function applyEnvelope(param: AudioParam, plan: EnvelopePlan, whenSec: number, scale = 1): void {
  for (let i = 0; i < plan.points.length; i++) {
    const point = plan.points[i];
    const at = whenSec + point.timeSec;
    const value = point.value * scale;
    if (i === 0 || point.shape === 'step') {
      param.setValueAtTime(value, at);
    } else if (point.shape === 'linear') {
      param.linearRampToValueAtTime(value, at);
    } else {
      param.exponentialRampToValueAtTime(Math.max(value, VOICE_SILENCE), at);
    }
  }
}

/**
 * Play one note.
 *
 * `whenSec` is an `AudioContext.currentTime`, not a wall-clock time, and
 * everything in the note is scheduled relative to it. The graph is:
 *
 *     partials -> partial gains -> envelope -> tonal gain ┐
 *     noise -> bandpass -> transient envelope ────────────┴> lowpass -> out
 *
 * with the vibrato LFO wired into every oscillator's `detune`. The transient
 * deliberately bypasses the ADSR: a flute's chiff has to be audible *during*
 * a ninety-five millisecond attack, and putting it behind the attack ramp
 * would erase the one thing that makes the flute a flute.
 */
export function playVoiceNote(
  ctx: AudioContext,
  destination: AudioNode,
  voice: InstrumentVoice,
  frequencyHz: number,
  whenSec: number,
  options: VoiceNoteOptions = {}
): ScheduledNote {
  const plan = planVoice(voice, frequencyHz, { nyquistHz: ctx.sampleRate / 2, ...options });

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];

  const output = ctx.createGain();
  output.gain.value = plan.gain;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = plan.cutoffHz;
  lowpass.Q.value = 0.7;
  lowpass.connect(output).connect(destination);
  nodes.push(output, lowpass);

  if (plan.partials.length > 0) {
    const tonal = ctx.createGain();
    tonal.gain.value = plan.tonalGain;
    const envelope = ctx.createGain();
    envelope.gain.value = 0;
    applyEnvelope(envelope.gain, plan.envelope, whenSec);
    envelope.connect(tonal).connect(lowpass);
    nodes.push(tonal, envelope);

    let vibratoDepth: GainNode | null = null;
    if (plan.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = plan.vibrato.rateHz;
      vibratoDepth = ctx.createGain();
      // One LFO feeding every oscillator's detune, rather than one each: a
      // player's breath moves the whole note together, and separate LFOs
      // would drift out of phase and read as chorus instead of vibrato.
      vibratoDepth.gain.value = plan.vibrato.depthCents;
      lfo.connect(vibratoDepth);
      lfo.start(whenSec);
      sources.push(lfo);
      nodes.push(vibratoDepth);
    }

    for (const partial of plan.partials) {
      const osc = ctx.createOscillator();
      // Sine per partial: the stack *is* the timbre, and starting from a saw
      // or a square would add a second, uncontrolled spectrum on top of the
      // one `instruments.ts` carefully specified.
      osc.type = 'sine';
      osc.frequency.value = partial.frequencyHz;
      osc.detune.value = partial.detuneCents;
      if (vibratoDepth) vibratoDepth.connect(osc.detune);

      const level = ctx.createGain();
      level.gain.value = partial.gain;
      osc.connect(level).connect(envelope);
      osc.start(whenSec);
      sources.push(osc);
      nodes.push(level);
    }
  }

  if (plan.transient) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    // Looped only so that a read position near the end of the buffer cannot
    // run out mid-burst; the burst is far shorter than the buffer.
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = plan.transient.centreHz;
    band.Q.value = plan.transient.q;
    const burst = ctx.createGain();
    burst.gain.setValueAtTime(0, whenSec);
    burst.gain.linearRampToValueAtTime(plan.transient.gain, whenSec + MIN_ATTACK_SEC);
    burst.gain.exponentialRampToValueAtTime(VOICE_SILENCE, whenSec + plan.transient.durationSec);
    burst.gain.setValueAtTime(0, whenSec + plan.transient.durationSec);
    noise.connect(band).connect(burst).connect(lowpass);
    // A different read position every time, so that twenty notes a second do
    // not all play the same slice of noise and add up to a pitched buzz.
    noise.start(whenSec, Math.random() * (NOISE_BUFFER_SEC - plan.transient.durationSec - 0.05));
    sources.push(noise);
    nodes.push(band, burst);
  }

  const endSec = whenSec + plan.endSec;
  const stopSec = endSec + STOP_PADDING_SEC;
  let pending = sources.length;
  const teardown = (): void => {
    pending -= 1;
    if (pending > 0) return;
    for (const node of nodes) node.disconnect();
    for (const source of sources) source.disconnect();
  };
  for (const source of sources) {
    source.onended = teardown;
    source.stop(stopSec);
  }
  // A plan with no partials and no transient (a zero-amplitude voice, or a
  // frequency out of range) creates no sources, so nothing would ever fire
  // `onended` to disconnect the filter and output gain.
  if (sources.length === 0) {
    for (const node of nodes) node.disconnect();
  }

  return {
    endSec,
    cancel(atSec: number): void {
      const from = Math.max(atSec, ctx.currentTime);
      if (from >= endSec) return;
      output.gain.cancelScheduledValues(from);
      output.gain.setValueAtTime(output.gain.value, from);
      output.gain.exponentialRampToValueAtTime(VOICE_SILENCE, from + CANCEL_FADE_SEC);
      output.gain.setValueAtTime(0, from + CANCEL_FADE_SEC);
      for (const source of sources) {
        try {
          source.stop(from + CANCEL_FADE_SEC + STOP_PADDING_SEC);
        } catch {
          // A source that has already ended refuses to be rescheduled, and
          // there is nothing left to silence in that case.
        }
      }
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Non-finite numbers from a malformed voice become zero rather than NaN. */
function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
