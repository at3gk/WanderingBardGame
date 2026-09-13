import { describe, expect, it } from 'vitest';
import { applyPlaybackAudioSession, type NavigatorWithAudioSession } from './audioSession';

describe('applyPlaybackAudioSession', () => {
  it('sets type to "playback" and reports success when the API exists', () => {
    const nav: NavigatorWithAudioSession = { audioSession: { type: 'auto' } };
    expect(applyPlaybackAudioSession(nav)).toBe(true);
    expect(nav.audioSession?.type).toBe('playback');
  });

  it('is a no-op and reports false when the API is absent', () => {
    const nav: NavigatorWithAudioSession = {};
    expect(applyPlaybackAudioSession(nav)).toBe(false);
    expect(nav.audioSession).toBeUndefined();
  });

  it('overwrites a type the page (or another script) already set', () => {
    const nav: NavigatorWithAudioSession = { audioSession: { type: 'ambient' } };
    applyPlaybackAudioSession(nav);
    expect(nav.audioSession?.type).toBe('playback');
  });
});
