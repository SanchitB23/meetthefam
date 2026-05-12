import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FamilyTree } from './_components/FamilyTree'
import type { PersonRow } from './_lib/types'
import { AddPersonControls } from './_components/AddPersonControls'

type TreeRow = {
  id: string
  name: string
  description: string | null
}

export default async function TreePage(props: PageProps<'/tree/[id]'>) {
  const { id } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // proxy.ts already gates /tree/*, but mirror the dashboard's defensive
  // redirect — keeps the page self-contained if matchers ever drift.
  if (!user) redirect('/login')

  // RLS gates membership: non-members see no row → notFound() below.
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
    // Phase 4: the tree canvas wants full-bleed width on desktop (per
    // docs/ux/tree-view.md). The header + empty state are still constrained
    // to `max-w-4xl` for readability — only the chart breaks out.
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
        // family-chart can't render an empty dataset, so the empty-state
        // branch stays — same shape Phase 3 shipped, with the CTA wired to
        // the existing create form.
        <div className="max-w-4xl mx-auto text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
          <p className="font-serif text-xl text-foreground/70 mb-2">
            No people yet
          </p>
          <p className="text-sm text-foreground/50 mb-6">
            Start by adding the first person in this family.
          </p>
          <AddPersonControls treeId={tree.id} showEmptyStateCta />
        </div>
      ) : (
        <>
          <FamilyTree people={people} />
          <AddPersonControls treeId={tree.id} />
        </>
      )}
    </main>
  )
}
