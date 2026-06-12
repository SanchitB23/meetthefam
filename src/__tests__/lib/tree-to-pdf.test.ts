// src/__tests__/lib/tree-to-pdf.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock jspdf: capture constructor options + method calls. We use the REAL
// planPdfPage / planTiles so assertions verify integration.
const { jsPDFMock, doc } = vi.hoisted(() => {
  const doc = {
    addImage: vi.fn(),
    addPage: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    output: vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
  }
  return { jsPDFMock: vi.fn(function () { return doc }), doc }
})
vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }))

import { treeToPdf } from '@/app/(app)/tree/[id]/_lib/tree-to-pdf'
import { planPdfPage, PDF_MARGIN_MM, pxToMm } from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'
import { planTiles } from '@/app/(app)/tree/[id]/_lib/export-tiling'

const DATA_URL = 'data:image/png;base64,AAAA'
const TILE_URL = 'data:image/png;base64,TILE'

/** Minimal stand-in for the captured canvas (jsdom has no real 2d canvas). */
function fakeTreeCanvas(width: number, height: number): HTMLCanvasElement {
  return { width, height, toDataURL: vi.fn(() => DATA_URL) } as unknown as HTMLCanvasElement
}

/** Stub document.createElement('canvas') for the tiled path's scratch canvas. */
function stubScratchCanvas() {
  const ctx = { clearRect: vi.fn(), drawImage: vi.fn() }
  const scratch = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => TILE_URL),
  }
  const real = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? (scratch as unknown as HTMLCanvasElement) : real(tag)) as
    typeof document.createElement)
  return { scratch, ctx }
}

/** Mirror of tiledPdf's edge-to-edge integer snapping of a tile source rect. */
function snapped(t: { sx: number; sy: number; sw: number; sh: number }) {
  const sx = Math.round(t.sx)
  const sy = Math.round(t.sy)
  return { sx, sy, sw: Math.round(t.sx + t.sw) - sx, sh: Math.round(t.sy + t.sh) - sy }
}

function clearDoc() {
  jsPDFMock.mockClear()
  for (const fn of Object.values(doc)) (fn as ReturnType<typeof vi.fn>).mockClear()
}

describe('treeToPdf — single A4 page (tree fits at print scale)', () => {
  // 1600×1000 native fits A4 landscape (≤ 1635.8×1074.8 px at 150 DPI).
  const NATIVE = { width: 1600, height: 1000 }

  beforeEach(clearDoc)
  afterEach(() => vi.restoreAllMocks())

  it('constructs jsPDF with the planned orientation, mm, a4', async () => {
    const plan = planPdfPage(NATIVE)
    await treeToPdf(fakeTreeCanvas(3200, 2000), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
    expect(doc.addPage).not.toHaveBeenCalled()
  })

  it('adds the full-canvas PNG at the planned coordinates', async () => {
    const plan = planPdfPage(NATIVE)
    const canvas = fakeTreeCanvas(3200, 2000)
    await treeToPdf(canvas, NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(doc.addImage).toHaveBeenCalledWith(DATA_URL, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)
  })

  it('draws the footer with the UTC date at the planned baseline', async () => {
    const plan = planPdfPage(NATIVE)
    await treeToPdf(fakeTreeCanvas(3200, 2000), NATIVE, 'Smith Family', new Date('2026-06-10T23:30:00Z'))
    expect(doc.text).toHaveBeenCalledWith(
      'Generated from meetthefam · 2026-06-10', plan.footer.x, plan.footer.y,
    )
  })

  it('returns the pdf blob from output("blob")', async () => {
    const blob = await treeToPdf(fakeTreeCanvas(3200, 2000), NATIVE, 'X')
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(blob).toBeInstanceOf(Blob)
  })
})

describe('treeToPdf — tiled multi-page (tree exceeds single A4)', () => {
  // 4000×900 native at pixelRatio 2 → landscape 3×1 grid (see export-tiling tests).
  const NATIVE = { width: 4000, height: 900 }
  const PR = 2

  beforeEach(clearDoc)
  afterEach(() => vi.restoreAllMocks())

  it('creates one A4 page per tile in the planned orientation', async () => {
    const { ctx } = stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
    expect(doc.addPage).toHaveBeenCalledTimes(plan.pageCount - 1) // 2
    expect(doc.addImage).toHaveBeenCalledTimes(plan.pageCount) // 3, one per tile
    expect(ctx.drawImage).toHaveBeenCalledTimes(plan.pageCount)
  })

  it('draws each tile slice from the canvas at the tile source rect', async () => {
    const { ctx } = stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    const canvas = fakeTreeCanvas(8000, 1800)
    await treeToPdf(canvas, NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const s = snapped(plan.tiles[0])
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, canvas, s.sx, s.sy, s.sw, s.sh, 0, 0, s.sw, s.sh)
  })

  it('places every tile image at the page margin, sized in mm at print DPI', async () => {
    stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const s = snapped(plan.tiles[0])
    expect(doc.addImage).toHaveBeenNthCalledWith(
      1, TILE_URL, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM,
      pxToMm(s.sw / PR), pxToMm(s.sh / PR),
    )
  })

  it('labels every page with name · date · page i of N · r/c · layout', async () => {
    stubScratchCanvas()
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const labels = doc.text.mock.calls.map((c) => c[0] as string)
    expect(labels[0]).toBe('Smith Family · 2026-06-10 · page 1 of 3 · r1c1 · layout 3×1')
    expect(labels[2]).toBe('Smith Family · 2026-06-10 · page 3 of 3 · r1c3 · layout 3×1')
  })

  it('draws registration ticks on every page', async () => {
    stubScratchCanvas()
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    // 8 tick lines per page × 3 pages.
    expect(doc.line).toHaveBeenCalledTimes(24)
  })

  it('returns the pdf blob from output("blob")', async () => {
    stubScratchCanvas()
    const blob = await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'X')
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(blob).toBeInstanceOf(Blob)
  })
})
