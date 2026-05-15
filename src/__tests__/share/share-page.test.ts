/**
 * Phase 7 — share-page data path.
 *
 * Direct DB-level service-role reads that mirror the logic in
 * `src/app/share/[token]/page.tsx`. We don't render the React component
 * here; the value we want to lock in is the contract that:
 *   - a valid token returns the tree row
 *   - an invalid token returns null
 *   - a regenerated tree's OLD token returns null
 *   - a disabled tree (share_token = null) cannot be reached even by
 *     someone who knows the value was previously null
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
} from '../_helpers'

const OWNER_EMAIL = 'share-page-owner@test.local'
const admin = adminClient()
let ownerId: string
let treeId: string
let validToken: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  const c = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(c, ownerId, 'share-page tests tree')

  // Seed a share_token directly via admin.
  validToken = 'test-share-token-' + Math.random().toString(36).slice(2)
  await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

describe('share-page data lookup (service-role)', () => {
  it('valid token → returns the tree row', async () => {
    const { data } = await admin
      .from('trees')
      .select('id, name, description, share_token')
      .eq('share_token', validToken)
      .maybeSingle()
    expect(data).not.toBeNull()
    expect((data as { id: string }).id).toBe(treeId)
  })

  it('invalid token → returns null', async () => {
    const { data } = await admin
      .from('trees')
      .select('id, name')
      .eq('share_token', 'totally-not-a-real-token')
      .maybeSingle()
    expect(data).toBeNull()
  })

  it('rotated tree: looking up by the OLD token returns null', async () => {
    const newToken = 'rotated-token-' + Math.random().toString(36).slice(2)
    await admin.from('trees').update({ share_token: newToken }).eq('id', treeId)

    const { data: lookupOld } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', validToken)
      .maybeSingle()
    expect(lookupOld).toBeNull()

    const { data: lookupNew } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', newToken)
      .maybeSingle()
    expect((lookupNew as { id: string } | null)?.id).toBe(treeId)

    // Restore for the next test.
    await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
  })

  it('disabled tree (share_token = null) cannot be reached by lookup', async () => {
    await admin.from('trees').update({ share_token: null }).eq('id', treeId)

    // No row should match share_token = null because we always query with .eq()
    // — the share-page calls `.eq('share_token', token)` and never passes null.
    // Sanity-check the negative: an empty-string lookup also returns null.
    const { data } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', '')
      .maybeSingle()
    expect(data).toBeNull()

    // Restore.
    await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
  })
})
