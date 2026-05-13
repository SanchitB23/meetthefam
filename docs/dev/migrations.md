# Migrations — recipe and rules

Operational guide for authoring and promoting Supabase migrations across the three environments — **local → QA → prod**. For the surrounding environment model, see [`../adrs/0005-three-environments.md`](../adrs/0005-three-environments.md). For the data model the migrations build up, see [`../architecture/data-model.md`](../architecture/data-model.md) and [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md).

Migrations are **forward-only**, **timestamp-ordered**, and **single-source-of-truth in `supabase/migrations/`**. Drift between the directory and any environment is a hard stop — investigate before moving forward.

## The flow at a glance

```
supabase/migrations/<ts>_<slug>.sql   (single source of truth — committed to git)
        ↓
   local stack                         pnpm exec supabase migration up
        ↓                              pnpm exec supabase db reset   (from-scratch verify)
        ↓ (squash-merge into qa)
   QA Supabase project                 mcp__supabase__apply_migration  +  list_migrations cross-check
        ↓ (release/vX.Y.Z → main)
   PROD Supabase project               same MCP path  +  get_advisors post-flight
```

Every migration crosses every line in order. No skipping QA, no editing a file after it lands on QA, no out-of-band SQL on a remote project.

## File conventions

| Rule | Why |
|---|---|
| Filename: `<UTC-timestamp>_<snake_case_slug>.sql`, timestamp from `date -u +%Y%m%d%H%M%S` | Lexicographic = chronological. UTC avoids clock-zone bugs between contributors. |
| One logical change per file | Lets QA / prod replay land in isolation. A failed apply doesn't half-land a multi-change file. |
| Header comment names the migration + cites the spec/ADR/architecture doc that drove it | Future-you reading `git blame` six months later. |
| Idempotent guards (`if not exists`, `on conflict (...) do nothing`) where they make sense — **but never relied on for correctness** | Idempotency helps re-running `db reset`. Never use it to swallow drift between environments. |
| RLS policies use explicit `using` and `with check` clauses, no `if not exists` | A repeat-apply that hits an existing policy is a signal of drift, not something to silently absorb. |
| `SECURITY INVOKER` for plpgsql functions unless you have an explicit reason for `DEFINER` | Functions should run with the caller's RLS context by default. |

Migrations land via the **`supabase-engineer`** subagent. RLS holes are the #1 silent bug class in multi-tenant SaaS; running schema work through a focused agent is cheap insurance.

## Local apply

```bash
# 0. Make sure the local stack is running.
pnpm exec supabase status
# If "supabase local development setup is not running" — start it:
pnpm exec supabase start

# 1. Incremental apply — applies anything in supabase/migrations/ not yet on the local DB.
pnpm exec supabase migration up

# 2. From-scratch verify — DESTRUCTIVE. Wipes local data, re-runs every migration
#    in timestamp order from zero, re-seeds from supabase/seed.sql.
#    Catches order-dependency bugs that `migration up` would miss.
pnpm exec supabase db reset
```

Always run BOTH `migration up` AND `db reset` before declaring a migration ready for QA. `migration up` proves the incremental path; `db reset` proves the fresh-clone path that any new contributor — and the future prod project — will take.

## QA apply

QA target: Supabase project `ljjvwtpifmoshfknlbaj` (`meetthefam-qa`, `ap-south-1`).

The QA project is configured in the user's Supabase MCP — `mcp__supabase__*` tools default to it. Use the MCP, NOT a direct `supabase db push` against the project's connection string — the MCP path captures the migration in the project's own migration table so `list_migrations` returns it.

```
mcp__supabase__apply_migration(
  name = "<slug-without-timestamp>",         # e.g. "photos_bucket_and_rls"
  query = "<SQL body, verbatim from the file>"
)
```

Then, **mandatory cross-check** — do not skip:

```
mcp__supabase__list_migrations()
```

Compare the returned list against `supabase/migrations/`:

- **Same count** of entries.
- **Same names**, in the same order.
- **Same SQL content** per name — if you doubt it, pull the QA migration's body via `mcp__supabase__execute_sql` against `supabase_migrations.schema_migrations` and diff against the local file.

**Timestamps will differ between the local filename and QA's `version` column** — this is expected, not drift. `mcp__supabase__apply_migration` stamps the QA migration log with **its own server clock at apply-time**, ignoring the local file's timestamp prefix. So `supabase/migrations/20260513141141_photos_bucket_and_rls.sql` shows up on QA as `version: 20260513143945, name: photos_bucket_and_rls` — different `version`, same `name`. Match on **(name, content)**, not timestamps.

**Real drift is a hard stop.** Real drift = a name in one place that doesn't appear in the other, OR same name with different content. If you see either, do NOT push forward. Likely causes: a previous apply was done out of band, or a migration was edited after applying. Reconcile by investigating which side is wrong, then write a new forward-only migration to bring the lagging side into line. **Never** edit an already-applied migration to "fix" the drift — that's how the issue gets worse.

## Prod apply

Prod target: Supabase project `family-tree-prod` (will be created at the v0.1 ship — does NOT exist today; first creation happens at the end of Phase 5). Configured in the user's Supabase MCP as the second project; pass the explicit `project_id` if your MCP defaults to QA.

Prod is exercised for the first time as part of the **v0.1.0 release** (see [`releases.md`](releases.md) step ~0.5). Future releases follow the same recipe.

```
# 1. Pre-flight: confirm the prod project is empty.
mcp__supabase__list_migrations(project_id = "<prod-id>")
# Expected: empty list. If not empty, STOP — someone applied out of band, investigate.

# 2. Replay every migration from supabase/migrations/ in timestamp order.
#    One MCP call per file. Pass the slug (no timestamp) as `name` and the
#    SQL body verbatim.
for each file in supabase/migrations/ (sorted ascending):
  mcp__supabase__apply_migration(project_id = "<prod-id>", name = "<slug>", query = "<sql>")

# 3. Post-flight: re-run list_migrations. MUST match supabase/migrations/
#    on (name, content) — same count, same names, same order. Timestamps
#    will be MCP-stamped (server clock at apply-time), not the local-file
#    timestamps; that's expected behavior, not drift.
mcp__supabase__list_migrations(project_id = "<prod-id>")

# 4. Schema smoke: confirm the expected tables exist with the expected shape.
mcp__supabase__list_tables(project_id = "<prod-id>", schemas = ["public"])
# Expected: profiles, trees, tree_members, people (and any newer tables).

# 5. Advisor sweep — MANDATORY. The advisor flags RLS gaps, missing indexes,
#    insecure defaults that the migration didn't cover.
mcp__supabase__get_advisors(project_id = "<prod-id>", type = "security")
mcp__supabase__get_advisors(project_id = "<prod-id>", type = "performance")
# Address every "ERROR" and "WARN" before declaring prod ready.
```

### One-off: storage buckets on prod

If a migration creates a `storage.buckets` row (like Phase 5's `photos` bucket), confirm the bucket exists on prod via the Supabase dashboard's Storage browser after step 5. The bucket's RLS policies should be visible alongside the public flag and the file-size limit.

## Rollback discipline

Migrations are forward-only. To undo a migration, **write a new migration** that reverses it (drop the column, drop the policy, rename back, etc.). Then apply the new migration via the same local → QA → prod path.

**Never:**

- Edit a migration file after it has been applied to QA or prod. The timestamps in the project's migration log must match the file. Editing breaks reproducibility from a fresh clone.
- Manually `delete from supabase_migrations.schema_migrations` to "re-run" a migration. That hides the drift; it doesn't fix it.
- Apply a migration to prod that has not been on QA for at least one feature cycle. The QA preview is the dress rehearsal; skipping it loses the safety it buys.

**The only exception** to "never edit": a migration that is still on a feature branch and has only been applied to local. Edit-then-`db reset` is fine because no other environment knows about it yet. The moment that branch hits `qa` and the migration is `apply_migration`'d to the QA project, the file is frozen.

## Pre-flight checklist (before opening the migration's PR)

Use the **`supabase-engineer`** subagent for the SQL authoring; the checklist below is the human gate before the PR opens.

- [ ] Migration filename matches `<UTC-timestamp>_<snake_case_slug>.sql`.
- [ ] Header comment names the migration and cites the spec/ADR.
- [ ] `pnpm exec supabase migration up` ran clean locally.
- [ ] `pnpm exec supabase db reset` ran clean locally (from-scratch verify).
- [ ] `mcp__supabase__apply_migration` ran clean on QA.
- [ ] `mcp__supabase__list_migrations` on QA matches `supabase/migrations/` on (name, order, content). Timestamps WILL differ between the local filename and QA's `version` column — that's MCP-stamps-its-own-time, not drift.
- [ ] `mcp__supabase__get_advisors` on QA shows no new ERROR / WARN entries (existing baseline noise is fine).
- [ ] PR body includes the migration filename + a one-line summary + the cross-check confirmation.

## See also

- [`../adrs/0005-three-environments.md`](../adrs/0005-three-environments.md) — the local / QA / prod model.
- [`../architecture/data-model.md`](../architecture/data-model.md) — the schema the migrations build up.
- [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md) — RLS policy patterns referenced by every multi-tenant migration.
- [`git-workflow.md`](git-workflow.md) — sub-task PR flow (a migration sub-task follows the same branch shape).
- [`releases.md`](releases.md) — release recipe (prod apply runs as step ~0.5 of every release from v0.1.0 onwards).
