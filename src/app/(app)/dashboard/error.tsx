'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Route-level error boundary for /dashboard. Catches unexpected throws
 * from DashboardContent's Supabase query (network failure, transient
 * RLS error, malformed response). Heirloom-styled to match
 * `src/app/not-found.tsx` — Cormorant kicker + serif H1 + Manrope body
 * + primary CTA.
 *
 * `reset()` re-renders the segment; the Supabase fetch retries cleanly.
 * `console.error` lets Vercel's runtime logs catch the cause without
 * wiring any external telemetry (Sentry / Datadog deferred to v1.0).
 *
 * Closes the 'error' half of phase-backlog L105.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard.error.tsx]', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="font-serif italic text-base text-muted-foreground mb-3">
          A small branch broke.
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
          We couldn&rsquo;t load your trees
        </h1>
        <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
          Something went wrong while fetching your dashboard. Try again — most
          hiccups resolve on a second attempt.
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
            href="/"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
