# Prod readiness checklist (pre-v1.0 / go-live)

> **Status:** collecting through Phases 6–9. Final pass at Phase 9 ticks every box before flipping live.

## Policy (set 2026-05-14, during Phase 6 close-out)

**No production DB or production Vercel config changes happen during Phases 6, 7, 8.** All per-phase migrations apply to **local + QA only**. The Vercel production project will deploy whatever lands on `main`, but **production traffic is zero in the pre-v1 window**, so a "main has schema features `family-tree-prod` doesn't" gap is acceptable until the v1.0 cut applies everything in one pass.

**Implication for the release recipe** ([ADR 0009 §4](../adrs/0009-versioning-and-releases.md)): the standard `release/vX.Y.Z` flow runs end-to-end (release-branch → main with merge commit → `gh release create --target main --prerelease` → forward-PR back to `qa`), but the "Apply Phase N migration to prod" step is **skipped** for v0.2.0 through v0.9.x. Phase close-out checklists in `docs/tasks/current-phase.md` reflect this by ticking the prod-apply box as "deferred — see `docs/dev/prod-readiness.md`".

**Want production Vercel deployments to keep matching prod DB state during the freeze?** Pin the Vercel production branch to the `v0.1.0` tag via the Vercel dashboard (Settings → Git → Production Branch). Production builds stop following `main` and stay on the last working state until you un-pin at v1.0.

---

## 1. Supabase: `family-tree-prod` (`ycnsgkotrbjifsjkqmvn`) parity with QA

- [ ] Apply ALL accumulated post-v0.1.0 migrations to prod in timestamp order via `mcp__supabase__apply_migration`. As of v0.2.0 the queue is:
  - [ ] `20260513211135_tree_invites.sql` (Phase 6 sub-task 1 — already on QA as version `20260514032107` per the MCP-clock-drift pattern)
  - *(future Phase 7 / 8 migrations get appended here as they land)*
- [ ] After each apply, run `mcp__supabase__list_migrations` against prod and cross-check (name, order) against QA — timestamp prefix drift is expected and OK per [`docs/dev/migrations.md`](migrations.md).
- [ ] Run `mcp__supabase__get_advisors` (security + performance) on prod. Compare drift against the v0.1.0-baseline-13-security-WARNs / 5-performance-INFOs disposition. Document any NEW prod-only entries in this file under "Known advisor entries".
- [ ] Run `mcp__supabase__list_tables` against prod; row-count parity isn't expected (prod is empty), but **RLS-enabled flag on each table must match QA**.
- [ ] Enable "Leaked Password Protection" via Supabase Auth dashboard (cleans up one of the baseline-13 security WARNs).
- [ ] Bump Auth rate limits (Auth → Rate Limits) to handle launch-day traffic. Default ~3–4/hr per project, per [`project_smtp_rate_limit.md`](../../../.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/project_smtp_rate_limit.md). Lifts only after custom SMTP lands (§4).
- [ ] Verify Storage `photos` bucket on prod: `public=true`, `file_size_limit=524288`, `allowed_mime_types=['image/jpeg']`, plus the 4 RLS policies (`photos_insert_editor` / `photos_update_editor` / `photos_delete_editor` / `photos_select_editor`). Phase 5 sub-task 5 installed these; re-verify post-migration replay.
- [ ] Set a strong prod DB password (if still the default); record in a password manager.

## 2. Vercel: production project

- [ ] Production env vars (Vercel dashboard → Settings → Environment Variables, Production scope):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL=https://ycnsgkotrbjifsjkqmvn.supabase.co`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY=<prod service role key>` — **server-only, NEVER `NEXT_PUBLIC_*`**
  - [ ] `MEETTHEFAM_EMAIL_INVITES_ENABLED=true` (only after custom SMTP lands — §4)
  - *(any new env vars introduced in Phases 7 / 8 / 9 get appended here)*
- [ ] Custom production domain configured + SSL cert provisioned via Vercel.
- [ ] Domain added to Supabase Auth's **Site URL** + **Redirect URLs** allowlist (otherwise magic-link + OAuth callbacks fail with `redirect_to mismatch`).
- [ ] Vercel Analytics + Speed Insights confirmed reporting in production (already mounted in `src/app/layout.tsx` since Phase 0).
- [ ] Plan tier decision (Hobby vs Pro). Hobby is OK for launch but bandwidth caps at 100 GB/mo + 1 team seat. Upgrade pre-launch if growth expected.
- [ ] Production branch in Vercel set to `main` (unpin from the v0.1.0 tag if it was pinned during the pre-v1 freeze).
- [ ] Vercel password protection: keep enabled on `qa` previews if desired; ensure production has it OFF.

## 3. Auth + OAuth

- [ ] Google OAuth Client ID + Secret configured for production:
  - [ ] Authorized redirect URIs include `https://<prod-domain>/auth/callback`
  - [ ] OAuth Consent Screen moved from "Testing" → "In production" in Google Cloud Console
- [ ] Upload branded auth email templates (issue #61) to prod Supabase → Auth → Email Templates: `supabase/templates/magic_link.html` (Magic Link) + `supabase/templates/confirm_signup.html` (Confirm signup). Authored in `emails/`; regenerate with `pnpm emails:build`; recipe in [`email-templates.md`](./email-templates.md).
- [ ] Invite email template branded (only once custom SMTP lands — §4).
- [ ] Smoke-test the auth flow against the production URL: anon hitting `/dashboard` → bounced through `/login?next=/dashboard` → magic-link arrives → click → land on dashboard. Plus the same for `/tree/<id>` and `/invite/<token>`.
- [ ] **`?next=` preservation** through the magic-link round-trip — verified working post-Phase-6 (commit `8758755`). Smoke-test it on prod for regression coverage.

## 4. Email deliverability (custom SMTP — tracks GitHub issue #25)

- [ ] Provider chosen: **Resend** (locked in #25). Account created; sender `noreply-mtf@sanchitb23.in` on domain `sanchitb23.in`.
- [ ] Sending domain verified (DKIM + SPF + DMARC records set in DNS).
- [ ] Test email rendering in Gmail, Outlook, Apple Mail (light + dark mode); inline images + buttons resolve.
- [x] `src/lib/email/inviteEmail.ts` sends via the Resend SDK (minimal inline HTML body; rich branded invite template deferred to follow-up #154). Stub `throw` removed in #25. Flip `MEETTHEFAM_EMAIL_INVITES_ENABLED=true` per environment once SMTP is verified.
- [ ] Provider API key added to prod env vars (Vercel + Supabase Edge Functions, if used).
- [ ] Supabase Auth → Email Templates: magic-link template updated to ship via the custom SMTP path (Supabase routes via the same SMTP when configured).
- [ ] Flip `MEETTHEFAM_EMAIL_INVITES_ENABLED=true` in prod env (§2).

## 5. Security + key rotation

- [ ] All items from [`project_pre_prod_key_rotation.md`](../../../.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/project_pre_prod_key_rotation.md) executed:
  - [ ] `SUPABASE_ACCESS_TOKEN` (exposed in transcript 2026-05-12)
  - [ ] Any other tokens enumerated in that memory entry
- [ ] `gh secret-scanning alerts` clean (or all open alerts triaged with documented decisions).
- [ ] Pre-commit secret-scanning hooks confirmed firing (try staging a fake AWS key; commit should be blocked).
- [ ] Secret-scanning push protection enabled at the repo level (already done per `phase-backlog.md` Phase 0 close-out — confirm still active).
- [ ] Decide repo visibility for v1.0: currently **public** (was flipped 2026-05-12 to get branch protection on free tier). Flip to **private** if not staying on Pro; OR pay for GitHub Pro and re-private.
- [ ] Review GitHub branch protection on `main` is still active (ruleset id `16283379`).

## 6. Observability + monitoring

- [x] Vercel Analytics dashboard mounted (`@vercel/analytics@2` in `src/app/layout.tsx` since Phase 0).
- [x] Vercel Speed Insights mounted (`@vercel/speed-insights@2` since Phase 0).
- [ ] Error tracking decision: Sentry (`@sentry/nextjs`) vs Vercel built-in error logs only. If Sentry: wire the SDK, set `SENTRY_DSN` in prod env, fire one synthetic error and confirm it lands.
- [ ] Supabase Logs review: skim the post-launch baseline; consider Logflare for searchable retention.
- [ ] Uptime checks: BetterStack / UptimeRobot / Vercel's built-in monitoring — any of these is fine.
- [ ] Datadog / full APM: out of scope for v1.0 unless we hit free-tier ceiling.

## 7. Performance + caching

- [x] `next.config.ts` `images.remotePatterns` covers `*.supabase.co/storage/v1/object/public/photos/**` (Phase 5).
- [x] `images.qualities: [75]`, `images.minimumCacheTTL: 14400` pinned (Phase 5, for stability across Next.js upgrades per ADR 0007).
- [ ] Decide: enable `cacheComponents: true` per [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md)? Default deferred — re-evaluate only if perf data justifies it.
- [ ] Decide: enable `reactCompiler: true`? Default deferred — re-evaluate only if profiler shows wasted renders.
- [ ] Decide: adopt `updateTag('tree:<id>')` / `updateTag('user-trees:<userId>')` cache-tag plumbing throughout Phase 2-6 mutation actions per the standing Phase backlog items? Default deferred until `"use cache"` segments land, post-v1.0.
- [ ] Smoke-test photo upload on a real 4G mobile connection (not just DevTools throttling).
- [ ] Lighthouse pass on landing + dashboard + tree page; performance score ≥ 90 mobile.

## 8. Legal + compliance

- [ ] Privacy policy page at `/privacy`.
- [ ] Terms of service page at `/terms`.
- [ ] Cookie consent banner if EU traffic expected. Otherwise skip.
- [ ] GDPR data export endpoint (probably out of scope for v1.0; document as v1.x).
- [ ] GDPR data delete endpoint — partially covered by "delete tree" / "delete person" today; full-account-delete is v1.x territory.
- [ ] Footer with policy + contact links wired into the landing page (Phase 8 polish item).

## 9. Backups + DR

- [ ] Tier decision: Supabase Free (1-day backup retention) vs Pro (7-day + point-in-time recovery). Pro is $25/mo; consider closer to launch.
- [ ] DB restore runbook: [`docs/runbooks/db-restore.md`](../runbooks/db-restore.md) — covers PITR via Supabase dashboard, pre-checks, verification, and comms. (≤200 lines, no screenshots required for v1.)
- [ ] Optional: scheduled `pg_dump` snapshots to S3 / R2 for offsite backups. Skip if Pro covers the SLA needs.
- [ ] Storage `photos` bucket — Supabase's built-in backup covers it; no separate plan needed.

## 10. Launch-day operational tasks

- [ ] All Phase 1–8 sub-tasks closed.
- [ ] Phase 9 sub-tasks closed.
- [ ] Final smoke pass on the production URL (walk every flow in [`docs/qa/smoke-flows.md`](../qa/smoke-flows.md)).
- [ ] DNS verified (A / AAAA / CNAME records resolve correctly; CAA records permit Let's Encrypt if Vercel uses it).
- [ ] DB backup taken pre-launch (manual snapshot via Supabase dashboard).
- [x] Status-page URL linked from the repo README — **BetterStack** (Option B) chosen as the status surface; README + landing footer wired ([#83](https://github.com/SanchitB23/meetthefam/issues/83)). The footer link is gated on `NEXT_PUBLIC_STATUS_URL`, so the remaining launch-day work is the **infra + env-var setup** below.
- [x] **BetterStack status page live** (infra, owner action — see [§10a](#10a-betterstack-status-page-setup)). Account + 3 monitors + status page provisioned via the BetterStack API (issue [#172](https://github.com/SanchitB23/meetthefam/issues/172)). Owner still needs to add the CNAME at Cloudflare + set `NEXT_PUBLIC_STATUS_URL` in Vercel — both tracked in §10a.
- [ ] Postmortem template ready at [`docs/runbooks/postmortem-template.md`](../runbooks/postmortem-template.md).
- [ ] On-call / contact info documented (even if it's just the maintainer's email + WhatsApp).

### 10a. BetterStack status page setup

We picked **BetterStack** over a static `STATUS.md` (Option A) and over statuspage.io / Instatus — the free tier covers our whole stack with automated uptime history and a hosted page, with zero code to maintain. This choice also resolves the uptime-monitor half of the Wave B observability decision ([#103](https://github.com/SanchitB23/meetthefam/issues/103)) that was holding [#83](https://github.com/SanchitB23/meetthefam/issues/83).

**Status (post-#172, 2026-05-31):** account live, 3 monitors green, status page provisioned with all 3 components attached. **Remaining owner actions** are the two boxes below — CNAME at Cloudflare, and the Vercel env-var paste.

#### Locked-in configuration

| Setting | Value | Notes |
|---|---|---|
| Status page subdomain (fallback) | `https://meetthefam.betteruptime.com` | Active immediately. Use this while DNS propagates. |
| Status page custom domain | `https://status.mtf.sanchitb23.in` | **This is the value to set as `NEXT_PUBLIC_STATUS_URL`.** Lights up once the CNAME below propagates. |
| Status page ID | `249518` | Used for any future `PATCH /api/v2/status-pages/249518` adjustments. |
| Free tier | Yes | 3-min polling cap (180 s), "Powered by Better Stack" footer. Acceptable for v1.0. |
| Status page design | `v2`, light theme, vertical layout | |
| Auto incident reports | `automatic_reports: true` | New monitor incidents auto-publish to the page. |

#### Monitors

All 3 polling at 180 s (3 min) from US / EU / AS / AU regions. Email alerts only (no SMS / call / push). All green as of provisioning.

| # | BetterStack ID | Component label | URL | Probe |
|---|---|---|---|---|
| 1 | 4469154 | Web app | `https://mtf.sanchitb23.in` | GET → 200 (plus SSL + domain expiration alerts at 14 days). |
| 2 | 4469155 | Auth (Supabase) | `https://ycnsgkotrbjifsjkqmvn.supabase.co/auth/v1/health` | GET with `apikey: <prod anon>` → 200. *(Endpoint requires the apikey header on hosted Supabase projects — Kong gates it even though the GoTrue docs imply it's public.)* |
| 3 | 4469156 | Database (Supabase REST) | `https://ycnsgkotrbjifsjkqmvn.supabase.co/rest/v1/trees?select=id&limit=0` | GET with `apikey: <prod anon>` → 200 `[]`. Confirms Kong + PostgREST + anon-key validity end-to-end. **Note:** uses `trees` because it's the only table migrated to prod pre-v1.0 — once the full schema lands at v1.0, this can be re-pointed at any allowed table. |

**Storage monitor deliberately skipped** — would require maintaining a `health-check.jpg` artifact in the `photos` bucket forever; auth + REST monitors already prove storage's transitive dependency chain (same Kong gateway). Revisit post-v1.0 if real users hit storage-specific outages.

#### Remaining owner actions

- [ ] **Add CNAME at Cloudflare** for `sanchitb23.in` zone:
  - Type: `CNAME`
  - Host: `status.mtf`
  - Target: `statuspage.betteruptime.com`
  - TTL: Auto (300 s)
  - Proxy status: **DNS only** (grey cloud — Cloudflare's proxy breaks BetterStack's SSL termination per [their docs](https://betterstack.com/docs/uptime/custom-subdomain/)).
- [ ] **Re-attach `custom_domain` on the status page** after CNAME propagates. The custom domain was temporarily cleared during provisioning to keep the BetterStack-hosted fallback (`meetthefam.betteruptime.com`) usable. One-liner: `curl -X PATCH https://uptime.betterstack.com/api/v2/status-pages/249518 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data '{"custom_domain":"status.mtf.sanchitb23.in"}'`.
- [ ] **Set `NEXT_PUBLIC_STATUS_URL=https://status.mtf.sanchitb23.in`** in Vercel → meetthefam project → Settings → Environment Variables → Production + Preview scopes. The landing footer renders the "Status" link only when this is set, so nothing dead ships before the page resolves. *(Tracked alongside the §2 Vercel env-var list.)*

#### Alert routing (locked at provisioning)

Email only, delivered to the BetterStack account owner's address. No Slack / SMS / phone integration for v1.0. Layer in via BetterStack → Integrations → Slack post-launch if signal density warrants it.

#### Scheduled maintenance windows

None pre-configured. Create ad-hoc via the BetterStack UI or `POST /api/v2/status-pages/249518/reports` (use `report_type: maintenance`) when a real window is planned.

**Trade-offs accepted for v1.0:** 3-min polling gap (paid plans go to 30 s) and a "Powered by Better Stack" badge on the free tier; status/incident history lives in BetterStack's UI rather than in git. Revisit a paid plan only if paying users justify shorter polling or removing the badge.

---

## How phases contribute

Each phase's close-out doc-keeper pass extends this file:

| Phase | Contributes |
|---|---|
| **6** (v0.2.0, this commit) | §1 — Phase 6 `tree_invites` migration queued for the v1.0 prod-apply batch. §4 — `MEETTHEFAM_EMAIL_INVITES_ENABLED` flag added (currently no-op). |
| 7 (v0.3.0) | §1 — Phase 7 share-link migration queued. §2 — env vars if any added. |
| 8 (v0.4.0) | §8 — legal/landing items get scoped. §7 — Lighthouse + visual polish notes. |
| 9 (v1.0.0) | All sections ticked end-to-end; this file is the launch gate. |

## Known advisor entries (prod-specific, post-launch)

*(Populate at v1.0 prod-apply time. Compare against QA baseline; document any drift.)*
