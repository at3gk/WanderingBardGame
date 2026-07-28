/**
 * A minimal stage that exercises every part of the render foundation:
 * painterly material (solid, vertex-coloured, instanced, swaying),
 * shadows, sky dome, fog, and the time-of-day coupling.
 *
 * This exists to be *checked*, not played. `tools/shader-check.mjs` boots
 * it in a real browser and fails the run if a shader does not compile or a
 * frame does not draw — which is the one class of bug that unit tests
 * cannot see and that silently costs an entire session when it slips in.
 */

import {
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import type { App, Stage } from './App';
import { createFoliageMaterial, createPainterlyMaterial } from './painterly';
import { applyTimeOfDay, Sky, skyStateAt } from './sky';
import { fbm1D, mulberry32 } from '../core/rng';

export class SmokeStage implements Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(52, 1, 0.1, 600);
  private readonly sky = new Sky();
  private readonly app: App;
  private timeOfDay: number;
  private elapsed = 0;

  constructor(app: App, timeOfDay = 0.82) {
    this.app = app;
    this.timeOfDay = timeOfDay;
    this.camera.position.set(0, 4.2, 12);
    this.camera.lookAt(0, 1.4, -6);
    this.scene.add(this.sky.mesh);

    const globals = app.globals;

    // --- ground: a gently rolling vertex-coloured mesh -------------------
    const ground = new PlaneGeometry(220, 220, 96, 96);
    ground.rotateX(-Math.PI / 2);
    const position = ground.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      // Keep a flat corridor down the middle for the road to sit in.
      const corridor = Math.min(1, Math.max(0, (Math.abs(x) - 3.5) / 7));
      const h = (fbm1D(1, x * 0.02, 3) * 2.4 + fbm1D(2, z * 0.017, 3) * 3.1) * corridor;
      position.setY(i, h);
      const tint = 0.86 + fbm1D(3, x * 0.09 + z * 0.07, 2) * 0.14;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint * 1.02;
      colors[i * 3 + 2] = tint * 0.9;
    }
    ground.setAttribute('color', new BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    const groundMesh = new Mesh(
      ground,
      createPainterlyMaterial(globals, {
        color: 0x7f9455,
        colorVariant: 0xc8b56a,
        grain: 0.7,
        grainScale: 0.22,
        rim: 0.1,
        vertexColors: true,
        bandSoftness: 0.1,
      }),
    );
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // --- trees: instanced trunks + canopies, canopies sway --------------
    const rand = mulberry32(4242);
    const count = Math.round(90 * app.quality.foliageDensity);
    const trunkGeo = new CylinderGeometry(0.16, 0.26, 2.6, 6);
    trunkGeo.translate(0, 1.3, 0);
    const canopyGeo = new ConeGeometry(1.7, 3.4, 7);
    canopyGeo.translate(0, 3.9, 0);

    const trunks = new InstancedMesh(
      trunkGeo,
      createPainterlyMaterial(globals, {
        color: 0x6b4f3c,
        colorVariant: 0x8a6a4a,
        rim: 0.25,
        baseShade: 0.4,
        baseShadeHeight: 1.2,
        flatShading: true,
      }),
      count,
    );
    const canopies = new InstancedMesh(
      canopyGeo,
      createFoliageMaterial(globals, {
        color: 0x4f7a44,
        colorVariant: 0x9dbd5e,
        grain: 0.8,
        sway: 0.22,
        swayHeight: 6,
        flatShading: true,
      }),
      count,
    );
    trunks.castShadow = true;
    canopies.castShadow = true;
    canopies.receiveShadow = true;

    const matrix = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    let placed = 0;
    for (let i = 0; i < count * 4 && placed < count; i++) {
      const x = (rand() - 0.5) * 190;
      const z = (rand() - 0.5) * 190;
      if (Math.abs(x) < 5.5) continue;
      const corridor = Math.min(1, Math.max(0, (Math.abs(x) - 3.5) / 7));
      const y = (fbm1D(1, x * 0.02, 3) * 2.4 + fbm1D(2, z * 0.017, 3) * 3.1) * corridor;
      pos.set(x, y, z);
      quat.setFromAxisAngle(new Vector3(0, 1, 0), rand() * Math.PI * 2);
      const s = 0.7 + rand() * 0.8;
      scale.set(s, s * (0.85 + rand() * 0.4), s);
      matrix.compose(pos, quat, scale);
      trunks.setMatrixAt(placed, matrix);
      canopies.setMatrixAt(placed, matrix);
      placed++;
    }
    trunks.count = placed;
    canopies.count = placed;
    this.scene.add(trunks, canopies);

    // --- a stand-in for the bard, to prove shadows and rim light --------
    const figure = new Mesh(
      new CylinderGeometry(0.32, 0.42, 1.6, 8),
      createPainterlyMaterial(globals, {
        color: 0x9a4f56,
        colorVariant: 0xd08a72,
        rim: 0.7,
        rimPower: 2.2,
        sway: 0.05,
        swayHeight: 1.6,
      }),
    );
    figure.position.set(0, 0.8, 0);
    figure.castShadow = true;
    this.scene.add(figure);
  }

  update(dt: number): void {
    this.elapsed += dt;
  }

  render(): void {
    const state = skyStateAt(this.timeOfDay);
    applyTimeOfDay(this.app.globals, state, this.app.sun);
    this.sky.apply(state, this.elapsed);
    this.app.aimSunAt(new Vector3(0, 0, 0));
  }

  setTimeOfDay(t: number): void {
    this.timeOfDay = t;
  }

  dispose(): void {
    this.sky.dispose();
  }
}
