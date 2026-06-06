// src/__tests__/lib/useExportTrigger.test.ts
/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RefObject } from 'react'
import {
  dispatchExportTree,
  onExportPending,
  type ExportPendingDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { useExportTrigger } from '@/app/(app)/tree/[id]/_lib/useExportTrigger'

function makeContainer(): { el: HTMLDivElement; ref: RefObject<HTMLElement | null> } {
  const el = document.createElement('div')
  el.style.overflow = 'hidden'
  return { el, ref: { current: el } }
}

describe('useExportTrigger', () => {
  it('round-trips pending true→false and restores overflow on export', async () => {
    const { el, ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    renderHook(() => useExportTrigger(ref, { readOnly: false }))
    dispatchExportTree({ format: 'png' })

    await waitFor(() => expect(pending).toContain(false))
    expect(pending[0]).toBe(true)
    expect(pending[pending.length - 1]).toBe(false)
    expect(el.style.overflow).toBe('hidden') // restored after capture
    off()
  })

  it('ignores the event when readOnly (share page)', async () => {
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    renderHook(() => useExportTrigger(ref, { readOnly: true }))
    dispatchExportTree({ format: 'png' })

    // Give any (incorrect) async handler a chance to run.
    await new Promise((r) => setTimeout(r, 20))
    expect(pending).toEqual([])
    off()
  })
})
