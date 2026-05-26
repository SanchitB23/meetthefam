/**
 * Integration tests for the `setSpouse` and `setParents` Server Actions —
 * asserting that the three RPC rejection paths map to typed error codes.
 *
 * These hit the real local Supabase stack and use the same module-stub
 * pattern as `createPerson-linkSpec.test.ts`. The three cases under test:
 *   - setSpouse self-spouse rejection  → { ok: false, error: 'self_spouse' }
 *   - setSpouse cross-tree rejection   → { ok: false, error: 'cross_tree' }
 *   - setParents ancestor-cycle        → { ok: false, error: 'ancestor_cycle' }
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

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => { /* no-op */ },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!clientHolder.current) {
      throw new Error('Test setup bug: clientHolder.current not initialised')
    }
    return clientHolder.current
  },
}))

import { setSpouse, setParents } from '@/app/(app)/tree/[id]/actions'

const OWNER_EMAIL = 'action-linking-owner@test.local'

const admin = adminClient()
let ownerId: string
let treeId: string
let otherTreeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  const setupClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(setupClient, ownerId, 'Linking Actions Tree')
  otherTreeId = await createTree(setupClient, ownerId, 'Linking Actions Other Tree')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
  await admin.from('people').delete().eq('tree_id', otherTreeId)
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

describe('setSpouse RPC rejection mappings', () => {
  it('self-spouse rejection maps to typed code self_spouse', async () => {
    const personId = await seedPerson(admin, treeId, { full_name: 'Alice' })
    const res = await setSpouse(personId, personId, treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('self_spouse')
  })

  it('cross-tree rejection maps to typed code cross_tree', async () => {
    const personA = await seedPerson(admin, treeId, { full_name: 'Alice' })
    const personB = await seedPerson(admin, otherTreeId, { full_name: 'Bob' })
    const res = await setSpouse(personA, personB, treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('cross_tree')
  })
})

describe('setParents RPC rejection mappings', () => {
  it('ancestor-cycle rejection maps to typed code ancestor_cycle', async () => {
    // Build a chain: grandparent → parent → child.
    // Then try to set `child` as the parent of `grandparent` — that closes
    // the cycle and set_parents_atomic raises the circular ancestry exception.
    const grandparentId = await seedPerson(admin, treeId, { full_name: 'Grandparent' })
    const parentId = await seedPerson(admin, treeId, {
      full_name: 'Parent',
      father_id: grandparentId,
    })
    const childId = await seedPerson(admin, treeId, {
      full_name: 'Child',
      father_id: parentId,
    })
    // Try to make `child` the father of `grandparent` — creates a cycle.
    const res = await setParents(grandparentId, childId, null, treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('ancestor_cycle')
  })
})
