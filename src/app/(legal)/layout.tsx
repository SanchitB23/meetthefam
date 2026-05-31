import { PublicHeader } from '@/components/layout/PublicHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * Public chrome for legal / marketing pages (/privacy, /terms, /contact).
 *
 * Sits OUTSIDE the (app) route group, so these pages carry no authenticated
 * nav or Sign-Out button. Renders only a logo header + the shared SiteFooter;
 * the root layout (src/app/layout.tsx) still provides <html>/<body> and the
 * tiny VersionFooter beneath everything.
 */

// These pages are pure static content (no per-request data). The app is
// otherwise dynamic app-wide because the Supabase auth proxy (src/proxy.ts)
// touches the default render path; opting this route group into static
// prerendering makes /privacy, /terms, /contact ship as cached HTML. Cascades
// to all three child pages. (Valid in Next 16 with Cache Components off — see
// docs route-segment-config.)
export const dynamic = 'force-static'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
