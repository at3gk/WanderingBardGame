import { describe, expect, it } from 'vitest';
import {
  FREE_PLAY_HIGH_STEP,
  FREE_PLAY_LOW_STEP,
  freePlayStaff,
  freePlayStepAt,
  freePlayStepY,
  MIN_STEP_BAND,
  MIN_TOP_MARGIN,
  HINT_CLEARANCE,
  HINT_LINE_HEIGHT,
  HINT_TOP_PAD,
  hintTopPad,
} from './freePlay';
import { letterForStep, semitoneAtStep } from './notation';
import { advanceSequence, freePlayRowLabel, MAKE_A_SONG_LABEL, PRACTISE_LABEL, BY_HEART_HELP_NOTES, BY_HEART_MISSES, byHeartTap, NO_HELP, pipShown, practiceAccidentalAt, practiceKey, practiceLine, practiceSemitoneAt, practiceSequence, practiceSignature, practiceTap, SIGNATURE_PAD, WRITTEN_NOTE_SPACING, songStepSequence, writtenNoteSlot } from './freePlay';
import type { ByHeartHelp } from './freePlay';
import { BOOK_TWO_SONGS, ITSY_BITSY_SPIDER, MARY_HAD_A_LITTLE_LAMB, SONGS } from './songs';
import { majorKey, spellInKey } from './notation';

const VIEWPORTS: Array<[string, number]> = [
  ['narrow 320', 568],
  ['iPhone SE', 667],
  ['iPhone 12', 664],
  ['landscape', 390],
  ['iPad', 1024],
  ['desktop', 600],
];

describe('the free-play staff', () => {
  it('gives every offered note a touch target a finger can actually hit', () => {
    // The reason this mode gets its own geometry at all: during the walk
    // the steps are 9px apart, and a fingertip covers four of them.
    for (const [name, h] of VIEWPORTS) {
      const staff = freePlayStaff(h, 70, 60);
      expect(staff.stepGap, name).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    }
  });

  it('maps a tap back to the step it was aimed at', () => {
    const staff = freePlayStaff(667, 70, 60);
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      expect(freePlayStepAt(freePlayStepY(step, staff), staff), `step ${step}`).toBe(step);
    }
  });

  it('is forgiving within a step, in both directions', () => {
    const staff = freePlayStaff(667, 70, 60);
    const nudge = staff.stepGap * 0.45;
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      const y = freePlayStepY(step, staff);
      expect(freePlayStepAt(y - nudge, staff), `above ${step}`).toBe(step);
      expect(freePlayStepAt(y + nudge, staff), `below ${step}`).toBe(step);
    }
  });

  it('plays the nearest note rather than nothing when aimed off the ends', () => {
    // In a mode with no failure state, an input that does nothing is the
    // only thing that can feel like a mistake.
    const staff = freePlayStaff(667, 70, 60);
    expect(freePlayStepAt(staff.topY - 500, staff)).toBe(FREE_PLAY_HIGH_STEP);
    expect(freePlayStepAt(staff.bottomY + 500, staff)).toBe(FREE_PLAY_LOW_STEP);
  });

  it('runs low pitch at the bottom and high at the top, like written music', () => {
    const staff = freePlayStaff(667, 70, 60);
    expect(freePlayStepY(FREE_PLAY_LOW_STEP, staff)).toBeGreaterThan(freePlayStepY(FREE_PLAY_HIGH_STEP, staff));
  });

  it('covers exactly the range the songbook draws, naming every step', () => {
    expect(semitoneAtStep(FREE_PLAY_LOW_STEP)).toBe(-1); // B3, under middle C
    expect(semitoneAtStep(FREE_PLAY_HIGH_STEP)).toBe(21); // A5
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      expect(letterForStep(step)).toMatch(/^[A-G]$/);
    }
  });

  it('still lays out on a screen far too short for the notes', () => {
    // It overflows rather than crushing the targets — a scrollable
    // overflow is recoverable, an unhittable note is not.
    const staff = freePlayStaff(120, 70, 60);
    expect(staff.stepGap).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    expect(freePlayStepAt(freePlayStepY(7, staff), staff)).toBe(7);
  });
});

describe('the positions a chosen song uses', () => {
  it('lists exactly the positions the tune uses', () => {
    // Mary is C D E G — four notes, and famously no F.
    expect([...new Set(songStepSequence(MARY_HAD_A_LITTLE_LAMB))].sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
  });

  it('is empty when wandering', () => {
    expect(songStepSequence(null)).toEqual([]);
    expect(songStepSequence(undefined)).toEqual([]);
  });

  it('only ever uses positions free play actually offers', () => {
    // A song whose notes fell outside the ladder would park the practice
    // pip on a rung that is not there.
    for (const song of SONGS) {
      for (const step of songStepSequence(song)) {
        expect(step, `${song.id} step ${step}`).toBeGreaterThanOrEqual(FREE_PLAY_LOW_STEP);
        expect(step, `${song.id} step ${step}`).toBeLessThanOrEqual(FREE_PLAY_HIGH_STEP);
      }
    }
  });

  it('offers every position either songbook writes, and no more than the floor needs', () => {
    // Run 311: My Bonnie and Amazing Grace write the space under middle C
    // (B3 / B-flat 3). Free play's ladder started at middle C, so a child
    // could meet that note on the walk and never find it here. Every
    // written position — Book One's naturals, Book Two's spelt-in-key
    // steps — must be a rung; and the lowest rung must be one some tune
    // actually writes, so the ladder never grows for nothing.
    const written = new Set<number>();
    for (const song of [...SONGS, ...BOOK_TWO_SONGS]) {
      const key = majorKey(song.key ?? 'C');
      for (const note of song.notes) {
        if (note.rest || !key) continue;
        written.add(spellInKey(note.semitone, key).step);
      }
    }
    for (const step of written) {
      expect(step, `written step ${step}`).toBeGreaterThanOrEqual(FREE_PLAY_LOW_STEP);
      expect(step, `written step ${step}`).toBeLessThanOrEqual(FREE_PLAY_HIGH_STEP);
    }
    expect(written.has(FREE_PLAY_LOW_STEP)).toBe(true);
  });
});

describe('playing a chosen song at your own pace', () => {
  const mary = songStepSequence(MARY_HAD_A_LITTLE_LAMB);

  it('is the tune in order, as positions to find', () => {
    // "Mary had a little lamb" opens E D C D E E E.
    expect(mary.slice(0, 7)).toEqual([2, 1, 0, 1, 2, 2, 2]);
    expect(mary.length).toBe(MARY_HAD_A_LITTLE_LAMB.notes.filter((n) => !n.rest).length);
  });

  it('drops rests — there is no clock here, so a silence has nothing to press', () => {
    const spider = songStepSequence(ITSY_BITSY_SPIDER);
    expect(spider.length).toBe(ITSY_BITSY_SPIDER.notes.filter((n) => !n.rest).length);
    expect(spider.length).toBeLessThan(ITSY_BITSY_SPIDER.notes.length);
  });

  it('moves on when the right note is found', () => {
    expect(advanceSequence(0, mary[0], mary)).toBe(1);
    expect(advanceSequence(5, mary[5], mary)).toBe(6);
  });

  it('stays put on a wrong note, and costs nothing', () => {
    // The rule that makes this practice rather than a test.
    const wrong = mary[0] === 5 ? 6 : 5;
    expect(advanceSequence(0, wrong, mary)).toBe(0);
    expect(advanceSequence(3, wrong, mary)).toBe(3);
  });

  it('wraps at the end, because you will want it again', () => {
    const last = mary.length - 1;
    expect(advanceSequence(last, mary[last], mary)).toBe(0);
  });

  it('survives an out-of-range index rather than reading past the end', () => {
    expect(advanceSequence(mary.length + 4, mary[4], mary)).toBe(5);
    expect(advanceSequence(-1, mary[mary.length - 1], mary)).toBe(0);
  });

  it('does nothing at all when wandering', () => {
    expect(songStepSequence(null)).toEqual([]);
    expect(advanceSequence(0, 4, [])).toBe(0);
  });
});

describe('writing the tune out left to right', () => {
  it('marches across the line, then starts a new one', () => {
    // 360px of staff at 30px a note is twelve to a line.
    const at = (i: number) => writtenNoteSlot(i, 360);
    expect(at(0)).toMatchObject({ column: 0, line: 0, perLine: 12 });
    expect(at(11)).toMatchObject({ column: 11, line: 0 });
    expect(at(12)).toMatchObject({ column: 0, line: 1 });
    expect(at(25)).toMatchObject({ column: 1, line: 2 });
  });

  it('fits fewer to a line on a narrower screen', () => {
    expect(writtenNoteSlot(0, 240).perLine).toBeLessThan(writtenNoteSlot(0, 600).perLine);
  });

  it('always leaves room for at least one note, however cramped', () => {
    for (const w of [0, 5, 29, 30]) {
      expect(writtenNoteSlot(3, w).perLine, `width ${w}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('never returns a negative column for a nonsense index', () => {
    expect(writtenNoteSlot(-4, 360).column).toBe(0);
  });
});

describe('fitting the ladder on the screen', () => {
  // The bug this exists for: on a 664x390 landscape phone the default
  // margins leave 260px for twelve gaps, under the 26px floor — and simply
  // overflowing put middle C at y=386 on a 390px screen, clipped at the
  // bottom edge and impossible to tap.
  const REAL: Array<[string, number]> = [
    ['narrow 320', 568], ['iPhone SE', 667], ['iPhone 12', 664],
    ['Pixel 5', 727], ['landscape', 390], ['iPad', 1024],
    ['desktop', 600], ['wide short', 560], ['tall narrow', 900],
  ];

  it('keeps every offered note on screen, on every real viewport', () => {
    for (const [name, h] of REAL) {
      const staff = freePlayStaff(h, 74, 56);
      expect(freePlayStepY(FREE_PLAY_LOW_STEP, staff), `${name} lowest`).toBeLessThanOrEqual(h);
      expect(freePlayStepY(FREE_PLAY_HIGH_STEP, staff), `${name} highest`).toBeGreaterThanOrEqual(0);
    }
  });

  it('still keeps targets a finger can hit while doing it', () => {
    for (const [name, h] of REAL) {
      expect(freePlayStaff(h, 74, 56).stepGap, name).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    }
  });

  it('squeezes the margins rather than the notes', () => {
    // 390 tall: the default 74/56 cannot fit twelve 26px gaps, so the top
    // margin has to give.
    const tight = freePlayStaff(390, 74, 56);
    expect(tight.topY).toBeLessThan(74);
    expect(tight.topY).toBeGreaterThanOrEqual(MIN_TOP_MARGIN);
    // A roomy screen keeps its margins untouched.
    expect(freePlayStaff(900, 74, 56).topY).toBe(74);
  });

  it('gives up and overflows only when even the minimum margins cannot fit', () => {
    // Nothing sane is this short; the point is that it degrades rather
    // than producing a zero or negative gap.
    const absurd = freePlayStaff(120, 74, 56);
    expect(absurd.stepGap).toBeGreaterThanOrEqual(MIN_STEP_BAND);
    expect(absurd.topY).toBe(MIN_TOP_MARGIN);
  });
});

describe('keeping the hint line off the top rung', () => {
  // Run 312: on a 664x390 phone the squeezed ladder put A5's ledger at
  // y=34, straight through the hint's words, where it read as an underline.
  const SCREEN_MARGINS: [number, number] = [MIN_TOP_MARGIN + 30, 40];
  const HEIGHTS = [360, 375, 390, 414, 568, 600, 667, 740, 1024];

  it('ends the hint line at least the clearance above the top rung whenever the screen allows it', () => {
    for (const h of HEIGHTS) {
      const staff = freePlayStaff(h, ...SCREEN_MARGINS);
      const hintBottom = hintTopPad(staff) + HINT_LINE_HEIGHT;
      expect(freePlayStepY(FREE_PLAY_HIGH_STEP, staff) - hintBottom, `${h} tall`).toBeGreaterThanOrEqual(HINT_CLEARANCE - 1);
    }
  });

  it('keeps the usual padding on a screen with room to spare', () => {
    expect(hintTopPad(freePlayStaff(740, ...SCREEN_MARGINS))).toBe(HINT_TOP_PAD);
    expect(hintTopPad(freePlayStaff(1024, ...SCREEN_MARGINS))).toBe(HINT_TOP_PAD);
  });

  it('gives up padding, never goes above the screen edge', () => {
    const tight = freePlayStaff(390, ...SCREEN_MARGINS);
    expect(hintTopPad(tight)).toBeLessThan(HINT_TOP_PAD);
    expect(hintTopPad(tight)).toBeGreaterThanOrEqual(0);
    expect(hintTopPad({ stepGap: 26, bottomY: 300, topY: 0 })).toBe(0);
  });
});

describe('practice on the ladder (task 233)', () => {
  it('every songbook tune can be practised end to end on the ladder', () => {
    for (const song of [...SONGS, ...BOOK_TWO_SONGS]) {
      const seq = practiceSequence(song);
      expect(seq, song.id).toEqual(songStepSequence(song));
      for (const step of seq) {
        expect(step).toBeGreaterThanOrEqual(FREE_PLAY_LOW_STEP);
        expect(step).toBeLessThanOrEqual(FREE_PLAY_HIGH_STEP);
      }
    }
  });

  it('skips a note the ladder does not draw rather than stalling on it', () => {
    const base = MARY_HAD_A_LITTLE_LAMB;
    const high = { ...base, notes: [...base.notes, { semitone: 36, beats: 1 }] };
    expect(practiceSequence(high)).toEqual(songStepSequence(base));
  });

  it('is plain free play when wandering or with nothing to find', () => {
    expect(practiceSequence(null)).toEqual([]);
    const one = { ...MARY_HAD_A_LITTLE_LAMB, notes: MARY_HAD_A_LITTLE_LAMB.notes.slice(0, 1) };
    expect(practiceSequence(one)).toEqual([]);
  });

  it('a right tap moves the pip on; a wrong one sounds and stays', () => {
    const seq = [2, 1, 0];
    expect(practiceTap(0, 2, seq)).toEqual({ index: 1, finished: false });
    expect(practiceTap(1, 5, seq)).toEqual({ index: 1, finished: false });
  });

  it('finishing the tune wraps to the first note, flagged for the chime', () => {
    const seq = [2, 1, 0];
    expect(practiceTap(2, 0, seq)).toEqual({ index: 0, finished: true });
    expect(practiceTap(2, 4, seq)).toEqual({ index: 2, finished: false });
    expect(practiceTap(0, 0, [])).toEqual({ index: 0, finished: false });
  });
});

describe('the found notes written out (task 234)', () => {
  const seq = [4, 3, 2, 3, 4, 4, 4, 3, 3, 3]; // Mary's opening, E D C D E E E D D D

  it('a fresh tune starts on a clean line with the pip in the first column', () => {
    const line = practiceLine(0, seq, 150);
    expect(line.written).toEqual([]);
    expect(line.pipColumn).toBe(0);
    expect(line.perLine).toBe(5);
  });

  it('every note found so far on this line is written, in order, left to right', () => {
    const line = practiceLine(3, seq, 150);
    expect(line.written).toEqual([
      { step: 4, column: 0 },
      { step: 3, column: 1 },
      { step: 2, column: 2 },
    ]);
    expect(line.pipColumn).toBe(3);
  });

  it('a full line turns to a clean one, keeping only what is found on it', () => {
    expect(practiceLine(5, seq, 150)).toMatchObject({ written: [], pipColumn: 0 });
    const line = practiceLine(7, seq, 150);
    expect(line.written.map((n) => n.step)).toEqual([4, 4]);
    expect(line.pipColumn).toBe(2);
  });

  it('finishing the tune (the pip wrapping to 0) leaves a clean page', () => {
    const finished = practiceTap(seq.length - 1, seq[seq.length - 1], seq);
    expect(finished.finished).toBe(true);
    expect(practiceLine(finished.index, seq, 150).written).toEqual([]);
  });

  it('a wrong tap writes nothing, because the page follows the pip alone', () => {
    const before = practiceLine(2, seq, 150);
    const after = practiceLine(practiceTap(2, 9, seq).index, seq, 150);
    expect(after.written).toEqual(before.written);
  });

  it('centres the line on the ladder, one spacing between columns', () => {
    const line = practiceLine(0, seq, 150);
    expect(line.offsetX(0)).toBe(-60);
    expect(line.offsetX(2)).toBe(0);
    expect(line.offsetX(4)).toBe(60);
    expect(line.offsetX(1) - line.offsetX(0)).toBe(30);
  });

  it('a whole line stays inside the width it was given', () => {
    for (const w of [156, 192, 260]) {
      const line = practiceLine(0, seq, w);
      expect(Math.abs(line.offsetX(line.perLine - 1)) + 15, `width ${w}`).toBeLessThanOrEqual(w / 2);
    }
  });

  it('copes with an empty tune', () => {
    expect(practiceLine(3, [], 150)).toMatchObject({ written: [], pipColumn: 0 });
  });
});

describe('byHeartTap / pipShown (task 235: by heart, quick to help, slow to withdraw)', () => {
  const run = (taps: boolean[], from: ByHeartHelp = NO_HELP) => taps.reduce(byHeartTap, from);

  it('guided practice always shows the pip', () => {
    expect(pipShown(false, NO_HELP)).toBe(true);
  });

  it('by heart starts with the pip away', () => {
    expect(pipShown(true, NO_HELP)).toBe(false);
  });

  it('a stray wrong tap or two does not bring the pip back', () => {
    const help = run(Array(BY_HEART_MISSES - 1).fill(false));
    expect(pipShown(true, help)).toBe(false);
  });

  it('enough wrong taps in a row bring it back', () => {
    const help = run(Array(BY_HEART_MISSES).fill(false));
    expect(pipShown(true, help)).toBe(true);
    expect(help.helping).toBe(BY_HEART_HELP_NOTES);
  });

  it('a right tap forgets the misses before it', () => {
    const help = run([false, false, true, false, false]);
    expect(pipShown(true, help)).toBe(false);
  });

  it('once back, the pip stays for several right notes, then goes quietly', () => {
    const back = run(Array(BY_HEART_MISSES).fill(false));
    const almost = run(Array(BY_HEART_HELP_NOTES - 1).fill(true), back);
    expect(pipShown(true, almost)).toBe(true);
    expect(pipShown(true, byHeartTap(almost, true))).toBe(false);
  });

  it('wrong taps while helping neither extend nor shorten the help, nor count', () => {
    const back = run(Array(BY_HEART_MISSES).fill(false));
    const after = run([true, false, false, false, false], back);
    expect(after).toEqual({ misses: 0, helping: BY_HEART_HELP_NOTES - 1 });
  });

  it('withdraws slower than it helps', () => {
    expect(BY_HEART_HELP_NOTES).toBeGreaterThan(BY_HEART_MISSES);
  });
});

describe('practising a keyed tune (task 236)', () => {
  const keyed = BOOK_TWO_SONGS.filter((s) => s.key !== undefined && s.key !== 'C');

  it('keeps every sounding note of a Book Two tune — sharps and flats included', () => {
    expect(keyed.length).toBeGreaterThan(0);
    for (const song of keyed) {
      const sounding = song.notes.filter((n) => !n.rest).length;
      expect(songStepSequence(song).length, song.id).toBe(sounding);
      expect(practiceSequence(song).length, song.id).toBe(sounding);
    }
  });

  it('a right tap on the tuned ladder sounds the tune exactly', () => {
    for (const song of keyed) {
      const key = practiceKey(song);
      expect(key, song.id).not.toBeNull();
      const sounding = song.notes.filter((n) => !n.rest).map((n) => n.semitone);
      const played = practiceSequence(song).map((step) => practiceSemitoneAt(step, key));
      expect(played, song.id).toEqual(sounding);
    }
  });

  it('tunes rungs the way the signature says: F♯ in G, B♭ E♭ A♭ in E♭', () => {
    const g = majorKey('G');
    const eb = majorKey('Eb');
    // F4 = step 3, B4 = 6, E4 = 2, A4 = 5, C4 = 0.
    expect(practiceSemitoneAt(3, g)).toBe(semitoneAtStep(3) + 1);
    expect(practiceAccidentalAt(3, g)).toBe('♯');
    expect(practiceAccidentalAt(10, g)).toBe('♯'); // F5 too
    expect(practiceAccidentalAt(0, g)).toBe('');
    for (const step of [6, 2, 5]) {
      expect(practiceSemitoneAt(step, eb)).toBe(semitoneAtStep(step) - 1);
      expect(practiceAccidentalAt(step, eb)).toBe('♭');
    }
    expect(practiceAccidentalAt(4, eb)).toBe('');
  });

  it('leaves Book One and keyless tunes on plain naturals', () => {
    expect(practiceKey(MARY_HAD_A_LITTLE_LAMB)).toBeNull();
    expect(practiceKey(null)).toBeNull();
    for (let step = FREE_PLAY_LOW_STEP; step <= FREE_PLAY_HIGH_STEP; step++) {
      expect(practiceSemitoneAt(step, null)).toBe(semitoneAtStep(step));
      expect(practiceAccidentalAt(step, null)).toBe('');
    }
    for (const song of SONGS) {
      expect(practiceSequence(song).map((s) => practiceSemitoneAt(s, practiceKey(song))), song.id).toEqual(
        song.notes.filter((n) => !n.rest).map((n) => n.semitone),
      );
    }
  });
});

describe('practice shows the key signature (task 237)', () => {
  it('draws none for a keyless tune or C major', () => {
    expect(practiceSignature(null)).toEqual({ marks: [], width: 0 });
    expect(practiceSignature({ fifths: 0 })).toEqual({ marks: [], width: 0 });
  });

  it('engraves sharps and flats where the walk puts them, in entry order', () => {
    // Steps from C4 = 0: F5 = 10, C5 = 7, G5 = 11; B4 = 6, E5 = 9, A4 = 5.
    expect(practiceSignature({ fifths: 1 }).marks.map((m) => [m.glyph, m.step])).toEqual([['♯', 10]]);
    expect(practiceSignature({ fifths: 3 }).marks.map((m) => [letterForStep(m.step), m.step])).toEqual([['F', 10], ['C', 7], ['G', 11]]);
    expect(practiceSignature({ fifths: -3 }).marks.map((m) => [m.glyph, letterForStep(m.step), m.step])).toEqual([
      ['♭', 'B', 6],
      ['♭', 'E', 9],
      ['♭', 'A', 5],
    ]);
  });

  it('names exactly the letters the tuned ladder alters, for every Book Two tune', () => {
    for (const song of BOOK_TWO_SONGS) {
      const key = practiceKey(song);
      const sig = practiceSignature(key);
      const altered = new Set(
        Array.from({ length: 14 }, (_, i) => i - 1)
          .filter((step) => practiceAccidentalAt(step, key) !== '')
          .map((step) => letterForStep(step))
      );
      expect(new Set(sig.marks.map((m) => letterForStep(m.step)))).toEqual(altered);
      for (const m of sig.marks) expect(practiceAccidentalAt(m.step, key)).toBe(m.glyph);
    }
  });

  it('keeps the written notes clear of the signature, even at 320px', () => {
    for (const fifths of [1, 2, 3, -1, -2, -3]) {
      const sig = practiceSignature({ fifths });
      const lastMarkRight = Math.max(...sig.marks.map((m) => m.x)) + SIGNATURE_PAD / 2;
      expect(lastMarkRight).toBeLessThanOrEqual(sig.width);
      for (const width of [192, 260]) {
        const seq = Array.from({ length: 20 }, () => 4);
        const line = practiceLine(0, seq, width, WRITTEN_NOTE_SPACING, sig.width);
        // The first column's head (15px wide) starts past the reserved room, measured from the staff's left end.
        const firstHeadLeft = width / 2 + line.offsetX(0) - 7.5;
        expect(firstHeadLeft).toBeGreaterThanOrEqual(sig.width - SIGNATURE_PAD);
        // And the last column still ends inside the staff.
        expect(width / 2 + line.offsetX(line.perLine - 1) + 7.5).toBeLessThanOrEqual(width);
        expect(line.perLine).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('leaves a keyless line exactly where it was', () => {
    const seq = [2, 1, 0, 1, 2, 2, 2];
    const plain = practiceLine(3, seq, 192);
    const reserved = practiceLine(3, seq, 192, WRITTEN_NOTE_SPACING, 0);
    expect(reserved.perLine).toBe(plain.perLine);
    expect(reserved.offsetX(0)).toBe(plain.offsetX(0));
  });
});

describe('the songbook row names what it opens (task 238)', () => {
  it('reads "Make a song" while wandering', () => {
    expect(freePlayRowLabel(null)).toBe(MAKE_A_SONG_LABEL);
    expect(freePlayRowLabel(undefined)).toBe(MAKE_A_SONG_LABEL);
  });

  it('offers practice for every songbook tune, Book One and Book Two', () => {
    for (const song of [...SONGS, ...BOOK_TWO_SONGS]) {
      expect(freePlayRowLabel(song)).toBe(PRACTISE_LABEL);
    }
  });

  it('never promises practice the screen would not give', () => {
    const one = { ...MARY_HAD_A_LITTLE_LAMB, notes: MARY_HAD_A_LITTLE_LAMB.notes.slice(0, 1) };
    expect(practiceSequence(one)).toEqual([]);
    expect(freePlayRowLabel(one)).toBe(MAKE_A_SONG_LABEL);
  });

  it('stays short enough to sit beside its fellow rows', () => {
    expect(PRACTISE_LABEL.length).toBeLessThanOrEqual('Wander the songbook'.length + 1);
    expect(PRACTISE_LABEL).toMatch(/♪$/);
    expect(MAKE_A_SONG_LABEL).toMatch(/♪$/);
  });
});
