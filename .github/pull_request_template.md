## Summary

<!-- 2-4 sentences: what changed and why. Match the Conventional-Commit prefix of the PR title (feat/fix/chore/docs/refactor/test/style). -->

## Changes

<!-- Bullet list of key files / areas touched. Helps reviewers scan the diff. -->

-
-

## Closes

<!--
One bare `Closes #N` line per issue this PR resolves — bare syntax only.
Markdown-link (`closes [#45](...)`) and bold comma-list (`**#44, #45**`) forms do NOT trigger auto-close.
Also set each issue's milestone (the current open cycle, e.g. v1.0 — Launch) so it tracks against the release.
Use "N/A" only for one-off chores with no backing issue.
-->

Closes #

## Test plan

<!-- How a reviewer (or future you) can verify this works end-to-end. Be specific. -->

- [ ]
- [ ]

## Manual human-testable checklist

<!--
Concrete click-through steps a human reviewer can perform in the running app.
Author: fill in feature-specific steps below. Reviewer: tick each box after walking through.
Delete a subsection if it doesn't apply.
-->

### App walkthrough (local dev — `pnpm dev` against `pnpm exec supabase start`)

- [ ] Pulled the branch, ran `pnpm install`, started Supabase + Next.js dev server
- [ ] Walked the golden path of the changed feature end-to-end (steps below)
  - [ ] Step 1: <!-- e.g. open / , click "New person", fill form, save -->
  - [ ] Step 2:
  - [ ] Step 3:
- [ ] Triggered the obvious failure path (invalid input, unauthorized access, etc.) and got a sensible error
- [ ] Checked the browser console — no new errors / warnings vs. `main`
- [ ] Checked Network tab — no failed requests, no unexpected calls

### QA preview (after the QA Vercel deploy goes green)

- [ ] Opened the Vercel preview URL for this PR on the QA project
- [ ] Repeated the golden-path walkthrough above against QA Supabase
- [ ] If feature touches share links: opened the share URL in an incognito window, confirmed read-only access works for a non-signed-in viewer

### Mobile viewport

- [ ] Tested at 375 × 667 (iPhone SE) in DevTools or on a real device — primary target per spec
- [ ] No layout breakage, touch targets are reachable, bottom sheets / modals dismiss cleanly

### Multi-tenant / RLS sanity (if the change touches DB queries)

- [ ] Signed in as a second user (or used a fresh incognito session) and confirmed the change does NOT leak data across tenants
- [ ] Viewed an unrelated tree's URL while signed in as the wrong user — got a 404 / forbidden, not the data

## Quality gates

- [ ] `pnpm typecheck` is clean
- [ ] `pnpm lint` is clean
- [ ] Relevant tests pass (`pnpm test`) — or N/A with reason
- [ ] No secrets staged (`.env`, `credentials.json`, `*.pem`, `*.key`)
- [ ] PR opened as **draft** — will be marked ready by the author once CI + self-review pass

### If this PR touches the database

- [ ] Migration applied locally (`pnpm exec supabase db reset` or targeted `db push`) and on QA
- [ ] RLS policies reviewed; `supabase-validator` agent dispatched (per `db-commit-detector` hook)
- [ ] `mcp__supabase__get_advisors` shows no new security / performance regressions

### If this PR has UI changes

- [ ] Screenshot or short clip attached for each affected screen
- [ ] Verified on a mobile viewport (primary target per spec)

## Notes for reviewer

<!-- Anything unusual, deliberately deferred, follow-ups filed elsewhere, etc. Delete if empty. -->
