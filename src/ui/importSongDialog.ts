/**
 * The MIDI file-upload control (ROADMAP task 177, piece 4's last slice).
 *
 * Everything up to this point — `core/midi.ts`'s `parseMidi`/`extractMelody`/
 * `quantizeDurations`/`transposeIntoRange`/`validateImportedMelody`/
 * `importMidi`, and `core/customSongs.ts`'s `saveImportedSong` — is pure
 * logic with no screen, tested exactly like any other core module. This
 * file is the one piece that actually needs a browser: an `<input
 * type="file">` to get a family's own `.mid` file as bytes, and the two
 * small dialogs the result can lead to — a name prompt on success (the same
 * shape `freePlayScreen.ts`'s recording door already uses), or a plain
 * "declined kindly" message on failure, since a bad file is exactly as
 * expected here as it is anywhere else this codebase reads one.
 *
 * One instance is one file-picker round trip: `RoadStage.ts` creates it in
 * response to the songbook's "Import a song" row (the same user gesture a
 * browser requires to grant a file picker at all), and destroys it once the
 * round trip ends — saved, cancelled, or declined and dismissed. It never
 * sits open across two picks, unlike `FreePlayScreen`, which stays mounted
 * for a whole free-play session.
 */
import { importMidi } from '../core/midi';
import { saveImportedSong, type SaveCustomSongResult } from '../core/customSongs';
import { BOOK_FACE } from './Hud';

const INK = '#f0e2c6';
const PANEL_BORDER = 'rgba(240, 226, 198, 0.5)';
const RECORD_RED = '#d1503a';

export interface ImportSongDialogOptions {
  /** A file was imported, validated and saved. */
  onSaved: (result: Extract<SaveCustomSongResult, { song: unknown }>) => void;
  /** The round trip ended with nothing saved — the file picker was cancelled, or a declined/erroring dialog was dismissed. */
  onDone: () => void;
}

/**
 * Opens the OS file picker immediately (constructor time — the caller's own
 * pointerdown is the gesture a picker needs) and drives whatever follows.
 * Call `destroy()` once `onSaved`/`onDone` fires; this class does not call
 * it for you, so a caller can decide whether "saved" should close a shared
 * host screen the same tick or after its own confirmation.
 */
export class ImportSongDialog {
  private readonly host: HTMLElement;
  private readonly opts: ImportSongDialogOptions;
  private readonly fileInput: HTMLInputElement;
  private overlay: HTMLDivElement | null = null;
  private done = false;

  constructor(host: HTMLElement, opts: ImportSongDialogOptions) {
    this.host = host;
    this.opts = opts;

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.mid,.midi,audio/midi,audio/x-midi';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => this.onFileChosen());
    // Modern Chromium/Firefox fire this when the picker is dismissed with
    // nothing chosen — where it isn't supported, a cancel simply leaves
    // this dialog's hidden input inert, no worse than never opening one.
    this.fileInput.addEventListener('cancel', () => this.finish());
    this.host.appendChild(this.fileInput);

    this.fileInput.click();
  }

  destroy(): void {
    this.overlay?.remove();
    this.fileInput.remove();
  }

  private async onFileChosen(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) {
      this.finish(); // the picker's own "no file selected" shape, same as a cancel
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      this.showMessage(`could not read "${file.name}"`);
      return;
    }

    const result = importMidi(bytes);
    if ('error' in result) {
      this.showMessage(result.error);
      return;
    }

    this.openNaming(result.melody);
  }

  /** A plain declined-kindly message with one way out — "OK" dismisses the whole round trip, same as a cancel. */
  private showMessage(message: string): void {
    const panel = this.buildPanel();
    const title = element('div', { fontStyle: 'italic', marginBottom: '10px' });
    title.textContent = "Couldn't import that file";
    panel.appendChild(title);

    const body = element('div', { fontSize: '14px', lineHeight: '1.4' });
    body.textContent = message;
    panel.appendChild(body);

    const ok = element('div', {
      marginTop: '14px',
      textAlign: 'center',
      textDecoration: 'underline',
      cursor: 'pointer',
    });
    ok.textContent = 'OK';
    ok.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.finish();
    });
    panel.appendChild(ok);
  }

  private openNaming(melody: Parameters<typeof saveImportedSong>[1]): void {
    const panel = this.buildPanel();
    const title = element('div', { fontStyle: 'italic', marginBottom: '10px' });
    title.textContent = 'Name your imported song';
    panel.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 30;
    input.placeholder = 'My song';
    Object.assign(input.style, {
      width: '100%',
      boxSizing: 'border-box',
      font: `400 16px/1.4 ${BOOK_FACE}`,
      color: INK,
      background: 'rgba(240, 226, 198, 0.1)',
      border: `1px solid ${PANEL_BORDER}`,
      borderRadius: '6px',
      padding: '8px 10px',
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(input);

    const error = element('div', { fontSize: '13px', color: RECORD_RED, marginTop: '8px', minHeight: '16px' });
    panel.appendChild(error);

    const buttonRow = element('div', { display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', cursor: 'pointer' });
    const save = element('div', { textDecoration: 'underline' });
    save.textContent = 'Save';
    const cancel = element('div', {});
    cancel.textContent = 'Cancel';
    buttonRow.appendChild(save);
    buttonRow.appendChild(cancel);
    panel.appendChild(buttonRow);

    const trySave = () => {
      const result = saveImportedSong(input.value, melody);
      if ('error' in result) {
        error.textContent = result.error;
        return;
      }
      this.opts.onSaved(result);
      this.finish();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') trySave();
    });
    save.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      trySave();
    });
    cancel.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.finish();
    });

    input.focus();
  }

  /** The scrim-plus-panel shell every step above shows its own content inside. */
  private buildPanel(): HTMLDivElement {
    this.overlay?.remove();
    const overlay = element('div', {
      position: 'fixed',
      inset: '0',
      zIndex: '6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.45)',
      font: `400 16px/1.4 ${BOOK_FACE}`,
      color: INK,
    });
    overlay.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    const panel = element('div', {
      width: 'min(320px, 84vw)',
      background: '#241a1f',
      border: `1px solid ${PANEL_BORDER}`,
      borderRadius: '10px',
      padding: '18px 20px',
      textAlign: 'center',
    });
    panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    overlay.appendChild(panel);
    this.host.appendChild(overlay);
    this.overlay = overlay;
    return panel;
  }

  /** Ends the round trip exactly once, whichever path led here. */
  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.opts.onDone();
  }
}

type Style = Partial<Record<string, string>>;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, style: Style): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
