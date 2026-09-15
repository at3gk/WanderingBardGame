// skylight-sat — the lit-vs-shade saturation instrument ROADMAP task 194
// asked for before any shader change: does a non-cast, form-shaded face
// (a slope turned away from the sun, lit only by the sky) actually lose
// its saturation the way `docs/color-script.md`'s noon section suspects?
//
// This is the "skylight ambient" gap, not the cast-shadow one: task 166
// piece 2 already measured and fixed cast-shadow colour
// (`CAST_SHADOW_HUE`/`CAST_SHADOW_CHROMA_CAP`, shadowcast.mjs verifies
// it). `skyLight` (painterly.ts:1604) feeds every non-cast, form-shaded
// fragment instead, via the `scatter`/`castGain` additive term at line
// 1749 — general shade richness — and no standing instrument measured
// it: shadowcast.mjs is cast-shadow-only by construction, figground.mjs
// measures figure-vs-surround. See ROADMAP task 194's own entry for the
// full account of why this is the right next step before touching
// `skyLight`'s saturation.
//
// Technique — the same "freeze the frame, re-render with one thing
// changed, diff/read pixels" every tool/ script here uses, plus one
// pitfall this script is the first to hit and worth recording for
// whatever's written after it:
//
//   1. Capture the frame as shipped (`base`), full pipeline
//      (`App.renderFrame`, the ACES/LUT finishing pass everything else
//      in tools/ also shoots through).
//   2. Turn the sun's shadow map off and capture again (`noShadow`) —
//      shadowcast.mjs's own technique — building a cast-shadow mask so
//      a genuinely cast-shadowed pixel is excluded, not counted as
//      "shaded". The two must stay apart: painterly.ts's own comment
//      at the `sunFacing`/`sunAmount` split (lines ~1541-1555) says the
//      additive skylight terms "must be able to tell 'this face is
//      turned away from the sun' ... from 'this face is behind
//      something'" — this instrument makes exactly that distinction.
//   3. Swap every terrain mesh's material (named `terrain-<index>`,
//      `WorldStreamer.ts`) for a tiny debug shader that outputs
//      dot(worldNormal, sunDirection)*0.5+0.5 as a grayscale value —
//      painterly.ts's own `lit` quantity (line 1536), from the real
//      per-vertex analytic heightfield normal.
//      Terrain only, deliberately: trees/shrubs/rocks/logs are
//      instanced (painterly.ts's USE_INSTANCING path, per
//      scatter-probe.mjs/largeFormAnchors.test.ts), and this debug
//      material doesn't apply `instanceMatrix`, so swapping their
//      material would draw every instance at one shared wrong
//      transform. Terrain alone already gives the "north-facing slope"
//      case task 194 names; canopy underside is left for whichever
//      future piece actually needs it.
//      THE PITFALL: this pass (and the id pass below) must NOT go
//      through `App.renderFrame`/`finishing.render()`. A constant
//      0.5 gray written straight to `gl_FragColor` came back as 0.80
//      through the full pipeline (measured live while building this
//      tool) — the finishing composite applies ACES tonemapping and
//      the scene's 3D LUT to the *whole* target, not per-material, so
//      it grades a debug shader's raw output exactly like it grades
//      real lighting, `material.toneMapped = false` included (that
//      flag only suppresses a material's own tonemapping chunk, and
//      this custom shader never had one to suppress). The fix: call
//      `renderer.render(scene, camera)` directly, bypassing
//      `finishing` entirely, for the debug passes only. Verified live
//      afterward: constants 0/0.25/0.5/0.75/1.0 round-tripped to
//      exactly 0/64/128/191/255. `base`/`noShadow` still want the full
//      pipeline — they measure what actually ships.
//   4. Read a second debug pass the same (bypassed) way: terrain
//      meshes painted flat magenta, nothing else touched. A pixel
//      counts as terrain only if this id pass reads pure magenta at
//      that pixel — real depth testing during the render means a tree
//      standing in front of a terrain slope still correctly occludes
//      it, no separate occlusion check needed. (An earlier version of
//      this tool tried to skip the id pass and detect "terrain" by
//      whether the ndl pass pixel was merely gray — wrong, because
//      hazy sky/fog near the horizon is *also* close to gray and was
//      the majority of what got counted. Keeping both passes.)
//   5. Bucket the surviving terrain pixels by the ndl pass's luma into
//      "lit" (painterly.ts's band3 edge, >=0.86) and "shaded, non-cast"
//      (painterly.ts's band1 edge, <=0.46) — now that the pipeline
//      pitfall is fixed these can sit right at the shader's own
//      thresholds, no LUT-curvature margin needed — excluding anything
//      the shadow mask from step 2 already claims. Read each bucket's
//      actual shipped colour from `base` and compare HSV saturation.
//
// One honest limitation, not a bug: at low sun (dawn, golden) almost no
// terrain pixel reaches band3 (>=0.86 needs a slope tilted hard into a
// sun that's barely above the horizon), so `lit` can legitimately come
// back with n=0 or a tiny sample at those hours. That is itself useful
// data for whatever piece tries the luma-preserving chroma boost task
// 194 describes: it needs to "stay out of the CARRYING hours" anyway,
// and this instrument shows those hours barely have a "lit" terrain
// population to compare against in the first place.
//
// A second, related finding from live-running this against the three
// pinned poses while building it: at noon, in-frame terrain rarely sits
// cleanly past *either* band edge (mostly the band1-band3 transition,
// partially lit) — so the strict `lit`/`shadeNonCast` two-bucket compare
// can come back with one or both `null` even at the hour task 194 cares
// about most. Rather than loosen the thresholds until the buckets fill
// (which would stop meaning what painterly.ts's own bands mean),
// `litGradient` reports mean saturation across five even luma bins
// spanning the full [0,1] range, so the actual shape is visible even
// when the two strict extremes are thin or empty.
import { BASE_URL, launch } from './browser.mjs';

const SHOTS = [
  { name: '01-dawn-road', s: 60, day: 0.24, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '09-phone-landscape', s: 900, day: 0.82, phase: 'busking', viewport: [844, 390] },
];

const outDir = process.argv[2] ?? null;

async function measureShot(page) {
  return page.evaluate(async () => {
    const app = window.bard?.app;
    const stage = window.bard?.stage;
    if (!app || !stage) return { error: 'no handle' };

    app.stop();

    const renderer = app.renderer;
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    // Full pipeline (ACES + the scene's LUT) — what actually ships.
    const captureShipped = () => {
      app.renderFrame(stage.scene, stage.camera);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    // Bypasses `finishing` entirely — raw linear readback for the debug
    // passes. See the header comment's PITFALL note for why this exists.
    const captureRaw = () => {
      renderer.setRenderTarget(null);
      renderer.render(stage.scene, stage.camera);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };

    const sun = app.sun;
    if (!sun || !sun.castShadow) return { error: 'no shadow-casting sun (quality tier?)' };

    const base = captureShipped();
    sun.castShadow = false;
    const noShadow = captureShipped();
    sun.castShadow = true;

    const terrainMeshes = [];
    stage.scene.traverse((o) => {
      if (o.isMesh && /^terrain-/.test(o.name || '')) terrainMeshes.push(o);
    });
    if (terrainMeshes.length === 0) return { error: 'no terrain meshes found' };

    const ShaderMaterial = terrainMeshes[0].material.constructor;
    const sunDir = app.globals.uSunDirection.value;

    const idMat = new ShaderMaterial({
      toneMapped: false,
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
        }
      `,
    });
    const ndlMat = new ShaderMaterial({
      toneMapped: false,
      uniforms: { uSunDir: { value: sunDir.clone() } },
      vertexShader: `
        varying vec3 vWNormal;
        void main() {
          vWNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying vec3 vWNormal;
        void main() {
          float lit = dot(normalize(vWNormal), normalize(uSunDir)) * 0.5 + 0.5;
          gl_FragColor = vec4(vec3(lit), 1.0);
        }
      `,
    });
    const originalMats = terrainMeshes.map((m) => m.material);
    terrainMeshes.forEach((m) => {
      m.material = idMat;
    });
    const idPass = captureRaw();
    terrainMeshes.forEach((m) => {
      m.material = ndlMat;
    });
    const ndlPass = captureRaw();
    terrainMeshes.forEach((m, i) => {
      m.material = originalMats[i];
    });
    idMat.dispose();
    ndlMat.dispose();
    // Leave the canvas showing the real, shipped frame for whatever
    // screenshot the caller takes below, not the last debug pass.
    captureShipped();

    const luma = (px, i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const hsv = (px, i) => {
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let hDeg = 0;
      if (d > 0) {
        if (max === r) hDeg = 60 * (((g - b) / d) % 6);
        else if (max === g) hDeg = 60 * ((b - r) / d + 2);
        else hDeg = 60 * ((r - g) / d + 4);
        if (hDeg < 0) hDeg += 360;
      }
      return { h: hDeg, s: max === 0 ? 0 : d / max, v: max };
    };

    const SHADOW_THRESH = 8; // shadowcast.mjs's own cast-shadow threshold
    const SHADE_LUMA = 255 * 0.46; // painterly.ts's band1 edge (line ~1537)
    const LIT_LUMA = 255 * 0.86; // painterly.ts's band3 edge (line ~1538)
    // A same-shot lit/shade comparison at those exact band edges turned
    // out to be too strict a target for these three pinned poses (see
    // below) — most in-frame terrain sits in the band1-band3 transition,
    // not past either edge. A 5-way luma split across the full [0,1]
    // range is kept alongside the strict two-bucket one so the gradient
    // is visible even when the strict buckets come back empty.
    const BIN_EDGES = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

    let litS = 0, litN = 0, litH = 0, litV = 0;
    let shadeS = 0, shadeN = 0, shadeH = 0, shadeV = 0;
    let terrainPixels = 0, shadowExcluded = 0;
    const bins = BIN_EDGES.slice(0, -1).map(() => ({ n: 0, s: 0, h: 0, v: 0 }));

    for (let i = 0; i < idPass.length; i += 4) {
      // The id pass is flat, unlit magenta with no antialiasing seam
      // tolerance needed beyond this: any real terrain fragment reads
      // exactly (255, 0, 255), anything else is whatever the real scene
      // put there (sky, a tree, the bard, the road).
      if (!(idPass[i] > 200 && idPass[i + 2] > 200 && idPass[i + 1] < 50)) continue;
      terrainPixels++;
      if (luma(noShadow, i) - luma(base, i) > SHADOW_THRESH) {
        shadowExcluded++;
        continue; // genuinely cast-shadowed — outside this instrument's target
      }
      const l = luma(ndlPass, i);
      const c = hsv(base, i);
      if (l <= SHADE_LUMA) {
        shadeS += c.s; shadeH += c.h; shadeV += c.v; shadeN++;
      } else if (l >= LIT_LUMA) {
        litS += c.s; litH += c.h; litV += c.v; litN++;
      }
      const bi = Math.min(bins.length - 1, Math.floor((l / 255) * bins.length));
      const bin = bins[bi];
      bin.n++; bin.s += c.s; bin.h += c.h; bin.v += c.v;
    }

    const summarize = (n, s, h, v) => ({
      n,
      sMean: Math.round((s / n) * 1000) / 1000,
      hMeanDeg: Math.round(h / n),
      vMean: Math.round((v / n) * 1000) / 1000,
    });

    return {
      frame: { w, h },
      terrainPixels,
      shadowExcluded,
      lit: litN ? summarize(litN, litS, litH, litV) : null,
      shadeNonCast: shadeN ? summarize(shadeN, shadeS, shadeH, shadeV) : null,
      saturationKeptPct:
        litN && shadeN
          ? Math.round((shadeS / shadeN / (litS / litN)) * 1000) / 10
          : null,
      litGradient: bins.map((b, i) => ({
        litRange: [BIN_EDGES[i], BIN_EDGES[i + 1]],
        ...(b.n ? summarize(b.n, b.s, b.h, b.v) : { n: 0 }),
      })),
    };
  });
}

const browser = await launch();
for (const shot of SHOTS) {
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    console.log(`${shot.name}: game never booted`);
    await page.close();
    continue;
  }
  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    shot,
  );
  await page.waitForTimeout(1800);
  const r = await measureShot(page);
  console.log(`\n=== ${shot.name} ===`);
  console.log(JSON.stringify(r, null, 2));
  if (outDir && !r.error) {
    await page.screenshot({ path: `${outDir}/${shot.name}-frozen.png`, timeout: 120000 });
  }
  await page.close();
}
await browser.close();
