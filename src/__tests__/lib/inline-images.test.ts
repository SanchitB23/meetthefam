// src/__tests__/lib/inline-images.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inlineImages } from '@/app/(app)/tree/[id]/_lib/inline-images'

const DATA_URL = 'data:image/jpeg;base64,/9j/FAKEDATA'

/** Build a target element with <img> children having the specified srcs. */
function buildTarget(srcs: string[]): HTMLDivElement {
  const target = document.createElement('div')
  for (const src of srcs) {
    const img = document.createElement('img')
    img.src = src
    target.appendChild(img)
  }
  return target
}

/** Stub FileReader so readAsDataURL always calls onload with DATA_URL. */
function stubFileReader() {
  // Use a real class so `new FileReader()` works correctly.
  class MockFileReader {
    result: string | null = null
    onload: ((e: ProgressEvent) => void) | null = null
    onerror: ((e: ProgressEvent) => void) | null = null

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readAsDataURL(_blob: Blob) {
      // Simulate async resolution via microtask.
      Promise.resolve().then(() => {
        this.result = DATA_URL
        if (this.onload) {
          this.onload({ target: { result: DATA_URL } } as unknown as ProgressEvent)
        }
      })
    }
  }
  vi.stubGlobal('FileReader', MockFileReader)
}

describe('inlineImages', () => {
  beforeEach(() => {
    stubFileReader()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('swaps http img src to a data URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget(['http://localhost/photo.jpg'])
    const img = target.querySelector('img')!

    const restore = await inlineImages(target)

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost/photo.jpg', { mode: 'cors' })
    expect(img.src).toBe(DATA_URL)

    restore()
    expect(img.src).toBe('http://localhost/photo.jpg')
  })

  it('handles https srcs too', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget(['https://example.com/photo.png'])
    const img = target.querySelector('img')!

    await inlineImages(target)

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/photo.png', { mode: 'cors' })
    expect(img.src).toBe(DATA_URL)
  })

  it('leaves src unchanged when fetch fails (non-fatal error isolation)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))

    const target = buildTarget(['http://localhost/bad.jpg'])
    const img = target.querySelector('img')!
    const originalSrc = img.src

    const restore = await inlineImages(target)

    // src should be unchanged because fetch failed
    expect(img.src).toBe(originalSrc)
    // restore should not throw even for non-swapped images
    expect(() => restore()).not.toThrow()
  })

  it('leaves src unchanged when fetch returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      blob: () => Promise.resolve(new Blob()),
    } as unknown as Response))

    const target = buildTarget(['http://localhost/forbidden.jpg'])
    const img = target.querySelector('img')!
    const originalSrc = img.src

    const restore = await inlineImages(target)

    expect(img.src).toBe(originalSrc)
    expect(() => restore()).not.toThrow()
  })

  it('skips data URL images (already inlined)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget(['data:image/png;base64,AABB'])
    await inlineImages(target)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not process blob: URLs', async () => {
    // blob: URLs don't start with http(s):// so they should be skipped.
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget(['blob:http://localhost/some-object-url'])
    await inlineImages(target)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('handles a mix of http and data URL srcs correctly', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget([
      'http://localhost/photo1.jpg',  // should be inlined
      'data:image/png;base64,AABB',   // should be skipped
    ])
    const imgs = Array.from(target.querySelectorAll('img'))

    const restore = await inlineImages(target)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(imgs[0].src).toBe(DATA_URL)
    expect(imgs[1].src).not.toBe(DATA_URL)

    restore()
    expect(imgs[0].src).toBe('http://localhost/photo1.jpg')
  })

  it('restore resets all swapped images even with multiple http images', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    const target = buildTarget([
      'http://localhost/a.jpg',
      'http://localhost/b.jpg',
    ])
    const imgs = Array.from(target.querySelectorAll('img'))

    const restore = await inlineImages(target)
    expect(imgs[0].src).toBe(DATA_URL)
    expect(imgs[1].src).toBe(DATA_URL)

    restore()
    expect(imgs[0].src).toBe('http://localhost/a.jpg')
    expect(imgs[1].src).toBe('http://localhost/b.jpg')
  })

  it('does not throw when the target has no imgs at all', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const target = document.createElement('div')
    const restore = await inlineImages(target)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(() => restore()).not.toThrow()
  })
})
