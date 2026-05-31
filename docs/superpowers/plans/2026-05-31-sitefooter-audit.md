# `SiteFooter` audit + sign-in conditional + sticky-bottom — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `SiteFooter` the authoritative index of every shipped public page, fix the unconditional "Sign in" link, and pin the footer to the viewport bottom across all chromes. Closes [#161](https://github.com/SanchitB23/meetthefam/issues/161).

**Architecture:** Add `/dmca` + `/childrens-privacy` links to the existing `SiteFooter` server component. Extract the auth link into a small `<AuthFooterLink />` client island that reads auth on mount via the browser Supabase client and renders Sign-in (link to `/login`) or Sign-out (server-action form). Fix the flex chain in `(app)/layout.tsx` and the landing page so the footer sticks to the viewport bottom.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Supabase Auth via `@supabase/ssr`, Tailwind v4, Vitest + React Testing Library (jsdom).

**Spec:** [docs/superpowers/specs/2026-05-31-sitefooter-audit-design.md](../specs/2026-05-31-sitefooter-audit-design.md)

**Branch:** `feat/161-sitefooter-audit` (off `origin/qa`, already checked out — spec commit already on this branch).

## Spec refinement (decided while writing this plan)

The spec said the signed-in branch of `<AuthFooterLink />` would call `supabase.auth.signOut()` + `router.refresh()` client-side. **The plan instead reuses the existing `signOut` server action at `src/app/(app)/_actions/signOut.ts`** (already in use by `SignOutButton`). Reasons: DRY (same redirect-to-`/login` behavior, no duplicate auth-client wiring), matches the existing app pattern, and the server action already cleans up cookies via the SSR-aware server client. The architectural decision — *a client island that picks between Sign-in and Sign-out at hydration* — is unchanged.

## File map

| File | Role | Touched in |
|---|---|---|
| `src/components/layout/AuthFooterLink.tsx` | **New.** Client island; reads auth, renders Sign-in `<Link>` or Sign-out `<form>` button. | Tasks 1–2 |
| `src/__tests__/components/AuthFooterLink.test.tsx` | **New.** Signed-out + signed-in branches. | Tasks 1–2 |
| `src/components/layout/SiteFooter.tsx` | **Modified.** Adds 2 `<Link>`s, swaps Sign-in `<Link>` for `<AuthFooterLink />`. | Task 3 |
| `src/__tests__/components/SiteFooter.test.tsx` | **Modified.** Asserts all 6 page hrefs; the sign-in branch test mocks the auth client to scope it to signed-out. | Task 3 |
| `src/app/(app)/layout.tsx` | **Modified.** Wrap `{children}` in `<main className="flex-1">`. | Task 4 |
| `src/app/page.tsx` (landing) | **Modified.** `flex flex-col` on outer `<div>`; `flex-1` wrapper around hero+features. | Task 5 |
| `docs/superpowers/specs/2026-05-30-legal-pages-design.md` | **Modified.** Add "Sibling-page checklist" section. | Task 6 |
| `.github/pull_request_template.md` | **Modified.** One-line manual-checklist reminder. | Task 7 |

`(legal)/layout.tsx` is intentionally NOT touched — its `force-static` is preserved by keeping the auth read inside a client island.

---

## Task 1: `<AuthFooterLink />` — signed-out branch (TDD)

**Files:**
- Create: `src/__tests__/components/AuthFooterLink.test.tsx`
- Create: `src/components/layout/AuthFooterLink.tsx`

- [ ] **Step 1.1: Write the failing test for the signed-out branch**

Create `src/__tests__/components/AuthFooterLink.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the browser Supabase client at module-load time.
const getUserMock = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      signOut: vi.fn(),
    },
  }),
}))

describe('<AuthFooterLink />', () => {
  beforeEach(() => {
    getUserMock.mockReset()
  })

  it('renders a Sign in link when the viewer is signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
    render(<AuthFooterLink />)

    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })
})
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `pnpm test src/__tests__/components/AuthFooterLink.test.tsx`

Expected: FAIL with "Failed to resolve import \"@/components/layout/AuthFooterLink\"" — the component does not exist yet.

- [ ] **Step 1.3: Create the minimal `<AuthFooterLink />` implementation**

Create `src/components/layout/AuthFooterLink.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type AuthState = 'loading' | 'signed-in' | 'signed-out'

/**
 * Auth link slot for <SiteFooter>. Renders nothing while reading auth
 * (avoids a "Sign in" flash for authed visitors on the statically-rendered
 * (legal) pages), then resolves to either a Sign-in link or a Sign-out
 * form on hydration. Encapsulates its own leading middot separator so
 * SiteFooter doesn't render an orphan dot while we're loading.
 */
export function AuthFooterLink() {
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setState(data.user ? 'signed-in' : 'signed-out')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return null
  }

  if (state === 'signed-out') {
    return (
      <>
        <span aria-hidden="true">·</span>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
      </>
    )
  }

  // signed-in branch arrives in Task 2.
  return null
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `pnpm test src/__tests__/components/AuthFooterLink.test.tsx`

Expected: PASS — 1 test passing.

- [ ] **Step 1.5: Commit**

```bash
git add src/components/layout/AuthFooterLink.tsx src/__tests__/components/AuthFooterLink.test.tsx
git commit -m "$(cat <<'EOF'
feat(#161): AuthFooterLink client island — signed-out branch

Scaffold the footer auth-link client component with loading + signed-out
states. Signed-in branch added in the next commit.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `<AuthFooterLink />` — signed-in branch via existing server action

**Files:**
- Modify: `src/components/layout/AuthFooterLink.tsx`
- Modify: `src/__tests__/components/AuthFooterLink.test.tsx`

- [ ] **Step 2.1: Add the failing signed-in test**

Append the test below to `src/__tests__/components/AuthFooterLink.test.tsx`, **inside the existing `describe` block**, after the signed-out test. First add the `signOut` mock near the top — update the existing `vi.mock` block as shown:

Add this mock above the existing `getUserMock` declaration (i.e. before the `vi.mock('@/lib/supabase/client', …)` line):

```tsx
const signOutActionMock = vi.fn()
vi.mock('@/app/(app)/_actions/signOut', () => ({
  signOut: signOutActionMock,
}))
```

Then add this `it` block as the second test inside `describe('<AuthFooterLink />', …)`:

```tsx
it('renders a Sign out form when the viewer is signed in', async () => {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'u_1', email: 'a@b.c' } },
    error: null,
  })
  const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
  render(<AuthFooterLink />)

  const button = await screen.findByRole('button', { name: /sign out/i })
  // The button lives inside a <form action={signOut}> — its enclosing form
  // exists and has action wired. We only assert the button is rendered and
  // submittable here; the actual signOut() call is exercised by the
  // existing signOut action's own tests.
  expect(button).toBeInTheDocument()
  expect(button.closest('form')).not.toBeNull()
})
```

Also extend the `beforeEach` to reset the new mock:

```tsx
beforeEach(() => {
  getUserMock.mockReset()
  signOutActionMock.mockReset()
})
```

- [ ] **Step 2.2: Run the test to verify the new case fails**

Run: `pnpm test src/__tests__/components/AuthFooterLink.test.tsx`

Expected: 1 PASS (signed-out) + 1 FAIL (signed-in) — the failure is `Unable to find an accessible element with the role "button"` because the signed-in branch currently returns `null`.

- [ ] **Step 2.3: Implement the signed-in branch**

Edit `src/components/layout/AuthFooterLink.tsx`. Add the `signOut` import at the top:

```tsx
import { signOut } from '@/app/(app)/_actions/signOut'
```

Then replace the `// signed-in branch arrives in Task 2.\n  return null` block at the bottom with:

```tsx
  // signed-in branch — reuse the existing server action used by SignOutButton
  // (src/app/(app)/_components/SignOutButton.tsx) so we get identical cookie
  // cleanup + redirect-to-/login behavior. The button is styled to match
  // surrounding underlined footer links rather than the nav's button chrome.
  return (
    <>
      <span aria-hidden="true">·</span>
      <form action={signOut} className="inline">
        <button
          type="submit"
          className="cursor-pointer underline hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </>
  )
```

- [ ] **Step 2.4: Run the test to verify both branches pass**

Run: `pnpm test src/__tests__/components/AuthFooterLink.test.tsx`

Expected: 2 PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/layout/AuthFooterLink.tsx src/__tests__/components/AuthFooterLink.test.tsx
git commit -m "$(cat <<'EOF'
feat(#161): AuthFooterLink signed-in branch wires signOut server action

Reuses src/app/(app)/_actions/signOut for cookie cleanup + redirect to
/login, matching SignOutButton's behavior. Button is styled to match
the surrounding underlined footer links.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `<AuthFooterLink />` into `SiteFooter` + add missing legal links

**Files:**
- Modify: `src/__tests__/components/SiteFooter.test.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`

- [ ] **Step 3.1: Update the SiteFooter test to assert all 6 page hrefs and to mock the auth client**

Replace the entire contents of `src/__tests__/components/SiteFooter.test.tsx` with:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// SiteFooter now embeds <AuthFooterLink />, which reads auth on mount.
// Mock the browser client so jsdom doesn't try a real Supabase call.
const getUserMock = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      signOut: vi.fn(),
    },
  }),
}))
vi.mock('@/app/(app)/_actions/signOut', () => ({
  signOut: vi.fn(),
}))

describe('<SiteFooter>', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    // Default: signed-out, so the Sign-in link renders.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
  })

  it('links to every shipped public page', async () => {
    const { SiteFooter } = await import('@/components/layout/SiteFooter')
    const { container } = render(<SiteFooter />)
    // Wait for AuthFooterLink to hydrate so the /login href is present.
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/childrens-privacy')
    expect(hrefs).toContain('/dmca')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/about')
  })

  it('renders a Sign in link when the viewer is signed out', async () => {
    const { SiteFooter } = await import('@/components/layout/SiteFooter')
    render(<SiteFooter />)
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders a Status link only when NEXT_PUBLIC_STATUS_URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATUS_URL', 'https://status.example.com')
    vi.resetModules()
    const { SiteFooter: WithStatus } = await import(
      '@/components/layout/SiteFooter'
    )
    const { container } = render(<WithStatus />)
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('https://status.example.com')
    vi.unstubAllEnvs()
  })
})
```

- [ ] **Step 3.2: Run the SiteFooter test to verify the new assertions fail**

Run: `pnpm test src/__tests__/components/SiteFooter.test.tsx`

Expected: 1 FAIL on the new "links to every shipped public page" case (`/childrens-privacy` and `/dmca` missing) + 2 PASS for the other cases (the existing Status case keeps passing; the renamed sign-in test still finds `/login` because the Sign-in link is currently a direct `<Link>` in SiteFooter).

- [ ] **Step 3.3: Modify SiteFooter to add the 2 missing links and swap Sign-in for `<AuthFooterLink />`**

Replace the entire contents of `src/components/layout/SiteFooter.tsx` with:

```tsx
import Link from 'next/link'
import { AuthFooterLink } from '@/components/layout/AuthFooterLink'

// Hosted status page (BetterStack). Set NEXT_PUBLIC_STATUS_URL in Vercel once
// the BetterStack page is live — the "Status" link only renders when it's set,
// so no dead link ships before launch. See docs/dev/prod-readiness.md §10.
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL

/**
 * SiteFooter — the shared footer for every chrome.
 *
 * Consumed by the (legal) route-group layout, the landing page, and the (app)
 * layout. Carries the heirloom tagline plus the policy + contact links that
 * docs/dev/prod-readiness.md §8 requires before v1.0 launch. The Sign-in /
 * Sign-out slot is a client island (<AuthFooterLink />) — keeps SiteFooter
 * server-rendered and preserves the (legal) route group's force-static mode.
 *
 * Standing convention: every PR that ships a new public (legal) / standard
 * page must add its <Link> here AND assert the href in SiteFooter.test.tsx.
 * See docs/superpowers/specs/2026-05-30-legal-pages-design.md → Sibling-page
 * checklist.
 */
export function SiteFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <nav
        aria-label="Footer"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      >
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/childrens-privacy" className="underline hover:text-foreground">
          Children&apos;s Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/dmca" className="underline hover:text-foreground">
          DMCA
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="underline hover:text-foreground">
          Contact
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/about" className="underline hover:text-foreground">
          About
        </Link>
        <AuthFooterLink />
        {STATUS_URL ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={STATUS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Status
            </a>
          </>
        ) : null}
      </nav>
    </footer>
  )
}
```

Note: `<AuthFooterLink />` owns its leading `·`, so the parent layout drops the middot that previously preceded the Sign-in `<Link>`.

- [ ] **Step 3.4: Run the SiteFooter test to verify all cases pass**

Run: `pnpm test src/__tests__/components/SiteFooter.test.tsx`

Expected: 3 PASS.

- [ ] **Step 3.5: Run the full Vitest suite to catch any regressions**

Run: `pnpm test`

Expected: All tests pass. (If any other test imports `SiteFooter`, they should still pass — the public API is unchanged.)

- [ ] **Step 3.6: Commit**

```bash
git add src/components/layout/SiteFooter.tsx src/__tests__/components/SiteFooter.test.tsx
git commit -m "$(cat <<'EOF'
feat(#161): add /dmca + /childrens-privacy to SiteFooter; conditional auth link

Footer is now the authoritative index of every shipped public (legal)
page. Sign-in is swapped for <AuthFooterLink />, the client island that
resolves to either Sign-in (signed out) or a Sign-out form action
(signed in). SiteFooter.test.tsx now asserts all six page hrefs and
mocks the auth client so jsdom doesn't reach Supabase.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fix sticky-bottom in `(app)/layout.tsx`

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 4.1: Read the current layout**

Open `src/app/(app)/layout.tsx`. Confirm the current shape is:

```tsx
return (
  <div className="min-h-screen flex flex-col bg-background">
    <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
      …
    </nav>
    {children}
    <SiteFooter />
  </div>
)
```

The bug: `{children}` has no `flex-1`, so on short-content pages (e.g. an empty dashboard) the footer rides up to sit just below the content.

- [ ] **Step 4.2: Wrap `{children}` in `<main className="flex-1">`**

Edit `src/app/(app)/layout.tsx`. Replace the `{children}` line with:

```tsx
      <main className="flex-1">{children}</main>
```

So the return becomes:

```tsx
return (
  <div className="min-h-screen flex flex-col bg-background">
    <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
      <a href="/dashboard" className="flex items-center gap-2 text-primary">
        <Logo size={28} />
        <span className="font-serif text-xl text-foreground">meetthefam</span>
      </a>
      <SignOutButton />
    </nav>
    <main className="flex-1">{children}</main>
    <SiteFooter />
  </div>
)
```

- [ ] **Step 4.3: Manually verify in the running app**

Start the local Supabase stack and dev server:

```bash
pnpm exec supabase start
pnpm dev
```

Open `http://localhost:3000/dashboard` (sign in if prompted). Confirm: the `<SiteFooter>` sits at the **viewport bottom**, not riding up to touch the dashboard content. Try resizing the window taller; footer should stay at the bottom of the viewport while content stays at the top.

Repeat for `http://localhost:3000/tree/<some-tree-id>` and any other auth-gated route you have data for.

- [ ] **Step 4.4: Commit**

```bash
git add 'src/app/(app)/layout.tsx'
git commit -m "$(cat <<'EOF'
fix(#161): pin SiteFooter to viewport bottom in (app) chrome

Wraps {children} in <main className="flex-1"> so short-content pages
(empty dashboard, fresh tree) no longer let the footer ride up.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Fix sticky-bottom on the landing page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 5.1: Replace the landing-page wrapper**

Edit `src/app/page.tsx`. Replace the return block. Current:

```tsx
return (
  <div className="min-h-screen bg-background text-foreground">
    <LandingHero />
    <LandingFeatures />
    <LandingFooter />
  </div>
)
```

Replace with (note: the import already says `LandingFooter` but qa swapped it to `SiteFooter` — verify the import line and use `<SiteFooter />` here; if for any reason this branch still has `LandingFooter`, replace it with `SiteFooter` and update the import):

```tsx
return (
  <div className="min-h-screen flex flex-col bg-background text-foreground">
    <div className="flex-1">
      <LandingHero />
      <LandingFeatures />
    </div>
    <SiteFooter />
  </div>
)
```

If the import line at the top reads `import { LandingFooter } from '@/components/landing/LandingFooter'`, replace it with:

```tsx
import { SiteFooter } from '@/components/layout/SiteFooter'
```

(Per the spec, `LandingFooter` was retired on qa; this branch is off qa so the import should already say `SiteFooter`. Belt-and-braces.)

- [ ] **Step 5.2: Manually verify on the landing page**

With `pnpm dev` running, sign **out** (or open an incognito window) and visit `http://localhost:3000/`. Verify:

- At a normal desktop height: the hero fills above the fold, features below it, footer is reachable by scrolling.
- At a tall viewport (resize taller than the content): the footer stays pinned to the **viewport bottom**, with white space pushed into the `flex-1` wrapper, not between content and footer.

- [ ] **Step 5.3: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
fix(#161): pin SiteFooter to viewport bottom on landing page

Adds flex flex-col to the page root and wraps hero+features in a
flex-1 spacer so tall viewports / short-content renders keep the
footer at the viewport bottom.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add "Sibling-page checklist" to the parent legal-pages spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-30-legal-pages-design.md`

- [ ] **Step 6.1: Pick the insertion point**

Open `docs/superpowers/specs/2026-05-30-legal-pages-design.md`. Find a sensible insertion point — preferably right before the "Out of scope" or the "Sibling pages / future children" section (whichever exists). If neither exists, insert at the bottom of the file, just above the final blank line.

- [ ] **Step 6.2: Append the new section**

Insert the following markdown block at the chosen point:

```markdown
## Sibling-page checklist (when shipping a new public page)

When a sibling public page under [#56](https://github.com/SanchitB23/meetthefam/issues/56)
ships (e.g. `/cookies`, `/accessibility`, `/imprint`, `/security`, `/subprocessors`,
`/faq`, `/pricing`), the **same PR** must:

1. Add a `<Link>` row for the new page in `src/components/layout/SiteFooter.tsx`,
   in the agreed slot — legal pages cluster before Contact / About / auth link.
2. Extend `src/__tests__/components/SiteFooter.test.tsx` with
   `expect(hrefs).toContain('/new-path')` in the
   `'links to every shipped public page'` test.

Reviewers should reject sibling-page PRs missing either step. The convention is
enforced by the test (CI fails when the assertion is missing AND the link
was added but not asserted, or vice-versa) and re-stated in the PR template's
manual checklist.

Convention authored under [#161](https://github.com/SanchitB23/meetthefam/issues/161);
see [`docs/superpowers/specs/2026-05-31-sitefooter-audit-design.md`](2026-05-31-sitefooter-audit-design.md).
```

- [ ] **Step 6.3: Commit**

```bash
git add docs/superpowers/specs/2026-05-30-legal-pages-design.md
git commit -m "$(cat <<'EOF'
docs(#161): sibling-page checklist for SiteFooter + tests

Codifies the standing convention from #161 in the parent legal-pages
spec: every new public page PR must add its SiteFooter <Link> AND
extend SiteFooter.test.tsx with the href assertion in the same change.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add the one-line reminder to the PR template

**Files:**
- Modify: `.github/pull_request_template.md`

- [ ] **Step 7.1: Find the manual-checklist section**

Open `.github/pull_request_template.md`. Locate the `### App walkthrough` block under `## Manual human-testable checklist`. The new bullet should go in a sensible place — at the top of the App walkthrough section, before the existing "Pulled the branch…" item, so it's the first thing a reviewer ticks.

- [ ] **Step 7.2: Insert the new checklist item**

Add this bullet as the **first** item under `### App walkthrough (local dev — \`pnpm dev\` against \`pnpm exec supabase start\`)`:

```markdown
- [ ] If this PR adds a new public `(legal)` / standard page, the `SiteFooter` link **and** the corresponding `SiteFooter.test.tsx` href assertion landed in this same PR (per `docs/superpowers/specs/2026-05-30-legal-pages-design.md` → Sibling-page checklist). Tick "N/A" if not applicable.
```

- [ ] **Step 7.3: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "$(cat <<'EOF'
docs(#161): PR template reminder for new-public-page footer-link sync

Adds a manual-checklist item so reviewers catch sibling pages that
ship without a SiteFooter link + test assertion in the same PR.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + open the draft PR

**No files modified** — verification only.

- [ ] **Step 8.1: Typecheck**

Run: `pnpm typecheck`

Expected: 0 errors. If any error, fix it before proceeding (likely culprits: a missing `import type` somewhere if the AuthFooterLink prop interface is referenced elsewhere; the spec doesn't introduce any new public types so this should be clean).

- [ ] **Step 8.2: Lint**

Run: `pnpm lint`

Expected: 0 errors / 0 warnings. If anything fires on `cursor-pointer` or `underline` ordering, run `pnpm lint --fix`.

- [ ] **Step 8.3: Full test run**

Run: `pnpm test`

Expected: All tests pass. Confirm both `SiteFooter.test.tsx` (3 cases) and `AuthFooterLink.test.tsx` (2 cases) report green.

- [ ] **Step 8.4: Manual click-through across all three chromes**

With `pnpm dev` running, in **incognito** (signed-out) and a **signed-in** browser side-by-side:

- `/` (landing):
  - Signed-out → footer shows all 6 page links + "Sign in" → /login.
  - Signed-in → redirects to /dashboard (existing behavior). No footer-link verification needed here.
- `/privacy` and `/dmca` (legal):
  - Signed-out → footer shows "Sign in".
  - Signed-in → footer briefly empty in the auth slot (loading state), then resolves to a "Sign out" button. Clicking it ends the session and redirects to /login.
- `/dashboard` (app):
  - Footer sits at viewport bottom regardless of how empty the dashboard is.
  - "Sign out" button in footer matches the nav's "Sign out" behavior.
- All chromes: click `/childrens-privacy` and `/dmca` from the footer; both load their respective pages.
- All chromes: at 375 × 667 viewport, the footer link row wraps cleanly with no overlap.

- [ ] **Step 8.5: Push the branch**

```bash
git push -u origin feat/161-sitefooter-audit
```

- [ ] **Step 8.6: Open the draft PR**

Per [feedback_draft_prs_user_marks_ready](memory):

```bash
gh pr create --draft \
  --base qa \
  --title "feat(#161): SiteFooter audit — add missing legal links + sign-in conditional + sticky-bottom" \
  --body "$(cat <<'EOF'
## Summary

Closes the SiteFooter audit gap surfaced by #56's umbrella work: the footer is now the authoritative index of every shipped public `(legal)` page, the Sign-in link is properly conditional on auth state, and the footer is pinned to the viewport bottom across all three chromes. Also locks a standing convention so future sibling pages can't drift again.

## Changes

- `src/components/layout/AuthFooterLink.tsx` (new) — client island that reads auth on mount and renders either a Sign-in `<Link>` or a Sign-out `<form action={signOut}>`.
- `src/components/layout/SiteFooter.tsx` — adds `/dmca` + `/childrens-privacy` links; swaps the Sign-in `<Link>` for `<AuthFooterLink />`.
- `src/app/(app)/layout.tsx` — wraps `{children}` in `<main className="flex-1">` so the footer stays pinned to the viewport bottom.
- `src/app/page.tsx` (landing) — adds `flex flex-col` + `flex-1` wrapper for the same reason.
- Tests: new `AuthFooterLink.test.tsx` (signed-in / signed-out branches); extended `SiteFooter.test.tsx` to assert all 6 page hrefs and mock the auth client.
- Standing convention: new "Sibling-page checklist" section in `docs/superpowers/specs/2026-05-30-legal-pages-design.md`; one-line manual-checklist reminder in `.github/pull_request_template.md`.

## Closes

Closes #161

## Spec + plan

- Spec: [docs/superpowers/specs/2026-05-31-sitefooter-audit-design.md](docs/superpowers/specs/2026-05-31-sitefooter-audit-design.md)
- Plan: [docs/superpowers/plans/2026-05-31-sitefooter-audit.md](docs/superpowers/plans/2026-05-31-sitefooter-audit.md)

## Test plan

- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 errors
- [x] `pnpm test` — `SiteFooter.test.tsx` (3 cases) + `AuthFooterLink.test.tsx` (2 cases) green; full suite green
- [ ] Walked all three chromes (landing, legal, app) signed-out and signed-in; verified link order, sticky-bottom, sign-in/out branches, and 375px viewport wrap

EOF
)"
```

Set the milestone to **v1.0 — Launch** in the PR UI after creation.

---

## Verification summary (recap)

| Spec requirement | Implementing task |
|---|---|
| Add `/dmca` link | Task 3 |
| Add `/childrens-privacy` link | Task 3 |
| Sign-in conditional (client island) | Tasks 1, 2, 3 |
| Sign-out behavior reuses server action | Task 2 |
| Render-nothing-while-loading | Task 1 |
| Link order (legal cluster up front) | Task 3 |
| Sticky-bottom fix in `(app)/layout` | Task 4 |
| Sticky-bottom fix on landing | Task 5 |
| `(legal)/layout` left alone (force-static preserved) | (no task — explicit non-change) |
| Extended `SiteFooter.test.tsx` (6 href assertions + auth mock) | Task 3 |
| New `AuthFooterLink.test.tsx` (2 branches) | Tasks 1, 2 |
| "Sibling-page checklist" in legal-pages spec | Task 6 |
| One-line reminder in PR template | Task 7 |
| Typecheck / lint / test green | Task 8 |
| Manual click-through all chromes | Task 8 |
