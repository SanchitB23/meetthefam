# `/login` public chrome — design

> Spec for [#162](https://github.com/SanchitB23/meetthefam/issues/162). Authored via
> `superpowers:brainstorming` on 2026-05-31. Tight structural refactor — extracts the
> tiny logo header out of `src/app/(legal)/layout.tsx` and uses it to give `/login`
> the same launch-facing chrome the `(legal)` pages got from
> [#137](https://github.com/SanchitB23/meetthefam/issues/137).

## Goal

Give `/login` the same public chrome as the `(legal)` pages — logo header that links
back to `/`, shared `<SiteFooter>` (Privacy · Terms · Contact · About · Sign in) — so
unauthenticated users get consistent branded chrome instead of a bare centered
sign-in card on a blank page.

## Current state

| Surface | Header | Footer | Notes |
|---|---|---|---|
| `src/app/(legal)/layout.tsx` | inline `<header>` with `<Logo size={28}>` + wordmark, linking `/` | `<SiteFooter>` | `export const dynamic = 'force-static'` |
| `src/app/login/page.tsx` | — | — | bare `<main className="flex min-h-screen ... justify-center">` with the sign-in card; dynamic (calls `supabase.auth.getUser()` + reads `searchParams`) |
| `src/app/layout.tsx` (root) | — | `<VersionFooter />` only | wraps everything |

So `/login` ships with zero branded chrome — no logo, no footer, no legal links.
Inconsistent with the `(legal)` pages and visibly unfinished as launch-facing.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Reuse mechanism** | Extract `<PublicHeader />` as a small named primitive in `src/components/layout/` | Matches the existing factor of this directory — `SiteFooter`, `StatusPageShell` are small named components composed per shell, not god-components with conditional layout props. |
| **Route-group restructure** | None — `/login` stays at `src/app/login/page.tsx` | Moving `/login` into a `(public)` group with its own layout doesn't share with `(legal)` anyway: `(legal)` is `force-static`, login is dynamic. Restructuring buys nothing and risks the static cacheability of `/privacy` `/terms` `/contact` `/about` `/dmca`. |
| **Login's vertical centering** | Login composes its own shell (`min-h-screen flex-col` + `<main className="flex-1 flex items-center justify-center">`) | Lets the sign-in card stay vertically balanced between header and footer without forcing the `(legal)` shell into a `centered?: boolean` prop it wouldn't need. Two call sites with different content alignment compose more cleanly than one shell with a prop. |
| **Header markup** | Verbatim move of the existing `(legal)` header — `<Link href="/">` wrapping `<Logo size={28}>` + `<span className="font-serif text-xl text-foreground">meetthefam</span>`, in a `<header className="border-b border-border px-4 py-3">` | The `(legal)` styling is already approved chrome; this is a pure extraction, not a redesign. Heirloom tokens carry through (`border-border`, `text-foreground`, `font-serif`). |
| **Component name** | `PublicHeader` (in `src/components/layout/PublicHeader.tsx`) | "Public" = unauthenticated chrome (mirrors how `(legal)/layout.tsx` describes itself: "no authenticated nav or Sign-Out button"). Consistent neighbour-naming with `SiteFooter`. |
| **Test coverage** | New Vitest render test for `<PublicHeader />`; no new test for `/login`'s composition | Cheap regression guard on the extracted component. The `/login` wrap is three lines of pure JSX composition; CI typecheck + manual eyeball at QA is sufficient there. |
| **`(app)` layout** | Left alone — not in scope | `(app)/layout.tsx` already renders `<SiteFooter>` and has its own auth-aware nav; this issue is about the public surface only. |

## Architecture

### New file — `src/components/layout/PublicHeader.tsx`

Server Component. Exports `<PublicHeader />`. Returns:

```tsx
<header className="border-b border-border px-4 py-3">
  <Link href="/" className="flex w-fit items-center gap-2 text-primary">
    <Logo size={28} />
    <span className="font-serif text-xl text-foreground">meetthefam</span>
  </Link>
</header>
```

No props. No client boundary. Pure presentational.

### Edited file — `src/app/(legal)/layout.tsx`

Swap the inline `<header>` for `<PublicHeader />`. `export const dynamic = 'force-static'` stays. The doc-comment that mentions "Renders only a logo header + the shared SiteFooter" stays accurate.

### Edited file — `src/app/login/page.tsx`

Wrap the existing centered card in the same shell shape `(legal)` uses, but with `flex-1 flex items-center justify-center` on the inner `<main>` so the card stays vertically centered between header and footer:

```tsx
return (
  <div className="min-h-screen flex flex-col bg-background">
    <PublicHeader />
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* existing sign-in card content unchanged */}
      </div>
    </main>
    <SiteFooter />
  </div>
)
```

The existing `<main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">` is replaced by the outer `<div>` + inner `<main>`. The inner sign-in markup (`<div className="w-full max-w-sm space-y-6">…</div>`) is left exactly as today — no copy or form changes.

### New test — `src/__tests__/components/PublicHeader.test.tsx`

Vitest + `@testing-library/react`, jsdom. Asserts:

- Renders an `<a>` with `href="/"` (logo + wordmark link back to root).
- Renders the `meetthefam` wordmark text.
- Renders the `<Logo>` SVG — match by `role="img"` + `aria-label="meetthefam"` (same selector style `src/__tests__/components/Logo.test.tsx` uses).

Mirrors the shape of `src/__tests__/components/SiteFooter.test.tsx`.

## Out of scope

- **#161 (SiteFooter audit / `/dmca` link).** Sibling v1.0 issue, separate PR. This spec touches `SiteFooter` only as a *consumer*, not as a target.
- **Auth-flow changes** on `/login` — copy, button styles, magic-link behaviour, Google OAuth flow, `safeNext` allowlist. All untouched.
- **`(app)` chrome refactor.** The authenticated layout has its own nav and is not part of the public-chrome story.
- **Dark-mode tuning** of the new header. Falls under Phase 8 polish (per CLAUDE.md "dark-mode tokens are placeholder shadcn defaults").
- **Route-group restructure** (moving `/login` under `(public)` or `(legal)`). Explicitly rejected above.

## Acceptance criteria (mirrors #162)

- [ ] `/login` shows a logo header that links to `/`.
- [ ] `/login` shows the shared `<SiteFooter>` with working legal links.
- [ ] Header/footer styling matches the `(legal)` pages (heirloom-journal tokens, no hard-coded hex).
- [ ] Sign-in card stays centered and usable on mobile (375×667 viewport spot-check).
- [ ] `(legal)` pages render unchanged after the header is refactored into `<PublicHeader />`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass; new `PublicHeader` test included.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Refactoring the `(legal)` header into a shared component accidentally regresses the static-cache behaviour of `/privacy` `/terms` `/contact` `/about` `/dmca`. | `PublicHeader` is a Server Component with no dynamic data — adding it does not opt the route group out of `force-static`. Visual spot-check the four pages after the swap. |
| `/login`'s vertical centering breaks once a real header + footer are added (card no longer sits perfectly mid-viewport). | Inner `<main className="flex-1 flex items-center justify-center">` keeps the card centered *between* header and footer (which is the desired behaviour). Spot-check at 375×667 and at a desktop viewport. |
| Header markup drifts between `(legal)/layout.tsx` and `PublicHeader.tsx` if either is edited later. | Single-source by extraction: `(legal)/layout.tsx` imports `<PublicHeader />`, doesn't keep its own copy. |
