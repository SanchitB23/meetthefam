# Authed Lighthouse Performance ≥90 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the authed `/dashboard` and `/tree/[id]` pages to Lighthouse mobile **Performance ≥ 90** (A11y stays ≥ 90) on a local production build, without any behavior regression.

**Architecture:** Five independent, individually-revertible delivery/timing optimizations applied measure-driven (re-measure after each, stop when both pages clear 90): lazy-load the family-chart client bundle, lift LCP headers above Suspense, parallelize serial Supabase round-trips, bundle hygiene, and touch-target sizes. No functional/behavior change — purely *when/how* code is delivered.

**Tech Stack:** Next.js 16 (App Router, Turbopack, RSC + Suspense streaming), React 19.2, `@supabase/ssr`, `family-chart` 0.9 (D3), Lighthouse 12 CLI, Playwright (auth-cookie capture).

**Spec:** `docs/superpowers/specs/2026-06-13-249-authed-lighthouse-perf-design.md`

---

## Hard constraint (applies to EVERY task)

Behavior must stay identical — only performance changes. Before each commit:
- `pnpm typecheck` → 0 errors
- `pnpm lint` → 0 errors (run from the worktree; ignore any `.claude/worktrees/*` phantom paths)
- Auth/permission gates byte-for-byte equivalent: unauth → `redirect('/login')`; missing tree / non-member → `notFound()` (the box-#5 RLS-negative guarantee must still hold).
- Each lever = its own commit so it can be reverted in isolation.
- A green Lighthouse number that breaks a flow is a FAIL, not a pass.

## File structure

| File | Create / Modify | Responsibility |
|---|---|---|
| `src/app/(app)/tree/[id]/_components/FamilyTreeClient.tsx` | **Create** | `'use client'` boundary that `dynamic()`-imports `FamilyTree` with `ssr:false` + a skeleton fallback. Exists because `ssr:false` dynamic is illegal in a Server Component. |
| `src/app/(app)/tree/[id]/_components/TreeContent.tsx` | Modify | Import `FamilyTreeClient` instead of `FamilyTree`. |
| `src/app/(app)/tree/[id]/page.tsx` | Modify | Parallelize `auth.getUser()` + `trees` fetch; (conditional) lift `<h1>` above Suspense. |
| `src/app/(app)/dashboard/page.tsx` | Modify | Lift static "Your Trees" header above Suspense; pass it down. |
| `src/app/(app)/dashboard/_components/DashboardContent.tsx` | Modify | Render only the data-dependent grid (header moved up). |
| `src/app/(app)/tree/[id]/_lib/person-node-html.ts` | Modify | Touch-target sizes for `.mtf-node__add-btn` + `mtf-node__duplicate-badge`. |
| `next.config.ts` | Modify | `experimental.optimizePackageImports`. |

---

## Task 0: Worktree setup + baseline Lighthouse harness

**Files:** none (environment + measurement).

- [ ] **Step 1: Install deps in the worktree**

Run (from the worktree root):
```bash
pnpm install --prefer-offline
```
Expected: resolves from the global store quickly; no errors. (Per repo memory: each worktree gets its OWN install; do NOT symlink `node_modules`.)

- [ ] **Step 2: Symlink the Next types dir only (avoids a full type rebuild)**

```bash
mkdir -p .next/dev && ln -sfn ../../meetthefam/.next/dev/types .next/dev/types 2>/dev/null || true
```
(Best-effort; if it fails, the first `pnpm typecheck` will regenerate types.)

- [ ] **Step 3: Baseline typecheck + lint (clean starting point)**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors. If anything fails here it is pre-existing — STOP and report.

- [ ] **Step 4: Confirm local Supabase is up + seed state**

Run: `pnpm exec supabase status`
Expected: API on `:54321`, Mailpit on `:54324`. There is a seeded `export-stress@example.com` owner with trees including a 50-person "Export Stress 50". If absent, note it — the loop needs a ≥1-tree authed account.

- [ ] **Step 5: Write the reusable Lighthouse harness script**

Create `scripts/lh-authed.mjs` (worktree-local, NOT committed — it logs in + writes a cookie). It: (a) builds is assumed already done by caller, (b) magic-link-logs-in `export-stress@example.com` via Mailpit, (c) extracts the `sb-127-auth-token` cookie via Playwright `storageState`, (d) runs Lighthouse mobile on `/dashboard` + the 50-person `/tree/<id>` with `--extra-headers`, (e) prints Perf + A11y per page. (Reference flow already validated in the session that authored #249; reuse the Mailpit API `GET /api/v1/messages` → magic link → Playwright `storageState({path})` → `npx lighthouse <url> --form-factor=mobile --only-categories=performance,accessibility --extra-headers=<file>`.)

- [ ] **Step 6: Capture the baseline**

Run: `pnpm build && pnpm start &` then the harness against both pages.
Expected (matches #249): Dashboard ≈ **84 / 95**, Tree(50p) ≈ **80 / 92**. Record exact numbers in a scratch note — these are the before-values for the #249 report.

- [ ] **Step 7: Commit the harness ignore (not the script)**

Add `scripts/lh-authed.mjs` and `/tmp` cookie artifacts to `.gitignore` if not already ignored. The cookie file and harness contain a session token — never commit them.
```bash
git add .gitignore && git commit -m "chore: gitignore local Lighthouse-auth harness artifacts"
```

---

## Task 1: Lever 1 — lazy-load the family-chart bundle (biggest tree win)

**Files:**
- Create: `src/app/(app)/tree/[id]/_components/FamilyTreeClient.tsx`
- Modify: `src/app/(app)/tree/[id]/_components/TreeContent.tsx:3` (import) and `:197-201` (usage)

- [ ] **Step 1: Create the client lazy-boundary**

`FamilyTree` is a named export and `ssr:false` dynamic is illegal in a Server Component, so wrap it in a `'use client'` module:

```tsx
// src/app/(app)/tree/[id]/_components/FamilyTreeClient.tsx
'use client'

import dynamic from 'next/dynamic'
import type { PersonRow } from '../_lib/types'

// family-chart (+ its bundled d3) is the heaviest client chunk on this route.
// Loading it via next/dynamic with ssr:false keeps it out of the initial JS:
// the chart is already DOM-only (imperative f3.createChart in a useEffect),
// so deferring to post-hydration changes nothing the user sees — first paint
// is the skeleton either way. ssr:false REQUIRES a client boundary (this file).
const FamilyTreeLazy = dynamic(
  () => import('./FamilyTree').then((m) => m.FamilyTree),
  {
    ssr: false,
    loading: () => (
      <div
        className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/40 h-[60vh] mtf-skeleton"
        aria-busy="true"
        aria-label="Loading family tree…"
      />
    ),
  },
)

type Props = {
  treeId: string
  people: PersonRow[]
  initialFocusId: string | null
}

export function FamilyTreeClient(props: Props) {
  return <FamilyTreeLazy {...props} />
}
```

(The skeleton mirrors the canvas placeholder in `loading.tsx:28` for visual continuity.)

- [ ] **Step 2: Swap the import in TreeContent**

In `TreeContent.tsx`, change line 3 from:
```ts
import { FamilyTree } from './FamilyTree'
```
to:
```ts
import { FamilyTreeClient } from './FamilyTreeClient'
```
And the usage (lines 197-201) from `<FamilyTree ... />` to `<FamilyTreeClient ... />` (identical props):
```tsx
<FamilyTreeClient
  treeId={tree.id}
  people={people}
  initialFocusId={initialFocusId}
/>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Build + re-measure tree page**

Run: `pnpm build && pnpm start` then the harness on the 50p tree.
Expected: Tree Performance **rises** vs the 80 baseline (family-chart no longer in the initial chunk). Record the number.

- [ ] **Step 5: Regression check**

Manually (or via the existing tree E2E happy path) confirm: tree still renders the chart, focus/`?p=` seeding works, FAB + node interactions work, the skeleton shows briefly then the chart appears. Run: `pnpm test` for the tree render spec if one exists.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/tree/[id]/_components/FamilyTreeClient.tsx src/app/(app)/tree/[id]/_components/TreeContent.tsx
git commit -m "perf: lazy-load family-chart bundle off the tree route's initial chunk

Wraps FamilyTree in a client next/dynamic boundary (ssr:false) so
family-chart + its bundled d3 load after hydration behind a skeleton
instead of blocking TTI/LCP. Chart is DOM-only; no behavior change.

Refs #249"
```

---

## Task 2: Lever 5 — bundle hygiene (low risk, measure the export libs)

**Files:** Modify `next.config.ts:3-24`

- [ ] **Step 1: Add optimizePackageImports**

In `next.config.ts`, add an `experimental` block to the config object:
```ts
const nextConfig: NextConfig = {
  experimental: {
    // lucide-react ships per-icon entry points; this makes Next 16's compiler
    // tree-shake it reliably across the app. Zero behavior change.
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    // …unchanged…
  },
};
```

- [ ] **Step 2: Measure whether jspdf / html-to-image leak into the page chunk**

Temporarily add the analyzer (do NOT commit it):
```bash
pnpm add -D @next/bundle-analyzer
ANALYZE=true pnpm build   # after wrapping config with withBundleAnalyzer guarded by process.env.ANALYZE
```
Inspect the `/tree/[id]` client bundle. `jspdf` (^4) and `html-to-image` (^1.11) are export-only (reached through `useExportTrigger` in `FamilyTree.tsx:69`).
- If they are NOT in the initial tree chunk (likely, now that FamilyTree is lazy) → no action; note it.
- If they ARE → dynamic-import them inside the export trigger handler (`_lib/useExportTrigger.ts`) so they load only when the user starts an export.

- [ ] **Step 3: Remove the analyzer + typecheck/lint**

```bash
pnpm remove @next/bundle-analyzer
# revert any temporary withBundleAnalyzer wrapper
pnpm typecheck && pnpm lint
```
Expected: 0 errors; `next.config.ts` contains only the `optimizePackageImports` addition.

- [ ] **Step 4: Build + re-measure both pages**

Run the harness. Record numbers (expect a small TTI improvement).

- [ ] **Step 5: Commit**

```bash
git add next.config.ts   # + useExportTrigger.ts only if Step 2 required the dynamic import
git commit -m "perf: optimizePackageImports for lucide-react (+ defer export libs if leaking)

Refs #249"
```

---

## Task 3: Lever 3a — parallelize the tree page's serial Supabase round-trips

**Files:** Modify `src/app/(app)/tree/[id]/page.tsx:39-66`

- [ ] **Step 1: Parallelize getUser + trees fetch**

The `trees` select is gated by RLS (session cookie), not by `user.id`, so it can run concurrently with `auth.getUser()`. `tree_members` needs `user.id`, so it stays after. Replace lines 39-66:

```ts
  const supabase = await createClient()

  // getUser() (auth validation) and the trees read are independent — the
  // trees RLS is enforced by the session cookie, not user.id — so run them
  // concurrently. tree_members still needs user.id, so it follows. 3 serial
  // round-trips → 2. Gates below are byte-for-byte unchanged.
  const [
    {
      data: { user },
    },
    { data: tree },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('trees')
      .select('id, name, description, share_token')
      .eq('id', id)
      .maybeSingle<TreeRow>(),
  ])

  if (!user) redirect('/login')
  if (!tree) notFound()

  const { data: myMembership } = await supabase
    .from('tree_members')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: 'owner' | 'editor' }>()

  if (!myMembership) notFound()

  const currentUserRole = myMembership.role
```

Note the gate ORDER is preserved (`!user` redirect first, then `!tree` notFound, then `!myMembership` notFound) — only the fetch timing changed.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint` → 0 errors.

- [ ] **Step 3: Regression — verify gates still fire correctly**

Re-run the box-#5 RLS-negative check (fresh authed non-member): hitting `/tree/<foreign-uuid>` must still `notFound()` (not leak). Unauth → `/login`. (Reuse the REST proof from #249's verification, or a quick manual walk.)
Expected: 404 for foreign/guessed UUIDs; redirect when logged out.

- [ ] **Step 4: Build + re-measure tree**

Run the harness on the 50p tree. Record.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/tree/[id]/page.tsx
git commit -m "perf: parallelize tree page auth + trees fetch (3 serial RTTs -> 2)

Promise.all the independent getUser() and trees read; tree_members
follows (needs user.id). Auth/notFound gates preserved in order.

Refs #249"
```

---

## Task 4: Lever 3b — dashboard: lift the static header above Suspense

**Files:** Modify `src/app/(app)/dashboard/page.tsx:22-26` and `DashboardContent.tsx:45-53`

The dashboard header (`<h1>Your Trees` + `CreateTreeModal`) is data-independent, so it can render in the page shell immediately while the tree-cards query streams — improving LCP/perceived load with zero data dependency.

- [ ] **Step 1: Render the header in page.tsx, above Suspense**

Replace `page.tsx` lines 22-26:
```tsx
  return (
    <main className="px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-foreground flex items-center gap-2">
          <Leaf size={22} className="text-primary" />
          Your Trees
        </h1>
        <CreateTreeModal />
      </div>
      <Suspense fallback={<DashboardListSkeleton />}>
        <DashboardContent userId={user.id} />
      </Suspense>
    </main>
  )
```
Add imports at the top of `page.tsx`:
```ts
import { Leaf } from '@/components/icons/Leaf'
import { CreateTreeModal } from './_components/CreateTreeModal'
import { DashboardListSkeleton } from './_components/DashboardListSkeleton'
```

- [ ] **Step 2: Trim DashboardContent to just the data-dependent grid**

In `DashboardContent.tsx`, remove the outer `<main>` + header (lines 45-53 the `<div className="flex items-center justify-between mb-6">…</div>`), returning only the conditional grid/empty-state fragment. Remove now-unused imports (`Leaf`, `CreateTreeModal`). Keep the `tree_members` query unchanged.

```tsx
  return trees.length === 0 ? (
    <div className="text-center py-16 text-foreground/50">
      <p className="font-serif text-xl mb-2">No trees yet</p>
      <p className="text-sm">Create your first family tree to get started.</p>
    </div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trees.map((m) => (
        <TreeCard
          key={m.trees.id}
          tree={m.trees}
          role={m.role}
          actions={m.role === 'owner' ? <TreeCardMenu tree={m.trees} baseUrl={baseUrl} /> : null}
        />
      ))}
    </div>
  )
```

- [ ] **Step 3: Create the list skeleton (replaces the old full-page DashboardLoading body for the streamed slot)**

Create `src/app/(app)/dashboard/_components/DashboardListSkeleton.tsx`:
```tsx
export function DashboardListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading your trees…">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 rounded-lg mtf-skeleton" />
      ))}
    </div>
  )
}
```
(Keep `dashboard/loading.tsx` as-is — it's the route-level fallback for the initial navigation; this new skeleton is the inner Suspense fallback for just the grid.)

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint` → 0 errors.

- [ ] **Step 5: Build + re-measure dashboard**

Run the harness. If Performance still < 90, apply the optional sub-step below; else skip to commit.

- [ ] **Step 5b (optional, only if dashboard < 90): drop the pre-Suspense auth network hop**

`proxy.ts` already gates `/dashboard` (unauth → redirect). The in-page `await supabase.auth.getUser()` adds a network RTT before the shell. Replace with `supabase.auth.getClaims()` (reads/validates the JWT from the cookie without a Supabase round-trip) to get `user.id` for the query. Verify the unauth redirect still works (middleware covers it; keep a defensive `if (!claims) redirect('/login')`). Re-measure.

- [ ] **Step 6: Regression check**

Dashboard lists the same trees / shows the empty state; "New tree" modal opens; header renders immediately. Confirm no layout shift between skeleton and loaded grid.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx src/app/(app)/dashboard/_components/DashboardContent.tsx src/app/(app)/dashboard/_components/DashboardListSkeleton.tsx
git commit -m "perf: stream dashboard header above Suspense; defer only the tree grid

Static 'Your Trees' header now paints with the shell instead of after
the tree_members query. (Optionally) reads session claims from cookie to
drop the pre-shell auth RTT. No behavior change.

Refs #249"
```

---

## Task 5: Lever 4 — touch-target sizes (a11y, best-effort)

**Files:** Modify `src/app/(app)/tree/[id]/_lib/person-node-html.ts:307-309` and `:357-358`

> Note: A11y already scores ≥ 90 (92/95), so this is a real-mobile-usability improvement, not required to pass the gate. Lighthouse's "Tap targets" audit also fails on insufficient *spacing* between dense nodes, which size alone may not fully resolve — bump the obviously-undersized controls and re-check; do NOT change chart node density/zoom (out of scope).

- [ ] **Step 1: Bump the duplicate-badge (22 → 28px, keeps it tucked in the corner without overlapping the avatar)**

In `person-node-html.ts`, the `mtf-node__duplicate-badge` style (lines 309-310): change `width:22px; height:22px;` to `width:28px; height:28px;` and adjust the offset so it still hugs the corner: `top:-8px; left:-8px;` (was `-6px`). Keep `font-size:12px`.

- [ ] **Step 2: Bump the add-relative "+" button (28 → 36px)**

The `.mtf-node__add-btn` style (lines 357-358): change `width:28px; height:28px;` to `width:36px; height:36px;`, keep the inner 14×14 SVG (still centered by `display:flex`). Adjust offset `bottom:-12px; right:-12px;` (was `-10px`) so the larger circle still sits on the card corner without covering content. (36px clears WCAG 2.5.8's 24px minimum with margin while staying visually proportionate to the node card; 44px was judged too large for the node corner.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint` → 0 errors.

- [ ] **Step 4: Visual regression at mobile viewport**

Build + load the 50p tree at 375×667. Confirm: the "+" and "↑" buttons are larger, still anchored to their card corners, and do NOT overlap adjacent node cards or the avatar/name. Re-run the harness; note the A11y number (must stay ≥ 90) and whether the tap-targets audit improved.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/tree/[id]/_lib/person-node-html.ts
git commit -m "fix(a11y): enlarge family-chart node tap targets (+ / duplicate-jump)

add-btn 28->36px, duplicate-badge 22->28px, offsets adjusted so the
larger hit areas stay on the card corner without overlap.

Refs #249"
```

---

## Task 6: Lever 2 (CONDITIONAL) — lift the tree LCP `<h1>` above Suspense

> Only do this if, after Tasks 1-5, the **tree** page Performance is still < 90. It is the riskiest change because the tree header row also holds `ExportTreeButton` (gated on `people.length`) and `TreeSettingsSheet` (needs members/invites) — both data-dependent — so only the back-arrow + `<h1>` can move up; the actions must keep streaming.

**Files:** Modify `src/app/(app)/tree/[id]/page.tsx` and `TreeContent.tsx`; Create `TreeHeader.tsx`.

- [ ] **Step 1: Create a server TreeHeader with the immediately-available bits**

```tsx
// src/app/(app)/tree/[id]/_components/TreeHeader.tsx
import { ArrowLeft } from 'lucide-react'
import { LinkProgress } from '@/components/ui/LinkProgress'

// Renders the parts of the tree header that depend ONLY on the gate-fetched
// `tree` row, so the LCP <h1> streams with the shell. The data-dependent
// actions (Export, Settings) render inside TreeContent and slot into `actions`.
export function TreeHeader({ name, actions }: { name: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6 max-w-4xl mx-auto">
      <LinkProgress
        href="/dashboard"
        aria-label="Back to dashboard"
        className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </LinkProgress>
      <h1 className="font-serif text-3xl text-foreground leading-tight flex-1 min-w-0 truncate">
        {name}
      </h1>
      {actions}
    </div>
  )
}
```

- [ ] **Step 2: Render the header in page.tsx above Suspense; keep actions streaming**

In `page.tsx`, wrap the return so the header (with the title) is outside `<Suspense>`, and the actions + body stream inside. Pass a render-prop / slot: the simplest no-regression shape is to render `<TreeHeader name={tree.name} actions={<Suspense fallback={<HeaderActionsSkeleton/>}><TreeHeaderActions .../></Suspense>} />` above the body Suspense. Extract `TreeHeaderActions` (Export + Settings) from `TreeContent` into its own async server component fed by the same queries. **If this split proves to materially change the queries or layout, STOP and reassess — the LCP win is not worth a regression.**

- [ ] **Step 3: Remove the header block from TreeContent**

`TreeContent` returns the `<main>` with only the people/empty-state body (header now lives in page shell). Adjust the `<main>` so spacing matches the prior layout (the header `mb-6` now lives in `TreeHeader`).

- [ ] **Step 4: Typecheck + lint + full regression**

`pnpm typecheck && pnpm lint`; verify the page looks pixel-identical (header position, actions appear once data streams), gates intact, chart renders.

- [ ] **Step 5: Build + re-measure tree**

Confirm tree Performance ≥ 90. If the split caused any layout shift or regression and the number isn't worth it, **revert this commit** (the prior tasks stand).

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/tree/[id]/_components/TreeHeader.tsx src/app/(app)/tree/[id]/page.tsx src/app/(app)/tree/[id]/_components/TreeContent.tsx
git commit -m "perf: stream tree title (LCP <h1>) with the shell above Suspense

Refs #249"
```

---

## Task 7: Final verification + PR

- [ ] **Step 1: Full clean re-measure**

`pnpm build && pnpm start`, run the harness on BOTH pages. Confirm Dashboard ≥ 90 Perf, Tree ≥ 90 Perf, both A11y ≥ 90. Record final before/after table.

- [ ] **Step 2: Full gate sweep**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. Run the 3 Playwright happy-path E2E flows if available (`pnpm test:e2e` or equivalent) — tree render, dashboard, share-link — to prove no regression.

- [ ] **Step 3: Push + open draft PR**

```bash
git push -u origin perf/249-authed-lighthouse
gh pr create --draft --base qa --title "perf: authed dashboard + tree Lighthouse mobile Performance >=90 (#249)" --body-file <PR body following .github/pull_request_template.md, with the before/after Lighthouse table, Closes #249, milestone v1.3>
```
Follow the repo PR template end-to-end (pre-tick local gates, leave manual-checklist boxes for the human). Open as DRAFT; the user marks ready.

- [ ] **Step 4: Update #249**

Comment on #249 with the final before/after numbers and which levers landed (and whether Lever 2 was needed). Do NOT tick #86 box #9 — the human ticks after their review (and ideally a real-prod confirmation).
