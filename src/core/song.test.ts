import { describe, expect, it } from 'vitest';
import { expandSong, Song, songDurationMs, songLengthBeats } from './song';

// 120 BPM -> 500ms per beat, so every expected time is easy to read.
const BPM = 120;

const TINY: Song = {
  id: 'tiny',
  title: 'Tiny',
  beatsPerBar: 4,
  notes: [
    { semitone: 0, beats: 1 },
    { semitone: 4, beats: 2 },
    { semitone: 7, beats: 1 },
  ],
};

describe('songLengthBeats / songDurationMs', () => {
  it('sums note durations, not note count', () => {
    expect(songLengthBeats(TINY)).toBe(4);
    expect(songDurationMs(TINY, BPM)).toBe(2000);
  });
});

describe('expandSong', () => {
  it('gives the first note a beat of runway', () => {
    expect(expandSong(TINY, BPM)[0].hitTimeMs).toBe(500);
  });

  it('spaces each note by the *previous* note\'s written length', () => {
    const beats = expandSong(TINY, BPM);
    expect(beats.map((b) => b.hitTimeMs)).toEqual([500, 1000, 2000]);
    // The half note at 1000ms is followed by silence until 2000ms — that
    // gap is how a half note is felt without being held.
    expect(beats[2].hitTimeMs - beats[1].hitTimeMs).toBe(1000);
  });

  it('carries each note\'s pitch and written length through', () => {
    const beats = expandSong(TINY, BPM);
    expect(beats.map((b) => b.semitone)).toEqual([0, 4, 7]);
    expect(beats.map((b) => b.beats)).toEqual([1, 2, 1]);
  });

  it('numbers notes from the given index offset', () => {
    expect(expandSong(TINY, BPM, 0, 10).map((b) => b.index)).toEqual([10, 11, 12]);
  });

  it('loops seamlessly when the next pass starts one song-duration later', () => {
    const first = expandSong(TINY, BPM);
    const second = expandSong(TINY, BPM, songDurationMs(TINY, BPM), TINY.notes.length);
    const lastOfFirst = first[first.length - 1];
    // The seam gap equals the last note's own written length (1 beat),
    // so a looping song keeps perfect time across repetitions.
    expect(second[0].hitTimeMs - lastOfFirst.hitTimeMs).toBe(500);
    expect(second[0].index).toBe(3);
  });

  it('handles dotted and eighth durations exactly', () => {
    const dotted: Song = {
      id: 'dotted',
      title: 'Dotted',
      beatsPerBar: 4,
      notes: [
        { semitone: 0, beats: 1.5 },
        { semitone: 2, beats: 0.5 },
        { semitone: 4, beats: 2 },
      ],
    };
    expect(expandSong(dotted, BPM).map((b) => b.hitTimeMs)).toEqual([500, 1250, 1500]);
  });
});
