/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Branch } from '@/components/icons/Branch'
import { Leaf } from '@/components/icons/Leaf'
import { Quote } from '@/components/icons/Quote'
import { Family } from '@/components/icons/Family'
import { Sparkle } from '@/components/icons/Sparkle'
import { Heart } from '@/components/icons/Heart'

const Cases = [
  ['Branch', Branch],
  ['Leaf', Leaf],
  ['Quote', Quote],
  ['Family', Family],
  ['Sparkle', Sparkle],
  ['Heart', Heart],
] as const

describe('brand icons', () => {
  for (const [name, Component] of Cases) {
    it(`<${name}> renders an SVG with currentColor`, () => {
      const { container } = render(<Component />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
      const usesCurrentColor =
        container.innerHTML.includes('stroke="currentColor"') ||
        container.innerHTML.includes('fill="currentColor"')
      expect(usesCurrentColor).toBe(true)
    })

    it(`<${name}> matches snapshot`, () => {
      const { asFragment } = render(<Component />)
      expect(asFragment()).toMatchSnapshot()
    })
  }
})
