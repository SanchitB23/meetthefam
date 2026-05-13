# Git workflow — feature-branch forward promotion

Operational guide for day-to-day branching and PRs in this repo. For the rationale and trade-offs, see [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md). For release-specific recipes, see [`releases.md`](releases.md).

## The flow at a glance

```
local → feat/* (or fix/, chore/, docs/, refactor/, test/, style/)
   ↓                ↘ PR (squash-merge)
   qa  ────────────────────────────────────●
   ↓                                       ↘ cut release/vX.Y.Z
   release/vX.Y.Z ──────────────────────────→ PR to main (merge commit) → tag on GitHub
                                            ↘ back-PR (squash-merge) returns the bump to qa
```

Code flows in one direction: `local → feat/* → qa → release/* → main → production`. Never commit directly to `main`. Per-sub-task feature branches are mandatory; direct commits to `qa` are reserved for emergencies.

## Branch types

Branch prefix mirrors the Conventional Commit type used in commit messages. PR title uses the matching prefix (`feat(scope): …`, `chore(release): vX.Y.Z`, etc.):

| Prefix | Cut from | Merge target | Merge method | Use |
|---|---|---|---|---|
| `feat/phase-N/sub-task-M-slug` | `qa` | `qa` | Squash | New feature sub-tasks (dominant pre-v1.0 case). |
| `fix/<slug>` | `qa` | `qa` | Squash | Bug fixes against current `qa`. |
| `chore/<slug>` | `qa` | `qa` | Squash | Tooling, deps, config, infra hygiene. |
| `docs/<slug>` | `qa` | `qa` | Squash | Docs-only changes — ride into the next phase release, no separate tag. |
| `refactor/<slug>` | `qa` | `qa` | Squash | Internal restructuring with no behavioral change. |
| `test/<slug>` | `qa` | `qa` | Squash | Test-only additions/fixes when not bundled with feature work. |
| `style/<slug>` | `qa` | `qa` | Squash | Formatting/style-only changes. |
| `release/vX.Y.Z` | `qa` | `main` (then back into `qa`) | Merge commit on `main`; squash on the back-PR | Phase-boundary release. Only branch that targets `main`. See [`releases.md`](releases.md). |
| `fix/<slug>` (hotfix) | `main` | `main` | Merge commit | **Hotfix exception**: production is broken AND `qa` has un-shipped work. Forward-port to `qa` afterwards. |

## Sub-task workflow

```bash
# 0. Sync qa first.
git checkout qa && git pull --ff-only

# 1. Cut a branch matching the work type. feat uses the phase/sub-task naming.
git checkout -b feat/phase-4/sub-task-1-<short-slug>
#  or: fix/<slug>, chore/<slug>, docs/<slug>, refactor/<slug>, test/<slug>, style/<slug>

# 2. Work. Commit with Conventional-Commit-formatted messages.

# 3. Push the branch.
git push -u origin feat/phase-4/sub-task-1-<short-slug>

# 4. Open the PR against qa. Title uses the matching Conventional Commit prefix.
gh pr create --repo SanchitB23/meetthefam \
  --base qa --head feat/phase-4/sub-task-1-<short-slug> \
  --title "feat(<scope>): <summary>" \
  --body "<context + test plan>"

# 5. Verify the Vercel preview on the feature branch. Each branch gets its own
#    preview URL — that's the per-sub-task isolation we're paying for.

# 6. Squash-merge with branch deletion. One squashed commit lands on qa.
gh pr merge --repo SanchitB23/meetthefam --squash --delete-branch <pr-number>

# 7. Sync local state.
git checkout qa && git pull --ff-only && git fetch --prune
```

> PR body is pre-filled from [`.github/pull_request_template.md`](../../.github/pull_request_template.md). Fill every section before marking the PR ready for review — the checklist (typecheck, lint, task-doc tick, supabase-validator if DB-touched, manual walkthrough) is intentionally strict.

## Hotfix exception

When production is broken AND `qa` has un-shipped work that can't ride the fix, branch off `main` instead of `qa`:

```bash
git checkout main && git pull --ff-only
git checkout -b fix/<slug>
# fix, commit, push, PR --base main, merge with merge commit
# Then forward-port to qa:
git checkout qa && git pull --ff-only
git merge main          # or cherry-pick the fix commit
```

If the hotfix requires a new release, use `release/vX.Y.Z+1` cut from `main` instead of `fix/<slug>` and follow [`releases.md`](releases.md).

## Conventions and guardrails

- **`qa` is unprotected.** No GitHub ruleset on `qa` — the convention is enforced by docs/discipline, not by tooling. Force-push and direct emergency commits are technically allowed but should be the exception, not the norm.
- **`main` is protected.** Ruleset id `16283379` requires PR, blocks non-fast-forward pushes, blocks branch deletion, restricts merge method to "merge commit" only (no squash, no rebase), and blocks merges on failed Vercel deploys.
- **`qa → main` is no longer a direct PR.** The phase boundary is drawn by `release/vX.Y.Z → main` (see [`releases.md`](releases.md)). The pre-v0.0.2 `git merge qa --ff-only` convention and the post-v0.0.2 `qa → main` PR convention are both superseded as of v0.0.5.
- **PR titles use Conventional Commits.** `feat(scope): summary`, `fix(scope): summary`, `chore(release): vX.Y.Z`, etc. Squash-merge produces a single Conventional-Commits-compliant commit on `qa`.
- **Update task docs in the same PR as the feature.** Per the standing memory rule `feedback_update_tasks_before_commit.md` — invoke the `task-doc-keeper` agent before opening each sub-task PR.
- **Always ask the user before `git commit`.** Per CLAUDE.md's commit rules — show a diff summary first, wait for explicit approval.

## See also

- [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md) — why this workflow.
- [`../adrs/0005-three-environments.md`](../adrs/0005-three-environments.md) — the three-environment model the workflow keys off.
- [`releases.md`](releases.md) — the release-specific recipe for `release/vX.Y.Z`.
