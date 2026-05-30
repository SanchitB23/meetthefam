# Launch-gate Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public `/privacy`, `/terms`, and `/contact` pages plus a shared `<SiteFooter>` (policy + contact links) wired into both the landing page and the authenticated `(app)` chrome, unblocking v1.0 launch gate §8.

**Architecture:** A new `(legal)` route group holds the three Server-Component pages under a shared public layout (logo header + `<SiteFooter>`). Page bodies use a dependency-free `<Prose>` wrapper that styles descendant elements with heirloom tokens. `<SiteFooter>` is extracted once and consumed by the `(legal)` layout, the landing page (retiring `LandingFooter`), and the `(app)` layout.

**Tech Stack:** Next.js 16 (App Router, Server Components), Tailwind v4 + heirloom tokens, Vitest + @testing-library/react (jsdom), branch `feat/137-legal-pages`, closes #137.

**Spec:** `docs/superpowers/specs/2026-05-30-legal-pages-design.md`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/components/ui/Prose.tsx` | Heirloom-styled prose wrapper (no typography plugin) | Create |
| `src/components/layout/SiteFooter.tsx` | Shared footer: tagline + Privacy/Terms/Contact/Sign in + conditional Status | Create |
| `src/components/landing/LandingFooter.tsx` | Old landing-only footer | Delete (logic absorbed by `SiteFooter`) |
| `src/app/page.tsx` | Landing page | Modify — swap `LandingFooter` → `SiteFooter` |
| `src/app/(app)/layout.tsx` | Authed chrome | Modify — append `<SiteFooter />` |
| `src/app/(legal)/layout.tsx` | Public chrome for legal pages | Create |
| `src/app/(legal)/privacy/page.tsx` | `/privacy` | Create |
| `src/app/(legal)/terms/page.tsx` | `/terms` | Create |
| `src/app/(legal)/contact/page.tsx` | `/contact` | Create |
| `src/__tests__/components/Prose.test.tsx` | Render guard for `<Prose>` | Create |
| `src/__tests__/components/SiteFooter.test.tsx` | href wiring guard for `<SiteFooter>` | Create |

**Conventions to follow:**
- Component tests start with `/** @vitest-environment jsdom */` and use `@testing-library/react` (see `src/__tests__/components/VersionFooter.test.tsx`).
- Server Components are the default — none of these files need `'use client'`.
- Style with heirloom Tailwind utilities only (`bg-background`, `text-foreground`, `text-muted-foreground`, `text-accent`, `text-primary`, `border-border`, `font-serif`). Never hard-code hex.
- The `(legal)` layout must NOT render `<html>`/`<body>` — the root layout (`src/app/layout.tsx`) already provides those plus `<VersionFooter>`.
- Commits reference `(#137)`. The PR body carries the bare `Closes #137`.

---

## Task 1: `<Prose>` heirloom prose wrapper

**Files:**
- Create: `src/components/ui/Prose.tsx`
- Test: `src/__tests__/components/Prose.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Prose } from '@/components/ui/Prose'

describe('<Prose>', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <Prose>
        <h2>Section heading</h2>
        <p>Body text.</p>
      </Prose>,
    )
    expect(getByText('Section heading')).toBeTruthy()
    expect(getByText('Body text.')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/Prose.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/Prose`.

- [ ] **Step 3: Write the component**

```tsx
import type { ReactNode } from 'react'

/**
 * Prose — heirloom-styled wrapper for long-form text (legal pages).
 *
 * Styles descendant elements via Tailwind arbitrary-variant selectors against
 * the heirloom tokens, so we avoid pulling in @tailwindcss/typography (whose
 * cool-gray defaults fight the cream/forest palette). Wrap a page's body in
 * <Prose> for consistent headings, paragraphs, lists, and links.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className="
        [&_h1]:font-serif [&_h1]:text-4xl [&_h1]:text-foreground [&_h1]:mb-2
        [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3
        [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
        [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
        [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1 [&_ul]:text-muted-foreground
        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1 [&_ol]:text-muted-foreground
        [&_a]:text-accent [&_a]:underline hover:[&_a]:text-foreground
        [&_strong]:text-foreground [&_strong]:font-semibold
      "
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/Prose.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Prose.tsx src/__tests__/components/Prose.test.tsx
git commit -m "feat(#137): add Prose heirloom text wrapper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `<SiteFooter>` shared footer

**Files:**
- Create: `src/components/layout/SiteFooter.tsx`
- Test: `src/__tests__/components/SiteFooter.test.tsx`

This component absorbs the tagline and the `NEXT_PUBLIC_STATUS_URL` conditional-Status logic from the existing `src/components/landing/LandingFooter.tsx` (which Task 3 deletes).

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteFooter } from '@/components/layout/SiteFooter'

describe('<SiteFooter>', () => {
  it('links to the privacy, terms, and contact pages', () => {
    const { container } = render(<SiteFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
  })

  it('keeps a sign-in link', () => {
    const { container } = render(<SiteFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/login')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/SiteFooter.test.tsx`
Expected: FAIL — cannot resolve `@/components/layout/SiteFooter`.

- [ ] **Step 3: Write the component**

```tsx
import Link from 'next/link'

// Hosted status page (BetterStack). Set NEXT_PUBLIC_STATUS_URL in Vercel once
// the BetterStack page is live — the "Status" link only renders when it's set,
// so no dead link ships before launch. See docs/dev/prod-readiness.md §10.
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL

/**
 * SiteFooter — the shared footer for every chrome.
 *
 * Consumed by the (legal) route-group layout, the landing page, and the (app)
 * layout. Carries the heirloom tagline plus the policy + contact links that
 * docs/dev/prod-readiness.md §8 requires before v1.0 launch. Replaces the old
 * landing-only LandingFooter.
 */
export function SiteFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link href="/contact" className="underline hover:text-foreground">
          Contact
        </Link>
        <span aria-hidden>·</span>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
        {STATUS_URL ? (
          <>
            <span aria-hidden>·</span>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/SiteFooter.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SiteFooter.tsx src/__tests__/components/SiteFooter.test.tsx
git commit -m "feat(#137): add shared SiteFooter with policy + contact links

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Wire `SiteFooter` into landing + app chrome, retire `LandingFooter`

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Delete: `src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Swap the import + usage in the landing page**

In `src/app/page.tsx`, replace the `LandingFooter` import line:

```tsx
import { LandingFooter } from '@/components/landing/LandingFooter'
```

with:

```tsx
import { SiteFooter } from '@/components/layout/SiteFooter'
```

and replace the `<LandingFooter />` element in the returned JSX with:

```tsx
<SiteFooter />
```

- [ ] **Step 2: Append `<SiteFooter>` to the app layout**

In `src/app/(app)/layout.tsx`, add the import at the top (after the existing imports):

```tsx
import { SiteFooter } from '@/components/layout/SiteFooter'
```

Then place `<SiteFooter />` immediately after `{children}` inside the flex-column wrapper, so the closing of the component reads:

```tsx
      {children}
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 3: Delete the retired component**

Run: `git rm src/components/landing/LandingFooter.tsx`

- [ ] **Step 4: Verify nothing else imports `LandingFooter`**

Run: `grep -rn "LandingFooter" src/`
Expected: no matches (empty output). If any remain, update them to `SiteFooter`.

- [ ] **Step 5: Typecheck + lint + run the footer test**

Run: `pnpm typecheck && pnpm lint && pnpm exec vitest run src/__tests__/components/SiteFooter.test.tsx`
Expected: typecheck clean, lint clean, test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(#137): wire SiteFooter into landing + app chrome, retire LandingFooter

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: `(legal)` route-group layout

**Files:**
- Create: `src/app/(legal)/layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * Public chrome for legal / marketing pages (/privacy, /terms, /contact).
 *
 * Sits OUTSIDE the (app) route group, so these pages carry no authenticated
 * nav or Sign-Out button. Renders only a logo header + the shared SiteFooter;
 * the root layout (src/app/layout.tsx) still provides <html>/<body> and the
 * tiny VersionFooter beneath everything.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <Link href="/" className="flex w-fit items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean (no page exists in the group yet, but the layout itself must compile).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(legal)/layout.tsx"
git commit -m "feat(#137): add (legal) route-group layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: `/privacy` — Privacy Policy

**Files:**
- Create: `src/app/(legal)/privacy/page.tsx`

- [ ] **Step 1: Write the page (full content — do not abbreviate)**

```tsx
import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Privacy Policy · meetthefam',
  description:
    'How meetthefam collects, uses, and protects your family-tree data.',
}

export default function PrivacyPage() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        This Privacy Policy explains how meetthefam (“we”, “us”) collects, uses,
        and protects your information. meetthefam is operated by Sanchit
        Bhatnagar as an individual. If you have any questions, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>

      <h2>1. Who we are</h2>
      <p>
        meetthefam is a private, invite-based family-tree service operated by
        Sanchit Bhatnagar (an individual) from India. For the purposes of
        applicable data-protection law, including India’s Digital Personal Data
        Protection Act, 2023 (DPDP Act), we act as the data fiduciary for the
        personal data described below.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — the email address you use to sign in
          (via magic link or Google sign-in).
        </li>
        <li>
          <strong>Content you create</strong> — the names, photos, biographies,
          dates, and parent / child / spouse relationships you add to your
          family trees.
        </li>
        <li>
          <strong>Usage data</strong> — minimal, privacy-respecting product
          analytics collected through Vercel Analytics and Vercel Speed Insights
          to understand performance and improve the service.
        </li>
      </ul>
      <p>
        We do not ask for or intentionally collect sensitive personal data
        beyond what you choose to enter into your trees.
      </p>

      <h2>3. Why we use it and our lawful basis</h2>
      <p>
        We process your data to create and maintain your account, store and
        display your family trees, secure your data against unauthorized access,
        and improve the reliability and performance of the service. Our lawful
        basis is your consent (given when you sign up and add content) and our
        legitimate interest in operating and securing the service.
      </p>

      <h2>4. Who we share it with</h2>
      <p>
        We do not sell your personal data. We share it only with the service
        providers (“processors”) that make meetthefam work:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and photo
          storage.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and analytics.
        </li>
      </ul>
      <p>
        These providers process data on our behalf under their own security and
        privacy commitments. We add new processors only where necessary to run
        the service.
      </p>

      <h2>5. How long we keep it and deletion</h2>
      <p>
        We keep your data for as long as your account and trees exist. You can
        delete individual people or entire trees at any time from within the
        app; doing so removes the associated records and any uploaded photos
        from storage. Account-level export and full-account deletion are planned
        features; until they ship, you can request account deletion by emailing{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a> and
        we will action it.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Subject to applicable law, you have the right to access the personal
        data we hold about you, correct inaccurate data, and request its
        deletion. To exercise these rights, or to raise a grievance, email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>

      <h2>7. Children’s data</h2>
      <p>
        Family trees often include children, including those under 13. Where you
        add information about a child, you confirm that you are a parent or
        relative entitled to do so and are responsible for any consent required
        under applicable law. If you believe a child’s data has been added
        without authority, email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a> and
        we will remove it.
      </p>

      <h2>8. How we protect your data</h2>
      <p>
        Each family tree is isolated to its owner and invited editors using
        database Row-Level Security, so one account cannot see another’s data.
        Data is encrypted at rest by our storage provider, and read-only share
        links use hashed, unguessable tokens that you can revoke at any time.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will revise
        the “Last updated” date above. We will communicate material changes
        where appropriate.
      </p>

      <h2>10. Contact</h2>
      <p>
        For any privacy question or request, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(legal)/privacy/page.tsx"
git commit -m "feat(#137): add /privacy policy page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: `/terms` — Terms of Service

**Files:**
- Create: `src/app/(legal)/terms/page.tsx`

- [ ] **Step 1: Write the page (full content — do not abbreviate)**

```tsx
import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Terms of Service · meetthefam',
  description: 'The terms that govern your use of meetthefam.',
}

export default function TermsPage() {
  return (
    <Prose>
      <h1>Terms of Service</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        These Terms of Service (“Terms”) govern your use of meetthefam (“the
        Service”), operated by Sanchit Bhatnagar (an individual). By using the
        Service, you agree to these Terms.
      </p>

      <h2>1. Acceptance and eligibility</h2>
      <p>
        By creating an account or using the Service, you confirm that you can
        form a binding contract and that you will comply with these Terms. If
        you do not agree, do not use the Service.
      </p>

      <h2>2. The service</h2>
      <p>
        meetthefam lets you build private family trees, invite editors, and
        share read-only views with relatives. The Service is provided on an “as
        is” and “as available” basis. We do not guarantee that it will always be
        available, uninterrupted, or error-free, and we may change or
        discontinue features.
      </p>

      <h2>3. Your content and licence</h2>
      <p>
        You retain ownership of everything you add to the Service — names,
        photos, biographies, and relationships (“Your Content”). You grant us a
        limited, non-exclusive licence to store, process, and display Your
        Content solely to operate and provide the Service to you and the people
        you share it with. We claim no ownership of Your Content.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You are responsible for Your Content and for the people with whom you
        share read-only links. You agree not to upload unlawful, infringing, or
        harmful content, not to add another person’s information without a
        legitimate family or personal reason, and not to misuse, disrupt, or
        attempt to gain unauthorized access to the Service.
      </p>

      <h2>5. Disclaimers and limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the Service is provided without
        warranties of any kind. We are not liable for any indirect, incidental,
        or consequential damages, or for loss of data, arising from your use of
        the Service. Our total liability is limited to the amount you have paid
        us, if any, in the twelve months before the claim.
      </p>

      <h2>6. Termination</h2>
      <p>
        You may stop using the Service at any time and delete your trees. We may
        suspend or terminate access if you breach these Terms or to protect the
        Service. On termination, we will delete or anonymize your data in line
        with our Privacy Policy.
      </p>

      <h2>7. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, and the courts of India
        will have exclusive jurisdiction over any dispute arising from them.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will revise
        the “Last updated” date above. Continued use of the Service after
        changes means you accept the updated Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(legal)/terms/page.tsx"
git commit -m "feat(#137): add /terms of service page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: `/contact` — Contact

**Files:**
- Create: `src/app/(legal)/contact/page.tsx`

- [ ] **Step 1: Write the page (full content — do not abbreviate)**

```tsx
import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Contact · meetthefam',
  description: 'How to reach meetthefam for support, privacy, and other requests.',
}

export default function ContactPage() {
  return (
    <Prose>
      <h1>Contact</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        meetthefam is a personal project built and run by one person. The best
        way to reach us is by email.
      </p>
      <p>
        For support, questions, privacy or data-subject requests, and copyright
        or takedown notices, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
      <p>
        We read every message and aim to respond as soon as we reasonably can.
        Because this is a small personal project, please allow a little time for
        a reply.
      </p>
    </Prose>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(legal)/contact/page.tsx"
git commit -m "feat(#137): add /contact page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Full verification + draft PR

**Files:** none (verification + PR only)

- [ ] **Step 1: Run the full local gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: typecheck clean, lint clean, all Vitest tests PASS (including the new Prose + SiteFooter tests), production build succeeds. The build output should list `/privacy`, `/terms`, and `/contact` as routes.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `pnpm dev`, then in a browser open `/privacy`, `/terms`, `/contact`. Confirm: heirloom styling (cream background, serif headings, terracotta links), the logo header links home, the footer shows Privacy · Terms · Contact · Sign in, and the footer links navigate between the three pages. Stop the dev server when done.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/137-legal-pages
```

- [ ] **Step 4: Open a draft PR following the repo template**

Open as a **draft** (`--draft`), targeting `qa`, following `.github/pull_request_template.md` end-to-end. The body MUST contain a bare `Closes #137` line near the top (not markdown-linked, not bold), pre-tick the local-gate boxes that passed in Step 1, and leave the manual / human-reviewer checklist boxes unchecked. Set the milestone to `v1.0 — Launch`. Do NOT mark the PR ready — the human reviewer does that.

```bash
gh pr create --draft --base qa --repo SanchitB23/meetthefam \
  --title "feat(#137): launch-gate legal pages (Privacy, Terms, Contact + footer)" \
  --milestone "v1.0 — Launch" \
  --body-file <(cat <<'BODY'
## Closes

Closes #137

<!-- Fill the rest per .github/pull_request_template.md -->
BODY
)
```

(Compose the full body to match the template before running — the heredoc above only shows the required `Closes #137` placement.)

- [ ] **Step 5: Tick the delivered boxes on the parent umbrella + child issue**

On #137, the scope checkboxes are now all delivered. On #56 (umbrella), no boxes change — the deferred catalog stays open. Leave #56 open; #137 closes automatically when the PR merges.

---

## Self-review notes

- **Spec coverage:** Privacy (Task 5), Terms (Task 6), Contact (Task 7), `<SiteFooter>` + dual-chrome wiring (Tasks 2–3), `<Prose>` A1 (Task 1), `(legal)` route group B1 (Task 4), Vitest footer href guard (Task 2), local-gate verification (Task 8). All spec sections map to a task.
- **Out-of-scope child issues** (DMCA, cookie banner, accessibility, about, security, FAQ, subprocessors, pricing, 404/500, robots/sitemap) are intentionally NOT in this plan — they are filed/queued as sibling children of #56 separately, per the spec.
- **Type/name consistency:** `Prose` and `SiteFooter` named exports are imported identically everywhere they appear (Tasks 4–7 import `Prose`; Tasks 3–4 import `SiteFooter`). The contact email `hello.mtf@sanchitb23.in` is identical across Privacy, Contact, and the footer is unaffected.
- **No production changes:** app-code only; no migrations, no DB, no Vercel config. Ships to local + QA per the pre-v1.0 rule.
