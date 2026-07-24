import { beforeEach, describe, expect, it } from 'vitest';
import { AudioEngine } from './AudioEngine';
import { AudioManifest } from './manifest';

/**
 * Minimal Web Audio stand-ins covering only what AudioEngine touches. There's
 * no AudioContext in Vitest's node environment, so `start`/`extend`'s actual
 * note-scheduling math (the thing worth regression-testing here) can only be
 * observed by swapping the global constructor for one of these.
 */
class FakeAudioParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect(): FakeGainNode {
    return this;
  }
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  startTimeSec: number | null = null;
  connect(): FakeOscillatorNode {
    return this;
  }
  start(when: number): void {
    this.startTimeSec = when;
  }
  stop(): void {}
}

class FakeAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  destination = {};
  oscillators: FakeOscillatorNode[] = [];
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createOscillator(): FakeOscillatorNode {
    const osc = new FakeOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

let activeContext: FakeAudioContext;

beforeEach(() => {
  activeContext = new FakeAudioContext();
  const fakeCtor = function (this: unknown): FakeAudioContext {
    return activeContext;
  } as unknown as typeof AudioContext;
  globalThis.AudioContext = fakeCtor;
});

const manifest: AudioManifest = {
  rootFrequencyHz: 220,
  baseLoop: { id: 'baseLoop', waveform: 'triangle', pattern: [0, 7], gain: 0.05, noteDurationMs: 100 },
  layers: [],
};

describe('AudioEngine.start phase alignment', () => {
  // bpm 120 -> 500ms/beat, so the first batch's four beats land at
  // 500/1000/1500/2000ms per generateBeatSchedule's "first beat lands one
  // interval after startTimeMs" rule.

  it('schedules from the very first beat when the first tap lands at game time 0', () => {
    const engine = new AudioEngine(manifest);
    engine.start(120, 4, 'village', 0);

    expect(activeContext.oscillators).toHaveLength(4);
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(activeContext.currentTime + 0.05 + 0.5);
  });

  it('skips beats already past nowMs and phase-aligns the rest to it, instead of restarting the loop at tap time', () => {
    const engine = new AudioEngine(manifest);
    const nowMs = 1200; // player's first tap arrives 1.2s into the visual schedule

    engine.start(120, 4, 'village', nowMs);

    // The 500ms and 1000ms beats already scrolled past the hit line by the
    // time this tap fires — only the two still-future beats get scheduled.
    expect(activeContext.oscillators).toHaveLength(2);
    const [first, second] = activeContext.oscillators;
    expect(first.startTimeSec).toBeCloseTo(activeContext.currentTime + 0.05 + (1500 - nowMs) / 1000);
    expect(second.startTimeSec).toBeCloseTo(activeContext.currentTime + 0.05 + (2000 - nowMs) / 1000);
  });

  it('never schedules a note earlier than the current audio-clock time, even with a large tap delay', () => {
    const engine = new AudioEngine(manifest);
    engine.start(120, 4, 'village', 1900);

    expect(activeContext.oscillators.length).toBeGreaterThan(0);
    for (const osc of activeContext.oscillators) {
      expect(osc.startTimeSec as number).toBeGreaterThanOrEqual(activeContext.currentTime);
    }
  });

  it('keeps a later extend() batch in the same phase established by start()', () => {
    const engine = new AudioEngine(manifest);
    engine.start(120, 4, 'village', 1200);
    activeContext.oscillators.length = 0;

    engine.extend(4, 'village');

    // Batch 2 beats land at 2500/3000/3500/4000ms; startAt is anchored at
    // start()-time (currentTime + 0.05 - 1200/1000 = -1.15).
    expect(activeContext.oscillators).toHaveLength(4);
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(-1.15 + 2.5);
  });
});
