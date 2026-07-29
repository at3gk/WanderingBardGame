/**
 * Ambient particles: fireflies, drifting seed-fluff, falling leaves, dust
 * in the light, embers over the fire.
 *
 * These are **entirely GPU-resident**. Each particle carries a handful of
 * static attributes (a seed, a home offset, a speed) and computes its own
 * position in the vertex shader from `uTime`; nothing is simulated on the
 * CPU and no buffer is ever re-uploaded. The alternative — stepping a few
 * thousand particles in JavaScript and pushing an instance matrix buffer
 * every frame — is one of the reliable ways to lose a phone's frame budget
 * to something the player registers as "nice atmosphere".
 *
 * The particles live in a box that follows the bard, and each one wraps
 * around that box using `mod`. So the field is effectively infinite, has a
 * fixed cost, and never pops: a firefly that leaves the box on the left
 * re-enters on the right at a position it would plausibly have drifted to.
 *
 * They are drawn as camera-facing quads with a soft radial falloff, additively
 * blended and depth-tested but not depth-written, which is the combination
 * that lets a hundred overlapping motes build up into a glow instead of a
 * stack of visible discs.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mulberry32 } from '../../core/rng';

export type ParticleKind = 'firefly' | 'fluff' | 'leaf' | 'dust' | 'ember';

export interface ParticleFieldOptions {
  kind: ParticleKind;
  count: number;
  /** Half-extent of the box the field wraps in, metres. */
  extent: Vector3;
  /** Vertical offset of the box's centre from the follow point. */
  centreY?: number;
  color: number;
  colorAlt?: number;
  size: number;
  /** Metres per second of drift. */
  speed: number;
  /** How much the particle bobs perpendicular to its drift. */
  wander?: number;
  /** 0 = never blinks, 1 = blinks hard. Fireflies only. */
  blink?: number;
  /** Falling speed. Leaves and embers use this; fireflies do not. */
  fall?: number;
  additive?: boolean;
}

const VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uOrigin;
uniform vec3 uExtent;
uniform float uCentreY;
uniform float uSize;
uniform float uSpeed;
uniform float uWander;
uniform float uFall;
uniform float uOpacity;
uniform float uBlink;
uniform vec3 uWindDirection;
uniform float uWindStrength;

attribute vec3 aHome;
attribute vec4 aSeed;

varying vec2 vUv;
varying float vAlpha;
varying float vTint;

void main() {
  vUv = position.xy;

  vec3 box = uExtent * 2.0;
  vec3 centre = uOrigin + vec3(0.0, uCentreY, 0.0);

  // Drift. Each particle gets its own direction and rate from its seed, and
  // the wind pushes the whole field. Using the same wind uniform the grass
  // and the cloak read is deliberate — a firefly that ignores a gust the
  // grass is bending in breaks the illusion faster than a worse-looking
  // firefly would.
  vec3 drift = vec3(
    sin(aSeed.x * 12.9 + uTime * uSpeed * (0.4 + aSeed.y * 0.6)),
    sin(aSeed.y * 7.3 + uTime * uSpeed * 0.7),
    cos(aSeed.z * 9.1 + uTime * uSpeed * (0.3 + aSeed.x * 0.5))
  ) * uWander;

  vec3 pos = aHome + drift;
  pos += uWindDirection * uWindStrength * uTime * uSpeed * 0.35;
  pos.y -= uFall * uTime * (0.6 + aSeed.w * 0.8);

  // Wrap into the box around the follow point. The mod-of-a-mod keeps this
  // correct for negative values, which a plain mod() does not.
  vec3 rel = pos - centre + uExtent;
  rel = mod(mod(rel, box) + box, box);
  vec3 world = rel - uExtent + centre;

  // Fade out at the box edges so nothing is ever seen to wrap.
  vec3 edge = 1.0 - smoothstep(uExtent * 0.62, uExtent, abs(world - centre));
  float edgeFade = min(edge.x, min(edge.y, edge.z));

  float blink = 1.0;
  if (uBlink > 0.0) {
    // Slow, irregular, and never fully off — a firefly that goes black is
    // a firefly that pops back in, which reads as a rendering fault.
    float b = sin(uTime * (0.7 + aSeed.z * 1.3) + aSeed.w * 30.0);
    blink = mix(1.0, smoothstep(-0.5, 0.9, b), uBlink);
  }

  vAlpha = uOpacity * edgeFade * blink;
  vTint = aSeed.y;

  // Camera-facing quad. Built from the view matrix's basis vectors rather
  // than a lookAt per particle, which is the cheap way to billboard.
  vec4 view = viewMatrix * vec4(world, 1.0);
  float size = uSize * (0.6 + aSeed.x * 0.8);
  view.xy += position.xy * size;

  gl_Position = projectionMatrix * view;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColorAlt;
uniform float uSoftness;

varying vec2 vUv;
varying float vAlpha;
varying float vTint;

void main() {
  float d = length(vUv) * 2.0;
  // Two-stage falloff: a small bright core inside a much wider soft halo.
  // A single smoothstep gives an evenly-shaded disc that reads as a bokeh
  // circle rather than a light.
  float core = smoothstep(1.0, 0.0, d) ;
  float halo = smoothstep(1.0, 0.15, d);
  float alpha = (core * core * 0.75 + halo * uSoftness) * vAlpha;
  if (alpha < 0.004) discard;
  vec3 color = mix(uColor, uColorAlt, vTint);
  gl_FragColor = vec4(color, alpha);
}
`;

export class ParticleField {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly geometry: InstancedBufferGeometry;

  constructor(options: ParticleFieldOptions, seed = 1) {
    const {
      kind,
      count,
      extent,
      centreY = 0,
      color,
      colorAlt = color,
      size,
      speed,
      wander = 0.6,
      blink = 0,
      fall = 0,
      additive = true,
    } = options;

    const rand = mulberry32(seed + kind.length * 7919);

    // One quad, instanced. The base geometry is in "unit quad" space and
    // the vertex shader scales it in view space, so a particle is always
    // exactly `size` metres across regardless of orientation.
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([
          -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
          -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
        ]),
        3,
      ),
    );

    const homes = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      homes[i * 3] = (rand() * 2 - 1) * extent.x;
      homes[i * 3 + 1] = (rand() * 2 - 1) * extent.y + centreY;
      homes[i * 3 + 2] = (rand() * 2 - 1) * extent.z;
      seeds[i * 4] = rand();
      seeds[i * 4 + 1] = rand();
      seeds[i * 4 + 2] = rand();
      seeds[i * 4 + 3] = rand();
    }
    geometry.setAttribute('aHome', new InstancedBufferAttribute(homes, 3));
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    geometry.instanceCount = count;
    // The wrap makes any bounding volume meaningless — the field is always
    // around the camera, so culling it can only ever be wrong.
    geometry.boundingSphere = null;

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOrigin: { value: new Vector3() },
        uExtent: { value: extent.clone() },
        uCentreY: { value: centreY },
        uSize: { value: size },
        uSpeed: { value: speed },
        uWander: { value: wander },
        uFall: { value: fall },
        uOpacity: { value: 1 },
        uBlink: { value: blink },
        uColor: { value: new Color(color) },
        uColorAlt: { value: new Color(colorAlt) },
        uSoftness: { value: additive ? 0.35 : 0.6 },
        uWindDirection: { value: new Vector3(1, 0, 0.35).normalize() },
        uWindStrength: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });

    this.geometry = geometry;
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.name = `particles-${kind}`;
  }

  /** Move the field's box to follow a point, and advance its clock. */
  update(origin: Vector3, time: number, windDirection: Vector3, windStrength: number): void {
    this.material.uniforms.uOrigin.value.copy(origin);
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWindDirection.value.copy(windDirection);
    this.material.uniforms.uWindStrength.value = windStrength;
  }

  /** 0 hides the field entirely; the draw call is skipped when invisible. */
  setOpacity(opacity: number): void {
    this.material.uniforms.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.001;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * The stock fields, keyed to when they should appear.
 *
 * Fireflies only after dusk, fluff in the open biomes by day, leaves in the
 * forest, dust wherever the sun is low enough to shaft through anything.
 * The weighting by time of day is what stops the world reading as "the
 * particle system is on" and starts it reading as evening.
 */
export function fireflies(count: number): ParticleFieldOptions {
  return {
    kind: 'firefly',
    count,
    extent: new Vector3(28, 3.2, 28),
    centreY: 1.4,
    color: 0xc8ff9a,
    colorAlt: 0xfff2a8,
    size: 0.16,
    speed: 0.35,
    wander: 1.6,
    blink: 0.85,
    additive: true,
  };
}

export function seedFluff(count: number): ParticleFieldOptions {
  return {
    kind: 'fluff',
    count,
    extent: new Vector3(34, 6, 34),
    centreY: 3,
    color: 0xfff6e0,
    colorAlt: 0xe8f0c8,
    size: 0.1,
    speed: 0.5,
    wander: 1.1,
    fall: 0.12,
    additive: false,
  };
}

export function fallingLeaves(count: number, color: number, colorAlt: number): ParticleFieldOptions {
  return {
    kind: 'leaf',
    count,
    extent: new Vector3(26, 7, 26),
    centreY: 4,
    color,
    colorAlt,
    size: 0.16,
    speed: 0.7,
    wander: 1.9,
    fall: 0.55,
    additive: false,
  };
}

export function sunDust(count: number): ParticleFieldOptions {
  return {
    kind: 'dust',
    count,
    extent: new Vector3(20, 5, 20),
    centreY: 2.4,
    color: 0xfff0cf,
    colorAlt: 0xffd9a0,
    size: 0.07,
    speed: 0.22,
    wander: 0.8,
    additive: true,
  };
}

export function embers(count: number): ParticleFieldOptions {
  return {
    kind: 'ember',
    count,
    extent: new Vector3(1.6, 2.4, 1.6),
    centreY: 1.5,
    color: 0xffb257,
    colorAlt: 0xff7a3c,
    size: 0.075,
    speed: 0.9,
    wander: 0.5,
    // Negative fall: embers rise. Reusing the same uniform rather than
    // adding a second one keeps the shader to one branch fewer.
    fall: -0.55,
    additive: true,
  };
}
