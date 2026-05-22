# DB Restore Runbook — Supabase Point-in-Time Restore

> **Scope:** Restoring the `family-tree-prod` Supabase project after data loss.
> This is NOT a Next.js rollback — see [`docs/dev/releases.md`](../dev/releases.md) for deploy rollbacks.
> Pre-requisite: [`docs/dev/prod-readiness.md §9`](../dev/prod-readiness.md#9-backups--dr) — confirm the Pro plan (7-day PITR) is active before v1.0.

---

## 1. When to use this runbook

Use this runbook when **data is lost or corrupted in production** and cannot be repaired by a targeted SQL fix. Common triggers:

- Accidental destructive migration applied to prod (e.g., `DROP TABLE`, `TRUNCATE`)
- Malformed bulk write that corrupted rows across many families
- Ransomware-style data destruction (all rows deleted/overwritten)

**Do NOT use this runbook for:**
- Application bugs producing wrong UI output (fix the code)
- A bad Next.js deploy (roll back via Vercel dashboard or `git revert`)
- Single-row corrections (write a targeted SQL fix instead)
- Storage (`photos` bucket) object loss — that needs a separate runbook

---

## 2. Pre-checks before restoring

Work through these in order before touching the Supabase dashboard.

1. **Confirm it is data loss, not a bug.** Run a quick read query in the Supabase SQL editor against `family_trees`, `people`, `tree_members`. If rows are missing or corrupted, proceed. If data looks fine but the app is broken, investigate the app layer first.

2. **Notify the owner.** Ping the on-call contact (see `docs/dev/prod-readiness.md §10`). Get a second set of eyes before a destructive restore.

3. **Pick the restore point.** Check when the incident started — look at `created_at` / `updated_at` timestamps on surviving rows, Vercel deploy logs, and Supabase project logs (`Project → Logs → API`). You want the latest clean point _before_ the incident.

4. **Freeze writes (if data is still being destroyed).** If the incident is ongoing (e.g., a migration is still running, or a runaway process is deleting rows), revoke the service-role key to halt writes:
   - Supabase dashboard → Project Settings → API → Service Role Key → Regenerate
   - Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel production env vars to the new key
   - Redeploy the Vercel production project (this makes the app temporarily read-only / broken — acceptable to stop the bleeding)

5. **Note current migration state.** Run `pnpm exec supabase db diff --linked` and save the output. You will use this to verify schema parity after the restore.

---

## 3. Point-in-time restore via Supabase dashboard

> **Retention window:** Free tier — 1-day backup snapshots only, no PITR. Pro tier — 7-day PITR. Ensure the Pro plan is active (§2 pre-check; this is a v1.0 gate in `prod-readiness.md §9`).

Steps:

1. Go to [app.supabase.com](https://app.supabase.com) → select `family-tree-prod`.
2. Navigate to **Project Settings → Database → Backups**.
3. Click **"Restore to point in time"** (only visible on Pro plan).
4. Use the calendar/time picker to select the restore timestamp identified in §2 step 3.
5. Read the confirmation dialog carefully — it lists what will be overwritten.
6. Click **Confirm**. The restore begins immediately.

> If "Restore to point in time" is not shown, you are on the Free tier. Your only option is **"Download backup"** (daily snapshot) and manually restoring via `psql`. Contact Supabase support or upgrade to Pro before proceeding.

---

## 4. Expected downtime

| Phase | Duration | User impact |
|---|---|---|
| Restore in progress | 5–15 min | Project URL stays the same; reads and writes are paused. The app shows errors or a loading state. |
| Post-restore startup | ~1 min | Connections re-established automatically. |
| Verification (§5) | 10–20 min | App stays live but you should monitor closely. |

Total expected downtime: **~15–30 min** for a typical restore.

---

## 5. Post-restore verification

Run all of these before declaring the incident resolved.

**Schema parity check:**
```bash
pnpm exec supabase db diff --linked
```
Compare against the output saved in §2 step 5. Any drift means a migration applied after the restore point is now missing — re-apply it manually via the Supabase SQL editor or `mcp__supabase__apply_migration`.

**Migration history check:**
```bash
# Via MCP (in a Claude session):
mcp__supabase__list_migrations   # against prod project ID ycnsgkotrbjifsjkqmvn
```
Cross-check the migration list against QA. Per [`docs/dev/migrations.md`](../dev/migrations.md), timestamp-prefix drift between environments is expected and OK — verify by name, not timestamp.

**RLS + security advisor check:**
```bash
# Via MCP:
mcp__supabase__get_advisors      # security + performance scan
```
Compare against the baseline documented in `prod-readiness.md §1`. Flag any NEW entries.

**Smoke flows:**
Run the QA smoke flows from [`docs/qa/smoke-flows.md`](../qa/smoke-flows.md) against the production URL. At minimum: sign-in, view a tree, add a person. If the app has a feature flag for prod-vs-QA, use it to point the QA environment at the restored prod DB temporarily.

**Row-count sanity:**
```sql
-- Run in Supabase SQL editor on prod:
SELECT 'family_trees' AS tbl, COUNT(*) FROM family_trees
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'tree_members', COUNT(*) FROM tree_members
UNION ALL SELECT 'tree_invites', COUNT(*) FROM tree_invites;
```
Compare against the last known-good counts (check Supabase logs or the previous DB backup metadata).

---

## 6. Communication

**During the incident (writes frozen / app degraded):**

Status page (link from repo README once wired — see `prod-readiness.md §10`):
> *"We are investigating a data issue affecting [meetthefam]. Writes are temporarily paused while we restore from backup. Expected resolution: [time]. Read access may be intermittent."*

In-app banner (if the app is still partially reachable — add via `src/app/layout.tsx` environment check):
> *"We're performing database maintenance. Your family tree data is safe. Back shortly."*

**After restore + verification complete:**

Status page update:
> *"Resolved. DB restore completed at [time]. All data has been restored to [restore-point timestamp]. If you notice any missing changes made after that time, please contact [maintainer email]."*

Remove the in-app banner and redeploy.

**Internally:** File a postmortem within 48 hours using `docs/runbooks/postmortem-template.md` (create if missing — see `prod-readiness.md §10`).

---

## 7. What this runbook does NOT cover

| Topic | Where to handle it |
|---|---|
| **Partial table restore** (recover specific rows, not a full PITR) | Manual SQL: use `pg_restore` on a downloaded backup snapshot, or replay the Supabase "Download backup" file into a temp DB, then `INSERT … SELECT` the needed rows into prod |
| **Storage (`photos` bucket) object recovery** | Supabase Storage objects are included in Pro backups but not exposed through the PITR UI — contact Supabase support, or restore from a separate offsite copy if one exists. A dedicated photo-loss runbook is deferred to a future phase. |
| **Next.js / Vercel rollback** | Use Vercel dashboard → Deployments → Instant Rollback, or `git revert` + push to `main` |
| **Partial migration rollback** | Write a compensating migration (`docs/dev/migrations.md`) and apply it; do not PITR for schema-only issues |
