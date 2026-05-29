# ADR 0010 — Feature-branch workflow on `qa`

**Status:** Accepted
**Date:** 2026-05-12

## Context

[ADR 0005](0005-three-environments.md) established the three-environment promotion model: `local → qa → main → production`. ADR 0005 §"Promotion flow" actually describes a feature-branch flow (`feature branch → PR into qa → merge qa → main`), but operational convention in [CLAUDE.md](../../CLAUDE.md) → "Git workflow — forward-promotion model" diverged from it almost immediately and told the developer to commit straight to `qa`. Phase 3 shipped via PR [#2](https://github.com/SanchitB23/meetthefam/pull/2) under that convention with 6 sub-tasks landing as 6 sequential commits directly on `qa`.

Two problems surfaced over the first 4 phases:

1. **No per-sub-task review checkpoint.** The only PR-level diff is the phase-boundary `qa → main` merge, which is too late to catch issues and too big to review meaningfully. Vercel previews on `qa` show the cumulative state after every push — they don't isolate "what just changed."
2. **The release flow needed a workaround.** [ADR 0009](0009-versioning-and-releases.md) §4 originally ran `pnpm version patch` on `main` and `git push origin main --follow-tags`, but the `main` ruleset (id `16283379`, added 2026-05-12) blocks non-PR pushes. The v0.0.4 release ([#4](https://github.com/SanchitB23/meetthefam/pull/4)) routed the bump through a temporary `release/v0.0.4 → main` PR — an undocumented workaround that landed twice (once on v0.0.3 as a near-miss, once on v0.0.4 as the actual fix). [phase-backlog.md:121](../archive/phase-backlog.md) tracked this as an open item to resolve before v0.0.5.

The two problems share a root cause: the operational flow doesn't use branches per unit of work. Solving (1) — branches per sub-task — also gives (2) a natural home (a `release/vX.Y.Z` branch).

## Decision

Adopt a feature-branch workflow keyed off `qa`. Every unit of work is cut on a Conventional-Commit-prefixed branch and PR'd into `qa` (or, for release branches, into `main`).

### Branch types

Branch prefix mirrors the Conventional Commit type already documented in [CLAUDE.md → "Git / commits"](../../CLAUDE.md), plus a release prefix:

| Prefix | Cut from | Merge target | Merge method | Use |
|---|---|---|---|---|
| `feat/phase-N/sub-task-M-slug` | `qa` | `qa` | Squash | New feature sub-tasks (dominant pre-v1.0 case). |
| `fix/<slug>` | `qa` | `qa` | Squash | Bug fixes against current `qa`. |
| `chore/<slug>` | `qa` | `qa` | Squash | Tooling, deps, config, infra hygiene (Dependabot uses a similar shape). |
| `docs/<slug>` | `qa` | `qa` | Squash | Docs-only changes. Per the auto-memory `feedback_no_release_for_docs_only.md` rule these ride into the next phase release — they don't get their own tag. |
| `refactor/<slug>` | `qa` | `qa` | Squash | Internal restructuring with no behavioral change. |
| `test/<slug>` | `qa` | `qa` | Squash | Test-only additions/fixes when not bundled with feature work. |
| `style/<slug>` | `qa` | `qa` | Squash | Formatting/style-only changes. |
| `release/vX.Y.Z` | `qa` | `main` (then back into `qa`) | Merge commit on `main`; squash on the back-PR | Phase-boundary release. Carries the `pnpm version` bump. |
| `fix/<slug>` or `release/vX.Y.Z+1` | `main` | `main` | Merge commit | **Hotfix exception**: production is broken and `qa` has un-shipped work. Forward-port to `qa` afterwards. |

Squash-merge collapses each PR into a single Conventional-Commits-compliant commit on `qa` — `qa`'s log looks identical in shape to today's, just routed through PRs. The `qa → main` boundary remains a real merge commit (the rule from the auto-memory `feedback_pr_based_promotion.md` is unchanged), but the boundary is now drawn by `release/vX.Y.Z → main`, not `qa → main` directly.

### Release flow

The v0.0.4 detour is now the standard path:

1. Cut `release/vX.Y.Z` from `qa`.
2. `pnpm version <patch|minor|major> --no-git-tag-version` — bumps `package.json` only. No local tag is created. Bump choice per [ADR 0009 §1](0009-versioning-and-releases.md) (phase-anchored SemVer).
3. Commit as `chore(release): vX.Y.Z`. Push the branch — no tags pushed.
4. PR `release/vX.Y.Z → main`, merged with a real merge commit. Release notes live in the PR body.
5. `gh release create vX.Y.Z --target main --notes-file ...` — creates the tag on GitHub pointing at the new `main` merge commit. The tag's source of truth is GitHub, not a local push.
6. Forward-PR `release/vX.Y.Z → qa` (title `chore(release): forward vX.Y.Z bump to qa`), squash-merged with `--delete-branch`. Brings the bump back to `qa` so the branches don't diverge on `package.json`.

`release/vX.Y.Z` is the only branch that fans into both `main` and `qa`.

### Out of scope

- **No `qa` branch protection.** The convention is enforced by docs and discipline. Adding a ruleset would block emergency direct pushes (e.g. fixing a typo in CLAUDE.md) for no second-reviewer gain — there isn't one to gate against in a solo-dev repo. Revisit when collaborators land.
- **Pre-v0.0.2 ff-only history on `main` stays as-is.** Releases `v0.0.0`, `v0.0.1`, `v0.0.2` predate the PR-based promotion rule and don't get retroactively rewritten.

## Consequences

- **~5–7 extra PRs per phase.** Phase 3 had 6 sub-tasks; under the new flow that's 6 sub-task PRs + 1 release PR + 1 forward-PR = 8 PRs/phase instead of 1. Each PR is small and self-contained, which is the whole point.
- **One Vercel preview per feature branch instead of one rolling preview on `qa`.** Each sub-task gets a verifiable, isolated preview URL. The `qa` preview itself still exists and reflects post-merge state.
- **Branch list grows fast, prunes itself.** `gh pr merge --delete-branch` removes the remote branch on merge; `git fetch --prune` cleans up locally. No stale branches accumulate.
- **The release-flow gap is closed by construction.** No more workaround — `release/vX.Y.Z` IS the path. Closes the open item at [phase-backlog.md:121](../archive/phase-backlog.md).
- **`qa` and `main` converge on `package.json`** thanks to the forward-PR step. Without it, `main`'s version would drift ahead of `qa`'s on every release.
- **Tag source-of-truth shifts to GitHub.** Local clones see tags only after `git fetch --tags`. This is a deliberate simplification — `gh release create` creates the tag against the actual `main` merge commit, removing one class of "did the tag end up on the right commit?" error.

## Alternatives considered

- **Status quo: commit directly to `qa`.** Cheapest in PR count but loses per-sub-task review and forces the release-flow workaround. Rejected.
- **One branch per phase, not per sub-task.** Essentially renames the current flow — same PR count (1/phase), same lack of per-sub-task isolation. Minimum benefit. Rejected.
- **One branch per logical chunk (group of related sub-tasks).** Middle ground. The user explicitly chose per-sub-task granularity for the strongest isolation — squash-merge keeps the `qa` log just as clean either way, so the per-sub-task option's only "cost" is the extra PRs themselves, which are cheap.
- **Bump version on `qa` instead of a release branch** (option (a) in the [original backlog entry](../archive/phase-backlog.md)). Simpler — the bump rides the existing `qa → main` merge bubble. Rejected because if a release is aborted, `qa` carries a partial version-bump commit that has to be reverted. The release branch isolates the bump until the release commits.
- **Protect `qa` with a ruleset.** Belt-and-suspenders enforcement. Rejected — see "Out of scope" above.

## Amendments

- **2026-05-14 (during v0.2.0 / Phase 6 close-out)** — **Phase-branch escape hatch for parallel sub-agent dev.** Phase 6 deviated from the default sub-task-→-`qa` flow: a **phase branch** `feat/phase-6-collaboration` was cut from `qa`, and each sub-task branch was cut from the phase branch (not from `qa`) and squash-merged back into the phase branch. The phase branch itself then merged into `qa` as one squash PR. The release at the end of the phase still rides a `release/v0.2.0` branch from `qa` per [ADR 0009 §4](0009-versioning-and-releases.md). **Why deviate**: Phase 6 fan-out Stage 3 ran sub-tasks 3 + 4 in parallel via dispatched sub-agents in isolated git worktrees. Each agent needed a stable base that already contained Sub-task 2's merged work. The phase branch IS that stable base. Going straight to `qa` would have forced serialisation (each agent rebases as the other lands) or noisy 3-way merges every time another phase's work also touched `qa`. **When to use the deviation**: anytime ≥2 sub-tasks can be authored in parallel by independent agents (UI fan-out, backend fan-out, tests + smoke fan-out). For a strictly sequential phase, stay on the default `feat/* → qa` flow — the phase branch adds two extra merges per phase (sub-tasks → phase, phase → qa) for no parallelism gain. **Phases that adopt this pattern** flag it in `docs/tasks/current-phase.md`'s Workflow note so reviewers see it before the qa PR lands. Phase 6 is the first; Phase 7+ are case-by-case at brainstorming time.
- **2026-05-29 — issue-anchored branches; phases retired.** Superseding the earlier "phase-branch as default" stance and the `feat/phase-N/sub-task-M-*` branch names in the table above: branches are now **issue-anchored**, `<type>/<issue#>-slug` (one branch → one GitHub issue → one PR with `Closes #N` + the issue's milestone, e.g. `feat/56-legal-pages`). The phase-tracking model that motivated phase / sub-task branch names was retired in favor of **GitHub milestones as the single planning source of truth** — see [ADR 0011](0011-github-milestones-source-of-truth.md). Forward-promotion (`→ qa → release/vX.Y.Z → main`) and the release flow above are unchanged. The phase-branch escape hatch (prior amendment) still applies for parallel sub-agent fan-out, keyed off a shared base branch rather than a "phase" per se.

## References

- [ADR 0005 — Three environments](0005-three-environments.md) — the three-environment model this workflow keys off.
- [ADR 0009 — Versioning and releases](0009-versioning-and-releases.md) — the SemVer scheme this release flow implements.
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) — branch-prefix taxonomy.
- [`docs/dev/git-workflow.md`](../dev/git-workflow.md) — operational recipe (sub-task workflow, branch-type table, hotfix exception). Updates land here when the *how* changes; this ADR stays put unless the *why* changes.
- [`docs/dev/releases.md`](../dev/releases.md) — operational recipe for cutting a release.
- [phase-backlog.md:121](../archive/phase-backlog.md) — the open item this ADR closes.
