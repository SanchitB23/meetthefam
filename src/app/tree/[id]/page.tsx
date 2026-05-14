import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users2 } from 'lucide-react'
import { FamilyTree } from './_components/FamilyTree'
import type { PersonRow } from './_lib/types'
import { AddRelativeFab } from './_components/AddRelativeFab'
import { MembersSheet, type MemberRow, type PendingInviteRow } from './_components/MembersSheet'

type TreeRow = {
  id: string
  name: string
  description: string | null
}

export default async function TreePage(props: PageProps<'/tree/[id]'>) {
  // Phase 4 sub-task 5 — await both async APIs per ADR 0007. `?p=<uuid>`
  // seeds the tree's initial focus person; the FamilyTree client picks
  // a `#p=<uuid>` hash over this on mount when present (hash is the
  // single source of truth at runtime).
  const { id } = await props.params
  const sp = await props.searchParams
  const rawFocus = sp?.p
  const initialFocusId =
    typeof rawFocus === 'string' && rawFocus.length > 0 ? rawFocus : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tree } = await supabase
    .from('trees')
    .select('id, name, description')
    .eq('id', id)
    .maybeSingle<TreeRow>()

  if (!tree) notFound()

  // Phase 6 sub-task 4 — fetch current user's role in this tree.
  // RLS ensures only tree members can read their own row; if the user is
  // not a member this returns null and we 404 (same effect as the tree
  // being inaccessible via the existing people RLS).
  const { data: myMembership } = await supabase
    .from('tree_members')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: 'owner' | 'editor' }>()

  if (!myMembership) notFound()

  const currentUserRole = myMembership.role

  // Phase 6 sub-task 4 — fetch all members for this tree, then their profiles.
  // Two queries instead of a PostgREST embed because `tree_members.user_id`
  // references `auth.users(id)`, NOT `profiles(id)` — PostgREST can't resolve
  // the embed and silently returns null for the joined object (or errors out),
  // producing an empty Members section. Same trap as the invite-page lookup.
  const { data: memberRows } = await supabase
    .from('tree_members')
    .select('user_id, role, joined_at')
    .eq('tree_id', id)
    .order('joined_at', { ascending: true })

  type RawMemberRow = {
    user_id: string
    role: 'owner' | 'editor'
    joined_at: string
  }

  const rawMembers = (memberRows as RawMemberRow[] | null) ?? []

  // Bulk-fetch profiles for the visible members. RLS on `profiles` allows
  // anyone to read display_name + avatar_url, so the caller's session works.
  const memberUserIds = rawMembers.map((m) => m.user_id)
  const profilesByUserId = new Map<
    string,
    { display_name: string | null; avatar_url: string | null }
  >()
  if (memberUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', memberUserIds)
    for (const p of (profileRows as
      | { id: string; display_name: string | null; avatar_url: string | null }[]
      | null) ?? []) {
      profilesByUserId.set(p.id, {
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      })
    }
  }

  const members: MemberRow[] = rawMembers.map((m) => {
    const p = profilesByUserId.get(m.user_id)
    return {
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    }
  })

  // Phase 6 sub-task 4 — fetch pending invites (owner only).
  // `expires_at > now()` filtering: Supabase JS v2 does not have a built-in
  // `.gt('expires_at', 'now()')` — we use `.gt('expires_at', new Date().toISOString())`.
  let pendingInvites: PendingInviteRow[] = []

  if (currentUserRole === 'owner') {
    const { data: inviteRows } = await supabase
      .from('tree_invites')
      .select('id, email, token, created_at, expires_at')
      .eq('tree_id', id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    type RawInviteRow = {
      id: string
      email: string
      token: string
      created_at: string
      expires_at: string
    }

    pendingInvites = (inviteRows as RawInviteRow[] | null ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      token: inv.token,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    }))
  }

  const { data: peopleRows } = await supabase
    .from('people')
    .select(
      `id, tree_id, full_name, nickname, gender, photo_url, bio,
       birth_year, location, occupation, deceased, death_year,
       father_id, mother_id, spouse_id, tone`,
    )
    .eq('tree_id', id)
    .order('created_at', { ascending: true })
    .returns<PersonRow[]>()

  const people = peopleRows ?? []

  // The Members trigger button — rendered server-side, wired to MembersSheet
  // on the client. The button is a plain visual element; MembersSheet wraps
  // it in a role="button" span that handles click + keyboard.
  const membersTrigger = (
    <button
      type="button"
      aria-label="Manage members"
      className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
    >
      <Users2 className="h-5 w-5" />
    </button>
  )

  return (
    <main className="px-4 py-8">
      <div className="flex items-center gap-3 mb-6 max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-3xl text-foreground leading-tight flex-1 min-w-0 truncate">
          {tree.name}
        </h1>
        {/* Phase 6 sub-task 4 — Members icon button in top bar */}
        <MembersSheet
          treeId={tree.id}
          currentUserId={user.id}
          currentUserRole={currentUserRole}
          members={members}
          pendingInvites={pendingInvites}
          trigger={membersTrigger}
        />
      </div>

      {people.length === 0 ? (
        <div className="max-w-4xl mx-auto text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
          <p className="font-serif text-xl text-foreground/70 mb-2">
            No people yet
          </p>
          <p className="text-sm text-foreground/50 mb-6">
            Start by adding the first person in this family.
          </p>
          <AddRelativeFab
            treeId={tree.id}
            focusPerson={null}
            variant="empty-state"
          />
        </div>
      ) : (
        <FamilyTree
          treeId={tree.id}
          people={people}
          initialFocusId={initialFocusId}
        />
      )}
    </main>
  )
}
