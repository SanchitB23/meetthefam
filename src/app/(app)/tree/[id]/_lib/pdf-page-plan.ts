// src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts
// Pure PDF page geometry (#219, A4-only since #225). Given the embedded
// image's pixel dimensions, decide orientation and scale-to-fit the image
// inside the A4 printable box, reserving a bottom strip for the footer.
// No DOM, no jspdf.
//
// #225 removed the A4→A3 step-up: A4 is the ONLY page format. Trees that
// don't fit a single A4 at print scale (see fitsSingleA4) are tiled across
// multiple A4 pages by tree-to-pdf.ts instead of stepping up paper sizes.
//
// jspdf works in mm here. A4 = 210x297 (portrait short x long).

/** Page margin on all sides (mm). */
export const PDF_MARGIN_MM = 10
/** Extra bottom space reserved for the footer line (mm). */
export const PDF_FOOTER_STRIP_MM = 8
/**
 * Declared print resolution. Canvas pixels convert to paper mm at this DPI
 * (mm = px / DPI * 25.4). Drives the single-vs-tiled decision and tile sizes.
 */
export const PDF_PRINT_DPI = 150
/**
 * Minimum allowed scale-to-fit factor before the smart PDF tiles instead of
 * fitting one page. 1.0 = cards never render below native size on paper
 * (the #225 readability bar). Lower (e.g. 0.75) to tolerate more single-page.
 */
export const SINGLE_PAGE_MIN_SCALE = 1.0

export const A4_MM = { short: 210, long: 297 } as const

export interface PdfImageDims {
  /** Embedded image width in NATIVE pixels (pre-pixelRatio scaling). */
  width: number
  /** Embedded image height in NATIVE pixels (pre-pixelRatio scaling). */
  height: number
}

export interface PdfPagePlan {
  pageFormat: 'a4'
  orientation: 'l' | 'p'
  /** Image placement (mm). */
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  /** Footer text baseline (mm). */
  footer: { x: number; y: number }
}

/** Convert native pixels to paper mm at the declared print DPI. */
export function pxToMm(px: number, dpi: number = PDF_PRINT_DPI): number {
  return (px / dpi) * 25.4
}

/**
 * True when the tree's native extent fits the A4 content box at PDF_PRINT_DPI
 * without downscaling below SINGLE_PAGE_MIN_SCALE — i.e. a single page keeps
 * cards at ≥ native print size. Orientation follows the image aspect.
 */
export function fitsSingleA4(dims: PdfImageDims): boolean {
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'
  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long
  const availW = pageW - 2 * PDF_MARGIN_MM
  const availH = pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM
  const scale = Math.min(availW / pxToMm(dims.width), availH / pxToMm(dims.height))
  return scale >= SINGLE_PAGE_MIN_SCALE
}

export function planPdfPage(dims: PdfImageDims): PdfPagePlan {
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'

  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long

  const availW = pageW - 2 * PDF_MARGIN_MM
  const availH = pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM

  const imgAspect = dims.width / dims.height
  const availAspect = availW / availH

  let imgW: number
  let imgH: number
  if (availAspect > imgAspect) {
    // Box is relatively wider than the image → height-bound.
    imgH = availH
    imgW = availH * imgAspect
  } else {
    // Box is relatively taller than the image → width-bound.
    imgW = availW
    imgH = availW / imgAspect
  }

  const imgX = (pageW - imgW) / 2
  const imgY = PDF_MARGIN_MM
  const footer = { x: PDF_MARGIN_MM, y: pageH - PDF_MARGIN_MM }

  return { pageFormat: 'a4', orientation, imgX, imgY, imgW, imgH, footer }
}
