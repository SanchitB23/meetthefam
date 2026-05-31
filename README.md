# meetthefam

A multi-tenant family tree web app. Sign up, build a family tree, invite editors, share read-only with relatives.

**Status:** Phase −1 — project AI infrastructure. No feature code yet.

## Quick links

- **Service status**: [status.meetthefam.com](https://meetthefam.betteruptime.com) — hosted BetterStack status page (web app / auth / DB / storage). Goes live at v1.0; setup + custom-domain steps in [`docs/dev/prod-readiness.md`](docs/dev/prod-readiness.md) §10.
- **Spec**: [`docs/specs/2026-05-10-family-tree-design.md`](docs/specs/2026-05-10-family-tree-design.md)
- **Architecture**: [`docs/architecture/overview.md`](docs/architecture/overview.md)
- **Current work**: the nearest open [GitHub milestone](https://github.com/SanchitB23/meetthefam/milestones) (planning source of truth — see [ADR 0011](docs/adrs/0011-github-milestones-source-of-truth.md))
- **Claude Code conventions**: [`CLAUDE.md`](CLAUDE.md)
- **Architecture Decision Records**: [`docs/adrs/`](docs/adrs/)

## Tech stack

- Next.js 16 (App Router, Turbopack default) on Vercel — see [`docs/adrs/0007-nextjs-16-and-async-idioms.md`](docs/adrs/0007-nextjs-16-and-async-idioms.md)
- Supabase (Postgres + Auth + Storage + Row-Level Security)
- Tailwind v4 + shadcn/ui (`base-nova` preset on Base UI primitives)
- [donatso/family-chart](https://github.com/donatso/family-chart) for tree rendering
- Vitest (RLS + server-action tests) + Playwright (E2E happy paths)

## Local development

```bash
pnpm install                    # installs JS deps + Supabase CLI binary
pnpm exec supabase start        # boots local Supabase stack (Docker required)
pnpm dev                        # Next.js dev server at http://localhost:3000
```

Local Supabase services after `supabase start`:

| Service | URL |
|---|---|
| API + Auth + REST | <http://127.0.0.1:54321> |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (DB UI) | <http://127.0.0.1:54323> |
| Mailpit (catches magic-link emails) | <http://127.0.0.1:54324> |

Tear down with `pnpm exec supabase stop`. Full DB wipe (re-applies migrations + seed) = `pnpm exec supabase db reset`.
