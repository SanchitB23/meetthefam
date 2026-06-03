# DB Restore Runbook — Supabase Free Tier

> **Scope:** Restoring the `family-tree-prod` Supabase project (`ycnsgkotrbjifsjkqmvn`) after data loss.
> This is NOT a Next.js rollback — see [`docs/dev/releases.md`](../dev/releases.md) for deploy rollbacks.
> `family-tree-prod` ships on **Supabase Free**. The path below uses daily-snapshot download + `psql` restore into a fresh project — there is no in-place PITR on Free. Pro-tier instructions are preserved in **Appendix A** for the v2.0 upgrade window.

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
- Storage (`photos` bucket) object loss — see §3.5 and the dedicated photo-backup follow-up ([#206](https://github.com/SanchitB23/meetthefam/issues/206))

---

## 2. Pre-checks before restoring

Work through these in order before touching the Supabase dashboard.

1. **Confirm it is data loss, not a bug.** Run a quick read query in the Supabase SQL editor against `family_trees`, `people`, `tree_members`. If rows are missing or corrupted, proceed. If data looks fine but the app is broken, investigate the app layer first.

2. **Notify the owner.** Ping the on-call contact (see [`docs/dev/prod-readiness.md`](../dev/prod-readiness.md) §10). Get a second set of eyes before a destructive restore.

3. **Pick the restore point.** Check when the incident started — look at `created_at` / `updated_at` timestamps on surviving rows, Vercel deploy logs, and Supabase project logs (`Project → Logs → API`). The Free-tier snapshot you download will be **up to ~24h old**; if the incident is older than that, see §4 (the rollback floor) before continuing.

4. **Freeze writes (if data is still being destroyed).** If the incident is ongoing (e.g., a migration is still running, or a runaway process is deleting rows), revoke the service-role key to halt writes:
   - Supabase dashboard → Project Settings → API → Service Role Key → Regenerate
   - Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel production env vars to the new key
   - Redeploy the Vercel production project (this makes the app temporarily read-only / broken — acceptable to stop the bleeding)

5. **Capture current migration state as a baseline.** Via MCP in a Claude session:
   ```
   mcp__supabase__list_migrations   # against prod project ID ycnsgkotrbjifsjkqmvn
   ```
   Save the output. You will compare this list against the restored project after §6 to detect any migrations that landed after the snapshot point and need re-applying.

---

## 3. Free-tier restore via psql

> **Free-tier restore is NOT in-place.** You download the daily snapshot, spin up a fresh Supabase project, restore via `psql`, then swap Vercel env vars to point production at the new project ref. The whole flow is ~60–90 min (§5). Pro-tier in-place PITR is in Appendix A.

### 3.1 Download the latest daily snapshot

1. Go to [app.supabase.com](https://app.supabase.com) → select `family-tree-prod`.
2. Navigate to **Project Settings → Database → Backups**.
3. Click **"Download backup"** on the latest snapshot. The file is a gzipped `pg_dump` (`backup.sql.gz`).
4. Note the snapshot timestamp shown in the dashboard — that's your effective restore point. On Free, you cannot pick an earlier time.

> No "Create backup" / on-demand button is exposed on Free; you get whatever the daily cron last produced.

### 3.2 Spin up a fresh Supabase project

1. Dashboard → **New Project**. Name it something traceable, e.g. `family-tree-prod-restore-YYYYMMDD`.
2. Choose **the same region** as `family-tree-prod` (minimises latency from Vercel functions).
3. Wait for provisioning (~2 min).
4. Capture, from Project Settings, into a local scratch file:
   - **New project ref** (visible in the URL: `https://<new-ref>.supabase.co`)
   - **Anon key** (Project Settings → API)
   - **Service-role key** (Project Settings → API)
   - **DB password** (Project Settings → Database)

### 3.3 Restore via psql

1. In the new project, go to **Project Settings → Database → Connection string** and copy the **direct** connection string (not the pooler — the pooler is for app traffic, not bulk restore).
2. Unzip the backup file:
   ```bash
   gunzip backup.sql.gz
   ```
3. Restore:
   ```bash
   psql "<connection-string>" -f backup.sql
   ```
   Expected duration: ~5–15 min depending on data volume.
4. Sanity-check the row counts:
   ```bash
   psql "<connection-string>" -c "SELECT
     (SELECT COUNT(*) FROM family_trees) AS trees,
     (SELECT COUNT(*) FROM people) AS people,
     (SELECT COUNT(*) FROM tree_members) AS members;"
   ```
   Compare against last known-good counts (see §6 for full verification).

### 3.4 Swap Vercel env vars to the new project ref

> **This step is often missed under incident pressure. Until you redeploy production with the new env vars, the app is still pointing at the OLD (broken or empty) project.**

Update on the Vercel project `meetthefam`, **Production environment** only:

| Vercel env var | New value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<new-ref>.supabase.co` (from §3.2) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New project's anon key (from §3.2) |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's service-role key (from §3.2) |

Then redeploy production:
```bash
vercel redeploy --prod
```
(Or Vercel Dashboard → Deployments → **…** → **Redeploy** on the latest production deploy.)

Verify the redeploy promoted by hitting the production URL and checking that signed-in flows hit the new project — `mcp__supabase__get_logs` against the new project ref should show the incoming traffic.

### 3.5 Storage caveat — photos NOT in DB backup

> **The downloaded backup is DB only. Photos in the Storage `photos` bucket on the lost/corrupted project are NOT included. The fresh project has an empty `photos` bucket.**

Implications:
- Person rows in the restored DB will reference Storage paths whose objects no longer exist.
- The app will show broken image icons in person cards until users re-upload.
- If the OLD project is still reachable (e.g. the loss was a DB-only `DROP TABLE`, not a project deletion), you can copy Storage objects across manually with `supabase storage cp` — a flow not yet documented; tracked as [#206](https://github.com/SanchitB23/meetthefam/issues/206).

**No offsite photo backup exists today.** Building one is tracked separately at [#206](https://github.com/SanchitB23/meetthefam/issues/206); plan to revisit alongside the next Pro-upgrade decision (§8).

---

## 4. The 1-day rollback floor

Free tier keeps exactly **one** daily snapshot. If the incident is older than ~24 hours, restore from Supabase backups is impossible.

Options at that point:

- **Manual data reconstruction** from app-level logs — Vercel access logs, Supabase auth logs, the `tree_invites` audit table — to rebuild what you can.
- **Accept the loss.**

There is no third option. This is the strongest case for upgrading to Pro (§8) — Pro's 7-day continuous-WAL window pushes the floor out to a full week and supports true point-in-time recovery.

---

## 5. Expected downtime

| Phase | Duration | User impact |
|---|---|---|
| Decide + pick restore point (§2) | 10–20 min | Writes frozen if service-role key was regenerated; app may be partially functional |
| Download backup (§3.1) | 1–5 min | Same as above |
| Provision fresh project (§3.2) | ~2 min | Same as above |
| `psql` restore (§3.3) | 5–15 min | Same as above |
| Vercel env swap + redeploy (§3.4) | 5–10 min | App down — pointing at wrong DB OR redeploying |
| Verification (§6) | 10–20 min | App live; monitor closely |

**Total realistic downtime: ~60–90 min on Free** (vs ~15–30 min on Pro via PITR — see Appendix A).

---

## 6. Post-restore verification

Run all of these against the **new project ref** before declaring the incident resolved.

**Schema parity check:**
```
# Via MCP (in a Claude session):
mcp__supabase__list_migrations    # against the new project ref from §3.2
```
Compare against the migration list saved in §2 step 5. Any drift means a migration applied after the snapshot point is missing — re-apply manually via `mcp__supabase__apply_migration` against the new project ref. Per [`docs/dev/migrations.md`](../dev/migrations.md), timestamp-prefix drift between environments is expected and OK — verify by name, not timestamp.

**RLS + advisor scan:**
```
mcp__supabase__get_advisors       # against the new project ref
```
Compare against the baseline documented in `prod-readiness.md` §1. Flag any NEW entries.

**Smoke flows:**
Run the QA smoke flows from [`docs/qa/smoke-flows.md`](../qa/smoke-flows.md) against the production URL (which now serves traffic from the new Supabase project, post-§3.4). At minimum: sign-in, view a tree, add a person.

**Row-count sanity:**
```sql
-- Run in the new project's Supabase SQL editor:
SELECT 'family_trees' AS tbl, COUNT(*) FROM family_trees
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'tree_members', COUNT(*) FROM tree_members
UNION ALL SELECT 'tree_invites', COUNT(*) FROM tree_invites;
```
Compare against the last known-good counts (Supabase logs from before the incident, or the previous DB backup metadata).

---

## 7. Communication

**During the incident (writes frozen / app degraded):**

Status page (link from repo README once wired — see `prod-readiness.md` §10):
> *"We are investigating a data issue affecting [meetthefam]. Writes are temporarily paused while we restore from backup. Expected resolution: [time]. Read access may be intermittent."*

In-app banner (if the app is still partially reachable — add via `src/app/layout.tsx` environment check):
> *"We're performing database maintenance. Your family tree data is safe. Back shortly."*

**After restore + verification complete:**

Status page update:
> *"Resolved. DB restore completed at [time]. All data has been restored to [restore-point timestamp]. If you notice any missing changes made after that time, please contact [maintainer email]."*

Remove the in-app banner and redeploy.

**Internally:** File a postmortem within 48 hours using `docs/runbooks/postmortem-template.md` (create if missing — see `prod-readiness.md` §10).

---

## 8. When to upgrade to Pro

`family-tree-prod` shipped on Free. Pro ($25/mo) buys: 7-day retention, continuous WAL backups, true point-in-time recovery via the dashboard, in-place restore (no project-ref change, no Vercel env swap).

The upgrade trigger is **reactive, not proactive.** Any of these justifies the $25/mo:

1. **First close call** — an incident where the 1-day floor (§4) was too tight, OR the Vercel env-swap restore (§3.4) caused unacceptable user-facing downtime (>90 min).
2. **First paying user** — at v2.0 paywall launch. Paying users deserve PITR.
3. **Operational fatigue** — if you find yourself stress-testing this runbook regularly, the cognitive load alone is worth $25/mo.

Until one fires, Free is fine. When you do upgrade, see **Appendix A** for the PITR path — those instructions are preserved verbatim for that future day.

---

## 9. What this runbook does NOT cover

| Topic | Where to handle it |
|---|---|
| **Partial table restore** (recover specific rows, not a full snapshot) | Manual SQL: download a daily snapshot, replay into a temp DB (steps 3.1–3.3 above against a throwaway project), then `INSERT … SELECT` the needed rows into prod |
| **Storage (`photos` bucket) object recovery** | Not covered. Tracked as [#206](https://github.com/SanchitB23/meetthefam/issues/206) — offsite photo-backup runbook. If the old project is still reachable, `supabase storage cp` between projects is the manual workaround |
| **Next.js / Vercel rollback** | Use Vercel Dashboard → Deployments → Instant Rollback, or `git revert` + push to `main` |
| **Partial migration rollback** | Write a compensating migration ([`docs/dev/migrations.md`](../dev/migrations.md)) and apply it; do not do a snapshot restore for schema-only issues |

---

## Appendix A: Pro-tier PITR (for future)

> **This section applies AFTER an upgrade to Supabase Pro. On Free, see §3 above.**

Pro tier exposes a **"Restore to point in time"** button in the Supabase dashboard. It restores the project **in place** — same project ref, same Vercel env vars, no redeploy required. Retention is 7 days with continuous WAL, so you can pick any second within the window.

### A.1 PITR via Supabase dashboard

1. Go to [app.supabase.com](https://app.supabase.com) → select `family-tree-prod`.
2. Navigate to **Project Settings → Database → Backups**.
3. Click **"Restore to point in time"** (only visible on Pro plan).
4. Use the calendar/time picker to select the restore timestamp identified in §2 step 3.
5. Read the confirmation dialog carefully — it lists what will be overwritten.
6. Click **Confirm**. The restore begins immediately.

### A.2 Expected downtime on Pro

| Phase | Duration | User impact |
|---|---|---|
| Restore in progress | 5–15 min | Project URL stays the same; reads and writes are paused. The app shows errors or a loading state. |
| Post-restore startup | ~1 min | Connections re-established automatically. |
| Verification (§6) | 10–20 min | App stays live but monitor closely. |

Total expected downtime on Pro: **~15–30 min** for a typical restore — roughly a third of the Free-tier path.

### A.3 What Pro does NOT change

- §3.5 still applies: **Storage objects are not covered by PITR.** Photos uploaded between the restore point and the incident are still lost unless the offsite photo-backup story ([#206](https://github.com/SanchitB23/meetthefam/issues/206)) has landed.
- §6's verification flow is unchanged — schema parity, advisor scan, smoke flows, row counts all still need running.
- §7's communication template is unchanged.
