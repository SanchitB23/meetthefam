/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

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
vi.mock('@/lib/actions/signOut', () => ({ signOut: vi.fn() }))

import NotFound from '@/app/not-found'

describe('not-found page', () => {
  it('shows the branded not-found heading', async () => {
    render(await NotFound())
    expect(screen.getByText(/couldn.t find that page/i)).toBeTruthy()
  })

  it('wraps content in the shared status-page chrome (footer nav present)', async () => {
    const { container } = render(await NotFound())
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/') // logo header → home
  })

  it('shows the Sign in CTA for anonymous visitors', async () => {
    const { container } = render(await NotFound())
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/login')
  })
})
