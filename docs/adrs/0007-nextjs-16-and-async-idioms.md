# ADR 0007 — Next.js 16 baseline + async idioms

**Status:** Accepted
**Date:** 2026-05-10

## Context

The project spec (drafted Phase −1) named "Next.js 15" as the framework version. By the time Phase 0 began, `pnpm create next-app@latest` scaffolded **Next.js 16.2.6** (released 2025-10-21). Next.js 16 ships several backwards-incompatible idiom changes — async dynamic APIs, `proxy.ts` over `middleware.ts`, new caching primitives — that cascade into how every page, route handler, and server action in this codebase will be written.

Two questions to settle:

1. Which version do we baseline on?
2. Which v16 idioms do we adopt now, which do we defer, and where should each one show up?

## Decision

### 1. Baseline on Next.js 16

We adopt **Next.js 16.x** as the framework baseline. The architecture (App Router, Server Components, Server Actions, RSC, RLS via `@supabase/ssr`) maps unchanged from 15 to 16 — none of our locked decisions break. Pinning to 15 would mean a forced upgrade later for no gain.

### 2. Adopt these v16 idioms from day one

| Idiom | Adopt where |
|---|---|
| **Async `params` / `searchParams`** in pages and `generateMetadata` (must `await props.params`) | Every dynamic route — `/tree/[id]`, `/share/[token]`, etc. |
| **Async `cookies()` / `headers()` / `draftMode()`** from `next/headers` (must `await`) | Every server-side `@supabase/ssr` client |
| **`proxy.ts`** for the auth boundary (replaces `middleware.ts`; runs on Node runtime) | Phase 1 auth gate |
| **`updateTag(tag)`** in Server Actions for read-your-writes after mutations | Phase 3 (people CRUD), Phase 6 (collaboration), Phase 7 (share toggle) |
| **`refresh()`** in Server Actions to refresh uncached data without busting cache shells | Phase 3 (people edits), Phase 5 (photo upload), Phase 7 (share state) |
| **`PageProps<'/route/[param]'>`** type helper for type-safe route params | All route components |
| **`revalidateTag(tag, profile)`** with explicit `cacheLife` profile (single-arg form deprecated) | Only if we introduce SWR caching — deferred to v1.0 |
| **Turbopack** as the default bundler (no `--turbopack` flag — drop it from `package.json` scripts; the flag is a no-op in v16) | Phase 0 close-out |
| **Explicit `images.qualities`, `images.minimumCacheTTL`, `images.remotePatterns`** | Phase 5 (photo upload) |

### 3. Defer until post-v0.1

| Feature | Why deferred |
|---|---|
| **Cache Components** (`cacheComponents: true` + `"use cache"` directive) | New programming model. Wait until our perf data shows real opportunities. v0.1 tree-fetch is one query — not cache-bound. |
| **React Compiler** (`reactCompiler: true`) | Adds Babel to the pipeline (compile slowdown). Manual memoization on the family-chart wrapper is sufficient at our scale. |
| **View Transitions** for tree navigation animations | Phase 8 visual-polish opportunity, not a v0.1 requirement |
| **Turbopack File System Caching** (`experimental.turbopackFileSystemCacheForDev`) | Beta, marginal benefit on a small repo |
| **Build Adapters API** | Alpha; we deploy to Vercel which doesn't need a custom adapter |

### 4. Adopt the Next.js Devtools MCP

Next.js 16 ships an official MCP server (`/docs/app/guides/mcp`) that exposes routing/caching/render context to AI agents. Add it to project `.mcp.json` as a Tier 1 MCP at Phase 0 close-out — it earns its keep the moment we have routes to debug.

## Consequences

- **Every server-side Supabase client must `await cookies()`.** This is the largest-blast-radius change. Any code copy-pasted from a 15-era Supabase guide will type-check but silently break at runtime — Context7 MCP must be the source of truth for the snippet.
- **`proxy.ts` is a one-time naming change.** No behavioral implication beyond the export name.
- **`updateTag()` over `revalidatePath()` for mutations** — gives us read-your-writes for free without invalidating the entire tree page on every edit. Cheaper at runtime, simpler mental model. Pair with `refresh()` when only uncached data needs to update (e.g. photo URLs).
- **Type inference improves.** `PageProps<'/tree/[id]'>` carries the route param shape — fewer manual `{ id: string }` annotations, fewer drift bugs when route shapes change.
- **The default Turbopack experience is faster** — 2–5× build, up to 10× Fast Refresh per the release notes. We pay for it with one footgun: existing `--turbopack` flags in `package.json` scripts are now no-ops (drop them).

## Alternatives considered

- **Pin to Next.js 15** — re-scaffold with `pnpm create next-app@15`. Rejected: 15 is now N-1 LTS thinking; codemod path off it later is the same async-idiom rewrite we'd do today, just with extra risk built up.
- **Adopt Cache Components + React Compiler now** — both are stable in v16 but add complexity to a 0-traffic v0.1 product. Rejected as premature.
- **Stay on `middleware.ts`** — still works in v16 but deprecated. Rejected — adopting `proxy.ts` now avoids a rename later.

## References

- [Next.js 16 release notes](https://nextjs.org/blog/next-16)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Cache Components docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Next.js Devtools MCP docs](https://nextjs.org/docs/app/guides/mcp)
