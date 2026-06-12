// src/__tests__/lib/pdf-page-plan.test.ts
// Pure geometry for single-page PDF layout (#219, A4-only since #225). No DOM; node env is fine.
import { describe, expect, it } from 'vitest'
import {
  planPdfPage,
  fitsSingleA4,
  pxToMm,
  PDF_PRINT_DPI,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
  SINGLE_PAGE_MIN_SCALE,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

// A4 = 210x297 (mm).
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

describe('planPdfPage — scale-to-fit within margins + footer strip', () => {
  it('width-bounds a very wide image to the A4 printable width (A4-only, no A3 step-up)', () => {
    // 10000×1000 → landscape. A4 landscape: pageW=297, availW = 297 - 2*10 = 277.
    const plan = planPdfPage({ width: 10_000, height: 1000 })
    expect(plan.orientation).toBe('l')
    expect(plan.pageFormat).toBe('a4')
    expect(plan.imgW).toBeCloseTo(277, 5)
    // height preserves aspect: 277 * (1000/10000) = 27.7.
    expect(plan.imgH).toBeCloseTo(27.7, 5)
    // centered horizontally: (297 - 277)/2 = 10.
    expect(plan.imgX).toBeCloseTo(10, 5)
    expect(plan.imgY).toBeCloseTo(PDF_MARGIN_MM, 5)
  })

  it('height-bounds a tall image to the printable height (minus footer strip)', () => {
    // 1000x4000 → portrait, A4 (210x297).
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

describe('pxToMm (#225)', () => {
  it('converts px to mm at the declared print DPI', () => {
    // 150 px at 150 DPI = 1 inch = 25.4 mm.
    expect(pxToMm(PDF_PRINT_DPI)).toBeCloseTo(25.4, 5)
  })
})

describe('fitsSingleA4 (#225)', () => {
  // A4 landscape content box: availW = 277mm, availH = 210 - 20 - 8 = 182mm.
  // At 150 DPI: availW = 1635.8px, availH = 1074.8px.
  it('fits a small landscape tree (no downscale needed)', () => {
    expect(fitsSingleA4({ width: 1600, height: 1000 })).toBe(true)
  })

  it('rejects a tree wider than the A4 landscape content box', () => {
    expect(fitsSingleA4({ width: 1700, height: 1000 })).toBe(false)
  })

  // A4 portrait content box: availW = 190mm (1122px), availH = 269mm (1588.6px).
  it('fits a small portrait tree', () => {
    expect(fitsSingleA4({ width: 1000, height: 1500 })).toBe(true)
  })

  it('rejects a portrait tree taller than the content box', () => {
    expect(fitsSingleA4({ width: 1000, height: 1700 })).toBe(false)
  })

  it('SINGLE_PAGE_MIN_SCALE is the no-downscale bar', () => {
    expect(SINGLE_PAGE_MIN_SCALE).toBe(1.0)
  })
})
