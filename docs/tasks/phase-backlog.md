# Phase backlog

Per-phase TODOs that don't belong in the spec's "Done when…" gate but must be picked up at the right phase. Loaded by the active phase's session — keep it short, link out for detail.

For Next.js 16 idiom rationale, see [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md). For the spec phase rows, see [`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing."

---

## Standing rules

Not phase-specific TODOs — discipline reminders for every session. These never get a `[x]` because they apply to all new code that crosses the relevant boundary.

- **`await cookies()` and `await headers()`** in every server-side `@supabase/ssr` client. In Next.js 16, `cookies()` and `headers()` from `next/headers` are async — every new Supabase server client must `await` them when wiring the cookie adapter. Pull the current snippet via Context7 MCP (`/supabase/supabase`) before writing one from memory; older guides have the synchronous form. Current code is in compliance (audit `src/lib/supabase/server.ts`, `src/app/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/proxy.ts`).

---

## Phase 0 — Foundation (close-out)

- [x] **Wire Vercel Analytics + Speed Insights** — `@vercel/analytics@2` + `@vercel/speed-insights@2` installed; `<Analytics />` and `<SpeedInsights />` mounted inside `<body>` in [`src/app/layout.tsx`](../../src/app/layout.tsx). Both packages are zero-config on Vercel and capture data from first deploy. Verify in the Vercel dashboard → Analytics tab after the next deploy.
- [x] **Drop `--turbopack` flag** from `package.json` scripts — Turbopack is the default in Next.js 16; the flag is a no-op. *(never added — landed clean in `34d1aa4`)*
- [x] **Add `engines.node`** to `package.json` (`>=24.15.0` matching `.nvmrc`). *(landed in `34d1aa4`)*
- [x] **Add Next.js Devtools MCP** to project `.mcp.json` once `pnpm dev` is wired — see [Next.js MCP docs](https://nextjs.org/docs/app/guides/mcp). Bumps Tier 1 MCPs from 4 → 5; update [`CLAUDE.md`](../../CLAUDE.md) and [`docs/setup/mcp-servers.md`](../setup/mcp-servers.md) when added. *(landed in `f107e7b`)*
- [x] **Palette refinement to match Kintree** (per [ADR 0008](../adrs/0008-design-system.md)) — `globals.css` migrated to two-tone + 5 TONES CSS vars. *(landed in `472df7b`)*
- [x] **Sub-task 3 follow-up — `.gitignore`**: `supabase/seed.local.sql` added to root `.gitignore` so the maintainer's personal-tree seed never gets committed (see [ADR 0008](../adrs/0008-design-system.md) → "Seed data"). *(landing in the sub-task 3 commit)*
- [x] **Sub-task 4 follow-up — Smith Family Demo seed**: ship `supabase/seed.sql` with the [`docs/ux/inspiration/kintree/project/data.jsx`](../ux/inspiration/kintree/project/data.jsx) shape (sanitized Smith / Anderson, 4 generations, 13 people). Production: do NOT run this seed (`supabase/seed.sql` is local-only by Supabase convention). *(landed in sub-task 4 commit)*
- [x] **Sub-task 4 follow-up — `tone` column + trigger**: add the `tone` column on `people` per [`../architecture/data-model.md`](../architecture/data-model.md) and a `BEFORE INSERT` trigger that auto-assigns via `hash(full_name) % 5` when null. See [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md) for the algorithm. *(landed in sub-task 4 commit, uses `abs(hashtext(full_name)) % 5`)*

## Phase 1 — Auth

- [x] **Use `proxy.ts`, not `middleware.ts`**, for the auth boundary. Export `proxy`, run on Node runtime. See [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md) → "Auth boundary." *(landed in sub-task 2, commit `3f1cee8` — lives at `src/proxy.ts` per Next.js 16 location convention)*
- [x] Add Supabase magic-link + Google OAuth callback as a Route Handler at `/auth/callback/route.ts` — single PKCE `exchangeCodeForSession` path serves both providers.
- [x] Protect `/dashboard`, `/tree/*` via `proxy.ts` matcher; explicitly skip `/share/[token]`. *(landed in sub-task 2, commit `3f1cee8` — `/tree/*` is covered by the matcher once the route lands)*

> The `await cookies()` / `await headers()` discipline has moved to the **Standing rules** section at the top of this file — it's an ongoing rule, not a one-shot.

## Phase 2 — Tree CRUD + dashboard

- [ ] **`PageProps<'/dashboard'>`** type helper on the dashboard page; `await props.searchParams` if we add a sort/filter query string.
- [ ] On tree create / rename / delete Server Actions, call `updateTag('user-trees:<userId>')` for read-your-writes on the dashboard list.
- [ ] **Mobile pattern (per [ADR 0008](../adrs/0008-design-system.md))** — dashboard at mobile breakpoint uses stacked card grid (1-col), desktop uses multi-col. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screen "Dashboard". **Defer the bespoke bottom-tab-bar decision here** — try top-nav-only first; only build the tab bar if mobile feels cramped after Phase 3.

## Phase 3 — People CRUD + linking

- [ ] **`PageProps<'/tree/[id]'>`** on the tree page; `await props.params` to read `id`.
- [ ] On every people-mutation Server Action (add / edit / delete person, link spouse, set parent, add child), call `updateTag('tree:<treeId>')`. Avoid `revalidatePath` — `updateTag` gives read-your-writes without re-rendering unaffected segments.
- [ ] Cycle-detection + spouse-symmetry edge cases per [`../architecture/data-model.md`](../architecture/data-model.md) → "Edge cases."
- [ ] **Build `<Avatar>` component** at `src/components/ui/avatar.tsx` per [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md). Photo-fallback to tinted-circle initials in Cormorant Garamond. Source shape: [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Avatar`.
- [ ] **Tone override UI** — person-edit form exposes a 5-swatch tone picker; defaults to the auto-assigned value from the DB trigger.
- [ ] **Mobile pattern** — add-relative + edit-person forms render in a bottom-sheet (`<Sheet side="bottom">` from shadcn) on mobile, side-drawer on desktop. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screen "Add Relative".

## Phase 4 — Tree visualization

- [ ] **`PageProps<'/tree/[id]'>`** carries focus-person hash via `searchParams` → `await`.
- [ ] **(Defer-or-promote decision)** **React 19.2 [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition)** for tree-navigation animations when re-centering on a tapped node. Lightweight wrapper around the family-chart re-render. Decision point: if family-chart's built-in animation is acceptable, defer to Phase 8 polish; otherwise adopt here. Track via a quick spike at start of Phase 4.
- [ ] Memoize the family-chart wrapper component manually (defer React Compiler).
- [ ] **PersonNode go/no-go spike (per [ADR 0008](../adrs/0008-design-system.md))** — verify family-chart's [custom-node API](https://github.com/donatso/family-chart) supports HTML nodes at fixed dimensions (~158×110 px) without breaking auto-layout. Pull current API via Context7 (`/donatso/family-chart`). **Decision**: if API supports cleanly → render the prototype's PersonNode pattern (round tinted avatar + serif name + uppercase role + dates + floating terracotta "+"). Source: [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `PersonNode`. **If API fights us** → fallback: keep family-chart's default rectangular nodes, apply our `--tone-*-bg` CSS vars + `--font-serif` to its built-in name field. Document the outcome in a new ADR before continuing.
- [ ] **Floating "+" hover affordance** wires to the same Server Action used by Phase 3's add-relative form (don't duplicate the create logic).
- [ ] **Mobile pattern** — full-screen tree canvas on mobile with a single FAB ("Add person") in the bottom-right; tree nodes are tappable to open the profile bottom-sheet from Phase 3. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screens "Tree" + "Mobile variants".

## Phase 5 — Photo upload

- [ ] On upload Server Action, call `refresh()` to update the avatar without busting cached tree shells. See [`../architecture/photo-upload.md`](../architecture/photo-upload.md) → "End-to-end flow."
- [ ] Set `images.remotePatterns`, `images.qualities: [75]`, `images.minimumCacheTTL: 14400` in `next.config.ts`. See `photo-upload.md` → "next/image config."
- [ ] Test: upload a photo, verify the avatar URL updates without a full page reload.

## Phase 6 — Collaboration

- [ ] On invite-accept / role-change / revoke Server Actions, call `updateTag('tree:<treeId>')` AND `updateTag('user-trees:<invitedUserId>')`.
- [ ] No `middleware.ts` workarounds for permission checks — RLS + the existing `proxy.ts` auth gate are sufficient.

## Phase 7 — Share link

- [ ] On share-token toggle / regenerate, call `updateTag('share:<treeId>')` so the dashboard's "share status" reflects immediately.
- [ ] `/share/[token]/route.ts` is a Route Handler using `service_role`. Read `params.token` via `await context.params` (Next.js 16 async).
- [ ] **(Optional)** If we cache the public share-tree response, use `revalidateTag('share:<treeId>', 'max')` with the explicit `cacheLife` profile (the single-arg form is deprecated in v16). Default: don't cache yet — re-evaluate at v1.0 ship.

## Phase 8 — Visual polish + landing

- [ ] **React 19.2 `<ViewTransition>`** for cross-page animations — landing → dashboard, dashboard → tree page. Keep transitions snappy (≤200ms). Reference: [React docs](https://react.dev/reference/react/ViewTransition).
- [ ] If tree navigation animations weren't done in Phase 4, do them here.
- [ ] **(Optional)** Try `useEffectEvent` for any "non-reactive" effect logic (theme listeners, focus trapping in the bottom sheet) — only if existing code is awkward.
- [ ] **Brand icon set (per [ADR 0008](../adrs/0008-design-system.md) → Hybrid icon set)** — extract `Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart` SVG paths from [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Icon` and re-implement as React components at `src/components/icons/` (one component per icon). Lucide stays for everything else.
- [ ] **Decorative motifs** — branch-SVG section dividers between major page sections (landing especially), leaf icons in section headings, sparkle icon for "new" indicators. Reference: [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Branch` component.
- [ ] **Italic Cormorant whitelist enforcement (per [ADR 0008](../adrs/0008-design-system.md))** — italic only on: landing-hero kicker, section taglines, empty-state hero copy, share-link footer pull-quotes, person-bio nicknames. Audit all copy after Phase 8 components land; flag any italic Cormorant outside the whitelist.
- [ ] **Replace create-next-app `src/app/page.tsx`** with the actual landing screen, modeled on the Kintree landing screen in the original prototype bundle (not vendored — see [`../ux/inspiration/README.md`](../ux/inspiration/README.md) for re-fetch URL).
- [ ] **Empty / loading / error states per screen** — apply heirloom palette + Cormorant for hero copy.

## Phase 9 — QA + edge cases + launch

- [ ] **(Optional)** Evaluate `cacheComponents: true` for the share-link page and any landing page — only if perf data justifies it. Default: don't enable.
- [ ] **(Optional)** Evaluate `reactCompiler: true` if profiler shows wasted renders. Default: don't enable.
- [ ] Verify no `--turbopack` flags lurking in `package.json` (cleanup if any survived).
- [ ] Verify Next.js Devtools MCP still works against the production deployment (or document that it's dev-only).
