# DMCA / Copyright takedown page (`/dmca`) — design

> Spec for [#138](https://github.com/SanchitB23/meetthefam/issues/138), a child of the
> [#56](https://github.com/SanchitB23/meetthefam/issues/56) "standard & legal pages" umbrella.
> Authored via `superpowers:brainstorming` on 2026-05-31. Extends the launch-gate legal-pages
> spec (`docs/superpowers/specs/2026-05-30-legal-pages-design.md`), which listed `/dmca` as an
> explicit out-of-scope child. Copy was settled and signed off interactively; see
> "Decisions locked" below.

## Goal

Replace the interim "email us via `/contact`" copyright route with a dedicated `/dmca` page that
sets out a clear **notice-and-takedown procedure**. Family trees carry user-uploaded photographs
and biographies, so a documented takedown contact + procedure is what lets the Service rely on
hosting-intermediary safe-harbor. The page reuses the existing `(legal)` route group, `<Prose>`
wrapper, and shared `<SiteFooter>`; it mirrors `src/app/(legal)/privacy/page.tsx` exactly in
shape (Server Component, exported `metadata`, visible "Last updated" stamp, numbered sections).

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Jurisdiction framing** | **Hybrid** — DMCA-style notice-and-takedown procedure, with a note that the operator is India-based, India governs disputes (per Terms §7), and complaints may also be raised under India's IT Act 2000 + Intermediary Guidelines 2021 | The page is `/dmca` and the app is hosted on US infra (Vercel/Supabase), so a DMCA-shaped procedure is what takedown senders expect; but the operator is in India and the Terms set India governing law, so the page must not contradict them. |
| **Procedural scope** | **Full** — takedown notice (required elements + good-faith / penalty-of-perjury statements), counter-notice with restoration window, AND a repeat-infringer termination policy | Counter-notice (§512(g)) and a repeat-infringer policy (§512(i)) are both standard safe-harbor requirements; strongest coverage. |
| **Takedown contact label** | **"Copyright Contact"** — *not* "Designated Agent" | We are **not** registered with the U.S. Copyright Office; claiming a USCO-registered designated agent would be false. "Copyright Contact" is accurate for a solo operator. |
| **Contact email** | `hello.mtf@sanchitb23.in` (verbatim) | Same inbox used across Contact + Privacy; consistent with the other legal pages. |
| **Counter-notice jurisdiction** | Consent to the **courts of India** (not a US federal district) | Adapts the standard DMCA counter-notice clause to stay consistent with Terms §7's India governing law. |
| **Effective date** | 31 May 2026 | Authoring date (privacy/terms/contact used their own authoring date, 30 May). |
| **Restoration window** | 10–14 business days after a valid counter-notice, unless the complainant initiates legal action | Standard DMCA §512(g) put-back window. |
| **Indexability** | Indexable (no `noindex`), like the other legal pages | Discoverability of the takedown route is desirable. |
| **Content format / routing** | A1 plain TSX Server Component in the `(legal)` route group + `<Prose>` wrapper | Inherited verbatim from the parent legal-pages spec; zero new deps. |
| **Cross-links** | "Terms of Service" references render as real `<a href="/terms">` links | The page leans on the Terms for governing law; the link makes that navigable. |

> **Content caveat (spec-level, not an on-page banner):** as with the other legal pages, this
> copy is boilerplate adapted by the operator and is **not** lawyer-reviewed. It reflects the
> app's current practices to the best of our knowledge. Have counsel review before relying on
> it; this spec does not constitute legal advice. A standard "Last updated" date + "Changes to
> this policy" section appear on the page; no heavy disclaimer banner, per the boilerplate
> content choice carried over from the parent spec.

## Architecture

### File layout

```
src/app/(legal)/
  dmca/page.tsx       # NEW — /dmca; exports metadata + page (Server Component)
```

No new components, no wiring changes, no new dependencies. The page slots into the existing
`(legal)` route group, inheriting `layout.tsx` (logo header + `<SiteFooter>`) and the
`force-static` render mode already set on that layout. It wraps its body in the existing
`<Prose>` component.

> **Footer note (deferred, not in this PR):** `SiteFooter` does not currently link to `/dmca`.
> Adding a footer link is a small follow-up but is **out of scope** here — issue #138 is "add the
> page." The page is reachable via direct URL and from the interim `/contact` copy. A footer/legal
> cross-link pass can be filed as a sibling child of #56 if desired.

### Metadata

```ts
export const metadata: Metadata = {
  title: 'Copyright & Takedown (DMCA) · meetthefam',
  description:
    'How to report copyright infringement on meetthefam and how the notice-and-takedown procedure works.',
}
```

## Page content

`<h1>` **Copyright & Takedown Policy**, followed by the **"Last updated: 31 May 2026"** stamp,
an intro paragraph, then numbered `<h2>` sections (signed-off copy):

1. **Reporting copyright infringement** — the six required elements of a takedown notice (your
   contact details; description of the copyrighted work; location of the material — share-link
   URL / page address / person card or photo; good-faith-belief statement; accuracy +
   authorized-to-act statement under penalty of perjury; physical or electronic signature).
   Sent to the Copyright Contact email.
2. **What happens after you send a notice** — we remove/disable access promptly and notify the
   posting account, passing on a copy of the notice.
3. **Counter-notice** — the five elements (contact details; identification of removed material +
   prior location; good-faith mistake/misidentification statement under penalty of perjury;
   consent to the courts of India; signature) + the 10–14 business-day restoration window.
4. **Repeat infringers** — we may suspend or terminate repeat-infringer accounts at our discretion.
5. **False claims** — misrepresentation can carry legal liability; seek advice if unsure.
6. **Other jurisdictions** — India IT Act 2000 + Intermediary Guidelines 2021 route; the
   Copyright Contact is the place to start either way.
7. **Changes to this policy** — date-stamp reflects the latest version.
8. **Contact** — `hello.mtf@sanchitb23.in` as the Copyright Contact.

Intro paragraph names the operator (Sanchit Bhatnagar, individual, India), the US hosting
(Vercel/Supabase), and frames the procedure as DMCA-adapted-for-a-small-service without
overriding the Terms' India governing law. References to "Terms of Service" link to `/terms`.

## Testing

A static Server Component with no business logic. Gate:

- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- No new Vitest test is required (the page has no logic and no wiring beyond the inherited
  layout). The existing `SiteFooter` test is unaffected because the footer is **not** changed
  in this PR. If a footer `/dmca` link is added in a later PR, extend that test then.
- No new Playwright flow (static content; existing E2E happy paths unaffected).

## Constraints honored

- **No prod changes pre-v1.0** — app-code page only; no DB, no Vercel-config, no migrations.
  Ships to local + QA and rides the next feature release.
- **Issue-anchored workflow** — branch `feat/138-dmca-page` off `qa`; the PR `Closes #138` and
  carries the `v1.0 — Launch` milestone. #56 stays open as the umbrella tracker.
