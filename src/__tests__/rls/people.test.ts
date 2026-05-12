/**
 * RLS smoke tests for the `people` table.
 *
 * Requires: local Supabase running (`pnpm exec supabase start`).
 * Run: `pnpm test`.
 *
 * Mirrors the structure of `trees.test.ts`. Covers the four policies in
 * `supabase/migrations/20260511034131_initial_schema.sql`:
 *   - people_select_member  (members + owners can SELECT)
 *   - people_insert_editor  (owners + editors can INSERT)
 *   - people_update_editor  (owners + editors can UPDATE)
 *   - people_delete_editor  (owners + editors can DELETE)
 *
 * Three roles under test:
 *   A = owner of the tree
 *   B = unrelated user (no membership)
 *   C = editor of A's tree (membership seeded directly via service-role)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  SUPABASE_URL,
  ANON_KEY,
  adminClient,
  anonClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  addMember,
  seedPerson,
  readPerson,
} from '../_helpers'
import { createClient } from '@supabase/supabase-js'

const USER_A_EMAIL = 'rls-people-a@test.local'
const USER_B_EMAIL = 'rls-people-b@test.local'
const USER_C_EMAIL = 'rls-people-c@test.local'

const admin = adminClient()

let userAId: string
let userBId: string
let userCId: string
let treeId: string
let personId: string

beforeAll(async () => {
  userAId = await createTestUser(admin, USER_A_EMAIL)
  userBId = await createTestUser(admin, USER_B_EMAIL)
  userCId = await createTestUser(admin, USER_C_EMAIL)

  const clientA = await signedInClient(USER_A_EMAIL)
  treeId = await createTree(clientA, userAId, 'People RLS Tree')

  // Seed user C as editor on A's tree (bypassing UI — Phase 6 ships invites).
  await addMember(admin, treeId, userCId, 'editor')

  // Seed a person owned by A's tree for cross-tenant assertions.
  personId = await seedPerson(admin, treeId, {
    full_name: 'Alice Test',
    gender: 'f',
  })
})

afterAll(async () => {
  // Cascade FKs on auth.users.id wipe trees + members + people.
  if (userAId) await admin.auth.admin.deleteUser(userAId)
  if (userBId) await admin.auth.admin.deleteUser(userBId)
  if (userCId) await admin.auth.admin.deleteUser(userCId)
  // Defensive cleanup if delete-by-id missed anything (e.g. earlier crash).
  await deleteUserByEmail(admin, USER_A_EMAIL)
  await deleteUserByEmail(admin, USER_B_EMAIL)
  await deleteUserByEmail(admin, USER_C_EMAIL)
})

describe('people RLS', () => {
  it('owner can SELECT people in their own tree', async () => {
    const c = await signedInClient(USER_A_EMAIL)
    const { data, error } = await c
      .from('people')
      .select('id')
      .eq('tree_id', treeId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(personId)
  })

  it("non-member cannot SELECT another user's people (returns empty)", async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const { data, error } = await c
      .from('people')
      .select('id')
      .eq('tree_id', treeId)
    // RLS silently filters — no error, no rows.
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('editor can SELECT people in trees they are a member of', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    const { data, error } = await c
      .from('people')
      .select('id')
      .eq('tree_id', treeId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('non-member INSERT is rejected (no row appears)', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const before = await admin
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    const beforeCount = before.count ?? 0

    const { error } = await c.from('people').insert({
      tree_id: treeId,
      full_name: 'Mallory Intruder',
    })
    // RLS returns an error on INSERT failure (USING + WITH CHECK).
    expect(error).not.toBeNull()

    const after = await admin
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId)
    expect(after.count ?? 0).toBe(beforeCount)
  })

  it('editor CAN insert a person into trees they edit', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    const { data, error } = await c
      .from('people')
      .insert({ tree_id: treeId, full_name: 'Editor Insert' })
      .select('id')
      .single<{ id: string }>()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    // Cleanup so subsequent COUNT assertions stay stable.
    if (data?.id) await admin.from('people').delete().eq('id', data.id)
  })

  it('non-member UPDATE is silently blocked (0 rows affected)', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    const before = await readPerson(admin, personId)
    await c
      .from('people')
      .update({ full_name: 'Hijacked Name' })
      .eq('id', personId)
    const after = await readPerson(admin, personId)
    expect(after?.full_name).toBe(before?.full_name)
    expect(after?.full_name).toBe('Alice Test')
  })

  it('editor CAN update a person in trees they edit', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    const { error } = await c
      .from('people')
      .update({ nickname: 'Ali' })
      .eq('id', personId)
    expect(error).toBeNull()
    const after = await readPerson(admin, personId)
    expect(after).not.toBeNull()
    // Revert so subsequent tests see a clean row.
    await admin.from('people').update({ nickname: null }).eq('id', personId)
  })

  it('non-member DELETE is silently blocked (row still exists)', async () => {
    const c = await signedInClient(USER_B_EMAIL)
    await c.from('people').delete().eq('id', personId)
    const after = await readPerson(admin, personId)
    expect(after).not.toBeNull()
    expect(after?.id).toBe(personId)
  })

  it('editor CAN delete a person in trees they edit', async () => {
    const c = await signedInClient(USER_C_EMAIL)
    // Seed a throwaway row so the rest of the suite sees a stable fixture.
    const tmpId = await seedPerson(admin, treeId, { full_name: 'Doomed' })
    const { error } = await c.from('people').delete().eq('id', tmpId)
    expect(error).toBeNull()
    const after = await readPerson(admin, tmpId)
    expect(after).toBeNull()
  })

  it('anonymous client cannot SELECT / INSERT / UPDATE / DELETE', async () => {
    const c = anonClient()

    const sel = await c.from('people').select('id').eq('tree_id', treeId)
    expect(sel.data).toEqual([])

    const ins = await c
      .from('people')
      .insert({ tree_id: treeId, full_name: 'Anon Insert' })
    expect(ins.error).not.toBeNull()

    // UPDATE / DELETE either error or silently filter; what matters is the row
    // is unchanged. Verify against ground truth via service role.
    await c.from('people').update({ full_name: 'Anon Hijack' }).eq('id', personId)
    const afterUpd = await readPerson(admin, personId)
    expect(afterUpd?.full_name).toBe('Alice Test')

    await c.from('people').delete().eq('id', personId)
    const afterDel = await readPerson(admin, personId)
    expect(afterDel).not.toBeNull()
  })

  it('anonymous client (no JWT at all) is also denied', async () => {
    // Constructing a client with the anon key but no signed-in session is the
    // case above. Here we exercise the "no Authorization header" path by
    // omitting the auth options entirely — supabase-js still attaches the anon
    // key, which is the same as the unauthenticated public access PostgREST
    // role. Belt-and-braces against a regression that would loosen the policy.
    const c = createClient(SUPABASE_URL, ANON_KEY)
    const { data } = await c.from('people').select('id').eq('tree_id', treeId)
    expect(data).toEqual([])
  })
})
