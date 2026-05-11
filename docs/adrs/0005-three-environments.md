# ADR 0005 — Three environments (Local + QA + Prod)

**Status:** Accepted
**Date:** 2026-05-10

## Context

How many deploy environments to maintain. Common options:

- **2** — Local + Production. Vercel previews share the dev DB.
- **3** — Local + QA + Production. Vercel previews point at QA's Supabase project.
- **N+** — per-feature DB branches (Supabase supports this on paid tier).

## Decision

**Three environments.** Local (Supabase CLI Docker stack) + QA (hosted Supabase project, `qa.<domain>` Vercel deploy from the `qa` branch) + Production (separate hosted Supabase project, `<domain>` Vercel deploy from `main`).

**Vercel: one project, branch-targeted env vars.** A single Vercel project (`meetthefam`) is connected to the GitHub repo. Vercel's native environment scoping carries the QA↔prod split:

- **Production env** (target: `main` branch) → prod Supabase project (added at v0.1 ship).
- **Preview env** (target: every non-`main` branch, including `qa` and feature branches) → QA Supabase project.
- **Development env** (target: `vercel dev` locally) → not used; we run `pnpm dev` against the local Supabase stack instead.

Vercel preview URLs on feature-branch PRs share the **QA** Supabase project — so previews aren't running against an empty DB. This falls out automatically from the Preview-env scoping above.

QA's stable hostname is Vercel's auto-generated `meetthefam-git-qa-<account>.vercel.app` for the `qa` branch; once a custom domain is wired, `qa.<domain>` aliases to it.

## Consequences

- **Two hosted Supabase projects on free tier.** Supabase free tier allows up to 2 active projects per organization, exactly matching this setup.
- **Migrations apply local → QA → prod in order.** If a migration breaks, it breaks at QA, not prod.
- **Promotion flow**: feature branch → PR into `qa` (auto-deploys to QA, smoke test) → merge `qa` → `main` (auto-deploys to prod).
- **Inactivity caveat**: Supabase free-tier projects pause after ~1 week with no activity. As long as the user is at least browsing the QA / prod URLs weekly, both stay alive. Restoring is a one-click action if it does pause.
- **Custom domain**: `<domain>` for prod, `qa.<domain>` as a subdomain for QA. One DNS, one renewal.

## Alternatives considered

- **Two environments (Local + Prod)** — Vercel previews would need to point at prod or at an empty DB. Both are wrong. Skipped.
- **Per-feature DB branches** — clean, expensive (paid tier required), and overkill for a side project.
- **Two Vercel projects (one for QA, one for prod)** — would isolate build queues and env-var blast radius, but Vercel's per-environment env vars already keep QA and prod secrets separate within a single project. Two projects also forces feature-branch PRs to deploy to *one* of them (which?) and breaks the "previews automatically use QA Supabase" property that drops out for free with a single project. Skipped.

## Amendments

- **2026-05-11** — Made the Vercel project layout explicit (single project + branch-targeted env vars). The original Decision text was silent on whether QA and prod should be one Vercel project or two, and the implementation in Phase 0 sub-task 5 ([`current-phase.md`](../tasks/current-phase.md)) settled on one. See the "Two Vercel projects" entry in Alternatives considered for the rejected option.
