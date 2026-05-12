/**
 * Integration tests for the `set_spouse_atomic` RPC.
 *
 * Covers the spouse-symmetry guarantees + the two rejection cases in
 * `supabase/migrations/20260512112332_people_link_rpcs.sql`:
 *   - self-spouse → P0001 'own spouse'
 *   - cross-tree → P0001 'same family tree'
 *
 * Bond transitions exercise the "clear prior on either side" semantics:
 * the new bond must be the ONLY bond either party participates in after
 * the call returns.
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

const OWNER_EMAIL = 'rpc-spouse-owner@test.local'

const admin = adminClient()
let ownerId: string
let ownerClient: SupabaseClient
let treeId: string
let otherTreeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'Spouse RPC Tree')
  otherTreeId = await createTree(ownerClient, ownerId, 'Spouse RPC Tree 2')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
  await admin.from('people').delete().eq('tree_id', otherTreeId)
})

async function setBond(a: string, b: string) {
  await admin.from('people').update({ spouse_id: b }).eq('id', a)
  await admin.from('people').update({ spouse_id: a }).eq('id', b)
}

describe('set_spouse_atomic', () => {
  it('sets a bidirectional spouse bond between two people', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: bId,
    })
    expect(error).toBeNull()
    const a = await readPerson(admin, aId)
    const b = await readPerson(admin, bId)
    expect(a?.spouse_id).toBe(bId)
    expect(b?.spouse_id).toBe(aId)
  })

  it("clears A's prior spouse when re-spousing A to a new partner", async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    const cId = await seedPerson(admin, treeId, { full_name: 'C' })
    await setBond(aId, bId)

    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: cId,
    })
    expect(error).toBeNull()

    expect((await readPerson(admin, aId))?.spouse_id).toBe(cId)
    expect((await readPerson(admin, cId))?.spouse_id).toBe(aId)
    expect((await readPerson(admin, bId))?.spouse_id).toBeNull()
  })

  it("clears B's prior spouse when the new partner had a different bond", async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const cId = await seedPerson(admin, treeId, { full_name: 'C' })
    const dId = await seedPerson(admin, treeId, { full_name: 'D' })
    await setBond(cId, dId) // C↔D exists

    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: dId,
    })
    expect(error).toBeNull()

    expect((await readPerson(admin, aId))?.spouse_id).toBe(dId)
    expect((await readPerson(admin, dId))?.spouse_id).toBe(aId)
    expect((await readPerson(admin, cId))?.spouse_id).toBeNull()
  })

  it('clears prior spouses on BOTH sides when both parties were paired', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    const cId = await seedPerson(admin, treeId, { full_name: 'C' })
    const dId = await seedPerson(admin, treeId, { full_name: 'D' })
    await setBond(aId, bId)
    await setBond(cId, dId)

    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: cId,
    })
    expect(error).toBeNull()

    expect((await readPerson(admin, aId))?.spouse_id).toBe(cId)
    expect((await readPerson(admin, cId))?.spouse_id).toBe(aId)
    expect((await readPerson(admin, bId))?.spouse_id).toBeNull()
    expect((await readPerson(admin, dId))?.spouse_id).toBeNull()
  })

  it('is a no-op when re-affirming an existing A↔B bond', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const bId = await seedPerson(admin, treeId, { full_name: 'B' })
    await setBond(aId, bId)

    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: bId,
    })
    expect(error).toBeNull()
    expect((await readPerson(admin, aId))?.spouse_id).toBe(bId)
    expect((await readPerson(admin, bId))?.spouse_id).toBe(aId)
  })

  it('rejects a self-spouse attempt with P0001 (own spouse)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: aId,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('own spouse')
  })

  it('rejects a cross-tree pairing with P0001 (same family tree)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const xId = await seedPerson(admin, otherTreeId, { full_name: 'X' })
    const { error } = await ownerClient.rpc('set_spouse_atomic', {
      p_person_a: aId,
      p_person_b: xId,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('same family tree')
  })
})
