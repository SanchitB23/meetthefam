/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExportDegradeDialog } from '@/app/(app)/tree/[id]/_components/ExportDegradeDialog'

describe('ExportDegradeDialog', () => {
  it('renders nothing when closed', () => {
    render(<ExportDegradeDialog open={false} onContinue={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText(/large tree export/i)).toBeNull()
  })

  it('fires onContinue from the Continue button', async () => {
    const onContinue = vi.fn()
    render(<ExportDegradeDialog open onContinue={onContinue} onCancel={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel from the Cancel button', async () => {
    const onCancel = vi.fn()
    render(<ExportDegradeDialog open onContinue={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
