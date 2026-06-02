# DB restore runbook — Free-tier rewrite

> Spec for [#179](https://github.com/SanchitB23/meetthefam/issues/179) — rewriting
> `docs/runbooks/db-restore.md` to match the Supabase Free-tier reality the project
> shipped on at v1.0 launch. Authored via `superpowers:brainstorming` on 2026-06-02.

## Why

`docs/runbooks/db-restore.md` today is written end-to-end assuming Supabase Pro tier:
§3 says *"Click 'Restore to point in time'"*, which is a Pro-only UI affordance.

But `family-tree-prod` (`ycnsgkotrbjifsjkqmvn`) shipped on **Free** at v1.0 — the
$25/mo Pro upgrade didn't pencil out against zero traffic. Free has very different
restore characteristics:

| | Free | Pro |
|---|---|---|
| Backup frequency | Daily | Continuous (WAL) |
| Retention | 1 day | 7 days |
| Restore granularity | Whole-snapshot (no point-in-time) | Any timestamp in the window |
| Restore mechanism | Download backup → fresh project → `psql` | In-place via dashboard |
| Project ref after restore | **Changes** (new project) | Same |
| Vercel env swap required | **Yes** (new URL + keys) | No |
| Storage objects in backup | **No** (DB only) | No (same on both, but louder on Free) |
| Realistic downtime | ~60–90 min | ~15–30 min |

The runbook today doesn't say any of this. If an incident happened tomorrow, whoever
opened the runbook would search for a button that doesn't exist, then improvise
under pressure. That's the bug.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Rewrite scope** | Replace §3 in place; keep tier-agnostic sections (§1, §2 trimmed, §5–7, §9) | Most of the runbook applies regardless of tier — only the restore mechanism + downtime + a few pre-checks change |
| **Pro-tier instructions** | Move to **Appendix A**, preserved verbatim | Zero-cost future-proofing for when we upgrade at v2.0 (paywall launch). Re-deriving the steps under incident pressure is worse than carrying a 30-line appendix |
| **Pro-upgrade trigger** | Reactive: "after first close call" | User decision (brainstorm Q1). Stay on Free until an incident exposes the 1-day floor or the Vercel-env-swap restore is too painful. Also auto-upgrade at v2.0 paywall launch |
| **Storage caveat** | Loud, explicit subsection inside §3 + file a follow-up issue for an offsite-photo-backup story | DB backup does NOT include Storage. Photos uploaded between the last backup and the incident are lost. The runbook must state this hard so future-Sanchit doesn't assume photos rode along |
| **Cross-ref to `prod-readiness.md §9`** | Update lines 141–142 in the same PR | One-line touch — keeping the cross-ref accurate is cheaper than two PRs |
| **Project-ref change is the surprise** | Get its own subsection (§3.4) with the exact Vercel env vars to swap + `vercel redeploy --prod` | The runbook's hardest path — needs the most detail; failure to swap leaves the app pointing at an empty DB |

## Target structure (new)

```
1. When to use this runbook              [unchanged — tier-agnostic]
2. Pre-checks before restoring           [trimmed — drop the Pro-only references in step 5]
3. Free-tier restore via psql            [NEW — replaces dashboard PITR]
   3.1 Download the latest daily snapshot
   3.2 Spin up a fresh Supabase project
   3.3 Restore via psql
   3.4 Swap Vercel env vars to the new project ref
   3.5 Storage caveat — photos NOT in DB backup
4. The 1-day rollback floor              [NEW short section — hard limit]
5. Expected downtime                     [rewritten — 60–90 min on Free vs 15–30 min on Pro]
6. Post-restore verification             [mostly unchanged — schema diff, advisor scan, smoke flows, row counts]
7. Communication                         [unchanged — same status-page + in-app banner copy]
8. When to upgrade to Pro                [NEW short section — "after first close call" trigger]
9. What this runbook does NOT cover      [unchanged]
Appendix A: Pro-tier PITR (for future)   [moved here from old §3 — preserved verbatim]
```

## Section-by-section content brief

### §1 When to use this runbook
Unchanged. The trigger criteria (destructive migration, malformed bulk write, ransomware-style destruction) and the do-NOT-use list (app bugs, Vercel rollback, single-row fixes, Storage loss) apply on either tier.

### §2 Pre-checks
- **Keep**: steps 1–3 (confirm data loss, notify owner, pick restore point).
- **Trim**: step 4 — the "Freeze writes" service-role-key regeneration still works; remove any Pro-implication wording.
- **Trim**: step 5 — drop `pnpm exec supabase db diff --linked` against the prod project (you don't have ongoing schema-diff capability against a Free project the same way; explain we'll capture schema state via `mcp__supabase__list_migrations` instead).

### §3 Free-tier restore via psql (the new core)

**§3.1 Download the latest daily snapshot.**
- Dashboard → Project Settings → Database → Backups
- Latest available snapshot is from up to ~24 hours ago (no on-demand backups on Free)
- Click "Download backup" — produces a gzipped `pg_dump` file

**§3.2 Spin up a fresh Supabase project.**
- Create a new project (any name, e.g. `family-tree-prod-restore-YYYYMMDD`)
- Note the new project ref (will appear in URL: `https://<new-ref>.supabase.co`)
- Wait for it to provision (~2 min)
- Capture the new anon key, service-role key, and DB password from Project Settings

**§3.3 Restore via psql.**
- Get the DB connection string from Project Settings → Database → Connection string (use the direct connection, not pooler, for restore)
- Run `psql "<connection-string>" -f <unzipped-backup.sql>` from a machine with network access to Supabase
- Restore takes ~5–15 min depending on data volume
- Verify with `psql "<connection-string>" -c "SELECT count(*) FROM people;"` etc.

**§3.4 Swap Vercel env vars to the new project ref.**

This is the step that often gets missed under incident pressure. Three env vars to update on the `meetthefam` Vercel project, Production environment:

| Vercel env var | New value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<new-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New project's anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's service-role key |

Then **redeploy production** (`vercel redeploy --prod` or Vercel Dashboard → Deployments → … → Redeploy on the latest production deploy). Until this redeploy completes, the app is pointing at the OLD (broken or empty) project.

**§3.5 Storage caveat — photos NOT in DB backup.**

The downloaded backup is **DB only**. Photos in the Storage bucket on the lost/corrupted project are NOT included. The fresh project has an empty `photos` bucket.

Implications:
- Person rows in the restored DB will reference Storage paths whose objects no longer exist
- The app will show broken image icons until the user re-uploads
- If the OLD project is still reachable (e.g., the loss was a `DROP TABLE` on DB only, not a project deletion), you can copy Storage objects across — but this is a manual `supabase storage cp` flow not covered here

**No offsite photo backup exists today.** A follow-up issue will track building one (out of scope for #179).

### §4 The 1-day rollback floor (NEW)

Hard limit: **Free tier keeps exactly 1 daily snapshot.** If the incident is older than ~24 hours, restore from Supabase backups is impossible. Other options at that point: manual data reconstruction from app-level logs (Vercel access logs, Supabase auth logs, share-link audit), or accept the loss. There is no third option.

This is the strongest case for upgrading to Pro (§8).

### §5 Expected downtime (rewritten)

| Phase | Duration | User impact |
|---|---|---|
| Decide + pick restore point (§2) | 10–20 min | Writes frozen if service-role key regenerated; app may be partially functional |
| Download backup (§3.1) | 1–5 min | Same as above |
| Provision fresh project (§3.2) | ~2 min | Same as above |
| `psql` restore (§3.3) | 5–15 min | Same as above |
| Vercel env swap + redeploy (§3.4) | 5–10 min | App down — wrong DB OR redeploying |
| Verification (§6) | 10–20 min | App live, monitor closely |

**Total realistic downtime: ~60–90 min** on Free (vs ~15–30 min on Pro via PITR — see Appendix A for comparison).

### §6 Post-restore verification

Mostly unchanged. Tweaks:
- Schema-parity check: use `mcp__supabase__list_migrations` against the new project ref (not `pnpm exec supabase db diff --linked` which requires `--linked` to a specific project — the new project isn't linked locally yet)
- Replace prod project ID in MCP examples: the new ref is whatever §3.2 produced, not `ycnsgkotrbjifsjkqmvn`
- Row-count sanity SQL is unchanged
- Smoke flows from `docs/qa/smoke-flows.md` are unchanged

### §7 Communication
Unchanged. Same status-page + in-app banner copy. Same postmortem requirement.

### §8 When to upgrade to Pro (NEW)

Triggers, any of which justify the $25/mo:

1. **First close call** — an incident where the 1-day backup floor was too tight (data older than 24h was needed) or the Vercel-env-swap restore took unacceptably long (>90 min user-facing downtime).
2. **First paying user** — paywall launch at v2.0. Paying users deserve PITR.
3. **Operational fatigue** — if you find yourself stress-testing this runbook regularly, the cognitive load alone is worth $25/mo.

The trigger is reactive, not proactive. Until one fires, Free is fine.

### §9 What this runbook does NOT cover
Unchanged — partial table restore, Storage object recovery, Next.js / Vercel rollback, partial migration rollback. All still cross-reference correctly on Free.

### Appendix A: Pro-tier PITR (for future)
Verbatim copy of the old §3 + the old §4's Pro downtime row. Heading prefixed with: *"This section applies AFTER an upgrade to Supabase Pro. On Free, see §3 above."*

## Cross-ref touch

`docs/dev/prod-readiness.md` lines 141–142, current:
```md
- [ ] Tier decision: Supabase Free (1-day backup retention) vs Pro (7-day + point-in-time recovery). Pro is $25/mo; consider closer to launch.
- [ ] DB restore runbook: [`docs/runbooks/db-restore.md`](../runbooks/db-restore.md) — covers PITR via Supabase dashboard, pre-checks, verification, and comms. (≤200 lines, no screenshots required for v1.)
```

After:
```md
- [x] Tier decision: shipped on Free at v1.0. Pro is $25/mo and reactive — see `docs/runbooks/db-restore.md §8` for upgrade triggers; revisit at v2.0 (paywall launch).
- [x] DB restore runbook: [`docs/runbooks/db-restore.md`](../runbooks/db-restore.md) — covers Free-tier `psql` restore path, Vercel env swap, Storage caveat, verification, and comms. Pro-tier PITR preserved in Appendix A.
```

(Boxes ticked because both items are now resolved decisions, not pending ones.)

## Out of scope

- **Offsite photo backup runbook** — file a sibling issue under the v1.1 (or v1.2) milestone. Important but separable.
- **Actually upgrading to Pro** — that's a separate decision, gated on the §8 triggers.
- **Any code changes** — this is docs-only.
- **Screenshots** — the existing runbook explicitly says "no screenshots required for v1." Preserve that.

## Constraints honored

- **Docs-only — no production changes.** Pure markdown rewrite. No DB, no Vercel-config, no migrations.
- **Issue-anchored workflow** — branch `docs/179-db-restore-free-tier`, PR carries bare `Closes #179`, milestone `v1.1 — Post-launch polish`.
- **Per-cycle constraints** — meetthefam is pre-paywall, India-oriented; the rewrite assumes the operational shape we actually have, not a hypothetical Pro setup.

## Acceptance criteria

The rewrite is done when:

1. `docs/runbooks/db-restore.md` has no remaining references to "Restore to point in time" or "Pro tier" except in Appendix A.
2. §3 walks through download → fresh project → `psql` → Vercel env swap → Storage caveat in that exact order with concrete commands.
3. §4 makes the 1-day floor unambiguous.
4. §5 downtime table reflects ~60–90 min on Free.
5. §8 spells out the three "upgrade-to-Pro" triggers.
6. Appendix A preserves the old Pro instructions verbatim under a "for future" header.
7. `docs/dev/prod-readiness.md` lines 141–142 are updated to match.
8. A follow-up GitHub issue exists for an offsite photo backup runbook — filed during implementation, linked from the PR body, and the new doc references it by number inside §3.5.

## Sequencing

1. Spec (this file) committed first under `docs/179-db-restore-free-tier`.
2. `superpowers:writing-plans` produces an implementation plan.
3. Implementation: edit `docs/runbooks/db-restore.md` + `docs/dev/prod-readiness.md`, file the follow-up issue, commit, open PR.
4. PR carries `Closes #179` (bare), milestone v1.1.
