// src/__tests__/lib/export-raster-plan.test.ts
// TDD for the pure planExportRaster geometry (#218 native-scale PNG export).
// This function is pure math — no DOM, no mocks needed, node environment is fine.
import { describe, expect, it } from 'vitest'
import {
  planExportRaster,
  MAX_CANVAS_SIDE,
  MAX_CANVAS_AREA,
  type RasterPlanOptions,
} from '@/app/(app)/tree/[id]/_lib/export-raster-plan'

// Helper: verify the plan's output canvas satisfies the caps.
function expectWithinCaps(
  plan: ReturnType<typeof planExportRaster>,
  maxSide = MAX_CANVAS_SIDE,
  maxArea = MAX_CANVAS_AREA,
) {
  const canvasW = plan.boxW * plan.pixelRatio
  const canvasH = plan.boxH * plan.pixelRatio
  expect(canvasW).toBeLessThanOrEqual(maxSide + 0.01) // 0.01 tolerance for float rounding
  expect(canvasH).toBeLessThanOrEqual(maxSide + 0.01)
  expect(canvasW * canvasH).toBeLessThanOrEqual(maxArea + 1)
  expect(plan.pixelRatio).toBeGreaterThan(0)
  expect(plan.boxW).toBeGreaterThan(0)
  expect(plan.boxH).toBeGreaterThan(0)
}

describe('planExportRaster — small tree (fits native at targetPixelRatio)', () => {
  it('uses native dimensions and full targetPixelRatio for a small tree', () => {
    // 800×600 at pixelRatio=3 → canvas 2400×1800, well within 16384
    const plan = planExportRaster({ nativeW: 800, nativeH: 600 })
    expect(plan.boxW).toBe(800)
    expect(plan.boxH).toBe(600)
    expect(plan.pixelRatio).toBe(3)
    expectWithinCaps(plan)
  })

  it('handles custom targetPixelRatio for a small tree', () => {
    const plan = planExportRaster({ nativeW: 600, nativeH: 400 }, { targetPixelRatio: 2 })
    expect(plan.boxW).toBe(600)
    expect(plan.boxH).toBe(400)
    expect(plan.pixelRatio).toBe(2)
    expectWithinCaps(plan)
  })

  it('handles a single-person tree (very small native extent)', () => {
    const plan = planExportRaster({ nativeW: 240, nativeH: 180 })
    expect(plan.boxW).toBe(240)
    expect(plan.boxH).toBe(180)
    expect(plan.pixelRatio).toBe(3)
    expectWithinCaps(plan)
  })
})

describe('planExportRaster — medium tree (needs pixelRatio reduction)', () => {
  it('reduces pixelRatio when native width would exceed maxCanvasSide', () => {
    // nativeW=6000, targetPR=3 → canvas 18000 > 16384; must reduce PR
    const plan = planExportRaster({ nativeW: 6000, nativeH: 1000 })
    // canvasW should be ≤ 16384
    expect(plan.boxW * plan.pixelRatio).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    // box stays at native
    expect(plan.boxW).toBe(6000)
    expect(plan.boxH).toBe(1000)
    expect(plan.pixelRatio).toBeLessThan(3)
    expectWithinCaps(plan)
  })

  it('reduces pixelRatio when native height would exceed maxCanvasSide', () => {
    const plan = planExportRaster({ nativeW: 1000, nativeH: 6000 })
    expect(plan.boxH * plan.pixelRatio).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(plan.boxW).toBe(1000)
    expect(plan.boxH).toBe(6000)
    expectWithinCaps(plan)
  })

  it('constrains by area cap even if individual sides are within the side cap', () => {
    // 5000×5000 at PR=3 → canvas area = (15000)² = 225_000_000, which may exceed area cap
    // MAX_CANVAS_AREA = 268_435_456; let's use a custom lower area cap
    const smallAreaCap = 100 * 100 // very tight
    const plan = planExportRaster(
      { nativeW: 200, nativeH: 200 },
      { maxCanvasArea: smallAreaCap, maxCanvasSide: 10000 },
    )
    // area cap: 100*100 = 10000; nativeW*nativeH*PR² = 200*200*PR²
    // max PR² = 10000 / 40000 = 0.25 → max PR = 0.5 < 1, so box is shrunk
    // At PR=1: box area must be ≤ 10000 → box side ≤ 100
    expect(plan.boxW * plan.pixelRatio * plan.boxH * plan.pixelRatio).toBeLessThanOrEqual(smallAreaCap + 1)
    expectWithinCaps(plan, 10000, smallAreaCap)
  })
})

describe('planExportRaster — huge tree (exceeds caps at PR=1, box must shrink)', () => {
  it('clamps pixelRatio to 1 and shrinks box when native extent is beyond any PR reduction', () => {
    // A tree so large that even PR=1 would exceed the side cap: 20000×20000
    const plan = planExportRaster({ nativeW: 20000, nativeH: 20000 })
    expect(plan.pixelRatio).toBe(1)
    expect(plan.boxW * plan.pixelRatio).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(plan.boxH * plan.pixelRatio).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expectWithinCaps(plan)
  })

  it('uses custom smaller caps for Safari tuning', () => {
    const safariCaps: RasterPlanOptions = { maxCanvasSide: 4096, maxCanvasArea: 4096 * 4096 }
    // 5000×3000 tree: at PR=3, canvas = 15000×9000 > 4096; reduce PR first
    const plan = planExportRaster({ nativeW: 5000, nativeH: 3000 }, safariCaps)
    expect(plan.boxW * plan.pixelRatio).toBeLessThanOrEqual(4096 + 0.01)
    expect(plan.boxH * plan.pixelRatio).toBeLessThanOrEqual(4096 + 0.01)
    expectWithinCaps(plan, 4096, 4096 * 4096)
  })

  it('survives an enormous square tree at default caps', () => {
    const plan = planExportRaster({ nativeW: 100_000, nativeH: 100_000 })
    expect(plan.pixelRatio).toBe(1)
    expect(plan.boxW).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(plan.boxH).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expectWithinCaps(plan)
  })
})

describe('planExportRaster — exact boundary at the cap', () => {
  it('permits exactly maxCanvasSide on one axis (PR not reduced)', () => {
    // nativeW = maxCanvasSide / targetPR exactly: PR need not be reduced
    const nativeW = MAX_CANVAS_SIDE / 3
    const plan = planExportRaster({ nativeW, nativeH: 100 }, { targetPixelRatio: 3 })
    expect(plan.boxW).toBe(Math.floor(nativeW))
    expect(plan.pixelRatio).toBe(3)
    expectWithinCaps(plan)
  })

  it('reduces PR when nativeW * targetPR is 1px over maxCanvasSide', () => {
    // One pixel over: nativeW = floor(maxCanvasSide/3) + 1
    const nativeW = Math.floor(MAX_CANVAS_SIDE / 3) + 1
    const plan = planExportRaster({ nativeW, nativeH: 100 }, { targetPixelRatio: 3 })
    expect(plan.boxW * plan.pixelRatio).toBeLessThanOrEqual(MAX_CANVAS_SIDE + 0.01)
    expectWithinCaps(plan)
  })

  it('satisfies area cap at the exact boundary', () => {
    // sqrt(maxCanvasArea / (nativeW * nativeH)) * nativeW = maxCanvasSide exactly for a square
    // √(16384² / (n*n)) = 16384/n → PR = 16384/n. For n=5000: PR = 3.2768 → capped at 3
    const plan = planExportRaster({ nativeW: 5000, nativeH: 5000 }, { targetPixelRatio: 3 })
    expectWithinCaps(plan)
  })
})

describe('planExportRaster — degenerate inputs', () => {
  it('returns fallback for zero width', () => {
    const plan = planExportRaster({ nativeW: 0, nativeH: 600 })
    expect(plan).toEqual({ boxW: 800, boxH: 600, pixelRatio: 1, degraded: true })
  })

  it('returns fallback for zero height', () => {
    const plan = planExportRaster({ nativeW: 800, nativeH: 0 })
    expect(plan).toEqual({ boxW: 800, boxH: 600, pixelRatio: 1, degraded: true })
  })

  it('returns fallback for negative dimensions', () => {
    const plan = planExportRaster({ nativeW: -100, nativeH: 600 })
    expect(plan).toEqual({ boxW: 800, boxH: 600, pixelRatio: 1, degraded: true })
  })

  it('returns fallback for both dimensions zero', () => {
    const plan = planExportRaster({ nativeW: 0, nativeH: 0 })
    expect(plan).toEqual({ boxW: 800, boxH: 600, pixelRatio: 1, degraded: true })
  })
})

describe('planExportRaster — aspect ratio preserved on box shrink', () => {
  it('preserves aspect ratio when box must be shrunk (wide tree)', () => {
    // Wide tree: 30000×5000 → nativeW > maxCanvasSide at PR=1 → box shrinks
    const plan = planExportRaster({ nativeW: 30000, nativeH: 5000 })
    const aspect = 30000 / 5000
    const planAspect = plan.boxW / plan.boxH
    // Aspect ratio preserved within 1%
    expect(Math.abs(planAspect - aspect) / aspect).toBeLessThan(0.01)
    expectWithinCaps(plan)
  })

  it('preserves aspect ratio when box must be shrunk (tall tree)', () => {
    const plan = planExportRaster({ nativeW: 3000, nativeH: 25000 })
    const aspect = 3000 / 25000
    const planAspect = plan.boxW / plan.boxH
    expect(Math.abs(planAspect - aspect) / aspect).toBeLessThan(0.01)
    expectWithinCaps(plan)
  })
})

describe('planExportRaster — output always integer box dimensions', () => {
  it('floors boxW and boxH to integers', () => {
    // Non-integer native dimensions (could happen from k-derived measurement)
    const plan = planExportRaster({ nativeW: 1234.7, nativeH: 567.3 })
    expect(Number.isInteger(plan.boxW)).toBe(true)
    expect(Number.isInteger(plan.boxH)).toBe(true)
  })
})

describe('planExportRaster — degraded flag (#225)', () => {
  it('is false when the box stays at native size and pixelRatio is untouched', () => {
    expect(planExportRaster({ nativeW: 800, nativeH: 600 }).degraded).toBe(false)
  })

  it('is false when only pixelRatio is reduced (box still native size)', () => {
    // 6000×1000 at PR 3 exceeds the side cap → PR drops, box stays native.
    const plan = planExportRaster({ nativeW: 6000, nativeH: 1000 })
    expect(plan.boxW).toBe(6000)
    expect(plan.degraded).toBe(false)
  })

  it('is true when the box must shrink below the native extent', () => {
    // 40000×30000 cannot fit even at pixelRatio 1 → box shrinks.
    const plan = planExportRaster({ nativeW: 40_000, nativeH: 30_000 })
    expect(plan.boxW).toBeLessThan(40_000)
    expect(plan.degraded).toBe(true)
  })

  it('is true for the defensive fallback (invalid native dimensions)', () => {
    expect(planExportRaster({ nativeW: 0, nativeH: 600 }).degraded).toBe(true)
  })
})
