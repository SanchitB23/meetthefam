'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Route-level error boundary for /tree/[id]. Catches unexpected throws
 * from TreeContent's Supabase queries (people / members / pending
 * invites). Permission failures already resolve via `notFound()` in the
 * outer auth gate, so this boundary fires on genuinely-unexpected
 * server errors — RLS misconfig, transient network, malformed RPC
 * response, etc.
 *
 * Closes the 'error' half of phase-backlog L105 for the tree-page
 * surface.
 */
export default function TreeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[tree/[id].error.tsx]', error)
  }, [error])

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="font-serif italic text-base text-muted-foreground mb-3">
          A small branch broke.
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
          We couldn&rsquo;t load this tree
        </h1>
        <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
          Something went wrong while fetching this family. Try again, or head
          back to your dashboard.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
