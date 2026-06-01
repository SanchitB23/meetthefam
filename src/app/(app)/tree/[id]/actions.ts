'use server'

import { createClient } from '@/lib/supabase/server'
import { refresh, revalidatePath } from 'next/cache'

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

// Phase 3 sub-task 5 — at-creation linking.
//
// `LinkSpecInput` is a discriminated union over the four relations the
// "How is this person related?" radio exposes. Each variant carries the
// focus person's id; the action composes existing sub-task 4 RPCs after
// the insert lands. See the inline notes inside `createPerson` for the
// non-atomic insert/link nuance (the row is kept on linking failure —
// the user can re-link or delete manually).
export type LinkSpecInput =
  | { relation: 'spouse'; focusPersonId: string }
  | { relation: 'father'; focusPersonId: string }
  | { relation: 'mother'; focusPersonId: string }
  | { relation: 'child'; focusPersonId: string }

// Maps Postgres RPC rejection messages to typed error codes.
// Strings matched here are the exact `raise exception` texts from the
// people_link_rpcs migration — do not change without updating that file too.
function mapRpcError(message: string): string {
  if (message.includes('Cannot set a person as their own spouse.')) return 'self_spouse'
  if (message.includes('Spouses must belong to the same family tree.')) return 'cross_tree'
  if (message.includes('Parents must belong to the same family tree as the person.')) return 'cross_tree'
  if (message.includes('This would create a circular ancestry.')) return 'ancestor_cycle'
  return 'unknown'
}

/** Trim string fields and coerce empty strings to null. */
function clean<T extends string | null | undefined>(value: T): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

// ---- Temporal-field validation (defense in depth for Fix 3) ----
//
// The client's react-hook-form rules already block future / impossible
// year inputs at submit time, but a curl POST or a stale tab can bypass
// that. These helpers run on every create + sparse update.
//
// `currentYear` is read at call time so a long-running process won't
// drift past Jan 1 with a stale value.
const YEAR_FLOOR = 1000

function validateBirthYear(year: number): string | null {
  const currentYear = new Date().getFullYear()
  if (year > currentYear) return 'Birth year cannot be in the future.'
  if (year < YEAR_FLOOR) return 'Please enter a valid birth year.'
  return null
}

function validateDeathYear(
  deathYear: number,
  birthYear: number | null,
): string | null {
  const currentYear = new Date().getFullYear()
  if (deathYear > currentYear) return 'Death year cannot be in the future.'
  if (deathYear < YEAR_FLOOR) return 'Please enter a valid death year.'
  if (birthYear != null && deathYear < birthYear) {
    return 'Death year cannot be before birth year.'
  }
  return null
}

function validateBirthDate(date: string): string | null {
  // ISO 'YYYY-MM-DD' strings compare lexically the same way they compare
  // chronologically — that's the whole point of the format.
  const todayISO = new Date().toISOString().slice(0, 10)
  if (date > todayISO) return 'Birth date cannot be in the future.'
  return null
}

export async function createPerson(
  treeId: string,
  data: PersonInput,
  linkSpec?: LinkSpecInput,
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

  // Temporal validation (Fix 3). Each helper returns a user-facing message
  // or null. Mirror the existing 80-char rejection style.
  if (birth_year != null) {
    const err = validateBirthYear(birth_year)
    if (err) return { ok: false, error: err }
  }
  const birth_date = clean(data.birth_date)
  if (birth_date) {
    const err = validateBirthDate(birth_date)
    if (err) return { ok: false, error: err }
  }
  if (death_year != null) {
    const err = validateDeathYear(death_year, birth_year)
    if (err) return { ok: false, error: err }
  }

  const insert = {
    tree_id: treeId,
    created_by: user.id,
    full_name,
    nickname,
    bio,
    gender: data.gender ?? 'unknown',
    birth_year,
    birth_date,
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
    console.error('[createPerson] DB error:', error)
    return { ok: false, error: 'unknown' }
  }

  const newPersonId = row.id

  // Sub-task 5: optional at-creation linking. The insert + the link RPC
  // are NOT atomic — Server Actions can't span a transaction across two
  // Supabase calls without a wrapping RPC. If the link step fails the new
  // row stays in the DB; the user can either re-link manually from the
  // card menu (sub-task 4 flows) or delete the orphan. The alternative —
  // silently rolling back via a DELETE — risks the user thinking their
  // person was saved when it wasn't; explicit error is the safer call.
  //
  // We still `revalidatePath` regardless of link success, since the row
  // exists either way and the UI should reflect that.
  if (linkSpec) {
    const linkError = await applyLinkSpec(
      supabase,
      newPersonId,
      linkSpec,
    )
    if (linkError) {
      revalidatePath(`/tree/${treeId}`)
      return { ok: false, error: linkError }
    }
  }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true, personId: newPersonId }
}

// Composes sub-task 4's `set_spouse_atomic` / `set_parents_atomic` RPCs
// for the at-creation linking flow. Returns an error message on failure,
// or `null` on success. The new person row already exists by the time
// this runs — see the non-atomic note in `createPerson`.
async function applyLinkSpec(
  supabase: Awaited<ReturnType<typeof createClient>>,
  newPersonId: string,
  linkSpec: LinkSpecInput,
): Promise<string | null> {
  if (linkSpec.relation === 'spouse') {
    const { error } = await supabase.rpc('set_spouse_atomic', {
      p_person_a: newPersonId,
      p_person_b: linkSpec.focusPersonId,
    })
    if (error) return mapRpcError(error.message)
    return null
  }

  if (linkSpec.relation === 'father' || linkSpec.relation === 'mother') {
    // We're setting the new person as one of the focus's parents. To
    // avoid clobbering the other parent slot we read it first. One extra
    // round-trip; not worth a dedicated RPC.
    const { data: focus, error: selErr } = await supabase
      .from('people')
      .select('father_id, mother_id')
      .eq('id', linkSpec.focusPersonId)
      .single<{ father_id: string | null; mother_id: string | null }>()
    if (selErr || !focus) {
      console.error('[applyLinkSpec] DB error loading focus person:', selErr)
      return 'unknown'
    }
    const fatherId =
      linkSpec.relation === 'father' ? newPersonId : focus.father_id
    const motherId =
      linkSpec.relation === 'mother' ? newPersonId : focus.mother_id

    const { error } = await supabase.rpc('set_parents_atomic', {
      p_person_id: linkSpec.focusPersonId,
      p_father_id: fatherId,
      p_mother_id: motherId,
    })
    if (error) return mapRpcError(error.message)
    return null
  }

  // relation === 'child': the focus becomes one of the new person's
  // parents; if the focus has a spouse, the spouse fills the other slot.
  // Slot assignment is gender-driven:
  //   - focus.gender === 'f' → focus is the mother
  //   - otherwise            → focus is the father (covers 'm', 'other',
  //                            'unknown' — picking a single default
  //                            avoids prompting the user; they can fix
  //                            it via "Set parents" if it's wrong).
  const { data: focus, error: selErr } = await supabase
    .from('people')
    .select('gender, spouse_id')
    .eq('id', linkSpec.focusPersonId)
    .single<{ gender: 'm' | 'f' | 'other' | 'unknown'; spouse_id: string | null }>()
  if (selErr || !focus) {
    console.error('[applyLinkSpec] DB error loading focus person:', selErr)
    return 'unknown'
  }

  const focusIsMother = focus.gender === 'f'
  let fatherId: string | null = focusIsMother ? null : linkSpec.focusPersonId
  let motherId: string | null = focusIsMother ? linkSpec.focusPersonId : null

  // If the focus has a spouse, they fill whichever parent slot the focus
  // didn't take. We don't read the spouse's gender — putting the focus's
  // partner into the opposite slot from the focus is the only consistent
  // rule when one of them is 'other' / 'unknown'. The user can correct
  // via "Set parents" later if needed.
  if (focus.spouse_id) {
    if (focusIsMother) fatherId = focus.spouse_id
    else motherId = focus.spouse_id
  }

  const { error } = await supabase.rpc('set_parents_atomic', {
    p_person_id: newPersonId,
    p_father_id: fatherId,
    p_mother_id: motherId,
  })
  if (error) return mapRpcError(error.message)
  return null
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
  // ---- Birth date / year priority (Fix #184) ----
  //
  // Rule: birth_date is the single source of truth.  If birth_date is set
  // in the submitted payload, we clear birth_year to prevent drift between
  // the two columns.  If only birth_year is provided (the user knows the
  // year but not the full date), we persist it as-is.
  //
  // Both fields pass through their respective validators before landing in
  // the patch.  The priority enforcement runs after both are resolved so
  // the final patch is internally consistent (birth_date set → birth_year
  // forced to null even if the caller sent both).

  if (data.birth_year !== undefined) {
    const by = Number.isFinite(data.birth_year)
      ? (data.birth_year as number)
      : null
    if (by != null) {
      const err = validateBirthYear(by)
      if (err) return { ok: false, error: err }
    }
    patch.birth_year = by
  }
  if (data.birth_date !== undefined) {
    const bd = clean(data.birth_date)
    if (bd) {
      const err = validateBirthDate(bd)
      if (err) return { ok: false, error: err }
    }
    patch.birth_date = bd
    // birth_date wins: clear birth_year so there is exactly one source of
    // truth.  We only force-null when birth_date is non-null — clearing
    // birth_date (bd === null) does NOT clobber birth_year, preserving
    // the year-only case.
    if (bd !== null) {
      patch.birth_year = null
    }
  }
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
    const dy =
      willBeDeceased && Number.isFinite(data.death_year)
        ? (data.death_year as number)
        : null
    if (dy != null) {
      // Cross-field check uses birth_year only when it's in this same
      // patch — we don't read the existing row. If the user updates just
      // death_year and the stored birth_year would conflict, the client
      // form already shows both inputs together so this case is rare.
      const patchBirthYear =
        typeof patch.birth_year === 'number' ? patch.birth_year : null
      const err = validateDeathYear(dy, patchBirthYear)
      if (err) return { ok: false, error: err }
    }
    patch.death_year = dy
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

  if (error) {
    console.error('[updatePerson] DB error:', error)
    return { ok: false, error: 'unknown' }
  }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}

// ---- Phase 5 sub-task 2: photo upload + remove ----
//
// Two Server Actions sitting alongside createPerson / updatePerson:
//
//   uploadPersonPhoto(treeId, personId, formData)
//     formData carries `file` (a Blob — the JPEG output of resizeToJpeg).
//     Uploads to photos/trees/<treeId>/people/<personId>/avatar.jpg with
//     upsert=true (same path on replace) and writes the resulting public
//     URL to people.photo_url. If the DB write fails after a successful
//     upload, best-effort removes the just-uploaded file so we don't
//     leave an orphan referenced by a stale URL.
//
//   removePersonPhoto(treeId, personId)
//     Deletes the avatar file (silent on 404 — file may already be gone)
//     and nulls people.photo_url. Both operations are best-effort
//     atomic enough that a partial state still lets the user retry.
//
// Both call `refresh()` from next/cache instead of `revalidatePath`
// (per ADR 0007 line 53 — first use of `refresh()` in the project).
// `refresh()` is the Next.js 16 Server-Action-only API that re-fetches
// the page's dynamic data via the client router without invalidating
// any cache shells. We don't have `"use cache"` segments yet (deferred
// post-v0.1), so the page is fully dynamic and `refresh()` alone
// re-fetches the updated photo_url. FamilyTree.tsx's chart-init
// useEffect has `[people]` in its deps, so the new array reference
// from the re-fetch triggers a chart rebuild that picks up the new URL.

const STORAGE_BUCKET = 'photos'
const STORAGE_MIME = 'image/jpeg'

// Mirrors the photos bucket's file_size_limit (524288 = 512 KB) from
// the sub-task 1 migration. Defense in depth: a client that skipped
// resizeToJpeg would otherwise blow through the bucket's lid only when
// the upload hits Storage. Catching it here gives a friendlier error.
const STORAGE_MAX_BYTES = 524288

function personPhotoPath(treeId: string, personId: string): string {
  return `trees/${treeId}/people/${personId}/avatar.jpg`
}

export type UploadPersonPhotoResult =
  | { ok: true; photoUrl: string; error?: never }
  | { ok: false; error: string; photoUrl?: never }

export async function uploadPersonPhoto(
  treeId: string,
  personId: string,
  formData: FormData,
): Promise<UploadPersonPhotoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const file = formData.get('file')
  if (!(file instanceof Blob)) {
    return { ok: false, error: 'No file provided' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'The selected file is empty' }
  }
  if (file.size > STORAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Photo is too large (max ${Math.floor(STORAGE_MAX_BYTES / 1024)} KB after resize)`,
    }
  }

  const path = personPhotoPath(treeId, personId)

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: STORAGE_MIME,
    })
  if (uploadError) {
    console.error('[uploadPersonPhoto] storage error:', uploadError)
    return { ok: false, error: 'unknown' }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)

  const { error: dbError } = await supabase
    .from('people')
    .update({ photo_url: publicUrl })
    .eq('id', personId)

  if (dbError) {
    // Best-effort orphan cleanup: the file is up but the row didn't
    // pick up the URL. Leaving the file would tie an unreferenced
    // ~150 KB to a person row that doesn't know about it.
    const { error: cleanupError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path])
    if (cleanupError) {
      console.warn(
        `uploadPersonPhoto: orphan cleanup failed for ${path}: ${cleanupError.message}`,
      )
    }
    console.error('[uploadPersonPhoto] DB error:', dbError)
    return { ok: false, error: 'unknown' }
  }

  refresh()
  return { ok: true, photoUrl: publicUrl }
}

export type RemovePersonPhotoResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }

export async function removePersonPhoto(
  treeId: string,
  personId: string,
): Promise<RemovePersonPhotoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const path = personPhotoPath(treeId, personId)

  // Order matters: clear the URL on the row first so the avatar UI
  // falls back to initials immediately on the refresh-driven re-render,
  // then remove the file. If the file delete fails the avatar already
  // looks correct; we just have an orphan to GC manually if it matters
  // (it won't — the row's URL is gone, so nothing references it).
  const { error: dbError } = await supabase
    .from('people')
    .update({ photo_url: null })
    .eq('id', personId)
  if (dbError) {
    console.error('[removePersonPhoto] DB error:', dbError)
    return { ok: false, error: 'unknown' }
  }

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path])
  if (storageError) {
    // Don't fail the action — the row is already nulled. A leftover
    // file is harmless because no row points to it.
    console.warn(
      `removePersonPhoto: storage remove failed for ${path}: ${storageError.message}`,
    )
  }

  refresh()
  return { ok: true }
}

// ---- deletePerson ----
//
// Delegates to the `delete_person_atomic` RPC (parallel supabase-engineer
// migration). The RPC nulls any inbound father_id/mother_id/spouse_id FKs
// then deletes the row — all in a single transaction. `SECURITY INVOKER`
// keeps the RLS gate honest.
//
// Storage cleanup is best-effort: after the row delete we attempt to remove
// the canonical avatar object. A failure is logged but does NOT fail the
// action — the row is already gone and a leftover file is harmless (nothing
// references it). Matches the discipline in `removePersonPhoto`.

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

  if (error) {
    console.error('[deletePerson] DB error:', error)
    return { ok: false, error: 'unknown' }
  }

  const avatarPath = personPhotoPath(treeId, personId)
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([avatarPath])
  if (storageError) {
    console.warn(
      `deletePerson: storage remove failed for ${avatarPath}: ${storageError.message}`,
    )
  }

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

  if (error) return { ok: false, error: mapRpcError(error.message) }

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

  if (error) return { ok: false, error: mapRpcError(error.message) }

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

  if (error) {
    console.error('[clearSpouse] DB error:', error)
    return { ok: false, error: 'unknown' }
  }

  revalidatePath(`/tree/${treeId}`)
  return { ok: true }
}
