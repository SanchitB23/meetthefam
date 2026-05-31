/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// next/font/google is a build-time helper that only runs under the Next
// compiler; outside it (vitest), calling the font fn throws. Stub it so the
// boundary's font wiring can be exercised. Unavoidable framework-boundary mock.
vi.mock('next/font/google', () => ({
  Manrope: () => ({ variable: 'font-sans-var' }),
  Cormorant_Garamond: () => ({ variable: 'font-serif-var' }),
}))

import GlobalError from '@/app/global-error'

describe('global-error (root-layout crash boundary)', () => {
  beforeEach(() => {
    // Suppress (a) the boundary's own console.error(error) and (b) React's
    // expected validateDOMNesting warning — global-error MUST render its own
    // <html>/<body>, which RTL mounts inside a container <div>.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const error = new Error('root layout exploded') as Error & {
    digest?: string
  }

  it('renders a branded heading', () => {
    render(<GlobalError error={error} reset={() => {}} />)
    expect(screen.getByText(/something went wrong/i)).toBeTruthy()
  })

  it('calls reset when the recovery button is clicked', () => {
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('renders its own <html>/<body> with the heirloom chrome', () => {
    // global-error replaces the root layout, so it returns <html>/<body>.
    // React 19 hoists those tags to the real document, merging their
    // attributes — so we assert on the document root, not the RTL container.
    render(<GlobalError error={error} reset={() => {}} />)
    expect(document.body.className).toContain('bg-background')
    // Font-variable classes wired onto <html> (mocked next/font values).
    expect(document.documentElement.className).toContain('font-sans-var')
    expect(document.documentElement.className).toContain('font-serif-var')
  })
})
