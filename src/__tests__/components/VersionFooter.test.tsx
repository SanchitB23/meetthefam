/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/generated/version', () => ({
  APP_VERSION: '0.4.0',
}))

describe('<VersionFooter>', () => {
  it('renders the version string prefixed with v', async () => {
    const { VersionFooter } = await import('@/components/ui/VersionFooter')
    const { getByText } = render(<VersionFooter />)
    expect(getByText('v0.4.0')).toBeTruthy()
  })

  it("sets pointer-events: none so it doesn't block the FAB", async () => {
    const { VersionFooter } = await import('@/components/ui/VersionFooter')
    const { container } = render(<VersionFooter />)
    const el = container.firstElementChild as HTMLElement
    expect(el?.style.pointerEvents).toBe('none')
  })
})
