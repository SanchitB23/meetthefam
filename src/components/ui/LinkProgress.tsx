'use client'

import Link, { type LinkProps } from 'next/link'
import { useLinkStatus } from 'next/link'
import { type ReactNode } from 'react'

type Props = LinkProps & {
  children?: ReactNode
  className?: string
}

/**
 * Wraps next/link with a thin top-edge progress bar that animates while
 * the navigation is pending. Uses Next.js 16's useLinkStatus() — only
 * available inside a child of a <Link>.
 *
 * Phase 8c-4: fixes 2/3 of #50 — the "feels stuck" mid-navigation UX
 * before the Server Component finishes fetching.
 */
function PendingBar() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'var(--accent)',
        animation: 'mtf-link-progress 1s linear infinite',
        zIndex: 100,
      }}
    />
  )
}

export function LinkProgress({ children, className, ...linkProps }: Props) {
  return (
    <Link {...linkProps} className={className}>
      {children}
      <PendingBar />
    </Link>
  )
}
