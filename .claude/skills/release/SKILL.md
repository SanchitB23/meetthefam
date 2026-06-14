---
name: release
description: Cut and ship a meetthefam release — version selection, release/vX.Y.Z branch, merge-to-main, GitHub tag, prod redeploy, QA↔prod migration parity, and ff-push back to qa. Use when the user wants to cut a release, ship a version, or close out a milestone. User-invoked only (has side effects: tags, deploys).
disable-model-invocation: true
---

# Release — cut & ship

Drives the full release cut for **meetthefam**. The canonical, always-authoritative
recipe lives in [`docs/dev/releases.md`](../../../docs/dev/releases.md) — **read it
before each cut**; this skill is the operational checklist + the hard-won gotchas
that aren't obvious from the steps alone. Rationale: [ADR 0009](../../../docs/adrs/0009-versioning-and-releases.md).

## Preconditions

- A milestone's issues are all closed → milestone completion **is** the release trigger.
  Cut + ship **first**, then close the milestone (the nearest open milestone then
  becomes the active cycle).
- **Docs-only changes never get a release** — they ride the next feature release.
- Work from a sibling `git worktree`, not the primary checkout.

## Version selection

- **Post-v1.0 (current):** Conventional Commits since the last tag decide the bump —
  `feat:` → minor, `fix:` → patch, breaking → major. (Last shipped: **v1.1.0**.)
- Confirm the resulting `vX.Y.Z` against the table in `releases.md` before tagging.

## Recipe (mirror of releases.md — verify against the doc each time)

Run each step yourself; **pause for the user** at the gates noted below.

0. **`gh auth status`** — confirm the **SanchitB23 (personal)** account is active,
   NOT the org account (`SQB6461_YUMGHCP`). Both are logged in on this machine.
1. Cut from a synced qa: `git checkout qa && git pull --ff-only` → `git checkout -b release/vX.Y.Z`.
   The release branch carries **zero unique commits** — no version bump (sentinel
   `0.0.0-dev`; version is build-time-derived from the tag).
2. `git push -u origin release/vX.Y.Z`.
3. Write release notes to `/tmp/vX.Y.Z-notes.md`, then `gh pr create --base main --head
   release/vX.Y.Z --body-file …`. **Open the PR as a draft** (`--draft`); the **user
   marks it ready** — do not merge a draft, do not ask whether to mark it ready.
   Follow `.github/PULL_REQUEST_TEMPLATE/release.md` end-to-end.
4. **Gate — wait for the user to mark ready + approve.** Then merge with a **real merge
   commit**: `gh pr merge --merge --delete-branch=false <pr>`. Never squash, never rebase.
5. `git fetch origin main` → `gh release create vX.Y.Z --target main --notes-file …`
   (drop `--prerelease` from v1.0.0 onward). This is the moment the tag exists.
6. **Redeploy prod AFTER the tag** (else `<VersionFooter>` renders the *previous*
   version — the merge build raced ahead of the tag). Preferred (CLI, cached build,
   ~30s): `PROD_URL=$(npx vercel ls --prod meetthefam | awk '/Ready/{print $3; exit}')`
   (the deployment URL is the 3rd whitespace-separated field of the table row), then
   `npx vercel redeploy "$PROD_URL"`. Do **not** use `mcp__vercel__deploy_to_vercel` —
   it only returns deployment *instructions*, it does not deploy (caught on the v1.2.0
   ship 2026-06-13). Verify (prod's alias is the custom domain, not
   meetthefam.vercel.app): `curl -s https://mtf.sanchitb23.in/ | grep -oE
   'v[0-9]+\.[0-9]+\.[0-9]+'` → must print `vX.Y.Z`, not `vPREV-dev.<sha>`.
7. **Migration parity QA↔prod.** Give the Supabase↔GitHub integration 2–3 min, then
   `mcp__supabase__list_migrations` on **prod `ycnsgkotrbjifsjkqmvn`** and **QA
   `ljjvwtpifmoshfknlbaj`**; cross-check by **name** (timestamps differ — clock drift
   is expected). **KNOWN FAILURE MODE (#177):** the integration reliably auto-applies
   on direct file-diffs but **silently skips migrations that first reach main via a
   release-branch merge commit** — which is *every* release. So treat a **post-release
   manual apply to prod as the expected path**, not the exception. If any QA name is
   absent on prod, apply it via the fallback in
   [`docs/dev/prod-readiness.md`](../../../docs/dev/prod-readiness.md) §1.
8. ff-push qa to the release tip: `git push origin release/vX.Y.Z:qa` then
   `git push origin --delete release/vX.Y.Z`. If it rejects with non-fast-forward
   (qa moved during the window), use the merge fallback in releases.md.
9. Sync + verify: `git checkout qa && git pull --ff-only && git fetch --tags --prune &&
   git tag -l vX.Y.Z` (should print the tag).

## After shipping

- Close the milestone; confirm the nearest open milestone is now the active cycle.
- The generated `src/lib/generated/version.ts` is build-time only — if you restored it
  to cut, leave the working tree clean (it's gitignored / sentinel-driven).

## See also

- [`docs/dev/releases.md`](../../../docs/dev/releases.md) — canonical recipe + rare-case fallback.
- [`docs/dev/migrations.md`](../../../docs/dev/migrations.md) — the migration promotion model behind step 7.
- [ADR 0009](../../../docs/adrs/0009-versioning-and-releases.md) — versioning + amendment history.
