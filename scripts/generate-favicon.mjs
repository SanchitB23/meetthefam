/**
 * Regenerate src/app/favicon.ico from public/logo.svg.
 *
 * Produces a multi-resolution ICO (16×16, 32×32, 48×48) with embedded PNGs
 * using only Node.js built-in modules — no external dependencies required.
 *
 * SVG design (viewBox 0 0 96 96):
 *   - 3 stroked circles  stroke #2D4A3E  stroke-width 3  no fill
 *       cx=48 cy=36 r=18  /  cx=36 cy=56 r=18  /  cx=60 cy=56 r=18
 *   - 1 filled dot  fill #C77B5C  cx=48 cy=50 r=3.2
 *
 * Usage:
 *   node scripts/generate-favicon.mjs
 */

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/app/favicon.ico");
const SIZES = [16, 32, 48];

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function compositeOver(src, dst) {
  const a = src[3] / 255;
  const ia = 1 - a;
  return [
    Math.round(src[0] * a + dst[0] * ia),
    Math.round(src[1] * a + dst[1] * ia),
    Math.round(src[2] * a + dst[2] * ia),
    Math.min(255, Math.round(src[3] + dst[3] * ia)),
  ];
}

// ─── Rasterizer ───────────────────────────────────────────────────────────────

function rasterize(size) {
  const buf = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 255; buf[i * 4 + 1] = 255;
    buf[i * 4 + 2] = 255; buf[i * 4 + 3] = 255;
  }

  const scale = size / 96;

  const shapes = [
    { type: "stroke", cx: 48, cy: 36, r: 18, sw: 3, color: "#2D4A3E" },
    { type: "stroke", cx: 36, cy: 56, r: 18, sw: 3, color: "#2D4A3E" },
    { type: "stroke", cx: 60, cy: 56, r: 18, sw: 3, color: "#2D4A3E" },
    { type: "fill",   cx: 48, cy: 50, r: 3.2,        color: "#C77B5C" },
  ];

  for (const shape of shapes) {
    const rgb = hexToRgb(shape.color);
    const cx = shape.cx * scale;
    const cy = shape.cy * scale;
    const r  = shape.r  * scale;

    if (shape.type === "fill") {
      const x0 = Math.max(0, Math.floor(cx - r - 1));
      const x1 = Math.min(size - 1, Math.ceil(cx + r + 1));
      const y0 = Math.max(0, Math.floor(cy - r - 1));
      const y1 = Math.min(size - 1, Math.ceil(cy + r + 1));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          let cov = 0;
          for (let sy = 0; sy < 2; sy++)
            for (let sx = 0; sx < 2; sx++) {
              const d = Math.hypot(px + sx * 0.5 + 0.25 - cx, py + sy * 0.5 + 0.25 - cy);
              if (d <= r) cov++;
            }
          if (cov > 0) {
            const idx = (py * size + px) * 4;
            const out = compositeOver(
              [rgb[0], rgb[1], rgb[2], Math.round(cov / 4 * 255)],
              [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]],
            );
            buf[idx] = out[0]; buf[idx + 1] = out[1];
            buf[idx + 2] = out[2]; buf[idx + 3] = out[3];
          }
        }
      }
    } else {
      const sw = shape.sw * scale;
      const rInner = r - sw / 2;
      const rOuter = r + sw / 2;
      const x0 = Math.max(0, Math.floor(cx - rOuter - 1));
      const x1 = Math.min(size - 1, Math.ceil(cx + rOuter + 1));
      const y0 = Math.max(0, Math.floor(cy - rOuter - 1));
      const y1 = Math.min(size - 1, Math.ceil(cy + rOuter + 1));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          let cov = 0;
          for (let sy = 0; sy < 2; sy++)
            for (let sx = 0; sx < 2; sx++) {
              const d = Math.hypot(px + sx * 0.5 + 0.25 - cx, py + sy * 0.5 + 0.25 - cy);
              if (d >= rInner && d <= rOuter) cov++;
            }
          if (cov > 0) {
            const idx = (py * size + px) * 4;
            const out = compositeOver(
              [rgb[0], rgb[1], rgb[2], Math.round(cov / 4 * 255)],
              [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]],
            );
            buf[idx] = out[0]; buf[idx + 1] = out[1];
            buf[idx + 2] = out[2]; buf[idx + 3] = out[3];
          }
        }
      }
    }
  }
  return buf;
}

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ b) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0); // no filter
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.from(raw), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── ICO packer ───────────────────────────────────────────────────────────────

function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  const data = [];

  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size < 256 ? size : 0;
    e[1] = size < 256 ? size : 0;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    data.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...data]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const images = SIZES.map((size) => {
  const rgba = rasterize(size);
  const png = encodePng(rgba, size, size);
  console.log(`  [${size}×${size}] PNG: ${png.length} bytes`);
  return { size, png };
});

const ico = buildIco(images);
writeFileSync(OUT, ico);
console.log(`\n✓ Wrote ${ico.length} bytes → ${OUT}`);
console.log(`  Sizes: ${SIZES.join(", ")} px  |  Format: ICO with embedded PNG`);
