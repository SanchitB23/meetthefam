# CLAUDE.md

> Conventions for any Claude Code session in this repo. Loaded automatically.

## Project context

**meetthefam** is a multi-tenant family-tree SaaS. Anyone can sign up, build a private family tree (50–200 people), invite editors, share a read-only link with relatives. Mobile-first, lightweight "meet-the-family" scope — names + photos + bios + simple parent / child / spouse relationships, no genealogy power-features.

Stack: Next.js 15 (App Router) on Vercel, Supabase (Postgres + Auth + Storage + Row-Level Security), Tailwind + shadcn/ui, [donatso/family-chart](https://github.com/donatso/family-chart) (D3, MIT) for tree rendering. **No separate backend** — all server logic in Next.js Server Actions and Route Handlers.

## Where to look first

- [`docs/specs/2026-05-10-family-tree-design.md`](docs/specs/2026-05-10-family-tree-design.md) — canonical product + technical spec (lifted from the brainstorming session)
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — system shape, data flow
- [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — DB schema, FK rationale, edge cases
- [`docs/architecture/auth-and-rls.md`](docs/architecture/auth-and-rls.md) — RLS policies + share-link bypass
- [`docs/architecture/photo-upload.md`](docs/architecture/photo-upload.md) — client-side resize + Storage paths
- [`docs/architecture/share-link.md`](docs/architecture/share-link.md) — token mechanics
- [`docs/ux/`](docs/ux/) — page-by-page UX details
- [`docs/adrs/`](docs/adrs/) — Architecture Decision Records (why each non-obvious call was made)
- [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md) — what we're working on right now

When unsure, read `docs/tasks/current-phase.md` first to know what phase we're in, then load only the docs relevant to the current phase.

## Project subagents

For focused work, prefer these subagents over a generic agent:

- **`supabase-engineer`** — schema, migrations, RLS policies, DB-touching server actions
- **`frontend-engineer`** — React components, family-chart wrapper, mobile gestures
- **`test-engineer`** — Vitest (RLS + server-action tests), Playwright (E2E happy paths)

Definitions live in [`.claude/agents/`](.claude/agents/).

## Conventions

### Git / commits

- **Always ask the user before running `git commit`, even for small changes.** Never auto-commit. After each mini-task, present a brief diff summary and wait for explicit approval.
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`.
- Stage specific files by name (`git add src/foo.ts`); avoid `git add -A` and `git add .` to prevent accidentally committing secrets.
- Never use `--no-verify`, `--no-gpg-sign`, or other hook-skipping flags unless the user explicitly asks.
- Co-author footer on every Claude-generated commit:
  `Co-Authored-By: Claude <noreply@anthropic.com>`

### Code

- TypeScript strict mode. No `any` unless absolutely necessary and commented why.
- Run `pnpm typecheck` and `pnpm lint` before proposing a commit; fix all errors first.
- Run relevant tests (`pnpm test`) when the change touches a tested area.
- Components: prefer Server Components; use `'use client'` only for components that need state, effects, or browser APIs.

### Files

- Never write secrets in committed files. Tokens live in `.env.local` (gitignored).
- `.mcp.json` references env vars via `${env:VAR_NAME}`; tokens themselves stay in `.env.local`.
- New ADRs: copy the format of `docs/adrs/0001-*.md`. Number sequentially.

### Workflow rules from the spec

- **One Claude session per logical task.** Don't bundle scaffolding + auth + dashboard into one session — fresh context per coherent unit produces better edits.
- **`frontend-design` skill is for visual polish only.** Don't invoke it for backend / RLS / business logic — it'll waste effort. Use it on tree-view styling, person cards, bottom sheets, landing page hero, empty states.
- **Use the `supabase-engineer` agent for any RLS work.** RLS holes are the #1 silent bug class in multi-tenant SaaS — running it through a focused agent is cheap insurance.

## Tier 1 MCPs

If a session has them available, prefer them over shelling out:

| MCP | Use for |
|---|---|
| **Supabase MCP** | SQL queries, schema inspection, migrations, RLS policies |
| **Context7 MCP** | Live docs for Next.js 15, Supabase, family-chart, Tailwind, shadcn/ui, react-hook-form |
| **GitHub MCP** | Branches, PRs, issues, repo metadata |
| **Vercel MCP** | Deployments, env vars, domains |

If MCPs aren't available, fall back to shell + file edits.

## Phasing at a glance

- **Phase −1** — Project AI infrastructure (CLAUDE.md, docs, agents, .mcp.json) — current
- **Phase 0** — Foundation: Next.js + Supabase scaffolded
- **Phases 1–5** — v0.1 (personal MVP): auth, tree CRUD, people CRUD, visualization, photos
- **Phases 6–9** — v1.0 (multi-tenant launch): collaboration, share link, visual polish, QA + launch

The active phase's checklist is in [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md).
