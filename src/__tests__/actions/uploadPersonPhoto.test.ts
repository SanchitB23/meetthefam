/**
 * Integration tests for the `uploadPersonPhoto` Server Action — Phase 5
 * sub-task 2's Storage write path.
 *
 * Pattern mirrors `createPerson-linkSpec.test.ts`:
 *   - `vi.mock('next/cache')` stubs both `revalidatePath` and `refresh` to
 *     no-ops (sub-task 2 imports both; the action uses `refresh()` after a
 *     successful upload).
 *   - `vi.mock('@/lib/supabase/server')` returns a hand-built, pre-authed
 *     supabase-js client per test via `clientHolder`.
 *   - We do NOT mock the storage / DB calls themselves. Every upload hits
 *     the real local Storage on `127.0.0.1:54321`, and ground-truth is read
 *     via the service-role admin client.
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

// ---- Module stubs ------------------------------------------------------

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op in tests */
  },
  refresh: () => {
    /* no-op in tests */
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

import { uploadPersonPhoto } from '@/app/tree/[id]/actions'

// ---- Fixtures ----------------------------------------------------------

const OWNER_EMAIL = 'action-upload-owner@test.local'
const OTHER_OWNER_EMAIL = 'action-upload-other@test.local'

const admin = adminClient()
let ownerId: string
let otherOwnerId: string
let treeId: string
let otherTreeId: string

function makeJpegBlob(sizeBytes?: number): Blob {
  // Real-ish JPEG header so any future MIME sniffing is happy.
  const header = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ])
  const tail = new Uint8Array([0xff, 0xd9])
  if (sizeBytes == null) {
    return new Blob([header, tail], { type: 'image/jpeg' })
  }
  // Pad with zeros to hit the requested size; clamp so we don't underflow.
  const padLen = Math.max(0, sizeBytes - header.length - tail.length)
  const padding = new Uint8Array(padLen)
  return new Blob([header, padding, tail], { type: 'image/jpeg' })
}

function formDataWith(blob: Blob): FormData {
  const fd = new FormData()
  fd.set('file', blob, 'avatar.jpg')
  return fd
}

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  otherOwnerId = await createTestUser(admin, OTHER_OWNER_EMAIL)
  const setupOwner = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(setupOwner, ownerId, 'uploadPersonPhoto Tree')
  const setupOther = await signedInClient(OTHER_OWNER_EMAIL)
  otherTreeId = await createTree(
    setupOther,
    otherOwnerId,
    'uploadPersonPhoto Other Tree',
  )
})

afterAll(async () => {
  // Best-effort: clear any uploaded files via service role before the user
  // delete cascades the tree away.
  const { data: aFolders } = await admin.storage
    .from('photos')
    .list(`trees/${treeId}/people`, { limit: 1000 })
  if (aFolders) {
    const paths = aFolders
      .filter((e) => e.id === null)
      .map((e) => `trees/${treeId}/people/${e.name}/avatar.jpg`)
    if (paths.length > 0) await admin.storage.from('photos').remove(paths)
  }
  const { data: bFolders } = await admin.storage
    .from('photos')
    .list(`trees/${otherTreeId}/people`, { limit: 1000 })
  if (bFolders) {
    const paths = bFolders
      .filter((e) => e.id === null)
      .map((e) => `trees/${otherTreeId}/people/${e.name}/avatar.jpg`)
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

describe('uploadPersonPhoto', () => {
  it('happy path: owner uploads → returns photoUrl + sets people.photo_url', async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Upload Subject',
    })

    const res = await uploadPersonPhoto(treeId, personId, formDataWith(makeJpegBlob()))
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.photoUrl).toContain(
      `/storage/v1/object/public/photos/trees/${treeId}/people/${personId}/avatar.jpg`,
    )

    const { data: row } = await admin
      .from('people')
      .select('photo_url')
      .eq('id', personId)
      .single<{ photo_url: string | null }>()
    expect(row?.photo_url).toBe(res.photoUrl)
  })

  it('cross-tree: owner of T_A cannot upload into T_B', async () => {
    // Person owned by the *other* tree — owner of T_A signs in but tries to
    // write into T_B's path. Both `is_tree_editor(treeBId)` (Storage RLS)
    // and the people.update RLS gate will reject this.
    const otherPersonId = await seedPerson(admin, otherTreeId, {
      full_name: 'Other Tree Subject',
    })

    const res = await uploadPersonPhoto(
      otherTreeId,
      otherPersonId,
      formDataWith(makeJpegBlob()),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBeTruthy()

    // Storage should not contain the file either way (the RLS reject either
    // happens at upload or at the people.update, but the action's orphan
    // cleanup should have run if the upload landed).
    const { data: listed } = await admin.storage
      .from('photos')
      .list(`trees/${otherTreeId}/people/${otherPersonId}`)
    const found = listed?.some((entry) => entry.name === 'avatar.jpg') ?? false
    expect(found).toBe(false)
  })

  it("empty-file rejection: zero-byte blob returns ok:false with empty-file error", async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Empty Subject',
    })
    const empty = new Blob([], { type: 'image/jpeg' })

    const res = await uploadPersonPhoto(treeId, personId, formDataWith(empty))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toMatch(/empty/i)
  })

  it("oversized rejection: blob larger than 512 KB returns ok:false with size error", async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Oversized Subject',
    })
    // STORAGE_MAX_BYTES is 524288 (= 512 KB). One byte over the lid.
    const huge = makeJpegBlob(524289)

    const res = await uploadPersonPhoto(treeId, personId, formDataWith(huge))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toMatch(/too large/i)
  })

  it("missing file: FormData without a 'file' entry returns ok:false", async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'No-File Subject',
    })
    const fd = new FormData() // no 'file' key

    const res = await uploadPersonPhoto(treeId, personId, fd)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toMatch(/no file/i)
  })

  it("upsert: re-uploading replaces the previous avatar (same path, new content)", async () => {
    const personId = await seedPerson(admin, treeId, {
      full_name: 'Upsert Subject',
    })

    const first = await uploadPersonPhoto(
      treeId,
      personId,
      formDataWith(makeJpegBlob()),
    )
    expect(first.ok).toBe(true)

    const second = await uploadPersonPhoto(
      treeId,
      personId,
      formDataWith(makeJpegBlob()),
    )
    expect(second.ok).toBe(true)

    // Only one file under the personId prefix — the upsert replaced.
    const { data: listed } = await admin.storage
      .from('photos')
      .list(`trees/${treeId}/people/${personId}`)
    const jpegs = listed?.filter((e) => e.name === 'avatar.jpg') ?? []
    expect(jpegs.length).toBe(1)
  })
})
