# Current phase: 0 — Foundation (in progress)

## Goal

Land the working app skeleton — Next.js 16 + Tailwind + shadcn/ui + local Supabase + first migration + a logged-in placeholder page proving auth + DB are wired end-to-end. Per the spec ([`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → "v0.1" → Phase 0 row).

**Ship gate**: from a fresh terminal in this repo,
- `pnpm install && pnpm dev` boots the Next.js app at `http://localhost:3000`
- `supabase start` brings up the local Postgres + Auth + Storage stack
- A migration applied to that local DB has all four tables (`profiles`, `trees`, `tree_members`, `people`) + RLS policies
- A QA Supabase project exists on the hosted free tier and a Vercel preview off the `qa` branch reads from it
- A logged-in placeholder page shows a real authenticated user from the DB
- All five Tier 1 MCPs (`supabase`, `context7`, `github-meetthefam`, `vercel`, **`nextjs-devtools`**) connect from a fresh `claude` session

## Sub-tasks

One Claude session per sub-task, per CLAUDE.md ("One Claude session per logical task").

- [x] **Sub-task 1** — Next.js 16 scaffold: `pnpm create next-app@latest .` with App Router + TS + Tailwind v4 + ESLint + `src/`; Node pinned to 24.15.0 via `.nvmrc`; `pnpm typecheck`/`pnpm lint`/`pnpm dev` all pass. *(commit `34d1aa4`)*
- [x] **Sub-task 2** — shadcn/ui init: `pnpm dlx shadcn@latest init --defaults` (`base-nova` preset on Base UI); custom heirloom-journal OKLCH palette + Cormorant Garamond / Manrope fonts; `pnpm dlx shadcn@latest add button` verified. *(commit `0dd1ae6`)*
- [x] **Sub-task 3** — Local Supabase stack: `supabase init` + `supabase start` (Docker required). *Supabase CLI 2.98.2 installed as project dev-dep with `pnpm.onlyBuiltDependencies` permitting its postinstall; stack up at API `:54321`, DB `:54322`, Studio `:54323`, Mailpit `:54324`. (No commit hash yet — landing in this commit.)*
- [ ] **Sub-task 4** — First migration via the **`supabase-engineer`** subagent: `profiles`, `trees`, `tree_members`, `people` + RLS policies per [`../architecture/data-model.md`](../architecture/data-model.md) and [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md).
- [ ] **Sub-task 5** — QA Supabase project on the hosted free tier; Vercel deployment off the `qa` branch. (Production project deferred until v0.1 ship — see [`../adrs/0005-three-environments.md`](../adrs/0005-three-environments.md).)
- [ ] **Sub-task 6** — Logged-in placeholder page: magic-link login → `/dashboard` shows the user's email from `auth.users`. Proves auth + DB end-to-end.

Per-sub-task TODOs (Next.js 16 idioms, MCP additions, image config) live in [`phase-backlog.md`](phase-backlog.md). **Always read that file when entering a sub-task.**

## Phase 0 close-out checklist

After all six sub-tasks land, before declaring Phase 0 done:

- [x] Drop `--turbopack` flag from `package.json` scripts (Next.js 16 makes it default — flag is a no-op). *(never added — sub-task 1 scaffold shipped without it, commit `34d1aa4`)*
- [x] Add `engines.node` to `package.json` (≥24.15.0, matching `.nvmrc`). *(landed in sub-task 1, commit `34d1aa4`)*
- [ ] Add **Next.js Devtools MCP** to project `.mcp.json`; bump Tier 1 MCP table in `CLAUDE.md` from 4 → 5.
- [ ] Update `docs/setup/mcp-servers.md` with the Devtools MCP install command.
- [ ] Verify `claude mcp list` shows all 5 Tier 1 MCPs connected from a fresh session.
- [x] **Palette refinement to match Kintree** (per [ADR 0008](../adrs/0008-design-system.md)) — `src/app/globals.css` migrated to two-tone (cream `--background` + paper `--card`) and seeded the 5 TONES CSS vars. *(landed in the same commit as ADR 0008)*

See [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md) for why we baseline on Next.js 16 and which v16 idioms get adopted now vs. deferred.

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
