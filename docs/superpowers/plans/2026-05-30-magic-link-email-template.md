# Magic-Link + Confirm-Signup Auth Email Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship branded, heirloom-palette Supabase Auth emails (Magic Link + Confirm Signup) authored in React Email and exported to committed static HTML, wired into the local stack + QA (prod deferred to v1.0).

**Architecture:** Two thin variant components share one `AuthEmailLayout` (React Email). A `tsx` build script renders them to `supabase/templates/*.html`, replacing a URL sentinel with Supabase's `{{ .ConfirmationURL }}` token. A Vitest test guards that the committed HTML matches a fresh render (drift) and contains the token/CTA/fallback. `config.toml` points the local stack at the HTML; QA upload is manual; prod is deferred.

**Tech Stack:** React 19 + `@react-email/components` + `@react-email/render` (dev-only), `tsx` runner, Vitest 4, Supabase CLI (Mailpit at `:54324`).

**Spec:** [`docs/superpowers/specs/2026-05-30-magic-link-email-template-design.md`](../specs/2026-05-30-magic-link-email-template-design.md)
**Visual reference:** [`docs/ux/auth-email-wireframe.html`](../../ux/auth-email-wireframe.html)
**Issue:** [#61](https://github.com/SanchitB23/meetthefam/issues/61) · **Branch:** `feat/61-magic-link-email-template` (already cut; spec + wireframe committed)

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | modify | Add dev deps (`@react-email/components`, `@react-email/render`, `tsx`), `emails:build` script, esbuild build-whitelist |
| `emails/theme.ts` | create | Email-safe hex palette + font stacks + the URL sentinel constant |
| `emails/components/AuthEmailLayout.tsx` | create | Shared layout (wordmark → card → CTA → fallback → security → footer) |
| `emails/magic-link.tsx` | create | Magic-link variant copy |
| `emails/confirm-signup.tsx` | create | Confirm-signup variant copy |
| `scripts/build-emails.ts` | create | Render variants → `supabase/templates/*.html` (sentinel→token); exports helpers for tests |
| `supabase/templates/magic_link.html` | create (generated) | Committed export |
| `supabase/templates/confirm_signup.html` | create (generated) | Committed export |
| `supabase/config.toml` | modify | `[auth.email.template.magic_link]` + `[auth.email.template.confirmation]` |
| `src/__tests__/emails/templates.test.ts` | create | Drift + content guard |
| `docs/dev/email-templates.md` | create | Authoring + upload recipe |
| `docs/dev/prod-readiness.md` | modify | §3 — queue the two template uploads for the v1.0 batch |

---

## Task 1: Add dependencies + build tooling

**Files:** `package.json`

- [ ] **Step 1: Add the dev dependencies**

```bash
pnpm add -D @react-email/components @react-email/render tsx
```

- [ ] **Step 2: Ensure esbuild's postinstall is allowed (pnpm 10 strict policy)**

`tsx` and Vitest use `esbuild`, whose postinstall fetches its platform binary. pnpm 10 skips unwhitelisted install scripts. Verify the runner works:

```bash
pnpm tsx --version
```

If that errors about a missing esbuild binary, add `esbuild` to the whitelist in `package.json` and rebuild:

```jsonc
// package.json → "pnpm"
"onlyBuiltDependencies": ["supabase", "esbuild"]
```

```bash
pnpm rebuild esbuild && pnpm tsx --version
```

Expected: prints a tsx version (e.g. `tsx v4.x`). If it already worked, leave `onlyBuiltDependencies` as-is.

- [ ] **Step 3: Add the `emails:build` script**

In `package.json` `"scripts"`, add:

```json
"emails:build": "tsx scripts/build-emails.ts"
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(#61): add react-email + tsx tooling for auth email templates

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Theme constants + shared layout

**Files:** `emails/theme.ts`, `emails/components/AuthEmailLayout.tsx`

- [ ] **Step 1: Create `emails/theme.ts`**

```ts
// Email-safe hex (translated from the OKLCH tokens in src/app/globals.css).
// Mail clients don't support OKLCH or CSS variables — these are literal hex,
// inlined into every element by React Email at render time.
export const colors = {
  bg: '#F5EFE3', // cream page background
  paper: '#FFFCF5', // card surface
  ink: '#2E2A24', // body text (warm charcoal)
  green: '#2D4A3E', // forest — wordmark + CTA fill
  onDark: '#FFFCF5', // text on the green button
  terracotta: '#C77B5C', // footer rule accent
  muted: '#6B6358', // hints, fallback link, footer
  hairline: '#E3DBCB', // borders / soft divider
} as const

// Web fonts are unreliable in mail clients, so these stacks lead with the
// brand fonts but always fall back to a system serif / sans. We do NOT add a
// <Font> / Google Fonts <link> — the fallback is the real renderer.
export const fonts = {
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
} as const

// Build-time placeholder. React Email can mangle hrefs containing `{{ }}` and
// spaces, so we render with this real-looking URL and string-replace it with
// the Supabase token in the build script (see scripts/build-emails.ts).
export const CONFIRMATION_URL_SENTINEL = 'https://confirmation-url.placeholder'
```

- [ ] **Step 2: Create `emails/components/AuthEmailLayout.tsx`**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { colors, fonts } from '../theme'

export interface AuthEmailProps {
  previewText: string
  headline: string
  framing: string
  ctaLabel: string
  confirmationUrl: string
}

export function AuthEmailLayout({
  previewText,
  headline,
  framing,
  ctaLabel,
  confirmationUrl,
}: AuthEmailProps) {
  return (
    <Html lang="en">
      <Head>
        {/* Signal that the email supports both schemes; we rely on the client's
            auto dark mode rather than manual overrides — inline styles win over
            any <style> block, so class-based dark overrides cannot apply. */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ textAlign: 'center', marginBottom: '18px' }}>
            <Text style={wordmark}>meetthefam</Text>
          </Section>

          <Section style={card}>
            <Heading as="h1" style={headlineStyle}>
              {headline}
            </Heading>
            <Text style={greeting}>Hi there,</Text>
            <Text style={framingStyle}>{framing}</Text>

            <Button href={confirmationUrl} style={cta}>
              {ctaLabel}
            </Button>

            <Text style={fallback}>
              Or paste this link into your browser:
              <br />
              <Link href={confirmationUrl} style={fallbackLink}>
                {confirmationUrl}
              </Link>
            </Text>

            <Hr style={dividerSoft} />

            <Text style={security}>
              This link expires in 60 minutes and can only be used once. If you didn&apos;t
              request it, you can safely ignore this email.
            </Text>
          </Section>

          <Section style={footer}>
            <Hr style={footerRule} />
            <Text style={footerMark}>meetthefam</Text>
            <Text style={footerContact}>
              <Link href="https://meetthefam.com" style={footerLink}>
                meetthefam.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---- styles (px values from docs/ux/auth-email-wireframe.html) ----
const body: React.CSSProperties = {
  backgroundColor: colors.bg,
  margin: 0,
  padding: '32px 12px 40px',
  fontFamily: fonts.sans,
  color: colors.ink,
}
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto' }
const wordmark: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '30px',
  color: colors.green,
  margin: 0,
}
const card: React.CSSProperties = {
  backgroundColor: colors.paper,
  border: `1px solid ${colors.hairline}`,
  borderRadius: '16px',
  padding: '44px 40px 40px',
}
const headlineStyle: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '38px',
  lineHeight: '1.08',
  color: colors.green,
  margin: '0 0 18px',
}
const greeting: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: '1.6',
  color: colors.ink,
  margin: '0 0 10px',
}
const framingStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.62',
  color: colors.ink,
  margin: '0 0 30px',
}
const cta: React.CSSProperties = {
  display: 'block',
  backgroundColor: colors.green,
  color: colors.onDark,
  textDecoration: 'none',
  textAlign: 'center',
  fontFamily: fonts.sans,
  fontWeight: 600,
  fontSize: '16px',
  padding: '16px 24px',
  borderRadius: '12px',
  lineHeight: '20px', // 16 + 16 + 20 = 52px tall
}
const fallback: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.55',
  color: colors.muted,
  margin: '22px 0 0',
}
const fallbackLink: React.CSSProperties = {
  color: colors.green,
  wordBreak: 'break-all',
  textDecoration: 'underline',
}
const dividerSoft: React.CSSProperties = {
  borderColor: colors.hairline,
  borderStyle: 'solid',
  borderWidth: '1px 0 0',
  margin: '30px 0 22px',
}
const security: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.6',
  color: colors.muted,
  margin: 0,
}
const footer: React.CSSProperties = { padding: '0 8px', marginTop: '28px' }
const footerRule: React.CSSProperties = {
  borderColor: colors.terracotta,
  borderStyle: 'solid',
  borderWidth: '2px 0 0',
  width: '44px',
  margin: '0 auto 18px',
}
const footerMark: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '17px',
  color: colors.green,
  textAlign: 'center',
  margin: '0 0 6px',
}
const footerContact: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: colors.muted,
  textAlign: 'center',
  margin: 0,
}
const footerLink: React.CSSProperties = { color: colors.muted, textDecoration: 'underline' }
```

> **Note on the lock icon:** the wireframe shows a small lock SVG before the security text. Inline SVG is stripped by Gmail/Outlook, so it's omitted here (decorative only) — the security copy stands alone. If a later pass wants it, add it as a hosted PNG, not SVG.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean (no type errors in `emails/`).

- [ ] **Step 4: Commit**

```bash
git add emails/theme.ts emails/components/AuthEmailLayout.tsx
git commit -m "feat(#61): shared AuthEmailLayout + email theme constants

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: The two variant templates

**Files:** `emails/magic-link.tsx`, `emails/confirm-signup.tsx`

- [ ] **Step 1: Create `emails/magic-link.tsx`**

```tsx
import * as React from 'react'
import { AuthEmailLayout } from './components/AuthEmailLayout'
import { CONFIRMATION_URL_SENTINEL } from './theme'

export function MagicLinkEmail({
  confirmationUrl = CONFIRMATION_URL_SENTINEL,
}: { confirmationUrl?: string } = {}) {
  return (
    <AuthEmailLayout
      previewText="Your secure sign-in link — expires in 60 minutes."
      headline="Your sign-in link"
      framing="Welcome back. Click below to get straight into your family tree — no password needed."
      ctaLabel="Sign in to meetthefam"
      confirmationUrl={confirmationUrl}
    />
  )
}

export default MagicLinkEmail
```

- [ ] **Step 2: Create `emails/confirm-signup.tsx`**

```tsx
import * as React from 'react'
import { AuthEmailLayout } from './components/AuthEmailLayout'
import { CONFIRMATION_URL_SENTINEL } from './theme'

export function ConfirmSignupEmail({
  confirmationUrl = CONFIRMATION_URL_SENTINEL,
}: { confirmationUrl?: string } = {}) {
  return (
    <AuthEmailLayout
      previewText="Confirm your email to start your family tree."
      headline="Welcome to meetthefam"
      framing="We're so glad you're here. Confirm your email below and we'll get you into your family tree."
      ctaLabel="Confirm your email"
      confirmationUrl={confirmationUrl}
    />
  )
}

export default ConfirmSignupEmail
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add emails/magic-link.tsx emails/confirm-signup.tsx
git commit -m "feat(#61): magic-link + confirm-signup email variants

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Build script + generate committed HTML

**Files:** `scripts/build-emails.ts`, `supabase/templates/magic_link.html`, `supabase/templates/confirm_signup.html`

- [ ] **Step 1: Create `scripts/build-emails.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@react-email/render'
import * as React from 'react'
import { ConfirmSignupEmail } from '../emails/confirm-signup'
import { MagicLinkEmail } from '../emails/magic-link'
import { CONFIRMATION_URL_SENTINEL } from '../emails/theme'

const SUPABASE_TOKEN = '{{ .ConfirmationURL }}'
const OUT_DIR = join(process.cwd(), 'supabase', 'templates')

export const TEMPLATES = [
  { file: 'magic_link.html', element: () => React.createElement(MagicLinkEmail) },
  { file: 'confirm_signup.html', element: () => React.createElement(ConfirmSignupEmail) },
] as const

/** Render a template and swap the URL sentinel for the Supabase Go-template token. */
export async function renderTemplate(element: React.ReactElement): Promise<string> {
  const html = await render(element, { pretty: true })
  return html.split(CONFIRMATION_URL_SENTINEL).join(SUPABASE_TOKEN)
}

export async function buildAll(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const t of TEMPLATES) {
    const html = await renderTemplate(t.element())
    writeFileSync(join(OUT_DIR, t.file), html)
    // eslint-disable-next-line no-console
    console.log('wrote', join('supabase/templates', t.file))
  }
}

// Only build when executed directly (not when imported by the test).
if (process.argv[1]?.endsWith('build-emails.ts')) {
  buildAll()
}
```

- [ ] **Step 2: Generate the HTML**

Run: `pnpm emails:build`
Expected: prints `wrote supabase/templates/magic_link.html` and `wrote supabase/templates/confirm_signup.html`.

- [ ] **Step 3: Eyeball the generated HTML for the token**

```bash
grep -c '{{ .ConfirmationURL }}' supabase/templates/magic_link.html supabase/templates/confirm_signup.html
```

Expected: each file reports `2` (the CTA `href` + the fallback link). If `0`, React mangled the sentinel — confirm `CONFIRMATION_URL_SENTINEL` is a plain `https://…` URL with no braces/spaces.

- [ ] **Step 4: Commit (script + generated HTML together)**

```bash
git add scripts/build-emails.ts supabase/templates/magic_link.html supabase/templates/confirm_signup.html
git commit -m "feat(#61): render script + generated magic_link / confirm_signup HTML

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Vitest drift + content guard

**Files:** `src/__tests__/emails/templates.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { ConfirmSignupEmail } from '../../../emails/confirm-signup'
import { MagicLinkEmail } from '../../../emails/magic-link'
import { renderTemplate, TEMPLATES } from '../../../scripts/build-emails'

describe('auth email templates', () => {
  it.each(TEMPLATES)('committed $file matches a fresh render (run `pnpm emails:build`)', async (t) => {
    const fresh = await renderTemplate(t.element())
    const committed = readFileSync(join(process.cwd(), 'supabase/templates', t.file), 'utf8')
    expect(committed).toBe(fresh)
  })

  it('magic_link carries the token, CTA, fallback, security copy, footer', async () => {
    const html = await renderTemplate(React.createElement(MagicLinkEmail))
    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(html).toContain('Sign in to meetthefam')
    expect(html).toContain('expires in 60 minutes')
    expect(html).toContain('meetthefam.com')
  })

  it('confirm_signup carries the token, CTA, welcome copy', async () => {
    const html = await renderTemplate(React.createElement(ConfirmSignupEmail))
    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(html).toContain('Confirm your email')
    expect(html).toContain('Welcome to meetthefam')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm test -- src/__tests__/emails/templates.test.ts`
Expected: PASS (3 cases). If the drift case fails, you edited a template without re-running `pnpm emails:build` — rebuild and re-commit the HTML.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/emails/templates.test.ts
git commit -m "test(#61): drift + content guard for auth email templates

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Wire config.toml + verify locally in Mailpit

**Files:** `supabase/config.toml`

- [ ] **Step 1: Replace the commented `invite` template block**

Find (around lines 242–244):

```toml
# Uncomment to customize email template
# [auth.email.template.invite]
# subject = "You have been invited"
# content_path = "./supabase/templates/invite.html"
```

Replace with:

```toml
# Branded auth email templates (authored in emails/, exported via `pnpm emails:build`).
[auth.email.template.magic_link]
subject = "Your meetthefam sign-in link"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.confirmation]
subject = "Welcome to meetthefam — confirm your email"
content_path = "./supabase/templates/confirm_signup.html"
```

- [ ] **Step 2: Restart the local stack so it picks up the templates**

```bash
pnpm exec supabase stop && pnpm exec supabase start
```

Expected: stack boots; Mailpit at `http://localhost:54324`.

- [ ] **Step 3: Trigger an email and verify in Mailpit (manual)**

Run `pnpm dev`, open `/login`, submit an email. Open `http://localhost:54324`:
- Confirm the captured email shows the branded template (forest wordmark, headline, green CTA button, fallback link, security line, terracotta footer rule, `meetthefam.com`).
- Test **both** paths: a brand-new email (→ Confirm-signup template) and an existing one (→ Magic-link template). Note: local `enable_confirmations = false` may route new users to the magic-link template — toggling it to `true` (then restart) forces the confirmation path for verification.
- Screenshot light + the client's dark mode.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(#61): wire branded magic_link + confirmation templates in config.toml

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Docs — authoring recipe + prod-readiness queue

**Files:** `docs/dev/email-templates.md`, `docs/dev/prod-readiness.md`

- [ ] **Step 1: Create `docs/dev/email-templates.md`**

```markdown
# Email templates

Branded transactional emails for meetthefam, authored in **React Email** and exported to static HTML that Supabase Auth consumes.

## Where things live

- **Source** (`emails/`): `theme.ts` (palette + fonts + URL sentinel), `components/AuthEmailLayout.tsx` (shared layout), `magic-link.tsx`, `confirm-signup.tsx`.
- **Exported HTML** (`supabase/templates/`): `magic_link.html`, `confirm_signup.html` — generated, committed.
- **Wiring**: `supabase/config.toml` → `[auth.email.template.magic_link]` + `[auth.email.template.confirmation]`.
- **Guard**: `src/__tests__/emails/templates.test.ts` fails if the committed HTML drifts from the source.

## Authoring recipe

1. Edit the JSX in `emails/`.
2. Regenerate: `pnpm emails:build`.
3. Verify locally: restart the stack (`pnpm exec supabase stop && pnpm exec supabase start`), trigger an email via `/login`, inspect at Mailpit `http://localhost:54324` (check both the new-user *Confirm signup* and returning-user *Magic Link* paths).
4. `pnpm test -- src/__tests__/emails/templates.test.ts` (drift + content guard).
5. **QA**: upload the HTML via Supabase Dashboard → Authentication → Email Templates.
6. **Prod**: deferred to the v1.0 launch batch — see `prod-readiness.md` §3.

## Constraints (why it's built this way)

- The CTA href uses a URL **sentinel** (`emails/theme.ts`) that the build script swaps for Supabase's `{{ .ConfirmationURL }}` — avoids React mangling a brace/space href.
- **No web fonts** — the serif/sans stacks fall back to Georgia / system sans (mail clients drop web fonts).
- **Dark mode is best-effort** — inline styles beat `<style>`, so we only signal `color-scheme` and rely on client auto-dark; we don't ship manual dark overrides.
- The future collaboration-invite (#25) and share-link emails should reuse `AuthEmailLayout`.
```

- [ ] **Step 2: Queue the prod uploads in `prod-readiness.md` §3 (Auth)**

Open `docs/dev/prod-readiness.md`, find the §3 Auth section, and add a checklist line:

```markdown
- [ ] Upload branded auth email templates to prod Supabase → Auth → Email Templates: `supabase/templates/magic_link.html` (Magic Link) + `supabase/templates/confirm_signup.html` (Confirm signup). Source: issue #61.
```

(If §3 has a different exact heading, add the line under the Auth/email-templates subsection; match the surrounding checkbox style.)

- [ ] **Step 3: Commit**

```bash
git add docs/dev/email-templates.md docs/dev/prod-readiness.md
git commit -m "docs(#61): email-template authoring recipe + queue prod upload in prod-readiness

Refs #61

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Final gates + draft PR

**Files:** none (verification + PR)

- [ ] **Step 1: Full gates**

```bash
pnpm emails:build   # ensure HTML is current
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all clean; `git status` shows no uncommitted change to `supabase/templates/*.html` (if it does, the source changed without a rebuild — commit the regenerated HTML). Leave the unrelated `src/lib/generated/version.ts` change unstaged.

- [ ] **Step 2: Push**

```bash
git push -u origin feat/61-magic-link-email-template
```

- [ ] **Step 3: Open a DRAFT PR closing #61**

Use `gh pr create --draft --base qa`, body following `.github/pull_request_template.md`, with a `## Closes` section near the top containing `Closes #61` and the `v1.0 — Launch` milestone set. Summarize: branded magic_link + confirmation templates (React Email → committed HTML), config wiring, drift test, docs, prod upload queued. Pre-tick the local gates; leave the manual Mailpit/real-client checklist boxes for the human reviewer. Attach the light + dark Mailpit screenshots from Task 6. Do **not** mark ready — the user does that.

---

## Self-review notes (plan author)

- **Spec coverage:** D1 scope → Tasks 2–4 (both templates, shared layout). D2 authoring → Tasks 1, 4. D3 content/palette → Task 2 (+ wireframe values). D4 wiring → Task 6 (local), Task 7 (prod queue), QA upload in docs/PR. D5 verification → Tasks 5 (automated) + 6 (Mailpit) + 8/PR (real-client, human). D6 docs → Task 7. Greeting-nameless + footer-site-link → baked into Task 2 code.
- **Token handling** (`{{ .ConfirmationURL }}`) uses the sentinel-replace pattern; the Task 4 grep + Task 5 test both guard it.
- **Dark mode** deliberately limited to `color-scheme` signaling (inline styles can't be overridden by `<style>`); recorded in the docs.
- **No `src/` runtime code** changes — `emails/` + `scripts/` are build-time only; the app bundle is untouched.
- **Type/name consistency:** `AuthEmailProps`, `AuthEmailLayout`, `MagicLinkEmail`/`ConfirmSignupEmail` (optional `confirmationUrl`), `renderTemplate`/`TEMPLATES`/`buildAll`, `CONFIRMATION_URL_SENTINEL` — consistent across Tasks 2–5.
