/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from '@/components/ui/avatar'

describe('<Avatar>', () => {
  it("renders 'other' with clipPath set and borderRadius zeroed", () => {
    const { container } = render(
      <Avatar fullName="Alex Doe" tone="indigo" gender="other" size={64} />,
    )
    const inner = container.querySelector('span[style*="clip-path"]')
    expect(inner).not.toBeNull()
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/clip-path:\s*polygon\(/)
    expect(style).toMatch(/border-radius:\s*0(px|;|$)/)
  })

  it("renders 'unknown' as a squircle at ~34% of px", () => {
    const { container } = render(
      <Avatar fullName="Pat Doe" tone="sage" gender="unknown" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    expect(inner).not.toBeNull()
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/border-radius:\s*16px/)
    expect(style).not.toMatch(/clip-path:\s*polygon/)
  })

  it("renders 'm' as a rounded-square at ~18% of px (unchanged)", () => {
    const { container } = render(
      <Avatar fullName="Sam Doe" tone="rose" gender="m" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/border-radius:\s*9px/)
  })

  it("renders 'f' as a circle (unchanged)", () => {
    const { container } = render(
      <Avatar fullName="Jane Doe" tone="amber" gender="f" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/border-radius:\s*50%/)
  })
})
