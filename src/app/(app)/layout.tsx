import { SignOutButton } from './_components/SignOutButton'
import { Logo } from '@/components/icons/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { AccessLostBanner } from '@/components/ui/AccessLostBanner'

/**
 * Shared chrome for authenticated routes — dashboard, tree page, invite
 * accept page. Public routes (landing, login, auth callbacks, share view)
 * live OUTSIDE this route group and don't get this layout.
 *
 * Phase 8c-1: hoisted out of the dashboard-only layout so Sign Out is
 * reachable from /tree/[id] and /invite/[token] too (closes #45).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AccessLostBanner />
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </a>
        <SignOutButton />
      </nav>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
