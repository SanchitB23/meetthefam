// src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts
// Pure single-page PDF layout geometry (#219). Given the embedded image's pixel
// dimensions, decide page size + orientation and scale-to-fit the image inside
// the printable box, reserving a bottom strip for the footer. No DOM, no jspdf.
//
// jspdf works in mm here. A4 = 210x297, A3 = 297x420 (portrait short x long).

/** Native long-edge (px) above which we step up from A4 to A3 for more print area. */
export const PDF_A3_LONG_EDGE_PX = 8000
/** Page margin on all sides (mm). */
export const PDF_MARGIN_MM = 10
/** Extra bottom space reserved for the footer line (mm). */
export const PDF_FOOTER_STRIP_MM = 8

const PAGE_MM = {
  a4: { short: 210, long: 297 },
  a3: { short: 297, long: 420 },
} as const

export interface PdfImageDims {
  /** Embedded image width in pixels. */
  width: number
  /** Embedded image height in pixels. */
  height: number
}

export interface PdfPagePlan {
  pageFormat: 'a4' | 'a3'
  orientation: 'l' | 'p'
  /** Image placement (mm). */
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  /** Footer text baseline (mm). */
  footer: { x: number; y: number }
}

export function planPdfPage(dims: PdfImageDims): PdfPagePlan {
  const longEdge = Math.max(dims.width, dims.height)
  const pageFormat: 'a4' | 'a3' = longEdge > PDF_A3_LONG_EDGE_PX ? 'a3' : 'a4'
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'

  const { short, long } = PAGE_MM[pageFormat]
  const pageW = orientation === 'l' ? long : short
  const pageH = orientation === 'l' ? short : long

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

  return { pageFormat, orientation, imgX, imgY, imgW, imgH, footer }
}
