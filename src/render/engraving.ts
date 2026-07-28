import Phaser from 'phaser';
import { needsLedger, stemDown } from '../core/notation';

/**
 * Baking the notation glyphs — the notes and rests the child actually
 * reads. Split out of RoadScene (which had grown past 1500 lines) because
 * this is the teaching surface: it is the part of the drawing code most
 * worth being able to find, read and check on its own.
 *
 * These are plain functions taking the scene rather than methods, so the
 * engraving has no access to game state and cannot start depending on it.
 * A glyph is a pure function of (name, position, note value) — that is what
 * makes `tools/proofsheet.mjs` able to bake every combination the songbook
 * can produce and check them all at once.
 *
 * Textures are cached by key, so repeated calls are free and a long walk
 * bakes each distinct glyph exactly once.
 */

/**
 * Vertical distance between two staff lines. Also the unit the rest glyphs
 * are drawn in, which is why it lives here alongside them rather than only
 * in the scene's layout code.
 */
export const STAFF_LINE_GAP = 18;
export const NOTE_TEX_W = 42;
export const NOTE_TEX_H = 60;
export const NOTE_HEAD_X = 19;
export const NOTE_HEAD_INSET_Y = 18;
export const NOTE_STEM_LEN = 32;
/** Origin that puts the note *head* (not the texture's centre) on the staff. */
export const NOTE_ORIGIN_X = NOTE_HEAD_X / NOTE_TEX_W;

// One visual language for everything the player reads or touches
// (ROADMAP task 32): shared by the walk's markers and free play's notes, so
// a hit, miss or upcoming note tints the same everywhere it can appear.
export const NOTE_TINT_UPCOMING = 0xe8d9c0;
export const NOTE_TINT_HIT = 0x7fd6a0;
export const NOTE_TINT_MISS = 0x8a5a5a;

const NOTE_LETTER_STYLE = { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#241a20' };
// A hollow (half/whole) head shows the sky through it, so its letter is
// drawn light instead of dark — readable either way, under any tint.
const NOTE_LETTER_STYLE_HOLLOW = { fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffffff' };

/**
 * One note glyph, baked to a texture and cached by key.
 *
 * `showLetter` is the scaffold (see core/scaffold.ts): the same note is
 * baked twice, lettered and bare, so revealing the letter is an instant
 * texture swap rather than a second object stacked on top of the first.
 */
export function noteTexture(
  scene: Phaser.Scene,
  name: string,
  step: number,
  beats: number,
  showLetter = true
): string {
  const key = `note-${name}-${step}-${beats}-${showLetter ? 'l' : 'b'}`;
  if (scene.textures.exists(key)) return key;

  const down = stemDown(step);
  const hollow = beats >= 2;
  const stemless = beats >= 4;
  const dotted = beats === 1.5 || beats === 3;
  const flagged = beats < 1;
  const headY = down ? NOTE_HEAD_INSET_Y : NOTE_TEX_H - NOTE_HEAD_INSET_Y;
  const headX = NOTE_HEAD_X;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  if (needsLedger(step)) {
    g.fillRect(2, headY - 1.5, 34, 3);
  }
  if (hollow) {
    // Thin ring on a slightly larger head, so the letter inside keeps a
    // dark gap around it instead of merging into the ring.
    g.lineStyle(3, 0xffffff, 1);
    g.strokeEllipse(headX, headY, 28, 20);
  } else {
    g.fillEllipse(headX, headY, 26, 18);
  }
  if (!stemless) {
    const stemX = down ? headX - 13 : headX + 10;
    const stemTop = down ? headY : headY - NOTE_STEM_LEN;
    g.fillRect(stemX, stemTop, 3.5, NOTE_STEM_LEN);
    if (flagged) {
      // A single flag off the free end of the stem, curving back toward
      // the head the way an engraved eighth note does.
      const tipY = down ? headY + NOTE_STEM_LEN : headY - NOTE_STEM_LEN;
      const dir = down ? -1 : 1;
      g.fillPoints(
        [
          new Phaser.Geom.Point(stemX + 3.5, tipY),
          new Phaser.Geom.Point(stemX + 13, tipY + 9 * dir),
          new Phaser.Geom.Point(stemX + 12, tipY + 18 * dir),
          new Phaser.Geom.Point(stemX + 3.5, tipY + 10 * dir),
        ],
        true
      );
    }
  }
  if (dotted) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(headX + 19, headY - 5, 3);
  }

  const rt = scene.make.renderTexture({ x: 0, y: 0, width: NOTE_TEX_W, height: NOTE_TEX_H }, false);
  rt.draw(g, 0, 0);
  if (showLetter) {
    const letter = scene.make.text(
      { x: 0, y: 0, text: name, style: hollow ? NOTE_LETTER_STYLE_HOLLOW : NOTE_LETTER_STYLE },
      false
    );
    letter.setOrigin(0.5, 0.5);
    rt.draw(letter, headX, headY);
    letter.destroy();
  }
  rt.saveTexture(key);
  rt.destroy();
  g.destroy();
  return key;
}

/**
 * A written silence (ROADMAP task 51), baked per value. Engraved as a
 * reader expects: a whole rest hangs *under* the second line from the
 * top, a half rest sits *on* the middle line — the pair a beginner is
 * taught to tell apart by which side of the line the block is on — and
 * a quarter rest is the zigzag. Drawn at the middle-line position, so
 * `staffY(STAFF_MIDDLE_STEP)` places it correctly.
 */
export function restTexture(scene: Phaser.Scene, beats: number): string {
  const key = `rest-${beats}`;
  if (scene.textures.exists(key)) return key;

  const midY = NOTE_TEX_H / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);

  if (beats >= 4) {
    // Whole rest: block hanging below the line one gap above the middle.
    g.fillRect(NOTE_HEAD_X - 9, midY - STAFF_LINE_GAP, 18, STAFF_LINE_GAP / 2);
  } else if (beats >= 2) {
    // Half rest: block sitting on the middle line.
    g.fillRect(NOTE_HEAD_X - 9, midY - STAFF_LINE_GAP / 2, 18, STAFF_LINE_GAP / 2);
  } else {
    // Quarter rest: the zigzag, drawn as three strokes down the middle.
    g.lineStyle(3.5, 0xffffff, 1);
    g.beginPath();
    g.moveTo(NOTE_HEAD_X - 5, midY - 16);
    g.lineTo(NOTE_HEAD_X + 5, midY - 6);
    g.lineTo(NOTE_HEAD_X - 5, midY + 3);
    g.lineTo(NOTE_HEAD_X + 6, midY + 14);
    g.strokePath();
    g.fillCircle(NOTE_HEAD_X - 1, midY + 8, 3.5);
  }

  g.generateTexture(key, NOTE_TEX_W, NOTE_TEX_H);
  g.destroy();
  return key;
}
