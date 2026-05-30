import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * Public chrome for legal / marketing pages (/privacy, /terms, /contact).
 *
 * Sits OUTSIDE the (app) route group, so these pages carry no authenticated
 * nav or Sign-Out button. Renders only a logo header + the shared SiteFooter;
 * the root layout (src/app/layout.tsx) still provides <html>/<body> and the
 * tiny VersionFooter beneath everything.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <Link href="/" className="flex w-fit items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
