/**
 * MusicXML import (ROADMAP task 178), piece 1: a dependency-free parser
 * from MusicXML text to a melody, reusing task 177's `MelodyNote` shape and
 * (once a later piece wires it in) its quantize/transpose/validate path
 * unchanged — this is exactly the "reuses 177's validation path" the task
 * was written against.
 *
 * MusicXML is "already notation" (ROADMAP's own words): every `<note>`
 * states its own pitch, duration and rest-or-not directly, so there is no
 * MIDI-style note-on/note-off timeline to reconstruct — piece 1 here does
 * what MIDI's pieces 1 *and* 2 did together, because the format makes that
 * one step rather than two.
 *
 * No npm XML library: this game ships one <5 MB bundle, and the game only
 * ever needs to read a handful of element names out of one `<part>`'s
 * `<measure>` list, so a minimal hand-rolled tree parser (tags, attributes,
 * text, comments, CDATA, entities) is the same trade `midi.ts` made for SMF
 * bytes. It is not a general-purpose XML parser — it declines, rather than
 * guesses, at anything a real music-notation program can produce that this
 * narrow reader does not understand (a second part kept for later, a
 * `score-timewise` document, percussion, grace notes' zero duration).
 *
 * Deliberately narrow, like every other "declined kindly" boundary in this
 * codebase: only the first `<part>` is read (multi-part scores are a later
 * piece's question, same as MIDI piece 1 punted multi-track skyline to
 * piece 2); only voice "1" is kept, so a second voice written into the same
 * measure (via `<backup>`) is skipped rather than appended as nonsense
 * timing; a same-position chord collapses to its highest note, the same
 * "top-note skyline" MIDI's piece 2 uses for real polyphony. Quantizing to
 * the songbook's legal durations, transposing into the drawable range, and
 * validating against `engravingProblem` are NOT this piece's job — they are
 * already generic over `MelodyNote[]` in `midi.ts` and are imported from
 * there unchanged rather than re-implemented, per the task's own framing.
 */

import type { MelodyNote } from './midi';

export type ParseMusicXmlResult = { melody: MelodyNote[] } | { error: string };

/** Semitone offset from the pitch class's letter, C major/naturals convention — same table `notation.ts` uses, keyed by MusicXML's own `<step>` letters. */
const STEP_SEMITONES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

interface XmlElement {
  tag: string;
  children: XmlNode[];
}

type XmlNode = XmlElement | { text: string };

function isElement(node: XmlNode): node is XmlElement {
  return 'tag' in node;
}

/** Direct-child elements only — this reader never needs to search deeper, because every field it wants (pitch, duration, rest, divisions) is one level under a known parent. */
function findChildren(el: XmlElement, tag: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => isElement(c) && c.tag === tag);
}

function findChild(el: XmlElement, tag: string): XmlElement | undefined {
  return el.children.find((c): c is XmlElement => isElement(c) && c.tag === tag);
}

function textOf(el: XmlElement): string {
  return el.children
    .filter((c): c is { text: string } => !isElement(c))
    .map((c) => c.text)
    .join('')
    .trim();
}

const ENTITIES: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const codePoint = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITIES[body] ?? match;
  });
}

/**
 * A minimal recursive-descent XML tree reader: tags, attributes (skipped —
 * nothing this game reads out of MusicXML lives in an attribute), text,
 * comments, CDATA, and the XML declaration/DOCTYPE preamble. Throws on
 * anything it can't make sense of; `parseMusicXml` below turns that into
 * this codebase's usual `{error}` result rather than letting it escape.
 */
function parseXmlTree(text: string): XmlElement {
  let pos = 0;
  const len = text.length;

  function skipProlog(): void {
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text.startsWith('<?', pos)) {
        const end = text.indexOf('?>', pos);
        if (end === -1) throw new Error('unterminated processing instruction');
        pos = end + 2;
      } else if (text.startsWith('<!--', pos)) {
        const end = text.indexOf('-->', pos);
        if (end === -1) throw new Error('unterminated comment');
        pos = end + 3;
      } else if (text.startsWith('<!DOCTYPE', pos) || text.startsWith('<!doctype', pos)) {
        const end = text.indexOf('>', pos);
        if (end === -1) throw new Error('unterminated DOCTYPE');
        pos = end + 1;
      } else {
        return;
      }
    }
  }

  function skipAttributes(): void {
    // Advances past `attr="value"` pairs (single- or double-quoted) up to
    // the tag's closing `>` or `/>`, without keeping any of it — nothing
    // this reader wants lives in an attribute value.
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (pos >= len || text[pos] === '>' || text.startsWith('/>', pos)) return;
      const eq = text.indexOf('=', pos);
      if (eq === -1) throw new Error('malformed attribute');
      pos = eq + 1;
      while (pos < len && /\s/.test(text[pos])) pos++;
      const quote = text[pos];
      if (quote !== '"' && quote !== "'") throw new Error('malformed attribute value');
      const close = text.indexOf(quote, pos + 1);
      if (close === -1) throw new Error('unterminated attribute value');
      pos = close + 1;
    }
  }

  function readElement(): XmlElement {
    if (text[pos] !== '<') throw new Error('expected an element');
    pos++;
    const nameStart = pos;
    while (pos < len && !/[\s/>]/.test(text[pos])) pos++;
    const tag = text.slice(nameStart, pos);
    if (!tag) throw new Error('unnamed element');
    skipAttributes();

    if (text.startsWith('/>', pos)) {
      pos += 2;
      return { tag, children: [] };
    }
    if (text[pos] !== '>') throw new Error(`malformed tag <${tag}>`);
    pos++;

    const children: XmlNode[] = [];
    for (;;) {
      if (pos >= len) throw new Error(`unterminated element <${tag}>`);
      if (text.startsWith('<!--', pos)) {
        const end = text.indexOf('-->', pos);
        if (end === -1) throw new Error('unterminated comment');
        pos = end + 3;
      } else if (text.startsWith('<![CDATA[', pos)) {
        const end = text.indexOf(']]>', pos);
        if (end === -1) throw new Error('unterminated CDATA');
        children.push({ text: text.slice(pos + 9, end) });
        pos = end + 3;
      } else if (text.startsWith('</', pos)) {
        const end = text.indexOf('>', pos);
        if (end === -1) throw new Error('unterminated closing tag');
        const closeTag = text.slice(pos + 2, end).trim();
        if (closeTag !== tag) throw new Error(`mismatched closing tag: expected </${tag}>, found </${closeTag}>`);
        pos = end + 1;
        return { tag, children };
      } else if (text[pos] === '<') {
        children.push(readElement());
      } else {
        const next = text.indexOf('<', pos);
        const raw = next === -1 ? text.slice(pos) : text.slice(pos, next);
        pos = next === -1 ? len : next;
        if (raw.length > 0) children.push({ text: decodeEntities(raw) });
      }
    }
  }

  skipProlog();
  const root = readElement();
  return root;
}

/**
 * Reads one `<note>` element (ROADMAP task 178, piece 1). Returns `'skip'`
 * for a grace note (no reliable duration to count) or a note outside voice
 * "1" (a second voice sharing the measure via `<backup>` — not this piece's
 * melody), the merged-with-previous chord case, or a genuine parse error in
 * words an upload dialog can show directly — the same "declined kindly"
 * contract `midi.ts` keeps.
 */
function readNote(noteEl: XmlElement, divisions: number): { melodyNote: MelodyNote; chord: boolean } | 'skip' | { error: string } {
  if (findChild(noteEl, 'grace')) return 'skip';

  const voiceEl = findChild(noteEl, 'voice');
  const voice = voiceEl ? textOf(voiceEl) : '1';
  if (voice !== '1') return 'skip';

  const chord = findChild(noteEl, 'chord') !== undefined;

  const durationEl = findChild(noteEl, 'duration');
  if (!durationEl) return { error: 'a note in this file is missing its duration' };
  const durationTicks = Number(textOf(durationEl));
  if (!Number.isFinite(durationTicks) || durationTicks <= 0) return { error: 'a note in this file has an invalid duration' };
  const beats = durationTicks / divisions;

  if (findChild(noteEl, 'rest')) {
    return { melodyNote: { semitone: 0, beats, rest: true }, chord };
  }

  const pitchEl = findChild(noteEl, 'pitch');
  if (!pitchEl) {
    if (findChild(noteEl, 'unpitched')) return { error: 'percussion (unpitched) notes are not supported' };
    return { error: 'a note in this file has neither a pitch nor a rest' };
  }

  const stepEl = findChild(pitchEl, 'step');
  const octaveEl = findChild(pitchEl, 'octave');
  if (!stepEl || !octaveEl) return { error: 'a note in this file has an incomplete pitch' };
  const step = textOf(stepEl).toUpperCase();
  if (!(step in STEP_SEMITONES)) return { error: `a note in this file has an unrecognised pitch letter "${step}"` };
  const octave = Number(textOf(octaveEl));
  if (!Number.isFinite(octave)) return { error: 'a note in this file has an invalid octave' };
  const alterEl = findChild(pitchEl, 'alter');
  const alter = alterEl ? Number(textOf(alterEl)) : 0;
  if (!Number.isFinite(alter)) return { error: 'a note in this file has an invalid pitch alteration' };

  const semitone = (octave - 4) * 12 + STEP_SEMITONES[step] + alter;
  return { melodyNote: { semitone, beats }, chord };
}

/**
 * Parses a `score-partwise` MusicXML document into a melody. Each measure
 * carries its own `<divisions>` (ticks per quarter note — the same "1 beat
 * = 1 quarter note" convention `extractMelody` in `midi.ts` uses for
 * `ticksPerQuarter`), and `<divisions>` can change partway through a real
 * file, so it is tracked measure-by-measure in this one pass and handed to
 * `readNote` as each note is reached, rather than resolved up front. Never
 * throws: a missing root, an unsupported `score-timewise` layout, or a
 * malformed tag all decline as `{error}`, matching `parseMidi`'s contract.
 */
export function parseMusicXml(text: string): ParseMusicXmlResult {
  let root: XmlElement;
  try {
    root = parseXmlTree(text);
  } catch {
    return { error: 'MusicXML file is corrupt or malformed' };
  }

  if (root.tag === 'score-timewise') return { error: 'score-timewise MusicXML files are not supported, only score-partwise' };
  if (root.tag !== 'score-partwise') return { error: 'not a MusicXML file (missing score-partwise root)' };

  const parts = findChildren(root, 'part');
  if (parts.length === 0) return { error: 'no parts found in this MusicXML file' };
  const part = parts[0];

  const measures = findChildren(part, 'measure');
  if (measures.length === 0) return { error: 'no measures found in this MusicXML file' };

  const melody: MelodyNote[] = [];
  let divisions = 1;

  for (const measure of measures) {
    for (const child of measure.children) {
      if (!isElement(child)) continue;

      if (child.tag === 'attributes') {
        const divisionsEl = findChild(child, 'divisions');
        if (divisionsEl) {
          const d = Number(textOf(divisionsEl));
          if (Number.isFinite(d) && d > 0) divisions = d;
        }
        continue;
      }

      if (child.tag !== 'note') continue;
      const note = readNote(child, divisions);
      if (note === 'skip') continue;
      if ('error' in note) return note;

      if (note.chord) {
        const prev = melody[melody.length - 1];
        if (prev && !prev.rest && !note.melodyNote.rest && note.melodyNote.semitone > prev.semitone) {
          melody[melody.length - 1] = note.melodyNote;
        }
        continue;
      }
      melody.push(note.melodyNote);
    }
  }

  if (melody.length === 0) return { error: 'no notes found in this MusicXML file' };
  return { melody };
}
