// scripts/export-stress/seed-export-stress.ts
// Seeds deterministic stress trees into the LOCAL Supabase stack via the
// service-role key (bypasses RLS). Idempotent: wipes any prior export-stress
// trees owned by the stress user, then recreates. Prints tree IDs.
//
// Usage:
//   pnpm seed:export-stress
//
// Requires (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Local stack must be running: pnpm exec supabase start
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildTreeShape } from './tree-shape'
import { synthPhoto } from './synth-photo'

const FIXTURES = [
  { name: 'Export Stress 25', count: 25, rootCouples: 3 },
  { name: 'Export Stress 50', count: 50, rootCouples: 3 },
  { name: 'Export Stress 100', count: 100, rootCouples: 3 },
  { name: 'Export Stress 150', count: 150, rootCouples: 3 },
  { name: 'Export Stress 200', count: 200, rootCouples: 3 },
  // #224 regression spot-check: single founding couple (no __super_root__).
  { name: 'Export Stress 60 single-trunk', count: 60, rootCouples: 1 },
] as const

const STRESS_EMAIL = 'export-stress@example.com'
const BUCKET = 'photos'

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(k in process.env)) process.env[k] = v
  }
}

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    process.stderr.write('Error: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set\n')
    process.exit(1)
  }
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    process.stderr.write(`Refusing to seed non-local Supabase URL: ${url}\n`)
    process.exit(1)
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Admin = ReturnType<typeof buildAdminClient>

type Fixture = (typeof FIXTURES)[number]

async function ensureOwner(admin: Admin): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const existing = data.users.find((u) => u.email === STRESS_EMAIL)
  if (existing) return existing.id
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: STRESS_EMAIL,
    email_confirm: true,
  })
  if (cErr || !created.user) throw cErr ?? new Error('createUser returned no user')
  return created.user.id
}

async function wipePriorTrees(admin: Admin, ownerId: string): Promise<void> {
  const { data: trees } = await admin
    .from('trees')
    .select('id')
    .eq('owner_id', ownerId)
    .like('name', 'Export Stress %')
  for (const t of trees ?? []) {
    await admin.storage.from(BUCKET).remove([`trees/${t.id}`])
    await admin.from('trees').delete().eq('id', t.id)
  }
}

async function seedTree(admin: Admin, ownerId: string, fixture: Fixture): Promise<string> {
  const { data: tree, error: tErr } = await admin
    .from('trees')
    .insert({ name: fixture.name, owner_id: ownerId })
    .select('id')
    .single<{ id: string }>()
  if (tErr || !tree) throw tErr ?? new Error('tree insert failed')
  const treeId = tree.id

  await admin.from('tree_members').insert({ tree_id: treeId, user_id: ownerId, role: 'owner' })

  const specs = buildTreeShape(fixture.count, fixture.rootCouples)
  const ids: string[] = []
  for (const s of specs) {
    const { data, error } = await admin
      .from('people')
      .insert({
        tree_id: treeId,
        full_name: s.fullName,
        gender: s.gender,
        created_by: ownerId,
      })
      .select('id')
      .single<{ id: string }>()
    if (error || !data) throw error ?? new Error('person insert failed')
    ids[s.idx] = data.id
  }
  for (const s of specs) {
    const patch: Record<string, string | null> = {}
    if (s.fatherIdx !== null) patch.father_id = ids[s.fatherIdx]
    if (s.motherIdx !== null) patch.mother_id = ids[s.motherIdx]
    if (s.spouseIdx !== null) patch.spouse_id = ids[s.spouseIdx]
    if (Object.keys(patch).length) {
      await admin.from('people').update(patch).eq('id', ids[s.idx])
    }
  }

  for (const s of specs) {
    if (!s.hasPhoto) continue
    const personId = ids[s.idx]
    const path = `trees/${treeId}/people/${personId}/avatar.jpg`
    const jpeg = await synthPhoto(s.idx)
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) throw upErr
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    await admin.from('people').update({ photo_url: pub.publicUrl }).eq('id', personId)
  }

  return treeId
}

async function main(): Promise<void> {
  loadEnvLocal()
  const admin = buildAdminClient()
  const ownerId = await ensureOwner(admin)
  await wipePriorTrees(admin, ownerId)

  console.log('Seeding export-stress trees...')
  const out: Array<{ name: string; id: string }> = []
  for (const fixture of FIXTURES) {
    const id = await seedTree(admin, ownerId, fixture)
    out.push({ name: fixture.name, id })
    console.log(`  ${fixture.name} → tree ${id}`)
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((e: unknown) => {
  process.stderr.write(`Seed failed: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
