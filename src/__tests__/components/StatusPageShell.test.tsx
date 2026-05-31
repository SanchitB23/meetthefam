/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// SiteFooter embeds <AuthFooterLink />, which calls the browser client.
// Mock it so jsdom doesn't attempt a real Supabase connection.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn(),
    },
  }),
}))
vi.mock('@/app/(app)/_actions/signOut', () => ({ signOut: vi.fn() }))

import { StatusPageShell } from '@/components/layout/StatusPageShell'

describe('<StatusPageShell>', () => {
  it('renders its children', () => {
    render(
      <StatusPageShell>
        <p>boundary message</p>
      </StatusPageShell>,
    )
    expect(screen.getByText('boundary message')).toBeTruthy()
  })

  it('renders a logo header that links home', () => {
    const { container } = render(
      <StatusPageShell>
        <p>x</p>
      </StatusPageShell>,
    )
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/')
  })

  it('exposes the shared footer navigation', async () => {
    const { container } = render(
      <StatusPageShell>
        <p>x</p>
      </StatusPageShell>,
    )
    // AuthFooterLink is async — wait for the Sign in link to appear.
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/login')
  })
})
