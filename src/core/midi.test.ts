import { describe, expect, it } from 'vitest';
import { parseMidi } from './midi';

// Hand-built Standard MIDI File bytes — no fixture files, no MIDI library,
// same "construct the exact bytes a real writer would emit" approach a
// parser test needs when the format itself is the thing under test.

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

/** MIDI variable-length quantity encoding — the inverse of `readVarLength`. */
function vlq(value: number): number[] {
  const bytes = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function chunk(id: string, data: number[]): number[] {
  return [...ascii(id), ...u32(data.length), ...data];
}

function header(format: number, trackCount: number, ticksPerQuarter: number): number[] {
  return chunk('MThd', [...u16(format), ...u16(trackCount), ...u16(ticksPerQuarter)]);
}

function track(data: number[]): number[] {
  return chunk('MTrk', data);
}

function midiBytes(chunks: number[][]): Uint8Array {
  return new Uint8Array(chunks.flat());
}

const TEMPO_120BPM = [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]; // 500000 microseconds/quarter
const END_OF_TRACK = [0xff, 0x2f, 0x00];

describe('parseMidi', () => {
  it('reads a minimal single-track file: tempo, one note, end of track', () => {
    const trackData = [
      0x00, ...TEMPO_120BPM,
      0x00, 0x90, 60, 80, // note-on C4-ish (MIDI note 60), delta 0
      0x60, 0x80, 60, 0, // note-off, 96 ticks later (0x60)
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.format).toBe(0);
    expect(result.file.ticksPerQuarter).toBe(96);
    expect(result.file.tracks).toHaveLength(1);
    expect(result.file.tracks[0].events).toEqual([
      { type: 'tempo', tick: 0, microsecondsPerQuarter: 500000 },
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'noteOff', tick: 96, channel: 0, note: 60 },
      { type: 'endOfTrack', tick: 96 },
    ]);
  });

  it('treats a note-on with velocity 0 as a note-off', () => {
    const trackData = [0x00, 0x90, 64, 80, 0x30, 0x90, 64, 0, 0x00, ...END_OF_TRACK];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 64, velocity: 80 },
      { type: 'noteOff', tick: 0x30, channel: 0, note: 64 },
      { type: 'endOfTrack', tick: 0x30 },
    ]);
  });

  it('follows running status: a second event omits its own status byte', () => {
    // note-on ch0, then a second note-on with the status byte dropped —
    // only legal if the reader remembers the previous status.
    const trackData = [
      0x00, 0x90, 60, 80,
      0x10, 62, 90, // running status: implicitly another 0x90 note-on
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events.slice(0, 2)).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'noteOn', tick: 0x10, channel: 0, note: 62, velocity: 90 },
    ]);
  });

  it('resets running status after a meta event', () => {
    // A status byte must follow a meta event even if it repeats the
    // previous channel status — a decoder that forgets this misreads the
    // next event's data bytes as a status byte.
    const trackData = [
      0x00, 0x90, 60, 80,
      0x00, ...TEMPO_120BPM,
      0x00, 0x90, 62, 90, // explicit status required here
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'tempo', tick: 0, microsecondsPerQuarter: 500000 },
      { type: 'noteOn', tick: 0, channel: 0, note: 62, velocity: 90 },
      { type: 'endOfTrack', tick: 0 },
    ]);
  });

  it('reads a time signature meta event', () => {
    const trackData = [0x00, 0xff, 0x58, 0x04, 3, 3, 24, 8, 0x00, ...END_OF_TRACK]; // 3/8
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events[0]).toEqual({ type: 'timeSignature', tick: 0, numerator: 3, denominator: 8 });
  });

  it('skips a SysEx event whole and keeps reading afterward', () => {
    const trackData = [
      0x00, 0xf0, ...vlq(3), 0x01, 0x02, 0x03, // an F0 SysEx with 3 bytes of payload
      0x00, 0x90, 60, 80,
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'endOfTrack', tick: 0 },
    ]);
  });

  it('drops channel messages that carry no melody (e.g. control change)', () => {
    const trackData = [
      0x00, 0xb0, 7, 100, // control change, 2 data bytes
      0x00, 0x90, 60, 80,
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'endOfTrack', tick: 0 },
    ]);
  });

  it('handles a one-data-byte channel message (program change) via running status correctly', () => {
    const trackData = [
      0x00, 0xc0, 5, // program change, 1 data byte
      0x00, 0x90, 60, 80,
      0x00, ...END_OF_TRACK,
    ];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    // If the 1-byte length were wrong, the note-on's own status byte would
    // be misread as program-change data and the note would come out garbled.
    expect(result.file.tracks[0].events).toEqual([
      { type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 },
      { type: 'endOfTrack', tick: 0 },
    ]);
  });

  it('reads a multi-track (format 1) file, each track ticking from its own zero', () => {
    const track1 = [0x00, 0x90, 60, 80, 0x60, 0x80, 60, 0, 0x00, ...END_OF_TRACK];
    const track2 = [0x30, 0x90, 67, 70, 0x60, 0x80, 67, 0, 0x00, ...END_OF_TRACK];
    const bytes = midiBytes([header(1, 2, 96), track(track1), track(track2)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks).toHaveLength(2);
    expect(result.file.tracks[0].events[0]).toEqual({ type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 });
    expect(result.file.tracks[1].events[0]).toEqual({ type: 'noteOn', tick: 0x30, channel: 0, note: 67, velocity: 70 });
  });

  it('handles a large variable-length delta time spanning multiple bytes', () => {
    // 0x81 0x80 0x00 decodes to (1<<14) = 16384 — needs all three VLQ bytes.
    const trackData = [0x81, 0x80, 0x00, 0x90, 60, 80, 0x00, ...END_OF_TRACK];
    const bytes = midiBytes([header(0, 1, 96), track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks[0].events[0]).toEqual({ type: 'noteOn', tick: 16384, channel: 0, note: 60, velocity: 80 });
  });

  it('declines a file with the wrong magic number', () => {
    const bytes = midiBytes([chunk('RIFF', [...u16(0), ...u16(1), ...u16(96)])]);
    const result = parseMidi(bytes);
    expect(result).toEqual({ error: 'not a MIDI file (missing MThd header)' });
  });

  it('declines an SMPTE-timed file rather than misreading the division as ticks', () => {
    // High bit of the division word set = SMPTE frames, not ticks/quarter.
    const bytes = midiBytes([header(0, 1, 0x8018)]);
    const result = parseMidi(bytes);
    expect(result).toEqual({ error: 'MIDI files timed in SMPTE frames are not supported, only ticks-per-quarter-note' });
  });

  it('declines a truncated file instead of throwing', () => {
    const bytes = new Uint8Array([...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1)]); // cut off mid-header
    const result = parseMidi(bytes);
    expect('error' in result).toBe(true);
  });

  it('declines a track missing its end-of-track byte without hanging or throwing', () => {
    const bytes = midiBytes([header(0, 1, 96), track([0x00, 0x90, 60, 80])]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);
    // No infinite loop, no crash — the reader stops at the chunk's declared
    // length even without an explicit end-of-track meta event.
    expect(result.file.tracks[0].events).toEqual([{ type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 }]);
  });

  it('skips an unknown chunk type between the header and the tracks, without counting it as one', () => {
    const unknown = chunk('XTRA', [1, 2, 3, 4]);
    const trackData = [0x00, 0x90, 60, 80, 0x00, ...END_OF_TRACK];
    // ntrks says 1 — the unknown chunk must not be mistaken for it.
    const bytes = midiBytes([header(0, 1, 96), unknown, track(trackData)]);
    const result = parseMidi(bytes);
    if ('error' in result) throw new Error(result.error);

    expect(result.file.tracks).toHaveLength(1);
    expect(result.file.tracks[0].events[0]).toEqual({ type: 'noteOn', tick: 0, channel: 0, note: 60, velocity: 80 });
  });
});
