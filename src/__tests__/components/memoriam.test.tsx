/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Memoriam } from '@/components/ui/memoriam'

describe('<Memoriam>', () => {
  it('prefixes the name with †', () => {
    const { container } = render(<Memoriam name="George Smith" />)
    // Verify both the † glyph and the name text appear in the rendered output.
    expect(container.textContent).toContain('†')
    expect(container.textContent).toContain('George Smith')
  })

  it('renders the glyph span with data-memoriam-glyph attribute', () => {
    const { container } = render(<Memoriam name="George Smith" />)
    const glyph = container.querySelector('[data-memoriam-glyph]')
    expect(glyph).not.toBeNull()
  })

  it('marks the glyph aria-hidden so screen readers skip the symbol', () => {
    const { container } = render(<Memoriam name="George Smith" />)
    const glyph = container.querySelector('[data-memoriam-glyph]')
    expect(glyph?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders the † character inside the glyph span', () => {
    const { container } = render(<Memoriam name="George Smith" />)
    const glyph = container.querySelector('[data-memoriam-glyph]')
    expect(glyph?.textContent).toContain('†')
  })
})
