// App-level not-found boundary — the heirloom-styled replacement for
// Next.js's stock dark-themed 404. Catches both genuinely unknown URLs
// and explicit `notFound()` calls (e.g. `/tree/[id]` when RLS hides the
// tree from the current user). Server Component — no interactivity
// beyond the <Link>s. See ADR 0008 for the design-token rationale
// (cream `--background`, forest-green `--primary`, Cormorant headings
// via `font-serif`, Manrope body via `font-sans`).

import Link from 'next/link'

export default function NotFound() {
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
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
