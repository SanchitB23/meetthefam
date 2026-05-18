/**
 * Integration tests for the `inviteEditor` Server Action.
 *
 * Pattern mirrors `createPerson-linkSpec.test.ts`:
 *   - `vi.mock('next/cache')` stubs `revalidatePath` to a no-op.
 *   - `vi.mock('next/headers')` stubs `headers()` to return an object whose
 *     `get('origin')` returns 'http://localhost:3000' so `getBaseUrl()` inside
 *     the action resolves without a live request context.
 *   - `vi.mock('@/lib/supabase/server')` returns a hand-built, pre-authed
 *     supabase-js client per test via `clientHolder`.
 *   - `vi.mock('@/lib/email/inviteEmail')` stubs out the flag-gated email
 *     stub so it never fires (or throws) during tests.
 *   - Real DB calls hit the local Supabase stack; ground-truth is read via
 *     the service-role admin client.
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
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'origin' ? 'http://localhost:3000' : null),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!clientHolder.current) {
      throw new Error('Test setup bug: clientHolder.current not initialised')
    }
    return clientHolder.current
  },
}))

vi.mock('@/lib/email/inviteEmail', () => ({
  sendInviteEmail: async () => {
    /* no-op */
  },
}))

import { inviteEditor } from '@/app/(app)/tree/[id]/members/actions'

// ---- Fixtures --------------------------------------------------------------

const OWNER_EMAIL = 'action-invite-owner@test.local'
const EDITOR_EMAIL = 'action-invite-editor@test.local'

const admin = adminClient()
let ownerId: string
let editorId: string
let treeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  editorId = await createTestUser(admin, EDITOR_EMAIL)

  const ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'inviteEditor Action Tree')
})

afterAll(async () => {
  // Delete invites before users to respect FK ordering.
  await admin.from('tree_invites').delete().eq('tree_id', treeId)
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  if (editorId) await admin.auth.admin.deleteUser(editorId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
  await deleteUserByEmail(admin, EDITOR_EMAIL)
})

beforeEach(async () => {
  // Clean all open invites so each test starts with a blank slate.
  await admin.from('tree_invites').delete().eq('tree_id', treeId)
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

// ---- Tests -----------------------------------------------------------------

describe('inviteEditor', () => {
  it('happy path — owner invites a new email → row created with correct fields', async () => {
    const res = await inviteEditor(treeId, 'new-invite@example.com')
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.inviteId).toBeTruthy()
    expect(res.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\//)

    // Ground-truth check via service role.
    const { data } = await admin
      .from('tree_invites')
      .select('email, token, expires_at, accepted_at, revoked_at')
      .eq('id', res.inviteId)
      .single<{
        email: string
        token: string
        expires_at: string
        accepted_at: string | null
        revoked_at: string | null
      }>()

    expect(data).not.toBeNull()
    expect(data!.email).toBe('new-invite@example.com')
    expect(data!.token).toBeTruthy()
    expect(data!.accepted_at).toBeNull()
    expect(data!.revoked_at).toBeNull()

    // expires_at should be approximately 7 days from now (allow 5-min drift).
    const expiresAt = new Date(data!.expires_at).getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const nowMs = Date.now()
    expect(expiresAt).toBeGreaterThan(nowMs + sevenDaysMs - 5 * 60 * 1000)
    expect(expiresAt).toBeLessThan(nowMs + sevenDaysMs + 5 * 60 * 1000)

    // inviteUrl must include the same token that was stored.
    expect(res.inviteUrl).toContain(data!.token)
  })

  it('duplicate-open — second invite for same (tree, email) returns already_invited with the FIRST invite URL', async () => {
    const first = await inviteEditor(treeId, 'dup@example.com')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await inviteEditor(treeId, 'dup@example.com')
    expect(second.ok).toBe(false)
    if (second.ok) return

    expect(second.error).toBe('already_invited')
    // The returned URL must be the FIRST invite's URL, not a new one.
    expect(second.inviteUrl).toBe(first.inviteUrl)

    // Only one open invite row should exist.
    const { data: rows } = await admin
      .from('tree_invites')
      .select('id')
      .eq('tree_id', treeId)
      .eq('email', 'dup@example.com')
      .is('accepted_at', null)
      .is('revoked_at', null)
    expect(rows).toHaveLength(1)
  })

  it('email case-insensitivity — invite Mixed@CASE.com then mixed@case.com → second is already_invited', async () => {
    const first = await inviteEditor(treeId, 'Mixed@CASE.com')
    expect(first.ok).toBe(true)

    const second = await inviteEditor(treeId, 'mixed@case.com')
    expect(second.ok).toBe(false)
    if (second.ok) return

    expect(second.error).toBe('already_invited')
  })

  it('invalid email shape — returns invalid_email, no row inserted', async () => {
    const before = await admin
      .from('tree_invites')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    const beforeCount = before.count ?? 0

    const res = await inviteEditor(treeId, 'not-an-email')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('invalid_email')

    const after = await admin
      .from('tree_invites')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    expect(after.count ?? 0).toBe(beforeCount)
  })

  it('non-owner caller — editor calling inviteEditor is rejected by RLS', async () => {
    // Make editorId a member of this tree, then sign in as them.
    await addMember(admin, treeId, editorId, 'editor')
    clientHolder.current = await signedInClient(EDITOR_EMAIL)

    const before = await admin
      .from('tree_invites')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    const beforeCount = before.count ?? 0

    const res = await inviteEditor(treeId, 'editor-invite-attempt@example.com')
    expect(res.ok).toBe(false)

    // Verify no row was written.
    const after = await admin
      .from('tree_invites')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    expect(after.count ?? 0).toBe(beforeCount)

    // Cleanup: remove the editor membership added above.
    await admin
      .from('tree_members')
      .delete()
      .eq('tree_id', treeId)
      .eq('user_id', editorId)
  })

  it('not signed in — action returns not_signed_in before touching the DB', async () => {
    // Override clientHolder with a client that has NO session — simulate the
    // "unauthenticated call" by returning an anon client (no JWT user).
    const { createClient } = await import('@supabase/supabase-js')
    const { SUPABASE_URL, ANON_KEY } = await import('../_helpers')
    clientHolder.current = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const res = await inviteEditor(treeId, 'unauthenticated@example.com')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_signed_in')
  })
})
