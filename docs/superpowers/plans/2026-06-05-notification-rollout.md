# Notification System Rollout Implementation Plan (#211)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every notification-worthy Server-Action outcome to the right surface (toast / inline / banner) per spec §6, building on the prototype infra already on this branch.

**Architecture:** One `notify` API (already shipped) with two call-site adapters — imperative `await`→toast for most call sites, `useToastOnResult` for the `useActionState` dashboard trio. A `<ToastFromSearchParams>` client component bridges auth/redirect actions. RLS `forbidden` raises a page-level access-lost banner + dashboard redirect. Mid-form validation stays in the existing inline `ErrorAlert`.

**Tech Stack:** Next.js 16 App Router, React 19, sonner 2.0.7, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-notification-system-design.md` (§6 catalogue). **Issue:** #211.

**Pre-seeded (cherry-picked from `spike/70-notification-system`):** `src/lib/toast/notify.ts` (+test), `src/lib/toast/useToastOnResult.ts` (+test), `src/components/ui/Toaster.tsx` mounted in `src/app/layout.tsx`, sonner dep, `createPerson` toasts in `PersonForm.tsx`.

---

## Product decisions (locked)
- `updatePerson` success → subtle **"Saved"** toast.
- Clipboard copies (invite/resend/share) → **"Copied to clipboard"** success toast (in addition to the existing Check-icon swap).
- `uploadPersonPhoto` **edit mode** → keep the existing in-modal success banner (#185); **no toast**. Toast only the **create-mode** photo-failure case.
- RLS **`forbidden`** mid-session → **full access-lost banner + dashboard redirect** (new component).

## Conventions for every wiring task
- **Imperative pattern** (most call sites): inside the existing `startTransition(async () => { const res = await action(...); ... })`, on the success branch add `notify.success(...)` (or `.warning`); leave existing inline `ErrorAlert` for mid-form/mid-dialog errors UNLESS the row notes a toast.
- **Copy strings**: use literal copy from the tables below; map error codes via the existing `mapErrorCode` from `@/lib/errors`.
- **Imports**: add `import { notify } from '@/lib/toast/notify'` where missing.
- **Commits**: one per task, `feat(#211): …`, footer `Co-Authored-By: Claude <noreply@anthropic.com>`, body line `Refs #211`. Stage only the files in that task. Never `git add -A`, never `--no-verify`.
- **Gate each task**: `pnpm typecheck && pnpm lint` (Node 24.15.0) before commit; run `pnpm test <file>` for tasks with tests.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/toast/notify.ts` (+test) | Fix `NotifyAction.onClick` type; add `info` test | 1 |
| `src/lib/toast/useToastOnResult.ts` (+test) | Allow `success` as `string \| (state)=>string`; doc memo requirement | 1 |
| `src/app/(app)/dashboard/actions.ts` | Echo `name` from `createTree`/`renameTree` | 2 |
| `src/app/(app)/dashboard/_components/{CreateTreeModal,RenameTreeModal,DeleteTreeDialog}.tsx` | `useToastOnResult` success toasts | 2 |
| `src/app/(app)/tree/[id]/_components/PersonForm.tsx` | `updatePerson` "Saved"; create-mode photo-failure → toast; `removePersonPhoto` | 3 |
| `src/app/(app)/tree/[id]/_components/DeletePersonDialog.tsx` | `deletePerson` success toast | 3 |
| `src/app/(app)/tree/[id]/_components/PersonActionMenu.tsx` | `setSpouse` success; `clearSpouse` result + error toast | 4 |
| `src/app/(app)/tree/[id]/_components/SetParentsDialog.tsx` | `setParents` success | 4 |
| `src/lib/toast/copyWithToast.ts` (+test) | Clipboard helper firing "Copied to clipboard" | 5 |
| `src/app/(app)/tree/[id]/_components/MembersSheet.tsx` | members success toasts + copy toasts + getMembers error | 5 |
| `src/app/(app)/tree/[id]/_components/ShareLinkSheet.tsx` | share success/warn toasts + copy toasts + forbidden | 6 |
| `src/components/ui/AccessLostBanner.tsx` (+ mount) | page-level banner on `mtf-access-lost` event + redirect | 6 |
| `src/components/ui/ToastFromSearchParams.tsx` | bridge `?error` → toast + strip param | 7 |
| `src/app/login/page.tsx`, `src/app/(app)/invite/[token]/page.tsx` | mount the bridge | 7 |

---

## Task 1: Carry-over fixes (foundation)

**Files:**
- Modify: `src/lib/toast/notify.ts`, `src/lib/toast/notify.test.ts`
- Modify: `src/lib/toast/useToastOnResult.ts`, `src/lib/toast/useToastOnResult.test.ts`

- [ ] **Step 1: Extend the notify test (info channel + action type)**

Add to `src/lib/toast/notify.test.ts` inside the `describe('notify')` block:
```ts
  it('info: 4s auto-dismiss', () => {
    notify.info('Heads up')
    expect(info).toHaveBeenCalledWith('Heads up', expect.objectContaining({ duration: 4000 }))
  })
```

- [ ] **Step 2: Run red**

Run: `pnpm test src/lib/toast/notify.test.ts`
Expected: the new `info` test passes already (notify.info exists) — but confirm the suite is green. If `info` mock isn't declared in the hoisted block, add `info: vi.fn()` to it and import. Expected end state: PASS (4 tests).

- [ ] **Step 3: Fix `NotifyAction.onClick` type**

In `src/lib/toast/notify.ts`, replace the `NotifyAction` type:
```ts
import type { ReactNode, MouseEvent } from 'react'
```
```ts
export type NotifyAction = {
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}
```
This matches sonner's `Action.onClick`. Existing callers passing `() => {...}` remain valid (a handler ignoring its arg is assignable).

- [ ] **Step 4: Extend `useToastOnResult` success to a function form + test**

Add to `src/lib/toast/useToastOnResult.test.ts`:
```ts
  it('success accepts a function of state', () => {
    expect(pickToast({ ok: true, name: 'Smiths' } as never, { success: (s: never) => `Created ${(s as { name: string }).name}` }))
      .toEqual({ channel: 'success', message: 'Created Smiths' })
  })
```

- [ ] **Step 5: Run red**

Run: `pnpm test src/lib/toast/useToastOnResult.test.ts`
Expected: FAIL — `success` is typed `string` only.

- [ ] **Step 6: Implement the function form**

In `src/lib/toast/useToastOnResult.ts`, change `ToastMessages` and `pickToast`:
```ts
export type ToastMessages = {
  success?: string | ((state: NonNullable<ActionResult>) => string)
  error?: (code: string) => string
}
```
In `pickToast`, replace the success branch:
```ts
  if (ok) {
    if (!messages.success) return null
    const message =
      typeof messages.success === 'function' ? messages.success(state) : messages.success
    return { channel: 'success', message }
  }
```
Add a doc comment above `useToastOnResult`:
```ts
// NOTE: callers MUST pass a stable `messages` (useMemo/useCallback) — the
// effect deps include `messages`; the ref-guard prevents double-toasting on
// re-render, but a stable object avoids redundant effect runs.
```

- [ ] **Step 7: Run green**

Run: `pnpm test src/lib/toast` → expect all pass (notify + useToastOnResult).

- [ ] **Step 8: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/toast/notify.ts src/lib/toast/notify.test.ts src/lib/toast/useToastOnResult.ts src/lib/toast/useToastOnResult.test.ts
git commit -m "fix(#211): notify Action type + useToastOnResult function success + info test" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Dashboard trio (useActionState adapter)

**Files:**
- Modify: `src/app/(app)/dashboard/actions.ts` (echo `name`)
- Modify: `src/app/(app)/dashboard/_components/CreateTreeModal.tsx`, `RenameTreeModal.tsx`, `DeleteTreeDialog.tsx`

Errors stay **inline** (modal stays open on error — the existing `ErrorAlert` is correct). Only **success** toasts here.

- [ ] **Step 1: Echo the name from the actions**

In `src/app/(app)/dashboard/actions.ts`:
- `CreateTreeState` success variant → add `name: string`. In `createTree`, the success return becomes `{ success: true, treeId: <id>, name: <trimmed name> }`.
- `RenameTreeState` success variant → add `name: string`. In `renameTree`, success return becomes `{ success: true, name: <trimmed name> }`.

(Use the already-validated trimmed name variable in each action.)

- [ ] **Step 2: Wire CreateTreeModal**

In `CreateTreeModal.tsx`, add imports:
```tsx
import { useMemo } from 'react'
import { useToastOnResult } from '@/lib/toast/useToastOnResult'
```
After the `useActionState` line, add:
```tsx
const toastMessages = useMemo(
  () => ({ success: (s: typeof state) => `Created "${(s as { name?: string })?.name ?? 'tree'}"` }),
  [],
)
useToastOnResult(state, toastMessages)
```

- [ ] **Step 3: Wire RenameTreeModal**

Same imports. After `useActionState`:
```tsx
const toastMessages = useMemo(
  () => ({ success: (s: typeof state) => `Renamed to "${(s as { name?: string })?.name ?? 'tree'}"` }),
  [],
)
useToastOnResult(state, toastMessages)
```

- [ ] **Step 4: Wire DeleteTreeDialog**

Same imports plus `treeName` is already a prop. After `useActionState`:
```tsx
const toastMessages = useMemo(() => ({ success: `Deleted "${treeName}"` }), [treeName])
useToastOnResult(state, toastMessages)
```

- [ ] **Step 5: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add "src/app/(app)/dashboard/actions.ts" "src/app/(app)/dashboard/_components/CreateTreeModal.tsx" "src/app/(app)/dashboard/_components/RenameTreeModal.tsx" "src/app/(app)/dashboard/_components/DeleteTreeDialog.tsx"
git commit -m "feat(#211): success toasts for create/rename/delete tree via useToastOnResult" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Tree person actions (imperative)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/PersonForm.tsx`
- Modify: `src/app/(app)/tree/[id]/_components/DeletePersonDialog.tsx`

`notify` is already imported in `PersonForm.tsx`.

- [ ] **Step 1: `updatePerson` "Saved" toast**

In `PersonForm.tsx` `runSubmit`, in the edit-mode success branch (after `onSaved?.(person.id)` / `onOpenChange(false)`, before `return`):
```tsx
notify.success('Saved')
```

- [ ] **Step 2: create-mode photo failure → toast (not inline)**

In `PersonForm.tsx`, the create-mode post-create photo flush currently does `setSubmitError(...)` then closes. Replace that failure block with:
```tsx
if (!photoResult.ok) {
  onSaved?.(result.personId)
  onOpenChange(false)
  notify.warning(`Added ${payload.full_name}, but the photo didn't upload. Edit them to attach it.`)
  return
}
```
(The person row exists; host closes; warn toast explains the partial result.)

- [ ] **Step 3: `removePersonPhoto` success toast**

In `PersonForm.tsx` `onRemovePhoto` success branch (after `setLocalPhotoUrl(null)` / `clearPendingBlob()`):
```tsx
notify.success('Photo removed')
```
Leave the edit-mode `uploadPersonPhoto` success path (`showPhotoSuccess()` banner) untouched — no toast there.

- [ ] **Step 4: `deletePerson` success toast**

In `DeletePersonDialog.tsx`, add `import { notify } from '@/lib/toast/notify'`. In `handleDelete`, success branch — fire the toast BEFORE the callbacks (so it fires regardless of which mount point opened the dialog, including the `PersonActionMenu` mount that passes no `onDeleted`):
```tsx
notify.success(`Deleted ${personName}`)
onDeleted?.()
onClose()
```
Keep the inline `ErrorAlert` for the error branch.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add "src/app/(app)/tree/[id]/_components/PersonForm.tsx" "src/app/(app)/tree/[id]/_components/DeletePersonDialog.tsx"
git commit -m "feat(#211): toasts for updatePerson/removePhoto/deletePerson + create-photo failure" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Relationship actions

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/PersonActionMenu.tsx`
- Modify: `src/app/(app)/tree/[id]/_components/SetParentsDialog.tsx`

- [ ] **Step 1: `setSpouse` success toast**

In `PersonActionMenu.tsx`, add `import { notify } from '@/lib/toast/notify'`. In `handleSelectSpouse` success branch (after `setSpousePickerForId(null)`):
```tsx
notify.success('Spouse linked')
```
Keep the inline error in the picker footer (mid-action).

- [ ] **Step 2: `clearSpouse` — capture result + toast**

In `PersonActionMenu.tsx`, change `handleClearSpouse` from fire-and-forget to awaited:
```tsx
const handleClearSpouse = () => {
  if (!person) return
  const id = person.id
  startTransition(async () => {
    const result = await clearSpouse(id, treeId)
    if (!result.ok) {
      notify.error(mapErrorCode(result.error, 'Could not remove the spouse link.'))
      return
    }
    notify.success('Spouse link removed')
  })
}
```
Add `import { mapErrorCode } from '@/lib/errors'` if not present.

- [ ] **Step 3: `setParents` success toast**

In `SetParentsDialog.tsx`, add `import { notify } from '@/lib/toast/notify'`. In `handleSave` success branch (after `onOpenChange(false)`):
```tsx
notify.success(`Parents updated for ${person.full_name}`)
```
Keep the inline `ErrorAlert` for errors (mid-dialog).

- [ ] **Step 4: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add "src/app/(app)/tree/[id]/_components/PersonActionMenu.tsx" "src/app/(app)/tree/[id]/_components/SetParentsDialog.tsx"
git commit -m "feat(#211): toasts for setSpouse/clearSpouse/setParents" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Members + clipboard helper

**Files:**
- Create: `src/lib/toast/copyWithToast.ts` (+ `copyWithToast.test.ts`)
- Modify: `src/app/(app)/tree/[id]/_components/MembersSheet.tsx`
- Modify: `src/app/(app)/dashboard/_components/TreeCardMenu.tsx` (getMembers error)

- [ ] **Step 1: Clipboard helper — failing test**

`src/lib/toast/copyWithToast.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const writeText = vi.fn().mockResolvedValue(undefined)
const success = vi.fn()
vi.mock('./notify', () => ({ notify: { success } }))
import { copyWithToast } from './copyWithToast'

describe('copyWithToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText } })
  })
  it('writes to clipboard and toasts', async () => {
    await copyWithToast('https://x.test')
    expect(writeText).toHaveBeenCalledWith('https://x.test')
    expect(success).toHaveBeenCalledWith('Copied to clipboard')
  })
})
```

- [ ] **Step 2: Run red** — `pnpm test src/lib/toast/copyWithToast.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/toast/copyWithToast.ts`:
```ts
'use client'

import { notify } from './notify'

// Copies text to the clipboard and fires a success toast. Returns the
// promise so callers can still flip their local "copied" icon state.
export async function copyWithToast(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  notify.success('Copied to clipboard')
}
```

- [ ] **Step 4: Run green** — `pnpm test src/lib/toast/copyWithToast.test.ts` → PASS.

- [ ] **Step 5: Wire MembersSheet success toasts + copies**

In `MembersSheet.tsx`, add `import { notify } from '@/lib/toast/notify'` and `import { copyWithToast } from '@/lib/toast/copyWithToast'`.
- `InviteForm.copyToClipboard` and `PendingInviteListRow` copy button: after the existing `navigator.clipboard.writeText(...)` / `setCopied(true)` flow, also call `notify.success('Copied to clipboard')` (or replace the raw `writeText` call with `copyWithToast(url)` and keep the `setCopied(true)` icon flip).
- `revokeInvite` success branch (after `setRevoked(true)`): `notify.success('Invite revoked')`.
- `resendInvite` success branch (after `setResendUrl(...)`): `notify.success('Invite resent')`.
- `revokeMember` success branch: there is no local success state today — add `notify.success('Member removed')` right after the `await revokeMember(...)` resolves with `res.ok` (add an `if (res.ok) notify.success('Member removed')` before the existing `if (!res.ok)` block, or restructure to `if (res.ok) { notify.success('Member removed') } else { ... }`).
Keep all existing inline `ErrorAlert` error handling.

- [ ] **Step 6: getMembersAndInvites silent-error gap**

In `TreeCardMenu.tsx`, add `import { notify } from '@/lib/toast/notify'`. In `handleManageMembers`, the error branch currently only does `setManaging(false)` — add before it:
```tsx
notify.error(mapErrorCode(res.error, 'Could not load members.'))
```
Add `import { mapErrorCode } from '@/lib/errors'` if missing.

- [ ] **Step 7: Typecheck + lint + test + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test src/lib/toast/copyWithToast.test.ts`
```bash
git add src/lib/toast/copyWithToast.ts src/lib/toast/copyWithToast.test.ts "src/app/(app)/tree/[id]/_components/MembersSheet.tsx" "src/app/(app)/dashboard/_components/TreeCardMenu.tsx"
git commit -m "feat(#211): member action toasts + copyWithToast helper + getMembers error" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Share + access-lost banner

**Files:**
- Create: `src/components/ui/AccessLostBanner.tsx`
- Modify: `src/app/(app)/tree/[id]/page.tsx` (mount the banner) — confirm exact path while implementing
- Modify: `src/app/(app)/tree/[id]/_components/ShareLinkSheet.tsx`

- [ ] **Step 1: Access-lost banner component**

`src/components/ui/AccessLostBanner.tsx` — a client component listening for a `mtf-access-lost` CustomEvent, rendering a persistent banner (reuse `ErrorAlert variant="banner"`) with a redirect:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorAlert } from '@/components/ui/error-alert'

// Listens for `mtf-access-lost` (dispatched when a Server Action returns
// `forbidden` mid-session) and shows a page-level banner + dashboard CTA.
export function AccessLostBanner() {
  const router = useRouter()
  const [lost, setLost] = useState(false)
  useEffect(() => {
    const handler = () => setLost(true)
    window.addEventListener('mtf-access-lost', handler)
    return () => window.removeEventListener('mtf-access-lost', handler)
  }, [])
  if (!lost) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 p-3">
      <ErrorAlert
        variant="banner"
        message="You no longer have access to this tree."
        action={
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm font-medium underline"
          >
            Go to dashboard
          </button>
        }
      />
    </div>
  )
}
```

- [ ] **Step 2: Mount the banner on the tree page**

Read `src/app/(app)/tree/[id]/page.tsx`, import `AccessLostBanner`, and render `<AccessLostBanner />` once at the top of the tree page's returned JSX (it self-hides until the event fires).

- [ ] **Step 3: Share success/warn toasts + copy + forbidden**

In `ShareLinkSheet.tsx`, add `import { notify } from '@/lib/toast/notify'`, `import { copyWithToast } from '@/lib/toast/copyWithToast'`, and `import { mapErrorCode } from '@/lib/errors'` (if missing).
- `enableShareLink` success (after `setLocalToken(res.shareToken)`): `notify.success('Share link enabled')`.
- `regenerateShareToken` success (after `setLocalToken(...)`): `notify.warning('New link created — the old link no longer works')`.
- `disableShareLink` success (after `setLocalToken(null)`): `notify.success('Share link disabled')`.
- The shared `copyToClipboard` closure: replace the raw `navigator.clipboard.writeText(currentUrl)` with `copyWithToast(currentUrl)` (keep the `setCopied(true)` icon flip).
- **forbidden:** in all three error branches, replace the generic `setError('Could not …')` with code-aware handling:
```tsx
} else {
  if (res.error === 'forbidden') {
    window.dispatchEvent(new CustomEvent('mtf-access-lost'))
  } else {
    setError('Could not update sharing. Please try again.')
  }
}
```

- [ ] **Step 4: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/components/ui/AccessLostBanner.tsx "src/app/(app)/tree/[id]/page.tsx" "src/app/(app)/tree/[id]/_components/ShareLinkSheet.tsx"
git commit -m "feat(#211): share toasts + copy toasts + access-lost banner on forbidden" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Auth/redirect bridge

**Files:**
- Create: `src/components/ui/ToastFromSearchParams.tsx`
- Modify: `src/app/login/page.tsx`, `src/app/(app)/invite/[token]/page.tsx`

The bridge fires an **error toast** for `?error=<code>` and strips the param. Login's `?sent=true` confirmation **card stays** (prominent primary state — not a toast).

- [ ] **Step 1: Bridge component**

`src/components/ui/ToastFromSearchParams.tsx`:
```tsx
'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { notify } from '@/lib/toast/notify'
import { mapErrorCode } from '@/lib/errors'

// Bridges Server-Action redirects that carry `?error=<code>` into an error
// toast, then strips the param so a refresh doesn't re-fire it.
export function ToastFromSearchParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const fired = useRef(false)
  useEffect(() => {
    const error = params.get('error')
    if (!error || fired.current) return
    fired.current = true
    notify.error(mapErrorCode(error))
    const next = new URLSearchParams(params)
    next.delete('error')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [params, router, pathname])
  return null
}
```

- [ ] **Step 2: Mount on login**

In `src/app/login/page.tsx`, import and render `<ToastFromSearchParams />` near the top of the page JSX. Remove the inline `{error && <ErrorAlert … message={mapErrorCode(error)} />}` rendering (the toast replaces it). Keep the `sent` confirmation card branch.

- [ ] **Step 3: Mount on invite**

In `src/app/(app)/invite/[token]/page.tsx`, import and render `<ToastFromSearchParams />` near the top. Remove the inline `{actionError && <p …>{friendlyActionError(actionError)}</p>}` post-submit error rendering (toast replaces it). Leave the five pre-action full `ErrorCard` states (not_found/revoked/expired/email_mismatch/already_accepted) as-is — those are not `?error=`-driven.

- [ ] **Step 4: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/components/ui/ToastFromSearchParams.tsx src/app/login/page.tsx "src/app/(app)/invite/[token]/page.tsx"
git commit -m "feat(#211): ToastFromSearchParams bridge for auth redirects" -m "Refs #211" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Verify end-to-end

**Files:** none.

- [ ] **Step 1: Static gates** — `pnpm typecheck && pnpm lint && pnpm test` (expect our toast unit tests green; pre-existing Supabase-integration test files fail only when the local stack is down — same baseline as before this branch).
- [ ] **Step 2: Build** — `pnpm build` (expect success; the bridge + banner are client components used under client trees / pages).
- [ ] **Step 3: Manual walk** (`supabase start` + `pnpm dev`): confirm a representative toast per area — create/rename/delete tree; updatePerson "Saved"; delete person; set/clear spouse; set parents; invite + copy ("Copied to clipboard"); revoke/resend; share enable/regen ("old link no longer works")/disable + copy; force a `forbidden` (revoke your own editorship from a second account) → access-lost banner + dashboard CTA; hit `/login?error=email_invalid` and `/invite/<bad>?error=expired` → error toast + param stripped from the URL.
- [ ] **Step 4: Push + draft PR**
```bash
git push -u origin feat/211-notification-rollout
```
Open a DRAFT PR into `qa` following `.github/pull_request_template.md`, body containing `Closes #211` (bare), pre-ticking local gates, leaving manual-checklist boxes for the human. Do not mark ready.

---

## Self-review

**Spec §6 coverage:** dashboard trio ✓ (T2) · createPerson ✓ (pre-seeded) · updatePerson/photo/delete person ✓ (T3) · setSpouse/setParents/clearSpouse ✓ (T4) · invite/revoke/resend/revokeMember/getMembers ✓ (T5) · acceptInvite ✓ (T7 bridge) · share trio + forbidden ✓ (T6) · auth surfaces ✓ (T7). `uploadPersonPhoto` edit-mode intentionally keeps its banner (product decision). No `info`-channel live use (reserved) — acceptable.

**Placeholders:** none — every step has concrete code/commands. The two "confirm exact path while implementing" notes (tree page mount; whether to wrap `copyToClipboard` vs append `notify`) are deliberate read-then-edit anchors, not missing content.

**Type consistency:** `notify.*`, `pickToast`/`useToastOnResult` `success: string | fn`, `copyWithToast(text)`, `mapErrorCode(code, fallback?)`, `ActionResult` shapes are consistent across tasks. CustomEvent name `mtf-access-lost` matches between dispatcher (T6 share) and listener (T6 banner).

## Deviations / notes for reviewer
- **Dashboard trio errors stay inline** (modal stays open) rather than the toast §6 marked — more correct than the spec row.
- **Login `?sent` keeps its card**; the bridge only toasts `?error`.
- **`forbidden`** uses a CustomEvent → page-level banner (reuses `ErrorAlert variant="banner"`) rather than a brand-new layout slot.
