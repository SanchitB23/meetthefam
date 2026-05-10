# ADR 0004 — Magic-link login only, no passwords

**Status:** Accepted
**Date:** 2026-05-10

## Context

Standard auth offers email + password. We're using Supabase Auth, which supports several mechanisms: email + password, email magic link, OAuth (Google / GitHub / Apple).

## Decision

**Email magic-link + Google OAuth only.** No password fields anywhere in the app.

## Consequences

- **No password-reset flow to build** — the magic-link IS the password reset.
- **No password-strength validation, breach-check, hashing config, or rotation policy** — we don't store passwords.
- **Slightly higher friction** — users wait for an email instead of typing a password. For a personal tool used a few times a month, fine; for a daily-driver app, a real concern. Revisit if user feedback says otherwise.
- **Email deliverability becomes a hard dependency.** Supabase's default sender works for low-volume signups. If we hit deliverability issues at higher volume, swap in a dedicated SMTP provider (Postmark, Resend) — well-isolated change.

## Alternatives considered

- **Email + password** — adds reset flows, password-rules friction, breach-check logic. More code, more edge cases. The user's stated goal is a polished personal tool, not a SaaS that competes on auth UX.
- **OAuth-only (Google + Apple)** — slightly worse: forces every viewer of the tree (including grandma) to have a Google account. Magic-link supports anyone with email.
- **Passkeys / WebAuthn** — ideal long-term, immature middleware in 2026 for a side project. Revisit when Supabase Auth has first-class support.
