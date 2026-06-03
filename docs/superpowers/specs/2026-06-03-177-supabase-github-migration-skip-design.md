# Investigation spec — Supabase ↔ GitHub integration skipped `tree_invites` on the v1.0.0 merge

> Issue: [#177](https://github.com/SanchitB23/meetthefam/issues/177) · Milestone: v1.1 — Post-launch polish · Date: 2026-06-03
> Type: investigation (`question`, `needs-human`). Not a feature build.

## Problem

On the v1.0.0 merge to `main` (PR #174, merge commit `071fcbb`, 2026-05-31), the Supabase ↔ GitHub
integration on `family-tree-prod` (`ycnsgkotrbjifsjkqmvn`) did **not** auto-apply the pending
`tree_invites` migration (`20260513211135_tree_invites.sql`). It had to be applied manually via
`mcp__supabase__apply_migration` ~10 minutes later. Earlier migrations had appeared on prod
seemingly "for free," so the skip was surprising and undermined trust in the auto-apply path.

## What is already mitigated (before this investigation)

Half of #177's acceptance criteria already shipped via **releases.md Amendment 5 (2026-06-01)**:
release recipe **step #7** instructs verifying QA↔prod migration parity post-release with
`list_migrations` and applying any missing migration manually (fallback: `prod-readiness.md §1`).
So the *operational* risk is already contained. The genuinely open item is the **root cause**.

## Evidence gathered (2026-06-03)

### Live migration state

| Migration | prod (`ycns…`) | QA (`ljjv…`) |
|---|---|---|
| `initial_schema` … `photos_select_policy_tighten` (7 historical) | ✅ | ✅ |
| `tree_invites` | ✅ (manual, stamped `20260531144055`) | ✅ |
| `harden_tree_invites_functions` | ❌ | ✅ |
| `add_tree_invites_fk_indexes` | ❌ | ✅ |

The two newest migrations are on QA but **not yet on `main`** (no release cut since v1.0.0), so prod
legitimately lacks them. They are queued for the next `qa → main` release.

### Timeline (from `git` history on `main`)

| Event | Date (local +0530) | `tree_invites` on `main`? | Applied to prod? |
|---|---|---|---|
| 7 historical migrations stamped on prod (`20260513182921`–`…183231`) | 2026-05-13 18:29–18:32 | n/a | ✅ (one batch) |
| v0.1.0 merge `e00f21e` (PR #33) | 2026-05-14 00:50 | no | — |
| **v0.2.0 merge `d87cf29` (PR #46)** — `tree_invites.sql` first reaches `main` | **2026-05-14 22:38** | ✅ from here | ❌ |
| v0.3.0 / v0.4.0 / v0.5.0 merges (incl. `18f7406`) | through 2026-05-29 | ✅ (already present) | ❌ |
| v1.0.0 merge `071fcbb` (PR #174) | 2026-05-31 20:03 | ✅ (unchanged in this merge) | ❌ → manual apply |

`tree_invites.sql` was introduced by commit `b53954a` ("feat(phase-6): Collaboration …", PR #43,
authored 2026-05-14 22:16) and confirmed present on `main` at the v0.5.0 merge (`18f7406`) via
`git ls-tree`. The v1.0.0 merge commit `071fcbb` introduced **no** `supabase/migrations/` changes.

## Two hard facts

1. **The 7 historical migrations were stamped on prod *before any release branch ever merged to
   `main`*** (earliest release merge is v0.1.0 at 2026-05-14 00:50; stamps are 2026-05-13 18:xx).
   They were therefore applied **once, at integration connect / initial-deploy time**, sweeping up
   whatever migration files existed in the repo that day — *not* "during prior release merges" as
   the issue originally assumed.
2. **`tree_invites` was the first migration to arrive on `main` *after* connect-time, and it
   arrived via a `release/* → main` merge commit.** It was then skipped on every subsequent merge
   (v0.2.0 → v1.0.0), not just v1.0.0.

## Leading hypothesis

The integration applies migrations **once at connect-time**, then relies on **per-merge
diff-detection that is blind to files introduced via a release-branch *merge commit***. A merge
commit's own (first-parent) diff does not surface file additions that happened on the merged
branch, so a migration whose first appearance on `main` is through a `release/* → main` merge is
never detected. `tree_invites` was the first such migration, which is why it is the first one to
expose the bug.

This unifies the issue's original hypotheses #2 (diff vs. previous-deployed commit) and #3
(release-branch merge-commit handling) into one mechanism. Hypotheses #1 (Vercel-build coupling)
and #4 (manifest divergence) are not needed to explain the observations and are deprioritized.

## Confirmation plan — next-release natural experiment

No fabricated no-op migration is required. The next `qa → main` release carries two real pending
migrations (`harden_tree_invites_functions`, `add_tree_invites_fk_indexes`), both arriving via a
`release/* → main` merge commit. Observation protocol for that release:

1. **Before cutting:** snapshot prod `list_migrations` (baseline: 8, ending at `tree_invites`).
2. **At merge to `main`:** record the merge commit SHA; `git show --stat <sha>` to confirm whether
   the two migration files appear in that commit (expected: they do *not*, since they ride the
   merged branch).
3. **After redeploy + ~5 min, BEFORE any manual apply:** re-run prod `list_migrations`.
   - **Both still absent** → hypothesis **confirmed** (release-merge-commit blindness).
   - **Auto-applied** → hypothesis **refuted**; escalate to the deep-dive path (pull Supabase
     integration deploy logs + GitHub webhook delivery payloads + Vercel build logs for the merge).
4. **Then** apply manually if needed (existing step #7 mitigation) so the release is not blocked.

Discipline: **do not manually apply before observing** — premature apply invalidates the experiment.

## Deliverables

- **A. RCA comment on #177** — timeline table, connect-time-vs-merge-diff finding, leading
  hypothesis, and a "pending confirmation on next release" note with the observation protocol.
  (Satisfies acceptance item 1.)
- **B. This spec doc** — durable artifact in `docs/superpowers/specs/`.
- **C. Targeted doc enhancement to `releases.md` step #7** — add one sentence converting the vague
  "unreliable" into the specific known failure mode: *the integration applies at connect-time and
  on direct file-change diffs, but is unreliable for files arriving via release-branch merge
  commits — always expect to apply manually post-release.* (Sharpens acceptance item 3, already
  shipped.)
- **D. Close-out** — leave #177 **open** with a pending checkbox for the next-release confirmation.
  After that release, append the result to the #177 comment and close.

## Resolution decision (acceptance item 2 — config fix)

**Do not attempt a speculative config change.** The integration still does useful work
(connect-time sync, direct-diff applies); the failure mode is now understood and cheap to work
around (the `list_migrations` parity check we already do); and there is no exposed knob that
obviously fixes merge-commit blindness. **Keep the integration, rely on the documented
manual-verify step.** (Alternative considered: disable auto-apply entirely and go fully manual for
one consistent path — rejected for now as strictly more manual work with no reliability gain, but
revisitable if the next-release experiment shows the integration misbehaving further.)

## Out of scope

- Pulling Vercel build logs / GitHub webhook delivery payloads — only if the experiment *refutes*
  the hypothesis.
- Any prod Supabase or Vercel config change.
- Any change to the migration files themselves.

## Acceptance mapping

- [ ] Root cause documented in a comment on #177 → **Deliverable A** (leading hypothesis now;
  confirmed/refuted after next release).
- [ ] If a config change fixes it, applied + re-tested via next release → **resolved as "no config
  fix pursued"**; the next-release experiment serves as the re-test of the documented behavior.
- [x] If integration unreliable, doc note in `releases.md` + release-recipe step → **already shipped
  (Amendment 5, step #7); Deliverable C sharpens it.**
