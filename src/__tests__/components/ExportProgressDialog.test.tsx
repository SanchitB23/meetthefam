/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExportProgressDialog } from '@/app/(app)/tree/[id]/_components/ExportProgressDialog'

describe('ExportProgressDialog', () => {
  it('shows the preparing message when open', () => {
    render(<ExportProgressDialog open />)
    expect(screen.getByText('Preparing export…')).toBeInTheDocument()
  })

  it('renders nothing visible when closed', () => {
    render(<ExportProgressDialog open={false} />)
    expect(screen.queryByText('Preparing export…')).not.toBeInTheDocument()
  })

  it('renders a Cancel button when onCancel is provided', () => {
    const onCancel = vi.fn()
    render(<ExportProgressDialog open onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<ExportProgressDialog open onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not render a Cancel button when onCancel is omitted', () => {
    render(<ExportProgressDialog open />)
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })
})
