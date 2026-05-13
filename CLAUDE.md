# CLAUDE.md

> Conventions for any Claude Code session in this repo. Loaded automatically.

@AGENTS.md

## Project context

**meetthefam** is a multi-tenant family-tree SaaS. Anyone can sign up, build a private family tree (50–200 people), invite editors, share a read-only link with relatives. Mobile-first, lightweight "meet-the-family" scope — names + photos + bios + simple parent / child / spouse relationships, no genealogy power-features.

Stack: Next.js 16 (App Router, Turbopack default) on Vercel, Supabase (Postgres + Auth + Storage + Row-Level Security), Tailwind v4 + shadcn/ui, [donatso/family-chart](https://github.com/donatso/family-chart) (D3, MIT) for tree rendering. **No separate backend** — all server logic in Next.js Server Actions and Route Handlers. See [`docs/adrs/0007-nextjs-16-and-async-idioms.md`](docs/adrs/0007-nextjs-16-and-async-idioms.md) for the Next.js 16 idioms we follow (async `params` / `cookies()`, `proxy.ts`, `updateTag()`, `refresh()`).

## Where to look first

- [`docs/specs/2026-05-10-family-tree-design.md`](docs/specs/2026-05-10-family-tree-design.md) — canonical product + technical spec (lifted from the brainstorming session)
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — system shape, data flow
- [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — DB schema, FK rationale, edge cases
- [`docs/architecture/auth-and-rls.md`](docs/architecture/auth-and-rls.md) — RLS policies + share-link bypass
- [`docs/architecture/photo-upload.md`](docs/architecture/photo-upload.md) — client-side resize + Storage paths
- [`docs/architecture/share-link.md`](docs/architecture/share-link.md) — token mechanics
- [`docs/ux/`](docs/ux/) — page-by-page UX details
- [`docs/dev/`](docs/dev/) — operational recipes: git workflow, releases, migrations (the *how*)
- [`docs/adrs/`](docs/adrs/) — Architecture Decision Records (the *why*)
- [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md) — what we're working on right now

When unsure, read `docs/tasks/current-phase.md` first to know what phase we're in, then load only the docs relevant to the current phase.

## Project subagents

For focused work, prefer these subagents over a generic agent:

- **`supabase-engineer`** — schema, migrations, RLS policies, DB-touching server actions (**authors**)
- **`supabase-validator`** — post-commit verification + live diagnosis of Supabase / DB errors (**validates**). Sibling to `supabase-engineer`; read-only by design (no `apply_migration` / `Edit` / `Write` grants). **Auto-nudged after DB-touching commits** by the `db-commit-detector` PostToolUse hook (see [`.claude/hooks/db-commit-detector.sh`](.claude/hooks/db-commit-detector.sh)); also invoke manually whenever the user reports a DB error in any environment.
- **`frontend-engineer`** — React components, family-chart wrapper, mobile gestures
- **`test-engineer`** — Vitest (RLS + server-action tests), Playwright (E2E happy paths)
- **`task-doc-keeper`** — keeps `docs/tasks/current-phase.md` + `docs/tasks/phase-backlog.md` in sync with work about to land. **Invoke before every feature commit** so doc ticks land in the same commit as the code (per the standing memory rule). Also drives phase close-outs (mark current phase ✅ closed, open the next phase stub). It only edits the docs — the controller still stages + commits.

Definitions live in [`.claude/agents/`](.claude/agents/).

## Conventions

### Git / commits

- **Always ask the user before running `git commit`, even for small changes.** Never auto-commit. After each mini-task, present a brief diff summary and wait for explicit approval.
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`.
- Stage specific files by name (`git add src/foo.ts`); avoid `git add -A` and `git add .` to prevent accidentally committing secrets.
- Never use `--no-verify`, `--no-gpg-sign`, or other hook-skipping flags unless the user explicitly asks.
- Co-author footer on every Claude-generated commit:
  `Co-Authored-By: Claude <noreply@anthropic.com>`

### Git workflow

Feature-branch forward-promotion: `local → feat/* (or fix/, chore/, docs/, refactor/, test/, style/) → qa → release/vX.Y.Z → main → production`. Never commit directly to `main`; per-sub-task branches are mandatory and direct `qa` commits are emergency-only. Branch prefix mirrors the Conventional Commit type used in the commit message.

- Full sub-task recipe + branch-type table + hotfix exception: [`docs/dev/git-workflow.md`](docs/dev/git-workflow.md).
- Rationale + alternatives considered: [ADR 0010](docs/adrs/0010-feature-branch-workflow.md).

### Releases

Phase-anchored SemVer (rules: [ADR 0009 §1](docs/adrs/0009-versioning-and-releases.md)). Releases ship via a `release/vX.Y.Z` branch cut from `qa`, merged to `main` with a real merge commit, then PR'd back into `qa` to return the version bump. Tag is created on GitHub via `gh release create --target main` — `pnpm version` always runs with `--no-git-tag-version` so no local tag exists.

- Full 8-step release recipe + versioning table: [`docs/dev/releases.md`](docs/dev/releases.md).
- Rationale + Amendment history: [ADR 0009](docs/adrs/0009-versioning-and-releases.md).

### Code

- TypeScript strict mode. No `any` unless absolutely necessary and commented why.
- Run `pnpm typecheck` and `pnpm lint` before proposing a commit; fix all errors first.
- Run relevant tests (`pnpm test`) when the change touches a tested area.
- Components: prefer Server Components; use `'use client'` only for components that need state, effects, or browser APIs.

### UI primitives

- **shadcn/ui is on the `base-nova` preset (shadcn 3.x default), which builds on [Base UI](https://base-ui.com/) (`@base-ui/react`) — *not* Radix.** When pulling component code, docs, or examples, search for "shadcn base-nova" / "@base-ui/react". Older guides referencing `@radix-ui/react-*` imports are out of date for this repo. Verify via Context7 (`/shadcn-ui/ui` at version `shadcn_3.5.0` or later) before importing primitives.
- **Lucide is on `lucide-react@1.x`** (the recent 0.x → 1.0 jump). Some icon names changed in the 1.0 cleanup. Always verify icon names via Context7 (`/lucide-icons/lucide`) or the live shadcn registry before importing — don't trust 0.x examples in training data.
- **Theme tokens live in `src/app/globals.css`** — the heirloom-journal palette (cream `--background`, forest-green `--primary`, terracotta `--accent`, charcoal `--foreground`) in OKLCH. Don't hard-code hex; reference tokens via Tailwind utilities (`bg-primary`, `text-foreground`, `border-border`, etc.). Fonts: Cormorant Garamond (`--font-serif`, headings) + Manrope (`--font-sans`, body) wired through `next/font` in `src/app/layout.tsx`. Dark-mode tokens are placeholder shadcn defaults — proper dark-mode tuning is deferred to Phase 8 polish.

### Local dev

- **pnpm 10's strict postinstall policy** silently ignores package install-scripts by default. The `pnpm.onlyBuiltDependencies` whitelist in [`package.json`](package.json) permits the ones we actually need (currently just `supabase`, which downloads its Go binary). **Fresh clone**: `pnpm install` runs the whitelisted scripts automatically — no extra steps. **Gotcha after `pnpm add -D <pkg>`**: if the new package's postinstall is needed and it's *not yet* in `onlyBuiltDependencies`, pnpm installs the package but skips the script — symptom is `pnpm exec <bin>` returning *"Command not found"* even though `node_modules/<pkg>` exists. **Fix**: add the package to `pnpm.onlyBuiltDependencies` in `package.json`, then run `pnpm rebuild <pkg>` to trigger the now-permitted postinstall. Plain `pnpm install` after the whitelist edit will *not* retry the skipped script on an already-installed dep.
- **Local Supabase stack** (Phase 0 sub-task 3 landed): `pnpm exec supabase start` boots Postgres (`:54322`), Auth + REST API (`:54321`), Studio (`:54323`), and Mailpit (`:54324` — catches magic-link emails for testing). `pnpm exec supabase stop` to tear down. Full DB reset = `pnpm exec supabase db reset`. Stack state survives `stop` → `start`; `reset` is the destructive one.

### Files

- Never write secrets in committed files. Tokens live in `.env.local` (gitignored).
- `.mcp.json` references env vars via `${env:VAR_NAME}`; tokens themselves stay in `.env.local`.
- New ADRs: copy the format of `docs/adrs/0001-*.md`. Number sequentially.

### Workflow rules from the spec

- **One Claude session per logical task.** Don't bundle scaffolding + auth + dashboard into one session — fresh context per coherent unit produces better edits.
- **`frontend-design` skill is for visual polish only.** Don't invoke it for backend / RLS / business logic — it'll waste effort. Use it on tree-view styling, person cards, bottom sheets, landing page hero, empty states.
- **Use the `supabase-engineer` agent for any RLS work.** RLS holes are the #1 silent bug class in multi-tenant SaaS — running it through a focused agent is cheap insurance.

## Tier 1 MCPs

Sessions in this repo are noticeably more productive when these MCP servers are connected. Install each at whichever scope (project `.mcp.json`, user `~/.claude/settings.json`, or otherwise) fits your setup — see [`docs/setup/mcp-servers.md`](docs/setup/mcp-servers.md) for one working configuration.

| MCP | Use for |
|---|---|
| **Supabase** | SQL queries, schema inspection, migrations, RLS policies |
| **Context7** | Live docs for Next.js 16, Supabase, family-chart, Tailwind v4, shadcn/ui (Base UI), Lucide 1.x, react-hook-form |
| **Next.js DevTools** | Auto-attaches to a running `pnpm dev` for codemods, async-API audits, v16 migration help |
| **GitHub** | Branches, PRs, issues, repo metadata |
| **Vercel** | Deployments, env vars, domains |

If an MCP isn't available in your session, fall back to shell + file edits.

## Phasing at a glance

- **Phase −1** — Project AI infrastructure (CLAUDE.md, docs, agents, .mcp.json)
- **Phase 0** — Foundation: Next.js + Supabase scaffolded
- **Phases 1–5** — v0.1 (personal MVP): auth, tree CRUD, people CRUD, visualization, photos
- **Phases 6–9** — v1.0 (multi-tenant launch): collaboration, share link, visual polish, QA + launch

The active phase's checklist is in [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md).
