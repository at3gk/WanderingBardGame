/**
 * iOS Safari mutes the Web Audio API entirely when the hardware ringer/
 * silent switch is set to silent — media elements keep playing, but
 * `AudioContext` output does not (WebKit bug 237322). The fix is the
 * Audio Session API: setting `navigator.audioSession.type = "playback"`
 * tells the OS this page is a playback app, the same category video/music
 * apps use, which is exempt from the mute switch. The API is Safari-led,
 * experimental, and absent everywhere else, so this always feature-detects
 * first and is a no-op — never a throw — where it doesn't exist.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API
 */

export interface AudioSessionLike {
  type: string;
}

export interface NavigatorWithAudioSession {
  audioSession?: AudioSessionLike;
}

/**
 * Returns whether the session type was actually set, so a caller can tell
 * a real Safari-with-the-API pass from every other engine's no-op — useful
 * for tests, not needed by the game itself.
 */
export function applyPlaybackAudioSession(nav: NavigatorWithAudioSession): boolean {
  if (!nav.audioSession) return false;
  nav.audioSession.type = 'playback';
  return true;
}
