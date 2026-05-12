import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FamilyTree } from './_components/FamilyTree'
import type { PersonRow } from './_lib/types'
import { AddRelativeFab } from './_components/AddRelativeFab'

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
        <h1 className="font-serif text-3xl text-foreground leading-tight">
          {tree.name}
        </h1>
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
