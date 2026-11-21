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
  FULL_SHELF_MESSAGE,
  LET_GO_ARM_MS,
  letGoArmed,
  letGoQuestion,
  letGoFarewell,
  engravingProblem,
  finishRecording,
  isCustomSongId,
  loadCustomSongs,
  notesFromSteps,
  recordTap,
  recordingProblem,
  resumeRecording,
  saveCustomSong,
  saveImportedSong,
  startRecording,
  stopRecording,
} from './customSongs';
import type { SongNote } from './song';

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

/**
 * The shape `core/midi.ts`'s `validateImportedMelody` hands to
 * `saveImportedSong`: real quarter notes plus one interior rest, still
 * exactly `MIN_CUSTOM_SONG_NOTES` non-rest notes and a whole final bar —
 * something `notesFromSteps` (fixed quarter notes, never a rest) could
 * never produce, which is the whole reason this second save path exists.
 */
function validImportedNotes(): SongNote[] {
  const notes: SongNote[] = validSteps().map((step) => ({ semitone: semitoneAtStep(step), beats: 1 }));
  notes.splice(4, 0, { semitone: 0, beats: 1, rest: true });
  notes.push({ semitone: semitoneAtStep(0), beats: 3 });
  return notes;
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

  it('the full-shelf message names the shelf and points at the door that exists', () => {
    for (let i = 0; i < MAX_CUSTOM_SONGS; i++) saveCustomSong(`Song ${i}`, validSteps());
    const result = saveCustomSong('One Too Many', validSteps());
    if (!('error' in result)) throw new Error('expected a full shelf');
    expect(result.error).toBe(FULL_SHELF_MESSAGE);
    expect(result.error).toContain('Your songs');
    expect(result.error).toContain(String(MAX_CUSTOM_SONGS));
    // Task 247's door is the songbook's × and its "let … go" question; the
    // message names exactly that, in the door's own words — not "delete".
    expect(result.error).toContain('×');
    expect(result.error).toContain('let it go');
    expect(result.error).not.toMatch(/delete|remove/i);
  });

  it('letting a tune go frees exactly one place on a full shelf', () => {
    const saved: string[] = [];
    for (let i = 0; i < MAX_CUSTOM_SONGS; i++) {
      const r = saveCustomSong(`Song ${i}`, validSteps());
      if ('song' in r) saved.push(r.song.id);
    }
    deleteCustomSong(saved[3]);
    expect(loadCustomSongs().map((s) => s.id)).toEqual(saved.filter((_, i) => i !== 3));
    expect('song' in saveCustomSong('Room Again', validSteps())).toBe(true);
    expect('error' in saveCustomSong('Full Again', validSteps())).toBe(true);
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

describe('saveImportedSong (task 177 piece 4)', () => {
  it('round-trips a melody with real durations and an interior rest, unlike a tapped song', () => {
    const notes = validImportedNotes();
    const result = saveImportedSong('  My Import  ', notes);
    expect('song' in result).toBe(true);
    const saved = (result as { song: { id: string } }).song;
    expect(isCustomSongId(saved.id)).toBe(true);

    const loaded = loadCustomSongs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('My Import'); // trimmed, same as saveCustomSong
    expect(loaded[0].notes).toEqual(notes);
  });

  it('declines the same way saveCustomSong does: bad name, failed engraving, full page', () => {
    expect('error' in saveImportedSong('   ', validImportedNotes())).toBe(true);
    expect(loadCustomSongs()).toEqual([]);

    const tooShort = validImportedNotes().slice(0, 4);
    expect('error' in saveImportedSong('Too Short', tooShort)).toBe(true);
    expect(loadCustomSongs()).toEqual([]);

    for (let i = 0; i < MAX_CUSTOM_SONGS; i++) {
      expect('song' in saveImportedSong(`Song ${i}`, validImportedNotes())).toBe(true);
    }
    expect('error' in saveImportedSong('One Too Many', validImportedNotes())).toBe(true);
    expect(loadCustomSongs()).toHaveLength(MAX_CUSTOM_SONGS);
  });

  it('sits on the same per-bookmark shelf as a tapped song', () => {
    saveCustomSong('Tapped', validSteps());
    saveImportedSong('Imported', validImportedNotes());
    const loaded = loadCustomSongs();
    expect(loaded.map((s) => s.title).sort()).toEqual(['Imported', 'Tapped']);
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
    it('flags an empty or short take and clears a saveable one', () => {
      expect(recordingProblem([])).toMatch(/at least one note/);
      expect(recordingProblem([0, 1, 2, 3])).toMatch(/needs 16/); // one whole bar, still short
      expect(recordingProblem(validSteps())).toBeNull();
    });

    it('asks a short take for more notes before mentioning bars, in words short enough to sit between ● and × (run 314)', () => {
      for (const n of [1, 2, 3, 5, 15]) {
        const problem = recordingProblem(Array.from({ length: n }, (_, i) => i % 8));
        expect(problem).toMatch(/^tap more notes/);
        expect(problem).toContain(String(MIN_CUSTOM_SONG_NOTES));
        expect(problem).not.toMatch(/bar/);
      }
    });

    it('counts the taps left to finish the last bar once the take is long enough', () => {
      const take = (n: number) => recordingProblem(Array.from({ length: n }, (_, i) => i % 8));
      expect(take(MIN_CUSTOM_SONG_NOTES + 1)).toBe('tap 3 more to finish the bar');
      expect(take(MIN_CUSTOM_SONG_NOTES + 2)).toBe('tap 2 more to finish the bar');
      expect(take(MIN_CUSTOM_SONG_NOTES + 3)).toBe('tap 1 more to finish the bar');
      expect(take(MIN_CUSTOM_SONG_NOTES + 4)).toBeNull();
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

describe('the let-a-tune-go door (task 247)', () => {
  it('a yes only counts once the question has stood long enough to outlast a double tap', () => {
    expect(LET_GO_ARM_MS).toBeGreaterThanOrEqual(300);
    expect(LET_GO_ARM_MS).toBeLessThanOrEqual(800);
    expect(letGoArmed(1000, 1000)).toBe(false);
    expect(letGoArmed(1000, 1000 + 250)).toBe(false);
    expect(letGoArmed(1000, 1000 + LET_GO_ARM_MS)).toBe(true);
    expect(letGoArmed(1000, 500)).toBe(false);
    expect(letGoArmed(Number.NaN, 5000)).toBe(false);
  });

  it('the question names the title exactly once, so the songbook can shorten only the title', () => {
    // Hud.ts splits the question around the title: words before and after
    // stay whole at 320px, and only the title ellipsizes.
    const parts = letGoQuestion('\u0000').split('\u0000');
    expect(parts).toHaveLength(2);
    expect(parts[0].length + parts[1].length).toBeLessThanOrEqual(14);
  });

  it('the question and farewell name the tune and never frame it as a loss', () => {
    const lossWords = /lose|lost|forever|gone forever|warning|sure\?|delete|remove|can'?t be undone/i;
    expect(letGoQuestion('Our Song')).toContain('Our Song');
    expect(letGoFarewell('Our Song')).toContain('Our Song');
    expect(letGoQuestion('Our Song')).not.toMatch(lossWords);
    expect(letGoFarewell('Our Song')).not.toMatch(lossWords);
  });
});
