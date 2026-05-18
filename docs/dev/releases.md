# Releases — recipe and rules

Operational recipe for cutting a release. For the rationale behind the versioning scheme, see [`../adrs/0009-versioning-and-releases.md`](../adrs/0009-versioning-and-releases.md). For the surrounding branching model, see [`git-workflow.md`](git-workflow.md) and [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md).

Every phase ends with a `release/vX.Y.Z` branch cut from `qa`, merged into `main` with a merge commit, then **fast-forwarded into `qa`** (since 2026-05-15 — see [ADR 0009 Amendment 4](../adrs/0009-versioning-and-releases.md)) to keep the branches content-aligned. The release branch is the only one that ever targets `main`. The version itself is derived at build time from the GitHub tag — there is **no manual `pnpm version` bump anymore**; `package.json` `version` is a sentinel `"0.0.0-dev"`.

## Versioning rules

Phase-anchored SemVer (full rationale in [ADR 0009 §1](../adrs/0009-versioning-and-releases.md)). Pick the version from this table and pass it to `gh release create vX.Y.Z`:

| Period | Bump shape | Resulting version |
|---|---|---|
| Pre-Phase-5 (historical) | patch | `0.0.x` |
| End of Phase 5 | minor | `v0.1.0` (first named release — personal MVP) |
| Phases 6–8 (each phase end) | minor | `0.MINOR.0` |
| Mid-phase hotfix on `0.MINOR` | patch | `0.MINOR.PATCH` |
| End of Phase 9 | major | `v1.0.0` (multi-tenant launch) |
| Post-v1.0 | Conventional Commits decide | `feat:` → minor, `fix:` → patch, breaking → major |

The tag is created on GitHub via `gh release create --target main`. Build-time `APP_VERSION` (in `src/lib/generated/version.ts`) is derived from that tag by [`scripts/derive-version.mjs`](../../scripts/derive-version.mjs) — never committed by hand.

## Release recipe

```bash
# 0. ALWAYS confirm gh is on the SanchitB23 (personal) account, not
#    the org one (SQB6461_YUMGHCP). Both are logged in on this machine.
gh auth status

# 1. Cut the release branch from a synced qa. The release branch is a
#    pure snapshot of qa — it carries zero unique commits (no version bump
#    anymore, per ADR 0009 Amendment 4).
git checkout qa && git pull --ff-only
git checkout -b release/vX.Y.Z

# 2. Push the snapshot. No tags pushed, no version bump committed.
git push -u origin release/vX.Y.Z

# 3. Open the release PR. Release notes go in the PR body — write them to
#    a tmp file first since multi-line markdown is awkward as a flag value.
gh pr create \
  --repo SanchitB23/meetthefam \
  --base main --head release/vX.Y.Z \
  --title "vX.Y.Z — <summary>" \
  --body-file /tmp/vX.Y.Z-notes.md

# 4. Merge with a real merge commit (NOT squash, NOT rebase). One bubble
#    per phase on main is the whole point. Keep the branch alive — step 6
#    fast-forwards it into qa.
gh pr merge --repo SanchitB23/meetthefam --merge \
            --delete-branch=false <pr-number>

# 5. Create the GitHub Release. --target main makes the tag point at the
#    new merge commit on main. This is the moment the vX.Y.Z tag exists.
git fetch origin main
gh release create vX.Y.Z \
  --repo SanchitB23/meetthefam \
  --target main \
  --title "vX.Y.Z — <summary>" \
  --notes-file /tmp/vX.Y.Z-notes.md \
  --prerelease                           # drop --prerelease starting v1.0.0

# 6. Fast-forward qa to the release-branch tip (which is a parent of main's
#    merge commit). No PR; no squash; no ghost commits. Eliminates the
#    structural divergence that caused v0.1.0 and v0.3.0 conflicts.
#    See ADR 0009 Amendment 4.
git push origin release/vX.Y.Z:qa
git push origin --delete release/vX.Y.Z

# 7. Sync local state and verify the tag exists.
git checkout qa && git pull --ff-only
git fetch --tags --prune
git tag -l vX.Y.Z                        # should print vX.Y.Z
```

### Rare-case fallback (qa moved during the release window)

If `git push origin release/vX.Y.Z:qa` rejects with "non-fast-forward" — someone landed a non-emergency PR on qa between cutting the release branch and merging the release PR — fall back to a real merge:

```bash
git checkout qa
git pull --ff-only
git merge --no-ff release/vX.Y.Z -m "chore(release): merge vX.Y.Z into qa"
git push origin qa
git push origin --delete release/vX.Y.Z
```

Adds one merge commit on qa. The next release's merge base is still the release-branch tip — no version conflict. Keep the release window short and the happy path stays a `git push`. 

> Use `--template release.md` on step 4 (or replace `--body-file` with it for an empty starting body) to pre-load the release-specific checklist from [`.github/PULL_REQUEST_TEMPLATE/release.md`](../../.github/PULL_REQUEST_TEMPLATE/release.md): bump rationale, release notes, pre-merge + post-merge rituals, manual smoke flows, rollback readiness.

## Fallback for environments without `gh`

CI, or a fresh machine before `gh auth login`: curl to the GitHub REST API using `$GITHUB_PERSONAL_ACCESS_TOKEN` from `.env.local` (loaded by direnv, fine-grained-scoped to this repo). See [ADR 0009 §4](../adrs/0009-versioning-and-releases.md) for the payload shape.

## Why this shape

- **Release branch carries zero unique commits.** With ADR 0009 Amendment 4, `package.json` `version` is a permanent sentinel `"0.0.0-dev"` — never bumped on the release branch. The branch is a pure snapshot pointer for the Vercel preview URL during release review. Aborting a release is a `git push origin :release/vX.Y.Z` with nothing to revert.
- **Build-time version derivation.** `scripts/derive-version.mjs` runs as `prebuild` and writes `src/lib/generated/version.ts` from the latest git tag. No file in git ever holds the "current released version" — eliminates the conflict surface that hit v0.1.0 (resolver commit `4673f59`) and v0.3.0 (resolver commit `097abaa`).
- **Tag created on GitHub, not pushed from local.** `gh release create --target main` creates the tag against the actual `main` merge commit — eliminates the "tag pointed at the wrong commit" failure mode that haunted the pre-v0.0.5 flow.
- **Fast-forward into `qa`, not forward-PR.** Without step 6, `main` would carry the merge commit but `qa` wouldn't, and the two branches would gradually diverge on every release. The fast-forward push lands the same SHA on `qa` as one of `main`'s merge-commit parents — zero ghost commits, zero structural divergence going forward.
- **`release/vX.Y.Z` is the only branch that targets `main`.** Everything else lands on `qa` first. This is what makes `release/vX.Y.Z` worth being its own branch type.

## See also

- [`../adrs/0009-versioning-and-releases.md`](../adrs/0009-versioning-and-releases.md) — versioning rationale + Amendment history.
- [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md) — why the `release/vX.Y.Z` branch exists.
- [`git-workflow.md`](git-workflow.md) — sub-task workflow into `qa` (what comes before a release).
- CI automation is deferred to v1.0; revisit [release-please](https://github.com/googleapis/release-please) and [changesets](https://github.com/changesets/changesets) then.
