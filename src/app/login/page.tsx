import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { signInWithGoogle, signInWithMagicLink } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { createClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { ToastFromSearchParams } from '@/components/ui/ToastFromSearchParams'

type SearchParams = Promise<{
  sent?: string
  email?: string
  next?: string
}>

// Same-origin relative-path allowlist — mirrors `safeNextPath` in actions.ts so
// a hostile `?next=//evil.com` can't slip through into the form's hidden input.
function safeNext(value: string | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { sent, email, next: nextParam } = await searchParams
  const next = safeNext(nextParam)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(next ?? '/dashboard')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-3xl text-foreground">meetthefam</h1>
            <p className="text-sm text-foreground/60">Sign in to continue</p>
          </div>

          {sent ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-foreground/80">
                ✉️ Check your email for a magic link.
              </p>
              {email && (
                <p className="text-xs text-foreground/60">
                  Sent to{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <form action={signInWithGoogle}>
                {next && <input type="hidden" name="next" value={next} />}
                <SubmitButton variant="outline" pendingText="Redirecting…">
                  <GoogleLogo />
                  Continue with Google
                </SubmitButton>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-foreground/40">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form action={signInWithMagicLink} className="space-y-4">
                {next && <input type="hidden" name="next" value={next} />}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <SubmitButton pendingText="Sending magic link…">
                  Send magic link
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}
