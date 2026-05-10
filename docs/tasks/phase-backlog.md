# Phase backlog

Per-phase TODOs that don't belong in the spec's "Done when…" gate but must be picked up at the right phase. Loaded by the active phase's session — keep it short, link out for detail.

For Next.js 16 idiom rationale, see [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md). For the spec phase rows, see [`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing."

---

## Phase 0 — Foundation (close-out)

- [ ] **Drop `--turbopack` flag** from `package.json` scripts — Turbopack is the default in Next.js 16; the flag is a no-op. Per the [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
- [ ] **Add `engines.node`** to `package.json` (`>=24.15.0` matching `.nvmrc`).
- [ ] **Add Next.js Devtools MCP** to project `.mcp.json` once `pnpm dev` is wired — see [Next.js MCP docs](https://nextjs.org/docs/app/guides/mcp). Bumps Tier 1 MCPs from 4 → 5; update [`CLAUDE.md`](../../CLAUDE.md) and [`docs/setup/mcp-servers.md`](../setup/mcp-servers.md) when added.
- [ ] **Set `images.remotePatterns`** in `next.config.ts` for `*.supabase.co/storage/v1/object/public/photos/**` (deferred to Phase 5 if cleaner).

## Phase 1 — Auth

- [ ] **Use `proxy.ts`, not `middleware.ts`**, for the auth boundary. Export `proxy`, run on Node runtime. See [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md) → "Auth boundary."
- [ ] **`await cookies()` and `await headers()`** in every server-side `@supabase/ssr` client. Pull the snippet via Context7 MCP — do not copy from older guides.
- [ ] Add Supabase magic-link + Google OAuth callback as a Route Handler at `/auth/callback/route.ts`.
- [ ] Protect `/dashboard`, `/tree/*` via `proxy.ts` matcher; explicitly skip `/share/[token]`.

## Phase 2 — Tree CRUD + dashboard

- [ ] **`PageProps<'/dashboard'>`** type helper on the dashboard page; `await props.searchParams` if we add a sort/filter query string.
- [ ] On tree create / rename / delete Server Actions, call `updateTag('user-trees:<userId>')` for read-your-writes on the dashboard list.

## Phase 3 — People CRUD + linking

- [ ] **`PageProps<'/tree/[id]'>`** on the tree page; `await props.params` to read `id`.
- [ ] On every people-mutation Server Action (add / edit / delete person, link spouse, set parent, add child), call `updateTag('tree:<treeId>')`. Avoid `revalidatePath` — `updateTag` gives read-your-writes without re-rendering unaffected segments.
- [ ] Cycle-detection + spouse-symmetry edge cases per [`../architecture/data-model.md`](../architecture/data-model.md) → "Edge cases."

## Phase 4 — Tree visualization

- [ ] **`PageProps<'/tree/[id]'>`** carries focus-person hash via `searchParams` → `await`.
- [ ] **(Defer-or-promote decision)** **React 19.2 [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition)** for tree-navigation animations when re-centering on a tapped node. Lightweight wrapper around the family-chart re-render. Decision point: if family-chart's built-in animation is acceptable, defer to Phase 8 polish; otherwise adopt here. Track via a quick spike at start of Phase 4.
- [ ] Memoize the family-chart wrapper component manually (defer React Compiler).

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

## Phase 9 — QA + edge cases + launch

- [ ] **(Optional)** Evaluate `cacheComponents: true` for the share-link page and any landing page — only if perf data justifies it. Default: don't enable.
- [ ] **(Optional)** Evaluate `reactCompiler: true` if profiler shows wasted renders. Default: don't enable.
- [ ] Verify no `--turbopack` flags lurking in `package.json` (cleanup if any survived).
- [ ] Verify Next.js Devtools MCP still works against the production deployment (or document that it's dev-only).
