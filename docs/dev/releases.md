# Releases — recipe and rules

Operational recipe for cutting a release. For the rationale behind the versioning scheme, see [`../adrs/0009-versioning-and-releases.md`](../adrs/0009-versioning-and-releases.md). For the surrounding branching model, see [`git-workflow.md`](git-workflow.md) and [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md).

Every phase ends with a `release/vX.Y.Z` branch cut from `qa`, merged into `main`, then PR'd back into `qa` to return the version bump. The release branch is the only one that ever targets `main`.

## Versioning rules

Phase-anchored SemVer (full rationale in [ADR 0009 §1](../adrs/0009-versioning-and-releases.md)):

| Period | Bump command | Resulting version |
|---|---|---|
| Pre-Phase-5 (current) | `pnpm version patch` | `0.0.x` |
| End of Phase 5 | `pnpm version minor` | `v0.1.0` (first named release — personal MVP) |
| Phases 6–8 (each phase end) | `pnpm version minor` | `0.MINOR.0` |
| Mid-phase hotfix on `0.MINOR` | `pnpm version patch` | `0.MINOR.PATCH` |
| End of Phase 9 | `pnpm version major` | `v1.0.0` (multi-tenant launch) |
| Post-v1.0 | Conventional Commits decide | `feat:` → minor, `fix:` → patch, breaking → major |

Always pass `--no-git-tag-version` — the tag is created on GitHub via `gh release create --target main`, not locally. The tag's source of truth is the GitHub Release page pointing at the actual `main` merge commit.

## Release recipe

```bash
# 0. ALWAYS confirm gh is on the SanchitB23 (personal) account, not
#    the org one (SQB6461_YUMGHCP). Both are logged in on this machine.
gh auth status

# 1. Cut the release branch from a synced qa.
git checkout qa && git pull --ff-only
git checkout -b release/vX.Y.Z

# 2. Bump the version on the release branch. Pick patch/minor/major per
#    the versioning table above.
pnpm version <patch|minor|major> --no-git-tag-version
git add package.json pnpm-lock.yaml
git commit -m "chore(release): vX.Y.Z"

# 3. Push the branch. No tags pushed.
git push -u origin release/vX.Y.Z

# 4. Open the release PR. Release notes go in the PR body — write them to
#    a tmp file first since multi-line markdown is awkward as a flag value.
gh pr create \
  --repo SanchitB23/meetthefam \
  --base main --head release/vX.Y.Z \
  --title "vX.Y.Z — <summary>" \
  --body-file /tmp/vX.Y.Z-notes.md

# 5. Merge with a real merge commit (NOT squash, NOT rebase). One bubble
#    per phase on main is the whole point. Keep the branch alive — step 7
#    forward-PRs it back into qa.
gh pr merge --repo SanchitB23/meetthefam --merge \
            --delete-branch=false <pr-number>

# 6. Create the GitHub Release. --target main makes the tag point at the
#    new merge commit on main. This is the moment the vX.Y.Z tag exists.
git fetch origin main
gh release create vX.Y.Z \
  --repo SanchitB23/meetthefam \
  --target main \
  --title "vX.Y.Z — <summary>" \
  --notes-file /tmp/vX.Y.Z-notes.md \
  --prerelease                           # drop --prerelease starting v1.0.0

# 7. Forward the version bump back to qa so the branches don't diverge
#    on package.json. Squash-merge the back-PR and delete the release branch.
gh pr create \
  --repo SanchitB23/meetthefam \
  --base qa --head release/vX.Y.Z \
  --title "chore(release): forward vX.Y.Z bump to qa" \
  --body "Brings the package.json bump from #<release-pr-number> back to qa."
gh pr merge --repo SanchitB23/meetthefam --squash \
            --delete-branch <forward-pr-number>

# 8. Sync local state and verify the tag exists.
git checkout qa && git pull --ff-only
git fetch --tags --prune
git tag -l vX.Y.Z                        # should print vX.Y.Z
```

> Use `--template release.md` on step 4 (or replace `--body-file` with it for an empty starting body) to pre-load the release-specific checklist from [`.github/PULL_REQUEST_TEMPLATE/release.md`](../../.github/PULL_REQUEST_TEMPLATE/release.md): bump rationale, release notes, pre-merge + post-merge rituals, manual smoke flows, rollback readiness.

## Fallback for environments without `gh`

CI, or a fresh machine before `gh auth login`: curl to the GitHub REST API using `$GITHUB_PERSONAL_ACCESS_TOKEN` from `.env.local` (loaded by direnv, fine-grained-scoped to this repo). See [ADR 0009 §4](../adrs/0009-versioning-and-releases.md) for the payload shape.

## Why this shape

- **Bump on a release branch, not on `qa`.** If the release is aborted, `qa` doesn't carry a half-cooked `package.json` bump that has to be reverted. The release branch is disposable; abort = `git push origin :release/vX.Y.Z`.
- **Tag created on GitHub, not pushed from local.** `gh release create --target main` creates the tag against the actual `main` merge commit — eliminates the "tag pointed at the wrong commit" failure mode that haunted the pre-v0.0.5 flow.
- **Forward-PR back to `qa`.** Without step 7, `main` would carry the version bump but `qa` wouldn't, and the two branches would diverge on `package.json` forever. The squash-merge brings the bump back as a single commit.
- **`release/vX.Y.Z` is the only branch that targets `main`.** Everything else lands on `qa` first. This is what makes `release/vX.Y.Z` worth being its own branch type.

## See also

- [`../adrs/0009-versioning-and-releases.md`](../adrs/0009-versioning-and-releases.md) — versioning rationale + Amendment history.
- [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md) — why the `release/vX.Y.Z` branch exists.
- [`git-workflow.md`](git-workflow.md) — sub-task workflow into `qa` (what comes before a release).
- CI automation is deferred to v1.0; revisit [release-please](https://github.com/googleapis/release-please) and [changesets](https://github.com/changesets/changesets) then.
