# Release-flow divergence fix — design spec

> Brainstorm output for `/superpowers:brainstorming` on the recurring release-PR conflict pattern. Feeds the follow-on `/writing-plans` invocation.

## Context

We hit a 3-way merge conflict on `package.json` every time we open a release PR into `main`. Same pattern struck v0.1.0 (resolver commit `4673f59` referenced in the Phase 5 close-out doc) and v0.3.0 (resolver commit `097abaa` from the just-completed release). Two more releases at this cadence and we've burned an hour on the same manual resolution.

**Root cause.** The release flow creates two distinct commits in the DAG that carry the same content:

- `M_vX.Y.Z` — the merge commit on `main` (parents: previous-main, release-branch-tip).
- `S_vX.Y.Z_forward` — the squash commit on `qa` from the forward-PR that returns the version bump.

Both contain the `"version": "X.Y.Z"` change. Different SHAs, same content. Git's 3-way merge algorithm, when subsequently merging the next release branch into main, walks back from both tips and finds their common ancestor *before* the version bump — at which point `version` is `X.Y.(Z-1)`. The merge sees main side = `X.Y.Z` and release side = `X.Y.(Z+1)`. Both modified the same line. Conflict.

The same mechanism causes a slower-burning problem: `qa` and `main` accumulate divergent history after every release. Today the divergence is masked because only `package.json` differs, but any future file touched by the release recipe would compound it.

**Why we hit it and big-company shops don't.** We run Git Flow (`develop` = `qa`, plus `main`, plus `release/*`) — Vincent Driessen's 2010 model. Driessen himself [later wrote in 2020](https://nvie.com/posts/a-successful-git-branching-model/) that Git Flow doesn't suit web/SaaS. Modern equivalents — trunk-based development (Google, Meta, Stripe), GitHub Flow (GitHub, Heroku), GitLab Flow (GitLab, Etsy, Shopify) — all avoid this entirely by dropping the long-lived `develop` branch, OR (for shops that keep Git Flow, e.g. mobile teams shipping to App Store) by deriving the version file from git tags at build time so there's no committed `version` to conflict on.

**Scope.** This spec fixes the conflict *without* dropping the `qa` branch. Switching to GitHub Flow / trunk-based is a bigger conversation (deferred to v1.0 if/when team size justifies it). For pre-v1 solo-dev → small-team scale, the two changes below eliminate the conflict surface and the structural divergence at minimum cost.

## Locked decisions

| # | Decision | Locked value |
|---|---|---|
| 1 | Manual `version` bump on release | **Removed.** `pnpm version --no-git-tag-version` drops out of the release recipe entirely. |
| 2 | `package.json` `version` field | **Sentinel** — `"0.0.0-dev"`. Never edited by hand again. Not authoritative. |
| 3 | Authoritative version source | **Latest git tag** (`v0.4.0`, `v1.0.0`, etc.). Tags are created via `gh release create`. |
| 4 | Runtime version surface | New `src/lib/generated/version.ts` **committed at sentinel value `"0.0.0-dev"`**, overwritten on every `pnpm build` by the derive-version script. Exports `APP_VERSION: string`. Committed (not gitignored) so imports resolve out-of-the-box at dev-server time and on fresh clones. No consumer today; banner / Sentry tag / debug overlay are future additions. |
| 5 | Version derivation script | New `scripts/derive-version.mjs` (Node ESM, ~30 lines). Runs as a `prebuild` npm script. |
| 6 | Version string format | Production (tagged commit on `main`): `"X.Y.Z"`. Release-PR preview (`release/vX.Y.Z` branch): `"X.Y.Z-rc.<short-sha>"`. Other previews (qa, phase branches): `"<latest-tag>-dev.<short-sha>"`. Fallback (no git / no tags): `"0.0.0-dev"`. |
| 7 | Forward-PR (squash) back into qa | **Replaced** with `git push origin release/vX.Y.Z:qa` — a real fast-forward (no force). |
| 8 | Rare-case fallback | If `qa` moved during the release window (rare; non-emergency work landed on qa between cut-release and merge-release), the fast-forward push is rejected. Recipe falls back to a real merge: `git checkout qa && git merge --no-ff release/vX.Y.Z && git push origin qa`. Adds one merge commit on qa. Still no version conflict because the merge base is the release-branch tip. |
| 9 | Release branch carries unique commits | **No.** Without the version bump, the release branch is a snapshot pointer for the QA preview URL. Same SHA as the qa tip at cut-time. |
| 10 | Merge-commit-into-main requirement | **Unchanged.** Release PR still merges into main with `--merge` (real merge commit). Preserves release-branch history per ADR 0009 §4. |
| 11 | Phase-branch-as-default workflow | **Unchanged.** Recent memory rule (`feedback_feature_branch_workflow.md`) stays valid. |
| 12 | Pre-v1 no-prod-changes policy | **Unchanged.** This is a flow change, not a feature; it ships at the next phase release (v0.4.0) as a docs + scripts + memory update with zero migration. |
| 13 | ADR 0009 update | **Amendment 4** documents both halves of the fix. ADR 0010 also gets an amendment (drops the forward-PR mention). |

## Part 1 — Version derivation

### Files

- **New**: `scripts/derive-version.mjs` — Node ESM, ~30 lines. Reads git state; writes `src/lib/generated/version.ts`.
- **New (committed)**: `src/lib/generated/version.ts` — initial content `export const APP_VERSION = "0.0.0-dev"`. Regenerated on every `pnpm build`; commits to the regenerated file are not required (re-running `pnpm build` locally before pushing a feature branch will dirty the file, but the change is harmless — see "Committed regenerations" below).
- **Modified**: `package.json` — `version` → `"0.0.0-dev"`; new `prebuild` script.

### `scripts/derive-version.mjs`

```js
// Phase 8 — release-flow divergence fix.
//
// Runs as `prebuild`. Reads the latest git tag (and the current branch + sha)
// and writes `src/lib/generated/version.ts` exporting an APP_VERSION constant.
//
// Format rules (locked decision #6):
//   - On a tagged commit (production build on main):  "X.Y.Z"
//   - On a release/vX.Y.Z branch:                     "X.Y.Z-rc.<short-sha>"
//   - Otherwise (qa, phase, etc.):                    "<latest-tag>-dev.<short-sha>"
//   - Fallback (no git / no tags):                    "0.0.0-dev"

import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const OUTPUT = 'src/lib/generated/version.ts'

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function deriveVersion() {
  const latestTag = git('describe --tags --abbrev=0') // e.g. "v0.3.0" or ""
  if (!latestTag) return '0.0.0-dev'

  const tagVersion = latestTag.replace(/^v/, '') // "v0.3.0" → "0.3.0"
  const tagSha = git(`rev-parse ${latestTag}`)
  const headSha = git('rev-parse HEAD')
  const shortSha = git('rev-parse --short HEAD')

  // Tagged commit → release build
  if (tagSha && headSha && tagSha === headSha) return tagVersion

  // Vercel sets VERCEL_GIT_COMMIT_REF for the building branch. Fall back to
  // local git symbolic-ref for non-Vercel builds (local pnpm build, CI).
  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    git('symbolic-ref --short HEAD') ||
    ''

  const releaseBranchMatch = branch.match(/^release\/v(\d+\.\d+\.\d+)$/)
  if (releaseBranchMatch) {
    return `${releaseBranchMatch[1]}-rc.${shortSha || 'unknown'}`
  }

  return `${tagVersion}-dev.${shortSha || 'unknown'}`
}

const version = deriveVersion()
const content = `// Generated by scripts/derive-version.mjs at build time. Do not edit.
export const APP_VERSION = ${JSON.stringify(version)}
`

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, content)
console.log(`[derive-version] APP_VERSION = ${version}`)
```

### `package.json` changes

```json
{
  "version": "0.0.0-dev",
  "scripts": {
    "prebuild": "node scripts/derive-version.mjs",
    "build": "next build"
  }
}
```

(Other scripts unchanged.)

### Vercel build compatibility

Vercel's build container has the `.git` directory available by default (it clones the repo for the build). `git describe --tags --abbrev=0` works there. The script's environment-variable fallback (`VERCEL_GIT_COMMIT_REF`) handles the case where Vercel's clone is shallow and `symbolic-ref` returns nothing — Vercel guarantees `VERCEL_GIT_COMMIT_REF` is set for every build.

### Committed regenerations

`src/lib/generated/version.ts` is committed at the sentinel value `"0.0.0-dev"`. Running `pnpm build` locally overwrites it with a branch-specific value (e.g., `"0.3.0-dev.abc1234"`). This produces an "untracked change" in `git status` after every local build.

This is intentional and harmless:

- Vercel's build container starts from a fresh clone of the pushed commit. The file is at sentinel value; the script overwrites it; the build proceeds. The committed file is never updated from CI.
- For local dev: the developer can choose to either commit the regenerated file (if they want the branch's version string in commits) or just discard the change with `git checkout -- src/lib/generated/version.ts` before staging. Most often they'll just leave it dirty and push — the staged-file discipline (`git add <specific files>`, per CLAUDE.md) means the regenerated file won't accidentally land.
- Typecheck is always happy because the committed file always exports a valid `APP_VERSION` string. There's no "missing module" failure mode.

Next.js' `pnpm dev` does NOT run `prebuild` (Next.js dev mode doesn't trigger npm lifecycle scripts). Dev-server-time `APP_VERSION` shows the committed sentinel value (`"0.0.0-dev"`). For most consumers (debug overlay, banner) this is acceptable.

## Part 2 — Fast-forward qa from release tip

### Release-recipe diff

Old Step 7 (forward-PR back to qa via squash-merge):

```bash
# OLD
gh pr create --base qa --head release/vX.Y.Z --title "chore(release): forward vX.Y.Z bump to qa" --body "..."
# User squash-merges manually
```

New Step 7 (fast-forward push):

```bash
# NEW
git push origin release/vX.Y.Z:qa     # fast-forward — no --force needed
git push origin --delete release/vX.Y.Z
```

### Rare-case fallback

If `git push origin release/vX.Y.Z:qa` rejects with "non-fast-forward" — qa has moved during the release window (rare; the release window is typically <1 hour and we don't merge non-emergency work in it):

```bash
git checkout qa
git pull --ff-only
git merge --no-ff release/vX.Y.Z -m "chore(release): merge vX.Y.Z into qa"
git push origin qa
git push origin --delete release/vX.Y.Z
```

This adds one merge commit on `qa`. The merge base of the **next** release PR with main is still the release-branch tip (same as the happy path), so no version conflict. Mention this fallback in the release recipe but don't optimize for it — keep the release window short and the happy path is `git push origin release/vX.Y.Z:qa`.

### Why the fast-forward works

```
Before fast-forward:
main:   ... ── M_v0.2.0 ──────────────── M_vX.Y.Z          (merge of release/vX.Y.Z)
                                          ↑
                                          │ (parent: D)
qa:     ... ── (post-v0.2.0) ── phase ── C
                                          ↘
release/vX.Y.Z:                            D                (snapshot — no unique commits with Part 1's bump removal)
```

Wait — without the version-bump commit (Part 1 removed `pnpm version`), the release branch has **zero unique commits** vs. qa at cut-time. So C and D are the same SHA. The release PR merges qa@C into main as M_vX.Y.Z. After the merge:

```
main:   ... ── M_v0.2.0 ──────────────── M_vX.Y.Z
                                          ↑
                                          │ (parent: C)
qa:     ... ── (post-v0.2.0) ── phase ── C                  (no movement during release window)
release/vX.Y.Z:                           C                  (same SHA)
```

Now `git push origin release/vX.Y.Z:qa` is a **no-op** push (qa is already at C). Vercel doesn't rebuild. The "fast-forward" step is degenerate but harmless. Delete the release branch.

For the *next* release PR (v0.5.0), the merge base of release/v0.5.0 (cut from qa) and main is **C** (the snapshot point of vX.Y.Z), which exists as a parent of M_vX.Y.Z on main and is the actual SHA of qa@C. **There's no ghost commit anywhere.**

If qa DID move during the release window, the release branch's snapshot is C; qa is at C'. After the release PR merges, `git push origin release/vX.Y.Z:qa` rejects. We fall back to merging release/vX.Y.Z into qa (real merge commit). The next release's merge base ends up at C (a parent of both the merge commit on main and the merge commit on qa) — still no conflict.

## Part 3 — Doc + memory updates

### `docs/adrs/0009-versioning-and-releases.md` — Amendment 4

Append a new "Amendment 4 (2026-05-15)" section. Body:

- **Drop manual `pnpm version` from the release recipe.** `package.json` `version` field becomes a sentinel `"0.0.0-dev"`. Runtime version comes from `src/lib/generated/version.ts`, regenerated on every build by `scripts/derive-version.mjs` from the latest git tag.
- **Replace the forward-PR (squash) step with `git push origin release/vX.Y.Z:qa`** — a regular fast-forward. This eliminates the ghost-commit class of conflicts (same content on different SHAs) that hit v0.1.0 and v0.3.0. Rare-case fallback documented in `docs/dev/releases.md`.
- **Rationale**: the version-bump-on-two-paths divergence pattern is structural to Git Flow with manual `version` files; modern shops on Git Flow auto-derive `version` from tags. We adopt that pattern without dropping the rest of the flow.
- **Alternatives considered, not chosen**: (a) keep manual bump but force-resolve via `-X ours` — symptom-level; (b) switch to GitHub Flow / trunk-based — bigger refactor, deferred to v1.0+; (c) merge-forward the PR instead of squash — works structurally but introduces a per-release merge commit on qa for no benefit over fast-forward.

### `docs/dev/releases.md` — rewrite Step 3 + Step 7

- Delete Step 3 ("Bump version on the release branch with `pnpm version <bump> --no-git-tag-version`"). Renumber the rest.
- Rewrite the (renumbered) "fast-forward qa" step with the two commands above + the rare-case fallback.
- Add a brief note that `package.json` `"version"` is a sentinel and not the authoritative version. Link to ADR 0009 Amendment 4.

### `docs/dev/git-workflow.md`

If it references `pnpm version` or the forward-PR (it likely does, given the release walkthrough), update to match the new flow.

### Memory updates

- **`feedback_pr_based_promotion.md`**: clarify that the qa update step is now a **fast-forward push** (was: forward-PR squash-merge). The "merge commit into main" half stays unchanged.
- **`feedback_feature_branch_workflow.md`**: drop the bullet that mentions "release/vX.Y.Z is then PR'd back into qa (squash) to keep qa and main from diverging on package.json" — replace with "release/vX.Y.Z is then fast-forwarded into qa via `git push origin release/vX.Y.Z:qa` (no PR; degenerate no-op push in the happy case)."

### `MEMORY.md` index

No structural change; the one-line hooks of the two memories above tweak slightly to reflect the new wording.

## Scope

**In scope (this spec):**
- Version-derivation script + sentinel `version` in `package.json` + committed `src/lib/generated/version.ts`.
- Recipe change from forward-PR to fast-forward push.
- ADR 0009 Amendment 4 + `docs/dev/releases.md` rewrite.
- Memory updates (`feedback_pr_based_promotion.md`, `feedback_feature_branch_workflow.md`, `MEMORY.md` index).

**Out of scope (deferred):**
- Switching to GitHub Flow / trunk-based development (drop `qa` entirely). Re-evaluate at v1.0 when team size justifies.
- Automated release tagging (semantic-release / release-please tooling). Manual `gh release create` stays — it's three commands per release.
- A UI surface that displays `APP_VERSION` (dev banner, debug overlay, Sentry tag). YAGNI — `APP_VERSION` is exported but unused at v0.3.0+1. Future spec when first consumer needs it.
- ADR 0010 amendment for phase-branch-as-default (already flagged separately at Phase 7 close-out).

## Verification

1. **Local smoke** — `pnpm build` runs `derive-version.mjs` and writes `src/lib/generated/version.ts` with the expected format string. Inspect the file post-build:
   - On qa: `"<latest-tag>-dev.<short-sha>"`.
   - On a temp `release/v0.4.0` branch: `"0.4.0-rc.<short-sha>"`.
   - At a tagged commit: just the tag.
2. **Vercel preview** — push the implementation branch (`feat/phase-8/release-flow-fix` or whatever Phase 8 calls it), let Vercel deploy, inspect the deployment's build logs for the `[derive-version] APP_VERSION = ...` line. Confirm it matches the expected format for the branch.
3. **Dry-run the new release flow** — at the next phase release (v0.4.0):
   - Cut `release/v0.4.0` from qa; verify the release branch carries **zero unique commits** (no version-bump commit anymore).
   - Open release PR → main. Verify **no 3-way conflicts** on `package.json` (it's at the sentinel value on both sides).
   - Merge with merge commit. Confirm main's HEAD matches release-branch-tip via the merge commit.
   - `gh release create v0.4.0 --target main --prerelease` — tag exists.
   - `git push origin release/v0.4.0:qa` — succeeds as a no-op (degenerate happy path; qa was already at the release-branch tip).
   - Inspect Vercel's production build of main post-merge — `APP_VERSION` reads `"0.4.0"` in the build logs.
4. **Regression check** — `pnpm typecheck && pnpm lint && pnpm test --run` clean. The new `src/lib/generated/version.ts` is committed at `"0.0.0-dev"` so importing it never produces a "module not found" in CI.

## Critical files reference

For the follow-on `/writing-plans` session:

- [`scripts/derive-version.mjs`](../../../scripts/derive-version.mjs) — new (this spec).
- [`src/lib/generated/version.ts`](../../../src/lib/generated/version.ts) — new (committed at sentinel value).
- [`package.json`](../../../package.json) — version sentinel + `prebuild` script.
- [`docs/adrs/0009-versioning-and-releases.md`](../../adrs/0009-versioning-and-releases.md) — Amendment 4.
- [`docs/dev/releases.md`](../../dev/releases.md) — recipe rewrite.
- [`docs/dev/git-workflow.md`](../../dev/git-workflow.md) — refresh references.
- `/Users/sqb6461/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/feedback_pr_based_promotion.md` — wording update.
- `/Users/sqb6461/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/feedback_feature_branch_workflow.md` — drop the forward-PR mention.
- `/Users/sqb6461/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/MEMORY.md` — index hooks.

## Open questions resolved during brainstorming

- **"Should we drop qa entirely (GitHub Flow)?"** Deferred to v1.0. Pre-v1 solo dev → small team doesn't justify the refactor.
- **"Should we merge-commit the forward-PR instead of squash?"** Rejected. Fast-forward is cleaner (no extra merge commit on qa) and just as structurally sound.
- **"Should we auto-tag via CI (semantic-release)?"** Rejected for now. Manual `gh release create` is three commands; tooling overhead doesn't pay off until cadence accelerates.
- **"Should `src/lib/generated/version.ts` be gitignored?"** Rejected — committed at sentinel value so imports work out-of-the-box on a fresh clone and at dev-server time without a manual `pnpm prebuild` step.
- **"What's the version string for preview builds?"** Locked: `"X.Y.Z-rc.<sha>"` for release branches; `"<latest-tag>-dev.<sha>"` elsewhere.

## Connection to the larger workflow

This spec is independent of any feature work. It can land as a Phase 8 sub-task (most natural — Phase 8 is open) or as a standalone `docs+chore` PR if Phase 8 brainstorming isn't ready yet. Either way:

- The change has **zero migration**, zero DB surface, zero RLS impact. No `supabase-validator` dispatch needed.
- The change is **localized to release-time discipline + build-time scripting**. No runtime user-facing change.
- The **first release that benefits** is v0.4.0 (the next phase close-out). v0.3.0 is shipped and won't be re-touched.
