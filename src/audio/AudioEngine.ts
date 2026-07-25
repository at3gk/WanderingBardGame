import { SongBeat } from '../core/song';
import { semitoneToFrequency } from './baseLoop';
import { isLayerActive } from './layering';
import { AudioManifest, LoopLayer } from './manifest';

const LAYER_FADE_SECONDS = 0.6;

/**
 * Thin Web Audio wrapper that performs whatever song the scene is walking
 * through. Notes come in already placed on the timeline (`SongBeat`s from
 * `core/song.ts`) — the same objects the beat markers are drawn from, so
 * what the player sees on the staff and what they hear are one schedule,
 * not two that must be kept in sync (ROADMAP task 46; this replaced the
 * old per-biome pattern plumbing and its batch-quantization caveat).
 *
 * Each manifest layer plays the same melody transposed by its own
 * `semitoneOffset` through its own `GainNode`, so `setMeterRatio` can fade
 * the extra voices in and out (ROADMAP task 8) without rescheduling.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private started = false;
  private layerGains = new Map<string, GainNode>();
  private layerActive = new Map<string, boolean>();
  private startAt = 0;
  private masterGain: GainNode | null = null;
  private muted = false;

  constructor(private manifest: AudioManifest) {}

  /** True once `start` has run — the scene uses this to know whether to schedule further passes. */
  get isStarted(): boolean {
    return this.started;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  /**
   * Re-resumes the AudioContext if the browser suspended it (mobile
   * browsers do this whenever the tab is backgrounded — app switch, screen
   * lock, an incoming call). Without this, audio stays silent forever after
   * the player returns to the tab, even though gameplay keeps running.
   * Safe to call anytime, including before `start()` (no-ops until a
   * context exists) and while already running (no-ops).
   */
  resume(): void {
    if (!this.context || this.context.state !== 'suspended') return;
    void this.context.resume();
  }

  /** True if `setMuted(true)` was called (or is pending a not-yet-started context). */
  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Mutes/unmutes all layers via one shared gain node, independent of each
   * layer's own meter-driven fade (ROADMAP task 20) — a mute toggle doesn't
   * need to know or reset per-layer active state. Safe to call before
   * `start()`; the muted state is applied once the master gain node exists.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.05);
  }

  /**
   * Starts the performance. Must be called from a user-gesture handler
   * (tap/keydown) — browsers block autoplay otherwise. No-ops after the
   * first call.
   *
   * `nowMs` is the visual schedule's elapsed game time at the moment of the
   * first gesture. The visual schedule's phase-zero is scene creation, but
   * a player never taps at exactly game time 0, so anchoring `startAt` to
   * `nowMs` in the past (rather than "now") keeps the performance in phase
   * with the notes crossing the hit line instead of restarting the song at
   * whatever moment the player happened to first tap.
   */
  start(notes: SongBeat[], nowMs: number): void {
    if (this.started) return;
    this.started = true;

    const ctx = this.ensureContext();
    this.startAt = ctx.currentTime + 0.05 - nowMs / 1000;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(ctx.destination);

    this.createLayerGain(ctx, this.manifest.baseLoop, true);
    for (const layer of this.manifest.layers) {
      this.createLayerGain(ctx, layer, isLayerActive(0, layer));
    }

    // Notes earlier than `nowMs` belong to beats that already scrolled past
    // the hit line — skip them so `start` doesn't burst-play a backlog.
    this.schedule(notes, nowMs);
  }

  /**
   * Schedules a run of song notes on every layer. No-ops until `start` has
   * run. `minTimeMs` drops notes already in the past (only used by `start`).
   */
  schedule(notes: SongBeat[], minTimeMs = 0): void {
    const ctx = this.context;
    if (!this.started || !ctx) return;
    this.scheduleLayer(ctx, this.manifest.baseLoop, notes, minTimeMs);
    for (const layer of this.manifest.layers) {
      this.scheduleLayer(ctx, layer, notes, minTimeMs);
    }
  }

  /**
   * The player's own note (ROADMAP task 33): a hit immediately sounds the
   * note that was written on the staff, an octave up and a little louder —
   * tapping isn't triggering a sound effect, it's performing the melody's
   * top voice, so a good run *sounds* like the player carrying the tune.
   * Misses stay silent (DESIGN.md: a missed beat lets a note drop out of
   * the tune; it doesn't add a buzzer). Routes through the master gain, so
   * mute silences it too.
   */
  pluck(semitone: number): void {
    if (!this.started || !this.context || !this.masterGain) return;
    const layer = this.manifest.baseLoop;
    const frequencyHz = semitoneToFrequency(this.manifest.rootFrequencyHz, semitone + 12);
    const voiced: LoopLayer = { ...layer, gain: layer.gain * 1.6 };
    this.playNote(this.context, this.masterGain, voiced, this.context.currentTime, frequencyHz, 0.24);
  }

  /** Fades additional layers in/out as the song meter (0–1 fraction of max) crosses each layer's `meterThreshold` (ROADMAP task 8). No-ops until `start` has run. */
  setMeterRatio(meterRatio: number): void {
    const ctx = this.context;
    if (!ctx) return;

    for (const layer of this.manifest.layers) {
      const shouldBeActive = isLayerActive(meterRatio, layer);
      if (shouldBeActive === this.layerActive.get(layer.id)) continue;

      const gainNode = this.layerGains.get(layer.id);
      if (!gainNode) continue;

      this.layerActive.set(layer.id, shouldBeActive);
      const now = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(shouldBeActive ? 1 : 0, now + LAYER_FADE_SECONDS);
    }
  }

  private createLayerGain(ctx: AudioContext, layer: LoopLayer, startActive: boolean): void {
    const layerGain = ctx.createGain();
    layerGain.gain.value = startActive ? 1 : 0;
    layerGain.connect(this.masterGain ?? ctx.destination);
    this.layerGains.set(layer.id, layerGain);
    this.layerActive.set(layer.id, startActive);
  }

  /**
   * One layer's take on the melody: same notes, transposed by the layer's
   * `semitoneOffset`, each note sounding for a slice of its *written*
   * length — so a half note is audibly twice a quarter, which is the whole
   * point of putting note values on the staff.
   */
  private scheduleLayer(ctx: AudioContext, layer: LoopLayer, notes: SongBeat[], minTimeMs: number): void {
    const layerGain = this.layerGains.get(layer.id);
    if (!layerGain) return;

    for (const note of notes) {
      if (note.hitTimeMs < minTimeMs) continue;
      const frequencyHz = semitoneToFrequency(this.manifest.rootFrequencyHz, note.semitone + layer.semitoneOffset);
      const durationSec = (layer.noteDurationMs * note.beats) / 1000;
      this.playNote(ctx, layerGain, layer, this.startAt + note.hitTimeMs / 1000, frequencyHz, durationSec);
    }
  }

  private playNote(
    ctx: AudioContext,
    destination: GainNode,
    layer: LoopLayer,
    whenSec: number,
    frequencyHz: number,
    durationSec: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = layer.waveform;
    osc.frequency.value = frequencyHz;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, whenSec);
    envelope.gain.linearRampToValueAtTime(layer.gain, whenSec + 0.01);
    envelope.gain.linearRampToValueAtTime(0, whenSec + durationSec);

    osc.connect(envelope).connect(destination);
    osc.start(whenSec);
    osc.stop(whenSec + durationSec + 0.02);
  }
}
