import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PersonList } from './_components/PersonList'
import type { PersonRow } from './_components/PersonCard'

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
    <main className="px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
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
        <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
          <p className="font-serif text-xl text-foreground/70 mb-2">
            No people yet
          </p>
          <p className="text-sm text-foreground/50 mb-6">
            Start by adding the first person in this family.
          </p>
          {/* TODO(phase-3 sub-task 2): wire to AddPersonFab / PersonForm. */}
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary/70 text-primary-foreground opacity-60 cursor-not-allowed"
          >
            + Add the first person
          </button>
        </div>
      ) : (
        <PersonList people={people} />
      )}
    </main>
  )
}
