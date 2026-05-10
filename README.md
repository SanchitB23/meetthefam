# meetthefam

A multi-tenant family tree web app. Sign up, build a family tree, invite editors, share read-only with relatives.

**Status:** Phase −1 — project AI infrastructure. No feature code yet.

## Quick links

- **Spec**: [`docs/specs/2026-05-10-family-tree-design.md`](docs/specs/2026-05-10-family-tree-design.md)
- **Architecture**: [`docs/architecture/overview.md`](docs/architecture/overview.md)
- **Current phase tasks**: [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md)
- **Claude Code conventions**: [`CLAUDE.md`](CLAUDE.md)
- **Architecture Decision Records**: [`docs/adrs/`](docs/adrs/)

## Tech stack

- Next.js 16 (App Router, Turbopack default) on Vercel — see [`docs/adrs/0007-nextjs-16-and-async-idioms.md`](docs/adrs/0007-nextjs-16-and-async-idioms.md)
- Supabase (Postgres + Auth + Storage + Row-Level Security)
- Tailwind + shadcn/ui
- [donatso/family-chart](https://github.com/donatso/family-chart) for tree rendering
- Vitest (RLS + server-action tests) + Playwright (E2E happy paths)

## Local development

> Phase −1 only. Phase 0 (Foundation) will replace this section with real instructions.

```bash
# Once Phase 0 lands:
# pnpm install
# supabase start          # local Supabase stack via Docker
# pnpm dev                # http://localhost:3000
```
