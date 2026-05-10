# Architecture overview

## System shape

```
[Vercel: Next.js 16 App Router]
        │
        ├── React Server Components            (read paths)
        ├── Server Actions                     (write paths)
        ├── Route Handlers                     (auth callback, /share/[token])
        │
        └── Supabase
              ├─ Postgres                      (people, trees, memberships)
              ├─ Auth                          (magic link + Google OAuth)
              ├─ Storage                       (photo bucket: trees/<tree_id>/people/<person_id>/avatar.jpg)
              └─ Row-Level Security policies   (multi-tenancy enforcement)
```

**No separate backend.** All server logic lives in Next.js Server Actions and Route Handlers. No microservices, no Go service, no separate Node API.

## Data flow — `/tree/[id]` page (the core experience)

1. User navigates to `/tree/[id]`. Next.js renders a Server Component.
2. Server Component reads the Supabase session from the request cookie via `@supabase/ssr`.
3. Server Component runs two SELECTs (RLS-checked automatically):
   - `SELECT * FROM trees WHERE id = $1`
   - `SELECT * FROM people WHERE tree_id = $1`
4. Server transforms `people` rows into [donatso/family-chart](https://github.com/donatso/family-chart)'s expected shape — adding a `children: [...]` array per person, computed from `father_id` / `mother_id`.
5. The transformed data passes as a prop to the `<FamilyTree>` Client Component (`'use client'`), which calls `f3.createChart(...)` to render.
6. **Edits** invoke Server Actions. After a successful mutation, `revalidatePath('/tree/[id]')` triggers a re-fetch; the Client Component diffs and re-renders.

## Data flow — `/share/[token]` page (read-only, no auth)

1. User opens `/share/<random-token>` — no session required.
2. A Route Handler runs server-side using the **`service_role`** Supabase key (server-only env var).
3. Handler looks up `SELECT * FROM trees WHERE share_token = $1` (RLS bypassed by service_role).
4. If found, fetches its people rows, transforms, and renders `<FamilyTree>` in read-only mode.
5. Banner: "You're viewing a shared family tree. [Create your own]."

The 256-bit random `share_token` is the credential — no auth check beyond "does this token match a row?"

## Tech inventory

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 App Router (Turbopack default) | Server Components + Server Actions remove the need for a separate backend. See [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md) |
| Hosting | Vercel | Tight Next.js integration, free Hobby tier |
| DB | Supabase Postgres | Relational shape fits tree data; RLS for multi-tenancy |
| Auth | Supabase Auth | Magic link + Google OAuth out of the box |
| Object storage | Supabase Storage | Single vendor, signed-URL-free public reads |
| UI components | shadcn/ui (`base-nova` / Base UI) on Tailwind v4 | Customizable, no vendor SDK; Base UI primitives (not Radix) per shadcn 3.x default |
| Form library | react-hook-form | Industry standard for this scope |
| Tree visualization | family-chart (D3, MIT) | Best mobile UX for focus-person navigation |
| Tests | Vitest + Playwright | Vitest for server / RLS, Playwright for E2E |

## Next.js 16 idioms we follow

Captured from the [Next.js 16 release notes](https://nextjs.org/blog/next-16) and the [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16). Full rationale + adopt/defer table in [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md).

| Idiom | Where it shows up |
|---|---|
| **Async `params` / `searchParams`** — `await props.params` in pages and `generateMetadata` | `/tree/[id]/page.tsx`, `/share/[token]/route.ts`, `/dashboard/page.tsx` |
| **Async `cookies()` / `headers()`** from `next/headers` — must be `await`ed | Every server-side Supabase client created with `@supabase/ssr` |
| **`proxy.ts`** (not `middleware.ts`) for the auth boundary — runs on Node runtime | The auth gate landing in Phase 1 — see [`auth-and-rls.md`](auth-and-rls.md) |
| **`updateTag(tag)`** in Server Actions — read-your-writes after mutations | Add / edit / delete person, link spouse, add child, rename tree |
| **`refresh()`** in Server Actions — refresh uncached data without touching the cache | After photo upload, after toggling share-link on/off |
| **`revalidateTag(tag, profile)`** with explicit `cacheLife` profile | If we ever introduce SWR-style cached reads of public share trees (deferred to v1.0) |
| **`PageProps<'/route/[param]'>`** type helper for type-safe params | All route components |

**Deferred until post-v0.1:** Cache Components (`"use cache"` + `cacheComponents: true`), React Compiler (`reactCompiler: true`), and View Transitions for tree navigation. Tracked in [`../tasks/phase-backlog.md`](../tasks/phase-backlog.md).

## Cross-references

- DB schema details → [`data-model.md`](data-model.md)
- Auth + RLS policy text → [`auth-and-rls.md`](auth-and-rls.md)
- Photo upload pipeline → [`photo-upload.md`](photo-upload.md)
- Share link mechanics → [`share-link.md`](share-link.md)
- Pages / routes → [`../ux/pages-and-routes.md`](../ux/pages-and-routes.md)
- Next.js 16 conventions → [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md)
- Per-phase backlog (Next.js 16 idioms, View Transitions, Devtools MCP) → [`../tasks/phase-backlog.md`](../tasks/phase-backlog.md)
