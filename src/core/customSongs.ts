import { Song, SongNote } from './song';
import { noteNameAt, staffStepAt, semitoneAtStep } from './notation';
import { bookmarkKey } from './profiles';

/**
 * The song maker (ROADMAP task 176, piece 1 — the data layer).
 *
 * "Practice mode already lets a child point at staff positions and hear
 * them; let them SAVE what they tap as a named song and walk the road with
 * it." This module is the "save" half: turning a tapped sequence of free
 * play steps (`freePlay.ts`'s `FreePlayStaff`/`freePlayStepAt`) into a
 * `Song`, checking it against the same engraving rules `songs.test.ts`
 * holds the built-in songbook to, and keeping it in the same wrapped,
 * per-bookmark localStorage pattern as `scaffoldStorage.ts` and
 * `profiles.ts`. Zero parsing: nothing here reads a file or a format,
 * because the composing already happened at the tap — this only records
 * it.
 *
 * Piece 2 (below, `RecordingSession` onward) is the recording door's own
 * state machine — still pure, still no UI. It turned out free play itself
 * (`freePlay.ts`) has no live screen yet: nothing in `three/RoadStage.ts`
 * imports it, so "point at staff positions and hear them" today only
 * happens inside a carried song's fireside rehearsal, not in an open,
 * tap-anything mode. That changes what the next piece is — it must build
 * free play's screen for the first time, recording built in from the
 * start, not bolt a record button onto an existing one. See ROADMAP task
 * 176's piece-2 done-note.
 */

/** One tap in, one quarter note out — the only duration this mode writes. Longer/shorter notes are a later piece, not "zero parsing". */
export const CUSTOM_SONG_NOTE_BEATS = 1;
export const CUSTOM_SONG_BEATS_PER_BAR = 4;

/** Same floor `songs.test.ts` holds the built-in songbook to: long enough to be recognizable as a tune. */
export const MIN_CUSTOM_SONG_NOTES = 16;

/** How many tunes a family's page can hold. A bound on storage, not a design opinion about how many songs matter. */
export const MAX_CUSTOM_SONGS = 8;

const ID_PREFIX = 'custom:';

/** Same set `songs.test.ts` calls "writable note values". */
const LEGAL_DURATIONS = [0.5, 1, 1.5, 2, 3, 4];

/** Same range `songs.test.ts` calls "a range the staff can draw legibly". */
const MIN_DRAWABLE_STEP = -2;
const MAX_DRAWABLE_STEP = 12;

/** Whether an id names a custom, locally-composed song rather than a built-in one. */
export function isCustomSongId(id: string): boolean {
  return id.startsWith(ID_PREFIX);
}

/** A tapped sequence of free-play steps, turned into quarter notes — the whole of "zero parsing". */
export function notesFromSteps(steps: readonly number[]): SongNote[] {
  return steps.map((step) => ({ semitone: semitoneAtStep(step), beats: CUSTOM_SONG_NOTE_BEATS }));
}

/** Assembles a composed song. Does not validate — see `engravingProblem`. */
export function buildCustomSong(id: string, title: string, steps: readonly number[]): Song {
  return { id, title, beatsPerBar: CUSTOM_SONG_BEATS_PER_BAR, notes: notesFromSteps(steps) };
}

/**
 * The same engraving rules `songs.test.ts` holds the built-in songbook to
 * (DESIGN.md Pedagogy: "the notation is never allowed to be wrong"), run
 * here at save time instead of only by a test file, because a saved song
 * reaches the very staff a chosen child reads. Returns the first problem
 * found, in words a save-dialog can show directly, or null when the song
 * is clean — "declined kindly, never mangled" (ROADMAP task 176/177).
 */
export function engravingProblem(song: Song): string | null {
  if (song.notes.length === 0) return 'needs at least one note';
  if (song.notes[0].rest) return 'should not start with silence';

  let nonRestCount = 0;
  let cursor = 0;
  for (const note of song.notes) {
    if (!LEGAL_DURATIONS.includes(note.beats)) return 'has a note length with no notation symbol';

    if (!note.rest) {
      nonRestCount++;
      if (noteNameAt(note.semitone) === null) return 'has a note off the naturals-only staff';
      const step = staffStepAt(note.semitone);
      if (step === null || step < MIN_DRAWABLE_STEP || step > MAX_DRAWABLE_STEP) {
        return 'has a note too far off the staff to draw';
      }
    }

    const startBar = Math.floor(cursor / song.beatsPerBar) + 0;
    const endBar = Math.floor((cursor + note.beats - 1e-9) / song.beatsPerBar) + 0;
    if (endBar !== startBar) return 'has a note that runs over a bar line';
    cursor += note.beats;
  }

  if (cursor % song.beatsPerBar !== 0) return 'does not fill a whole final bar';
  if (nonRestCount < MIN_CUSTOM_SONG_NOTES) return `needs at least ${MIN_CUSTOM_SONG_NOTES} notes to sound like a tune`;
  return null;
}

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'wb.customsongs.v1';

interface StoredSong {
  id: string;
  title: string;
  /** [semitone, beats] pairs — rests never reach here (see `notesFromSteps`), so there is nothing to encode for one. */
  n: [number, number][];
}

interface Stored {
  v: 1;
  songs: StoredSong[];
}

/** Every custom song this bookmark has saved, oldest first. Corrupt or foreign data reads as none, never as a crash. */
export function loadCustomSongs(): Song[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(bookmarkKey(STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.songs)) return [];

    const songs: Song[] = [];
    for (const s of parsed.songs) {
      if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' || !Array.isArray(s.n)) continue;
      const notes: SongNote[] = [];
      for (const pair of s.n) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [semitone, beats] = pair;
        if (!Number.isFinite(semitone) || !Number.isFinite(beats)) continue;
        notes.push({ semitone, beats });
      }
      if (notes.length === 0) continue;
      songs.push({ id: s.id, title: s.title, beatsPerBar: CUSTOM_SONG_BEATS_PER_BAR, notes });
    }
    return songs;
  } catch {
    return [];
  }
}

function writeCustomSongs(songs: readonly Song[]): void {
  const store = storage();
  if (!store) return;
  try {
    const record: Stored = {
      v: 1,
      songs: songs.map((s) => ({ id: s.id, title: s.title, n: s.notes.map((n) => [n.semitone, n.beats] as [number, number]) })),
    };
    store.setItem(bookmarkKey(STORAGE_KEY), JSON.stringify(record));
  } catch {
    // Quota or private browsing: the save quietly fails and the tune is
    // simply not kept, the same kind failure scaffoldStorage.ts accepts.
  }
}

/** A fresh id for a newly composed song. Timestamped so saving the same title twice keeps both tunes rather than colliding. */
function newCustomSongId(): string {
  return `${ID_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
}

export type SaveCustomSongResult = { song: Song } | { error: string };

/**
 * Saves a tapped sequence as a named song. Validates first — a song that
 * cannot be engraved correctly is declined, never mangled, per ROADMAP
 * task 176's own promise — then checks the page isn't full.
 */
export function saveCustomSong(title: string, steps: readonly number[]): SaveCustomSongResult {
  const trimmedTitle = title.trim();
  if (trimmedTitle === '') return { error: 'needs a name' };

  const song = buildCustomSong(newCustomSongId(), trimmedTitle, steps);
  const problem = engravingProblem(song);
  if (problem) return { error: problem };

  const existing = loadCustomSongs();
  if (existing.length >= MAX_CUSTOM_SONGS) {
    return { error: `the songbook page for your own tunes is full (max ${MAX_CUSTOM_SONGS}) — delete one to make room` };
  }

  writeCustomSongs([...existing, song]);
  return { song };
}

/** Removes a saved song by id. Removing one that isn't there is a no-op, not an error. */
export function deleteCustomSong(id: string): void {
  const existing = loadCustomSongs();
  const next = existing.filter((s) => s.id !== id);
  if (next.length !== existing.length) writeCustomSongs(next);
}

/**
 * The recording door (ROADMAP task 176, piece 2): the state a "record my
 * own tune" screen needs, kept as plain, immutable data so a UI can hold
 * it in whatever form it likes (component state, a Three.js scene field)
 * without this module knowing about either. `recording` gates whether a
 * tap counts; `steps` is exactly the sequence `saveCustomSong` wants.
 */
export interface RecordingSession {
  readonly recording: boolean;
  readonly steps: readonly number[];
}

/** Before the first tap, or after a save/cancel — nothing captured yet. */
export const EMPTY_RECORDING: RecordingSession = { recording: false, steps: [] };

/** The record button, pressed: a fresh, empty take. Any earlier take not yet saved is simply gone — silent discard is right here, the same as walking away from an unsent draft. */
export function startRecording(): RecordingSession {
  return { recording: true, steps: [] };
}

/**
 * One tap on the free-play staff, while recording. Taps that arrive
 * outside a recording (the mode a child is in most of the time) are a
 * no-op, returning the same session unchanged — free play's ordinary
 * point-and-hear behaviour is untouched by this module.
 */
export function recordTap(session: RecordingSession, step: number): RecordingSession {
  if (!session.recording) return session;
  return { recording: true, steps: [...session.steps, step] };
}

/** The stop button: freezes the take (no more taps accepted) so the name prompt can show a stable count while it's open. */
export function stopRecording(session: RecordingSession): RecordingSession {
  return { recording: false, steps: session.steps };
}

/** "Not yet, keep tapping": reopens a stopped take without losing what was already captured — what the declined-kindly message leads into when the problem is simply too few notes so far. */
export function resumeRecording(session: RecordingSession): RecordingSession {
  return { recording: true, steps: session.steps };
}

/**
 * A live read on whether the take so far could be saved, without needing
 * a name yet — lets the screen show the same words `saveCustomSong` would
 * decline with (e.g. "needs at least 16 notes to sound like a tune")
 * while the child is still tapping, rather than only at the name prompt.
 * `null` while recording is active is not a promise the take is done —
 * only `engravingProblem` on the frozen take, after stop, is the real
 * gate; this is guidance, not validation.
 */
export function recordingProblem(steps: readonly number[]): string | null {
  if (steps.length === 0) return 'needs at least one note';
  return engravingProblem(buildCustomSong('preview', 'preview', steps));
}

/** The name prompt, confirmed: hands the frozen take to `saveCustomSong`, which validates and declines kindly exactly as piece 1 already does. */
export function finishRecording(session: RecordingSession, title: string): SaveCustomSongResult {
  return saveCustomSong(title, session.steps);
}
