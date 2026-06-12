// src/__tests__/lib/export-events.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchExportTree,
  emitExportPending,
  onExportPending,
  onExportTree,
} from '@/app/(app)/tree/[id]/_lib/export-events'

describe('export-events', () => {
  it('round-trips an export-tree event with its format + treeName payload', () => {
    const cb = vi.fn()
    const off = onExportTree(cb)
    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })
    expect(cb).toHaveBeenCalledWith({ format: 'png', treeName: 'Smith Family' })
    off()
    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    expect(cb).toHaveBeenCalledTimes(1) // unsubscribed → no second call
  })

  it('round-trips an export-pending event', () => {
    const cb = vi.fn()
    const off = onExportPending(cb)
    emitExportPending({ pending: true })
    emitExportPending({ pending: false })
    expect(cb).toHaveBeenNthCalledWith(1, { pending: true })
    expect(cb).toHaveBeenNthCalledWith(2, { pending: false })
    off()
  })
})
