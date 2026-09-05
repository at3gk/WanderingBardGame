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
