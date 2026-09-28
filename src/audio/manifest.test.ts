import { describe, expect, it } from 'vitest';
import { AUDIO_MANIFEST } from './manifest';

describe('AUDIO_MANIFEST', () => {
  it('roots the manifest at middle C so staff positions match sounded pitches', () => {
    expect(AUDIO_MANIFEST.rootFrequencyHz).toBeCloseTo(261.63, 2);
  });
});
