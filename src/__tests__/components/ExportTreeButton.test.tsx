/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EXPORT_TREE_EVENT,
  emitExportPending,
  type ExportTreeDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { ExportTreeButton } from '@/app/(app)/tree/[id]/_components/ExportTreeButton'

// Render the Base UI dropdown inline (no portal / open state) so both the
// trigger button and the menu items are always present and clickable.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ render }: { render: React.ReactElement }) => render,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

describe('ExportTreeButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dispatches png from the PNG item and pdf from the PDF item', () => {
    const seen: ExportTreeDetail[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent<ExportTreeDetail>).detail)
    window.addEventListener(EXPORT_TREE_EVENT, handler)

    render(<ExportTreeButton treeName="Smith Family" />)
    fireEvent.click(screen.getByRole('button', { name: /download as png/i }))
    fireEvent.click(screen.getByRole('button', { name: /download as pdf/i }))

    expect(seen).toEqual([
      { format: 'png', treeName: 'Smith Family' },
      { format: 'pdf', treeName: 'Smith Family' },
    ])
    window.removeEventListener(EXPORT_TREE_EVENT, handler)
  })

  it('disables the trigger while a capture is pending and re-enables after', async () => {
    render(<ExportTreeButton treeName="Smith Family" />)
    const trigger = screen.getByRole('button', { name: /export tree/i })
    expect(trigger).toBeEnabled()

    emitExportPending({ pending: true })
    await screen.findByRole('button', { name: /exporting/i })
    expect(screen.getByRole('button', { name: /exporting/i })).toBeDisabled()

    emitExportPending({ pending: false })
    await screen.findByRole('button', { name: /export tree/i })
    expect(screen.getByRole('button', { name: /export tree/i })).toBeEnabled()
  })
})
