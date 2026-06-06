/**
 * Vitest integration tests for #184 — birth_date priority in updatePerson.
 *
 * Rule: when birth_date is non-null in the update payload, the server action
 * must clear birth_year (set it to null) so there is exactly one source of
 * truth for the person's birth information.  When only birth_year is provided,
 * it persists unchanged.  When only birth_date is provided, birth_year is
 * cleared even though the caller never explicitly sent birth_year.
 *
 * Tests run against the local Supabase stack (supabase start).  They follow
 * the same pattern as `createPerson-linkSpec.test.ts`:
 *   - vi.mock('next/cache') — revalidatePath is a no-op in tests.
 *   - vi.mock('@/lib/supabase/server') — createClient returns a pre-authed
 *     client via clientHolder so each test can swap identities.
 *   - All DB assertions use the service-role admin client (readPersonBirth)
 *     to bypass RLS and read ground-truth values.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  seedPerson,
} from '../_helpers'

// ---- Module stubs --------------------------------------------------------
// Must be declared before the action import — vi.mock is hoisted.

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op in tests */
  },
  refresh: () => {
    /* no-op in tests */
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!clientHolder.current) {
      throw new Error('Test setup bug: clientHolder.current not initialised')
    }
    return clientHolder.current
  },
}))

import { updatePerson } from '@/app/(app)/tree/[id]/actions'

// ---- Fixtures ------------------------------------------------------------

const OWNER_EMAIL = 'update-birth-priority-owner@test.local'

const admin = adminClient()
let ownerId: string
let treeId: string

// Helper: read birth fields directly from the DB (bypasses RLS).
async function readPersonBirth(
  personId: string,
): Promise<{ birth_year: number | null; birth_date: string | null }> {
  const { data, error } = await admin
    .from('people')
    .select('birth_year, birth_date')
    .eq('id', personId)
    .single<{ birth_year: number | null; birth_date: string | null }>()
  if (error || !data) {
    throw new Error(`readPersonBirth(${personId}) failed: ${error?.message}`)
  }
  return data
}

// ---- Lifecycle -----------------------------------------------------------

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  const ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'Birth Priority Test Tree')
})

afterAll(async () => {
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  // Wire clientHolder to the owner's session before each test so updatePerson
  // sees an authenticated Supabase client.
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

// ---- Tests ---------------------------------------------------------------

describe('updatePerson — birth_date priority (#184)', () => {
  it('(i) both birth_date and birth_year filled → birth_date persists, birth_year cleared', async () => {
    // Seed a person with an explicit birth_year so we have something to clear.
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Both Fields Person',
    })

    // Pre-condition: set both columns via the service-role so we start with
    // a known dirty state (both filled).
    await admin
      .from('people')
      .update({ birth_year: 1985, birth_date: null })
      .eq('id', personId)

    const result = await updatePerson(personId, treeId, {
      birth_date: '1986-03-04',
      birth_year: 1985,
    })

    expect(result.ok).toBe(true)

    const row = await readPersonBirth(personId)
    expect(row.birth_date).toBe('1986-03-04')
    // birth_year must be cleared — birth_date is the single source of truth.
    expect(row.birth_year).toBeNull()
  })

  it('(ii) only birth_year filled → year persists, birth_date unchanged', async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Year Only Person',
    })

    // Ensure birth_date is null so we're testing the year-only case cleanly.
    await admin
      .from('people')
      .update({ birth_year: null, birth_date: null })
      .eq('id', personId)

    const result = await updatePerson(personId, treeId, {
      birth_year: 1970,
      // birth_date intentionally omitted — not present in the patch at all.
    })

    expect(result.ok).toBe(true)

    const row = await readPersonBirth(personId)
    expect(row.birth_year).toBe(1970)
    // birth_date was not in the payload — the DB value (null) is untouched.
    expect(row.birth_date).toBeNull()
  })

  it('(iii) only birth_date filled → date persists, birth_year cleared', async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Date Only Person',
    })

    // Seed a birth_year so we can verify it gets cleared even when the
    // caller did NOT explicitly include birth_year in the payload.
    await admin
      .from('people')
      .update({ birth_year: 1960, birth_date: null })
      .eq('id', personId)

    const result = await updatePerson(personId, treeId, {
      birth_date: '1960-06-15',
      // birth_year intentionally omitted from the payload.
    })

    expect(result.ok).toBe(true)

    const row = await readPersonBirth(personId)
    expect(row.birth_date).toBe('1960-06-15')
    // birth_year was pre-existing in the DB, but birth_date being set must
    // force it to null regardless.
    expect(row.birth_year).toBeNull()
  })
})
