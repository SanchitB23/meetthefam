# Full-tree Export Viability Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic 5-tree seed + a throwaway capture probe, measure client-side (`html-to-image`) and server-side (Playwright) export of a full family tree across sizes and browsers, then compute the A-only / A-now-B-later / A+B verdict for epic #60.

**Architecture:** A `tsx` seed script writes 5 trees (25/50/100/150/200 people) with FK relationships + synthesised photos into the **local** Supabase stack via the service-role key. A temporary public Next route renders the real `<FamilyTree>` against a seed tree and runs two capture paths. A Playwright runner drives the client path across browsers + screenshots the server path. Results fill the spec's metrics table; the verdict + product note go into the spec and a #215 comment. **Everything here is disposable spike code** — the only durable artifacts are the spec doc + the #215 comment + the verdict.

**Tech Stack:** Next.js 16 App Router, Supabase (local), `@supabase/supabase-js` service-role, `tsx`, `sharp` (synthesise photos), `html-to-image` + `jspdf` (client capture), `@playwright/test` (browser matrix + server capture).

**Branch / env:** Work on `spike/215-full-tree-export-viability` in the worktree `.claude/worktrees/spike-215`. Every command needs node 24 on PATH:
```bash
export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh" >/dev/null
export PATH="$NVM_DIR/versions/node/v24.15.0/bin:$PATH"
```
The local Supabase stack must be running: `pnpm exec supabase start` (Studio :54323, Mailpit :54324). `.env.local` already holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Reference reading before starting:**
- Spec: `docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md`
- Schema: `supabase/migrations/20260511034131_initial_schema.sql` (people:249, trees:21, tree_members:38)
- Photos bucket: `supabase/migrations/20260513141141_photos_bucket_and_rls.sql` (bucket `photos`, public, 512 KB lid, `image/jpeg`)
- Existing seed pattern to mirror: `scripts/qa/seed-editor-fixture.ts` (`loadEnvLocal`, `buildAdminClient`, `admin.auth.admin.createUser`)
- `PersonRow`: `src/app/(app)/tree/[id]/_lib/types.ts:11-30`
- `<FamilyTree>` props: `src/app/(app)/tree/[id]/_components/FamilyTree.tsx:72-83` (props: `treeId`, `people: PersonRow[]`, `initialFocusId?`, `readOnly?`)
- Photo path helper: `src/app/(app)/tree/[id]/actions.ts:497` → `trees/${treeId}/people/${personId}/avatar.jpg`; bucket const `STORAGE_BUCKET = 'photos'` (actions.ts:487)
- Auth gate: `src/proxy.ts` (matcher:66 protects everything except `_next`, static, `share`); `src/lib/public-routes.ts` (`PUBLIC_PATHS`)

---

## File structure

- **Create** `scripts/spike-215/tree-shape.ts` — pure generator: count → array of person specs with father/mother/spouse links. Deterministic. Unit-tested.
- **Create** `scripts/spike-215/synth-photo.ts` — pure: index → JPEG `Buffer` (varied colour, ~256×256, < 512 KB) via `sharp`.
- **Create** `scripts/spike-215/seed-export-stress.ts` — runner: builds 5 trees, owner user, members, people rows, uploads photos, prints the tree IDs.
- **Create** `scripts/spike-215/__tests__/tree-shape.test.ts` — Vitest unit tests for the generator.
- **Create** `src/app/_spike/export-probe/page.tsx` — server component: service-role-loads people for `?tree=<id>`, renders the client probe.
- **Create** `src/app/_spike/export-probe/Probe.tsx` — `'use client'`: renders `<FamilyTree>` + capture buttons (PNG/PDF) + metrics readout.
- **Create** `scripts/spike-215/capture-runner.spec.ts` — Playwright spec: drives the probe across browsers/sizes, runs client capture, screenshots the server path, emits metrics JSON.
- **Create** `playwright.config.ts` — minimal config (3 desktop + 2 mobile projects).
- **Modify** `src/lib/public-routes.ts` — temporarily add `/_spike` (reverted in cleanup task).
- **Modify** `docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md` — fill metrics + verdict.
- **Modify** `package.json` — devDeps + `pnpm.onlyBuiltDependencies` (sharp) + scripts.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json` (deps, `pnpm.onlyBuiltDependencies`, scripts)

- [ ] **Step 1: Install runtime + dev deps**

Run (node-24 PATH exported):
```bash
pnpm add html-to-image jspdf
pnpm add -D sharp @playwright/test
```
Expected: all four resolve and install.

- [ ] **Step 2: Whitelist sharp's postinstall (pnpm 10 strict policy)**

`sharp` ships a native binary via a postinstall script that pnpm skips by default (see CLAUDE.md "Local dev"). Add `"sharp"` to the existing `pnpm.onlyBuiltDependencies` array in `package.json` (it currently lists `"supabase"`), then:
```bash
pnpm rebuild sharp
```
Expected: sharp rebuilds, prints its platform binary.

- [ ] **Step 3: Install Playwright browsers**

Run:
```bash
pnpm exec playwright install chromium webkit firefox
```
Expected: three browsers download.

- [ ] **Step 4: Add convenience scripts to package.json**

Add to `"scripts"`:
```json
"spike:seed": "tsx scripts/spike-215/seed-export-stress.ts",
"spike:capture": "playwright test scripts/spike-215/capture-runner.spec.ts"
```

- [ ] **Step 5: Verify install**

Run: `pnpm typecheck`
Expected: PASS (no new code yet; deps only).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(#215): add spike capture deps (html-to-image, jspdf, sharp, playwright)"
```

---

## Task 2: Tree-shape generator (pure, TDD)

A pure function that, given a target person count, returns deterministic person specs wired with `father_id` / `mother_id` / `spouse_id` by array index (resolved to UUIDs later). Multi-generation, branching, ~70% married couples, deterministic via a seeded PRNG.

**Files:**
- Create: `scripts/spike-215/tree-shape.ts`
- Test: `scripts/spike-215/__tests__/tree-shape.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/spike-215/__tests__/tree-shape.test.ts
import { describe, it, expect } from 'vitest'
import { buildTreeShape } from '../tree-shape'

describe('buildTreeShape', () => {
  it('produces exactly the requested number of people', () => {
    for (const n of [25, 50, 100, 150, 200]) {
      expect(buildTreeShape(n).length).toBe(n)
    }
  })

  it('is deterministic for a given count', () => {
    expect(buildTreeShape(50)).toEqual(buildTreeShape(50))
  })

  it('only references parent/spouse indices that exist and are earlier (parents) ', () => {
    const people = buildTreeShape(100)
    people.forEach((p, i) => {
      if (p.fatherIdx !== null) {
        expect(p.fatherIdx).toBeGreaterThanOrEqual(0)
        expect(p.fatherIdx).toBeLessThan(i)
      }
      if (p.motherIdx !== null) {
        expect(p.motherIdx).toBeLessThan(i)
      }
      if (p.spouseIdx !== null) {
        expect(p.spouseIdx).toBeGreaterThanOrEqual(0)
        expect(p.spouseIdx).toBeLessThan(people.length)
        // spouse links are reciprocal
        expect(people[p.spouseIdx].spouseIdx).toBe(i)
      }
    })
  })

  it('assigns ~70% of people a photo (between 60% and 80%)', () => {
    const people = buildTreeShape(200)
    const withPhoto = people.filter((p) => p.hasPhoto).length
    expect(withPhoto / 200).toBeGreaterThanOrEqual(0.6)
    expect(withPhoto / 200).toBeLessThanOrEqual(0.8)
  })

  it('spans multiple generations', () => {
    const people = buildTreeShape(100)
    const maxGen = Math.max(...people.map((p) => p.generation))
    expect(maxGen).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/spike-215/__tests__/tree-shape.test.ts`
Expected: FAIL — cannot find module `../tree-shape`.

- [ ] **Step 3: Implement the generator**

```ts
// scripts/spike-215/tree-shape.ts
// Deterministic synthetic family-tree shape generator for the export-viability
// spike (#215). Pure: no I/O. Indices are positional; the seed runner resolves
// them to UUIDs. Spouse links are reciprocal. Parents always precede children.

export type PersonSpec = {
  idx: number
  generation: number
  fullName: string
  gender: 'm' | 'f'
  fatherIdx: number | null
  motherIdx: number | null
  spouseIdx: number | null
  hasPhoto: boolean
}

// Mulberry32 — tiny deterministic PRNG so runs are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Asha', 'Ravi', 'Meera', 'Arjun', 'Priya', 'Vikram', 'Sita', 'Karan', 'Nisha', 'Dev', 'Tara', 'Rohan', 'Lila', 'Sam', 'Uma', 'Neel']
const LAST = ['Rao', 'Mehta', 'Khan', 'Patel', 'Bose', 'Nair', 'Singh', 'Iyer']

/**
 * Build `count` person specs. Generation 0 is a founding couple; each later
 * person is either a child of an existing couple or the in-marrying spouse of
 * an existing person. ~70% are flagged `hasPhoto`.
 */
export function buildTreeShape(count: number): PersonSpec[] {
  const rand = mulberry32(count * 2654435761)
  const people: PersonSpec[] = []

  const push = (
    gender: 'm' | 'f',
    generation: number,
    fatherIdx: number | null,
    motherIdx: number | null,
  ): PersonSpec => {
    const idx = people.length
    const p: PersonSpec = {
      idx,
      generation,
      gender,
      fatherIdx,
      motherIdx,
      spouseIdx: null,
      fullName: `${FIRST[idx % FIRST.length]} ${LAST[idx % LAST.length]}`,
      hasPhoto: rand() < 0.7,
    }
    people.push(p)
    return p
  }

  const marry = (a: PersonSpec, b: PersonSpec) => {
    a.spouseIdx = b.idx
    b.spouseIdx = a.idx
  }

  // Founding couple (generation 0).
  const f0 = push('m', 0, null, null)
  const m0 = push('f', 0, null, null)
  marry(f0, m0)

  // Couples that can still bear children, as [husbandIdx, wifeIdx, generation].
  const couples: Array<[number, number, number]> = [[f0.idx, m0.idx, 0]]

  while (people.length < count) {
    const [hIdx, wIdx, gen] = couples[Math.floor(rand() * couples.length)]
    if (people.length + 1 > count) break

    // Add a child of this couple.
    const childGender: 'm' | 'f' = rand() < 0.5 ? 'm' : 'f'
    const child = push(childGender, gen + 1, hIdx, wIdx)

    // ~70% of children marry an in-marrying spouse (if budget allows).
    if (rand() < 0.7 && people.length < count) {
      const spouseGender: 'm' | 'f' = childGender === 'm' ? 'f' : 'm'
      const spouse = push(spouseGender, gen + 1, null, null)
      marry(child, spouse)
      couples.push([
        childGender === 'm' ? child.idx : spouse.idx,
        childGender === 'm' ? spouse.idx : child.idx,
        gen + 1,
      ])
    }
  }

  return people.slice(0, count)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/spike-215/__tests__/tree-shape.test.ts`
Expected: PASS (5 tests).

Note: if the "~70% photo" test is flaky at the band edges for a specific count, adjust the band to 55–82% — the exact ratio is not load-bearing for the spike.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike-215/tree-shape.ts scripts/spike-215/__tests__/tree-shape.test.ts
git commit -m "feat(#215): deterministic tree-shape generator for export spike"
```

---

## Task 3: Photo synthesiser (pure)

Given an index, return a small varied JPEG `Buffer` (well under the 512 KB bucket lid) so each seeded person can get a genuine cross-origin photo URL — exercising the canvas-taint + decode path realistically.

**Files:**
- Create: `scripts/spike-215/synth-photo.ts`

- [ ] **Step 1: Implement**

```ts
// scripts/spike-215/synth-photo.ts
// Synthesise a small, varied JPEG for a seeded person. Pure (returns a Buffer).
// Colour is derived from the index so photos differ (distinct decode work) but
// are deterministic. 256×256 keeps every file a few KB — far under the 512 KB
// photos-bucket lid.
import sharp from 'sharp'

export async function synthPhoto(idx: number): Promise<Buffer> {
  const hue = (idx * 47) % 360
  // HSL→RGB at S=60% L=55%.
  const { r, g, b } = hslToRgb(hue / 360, 0.6, 0.55)
  return sharp({
    create: { width: 256, height: 256, channels: 3, background: { r, g, b } },
  })
    .jpeg({ quality: 70 })
    .toBuffer()
}

function hslToRgb(h: number, s: number, l: number) {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  }
}
```

- [ ] **Step 2: Smoke-verify it produces a JPEG**

Run:
```bash
tsx -e "import('./scripts/spike-215/synth-photo.ts').then(async m => { const b = await m.synthPhoto(3); console.log('bytes', b.length, 'magic', b.subarray(0,3).toString('hex')) })"
```
Expected: `bytes <a few thousand>` and `magic ffd8ff` (JPEG SOI marker), well under 524288.

- [ ] **Step 3: Commit**

```bash
git add scripts/spike-215/synth-photo.ts
git commit -m "feat(#215): synthesise varied JPEG avatars for export spike seed"
```

---

## Task 4: Seed runner

Builds the owner user, 5 trees, membership rows, people rows (resolving index links to UUIDs), and uploads photos. Idempotent: re-running deletes + recreates the five spike trees so IDs stay printed and content is fresh. Mirrors the env/admin-client pattern of `scripts/qa/seed-editor-fixture.ts`.

**Files:**
- Create: `scripts/spike-215/seed-export-stress.ts`

- [ ] **Step 1: Implement the runner**

```ts
// scripts/spike-215/seed-export-stress.ts
// Seeds 5 deterministic stress trees (25/50/100/150/200 people) into the LOCAL
// Supabase stack via the service-role key (bypasses RLS). Idempotent: wipes any
// prior spike trees owned by the spike user, then recreates. Prints tree IDs.
//
// Usage:
//   pnpm spike:seed
//
// Requires (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Local stack must be running: pnpm exec supabase start
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildTreeShape } from './tree-shape'
import { synthPhoto } from './synth-photo'

const SIZES = [25, 50, 100, 150, 200] as const
const SPIKE_EMAIL = 'spike-215@example.com'
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
  // Guard: refuse to run against anything that is not local.
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    process.stderr.write(`Refusing to seed non-local Supabase URL: ${url}\n`)
    process.exit(1)
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Admin = ReturnType<typeof buildAdminClient>

async function ensureOwner(admin: Admin): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const existing = data.users.find((u) => u.email === SPIKE_EMAIL)
  if (existing) return existing.id
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: SPIKE_EMAIL,
    email_confirm: true,
  })
  if (cErr || !created.user) throw cErr ?? new Error('createUser returned no user')
  return created.user.id
}

async function wipePriorTrees(admin: Admin, ownerId: string): Promise<void> {
  // people / tree_members cascade on tree delete (FK on delete cascade).
  const { data: trees } = await admin
    .from('trees')
    .select('id')
    .eq('owner_id', ownerId)
    .like('name', 'Export Stress %')
  for (const t of trees ?? []) {
    await admin.storage.from(BUCKET).remove([`trees/${t.id}`]) // best-effort prefix clear
    await admin.from('trees').delete().eq('id', t.id)
  }
}

async function seedTree(admin: Admin, ownerId: string, size: number): Promise<string> {
  // 1. tree
  const { data: tree, error: tErr } = await admin
    .from('trees')
    .insert({ name: `Export Stress ${size}`, owner_id: ownerId })
    .select('id')
    .single<{ id: string }>()
  if (tErr || !tree) throw tErr ?? new Error('tree insert failed')
  const treeId = tree.id

  // 2. owner membership
  await admin.from('tree_members').insert({ tree_id: treeId, user_id: ownerId, role: 'owner' })

  // 3. people — two passes so FK index→UUID resolution works.
  const specs = buildTreeShape(size)
  const ids: string[] = []
  // Pass A: insert bare rows to mint UUIDs (no relations yet). `tone` is auto-
  // assigned by the people_assign_default_tone trigger, so we omit it.
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
  // Pass B: update relations now that every UUID exists.
  for (const s of specs) {
    const patch: Record<string, string | null> = {}
    if (s.fatherIdx !== null) patch.father_id = ids[s.fatherIdx]
    if (s.motherIdx !== null) patch.mother_id = ids[s.motherIdx]
    if (s.spouseIdx !== null) patch.spouse_id = ids[s.spouseIdx]
    if (Object.keys(patch).length) {
      await admin.from('people').update(patch).eq('id', ids[s.idx])
    }
  }

  // 4. photos for ~70% (the specs already flag who).
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
  const out: Array<{ size: number; id: string }> = []
  for (const size of SIZES) {
    const id = await seedTree(admin, ownerId, size)
    out.push({ size, id })
    console.log(`  ${size} people → tree ${id}`)
  }

  console.log('\nProbe URLs:')
  for (const { size, id } of out) {
    console.log(`  ${size}: /_spike/export-probe?tree=${id}`)
  }
  process.exit(0)
}

main().catch((e: unknown) => {
  process.stderr.write(`Seed failed: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
```

- [ ] **Step 2: Start the local stack (if not running)**

Run: `pnpm exec supabase start`
Expected: prints API URL `http://127.0.0.1:54321` etc.

- [ ] **Step 3: Run the seed**

Run: `pnpm spike:seed`
Expected: prints `25 people → tree <uuid>` … `200 people → tree <uuid>` and a "Probe URLs" block. No errors.

- [ ] **Step 4: Verify in DB**

Run:
```bash
tsx -e "import('./scripts/spike-215/seed-export-stress.ts')" 2>/dev/null; \
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
"select t.name, count(p.id) as people, count(p.photo_url) as photos from trees t join people p on p.tree_id=t.id where t.name like 'Export Stress %' group by t.name order by t.name;"
```
Expected: five rows, `people` = 25/50/100/150/200 and `photos` ≈ 70% of each. (If `psql` is unavailable, verify the same counts in Supabase Studio :54323.)

- [ ] **Step 5: Commit**

```bash
git add scripts/spike-215/seed-export-stress.ts package.json
git commit -m "feat(#215): seed runner for 5 export-stress trees (local)"
```

---

## Task 5: Probe route + client capture

A temporary public route renders the real `<FamilyTree>` against `?tree=<id>` (people loaded server-side via service-role) and a client component runs the two capture buttons + measures.

**Files:**
- Create: `src/app/_spike/export-probe/page.tsx`
- Create: `src/app/_spike/export-probe/Probe.tsx`
- Modify: `src/lib/public-routes.ts`

- [ ] **Step 1: Allow the probe route through the auth gate**

In `src/lib/public-routes.ts`, add `'/_spike'` to the `PUBLIC_PATHS` array (a sub-path match, so `/_spike/export-probe` resolves). Add a `// SPIKE #215 — remove with the probe` comment on the line.

- [ ] **Step 2: Server page — load people via service-role**

```tsx
// src/app/_spike/export-probe/page.tsx
// SPIKE #215 — throwaway. Renders the real FamilyTree against a seeded tree for
// export-capture measurement. Loads people with the service-role client so no
// session is needed. DELETE with the probe.
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'
import { Probe } from './Probe'

export const dynamic = 'force-dynamic'

export default async function ExportProbePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string }>
}) {
  const { tree } = await searchParams
  if (!tree) notFound()

  const admin = createServiceRoleClient()
  const { data: people, error } = await admin
    .from('people')
    .select(
      'id, tree_id, full_name, nickname, gender, photo_url, bio, birth_year, birth_date, location, occupation, deceased, death_year, father_id, mother_id, spouse_id, tone',
    )
    .eq('tree_id', tree)
  if (error || !people || people.length === 0) notFound()

  const { data: t } = await admin.from('trees').select('name').eq('id', tree).single()

  return (
    <Probe
      treeId={tree}
      treeName={t?.name ?? 'tree'}
      people={people as PersonRow[]}
    />
  )
}
```

- [ ] **Step 3: Client probe — render tree + capture + metrics**

```tsx
// src/app/_spike/export-probe/Probe.tsx
// SPIKE #215 — throwaway. DELETE with the page.
'use client'
import { useRef, useState } from 'react'
import { FamilyTree } from '@/app/(app)/tree/[id]/_components/FamilyTree'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

type Metrics = {
  path: string
  ok: boolean
  width?: number
  height?: number
  bytes?: number
  ms?: number
  error?: string
}

export function Probe({
  treeId,
  treeName,
  people,
}: {
  treeId: string
  treeName: string
  people: PersonRow[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<Metrics[]>([])

  // Locate the full family-chart SVG and expand it out of the clipped viewport
  // so the whole tree is in frame, then run html-to-image on that node.
  async function captureClient(format: 'png' | 'pdf') {
    const t0 = performance.now()
    const root = wrapRef.current
    const svg = root?.querySelector('svg.main_svg') as SVGSVGElement | null
    const m: Metrics = { path: `client-${format}`, ok: false }
    try {
      if (!svg) throw new Error('svg.main_svg not found')
      const bbox = svg.getBBox()
      // Capture the SVG element directly; html-to-image inlines styles/fonts and
      // fetches images to data URLs. We size to the full content bbox.
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(svg as unknown as HTMLElement, {
        pixelRatio: 2,
        width: Math.ceil(bbox.width),
        height: Math.ceil(bbox.height),
        backgroundColor: '#FAF6F0',
      })
      if (!blob) throw new Error('toBlob returned null')
      m.bytes = blob.size
      m.width = Math.ceil(bbox.width * 2)
      m.height = Math.ceil(bbox.height * 2)

      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const url = URL.createObjectURL(blob)
        const img = new Image()
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = rej
          img.src = url
        })
        const pdf = new jsPDF({ orientation: img.width > img.height ? 'l' : 'p', unit: 'px', format: [img.width, img.height] })
        pdf.addImage(img, 'PNG', 0, 0, img.width, img.height)
        pdf.save(`${treeName}-${treeId}.pdf`)
        URL.revokeObjectURL(url)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${treeName}-${treeId}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
      m.ok = true
    } catch (e) {
      m.error = e instanceof Error ? e.message : String(e)
    }
    m.ms = Math.round(performance.now() - t0)
    setMetrics((prev) => [...prev, m])
    // Expose for Playwright to read.
    ;(window as unknown as { __spikeMetrics?: Metrics[] }).__spikeMetrics = [
      ...((window as unknown as { __spikeMetrics?: Metrics[] }).__spikeMetrics ?? []),
      m,
    ]
  }

  return (
    <div style={{ padding: 12 }}>
      <div data-export-exclude style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <strong>
          {treeName} — {people.length} people
        </strong>
        <button data-testid="cap-png" onClick={() => captureClient('png')}>
          Client PNG
        </button>
        <button data-testid="cap-pdf" onClick={() => captureClient('pdf')}>
          Client PDF
        </button>
        <pre data-testid="metrics" style={{ margin: 0 }}>
          {JSON.stringify(metrics, null, 0)}
        </pre>
      </div>
      <div ref={wrapRef}>
        <FamilyTree treeId={treeId} people={people} readOnly />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Manual smoke (dev server)**

Run `pnpm dev`, open `/_spike/export-probe?tree=<the 25-person tree id>`.
Verify: tree renders; clicking **Client PNG** downloads a PNG that visually contains person cards + photos (not blank). The `metrics` block shows `ok:true` with width/height/bytes/ms.

If cards are blank or photos missing, that is a finding — record it; do not "fix" production code in this spike beyond what's needed to measure.

- [ ] **Step 5: Commit**

```bash
git add src/app/_spike/export-probe/page.tsx src/app/_spike/export-probe/Probe.tsx src/lib/public-routes.ts
git commit -m "feat(#215): throwaway export-probe route + client capture harness"
```

---

## Task 6: Playwright capture runner (browser matrix + server path)

Drives the probe across browsers/sizes: clicks the client PNG button, reads `window.__spikeMetrics`, and also takes a full-page Playwright screenshot of the tree (the "server / headless" path proxy) so we can compare reliability + size. Emits a metrics JSON.

**Files:**
- Create: `playwright.config.ts`
- Create: `scripts/spike-215/capture-runner.spec.ts`

- [ ] **Step 1: Minimal Playwright config**

```ts
// playwright.config.ts
// SPIKE #215 — minimal config for the export-capture matrix. DELETE with the spike.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/spike-215',
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
```

- [ ] **Step 2: The runner spec**

Replace the `TREE_IDS` map with the IDs printed by `pnpm spike:seed`.

```ts
// scripts/spike-215/capture-runner.spec.ts
// SPIKE #215 — drives the export-probe across sizes; records client-capture
// metrics + a headless screenshot ("server path" proxy). Run: pnpm spike:capture
import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// ⇩ paste the IDs from `pnpm spike:seed`
const TREE_IDS: Record<number, string> = {
  25: 'REPLACE_ME',
  50: 'REPLACE_ME',
  100: 'REPLACE_ME',
  150: 'REPLACE_ME',
  200: 'REPLACE_ME',
}

mkdirSync('scripts/spike-215/results', { recursive: true })

for (const [sizeStr, treeId] of Object.entries(TREE_IDS)) {
  const size = Number(sizeStr)
  test(`capture ${size}`, async ({ page, browserName }, testInfo) => {
    test.skip(treeId === 'REPLACE_ME', 'tree id not filled in')
    await page.goto(`/_spike/export-probe?tree=${treeId}`)
    // Wait for the family-chart SVG + at least one card to exist.
    await page.waitForSelector('svg.main_svg', { timeout: 30_000 })
    await page.waitForTimeout(2000) // settle layout + photo loads

    // Client path: click PNG, read the metric the probe stashed on window.
    await page.getByTestId('cap-png').click()
    const clientMetric = await page.waitForFunction(
      () => (window as unknown as { __spikeMetrics?: unknown[] }).__spikeMetrics?.at(-1),
      { timeout: 60_000 },
    )
    const client = await clientMetric.jsonValue()

    // "Server/headless" path proxy: full-page Playwright screenshot of the SVG.
    const t0 = Date.now()
    const svg = page.locator('svg.main_svg')
    const shot = await svg.screenshot({ timeout: 60_000 }).catch((e) => {
      return Buffer.from(`ERR:${e instanceof Error ? e.message : String(e)}`)
    })
    const headless = {
      ok: !shot.subarray(0, 4).toString().startsWith('ERR:'),
      bytes: shot.length,
      ms: Date.now() - t0,
    }

    const row = { size, browser: browserName, client, headless }
    writeFileSync(
      `scripts/spike-215/results/${browserName}-${size}.json`,
      JSON.stringify(row, null, 2),
    )
    console.log(JSON.stringify(row))
    expect(true).toBe(true) // the spec records data; it does not gate
  })
}
```

- [ ] **Step 3: Run the matrix**

Start the dev server in one shell (`pnpm dev`), then in another (node-24 PATH):
Run: `pnpm spike:capture`
Expected: per-browser-per-size JSON files appear under `scripts/spike-215/results/`. Some mobile/large combos may fail — that is data, not a blocker.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts scripts/spike-215/capture-runner.spec.ts scripts/spike-215/results
git commit -m "feat(#215): playwright capture matrix runner + results"
```

---

## Task 7: Analyse, fill the spec, compute the verdict

**Files:**
- Modify: `docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md`

- [ ] **Step 1: Assemble the results table**

From `scripts/spike-215/results/*.json` + the manual desktop spot-checks, build the §5 metrics table: rows = (size × browser × path), columns = ok / canvas dims vs ~16384 px / bytes / ms / visual defects.

- [ ] **Step 2: Apply the §6 decision rule**

Compute the verdict strictly per the spec table:
- Client clears the **100-floor** on Chrome+Safari+Firefox with correct visuals → **A-only**.
- Clears floor but breaks before 200 or on mobile → **A-now / B-later**.
- Fails the floor or has uncorrectable visual defects on a desktop target → **A+B (server required)**.

- [ ] **Step 3: Write the verdict + product note into the spec**

Append a `## 9. Results` and `## 10. Verdict` section to the spec doc: the filled table, the computed verdict with the evidence that triggered it, the explicit product-note recommendation on collapsing vs keeping the current-view/full-tree split, and any epic rescoping (e.g. "file server-export issue under #60", "#218 simplifies to single-mode").

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md
git commit -m "docs(#215): export-viability results + verdict"
```

---

## Task 8: Post the #215 decision comment + cleanup note

**Files:** none (GitHub + a cleanup checklist)

- [ ] **Step 1: Post the decision summary on #215**

Run (substitute the verdict + a 3-bullet evidence summary, link the spec):
```bash
gh issue comment 215 --repo SanchitB23/meetthefam --body "$(cat <<'EOF'
## Spike result — full-tree export viability

**Verdict:** <A-only | A-now/B-later | A+B>

<3–5 bullets: floor pass/fail per browser, the measured ceiling, mobile behaviour, key visual defects if any>

**Product note:** <collapse current-view/full-tree into one action? rescope of #218/#219? new server-export issue?>

Full table + methodology: `docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md`.
EOF
)"
```

- [ ] **Step 2: Record the cleanup contract**

The probe code is disposable. Before #218/#219 build the real feature, the following must be reverted/removed (note this in the #215 comment or the spec so it is not forgotten):
- `src/app/_spike/` (whole dir)
- the `/_spike` entry in `src/lib/public-routes.ts`
- `playwright.config.ts` + `scripts/spike-215/capture-runner.spec.ts` + `results/` (unless we keep Playwright for #218 E2E — decide then)
- the `spike:seed` / `spike:capture` package.json scripts
- Keep: `tree-shape.ts` + `synth-photo.ts` + the seed runner may be useful for #218/#219 manual testing — decide at epic time; not deleted by default.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin spike/215-full-tree-export-viability
```

- [ ] **Step 4: Open the spike PR (draft)** — optional, if a PR trail is wanted for the spike

```bash
gh pr create --draft --base qa --repo SanchitB23/meetthefam \
  --title "spike(#215): full-tree export viability" \
  --body "Closes #215"$'\n\n'"Spike — see docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md for methodology + verdict. Probe code is disposable (see cleanup contract in the spec)."
```
Follow `.github/pull_request_template.md` if the repo enforces it; pre-tick local gates, leave manual boxes for the human reviewer.

---

## Self-review notes

- **Spec coverage:** seed (§4) → Tasks 2–4; probe + both capture paths (§5) → Tasks 5–6; decision framework (§6) → Task 7; deliverables (§2) + DoD (§8) → Tasks 7–8. Tiered bar (§3) is the rule applied in Task 7 Step 2.
- **Photo-content limitation:** synth photos are solid colours (varied hue, distinct decode + distinct URLs) — they exercise taint/CORS/decode-count + canvas dims (the memory driver) but not JPEG-decode-cost variance. Acceptable for the ceiling question; noted as a limitation to carry into the spec results.
- **No production behaviour change** ships: the only non-spike file touched is `src/lib/public-routes.ts` (one line, reverted in cleanup).
- **Server-path fidelity:** Task 6's "headless screenshot" is a *proxy* for a real Vercel-function Playwright export, enough to compare reliability/size client-vs-headless; a true server-export build is out of scope and becomes a follow-up issue only if the verdict demands it.
