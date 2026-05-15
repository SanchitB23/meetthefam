// Phase 7 sub-task 3 — sticky banner across the top of the share view.
//
// Server Component (no client state needed). The link points at /login
// because magic-link is our actual signup path — first click creates the
// auth.users + profiles row via handle_new_user.

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function ShareBanner() {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-foreground/80 italic font-serif">
          You&apos;re viewing a shared family tree.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Sign up to create your own
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
