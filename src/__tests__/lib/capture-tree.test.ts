// src/__tests__/lib/capture-tree.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CaptureOpts = { filter: (n: HTMLElement) => boolean; pixelRatio: number }

// Mock html-to-image: capture the (node, options) it's called with.
const { toBlob } = vi.hoisted(() => ({
  toBlob: vi.fn<(node: HTMLElement, opts: CaptureOpts) => Promise<Blob>>(
    async () => new Blob(['x'], { type: 'image/png' }),
  ),
}))
vi.mock('html-to-image', () => ({ toBlob }))

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
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(toBlob.mock.calls[0][0]).toBe(wrapper)
  })

  it('filters out [data-export-exclude] nodes', async () => {
    const { container, card, excluded } = buildTree()
    await captureTree(container, 'png', 'Smith Family')
    const opts = toBlob.mock.calls[0][1]
    expect(opts.filter(excluded)).toBe(false)
    expect(opts.filter(card)).toBe(true)
  })

  it('rasterises at pixelRatio 3 by default (backward compat)', async () => {
    const { container } = buildTree()
    await captureTree(container, 'png', 'Smith Family')
    expect(toBlob.mock.calls[0][1].pixelRatio).toBe(3)
  })

  it('forwards an explicit pixelRatio to html-to-image (native-scale export #218)', async () => {
    const { container } = buildTree()
    await captureTree(container, 'png', 'Smith Family', undefined, 2.73)
    expect(toBlob.mock.calls[0][1].pixelRatio).toBe(2.73)
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
    // Make toBlob flip the signal before resolving (simulates cancel mid-raster).
    toBlob.mockImplementation(async () => {
      signal.aborted = true
      return new Blob(['x'], { type: 'image/png' })
    })
    await captureTree(container, 'png', 'Smith Family', signal)
    // toBlob ran but the download should have been skipped.
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
