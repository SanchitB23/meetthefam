## Release `vX.Y.Z`

<!-- Replace X.Y.Z. Title should be: chore(release): vX.Y.Z -->

## Bump rationale

<!-- Pick one and justify per ADR 0009 §1 (phase-anchored SemVer). -->

- [ ] **patch** — bugfix / chore / docs-only inside the current phase
- [ ] **minor** — a phase closed (new user-visible capability)
- [ ] **major** — v1.0 launch or breaking change

Reason:

## Phase closure context

<!-- Which phase does this release close, if any? What's the highlight? Link the relevant docs/tasks/phase-N-*.md file. -->

## Release notes

<!-- Bullet list of merged PRs in this release. `gh pr list --base qa --state merged --search "merged:>=<last-release-date>"` is a good starting point. Group by feat / fix / chore. -->

### Features

-

### Fixes

-

### Chores / docs / refactors

-

## Pre-merge checklist

- [ ] `qa` is green — last few sub-task PRs verified end-to-end
- [ ] `pnpm version <patch|minor|major> --no-git-tag-version` run on this branch (no local tag — see ADR 0009)
- [ ] `package.json` `version` field matches the branch name (`release/vX.Y.Z`)
- [ ] Merge strategy on this PR will be **"Create a merge commit"** — NOT squash, NOT rebase
- [ ] Base branch is `main` (not `qa`)

## Post-merge checklist (author runs these after merging)

- [ ] `gh release create vX.Y.Z --target main` (add `--prerelease` for any pre-v1.0 release)
- [ ] Forward-PR `release/vX.Y.Z` back into `qa` (squash-merge) to return the version bump
- [ ] Verify the production deployment on Vercel picked up the new `main`

## Manual human-testable smoke checklist

<!--
Click-through smoke flows the human releaser walks before AND after merging the release PR.
These exist on top of the per-PR manual checks so we have one final integrated pass.
-->

### Pre-merge — on QA (Vercel QA preview + QA Supabase)

- [ ] Opened the QA preview URL in a fresh incognito window
- [ ] Signed up a brand-new test user via magic link — received the email (or saw it in Mailpit if local), completed sign-in
- [ ] Created a new tree, added at least one parent + one child, added a spouse — relationships render correctly
- [ ] Uploaded a photo to a person — resize works, photo appears on the card and in the tree
- [ ] Generated a share link, opened it in a second incognito window — read-only view works for a signed-out viewer
- [ ] Deleted a person and a tree — no orphan rows / orphan photos visible
- [ ] Mobile viewport pass (375 × 667) on the QA preview — gestures and bottom sheets still work

### Post-merge — on production (after `main` deploys)

- [ ] Production URL loads, no console errors on a clean page load
- [ ] Signed in as an existing production user (or signed up a throwaway one) — no regressions vs. QA
- [ ] Spot-checked one tree of meaningful size — renders within ~1s, no layout breakage
- [ ] If this release ships a user-visible feature: walked the new flow against production once

### Rollback readiness

- [ ] I know how to revert: `gh release delete vX.Y.Z` + revert the `main` merge commit + redeploy previous Vercel deploy
- [ ] No DB migrations in this release are irreversible without a backup (or backup taken if any are)

## Notes

<!-- Anything special about this release: rotated keys, infra changes, breaking auth/API edges, etc. -->
