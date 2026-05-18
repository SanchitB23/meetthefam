/**
 * Integration tests for the `acceptInvite` Server Action.
 *
 * The action wraps the `accept_invite` SECURITY DEFINER RPC.  All five RPC
 * error tags are raised as `P0001` with the tag as the message text; we
 * pattern-match on message (NOT code) per the constraints doc.
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
} from '../_helpers'

// ---- Module stubs ----------------------------------------------------------

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op */
  },
  refresh: () => {
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

import { acceptInvite } from '@/app/(app)/tree/[id]/members/actions'

// ---- Fixtures --------------------------------------------------------------

const OWNER_EMAIL = 'action-accept-owner@test.local'
const INVITEE_EMAIL = 'action-accept-invitee@test.local'
const OTHER_USER_EMAIL = 'action-accept-other@test.local'

const admin = adminClient()
let ownerId: string
let inviteeId: string
let otherUserId: string
let treeId: string

/** Seeds an open invite (via admin, bypasses RLS). Returns the token. */
async function seedInvite(
  targetTreeId: string,
  email: string,
  overrides: {
    expires_at?: string
    revoked_at?: string
    accepted_at?: string
    accepted_by?: string
  } = {},
): Promise<{ token: string; inviteId: string }> {
  const token = `test-${Math.random().toString(36).slice(2)}-${Date.now()}`
  const { data, error } = await admin
    .from('tree_invites')
    .insert({
      tree_id: targetTreeId,
      email: email.toLowerCase(),
      token,
      invited_by: ownerId,
      ...overrides,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) throw new Error(`seedInvite failed: ${error?.message}`)
  return { token, inviteId: data.id }
}

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  inviteeId = await createTestUser(admin, INVITEE_EMAIL)
  otherUserId = await createTestUser(admin, OTHER_USER_EMAIL)

  const ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'acceptInvite Action Tree')
})

afterAll(async () => {
  // Delete invites before members before users (FK order).
  await admin.from('tree_invites').delete().eq('tree_id', treeId)
  await admin.from('tree_members').delete().eq('tree_id', treeId).neq('role', 'owner')

  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  if (inviteeId) await admin.auth.admin.deleteUser(inviteeId)
  if (otherUserId) await admin.auth.admin.deleteUser(otherUserId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
  await deleteUserByEmail(admin, INVITEE_EMAIL)
  await deleteUserByEmail(admin, OTHER_USER_EMAIL)
})

beforeEach(async () => {
  // Wipe open invites and non-owner members so each test starts clean.
  await admin.from('tree_invites').delete().eq('tree_id', treeId)
  await admin
    .from('tree_members')
    .delete()
    .eq('tree_id', treeId)
    .neq('role', 'owner')
  // Default to invitee being signed in; each test can override clientHolder.
  clientHolder.current = await signedInClient(INVITEE_EMAIL)
})

// ---- Tests -----------------------------------------------------------------

describe('acceptInvite', () => {
  it('happy path — matching email + valid token → membership row created, invite marked accepted', async () => {
    const { token } = await seedInvite(treeId, INVITEE_EMAIL)

    const res = await acceptInvite(token)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.treeId).toBe(treeId)

    // Verify tree_members row was created.
    const { data: memberRows } = await admin
      .from('tree_members')
      .select('role')
      .eq('tree_id', treeId)
      .eq('user_id', inviteeId)
    expect(memberRows).toHaveLength(1)
    expect(memberRows![0].role).toBe('editor')

    // Verify invite was marked accepted.
    const { data: invite } = await admin
      .from('tree_invites')
      .select('accepted_at, accepted_by')
      .eq('tree_id', treeId)
      .eq('email', INVITEE_EMAIL.toLowerCase())
      .single<{ accepted_at: string | null; accepted_by: string | null }>()
    expect(invite?.accepted_at).not.toBeNull()
    expect(invite?.accepted_by).toBe(inviteeId)
  })

  it('email_mismatch — invite for A, signed in as B → error email_mismatch, no membership', async () => {
    const { token } = await seedInvite(treeId, INVITEE_EMAIL)

    // Sign in as a different user (otherUser).
    clientHolder.current = await signedInClient(OTHER_USER_EMAIL)

    const res = await acceptInvite(token)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('email_mismatch')

    // No membership row should have been created.
    const { data: rows } = await admin
      .from('tree_members')
      .select('user_id')
      .eq('tree_id', treeId)
      .eq('user_id', otherUserId)
    expect(rows).toHaveLength(0)
  })

  it('expired — expires_at in the past → error expired', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { token } = await seedInvite(treeId, INVITEE_EMAIL, {
      expires_at: yesterday,
    })

    const res = await acceptInvite(token)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('expired')
  })

  it('revoked — revoked_at set → error revoked', async () => {
    const { token } = await seedInvite(treeId, INVITEE_EMAIL, {
      revoked_at: new Date().toISOString(),
    })

    const res = await acceptInvite(token)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('revoked')
  })

  it('double-accept — second call returns already_accepted, only one membership row exists', async () => {
    const { token } = await seedInvite(treeId, INVITEE_EMAIL)

    // First accept should succeed.
    const first = await acceptInvite(token)
    expect(first.ok).toBe(true)

    // Second accept with same token should fail.
    const second = await acceptInvite(token)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error).toBe('already_accepted')

    // Verify only one membership row for this user+tree.
    const { data: rows } = await admin
      .from('tree_members')
      .select('user_id')
      .eq('tree_id', treeId)
      .eq('user_id', inviteeId)
    expect(rows).toHaveLength(1)
  })

  it('not_found — token does not exist → error not_found', async () => {
    const res = await acceptInvite('this-token-does-not-exist-at-all')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_found')
  })

  it('priority order — revoked + expired + email_mismatch → returns revoked (highest priority)', async () => {
    // Create an invite with all three error conditions set simultaneously.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { token } = await seedInvite(
      treeId,
      OTHER_USER_EMAIL, // email mismatch (invitee is signed in, not otherUser)
      {
        expires_at: yesterday,
        revoked_at: new Date().toISOString(),
      },
    )

    // invitee is signed in from beforeEach — email_mismatch would also fire,
    // but revoked should win.
    const res = await acceptInvite(token)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('revoked')
  })

  it('idempotent on pre-existing membership — accepts successfully even when user is already a member', async () => {
    // Pre-insert the invitee as an editor.
    await addMember(admin, treeId, inviteeId, 'editor')

    // Now mint and accept an invite for that same user+tree.
    const { token } = await seedInvite(treeId, INVITEE_EMAIL)

    const res = await acceptInvite(token)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.treeId).toBe(treeId)

    // Invite should be marked accepted.
    const { data: invite } = await admin
      .from('tree_invites')
      .select('accepted_at')
      .eq('tree_id', treeId)
      .eq('email', INVITEE_EMAIL.toLowerCase())
      .single<{ accepted_at: string | null }>()
    expect(invite?.accepted_at).not.toBeNull()
  })

  it('not signed in — returns not_signed_in before calling the RPC', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { SUPABASE_URL, ANON_KEY } = await import('../_helpers')
    clientHolder.current = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const res = await acceptInvite('any-token')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_signed_in')
  })
})
