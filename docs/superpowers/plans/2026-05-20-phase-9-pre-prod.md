# Phase 9 (Pre-prod) — implementation plan

> **Source brainstorm:** in-session `/superpowers:brainstorming` on 2026-05-20.
> **Phase boundary reference:** [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) → "Phase 9 — Pre-prod" (lines 112–199).
> **Companion docs (Phase 10 / 11):** [`../../dev/prod-readiness.md`](../../dev/prod-readiness.md) for the launch-day index; [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) → "Phase 11 — Post-prod" for deferred backlog.

## Context

Phase 8 (visual polish + landing) shipped as `v0.4.0` on 2026-05-18. The post-release audit split the original "Phase 9 — QA + edge cases + launch" row into three buckets so launch-day operator work could be separated from the code/docs that has to land first.

This plan covers **Phase 9 (Pre-prod)** only — the code + docs that must land in `qa` before we cut `release/v1.0.0`. **Phase 10** (the prod cut-over, indexed against `docs/dev/prod-readiness.md`) and **Phase 11** (post-v1 backlog: #60, #69, #70, #74, GDPR endpoints, `cacheComponents`, etc.) are out of scope here.

Two facts drive the wave ordering:

1. **The official Claude GitHub Action is wired** — `@claude` on an `agent-ready` issue spins a `claude/issue-N-...` branch and a "Create PR ➔" link for the human. Most of Phase 9 is six categories of agent-handleable issues; the bottleneck is human PR-review throughput, not agent code time.
2. **No prod changes pre-v1** (memory: `feedback_no_prod_changes_pre_v1`). Everything in Phase 9 lands on `qa`; production migrations + env flips happen in Phase 10.

## Ship gate (when Phase 9 closes)

- Every checkbox under [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) → "Phase 9 — Pre-prod" is `[x]`.
- All PRs from Waves 0–4 merged to `qa`; CI green.
- All 10 verification-matrix boxes in epic [#86](https://github.com/SanchitB23/meetthefam/issues/86) ticked.
- `pnpm typecheck && pnpm lint && pnpm test` clean on `qa`.
- `e2e-smoke-tester` passes Phase 1-7 flows against the QA preview, plus the new Phase 9 verification flows.
- `release/v1.0.0` branch cut from `qa` and ready for Phase 10 cut-over.

## Issue snapshot (2026-05-20)

| # | Title | Wave | Status |
|---|---|---|---|
| #25 | Custom SMTP provider | W1 brainstorm → W3 code | needs-human spike |
| #49 | /login redirect | W0 | PR [#89](https://github.com/SanchitB23/meetthefam/pull/89) open — human review |
| #56 | Legal pages catalog | W1 brainstorm → W3 code | needs-human spike |
| #58 | postcss CVE | W0 | PR [#88](https://github.com/SanchitB23/meetthefam/pull/88) open — human review |
| #61 | Magic-link email branding | W3 (with SMTP) | needs-human design |
| #62 | Tree re-center undo | W2 | @claude'd 2026-05-20 |
| #68 | Error-handling umbrella | (decomposed) | superseded by #90-#93 |
| #71 | Add-person FAB link UX | W3 brainstorm → W4 code | needs-human spike |
| #72 | Zoom control cluster | W2 | @claude'd 2026-05-20 (with surface-overlap note vs #73) |
| #73 | Person-card contrast | W2 | @claude'd 2026-05-20 (with surface-overlap note vs #72) |
| #75 | Favicon verify | W2 | `agent-ready` label added 2026-05-20; @claude'd same day |
| #78 | derive-version on tagged builds | W2 | @claude'd 2026-05-20 |
| #81 | DB restore runbook | W2 | @claude'd 2026-05-20 (docs) |
| #82 | Postmortem template | W2 | @claude'd 2026-05-20 (docs) |
| #83 | Status-page link | W3 | **hold** — depends on W1 (c) observability decision |
| #84 | CI lint+typecheck | W1 | re-prompted "Implement a fix" 2026-05-20 (verify-only first pass) |
| #85 | pnpm test CI workflow | W4 | gate for downstream |
| #86 | Verification matrix epic | W5 | tracking only — boxes ticked by human |
| #90 | ErrorAlert foundation | W1 | @claude'd 2026-05-20 — **blocks #91/#92/#93** |
| #91 | Auth flow typed errors | W3 | **hold** — @claude after #90 merges |
| #92 | Dashboard server actions | W3 | **hold** — @claude after #90 merges |
| #93 | Tree-page server actions | W3 | **hold** — @claude after #90 merges |

## Wave plan

### Wave 0 — Clear the in-flight queue

**Goal:** land what's already in review before opening new fronts.

- Human review + merge **PR #89** (`fix/49-login-redirect`) — merge first so any auth-flow rebase from #91 is clean.
- Human review + merge **PR #88** (postcss CVE override via `pnpm.overrides`).

**Exit:** both merged to `qa`; CI green on `qa`.

**Risks:** #58 is a transitive bump — verify the dev build + dev-mode behaviour post-merge.

### Wave 1 — Unblockers + brainstorm kick-off

**Goal:** get the dependency-blocking ticket moving; start three parallel decision tracks.

**Agent work (kicked off 2026-05-20):**
- `@claude` **#90** (ErrorAlert + `mapErrorCode` + global error boundary). Strictly first — #91/#92/#93 must wait for the API contract.
- Re-comment `@claude Implement a fix` on **#84** (CI lint+typecheck Action).

**User-driven brainstorms (run in parallel with agent work — separate `/superpowers:brainstorming` sessions):**
- **(a) SMTP provider pick** — Resend / Postmark / SES / SendGrid. Decision unblocks Wave 3 SMTP code. Existing ticket: [#25](https://github.com/SanchitB23/meetthefam/issues/25). Decision should be written into that issue as a comment + into a new ADR if cost/lock-in matters.
- **(b) Legal pages catalog** — privacy, terms, cookies, about, contact. Decision unblocks Wave 3 page scaffolding. Existing ticket: [#56](https://github.com/SanchitB23/meetthefam/issues/56). **Flag:** actual policy text needs a source (Termly / iubenda / lawyer) — decide whether @claude generates prose or just scaffolds.
- **(c) Observability stack** — Sentry y/n + uptime monitor (BetterStack / UptimeRobot / Vercel built-in). Decision unblocks Wave 2 #83 (status-page URL) + optional Wave 3 Sentry-SDK wiring. No existing ticket — open a fresh brainstorm-tracking issue or capture the decision inline in this plan.

**Exit:**
- #90 PR merged to `qa`.
- #84 PR merged to `qa`.
- All three brainstorm decisions written down (provider chosen, page list catalogued, observability stack named).

**Risks:**
- #90's ErrorAlert API shape locks the contract for the consumers — review carefully; ergonomics > speed.
- **Ripple risk:** once #84 (lint+typecheck) merges, every PR in flight gets gated. Budget a buffer day for the first-after-merge wave of CI failures.

### Wave 2 — Parallel agent swarm: independent bugs + polish + docs

**Goal:** burn down agent-ready backlog while #90 is in review/merging.

**`@claude`'d in parallel 2026-05-20:**
- **#62** tree re-center undo
- **#72** zoom control cluster *(surface-overlap note vs #73 in comment)*
- **#73** person-card contrast *(surface-overlap note vs #72 in comment)*
- **#75** favicon verify *(`agent-ready` label added first)*
- **#78** `derive-version.mjs` tagged-build edge case
- **#81** DB restore runbook (docs)
- **#82** postmortem template (docs)

**Hold:** #83 (status-page link) waits for Wave 1 (c) brainstorm output to know which URL to link.

**Exit:** all seven PRs merged to `qa`. No conflict cascades on the canvas-touching pair (#72/#73).

**Shape:** 2-3 days, dominated by human PR review throughput.

### Wave 3 — #68 consumer fan-out + brainstorm-output implementation

**Goal:** apply the ErrorAlert foundation; start the brainstorm-output implementation tracks.

**Agent work (in parallel, once #90 is merged to `qa`):**
- `@claude` **#91, #92, #93** in parallel — three independent surfaces (auth / dashboard / tree-page) consuming the #90 contract.
- `@claude` **#83** (status-page link — URL now known).
- **SMTP code track:** open new issues for (i) SDK wire-in `src/lib/email/inviteEmail.ts`, (ii) magic-link template branding ([#61](https://github.com/SanchitB23/meetthefam/issues/61)), (iii) invite template branding. @claude the code tickets. **Separate** the human-only DNS / provider-account / DKIM-SPF-DMARC tasks into their own tickets (don't @claude them — ops work).
- **Legal pages code track:** open `/privacy` and `/terms` issues from the W1 (b) catalog. @claude both for scaffolding (per W1 (b) decision on prose-vs-scaffolding).
- **Sentry SDK wire (if chosen in W1 (c)):** open the SDK-wire issue; @claude it. `SENTRY_DSN` env-var stays for Phase 10.

**#71 brainstorm** ([add-person FAB link relationship UX](https://github.com/SanchitB23/meetthefam/issues/71)) runs in this wave (not earlier — UX-deep but not blocking other work). Output carries into Wave 4 implementation.

**Exit:** all #68 sub-issues merged. SMTP wired in code (env-var flip deferred to Phase 10). `/privacy` + `/terms` + footer live. Sentry SDK in code (if chosen).

**Risks:** SMTP DNS is async (TTL up to 24h) — submit DKIM/SPF/DMARC records early in this wave, even before SDK code lands.

### Wave 4 — Phase 8 polish carry-overs + CI gate

**Goal:** knock out the visual/UX polish list and land the test workflow.

**Agent work:**
- `@claude` **#85** (`pnpm test` CI workflow with Supabase service container).
- **Phase 8 polish carry-overs** from [phase-backlog.md → "Phase 8 polish carry-overs"](../../tasks/phase-backlog.md): pointers to still-unticked Phase 8 rows (landing page if anything left, empty/loading/error states, Suspense + `useLinkStatus`, tree-settings unified sheet, revoke-member copy, decorative motifs, Cormorant italic audit, tree-nav animations). Each independently @claude'able **once Wave 3 brainstorms aren't blocking it**.
  - **Hold #71** until its brainstorm output exists.
  - **Human-only items** — decorative motifs + italic audit need aesthetic judgement; keep these out of the @claude batch.

**Exit:** all Phase 8 polish boxes ticked **in their original Phase 8 location** (they're pointers, not duplicates). `pnpm test` workflow gating PRs on `qa`.

### Wave 5 — Verification matrix + security hardening

**Goal:** execute, don't code. Manual / scripted verification before tag.

**Verification matrix (epic [#86](https://github.com/SanchitB23/meetthefam/issues/86) — 10 boxes):** two-account smoke, mobile gestures, editor round-trip, share-link incognito, RLS negative test, 200-person perf, person-delete storage check, tree-delete cascade, Lighthouse, real-4G photo upload, `--turbopack` flag sweep.

**Security hardening:**
- Execute key rotation per [`project_pre_prod_key_rotation.md`](../../../.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/project_pre_prod_key_rotation.md) (includes the 2026-05-12 `SUPABASE_ACCESS_TOKEN` exposure).
  - **Risk:** rotation may invalidate CI secrets — confirm it can happen *before* tag without breaking the QA env, OR move to Phase 10 if it would.
- Confirm pre-commit secret-scanning hook fires on a fake AWS key.
- Confirm branch-protection ruleset `16283379` still active on `main`.

**Observability decisions docs:** DB restore runbook (#81 from W2), postmortem template (#82 from W2), status-page link (#83 from W3), on-call / contact info documented (single page in `docs/runbooks/` or appended to README).

**Exit:** all 10 verification boxes ticked. Key rotation executed (or explicitly punted to Phase 10 with reason).

### Wave 6 — Release cut

**Goal:** tag and hand off.

Branch cut: `qa` → `release/v1.0.0`. From here Phase 10 operator work takes over (prod env vars, prod migrations, SMTP env flip, Sentry DSN, domain). Release recipe per [`../../dev/releases.md`](../../dev/releases.md) + [ADR 0009 Amendment 4](../../adrs/0009-versioning-and-releases.md): `release/v1.0.0` → `main` (merge commit) → `gh release create --target main` → post-tag prod redeploy (memory: `feedback_release_redeploy_after_tag.md`) → push `release/v1.0.0:qa` fast-forward.

## Review-and-merge cadence note

With 6-8 PRs concurrent across Waves 2-4, the bottleneck is human review. To keep it manageable:

1. **Daily 30-min review block** — one focused pass per day.
2. **Triage order:** blockers (#90, then #84) → security/CVE → small docs PRs (skim-merge to clear count) → bug fixes → polish.
3. **Rebase discipline:** every PR rebased on latest `qa` before review; fast-forward merge only.
4. **One PR per agent run** — if @claude posts a multi-surface diff, ask for a split (precedent: #68 → #90-#93).
5. **Label PRs by wave** (`wave-2`, `wave-3`) for batched sorting.
6. **Backpressure:** don't @claude the next batch (Wave 3 fan-out) until current batch ≤ 2 open PRs.
7. **Visual PRs (#72, #73, polish carry-overs):** attach a Vercel preview screenshot to save a round-trip.

## Mis-categorisation flags (kept for traceability)

- **#83 status-page link** — listed in the Phase 9 bug-fix block, but depends on the W1 (c) observability brainstorm output (the URL doesn't exist until we pick the uptime tool). Held in Wave 3.
- **#71 add-person FAB UX** — listed under Phase 8 polish carry-overs but `spike` labelled and needs a brainstorm; the brainstorm runs in Wave 3 (when it's actually needed), not Wave 1.
- **SMTP human-ops steps** — "Set up the provider account" + "Verify sending domain (DKIM/SPF/DMARC)" in phase-backlog.md → "Custom SMTP" are ops work, not @claude'able. Open them as separate tickets in Wave 3 so the agent ticket for the SDK wire-in doesn't sit waiting on DNS.
- **Legal pages prose** — `@claude` can scaffold the routes + heirloom chrome; the policy *text* needs a source (Termly / iubenda / lawyer). Decide in W1 (b) before opening agent tickets.

## Action items already executed by this plan (2026-05-20)

- ✅ `gh issue edit 75 --add-label agent-ready` — favicon issue picked up by the agent track.
- ✅ `@claude` comment on #90 (Wave 1 unblocker).
- ✅ `@claude Implement a fix` comment on #84 (re-prompt after verify-only first pass).
- ✅ `@claude` comments on #62, #72, #73, #75, #78, #81, #82 — Wave 2 swarm (with surface-overlap notes on #72 / #73).
- ✅ `docs/tasks/current-phase.md` flipped from Phase 8 → Phase 9 (Pre-prod) via `task-doc-keeper`.

## Critical files

- [`docs/tasks/phase-backlog.md`](../../tasks/phase-backlog.md) — Phase 9 / 10 / 11 source of truth.
- [`docs/tasks/current-phase.md`](../../tasks/current-phase.md) — rewritten to point at Phase 9 alongside this plan landing.
- [`docs/dev/prod-readiness.md`](../../dev/prod-readiness.md) — Phase 10 index; not edited in Phase 9 but referenced from Wave 6.
- [`docs/superpowers/specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" — architectural view of Phase 9 (single row).
- [`.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/project_pre_prod_key_rotation.md`](../../../.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/project_pre_prod_key_rotation.md) — Wave 5 key rotation source.
- [`src/lib/email/inviteEmail.ts`](../../../src/lib/email/inviteEmail.ts) — Wave 3 SMTP SDK wire-in target.
- `.github/pull_request_template.md` — PRs (incl. agent-opened) must follow per memory `feedback_pr_template_compliance.md`.

## Out of scope

- **Phase 10** (prod cut-over) — separate plan when Phase 9 closes.
- **Phase 11** (post-v1 backlog: #60, #69, #70, #74; `cacheComponents`, GDPR endpoints, etc.) — separate plans per item when picked up post-v1.
