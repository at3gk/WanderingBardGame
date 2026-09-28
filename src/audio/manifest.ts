/**
 * The one shared root pitch every sounding voice transposes from — melody,
 * the adaptive backing (`adaptive.ts`), and free play (`freePlayScreen.ts`)
 * alike. Rooted at MIDDLE C (C4), matching `core/notation.ts`, so a note
 * drawn on the staff and the note sounded are the same note.
 *
 * `baseLoop`/`layers` (per-voice waveform, gain, note length and a
 * meter-threshold crossfade, ROADMAP task 8) lived here too until run 220:
 * `adaptive.ts`'s `ADAPTIVE_LAYERS` took over as the real backing mechanism
 * with its own waveform table (`RoadStage.ts`'s `LAYER_WAVEFORMS`) and those
 * fields had zero production readers left. Deleted rather than reworded, the
 * same call run 215 made on dead `hud.ts` code and run 218 made on
 * `layering.ts`.
 */

export interface AudioManifest {
  rootFrequencyHz: number;
}

export const AUDIO_MANIFEST: AudioManifest = {
  rootFrequencyHz: 261.63,
};
