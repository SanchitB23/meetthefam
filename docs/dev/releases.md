# Releases — recipe and rules

Operational recipe for cutting a release. For the rationale behind the versioning scheme, see [`../adrs/0009-versioning-and-releases.md`](../adrs/0009-versioning-and-releases.md). For the surrounding branching model, see [`git-workflow.md`](git-workflow.md) and [`../adrs/0010-feature-branch-workflow.md`](../adrs/0010-feature-branch-workflow.md).

Every phase ends with a `release/vX.Y.Z` branch cut from `qa`, merged into `main` with a merge commit, then **fast-forwarded into `qa`** (since 2026-05-15 — see [ADR 0009 Amendment 4](../adrs/0009-versioning-and-releases.md)) to keep the branches content-aligned. The release branch is the only one that ever targets `main`. The version itself is derived at build time from the GitHub tag — there is **no manual `pnpm version` bump anymore**; `package.json` `version` is a sentinel `"0.0.0-dev"`.

## Versioning rules

Phase-anchored SemVer (full rationale in [ADR 0009 §1](../adrs/0009-versioning-and-releases.md)). Pick the version from this table and pass it to `gh release create vX.Y.Z`:

| Period | Bump shape | Resulting version |
|---|---|---|
| Pre-Phase-5 (historical) | patch | `0.0.x` |
| End of Phase 5 | minor | `v0.1.0` (first named release — personal MVP) |
| Phases 6–9 (each phase end) | minor | `0.MINOR.0` (Phase 9 shipped `v0.5.0`, 2026-05-29) |
| Phase 10 launch-prep checkpoints (as needed) | minor | `0.6.0`+ |
| Mid-phase hotfix on `0.MINOR` | patch | `0.MINOR.PATCH` |
| v1.0 launch (cut at Phase 10 Wave F, shipped in Phase 11) | major | `v1.0.0` (multi-tenant launch) |
| Post-v1.0 | Conventional Commits decide | `feat:` → minor, `fix:` → patch, breaking → major |

> **Note (post-2026-05-22 restructure).** This table originally anchored `v1.0.0` to "end of Phase 9". The Phase 9 / 10 / 11 / 12 split (see [`../tasks/phase-backlog.md`](../tasks/phase-backlog.md) intro) moved the launch to the **Phase 10 Wave F → Phase 11 cut-over** boundary: Phase 9 (pre-prod implementation) now closes with an intermediate minor (`v0.5.0`), Phase 10 owns the path to the launch cut, and `v1.0.0` is the actual multi-tenant launch. Rationale recorded in [ADR 0009 Amendments](../adrs/0009-versioning-and-releases.md#amendments).

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

# 6. Retrigger prod deploy so <VersionFooter> picks up the new tag.
#    The Vercel build that fired off on step 4's merge to main raced
#    AHEAD of step 5's tag — its GitHub-API fallback in
#    scripts/derive-version.mjs saw the PREVIOUS release as "latest"
#    and emitted "<prev>-dev.<sha>" for APP_VERSION. Redeploy re-runs
#    the build with the new tag visible. Without this step prod renders
#    the stale version until the next commit to main. (Caught on v0.4.0
#    ship 2026-05-18.) Two paths — pick ONE:
#
#    a) CLI (preferred — uses cached build files, ~30s, no rebuild):
#       # The deployment URL is the 3rd whitespace-separated field of the
#       # `vercel ls` table row — hence $3.
#       PROD_URL=$(npx vercel ls --prod meetthefam | awk '/Ready/{print $3; exit}')
#       npx vercel redeploy "$PROD_URL"
#
#    b) Dashboard: open the latest Production deployment for
#       sanchit-bhatnagars-projects/meetthefam and click "Redeploy".
#
#    Do NOT use the Vercel MCP tool mcp__vercel__deploy_to_vercel as a
#    redeploy path — it only returns deployment *instructions*; it does
#    not actually deploy anything. (Caught on the v1.2.0 ship 2026-06-13.)
#
#    Verify after any path (prod's alias is the custom domain, not
#    meetthefam.vercel.app):
#       curl -s https://mtf.sanchitb23.in/ | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+'
#       # should print v<X.Y.Z>, NOT v<PREV>-dev.<sha>

# 7. Verify migration parity between QA and prod (Amendment 5, 2026-06-01).
#    The Supabase ↔ GitHub integration auto-applies migrations on merge to
#    main. Give it 2–3 minutes to run, then confirm every QA migration
#    name is also on prod. If any are missing, apply manually — see
#    docs/dev/prod-readiness.md §1 for the fallback recipe.
#    KNOWN FAILURE MODE (#177): the integration applies migrations at
#    connect-time and on direct file-change diffs, but is unreliable for
#    files that first reach main via a release-branch MERGE COMMIT — those
#    can be silently skipped (as tree_invites was on the v1.0.0 merge).
#    Since every release lands on main via a release/* merge commit, treat
#    a post-release manual apply as the EXPECTED path, not the exception.
#
#    mcp__supabase__list_migrations  →  project: ycnsgkotrbjifsjkqmvn  (prod)
#    mcp__supabase__list_migrations  →  project: ljjvwtpifmoshfknlbaj  (QA)
#
#    Cross-check by name (ignore timestamp prefix — clock-drift is expected).
#    If all QA names are present on prod → proceed. If any are absent →
#    apply the missing migration(s) using the fallback in prod-readiness.md §1.

# 8. Fast-forward qa to the release-branch tip (which is a parent of main's
#    merge commit). No PR; no squash; no ghost commits. Eliminates the
#    structural divergence that caused v0.1.0 and v0.3.0 conflicts.
#    See ADR 0009 Amendment 4.
git push origin release/vX.Y.Z:qa
git push origin --delete release/vX.Y.Z

# 9. Sync local state and verify the tag exists.
git checkout qa && git pull --ff-only
git fetch --tags --prune
git tag -l vX.Y.Z                        # should print vX.Y.Z
```

### Rare-case fallback (qa moved during the release window)

If `git push origin release/vX.Y.Z:qa` (step 8) rejects with "non-fast-forward" — someone landed a non-emergency PR on qa between cutting the release branch and merging the release PR — fall back to a real merge:

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
