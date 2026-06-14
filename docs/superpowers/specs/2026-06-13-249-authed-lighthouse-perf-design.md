# Design — authed dashboard + tree pages: Lighthouse mobile Performance ≥ 90

> Issue: [#249](https://github.com/SanchitB23/meetthefam/issues/249) (sub-issue of epic [#86](https://github.com/SanchitB23/meetthefam/issues/86), box #9 of the pre-launch verification matrix).
> Milestone: v1.3 — Launch Readiness. Date: 2026-06-13.

## Problem

The two authenticated pages miss the box-#9 Lighthouse **mobile Performance ≥ 90** bar. Accessibility already passes everywhere.

| Page | Perf (baseline) | A11y (baseline) | Measured on |
|---|---|---|---|
| Landing `/` | 95 ✅ | 95 | real prod |
| Dashboard `/dashboard` | **84** ❌ | 95 | local prod build (authed) |
| Tree `/tree/[id]` (50p) | **80** ❌ | 92 | local prod build (authed) |

The miss is **LCP-dominated** (dashboard 4.3s, tree 4.9s) with high TTI. The LCP elements are text nodes, so the bottleneck is **JS execution / hydration under mobile CPU throttling**, not network — confirmed by real-prod field timing (TTFB ~60ms, fast infra). A CDN won't close it.

### Root causes (from code exploration)

- **Tree page** (`src/app/(app)/tree/[id]/`):
  - `FamilyTree.tsx:45` statically imports `family-chart` (+ its bundled d3) into the route's initial client chunk for every visitor — no `next/dynamic`, no `ssr:false`.
  - `page.tsx:42–63` runs **three serial Supabase round-trips** (`auth.getUser()` → `trees.select()` → `tree_members.select()`) before the Suspense skeleton renders.
  - The LCP `<h1>{tree.name}</h1>` (`TreeContent.tsx:164`) sits **inside** the `<Suspense>` boundary, so it paints only after all `TreeContent` queries resolve.
- **Dashboard** (`src/app/(app)/dashboard/`):
  - `page.tsx` does a serial `await createClient()` → `await auth.getUser()` gate before the Suspense skeleton, then a `tree_members`-join data query inside the boundary — two serial RTTs before tree cards paint. (Note: "Loading your trees…" in `loading.tsx:20` is an `sr-only` label, not a hang.)
- **Bundle/config** (`next.config.ts`): no `optimizePackageImports`; `jspdf` (^4) + `html-to-image` (^1.11) are heavy export-only deps that must not leak into the page chunk.
- **Touch targets** (`_lib/person-node-html.ts`): `.mtf-node__add-btn` is 28×28px and `mtf-node__duplicate-badge` 22×22px (below the 44px min). The `…` `[data-action-trigger]` is already 44×44.

## Goal / Definition of done

Both `/dashboard` and `/tree/[id]` reach **Performance ≥ 90** on a **local production build** (authed, mobile throttling), with **Accessibility staying ≥ 90**. Measure-driven and iterative: apply levers in priority order, re-measure after each, stop when both clear the bar.

Out of scope: real-prod authed Lighthouse (separate human step), architectural data-fetch rework, the 200-person worst case (box #6, already ticked).

### Hard constraint — no behavior regressions

Performance is the *only* thing changing; observable behavior must stay identical. Every lever is purely a delivery/timing optimization, not a functional change:
- Auth + permission gates (`redirect('/login')`, `notFound()` on missing tree / non-membership) must be byte-for-byte equivalent after the `Promise.all` refactor — the RLS-negative guarantee (box #5) must still hold.
- The tree renders the same chart with the same data, focus behavior, and interactions; the dashboard lists the same trees / empty state.
- `ssr:false` on `FamilyTree` must not change what the user sees (chart was already client-rendered behind a skeleton).
- Touch-target size bumps must not shift node layout or cause overlap/clipping.
- Each lever lands as its own commit so any single one can be reverted in isolation if it regresses.
- Verification (typecheck, lint, existing E2E happy paths, visual check at 375px) gates every commit — a green Lighthouse number that breaks a flow is a failure, not a pass.

## Approach (chosen: full lever set, measure-driven)

Levers in priority order. Each is small, independent, and revertible.

### Lever 1 — Lazy-load the family-chart bundle (tree page, biggest win)
In `TreeContent.tsx`, replace the static import of `FamilyTree` with:
```ts
const FamilyTree = dynamic(() => import('./FamilyTree'), {
  ssr: false,
  loading: () => <FamilyTreeSkeleton />, // matches the existing chart skeleton
})
```
Pulls `family-chart` + d3 out of the route's initial JS into a separate chunk loaded after hydration. Safe: `FamilyTree` is already `'use client'` and builds the chart imperatively in a `useEffect` (DOM-only), so `ssr:false` changes nothing functionally — first paint is the skeleton either way.

### Lever 2 — Lift the LCP `<h1>` above the Suspense boundary (tree page)
Extract a server `TreeHeader` (tree title + role-based action affordances) rendered in `page.tsx` **above** `<Suspense>`, using the `tree` row already fetched in the gate. `TreeContent` renders only the chart/body. The `<h1>` then streams with the shell and becomes a fast LCP instead of waiting on `TreeContent`'s queries.

### Lever 3 — Parallelize the serial Supabase round-trips
- Tree `page.tsx`: `const [{ data: { user } }, treeRes] = await Promise.all([supabase.auth.getUser(), trees.select(...)])`, then `tree_members` (needs `user.id`). 3 serial RTTs → 2. Preserve the existing `notFound()` / `redirect('/login')` gates exactly.
- Dashboard: run the trees data query in parallel with the auth check where the RLS gate still protects unauth access; if the dashboard remains short of 90 after Levers 1–3, read the session from the cookie instead of the network `getUser()` (middleware `proxy.ts` already gates `/dashboard`).

### Lever 4 — Touch targets (a11y, in scope)
`_lib/person-node-html.ts`: bump `.mtf-node__add-btn` 28→44px and `mtf-node__duplicate-badge` 22→44px; keep the inner SVG icon size and re-center. Visually confirm the larger hit areas don't overlap adjacent nodes in the chart layout.

### Lever 5 — Bundle hygiene
- Add `experimental.optimizePackageImports: ['lucide-react']` to `next.config.ts`.
- Verify `jspdf` + `html-to-image` are not in the tree/dashboard initial chunk (measure with a temporary `@next/bundle-analyzer`, dev-only); if present, dynamic-import them at the export trigger.

## Components touched

| File | Change | Purpose |
|---|---|---|
| `tree/[id]/_components/TreeContent.tsx` | `dynamic()` import of `FamilyTree`; render body only | Lever 1, 2 |
| `tree/[id]/_components/FamilyTree.tsx` | unchanged import internally; becomes a dynamic chunk | Lever 1 |
| `tree/[id]/_components/TreeHeader.tsx` (new) | server header with `<h1>` + actions | Lever 2 |
| `tree/[id]/page.tsx` | render `TreeHeader` above `<Suspense>`; `Promise.all` the fetches | Lever 2, 3 |
| `dashboard/page.tsx` (+ `_components`) | parallelize auth/data; optional modal lazy-load | Lever 3 |
| `tree/[id]/_lib/person-node-html.ts` | touch-target sizes | Lever 4 |
| `next.config.ts` | `optimizePackageImports` | Lever 5 |

## Error handling

- `dynamic(..., { ssr:false, loading })` provides the skeleton during chunk load; the existing `tree/[id]/error.tsx` boundary still catches render/data errors.
- Gates (`notFound()` on missing tree / non-membership, `redirect('/login')` when unauthenticated) must be byte-for-byte preserved through the `Promise.all` refactor — verified by re-reading the RLS negative path (box #5).

## Verification

- **Harness:** `pnpm build && pnpm start`; authenticate via magic-link/Mailpit; extract the session cookie with Playwright `storageState`; `npx lighthouse <url> --form-factor=mobile --only-categories=performance,accessibility --extra-headers=<cookie.json>`. Target the **50-person** tree (matches baseline).
- **Loop:** re-measure after each lever; iterate until both pages clear Performance ≥ 90 and A11y stays ≥ 90. Record before/after numbers on #249.
- **Gates before commit:** `pnpm typecheck`, `pnpm lint`, existing tree-render E2E happy path still green.
- **Regression check:** tree page still renders chart + header; dashboard still lists trees / shows empty state; touch targets visually non-overlapping at a 375px viewport.

## Workflow

Branch `perf/249-authed-lighthouse` (cut from `qa`), worktree under `meetthefam-worktrees/`. Draft PR with `Closes #249`, milestone v1.3. Conventional Commits (`perf:` / `fix:`).
