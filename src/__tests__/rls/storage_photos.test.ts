/**
 * RLS smoke tests for the `photos` Storage bucket on `storage.objects`.
 *
 * Requires: local Supabase running (`pnpm exec supabase start`).
 * Run: `pnpm test`.
 *
 * Mirrors the structure of `people.test.ts`. Covers the four policies in
 * `supabase/migrations/20260513141141_photos_bucket_and_rls.sql` plus the
 * tightened SELECT policy at `20260513154211_photos_select_policy_tighten.sql`:
 *   - photos_insert_editor  (owners + editors can INSERT)
 *   - photos_update_editor  (owners + editors can UPDATE)
 *   - photos_delete_editor  (owners + editors can DELETE)
 *   - photos_select_editor  (owners + editors can SELECT — supports the
 *                            INSERT ... RETURNING the supabase-js client runs
 *                            during .upload())
 *
 * Path layout under test: `trees/<treeId>/people/<personId>/avatar.jpg`.
 * `is_tree_editor(((storage.foldername(name))[2])::uuid)` parses segment [2]
 * (the tree UUID, 1-based) and runs the same membership predicate used by
 * `public.people`.
 *
 * Three roles under test:
 *   A = owner of tree T_A
 *   B = unrelated user (no membership)
 *   C = editor of T_A (membership seeded directly via service-role)
 *
 * Plus a cross-tree check: editor C uploading into T_B's prefix is rejected.
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
  seedPerson,
} from '../_helpers'

const USER_A_EMAIL = 'rls-photos-a@test.local'
const USER_B_EMAIL = 'rls-photos-b@test.local'
const USER_C_EMAIL = 'rls-photos-c@test.local'

const BUCKET = 'photos'

const admin = adminClient()

let userAId: string
let userBId: string
let userCId: string
let treeAId: string
let treeBId: string
let personAId: string
let personBId: string

/**
 * Build a minimal JPEG-shaped Blob. The bucket's `allowed_mime_types` is
 * `{'image/jpeg'}`, so the content-type at upload time matters more than the
 * bytes — but a valid JFIF header keeps Supabase Storage's MIME sniffing
 * happy if it ever gets stricter. The end-of-image marker (0xFF, 0xD9) makes
 * this a syntactically valid (if visually empty) JPEG.
 */
function makeJpegBlob(): Blob {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ])
  return new Blob([bytes], { type: 'image/jpeg' })
}

function avatarPath(treeId: string, personId: string): string {
  return `trees/${treeId}/people/${personId}/avatar.jpg`
}

beforeAll(async () => {
  userAId = await createTestUser(admin, USER_A_EMAIL)
  userBId = await createTestUser(admin, USER_B_EMAIL)
  userCId = await createTestUser(admin, USER_C_EMAIL)

  const clientA = await signedInClient(USER_A_EMAIL)
  treeAId = await createTree(clientA, userAId, 'Photos RLS Tree A')

  const clientB = await signedInClient(USER_B_EMAIL)
  treeBId = await createTree(clientB, userBId, 'Photos RLS Tree B')

  // Seed user C as editor on A's tree (bypassing UI — Phase 6 ships invites).
  await addMember(admin, treeAId, userCId, 'editor')

  // Seed one person per tree for the canonical path.
  personAId = await seedPerson(admin, treeAId, {
    full_name: 'Photo Subject A',
    gender: 'f',
  })
  personBId = await seedPerson(admin, treeBId, {
    full_name: 'Photo Subject B',
    gender: 'm',
  })
})

afterAll(async () => {
  // Best-effort Storage cleanup BEFORE deleting the users — otherwise the
  // FK cascade kills tree_members and the suite's owner client can't reach
  // the storage.objects rows anymore.
  await admin.storage
    .from(BUCKET)
    .remove([avatarPath(treeAId, personAId), avatarPath(treeBId, personBId)])

  if (userAId) await admin.auth.admin.deleteUser(userAId)
  if (userBId) await admin.auth.admin.deleteUser(userBId)
  if (userCId) await admin.auth.admin.deleteUser(userCId)
  // Defensive cleanup if delete-by-id missed anything.
  await deleteUserByEmail(admin, USER_A_EMAIL)
  await deleteUserByEmail(admin, USER_B_EMAIL)
  await deleteUserByEmail(admin, USER_C_EMAIL)
})

describe('photos bucket RLS', () => {
  it('owner can INSERT (upload) an avatar in their own tree', async () => {
    const c = await signedInClient(USER_A_EMAIL)
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).toBeNull()
  })

  it('editor can INSERT (upload) an avatar in trees they edit', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    // upsert so this works regardless of test ordering.
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).toBeNull()
  })

  it('non-member INSERT into another tree is rejected', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).not.toBeNull()
    // Supabase Storage surfaces RLS rejections as "new row violates row-level
    // security policy" or a generic permission-denied — assert truthiness
    // rather than the exact wording so we don't break on minor message shifts.
    expect(error?.message).toBeTruthy()
  })

  it('anonymous INSERT is rejected', async () => {
    const c = anonClient()
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).not.toBeNull()
  })

  it('cross-tree: editor of T_A cannot upload into T_B', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeBId, personBId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).not.toBeNull()
  })

  it('owner can SELECT (list) avatars in their own tree', async () => {
    const c = await signedInClient(USER_A_EMAIL)
    const { data, error } = await c.storage
      .from(BUCKET)
      .list(`trees/${treeAId}/people/${personAId}`)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    // Earlier tests in the suite uploaded the avatar; the list should see it.
    expect(data?.some((entry) => entry.name === 'avatar.jpg')).toBe(true)
  })

  it('non-member SELECT (list) returns empty (filtered by RLS)', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const { data } = await c.storage
      .from(BUCKET)
      .list(`trees/${treeAId}/people/${personAId}`)
    // Storage list silently filters on RLS — non-members see an empty array.
    expect(data ?? []).toEqual([])
  })

  it('owner can UPDATE (re-upload with upsert) an existing avatar', async () => {
    const c = await signedInClient(USER_A_EMAIL)
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).toBeNull()
  })

  it('non-member UPDATE attempt is rejected', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const { error } = await c.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    expect(error).not.toBeNull()
  })

  it('editor can DELETE an avatar in trees they edit', async () => {
    // Seed a throwaway upload (as owner) so the rest of the suite doesn't
    // depend on whether this test ran first.
    const owner = await signedInClient(USER_A_EMAIL)
    await owner.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })

    const c = await signedInClient(USER_C_EMAIL)
    const { data, error } = await c.storage
      .from(BUCKET)
      .remove([avatarPath(treeAId, personAId)])
    expect(error).toBeNull()
    // A successful remove returns the deleted object descriptors.
    expect(data && data.length > 0).toBe(true)
  })

  it('non-member DELETE attempt does not remove the file', async () => {
    // Re-seed an avatar to exercise the negative case cleanly.
    const owner = await signedInClient(USER_A_EMAIL)
    await owner.storage
      .from(BUCKET)
      .upload(avatarPath(treeAId, personAId), makeJpegBlob(), {
        contentType: 'image/jpeg',
        upsert: true,
      })

    const c = await signedInClient(USER_B_EMAIL)
    const { data } = await c.storage
      .from(BUCKET)
      .remove([avatarPath(treeAId, personAId)])
    // Either an error, or data === [] (silently filtered) — what matters is
    // the file is still there.
    expect((data ?? []).length).toBe(0)

    // Ground-truth via service-role list.
    const { data: stillThere } = await admin.storage
      .from(BUCKET)
      .list(`trees/${treeAId}/people/${personAId}`)
    expect(stillThere?.some((entry) => entry.name === 'avatar.jpg')).toBe(true)
  })

  it('anonymous DELETE attempt is rejected', async () => {
    // File should already exist from the prior test's re-seed.
    const c = anonClient()
    const { data } = await c.storage
      .from(BUCKET)
      .remove([avatarPath(treeAId, personAId)])
    expect((data ?? []).length).toBe(0)
  })
})
