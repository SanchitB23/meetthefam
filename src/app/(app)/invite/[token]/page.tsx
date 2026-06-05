/**
 * /invite/[token] — Server Component
 *
 * Accept-invite confirm page.  Reads the invite row via the service-role client
 * (bypassing RLS so the token lookup works before the invitee is a member),
 * validates all five error states server-side, and renders the appropriate
 * card.  The confirm card's form action calls the `acceptInvite` Server Action
 * and redirects to the tree on success, or back here with `?error=<tag>` on
 * failure.
 *
 * Auth gate: the proxy (src/proxy.ts) redirects unauthenticated users to
 * `/login?next=/invite/<token>` before this component is ever reached.  The
 * session check here is a defence-in-depth guard (e.g. after session expiry).
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { acceptInvite } from '@/app/(app)/tree/[id]/members/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ToastFromSearchParams } from '@/components/ui/ToastFromSearchParams'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InviteRow = {
  id: string
  email: string
  tree_id: string
  invited_by: string
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
  trees: { name: string } | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// ---------------------------------------------------------------------------
// Page props — manual shape (route is new; routes.d.ts hasn't been rebuilt yet)
// ---------------------------------------------------------------------------
interface InvitePageProps {
  params: Promise<{ token: string }>
  searchParams: SearchParams
}

// ---------------------------------------------------------------------------
// Inline Server Action — called by the confirm form
// ---------------------------------------------------------------------------
async function acceptInviteAction(formData: FormData) {
  'use server'
  const token = formData.get('token')
  if (!token || typeof token !== 'string') {
    redirect('/dashboard')
  }

  const result = await acceptInvite(token)

  if (result.ok) {
    redirect('/tree/' + result.treeId)
  }

  // Redirect back to the same page with the error tag so the Server Component
  // can render the appropriate error card (mirrors the login page pattern).
  redirect(`/invite/${token}?error=${result.error}`)
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function BackToDashboard() {
  return (
    <Link
      href="/dashboard"
      className="mt-4 inline-block text-sm text-foreground/60 hover:text-foreground underline underline-offset-2 transition-colors"
    >
      Back to dashboard
    </Link>
  )
}

interface ErrorCardProps {
  title: string
  message: string
  showDashboardLink?: boolean
}

function ErrorCard({ title, message, showDashboardLink = true }: ErrorCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-2 text-center max-w-md w-full">
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      <p className="text-sm text-foreground/70">{message}</p>
      {showDashboardLink && <BackToDashboard />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params
  await searchParams // consumed by ToastFromSearchParams client bridge

  // --- Auth gate (defence-in-depth; proxy already redirects anon users) ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/invite/' + token)
  }

  // --- Service-role lookup of the invite row ---
  const service = createServiceRoleClient()

  const { data: invite, error: fetchError } = await service
    .from('tree_invites')
    .select(
      `id, email, tree_id, invited_by, accepted_at, revoked_at, expires_at,
       trees ( name )`,
    )
    .eq('token', token)
    .maybeSingle<InviteRow>()

  if (fetchError) {
    console.error('InvitePage: service-role lookup failed', fetchError)
  }

  // Separate profile lookup — `tree_invites.invited_by` references `auth.users(id)`,
  // not `profiles(id)`, so PostgREST can't resolve an embedded join. Two queries
  // is the simplest correct shape.
  let inviterDisplayName: string | null = null
  if (invite?.invited_by) {
    const { data: inviterProfile } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', invite.invited_by)
      .maybeSingle<{ display_name: string | null }>()
    inviterDisplayName = inviterProfile?.display_name ?? null
  }

  const treeName = invite?.trees?.name ?? 'a family tree'
  const inviterName = inviterDisplayName ?? 'Someone'

  // --- Render wrapper ---
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <div className="w-full max-w-md space-y-6">
        <h1 className="font-serif text-3xl text-foreground text-center">
          meetthefam
        </h1>

        {renderCard({
          invite,
          token,
          user,
          treeName,
          inviterName,
        })}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Card dispatch — keeps the JSX for each state readable
// ---------------------------------------------------------------------------

interface CardProps {
  invite: InviteRow | null
  token: string
  user: { email?: string | null }
  treeName: string
  inviterName: string
}

function renderCard({
  invite,
  token,
  user,
  treeName,
  inviterName,
}: CardProps) {
  // 1. Not found
  if (!invite) {
    return (
      <ErrorCard
        title="Invite not found"
        message="This invite link is invalid or has already been used. Ask the tree owner to send you a fresh link."
      />
    )
  }

  // 2. Revoked (checked before expired — mirrors the RPC validation order)
  if (invite.revoked_at !== null) {
    return (
      <ErrorCard
        title="Invite cancelled"
        message="The tree owner has cancelled this invite. Ask them to send you a new one."
      />
    )
  }

  // 3. Expired
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <ErrorCard
        title="Invite expired"
        message="This invite link expired after 7 days. Ask the tree owner to resend it."
      />
    )
  }

  // 4. Email mismatch — show both emails so the user knows which account to use
  if (
    user.email?.toLowerCase() !== invite.email.toLowerCase()
  ) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-3 text-center max-w-md w-full">
        <h2 className="font-serif text-xl text-foreground">Wrong account</h2>
        <p className="text-sm text-foreground/70">
          This invite was sent to{' '}
          <span className="font-medium text-foreground">{invite.email}</span>,
          but you&rsquo;re signed in as{' '}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
        <p className="text-sm text-foreground/60">
          Sign in with the correct account to accept this invite.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={`/login?next=/invite/${token}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in with a different account
          </Link>
          <BackToDashboard />
        </div>
      </div>
    )
  }

  // 5. Already accepted — offer to go straight to the tree
  if (invite.accepted_at !== null) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-3 text-center max-w-md w-full">
        <h2 className="font-serif text-xl text-foreground">Already joined</h2>
        <p className="text-sm text-foreground/70">
          You&rsquo;ve already accepted this invite and are a member of{' '}
          <span className="font-medium text-foreground">{treeName}</span>.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={`/tree/${invite.tree_id}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to tree
          </Link>
          <BackToDashboard />
        </div>
      </div>
    )
  }

  // --- Confirm card (happy path) ---
  // Post-submit errors are surfaced as `?error=<code>` and shown via the
  // ToastFromSearchParams client bridge (e.g. race-condition revoke after load).
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-md w-full">
      <div className="space-y-1 text-center">
        <h2 className="font-serif text-2xl text-foreground">
          {treeName}
        </h2>
        <p className="text-sm text-foreground/60">
          {inviterName} has invited you to join as an editor.
        </p>
      </div>

      <div className="rounded-md bg-muted px-4 py-3 text-sm text-foreground/70 text-center">
        You&rsquo;ll be able to add, edit, and manage people in this tree.
      </div>

      <form action={acceptInviteAction}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton pendingText="Joining…">Accept invite</SubmitButton>
      </form>

      <div className="text-center">
        <BackToDashboard />
      </div>
    </div>
  )
}

