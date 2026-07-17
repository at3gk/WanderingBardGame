import { generateBaseLoopSchedule } from './baseLoop';
import { isLayerActive } from './layering';
import { AudioManifest, LoopLayer } from './manifest';

const LAYER_FADE_SECONDS = 0.6;

/**
 * Thin Web Audio wrapper around the procedural base loop and its
 * additional instrument layers. Schedules the whole (bounded) note
 * sequence for every layer up front on the AudioContext's own
 * sample-accurate clock — no JS-side lookahead scheduler needed at this
 * loop length, same bound as the visual beat lane (`BEAT_COUNT` in
 * RoadScene). Each layer plays through its own `GainNode` so
 * `setMeterRatio` can fade extra layers in/out (ROADMAP task 8) without
 * touching the base loop or re-scheduling notes.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private started = false;
  private layerGains = new Map<string, GainNode>();
  private layerActive = new Map<string, boolean>();

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

  /** Starts the base loop and all manifest layers. Must be called from a user-gesture handler (tap/keydown) — browsers block autoplay otherwise. No-ops after the first call. */
  start(bpm: number, count: number): void {
    if (this.started) return;
    this.started = true;

    const ctx = this.ensureContext();
    const startAt = ctx.currentTime + 0.05;

    this.scheduleLayer(ctx, this.manifest.baseLoop, bpm, count, startAt, true);
    for (const layer of this.manifest.layers) {
      this.scheduleLayer(ctx, layer, bpm, count, startAt, isLayerActive(0, layer));
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

  private scheduleLayer(
    ctx: AudioContext,
    layer: LoopLayer,
    bpm: number,
    count: number,
    startAt: number,
    startActive: boolean
  ): void {
    const master = ctx.createGain();
    master.gain.value = startActive ? 1 : 0;
    master.connect(ctx.destination);
    this.layerGains.set(layer.id, master);
    this.layerActive.set(layer.id, startActive);

    const schedule = generateBaseLoopSchedule(bpm, count, this.manifest.rootFrequencyHz, layer);
    for (const note of schedule) {
      this.playNote(ctx, master, layer, startAt + note.timeMs / 1000, note.frequencyHz, note.durationMs / 1000);
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
