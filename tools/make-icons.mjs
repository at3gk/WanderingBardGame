// make-icons — renders the favicon mark to the PNG icons the web app
// manifest needs, with no npm dependencies and no image library.
//
// Why this exists at all: an installed home-screen web app is exempt from
// Safari's 7-day storage eviction, so the manifest + these icons are what
// keeps a player's save alive on iPad (see index.html for the full note).
// A manifest whose icons 404 is a manifest iOS and Android will refuse to
// install, which makes "generate three PNGs" a save-system chore rather
// than a branding one.
//
// Why hand-rolled: the mark is a rounded rect and two concentric circles.
// Pulling in a canvas or PNG library to draw that — plus a native build
// step on every machine and CI runner — costs more than the ~80 lines of
// encoder below. node:zlib already does the hard part (DEFLATE); a PNG is
// then just four length-tagged, CRC'd chunks around it.
//
// Output is deterministic: same pixels, same bytes, every run. PNG has no
// mandatory timestamp chunk and we write none, so re-running this never
// churns the committed files. `node tools/make-icons.mjs` self-checks that.
//
// Usage: node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// The mark, in the favicon's own 32-unit coordinate space (index.html's
// inline SVG is the source of truth; keep these in sync with it).
const BG = [0x1a, 0x16, 0x21];
const RING = [0xc9, 0x8a, 0x5b];
const CORE = [0xe8, 0xd9, 0xc0];
const RING_R = 9 / 32;
const CORE_R = 4 / 32;

// Every size is full-bleed: the background colour fills the whole square and
// nothing is transparent. Two reasons, one per platform.
//   - iOS composites its own rounded mask over apple-touch-icon, so
//     transparent corners of our own don't show through as rounded — they
//     show through as BLACK, framing the icon in a dark square.
//   - The manifest declares purpose "any maskable", and a maskable icon is
//     allowed to be cropped to any shape inside its outer 10% on each side.
//     That requires an edge-to-edge background with the mark inside the
//     central 80% safe zone. The ring is r=9/32, i.e. 56% of the width —
//     comfortably inside it.
// So "no rounded corners anywhere" is both the correct answer and the
// simplest one; the rounded rect only lives on in the SVG favicon, where a
// browser tab draws it against arbitrary chrome colours.
const SIZES = [
  { file: 'icon-512.png', px: 512 },
  { file: 'icon-192.png', px: 192 },
  { file: 'apple-touch-icon.png', px: 180 },
];

// Subsamples per pixel per axis. The mark is two big flat circles, so their
// edges are the only detail in the image and aliasing there is the only
// thing anyone would notice. 8x8 gives 65 coverage levels, which reads as a
// clean curve at 180px; 4x4's 17 levels visibly staircase on an arc this
// long.
const SS = 8;

/**
 * Renders the mark at `px` square and returns raw RGBA bytes (4 per pixel,
 * top row first) — the layout PNG's filter-0 scanlines want.
 *
 * Coverage, not hard tests: each pixel samples an SS x SS grid of subpixel
 * points and counts how many land inside each circle. That fraction is the
 * blend weight, so an edge pixel gets a partial mix of the two colours it
 * straddles instead of picking one. Painter's order — background, ring,
 * core — matches the SVG's.
 */
function render(px) {
  const cx = px / 2;
  const cy = px / 2;
  const ringR2 = (RING_R * px) ** 2;
  const coreR2 = (CORE_R * px) ** 2;
  const step = 1 / SS;
  const total = SS * SS;

  const out = Buffer.alloc(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let ringHits = 0;
      let coreHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        const py = y + (sy + 0.5) * step - cy;
        const py2 = py * py;
        for (let sx = 0; sx < SS; sx++) {
          const pxx = x + (sx + 0.5) * step - cx;
          const d2 = pxx * pxx + py2;
          if (d2 <= ringR2) ringHits++;
          if (d2 <= coreR2) coreHits++;
        }
      }
      const ringA = ringHits / total;
      const coreA = coreHits / total;

      const i = (y * px + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = BG[c];
        v = v + (RING[c] - v) * ringA;
        v = v + (CORE[c] - v) * coreA;
        out[i + c] = Math.round(v);
      }
      out[i + 3] = 255; // full-bleed: opaque everywhere
    }
  }
  return out;
}

// Standard PNG/zlib CRC-32 (polynomial 0xEDB88320, reflected). Table built
// once at module load rather than shipped as a literal.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** One PNG chunk: length, 4-char type, data, CRC over type+data. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Encodes RGBA bytes as an 8-bit truecolour-with-alpha PNG.
 *
 * Filter byte 0 (None) on every scanline: the image is flat colour and
 * smooth arcs, so a smarter filter would buy a few hundred bytes on files
 * that are already tiny, at the cost of code that can be subtly wrong.
 */
function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression: DEFLATE
  ihdr[11] = 0; // filter method: adaptive (per-scanline byte below)
  ihdr[12] = 0; // interlace: none

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

let failed = false;
for (const { file, px } of SIZES) {
  const path = join(OUT_DIR, file);
  const png = encodePng(render(px), px, px);
  writeFileSync(path, png);

  // Read it back rather than trusting the buffer we just wrote: this is the
  // only check that the file on disk is a PNG a browser would accept.
  const back = readFileSync(path);
  const sig = back.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const w = back.readUInt32BE(16);
  const h = back.readUInt32BE(20);
  const ok = sig && w === px && h === px;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(20)} ${w}x${h}  ${back.length} bytes` +
      (sig ? '' : '  (bad PNG signature)')
  );
}

if (failed) process.exit(1);
