'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Phase 3 sub-task 3 adds `updatePerson` + `deletePerson` on top of
// sub-task 2's `createPerson`. Sub-task 4 adds `setSpouse`, `setParents`,
// and `clearSpouse` — thin wrappers around the parallel-landing RPCs in
// the `<ts>_people_link_rpcs.sql` migration (supabase-engineer). Sub-task
// 5 will add a `linkSpec` argument to `createPerson`.

const TONES = ['sage', 'rose', 'indigo', 'amber', 'green'] as const
type ToneLiteral = (typeof TONES)[number]
function isTone(v: unknown): v is ToneLiteral {
  return typeof v === 'string' && (TONES as readonly string[]).includes(v)
}

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

// ---- updatePerson ----
//
// Sub-task 3 design notes:
// - Takes `treeId` explicitly (option (b) from the plan) so we can call
//   `revalidatePath` without a follow-up SELECT. The caller — PersonForm in
//   edit mode — already has it from `person.tree_id`.
// - Build a sparse update payload. Only fields present in `data` get written;
//   undefined fields are left untouched. The `clean()` helper still coerces
//   explicit empty strings → null, but a *missing* key on `data` means "don't
//   touch this column".
// - `tone` accepts the 5 enum values OR `null` (clears the override and lets
//   the DB trigger reassign on the next mutation that nulls it). The form's
//   swatch picker always sends one of the 5 strings, never null.

export type UpdatePersonResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }

export async function updatePerson(
  personId: string,
  treeId: string,
  data: Partial<PersonInput>,
): Promise<UpdatePersonResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // `Record<string, unknown>` because the people row has many columns and
  // we only set what's present. Supabase's typed update would require us
  // to whitelist every column — sparse updates fight the type. RLS gates
  // the actual write so the looser type is acceptable here.
  const patch: Record<string, unknown> = {}

  if (data.full_name !== undefined) {
    const full_name = clean(data.full_name)
    if (!full_name) return { ok: false, error: 'Full name is required' }
    if (full_name.length > 80) {
      return { ok: false, error: 'Full name must be 80 characters or fewer' }
    }
    patch.full_name = full_name
  }

  if (data.nickname !== undefined) {
    const nickname = clean(data.nickname)
    if (nickname && nickname.length > 40) {
      return { ok: false, error: 'Nickname must be 40 characters or fewer' }
    }
    patch.nickname = nickname
  }

  if (data.bio !== undefined) {
    const bio = clean(data.bio)
    if (bio && bio.length > 500) {
      return { ok: false, error: 'Bio must be 500 characters or fewer' }
    }
    patch.bio = bio
  }

  if (data.gender !== undefined) patch.gender = data.gender ?? 'unknown'
  if (data.birth_year !== undefined) {
    patch.birth_year = Number.isFinite(data.birth_year)
      ? (data.birth_year as number)
      : null
  }
  if (data.birth_date !== undefined) patch.birth_date = clean(data.birth_date)
  if (data.location !== undefined) patch.location = clean(data.location)
  if (data.occupation !== undefined) patch.occupation = clean(data.occupation)

  // `deceased` + `death_year` move together: if `deceased` is being set to
  // false, force death_year to null even if the caller didn't pass it.
  if (data.deceased !== undefined) {
    patch.deceased = Boolean(data.deceased)
    if (!data.deceased) patch.death_year = null
  }
  if (data.death_year !== undefined) {
    // Only honour death_year when the row is (or is being set) deceased.
    const willBeDeceased = data.deceased ?? true
    patch.death_year =
      willBeDeceased && Number.isFinite(data.death_year)
        ? (data.death_year as number)
        : null
  }

  if (data.tone !== undefined) {
    if (data.tone === null) {
      patch.tone = null
    } else if (!isTone(data.tone)) {
      return { ok: false, error: 'Invalid tone' }
    } else {
      patch.tone = data.tone
    }
  }

  if (Object.keys(patch).length === 0) {
    // No-op update — return ok rather than round-tripping to the DB.
    return { ok: true }
  }

  const { error } = await supabase.from('people').update(patch).eq('id', personId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}

// ---- deletePerson ----
//
// Delegates to the `delete_person_atomic` RPC (parallel supabase-engineer
// migration). The RPC nulls any inbound father_id/mother_id/spouse_id FKs
// then deletes the row — all in a single transaction. `SECURITY INVOKER`
// keeps the RLS gate honest.

export type DeletePersonResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }

export async function deletePerson(
  personId: string,
  treeId: string,
): Promise<DeletePersonResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase.rpc('delete_person_atomic', {
    p_person_id: personId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}

// ---- Linking actions (sub-task 4) ----
//
// Each wrapper:
//   1. Verifies the user is signed in (defense in depth — RLS gates the
//      actual write inside the RPC because the RPCs are SECURITY INVOKER).
//   2. Calls the corresponding `*_atomic` Postgres function by name.
//      Supabase's `.rpc()` is stringly-typed for function names, so the
//      typecheck passes even though the RPCs ship in a separate migration
//      in parallel with this PR.
//   3. Surfaces the RPC's `error.message` to the caller — the supabase-
//      engineer's brief calls for user-facing error text on the three
//      rejection cases (self-spouse, cross-tree, ancestor cycle).
//   4. `revalidatePath('/tree/' + treeId)` so the list reflects the new
//      links on the next render.

export type SetSpouseResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }
export type SetParentsResult = SetSpouseResult
export type ClearSpouseResult = SetSpouseResult

export async function setSpouse(
  personA: string,
  personB: string,
  treeId: string,
): Promise<SetSpouseResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase.rpc('set_spouse_atomic', {
    p_person_a: personA,
    p_person_b: personB,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}

export async function setParents(
  personId: string,
  fatherId: string | null,
  motherId: string | null,
  treeId: string,
): Promise<SetParentsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase.rpc('set_parents_atomic', {
    p_person_id: personId,
    p_father_id: fatherId,
    p_mother_id: motherId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}

export async function clearSpouse(
  personId: string,
  treeId: string,
): Promise<ClearSpouseResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase.rpc('clear_spouse_atomic', {
    p_person_id: personId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}
