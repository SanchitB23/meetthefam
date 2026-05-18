# Phase 8 — Bundle 8c (Landing + nav + animations) execution plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Companion to the canonical plan** [`2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md) — that file has the code-level walkthroughs for all 14 Phase 8 sub-tasks. This file is a focused session-execution overlay for Bundle 8c only, structured the same way the 8b overlay was ([`2026-05-17-phase-8b-execution.md`](./2026-05-17-phase-8b-execution.md)).

**Goal:** Land Bundle 8c (7 sub-tasks: route group, landing screen, skeletons, Suspense, `<ViewTransition>`, copy audit, app-version footer) on the existing `feat/phase-8-visual-polish-landing` branch, ticking each sub-task in the running draft PR #55, ending with the 8c-done milestone smoke. Then run the phase close-out + the `v0.4.0` release recipe (ADR 0009 Amendment 4 — first consumer of the build-time-derived version + no `pnpm version` step).

**Architecture:** Five separable concerns, sequenced so each builds on a clean foundation:

1. **Move the authenticated chrome into a route group.** All authed surfaces (`dashboard`, `tree/[id]`, `invite/[token]`) currently sit at the app-root level, each with its own ad-hoc top-nav (only `dashboard/layout.tsx` actually exists today; `tree/[id]` has no nav at all). Collapse into a single `src/app/(app)/layout.tsx` with the top-nav + Sign Out and move the route files under it. Public surfaces (`page.tsx` landing, `login`, `auth`, `share/[token]`) stay at root with no chrome.
2. **Replace the Next.js boilerplate landing page** (`src/app/page.tsx` is still the "To get started, edit page.tsx" default) with a real heirloom-journal landing screen — hero + features + footer + sign-in CTA — that redirects authed users to `/dashboard`.
3. **Loading + Suspense + LinkProgress** for perceived performance: heirloom-palette skeletons in `loading.tsx` files; explicit `<Suspense>` boundaries around server-data fetches; a thin top progress bar driven by React 19.2's `useLinkStatus()` so cross-page nav has hot feedback.
4. **`<ViewTransition>` (React 19.2)** scoped per-link on the landing CTA and dashboard tree-card links — smooth element morph during the cross-page nav.
5. **Copy + housekeeping** (revoke-member explanatory line, italic-Cormorant whitelist audit, `<VersionFooter>` consuming the already-derived `APP_VERSION`).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19.2 (`<ViewTransition>` + `useLinkStatus()`), Tailwind v4, lucide-react 1.x, Vitest.

---

## Context

Phase 8 is in its final bundle. Bundle 8a (4 sub-tasks + polish) and Bundle 8b (3 sub-tasks + 5 polish/fix/chore commits) have landed on `feat/phase-8-visual-polish-landing`. As of the start of this session: HEAD `97cc53b` (8b deceased treatment strengthened), 195/195 tests pass, typecheck clean, lint baseline unchanged (14 pre-existing PersonForm `react-hooks/incompatible-library` warnings).

**Why a new plan instead of just executing the canonical one?** The canonical plan at [`./2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md) (3237 lines, written 2026-05-16) is the source of truth for code-level detail — every code block, test, and commit message draft below defers to it. The 8c section starts at line 1880.

**Ground-truth recon (run 2026-05-18 against HEAD `97cc53b`):**

1. **No `(app)` route group exists yet.** All authed routes sit at `src/app/{dashboard, tree, invite}` directly. `dashboard/layout.tsx` carries the ONLY top-nav in the app today (Logo + "meetthefam" wordmark + Sign Out); `tree/[id]` and `invite/[token]` have no nav at all. The 8c-1 move WILL add chrome to those routes for the first time.
2. **`src/app/page.tsx` is still the Next.js boilerplate** — literal "To get started, edit the page.tsx file" placeholder. Greenfield replacement; nothing to preserve.
3. **`dashboard/loading.tsx` + `tree/[id]/loading.tsx` already exist** but with placeholder content (a generic shadcn Skeleton import was sketched in earlier phases). 8c-3 rewrites them in the heirloom palette.
4. **`scripts/derive-version.mjs` + `src/lib/generated/version.ts` already exist** (landed in v0.3.x per ADR 0009 Amendment 4). The infrastructure for 8c-7 is in place — 8c-7 just needs to create `<VersionFooter>` and mount it in `src/app/layout.tsx`.
5. **`src/app/tree/[id]/_components/MembersSheet.tsx` exists** — 8c-6 adds an inline explanatory line above the revoke-member confirm button.

Branch, PR, and milestone-smoke posture for this session:

- **Scope:** Bundle 8c only (8c-1 → 8c-2 → 8c-3 → 8c-4 → 8c-5 → 8c-6 → 8c-7 → 8c-done milestone smoke) + Phase 8 close-out + `v0.4.0` release recipe.
- **Commit cadence:** Per-commit approval prompts are suspended for this session — same posture the user established mid-8b. Implementer subagents draft the commit + diff summary; the controller stages and commits without explicit approval prompts. The user batch-reviews via the QA preview walk after each sub-task push.
- **8c-done smoke:** Dispatched in background via `e2e-smoke-tester` against the QA Vercel preview (now unblocked via `d8b382f`'s protection-bypass infra). Playwright MCP at-runtime is still a known blocker — the smoke agent runs whatever curl-verifiable + static-asset gates it can and reports PARTIAL PASS if interactive flows still SKIP.

---

## Canonical references — load these in every implementer dispatch

- **Plan source of truth:** [`./2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md). 8c sub-task line ranges:
  - 8c-1 — `1880 – 2092`
  - 8c-2 — `2092 – 2284`
  - 8c-3 — `2284 – 2398`
  - 8c-4 — `2398 – 2606`
  - 8c-5 — `2606 – 2728`
  - 8c-6 — `2728 – 2810`
  - 8c-7 — `2810 – 2983`
  - Milestone 8c-done — `2983 – 3017`
  - Phase close-out + release — `3017 – 3237`
- **Brand decisions:** [`../../architecture/brand-decisions.md`](../../architecture/brand-decisions.md).
- **Plan-time resolved decisions** (canonical plan lines 113-128) — key items for 8c:
  - #5: 8c-1 dashboard chrome moves UP to `(app)/layout.tsx` (collapse the dashboard-specific layer).
  - #6: 8c-5 `<ViewTransition>` scope is **per-link** (CTA + tree cards), not root.
  - #7: 8c-7 `<VersionFooter>` mounts in **`src/app/layout.tsx`** (global). Position `fixed bottom-2 right-3`, `pointer-events:none`, `opacity:0.4`.
- **Conventions:** [`../../../CLAUDE.md`](../../../CLAUDE.md) + [`../../../AGENTS.md`](../../../AGENTS.md).
- **ADR 0009 Amendment 4** (build-time version derivation): [`../../adrs/0009-versioning-and-releases.md`](../../adrs/0009-versioning-and-releases.md) — 8c-7 is the first UI consumer; v0.4.0 is the first release exercising the no-`pnpm version` recipe.

---

## Pre-flight: verify starting state

- [ ] **Step 0.1: Confirm branch + working tree.**

```bash
git fetch origin feat/phase-8-visual-polish-landing
git status                  # expect: clean (the 8b execution plan landed in a docs commit alongside this one, or it can ride along)
git log --oneline -3        # expect HEAD: 97cc53b chore(phase-8): strengthen deceased card treatment so it reads at a glance
git rev-parse --abbrev-ref HEAD   # expect: feat/phase-8-visual-polish-landing
```

If not clean or wrong branch — STOP and surface to the user.

- [ ] **Step 0.2: Confirm baseline gates.**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: typecheck clean, 14 pre-existing PersonForm warnings (unchanged), `195 / 195` tests pass.

If baseline drift — STOP, diagnose, surface to the user.

---

## Sub-task 8c-1: Shared `(app)` route group

**Canonical reference:** plan lines **1880 – 2092**.

**Risk:** highest in the bundle. The move touches every authed route's path + the proxy matcher. Test the SSR seed + share-link route after the move.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 1880-2092 + read the existing files that will move: `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/SignOutButton.tsx`, `src/app/dashboard/actions.ts`, `src/app/dashboard/loading.tsx`, `src/app/dashboard/_components/*`, `src/app/tree/[id]/page.tsx`, `src/app/tree/[id]/loading.tsx`, `src/app/invite/[token]/page.tsx`, `src/proxy.ts`.

Implementation notes:

1. Create `src/app/(app)/layout.tsx` — port the contents of `src/app/dashboard/layout.tsx` (Logo + "meetthefam" wordmark + Sign Out top-nav). Apply 8a brand tokens (`bg-background`, `border-border`, `font-serif`). Add a `min-h-screen flex flex-col` so the children area grows to fill viewport (matters for the upcoming `<VersionFooter>` in 8c-7).
2. Move `SignOutButton.tsx` → `src/app/(app)/_components/SignOutButton.tsx`. Move `actions.ts` (signOut action) → `src/app/(app)/_actions/signOut.ts`. Update the layout's import.
3. Move route trees:
   - `src/app/dashboard/*` → `src/app/(app)/dashboard/*` (preserves `page.tsx`, `loading.tsx`, `_components/`, etc.)
   - `src/app/tree/[id]/*` → `src/app/(app)/tree/[id]/*`
   - `src/app/invite/[token]/*` → `src/app/(app)/invite/[token]/*`
   - Delete the now-empty `src/app/dashboard/layout.tsx` (chrome moved UP per decision #5).
4. **`src/proxy.ts` matcher**: route groups are transparent to URLs (e.g. `/(app)/dashboard` URL stays `/dashboard`), so the existing matcher patterns SHOULD still work. Verify by re-reading the proxy + running through the matcher patterns. If any explicit path-prefix logic in `proxy.ts` references `/dashboard`, `/tree`, `/invite` — those are unchanged (group folders never appear in URLs).
5. **Imports**: any cross-route import like `import { signOut } from '@/app/dashboard/actions'` needs updating to `@/app/(app)/_actions/signOut`. Grep for `from.*dashboard|from.*tree\/\[id\]|from.*invite\/\[token\]` across `src/` and update each hit. Tests in `src/__tests__/` likely don't import from these paths but verify.
6. **Public surfaces** (`page.tsx` landing, `login`, `auth/*`, `share/[token]`) stay at the root level — no chrome (they have their own layouts or none).

- [ ] **Step 2: Run gates.**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: clean. If route-group transparency holds, no test changes needed.

- [ ] **Step 3: Browser walk** — `pnpm dev`. Confirm:
  - `/dashboard` still loads with top-nav (no double chrome).
  - `/tree/<id>` now ALSO shows the top-nav (didn't before — this is the new behavior).
  - `/invite/<token>` shows top-nav.
  - `/` still shows the Next.js boilerplate (will be replaced in 8c-2).
  - `/login` is chrome-free (it has its own layout or none).
  - `/share/<token>` is chrome-free (no top-nav — read-only public view).

- [ ] **Step 4: Spec compliance + code quality reviews** (parallel subagent dispatches, same pattern as 8b sub-tasks). Code quality specifically: verify `proxy.ts` is uncchanged (or minimally changed); no broken imports remain (`grep` for the old `@/app/dashboard/actions` etc.).

- [ ] **Step 5: Commit + push** (no per-commit approval prompt). Tick `current-phase.md` + `phase-backlog.md` in the same commit per the standing rule. Stage explicit files (no `git add -A` — there will be deletions to be careful with).

Commit message draft (canonical plan lines ~2080).

- [ ] **Step 6: Tick PR #55's checklist** (8c-1 row, link to the new SHA).

---

## Sub-task 8c-2: Real landing screen + authed redirect

**Canonical reference:** plan lines **2092 – 2284**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2092-2284. Read `src/app/page.tsx` (still the Next.js boilerplate — wholly replaced). Read `src/proxy.ts` for the existing authed-redirect pattern.

Implementation notes:

1. **`src/app/page.tsx`** — server component. First reads the Supabase user from `cookies()`; if authed, `redirect('/dashboard')` (Next.js 16 `redirect()`). If not authed, renders the public landing.
2. **`src/components/landing/LandingHero.tsx`** — Cormorant Garamond italic-kicker heading (e.g. "Family · history, gathered with care.") + a body paragraph + primary CTA "Sign in" (links to `/login`). Use `Sparkle` (lucide) accent in the kicker per the brand decisions doc.
3. **`src/components/landing/LandingFeatures.tsx`** — 3-column feature grid (mobile: stacked). Each card has a Lucide icon (`Branch`, `Leaf`, `Heart` from the 8a-4 icon set), a serif heading, and a one-line description. Heirloom palette throughout.
4. **`src/components/landing/LandingFooter.tsx`** — slim footer with sign-in CTA + the 8c-7 `<VersionFooter>` mounted later (8c-7 mounts the version footer GLOBALLY via `src/app/layout.tsx` per decision #7, but if the landing wants an inline anchor link to the version that's fine — coordinate with 8c-7).
5. **Italic-Cormorant whitelist**: only headings, italic-kicker accents, and the "in memoriam" Memoriam glyph use italic Cormorant. Body copy is Manrope. Reference `docs/architecture/brand-decisions.md`.

- [ ] **Step 2: Run gates.** Expect clean. No new tests required.

- [ ] **Step 3: Browser walk** — confirm `/` shows the landing when logged out, and redirects to `/dashboard` when logged in. Sign-in CTA hits `/login`.

- [ ] **Step 4: Reviews.**

- [ ] **Step 5: Commit + push + PR tick.**

---

## Sub-task 8c-3: Heirloom palette pass on empty / loading / error states

**Canonical reference:** plan lines **2284 – 2398**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2284-2398. Read existing `src/app/(app)/dashboard/loading.tsx` + `src/app/(app)/tree/[id]/loading.tsx` (post-8c-1 paths). Implement heirloom-palette skeleton blocks using shadcn `Skeleton` primitive with `bg-foreground/[0.05]` shimmer or `animate-pulse` Tailwind utility.

Implementation notes:

1. **Dashboard loading**: skeleton row of tree-card placeholders (rounded, soft cream), matching the dashboard's grid layout.
2. **Tree loading**: a centered placeholder block (~50% viewport) with a soft pulse animating the avatar circle + name line + date line.
3. **Empty states** (also tick this sub-task): if `dashboard/page.tsx` has an empty-state branch ("No trees yet — create one"), align it with the heirloom palette + a single CTA button using brand tokens.
4. **Error states**: if `error.tsx` files exist or get added, use the heirloom palette + a Lucide `AlertTriangle` icon styled in `--muted-foreground`.

- [ ] **Step 2-5**: gates → reviews → commit + push + PR tick.

---

## Sub-task 8c-4: `<Suspense>` boundaries + `useLinkStatus()` progress indicators

**Canonical reference:** plan lines **2398 – 2606**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2398-2606. Also context-fetch from `mcp__context7__query-docs` for React 19.2's `useLinkStatus()` (`/facebook/react`, version 19.2) and Next.js `<Link>` + Suspense interactions (`/vercel/next.js` 16+).

Implementation notes:

1. **`src/components/ui/LinkProgress.tsx`** — client component. Uses `useLinkStatus()` (from `next/link`, React 19.2 path) to know whether a navigation triggered by an enclosing `<Link>` is pending. Renders a thin (2-3px) progress bar fixed at `top:0; left:0; right:0` with a smooth scale-x animation from 0 → 0.7 over the duration of the navigation. Color: `--primary` at 60% opacity. The component returns `null` when no nav is pending.
2. **`<Suspense>` wrappers**: in `src/app/(app)/dashboard/page.tsx` and `src/app/(app)/tree/[id]/page.tsx`, wrap the data-fetching server components in `<Suspense fallback={<DashboardLoading />} />` / `<Suspense fallback={<TreeLoading />} />` so the page shell renders immediately while data streams in. The corresponding `loading.tsx` files (8c-3 above) serve as the route-level fallback; explicit `<Suspense>` boundaries serve as the in-page granularity.
3. **`LinkProgress` mount**: inside `src/app/(app)/layout.tsx` (so it's available on every authed route's nav transitions) and inside the landing screen's CTA wrapper if it links to `/login`. Mount as the first child of the layout so it pins to the very top.

- [ ] **Step 2: Tests.** Vitest unit test for `LinkProgress` mounting + un-mounting based on a mocked `useLinkStatus()` return value (use `vi.mock` on `next/link`'s `useLinkStatus`). 2-3 tests is enough.

- [ ] **Step 3-6**: gates → browser walk → reviews → commit + push + PR tick.

---

## Sub-task 8c-5: React 19.2 `<ViewTransition>` for cross-page animations

**Canonical reference:** plan lines **2606 – 2728**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2606-2728. Context7-fetch React 19.2 `<ViewTransition>` docs (`/facebook/react` 19.2).

Implementation notes per decision #6 (per-link scope, not root):

1. **Landing CTA**: wrap the `<Link href="/login">` (or wherever sign-in goes) in `<ViewTransition>` so the morph from landing → login feels intentional.
2. **Dashboard tree cards**: wrap each `<Link href="/tree/<id>">` in `<ViewTransition>` so clicking a tree card morphs the card into the centered avatar on the tree page. Pair with `viewTransitionName` CSS on the avatar in `personNodeHtml` to allow same-element morphing (this is the "transition name" mechanic).
3. **Fallback**: if `<ViewTransition>` not supported (older browsers), the wrapper degrades to a regular `<Link>` — no error.
4. **Don't wrap the whole app root** — per decision #6, root-level wrapping is deferred.

- [ ] **Step 2-5**: gates → browser walk (test in Chrome which has full ViewTransition support; Safari support is improving) → reviews → commit + push + PR tick.

---

## Sub-task 8c-6: Revoke-member confirm copy + italic-Cormorant audit

**Canonical reference:** plan lines **2728 – 2810**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2728-2810. Read `src/app/(app)/tree/[id]/_components/MembersSheet.tsx`.

Implementation notes:

1. **MembersSheet copy**: add an inline `<p>` near the Confirm button: "Revoking access removes <name> from this tree. They keep no copy of the data and will need a new invite to return." Use `text-sm text-muted-foreground`.
2. **Italic-Cormorant whitelist audit**: grep the codebase for `font-serif` + `italic` together and verify each instance is one of: (a) Memoriam glyph, (b) a heading with intentional italic accent, (c) a person's nickname display. Anything else is incidental and should be removed. Document the audit result inline in `docs/adrs/0008-design-system.md` (append a 2-sentence note if any deviations stood).
3. **Bonus copy pass** (canonical plan calls for): scan visible UI strings for any remaining Phase 4-era boilerplate ("Add a person", default placeholders) — replace with copy that matches the heirloom voice from 8a-1 brand decisions.

- [ ] **Step 2-5**: gates → reviews → commit + push + PR tick.

---

## Sub-task 8c-7: `APP_VERSION` footer micro-version

**Canonical reference:** plan lines **2810 – 2983**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 2810-2983. Read `scripts/derive-version.mjs` + `src/lib/generated/version.ts` (both already exist). Read `src/app/layout.tsx`.

Implementation notes:

1. **`src/components/ui/VersionFooter.tsx`** — client component (no — actually can be a server component since `APP_VERSION` is build-time-resolved, no runtime hook needed). Imports `APP_VERSION` from `@/lib/generated/version`. Returns a small `<footer>` positioned `fixed bottom-2 right-3` per decision #7, with `font-mono text-[11px] text-muted-foreground opacity-40 pointer-events-none select-none`. Renders the version string verbatim.
2. **Mount in `src/app/layout.tsx`** — outside the `<body>` content flow but inside the body so it's truly global. The `pointer-events:none` means it never blocks clicks on the FAB on `/tree/[id]` (the FAB sits at `bottom-6 right-6`, so they don't collide either way).
3. **Snapshot test**: `src/__tests__/components/VersionFooter.test.tsx` — render the component with the 4 version-string format cases from the derive script (tagged, rc, dev with tag, dev without tag) and snapshot them. Mock `APP_VERSION` via `vi.mock('@/lib/generated/version', () => ({ APP_VERSION: 'X.Y.Z' }))` etc.

- [ ] **Step 2-5**: gates → browser walk (confirm the footer renders on every authed + public page, doesn't block the FAB) → reviews → commit + push + PR tick.

---

## Milestone 8c-done — full Phase 8 smoke (background dispatch)

**Canonical reference:** plan lines **2983 – 3017**.

- [ ] **Step 1: Append `phase-8c-full` smoke flow to [`../../qa/smoke-flows.md`](../../qa/smoke-flows.md).** Steps cover: landing → sign-in → dashboard → tree → recenter → add-relative → version-footer visible everywhere.

- [ ] **Step 2: Dispatch `e2e-smoke-tester` IN BACKGROUND.**

```
Agent({
  description: "Phase 8c-done full smoke",
  subagent_type: "e2e-smoke-tester",
  prompt: "Run the full Phase 8 smoke against the QA preview using VERCEL_PROTECTION_BYPASS for SSO unblock (the env-var pattern is documented in docs/qa/smoke-flows.md). Run flows: phase-3, phase-4, phase-5, phase-6, phase-7-share-link, phase-8a, phase-8b-tree-polish, phase-8c-full. Report PASS / FAIL / SKIPPED per flow. Playwright MCP at runtime may still be BLOCKED — report partial-pass on curl-verifiable gates and call out interactive SKIPs explicitly.",
  run_in_background: true
})
```

The controller continues without waiting. When the agent returns, surface the verdict.

---

## Phase close-out posture

**Canonical reference:** plan lines **3017 – ~3100**.

- [ ] **Step 1: Flip `docs/tasks/current-phase.md` to "Phase 8 — DONE".** Mark all 14 Phase 8 sub-tasks ticked, append the 8c bundle completion note, link the v0.4.0 release recipe section below.
- [ ] **Step 2: Mirror in `docs/tasks/phase-backlog.md`.** All Phase 8 backlog entries that were carriers for this phase get final dispositions (ticked or explicitly deferred with reason).
- [ ] **Step 3: Add a new `docs/tasks/current-phase.md` stub for Phase 9** — the next planning surface. (Phase 9 is "Collaboration polish + last-mile launch prep" per `phase-backlog.md`.)

- [ ] **Step 4: Un-draft PR #55.** `gh pr ready 55`. The PR body should already have all 14 sub-task rows ticked. Add a final "Ready for review" comment summarizing the bundle counts and pointing reviewers at the QA preview URL.

---

## `v0.4.0` release recipe (ADR 0009 Amendment 4 — first consumer)

**Canonical reference:** plan lines **~3100 – 3237**.

This is the FIRST release exercising ADR 0009 Amendment 4 (no `pnpm version`, build-time-derived version, release-branch → main merge commit, fast-forward push back to qa).

- [ ] **Step 1: Squash-merge PR #55 into qa.** `gh pr merge 55 --squash`. Capture the resulting qa-HEAD SHA.
- [ ] **Step 2: Cut release branch from qa.** `git checkout qa && git pull && git checkout -b release/v0.4.0`.
- [ ] **Step 3: Zero-unique-commit release branch.** No edits, no `pnpm version`, no manual version bumps. The release branch is identical to qa at this moment — that's the point of Amendment 4.
- [ ] **Step 4: Open release PR into main.** `gh pr create --base main --head release/v0.4.0 --title "release: v0.4.0" --body "..."`. The PR body summarizes Phase 8 (link to the 14 sub-task ladder on PR #55).
- [ ] **Step 5: Merge release PR with "Create a merge commit"** (NOT squash, NOT ff-only). This produces a real merge commit on main that the GitHub release auto-tags.
- [ ] **Step 6: Create the GitHub release.** `gh release create v0.4.0 --target main --title "v0.4.0 — Visual polish + landing" --notes-file <changelog>`. The build-time `derive-version.mjs` reads the tag at the next prod build and emits `APP_VERSION = "0.4.0"`.
- [ ] **Step 7: Fast-forward push release branch into qa.** `git push origin release/v0.4.0:qa`. Returns the merge commit to qa so qa keeps tracking main's history (no forward-PR needed).
- [ ] **Step 8: Verify QA + prod previews report `APP_VERSION = "0.4.0"`** in the `<VersionFooter>`. Pre-prod key rotation (see memory `project_pre_prod_key_rotation`) is NOT required for v0.4.0 — that's the v1.0 gate.

---

## Verification — how to confirm 8c (and Phase 8 overall) is shippable

End-to-end checks before un-drafting PR #55:

1. **Gates clean at every commit**: `pnpm typecheck && pnpm lint && pnpm test --run` reports clean and `≥ 195 + new test count` tests passing on every commit on `feat/phase-8-visual-polish-landing`.
2. **Visual walk against the QA Vercel preview** (matrix):
   - **Landing** (`/` while logged out): heirloom hero + features + footer renders; "Sign in" CTA goes to `/login`.
   - **Authed redirect**: `/` while logged in instantly redirects to `/dashboard`.
   - **Route-group chrome**: `/dashboard`, `/tree/<id>`, `/invite/<token>` all show the top-nav (Logo + Sign Out). Public surfaces (`/`, `/login`, `/share/<token>`) show NO chrome.
   - **Loading shimmer**: a hard-refresh on `/dashboard` (after clearing the SSR cache, or in cold-start) flashes the heirloom skeleton before content paints.
   - **LinkProgress bar**: clicking a tree card on `/dashboard` shows the thin top progress bar during navigation; disappears after the new page paints.
   - **ViewTransition**: in Chrome, clicking a tree card produces a morph animation (avatar grows; surrounding card fades). In Safari (no ViewTransition support yet), the nav is instant — no error.
   - **Revoke-member copy**: `/tree/<id>` → Members sheet → click revoke on a member → the explanatory line is visible above the Confirm button.
   - **VersionFooter**: tiny version string visible at `bottom-2 right-3` on every route. Doesn't block the FAB.
3. **PR #55 progress checklist** — all 14 Phase 8 sub-tasks ticked.
4. **Background 8c-done smoke** — reported (PASS or PARTIAL_PASS with documented reason).

---

## Self-review notes

Walked the canonical plan's "Ship gate" bullets in [`../../tasks/current-phase.md`](../../tasks/current-phase.md) against this overlay:

- ✅ Shared `(app)` route group with proper chrome separation — 8c-1
- ✅ Real landing screen replacing Next.js boilerplate, authed-redirect to /dashboard — 8c-2
- ✅ Heirloom-palette skeletons on loading / empty / error — 8c-3
- ✅ `<Suspense>` + `useLinkStatus()` for hot perceived perf — 8c-4
- ✅ Per-link `<ViewTransition>` on CTA + tree cards — 8c-5
- ✅ Revoke-member explanatory copy + italic-Cormorant audit — 8c-6
- ✅ Global `<VersionFooter>` consuming `APP_VERSION` from the derive script — 8c-7
- ✅ Phase close-out flips `current-phase.md` + un-drafts PR #55
- ✅ `v0.4.0` release recipe is the first ADR 0009 Amendment 4 consumer (no `pnpm version`)

Placeholder scan: no "TBD" / "implement later" / "similar to Task N" — every sub-task points at canonical plan line ranges. No corrections vs canonical needed for 8c (the ground-truth recon confirmed all assumed files exist or are greenfield as documented).

No spec-gap detected.

---

## How to use this doc in a fresh chat

1. Open a new Claude Code session in the meetthefam repo root.
2. Paste this prompt verbatim:

> Resume Phase 8 Bundle 8c execution per [`docs/superpowers/plans/2026-05-18-phase-8c-execution.md`](docs/superpowers/plans/2026-05-18-phase-8c-execution.md). The canonical 14-sub-task plan is at [`docs/superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md`](docs/superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md). The 8b execution overlay (for context on the same shape) is at [`docs/superpowers/plans/2026-05-17-phase-8b-execution.md`](docs/superpowers/plans/2026-05-17-phase-8b-execution.md). Begin with the Pre-flight checks (Step 0.1 + 0.2). Per-commit approval prompts suspended this bundle (user batch-reviews via QA preview walk). Use the `superpowers:subagent-driven-development` skill for per-sub-task implementer + reviewer dispatches.
