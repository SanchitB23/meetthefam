# Custom SMTP — Design Spec

> **Issue**: [#25](https://github.com/SanchitB23/meetthefam/issues/25)
> **Date**: 2026-05-30
> **Status**: Approved — ready for implementation plan

## Problem

Supabase's built-in SMTP sender caps at ~3–4 auth emails per hour (free tier) per project. At v1.0 multi-tenant launch this becomes an immediate, silent user-facing failure: magic-link sends silently drop, invite emails never dispatch, and there is no error surface in the app UI. Custom SMTP bypasses this limit entirely by routing outbound email through a real provider.

## Approach: Resend — two wiring points

One Resend account, one verified sender domain, two integration points:

```
Auth emails (magic-link, confirm-signup)
  Supabase Auth  →  smtp.resend.com:465  →  Resend  →  inbox
  (Supabase Dashboard SMTP settings — no app code change)

Invite emails (collaboration invites)
  Server Action  →  sendInviteEmail()  →  Resend SDK (REST)  →  inbox
  (src/lib/email/inviteEmail.ts — replaces the stub)

Local dev
  Auth emails  →  Mailpit :54324  (config.toml SMTP block stays commented out)
  Invite emails  →  console.log  (MEETTHEFAM_EMAIL_INVITES_ENABLED stays unset locally)
```

Supabase owns auth email routing; the app owns invite delivery. Mailpit stays intact — local testing burns zero real sends.

## Sender domain

- **Domain**: `sanchitb23.in` (verified in Resend → Domains)
- **From address**: `noreply-mtf@sanchitb23.in`
- **DNS records required**: SPF, DKIM, DMARC — Resend Dashboard provides exact values

## Environment variables

| Variable | Scope | Value |
|---|---|---|
| `RESEND_API_KEY` | Server-only (never `NEXT_PUBLIC_*`) | Resend API key — Vercel QA + prod scopes; add to `.env.local` only if explicitly testing invite delivery locally with the flag flipped on |
| `RESEND_FROM_EMAIL` | Server-only | `noreply-mtf@sanchitb23.in` |
| `MEETTHEFAM_EMAIL_INVITES_ENABLED` | Server-only | `true` — flip once SMTP is live on QA/prod |

Supabase Dashboard SMTP settings take the API key directly — not wired as app env vars.

`RESEND_API_KEY` must be added to the pre-prod key rotation checklist before v1.0 go-live.

## Code changes

### `src/lib/email/inviteEmail.ts` — replace stub

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInviteEmail(invite: InvitePayload): Promise<void> {
  if (process.env.MEETTHEFAM_EMAIL_INVITES_ENABLED !== 'true') {
    console.log('[invite-email] disabled by flag; would have sent to', invite.email, invite.inviteUrl)
    return
  }
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: invite.email,
    subject: `${invite.invitedByName} invited you to their family tree on meetthefam`,
    html: buildInviteHtml(invite),
  })
}
```

The `throw new Error('Email delivery not yet implemented')` line is removed. `buildInviteHtml(invite)` is a small **inline HTML helper defined in the same file** — a plain-but-functional table-based body (greeting, the inviter + tree name, a CTA link to `invite.inviteUrl`, plaintext fallback). It does **not** depend on a React Email component. A rich, brand-aligned invite template (reusing the heirloom palette like the auth emails) is deliberately deferred to its own follow-up ticket — this issue only needs the invite send path to work once the flag is flipped.

### `supabase/config.toml` — no change

The `[auth.email.smtp]` block stays commented out. QA and prod SMTP is configured entirely in the Supabase Dashboard.

### `package.json` — add dependency

```bash
pnpm add resend
```

## Manual steps (needs-human)

### One-time setup

1. Create a Resend account
2. Add domain `sanchitb23.in` → Resend Dashboard → Domains → Add Domain
3. Add DNS records Resend generates (SPF, DKIM, DMARC) in the domain registrar
4. Wait for domain verification
5. Generate an API key in Resend → API Keys

### QA wiring

6. Supabase Dashboard (QA project `ljjv…`) → Auth → SMTP Settings:
   - Host: `smtp.resend.com` | Port: `465` | Username: `resend` | Password: `<API key>`
   - Sender name: `meetthefam` | Sender email: `noreply-mtf@sanchitb23.in`
7. Vercel QA env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply-mtf@sanchitb23.in`
8. Vercel QA env vars: `MEETTHEFAM_EMAIL_INVITES_ENABLED=true`
9. Smoke-test: trigger magic-link on QA → verify arrives from `noreply-mtf@sanchitb23.in`; send invite → verify invite email arrives

### Prod wiring (deferred — v1.0 launch batch)

Same 3 steps above against prod Supabase project (`ycns…`) + Vercel prod scope. Governed by `docs/dev/prod-readiness.md` §4.

## Out of scope

- Auth email template HTML (magic-link, confirm-signup) — already shipped in #61
- Rich, brand-aligned invite email template — deferred to follow-up issue #154; #25 ships only a minimal inline invite HTML body
- Monitoring / SMTP failure alerting (post-v1.0)
- DNS setup documentation (Resend Dashboard guides this inline)
- `supabase/config.toml` SMTP wiring for local dev (Mailpit already covers local testing)

## References

- [Supabase docs — Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend docs — SMTP](https://resend.com/docs/send-with-smtp)
- [Resend docs — Node.js SDK](https://resend.com/docs/send-with-nodejs)
- `docs/dev/prod-readiness.md` §4 — email deliverability checklist
- `src/lib/email/inviteEmail.ts` — invite email stub (current)
- `emails/` — React Email templates (magic-link, confirm-signup, invite)
