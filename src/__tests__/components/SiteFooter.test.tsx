/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
