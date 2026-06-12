// src/app/(app)/tree/[id]/_lib/rasterize-tree.ts
// Shared raster core for the unified export path (#219). Produces an
// HTMLCanvasElement from the rendered family tree via html-to-image `toCanvas`,
// applying the same Safari fixes + 2-pass warm-up as the PNG pipeline.
//
// Deliberately self-contained: the legacy `toBlob` path in capture-tree.ts is
// the flag-off fallback and must NOT share code with this file, so a regression
// here can't leak into the known-good path. The small helper duplication is
// intentional (see EXPORT_PNG_VIA_CANVAS in export-config.ts).
import { inlineImages } from './inline-images'
import { inlineLinkStrokes } from './inline-link-strokes'
import type { CaptureSignal } from './capture-tree'

const FALLBACK_BG = '#fdfbf3' // heirloom cream; used if the live bg is transparent

function captureTargetOf(container: HTMLElement): HTMLElement {
  const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
  const parent = svg?.parentElement
  return parent instanceof HTMLElement ? parent : container
}

async function awaitPhotoDecode(target: HTMLElement): Promise<void> {
  const imgs = Array.from(target.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  )
}

function resolveBackground(target: HTMLElement): string {
  const bg = getComputedStyle(target).backgroundColor
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return FALLBACK_BG
  return bg
}

/** Promisified canvas.toBlob (PNG). Rejects if the browser yields a null blob. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Tree export failed: empty canvas'))),
      'image/png',
    )
  })
}

/**
 * Rasterise the tree to a canvas. Returns null if aborted before capture.
 * Caller derives PNG blob (canvasToBlob) or PDF data URL (canvas.toDataURL).
 */
export async function rasterizeTreeCanvas(
  container: HTMLElement,
  pixelRatio = 3,
  signal?: CaptureSignal,
): Promise<HTMLCanvasElement | null> {
  const target = captureTargetOf(container)
  await awaitPhotoDecode(target)
  if (signal?.aborted) return null

  const restoreImgs = await inlineImages(target)
  const restoreStrokes = inlineLinkStrokes(target)

  try {
    if (signal?.aborted) return null // inlineImages awaits network fetches — re-check before rastering
    const { toCanvas } = await import('html-to-image')
    const opts = {
      pixelRatio,
      backgroundColor: resolveBackground(target),
      cacheBust: true,
      filter: (node: HTMLElement) =>
        !(node instanceof HTMLElement && node.hasAttribute('data-export-exclude')),
    }
    await toCanvas(target, opts) // first pass — discard (Safari warm-up)
    return await toCanvas(target, opts) // second pass — use this
  } finally {
    restoreStrokes()
    restoreImgs()
  }
}
