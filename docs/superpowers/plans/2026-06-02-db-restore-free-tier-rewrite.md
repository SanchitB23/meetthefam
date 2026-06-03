# DB restore runbook — Free-tier rewrite (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `docs/runbooks/db-restore.md` to match the Supabase Free-tier reality `family-tree-prod` shipped on at v1.0; preserve Pro-tier instructions verbatim in an appendix; update the cross-ref in `docs/dev/prod-readiness.md`; file a follow-up issue for an offsite photo-backup runbook.

**Architecture:** Pure docs-only edit. One file rewritten end-to-end (`db-restore.md`), one file lightly touched (`prod-readiness.md`), one GitHub issue filed during implementation so the rewrite can reference it by number. No code changes, no migrations, no DB touch.

**Tech Stack:** Markdown. `gh` CLI for the follow-up issue + draft PR. No build / typecheck / lint required since nothing under `src/` changes.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-02-db-restore-free-tier-rewrite-design.md` — read this first.
- Current runbook: `docs/runbooks/db-restore.md`
- Cross-ref target: `docs/dev/prod-readiness.md` lines 141–142
- PR template: `.github/pull_request_template.md`

**Branch:** `docs/179-db-restore-free-tier` (already created by the brainstorming pass; the spec is committed as `a5619c3`).

**Closes:** `#179` (bare, in PR body).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `docs/runbooks/db-restore.md` | **Rewrite** | The new Free-tier restore runbook; old Pro instructions move to Appendix A verbatim |
| `docs/dev/prod-readiness.md` | **Edit** (lines 141–142 only) | Update the launch-gate checklist to reflect the resolved tier decision + the rewritten runbook |
| `docs/superpowers/specs/2026-06-02-db-restore-free-tier-rewrite-design.md` | (already committed) | The design contract — no edits during implementation |

No `src/` changes. No tests. `pnpm typecheck` / `pnpm lint` / `pnpm test` not required for this PR.

---

### Task 1: File the follow-up issue for an offsite photo-backup runbook

**Why first:** The rewrite's §3.5 must reference the follow-up by number. Filing first means we don't go back and patch the doc after.

**Files:** None modified. Output is a GitHub issue.

- [ ] **Step 1: Verify `gh auth status` is OK and you're targeting the right repo**

Run:
```bash
gh auth status
gh repo view --json nameWithOwner | jq -r .nameWithOwner
```

Expected: `SanchitB23/meetthefam`. Stop if either fails.

- [ ] **Step 2: Create the follow-up issue**

Run (HEREDOC for the body):
```bash
gh issue create \
  --title "docs: offsite photo-backup runbook (Storage bucket survives DB restore)" \
  --milestone "v1.1 — Post-launch polish" \
  --label "documentation,enhancement,needs-human" \
  --body "$(cat <<'EOF'
## Why

The DB restore runbook rewrite for Supabase Free tier (#179) surfaced a real gap: **DB backups do NOT include Storage objects**. The `photos` bucket lives in the Supabase project, not in the daily `pg_dump` snapshot.

That means in a DB-restore scenario (download daily backup → fresh project → \`psql\` restore), the new project has an empty \`photos\` bucket. Person rows reference Storage paths whose objects no longer exist; the app shows broken image icons until users re-upload.

Today there is **no offsite copy** of the \`photos\` bucket. If the old project is still reachable, a manual \`supabase storage cp\` could move objects across — but if the loss was project-level (e.g. account deletion, ransomware), photos are gone.

## What this issue tracks

A runbook (and possibly tooling) for an offsite photo backup story:

1. Where do we copy the bucket TO? (S3? Local disk? Another Supabase project?)
2. How often? (Nightly cron? On-demand before risky operations?)
3. How do we restore from it after a DB restore?
4. Cost + complexity vs. the risk of photo loss.

## Related

- Surfaced during #179 (DB restore runbook rewrite).
- See \`docs/runbooks/db-restore.md\` §3.5 (after #179 lands) for the gap statement.

## Out of scope

- Upgrading to Pro for Storage backups (separate decision, gated on #179 §8 triggers).
- Generic disaster-recovery scope creep.
EOF
)"
```

Expected output: `https://github.com/SanchitB23/meetthefam/issues/<N>` printed.

- [ ] **Step 3: Capture the new issue number**

Run:
```bash
gh issue list --milestone "v1.1 — Post-launch polish" --state open \
  --search "offsite photo-backup" --json number,title \
  | jq -r '.[0] | "\(.number)\t\(.title)"'
```

Expected: one row with the new issue number. **Note this number — you will reference it as `<PHOTO_BACKUP_ISSUE>` in Task 2.**

- [ ] **Step 4: Commit — nothing to commit (issue is on GitHub, not in the repo)**

This task produced no file changes. Continue to Task 2.

---

### Task 2: Rewrite `docs/runbooks/db-restore.md`

**Files:**
- Rewrite: `docs/runbooks/db-restore.md` (currently 141 lines; target ~220 lines including Appendix A)

This is the bulk of the PR. The rewrite preserves §1, §2 (trimmed), §6, §7, §9 from the original, replaces §3 with the Free-tier path, adds §4 (1-day floor) + §8 (Pro-upgrade triggers), rewrites §5 (downtime), and appends Appendix A with the old Pro instructions.

- [ ] **Step 1: Re-read the spec to load section-by-section content brief**

Open `docs/superpowers/specs/2026-06-02-db-restore-free-tier-rewrite-design.md` and re-read the **"Section-by-section content brief"** section. Every concrete content choice for the rewrite is there. Don't paraphrase from memory — use the spec as the source of truth.

- [ ] **Step 2: Write the new `docs/runbooks/db-restore.md` end-to-end**

Use the Write tool to overwrite the file with the new content. Structure (per spec):

```
# DB Restore Runbook — Supabase Free Tier
(intro: scope, what-this-is-not, prod project ref `ycnsgkotrbjifsjkqmvn`,
 link to releases.md for Vercel rollbacks)

---

## 1. When to use this runbook
   [verbatim from old §1 — destructive migration / malformed bulk write / ransomware
    triggers; do-NOT-use list: app bugs / Vercel rollback / single-row corrections /
    Storage loss handled in §3.5 + the follow-up issue]

---

## 2. Pre-checks before restoring
   1. Confirm it is data loss, not a bug         [keep verbatim from old §2 step 1]
   2. Notify the owner                            [keep verbatim from old §2 step 2]
   3. Pick the restore point                      [keep verbatim from old §2 step 3]
   4. Freeze writes (if data is still being destroyed)  [keep wording; remove any
       Pro implication; service-role-key regen still works on Free]
   5. Note current migration state                [rewrite — replace
       `pnpm exec supabase db diff --linked` with `mcp__supabase__list_migrations`
       against project ref `ycnsgkotrbjifsjkqmvn` so we have a baseline list to
       compare against after restore]

---

## 3. Free-tier restore via psql

### 3.1 Download the latest daily snapshot
   - Dashboard → Project Settings → Database → Backups
   - Latest snapshot is up to ~24h old; no on-demand backups on Free
   - Click "Download backup" → gzipped pg_dump file

### 3.2 Spin up a fresh Supabase project
   - Dashboard → New Project — name e.g. `family-tree-prod-restore-YYYYMMDD`
   - Same region as `family-tree-prod` to minimise latency from Vercel functions
   - Capture from Project Settings:
     * new project ref (URL: `https://<new-ref>.supabase.co`)
     * anon key
     * service-role key
     * DB password
   - Wait for provisioning (~2 min)

### 3.3 Restore via psql
   - Project Settings → Database → Connection string → use the **direct** connection
     (not the pooler — pooler is for app traffic, not bulk restore)
   - Unzip the backup file: `gunzip backup.sql.gz`
   - Run:
     ```bash
     psql "<connection-string>" -f backup.sql
     ```
   - Restore takes ~5–15 min depending on data volume
   - Verify with a quick row count:
     ```bash
     psql "<connection-string>" -c "SELECT
       (SELECT COUNT(*) FROM family_trees) AS trees,
       (SELECT COUNT(*) FROM people) AS people,
       (SELECT COUNT(*) FROM tree_members) AS members;"
     ```
   - Compare against §5's expected counts (captured pre-incident)

### 3.4 Swap Vercel env vars to the new project ref
   > **This step is often missed under incident pressure. Until you redeploy
   > production with the new env vars, the app is pointing at the OLD project.**

   Update on Vercel project `meetthefam`, **Production environment** only:

   | Vercel env var | New value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<new-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New project's anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | New project's service-role key |

   Then redeploy:
   ```bash
   vercel redeploy --prod
   ```
   (Or Vercel Dashboard → Deployments → … → Redeploy on the latest production deploy.)

### 3.5 Storage caveat — photos NOT in DB backup
   > **The downloaded backup is DB only. Photos in the Storage `photos` bucket on
   > the lost/corrupted project are NOT included. The fresh project has an empty
   > `photos` bucket.**

   Implications:
   - Person rows in the restored DB will reference Storage paths whose objects no
     longer exist
   - The app will show broken image icons until users re-upload
   - If the OLD project is still reachable (e.g. DB-only `DROP TABLE`, not project
     deletion), you can copy objects across manually with `supabase storage cp` —
     a flow not yet documented (see #<PHOTO_BACKUP_ISSUE> for the follow-up runbook)

   **No offsite photo backup exists today.** Tracked: #<PHOTO_BACKUP_ISSUE>.

---

## 4. The 1-day rollback floor

   Free tier keeps exactly **one** daily snapshot. If the incident is older than
   ~24 hours, restore from Supabase backups is impossible.

   Options at that point:
   - Manual data reconstruction from app-level logs (Vercel access logs, Supabase
     auth logs, share-link audit table)
   - Accept the loss

   This is the strongest case for upgrading to Pro — see §8.

---

## 5. Expected downtime

   | Phase | Duration | User impact |
   |---|---|---|
   | Decide + pick restore point (§2) | 10–20 min | Writes frozen if service-role key regenerated |
   | Download backup (§3.1) | 1–5 min | Same as above |
   | Provision fresh project (§3.2) | ~2 min | Same as above |
   | `psql` restore (§3.3) | 5–15 min | Same as above |
   | Vercel env swap + redeploy (§3.4) | 5–10 min | App down — wrong DB OR redeploying |
   | Verification (§6) | 10–20 min | App live, monitor closely |

   **Total realistic downtime: ~60–90 min on Free** (vs ~15–30 min on Pro via
   PITR — see Appendix A for comparison).

---

## 6. Post-restore verification

   [keep §5 from old runbook structure; tweaks:]

   **Schema parity check:**
   ```
   # Via MCP (in a Claude session):
   mcp__supabase__list_migrations    # against the NEW project ref from §3.2
   ```
   Compare against the migration list saved in §2 step 5. Any drift means a
   migration applied after the snapshot point is missing — re-apply manually via
   `mcp__supabase__apply_migration` against the new project ref.

   **RLS + advisor scan:**
   ```
   mcp__supabase__get_advisors       # against the NEW project ref
   ```
   Compare against the baseline in `prod-readiness.md §1`. Flag any new entries.

   **Smoke flows:** run the QA smoke flows from `docs/qa/smoke-flows.md` against
   the production URL (which now serves traffic from the new Supabase project).
   At minimum: sign-in, view a tree, add a person.

   **Row-count sanity:**
   ```sql
   SELECT 'family_trees' AS tbl, COUNT(*) FROM family_trees
   UNION ALL SELECT 'people', COUNT(*) FROM people
   UNION ALL SELECT 'tree_members', COUNT(*) FROM tree_members
   UNION ALL SELECT 'tree_invites', COUNT(*) FROM tree_invites;
   ```
   Compare against last known-good counts.

---

## 7. Communication
   [verbatim from old §6 — status-page copy, in-app banner copy, postmortem
    requirement; no Pro-tier wording to remove]

---

## 8. When to upgrade to Pro

   `family-tree-prod` shipped on Free. Pro ($25/mo) buys: 7-day retention,
   continuous WAL backups, true point-in-time recovery via dashboard, in-place
   restore (no project-ref change, no Vercel env swap).

   Upgrade triggers — any of which justify the cost:

   1. **First close call** — an incident where the 1-day floor was too tight
      (data older than 24h needed) or the Vercel-env-swap restore took
      unacceptably long (>90 min user-facing downtime).
   2. **First paying user** — at v2.0 paywall launch. Paying users deserve PITR.
   3. **Operational fatigue** — if you find yourself stress-testing this runbook
      regularly, the cognitive load alone is worth $25/mo.

   The trigger is reactive, not proactive. Until one fires, Free is fine.

---

## 9. What this runbook does NOT cover
   [verbatim from old §7 — partial table restore, Storage object recovery,
    Next.js/Vercel rollback, partial migration rollback; cross-references all
    still resolve correctly on Free]

---

## Appendix A: Pro-tier PITR (for future)

   > **This section applies AFTER an upgrade to Supabase Pro. On Free, see §3 above.**

   [old §3 content, verbatim]
   [old §4's Pro downtime row preserved here as a Pro-vs-Free table comparison]
```

When writing the appendix: copy the old §3 ("Point-in-time restore via Supabase dashboard") and the Pro row of the old §4 downtime table **verbatim** from the pre-rewrite version. Don't editorialise — the spec says preserve them as-is.

Replace `<PHOTO_BACKUP_ISSUE>` everywhere with the actual issue number from Task 1 step 3.

- [ ] **Step 3: Verify the rewrite by reading it end-to-end**

Open the new file. Spot-check:
- No "Click 'Restore to point in time'" outside Appendix A
- No "Pro tier" / "PITR" wording in §1–§9 except where contrasting against Free (and in §8, §5 table)
- §3.5 references the actual `#<N>` (not the placeholder `<PHOTO_BACKUP_ISSUE>`)
- §3.4's three env-var names match the codebase (grep to confirm):
  ```bash
  grep -r "NEXT_PUBLIC_SUPABASE_URL\|NEXT_PUBLIC_SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY" \
    src/ --include="*.ts" --include="*.tsx" -l | head -5
  ```
  Expected: hits in `src/lib/supabase/*` and similar. If a name has changed, fix the doc.
- Section numbering (1 → 9 → Appendix A) is continuous

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/db-restore.md
git commit -m "$(cat <<'EOF'
docs(#179): rewrite db-restore.md for Supabase Free-tier reality

family-tree-prod shipped on Free at v1.0 — the old runbook assumed Pro
(PITR via dashboard, in-place restore) and would have failed under any
real incident.

- §3 replaced with the Free-tier path: download daily snapshot → fresh
  project → psql restore → Vercel env swap → redeploy
- §3.5: loud Storage caveat (DB backup does NOT include photos);
  follow-up issue tracked separately
- §4 new: the 1-day rollback floor is a hard limit
- §5 rewritten: realistic ~60–90 min downtime (vs ~15–30 min on Pro)
- §8 new: reactive Pro-upgrade triggers — first close call / first
  paying user / operational fatigue
- Appendix A: old Pro instructions preserved verbatim for v2.0 upgrade

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update `docs/dev/prod-readiness.md` lines 141–142

**Files:**
- Edit: `docs/dev/prod-readiness.md:141-142`

- [ ] **Step 1: Read the current lines to confirm exact text**

```bash
sed -n '140,143p' docs/dev/prod-readiness.md
```

Expected:
```
- [ ] Tier decision: Supabase Free (1-day backup retention) vs Pro (7-day + point-in-time recovery). Pro is $25/mo; consider closer to launch.
- [ ] DB restore runbook: [`docs/runbooks/db-restore.md`](../runbooks/db-restore.md) — covers PITR via Supabase dashboard, pre-checks, verification, and comms. (≤200 lines, no screenshots required for v1.)
```

- [ ] **Step 2: Apply the edit via the Edit tool**

Replace the two lines with:
```
- [x] Tier decision: shipped on Free at v1.0. Pro is $25/mo and reactive — see `docs/runbooks/db-restore.md` §8 for upgrade triggers; revisit at v2.0 (paywall launch).
- [x] DB restore runbook: [`docs/runbooks/db-restore.md`](../runbooks/db-restore.md) — covers Free-tier `psql` restore path, Vercel env swap, Storage caveat, verification, and comms. Pro-tier PITR preserved in Appendix A.
```

- [ ] **Step 3: Verify the edit applied correctly**

```bash
sed -n '140,143p' docs/dev/prod-readiness.md
```

Expected: the two new lines (both `[x]`) appear at the same line numbers.

- [ ] **Step 4: Commit**

```bash
git add docs/dev/prod-readiness.md
git commit -m "$(cat <<'EOF'
docs(#179): mark prod-readiness §9 tier-decision + restore-runbook resolved

The launch-gate boxes for tier decision (Free vs Pro) and DB restore
runbook coverage are both resolved as of v1.0 / this PR. Updates the
runbook description to reflect the Free-tier reality and the Pro
appendix.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Cross-reference sanity sweep

**Files:** None modified. Verification only.

- [ ] **Step 1: Find every reference to `db-restore` in the repo**

```bash
grep -rn "db-restore\|db_restore\|DB Restore Runbook" docs/ src/ .github/ 2>/dev/null | grep -v "docs/superpowers/"
```

Expected hits:
- `docs/dev/prod-readiness.md` (the one we just edited)
- Maybe a few historical mentions in `docs/archive/` — leave those alone

- [ ] **Step 2: Verify any in-doc links inside `db-restore.md` still resolve**

```bash
grep -oE "\(\.\./[^)]+\)|\(#[^)]+\)" docs/runbooks/db-restore.md | sort -u
```

For each `(../path)`, confirm the file exists:
```bash
# Manually for each unique link found
ls -la docs/dev/releases.md docs/dev/migrations.md docs/qa/smoke-flows.md \
       docs/runbooks/postmortem-template.md 2>&1 | head -10
```

If a referenced file doesn't exist (e.g. `postmortem-template.md` may still be unwritten), leave the reference — it's part of the existing runbook's deferred-future cross-refs. Not in scope for #179.

- [ ] **Step 3: Verify PITR-only references are gone from §1–§9**

```bash
awk '/^## Appendix A/{exit} {print}' docs/runbooks/db-restore.md | \
  grep -niE "point.in.time|PITR|Restore to point in time|Pro tier" || \
  echo "PASS: no Pro-only references outside Appendix A"
```

Expected: `PASS: no Pro-only references outside Appendix A`

Acceptable matches: §5 downtime table contrasting Free vs Pro; §8's Pro-upgrade triggers (those are intentional). If `grep` returns any Pro-only references in §3 or §4, fix them in `db-restore.md` and re-run.

- [ ] **Step 4: No commit needed**

This task only verifies; if §3 caught a fix, commit it as a fix-up commit:
```bash
git add docs/runbooks/db-restore.md
git commit -m "docs(#179): scrub residual Pro-only references"
```

---

### Task 5: Open the draft PR

**Files:** None modified. Output is a GitHub PR.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin docs/179-db-restore-free-tier
```

Expected: branch published; PR-create hint URL in the output.

- [ ] **Step 2: Open the PR as a draft**

Run (HEREDOC; replace `<PHOTO_BACKUP_ISSUE>` with the actual number from Task 1 step 3):

```bash
gh pr create \
  --draft \
  --base qa \
  --title "docs(#179): rewrite db-restore.md for Supabase Free-tier reality" \
  --body "$(cat <<'EOF'
## Summary

- Rewrites \`docs/runbooks/db-restore.md\` to match the Free-tier reality \`family-tree-prod\` shipped on at v1.0 — the old runbook assumed Pro (PITR via dashboard, in-place restore) and would have failed under any real incident.
- Adds the §3.5 Storage caveat (DB backup does NOT include photos) and a §8 reactive Pro-upgrade trigger list (first close call / first paying user / operational fatigue).
- Preserves the old Pro instructions verbatim in **Appendix A** for the v2.0 upgrade window — zero-cost future-proofing.
- Updates the matching launch-gate cross-ref in \`docs/dev/prod-readiness.md\` (both boxes \`[x]\`).
- Files a follow-up issue (#<PHOTO_BACKUP_ISSUE>) for an offsite photo-backup runbook, referenced by number inside §3.5.

## Closes

Closes #179

## Spec + plan

- Spec: \`docs/superpowers/specs/2026-06-02-db-restore-free-tier-rewrite-design.md\` (committed as \`a5619c3\`)
- Plan: \`docs/superpowers/plans/2026-06-02-db-restore-free-tier-rewrite.md\`

## Test plan

This is docs-only — no \`pnpm typecheck\` / \`pnpm lint\` / \`pnpm test\` impact. Manual review only:

- [x] No "Click 'Restore to point in time'" outside Appendix A
- [x] §3.4's env-var names match the codebase (\`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`)
- [x] §3.5 references the follow-up issue by number, not as a placeholder
- [x] Section numbering 1 → 9 → Appendix A is continuous
- [x] In-doc cross-refs resolve (\`releases.md\`, \`migrations.md\`, \`smoke-flows.md\`, \`prod-readiness.md\`)
- [x] \`docs/dev/prod-readiness.md\` lines 141–142 are both \`[x]\` and reference the rewritten runbook
- [ ] Reviewer: read the runbook top to bottom, confirm the Free-tier path is followable cold under incident pressure

## Out of scope

- Writing the offsite photo-backup runbook itself (#<PHOTO_BACKUP_ISSUE>)
- Actually upgrading to Pro (separate decision, gated on §8 triggers)
- Code changes — this is docs-only

## Notes for reviewer

The biggest substantive change: the runbook now spells out that **Free-tier restore is NOT in-place**. Project ref changes → Vercel env swap → app downtime is ~60–90 min, not ~15–30 min. If we hadn't surfaced this, an incident-time read would have assumed PITR semantics and missed the env-swap step.
EOF
)"
```

Expected output: PR URL printed.

- [ ] **Step 3: Mark the PR's \`Closes #N\` numbers**

After the PR is created, double-check the body in the GitHub UI:
- The \`Closes #179\` line is bare (no markdown link wrap)
- The PR is in draft state
- The milestone is set (if it didn't auto-pick from the issue, set it: `gh pr edit <N> --milestone "v1.1 — Post-launch polish"`)

- [ ] **Step 4: Hand back to the user**

Report:
- PR URL
- Branch name
- Issue numbers closed (#179) and referenced (#<PHOTO_BACKUP_ISSUE>)
- A one-line "ready for review" — the user marks it ready themselves.

---

## Self-review checklist

After completing all tasks, verify:

- [ ] **Spec coverage:** every section of the spec's "Section-by-section content brief" has a corresponding chunk in Task 2 Step 2. Acceptance criteria #1–#8 in the spec all map to a task step.
- [ ] **No placeholders:** the doc contains a real `#<N>` (not `<PHOTO_BACKUP_ISSUE>`), the project ref is `ycnsgkotrbjifsjkqmvn` (not `<prod-ref>`), Vercel env-var names match the codebase exactly.
- [ ] **Type / name consistency:** `NEXT_PUBLIC_SUPABASE_URL` vs `SUPABASE_URL` (we use the public-prefixed name) — verified via grep in Task 2 Step 3.
- [ ] **No production changes:** the PR touches `docs/**` only.
- [ ] **Issue-anchored:** branch name = `docs/179-db-restore-free-tier`, PR body has bare `Closes #179`, milestone = `v1.1 — Post-launch polish`.
- [ ] **Draft PR opened:** not ready-for-review; user marks ready themselves.
