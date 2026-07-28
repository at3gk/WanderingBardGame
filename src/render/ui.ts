import Phaser from 'phaser';

/**
 * The shared UI textures for the "musical notation" visual language
 * (ROADMAP task 32) — everything the player reads or touches that is not a
 * note on the staff: the tintable eighth-note glyph used for beat markers
 * and the mute toggle, the note-stamped coin, the soft hit line, and the
 * treble clef at the staff's left edge.
 *
 * Third and last of the render extractions (engraving, scenery, ui). Like
 * the others these are plain functions over the scene with no game state,
 * cached by texture key, so `tools/ui-sheet.mjs` can bake the set and check
 * it in one image.
 */

/** Warm gold, matching the village's lit windows — the coin is a light source. */
export const COIN_ICON_COLOR = 0xe8c157;
/** Height of the hit-line texture; the scene sizes the image to match. */
export const HIT_LINE_HEIGHT = 120;

/**
 * Bakes all four, once per texture-manager lifetime. Safe to call again —
 * guarded for the case `create()` re-runs on a resize, though
 * `tools/rotate-check.mjs` now verifies that doesn't actually happen in
 * headless testing. Kept idempotent regardless; it costs nothing.
 */
export function createStyleTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('note-glyph')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(9, 28, 16, 11);
    g.fillRect(15, 4, 3, 25);
    g.fillTriangle(18, 4, 27, 10, 18, 16);
    g.generateTexture('note-glyph', 28, 34);
    g.destroy();
  }
  if (!scene.textures.exists('coin-icon')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb5923c, 1);
    g.fillCircle(10, 10, 9);
    g.fillStyle(COIN_ICON_COLOR, 1);
    g.fillCircle(10, 10, 7.5);
    g.fillStyle(0xa8842f, 1);
    g.fillEllipse(8, 13, 6, 4.5);
    g.fillRect(10, 5, 1.5, 8.5);
    g.generateTexture('coin-icon', 20, 20);
    g.destroy();
  }
  if (!scene.textures.exists('hit-line')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 6, HIT_LINE_HEIGHT, 3);
    g.generateTexture('hit-line', 6, HIT_LINE_HEIGHT);
    g.destroy();
  }
  if (!scene.textures.exists('treble-clef')) {
    // Stylized treble clef (idea backlog → shipped only because the
    // screenshot check agreed it reads as one): a straight stem, a top
    // curl, a two-arc spiral wrapping the G line, and a bottom hook.
    // Texture rows map to staff steps: top staff line (F5, step 10) at
    // y=12, 7px per step, so the spiral's center lands on the G line
    // (step 4, y=54) when the image's y=12 row is pinned to F5.
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(3, 0xffffff, 1);
    g.beginPath();
    g.arc(26, 13, 8, Math.PI, Math.PI * 2);
    g.strokePath();
    g.lineBetween(20, 6, 20, 90);
    g.beginPath();
    g.arc(20, 54, 11, -Math.PI / 2, Math.PI);
    g.strokePath();
    g.beginPath();
    g.arc(18, 54, 5.5, Math.PI, Math.PI * 2.6);
    g.strokePath();
    g.beginPath();
    g.arc(14, 91, 6, 0, Math.PI * 0.9);
    g.strokePath();
    g.generateTexture('treble-clef', 44, 104);
    g.destroy();
  }
}

/**
 * The songbook icon: a page of sheet music with a note on it.
 *
 * Three drawings were tried. A closed book was shapeless at 22px; an open
 * book came out as two rectangles with lines in them, which reads as a
 * generic list menu rather than anything musical. A *page with a staff and
 * a note* says "choose something to play" in this game's own visual
 * language, and it cannot be confused with the mute toggle beside it, which
 * is a bare note glyph on no background.
 *
 * It matters more than icon polish usually would: the child this is for
 * cannot read the label.
 */
export function songbookTexture(scene: Phaser.Scene): string {
  const key = 'songbook-icon';
  if (scene.textures.exists(key)) return key;

  const W = 26;
  const H = 26;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // The page. Tintable white like every other glyph, so it picks up the
  // same warm cream as the mute toggle.
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(4, 2.5, 18, 21, 2.5);

  // Two staff lines, not five. At 22px on a phone five lines close to a
  // millimetre apart merge into a grey smear; two say "ruled like music"
  // and leave the note room to be the thing you actually see.
  g.fillStyle(0x2a1a2e, 1);
  g.fillRect(7, 8, 12, 1.3);
  g.fillRect(7, 18, 12, 1.3);

  // One big quarter note between them, stem up. Bold enough to survive
  // being drawn at a third of device resolution on a phone.
  g.fillEllipse(11, 15.5, 7, 5.2);
  g.fillRect(13.6, 7, 1.6, 8.5);

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

/**
 * The free-play icon: a hand-plucked string.
 *
 * It has to say "you play this one" next to a page of sheet music that
 * says "choose what to play" and a bare note that says "sound on". A
 * single string with a note leaving it reads as plucking without needing
 * the whole lute, which at 22px would be a brown smudge.
 */
export function freePlayTexture(scene: Phaser.Scene): string {
  const key = 'freeplay-icon';
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);

  // The string, bowed as if just released.
  g.lineStyle(1.6, 0xffffff, 1);
  g.beginPath();
  g.moveTo(6, 3);
  g.lineTo(6, 23);
  g.strokePath();
  g.beginPath();
  g.moveTo(6, 3);
  g.lineTo(10.5, 13);
  g.lineTo(6, 23);
  g.strokePath();

  // A note sounding away from it.
  g.fillEllipse(17, 17, 6.5, 5);
  g.fillRect(19.4, 8, 1.5, 8);
  g.fillTriangle(20.9, 8, 24.5, 10.5, 20.9, 13.5);

  g.generateTexture(key, 26, 26);
  g.destroy();
  return key;
}
