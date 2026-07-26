import { beforeEach, describe, expect, it } from 'vitest';
import { expandSong, Song, songDurationMs } from '../core/song';
import { AudioEngine } from './AudioEngine';
import { AudioManifest } from './manifest';

/**
 * Minimal Web Audio stand-ins covering only what AudioEngine touches. There's
 * no AudioContext in Vitest's node environment, so the note-scheduling math
 * (the thing worth regression-testing here) can only be observed by swapping
 * the global constructor for one of these.
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
  stopTimeSec: number | null = null;
  connect(): FakeOscillatorNode {
    return this;
  }
  start(when: number): void {
    this.startTimeSec = when;
  }
  stop(when: number): void {
    this.stopTimeSec = when;
  }
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
  rootFrequencyHz: 100,
  baseLoop: { id: 'baseLoop', waveform: 'triangle', semitoneOffset: 0, gain: 0.05, noteDurationMs: 100 },
  layers: [],
};

// 120 BPM -> 500ms/beat. C, then a half-note G.
const SONG: Song = {
  id: 'test',
  title: 'Test',
  beatsPerBar: 4,
  notes: [
    { semitone: 0, beats: 1 },
    { semitone: 12, beats: 2 },
    { semitone: 0, beats: 1 },
  ],
};
const BPM = 120;

describe('AudioEngine.start phase alignment', () => {
  it('schedules from the very first note when the first tap lands at game time 0', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);

    expect(activeContext.oscillators).toHaveLength(3);
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(activeContext.currentTime + 0.05 + 0.5);
  });

  it('skips notes already past nowMs and phase-aligns the rest to it, instead of restarting the song at tap time', () => {
    const engine = new AudioEngine(manifest);
    const nowMs = 1200; // first tap arrives 1.2s into the visual schedule

    engine.start(expandSong(SONG, BPM), nowMs);

    // Notes at 500ms and 1000ms already scrolled past the hit line.
    expect(activeContext.oscillators).toHaveLength(1);
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(activeContext.currentTime + 0.05 + (2000 - nowMs) / 1000);
  });

  it('never schedules a note earlier than the current audio-clock time, even with a large tap delay', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 1900);

    for (const osc of activeContext.oscillators) {
      expect(osc.startTimeSec as number).toBeGreaterThanOrEqual(activeContext.currentTime);
    }
  });

  it('re-anchors a later pass to the visual clock rather than inheriting the original anchor', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 1200);
    activeContext.oscillators.length = 0;

    // 2 seconds of visual time have passed, and the audio clock agrees.
    activeContext.currentTime = 2;
    engine.schedule(expandSong(SONG, BPM, songDurationMs(SONG, BPM), SONG.notes.length), 2000);

    // Pass 2's first note is written at 2500ms, i.e. 500ms from now.
    expect(activeContext.oscillators).toHaveLength(3);
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(2 + 0.05 + 0.5);
  });

  it('corrects audio-clock drift at every pass instead of letting it accumulate', () => {
    // The two clocks are independent — visuals run off performance.now, audio
    // off the sound hardware — so they are never exactly the same rate. If
    // every pass were scheduled against the anchor taken at start(), that
    // difference would accumulate for as long as the session lasted, and what
    // you see and what you hear would slide apart. In a rhythm game that is
    // the one failure that ruins it.
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 1200);
    activeContext.oscillators.length = 0;

    // Visual time is 2000ms, but the audio clock has fallen 300ms behind.
    activeContext.currentTime = 1.7;
    engine.schedule(expandSong(SONG, BPM, songDurationMs(SONG, BPM), SONG.notes.length), 2000);

    // The note must land 500ms from the audio clock's *present*, absorbing
    // the 300ms of accumulated error rather than carrying it forward.
    expect(activeContext.oscillators[0].startTimeSec).toBeCloseTo(1.7 + 0.05 + 0.5);
  });

  it('does nothing before start() — the first gesture is what unlocks audio', () => {
    const engine = new AudioEngine(manifest);
    engine.schedule(expandSong(SONG, BPM), 0);
    expect(activeContext.oscillators).toHaveLength(0);
    expect(engine.isStarted).toBe(false);
  });
});

describe('AudioEngine song voicing', () => {
  it('sounds each note at its written pitch', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);

    const [first, second] = activeContext.oscillators;
    expect(first.frequency.value).toBeCloseTo(100); // root
    expect(second.frequency.value).toBeCloseTo(200); // +12 semitones
  });

  it('holds a half note twice as long as a quarter — note values are audible', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);

    const [quarter, half] = activeContext.oscillators;
    const quarterLen = (quarter.stopTimeSec as number) - (quarter.startTimeSec as number);
    const halfLen = (half.stopTimeSec as number) - (half.startTimeSec as number);
    expect(halfLen - 0.02).toBeCloseTo((quarterLen - 0.02) * 2, 5);
  });

  it('transposes each layer by its own offset, playing the same melody', () => {
    const layered: AudioManifest = {
      ...manifest,
      layers: [{ id: 'bass', waveform: 'sine', semitoneOffset: -12, gain: 0.04, noteDurationMs: 100 }],
    };
    const engine = new AudioEngine(layered);
    engine.start(expandSong(SONG, BPM), 0);

    const bassNotes = activeContext.oscillators.filter((o) => o.type === 'sine');
    expect(bassNotes).toHaveLength(3);
    expect(bassNotes[0].frequency.value).toBeCloseTo(50); // an octave below the root
  });
});

describe('AudioEngine.pluck (the player\'s own note)', () => {
  it('no-ops before start() — no context, no note', () => {
    const engine = new AudioEngine(manifest);
    engine.pluck(0);
    expect(activeContext.oscillators).toHaveLength(0);
  });

  it('sounds the written note an octave up, immediately', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);
    activeContext.oscillators.length = 0;

    engine.pluck(7);
    expect(activeContext.oscillators).toHaveLength(1);
    const osc = activeContext.oscillators[0];
    expect(osc.frequency.value).toBeCloseTo(100 * Math.pow(2, 19 / 12));
    expect(osc.startTimeSec).toBe(activeContext.currentTime);
  });
});

describe('AudioEngine.chime (the coin milestone)', () => {
  it('no-ops before start() — no context, no chime', () => {
    const engine = new AudioEngine(manifest);
    engine.chime();
    expect(activeContext.oscillators).toHaveLength(0);
  });

  it('sounds a plain sine two octaves above the root, immediately', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);
    activeContext.oscillators.length = 0;

    engine.chime();
    expect(activeContext.oscillators).toHaveLength(1);
    const osc = activeContext.oscillators[0];
    expect(osc.type).toBe('sine');
    expect(osc.frequency.value).toBeCloseTo(400); // root * 2^(24/12)
    expect(osc.startTimeSec).toBe(activeContext.currentTime);
  });

  it('never sounds a pitch drawn from the song\'s own layers', () => {
    const engine = new AudioEngine(manifest);
    engine.start(expandSong(SONG, BPM), 0);
    const songFrequencies = activeContext.oscillators.map((o) => o.frequency.value);
    activeContext.oscillators.length = 0;

    engine.chime();
    expect(songFrequencies).not.toContain(activeContext.oscillators[0].frequency.value);
  });
});
