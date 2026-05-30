/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter } from '@/components/layout/SiteFooter'

describe('<SiteFooter>', () => {
  it('links to the privacy, terms, and contact pages', () => {
    const { container } = render(<SiteFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
  })

  it('keeps a sign-in link', () => {
    const { container } = render(<SiteFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/login')
  })

  it('renders a Status link only when NEXT_PUBLIC_STATUS_URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATUS_URL', 'https://status.example.com')
    vi.resetModules()
    const { SiteFooter: WithStatus } = await import(
      '@/components/layout/SiteFooter'
    )
    const { container } = render(<WithStatus />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('https://status.example.com')
    vi.unstubAllEnvs()
  })
})
