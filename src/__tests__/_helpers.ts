/**
 * Shared test helpers for Phase 3 Vitest suites.
 *
 * Mirrors the pattern in `src/__tests__/rls/trees.test.ts` (local Supabase
 * stack on :54321, deterministic dev JWT keys, service-role admin client
 * for cross-account setup). Centralising the user lifecycle + tree/person
 * fixtures keeps each suite focused on the assertions they care about.
 *
 * Local-only: every test file in `src/__tests__/` assumes `supabase start`
 * is running. The QA project is intentionally NOT used (per the brief —
 * tests run against fresh local schema, never the shared QA DB).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'http://127.0.0.1:54321'

// Deterministic dev JWT keys from `pnpm exec supabase status -o env`.
// Public local-stack constants — safe to commit, NOT secrets.
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const PASSWORD = 'Test1234!'

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function signedInClient(email: string): Promise<SupabaseClient> {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Sign-in for ${email} failed: ${error.message}`)
  return c
}

/**
 * Deletes any leftover user by email (idempotent — no-op if not found).
 * Cascade FKs on auth.users.id remove their trees + memberships + people.
 */
export async function deleteUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const match = data.users.find((u) => u.email === email)
  if (match) {
    await admin.auth.admin.deleteUser(match.id)
  }
}

export async function createTestUser(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  await deleteUserByEmail(admin, email)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
  return data.user!.id
}

/**
 * Creates a tree owned by `ownerId` via the same RPC the app uses.
 * Caller must pass an authenticated client for that owner.
 */
export async function createTree(
  client: SupabaseClient,
  ownerId: string,
  name = 'Test Tree',
): Promise<string> {
  const { data, error } = await client.rpc('create_tree_with_owner', {
    p_name: name,
    p_description: null,
    p_owner_id: ownerId,
  })
  if (error) throw new Error(`create_tree_with_owner failed: ${error.message}`)
  return data as string
}

/**
 * Inserts a row directly into tree_members using the service role.
 * Bypasses RLS for the test-setup step of adding an editor to a tree
 * (the editor-invite UI is Phase 6 — until then we seed memberships
 * directly).
 */
export async function addMember(
  admin: SupabaseClient,
  treeId: string,
  userId: string,
  role: 'owner' | 'editor',
): Promise<void> {
  const { error } = await admin
    .from('tree_members')
    .insert({ tree_id: treeId, user_id: userId, role })
  if (error) throw new Error(`addMember failed: ${error.message}`)
}

export type PersonSeed = {
  full_name: string
  gender?: 'm' | 'f' | 'other' | 'unknown'
  father_id?: string | null
  mother_id?: string | null
  spouse_id?: string | null
}

/**
 * Inserts a `people` row via the service role (skips RLS). Use this for
 * test-setup; the actual policy-gated insert path is covered by the RLS
 * suite. Returns the new row id.
 */
export async function seedPerson(
  admin: SupabaseClient,
  treeId: string,
  person: PersonSeed,
): Promise<string> {
  const { data, error } = await admin
    .from('people')
    .insert({
      tree_id: treeId,
      full_name: person.full_name,
      gender: person.gender ?? 'unknown',
      father_id: person.father_id ?? null,
      mother_id: person.mother_id ?? null,
      spouse_id: person.spouse_id ?? null,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    throw new Error(`seedPerson(${person.full_name}) failed: ${error?.message}`)
  }
  return data.id
}

/**
 * Read a person row via the service role (bypasses RLS). Use when you
 * want to assert ground-truth DB state after a policy-gated mutation.
 */
export async function readPerson(
  admin: SupabaseClient,
  personId: string,
): Promise<{
  id: string
  father_id: string | null
  mother_id: string | null
  spouse_id: string | null
  full_name: string
  tree_id: string
} | null> {
  const { data } = await admin
    .from('people')
    .select('id, father_id, mother_id, spouse_id, full_name, tree_id')
    .eq('id', personId)
    .maybeSingle()
  return data as
    | {
        id: string
        father_id: string | null
        mother_id: string | null
        spouse_id: string | null
        full_name: string
        tree_id: string
      }
    | null
}
