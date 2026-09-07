import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml';

// Hand-built MusicXML strings — no fixture files, no XML library, same
// "construct the exact document a real writer would emit" approach
// midi.test.ts uses for hand-built SMF bytes.

function score(partContent: string, opts: { withDoctype?: boolean } = {}): string {
  const doctype = opts.withDoctype
    ? '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n${doctype}<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
${partContent}
  </part>
</score-partwise>`;
}

function note(opts: { step?: string; octave?: number; alter?: number; duration: number; type?: string; rest?: boolean; chord?: boolean; voice?: number; grace?: boolean }): string {
  const parts: string[] = ['<note>'];
  if (opts.chord) parts.push('<chord/>');
  if (opts.grace) parts.push('<grace/>');
  if (opts.rest) {
    parts.push('<rest/>');
  } else if (opts.step !== undefined) {
    parts.push('<pitch>');
    parts.push(`<step>${opts.step}</step>`);
    if (opts.alter !== undefined) parts.push(`<alter>${opts.alter}</alter>`);
    parts.push(`<octave>${opts.octave}</octave>`);
    parts.push('</pitch>');
  }
  if (!opts.grace) parts.push(`<duration>${opts.duration}</duration>`);
  parts.push(`<voice>${opts.voice ?? 1}</voice>`);
  if (opts.type) parts.push(`<type>${opts.type}</type>`);
  parts.push('</note>');
  return parts.join('');
}

describe('parseMusicXml', () => {
  it('reads a minimal melody: middle C quarter note, divisions 1', () => {
    const xml = score(`<measure number="1"><attributes><divisions>1</divisions></attributes>${note({ step: 'C', octave: 4, duration: 1, type: 'quarter' })}</measure>`);
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 0, beats: 1 }]);
  });

  it('parses the DOCTYPE preamble real MusicXML writers emit', () => {
    const xml = score(`<measure number="1"><attributes><divisions>1</divisions></attributes>${note({ step: 'C', octave: 4, duration: 1 })}</measure>`, { withDoctype: true });
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 0, beats: 1 }]);
  });

  it('reads a short recognisable melody with divisions > 1', () => {
    // C4 quarter, D4 quarter, E4 half — divisions=2 means 1 beat = 2 ticks.
    const xml = score(
      `<measure number="1"><attributes><divisions>2</divisions></attributes>` +
        note({ step: 'C', octave: 4, duration: 2, type: 'quarter' }) +
        note({ step: 'D', octave: 4, duration: 2, type: 'quarter' }) +
        note({ step: 'E', octave: 4, duration: 4, type: 'half' }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([
      { semitone: 0, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 4, beats: 2 },
    ]);
  });

  it('reads an explicit rest as a rest, not silence between notes', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'C', octave: 4, duration: 1 }) +
        note({ rest: true, duration: 1 }) +
        note({ step: 'D', octave: 4, duration: 1 }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([
      { semitone: 0, beats: 1 },
      { semitone: 0, beats: 1, rest: true },
      { semitone: 2, beats: 1 },
    ]);
  });

  it('applies alter for sharps and flats', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'F', octave: 4, alter: 1, duration: 1 }) + // F#4
        note({ step: 'B', octave: 4, alter: -1, duration: 1 }) + // Bb4
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([
      { semitone: 6, beats: 1 },
      { semitone: 10, beats: 1 },
    ]);
  });

  it('collapses a chord to its highest note, keeping the base note\'s duration', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'C', octave: 4, duration: 1 }) +
        note({ step: 'E', octave: 4, duration: 1, chord: true }) +
        note({ step: 'G', octave: 4, duration: 1, chord: true }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 7, beats: 1 }]); // G4, the chord's top note
  });

  it('carries divisions across a measure boundary until it changes again', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>4</divisions></attributes>${note({ step: 'C', octave: 4, duration: 4 })}</measure>` +
        `<measure number="2">${note({ step: 'D', octave: 4, duration: 2 })}</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([
      { semitone: 0, beats: 1 },
      { semitone: 2, beats: 0.5 },
    ]);
  });

  it('skips a second voice sharing the measure (voice 2, e.g. after a backup)', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'C', octave: 4, duration: 1, voice: 1 }) +
        `<backup><duration>1</duration></backup>` +
        note({ step: 'C', octave: 3, duration: 1, voice: 2 }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 0, beats: 1 }]);
  });

  it('skips grace notes (no reliable duration to count)', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'D', octave: 4, duration: 1, grace: true }) +
        note({ step: 'C', octave: 4, duration: 1 }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 0, beats: 1 }]);
  });

  it('handles octaves other than the reference octave', () => {
    const xml = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>` +
        note({ step: 'C', octave: 5, duration: 1 }) +
        note({ step: 'C', octave: 3, duration: 1 }) +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([
      { semitone: 12, beats: 1 },
      { semitone: -12, beats: 1 },
    ]);
  });

  it('declines a score-timewise document by name', () => {
    const xml = '<?xml version="1.0"?><score-timewise version="3.1"></score-timewise>';
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/score-timewise/);
  });

  it('declines a document with no recognisable root', () => {
    const result = parseMusicXml('<not-music-xml></not-music-xml>');
    expect('error' in result && result.error).toMatch(/score-partwise/);
  });

  it('declines a document with no parts', () => {
    const xml = '<?xml version="1.0"?><score-partwise version="3.1"><part-list></part-list></score-partwise>';
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/no parts/);
  });

  it('declines a document with a part but no measures', () => {
    const xml = score('');
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/no measures/);
  });

  it('declines a document with measures but no notes', () => {
    const xml = score('<measure number="1"><attributes><divisions>1</divisions></attributes></measure>');
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/no notes/);
  });

  it('declines a note with neither pitch nor rest', () => {
    const xml = score('<measure number="1"><attributes><divisions>1</divisions></attributes><note><duration>1</duration><voice>1</voice></note></measure>');
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/neither a pitch nor a rest/);
  });

  it('declines a note missing its duration', () => {
    const xml = score('<measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice></note></measure>');
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/missing its duration/);
  });

  it('declines an unpitched (percussion) note', () => {
    const xml = score('<measure number="1"><attributes><divisions>1</divisions></attributes><note><unpitched><display-step>C</display-step></unpitched><duration>1</duration><voice>1</voice></note></measure>');
    const result = parseMusicXml(xml);
    expect('error' in result && result.error).toMatch(/percussion/);
  });

  it('declines malformed XML rather than throwing', () => {
    const result = parseMusicXml('<score-partwise><part id="P1"><measure number="1">');
    expect('error' in result).toBe(true);
  });

  it('decodes XML entities and ignores comments/CDATA around content', () => {
    const xml = score(
      `<!-- a comment --><measure number="1"><attributes><divisions>1</divisions></attributes>` +
        `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><lyric><text>tra&amp;la</text></lyric></note>` +
        `</measure>`
    );
    const result = parseMusicXml(xml);
    if ('error' in result) throw new Error(result.error);
    expect(result.melody).toEqual([{ semitone: 0, beats: 1 }]);
  });
});
