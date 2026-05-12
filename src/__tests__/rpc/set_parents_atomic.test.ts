/**
 * Integration tests for the `set_parents_atomic` RPC.
 *
 * Covers:
 *   - all four nullable arg combinations
 *   - self-as-parent rejection
 *   - the ancestor-cycle recursive CTE (1-gen + 4-gen chains)
 *   - cross-tree parent rejection
 *   - early-return on a missing target row
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

const OWNER_EMAIL = 'rpc-parents-owner@test.local'

const admin = adminClient()
let ownerId: string
let ownerClient: SupabaseClient
let treeId: string
let otherTreeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'Parents RPC Tree')
  otherTreeId = await createTree(ownerClient, ownerId, 'Parents RPC Tree 2')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
  await admin.from('people').delete().eq('tree_id', otherTreeId)
})

describe('set_parents_atomic', () => {
  it('sets both father and mother in one call', async () => {
    const fId = await seedPerson(admin, treeId, { full_name: 'Father', gender: 'm' })
    const mId = await seedPerson(admin, treeId, { full_name: 'Mother', gender: 'f' })
    const cId = await seedPerson(admin, treeId, { full_name: 'Child' })

    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: cId,
      p_father_id: fId,
      p_mother_id: mId,
    })
    expect(error).toBeNull()
    const c = await readPerson(admin, cId)
    expect(c?.father_id).toBe(fId)
    expect(c?.mother_id).toBe(mId)
  })

  it('sets only father when mother arg is null', async () => {
    const fId = await seedPerson(admin, treeId, { full_name: 'Father', gender: 'm' })
    const cId = await seedPerson(admin, treeId, { full_name: 'Child' })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: cId,
      p_father_id: fId,
      p_mother_id: null,
    })
    expect(error).toBeNull()
    const c = await readPerson(admin, cId)
    expect(c?.father_id).toBe(fId)
    expect(c?.mother_id).toBeNull()
  })

  it('sets only mother when father arg is null', async () => {
    const mId = await seedPerson(admin, treeId, { full_name: 'Mother', gender: 'f' })
    const cId = await seedPerson(admin, treeId, { full_name: 'Child' })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: cId,
      p_father_id: null,
      p_mother_id: mId,
    })
    expect(error).toBeNull()
    const c = await readPerson(admin, cId)
    expect(c?.father_id).toBeNull()
    expect(c?.mother_id).toBe(mId)
  })

  it('clears both parents when both args are null', async () => {
    const fId = await seedPerson(admin, treeId, { full_name: 'Father', gender: 'm' })
    const mId = await seedPerson(admin, treeId, { full_name: 'Mother', gender: 'f' })
    const cId = await seedPerson(admin, treeId, {
      full_name: 'Child',
      father_id: fId,
      mother_id: mId,
    })

    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: cId,
      p_father_id: null,
      p_mother_id: null,
    })
    expect(error).toBeNull()
    const c = await readPerson(admin, cId)
    expect(c?.father_id).toBeNull()
    expect(c?.mother_id).toBeNull()
  })

  it('rejects self-as-father with P0001 (own parent)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: aId,
      p_father_id: aId,
      p_mother_id: null,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('own parent')
  })

  it('rejects self-as-mother with P0001 (own parent)', async () => {
    const aId = await seedPerson(admin, treeId, { full_name: 'A' })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: aId,
      p_father_id: null,
      p_mother_id: aId,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('own parent')
  })

  it('rejects a direct 2-generation cycle (making your child your parent)', async () => {
    // A is currently B's father. Try to make B the father of A — that closes
    // the loop A→B→A, which the ancestor-walk CTE must detect.
    const aId = await seedPerson(admin, treeId, { full_name: 'A', gender: 'm' })
    const bId = await seedPerson(admin, treeId, {
      full_name: 'B',
      father_id: aId,
    })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: aId,
      p_father_id: bId,
      p_mother_id: null,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('circular ancestry')
  })

  it('rejects a 4-generation cycle (great-grandparent attempt)', async () => {
    // Build A→B→C→D where each child has the previous as father.
    const aId = await seedPerson(admin, treeId, { full_name: 'A', gender: 'm' })
    const bId = await seedPerson(admin, treeId, {
      full_name: 'B',
      gender: 'm',
      father_id: aId,
    })
    const cId = await seedPerson(admin, treeId, {
      full_name: 'C',
      gender: 'm',
      father_id: bId,
    })
    const dId = await seedPerson(admin, treeId, {
      full_name: 'D',
      father_id: cId,
    })
    // Making D the father of A would walk D→C→B→A and detect the cycle.
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: aId,
      p_father_id: dId,
      p_mother_id: null,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('circular ancestry')
  })

  it('rejects a cross-tree parent with P0001 (same family tree)', async () => {
    const childId = await seedPerson(admin, treeId, { full_name: 'Child' })
    const parentId = await seedPerson(admin, otherTreeId, {
      full_name: 'Outsider',
    })
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: childId,
      p_father_id: parentId,
      p_mother_id: null,
    })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('same family tree')
  })

  it('returns silently when the target person id does not exist', async () => {
    // Per the RPC's early-return guard: a missing target row simply yields a
    // 0-row UPDATE and no exception. This protects against RLS races where
    // the row was deleted between the UI's read and the link call.
    const fId = await seedPerson(admin, treeId, { full_name: 'Father' })
    const ghost = '00000000-0000-0000-0000-000000000000'
    const { error } = await ownerClient.rpc('set_parents_atomic', {
      p_person_id: ghost,
      p_father_id: fId,
      p_mother_id: null,
    })
    expect(error).toBeNull()
  })
})
