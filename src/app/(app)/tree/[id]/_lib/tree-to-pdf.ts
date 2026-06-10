// src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts
// Smart A4 PDF builder (#219 single-page; #225 smart single-vs-tiled).
// Dynamic-imports jspdf (code-split: only loaded when the user picks PDF).
//
// Branching (#225, spec §5): when the tree's native extent fits the A4
// content box at PDF_PRINT_DPI without downscaling (fitsSingleA4), emit the
// shipped single scale-to-fit page. Otherwise emit a tiled multi-page A4
// document — one A4 sheet per tile of the captured canvas, with overlap
// bleed, corner registration ticks, and an assembly label on every page —
// for print-and-assemble archival output.
import { isoDate } from './export-filename'
import {
  A4_MM,
  PDF_MARGIN_MM,
  fitsSingleA4,
  planPdfPage,
  pxToMm,
  type PdfImageDims,
} from './pdf-page-plan'
import { planTiles, type TilePlan } from './export-tiling'

/** Footer font size (pt) and muted grey RGB. */
const FOOTER_FONT_PT = 9
const FOOTER_RGB: [number, number, number] = [120, 120, 120]
/** Length of the corner registration ticks (mm). */
const TICK_MM = 4

// Minimal structural interface for the jsPDF document object so we avoid
// relying on InstanceType<…> which can be fragile in dynamic-import contexts.
interface JsPdfDoc {
  addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void
  addPage: (format: string, orientation: string) => void
  setFontSize: (size: number) => void
  setTextColor: (...args: number[]) => void
  setDrawColor: (color: number) => void
  line: (x1: number, y1: number, x2: number, y2: number) => void
  text: (text: string, x: number, y: number) => void
  output: (type: string) => Blob
}

export async function treeToPdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  treeName: string,
  date: Date = new Date(),
): Promise<Blob> {
  return fitsSingleA4(native)
    ? singlePagePdf(canvas, native, date)
    : tiledPdf(canvas, native, treeName, date)
}

/** Shipped #219 path: one A4 page, image scale-to-fit, footer. */
async function singlePagePdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  date: Date,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const plan = planPdfPage(native)

  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: 'a4' }) as unknown as JsPdfDoc
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)

  doc.setFontSize(FOOTER_FONT_PT)
  doc.setTextColor(...FOOTER_RGB)
  doc.text(`Generated from meetthefam · ${isoDate(date)}`, plan.footer.x, plan.footer.y)

  return doc.output('blob')
}

/** #225 tiled path: one A4 page per tile of the captured canvas. */
async function tiledPdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  treeName: string,
  date: Date,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pixelRatio = canvas.width / native.width
  const plan = planTiles({ nativeW: native.width, nativeH: native.height, pixelRatio })

  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: 'a4' }) as unknown as JsPdfDoc
  const pageH = plan.orientation === 'l' ? A4_MM.short : A4_MM.long

  // ONE reused scratch canvas across tiles bounds peak memory (spec §7).
  const scratch = document.createElement('canvas')

  for (const tile of plan.tiles) {
    if (tile.pageIndex > 0) doc.addPage('a4', plan.orientation)

    scratch.width = Math.ceil(tile.sw)
    scratch.height = Math.ceil(tile.sh)
    const ctx = scratch.getContext('2d')
    if (!ctx) throw new Error('Tree export failed: no 2d context for tile slicing')
    ctx.clearRect(0, 0, scratch.width, scratch.height)
    ctx.drawImage(canvas, tile.sx, tile.sy, tile.sw, tile.sh, 0, 0, tile.sw, tile.sh)

    // Size from the TILE, not the content box — last tiles are partial and
    // would stretch if placed at contentWmm × contentHmm.
    doc.addImage(
      scratch.toDataURL('image/png'),
      'PNG',
      PDF_MARGIN_MM,
      PDF_MARGIN_MM,
      pxToMm(tile.sw / pixelRatio),
      pxToMm(tile.sh / pixelRatio),
    )

    drawRegistrationTicks(doc, plan)

    doc.setFontSize(FOOTER_FONT_PT)
    doc.setTextColor(...FOOTER_RGB)
    const label =
      `${treeName} · ${isoDate(date)} · page ${tile.pageIndex + 1} of ${plan.pageCount}` +
      ` · r${tile.row + 1}c${tile.col + 1} · layout ${plan.cols}×${plan.rows}`
    doc.text(label, PDF_MARGIN_MM, pageH - PDF_MARGIN_MM)
  }

  return doc.output('blob')
}

/** Thin corner L-ticks at the content-box corners — trim/registration guides. */
function drawRegistrationTicks(doc: JsPdfDoc, plan: TilePlan): void {
  const x0 = PDF_MARGIN_MM
  const y0 = PDF_MARGIN_MM
  const x1 = PDF_MARGIN_MM + plan.contentWmm
  const y1 = PDF_MARGIN_MM + plan.contentHmm
  doc.setDrawColor(150)
  doc.line(x0, y0, x0 + TICK_MM, y0)
  doc.line(x0, y0, x0, y0 + TICK_MM)
  doc.line(x1, y0, x1 - TICK_MM, y0)
  doc.line(x1, y0, x1, y0 + TICK_MM)
  doc.line(x0, y1, x0 + TICK_MM, y1)
  doc.line(x0, y1, x0, y1 - TICK_MM)
  doc.line(x1, y1, x1 - TICK_MM, y1)
  doc.line(x1, y1, x1, y1 - TICK_MM)
}
