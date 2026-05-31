/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PublicHeader } from '@/components/layout/PublicHeader'

describe('<PublicHeader>', () => {
  it('renders a link back to the root', () => {
    const { container } = render(<PublicHeader />)
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/')
  })

  it('renders the meetthefam wordmark', () => {
    const { container } = render(<PublicHeader />)
    expect(container.textContent).toContain('meetthefam')
  })

  it('renders the Logo svg with the meetthefam aria-label', () => {
    const { container } = render(<PublicHeader />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('meetthefam')
  })
})
