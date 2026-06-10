// src/__tests__/lib/capture-tree-canvas.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Flag ON: PNG should go through the canvas path.
vi.mock('@/app/(app)/tree/[id]/_lib/export-config', () => ({
  EXPORT_PNG_VIA_CANVAS: true,
}))

// Fake canvas with the two derivation methods capture-tree uses.
const fakeCanvas = {
  width: 1234,
  height: 567,
  toDataURL: vi.fn(() => 'data:image/png;base64,ZZZ'),
} as unknown as HTMLCanvasElement

const { rasterizeTreeCanvas, canvasToBlob } = vi.hoisted(() => ({
  rasterizeTreeCanvas: vi.fn(async () => fakeCanvas),
  canvasToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/rasterize-tree', () => ({ rasterizeTreeCanvas, canvasToBlob }))

const { treeToPdf } = vi.hoisted(() => ({
  treeToPdf: vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' })),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/tree-to-pdf', () => ({ treeToPdf }))

import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

function buildContainer() {
  const container = document.createElement('div')
  document.body.append(container)
  return container
}

describe('captureTree — canvas PNG path (flag on)', () => {
  let clickSpy: ReturnType<typeof vi.fn<() => void>>
  beforeEach(() => {
    rasterizeTreeCanvas.mockClear(); canvasToBlob.mockClear(); treeToPdf.mockClear()
    ;(fakeCanvas.toDataURL as ReturnType<typeof vi.fn>).mockClear()
    clickSpy = vi.fn<() => void>()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  it('rasterises to a canvas, derives a blob, and downloads a .png', async () => {
    vi.setSystemTime(new Date('2026-06-09T10:00:00Z'))
    const container = buildContainer() // build before mocking createElement
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(container, 'png', 'Smith Family', undefined, 2.5)
    expect(rasterizeTreeCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), 2.5, undefined)
    expect(canvasToBlob).toHaveBeenCalledWith(fakeCanvas)
    expect(treeToPdf).not.toHaveBeenCalled()
    expect(anchor.download).toBe('Smith Family-tree-2026-06-09.png')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips download when aborted (canvas path returns null)', async () => {
    rasterizeTreeCanvas.mockResolvedValueOnce(null as unknown as HTMLCanvasElement)
    await captureTree(buildContainer(), 'png', 'Smith Family', { aborted: true })
    expect(canvasToBlob).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})

describe('captureTree — PDF path', () => {
  let clickSpy: ReturnType<typeof vi.fn<() => void>>
  beforeEach(() => {
    rasterizeTreeCanvas.mockClear(); canvasToBlob.mockClear(); treeToPdf.mockClear()
    ;(fakeCanvas.toDataURL as ReturnType<typeof vi.fn>).mockClear()
    clickSpy = vi.fn<() => void>()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  it('rasterises, hands the canvas + native dims to treeToPdf, downloads .pdf', async () => {
    vi.setSystemTime(new Date('2026-06-09T10:00:00Z'))
    const container = buildContainer() // build before mocking createElement
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(container, 'pdf', 'Smith Family', undefined, 2.5)
    expect(rasterizeTreeCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), 2.5, undefined)
    // #225: the smart builder receives the CANVAS (the tiled path slices it);
    // native dims = canvas px / pixelRatio. 1234/2.5=493.6, 567/2.5=226.8.
    expect(treeToPdf).toHaveBeenCalledWith(
      fakeCanvas,
      { width: 1234 / 2.5, height: 567 / 2.5 },
      'Smith Family',
    )
    expect(fakeCanvas.toDataURL).not.toHaveBeenCalled() // builder derives its own
    expect(canvasToBlob).not.toHaveBeenCalled()
    expect(anchor.download).toBe('Smith Family-tree-2026-06-09.pdf')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips the PDF download when aborted before raster', async () => {
    rasterizeTreeCanvas.mockResolvedValueOnce(null as unknown as HTMLCanvasElement)
    await captureTree(buildContainer(), 'pdf', 'Smith Family', { aborted: true })
    expect(treeToPdf).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
