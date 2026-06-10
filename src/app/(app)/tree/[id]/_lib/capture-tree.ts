// src/app/(app)/tree/[id]/_lib/capture-tree.ts
// Dispatches tree export to the appropriate path based on format and feature flag (#219).
//
// Paths:
//   - format === 'pdf'         → canvas rasteriser → PNG data URL → jsPDF → .pdf download
//   - format === 'png' + flag ON → canvas rasteriser → toBlob → .png download
//   - format === 'png' + flag OFF → legacy html-to-image 2-pass toBlob pipeline (below)
//
// The legacy path is kept VERBATIM as `captureTreePngLegacy` — it is the
// production-rollback escape hatch. Do not "improve" it.
//
// Legacy path capture target (per #215 spike): person cards + photos are HTML `div.card_cont`
// nodes that are SIBLINGS of `svg.main_svg` (the SVG holds only connector lines).
// Capturing the SVG alone yields lines with no people, so we capture
// `svg.main_svg.parentElement` — the wrapper div holding both SVG and cards.
//
// Safari fixes (#218):
//   1. inlineImages — converts cross-origin <img> srcs to base64 data URLs so
//      WebKit never taints the canvas (photos would otherwise be dropped).
//   2. inlineLinkStrokes — writes getComputedStyle stroke values as inline
//      styles on path.link elements so html-to-image's Safari clone carries
//      the concrete color (family-chart hard-codes stroke="#fff" as an attribute
//      which wins over CSS in the clone → invisible connectors on cream bg).
//   3. 2-pass toBlob — Safari's first toBlob call often returns a blank/
//      incomplete canvas while fonts and composited layers finish their first
//      paint. We discard the first result and use the second.
import type { ExportFormat } from './export-events'
import { exportFilename } from './export-filename'
import { inlineImages } from './inline-images'
import { inlineLinkStrokes } from './inline-link-strokes'
import { EXPORT_PNG_VIA_CANVAS } from './export-config'
import { rasterizeTreeCanvas, canvasToBlob } from './rasterize-tree'
import { treeToPdf } from './tree-to-pdf'

const FALLBACK_BG = '#fdfbf3' // heirloom cream; used if the live bg is transparent

/** The element whose full extent should be rasterised. */
function captureTargetOf(container: HTMLElement): HTMLElement {
  const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
  const parent = svg?.parentElement
  return parent instanceof HTMLElement ? parent : container
}

/** Wait for every <img> to finish decoding so no broken-image placeholders bake in. */
async function awaitPhotoDecode(target: HTMLElement): Promise<void> {
  const imgs = Array.from(target.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === 'function'
        ? img.decode().catch(() => undefined) // tolerate already-broken / cross-origin
        : Promise.resolve(),
    ),
  )
}

function resolveBackground(target: HTMLElement): string {
  const bg = getComputedStyle(target).backgroundColor
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return FALLBACK_BG
  return bg
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface CaptureSignal {
  /** True when the user cancelled — the blob is discarded and no download fires. */
  aborted: boolean
}

/** Legacy PNG path (#218): html-to-image 2-pass toBlob. Flag-off fallback. */
async function captureTreePngLegacy(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const target = captureTargetOf(container)
  await awaitPhotoDecode(target)

  // Check cancellation before starting the potentially-slow raster step.
  if (signal?.aborted) return

  // --- Safari pre-capture DOM prep ---
  // These two steps mutate the live DOM temporarily; both return restore fns
  // that MUST be called in the finally block below.
  const restoreImgs = await inlineImages(target)
  const restoreStrokes = inlineLinkStrokes(target)

  let blob: Blob | null = null
  try {
    const { toBlob } = await import('html-to-image')

    const opts = {
      // pixelRatio is supplied by the caller (useExportTrigger via prepareForCapture).
      // For the native-scale approach (#218): the container is enlarged to the tree's
      // native extent before capture so the chart renders at ≈1×, and pixelRatio is
      // chosen by planExportRaster to keep the output within browser canvas caps.
      pixelRatio,
      backgroundColor: resolveBackground(target),
      cacheBust: true,
      filter: (node: HTMLElement) =>
        !(node instanceof HTMLElement && node.hasAttribute('data-export-exclude')),
    }

    // 2-pass capture for Safari: WebKit's first toBlob() often returns a blank
    // or incomplete canvas while composited layers and fonts settle into the
    // clone. We discard the first result and use the second. On Chrome the two
    // passes are equally good and the extra pass costs < 100 ms.
    await toBlob(target, opts) // first pass — discard (Safari warm-up)
    blob = await toBlob(target, opts) // second pass — use this
  } finally {
    // Always restore the DOM, even if toBlob throws or the signal is aborted.
    restoreStrokes()
    restoreImgs()
  }

  if (!blob) throw new Error('Tree export failed: empty image')

  // Check again after the async raster in case the user cancelled mid-flight.
  if (signal?.aborted) return

  triggerDownload(blob, exportFilename(treeName, 'png'))
}

/** Canvas PNG path (#219): shared rasteriser → canvas.toBlob → download. */
async function captureTreePngViaCanvas(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const canvas = await rasterizeTreeCanvas(container, pixelRatio, signal)
  if (!canvas || signal?.aborted) return
  const blob = await canvasToBlob(canvas)
  if (signal?.aborted) return
  triggerDownload(blob, exportFilename(treeName, 'png'))
}

/** PDF path (#219): shared rasteriser → PNG data URL → jspdf → download. */
async function captureTreePdf(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const canvas = await rasterizeTreeCanvas(container, pixelRatio, signal)
  if (!canvas || signal?.aborted) return
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await treeToPdf(dataUrl, { width: canvas.width, height: canvas.height }, treeName)
  if (signal?.aborted) return
  triggerDownload(blob, exportFilename(treeName, 'pdf'))
}

export async function captureTree(
  container: HTMLElement,
  format: ExportFormat,
  treeName: string,
  signal?: CaptureSignal,
  /** Pixel ratio for the raster. Defaults to 3 (crisp Retina output).
   *  #218 native-scale export: planExportRaster computes the appropriate ratio
   *  based on the tree's native extent and browser canvas caps — it will be ≤ 3
   *  for trees whose native size would exceed those caps. */
  pixelRatio = 3,
): Promise<void> {
  if (format === 'pdf') {
    return captureTreePdf(container, treeName, signal, pixelRatio)
  }
  if (EXPORT_PNG_VIA_CANVAS) {
    return captureTreePngViaCanvas(container, treeName, signal, pixelRatio)
  }
  return captureTreePngLegacy(container, treeName, signal, pixelRatio)
}
