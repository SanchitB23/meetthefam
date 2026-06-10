// src/__tests__/lib/tree-to-pdf.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock jspdf: capture constructor options + method calls. We use the REAL
// planPdfPage so the assertions verify integration (right page, right coords).
const { jsPDFMock, doc } = vi.hoisted(() => {
  const doc = {
    addImage: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    output: vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
  }
  return { jsPDFMock: vi.fn(function () { return doc }), doc }
})
vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }))

import { treeToPdf } from '@/app/(app)/tree/[id]/_lib/tree-to-pdf'
import { planPdfPage } from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

const DATA_URL = 'data:image/png;base64,AAAA'

describe('treeToPdf', () => {
  beforeEach(() => {
    jsPDFMock.mockClear()
    doc.addImage.mockClear()
    doc.text.mockClear()
    doc.setFontSize.mockClear()
    doc.setTextColor.mockClear()
    doc.output.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('constructs jsPDF with the planned orientation/format in mm', async () => {
    const dims = { width: 4000, height: 2000 } // landscape A4
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({
      orientation: plan.orientation,
      unit: 'mm',
      format: plan.pageFormat,
    })
  })

  it('adds the PNG image at the planned coordinates', async () => {
    const dims = { width: 4000, height: 2000 }
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T00:00:00Z'))
    expect(doc.addImage).toHaveBeenCalledWith(
      DATA_URL, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH,
    )
  })

  it('draws the footer with the UTC date at the planned baseline', async () => {
    const dims = { width: 4000, height: 2000 }
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T23:30:00Z'))
    expect(doc.text).toHaveBeenCalledWith(
      'Generated from meetthefam · 2026-06-09', plan.footer.x, plan.footer.y,
    )
  })

  it('returns the pdf blob from output("blob")', async () => {
    const blob = await treeToPdf(DATA_URL, { width: 1000, height: 1000 }, 'X')
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(blob).toBeInstanceOf(Blob)
  })
})
