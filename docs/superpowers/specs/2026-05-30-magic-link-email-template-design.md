# Design: branded magic-link + confirm-signup auth emails

> **Status**: Approved 2026-05-30. Implements GitHub issue [#61](https://github.com/SanchitB23/meetthefam/issues/61) (milestone `v1.0 — Launch`).
> **Spec type**: Front-of-funnel UX + small build-tooling addition. No schema / RLS change.

## Problem

The auth email a new or returning user receives is Supabase's **stock default** — plain, unbranded, `noreply@mail.app.supabase.io`. It is the first thing every tenant sees from the product, before they've loaded a single pixel of the app. We want a polished, on-brand transactional email that reinforces the heirloom-journal voice and gives a real CTA button.

ADR 0004 makes this auth flow **magic-link-only (no passwords)**, so the email *is* the auth flow — investing in it is investing in auth UX.

## Key finding that shapes scope

`src/app/login/actions.ts` calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo }})` with **no `shouldCreateUser` override** (defaults to `true`). Supabase therefore fires **two different templates** depending on the user:

- **Returning user** → the **Magic Link** template (`magic_link`).
- **Brand-new user** → the **Confirm signup** template (`confirmation`).

Branding only `magic_link` would leave every brand-new user's *first* email — the exact first-impression this issue targets — on the unbranded default. (Note: local `supabase/config.toml` has `enable_confirmations = false`, which changes *which* template fires for new users locally; we brand **both** and verify in Mailpit so we're covered in every environment.)

## Decisions

### D1 — Scope: two templates, one shared layout

Brand the two templates the OTP flow actually fires, sharing one React Email layout and differing only in **subject + headline + one line of body copy + CTA label**:

| Template | Fires for | Subject | Headline | CTA label |
|---|---|---|---|---|
| `magic_link` | returning sign-in | `Your meetthefam sign-in link` | "Your sign-in link" | "Sign in to meetthefam" |
| `confirmation` | new-user first touch | `Welcome to meetthefam — confirm your email` | "Welcome to meetthefam" | "Confirm your email" |

**Out of scope (YAGNI):** invite email (tracked by #25 / collaboration), share-link email, and the `email_change` / `reauthentication` / `recovery` templates (no passwords; those flows aren't user-facing yet).

### D2 — Authoring: React Email → committed static HTML

- **Dev-only dependencies** (authoring + export only — no app runtime dependency, the shipped artifact is plain HTML): `@react-email/components`, `@react-email/render`, and `tsx` (to run the TS/JSX export script on Node 24).
- **Source tree at repo root** (`emails/`, outside the Next.js build):
  - `emails/theme.ts` — single source of truth for the email-safe **hex** palette + font-stack constants.
  - `emails/components/AuthEmailLayout.tsx` — the shared primitive: header wordmark → body slot → CTA button → plaintext fallback link → security hint → footer. Accepts props for `previewText`, `headline`, `bodyCopy`, `ctaLabel`, and `confirmationUrl`.
  - `emails/magic-link.tsx`, `emails/confirm-signup.tsx` — thin wrappers passing the per-variant copy + the Supabase token.
- **Export script** `scripts/build-emails.ts`, run via `pnpm emails:build`, uses `@react-email/render` to write:
  - `supabase/templates/magic_link.html`
  - `supabase/templates/confirm_signup.html`

  These exported HTML files are **committed** alongside the JSX. The CTA `href` is the literal Supabase Go-template token `{{ .ConfirmationURL }}`, so it survives verbatim into the static HTML.

### D3 — Template content & styling

Per the issue's "what good looks like":

- **Structure**: table-based layout, inline CSS only (React Email emits this), `max-width: 560px`, single column, mobile-first.
- **Type**: serif stack for the wordmark + headline (`'Cormorant Garamond', Georgia, 'Times New Roman', serif` → effectively Georgia in mail clients); system-sans stack for body (`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`). **No web fonts** (unreliable in mail).
- **Wordmark**: **text only** (no hosted image) — immune to client image-blocking, nothing to host. Serif "meetthefam", forest green on cream.
- **Greeting**: **nameless** — "Hi there,". (The wireframe shows "Hi Eleanor," but Supabase's `magic_link` / `confirmation` templates expose **no display-name variable** — only `{{ .Email }}`, which we don't want to print raw. Keep a warm but nameless greeting.)
- **Email-safe hex palette** (translated from the OKLCH tokens in `src/app/globals.css`):

  | Role | Hex |
  |---|---|
  | Background (cream) | `#F5EFE3` |
  | Card / paper surface | `#FFFCF5` |
  | Body text (warm charcoal) | `#2E2A24` |
  | Primary / forest green (wordmark + button) | `#2D4A3E` |
  | Button text / on-dark | `#FFFCF5` |
  | Terracotta accent (footer rule) | `#C77B5C` |
  | Muted grey (hints, fallback link) | `#6B6358` |
  | Hairline border | `#E3DBCB` |

- **CTA button**: real `<a>` styled as a button — forest fill, cream text, ~44px tall, generous padding, gently rounded; mobile-tappable.
- **Plaintext fallback link**: small muted-grey `<a href="{{ .ConfirmationURL }}">` below the button ("or paste this link: …").
- **Security hint**: "This link expires in 60 minutes and can only be used once. If you didn't request it, you can safely ignore this email." (`otp_expiry = 3600` in config confirms 60 min.)
- **Footer**: thin terracotta divider rule, then small Manrope-stack text — `meetthefam` + **site link only** (`meetthefam.com`), **no email address** (none established yet; revisit a real contact with the #56 contact/legal page).
- **Dark mode**: light-first, with a best-effort `@media (prefers-color-scheme: dark)` block and inversion-resilient colors (no pure `#000`/`#fff`). Explicitly best-effort — Gmail strips `<style>`/media queries.

### D4 — Wiring (local + QA now; prod deferred)

- `supabase/config.toml`: add `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]` blocks (each with `subject` + `content_path` pointing at the exported HTML), replacing the stale commented `[auth.email.template.invite]` block at lines 242–244.
- **Local**: restart the stack so it picks up the templates → submit a magic link via `/login` → verify both captures in **Mailpit** (`http://localhost:54324`), screenshot light + dark.
- **QA**: upload both HTML files via Supabase Dashboard → Authentication → Email Templates (Magic Link + Confirm signup).
- **Prod**: **deferred to the v1.0 launch batch** per memory `feedback_no_prod_changes_pre_v1` (no prod Supabase changes until the `v1.0 — Launch` milestone closes). Add the two template uploads to `docs/dev/prod-readiness.md` §3 (Auth) so the launch batch picks them up.

### D5 — Verification

- **Local Mailpit** visual check of both templates, light + dark.
- **Vitest sync-check**: a small test that renders each template via `@react-email/render` and asserts the output contains `{{ .ConfirmationURL }}`, the CTA label, and the fallback link — and (optionally) that it matches the committed HTML, guarding against the JSX and the exported HTML drifting apart.
- **Manual real-client smoke** (needs-human): forward a Mailpit capture to Gmail + Apple Mail and eyeball rendering.

### D6 — Docs

New `docs/dev/email-templates.md` — the authoring recipe: edit JSX → `pnpm emails:build` → verify in Mailpit → upload to the dashboard. Future invite (#25) and share-link emails reuse the same `AuthEmailLayout` primitive and recipe. Satisfies the issue's "document the workflow" checkbox.

## Visual reference (wireframe)

Implements the approved wireframe, committed at [`docs/ux/auth-email-wireframe.html`](../../ux/auth-email-wireframe.html) (from the Claude design handoff `MeetMyFamily`, chat4). Exact measurements to match:

- Email `max-width: 560px`, centered. Card: `#FFFCF5` on `#F5EFE3`, 1px `#E3DBCB` border, `border-radius: 16px`, padding `44px 40px 40px` (mobile `36px 26px 32px`).
- Preheader/preview line: 12px muted, centered, above the wordmark → implemented as React Email `<Preview>` (inbox snippet).
- Wordmark: serif `30px` / `600`, centered, `#2D4A3E`.
- Headline: serif `38px` (mobile `32px`) / `600`, line-height `1.08`, `#2D4A3E`.
- Greeting `16px` / `500`; framing `16px` / line-height `1.62`, `max-width: 42ch`.
- CTA: full-width block, `#2D4A3E` fill, `#FFFCF5` text, `16px` / `600`, padding `16px 24px`, `min-height: 52px`, `border-radius: 12px`.
- Fallback: `13px` muted; the link is `#2D4A3E`, underlined, `word-break: break-all`.
- Soft divider: 1px `#E3DBCB`, margin `30px 0 22px`.
- Security row: lock-icon (15px stroked SVG) + `13px` muted text, flex, gap `10px`.
- Footer: terracotta rule `2px × 44px`, centered, `border-radius: 2px`; footer-mark serif `17px` `#2D4A3E`; footer-contact `12px` muted.
- Dark-variant hex (from the wireframe, for the best-effort dark block): client bg `#211E1A`, card `#2A2620`, border `#3a352d`, green→`#9DBBA9`, body text `#EDE6D8`, muted `#9a9183`, CTA fill `#9DBBA9` on text `#1b2722`.
- Fonts: the wireframe loads Cormorant Garamond + Manrope via Google Fonts; the **email keeps the stacks but does not depend on the web font loading** (`'Cormorant Garamond', Georgia, serif` and `'Manrope', -apple-system, …, sans-serif`).

**Two deliberate deviations from the wireframe** (it used design-tool placeholders): the **greeting** is nameless (see D3 — no Supabase name var), and the **footer** is site-link-only `meetthefam · meetthefam.com` (locked decision — the wireframe's `hello@meetthefam.app` is dropped; no monitored inbox yet, and the domain is `.com`).

## Components & boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `emails/theme.ts` | Palette hex + font stacks (constants) | — |
| `emails/components/AuthEmailLayout.tsx` | Shared visual layout; props for copy + URL | `theme.ts`, `@react-email/components` |
| `emails/magic-link.tsx` / `confirm-signup.tsx` | Per-variant copy + token | `AuthEmailLayout` |
| `scripts/build-emails.ts` | Render JSX → committed `supabase/templates/*.html` | `@react-email/render`, the two templates |
| `supabase/config.toml` blocks | Point the local stack at the exported HTML | the exported HTML files |
| Vitest sync-check | Guard render output / drift | `@react-email/render`, the templates |
| `docs/dev/email-templates.md` | Authoring + upload recipe | — |

## Success criteria

1. Submitting a magic link locally renders the branded template in Mailpit for **both** the new-user and returning-user paths (verified by toggling `enable_confirmations` / using a fresh vs existing email).
2. Both exported HTML files contain a working `{{ .ConfirmationURL }}` in the CTA **and** the fallback link, render with the heirloom palette, and degrade gracefully with images off / `<style>` stripped (the button is an inline-styled `<a>`, not dependent on a `<style>` block).
3. `pnpm emails:build` regenerates the committed HTML deterministically; the Vitest sync-check passes.
4. QA dashboard shows the branded templates; prod is queued in `prod-readiness.md` §3, not applied.
5. `docs/dev/email-templates.md` documents the workflow end-to-end.

## Out of scope

- Custom SMTP / sender domain (#25).
- Invite + share-link emails (reuse this layout later; not built now).
- `email_change` / `reauthentication` / `recovery` templates.
- Any production Supabase change (deferred to v1.0 cut).
