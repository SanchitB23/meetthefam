# Current phase: −1 — Project AI infrastructure (✅ done, awaiting fresh-session ship-gate verification)

## Goal

Set up everything Claude Code needs to be productive on this codebase before any feature work starts. **No app code yet.**

**Ship gate**: from a fresh terminal in `/Users/sqb6461/Workspace/SelfProjects/meetthefam`, opening Claude Code:
- Auto-loads `CLAUDE.md`
- Has Tier 1 MCPs available — `supabase`, `context7`, `github` from `.mcp.json` + `vercel` from user scope
- Has access to the three project subagents (`supabase-engineer`, `frontend-engineer`, `test-engineer`)
- Can answer "what's in the people table?" by reading `docs/architecture/data-model.md` without loading the full spec.

## Checklist

- [x] Confirmation gate 1 — work directory name (`meetthefam`)
- [x] Confirmation gate 2 — GitHub repo name + visibility (`SanchitB23/meetthefam`, private)
- [x] Confirmation gate 3 — SSH alias verification (`github-personal` exists in `~/.ssh/config`)
- [x] Memory: "always ask before commit"
- [x] Memory: "strict work/personal GitHub separation"
- [x] **Mini-task 1** — repo skeleton: work dir + `git init` + `.gitignore` + `.env.local.example` + placeholder `README.md`. Commit `0ffeebc`.
- [x] **Mini-task 2** — knowledge base: `CLAUDE.md` + `docs/` tree (specs, architecture, ux, adrs, current-phase, README). Commit `8dd64eb`.
- [x] **Mini-task 3 + 4** — project subagents (3) + initial `.mcp.json` (Tier 1) + `docs/setup/mcp-servers.md`. Commit `0765c5f`.
- [x] **Mini-task 5** — GitHub setup:
  - [x] 5a — repo created on personal account (`SanchitB23/meetthefam`, private, web UI)
  - [x] 5b — SSH remote with `github-personal` alias
  - [x] 5c — pushed 3 commits to `origin/main`
  - [x] 5d — `direnv` installed (v2.37.1) + `~/.zshrc` hook + `.envrc` + `.env.local` with PAT + `direnv allow` ✅
  - [x] 5e — dropped redundant `vercel` from project `.mcp.json` (kept at user scope) + doc/CLAUDE.md cleanup
- [x] Phase −1 ship-gate verification — fresh `claude` session in the repo: CLAUDE.md auto-loads, `claude mcp list` shows `supabase`, `context7`, `github` connected, agents visible, schema doc readable. `/doctor` flags `env:SUPABASE_ACCESS_TOKEN` and `env:GITHUB_PERSONAL_ACCESS_TOKEN` warnings — both confirmed cosmetic (Supabase token populates in Phase 0; GitHub PAT verified valid via direct API call returning `SanchitB23` + private-repo permissions).
- ~~PAT rotation~~ — not needed; the existing fine-grained PAT is already scoped only to `SanchitB23/meetthefam`.

## What's next

After Phase −1 ship gate passes: **Phase 0 — Foundation.**

- `npx create-next-app@latest` with App Router + TypeScript + Tailwind
- Add shadcn/ui
- Initialize Supabase locally (`supabase init` then `supabase start`)
- Author the first migration containing `profiles`, `trees`, `tree_members`, `people` tables + RLS policies
- Create QA Supabase project on the hosted free tier; link Vercel deployment to the `qa` branch
- "Logged-in placeholder" page proves auth + DB are wired end-to-end
- Production Supabase project deferred until v0.1 ship

See [`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → "v0.1" → Phase 0 row for the full Phase 0 ship gate.
