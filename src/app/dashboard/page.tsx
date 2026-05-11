import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl text-foreground">
          Welcome to meetthefam
        </h1>
        <p className="text-sm text-foreground/60">
          Signed in as{' '}
          <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <p className="text-xs text-foreground/40">
          Auth + DB wired ✓ — Phase 0 sub-task 6
        </p>
        <SignOutButton />
      </div>
    </main>
  )
}
