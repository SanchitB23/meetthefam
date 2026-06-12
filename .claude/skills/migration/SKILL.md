---
name: migration
description: Author and promote a Supabase migration through meetthefam's local → QA → prod path — file conventions, local apply (up + db reset), QA MCP apply with the timestamp-quirk cross-check, the per-environment apply policy, and the post-commit validator nudge. Use when creating, applying, or promoting a DB migration. User-invoked only.
disable-model-invocation: true
---

# Migration — author & promote

Drives a Supabase migration through **local → QA → prod** for **meetthefam**. The
canonical, always-authoritative guide is
[`docs/dev/migrations.md`](../../../docs/dev/migrations.md) — **read it before
applying**; this skill is the checklist + the non-obvious gotchas. Migrations are
**forward-only**, **timestamp-ordered**, single-source-of-truth in
`supabase/migrations/`. Drift between the directory and any environment is a hard stop.

## Authoring

- **Use the `supabase-engineer` subagent** for the SQL — RLS holes are the #1 silent
  bug class in multi-tenant SaaS. Always pass the project refs explicitly to subagents
  (they don't load main-session memory): **QA `ljjvwtpifmoshfknlbaj`**, **prod
  `ycnsgkotrbjifsjkqmvn`**.
- Filename: `<UTC-timestamp>_<snake_case_slug>.sql` (timestamp from
  `date -u +%Y%m%d%H%M%S` — lexicographic = chronological).
- One logical change per file. Header comment names it + cites the spec/ADR.
- RLS policies use explicit `using` / `with check`, **no `if not exists`** (a repeat-apply
  hitting an existing policy is a drift signal, not something to absorb).
- `SECURITY INVOKER` for plpgsql functions unless there's an explicit `DEFINER` reason.

## Local apply (both, always)

```bash
pnpm exec supabase status            # start the stack if it's not running
pnpm exec supabase migration up      # incremental path
pnpm exec supabase db reset          # DESTRUCTIVE from-scratch verify (order-dependency catch)
```

Run **both** before declaring ready for QA: `migration up` proves the incremental path;
`db reset` proves the fresh-clone path prod will take.

## QA apply

Target: **`ljjvwtpifmoshfknlbaj`** (`meetthefam-qa`). QA has **no auto-apply** (Automatic
Branching is Pro-only) — a manual MCP apply **is** required. Use the MCP, not a direct
`supabase db push` (the MCP path records the migration in the project's own log so
`list_migrations` returns it):

```
mcp__supabase__apply_migration(name = "<slug-without-timestamp>", query = "<SQL verbatim>")
mcp__supabase__list_migrations()        # MANDATORY cross-check — do not skip
```

Cross-check `list_migrations` against `supabase/migrations/` on **(name, content)** —
same count, same names, same order.

- **Timestamps WILL differ** between the local filename and QA's `version` column —
  `apply_migration` stamps the QA log with its **own server clock at apply-time**. That's
  expected, **not drift**. Match on **(name, content)**, never on timestamps.
- **MCP-apply quirk:** because it generates a fresh "applied at" timestamp instead of
  using the file timestamp, you may need to patch the tracking row afterward to keep the
  `version` aligned where it matters — see the `UPDATE` recorded in the migrations memory.
- **Real drift = a name in one place not in the other, OR same name with different
  content → HARD STOP.** Never edit an applied migration to "fix" drift; write a new
  forward-only migration instead.

## Prod apply — policy

- Prod (**`ycnsgkotrbjifsjkqmvn`**) **auto-applies on merge to `main`** via the
  Supabase↔GitHub integration — so **do not pre-emptively MCP-apply to prod** as part of
  a feature branch.
- **BUT** the integration silently skips migrations that first reach main via a
  **release-branch merge commit** (#177) — which is every release. So a **manual MCP
  apply to prod at release time is the expected fallback**, run as part of the
  [`/release`](../release/SKILL.md) step 7 parity check, not here. Prod apply belongs to
  the release flow, not the feature flow.

## Never

- Edit a migration file after it's been applied to QA or prod (breaks fresh-clone reproducibility).
- `delete from supabase_migrations.schema_migrations` to "re-run" — that hides drift.
- Skip QA — the QA preview is the dress rehearsal for prod.

## After committing the migration

The `db-commit-detector` PostToolUse hook will nudge you to dispatch the
**`supabase-validator`** subagent. Do it (unless you already validated inline) — it
applies locally + cross-checks QA, simulates RLS per role, and runs `get_advisors`.

## Pre-flight checklist (before the migration's PR opens)

- [ ] Filename matches `<UTC-timestamp>_<snake_case_slug>.sql`; header cites the spec/ADR.
- [ ] `supabase migration up` AND `supabase db reset` ran clean locally.
- [ ] `apply_migration` ran clean on QA `ljjvwtpifmoshfknlbaj`.
- [ ] `list_migrations` on QA matches `supabase/migrations/` on (name, order, content).
- [ ] `get_advisors` on QA shows no new ERROR/WARN.
- [ ] PR body has the filename + one-line summary + the cross-check confirmation.

## See also

- [`docs/dev/migrations.md`](../../../docs/dev/migrations.md) — canonical recipe.
- [`docs/architecture/auth-and-rls.md`](../../../docs/architecture/auth-and-rls.md) — RLS patterns.
- [`/release`](../release/SKILL.md) — owns the prod-apply parity step.
