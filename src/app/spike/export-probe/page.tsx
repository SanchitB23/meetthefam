// src/app/_spike/export-probe/page.tsx
// SPIKE #215 — throwaway. Renders the real FamilyTree against a seeded tree for
// export-capture measurement. Loads people with the service-role client so no
// session is needed. DELETE with the probe.
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'
import { Probe } from './Probe'

export const dynamic = 'force-dynamic'

export default async function ExportProbePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string }>
}) {
  const { tree } = await searchParams
  if (!tree) notFound()

  const admin = createServiceRoleClient()
  const { data: people, error } = await admin
    .from('people')
    .select(
      'id, tree_id, full_name, nickname, gender, photo_url, bio, birth_year, birth_date, location, occupation, deceased, death_year, father_id, mother_id, spouse_id, tone',
    )
    .eq('tree_id', tree)
  if (error || !people || people.length === 0) notFound()

  const { data: t } = await admin.from('trees').select('name').eq('id', tree).single()

  return (
    <Probe
      treeId={tree}
      treeName={t?.name ?? 'tree'}
      people={people as PersonRow[]}
    />
  )
}
