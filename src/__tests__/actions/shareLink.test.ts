/**
 * Integration tests for the Phase 7 share-link Server Actions.
 *
 * Pattern mirrors `inviteEditor.test.ts`:
 *   - vi.mock('next/cache'), vi.mock('next/headers'), vi.mock('@/lib/supabase/server')
 *   - clientHolder.current swapped per-test for the desired role's client
 *   - ground-truth reads via the service-role admin client
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

import {
  enableShareLink,
  regenerateShareToken,
  disableShareLink,
} from '@/app/(app)/tree/[id]/share/actions'

const OWNER_EMAIL = 'action-share-owner@test.local'
const EDITOR_EMAIL = 'action-share-editor@test.local'

const admin = adminClient()
let ownerId: string
let editorId: string
let treeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  editorId = await createTestUser(admin, EDITOR_EMAIL)

  const ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'shareLink Action Tree')

  // Pre-seed editor membership for the non-owner test.
  await addMember(admin, treeId, editorId, 'editor')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  if (editorId) await admin.auth.admin.deleteUser(editorId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
  await deleteUserByEmail(admin, EDITOR_EMAIL)
})

beforeEach(async () => {
  // Reset share_token each test.
  await admin
    .from('trees')
    .update({ share_token: null })
    .eq('id', treeId)
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

describe('enableShareLink', () => {
  it('happy path — owner enables → token written, shareUrl returned', async () => {
    const res = await enableShareLink(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.shareToken).toBeTruthy()
    expect(res.shareToken!.length).toBeGreaterThanOrEqual(40) // base64url(32) = 43
    expect(res.shareUrl).toBe(`http://localhost:3000/share/${res.shareToken}`)

    // Ground-truth: token written to DB.
    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(res.shareToken)
  })

  it('already-enabled — second call rotates the token in place', async () => {
    const first = await enableShareLink(treeId)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await enableShareLink(treeId)
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(second.shareToken).not.toBe(first.shareToken)
    // DB row matches the second token (the first is dead).
    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(second.shareToken)
  })

  it('non-owner editor — returns forbidden, share_token stays null', async () => {
    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await enableShareLink(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(data?.share_token).toBeNull()
  })
})

describe('regenerateShareToken', () => {
  it('happy path — rotates token; old value is replaced', async () => {
    const first = await enableShareLink(treeId)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const rotated = await regenerateShareToken(treeId)
    expect(rotated.ok).toBe(true)
    if (!rotated.ok) return
    expect(rotated.shareToken).not.toBe(first.shareToken)

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(rotated.shareToken)
  })

  it('non-owner editor — returns forbidden', async () => {
    await enableShareLink(treeId)
    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await regenerateShareToken(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')
  })

  it('regenerate from disabled state — works, mints fresh token', async () => {
    // share_token is null after beforeEach.
    const res = await regenerateShareToken(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.shareToken).toBeTruthy()
  })
})

describe('disableShareLink', () => {
  it('happy path — owner disables → share_token nulled', async () => {
    await enableShareLink(treeId)
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.shareToken).toBeNull()
    expect(res.shareUrl).toBeNull()

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(data?.share_token).toBeNull()
  })

  it('idempotent — disabling an already-disabled tree returns ok', async () => {
    // beforeEach already set it to null. Disable again — still ok.
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(true)
  })

  it('non-owner editor — returns forbidden, share_token unchanged', async () => {
    await enableShareLink(treeId)
    const { data: before } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()

    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')

    const { data: after } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(after?.share_token).toBe(before?.share_token)
  })
})
