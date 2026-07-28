/**
 * Sky dome and the time-of-day palette that drives the whole world's light.
 *
 * The sky is not decoration here — it is the light source. Every painterly
 * surface reads `uSkyColor`, `uHorizonColor`, `uSunColor` and `uFogColor`,
 * so setting the time of day is one call into `applyTimeOfDay` and the
 * grass, the bard's cloak and the fog all move together. Getting that
 * coupling right is most of why dusk on this road feels like dusk rather
 * than like someone turned a brightness slider down.
 *
 * The dome itself is a single inverted sphere with a vertical gradient, a
 * soft sun bloom, a band of horizon warmth, and — after dark — stars that
 * fade in by altitude. No cubemap, no HDR load: the whole sky is a few
 * hundred bytes of shader and it can be any colour we want at any moment,
 * which a baked cubemap cannot.
 */

import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type IUniform,
} from 'three';
import type { PainterlyGlobals } from './painterly';

/** One keyframe of the day. `t` is 0..1 across a full cycle from midnight. */
export interface SkyKey {
  t: number;
  name: string;
  zenith: number;
  horizon: number;
  sun: number;
  /** Warm bounce coming back up off the ground into shadowed faces. */
  bounce: number;
  fog: number;
  /** Sun elevation in radians. Negative is below the horizon. */
  elevation: number;
  /** Sun azimuth in radians, measured around +Y from +Z. */
  azimuth: number;
  /** Overall light multiplier. */
  exposure: number;
  /** 0 = no stars, 1 = full night sky. */
  starness: number;
}

/**
 * The day, in eight keys.
 *
 * These are hand-picked rather than derived from a physical sky model,
 * because a physical model gives you a correct blue-grey dawn and what a
 * storybook wants is a *lilac* one. The through-line: shadows are always
 * the complement of the sun (warm sun, cool shadow; cool sun, warm
 * shadow), which is the single rule that makes painted light read as
 * painted light.
 */
export const SKY_KEYS: SkyKey[] = [
  {
    t: 0.0,
    name: 'deep night',
    zenith: 0x121a33,
    horizon: 0x2a2a48,
    sun: 0x8f9ed6,
    bounce: 0x1c2138,
    fog: 0x232a44,
    elevation: -0.5,
    azimuth: 1.2,
    exposure: 0.62,
    starness: 1,
  },
  {
    t: 0.2,
    name: 'first light',
    zenith: 0x3f5580,
    horizon: 0xc9a0a8,
    sun: 0xe9b0a4,
    bounce: 0x4a4460,
    fog: 0x8e93ae,
    elevation: -0.04,
    azimuth: 1.05,
    exposure: 0.78,
    starness: 0.35,
  },
  {
    t: 0.28,
    name: 'dawn',
    zenith: 0x7ba3cf,
    horizon: 0xffc9a0,
    sun: 0xffc07a,
    bounce: 0x8a6f56,
    fog: 0xd9b7a4,
    elevation: 0.16,
    azimuth: 0.95,
    exposure: 0.95,
    starness: 0,
  },
  {
    t: 0.42,
    name: 'morning',
    zenith: 0x8dc0e8,
    // Was 0xdceaf2, which is within a few per cent of white. A near-white
    // horizon key does two bad things at once: it leaves the lower sky with
    // no colour to differ from the cloud in it, and — because this same
    // value is the world's sideways ambient — it lifts every vertical
    // surface in the frame until there is no dark left to compose with.
    horizon: 0xbfd4e6,
    sun: 0xfff0d0,
    bounce: 0x7d8a5c,
    fog: 0xcfe0ec,
    elevation: 0.62,
    azimuth: 0.6,
    exposure: 1.02,
    starness: 0,
  },
  {
    t: 0.55,
    name: 'high day',
    zenith: 0x86bde6,
    // See the note on morning. Noon is the frame with the least colour in it
    // and the most to lose from a white horizon.
    horizon: 0xc8d8e4,
    sun: 0xfff6e2,
    bounce: 0x87945f,
    fog: 0xd6e6f0,
    elevation: 1.05,
    azimuth: 0.0,
    exposure: 1.05,
    starness: 0,
  },
  {
    t: 0.7,
    name: 'afternoon',
    zenith: 0x8ec2df,
    horizon: 0xf3dcbc,
    sun: 0xffe2ac,
    bounce: 0x8b8452,
    fog: 0xdfd8c8,
    elevation: 0.5,
    azimuth: -0.7,
    exposure: 1.0,
    starness: 0,
  },
  {
    t: 0.82,
    name: 'golden hour',
    zenith: 0x6f96c4,
    horizon: 0xffa869,
    sun: 0xff9d5c,
    bounce: 0x8a5f42,
    fog: 0xe8b391,
    elevation: 0.12,
    azimuth: -1.05,
    exposure: 0.98,
    starness: 0,
  },
  {
    t: 0.9,
    name: 'dusk',
    zenith: 0x3c4a7a,
    horizon: 0xc2718a,
    sun: 0xd98a86,
    bounce: 0x4c4258,
    fog: 0x8a7c96,
    elevation: -0.1,
    azimuth: -1.2,
    exposure: 0.8,
    starness: 0.45,
  },
];

const scratchA = new Color();
const scratchB = new Color();

/** Interpolated sky state at a point in the day. */
export interface SkyState {
  zenith: Color;
  horizon: Color;
  sun: Color;
  bounce: Color;
  fog: Color;
  sunDirection: Vector3;
  exposure: number;
  starness: number;
  /** Blend label, for debug overlays and the journal. */
  label: string;
}

/**
 * Sample the palette. `t` wraps, so 1.05 and 0.05 are the same moment —
 * the day loop never has to clamp at its own seam.
 */
export function skyStateAt(t: number): SkyState {
  const time = ((t % 1) + 1) % 1;
  const keys = SKY_KEYS;

  let i = 0;
  for (let k = 0; k < keys.length; k++) {
    if (keys[k].t <= time) i = k;
  }
  const a = keys[i];
  const b = keys[(i + 1) % keys.length];
  let span = b.t - a.t;
  if (span <= 0) span += 1;
  let local = (time - a.t) / span;
  if (local < 0) local += 1 / span;
  local = Math.min(1, Math.max(0, local));
  // Ease the blend so the sky lingers in each named mood and moves quickly
  // between them, rather than spending the whole day in between two.
  const e = local * local * (3 - 2 * local);

  const elevation = a.elevation + (b.elevation - a.elevation) * e;
  const azimuth = a.azimuth + (b.azimuth - a.azimuth) * e;

  return {
    zenith: mixHex(a.zenith, b.zenith, e).clone(),
    horizon: mixHex(a.horizon, b.horizon, e).clone(),
    sun: mixHex(a.sun, b.sun, e).clone(),
    bounce: mixHex(a.bounce, b.bounce, e).clone(),
    fog: mixHex(a.fog, b.fog, e).clone(),
    sunDirection: new Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation),
    ).normalize(),
    exposure: a.exposure + (b.exposure - a.exposure) * e,
    starness: a.starness + (b.starness - a.starness) * e,
    label: e < 0.5 ? a.name : b.name,
  };
}

function mixHex(a: number, b: number, t: number): Color {
  scratchA.setHex(a);
  scratchB.setHex(b);
  return scratchA.lerp(scratchB, t);
}

/**
 * Push a sky state into the shared painterly uniforms and the sun light.
 * This is the one function that couples "what time is it" to "what does
 * everything look like".
 */
export function applyTimeOfDay(
  globals: PainterlyGlobals,
  state: SkyState,
  sunLight?: { color: Color; intensity: number },
): void {
  globals.uSkyColor.value.copy(state.zenith);
  globals.uHorizonColor.value.copy(state.horizon);
  globals.uSunColor.value.copy(state.sun);
  globals.uGroundBounce.value.copy(state.bounce);
  globals.uFogColor.value.copy(state.fog);
  globals.uSunDirection.value.copy(state.sunDirection);
  globals.uExposure.value = state.exposure;

  if (sunLight) {
    sunLight.color.copy(state.sun);
    // Below the horizon the sun stops throwing shadows entirely rather than
    // inverting them, and moonlight takes over as a dim cool key.
    const above = Math.max(0, state.sunDirection.y);
    sunLight.intensity = 0.15 + above * 1.15;
  }
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  // Strip translation so the dome is always centred on the camera, and
  // force w = z so it renders at the far plane without a huge radius.
  vec4 clip = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uStarness;
uniform float uTime;

varying vec3 vDirection;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/** Value noise on the dome's own coordinates. Two octaves is enough for cloud. */
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.3 + 7.1) * 0.3 + vnoise(p * 4.7 + 19.3) * 0.15;
}

void main() {
  vec3 dir = normalize(vDirection);
  float height = dir.y;

  // Gradient.
  //
  // The edges here are the whole reason the sky used to be blank paper. The
  // ramp ran smoothstep(0.44, 0.92, t), and t is 0.5 at the horizon: it did
  // not reach the halfway point of that ramp until about seventeen degrees
  // of elevation, which is above the top of a forty-two-degree frame pitched
  // slightly down. The camera therefore never saw the zenith colour at all,
  // and every daylight frame had a third to a half of its area filled with
  // undifferentiated horizon wash. Bringing the ramp into 0.50..0.66 puts
  // the blue where the camera is actually looking. The pow() is kept: it is
  // what stops the warm horizon band washing halfway up the sky.
  float t = pow(clamp(height * 0.5 + 0.5, 0.0, 1.0), 0.9);
  vec3 color = mix(uHorizon, uZenith, smoothstep(0.50, 0.66, t));

  // A tighter band of extra horizon warmth just above the skyline.
  float band = exp(-abs(height) * 7.0);
  color = mix(color, uHorizon, band * 0.55);

  // --- cloud -------------------------------------------------------------
  // Two drifting sheets of fbm, masked to the band of sky the camera can see
  // and faded out at both ends of it. Sheets rather than a single layer
  // because one layer of noise reads as marble; two at different scales and
  // speeds read as weather. They are tinted between the horizon colour and
  // white, so they take the time of day for free — pink at dusk, near-white
  // at noon — which is the same trick the whole world's lighting uses and
  // costs nothing beyond the uniforms already here.
  //
  // Drawn on the dome rather than as geometry: no mesh, no texture, no
  // bundle. The projection divides the direction by its own height, so a
  // sheet flattens toward the horizon the way a real one does.
  float cloudBand = smoothstep(0.015, 0.14, height) * smoothstep(0.92, 0.34, height);
  if (cloudBand > 0.001) {
    vec2 plane = dir.xz / max(height + 0.16, 0.05);
    float drift = uTime * 0.004;
    float low = fbm(plane * 0.85 + vec2(drift, drift * 0.3));
    float high = fbm(plane * 2.1 + vec2(-drift * 1.7, drift * 0.9) + 31.0);
    // Sharpened well off centre so the sky is mostly empty. Cloud that
    // covers half the dome is overcast, and this game is not overcast.
    float cover = smoothstep(0.52, 0.78, low * 0.72 + high * 0.28);
    float lit = smoothstep(0.5, 0.85, low);
    vec3 cloudColor = mix(uHorizon, vec3(1.0), 0.35 + lit * 0.5);
    color = mix(color, cloudColor, cover * cloudBand * 0.85);
  }

  // Sun: a soft disc plus a wide bloom. No hard edge — a crisp disc reads
  // as a decal pasted on a painting.
  float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
  float disc = smoothstep(0.995, 0.9995, sunDot);
  float bloom = pow(sunDot, 42.0) * 0.55 + pow(sunDot, 6.0) * 0.16;
  color += uSunColor * (disc * 0.9 + bloom);

  // Stars, faded in by night and by altitude so they don't sit in the fog.
  if (uStarness > 0.001) {
    vec2 grid = dir.xz / max(abs(dir.y) + 0.22, 0.06) * 34.0;
    vec2 cell = floor(grid);
    float star = hash21(cell);
    float bright = smoothstep(0.982, 1.0, star);
    if (bright > 0.0) {
      vec2 local = fract(grid) - 0.5 - (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.6;
      float dist = length(local);
      float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + star * 40.0);
      float point = smoothstep(0.16, 0.0, dist) * bright * twinkle;
      color += vec3(0.85, 0.88, 1.0) * point * uStarness * smoothstep(0.02, 0.35, height);
    }
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly mesh: Mesh;
  private readonly uniforms: {
    uZenith: IUniform<Color>;
    uHorizon: IUniform<Color>;
    uSunColor: IUniform<Color>;
    uSunDirection: IUniform<Vector3>;
    uStarness: IUniform<number>;
    uTime: IUniform<number>;
  };

  constructor() {
    this.uniforms = {
      uZenith: { value: new Color(0x86bde6) },
      uHorizon: { value: new Color(0xe4eef4) },
      uSunColor: { value: new Color(0xfff6e2) },
      uSunDirection: { value: new Vector3(0, 1, 0) },
      uStarness: { value: 0 },
      uTime: { value: 0 },
    };

    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      // Rendered first with depth test off; everything else draws over it.
      depthTest: false,
      fog: false,
    });

    this.mesh = new Mesh(new SphereGeometry(1, 32, 16), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  apply(state: SkyState, timeSeconds: number): void {
    this.uniforms.uZenith.value.copy(state.zenith);
    this.uniforms.uHorizon.value.copy(state.horizon);
    this.uniforms.uSunColor.value.copy(state.sun);
    this.uniforms.uSunDirection.value.copy(state.sunDirection);
    this.uniforms.uStarness.value = state.starness;
    this.uniforms.uTime.value = timeSeconds;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
  }
}
