/**
 * Integration tests for the `delete_person_atomic` RPC.
 *
 * Confirms the FK `on delete set null` cascade on father_id / mother_id /
 * spouse_id cleans up inbound pointers when the target row is deleted
 * (see notes in `supabase/migrations/20260512111009_delete_person_rpc.sql`).
 *
 * Each test seeds rows via the service-role admin client (bypasses RLS),
 * then invokes the RPC via a session authenticated as the tree owner so
 * the policy-gated DELETE runs through the usual `people_delete_editor`
 * path.
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

const OWNER_EMAIL = 'rpc-delete-owner@test.local'

const admin = adminClient()
let ownerId: string
let ownerClient: SupabaseClient
let treeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'Delete RPC Tree')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  // Wipe the tree's people between tests so seeded fixtures don't leak.
  await admin.from('people').delete().eq('tree_id', treeId)
})

describe('delete_person_atomic', () => {
  it("nulls the surviving spouse's spouse_id when one half of a couple is deleted", async () => {
    const aliceId = await seedPerson(admin, treeId, { full_name: 'Alice' })
    const bobId = await seedPerson(admin, treeId, { full_name: 'Bob' })
    // Establish a symmetric bond.
    await admin.from('people').update({ spouse_id: bobId }).eq('id', aliceId)
    await admin.from('people').update({ spouse_id: aliceId }).eq('id', bobId)

    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: aliceId,
    })
    expect(error).toBeNull()

    const alice = await readPerson(admin, aliceId)
    const bob = await readPerson(admin, bobId)
    expect(alice).toBeNull()
    expect(bob?.spouse_id).toBeNull()
  })

  it("nulls children's father_id when their father is deleted", async () => {
    const dadId = await seedPerson(admin, treeId, {
      full_name: 'Dad',
      gender: 'm',
    })
    const kidId = await seedPerson(admin, treeId, {
      full_name: 'Kid',
      father_id: dadId,
    })
    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: dadId,
    })
    expect(error).toBeNull()
    const kid = await readPerson(admin, kidId)
    expect(kid?.father_id).toBeNull()
  })

  it("nulls children's mother_id when their mother is deleted", async () => {
    const momId = await seedPerson(admin, treeId, {
      full_name: 'Mom',
      gender: 'f',
    })
    const kidId = await seedPerson(admin, treeId, {
      full_name: 'Kid',
      mother_id: momId,
    })
    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: momId,
    })
    expect(error).toBeNull()
    const kid = await readPerson(admin, kidId)
    expect(kid?.mother_id).toBeNull()
  })

  it('nulls all three inbound FK kinds (spouse + father + mother) at once', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const spouseId = await seedPerson(admin, treeId, {
      full_name: 'Spouse',
      spouse_id: aId,
    })
    // A points back at spouse to be a symmetric couple. Doesn't matter for the
    // assertion (we delete A), but exercises the realistic shape.
    await admin.from('people').update({ spouse_id: spouseId }).eq('id', aId)

    const childByFatherId = await seedPerson(admin, treeId, {
      full_name: 'Child of A (father)',
      father_id: aId,
    })
    const childByMotherId = await seedPerson(admin, treeId, {
      full_name: 'Child of A (mother)',
      mother_id: aId,
    })

    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: aId,
    })
    expect(error).toBeNull()

    const spouse = await readPerson(admin, spouseId)
    const fatherChild = await readPerson(admin, childByFatherId)
    const motherChild = await readPerson(admin, childByMotherId)
    expect(spouse?.spouse_id).toBeNull()
    expect(fatherChild?.father_id).toBeNull()
    expect(motherChild?.mother_id).toBeNull()
  })

  it('deletes a person with no spouse and no children without error', async () => {
    const loneId = await seedPerson(admin, treeId, { full_name: 'Lone' })
    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: loneId,
    })
    expect(error).toBeNull()
    expect(await readPerson(admin, loneId)).toBeNull()
  })

  it('is a no-op when given a non-existent uuid (no error)', async () => {
    // Random uuid that has no chance of matching a real row.
    const ghost = '00000000-0000-0000-0000-000000000000'
    const { error } = await ownerClient.rpc('delete_person_atomic', {
      p_person_id: ghost,
    })
    expect(error).toBeNull()
  })
})
