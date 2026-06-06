/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
