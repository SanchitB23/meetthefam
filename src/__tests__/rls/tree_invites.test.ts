/**
 * RLS smoke tests for the `tree_invites` table.
 *
 * Requires: local Supabase running (`pnpm exec supabase start`).
 * Run: `pnpm test`.
 *
 * Covers the four RLS policies from the Phase 6 migration:
 *   - tree_invites_select_owner  (owner only)
 *   - tree_invites_insert_owner  (owner only)
 *   - tree_invites_update_owner  (owner only)
 *   - tree_invites_delete_owner  (owner only)
 *
 * Roles under test:
 *   ownerA    = owner of tree A (should have full CRUD)
 *   ownerB    = owner of a different tree (cross-tree non-owner)
 *   editorA   = editor member of tree A (member, but not owner)
 *   stranger  = authenticated user with no membership anywhere
 *   anon      = unauthenticated client
 *
 * 20 tests total (4 operations × 5 roles).
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

const OWNER_A_EMAIL = 'rls-invites-owner-a@test.local'
const OWNER_B_EMAIL = 'rls-invites-owner-b@test.local'
const EDITOR_A_EMAIL = 'rls-invites-editor-a@test.local'
const STRANGER_EMAIL = 'rls-invites-stranger@test.local'

const admin = adminClient()

let ownerAId: string
let ownerBId: string
let editorAId: string
let strangerUserId: string
let treeAId: string
let treeBId: string
let seededInviteId: string

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Seeds an open invite into treeA via the service role, bypassing RLS. */
async function seedInvite(
  treeId: string,
  email: string,
  invitedBy: string,
): Promise<string> {
  const { data, error } = await admin
    .from('tree_invites')
    .insert({
      tree_id: treeId,
      email: email.toLowerCase(),
      token: `test-token-${Math.random().toString(36).slice(2)}`,
      invited_by: invitedBy,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    throw new Error(`seedInvite failed: ${error?.message}`)
  }
  return data.id
}

beforeAll(async () => {
  ownerAId = await createTestUser(admin, OWNER_A_EMAIL)
  ownerBId = await createTestUser(admin, OWNER_B_EMAIL)
  editorAId = await createTestUser(admin, EDITOR_A_EMAIL)
  strangerUserId = await createTestUser(admin, STRANGER_EMAIL)

  const clientA = await signedInClient(OWNER_A_EMAIL)
  treeAId = await createTree(clientA, ownerAId, 'Invites RLS Tree A')

  const clientB = await signedInClient(OWNER_B_EMAIL)
  treeBId = await createTree(clientB, ownerBId, 'Invites RLS Tree B')

  // Make editorA a member of treeA (editor role).
  await addMember(admin, treeAId, editorAId, 'editor')

  // Seed a target invite row so SELECT/UPDATE/DELETE tests have something to
  // operate on.  Using a placeholder email that is not one of the test users.
  seededInviteId = await seedInvite(treeAId, 'target@test.local', ownerAId)
})

afterAll(async () => {
  // Delete invites BEFORE deleting auth.users to avoid FK cascade races.
  await admin.from('tree_invites').delete().eq('tree_id', treeAId)
  await admin.from('tree_invites').delete().eq('tree_id', treeBId)

  if (ownerAId) await admin.auth.admin.deleteUser(ownerAId)
  if (ownerBId) await admin.auth.admin.deleteUser(ownerBId)
  if (editorAId) await admin.auth.admin.deleteUser(editorAId)
  if (strangerUserId) await admin.auth.admin.deleteUser(strangerUserId)

  // Defensive cleanup in case deleteUser already cascaded.
  await deleteUserByEmail(admin, OWNER_A_EMAIL)
  await deleteUserByEmail(admin, OWNER_B_EMAIL)
  await deleteUserByEmail(admin, EDITOR_A_EMAIL)
  await deleteUserByEmail(admin, STRANGER_EMAIL)
})

// ===========================================================================
// SELECT
// ===========================================================================

describe('tree_invites RLS — SELECT', () => {
  it('ownerA can SELECT their own tree invites', async () => {
    const c = await signedInClient(OWNER_A_EMAIL)
    const { data, error } = await c
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeAId)
    expect(error).toBeNull()
    expect(data).not.toHaveLength(0)
    expect(data!.map((r) => r.id)).toContain(seededInviteId)
  })

  it('ownerB (cross-tree) cannot SELECT tree A invites — returns 0 rows', async () => {
    const c = await signedInClient(OWNER_B_EMAIL)
    const { data, error } = await c
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('editorA cannot SELECT tree A invites even though they are a member', async () => {
    const c = await signedInClient(EDITOR_A_EMAIL)
    const { data, error } = await c
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('stranger cannot SELECT any tree invites — returns 0 rows', async () => {
    const c = await signedInClient(STRANGER_EMAIL)
    const { data, error } = await c
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anonymous client cannot SELECT tree invites — returns 0 rows', async () => {
    const c = anonClient()
    const { data, error } = await c
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})

// ===========================================================================
// INSERT
// ===========================================================================

describe('tree_invites RLS — INSERT', () => {
  /** Cleans up any test-inserted rows so the partial unique index stays clean. */
  async function cleanupInviteByEmail(email: string) {
    await admin
      .from('tree_invites')
      .delete()
      .eq('tree_id', treeAId)
      .eq('email', email.toLowerCase())
  }

  it('ownerA can INSERT an invite into their own tree', async () => {
    const c = await signedInClient(OWNER_A_EMAIL)
    const { data, error } = await c
      .from('tree_invites')
      .insert({
        tree_id: treeAId,
        email: 'owner-a-insert@test.local',
        token: `tok-owner-a-${Math.random().toString(36).slice(2)}`,
        invited_by: ownerAId,
      })
      .select('id')
      .single<{ id: string }>()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    await cleanupInviteByEmail('owner-a-insert@test.local')
  })

  it('ownerB (cross-tree) cannot INSERT into tree A — RLS rejects', async () => {
    const c = await signedInClient(OWNER_B_EMAIL)
    const { error } = await c.from('tree_invites').insert({
      tree_id: treeAId,
      email: 'owner-b-insert-attempt@test.local',
      token: `tok-owner-b-${Math.random().toString(36).slice(2)}`,
      invited_by: ownerBId,
    })
    expect(error).not.toBeNull()
  })

  it('editorA cannot INSERT into tree A — only owners may invite', async () => {
    const c = await signedInClient(EDITOR_A_EMAIL)
    const { error } = await c.from('tree_invites').insert({
      tree_id: treeAId,
      email: 'editor-a-insert-attempt@test.local',
      token: `tok-editor-a-${Math.random().toString(36).slice(2)}`,
      invited_by: editorAId,
    })
    expect(error).not.toBeNull()
  })

  it('stranger cannot INSERT into tree A — RLS rejects', async () => {
    const c = await signedInClient(STRANGER_EMAIL)
    const { error } = await c.from('tree_invites').insert({
      tree_id: treeAId,
      email: 'stranger-insert-attempt@test.local',
      token: `tok-stranger-${Math.random().toString(36).slice(2)}`,
      invited_by: strangerUserId,
    })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot INSERT into tree A — RLS rejects', async () => {
    const c = anonClient()
    const { error } = await c.from('tree_invites').insert({
      tree_id: treeAId,
      email: 'anon-insert-attempt@test.local',
      token: `tok-anon-${Math.random().toString(36).slice(2)}`,
      invited_by: ownerAId, // field value irrelevant — RLS fires first
    })
    expect(error).not.toBeNull()
  })
})

// ===========================================================================
// UPDATE
// ===========================================================================

describe('tree_invites RLS — UPDATE', () => {
  it('ownerA can UPDATE an invite in their own tree', async () => {
    const c = await signedInClient(OWNER_A_EMAIL)
    // Attempt to set revoked_at (the only owner-meaningful update field).
    const { error } = await c
      .from('tree_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', seededInviteId)

    expect(error).toBeNull()

    // Restore so other UPDATE tests still have a non-revoked target row.
    await admin
      .from('tree_invites')
      .update({ revoked_at: null })
      .eq('id', seededInviteId)
  })

  it('ownerB (cross-tree) UPDATE on tree A invite affects 0 rows', async () => {
    const c = await signedInClient(OWNER_B_EMAIL)
    const before = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    await c
      .from('tree_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', seededInviteId)

    const after = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    expect(after.data?.revoked_at).toBe(before.data?.revoked_at)
  })

  it('editorA UPDATE on tree A invite affects 0 rows', async () => {
    const c = await signedInClient(EDITOR_A_EMAIL)
    const before = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    await c
      .from('tree_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', seededInviteId)

    const after = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    expect(after.data?.revoked_at).toBe(before.data?.revoked_at)
  })

  it('stranger UPDATE on tree A invite affects 0 rows', async () => {
    const c = await signedInClient(STRANGER_EMAIL)
    await c
      .from('tree_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', seededInviteId)

    const after = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    expect(after.data?.revoked_at).toBeNull()
  })

  it('anonymous client UPDATE on tree A invite affects 0 rows', async () => {
    const c = anonClient()
    await c
      .from('tree_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', seededInviteId)

    const after = await admin
      .from('tree_invites')
      .select('revoked_at')
      .eq('id', seededInviteId)
      .single<{ revoked_at: string | null }>()

    expect(after.data?.revoked_at).toBeNull()
  })
})

// ===========================================================================
// DELETE
// ===========================================================================

describe('tree_invites RLS — DELETE', () => {
  /** Creates a throwaway invite for a delete test, returns its id. */
  async function mkThrowawayInvite(label: string): Promise<string> {
    return seedInvite(
      treeAId,
      `throwaway-${label}@test.local`,
      ownerAId,
    )
  }

  it('ownerA can DELETE an invite from their own tree', async () => {
    const inviteId = await mkThrowawayInvite('owner-a-del')
    const c = await signedInClient(OWNER_A_EMAIL)
    const { error } = await c
      .from('tree_invites')
      .delete()
      .eq('id', inviteId)
    expect(error).toBeNull()

    // Verify the row is gone.
    const { data } = await admin
      .from('tree_invites')
      .select('id')
      .eq('id', inviteId)
    expect(data).toHaveLength(0)
  })

  it('ownerB (cross-tree) DELETE on tree A invite — row survives', async () => {
    const inviteId = await mkThrowawayInvite('owner-b-del')
    const c = await signedInClient(OWNER_B_EMAIL)
    await c.from('tree_invites').delete().eq('id', inviteId)

    const { data } = await admin
      .from('tree_invites')
      .select('id')
      .eq('id', inviteId)
    expect(data).toHaveLength(1)

    // Cleanup via admin.
    await admin.from('tree_invites').delete().eq('id', inviteId)
  })

  it('editorA DELETE on tree A invite — row survives', async () => {
    const inviteId = await mkThrowawayInvite('editor-a-del')
    const c = await signedInClient(EDITOR_A_EMAIL)
    await c.from('tree_invites').delete().eq('id', inviteId)

    const { data } = await admin
      .from('tree_invites')
      .select('id')
      .eq('id', inviteId)
    expect(data).toHaveLength(1)

    await admin.from('tree_invites').delete().eq('id', inviteId)
  })

  it('stranger DELETE on tree A invite — row survives', async () => {
    const inviteId = await mkThrowawayInvite('stranger-del')
    const c = await signedInClient(STRANGER_EMAIL)
    await c.from('tree_invites').delete().eq('id', inviteId)

    const { data } = await admin
      .from('tree_invites')
      .select('id')
      .eq('id', inviteId)
    expect(data).toHaveLength(1)

    await admin.from('tree_invites').delete().eq('id', inviteId)
  })

  it('anonymous client DELETE on tree A invite — row survives', async () => {
    const inviteId = await mkThrowawayInvite('anon-del')
    const c = anonClient()
    await c.from('tree_invites').delete().eq('id', inviteId)

    const { data } = await admin
      .from('tree_invites')
      .select('id')
      .eq('id', inviteId)
    expect(data).toHaveLength(1)

    await admin.from('tree_invites').delete().eq('id', inviteId)
  })
})
