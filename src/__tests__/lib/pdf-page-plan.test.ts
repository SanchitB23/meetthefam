// src/__tests__/lib/pdf-page-plan.test.ts
// Pure geometry for single-page PDF layout (#219). No DOM; node env is fine.
import { describe, expect, it } from 'vitest'
import {
  planPdfPage,
  PDF_A3_LONG_EDGE_PX,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

// A4 = 210x297, A3 = 297x420 (mm).
describe('planPdfPage — orientation', () => {
  it('chooses landscape when the image is wider than tall', () => {
    const plan = planPdfPage({ width: 4000, height: 2000 })
    expect(plan.orientation).toBe('l')
  })

  it('chooses portrait when the image is taller than wide', () => {
    const plan = planPdfPage({ width: 2000, height: 4000 })
    expect(plan.orientation).toBe('p')
  })

  it('treats a square image as portrait (not wider than tall)', () => {
    expect(planPdfPage({ width: 3000, height: 3000 }).orientation).toBe('p')
  })
})

describe('planPdfPage — page size threshold', () => {
  it('uses A4 when the long edge is at or below the A3 threshold', () => {
    expect(planPdfPage({ width: PDF_A3_LONG_EDGE_PX, height: 1000 }).pageFormat).toBe('a4')
  })

  it('uses A3 when the long edge exceeds the threshold', () => {
    expect(planPdfPage({ width: PDF_A3_LONG_EDGE_PX + 1, height: 1000 }).pageFormat).toBe('a3')
  })
})

describe('planPdfPage — scale-to-fit within margins + footer strip', () => {
  it('width-bounds a very wide image to the printable width', () => {
    // A4 landscape: pageW=297, availW = 297 - 2*10 = 277.
    const plan = planPdfPage({ width: 10000, height: 1000 }) // long edge 10000 > 8000 → A3
    // A3 landscape: pageW=420, availW = 420 - 20 = 400.
    expect(plan.orientation).toBe('l')
    expect(plan.pageFormat).toBe('a3')
    expect(plan.imgW).toBeCloseTo(400, 5)
    // height preserves aspect: 400 * (1000/10000) = 40.
    expect(plan.imgH).toBeCloseTo(40, 5)
    // centered horizontally: (420 - 400)/2 = 10.
    expect(plan.imgX).toBeCloseTo(10, 5)
    expect(plan.imgY).toBeCloseTo(PDF_MARGIN_MM, 5)
  })

  it('height-bounds a tall image to the printable height (minus footer strip)', () => {
    // 1000x4000 → portrait, long edge 4000 ≤ 8000 → A4 (210x297).
    const plan = planPdfPage({ width: 1000, height: 4000 })
    expect(plan.orientation).toBe('p')
    expect(plan.pageFormat).toBe('a4')
    // availH = 297 - 2*10 - 8 = 269. availW = 210 - 20 = 190.
    // availAspect = 190/269 = 0.706 ; imgAspect = 1000/4000 = 0.25.
    // availAspect > imgAspect → height-bound: imgH = 269, imgW = 269*0.25 = 67.25.
    expect(plan.imgH).toBeCloseTo(269, 5)
    expect(plan.imgW).toBeCloseTo(67.25, 5)
    expect(plan.imgX).toBeCloseTo((210 - 67.25) / 2, 5)
  })

  it('never lets the image overlap the footer strip', () => {
    const plan = planPdfPage({ width: 3000, height: 3000 }) // portrait A4
    const pageH = 297
    const footerTop = pageH - PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM
    expect(plan.imgY + plan.imgH).toBeLessThanOrEqual(footerTop + 0.01)
  })
})

describe('planPdfPage — footer position', () => {
  it('puts the footer baseline left-aligned in the bottom margin', () => {
    const plan = planPdfPage({ width: 3000, height: 2000 }) // landscape A4 (297x210)
    expect(plan.footer.x).toBeCloseTo(PDF_MARGIN_MM, 5)
    expect(plan.footer.y).toBeCloseTo(210 - PDF_MARGIN_MM, 5)
  })
})
