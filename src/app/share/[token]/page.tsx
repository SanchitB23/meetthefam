import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { FamilyTree } from '@/app/tree/[id]/_components/FamilyTree'
import type { PersonRow } from '@/app/tree/[id]/_lib/types'
import { ShareBanner } from './_components/ShareBanner'

// Phase 7 sub-task 3 — public read-only share view.
//
// This is the ONLY route in the project that runs with the service-role
// client against the people / trees tables. The token IS the auth: a
// 256-bit random value, brute-forcing is infeasible. RLS is bypassed
// deliberately because the share viewer has no session.
//
// /share/* is already excluded from src/proxy.ts's auth matcher so this
// page is anonymously reachable.

export const metadata = {
  title: 'Shared family tree · meetthefam',
}

type TreeRow = {
  id: string
  name: string
  description: string | null
}

export default async function SharePage(props: PageProps<'/share/[token]'>) {
  const { token } = await props.params

  const supabase = createServiceRoleClient()

  // Token lookup. .maybeSingle() returns null (not an error) when no row
  // matches — covers null share_token, regenerated-old token, and
  // never-existed.
  const { data: tree } = await supabase
    .from('trees')
    .select('id, name, description')
    .eq('share_token', token)
    .maybeSingle<TreeRow>()

  if (!tree) notFound()

  const { data: peopleRows } = await supabase
    .from('people')
    .select(
      `id, tree_id, full_name, nickname, gender, photo_url, bio,
       birth_year, location, occupation, deceased, death_year,
       father_id, mother_id, spouse_id, tone`,
    )
    .eq('tree_id', tree.id)
    .order('created_at', { ascending: true })
    .returns<PersonRow[]>()

  const people = peopleRows ?? []

  return (
    <main className="min-h-screen flex flex-col">
      <ShareBanner />

      <div className="px-4 pt-6 pb-2 max-w-4xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-foreground leading-tight">
          {tree.name}
        </h1>
        {tree.description && (
          <p className="text-foreground/70 text-sm mt-1">{tree.description}</p>
        )}
      </div>

      <div className="px-4 pb-8 flex-1 max-w-4xl mx-auto w-full">
        {people.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
            <p className="font-serif text-xl text-foreground/70">
              This tree is empty.
            </p>
          </div>
        ) : (
          <FamilyTree
            treeId={tree.id}
            people={people}
            readOnly
          />
        )}
      </div>
    </main>
  )
}
