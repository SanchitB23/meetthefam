/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// SiteFooter now embeds <AuthFooterLink />, which reads auth on mount.
// Centralised mock keeps jsdom inert; per-test overrides go through the
// `mockSupabaseClient({ user })` helper.
import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'

describe('<SiteFooter>', () => {
  beforeEach(() => {
    // Default: signed-out, so the Sign-in link renders.
    mockSupabaseClient()
  })

  it('links to every shipped public page', async () => {
    const { SiteFooter } = await import('@/components/layout/SiteFooter')
    const { container } = render(<SiteFooter />)
    // Wait for AuthFooterLink to hydrate so the /login href is present.
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/childrens-privacy')
    expect(hrefs).toContain('/dmca')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/about')
  })

  it('renders a Sign in link when the viewer is signed out', async () => {
    const { SiteFooter } = await import('@/components/layout/SiteFooter')
    render(<SiteFooter />)
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders a Sign out button when the viewer is signed in', async () => {
    mockSupabaseClient({ user: { id: 'u_1', email: 'a@b.c' } })
    const { SiteFooter } = await import('@/components/layout/SiteFooter')
    render(<SiteFooter />)
    const button = await screen.findByRole('button', { name: /sign out/i })
    expect(button.closest('form')).not.toBeNull()
  })

  it('renders a Status link only when NEXT_PUBLIC_STATUS_URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATUS_URL', 'https://status.example.com')
    vi.resetModules()
    const { SiteFooter: WithStatus } = await import(
      '@/components/layout/SiteFooter'
    )
    const { container } = render(<WithStatus />)
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('https://status.example.com')
    vi.unstubAllEnvs()
  })
})
