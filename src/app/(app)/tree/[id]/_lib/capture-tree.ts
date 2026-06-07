// src/app/(app)/tree/[id]/_lib/capture-tree.ts
// Rasterises the rendered family tree to a PNG and triggers a download (#218).
//
// Capture target (per #215 spike): person cards + photos are HTML `div.card_cont`
// nodes that are SIBLINGS of `svg.main_svg` (the SVG holds only connector lines).
// Capturing the SVG alone yields lines with no people, so we capture
// `svg.main_svg.parentElement` — the wrapper div holding both SVG and cards.
import type { ExportFormat } from './export-events'
import { exportFilename } from './export-filename'

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

export async function captureTree(
  container: HTMLElement,
  format: ExportFormat,
  treeName: string,
  signal?: CaptureSignal,
): Promise<void> {
  const target = captureTargetOf(container)
  await awaitPhotoDecode(target)

  // Check cancellation before starting the potentially-slow raster step.
  if (signal?.aborted) return

  const { toBlob } = await import('html-to-image')
  const blob = await toBlob(target, {
    // 3× (not the usual 2×) so the exported PNG stays legible when zoomed into
    // on a large tree — the whole tree is fit-to-screen before capture, so the
    // per-card pixel budget is small; the extra ratio buys readable zoom. Still
    // well under the browser canvas-size cap for our 50–200 person trees.
    pixelRatio: 3,
    backgroundColor: resolveBackground(target),
    cacheBust: true,
    filter: (node: HTMLElement) =>
      !(node instanceof HTMLElement && node.hasAttribute('data-export-exclude')),
  })
  if (!blob) throw new Error('Tree export failed: empty image')

  // Check again after the async raster in case the user cancelled mid-flight.
  if (signal?.aborted) return

  triggerDownload(blob, exportFilename(treeName, format))
}
