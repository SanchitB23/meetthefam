# ADR 0009 — Versioning and releases

**Status:** Accepted
**Date:** 2026-05-12

## Context

Once code reaches `main` (via the `qa→main` forward-promotion model from [ADR 0005](0005-three-environments.md)), there's currently no way to:

- Identify "what's in production right now" at a glance — `git log main` shows the latest commit but no semantic version.
- Roll back to a known-good state — you'd have to remember a commit SHA.
- Track release-level changes for the user-facing changelog the multi-tenant launch (v1.0) will need.

The `package.json` version field has been sitting at the `create-next-app` default (`0.1.0`) since Phase 0 sub-task 1 — meaningless, and worse, it implies we've already hit the "v0.1 personal MVP" milestone defined in the spec.

We need a versioning scheme and a release process that's lightweight enough for a solo dev to actually follow, but disciplined enough to scale to v1.0 without a rewrite.

## Decision

### 1. Phase-anchored SemVer

The spec already names two milestones — **v0.1** (personal MVP, end of Phase 5) and **v1.0** (multi-tenant launch, end of Phase 9). Versioning is anchored to those:

| Period | Version line | Bump rule |
|---|---|---|
| Pre-Phase-5 | `0.0.x` | Patch on every prod deploy. Counter, not semantic. |
| End of Phase 5 | `0.1.0` | First named release. |
| Phases 6–9 | `0.MINOR.PATCH` | Each phase ≈ a minor bump; bugfixes within a phase = patch. |
| End of Phase 9 | `1.0.0` | Public launch. |
| Post-v1.0 | Conventional Commits → SemVer | `feat:` → minor, `fix:` → patch, breaking change → major. |

Pre-v1.0 is explicitly "anything may change" per [SemVer §4](https://semver.org/#spec-item-4). The phase-anchored bumps give us a clean changelog story without forcing premature `feat:`/`fix:` discipline pre-MVP — most pre-MVP commits are `chore:` or `docs:` scaffolding that wouldn't bump a version under strict Conventional Commits anyway.

### 2. Tags with `v` prefix

All tags are annotated and use the `v` prefix: `v0.0.0`, `v0.1.0`, `v1.0.0`. `pnpm version` creates them by default.

### 3. GitHub Release per tag

Every tag gets a GitHub Release, marked `prerelease: true` until `v1.0.0`. Release notes are auto-generated from commits between tags via the API's `generate_release_notes: true`.

### 4. Manual tooling (no CI automation yet)

The release process is run by the human after each `qa→main` promotion. **Always confirm `gh auth status` shows `SanchitB23` as the active account before any release operation** — the org account (`SQB6461_YUMGHCP`) is also logged in on this machine, and releasing under that identity would create the release on the wrong repo (or fail outright since `SQB6461_YUMGHCP` has no access to `SanchitB23/meetthefam`).

```bash
gh auth status                          # MUST show SanchitB23 active
git checkout main
git merge qa --ff-only
pnpm version patch                      # or minor / major
git push origin main --follow-tags
gh release create vX.Y.Z \
  --repo SanchitB23/meetthefam \
  --title "vX.Y.Z — <summary>" \
  --notes-file /tmp/vX.Y.Z-notes.md \
  --prerelease                          # drop --prerelease starting v1.0.0
```

**Fallback for environments without `gh`** (CI, or a fresh machine before `gh auth login`): curl to the GitHub REST API using `$GITHUB_PERSONAL_ACCESS_TOKEN` from `.env.local` (loaded by direnv, fine-grained-scoped to `SanchitB23/meetthefam`):

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/SanchitB23/meetthefam/releases \
  -d '{"tag_name":"vX.Y.Z","name":"vX.Y.Z","generate_release_notes":true,"prerelease":true}'
```

The GitHub MCP currently has only read-tools for releases (no `create_release`), so the API route is the working fallback when `gh` is unavailable.

### 5. Baseline at v0.0.0

`package.json` is reset from the `create-next-app` default `0.1.0` to `0.0.0` in this commit, and tagged `v0.0.0` after promotion to main. Earlier commits (sub-tasks 1–6 of Phase 0) are left untagged — we didn't have a versioning convention when they shipped, so backfilling would be making up history. If we later want a "Phase 0 complete" marker on commit `d48d395` (the last commit before this one on `main`), we can add an annotated **non-version** tag like `phase-0-complete` — purely descriptive, doesn't enter the SemVer line.

## Consequences

- **Every prod deploy ends with a tag.** The release process is a 4-step checklist on the human side. If we skip it, `main` advances without a tag and the next release's auto-generated notes get noisy (and the gap between tags loses any "what shipped when" precision).
- **Phase-end tags (`v0.1.0`, `v1.0.0`) become real artefacts, not just doc references.** `git checkout v0.1.0` shows exactly what shipped at the personal-MVP point.
- **CI automation is deferred.** When release volume rises (post-v1.0 or with collaborators), revisit and likely auto-tag from a GitHub Action gated on a maintainer-applied `release: true` label. Tools to evaluate then: [release-please](https://github.com/googleapis/release-please), [changesets](https://github.com/changesets/changesets).
- **Custom-domain rollback caveat**: `mtf.sanchitb23.in` aliases to the latest production deploy. Vercel's rollback UI uses deployment IDs, not git tags — so "roll back to v0.0.X" is a two-step manual operation (find the deployment for that commit SHA in the Vercel dashboard, click "Promote to Production"). Cross that bridge when we need it.

## Alternatives considered

- **CalVer** (`2026.05.11`) — works well when users care about "how fresh is this build" more than "what changed semantically." Rejected because the spec already structured the work around the v0.1 / v1.0 milestones, and CalVer would lose that signal.
- **Strict Conventional Commits from day one** (`feat:` → `0.1.0` immediately) — would burn the v0.1 milestone in one commit. Useful post-v1.0; premature now.
- **No versioning until v1.0** (just commit SHAs) — easy but loses the milestone tagging that makes `git checkout v0.1.0` useful for later debugging or comparison. Rejected.
- **CI-automated tagging via GitHub Actions** (e.g., release-please, changesets) — saves manual steps. Deferred until release volume justifies the workflow file maintenance — currently low single-digits per week, and a human gate before tagging adds value at this stage.

## References

- [SemVer 2.0.0](https://semver.org/)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/)
- [GitHub CLI — `gh release create`](https://cli.github.com/manual/gh_release_create)
- [GitHub REST API — Create a release](https://docs.github.com/en/rest/releases/releases#create-a-release)
- [ADR 0005 — Three environments](0005-three-environments.md) — the `qa→main` promotion is what triggers a release

## Amendments

- **2026-05-12** — Promoted `gh release create` to the primary release command and demoted the `curl` form to a fallback. The original §4 (in `v0.0.0`'s ADR) claimed `gh` was unavailable because it was logged into the user's org account — that was incorrect at the time of writing. Both `SanchitB23` (personal) and `SQB6461_YUMGHCP` (org) are logged in on this machine, with `SanchitB23` set as the active account, and `gh release create` works against this repo. The `v0.0.0` release was itself created via `gh release create`, demonstrating the path. §4 was rewritten accordingly, and a "verify `gh auth status` first" step was prepended to guard against accidentally operating under the org identity.

- **2026-05-12 (post-v0.0.2)** — Flipped the promotion mechanic from "`git merge qa --ff-only`, no PR" to **"PR with a real merge commit"**. The original convention optimized for a linear `main` history; in practice that cost us the PR record as a durable phase marker, and a GitHub Release alone isn't as discoverable when you're scanning history six months later. New convention: each `qa → main` promotion goes through a PR (description reuses the release notes), merged via GitHub's "Create a merge commit" — squash and rebase are explicitly disallowed because they lose either the per-sub-task commits or the phase boundary. `git log --graph main` now shows one merge bubble per release. Releases `v0.0.0`, `v0.0.1`, and `v0.0.2` predate this amendment and shipped via the ff-only path — they remain as-is on `main`, with GitHub Releases serving as their history markers. Starting Phase 2, every promotion follows the PR-based steps in CLAUDE.md "Releases."
