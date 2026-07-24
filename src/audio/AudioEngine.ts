import { beatIntervalMs } from '../core/beats';
import { generateBaseLoopSchedule } from './baseLoop';
import { isLayerActive } from './layering';
import { AudioManifest, LoopLayer } from './manifest';

const LAYER_FADE_SECONDS = 0.6;

/**
 * Thin Web Audio wrapper around the procedural base loop and its
 * additional instrument layers. Schedules notes for every layer on the
 * AudioContext's own sample-accurate clock in batches — `start` schedules
 * the first batch, `extend` schedules further batches as the caller's
 * beat schedule grows (ROADMAP task 13 — unbounded schedule), continuing
 * the same tempo/index sequence so the pattern cycle never resets. Each
 * layer plays through its own `GainNode`, created once in `start`, so
 * `setMeterRatio` can fade extra layers in/out (ROADMAP task 8) without
 * touching the base loop or re-scheduling notes.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private started = false;
  private layerGains = new Map<string, GainNode>();
  private layerActive = new Map<string, boolean>();
  private startAt = 0;
  private bpm = 0;
  private noteIndexOffset = 0;
  private masterGain: GainNode | null = null;
  private muted = false;

  constructor(private manifest: AudioManifest) {}

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
   * Starts the base loop and all manifest layers. Must be called from a
   * user-gesture handler (tap/keydown) — browsers block autoplay otherwise.
   * No-ops after the first call. `biomeId` selects each layer's
   * `patternByBiome` override, if any.
   *
   * `nowMs` is the visual beat schedule's elapsed game time at the moment of
   * this first gesture (`RoadScene`'s `nowMs`, not real wall-clock time).
   * The visual schedule's phase-zero is scene creation, but a player never
   * taps at exactly game time 0 — there's always some reaction delay before
   * their first tap. Anchoring `startAt` to `nowMs` in the past (rather than
   * always "now") keeps the backing loop's beat notes in phase with the
   * markers crossing the hit line instead of restarting the loop's phase
   * fresh at whatever moment the player happened to first tap.
   */
  start(bpm: number, count: number, biomeId: string, nowMs: number): void {
    if (this.started) return;
    this.started = true;
    this.bpm = bpm;

    const ctx = this.ensureContext();
    this.startAt = ctx.currentTime + 0.05 - nowMs / 1000;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(ctx.destination);

    this.createLayerGain(ctx, this.manifest.baseLoop, true);
    for (const layer of this.manifest.layers) {
      this.createLayerGain(ctx, layer, isLayerActive(0, layer));
    }

    // Notes already earlier than `nowMs` correspond to beats that have
    // already scrolled past the hit line — skip them so `start` doesn't
    // burst-play a backlog of "already happened" notes all at once.
    this.scheduleAllLayers(ctx, count, 0, biomeId, nowMs);
    this.noteIndexOffset = count;
  }

  /** Schedules the next `count` beats' worth of notes, continuing seamlessly from the last batch. No-ops until `start` has run. `biomeId` picks the pattern each layer plays for this batch (ROADMAP task 16). */
  extend(count: number, biomeId: string): void {
    if (!this.started || !this.context) return;
    const startTimeMs = this.noteIndexOffset * beatIntervalMs(this.bpm);
    this.scheduleAllLayers(this.context, count, startTimeMs, biomeId);
    this.noteIndexOffset += count;
  }

  private scheduleAllLayers(
    ctx: AudioContext,
    count: number,
    startTimeMs: number,
    biomeId: string,
    minTimeMs = 0
  ): void {
    this.scheduleLayerNotes(ctx, this.manifest.baseLoop, count, startTimeMs, biomeId, minTimeMs);
    for (const layer of this.manifest.layers) {
      this.scheduleLayerNotes(ctx, layer, count, startTimeMs, biomeId, minTimeMs);
    }
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

  private scheduleLayerNotes(
    ctx: AudioContext,
    layer: LoopLayer,
    count: number,
    startTimeMs: number,
    biomeId: string,
    minTimeMs = 0
  ): void {
    const layerGain = this.layerGains.get(layer.id);
    if (!layerGain) return;

    const schedule = generateBaseLoopSchedule(
      this.bpm,
      count,
      this.manifest.rootFrequencyHz,
      layer,
      startTimeMs,
      this.noteIndexOffset,
      biomeId
    );
    for (const note of schedule) {
      if (note.timeMs < minTimeMs) continue;
      this.playNote(ctx, layerGain, layer, this.startAt + note.timeMs / 1000, note.frequencyHz, note.durationMs / 1000);
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
