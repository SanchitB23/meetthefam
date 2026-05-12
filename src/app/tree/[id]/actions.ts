'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Phase 3 sub-task 2: only `createPerson` (no linking, no edit, no delete).
// Sub-tasks 3/4/5 will extend this file with `updatePerson`, `deletePerson`,
// `setSpouse`, `setParents`, `clearSpouse`, and a `linkSpec` argument here.

export type PersonInput = {
  full_name: string
  nickname?: string | null
  bio?: string | null
  gender?: 'm' | 'f' | 'other' | 'unknown'
  birth_year?: number | null
  birth_date?: string | null // ISO date 'YYYY-MM-DD'
  location?: string | null
  occupation?: string | null
  deceased?: boolean
  death_year?: number | null
  // `tone` is intentionally left out of the create flow — the DB trigger
  // assigns it deterministically when null. Sub-task 3 adds the override
  // swatch in the edit form.
  tone?: 'sage' | 'rose' | 'indigo' | 'amber' | 'green' | null
}

export type CreatePersonResult =
  | { ok: true; personId: string; error?: never }
  | { ok: false; error: string; personId?: never }

/** Trim string fields and coerce empty strings to null. */
function clean<T extends string | null | undefined>(value: T): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export async function createPerson(
  treeId: string,
  data: PersonInput,
): Promise<CreatePersonResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const full_name = clean(data.full_name)
  if (!full_name) return { ok: false, error: 'Full name is required' }
  if (full_name.length > 80) {
    return { ok: false, error: 'Full name must be 80 characters or fewer' }
  }

  const nickname = clean(data.nickname)
  if (nickname && nickname.length > 40) {
    return { ok: false, error: 'Nickname must be 40 characters or fewer' }
  }

  const bio = clean(data.bio)
  if (bio && bio.length > 500) {
    return { ok: false, error: 'Bio must be 500 characters or fewer' }
  }

  const deceased = Boolean(data.deceased)
  // death_year only meaningful when deceased; ignore the orphan value otherwise.
  const death_year = deceased
    ? Number.isFinite(data.death_year)
      ? (data.death_year as number)
      : null
    : null
  const birth_year = Number.isFinite(data.birth_year)
    ? (data.birth_year as number)
    : null

  const insert = {
    tree_id: treeId,
    created_by: user.id,
    full_name,
    nickname,
    bio,
    gender: data.gender ?? 'unknown',
    birth_year,
    birth_date: clean(data.birth_date),
    location: clean(data.location),
    occupation: clean(data.occupation),
    deceased,
    death_year,
    // tone null → DB trigger picks one based on full_name hash.
    tone: null,
  }

  const { data: row, error } = await supabase
    .from('people')
    .insert(insert)
    .select('id')
    .single<{ id: string }>()

  if (error || !row) {
    return { ok: false, error: error?.message ?? 'Insert failed' }
  }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true, personId: row.id }
}
