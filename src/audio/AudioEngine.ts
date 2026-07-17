import { generateBaseLoopSchedule } from './baseLoop';
import { AudioManifest } from './manifest';

/**
 * Thin Web Audio wrapper around the procedural base loop. Schedules the
 * whole (bounded) note sequence up front on the AudioContext's own
 * sample-accurate clock — no JS-side lookahead scheduler needed at this
 * loop length, same bound as the visual beat lane (`BEAT_COUNT` in
 * RoadScene).
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private started = false;

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

  /** Starts the base loop. Must be called from a user-gesture handler (tap/keydown) — browsers block autoplay otherwise. No-ops after the first call. */
  start(bpm: number, count: number): void {
    if (this.started) return;
    this.started = true;

    const ctx = this.ensureContext();
    const layer = this.manifest.baseLoop;
    const schedule = generateBaseLoopSchedule(bpm, count, this.manifest.rootFrequencyHz, layer);
    const startAt = ctx.currentTime + 0.05;

    for (const note of schedule) {
      this.playNote(ctx, layer, startAt + note.timeMs / 1000, note.frequencyHz, note.durationMs / 1000);
    }
  }

  private playNote(
    ctx: AudioContext,
    layer: AudioManifest['baseLoop'],
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

    osc.connect(envelope).connect(ctx.destination);
    osc.start(whenSec);
    osc.stop(whenSec + durationSec + 0.02);
  }
}
