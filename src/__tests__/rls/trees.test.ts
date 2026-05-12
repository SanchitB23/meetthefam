/**
 * RLS smoke tests for the trees + tree_members tables.
 * Requires: local Supabase running (`pnpm exec supabase start`)
 * Run: pnpm test
 */
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const URL = 'http://127.0.0.1:54321'
// Local dev JWT keys — fetched via `pnpm exec supabase status -o env`.
// These are deterministic for `supabase start` against this repo's config.
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const USER_A_EMAIL = 'rls-user-a@test.local'
const USER_B_EMAIL = 'rls-user-b@test.local'
const PASSWORD = 'Test1234!'

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userAId: string
let userBId: string
let treeId: string

async function deleteUserByEmail(email: string) {
  // listUsers paginates; we only have a handful in the local stack, so page 1 is enough.
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const match = data.users.find((u) => u.email === email)
  if (match) {
    await admin.auth.admin.deleteUser(match.id)
  }
}

beforeAll(async () => {
  // Clean up any leftovers from a previous failed run.
  await deleteUserByEmail(USER_A_EMAIL)
  await deleteUserByEmail(USER_B_EMAIL)

  const { data: a, error: errA } = await admin.auth.admin.createUser({
    email: USER_A_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (errA) throw new Error(`Failed to create user A: ${errA.message}`)
  userAId = a.user!.id

  const { data: b, error: errB } = await admin.auth.admin.createUser({
    email: USER_B_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (errB) throw new Error(`Failed to create user B: ${errB.message}`)
  userBId = b.user!.id

  // User A creates a tree via the same RPC the app uses.
  const clientA = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: PASSWORD,
  })
  if (signInErr) throw new Error(`Sign-in A failed: ${signInErr.message}`)

  const { data: id, error } = await clientA.rpc('create_tree_with_owner', {
    p_name: 'RLS Test Tree',
    p_description: null,
    p_owner_id: userAId,
  })
  if (error) throw new Error(`Setup failed: ${error.message}`)
  treeId = id as string
})

afterAll(async () => {
  // Cascade deletes trees + tree_members via FK.
  if (userAId) await admin.auth.admin.deleteUser(userAId)
  if (userBId) await admin.auth.admin.deleteUser(userBId)
})

describe('trees RLS', () => {
  it('owner can SELECT their own tree', async () => {
    const c = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await c.auth.signInWithPassword({ email: USER_A_EMAIL, password: PASSWORD })
    const { data, error } = await c.from('trees').select('id').eq('id', treeId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it("non-member cannot SELECT another user's tree (returns empty)", async () => {
    const c = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await c.auth.signInWithPassword({ email: USER_B_EMAIL, password: PASSWORD })
    const { data, error } = await c.from('trees').select('id').eq('id', treeId)
    expect(error).toBeNull() // RLS silently filters
    expect(data).toHaveLength(0)
  })

  it('non-owner UPDATE is silently blocked (0 rows affected, name unchanged)', async () => {
    const c = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await c.auth.signInWithPassword({ email: USER_B_EMAIL, password: PASSWORD })
    await c.from('trees').update({ name: 'Hijacked' }).eq('id', treeId)
    // Verify via service role (RLS-bypassing read).
    const { data } = await admin
      .from('trees')
      .select('name')
      .eq('id', treeId)
      .single()
    expect(data!.name).toBe('RLS Test Tree')
  })

  it('non-owner DELETE is silently blocked (tree still exists)', async () => {
    const c = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await c.auth.signInWithPassword({ email: USER_B_EMAIL, password: PASSWORD })
    await c.from('trees').delete().eq('id', treeId)
    const { data } = await admin
      .from('trees')
      .select('id')
      .eq('id', treeId)
      .single()
    expect(data).not.toBeNull()
  })
})
