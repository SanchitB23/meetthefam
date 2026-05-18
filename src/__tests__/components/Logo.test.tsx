/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from '@/components/icons/Logo'

describe('<Logo>', () => {
  it('renders an SVG with role="img" and aria-label', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('meetthefam')
  })

  it('uses currentColor for the ring strokes', () => {
    const { container } = render(<Logo />)
    const strokeEls = container.querySelectorAll('[stroke]')
    strokeEls.forEach((el) => {
      expect(el.getAttribute('stroke')).toBe('currentColor')
    })
  })
})
