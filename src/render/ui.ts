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
 * the scene does, on every `create()`, which a resize re-runs.
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
 * The songbook icon: a small closed book with a ribbon, in the same white
 * that everything tintable in this game is drawn in.
 *
 * Deliberately not another note glyph. The mute toggle is already a note,
 * and two note-shaped buttons side by side would read as one control with
 * a broken half. A book says "choose what to play" without any words —
 * which matters, because the child this is for cannot read the label.
 */
export function songbookTexture(scene: Phaser.Scene): string {
  const key = 'songbook-icon';
  if (scene.textures.exists(key)) return key;

  const W = 26;
  const H = 26;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Covers: two leaves meeting at a spine, drawn as an open book seen
  // slightly from above so it reads at 22px.
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(2, 5, 10.5, 17, 2);
  g.fillRoundedRect(13.5, 5, 10.5, 17, 2);
  // The gutter between them, punched back out so the two halves read as
  // separate pages rather than one white slab.
  g.fillStyle(0x000000, 0);
  g.fillRect(12.2, 5, 1.6, 17);

  // Page lines, one per leaf — enough to say "book", few enough to survive
  // being drawn at icon size.
  g.fillStyle(0x2a1a2e, 1);
  for (let i = 0; i < 3; i++) {
    const y = 9 + i * 4;
    g.fillRect(4.5, y, 6, 1.2);
    g.fillRect(15.5, y, 6, 1.2);
  }

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}
