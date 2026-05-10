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

Vercel preview URLs on feature-branch PRs share the **QA** Supabase project — so previews aren't running against an empty DB.

## Consequences

- **Two hosted Supabase projects on free tier.** Supabase free tier allows up to 2 active projects per organization, exactly matching this setup.
- **Migrations apply local → QA → prod in order.** If a migration breaks, it breaks at QA, not prod.
- **Promotion flow**: feature branch → PR into `qa` (auto-deploys to QA, smoke test) → merge `qa` → `main` (auto-deploys to prod).
- **Inactivity caveat**: Supabase free-tier projects pause after ~1 week with no activity. As long as the user is at least browsing the QA / prod URLs weekly, both stay alive. Restoring is a one-click action if it does pause.
- **Custom domain**: `<domain>` for prod, `qa.<domain>` as a subdomain for QA. One DNS, one renewal.

## Alternatives considered

- **Two environments (Local + Prod)** — Vercel previews would need to point at prod or at an empty DB. Both are wrong. Skipped.
- **Per-feature DB branches** — clean, expensive (paid tier required), and overkill for a side project.
