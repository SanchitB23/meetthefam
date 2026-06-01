/**
 * scripts/qa/seed-editor-fixture.ts
 *
 * Idempotently seeds a `tree_members` row with role='editor' for a given
 * (tree_id, email) pair against a remote Supabase project (QA or local).
 *
 * Usage:
 *   pnpm tsx scripts/qa/seed-editor-fixture.ts --tree=<uuid> --email=<email>
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL     — base URL of the Supabase project
 *   SUPABASE_SERVICE_ROLE_KEY    — service-role key (bypasses RLS)
 *
 * Exit codes: 0 = success / already-exists no-op, non-zero = failure.
 *
 * Uses the same admin-client + admin.createUser pattern as
 * `src/__tests__/_helpers.ts` — no new npm deps required.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs(): { treeId: string; email: string } {
  const args = process.argv.slice(2)
  let treeId: string | undefined
  let email: string | undefined

  for (const arg of args) {
    if (arg.startsWith('--tree=')) treeId = arg.slice('--tree='.length)
    if (arg.startsWith('--email=')) email = arg.slice('--email='.length)
  }

  if (!treeId) {
    process.stderr.write('Error: --tree=<uuid> is required\n')
    process.exit(1)
  }
  if (!email) {
    process.stderr.write('Error: --email=<email> is required\n')
    process.exit(1)
  }

  return { treeId, email }
}

// ── Build admin client ──────────────────────────────────────────────────────

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    process.stderr.write(
      'Error: NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local.\n',
    )
    process.exit(1)
  }
  if (!key) {
    process.stderr.write(
      'Error: SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.\n',
    )
    process.exit(1)
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Load .env.local (tsx does not auto-load it) ─────────────────────────────

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    // Skip blank lines and comments.
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal()

  const { treeId, email } = parseArgs()
  const admin = buildAdminClient()

  // ── Step 1: look up (or create) the user ─────────────────────────────────
  let userId: string | undefined

  const { data: listData, error: listError } = await admin.auth.admin.listUsers()
  if (listError) {
    process.stderr.write(`Error: listUsers failed: ${listError.message}\n`)
    process.exit(1)
  }

  const existing = listData.users.find((u) => u.email === email)
  if (existing) {
    userId = existing.id
    console.log(`User already exists: ${email} (id=${userId})`)
  } else {
    // Auto-confirmed sign-up via admin — mirrors createTestUser in _helpers.ts
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createError || !created.user) {
      process.stderr.write(
        `Error: admin.createUser(${email}) failed: ${createError?.message ?? 'no user returned'}\n`,
      )
      process.exit(1)
    }
    userId = created.user.id
    console.log(`Created user: ${email} (id=${userId})`)
  }

  // ── Step 2: idempotent insert into tree_members ───────────────────────────
  // Check first so we can emit a helpful no-op message.
  const { data: existingRow, error: selectError } = await admin
    .from('tree_members')
    .select('role')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .maybeSingle<{ role: string }>()

  if (selectError) {
    process.stderr.write(
      `Error: checking tree_members failed: ${selectError.message}\n`,
    )
    process.exit(1)
  }

  if (existingRow) {
    console.log(
      `No-op: tree_members row already exists (tree=${treeId}, user=${userId}, role=${existingRow.role})`,
    )
    process.exit(0)
  }

  const { error: insertError } = await admin.from('tree_members').insert({
    tree_id: treeId,
    user_id: userId,
    role: 'editor',
  })

  if (insertError) {
    process.stderr.write(
      `Error: inserting tree_members row failed: ${insertError.message}\n`,
    )
    process.exit(1)
  }

  console.log(
    `Done: inserted tree_members (tree=${treeId}, user=${userId}, role=editor)`,
  )
  process.exit(0)
}

main().catch((err: unknown) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
