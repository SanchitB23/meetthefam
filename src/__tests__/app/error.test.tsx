/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// SiteFooter embeds <AuthFooterLink />, which calls the browser client +
// the `signOut` server action. Centralised mock keeps jsdom inert.
import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'
mockSupabaseClient()

import AppError from '@/app/error'

describe('app error boundary', () => {
  beforeEach(() => {
    // The boundary logs the error via useEffect; keep test output pristine.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const error = new Error('boom') as Error & { digest?: string }

  it('renders the branded error heading', () => {
    render(<AppError error={error} reset={() => {}} />)
    expect(screen.getByText(/unexpected error/i)).toBeTruthy()
  })

  it('calls reset when the Try again button is clicked', () => {
    const reset = vi.fn()
    render(<AppError error={error} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('wraps content in the shared status-page chrome (footer nav present)', () => {
    const { container } = render(<AppError error={error} reset={() => {}} />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/') // logo header → home
  })
})
