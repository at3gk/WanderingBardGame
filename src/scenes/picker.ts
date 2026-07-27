import Phaser from 'phaser';
import { SongChoice, songGridLayout } from '../core/songChoice';
import { SONGS } from '../core/songs';

/**
 * The songbook picker overlay. Split out of RoadScene (which had grown to
 * 2275 lines — the next candidate flagged by the render-module extractions
 * before it) as its own scene module rather than a `render/` one: unlike
 * those, this is not a pure function of its inputs. It owns two bits of
 * scene state (`pickerParts`, `pickerOpen`) because the whole overlay has
 * to be torn down as one unit, and other input handling elsewhere in the
 * scene needs to know whether it is open. `PickerHost` is the minimal
 * slice of RoadScene these functions read and write.
 */
export interface PickerHost {
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  scale: { width: number; height: number };
  pickerParts: Phaser.GameObjects.GameObject[];
  pickerOpen: boolean;
}

export const PICKER_BACKDROP_COLOR = 0x120d16;
export const PICKER_BACKDROP_ALPHA = 0.93;
export const PICKER_PAD = 18;
export const PICKER_TITLE_H = 34;
export const PICKER_ROW_MIN_H = 38;
export const PICKER_ROW_MAX_W = 250;
export const PICKER_TEXT_COLOR = '#e8d9c0';
export const PICKER_TEXT_COLOR_CHOSEN = '#2a1a2e';
// Reused outside the picker itself — the free-play cursor/pip and the
// lute icon's "practice mode" tint borrow this same gold, so it stays
// exported rather than folded away as a picker-only constant.
export const PICKER_CHOSEN_BG = 0xe8c157;
export const PICKER_ROW_BG = 0x2c2233;
export const PICKER_DEPTH = 1000;
export const PICKER_FADE_MS = 130;

/**
 * The songbook. A full-screen panel listing every tune plus "wander",
 * because eleven entries plus a heading is more than fits beside the
 * staff on a phone, and half-covering the game would leave notes
 * scrolling past under the child's thumb.
 *
 * Nothing here is a menu the game waits behind: the walk is already
 * running before this can be opened, which is the "playable in under
 * five seconds" pillar. Opening it simply stops taps reaching the lane.
 */
export function openPicker(host: PickerHost, currentChoice: SongChoice, onChoose: (choice: SongChoice) => void): void {
  if (host.pickerOpen) return;
  host.pickerOpen = true;

  const w = host.scale.width;
  const h = host.scale.height;
  const backdrop = host.add.rectangle(w / 2, h / 2, w, h, PICKER_BACKDROP_COLOR, PICKER_BACKDROP_ALPHA);
  backdrop.setInteractive();
  backdrop.setDepth(PICKER_DEPTH);
  host.pickerParts.push(backdrop);

  const heading = host.add.text(w / 2, PICKER_PAD + PICKER_TITLE_H / 2, 'choose a song', {
    fontFamily: 'sans-serif',
    fontSize: '15px',
    color: PICKER_TEXT_COLOR,
  });
  heading.setOrigin(0.5, 0.5);
  heading.setDepth(PICKER_DEPTH + 2);
  host.pickerParts.push(heading);

  const entries: Array<{ id: SongChoice; label: string }> = [
    { id: null, label: 'wander (all songs)' },
    ...SONGS.map((song) => ({ id: song.id as SongChoice, label: song.title })),
  ];

  const panelTop = PICKER_PAD + PICKER_TITLE_H;
  const panelH = Math.max(PICKER_ROW_MIN_H, h - panelTop - PICKER_PAD);
  const panelW = Math.max(60, w - PICKER_PAD * 2);
  const layout = songGridLayout(entries.length, panelW, panelH, PICKER_ROW_MIN_H, PICKER_ROW_MAX_W);
  const gridW = layout.cols * layout.cellW;
  const originX = (w - gridW) / 2;

  entries.forEach((entry, i) => {
    const col = Math.floor(i / layout.rows);
    const row = i % layout.rows;
    const cx = originX + col * layout.cellW + layout.cellW / 2;
    const cy = panelTop + row * layout.cellH + layout.cellH / 2;
    const chosen = entry.id === currentChoice;

    const bg = host.add.rectangle(
      cx,
      cy,
      layout.cellW - 8,
      Math.max(24, layout.cellH - 6),
      chosen ? PICKER_CHOSEN_BG : PICKER_ROW_BG,
      1
    );
    bg.setDepth(PICKER_DEPTH + 1);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      onChoose(entry.id);
      closePicker(host);
    });
    host.pickerParts.push(bg);

    const label = host.add.text(cx, cy, entry.label, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: chosen ? PICKER_TEXT_COLOR_CHOSEN : PICKER_TEXT_COLOR,
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(PICKER_DEPTH + 2);
    host.pickerParts.push(label);
  });

  // Tapping the backdrop closes without choosing — the way out for a
  // child who opened this by accident.
  backdrop.on('pointerdown', () => closePicker(host));

  // Fade the whole panel up rather than snapping it on. A full-screen
  // overlay appearing between two frames reads as the game breaking;
  // 130ms is enough to say "this slid in front" and short enough that
  // nobody is waiting for it.
  for (const part of host.pickerParts) {
    const target = part as Phaser.GameObjects.GameObject & { alpha: number };
    const to = target.alpha;
    target.alpha = 0;
    host.tweens.add({ targets: target, alpha: to, duration: PICKER_FADE_MS, ease: 'Quad.easeOut' });
  }
}

export function closePicker(host: PickerHost): void {
  if (!host.pickerOpen) return;
  host.pickerOpen = false;
  // Fade out and destroy on completion. `pickerOpen` goes false straight
  // away, so taps reach the lane again the instant the choice is made
  // rather than after the animation — the input model must never wait on
  // a transition.
  const parts = host.pickerParts;
  host.pickerParts = [];
  for (const part of parts) {
    host.tweens.add({
      targets: part,
      alpha: 0,
      duration: PICKER_FADE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => part.destroy(),
    });
  }
}
