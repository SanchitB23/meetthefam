/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('exposes the shared footer navigation', () => {
    const { container } = render(
      <StatusPageShell>
        <p>x</p>
      </StatusPageShell>,
    )
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/login')
  })
})
