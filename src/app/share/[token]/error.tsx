'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Route-level error boundary for /share/[token]. The share page uses
 * `createServiceRoleClient()` to bypass RLS for anonymous read; if the
 * service-role query throws (network blip, malformed token, transient
 * Supabase outage) this boundary catches it. Invalid / unknown tokens
 * resolve via `notFound()` and hit the dedicated not-found page, not
 * this boundary.
 *
 * Anonymous-visitor CTA — no /dashboard link, because the user has no
 * session. Offer 'Try again' + 'Back to home'.
 *
 * Closes the 'error' half of phase-backlog L105 for the share surface.
 */
export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[share/[token].error.tsx]', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="font-serif italic text-base text-muted-foreground mb-3">
          The link held, but the room is dark.
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
          We couldn&rsquo;t load this shared tree
        </h1>
        <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
          Something went wrong while opening this share. Try again — and if the
          problem keeps coming back, ask the person who shared the link.
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
