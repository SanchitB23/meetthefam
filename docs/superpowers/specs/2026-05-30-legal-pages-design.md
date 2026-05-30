# Launch-gate legal pages — design

> Spec for the launch-gate subset of [#56](https://github.com/SanchitB23/meetthefam/issues/56)
> (the umbrella "standard & legal pages" tracker). Authored via `superpowers:brainstorming`
> on 2026-05-30. Scope, content approach, and issue-anchoring were decided interactively;
> see "Decisions locked" below.

## Goal

Ship the smallest mergeable set of public pages that unblocks the v1.0 launch gate
(`docs/dev/prod-readiness.md` §8): **Privacy Policy**, **Terms of Service**, **Contact**,
plus a shared **footer** wiring policy + contact links into both the public landing page
and the authenticated `(app)` chrome. Everything else in #56's catalog is split into
child issues and deferred.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Scope** | Launch-gate minimum: `/privacy`, `/terms`, `/contact` + footer wiring | §8 only hard-gates Privacy + Terms + footer links. Smallest unit that unblocks launch; rest → child issues. |
| **Content** | Adapt a SaaS boilerplate, fill in app-specific specifics | More legally-complete clause coverage than self-drafted prose; grounded in the real stack + data-model. |
| **Operator** | Sanchit Bhatnagar (individual) | Solo personal project, pre-incorporation. "We/us" = the individual operator. |
| **Governing law** | India — DPDP Act framing | Per operator location. |
| **Contact email** | `hello.mtf@sanchitb23.in` (verbatim) | Real inbox; used across Contact + Privacy data-requests. |
| **Effective date** | 30 May 2026 | Authoring date. |
| **Content format** | A1 — plain TSX Server Components + `<Prose>` wrapper | Zero new deps; matches all-TSX codebase; full control over heirloom styling. (No `@tailwindcss/typography`, no MDX in repo.) |
| **Routing** | B1 — `(legal)` route group with its own layout | Idiomatic Next 16; one layout for all public legal pages; shared `<SiteFooter>` extraction satisfies the §8 dual-chrome footer requirement. |
| **Issue anchor** | New child issue under #56; PR `Closes` the child | #56 stays open as the umbrella tracker; deferred pages filed as sibling children. Fits the one-branch→one-issue→`Closes #N` workflow. |

> **Content caveat (spec-level, not an on-page banner):** the copy is boilerplate adapted by
> the operator and is **not** lawyer-reviewed. It reflects the app's current practices to the
> best of our knowledge. Have counsel review before relying on it; this spec does not constitute
> legal advice. (A standard "Last updated" date + "Changes to this policy" section appear on the
> pages; no heavy disclaimer banner, per the boilerplate content choice.)

## Architecture

### File layout

```
src/app/(legal)/
  layout.tsx          # public chrome: <header> with logo→"/" + <SiteFooter> at bottom
  privacy/page.tsx    # /privacy   — exports metadata + page
  terms/page.tsx      # /terms     — exports metadata + page
  contact/page.tsx    # /contact   — exports metadata + page
src/components/
  layout/SiteFooter.tsx   # NEW — shared footer; replaces LandingFooter
  ui/Prose.tsx            # NEW — heirloom-styled prose wrapper
```

All four route-group files are Server Components (no client interactivity needed). The
`(legal)` route group sits **outside** `(app)`, so these pages are fully public and do not
inherit the authenticated nav / Sign-Out chrome.

### Wiring changes

- `src/app/page.tsx` (landing): swap `<LandingFooter />` → `<SiteFooter />`.
- `src/app/(app)/layout.tsx`: add `<SiteFooter />` at the bottom of its flex column.
- `src/components/landing/LandingFooter.tsx`: **retired** — its tagline and the
  `NEXT_PUBLIC_STATUS_URL` conditional-Status logic move into `SiteFooter`.
- `src/app/layout.tsx`: **untouched.** `<VersionFooter />` continues to render below
  everything as the small version string; `<SiteFooter>` sits above it within page flow.

## Components

### `SiteFooter` (`src/components/layout/SiteFooter.tsx`)

The §8 deliverable. One component, three consumers (legal layout, landing, app layout).

- Heirloom tagline: *"Made for the people who already know each other."* (Cormorant italic,
  carried over from `LandingFooter`).
- Link row, `next/link`: **Privacy · Terms · Contact · Sign in**, plus the existing
  **Status** link rendered only when `process.env.NEXT_PUBLIC_STATUS_URL` is set (logic
  ported verbatim from `LandingFooter` so no dead link ships).
- Styling reuses the current footer classes (`text-muted-foreground`, `text-sm`,
  underline-on-hover → `hover:text-foreground`).
- No props required; the tagline + link set is identical across all three placements.

### `Prose` (`src/components/ui/Prose.tsx`)

A presentational wrapper that styles descendant elements via Tailwind arbitrary-variant
selectors against the heirloom tokens — no `@tailwindcss/typography` dependency:

- `[&_h1]` / `[&_h2]` / `[&_h3]`: `font-serif`, stepped sizes, `text-foreground`.
- `[&_p]`, `[&_li]`: `text-muted-foreground`, `leading-relaxed`, vertical rhythm.
- `[&_a]`: `text-accent underline`, hover state.
- `[&_ul]` / `[&_ol]`: list markers + indent; sensible `space-y` between blocks.

Each legal page wraps its body in `<Prose>` for consistent typography on the cream surface.

## Page content

Each page exports a Next.js `metadata` object (`title`, `description`) and renders a visible
**"Last updated: 30 May 2026"**. Pages remain indexable (no `noindex`).

### `/privacy` — Privacy Policy (India / DPDP-flavored)

Sections, grounded in `docs/architecture/data-model.md` + `auth-and-rls.md`:

1. **Who we are** — Sanchit Bhatnagar (individual operator); contact `hello.mtf@sanchitb23.in`.
2. **What we collect** — authentication email; the names, photos, bios, and relationships
   *you* enter into your trees; minimal product analytics (Vercel Analytics + Speed Insights).
3. **Why we process it & lawful basis** — to provide the service, secure accounts, and
   improve performance.
4. **Who we share it with (subprocessors)** — **Supabase** (database, auth, storage),
   **Vercel** (hosting, analytics). No selling of personal data.
5. **Retention & deletion** — deleting a person or a tree removes that data (FK cascade +
   Storage purge) today; account-level export / full-account-delete noted as forthcoming
   (tracked separately as v1.x in prod-readiness §8).
6. **Your rights** — access, correction, deletion; grievance/contact route via the email.
7. **Children's data** — family trees may include under-13s; the uploading
   relative is responsible for any required consent; delete-on-request path stated.
8. **Security** — Row-Level Security tenant isolation; encryption at rest via Supabase;
   hashed share-link tokens.
9. **Changes to this policy** — we may revise; date stamp reflects the latest version.
10. **Contact** — `hello.mtf@sanchitb23.in`.

### `/terms` — Terms of Service (boilerplate adapted)

1. **Acceptance & eligibility.**
2. **The service** — description; provided "as is"; availability not guaranteed.
3. **Your content & license** — you retain ownership of everything you upload; you grant a
   limited licence to host, store, and display it solely to operate the service.
4. **Acceptable use** — no unlawful/infringing content; you are responsible for the people
   and photos you add and for whom you share read-only links with.
5. **Disclaimer of warranties & limitation of liability** — liability cap.
6. **Termination** — either side may stop; effect on data.
7. **Governing law** — **India.**
8. **Changes to these terms** + **Contact**.

### `/contact` — Contact

Simple, no form (a contact form is deferred to a child issue):

- `hello.mtf@sanchitb23.in` for support, privacy / data-subject requests, and interim
  copyright / takedown notices (until a dedicated DMCA page lands).
- Brief "what to expect" note (best-effort response; this is a personal project).

## Testing

These are static Server Components with no business logic. Gate:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- One lightweight **Vitest** render test on `<SiteFooter>` asserting it exposes the
  `/privacy`, `/terms`, and `/contact` hrefs — a cheap regression guard on the §8 wiring.
- No new Playwright flow (static content; existing E2E happy paths are unaffected).

## Out of scope → child issues off #56

Filed as sibling child issues so #56 remains the umbrella tracker:

- DMCA / Copyright policy (`/dmca`)
- Children's-privacy standalone page (`/childrens-privacy`) — interim section lives in `/privacy`
- Cookie policy + consent banner (`/cookies`) — deferred until analytics/EU expansion
- Accessibility statement (`/accessibility`)
- Imprint / legal notice (`/imprint`) — decide-later
- About (`/about`)
- Security overview (`/security`)
- Subprocessors page (`/subprocessors`) — interim list lives in `/privacy`
- FAQ / Help (`/faq`)
- Pricing (`/pricing`) — placeholder "Free during beta"
- Branded `not-found.tsx` (404) and `error.tsx` (500)
- `robots.ts` + `sitemap.ts`

Also out of scope (already tracked elsewhere): GDPR/DPDP export + full-account-delete
endpoints (prod-readiness §8, v1.x); the landing page itself ([#44](https://github.com/SanchitB23/meetthefam/issues/44));
the `(app)` route-group refactor ([#45](https://github.com/SanchitB23/meetthefam/issues/45)).

## Constraints honored

- **No prod changes pre-v1.0** — these are app-code pages only; no DB, no Vercel-config,
  no migrations. Ships to local + QA and rides the next feature release.
- **Issue-anchored workflow** — a new child issue under #56 anchors the branch
  (`feat/<child#>-legal-pages`); the PR `Closes` that child; #56 stays open.
