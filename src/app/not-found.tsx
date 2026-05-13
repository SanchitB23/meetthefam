// App-level not-found boundary — the heirloom-styled replacement for
// Next.js's stock dark-themed 404. Catches both genuinely unknown URLs
// and explicit `notFound()` calls (e.g. `/tree/[id]` when RLS hides the
// tree from the current user). Server Component — checks the session
// so the CTA matches the visitor's auth state: signed-in users get
// "Back to dashboard", anonymous visitors get "Sign in". See ADR 0008
// for the design-token rationale (cream `--background`, forest-green
// `--primary`, Cormorant headings via `font-serif`, Manrope body via
// `font-sans`).

import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'

export default async function NotFound() {
  // Auth boundary mirror: same `supabase.auth.getUser()` shape the
  // tree page + dashboard use. Failures (no session, expired token,
  // RLS-gated) all collapse to "no user" → show the Sign-in CTA.
  let isSignedIn = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isSignedIn = Boolean(user)
  } catch {
    // Defensive — `createClient()` shouldn't throw, but if it does we
    // fall back to the anonymous CTA rather than leak a server error
    // out of the not-found boundary.
    isSignedIn = false
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="font-serif italic text-base text-muted-foreground mb-3">
          Lost in the family tree?
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
          We couldn&rsquo;t find that page
        </h1>
        <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
          The page you were looking for isn&rsquo;t here, or you don&rsquo;t
          have access to it.
        </p>
        <div className="flex justify-center">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Back to dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
