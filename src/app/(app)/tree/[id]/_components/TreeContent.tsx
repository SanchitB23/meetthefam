import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Settings } from 'lucide-react'
import { FamilyTreeClient } from './FamilyTreeClient'
import type { PersonRow } from '../_lib/types'
import { AddRelativeFab } from './AddRelativeFab'
import { ExportTreeButton } from './ExportTreeButton'
import { TreeSettingsSheet, type MemberRow, type PendingInviteRow } from './TreeSettingsSheet'
import { LinkProgress } from '@/components/ui/LinkProgress'

type TreeRow = {
  id: string
  name: string
  description: string | null
  share_token: string | null
}

type Props = {
  treeId: string
  userId: string
  tree: TreeRow
  currentUserRole: 'owner' | 'editor'
  initialFocusId: string | null
  baseUrl: string
}

/**
 * Server component that runs the bulk data queries (members, profiles, invites,
 * people) and renders the tree page body. Mounted inside a <Suspense> in
 * TreePage so the auth/permission gates can redirect/404 immediately while
 * this slower multi-query fetch streams behind the heirloom skeleton.
 *
 * Phase 8c-4: Suspense boundary pattern (part of closing #50).
 */
export async function TreeContent({
  treeId,
  userId,
  tree,
  currentUserRole,
  initialFocusId,
  baseUrl,
}: Props) {
  const supabase = await createClient()

  type RawMemberRow = {
    user_id: string
    role: 'owner' | 'editor'
    joined_at: string
  }
  type RawInviteRow = {
    id: string
    email: string
    token: string
    created_at: string
    expires_at: string
  }

  // The members, people, and (owner-only) invites reads are independent, so run
  // them concurrently instead of as a serial waterfall — the tree title (LCP)
  // waits on TreeContent resolving, so collapsing the waterfall paints it
  // sooner. `profiles` depends on the member ids, so it runs in a second wave.
  //
  // Members + profiles are two queries (not a PostgREST embed) because
  // `tree_members.user_id` references `auth.users(id)`, NOT `profiles(id)` — the
  // embed silently returns null. `expires_at > now()`: Supabase JS v2 has no
  // `.gt(..., 'now()')`, so we pass `new Date().toISOString()`. Perf #249.
  const [memberRes, peopleRes, inviteRes] = await Promise.all([
    supabase
      .from('tree_members')
      .select('user_id, role, joined_at')
      .eq('tree_id', treeId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('people')
      .select(
        `id, tree_id, full_name, nickname, gender, photo_url, bio,
         birth_year, birth_date, location, occupation, deceased, death_year,
         father_id, mother_id, spouse_id, tone`,
      )
      .eq('tree_id', treeId)
      // id tiebreak (#228): created_at defaults to now(), fixed per transaction
      // — batch inserts tie, and order among ties is arbitrary.
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .returns<PersonRow[]>(),
    currentUserRole === 'owner'
      ? supabase
          .from('tree_invites')
          .select('id, email, token, created_at, expires_at')
          .eq('tree_id', treeId)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as RawInviteRow[] }),
  ])

  const rawMembers = (memberRes.data as RawMemberRow[] | null) ?? []
  const people = peopleRes.data ?? []

  // Bulk-fetch profiles for the visible members (second wave — needs the ids).
  // RLS on `profiles` allows anyone to read display_name + avatar_url.
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

  const pendingInvites: PendingInviteRow[] = (
    (inviteRes.data as RawInviteRow[] | null) ?? []
  ).map((inv) => ({
    id: inv.id,
    email: inv.email,
    token: inv.token,
    created_at: inv.created_at,
    expires_at: inv.expires_at,
  }))

  const settingsTrigger = (
    <button
      type="button"
      aria-label="Tree settings"
      className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
    >
      <Settings className="h-5 w-5" />
    </button>
  )

  return (
    <main className="px-4 py-8">
      <div className="flex items-center gap-3 mb-6 max-w-4xl mx-auto">
        <LinkProgress
          href="/dashboard"
          aria-label="Back to dashboard"
          className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </LinkProgress>
        <h1 className="font-serif text-3xl text-foreground leading-tight flex-1 min-w-0 truncate">
          {tree.name}
        </h1>
        {people.length > 0 && <ExportTreeButton treeName={tree.name} />}
        <TreeSettingsSheet
          key={tree.id}
          treeId={tree.id}
          treeName={tree.name}
          currentUserId={userId}
          currentUserRole={currentUserRole}
          members={members}
          pendingInvites={pendingInvites}
          shareToken={tree.share_token}
          baseUrl={baseUrl}
          trigger={settingsTrigger}
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
        <FamilyTreeClient
          treeId={tree.id}
          people={people}
          initialFocusId={initialFocusId}
        />
      )}
    </main>
  )
}
