// src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts
// Builds a single-page PDF from a captured tree image (#219). Dynamic-imports
// jspdf (code-split: only loaded when the user picks PDF). The image is
// embedded losslessly as PNG — PDF is the archival/high-quality artifact;
// the PNG download is the lightweight shareable one.
import { isoDate } from './export-filename'
import { planPdfPage, type PdfImageDims } from './pdf-page-plan'

/** Footer font size (pt) and muted grey RGB. */
const FOOTER_FONT_PT = 9
const FOOTER_RGB: [number, number, number] = [120, 120, 120]

export async function treeToPdf(
  pngDataUrl: string,
  dims: PdfImageDims,
  _treeName: string,
  date: Date = new Date(),
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const plan = planPdfPage(dims)

  const doc = new jsPDF({
    orientation: plan.orientation,
    unit: 'mm',
    format: plan.pageFormat,
  })

  doc.addImage(pngDataUrl, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)

  doc.setFontSize(FOOTER_FONT_PT)
  doc.setTextColor(...FOOTER_RGB)
  doc.text(`Generated from meetthefam · ${isoDate(date)}`, plan.footer.x, plan.footer.y)

  return doc.output('blob')
}
