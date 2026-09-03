import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setActiveBookmark } from './profiles';
import { semitoneAtStep } from './notation';
import {
  CUSTOM_SONG_BEATS_PER_BAR,
  EMPTY_RECORDING,
  MAX_CUSTOM_SONGS,
  MIN_CUSTOM_SONG_NOTES,
  buildCustomSong,
  deleteCustomSong,
  engravingProblem,
  finishRecording,
  isCustomSongId,
  loadCustomSongs,
  notesFromSteps,
  recordTap,
  recordingProblem,
  resumeRecording,
  saveCustomSong,
  startRecording,
  stopRecording,
} from './customSongs';

// Same in-memory localStorage stub profiles.test.ts uses — the node test
// environment has none.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
  setActiveBookmark(0);
});

/** Sixteen quarter notes, in range, filling exactly 4 bars of 4/4 — a minimal valid tune. */
function validSteps(): number[] {
  const steps: number[] = [];
  for (let i = 0; i < MIN_CUSTOM_SONG_NOTES; i++) steps.push(i % 8);
  return steps;
}

describe('notesFromSteps', () => {
  it('turns each tapped step into a quarter note at that step\'s pitch', () => {
    const notes = notesFromSteps([0, 4, 7]);
    expect(notes).toEqual([
      { semitone: semitoneAtStep(0), beats: 1 },
      { semitone: semitoneAtStep(4), beats: 1 },
      { semitone: semitoneAtStep(7), beats: 1 },
    ]);
  });

  it('is empty for an empty tap sequence', () => {
    expect(notesFromSteps([])).toEqual([]);
  });
});

describe('buildCustomSong', () => {
  it('carries the id and title through untouched, with the fixed meter', () => {
    const song = buildCustomSong('custom:abc', 'My Tune', [0, 2, 4]);
    expect(song.id).toBe('custom:abc');
    expect(song.title).toBe('My Tune');
    expect(song.beatsPerBar).toBe(CUSTOM_SONG_BEATS_PER_BAR);
    expect(song.notes).toHaveLength(3);
  });
});

describe('engravingProblem', () => {
  it('accepts a tune built from tapped free-play steps', () => {
    const song = buildCustomSong('custom:ok', 'Ok Tune', validSteps());
    expect(engravingProblem(song)).toBeNull();
  });

  it('declines an empty song', () => {
    const song = buildCustomSong('custom:empty', 'Empty', []);
    expect(engravingProblem(song)).not.toBeNull();
  });

  it('declines a song shorter than the minimum', () => {
    // 12 notes: a whole number of 4/4 bars (so the bar-fill check passes)
    // but still under the floor, isolating the length check.
    const song = buildCustomSong('custom:short', 'Short', validSteps().slice(0, 12));
    expect(engravingProblem(song)).toMatch(/at least/);
  });

  it('declines a song whose note count does not fill a whole final bar', () => {
    // One quarter note beyond four full bars of 4/4.
    const song = buildCustomSong('custom:partial', 'Partial', [...validSteps(), 0]);
    expect(engravingProblem(song)).toMatch(/whole final bar/);
  });

  it('declines a note off the naturals-only staff', () => {
    const song = buildCustomSong('custom:sharp', 'Sharp', validSteps());
    song.notes[0] = { semitone: 1, beats: 1 }; // C#, not reachable by tapping, but the validator still guards it
    expect(engravingProblem(song)).toMatch(/naturals-only/);
  });

  it('declines a note too far off the drawable staff', () => {
    const song = buildCustomSong('custom:far', 'Far', validSteps());
    song.notes[0] = { semitone: semitoneAtStep(20), beats: 1 };
    expect(engravingProblem(song)).toMatch(/too far off the staff/);
  });

  it('declines an illegal note length', () => {
    const song = buildCustomSong('custom:odd', 'Odd', validSteps());
    song.notes[0] = { ...song.notes[0], beats: 0.75 };
    expect(engravingProblem(song)).toMatch(/no notation symbol/);
  });

  it('declines a song that opens with a rest', () => {
    const song = buildCustomSong('custom:rest', 'Rest', validSteps());
    song.notes[0] = { ...song.notes[0], rest: true };
    expect(engravingProblem(song)).toMatch(/silence/);
  });

  it('declines a note that runs over a bar line', () => {
    const song = buildCustomSong('custom:overrun', 'Overrun', validSteps());
    song.notes[0] = { ...song.notes[0], beats: 3 };
    song.notes[1] = { ...song.notes[1], beats: 2 };
    expect(engravingProblem(song)).toMatch(/bar line/);
  });
});

describe('isCustomSongId', () => {
  it('recognizes only ids the song maker mints', () => {
    expect(isCustomSongId('custom:abc123')).toBe(true);
    expect(isCustomSongId('mary')).toBe(false);
  });
});

describe('saveCustomSong / loadCustomSongs / deleteCustomSong', () => {
  it('round-trips a valid tune through storage', () => {
    expect(loadCustomSongs()).toEqual([]);
    const result = saveCustomSong('  My Tune  ', validSteps());
    expect('song' in result).toBe(true);
    const saved = (result as { song: { id: string } }).song;
    expect(isCustomSongId(saved.id)).toBe(true);

    const loaded = loadCustomSongs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('My Tune'); // trimmed
    expect(loaded[0].notes).toHaveLength(MIN_CUSTOM_SONG_NOTES);

    deleteCustomSong(saved.id);
    expect(loadCustomSongs()).toEqual([]);
  });

  it('declines an unnamed song without touching storage', () => {
    const result = saveCustomSong('   ', validSteps());
    expect('error' in result).toBe(true);
    expect(loadCustomSongs()).toEqual([]);
  });

  it('declines a song that fails engraving without touching storage', () => {
    const result = saveCustomSong('Too Short', [0, 1, 2]);
    expect('error' in result).toBe(true);
    expect(loadCustomSongs()).toEqual([]);
  });

  it('keeps two tunes saved under the same title distinct', () => {
    saveCustomSong('Twice', validSteps());
    saveCustomSong('Twice', validSteps());
    const loaded = loadCustomSongs();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).not.toBe(loaded[1].id);
  });

  it('declines a new song once the page is full', () => {
    for (let i = 0; i < MAX_CUSTOM_SONGS; i++) {
      const result = saveCustomSong(`Song ${i}`, validSteps());
      expect('song' in result, `save ${i}`).toBe(true);
    }
    const result = saveCustomSong('One Too Many', validSteps());
    expect('error' in result).toBe(true);
    expect(loadCustomSongs()).toHaveLength(MAX_CUSTOM_SONGS);
  });

  it('deleting a song id that is not there is a harmless no-op', () => {
    saveCustomSong('Kept', validSteps());
    expect(() => deleteCustomSong('custom:nonexistent')).not.toThrow();
    expect(loadCustomSongs()).toHaveLength(1);
  });

  it('keeps each bookmark\'s custom songs separate, same as the rest of the save (task 157)', () => {
    saveCustomSong('Bookmark Zero Song', validSteps());
    setActiveBookmark(1);
    expect(loadCustomSongs()).toEqual([]);
    saveCustomSong('Bookmark One Song', validSteps());
    expect(loadCustomSongs()).toHaveLength(1);
    expect(loadCustomSongs()[0].title).toBe('Bookmark One Song');

    setActiveBookmark(0);
    expect(loadCustomSongs()).toHaveLength(1);
    expect(loadCustomSongs()[0].title).toBe('Bookmark Zero Song');
  });

  it('ignores corrupt storage instead of throwing', () => {
    globalThis.localStorage.setItem('wb.customsongs.v1', '{not json');
    expect(loadCustomSongs()).toEqual([]);
  });
});

describe('the recording door (task 176 piece 2)', () => {
  it('starts empty and recording', () => {
    const session = startRecording();
    expect(session.recording).toBe(true);
    expect(session.steps).toEqual([]);
  });

  it('appends each tap to the take, in order, while recording', () => {
    let session = startRecording();
    session = recordTap(session, 4);
    session = recordTap(session, 7);
    expect(session.steps).toEqual([4, 7]);
    expect(session.recording).toBe(true);
  });

  it('ignores taps once stopped — the same session comes back unchanged', () => {
    let session = startRecording();
    session = recordTap(session, 4);
    session = stopRecording(session);
    const after = recordTap(session, 7);
    expect(after).toBe(session); // same reference: a genuine no-op
    expect(after.steps).toEqual([4]);
  });

  it('ignores taps on a session that was never recording (EMPTY_RECORDING)', () => {
    expect(recordTap(EMPTY_RECORDING, 4)).toBe(EMPTY_RECORDING);
  });

  it('stop freezes the take without losing it', () => {
    let session = startRecording();
    session = recordTap(session, 1);
    session = recordTap(session, 2);
    const stopped = stopRecording(session);
    expect(stopped.recording).toBe(false);
    expect(stopped.steps).toEqual([1, 2]);
  });

  it('resume reopens a stopped take for more taps without dropping what was captured', () => {
    let session = startRecording();
    session = recordTap(session, 1);
    session = stopRecording(session);
    session = resumeRecording(session);
    expect(session.recording).toBe(true);
    session = recordTap(session, 2);
    expect(session.steps).toEqual([1, 2]);
  });

  it('starting a fresh recording discards whatever the last take held', () => {
    let session = startRecording();
    session = recordTap(session, 1);
    session = stopRecording(session);
    const fresh = startRecording();
    expect(fresh.steps).toEqual([]);
    expect(fresh.recording).toBe(true);
  });

  describe('recordingProblem', () => {
    it('mirrors engravingProblem\'s words for a live, in-progress take', () => {
      expect(recordingProblem([])).toMatch(/at least one note/);
      expect(recordingProblem([0, 1, 2, 3])).toMatch(/at least/); // one whole bar, still short
      expect(recordingProblem(validSteps())).toBeNull();
    });
  });

  describe('finishRecording', () => {
    it('saves the frozen take under the given title, same as saveCustomSong', () => {
      let session = startRecording();
      for (const step of validSteps()) session = recordTap(session, step);
      session = stopRecording(session);

      const result = finishRecording(session, 'My Recorded Tune');
      expect('song' in result).toBe(true);
      expect(loadCustomSongs()).toHaveLength(1);
      expect(loadCustomSongs()[0].title).toBe('My Recorded Tune');
    });

    it('declines kindly, same as saveCustomSong, without touching storage', () => {
      let session = startRecording();
      session = recordTap(session, 0);
      session = stopRecording(session);

      const result = finishRecording(session, 'Too Short');
      expect('error' in result).toBe(true);
      expect(loadCustomSongs()).toEqual([]);
    });
  });
});
