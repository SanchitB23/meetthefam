// scripts/export-stress/synth-photo.ts
// Synthesise a small, varied JPEG for a seeded person. Pure (returns a Buffer).
// Colour is derived from the index so photos differ (distinct decode work) but
// are deterministic. 256×256 keeps every file a few KB — far under the 512 KB
// photos-bucket lid.
import sharp from 'sharp'

export async function synthPhoto(idx: number): Promise<Buffer> {
  const hue = (idx * 47) % 360
  // HSL→RGB at S=60% L=55%.
  const { r, g, b } = hslToRgb(hue / 360, 0.6, 0.55)
  return sharp({
    create: { width: 256, height: 256, channels: 3, background: { r, g, b } },
  })
    .jpeg({ quality: 70 })
    .toBuffer()
}

function hslToRgb(h: number, s: number, l: number) {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  }
}
