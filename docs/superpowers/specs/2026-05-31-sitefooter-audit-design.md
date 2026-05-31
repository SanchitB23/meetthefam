# `SiteFooter` audit + two follow-on bugs — design

> Spec for [#161](https://github.com/SanchitB23/meetthefam/issues/161), a child of the
> [#56](https://github.com/SanchitB23/meetthefam/issues/56) "standard & legal pages" umbrella.
> Authored via `superpowers:brainstorming` on 2026-05-31. Extends the launch-gate legal-pages
> spec (`docs/superpowers/specs/2026-05-30-legal-pages-design.md`), which introduced
> `<SiteFooter>` as the §8 launch-gate deliverable.

## Goal

Make `SiteFooter` the authoritative, complete index of every shipped public `(legal)` /
standard page, and fix the two visible footer bugs surfaced on the issue thread:

1. **Missing links.** `/dmca` (#138) and `/childrens-privacy` (#139) are live but not in the
   footer link row — reachable only by direct URL.
2. **"Sign in" is unconditional.** Signed-in visitors on `(legal)` pages still see a "Sign in"
   link in the footer.
3. **Footer is not pinned to the viewport bottom** on short-content pages in the `(app)` chrome
   and on the landing page — it rides up to sit immediately under the main content.

The PR closes #161 and locks a standing convention so future sibling pages can't drift again.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Need a new footer design?** | **No.** Keep the heirloom tagline + middot-separated row. | 8 links still fit comfortably in `flex flex-wrap`; sectional footers only earn their keep at ~10+ links; the tagline + row matches the heirloom voice. A redesign is Phase-8-style polish, not a launch-gate task. |
| **Auth-state mechanic** | **Client island.** Extract Sign-in/Sign-out into a small `<AuthFooterLink />` client component that reads auth on mount. | Preserves `export const dynamic = 'force-static'` on `(legal)/layout.tsx` (deliberate optimization from #137). Option B (drop force-static + prop-driven `isSignedIn`) was simpler but undoes that optimization. Option C (move auth link to header) widens scope unnecessarily. |
| **Sign-out behavior** | When signed in, render a `<button>` styled to match the surrounding footer links; click → `supabase.auth.signOut()` + `router.refresh()`. | Mirrors `SignOutButton` semantics without importing its chrome (button shape vs. inline link). One inline click handler, no new server action. |
| **Initial-render fallback** | While the client island is loading, render **nothing** in that slot (don't render "Sign in" as a default). | Prevents a brief "Sign in" flash for authed users on `(legal)` pages. The cost is a slightly empty footer slot until hydration — acceptable, footer is below-the-fold. |
| **Link order** | `Privacy · Terms · Children's Privacy · DMCA · Contact · About · [Sign in / Sign out] · (Status)` | Legal cluster up front; auth + status as the trailing edge. `flex flex-wrap` keeps it usable at 320 / 375 / 414px. |
| **Sticky-bottom fix scope** | Fix the two chromes that are wrong (`(app)/layout.tsx` and `src/app/page.tsx`). `(legal)/layout.tsx` is already correct. | Minimal blast radius. The root `<body class="min-h-full flex flex-col">` is fine. |
| **Test coverage** | Extend `SiteFooter.test.tsx` with `/dmca` + `/childrens-privacy` href assertions; add a new `AuthFooterLink.test.tsx` for the signed-in / signed-out branches. | Cheap regression guard for the standing convention (below); the AuthFooterLink branches are pure logic worth pinning. |
| **Standing convention** | Add a "Sibling-page checklist" section to the parent legal-pages spec **and** a one-line reminder to the PR template. | Two-channel reminder catches both spec-readers (planning side) and PR-template-readers (review side). |

## Architecture

### Components

```
src/components/layout/
  SiteFooter.tsx            # MODIFIED — adds 2 links, swaps Sign-in <Link> for <AuthFooterLink />
  AuthFooterLink.tsx        # NEW — client component, picks Sign in vs Sign out
```

`SiteFooter` stays a server component used by all three chromes. The only client island is the
single auth link — the policy/info links remain SSR'd.

### `<AuthFooterLink />` shape

- `'use client'`.
- On mount: `useEffect` → `supabase.auth.getUser()` → setState (`'loading' | 'signed-in' | 'signed-out'`).
- Render branches:
  - `loading` → renders nothing (an empty fragment). Keeps the middot before it from creating an
    orphan separator: the surrounding middot in `SiteFooter` is conditional on the link
    rendering. (See "Separator handling" below.)
  - `signed-out` → `<Link href="/login" className="underline hover:text-foreground">Sign in</Link>`.
  - `signed-in` → `<button type="button" className="underline hover:text-foreground cursor-pointer"
    onClick={handleSignOut}>Sign out</button>` where `handleSignOut` calls
    `await supabase.auth.signOut()` then `router.refresh()`.
- Uses the existing browser Supabase client from `@/lib/supabase/client`.

### Separator handling

The middot before the auth link must not render while the island is in `loading` (otherwise the
footer briefly shows `… About · ` with a trailing middot). Two options:

- **A.** Let `<AuthFooterLink />` own its leading middot. The component renders nothing in
  `loading`, and `(<span aria-hidden>·</span> <link-or-button>)` in either resolved state.
  Keeps `SiteFooter` simple.
- **B.** Conditionally render the middot in `SiteFooter` based on a prop. More wiring.

**Pick A.** The leading middot is a property of "this is the auth slot," not a property of the
parent footer. Encapsulation wins.

### `SiteFooter` after the change

Server component, structure unchanged. Order (with separators omitted for brevity):

```
Privacy · Terms · Children's Privacy · DMCA · Contact · About · <AuthFooterLink /> · (Status)
```

The `Status` link's existing leading middot stays as-is — it's already conditional on
`STATUS_URL`, which is a build-time env var, so no hydration race.

### Sticky-bottom fix

Root cause: `(app)/layout.tsx` and the landing page (`src/app/page.tsx`) place content directly
between the chrome and `<SiteFooter />` without a `flex-1` spacer, so on short-content pages
(e.g. a dashboard with one tree, or any narrow-viewport landing render) the footer rides up to
sit right under the content instead of at the viewport bottom.

`(legal)/layout.tsx` already does this correctly (its `<main>` has `flex-1`); no change needed
there. `<VersionFooter />` (the tiny version pill in `src/app/layout.tsx`, beneath everything)
already cooperates with `<body class="min-h-full flex flex-col">` and stays put.

**Fixes:**

| File | Current | After |
|---|---|---|
| `src/app/(app)/layout.tsx` | `<div min-h-screen flex flex-col …> nav · {children} · <SiteFooter /></div>` | Wrap `{children}` in `<main className="flex-1">…</main>`. |
| `src/app/page.tsx` (landing) | `<div className="min-h-screen bg-background text-foreground"> hero · features · footer </div>` | Add `flex flex-col` to the outer `<div>`; wrap hero+features in `<div className="flex-1">…</div>` so the footer is pushed to the bottom on short content. Do **not** edit `LandingFeatures` internals — keep the fix local to the page file. |
| `src/app/(legal)/layout.tsx` | already correct (`<main className="…flex-1…">`) | unchanged |
| `src/app/layout.tsx` (root) | `<body className="min-h-full flex flex-col">{children}<VersionFooter />…</body>` | unchanged |

The landing fix is defensive — at typical viewport sizes the hero is tall enough that this
never matters. But mobile-landscape and zoomed-in renders can produce short content; the
flex-1 wrapper is the obvious guard.

## Standing convention — "Sibling-page checklist"

Add a new section to `docs/superpowers/specs/2026-05-30-legal-pages-design.md` (the parent
launch-gate spec) titled **"Sibling-page checklist (when shipping a new public page)"**:

> When a future sibling public page under #56 ships (e.g. `/cookies`, `/accessibility`,
> `/imprint`, `/security`, `/subprocessors`, `/faq`, `/pricing`), the **same PR** must:
>
> 1. Add a `<Link>` row for the new page in `src/components/layout/SiteFooter.tsx`, in the
>    agreed slot (legal pages keep clustering before Contact / About).
> 2. Extend `src/__tests__/components/SiteFooter.test.tsx` with
>    `expect(hrefs).toContain('/new-path')`.
>
> Reviewers should reject sibling-page PRs missing either step. This convention is enforced by
> the test (CI fails) and re-stated in the PR template's manual checklist.

Mirror this with a one-line reminder in `.github/pull_request_template.md` under the manual
checklist:

> - [ ] If this PR adds a new public `(legal)` / standard page, the `SiteFooter` link **and**
>   the corresponding `SiteFooter.test.tsx` href assertion landed in this same PR (per
>   `docs/superpowers/specs/2026-05-30-legal-pages-design.md` → Sibling-page checklist).

## Testing

### `src/__tests__/components/SiteFooter.test.tsx` — extended

The existing `vi.stubEnv` test for the conditional Status link stays. Two changes:

- The first test (`'links to the privacy, terms, contact, and about pages'`) renames to
  `'links to every shipped public page'` and asserts:

  ```ts
  expect(hrefs).toContain('/privacy')
  expect(hrefs).toContain('/terms')
  expect(hrefs).toContain('/childrens-privacy')
  expect(hrefs).toContain('/dmca')
  expect(hrefs).toContain('/contact')
  expect(hrefs).toContain('/about')
  ```

- The existing `'keeps a sign-in link'` test stays but is **scoped to the signed-out branch**
  via a mock on `@/lib/supabase/client`. (Without a mock, `getUser()` may resolve to "no user"
  fine in jsdom — but pinning it explicitly avoids flake.) The test mocks `getUser` to resolve
  `{ data: { user: null } }`, awaits a tick, asserts the `/login` href is present.

### `src/__tests__/components/AuthFooterLink.test.tsx` — new

Two cases, both with `vi.mock('@/lib/supabase/client', …)`:

- **Signed-out** → `getUser` resolves `{ data: { user: null } }`. After `await
  findByRole('link', { name: /sign in/i })`, assert `href="/login"`.
- **Signed-in** → `getUser` resolves `{ data: { user: { id: 'u_1', email: 'x@y.z' } } }`. After
  `await findByRole('button', { name: /sign out/i })`, click it, assert `signOut` was called
  exactly once and `router.refresh` was called. (`useRouter` is mocked too.)

### What we do not test

- Cross-chrome integration (does `(app)` render the right footer when the user is logged in?) —
  covered by Playwright happy-paths if/when they need an update; the unit-level branch tests
  pin the behavior at the component boundary.
- Visual snapshot of the wrap behavior at 320 / 375 / 414px — verified manually once; no
  snapshot test (snapshots in this repo are reserved for stable static content).

## Out of scope (explicit non-goals)

- Sectional / multi-column footer redesign. Single wrapped row stays.
- Retiring `src/components/landing/LandingFooter.tsx` — already retired on qa via #137; no
  orphan file remains.
- A persistent "Sign out is sticky in the app nav already" UX cleanup. The footer Sign-out is
  an additional surface, not a replacement for the nav button.
- Auth flicker mitigation beyond the "render nothing while loading" strategy. Acceptable for a
  footer link; below the fold on every chrome.
- Updating any of the existing `(legal)` page bodies (`/privacy`, `/terms`, `/contact`,
  `/about`, `/dmca`, `/childrens-privacy`). Pure footer + chrome work.

## Files touched (anticipated)

| File | Change |
|---|---|
| `src/components/layout/SiteFooter.tsx` | Modified — add `/dmca` + `/childrens-privacy` links, swap Sign-in `<Link>` for `<AuthFooterLink />`. |
| `src/components/layout/AuthFooterLink.tsx` | **New** — client island. |
| `src/app/(app)/layout.tsx` | Modified — wrap `{children}` in `<main className="flex-1">`. |
| `src/app/page.tsx` | Modified — `flex flex-col` on root + `flex-1` wrapper around hero+features. |
| `src/__tests__/components/SiteFooter.test.tsx` | Modified — assert 6 page hrefs; mock client for the sign-in branch. |
| `src/__tests__/components/AuthFooterLink.test.tsx` | **New** — signed-in / signed-out branches. |
| `docs/superpowers/specs/2026-05-30-legal-pages-design.md` | Modified — add "Sibling-page checklist" section. |
| `.github/pull_request_template.md` | Modified — one-line sibling-page reminder under manual checklist. |
| `docs/superpowers/specs/2026-05-31-sitefooter-audit-design.md` | **New** — this spec. |

## Risks / things to verify during implementation

- **`router.refresh()` from a client component in (app) layout subtree** — verify this triggers
  a re-render of the auth-gated layout (i.e., the proxy bounce on logged-out). Should be fine
  per Next.js 16 docs (ADR 0007), but call it out in the implementation plan as a manual
  verification step.
- **Hydration mismatch** — `<AuthFooterLink />` returns `null` on the server and on the first
  client render. No mismatch risk.
- **`/childrens-privacy` route exists on qa?** — verified via `git ls-tree origin/qa
  src/app/(legal)/` (yes, shipped via #158). Same for `/dmca` (#159).
- **Status link wrapping order** — at very narrow widths (≤320px), the wrap may put Status on
  its own line after 7 other items. Visual check during implementation; acceptable per the
  existing `flex flex-wrap` design.
