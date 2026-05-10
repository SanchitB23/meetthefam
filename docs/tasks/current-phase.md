# Current phase: −1 — Project AI infrastructure

> Living checklist. Claude updates as work progresses; users review at any time.

## Goal

Set up everything Claude Code needs to be productive on this codebase before any feature work starts. **No app code yet.**

**Ship gate**: from a fresh terminal in `/Users/sqb6461/Workspace/SelfProjects/meetthefam`, opening Claude Code:
- Auto-loads `CLAUDE.md`
- Has Tier 1 MCPs available (Supabase, Context7, GitHub, Vercel)
- Has access to the three project subagents
- Can answer "what's in the people table?" by reading `docs/architecture/data-model.md` without loading the full spec.

## Checklist

- [x] Confirmation gate 1 — work directory name (`meetthefam`)
- [x] Confirmation gate 2 — GitHub repo name + visibility (`meetthefam`, private)
- [x] Confirmation gate 3 — SSH alias verification (`github-personal` exists in `~/.ssh/config`)
- [x] Memory: save "always ask before commit" feedback memory
- [x] Mini-task 1 — repo skeleton: work dir + `git init` + `.gitignore` + `.env.local.example` + placeholder `README.md` (committed: `0ffeebc`)
- [ ] Mini-task 2 — knowledge base: `CLAUDE.md` + `docs/` tree (specs, architecture, ux, adrs, current-phase)
- [ ] Mini-task 3 — project subagents: `.claude/agents/{supabase-engineer,frontend-engineer,test-engineer}.md`
- [ ] Mini-task 4 — `.mcp.json` with Tier 1 MCP server definitions
- [ ] Mini-task 5 — GitHub setup: install GitHub MCP via `claude mcp add`, create GitHub repo, set remote with `github-personal` alias, push initial commits
- [ ] Phase −1 ship-gate verification — confirm all four ship-gate items pass

## What's next

After Phase −1: **Phase 0 — Foundation.** Next.js 15 + Tailwind + shadcn/ui scaffolded; local Supabase stack running with all tables + RLS migrated; QA Supabase project + Vercel deployment from the `qa` branch; logged-in placeholder page proves auth + DB are wired end-to-end.

See [`docs/specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → "v0.1" for full Phase 0 details.
