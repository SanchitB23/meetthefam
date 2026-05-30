import type { ReactNode } from 'react'
import Link from 'next/link'

import { Logo } from '@/components/icons/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * StatusPageShell — the public chrome for the branded status pages
 * (`not-found.tsx` 404 and `error.tsx` 500).
 *
 * Presentational only (no `'use client'`), so it renders fine from both the
 * Server Component `not-found` and the Client Component `error`. Mirrors the
 * `(legal)` route-group layout — a logo header linking home plus the shared
 * `<SiteFooter>` — so a lost or errored visitor lands on the same heirloom
 * chrome (and Privacy · Terms · Contact · Sign in navigation) as `/privacy`
 * et al., instead of a bare centered card.
 *
 * Note: the absolute-last-resort `global-error.tsx` boundary does NOT use this
 * shell — it renders outside the app shell where routing context is unreliable,
 * so it stays fully self-contained with a plain reset action.
 */
export function StatusPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <Link href="/" className="flex w-fit items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
