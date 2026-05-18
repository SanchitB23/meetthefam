/**
 * Integration tests for the `createPerson` Server Action with a linkSpec
 * argument — Phase 3 sub-task 5's at-creation linking edge cases.
 *
 * These run the actual `createPerson` source (insert + linkSpec composition
 * via `applyLinkSpec`) against the local Supabase stack. To do so we have
 * to stub Next.js-only modules that the action would otherwise pull in:
 *
 *   - `next/cache` → `revalidatePath` becomes a no-op.
 *   - `@/lib/supabase/server` → `createClient()` returns a hand-built,
 *     pre-authenticated supabase-js client.
 *
 * We do NOT mock the actual Supabase calls — every insert + RPC hits the
 * real local stack and the assertions read ground truth via the service
 * role. This is what the brief means by "use the action directly rather
 * than re-mocking the RPC".
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
  readPerson,
} from '../_helpers'

// ---- Module stubs ------------------------------------------------------
// Must be declared via vi.mock with a getter that reads a mutable holder
// so each test can swap in a freshly authenticated client. vi.mock is
// hoisted above imports, so the action's `import { createClient }` will
// pick up our mock at evaluation time.

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
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

// Import the action AFTER mocks are registered. vitest hoists vi.mock above
// imports automatically but being explicit avoids surprises if the file is
// later refactored.
import { createPerson } from '@/app/(app)/tree/[id]/actions'

// ---- Fixtures ----------------------------------------------------------

const OWNER_EMAIL = 'action-createperson-owner@test.local'

const admin = adminClient()
let ownerId: string
let treeId: string
let otherTreeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  const setupClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(setupClient, ownerId, 'createPerson Action Tree')
  otherTreeId = await createTree(setupClient, ownerId, 'createPerson Other Tree')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
  await admin.from('people').delete().eq('tree_id', otherTreeId)
  // Fresh signed-in client per test so token refresh races can't leak state
  // between describe blocks.
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

describe('createPerson with linkSpec', () => {
  it("Spouse-of-X: clears X's prior spouse Y when the new bond forms", async () => {
    const xId = await seedPerson(admin, treeId, { full_name: 'X' })
    const yId = await seedPerson(admin, treeId, { full_name: 'Y' })
    // Seed prior X↔Y bond.
    await admin.from('people').update({ spouse_id: yId }).eq('id', xId)
    await admin.from('people').update({ spouse_id: xId }).eq('id', yId)

    const res = await createPerson(
      treeId,
      { full_name: 'New Spouse' },
      { relation: 'spouse', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return // type guard for TS below

    const newPerson = await readPerson(admin, res.personId)
    const x = await readPerson(admin, xId)
    const y = await readPerson(admin, yId)
    expect(newPerson?.spouse_id).toBe(xId)
    expect(x?.spouse_id).toBe(res.personId)
    expect(y?.spouse_id).toBeNull()
  })

  it('Father-of-X: preserves X.mother_id (only the father slot changes)', async () => {
    const motherId = await seedPerson(admin, treeId, {
      full_name: 'Original Mom',
      gender: 'f',
    })
    const xId = await seedPerson(admin, treeId, {
      full_name: 'X',
      mother_id: motherId,
    })
    const res = await createPerson(
      treeId,
      { full_name: 'New Dad' },
      { relation: 'father', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const x = await readPerson(admin, xId)
    expect(x?.father_id).toBe(res.personId)
    expect(x?.mother_id).toBe(motherId) // preserved
  })

  it('Mother-of-X: preserves X.father_id (only the mother slot changes)', async () => {
    const fatherId = await seedPerson(admin, treeId, {
      full_name: 'Original Dad',
      gender: 'm',
    })
    const xId = await seedPerson(admin, treeId, {
      full_name: 'X',
      father_id: fatherId,
    })
    const res = await createPerson(
      treeId,
      { full_name: 'New Mom' },
      { relation: 'mother', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const x = await readPerson(admin, xId)
    expect(x?.mother_id).toBe(res.personId)
    expect(x?.father_id).toBe(fatherId) // preserved
  })

  it("Child-of-X (male X, no spouse): father slot filled, mother_id stays null", async () => {
    const xId = await seedPerson(admin, treeId, { full_name: 'X', gender: 'm' })
    const res = await createPerson(
      treeId,
      { full_name: 'Kid' },
      { relation: 'child', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const kid = await readPerson(admin, res.personId)
    expect(kid?.father_id).toBe(xId)
    expect(kid?.mother_id).toBeNull()
  })

  it("Child-of-X (male X with spouse): focus fills father, spouse fills mother", async () => {
    const xId = await seedPerson(admin, treeId, { full_name: 'X', gender: 'm' })
    const spouseId = await seedPerson(admin, treeId, {
      full_name: 'Partner',
      gender: 'f',
    })
    await admin.from('people').update({ spouse_id: spouseId }).eq('id', xId)
    await admin.from('people').update({ spouse_id: xId }).eq('id', spouseId)

    const res = await createPerson(
      treeId,
      { full_name: 'Kid' },
      { relation: 'child', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const kid = await readPerson(admin, res.personId)
    expect(kid?.father_id).toBe(xId)
    expect(kid?.mother_id).toBe(spouseId)
  })

  it("Child-of-X (X.gender='other'): defaults to focus = father per documented rule", async () => {
    const xId = await seedPerson(admin, treeId, { full_name: 'X', gender: 'other' })
    const res = await createPerson(
      treeId,
      { full_name: 'Kid' },
      { relation: 'child', focusPersonId: xId },
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const kid = await readPerson(admin, res.personId)
    expect(kid?.father_id).toBe(xId)
    expect(kid?.mother_id).toBeNull()
  })

  it("orphan row stays in place when the link RPC rejects (e.g. ancestor cycle)", async () => {
    // Build A→B (B.father_id = A). Then try to create a person "Father of A"
    // where the new father IS B — but we have to coerce this through
    // linkSpec=father. Since linkSpec uses the new person as the parent of
    // the focus, we instead build a cycle by trying child-of-A with parent
    // wiring that crashes set_parents_atomic. Simpler path: set_parents_atomic
    // requires same-tree, so an asymmetric cross-tree attempt also rejects.
    //
    // We use the deterministic cross-tree path because it's easier to reason
    // about than reconstructing a cycle through createPerson's slot logic.
    // The focusPersonId points at a person in `otherTreeId`; the new row is
    // inserted into `treeId`; the RPC's same-tree guard rejects with P0001.
    const xId = await seedPerson(admin, otherTreeId, { full_name: 'Other Tree X' })
    const before = await admin
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)

    const res = await createPerson(
      treeId,
      { full_name: 'Orphan' },
      { relation: 'father', focusPersonId: xId },
    )
    // Link rejected — action returns ok:false but the new row WAS inserted
    // into treeId. Verify by counting + by reading the orphan back.
    expect(res.ok).toBe(false)

    const after = await admin
      .from('people')
      .select('id, full_name')
      .eq('tree_id', treeId)
    expect((after.data ?? []).length).toBe((before.count ?? 0) + 1)
    expect(after.data!.some((r) => r.full_name === 'Orphan')).toBe(true)
  })

  it('cross-tree focus rejected when the focus lives in another tree', async () => {
    // Same setup as above but covers the spouse relation, which goes through
    // set_spouse_atomic rather than set_parents_atomic. Both share the same-
    // tree guard.
    const xId = await seedPerson(admin, otherTreeId, { full_name: 'Outsider' })
    const res = await createPerson(
      treeId,
      { full_name: 'New Person' },
      { relation: 'spouse', focusPersonId: xId },
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.toLowerCase()).toContain('same family tree')
  })
})
