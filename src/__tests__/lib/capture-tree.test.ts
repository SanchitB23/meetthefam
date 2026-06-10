// src/__tests__/lib/capture-tree.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Legacy PNG path is the flag-off fallback; pin the flag so these assertions
// (which expect the toBlob 2-pass pipeline) keep exercising it.
vi.mock('@/app/(app)/tree/[id]/_lib/export-config', () => ({
  EXPORT_PNG_VIA_CANVAS: false,
}))

type CaptureOpts = { filter: (n: HTMLElement) => boolean; pixelRatio: number }

// Mock html-to-image: capture the (node, options) it's called with.
const { toBlob } = vi.hoisted(() => ({
  toBlob: vi.fn<(node: HTMLElement, opts: CaptureOpts) => Promise<Blob>>(
    async () => new Blob(['x'], { type: 'image/png' }),
  ),
}))
vi.mock('html-to-image', () => ({ toBlob }))

// Mock inlineImages and inlineLinkStrokes so the capture tests stay focused on
// orchestration logic and don't require real fetch / getComputedStyle wiring.
// The Safari helpers are tested in their own suites.
const { inlineImages } = vi.hoisted(() => ({
  inlineImages: vi.fn<(target: HTMLElement) => Promise<() => void>>(
    async () => () => undefined,
  ),
}))
const { inlineLinkStrokes } = vi.hoisted(() => ({
  inlineLinkStrokes: vi.fn<(target: HTMLElement) => () => void>(
    () => () => undefined,
  ),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-images', () => ({ inlineImages }))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-link-strokes', () => ({ inlineLinkStrokes }))

import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

/** Build the f3 DOM shape: .f3 container > inner wrapper > svg.main_svg + sibling cards. */
function buildTree() {
  const container = document.createElement('div')
  container.className = 'f3'
  const wrapper = document.createElement('div') // svg.main_svg.parentElement
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'main_svg')
  const card = document.createElement('div')
  card.className = 'card_cont'
  const excluded = document.createElement('button')
  excluded.setAttribute('data-export-exclude', '')
  wrapper.append(svg, card, excluded)
  container.append(wrapper)
  document.body.append(container)
  return { container, wrapper, svg, card, excluded }
}

describe('captureTree (png)', () => {
  let clickSpy: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    toBlob.mockClear()
    inlineImages.mockClear()
    inlineLinkStrokes.mockClear()
    // Reset to default passing implementations.
    inlineImages.mockResolvedValue(() => undefined)
    inlineLinkStrokes.mockReturnValue(() => undefined)
    clickSpy = vi.fn<() => void>()
    // jsdom lacks object-URL plumbing.
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('captures svg.main_svg.parentElement, not the container or the svg', async () => {
    const { container, wrapper } = buildTree()
    await captureTree(container, 'png', 'Smith Family')
    // 2-pass: toBlob is called twice — first pass discarded, second used.
    expect(toBlob).toHaveBeenCalledTimes(2)
    expect(toBlob.mock.calls[0][0]).toBe(wrapper)
    expect(toBlob.mock.calls[1][0]).toBe(wrapper)
  })

  it('filters out [data-export-exclude] nodes', async () => {
    const { container, card, excluded } = buildTree()
    await captureTree(container, 'png', 'Smith Family')
    // Use the second-pass call options (the one whose result is used).
    const opts = toBlob.mock.calls[1][1]
    expect(opts.filter(excluded)).toBe(false)
    expect(opts.filter(card)).toBe(true)
  })

  it('rasterises at pixelRatio 3 by default (backward compat)', async () => {
    const { container } = buildTree()
    await captureTree(container, 'png', 'Smith Family')
    expect(toBlob.mock.calls[1][1].pixelRatio).toBe(3)
  })

  it('forwards an explicit pixelRatio to html-to-image (native-scale export #218)', async () => {
    const { container } = buildTree()
    await captureTree(container, 'png', 'Smith Family', undefined, 2.73)
    expect(toBlob.mock.calls[1][1].pixelRatio).toBe(2.73)
  })

  it('downloads with the export filename', async () => {
    const { container } = buildTree()
    vi.setSystemTime(new Date('2026-06-07T10:00:00Z'))
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(container, 'png', 'Smith Family')
    expect(anchor.download).toBe('Smith Family-tree-2026-06-07.png')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips the download when signal.aborted is true before raster', async () => {
    const { container } = buildTree()
    const signal = { aborted: true }
    await captureTree(container, 'png', 'Smith Family', signal)
    // toBlob should not be called — aborted before raster step.
    expect(toBlob).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('skips the download when signal.aborted becomes true mid-flight', async () => {
    const { container } = buildTree()
    const signal = { aborted: false }
    // Make the second toBlob flip the signal before resolving (simulates cancel mid-raster).
    let callCount = 0
    toBlob.mockImplementation(async () => {
      callCount++
      if (callCount === 2) signal.aborted = true
      return new Blob(['x'], { type: 'image/png' })
    })
    await captureTree(container, 'png', 'Smith Family', signal)
    // Both toBlob passes ran but the download should have been skipped.
    expect(toBlob).toHaveBeenCalledTimes(2)
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('calls inlineImages and inlineLinkStrokes before toBlob', async () => {
    const callOrder: string[] = []
    inlineImages.mockImplementation(async () => {
      callOrder.push('inlineImages')
      return () => undefined
    })
    inlineLinkStrokes.mockImplementation(() => {
      callOrder.push('inlineLinkStrokes')
      return () => undefined
    })
    toBlob.mockImplementation(async () => {
      callOrder.push('toBlob')
      return new Blob(['x'], { type: 'image/png' })
    })

    const { container } = buildTree()
    await captureTree(container, 'png', 'Smith Family')

    expect(callOrder[0]).toBe('inlineImages')
    expect(callOrder[1]).toBe('inlineLinkStrokes')
    expect(callOrder).toContain('toBlob')
  })

  it('calls restore functions even when toBlob throws', async () => {
    const restoreImgs = vi.fn()
    const restoreStrokes = vi.fn()
    inlineImages.mockResolvedValue(restoreImgs)
    inlineLinkStrokes.mockReturnValue(restoreStrokes)
    toBlob.mockRejectedValue(new Error('raster fail'))

    const { container } = buildTree()
    await expect(captureTree(container, 'png', 'Smith Family')).rejects.toThrow('raster fail')

    expect(restoreImgs).toHaveBeenCalled()
    expect(restoreStrokes).toHaveBeenCalled()
  })
})
