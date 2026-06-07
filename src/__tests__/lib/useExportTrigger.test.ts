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
    expect(captureTreeMock).toHaveBeenCalledWith(el, 'png', 'Smith Family')
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
})
