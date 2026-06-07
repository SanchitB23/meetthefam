/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EXPORT_TREE_EVENT,
  emitExportPending,
  type ExportTreeDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { ExportTreeButton } from '@/app/(app)/tree/[id]/_components/ExportTreeButton'

describe('ExportTreeButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dispatches mtf-export-tree with png format on click', () => {
    const seen: ExportTreeDetail[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent<ExportTreeDetail>).detail)
    window.addEventListener(EXPORT_TREE_EVENT, handler)

    render(<ExportTreeButton />)
    fireEvent.click(screen.getByRole('button', { name: /export tree/i }))

    expect(seen).toEqual([{ format: 'png' }])
    window.removeEventListener(EXPORT_TREE_EVENT, handler)
  })

  it('disables while a capture is pending and re-enables after', async () => {
    render(<ExportTreeButton />)
    const btn = screen.getByRole('button', { name: /export tree/i })
    expect(btn).toBeEnabled()

    emitExportPending({ pending: true })
    await screen.findByRole('button', { name: /exporting/i })
    expect(screen.getByRole('button')).toBeDisabled()

    emitExportPending({ pending: false })
    await screen.findByRole('button', { name: /export tree/i })
    expect(screen.getByRole('button')).toBeEnabled()
  })
})
