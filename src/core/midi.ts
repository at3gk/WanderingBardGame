/**
 * MIDI import (ROADMAP task 177), piece 1: a dependency-free Standard MIDI
 * File (SMF) parser. "The format is simple" is the task's own claim — this
 * piece is the proof: a hand-rolled reader for the byte layout (header
 * chunk, track chunks, delta-time-prefixed events, running status), with no
 * npm dependency, because a game that ships one <5 MB bundle should not pull
 * in a MIDI library to read note-on/note-off pairs.
 *
 * Scope, deliberately narrow like task 176 piece 1 was: turn raw bytes into
 * a generic, faithful event list — every note-on/off, tempo, and time
 * signature, in tick order, exactly as the file states them. No melody
 * extraction (single-track direct vs. polyphonic skyline), no quantizing to
 * the songbook's note values, no transposition, no naturals-only
 * validation — those need this parser to exist first and are sized as their
 * own pieces. A malformed or unsupported file is declined kindly (an
 * `{error}` result, in words an upload dialog can show directly) rather
 * than thrown, the same promise `customSongs.ts`'s `engravingProblem` makes
 * for a tapped song that can't be engraved.
 */

import { staffStepAt } from './notation';
import { LEGAL_DURATIONS, MIN_DRAWABLE_STEP, MAX_DRAWABLE_STEP, CUSTOM_SONG_BEATS_PER_BAR, engravingProblem } from './customSongs';

export interface MidiNoteOnEvent {
  type: 'noteOn';
  tick: number;
  channel: number;
  note: number;
  velocity: number;
}

export interface MidiNoteOffEvent {
  type: 'noteOff';
  tick: number;
  channel: number;
  note: number;
}

export interface MidiTempoEvent {
  type: 'tempo';
  tick: number;
  microsecondsPerQuarter: number;
}

export interface MidiTimeSignatureEvent {
  type: 'timeSignature';
  tick: number;
  numerator: number;
  denominator: number;
}

export interface MidiEndOfTrackEvent {
  type: 'endOfTrack';
  tick: number;
}

export type MidiEvent =
  | MidiNoteOnEvent
  | MidiNoteOffEvent
  | MidiTempoEvent
  | MidiTimeSignatureEvent
  | MidiEndOfTrackEvent;

export interface MidiTrack {
  events: MidiEvent[];
}

export interface MidiFile {
  /** 0 = single track, 1 = multiple tracks played together, 2 = independent sequences. */
  format: number;
  ticksPerQuarter: number;
  tracks: MidiTrack[];
}

export type ParseMidiResult = { file: MidiFile } | { error: string };

/**
 * One note (or rest) of a melody, mid-extraction: a MIDI file's own pitch
 * and duration, before piece 3 quantizes `beats` to the songbook's legal
 * note values or transposes `semitone` into the staff's drawable range.
 * Shaped like `SongNote` (`core/song.ts`) on purpose — same field names,
 * same "semitones from middle C (C4)" convention, same rest contract —
 * because that is exactly what this becomes once piece 3/4 are done; the
 * only thing missing here is validation.
 */
export interface MelodyNote {
  semitone: number;
  beats: number;
  rest?: true;
}

export type ExtractMelodyResult = { melody: MelodyNote[] } | { error: string };

/** MIDI note number 60 is defined as middle C (C4) — the same anchor `notation.ts` uses. */
const MIDDLE_C_MIDI_NOTE = 60;

/** How many octaves either side of the file's own written register to try when auto-transposing (task 177, piece 3). Ten MIDI octaves (0-127) means a file's melody is never more than about ±8 octaves from middle C. */
const MAX_OCTAVE_SHIFT = 8;

interface TimedNote {
  tick: number;
  kind: 'on' | 'off';
  note: number;
}

/**
 * Turns a parsed file's raw note-on/note-off events into a single
 * pitch-and-duration sequence (ROADMAP task 177, piece 2). One algorithm
 * covers both cases the task names: every track's events are merged into
 * one tick-ordered timeline and the *highest currently-sounding* note is
 * tracked at every moment (a "top-note skyline"). For an ordinary
 * single-track, monophonic melody, nothing is ever sounding but one note
 * at a time, so the skyline degenerates to that note directly — the
 * "single track direct" case is this algorithm's trivial output, not a
 * separate code path that could disagree with it. A gap where nothing is
 * sounding becomes a rest, exactly like a written song's own rests; the
 * leading silence before the first note-on and any trailing silence after
 * the last note-off are both dropped rather than kept as rests, since
 * they carry no melody, only file setup (a DAW's count-in, a fixed
 * end-of-track padding) — the extracted melody starts on its own first
 * note, matching `engravingProblem`'s "should not start with silence"
 * rule that piece 4 will hold every uploaded song to anyway.
 *
 * Ticks are converted to beats via the file's own `ticksPerQuarter` (1
 * beat = 1 quarter note, `song.ts`'s convention). Tempo events are not
 * needed for this: durations stay tick-relative, and it's beats — not
 * real seconds — that the songbook's note values and this game's
 * one-tap-per-arrival mechanic both run on.
 */
export function extractMelody(file: MidiFile): ExtractMelodyResult {
  const timed: TimedNote[] = [];
  for (const track of file.tracks) {
    for (const event of track.events) {
      if (event.type === 'noteOn') timed.push({ tick: event.tick, kind: 'on', note: event.note });
      else if (event.type === 'noteOff') timed.push({ tick: event.tick, kind: 'off', note: event.note });
    }
  }
  if (timed.length === 0) return { error: 'no notes found in this MIDI file' };

  // Stable sort by tick; at an equal tick, offs land before ons so a note
  // ending exactly when the next begins never briefly reads as a chord.
  timed.sort((a, b) => a.tick - b.tick || (a.kind === b.kind ? 0 : a.kind === 'off' ? -1 : 1));

  const active = new Map<number, number>();
  const melody: MelodyNote[] = [];
  let started = false;
  let segmentStartTick = 0;
  let segmentTopNote: number | null = null;

  const closeSegment = (endTick: number): void => {
    const beats = (endTick - segmentStartTick) / file.ticksPerQuarter;
    if (beats <= 0) return;
    melody.push(segmentTopNote === null ? { semitone: 0, beats, rest: true } : { semitone: segmentTopNote - MIDDLE_C_MIDI_NOTE, beats });
  };

  let i = 0;
  while (i < timed.length) {
    const tick = timed[i].tick;
    while (i < timed.length && timed[i].tick === tick) {
      const event = timed[i];
      if (event.kind === 'on') {
        active.set(event.note, (active.get(event.note) ?? 0) + 1);
      } else {
        const count = active.get(event.note) ?? 0;
        if (count <= 1) active.delete(event.note);
        else active.set(event.note, count - 1);
      }
      i++;
    }

    const topNote = active.size === 0 ? null : Math.max(...active.keys());
    if (!started) {
      if (topNote === null) continue; // still in the leading silence — nothing to record yet
      started = true;
      segmentStartTick = tick;
      segmentTopNote = topNote;
      continue;
    }
    if (topNote !== segmentTopNote) {
      closeSegment(tick);
      segmentStartTick = tick;
      segmentTopNote = topNote;
    }
  }

  // Whatever is still sounding when the data runs out (a missing note-off,
  // rare but real — the parser itself already tolerates a missing
  // end-of-track for the same reason) is closed at the final tick seen;
  // trailing silence (segmentTopNote === null) is dropped, not kept.
  if (started && segmentTopNote !== null) closeSegment(timed[timed.length - 1].tick);

  return { melody };
}

/**
 * Rounds one raw beat duration (a MIDI file's own tick gap, converted to
 * beats) to the nearest value the songbook's engraver can actually draw
 * (`LEGAL_DURATIONS`). A real MIDI file's durations essentially never land
 * exactly on one of these — human performance timing, a `ticksPerQuarter`
 * that doesn't divide evenly, a DAW's own swing/humanize — which is exactly
 * the "real rounding policy" piece 2 left undone. Ties (equally close to
 * two legal values) round down to the shorter one; deterministic, and
 * consistent with `nearestLegalDuration`/`transposeIntoRange` both scanning
 * their candidates in ascending order and only replacing the current best
 * on a strict improvement.
 */
function nearestLegalDuration(beats: number): number {
  let best = LEGAL_DURATIONS[0];
  let bestDiff = Math.abs(beats - best);
  for (const candidate of LEGAL_DURATIONS) {
    const diff = Math.abs(beats - candidate);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * Quantizes every note in a melody — rests included — to a legal notated
 * duration (ROADMAP task 177, piece 3). Rests are quantized too:
 * `engravingProblem` checks `LEGAL_DURATIONS` against every note
 * unconditionally, before it ever looks at whether the note is a rest.
 */
export function quantizeDurations(melody: readonly MelodyNote[]): MelodyNote[] {
  return melody.map((note) => ({ ...note, beats: nearestLegalDuration(note.beats) }));
}

/**
 * Shifts an entire melody by whole octaves — never a smaller interval,
 * which would change the tune's intervals rather than just its register —
 * so it sits inside the staff's drawable range (`MIN_DRAWABLE_STEP`/
 * `MAX_DRAWABLE_STEP`) as well as one uniform shift can manage (task 177,
 * piece 3). Only a note already on a natural pitch class can ever land in
 * range at all: an accidental's pitch class is unchanged by any octave
 * shift, so a MIDI file that uses one stays out of range no matter what
 * this function does — correctly left for `engravingProblem` to decline
 * (piece 4), not silently "fixed" here by picking a different pitch.
 * Scores every candidate shift by how many notes it lands in range and
 * keeps the first strict improvement seen while scanning shifts from
 * the deepest drop to the highest lift; a tie in score keeps whichever
 * shift has the smaller magnitude, and a tie in magnitude (a drop and a
 * lift of the same size) keeps the drop, simply because it was reached
 * first by that ascending scan — a deterministic pick, not a claim that
 * dropping an octave is musically better than lifting one.
 */
export function transposeIntoRange(melody: readonly MelodyNote[]): MelodyNote[] {
  const pitched = melody.filter((note) => !note.rest);
  if (pitched.length === 0) return melody.slice();

  let bestOctave = 0;
  let bestScore = -1;
  for (let octave = -MAX_OCTAVE_SHIFT; octave <= MAX_OCTAVE_SHIFT; octave++) {
    const shift = octave * 12;
    let score = 0;
    for (const note of pitched) {
      const step = staffStepAt(note.semitone + shift);
      if (step !== null && step >= MIN_DRAWABLE_STEP && step <= MAX_DRAWABLE_STEP) score++;
    }
    if (score > bestScore || (score === bestScore && Math.abs(octave) < Math.abs(bestOctave))) {
      bestScore = score;
      bestOctave = octave;
    }
  }

  const shift = bestOctave * 12;
  return melody.map((note) => (note.rest ? note : { ...note, semitone: note.semitone + shift }));
}

export type ImportMidiResult = { melody: MelodyNote[] } | { error: string };

/**
 * Quantizes and transposes a raw extracted melody, then holds the result to
 * the SAME engraving rules the built-in songbook and a tapped custom song
 * both pass — `customSongs.ts`'s `engravingProblem` — by wrapping it in a
 * throwaway `Song` (ROADMAP task 177, piece 4, first slice). "Declined
 * kindly, never mangled" is this task's own promise from the moment it was
 * written; this is where it's finally kept, since pieces 2-3 only ever
 * produced melodies, never validated them. Deliberately not quantized/
 * transposed and then re-checked in a loop: both are one-shot fixes over
 * the whole melody (piece 3's own docs), so whatever `engravingProblem`
 * still objects to afterward — an accidental, still off the naturals-only
 * staff no octave shift can fix; a note that quantizing to a legal length
 * didn't stop from crossing a bar line; too few notes to sound like a tune
 * — is a real decline, not a bug in this step.
 */
export function validateImportedMelody(melody: readonly MelodyNote[]): ImportMidiResult {
  const fixed = transposeIntoRange(quantizeDurations(melody));
  const problem = engravingProblem({ id: 'preview', title: 'preview', beatsPerBar: CUSTOM_SONG_BEATS_PER_BAR, notes: fixed });
  if (problem) return { error: problem };
  return { melody: fixed };
}

/**
 * The whole pipeline, bytes to an engraving-clean melody: parse (piece 1),
 * extract (piece 2), then quantize/transpose/validate (piece 3 and this
 * piece's own `validateImportedMelody`). This is what the next slice of
 * piece 4 — the actual file-upload control — will call; nothing here reads
 * a `File` or touches the DOM, so it's testable exactly like pieces 1-3
 * were, without a screen.
 */
export function importMidi(bytes: Uint8Array): ImportMidiResult {
  const parsed = parseMidi(bytes);
  if ('error' in parsed) return parsed;

  const extracted = extractMelody(parsed.file);
  if ('error' in extracted) return extracted;

  return validateImportedMelody(extracted.melody);
}

/**
 * Parses a Standard MIDI File. Never throws: a truncated file, a bad magic
 * number, or an SMPTE (frames-per-second) division — real but rare, and
 * this reader only speaks ticks-per-quarter-note — all decline as `{error}`
 * in plain words, same stance as every other "declined kindly" boundary in
 * this codebase.
 */
export function parseMidi(bytes: Uint8Array): ParseMidiResult {
  try {
    const cursor = { pos: 0 };
    const header = readChunkHeader(bytes, cursor);
    if (header.id !== 'MThd') return { error: 'not a MIDI file (missing MThd header)' };
    if (header.length < 6) return { error: 'MIDI header is too short to read' };

    const format = readUint16(bytes, cursor);
    const trackCount = readUint16(bytes, cursor);
    const division = readUint16(bytes, cursor);
    // Any header bytes beyond the six standard ones (rare, but legal) are
    // skipped rather than misread as the next chunk.
    cursor.pos += header.length - 6;

    if ((division & 0x8000) !== 0) {
      return { error: 'MIDI files timed in SMPTE frames are not supported, only ticks-per-quarter-note' };
    }
    const ticksPerQuarter = division;
    if (ticksPerQuarter <= 0) return { error: 'MIDI file has an invalid time division' };

    // Read chunks until the declared number of *actual* MTrk chunks is
    // found — a non-MTrk chunk in between (rare, but legal: some writers
    // add their own) is skipped whole and does not count against ntrks.
    const tracks: MidiTrack[] = [];
    while (tracks.length < trackCount) {
      if (cursor.pos >= bytes.length) return { error: 'MIDI file ends before all declared tracks were read' };
      const track = readTrack(bytes, cursor);
      if (track) tracks.push(track);
    }

    return { file: { format, ticksPerQuarter, tracks } };
  } catch {
    return { error: 'MIDI file is corrupt or truncated' };
  }
}

interface Cursor {
  pos: number;
}

function readChunkHeader(bytes: Uint8Array, cursor: Cursor): { id: string; length: number } {
  const id = readAscii(bytes, cursor, 4);
  const length = readUint32(bytes, cursor);
  return { id, length };
}

/** Reads one chunk. Returns null for a non-MTrk chunk, skipped whole rather than misread as events. */
function readTrack(bytes: Uint8Array, cursor: Cursor): MidiTrack | null {
  const header = readChunkHeader(bytes, cursor);
  const trackEnd = cursor.pos + header.length;
  if (header.id !== 'MTrk') {
    cursor.pos = trackEnd;
    return null;
  }

  const events: MidiEvent[] = [];
  let tick = 0;
  let runningStatus: number | null = null;

  while (cursor.pos < trackEnd) {
    tick += readVarLength(bytes, cursor);
    let statusByte = bytes[cursor.pos];

    if (statusByte < 0x80) {
      // Running status: reuse the previous event's status byte, and this
      // byte is the event's first data byte, not a new status.
      if (runningStatus === null) throw new Error('running status used before any status byte was seen');
      statusByte = runningStatus;
    } else {
      cursor.pos++;
    }

    if (statusByte === 0xff) {
      readMetaEvent(bytes, cursor, tick, events);
      runningStatus = null;
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // SysEx: a length-prefixed blob this game has no use for.
      const length = readVarLength(bytes, cursor);
      cursor.pos += length;
      runningStatus = null;
    } else {
      runningStatus = statusByte;
      readChannelEvent(bytes, cursor, tick, statusByte, events);
    }
  }

  cursor.pos = trackEnd;
  return { events };
}

/** How many data bytes follow a channel-voice status byte, by its high nibble. */
function channelEventDataLength(highNibble: number): number {
  // Program change (0xC) and channel pressure (0xD) carry one data byte;
  // every other channel-voice message carries two.
  return highNibble === 0xc || highNibble === 0xd ? 1 : 2;
}

function readChannelEvent(bytes: Uint8Array, cursor: Cursor, tick: number, statusByte: number, events: MidiEvent[]): void {
  const highNibble = statusByte >> 4;
  const channel = statusByte & 0x0f;
  const dataLength = channelEventDataLength(highNibble);
  const data1 = bytes[cursor.pos];
  const data2 = dataLength === 2 ? bytes[cursor.pos + 1] : 0;
  cursor.pos += dataLength;

  if (highNibble === 0x9 && data2 > 0) {
    events.push({ type: 'noteOn', tick, channel, note: data1, velocity: data2 });
  } else if (highNibble === 0x8 || (highNibble === 0x9 && data2 === 0)) {
    // A note-on with velocity 0 is a note-off by convention (lets a stream
    // stay in running status without ever sending a real 0x8n byte).
    events.push({ type: 'noteOff', tick, channel, note: data1 });
  }
  // Other channel-voice messages (control change, pitch bend, aftertouch,
  // program change) don't describe a melody's notes, so they're read past
  // and dropped rather than kept.
}

function readMetaEvent(bytes: Uint8Array, cursor: Cursor, tick: number, events: MidiEvent[]): void {
  const metaType = bytes[cursor.pos];
  cursor.pos++;
  const length = readVarLength(bytes, cursor);
  const start = cursor.pos;
  cursor.pos += length;

  if (metaType === 0x51 && length === 3) {
    const microsecondsPerQuarter = (bytes[start] << 16) | (bytes[start + 1] << 8) | bytes[start + 2];
    events.push({ type: 'tempo', tick, microsecondsPerQuarter });
  } else if (metaType === 0x58 && length >= 2) {
    events.push({ type: 'timeSignature', tick, numerator: bytes[start], denominator: 2 ** bytes[start + 1] });
  } else if (metaType === 0x2f) {
    events.push({ type: 'endOfTrack', tick });
  }
  // Text/lyric/track-name/instrument-name and every other meta type carry
  // nothing melody-shaped, so — same as the unhandled channel messages
  // above — they're read past and dropped.
}

function readAscii(bytes: Uint8Array, cursor: Cursor, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[cursor.pos + i]);
  cursor.pos += length;
  return s;
}

function readUint16(bytes: Uint8Array, cursor: Cursor): number {
  const value = (bytes[cursor.pos] << 8) | bytes[cursor.pos + 1];
  cursor.pos += 2;
  return value;
}

function readUint32(bytes: Uint8Array, cursor: Cursor): number {
  const value = (bytes[cursor.pos] * 2 ** 24) + (bytes[cursor.pos + 1] << 16) + (bytes[cursor.pos + 2] << 8) + bytes[cursor.pos + 3];
  cursor.pos += 4;
  return value;
}

/** A MIDI variable-length quantity: 7 data bits per byte, high bit marks "more bytes follow". */
function readVarLength(bytes: Uint8Array, cursor: Cursor): number {
  let value = 0;
  for (;;) {
    const byte = bytes[cursor.pos];
    cursor.pos++;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
}
