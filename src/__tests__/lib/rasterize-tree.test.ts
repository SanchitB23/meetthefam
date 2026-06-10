/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CaptureOpts = { filter: (n: HTMLElement) => boolean; pixelRatio: number }

const { toCanvas } = vi.hoisted(() => ({
  toCanvas: vi.fn<(node: HTMLElement, opts: CaptureOpts) => Promise<HTMLCanvasElement>>(
    async () => document.createElement('canvas'),
  ),
}))
vi.mock('html-to-image', () => ({ toCanvas }))

const { inlineImages } = vi.hoisted(() => ({
  inlineImages: vi.fn<(t: HTMLElement) => Promise<() => void>>(async () => () => undefined),
}))
const { inlineLinkStrokes } = vi.hoisted(() => ({
  inlineLinkStrokes: vi.fn<(t: HTMLElement) => () => void>(() => () => undefined),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-images', () => ({ inlineImages }))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-link-strokes', () => ({ inlineLinkStrokes }))

import { rasterizeTreeCanvas } from '@/app/(app)/tree/[id]/_lib/rasterize-tree'

function buildTree() {
  const container = document.createElement('div')
  const wrapper = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'main_svg')
  const card = document.createElement('div')
  card.className = 'card_cont'
  const excluded = document.createElement('button')
  excluded.setAttribute('data-export-exclude', '')
  wrapper.append(svg, card, excluded)
  container.append(wrapper)
  document.body.append(container)
  return { container, wrapper, card, excluded }
}

describe('rasterizeTreeCanvas', () => {
  beforeEach(() => {
    toCanvas.mockClear()
    inlineImages.mockClear()
    inlineLinkStrokes.mockClear()
    inlineImages.mockResolvedValue(() => undefined)
    inlineLinkStrokes.mockReturnValue(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('captures svg.main_svg.parentElement, twice (Safari 2-pass)', async () => {
    const { container, wrapper } = buildTree()
    await rasterizeTreeCanvas(container, 2)
    expect(toCanvas).toHaveBeenCalledTimes(2)
    expect(toCanvas.mock.calls[0][0]).toBe(wrapper)
    expect(toCanvas.mock.calls[1][0]).toBe(wrapper)
  })

  it('forwards the pixelRatio and filters [data-export-exclude]', async () => {
    const { container, card, excluded } = buildTree()
    await rasterizeTreeCanvas(container, 2.5)
    const opts = toCanvas.mock.calls[1][1]
    expect(opts.pixelRatio).toBe(2.5)
    expect(opts.filter(excluded)).toBe(false)
    expect(opts.filter(card)).toBe(true)
  })

  it('returns the SECOND canvas', async () => {
    const first = document.createElement('canvas')
    const second = document.createElement('canvas')
    toCanvas.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const { container } = buildTree()
    const result = await rasterizeTreeCanvas(container, 2)
    expect(result).toBe(second)
  })

  it('calls inline helpers before toCanvas and restores them after', async () => {
    const order: string[] = []
    const restoreImgs = vi.fn(() => order.push('restoreImgs'))
    const restoreStrokes = vi.fn(() => order.push('restoreStrokes'))
    inlineImages.mockImplementation(async () => { order.push('inlineImages'); return restoreImgs })
    inlineLinkStrokes.mockImplementation(() => { order.push('inlineLinkStrokes'); return restoreStrokes })
    toCanvas.mockImplementation(async () => { order.push('toCanvas'); return document.createElement('canvas') })
    const { container } = buildTree()
    await rasterizeTreeCanvas(container, 2)
    expect(order[0]).toBe('inlineImages')
    expect(order[1]).toBe('inlineLinkStrokes')
    expect(restoreImgs).toHaveBeenCalled()
    expect(restoreStrokes).toHaveBeenCalled()
  })

  it('returns null and skips raster when aborted before capture', async () => {
    const { container } = buildTree()
    const result = await rasterizeTreeCanvas(container, 2, { aborted: true })
    expect(result).toBeNull()
    expect(toCanvas).not.toHaveBeenCalled()
  })

  it('restores inline helpers even if toCanvas throws', async () => {
    const restoreImgs = vi.fn()
    const restoreStrokes = vi.fn()
    inlineImages.mockResolvedValue(restoreImgs)
    inlineLinkStrokes.mockReturnValue(restoreStrokes)
    toCanvas.mockRejectedValue(new Error('raster fail'))
    const { container } = buildTree()
    await expect(rasterizeTreeCanvas(container, 2)).rejects.toThrow('raster fail')
    expect(restoreImgs).toHaveBeenCalled()
    expect(restoreStrokes).toHaveBeenCalled()
  })
})
