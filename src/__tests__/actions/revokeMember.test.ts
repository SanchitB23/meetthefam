/**
 * Integration tests for the `revokeMember` Server Action.
 *
 * The most important test in this file is "post-revoke RLS" — it proves that
 * after revocation, the ex-editor's `signedInClient` is immediately blocked by
 * RLS from writing to the tree's `people` rows.  This is the spec's "revoked
 * editors immediately lose RLS-gated reads + writes" gate.
 *
 * Stubs:
 *   - `next/cache` → `revalidatePath` no-op.
 *   - `@/lib/supabase/server` → swappable clientHolder (per test).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  addMember,
  seedPerson,
} from '../_helpers'

// ---- Module stubs ----------------------------------------------------------

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op */
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

import { revokeMember } from '@/app/(app)/tree/[id]/members/actions'

// ---- Fixtures --------------------------------------------------------------

const OWNER_A_EMAIL = 'action-revoke-owner-a@test.local'
const OWNER_B_EMAIL = 'action-revoke-owner-b@test.local'
const EDITOR_EMAIL = 'action-revoke-editor@test.local'
const SECOND_EDITOR_EMAIL = 'action-revoke-editor-2@test.local'

const admin = adminClient()
let ownerAId: string
let ownerBId: string
let editorId: string
let secondEditorId: string
let treeAId: string
let treeBId: string

beforeAll(async () => {
  ownerAId = await createTestUser(admin, OWNER_A_EMAIL)
  ownerBId = await createTestUser(admin, OWNER_B_EMAIL)
  editorId = await createTestUser(admin, EDITOR_EMAIL)
  secondEditorId = await createTestUser(admin, SECOND_EDITOR_EMAIL)

  const clientA = await signedInClient(OWNER_A_EMAIL)
  treeAId = await createTree(clientA, ownerAId, 'revokeMember Tree A')

  const clientB = await signedInClient(OWNER_B_EMAIL)
  treeBId = await createTree(clientB, ownerBId, 'revokeMember Tree B')
})

afterAll(async () => {
  // People rows cascade on tree delete; trees cascade on user delete.
  if (ownerAId) await admin.auth.admin.deleteUser(ownerAId)
  if (ownerBId) await admin.auth.admin.deleteUser(ownerBId)
  if (editorId) await admin.auth.admin.deleteUser(editorId)
  if (secondEditorId) await admin.auth.admin.deleteUser(secondEditorId)
  await deleteUserByEmail(admin, OWNER_A_EMAIL)
  await deleteUserByEmail(admin, OWNER_B_EMAIL)
  await deleteUserByEmail(admin, EDITOR_EMAIL)
  await deleteUserByEmail(admin, SECOND_EDITOR_EMAIL)
})

beforeEach(async () => {
  // Remove all non-owner members from treeA to give each test a clean slate.
  await admin
    .from('tree_members')
    .delete()
    .eq('tree_id', treeAId)
    .neq('role', 'owner')
  clientHolder.current = await signedInClient(OWNER_A_EMAIL)
})

// ---- Tests -----------------------------------------------------------------

describe('revokeMember', () => {
  it('happy path — owner revokes an editor → editor row removed from tree_members', async () => {
    await addMember(admin, treeAId, editorId, 'editor')

    const res = await revokeMember(treeAId, editorId)
    expect(res.ok).toBe(true)

    const { data: rows } = await admin
      .from('tree_members')
      .select('user_id')
      .eq('tree_id', treeAId)
      .eq('user_id', editorId)
    expect(rows).toHaveLength(0)
  })

  it('post-revoke RLS — revoked editor cannot UPDATE a person in that tree', async () => {
    // Set up: editor is a member, seed a person.
    await addMember(admin, treeAId, editorId, 'editor')
    const personId = await seedPerson(admin, treeAId, {
      full_name: 'Pre-Revoke Person',
    })

    // Revoke via owner.
    const revokeRes = await revokeMember(treeAId, editorId)
    expect(revokeRes.ok).toBe(true)

    // Now attempt the edit as the (now ex-)editor directly via the DB client.
    const exEditorClient = await signedInClient(EDITOR_EMAIL)
    const { error } = await exEditorClient
      .from('people')
      .update({ full_name: 'After-Revoke Hijack' })
      .eq('id', personId)

    // Either an RLS error is returned, or the update silently affects 0 rows.
    // Either way, the DB row must be unchanged.
    const { data: after } = await admin
      .from('people')
      .select('full_name')
      .eq('id', personId)
      .single<{ full_name: string }>()

    if (error) {
      // Explicit RLS rejection — also acceptable.
      expect(after?.full_name).toBe('Pre-Revoke Person')
    } else {
      // Silent filter — the row must be unchanged.
      expect(after?.full_name).toBe('Pre-Revoke Person')
    }

    // Belt-and-braces: regardless of error path, the name must not have changed.
    expect(after?.full_name).not.toBe('After-Revoke Hijack')

    // Cleanup.
    await admin.from('people').delete().eq('id', personId)
  })

  it('owner-self-revoke protection — owner cannot revoke themselves (role filter excludes owner row)', async () => {
    const res = await revokeMember(treeAId, ownerAId)
    // The role='editor' filter in the action means the owner row is never
    // matched; the action returns not_found_or_not_editor.
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_found_or_not_editor')

    // Owner membership must still exist.
    const { data: rows } = await admin
      .from('tree_members')
      .select('role')
      .eq('tree_id', treeAId)
      .eq('user_id', ownerAId)
    expect(rows).toHaveLength(1)
    expect(rows![0].role).toBe('owner')
  })

  it('editor calling revokeMember — editor cannot revoke another editor (RLS DELETE policy gates to owner)', async () => {
    await addMember(admin, treeAId, editorId, 'editor')
    await addMember(admin, treeAId, secondEditorId, 'editor')

    // Sign in as editor (not owner).
    clientHolder.current = await signedInClient(EDITOR_EMAIL)

    const res = await revokeMember(treeAId, secondEditorId)
    // The action should return not_found_or_not_editor because RLS prevents
    // the delete (0 rows deleted).
    expect(res.ok).toBe(false)

    // secondEditor's membership must still exist.
    const { data: rows } = await admin
      .from('tree_members')
      .select('user_id')
      .eq('tree_id', treeAId)
      .eq('user_id', secondEditorId)
    expect(rows).toHaveLength(1)
  })

  it('cross-tree — ownerA cannot revoke an editor of tree B where A is not owner', async () => {
    // Add editor to tree B (owned by ownerB, not ownerA).
    await addMember(admin, treeBId, editorId, 'editor')

    // ownerA is signed in (clientHolder = ownerA).
    const res = await revokeMember(treeBId, editorId)
    expect(res.ok).toBe(false)

    // Editor membership in tree B must still exist.
    const { data: rows } = await admin
      .from('tree_members')
      .select('user_id')
      .eq('tree_id', treeBId)
      .eq('user_id', editorId)
    expect(rows).toHaveLength(1)

    // Cleanup tree B membership.
    await admin
      .from('tree_members')
      .delete()
      .eq('tree_id', treeBId)
      .eq('user_id', editorId)
  })
})
