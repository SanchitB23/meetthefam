/**
 * RLS coverage for `trees.share_token` writes.
 *
 * Only the tree's owner should be able to UPDATE share_token via the
 * existing `trees_update_owner` policy. This file proves the matrix:
 * ownerA, ownerB (different tree), editorA (member of treeA), anon.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  adminClient,
  anonClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  addMember,
} from '../_helpers'

const OWNER_A_EMAIL = 'rls-share-owner-a@test.local'
const OWNER_B_EMAIL = 'rls-share-owner-b@test.local'
const EDITOR_A_EMAIL = 'rls-share-editor-a@test.local'

const admin = adminClient()

let ownerAId: string
let ownerBId: string
let editorAId: string
let treeAId: string

beforeAll(async () => {
  ownerAId = await createTestUser(admin, OWNER_A_EMAIL)
  ownerBId = await createTestUser(admin, OWNER_B_EMAIL)
  editorAId = await createTestUser(admin, EDITOR_A_EMAIL)

  const clientA = await signedInClient(OWNER_A_EMAIL)
  treeAId = await createTree(clientA, ownerAId, 'share RLS Tree A')

  const clientB = await signedInClient(OWNER_B_EMAIL)
  await createTree(clientB, ownerBId, 'share RLS Tree B') // unused but ensures B has a tree

  await addMember(admin, treeAId, editorAId, 'editor')
})

afterAll(async () => {
  if (ownerAId) await admin.auth.admin.deleteUser(ownerAId)
  if (ownerBId) await admin.auth.admin.deleteUser(ownerBId)
  if (editorAId) await admin.auth.admin.deleteUser(editorAId)
  await deleteUserByEmail(admin, OWNER_A_EMAIL)
  await deleteUserByEmail(admin, OWNER_B_EMAIL)
  await deleteUserByEmail(admin, EDITOR_A_EMAIL)
})

describe('trees.share_token RLS — UPDATE', () => {
  it('ownerA can UPDATE share_token on their own tree', async () => {
    const c = await signedInClient(OWNER_A_EMAIL)
    const { error, data } = await c
      .from('trees')
      .update({ share_token: 'token-from-owner-a' })
      .eq('id', treeAId)
      .select('id')
    expect(error).toBeNull()
    expect(data).not.toHaveLength(0)

    // Verify ground truth.
    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string }>()
    expect(row?.share_token).toBe('token-from-owner-a')

    // Cleanup.
    await admin.from('trees').update({ share_token: null }).eq('id', treeAId)
  })

  it('ownerB (cross-tree) UPDATE on tree A affects 0 rows', async () => {
    const c = await signedInClient(OWNER_B_EMAIL)
    const { error, data } = await c
      .from('trees')
      .update({ share_token: 'token-from-owner-b' })
      .eq('id', treeAId)
      .select('id')

    // Either error is non-null or no rows came back.
    expect(error == null && (data?.length ?? 0) === 0).toBe(true)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })

  it('editorA (member, not owner) UPDATE on tree A affects 0 rows', async () => {
    const c = await signedInClient(EDITOR_A_EMAIL)
    const { data } = await c
      .from('trees')
      .update({ share_token: 'token-from-editor-a' })
      .eq('id', treeAId)
      .select('id')
    expect(data?.length ?? 0).toBe(0)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })

  it('anon UPDATE on tree A affects 0 rows', async () => {
    const c = anonClient()
    const { data } = await c
      .from('trees')
      .update({ share_token: 'token-from-anon' })
      .eq('id', treeAId)
      .select('id')
    expect(data?.length ?? 0).toBe(0)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })
})
