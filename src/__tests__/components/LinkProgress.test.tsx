/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock next/link to control useLinkStatus return value.
// We preserve the default export (Link) as a passthrough <a> so renders work.
vi.mock('next/link', async () => {
  const actual = await vi.importActual<typeof import('next/link')>('next/link')
  return {
    ...actual,
    // Default export: a simple passthrough anchor (avoids Next.js router dep).
    default: ({ href, children, className, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) => (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    ),
    useLinkStatus: vi.fn(() => ({ pending: false })),
  }
})

// Import AFTER mock is in place so the module picks up the mocked version.
import { LinkProgress } from '@/components/ui/LinkProgress'
import { useLinkStatus } from 'next/link'

const mockUseLinkStatus = vi.mocked(useLinkStatus)

beforeEach(() => {
  mockUseLinkStatus.mockReturnValue({ pending: false })
})

describe('<LinkProgress> / PendingBar', () => {
  it('renders no progress bar when pending is false', () => {
    mockUseLinkStatus.mockReturnValue({ pending: false })
    const { container } = render(
      <LinkProgress href="/dashboard">Go back</LinkProgress>,
    )
    // The span with the animation style should NOT be present.
    const bar = container.querySelector('[aria-hidden="true"]')
    expect(bar).toBeNull()
  })

  it('renders the animated progress bar when pending is true', () => {
    mockUseLinkStatus.mockReturnValue({ pending: true })
    const { container } = render(
      <LinkProgress href="/dashboard">Go back</LinkProgress>,
    )
    // The span should appear and carry the correct animation style.
    const bar = container.querySelector('[aria-hidden="true"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('style')).toContain('mtf-link-progress')
    expect(bar?.getAttribute('style')).toContain('position: fixed')
  })
})
