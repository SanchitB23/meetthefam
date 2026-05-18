/**
 * Integration tests for the `removePersonPhoto` Server Action — Phase 5
 * sub-task 2's Storage delete path.
 *
 * Pattern mirrors `uploadPersonPhoto.test.ts` (same module-stubs for
 * `next/cache` + `@/lib/supabase/server`). The action nulls `people.photo_url`
 * FIRST, then attempts the Storage `.remove()`. A Storage error is logged
 * but does NOT fail the action — the row's URL is already gone, so a
 * leftover object is unreferenced.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  seedPerson,
} from '../_helpers'

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

import { removePersonPhoto } from '@/app/(app)/tree/[id]/actions'

const OWNER_EMAIL = 'action-remove-owner@test.local'
const OTHER_OWNER_EMAIL = 'action-remove-other@test.local'

const admin = adminClient()
let ownerId: string
let otherOwnerId: string
let treeId: string
let otherTreeId: string

function makeJpegBlob(): Blob {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ])
  return new Blob([bytes], { type: 'image/jpeg' })
}

function avatarPath(tId: string, pId: string): string {
  return `trees/${tId}/people/${pId}/avatar.jpg`
}

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  otherOwnerId = await createTestUser(admin, OTHER_OWNER_EMAIL)
  const setupOwner = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(setupOwner, ownerId, 'removePersonPhoto Tree')
  const setupOther = await signedInClient(OTHER_OWNER_EMAIL)
  otherTreeId = await createTree(
    setupOther,
    otherOwnerId,
    'removePersonPhoto Other Tree',
  )
})

afterAll(async () => {
  // Clear any leftover files via service role.
  const { data: aFolders } = await admin.storage
    .from('photos')
    .list(`trees/${treeId}/people`, { limit: 1000 })
  if (aFolders) {
    const paths = aFolders
      .filter((e) => e.id === null)
      .map((e) => avatarPath(treeId, e.name))
    if (paths.length > 0) await admin.storage.from('photos').remove(paths)
  }
  const { data: bFolders } = await admin.storage
    .from('photos')
    .list(`trees/${otherTreeId}/people`, { limit: 1000 })
  if (bFolders) {
    const paths = bFolders
      .filter((e) => e.id === null)
      .map((e) => avatarPath(otherTreeId, e.name))
    if (paths.length > 0) await admin.storage.from('photos').remove(paths)
  }

  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  if (otherOwnerId) await admin.auth.admin.deleteUser(otherOwnerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
  await deleteUserByEmail(admin, OTHER_OWNER_EMAIL)
})

beforeEach(async () => {
  await admin.from('people').delete().eq('tree_id', treeId)
  await admin.from('people').delete().eq('tree_id', otherTreeId)
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

describe('removePersonPhoto', () => {
  it('happy path: nulls photo_url and removes the file', async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Remove Subject',
    })

    // Seed a Storage object + a non-null photo_url via service role so we
    // exercise removePersonPhoto in isolation (no dependency on
    // uploadPersonPhoto being called first).
    const path = avatarPath(treeId, personId)
    await admin.storage
      .from('photos')
      .upload(path, makeJpegBlob(), { contentType: 'image/jpeg', upsert: true })
    const { data: pub } = admin.storage.from('photos').getPublicUrl(path)
    await admin
      .from('people')
      .update({ photo_url: pub.publicUrl })
      .eq('id', personId)

    const res = await removePersonPhoto(treeId, personId)
    expect(res.ok).toBe(true)

    const { data: row } = await admin
      .from('people')
      .select('photo_url')
      .eq('id', personId)
      .single<{ photo_url: string | null }>()
    expect(row?.photo_url).toBeNull()

    const { data: listed } = await admin.storage
      .from('photos')
      .list(`trees/${treeId}/people/${personId}`)
    const found = listed?.some((entry) => entry.name === 'avatar.jpg') ?? false
    expect(found).toBe(false)
  })

  it("idempotent: succeeds when photo_url is already null and no file exists", async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'No-Photo Subject',
    })
    // No upload, no photo_url — fresh row.

    const res = await removePersonPhoto(treeId, personId)
    // Storage `.remove()` against a missing object is a no-op (not an error)
    // on the supabase-js path used by the action, and the people UPDATE is
    // a no-op when the column is already null. Either way: action returns ok.
    expect(res.ok).toBe(true)
  })

  it("cross-tree: owner of T_A cannot null T_B's photo_url (RLS blocks the row update)", async () => {
    const otherPersonId = await seedPerson(admin, otherTreeId, {
      full_name: 'Other Tree Subject',
    })
    const path = avatarPath(otherTreeId, otherPersonId)
    await admin.storage
      .from('photos')
      .upload(path, makeJpegBlob(), { contentType: 'image/jpeg', upsert: true })
    const { data: pub } = admin.storage.from('photos').getPublicUrl(path)
    await admin
      .from('people')
      .update({ photo_url: pub.publicUrl })
      .eq('id', otherPersonId)

    // clientHolder is owner of T_A — try to remove T_B's photo.
    const res = await removePersonPhoto(otherTreeId, otherPersonId)

    // The `people.update` RLS USING-clause filters non-editor rows, which
    // makes the update a 0-row no-op rather than an outright error. The
    // important property: T_B's photo_url is unchanged AND the file is
    // still there.
    expect(res.ok).toBe(true)

    const { data: row } = await admin
      .from('people')
      .select('photo_url')
      .eq('id', otherPersonId)
      .single<{ photo_url: string | null }>()
    expect(row?.photo_url).toBe(pub.publicUrl)

    const { data: listed } = await admin.storage
      .from('photos')
      .list(`trees/${otherTreeId}/people/${otherPersonId}`)
    expect(listed?.some((entry) => entry.name === 'avatar.jpg')).toBe(true)
  })
})
