# Current phase: 1 — Auth (in progress)

## Goal

Take auth from the Phase 0 sub-task 6 proof to a production-ready boundary. Add Google OAuth as a secondary sign-in path, enforce auth at the edge via `proxy.ts` (not in-page redirects), and give the signed-in user a way to actually sign out. Per the spec ([`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → "v0.1" → Phase 1 row), [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md), and [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md) on `proxy.ts` over `middleware.ts`.

**Ship gate**:

- Magic-link sign-in (from Phase 0) still works end-to-end on local + QA.
- Google OAuth one-click sign-in works end-to-end on local + QA.
- Hitting `/dashboard` while unauthenticated triggers an **edge-side** redirect to `/login` from `proxy.ts` — verified by checking that no in-page `redirect('/login')` fires (browser DevTools Network tab shows a 307 from `/dashboard` itself, not a 200 with a client-side redirect).
- Hitting `/share/<random-token>` does NOT trigger the auth boundary (matcher explicitly skips it). 404 from the route handler, not a redirect to `/login`.
- A "Sign out" button on `/dashboard` clears the session and returns the user to `/login`.

## Sub-tasks

One Claude session per sub-task, per CLAUDE.md ("One Claude session per logical task").

- [ ] **Sub-task 1** — **Google OAuth secondary sign-in**. "Continue with Google" button on `/login`. Extend `/auth/callback/route.ts` to handle the OAuth code branch (the PKCE code-exchange path is already there; OAuth uses the same `exchangeCodeForSession` mechanism). Configure the Google provider in local `supabase/config.toml` AND in the QA Supabase project dashboard (client_id / client_secret). Verify on local (direct browser redirect to Google, not Mailpit) and on QA (real Google account). See [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md) → "Auth mechanisms" and [ADR 0004](../adrs/0004-magic-link-only-no-passwords.md).
- [ ] **Sub-task 2** — **`proxy.ts` auth boundary**. Create `proxy.ts` at the repo root (NOT `middleware.ts` — per [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md)). Export `proxy`, run on the Node.js runtime, refresh session via `@supabase/ssr`, redirect unauthenticated traffic to `/login`. Matcher: `['/((?!_next|.*\\..*|share).*)']` — explicitly skip `/share/[token]` and static assets. Once `proxy.ts` is in place, remove the in-page `if (!user) redirect('/login')` from `src/app/dashboard/page.tsx` — the proxy handles it now and we want a single source of truth.
- [ ] **Sub-task 3** — **Sign-out**. Server Action `signOut()` (probably `src/app/dashboard/actions.ts`) that calls `supabase.auth.signOut()` then `redirect('/login')`. "Sign out" button on `/dashboard` that submits to the action. After this, the auth proof from Phase 0 sub-task 6 can be exercised end-to-end in a full loop: sign in → `/dashboard` shows email → sign out → back to `/login`.

Per-sub-task TODOs (Next.js 16 idioms, image config) live in [`phase-backlog.md`](phase-backlog.md). **Always read that file when entering a sub-task.**

---

## Previous phase: 0 — Foundation (✅ closed)

Closed with **`v0.0.0`** — the project's conventions baseline tag. See [release notes](https://github.com/SanchitB23/meetthefam/releases/tag/v0.0.0).

**Ship gate (met)**:

- `pnpm install && pnpm dev` boots Next.js at `http://localhost:3000`.
- `supabase start` brings up the local Postgres + Auth + Storage stack.
- Migration applied locally has all four tables (`profiles`, `trees`, `tree_members`, `people`) + RLS policies.
- QA Supabase project exists on the free tier; Vercel preview off `qa` reads from it.
- Logged-in placeholder page (`/dashboard`) shows a real authenticated user from the DB.
- All 5 Tier 1 MCPs (`supabase`, `context7`, `github-meetthefam`, `vercel`, `nextjs-devtools`) connect from a fresh `claude` session.

**Sub-tasks (all closed)**:

- [x] **Sub-task 1** — Next.js 16 scaffold (App Router + TS + Tailwind v4 + ESLint + `src/`; Node pinned to 24.15.0). *(commit `34d1aa4`)*
- [x] **Sub-task 2** — shadcn/ui init (`base-nova` preset on Base UI); heirloom-journal OKLCH palette + Cormorant Garamond / Manrope fonts. *(commit `0dd1ae6`)*
- [x] **Sub-task 3** — Local Supabase stack via `supabase init` + `supabase start`; CLI 2.98.2 installed as dev-dep with `pnpm.onlyBuiltDependencies` whitelist. *(landed in `846cdfb`)*
- [x] **Sub-task 4** — First migration via the **`supabase-engineer`** subagent: `profiles`, `trees`, `tree_members`, `people` + RLS policies + `tone` trigger + profile-on-signup trigger + Smith Family Demo seed (13 people). RLS smoke-checked. *(commit `846cdfb`)*
- [x] **Sub-task 5** — QA Supabase project `meetthefam-qa` (`ljjvwtpifmoshfknlbaj`, `ap-south-1`); single Vercel project with branch-targeted env vars. QA preview READY at `meetthefam-git-qa-sanchit-bhatnagars-projects.vercel.app`, production at `meetthefam.vercel.app` + `mtf.sanchitb23.in`. *(commit `ce72df9`)*
- [x] **Sub-task 6** — Magic-link login → `/dashboard` showing user's email; PKCE flow via `/login` → `/auth/callback` → cookie set → server-side `getUser()`. UX polish: `useFormStatus` spinner + email in confirmation card. *(commits `7e5346b`, `d48d395`)*

**Phase 0 close-out** (all done):

- [x] Drop `--turbopack` flag from scripts (never added — `34d1aa4`).
- [x] Add `engines.node` ≥ 24.15.0 to `package.json` (`34d1aa4`).
- [x] Add Next.js Devtools MCP to `.mcp.json`; bump Tier 1 MCP table from 4 → 5 (`f107e7b`).
- [x] Update `docs/setup/mcp-servers.md` with the Devtools MCP install command (`f107e7b`).
- [x] Verify `claude mcp list` shows all 5 Tier 1 MCPs connected from a fresh session (user-confirmed).
- [x] Wire `@vercel/analytics` + `@vercel/speed-insights` in `src/app/layout.tsx` (`f107e7b`).
- [x] Palette refinement to match Kintree per [ADR 0008](../adrs/0008-design-system.md) — `globals.css` migrated to two-tone + 5 TONES CSS vars.
- [x] Conventions baseline: `qa → main` workflow + phase-anchored SemVer + release process pinned. *(commit `dd1c3e1`, tagged `v0.0.0`)*

See [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md) for the Next.js 16 idioms baseline and [ADR 0009](../adrs/0009-versioning-and-releases.md) for the release process Phase 0 established.

---

## Previous phase: −1 — Project AI infrastructure (✅ closed)

Set up Claude Code to be productive in this repo before any feature work — no app code, just docs, MCPs, agents, direnv. Ship gate verified in a fresh session.

- [x] Confirmation gates 1–3: work dir, GitHub repo, SSH alias.
- [x] Memories: "always ask before commit" + "strict work/personal GitHub separation."
- [x] **Mini-task 1** — repo skeleton (`0ffeebc`).
- [x] **Mini-task 2** — knowledge base: `CLAUDE.md` + `docs/` tree (`8dd64eb`).
- [x] **Mini-task 3 + 4** — project subagents + initial `.mcp.json` (Tier 1) + `docs/setup/mcp-servers.md` (`0765c5f`).
- [x] **Mini-task 5** — GitHub setup (repo created, SSH remote, push, direnv, `.mcp.json` cleanup).
- [x] Phase −1 ship-gate verification — fresh `claude` session: CLAUDE.md auto-loads, `claude mcp list` shows `supabase`, `context7`, `github` connected, agents visible, schema doc readable. `/doctor` env-var warnings confirmed cosmetic.
- ~~PAT rotation~~ — not needed; existing fine-grained PAT is already scoped only to `SanchitB23/meetthefam`.
