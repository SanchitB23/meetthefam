import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

/**
 * PublicHeader — logo + wordmark header for unauthenticated chrome.
 *
 * Used by the (legal) route-group layout and the /login page. Carries no nav
 * or Sign-Out button; the wordmark links back to `/`. Extracted from the
 * (legal) layout so /login can render the same launch-facing chrome without
 * duplicating the markup.
 */
export function PublicHeader() {
  return (
    <header className="border-b border-border px-4 py-3">
      <Link href="/" className="flex w-fit items-center gap-2 text-primary">
        <Logo size={28} />
        <span className="font-serif text-xl text-foreground">meetthefam</span>
      </Link>
    </header>
  )
}
