/**
 * Integration tests for the `clear_spouse_atomic` RPC.
 *
 * The RPC is symmetric: clearing from either end nulls both sides. It is
 * also idempotent — calling on a person with no spouse is a safe no-op.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  seedPerson,
  readPerson,
} from '../_helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

const OWNER_EMAIL = 'rpc-clear-spouse-owner@test.local'

const admin = adminClient()
let ownerId: string
let ownerClient: SupabaseClient
let treeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'Clear Spouse RPC Tree')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
})

async function setBond(a: string, b: string) {
  await admin.from('people').update({ spouse_id: b }).eq('id', a)
  await admin.from('people').update({ spouse_id: a }).eq('id', b)
}

describe('clear_spouse_atomic', () => {
  it('nulls both ends when called from A in an A↔B bond', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    await setBond(aId, bId)

    const { error } = await ownerClient.rpc('clear_spouse_atomic', {
      p_person_id: aId,
    })
    expect(error).toBeNull()
    expect((await readPerson(admin, aId))?.spouse_id).toBeNull()
    expect((await readPerson(admin, bId))?.spouse_id).toBeNull()
  })

  it('nulls both ends when called from B in an A↔B bond (symmetric)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    await setBond(aId, bId)

    const { error } = await ownerClient.rpc('clear_spouse_atomic', {
      p_person_id: bId,
    })
    expect(error).toBeNull()
    expect((await readPerson(admin, aId))?.spouse_id).toBeNull()
    expect((await readPerson(admin, bId))?.spouse_id).toBeNull()
  })

  it('is a no-op when the target has no spouse (no error)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const { error } = await ownerClient.rpc('clear_spouse_atomic', {
      p_person_id: aId,
    })
    expect(error).toBeNull()
    expect((await readPerson(admin, aId))?.spouse_id).toBeNull()
  })
})
