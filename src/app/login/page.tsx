import { signInWithMagicLink } from './actions'
import { Button } from '@/components/ui/button'

type SearchParams = Promise<{ sent?: string; error?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { sent, error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-3xl text-foreground">meetthefam</h1>
          <p className="text-sm text-foreground/60">Sign in with your email</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground/80">
              ✉️ Check your email for a magic link.
            </p>
          </div>
        ) : (
          <form action={signInWithMagicLink} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">
                {decodeURIComponent(error)}
              </p>
            )}
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
            <Button type="submit" className="w-full">
              Send magic link
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
