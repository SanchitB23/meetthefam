// src/__tests__/lib/export-tiling.test.ts
// Pure tile-grid geometry for the tiled A4 PDF (#225). No DOM; node env fine.
import { describe, expect, it } from 'vitest'
import { planTiles, TILE_OVERLAP_PX } from '@/app/(app)/tree/[id]/_lib/export-tiling'
import {
  A4_MM,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
  PDF_PRINT_DPI,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

// Content box of one page in native px at the print DPI.
function contentPx(orientation: 'l' | 'p') {
  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long
  const w = ((pageW - 2 * PDF_MARGIN_MM) / 25.4) * PDF_PRINT_DPI
  const h = ((pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM) / 25.4) * PDF_PRINT_DPI
  return { w, h } // landscape ≈ { w: 1635.8, h: 1074.8 }
}

describe('planTiles — single tile', () => {
  it('returns a 1×1 grid when the tree fits one page (tie → landscape)', () => {
    const plan = planTiles({ nativeW: 1000, nativeH: 800, pixelRatio: 2 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(1)
    expect(plan.pageCount).toBe(1)
    expect(plan.orientation).toBe('l')
    // Source rect covers the whole canvas (canvas px = native × pixelRatio).
    expect(plan.tiles[0]).toMatchObject({ sx: 0, sy: 0, row: 0, col: 0, pageIndex: 0 })
    expect(plan.tiles[0].sw).toBeCloseTo(2000, 5)
    expect(plan.tiles[0].sh).toBeCloseTo(1600, 5)
  })
})

describe('planTiles — grid + orientation choice', () => {
  it('picks the orientation with fewer pages (wide tree → landscape 3×1)', () => {
    // Landscape: cols = ceil((4000-48)/(1635.8-48)) = 3, rows = 1 → 3 pages.
    // Portrait:  cols = ceil((4000-48)/(1122.0-48)) = 4, rows = 1 → 4 pages.
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 1 })
    expect(plan.orientation).toBe('l')
    expect(plan.cols).toBe(3)
    expect(plan.rows).toBe(1)
    expect(plan.pageCount).toBe(3)
  })

  it('adjacent tiles overlap by TILE_OVERLAP_PX (in canvas px × pixelRatio)', () => {
    const pr = 2
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: pr })
    const [t0, t1] = plan.tiles
    // Overlap is TILE_OVERLAP_PX in native px = TILE_OVERLAP_PX × pixelRatio in canvas px.
    expect(t0.sx + t0.sw - t1.sx).toBeCloseTo(TILE_OVERLAP_PX * pr, 3)
  })

  it('clamps the last tile to the canvas edge (partial tile)', () => {
    const { w } = contentPx('l')
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 1 })
    const last = plan.tiles[plan.tiles.length - 1]
    expect(last.sx + last.sw).toBeCloseTo(4000, 3)
    expect(last.sw).toBeLessThanOrEqual(w + 0.01)
    // Same clamp at pixelRatio 2: canvas edge = nativeW × 2.
    const plan2 = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 2 })
    const last2 = plan2.tiles[plan2.tiles.length - 1]
    expect(last2.sx + last2.sw).toBeCloseTo(8000, 3)
  })

  it('emits row-major pageIndex over a 2-D grid', () => {
    // 4000×2400: portrait wins (4×2=8 pages) over landscape (3×3=9 pages).
    // Portrait contentWpx≈1122, contentHpx≈1589.
    // cols = ceil((4000-48)/(1122-48)) = 4, rows = ceil((2400-48)/(1589-48)) = 2.
    const plan = planTiles({ nativeW: 4000, nativeH: 2400, pixelRatio: 1 })
    expect(plan.orientation).toBe('p')
    expect(plan.cols).toBe(4)
    expect(plan.rows).toBe(2)
    expect(plan.pageCount).toBe(8)
    expect(plan.tiles.map((t) => t.pageIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(plan.tiles[4]).toMatchObject({ row: 1, col: 0 })
  })

  it('throws RangeError when overlapPx is as large as the content box', () => {
    expect(() =>
      planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 1, overlapPx: 5000 }),
    ).toThrow(RangeError)
  })
})
