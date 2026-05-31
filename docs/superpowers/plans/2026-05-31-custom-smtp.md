# Custom SMTP (Resend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bypass Supabase's built-in SMTP rate limit by routing auth emails through Resend (Dashboard config) and wiring the collaboration-invite send path to the Resend SDK with a minimal inline HTML body.

**Architecture:** Two integration points, one Resend account, one verified sender domain. Supabase Auth routes magic-link + confirm-signup through `smtp.resend.com` (configured in the Supabase Dashboard — no app code). Collaboration invites send via the `resend` npm SDK from `src/lib/email/inviteEmail.ts`. Local dev is untouched: Mailpit catches auth emails, and `MEETTHEFAM_EMAIL_INVITES_ENABLED` stays unset so invites stay a `console.log` no-op.

**Tech Stack:** Next.js 16 Server Actions, `resend` SDK, Vitest, Supabase Dashboard SMTP.

**Spec:** `docs/superpowers/specs/2026-05-30-custom-smtp-design.md`
**Issue:** [#25](https://github.com/SanchitB23/meetthefam/issues/25)

---

## Branch

All code tasks land on `feat/25-custom-smtp`, cut from `qa`. The approved spec (currently untracked in the working tree) is committed as the first commit on this branch (Task 1).

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `docs/superpowers/specs/2026-05-30-custom-smtp-design.md` | Approved design spec | Commit (already written, untracked) |
| `package.json` / `pnpm-lock.yaml` | Add `resend` dependency | Modify |
| `src/lib/email/inviteEmail.ts` | Invite send path — flag gate + Resend SDK call + inline HTML body + HTML escaping | Replace stub |
| `src/__tests__/email/inviteEmail.test.ts` | Unit tests for the three branches of `sendInviteEmail` | Create |
| `.env.local.example` | Document the three new env vars | Modify |
| `docs/dev/prod-readiness.md` | §4 — record Resend as chosen provider + sender address | Modify |

The auth-email rate-limit fix itself is **config-only** (Supabase Dashboard) and has no code task — it lives in the "Manual / human steps" section at the end.

---

### Task 0: Create the branded-invite-template follow-up issue

`#25` ships a **minimal inline HTML** invite body. The polished, brand-aligned invite template (a proper React Email component reusing the heirloom palette + layout primitives from `#61`) is a separate enhancement to be picked up **once `#25` is closed**. Create the follow-up issue now so the deferred scope is tracked and linked.

**Files:** none (GitHub operation).

- [ ] **Step 1: Create the follow-up issue**

```bash
gh issue create \
  --repo SanchitB23/meetthefam \
  --title "Branded invite email template — React Email component (follow-up to #61 / #25)" \
  --label enhancement \
  --label auth \
  --milestone "v1.1 — Post-launch polish" \
  --body "## Context

Follow-up to #61 (auth email template family: magic-link + confirm-signup) and #25 (custom SMTP / Resend).

#25 wired the collaboration-invite send path to the Resend SDK using a **minimal inline HTML body** (\`buildInviteHtml\` in \`src/lib/email/inviteEmail.ts\`) — deliberately plain, just enough to ship the rate-limit workaround. This issue polishes that into a proper, brand-aligned template that matches the auth emails.

## Pick-up gate

**Pick this up once #25 is closed.** It depends on the Resend send path landing first.

## What good looks like

- New \`emails/invite.tsx\` React Email component reusing \`emails/theme.ts\` (heirloom palette + font stacks) and the layout pattern from \`emails/components/AuthEmailLayout.tsx\` (the auth layout is auth-specific — extract/adapt a shared primitive if it makes sense, or author an invite-specific layout).
- Heirloom wordmark header, greeting, inviter + tree-name framing copy, a real CTA button to the invite URL, plaintext fallback link, terracotta footer rule.
- Export pipeline: wire it into \`scripts/build-emails.ts\` if a committed HTML artifact is wanted, OR render on demand via \`@react-email/render\` inside \`sendInviteEmail\`.
- Replace the inline \`buildInviteHtml\` string in \`src/lib/email/inviteEmail.ts\` with the rendered component; keep HTML-escaping guarantees.
- Update the \`sendInviteEmail\` unit tests to assert against the new render path.

## References

- #61 — auth email template family (closed)
- #25 — custom SMTP / Resend (the inline-HTML invite body lands here)
- \`docs/superpowers/specs/2026-05-30-custom-smtp-design.md\` — marks this as the deferred follow-up
- \`emails/\`, \`docs/dev/email-templates.md\` — authoring recipe"
```

Expected: prints the new issue URL. **Capture the issue number** — reference it in the `#25` PR body ("follow-up: #NN tracks the branded invite template") and in the spec's out-of-scope note if convenient.

> If the `v1.1 — Post-launch polish` milestone title differs at execution time, run `gh api repos/SanchitB23/meetthefam/milestones --jq '.[].title'` to get the exact string, or drop `--milestone` and set it in the UI.

---

### Task 1: Branch + commit the approved spec & plan

**Files:**
- Commit: `docs/superpowers/specs/2026-05-30-custom-smtp-design.md` (untracked, already written)
- Commit: `docs/superpowers/plans/2026-05-31-custom-smtp.md` (this plan, untracked, already written)

- [ ] **Step 1: Confirm the branch**

This plan executes on `feat/25-custom-smtp` (cut from `qa`, ideally in a git worktree per the project convention). If the worktree/branch was created by `superpowers:using-git-worktrees`, verify you're on it:

Run: `git branch --show-current`
Expected: `feat/25-custom-smtp`

> **Note:** both `docs/superpowers/plans/` and `docs/superpowers/specs/` are already advertised in CLAUDE.md "Where to look first", so adding files inside them needs no CLAUDE.md edit.

- [ ] **Step 2: Commit the spec + plan**

```bash
git add docs/superpowers/specs/2026-05-30-custom-smtp-design.md \
        docs/superpowers/plans/2026-05-31-custom-smtp.md
git commit -m "docs(#25): add custom SMTP design spec + implementation plan

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add the `resend` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install resend as a production dependency**

Run: `pnpm add resend`
Expected: `resend` appears under `dependencies` in `package.json`; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(#25): add resend dependency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Implement `sendInviteEmail` (TDD)

The current `src/lib/email/inviteEmail.ts` is a flag-gated stub that throws `'Email delivery not yet implemented'`. Replace it with a real Resend SDK call that:
- keeps the existing flag gate (`MEETTHEFAM_EMAIL_INVITES_ENABLED !== 'true'` → `console.log` no-op),
- builds a minimal, escaped, table-based HTML body inline,
- **swallows** send errors (the invite row already exists upstream; a delivery failure must not roll back invite creation — the owner can still copy the invite URL),
- lazily constructs the `Resend` client *after* the flag check so local dev never needs `RESEND_API_KEY`.

**Files:**
- Create: `src/__tests__/email/inviteEmail.test.ts`
- Modify: `src/lib/email/inviteEmail.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/email/inviteEmail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the resend module BEFORE importing the unit under test.
const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}))

import { sendInviteEmail } from '@/lib/email/inviteEmail'

const PAYLOAD = {
  email: 'editor@example.com',
  inviteUrl: 'https://meetthefam.com/invite/tok_abc123',
  treeName: 'The Smith Family',
  invitedByName: 'Jane Smith',
}

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'eml_1' }, error: null })
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply-mtf@sanchitb23.in')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendInviteEmail', () => {
  it('does NOT send when the flag is unset', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', '')
    await sendInviteEmail(PAYLOAD)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends via Resend with the right envelope when the flag is on', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    await sendInviteEmail(PAYLOAD)

    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.from).toBe('noreply-mtf@sanchitb23.in')
    expect(arg.to).toBe('editor@example.com')
    expect(arg.subject).toContain('Jane Smith')
    expect(arg.html).toContain('https://meetthefam.com/invite/tok_abc123')
    expect(arg.html).toContain('The Smith Family')
    expect(arg.html).toContain('Jane Smith')
  })

  it('escapes HTML-significant characters in user-supplied fields', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    await sendInviteEmail({
      ...PAYLOAD,
      treeName: 'Smith & <Sons>',
      invitedByName: 'Bobby "Tables"',
    })
    const html = sendMock.mock.calls[0][0].html as string
    expect(html).toContain('Smith &amp; &lt;Sons&gt;')
    expect(html).toContain('Bobby &quot;Tables&quot;')
    expect(html).not.toContain('<Sons>')
  })

  it('swallows send failures (does not reject) so invite creation is not rolled back', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    sendMock.mockRejectedValueOnce(new Error('Resend down'))
    await expect(sendInviteEmail(PAYLOAD)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- src/__tests__/email/inviteEmail.test.ts`
Expected: FAIL — the current implementation throws `'Email delivery not yet implemented'` on the flag-on cases and never calls `sendMock`.

- [ ] **Step 3: Implement the new `inviteEmail.ts`**

Replace the entire contents of `src/lib/email/inviteEmail.ts` with:

```ts
import { Resend } from 'resend'

type InvitePayload = {
  email: string
  inviteUrl: string
  treeName: string
  invitedByName: string
}

/** Escape the five HTML-significant characters for safe interpolation into the body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Minimal, table-based invite body. Deliberately plain — a brand-aligned
 * template (heirloom palette, like the auth emails) is deferred to a
 * follow-up ticket. All user-supplied fields are HTML-escaped.
 */
function buildInviteHtml(invite: InvitePayload): string {
  const treeName = escapeHtml(invite.treeName)
  const invitedByName = escapeHtml(invite.invitedByName)
  const inviteUrl = escapeHtml(invite.inviteUrl)
  return `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #2E2A24; background-color: #F5EFE3; margin: 0; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px;">
            <tr>
              <td style="background-color: #FFFCF5; border: 1px solid #E3DBCB; border-radius: 16px; padding: 40px;">
                <h1 style="color: #2D4A3E; font-size: 24px; margin: 0 0 16px;">You're invited to a family tree</h1>
                <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  ${invitedByName} invited you to help build <strong>${treeName}</strong> on meetthefam.
                </p>
                <a href="${inviteUrl}" style="display: inline-block; background-color: #2D4A3E; color: #FFFCF5; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 24px; border-radius: 12px;">
                  Accept invitation
                </a>
                <p style="font-size: 13px; line-height: 1.55; color: #6B6358; margin: 24px 0 0;">
                  Or paste this link into your browser:<br />
                  <a href="${inviteUrl}" style="color: #2D4A3E; word-break: break-all;">${inviteUrl}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendInviteEmail(invite: InvitePayload): Promise<void> {
  if (process.env.MEETTHEFAM_EMAIL_INVITES_ENABLED !== 'true') {
    console.log(
      '[invite-email] disabled by flag; would have sent to',
      invite.email,
      invite.inviteUrl,
    )
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: invite.email,
      subject: `${invite.invitedByName} invited you to their family tree on meetthefam`,
      html: buildInviteHtml(invite),
    })
  } catch (err) {
    // The invite row already exists upstream; a delivery failure must not
    // roll back invite creation. Log and swallow — the owner can copy the
    // invite URL from the members sheet.
    console.error('[invite-email] send failed for', invite.email, err)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- src/__tests__/email/inviteEmail.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Run the existing invite-action test to confirm no regression**

Run: `pnpm test -- src/__tests__/actions/inviteEditor.test.ts`
Expected: PASS — that test mocks `@/lib/email/inviteEmail` so it's unaffected, but confirm the call site still typechecks against the unchanged `InvitePayload` shape.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/email/inviteEmail.ts src/__tests__/email/inviteEmail.test.ts
git commit -m "feat(#25): wire invite email send path to Resend SDK

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Document the new environment variables

`.env.local.example` is missing both `MEETTHEFAM_EMAIL_INVITES_ENABLED` and the two new Resend vars. Add a documented block.

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Append the email block to `.env.local.example`**

Add this block to the end of `.env.local.example`:

```bash
# ─── Email delivery (Resend) ───────────────────────────────────────────
# Custom SMTP / invite delivery. See docs/superpowers/specs/2026-05-30-custom-smtp-design.md.
#
# AUTH emails (magic-link, confirm-signup) do NOT use these vars — they are
# configured in the Supabase Dashboard (Auth → SMTP Settings) for QA/prod,
# and caught by Mailpit (:54324) locally. These vars only drive the
# collaboration-invite send path in src/lib/email/inviteEmail.ts.
#
# Server-only — NEVER prefix with NEXT_PUBLIC_.
# Resend API key (https://resend.com → API Keys). Leave blank locally unless
# you are explicitly testing invite delivery with the flag flipped on.
RESEND_API_KEY=
# Verified sender address (Resend → Domains). Production value:
RESEND_FROM_EMAIL=noreply-mtf@sanchitb23.in
# Set to "true" to actually send invite emails. Unset/anything-else = the
# invite path is a console.log no-op (the default for local dev).
MEETTHEFAM_EMAIL_INVITES_ENABLED=
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs(#25): document Resend env vars in .env.local.example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update the prod-readiness checklist

`docs/dev/prod-readiness.md` §4 already tracks custom SMTP but lists Resend only as "recommended" and references the old stub. Lock in Resend + the chosen sender address, and note the inline-HTML decision.

**Files:**
- Modify: `docs/dev/prod-readiness.md`

- [ ] **Step 1: Update §4's first bullet**

Find:

```markdown
- [ ] Provider chosen (Resend recommended for Next.js / Supabase compat); account created.
```

Replace with:

```markdown
- [ ] Provider chosen: **Resend** (locked in #25). Account created; sender `noreply-mtf@sanchitb23.in` on domain `sanchitb23.in`.
```

- [ ] **Step 2: Update the stub-removal bullet**

Find:

```markdown
- [ ] `src/lib/email/inviteEmail.ts`'s flag-gated path actually sends via the provider's SDK. Drop the `throw new Error('Email delivery not yet implemented')` line.
```

Replace with:

```markdown
- [x] `src/lib/email/inviteEmail.ts` sends via the Resend SDK (minimal inline HTML body; rich branded invite template deferred to a follow-up ticket). Stub `throw` removed in #25. Flip `MEETTHEFAM_EMAIL_INVITES_ENABLED=true` per environment once SMTP is verified.
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev/prod-readiness.md
git commit -m "docs(#25): lock Resend as SMTP provider in prod-readiness checklist

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Open the PR

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feat/25-custom-smtp`

- [ ] **Step 2: Open a draft PR into `qa`**

Open as a **draft** (project convention — the user marks it ready). Follow `.github/pull_request_template.md` end-to-end. The PR body MUST include a bare `Closes #25` line (markdown-link or bold-list syntax does NOT trigger auto-close). Pre-tick the local gates (`pnpm typecheck && pnpm lint && pnpm test`); leave the manual/human-step checklist boxes (Resend account, DNS, Dashboard SMTP, smoke-test) unticked for the human reviewer.

```bash
gh pr create --draft --base qa \
  --title "feat(#25): custom SMTP via Resend (invite send path + auth-email config)" \
  --body "<filled from .github/pull_request_template.md, including 'Closes #25'>"
```

---

## Manual / human steps (needs-human — NOT agent-executable)

These complete the rate-limit fix and turn on real sending. They are config/dashboard/DNS steps; document them in the PR but a human performs them.

**One-time Resend setup**
1. Create a Resend account.
2. Resend → Domains → Add Domain: `sanchitb23.in`.
3. Add the SPF, DKIM, DMARC DNS records Resend generates, in the registrar for `sanchitb23.in`.
4. Wait for domain verification (usually minutes).
5. Resend → API Keys → generate a sending key.

**QA wiring**
6. Supabase Dashboard (QA project `ljjv…`) → Auth → SMTP Settings:
   - Host `smtp.resend.com` · Port `465` · Username `resend` · Password `<API key>`
   - Sender name `meetthefam` · Sender email `noreply-mtf@sanchitb23.in`
7. Vercel (QA scope) env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply-mtf@sanchitb23.in`, `MEETTHEFAM_EMAIL_INVITES_ENABLED=true`.
8. Smoke-test on QA: trigger a magic-link from `/login` → confirm it arrives from `noreply-mtf@sanchitb23.in` (not `noreply@mail.app.supabase.io`); send a collaboration invite → confirm the invite email arrives.

**Prod wiring (deferred to the v1.0 launch batch — `docs/dev/prod-readiness.md` policy)**
9. Repeat steps 6–8 against the prod Supabase project (`ycns…`) + Vercel prod scope.
10. Add `RESEND_API_KEY` to the pre-prod key-rotation checklist (`project_pre_prod_key_rotation.md`).

---

## Self-Review notes

- **Spec coverage:** auth-email SMTP wiring → Manual steps §6–9; invite SDK wiring → Task 3; `resend` dep → Task 2; env vars → Task 4; sender domain/address → spec + Manual steps; prod deferral → Task 5 + Manual steps. All spec sections map to a task.
- **Decision recorded:** invite body is minimal inline HTML (per the 2026-05-31 scope call), not a React Email component — Task 3 implements `buildInviteHtml` inline with HTML escaping; spec updated to match.
- **No phantom references:** `buildInviteHtml`, `escapeHtml`, `InvitePayload`, and `sendInviteEmail` are all defined in Task 3. No dependency on a nonexistent `emails/invite.tsx`.
