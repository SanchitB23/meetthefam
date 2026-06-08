// src/__tests__/lib/useExportTrigger.test.ts
/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import {
  dispatchExportTree,
  onExportPending,
  type ExportPendingDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { useExportTrigger } from '@/app/(app)/tree/[id]/_lib/useExportTrigger'
import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

// Stub the real rasteriser — jsdom has no canvas; we only assert orchestration.
vi.mock('@/app/(app)/tree/[id]/_lib/capture-tree', () => ({
  captureTree: vi.fn(async () => undefined),
}))
const captureTreeMock = vi.mocked(captureTree)

function makeContainer(): { el: HTMLDivElement; ref: RefObject<HTMLElement | null> } {
  const el = document.createElement('div')
  el.style.overflow = 'hidden'
  return { el, ref: { current: el } }
}

describe('useExportTrigger', () => {
  beforeEach(() => captureTreeMock.mockClear())

  it('round-trips pending true→false and restores overflow on export', async () => {
    const { el, ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    const { unmount } = renderHook(() => useExportTrigger(ref, { readOnly: false }))
    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })

    await waitFor(() => expect(pending).toContain(false))
    expect(pending[0]).toBe(true)
    expect(pending[pending.length - 1]).toBe(false)
    expect(el.style.overflow).toBe('hidden') // restored after capture
    unmount()
    off()
  })

  it('passes the format + treeName from the event through to captureTree', async () => {
    const { el, ref } = makeContainer()
    const { unmount } = renderHook(() => useExportTrigger(ref, { readOnly: false }))
    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())
    // Fifth arg is pixelRatio (defaults to 3 when no prepareForCapture).
    expect(captureTreeMock).toHaveBeenCalledWith(el, 'png', 'Smith Family', expect.anything(), 3)
    unmount()
  })

  it('ignores the event when readOnly (share page)', async () => {
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    const { unmount } = renderHook(() => useExportTrigger(ref, { readOnly: true }))
    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })

    // Give any (incorrect) async handler a chance to run.
    await new Promise((r) => setTimeout(r, 20))
    expect(pending).toEqual([])
    unmount()
    off()
  })

  it('calls fitFn before captureTree', async () => {
    // Verify call order: fitFn is invoked, then captureTree follows.
    const callOrder: string[] = []
    const fitFn = vi.fn(() => { callOrder.push('fit') })

    // Make captureTree record its invocation order.
    captureTreeMock.mockImplementation(async () => { callOrder.push('capture') })

    const { ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, fitFn }),
    )

    dispatchExportTree({ format: 'png', treeName: 'Test' })

    // Wait for the full export cycle to complete (fitFn → delay → captureTree).
    await waitFor(() => expect(callOrder).toContain('capture'), { timeout: 2000 })
    // fitFn must have been called BEFORE captureTree.
    expect(callOrder.indexOf('fit')).toBeLessThan(callOrder.indexOf('capture'))

    unmount()
  })

  it('prepareForCapture is called before captureTree and restore() is called in finally', async () => {
    const callOrder: string[] = []
    const restore = vi.fn(() => { callOrder.push('restore') })
    const prepareForCapture = vi.fn(() => {
      callOrder.push('prepare')
      return { pixelRatio: 2.5, restore }
    })
    captureTreeMock.mockImplementation(async () => { callOrder.push('capture') })

    const { ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    dispatchExportTree({ format: 'png', treeName: 'NativeScale' })
    await waitFor(() => expect(callOrder).toContain('restore'), { timeout: 2000 })

    // Order must be: prepare → capture → restore
    expect(callOrder.indexOf('prepare')).toBeLessThan(callOrder.indexOf('capture'))
    expect(callOrder.indexOf('capture')).toBeLessThan(callOrder.indexOf('restore'))
    unmount()
  })

  it('prepareForCapture pixelRatio is forwarded to captureTree', async () => {
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 1.72, restore }))

    const { el, ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    dispatchExportTree({ format: 'png', treeName: 'NativeScale' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled(), { timeout: 2000 })

    // Fifth arg is the pixelRatio from prepareForCapture
    expect(captureTreeMock).toHaveBeenCalledWith(el, 'png', 'NativeScale', expect.anything(), 1.72)
    await waitFor(() => expect(restore).toHaveBeenCalled())
    unmount()
  })

  it('restore() is called even when captureTree throws', async () => {
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }))
    captureTreeMock.mockRejectedValueOnce(new Error('raster failed'))

    const { ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    dispatchExportTree({ format: 'png', treeName: 'ErrorCase' })
    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 })

    unmount()
  })

  it('cancel resets pending and exporting; signal passed to captureTree reflects aborted state', async () => {
    // Make captureTree record the signal object it receives.
    const receivedSignals: Array<{ aborted: boolean } | undefined> = []
    captureTreeMock.mockImplementation(async (_el, _fmt, _name, signal) => {
      receivedSignals.push(signal as { aborted: boolean } | undefined)
      // Yield so the cancel call has a chance to flip signal.aborted
      // before captureTree's post-raster abort check would run.
      await new Promise((r) => setTimeout(r, 0))
    })

    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    )

    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })

    // Wait for captureTree to be invoked (export is in progress).
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())

    // Cancel while capture is running.
    result.current.cancel()

    // The signal object shared with captureTree should now report aborted.
    await waitFor(() => {
      const sig = receivedSignals[0]
      expect(sig?.aborted).toBe(true)
    })

    // pending reset to false by cancel().
    expect(pending).toContain(false)
    expect(pending[pending.length - 1]).toBe(false)

    unmount()
    off()
  })
})
