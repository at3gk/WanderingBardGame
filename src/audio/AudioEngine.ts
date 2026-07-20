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

  /** Starts the base loop and all manifest layers. Must be called from a user-gesture handler (tap/keydown) — browsers block autoplay otherwise. No-ops after the first call. `biomeId` selects each layer's `patternByBiome` override, if any. */
  start(bpm: number, count: number, biomeId: string): void {
    if (this.started) return;
    this.started = true;
    this.bpm = bpm;

    const ctx = this.ensureContext();
    this.startAt = ctx.currentTime + 0.05;

    this.createLayerGain(ctx, this.manifest.baseLoop, true);
    for (const layer of this.manifest.layers) {
      this.createLayerGain(ctx, layer, isLayerActive(0, layer));
    }

    this.scheduleAllLayers(ctx, count, 0, biomeId);
    this.noteIndexOffset = count;
  }

  /** Schedules the next `count` beats' worth of notes, continuing seamlessly from the last batch. No-ops until `start` has run. `biomeId` picks the pattern each layer plays for this batch (ROADMAP task 16). */
  extend(count: number, biomeId: string): void {
    if (!this.started || !this.context) return;
    const startTimeMs = this.noteIndexOffset * beatIntervalMs(this.bpm);
    this.scheduleAllLayers(this.context, count, startTimeMs, biomeId);
    this.noteIndexOffset += count;
  }

  private scheduleAllLayers(ctx: AudioContext, count: number, startTimeMs: number, biomeId: string): void {
    this.scheduleLayerNotes(ctx, this.manifest.baseLoop, count, startTimeMs, biomeId);
    for (const layer of this.manifest.layers) {
      this.scheduleLayerNotes(ctx, layer, count, startTimeMs, biomeId);
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
    const master = ctx.createGain();
    master.gain.value = startActive ? 1 : 0;
    master.connect(ctx.destination);
    this.layerGains.set(layer.id, master);
    this.layerActive.set(layer.id, startActive);
  }

  private scheduleLayerNotes(
    ctx: AudioContext,
    layer: LoopLayer,
    count: number,
    startTimeMs: number,
    biomeId: string
  ): void {
    const master = this.layerGains.get(layer.id);
    if (!master) return;

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
      this.playNote(ctx, master, layer, this.startAt + note.timeMs / 1000, note.frequencyHz, note.durationMs / 1000);
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
