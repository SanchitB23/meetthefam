# Phase 7 — Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the anonymous read-only share link — owners toggle a `share_token` on their tree, copy the URL, and anyone with the link loads `/share/<token>` and sees the family tree without authenticating. Closes the v0.3.0 milestone.

**Architecture:** Three new surfaces — (1) owner-only Server Actions (`enableShareLink` / `regenerateShareToken` / `disableShareLink`) that mint/clear a 32-byte base64url token on `trees.share_token`; (2) a `ShareLinkSheet` opened from a new `<Share2>` icon button in the tree-page top bar (Sheet on mobile / Dialog on desktop, mirrors Phase 6's `MembersSheet`); (3) a public Server-Component page at `src/app/share/[token]/page.tsx` that uses the existing `createServiceRoleClient()` to bypass RLS, looks up the tree by token, and renders the existing `<FamilyTree>` in a new `readOnly` mode (FAB hidden, action menu disabled, Edit CTA hidden inside `<PersonDetailSheet>`). No DB migration — `share_token text unique` already exists on `trees` from Phase 0 and `trees_update_owner` RLS lets only the owner mutate it.

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase (Postgres + RLS + `service_role` for the public route), `@supabase/ssr` server clients, Tailwind v4 + shadcn/ui (Base UI, not Radix), Lucide 1.x, `react-hook-form` (matches Phase 6's `MembersSheet`), Vitest + local Supabase stack for tests.

---

## File Structure

**New files:**
- `src/app/tree/[id]/share/actions.ts` — three Server Actions (`enableShareLink`, `regenerateShareToken`, `disableShareLink`). One file, ~150 lines.
- `src/app/tree/[id]/_components/ShareLinkSheet.tsx` — owner/editor UI. Sheet-on-mobile / Dialog-on-desktop. ~250 lines.
- `src/app/share/[token]/page.tsx` — Server Component, service-role lookup, renders `<FamilyTree readOnly>`. ~80 lines.
- `src/app/share/[token]/not-found.tsx` — heirloom 404 for invalid / disabled / regenerated tokens. ~25 lines.
- `src/app/share/[token]/_components/ShareBanner.tsx` — sticky top banner with the "Create your own" CTA. ~30 lines.
- `src/__tests__/actions/shareLink.test.ts` — Server Action tests (~9 tests).
- `src/__tests__/rls/share_token.test.ts` — cross-role UPDATE matrix on `trees.share_token` (~4 tests).
- `src/__tests__/share/share-page.test.ts` — DB-level service-role read tests (~4 tests).

**Modified files:**
- `src/app/tree/[id]/page.tsx` — read `share_token`, render `<Share2>` icon button + `<ShareLinkSheet>` next to existing Members button.
- `src/app/tree/[id]/_components/FamilyTree.tsx` — accept `readOnly?: boolean` prop; skip FAB, press hook, action-menu branch, pass `readOnly` to `PersonDetailSheet`.
- `src/app/tree/[id]/_lib/person-node-html.ts` — accept `options: { readOnly?: boolean }`; omit the `[data-action-trigger]` button block when `readOnly`.
- `src/app/tree/[id]/_components/PersonDetailSheet.tsx` — accept `readOnly?: boolean` prop; hide the Edit footer button when true.
- `docs/qa/smoke-flows.md` — append `phase-7-share-link` flow.
- `docs/architecture/share-link.md` — small clarifying edits: "Route Handler" → "Server-Component page"; document the actual token format used (base64url, not the example).
- `docs/tasks/current-phase.md` — phase header + sub-task ticks per the standing memory rule.
- `docs/tasks/phase-backlog.md` — tick Phase 7 backlog items as each sub-task lands.
- `package.json` — bumped to `0.3.0` by `pnpm version` during the release-branch step.

---

## Sub-task / branch decomposition

5 sub-tasks, each lands on its own branch and PRs into `qa`. Branch names follow the standing convention:

- Sub-task 1 → `feat/phase-7/sub-task-1-share-actions`
- Sub-task 2 → `feat/phase-7/sub-task-2-share-sheet`
- Sub-task 3 → `feat/phase-7/sub-task-3-share-page`
- Sub-task 4 → `feat/phase-7/sub-task-4-readonly-mode`
- Sub-task 5 → `feat/phase-7/sub-task-5-tests-and-closeout` + `release/v0.3.0`

Per CLAUDE.md, **always ask the user before each `git commit`** with a diff summary — the standing approval rule applies even though this plan lists commit steps.

Within each sub-task, the `task-doc-keeper` agent ticks the sub-task entry in `docs/tasks/current-phase.md` in the same commit as the feature change (per `feedback_update_tasks_before_commit.md`). The `task-doc-tick-detector` PreToolUse hook will auto-nudge if this is forgotten. After every DB-touching commit, dispatch the `supabase-validator` agent (per `feedback_supabase_validator_after_db_commit.md`); for this phase that's only sub-task 1 (Server Actions touch DB) and sub-task 5 (RLS tests added).

---

## Task 1 — Server Actions: enable / regenerate / disable

**Branch:** `feat/phase-7/sub-task-1-share-actions` (cut from `qa`).

**Files:**
- Create: `src/app/tree/[id]/share/actions.ts`

This task ships pure server-side logic. No UI changes yet; the actions are invoked by Task 2's UI. Tests are deferred to Task 5 alongside the rest of the phase's test suite (existing pattern).

### Step 1.1 — Cut the branch

- [ ] **Cut the feature branch from qa**

```bash
git checkout qa
git pull --ff-only
git checkout -b feat/phase-7/sub-task-1-share-actions
```

### Step 1.2 — Create `src/app/tree/[id]/share/actions.ts`

- [ ] **Write the Server Action module**

Create the file with the exact contents below. This mirrors `src/app/tree/[id]/members/actions.ts` for `getBaseUrl()`, `mintToken()`, and the `revalidatePath` pattern — DON'T re-extract those helpers into a shared module (YAGNI; if a third surface needs them, refactor then).

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Helpers (mirror `src/app/tree/[id]/members/actions.ts`).
// ---------------------------------------------------------------------------

async function getBaseUrl(): Promise<string> {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}

function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ShareLinkResult =
  | { ok: true; shareToken: string | null; shareUrl: string | null; error?: never }
  | { ok: false; error: 'not_signed_in' | 'forbidden' | 'not_found' | 'unknown'; shareToken?: never; shareUrl?: never }

// ---------------------------------------------------------------------------
// enableShareLink
// ---------------------------------------------------------------------------
//
// Mints a 32-byte URL-safe token and writes it to `trees.share_token`.
// RLS (`trees_update_owner`) ensures only the owner can mutate.  If the
// link is already enabled, this rotates the token (matches Phase 6
// `resendInvite`'s "rotate in place" semantics — the old URL stops
// working immediately, which is the safer default).

export async function enableShareLink(treeId: string): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const token = mintToken()
  const baseUrl = await getBaseUrl()

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: token })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('enableShareLink: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  // RLS USING-clause filter for non-owners drops the row from the result
  // set without raising an error — we treat that as forbidden.
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return {
    ok: true,
    shareToken: token,
    shareUrl: `${baseUrl}/share/${token}`,
  }
}

// ---------------------------------------------------------------------------
// regenerateShareToken
// ---------------------------------------------------------------------------
//
// Same code path as `enableShareLink` — both rotate the token IN PLACE.
// The two actions exist as separate exports so the UI can distinguish
// "first-time enable" copy from "rotate" copy without inspecting the
// current state on the client.

export async function regenerateShareToken(
  treeId: string,
): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const token = mintToken()
  const baseUrl = await getBaseUrl()

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: token })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('regenerateShareToken: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return {
    ok: true,
    shareToken: token,
    shareUrl: `${baseUrl}/share/${token}`,
  }
}

// ---------------------------------------------------------------------------
// disableShareLink
// ---------------------------------------------------------------------------
//
// Clears `share_token` to null.  Idempotent — calling it twice in a row
// returns ok the second time too (the result set will still contain the
// row because the owner-only RLS USING clause matches).

export async function disableShareLink(
  treeId: string,
): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: null })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('disableShareLink: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return { ok: true, shareToken: null, shareUrl: null }
}
```

### Step 1.3 — Verify type-check + lint

- [ ] **Run typecheck**

```bash
pnpm typecheck
```

Expected: clean (no errors).

- [ ] **Run lint**

```bash
pnpm lint
```

Expected: no new warnings beyond the existing baseline (the only pre-existing warning is the `PersonForm.tsx` `react-hooks/incompatible-library` against `watch()`).

### Step 1.4 — Manual local smoke (no UI yet — verify via DB)

- [ ] **Start the local Supabase stack if not already running**

```bash
pnpm exec supabase status || pnpm exec supabase start
```

- [ ] **Verify enable + disable via Studio**

Open Supabase Studio at http://localhost:54323 → Table Editor → `trees`. The actions can't be invoked from the browser yet (no UI). Real verification waits until Task 2's UI is wired, but the action code can be eyeballed against the existing `inviteEditor`'s shape (same pattern: `getUser()` → mutate → RLS gates → `revalidatePath`).

Test coverage lands in Task 5.

### Step 1.5 — Tick docs + commit

- [ ] **Update `docs/tasks/current-phase.md`** — replace the "Sub-task 1 — TBD at planning" line with the real sub-task 1 entry. Mark `[x]`. Mention the new `src/app/tree/[id]/share/actions.ts` file, the three exports, the `'rotate in place'` semantics of `enableShareLink`, the RLS USING-clause behavior, and that tests are deferred to sub-task 5.

(Use the `task-doc-keeper` subagent for this step — dispatch it with the sub-task description; it knows the doc shape.)

- [ ] **Ask the user to approve the commit, with a diff summary**

Show the user:

```
git status
git diff src/app/tree/[id]/share/actions.ts docs/tasks/current-phase.md
```

- [ ] **Commit (after user approval)**

```bash
git add src/app/tree/\[id\]/share/actions.ts docs/tasks/current-phase.md
git commit -m "$(cat <<'EOF'
feat(phase-7): share-link Server Actions (enable / regenerate / disable)

Owner-only mutation surface on trees.share_token via RLS. enableShareLink
and regenerateShareToken both mint a 32-byte URL-safe token and rotate
in place; disableShareLink sets it to null. All three guarded by
trees_update_owner — non-owners get { ok: false, error: 'forbidden' }
from the empty-result-set filter. Tests deferred to sub-task 5.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 1.6 — Dispatch supabase-validator

- [ ] **Dispatch the supabase-validator agent**

This is a DB-touching commit (Server Actions writing to `trees.share_token`). Per `feedback_supabase_validator_after_db_commit.md`, dispatch the validator. Brief prompt: "Validate the new share-link Server Actions in `src/app/tree/[id]/share/actions.ts` against the existing `trees_update_owner` RLS policy. No new migrations to apply; check that the actions are RLS-gated correctly for non-owner callers and that the empty-result-set pattern is the right RLS-tell."

### Step 1.7 — Open the PR

- [ ] **Push and open a draft PR**

```bash
git push -u origin feat/phase-7/sub-task-1-share-actions
gh pr create --draft --base qa --title "feat(phase-7): share-link Server Actions" --body "$(cat <<'EOF'
## Summary

- Adds `enableShareLink`, `regenerateShareToken`, `disableShareLink` Server Actions at `src/app/tree/[id]/share/actions.ts`
- RLS-gated via existing `trees_update_owner` — no migration needed
- Tests deferred to sub-task 5 alongside the rest of the phase's test suite

## Test plan

- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] supabase-validator agent pass (no advisor drift, RLS unchanged)
- [ ] Manual verification deferred to sub-task 2 (UI lands then)

## Related

- Phase 7 plan: `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`
- Brainstorm: `/Users/sqb6461/.claude/plans/on-phase-7-then-wobbly-tide.md`
EOF
)"
```

Per memory rule `feedback_draft_prs_user_marks_ready.md`: open as draft; user marks ready themselves.

---

## Task 2 — ShareLinkSheet + tree-page Share button

**Branch:** `feat/phase-7/sub-task-2-share-sheet` (cut from `qa` AFTER sub-task 1 is squash-merged).

**Files:**
- Create: `src/app/tree/[id]/_components/ShareLinkSheet.tsx`
- Modify: `src/app/tree/[id]/page.tsx`

### Step 2.1 — Cut the branch

- [ ] **Cut from updated qa**

```bash
git checkout qa
git pull --ff-only  # picks up sub-task 1's squash
git checkout -b feat/phase-7/sub-task-2-share-sheet
```

### Step 2.2 — Create `src/app/tree/[id]/_components/ShareLinkSheet.tsx`

- [ ] **Write the component**

```tsx
'use client'

// Phase 7 sub-task 2 — share-link toggle UI.
//
// Mirrors MembersSheet's structure:
//   - Sheet (bottom) on mobile, Dialog on desktop via `useIsDesktop`.
//   - Owner sees the full toggle/rotate/disable surface.
//   - Editor sees a read-only banner (sharing's enabled state is shared
//     information by design — transparency for editors).
//
// Two-click confirm pattern for Regenerate + Disable matches MembersSheet's
// MemberListRow.handleRevoke — `confirm*` state flips on first click; second
// click within ~3s commits. No timer-driven reset; the user clicks Cancel
// (or X) or re-clicks elsewhere on the form to dismiss.

import { useState, useTransition } from 'react'
import {
  Copy,
  Check,
  Share2,
  RefreshCw,
  X,
  LoaderCircle,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsDesktop } from '@/components/ui/use-is-desktop'

import {
  enableShareLink,
  regenerateShareToken,
  disableShareLink,
} from '../share/actions'

// Same Tailwind chrome MembersSheet uses for read-only URL inputs.
const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

type Props = {
  treeId: string
  currentUserRole: 'owner' | 'editor'
  /** Current share_token from the tree row. Null = sharing disabled. */
  shareToken: string | null
  /** Origin to prepend to /share/<token> when building the copyable URL. */
  baseUrl: string
  /** Optional click target. When omitted, parent controls open via `open`/`onOpenChange`. */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

export function ShareLinkSheet({
  treeId,
  currentUserRole,
  shareToken,
  baseUrl,
  trigger,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
}: Props) {
  const desktop = useIsDesktop()
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }

  const isOwner = currentUserRole === 'owner'
  const isEnabled = shareToken != null

  // Local mirror of the token so we can show the freshly-minted URL
  // optimistically without waiting for the revalidatePath round-trip.
  const [localToken, setLocalToken] = useState<string | null>(shareToken)
  const currentToken = localToken ?? shareToken
  const currentUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleEnable = () => {
    setError(null)
    startTransition(async () => {
      const res = await enableShareLink(treeId)
      if (res.ok) {
        setLocalToken(res.shareToken)
      } else {
        setError('Could not enable sharing. Please try again.')
      }
    })
  }

  const handleRegenerate = () => {
    if (!confirmRegen) {
      setConfirmRegen(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await regenerateShareToken(treeId)
      if (res.ok) {
        setLocalToken(res.shareToken)
        setConfirmRegen(false)
      } else {
        setError('Could not regenerate token. Please try again.')
        setConfirmRegen(false)
      }
    })
  }

  const handleDisable = () => {
    if (!confirmDisable) {
      setConfirmDisable(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await disableShareLink(treeId)
      if (res.ok) {
        setLocalToken(null)
        setConfirmDisable(false)
      } else {
        setError('Could not disable sharing. Please try again.')
        setConfirmDisable(false)
      }
    })
  }

  // ---- Body for each state ----
  const body = (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0 sm:mt-2">
      {!isOwner && (
        <p className="text-sm text-foreground/70">
          {isEnabled
            ? 'This tree is shared via a read-only link. Only the owner can manage the link.'
            : 'This tree is not shared. Only the owner can enable sharing.'}
        </p>
      )}

      {isOwner && !isEnabled && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground/80">
            Generate a read-only URL anyone can open to see this tree. You can rotate or disable it at any time.
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleEnable}
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Enabling…
              </span>
            ) : (
              'Enable read-only share link'
            )}
          </Button>
        </div>
      )}

      {isOwner && isEnabled && currentUrl && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              Share this URL with anyone you want to view the tree:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className={`${inputClass} flex-1 min-w-0 cursor-text`}
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(currentUrl)}
                aria-label="Copy share link"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">Manage</h3>

            {/* Regenerate */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {confirmRegen ? (
                  <>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={isPending}
                      onClick={handleRegenerate}
                      className="text-xs h-7"
                    >
                      {isPending ? 'Rotating…' : 'Confirm regenerate'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => setConfirmRegen(false)}
                      aria-label="Cancel regenerate"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <p className="text-xs text-foreground/60">
                      This will break the current URL immediately.
                    </p>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>

            {/* Disable */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {confirmDisable ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={handleDisable}
                      className="text-xs h-7"
                    >
                      {isPending ? 'Disabling…' : 'Confirm disable'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => setConfirmDisable(false)}
                      aria-label="Cancel disable"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <p className="text-xs text-foreground/60">
                      The URL will stop working immediately.
                    </p>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={handleDisable}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Disable sharing
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )

  const title = 'Share link'
  const description = isOwner
    ? 'Generate or manage a read-only public URL for this tree.'
    : 'View whether this tree is shared publicly.'

  const surface = desktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {body}
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-serif text-xl flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      {trigger && (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          aria-label="Share link"
          className="contents"
        >
          {trigger}
        </span>
      )}
      {surface}
    </>
  )
}
```

### Step 2.3 — Wire the button + sheet in `src/app/tree/[id]/page.tsx`

- [ ] **Add `share_token` to the existing `TreeRow` type and tree SELECT**

In `src/app/tree/[id]/page.tsx`, line 10–14 currently declares:

```ts
type TreeRow = {
  id: string
  name: string
  description: string | null
}
```

Change to:

```ts
type TreeRow = {
  id: string
  name: string
  description: string | null
  share_token: string | null
}
```

In the same file, line 33–37 currently has:

```ts
const { data: tree } = await supabase
  .from('trees')
  .select('id, name, description')
  .eq('id', id)
  .maybeSingle<TreeRow>()
```

Change to:

```ts
const { data: tree } = await supabase
  .from('trees')
  .select('id, name, description, share_token')
  .eq('id', id)
  .maybeSingle<TreeRow>()
```

- [ ] **Import `Share2` icon + `ShareLinkSheet`**

At the top of the file (line 4 currently imports `ArrowLeft, Users2`), change to:

```ts
import { ArrowLeft, Share2, Users2 } from 'lucide-react'
```

And add after line 8 (next to the existing `MembersSheet` import):

```ts
import { ShareLinkSheet } from './_components/ShareLinkSheet'
import { headers } from 'next/headers'
```

- [ ] **Derive `baseUrl` inside the component**

After the existing `const sp = await props.searchParams` (around line 22), add:

```ts
const baseUrl = (await headers()).get('origin') ?? 'http://localhost:3000'
```

- [ ] **Add the Share button trigger + sheet next to the existing Members trigger**

Currently (around line 153–164) there's:

```tsx
const membersTrigger = (
  <button
    type="button"
    aria-label="Manage members"
    className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
  >
    <Users2 className="h-5 w-5" />
  </button>
)
```

Add immediately after (still inside the function, before the `return`):

```tsx
const shareTrigger = (
  <button
    type="button"
    aria-label="Share link"
    className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
  >
    <Share2 className="h-5 w-5" />
  </button>
)
```

In the JSX (currently lines 178–188 — the top-bar `<div>` with the back link + heading + MembersSheet), change to:

```tsx
<div className="flex items-center gap-3 mb-6 max-w-4xl mx-auto">
  <Link
    href="/dashboard"
    aria-label="Back to dashboard"
    className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
  >
    <ArrowLeft className="h-5 w-5" />
  </Link>
  <h1 className="font-serif text-3xl text-foreground leading-tight flex-1 min-w-0 truncate">
    {tree.name}
  </h1>
  {/* Phase 7 sub-task 2 — Share icon button in top bar */}
  <ShareLinkSheet
    treeId={tree.id}
    currentUserRole={currentUserRole}
    shareToken={tree.share_token}
    baseUrl={baseUrl}
    trigger={shareTrigger}
  />
  {/* Phase 6 sub-task 4 — Members icon button in top bar */}
  <MembersSheet
    treeId={tree.id}
    currentUserId={user.id}
    currentUserRole={currentUserRole}
    members={members}
    pendingInvites={pendingInvites}
    trigger={membersTrigger}
  />
</div>
```

### Step 2.4 — Manual smoke test

- [ ] **Start dev server**

```bash
pnpm dev
```

- [ ] **Owner flow check**

In a normal browser window signed in as the tree owner:
1. Open the Smith demo tree (or any owned tree).
2. Click the Share icon (next to Members) — assert the sheet opens with "Enable read-only share link" button.
3. Click Enable — assert the URL appears in a read-only input with a Copy button.
4. Click Copy — assert "Copy" icon flips to a green check briefly.
5. Click Regenerate — assert "Confirm regenerate" + "Cancel" appear.
6. Click Confirm regenerate — assert the URL changes (token differs from before).
7. Click Disable → Confirm disable — assert the URL row disappears and the Enable button reappears.

- [ ] **Editor view check**

If a second account with editor membership exists (per Phase 6 setup), sign in as the editor and open the same tree:
1. Click Share — assert the sheet opens.
2. Assert the body shows the read-only banner ("Only the owner can manage…").
3. Close.

(If no editor account is set up locally, skip this step and rely on Task 5's RLS tests.)

### Step 2.5 — Verify typecheck + lint

- [ ] **Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Run lint**

```bash
pnpm lint
```

Expected: no new warnings.

### Step 2.6 — Tick docs + commit

- [ ] **Update `docs/tasks/current-phase.md`** — tick sub-task 2. Describe: new `ShareLinkSheet.tsx`, the four UI states (owner-disabled / owner-enabled / editor-enabled / editor-disabled), the two-click confirm pattern reuse from MembersSheet, the page.tsx wiring, the headers-derived baseUrl.

(Dispatch `task-doc-keeper` for this.)

- [ ] **Show diff + ask user to approve**

```bash
git status
git diff src/app/tree/\[id\]/_components/ShareLinkSheet.tsx src/app/tree/\[id\]/page.tsx docs/tasks/current-phase.md
```

- [ ] **Commit (after approval)**

```bash
git add src/app/tree/\[id\]/_components/ShareLinkSheet.tsx src/app/tree/\[id\]/page.tsx docs/tasks/current-phase.md
git commit -m "$(cat <<'EOF'
feat(phase-7): ShareLinkSheet + tree-page Share button

Mobile-first Sheet (Dialog on desktop) for the share-link toggle.
Owner sees enable / copy / regenerate / disable with two-click confirms
on regenerate + disable (mirrors MembersSheet's revoke pattern).
Editor sees a read-only banner showing whether sharing is on.

Top-bar gets a Share2 icon button next to Members. tree-page.tsx
reads share_token off the trees row and derives baseUrl from origin
headers so the copyable URL matches the request origin (mirrors
inviteEditor's getBaseUrl pattern).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 2.7 — Open PR

- [ ] **Push and open a draft PR**

```bash
git push -u origin feat/phase-7/sub-task-2-share-sheet
gh pr create --draft --base qa --title "feat(phase-7): ShareLinkSheet + Share button" --body "$(cat <<'EOF'
## Summary

- New `ShareLinkSheet` component at `src/app/tree/[id]/_components/ShareLinkSheet.tsx`
- New Share icon button in tree-page top bar, next to Members
- Reads `share_token` off the trees row; derives `baseUrl` from origin headers

## Test plan

- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] Owner manual flow: enable → copy → regenerate → disable
- [ ] Editor manual flow: sheet shows read-only banner
- [ ] Tests deferred to sub-task 5

## Related

- Phase 7 plan: `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`
EOF
)"
```

---

## Task 3 — `/share/[token]/page.tsx` Server Component

**Branch:** `feat/phase-7/sub-task-3-share-page` (cut from `qa` AFTER sub-task 2 is squash-merged).

**Files:**
- Create: `src/app/share/[token]/page.tsx`
- Create: `src/app/share/[token]/not-found.tsx`
- Create: `src/app/share/[token]/_components/ShareBanner.tsx`
- Modify: `docs/architecture/share-link.md` (clarify "Server-Component page" terminology, fix the token-mint example)

This task ships the public route, but DOES NOT yet wire the `readOnly` prop on `<FamilyTree>` (that's Task 4). The page is functional but the canvas will still show the FAB + action menu + Edit button on tap. Task 4 finishes the lockdown. This staging is deliberate — keeps the route landing reviewable separately from the `<FamilyTree>` mode-switch.

### Step 3.1 — Cut the branch

- [ ] **Cut from updated qa**

```bash
git checkout qa
git pull --ff-only
git checkout -b feat/phase-7/sub-task-3-share-page
```

### Step 3.2 — Create `src/app/share/[token]/_components/ShareBanner.tsx`

- [ ] **Write the banner component**

```tsx
// Phase 7 sub-task 3 — sticky banner across the top of the share view.
//
// Server Component (no client state needed). The link points at /login
// because magic-link is our actual signup path — first click creates the
// auth.users + profiles row via handle_new_user.

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function ShareBanner() {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-foreground/80 italic font-serif">
          You&apos;re viewing a shared family tree.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Sign up to create your own
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
```

### Step 3.3 — Create `src/app/share/[token]/not-found.tsx`

- [ ] **Write the 404 page**

```tsx
import Link from 'next/link'

export default function ShareNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-serif text-4xl text-foreground mb-3">
        Tree not found
      </h1>
      <p className="text-foreground/70 max-w-md mb-6">
        This share link is no longer active. The owner may have disabled sharing or rotated the link.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
      >
        Sign up to create your own tree →
      </Link>
    </main>
  )
}
```

### Step 3.4 — Create `src/app/share/[token]/page.tsx`

- [ ] **Write the page**

```tsx
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { FamilyTree } from '@/app/tree/[id]/_components/FamilyTree'
import type { PersonRow } from '@/app/tree/[id]/_lib/types'
import { ShareBanner } from './_components/ShareBanner'

// Phase 7 sub-task 3 — public read-only share view.
//
// This is the ONLY route in the project that runs with the service-role
// client against the people / trees tables. The token IS the auth: a
// 256-bit random value, brute-forcing is infeasible. RLS is bypassed
// deliberately because the share viewer has no session.
//
// /share/* is already excluded from src/proxy.ts's auth matcher so this
// page is anonymously reachable.

export const metadata = {
  title: 'Shared family tree · meetthefam',
}

type TreeRow = {
  id: string
  name: string
  description: string | null
}

export default async function SharePage(props: PageProps<'/share/[token]'>) {
  const { token } = await props.params

  const supabase = createServiceRoleClient()

  // Token lookup. .maybeSingle() returns null (not an error) when no row
  // matches — covers null share_token, regenerated-old token, and
  // never-existed.
  const { data: tree } = await supabase
    .from('trees')
    .select('id, name, description')
    .eq('share_token', token)
    .maybeSingle<TreeRow>()

  if (!tree) notFound()

  const { data: peopleRows } = await supabase
    .from('people')
    .select(
      `id, tree_id, full_name, nickname, gender, photo_url, bio,
       birth_year, location, occupation, deceased, death_year,
       father_id, mother_id, spouse_id, tone`,
    )
    .eq('tree_id', tree.id)
    .order('created_at', { ascending: true })
    .returns<PersonRow[]>()

  const people = peopleRows ?? []

  return (
    <main className="min-h-screen flex flex-col">
      <ShareBanner />

      <div className="px-4 pt-6 pb-2 max-w-4xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-foreground leading-tight">
          {tree.name}
        </h1>
        {tree.description && (
          <p className="text-foreground/70 text-sm mt-1">{tree.description}</p>
        )}
      </div>

      <div className="px-4 pb-8 flex-1 max-w-4xl mx-auto w-full">
        {people.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
            <p className="font-serif text-xl text-foreground/70">
              This tree is empty.
            </p>
          </div>
        ) : (
          <FamilyTree
            treeId={tree.id}
            people={people}
            readOnly
          />
        )}
      </div>
    </main>
  )
}
```

NOTE: `<FamilyTree readOnly>` doesn't accept the prop yet — that lands in Task 4. The page will still render correctly because unknown props are ignored by React; the chrome will just be the same as the logged-in view (FAB + action menu visible). Task 4 finishes the lockdown.

### Step 3.5 — Update `docs/architecture/share-link.md`

- [ ] **Fix terminology + token-mint example**

In `docs/architecture/share-link.md`:

1. Change line 13 — "no row → return 404" stays correct.
2. Change line 31 from `## /share/[token] Route Handler` to `## /share/[token] Server Component`.
3. Change line 37 — the box-and-arrow diagram says "Server-side handler with createClient using SUPABASE_SERVICE_ROLE_KEY" — change to "Server Component using createServiceRoleClient() (service_role)".
4. Change line 26 (the token example) from:

```ts
const token = crypto.randomBytes(32).toString('base64url')  // 43 chars, URL-safe
```

to (no edit — that's already correct). But verify the line above it doesn't claim "different format" — leave the doc clean.

### Step 3.6 — Manual smoke

- [ ] **Restart dev server (so the new route registers)**

```bash
pnpm dev
```

- [ ] **Verify the route loads**

1. Sign in as the owner of the Smith tree. Open the Share sheet → Enable. Copy the URL.
2. Open the URL in an incognito / private window.
3. Assert: page renders with the sticky banner, tree name, and the canvas. The FAB is still visible (Task 4 fixes this).
4. Tap a person — detail sheet opens with bio etc, and the Edit button is still visible (Task 4 fixes this).
5. Close the detail sheet.
6. Sign in as owner → Regenerate the token → close the sheet. Reload the incognito tab. Assert: 404 page renders ("Tree not found").
7. Sign in as owner → re-enable / copy the new URL → open in incognito → confirm reachable again.
8. Sign in as owner → Disable. Reload incognito. Assert: 404 again.

- [ ] **Verify metadata + chrome**

In the incognito tab's DevTools → Elements, assert the document title is "Shared family tree · meetthefam" (not the tree name — no person/tree names should leak into HTML head).

### Step 3.7 — Verify typecheck + lint

- [ ] **Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

### Step 3.8 — Tick docs + commit

- [ ] **Update `docs/tasks/current-phase.md`** — tick sub-task 3. Describe: the new `/share/[token]` page, the service-role client reuse, the 404 boundary, the banner component, the metadata title decision. Note that read-only LOCKDOWN of the canvas chrome lands in sub-task 4 (this sub-task ships the route; the next sub-task finishes the affordance-hiding).

- [ ] **Diff summary + ask user**

```bash
git status
git diff src/app/share docs/architecture/share-link.md docs/tasks/current-phase.md
```

- [ ] **Commit**

```bash
git add src/app/share docs/architecture/share-link.md docs/tasks/current-phase.md
git commit -m "$(cat <<'EOF'
feat(phase-7): /share/[token] Server Component page

New public route serving the read-only family tree view. Uses
createServiceRoleClient() to bypass RLS — token is the auth gate;
brute-forcing 256 bits is infeasible. /share/* is already excluded
from proxy.ts's matcher.

Includes the sticky banner pointing at /login for signup conversion
and a heirloom-styled not-found page for invalidated / disabled
tokens. Architecture doc updated to call it a Server Component (was
'Route Handler' — leftover from earlier wording).

Read-only LOCKDOWN of the canvas chrome (FAB, action menu, Edit
button) lands in sub-task 4 — this sub-task ships the route shell.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 3.9 — Open PR

- [ ] **Push and open a draft PR**

```bash
git push -u origin feat/phase-7/sub-task-3-share-page
gh pr create --draft --base qa --title "feat(phase-7): /share/[token] Server Component" --body "$(cat <<'EOF'
## Summary

- New public route `/share/[token]` at `src/app/share/[token]/page.tsx`
- New `ShareBanner` + `not-found.tsx`
- Uses existing `createServiceRoleClient()` for the RLS bypass
- `docs/architecture/share-link.md` clarified — "Server-Component page" (was "Route Handler")

## Test plan

- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] Manual: enable → open URL incognito → canvas renders
- [ ] Manual: regenerate → old URL 404s
- [ ] Manual: disable → URL 404s
- [ ] Read-only chrome lockdown deferred to sub-task 4

## Related

- Phase 7 plan: `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`
EOF
)"
```

---

## Task 4 — readOnly prop on `<FamilyTree>` / `personNodeHtml` / `<PersonDetailSheet>`

**Branch:** `feat/phase-7/sub-task-4-readonly-mode` (cut from `qa` AFTER sub-task 3 is squash-merged).

**Files:**
- Modify: `src/app/tree/[id]/_components/FamilyTree.tsx`
- Modify: `src/app/tree/[id]/_lib/person-node-html.ts`
- Modify: `src/app/tree/[id]/_components/PersonDetailSheet.tsx`

### Step 4.1 — Cut the branch

- [ ] **Cut from updated qa**

```bash
git checkout qa
git pull --ff-only
git checkout -b feat/phase-7/sub-task-4-readonly-mode
```

### Step 4.2 — Extend `personNodeHtml` with a `readOnly` option

- [ ] **Update `src/app/tree/[id]/_lib/person-node-html.ts`**

The current signature is `export function personNodeHtml(d: TreeDatum): string`. Change to accept an options bag with `readOnly`. When `readOnly` is true, omit the `ellipsisButton` block (the three-dot trigger).

Locate the export at line 106:

```ts
export function personNodeHtml(d: TreeDatum): string {
```

Change to:

```ts
type PersonNodeHtmlOptions = { readOnly?: boolean }

export function personNodeHtml(
  d: TreeDatum,
  options: PersonNodeHtmlOptions = {},
): string {
```

Inside the function body, find the `${ellipsisButton}` interpolation (around line 190 — inside the returned template literal between the `</button>` close of `ellipsisButton` and the avatar render). Change:

```ts
${ellipsisButton}
${avatarHtml(data)}
```

to:

```ts
${options.readOnly ? '' : ellipsisButton}
${avatarHtml(data)}
```

The `ellipsisButton` variable definition above can stay (it's a const string; unused in readOnly mode, but no behavior change).

### Step 4.3 — Pass options through from `<FamilyTree>`

- [ ] **Update `src/app/tree/[id]/_components/FamilyTree.tsx`**

Add `readOnly` to the Props type (line 59–64 currently):

```ts
type Props = {
  treeId: string
  people: PersonRow[]
  /** SSR-derived focus from `?p=<id>` searchParams. May be overridden by `#p=<id>` on mount. */
  initialFocusId?: string | null
  /** When true, hides FAB, disables the press hook, removes the three-dot button from cards, and hides Edit in the detail sheet. */
  readOnly?: boolean
}
```

Update the function signature (line 91):

```ts
function FamilyTreeImpl({ treeId, people, initialFocusId, readOnly = false }: Props) {
```

Skip the `usePressActions` registration when `readOnly` — its only purpose is opening the action menu. Currently (line 118–128):

```ts
const { shouldSuppressNextClickRef } = usePressActions(containerRef, {
  onLongPress: (personId, e) => {
    const node = (e.target as HTMLElement | null)?.closest('.mtf-node') as HTMLElement | null
    const rect = node?.getBoundingClientRect()
    setActionAnchor({
      personId,
      x: rect ? rect.right - 4 : e.clientX,
      y: rect ? rect.top + 8 : e.clientY,
    })
  },
})
```

Wrap the hook call in a conditional. The `usePressActions` hook needs to be unconditionally invoked (Rules of Hooks) but its `onLongPress` callback can be a no-op in readOnly mode. Change to:

```ts
const { shouldSuppressNextClickRef } = usePressActions(containerRef, {
  onLongPress: readOnly
    ? () => {
        /* no-op in read-only mode */
      }
    : (personId, e) => {
        const node = (e.target as HTMLElement | null)?.closest('.mtf-node') as HTMLElement | null
        const rect = node?.getBoundingClientRect()
        setActionAnchor({
          personId,
          x: rect ? rect.right - 4 : e.clientX,
          y: rect ? rect.top + 8 : e.clientY,
        })
      },
})
```

Pass the readOnly option to `personNodeHtml`. Currently (line 162):

```ts
.setCardInnerHtmlCreator(personNodeHtml)
```

The library's `setCardInnerHtmlCreator` takes a function `(d) => string`. We need to bind the readOnly flag. Change to:

```ts
.setCardInnerHtmlCreator((d) => personNodeHtml(d, { readOnly }))
```

Skip the action-menu branch inside `setOnCardClick` when readOnly (it's already implicitly skipped because the `[data-action-trigger]` button isn't in the HTML, but explicit is better). Currently (line 163–183):

```ts
.setOnCardClick((e: Event, d: TreeDatum) => {
  if (shouldSuppressNextClickRef.current) {
    shouldSuppressNextClickRef.current = false
    return
  }
  const id = d.data.id
  if (!peopleByIdRef.current.has(id)) return

  const target = (e.target as HTMLElement | null) ?? null
  const trigger = target?.closest('[data-action-trigger]') as HTMLElement | null
  if (trigger) {
    const rect = trigger.getBoundingClientRect()
    setActionAnchor({
      personId: id,
      x: rect.right,
      y: rect.bottom,
    })
    return
  }
  setDetailPersonId(id)
})
```

Change to:

```ts
.setOnCardClick((e: Event, d: TreeDatum) => {
  if (shouldSuppressNextClickRef.current) {
    shouldSuppressNextClickRef.current = false
    return
  }
  const id = d.data.id
  if (!peopleByIdRef.current.has(id)) return

  if (!readOnly) {
    const target = (e.target as HTMLElement | null) ?? null
    const trigger = target?.closest('[data-action-trigger]') as HTMLElement | null
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      setActionAnchor({
        personId: id,
        x: rect.right,
        y: rect.bottom,
      })
      return
    }
  }
  setDetailPersonId(id)
})
```

The chart-init `useEffect`'s dependency array needs `readOnly` added too. Find the eslint-disable line near the end of the effect:

```ts
}, [people, shouldSuppressNextClickRef])
```

Change to:

```ts
}, [people, shouldSuppressNextClickRef, readOnly])
```

Conditionally render the FAB, action menu, and pass `readOnly` to the detail sheet. Currently (line 251–275):

```tsx
return (
  <>
    <div
      ref={containerRef}
      className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-card overflow-hidden"
      style={{
        ['--background-color' as string]: 'var(--card)',
        ['--text-color' as string]: 'var(--foreground)',
      }}
    />
    <PersonDetailSheet
      person={detailPerson}
      peopleById={peopleById}
      treeId={treeId}
      onOpenChange={(next) => setDetailPersonId(next?.id ?? null)}
    />
    <PersonActionMenu
      anchor={actionAnchor}
      treeId={treeId}
      people={people}
      peopleById={peopleById}
      onClose={() => setActionAnchor(null)}
      onRecenter={handleRecenter}
    />
    <AddRelativeFab treeId={treeId} focusPerson={focusPerson} />
  </>
)
```

Change to:

```tsx
return (
  <>
    <div
      ref={containerRef}
      className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-card overflow-hidden"
      style={{
        ['--background-color' as string]: 'var(--card)',
        ['--text-color' as string]: 'var(--foreground)',
      }}
    />
    <PersonDetailSheet
      person={detailPerson}
      peopleById={peopleById}
      treeId={treeId}
      readOnly={readOnly}
      onOpenChange={(next) => setDetailPersonId(next?.id ?? null)}
    />
    {!readOnly && (
      <>
        <PersonActionMenu
          anchor={actionAnchor}
          treeId={treeId}
          people={people}
          peopleById={peopleById}
          onClose={() => setActionAnchor(null)}
          onRecenter={handleRecenter}
        />
        <AddRelativeFab treeId={treeId} focusPerson={focusPerson} />
      </>
    )}
  </>
)
```

### Step 4.4 — Add `readOnly` to `<PersonDetailSheet>`

- [ ] **Update `src/app/tree/[id]/_components/PersonDetailSheet.tsx`**

Add the prop to the Props type (line 35–43 currently):

```ts
type Props = {
  /** When non-null, the sheet is open and shows this person. */
  person: PersonRow | null
  /** Resolves spouse/parent names without re-querying the DB. */
  peopleById: Map<string, PersonRow>
  treeId: string
  /** When true, hides the Edit footer button. Used by the public share view. */
  readOnly?: boolean
  /** Called with `null` when the user closes the sheet. */
  onOpenChange: (person: PersonRow | null) => void
}
```

Add to the destructured args (line 55–60):

```ts
export function PersonDetailSheet({
  person,
  peopleById,
  treeId,
  readOnly = false,
  onOpenChange,
}: Props) {
```

Wrap the Edit button + the subsequent `<PersonForm>` invocation in `!readOnly` — they're the only mutation surface in the component. Currently (line 146–161):

```tsx
<div className="flex justify-end pt-2">
  <Button
    type="button"
    onClick={() => {
      // Sequence: capture the person for the edit form,
      // then close this sheet. The form mounts independently
      // of the detail-sheet `person` prop, so closing here
      // doesn't unmount it.
      setEditPerson(person)
      onOpenChange(null)
    }}
  >
    Edit
  </Button>
</div>
```

Change to:

```tsx
{!readOnly && (
  <div className="flex justify-end pt-2">
    <Button
      type="button"
      onClick={() => {
        // Sequence: capture the person for the edit form,
        // then close this sheet. The form mounts independently
        // of the detail-sheet `person` prop, so closing here
        // doesn't unmount it.
        setEditPerson(person)
        onOpenChange(null)
      }}
    >
      Edit
    </Button>
  </div>
)}
```

The `editPerson` state + the `<PersonForm>` mount below it stay — they're dead code paths when `readOnly` is true (no surface to set `editPerson` to non-null), so they don't render. No further change needed there.

### Step 4.5 — Manual smoke

- [ ] **Restart dev server**

```bash
pnpm dev
```

- [ ] **Verify owner view still works (regression check)**

In a normal browser signed in as the tree owner:
1. Open the Smith demo tree. Assert: the FAB is visible, the three-dot trigger appears on hover/tap of each person card, the action menu opens on long-press, tapping a person opens the detail sheet WITH the Edit button.
2. Click Edit → assert the form opens. Cancel out.

This proves the default behavior (readOnly defaults to false) is unchanged.

- [ ] **Verify share view is now locked down**

1. As owner: Share → Enable → Copy URL.
2. Open the URL in incognito.
3. Assert: NO FAB visible at the bottom-right.
4. Assert: hover/tap a person card — NO three-dot trigger button visible (the SVG block isn't in the DOM).
5. Long-press a person card — NO action menu opens.
6. Tap a person — detail sheet opens with bio / dates / location / occupation / relations, but NO Edit button at the bottom.
7. Close the sheet. Pan + pinch-zoom the canvas — works normally.

### Step 4.6 — Verify typecheck + lint

- [ ] **Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

### Step 4.7 — Tick docs + commit

- [ ] **Update `docs/tasks/current-phase.md`** — tick sub-task 4. Describe: the three-file change set, the readOnly prop chain (page → FamilyTree → personNodeHtml + PersonDetailSheet), the conditional FAB + action menu rendering, the no-op long-press callback.

- [ ] **Diff summary + ask**

```bash
git status
git diff src/app/tree/\[id\] docs/tasks/current-phase.md
```

- [ ] **Commit**

```bash
git add src/app/tree/\[id\] docs/tasks/current-phase.md
git commit -m "$(cat <<'EOF'
feat(phase-7): readOnly mode for FamilyTree + PersonNode + DetailSheet

readOnly prop threads through FamilyTree → personNodeHtml +
PersonDetailSheet. When true:
  - AddRelativeFab not rendered
  - PersonActionMenu not rendered
  - three-dot button stripped from each card's HTML
  - usePressActions onLongPress callback is a no-op
  - Edit button hidden in PersonDetailSheet footer

Pan/zoom/tap-to-detail still work for share viewers — the
detail content is the whole point of the share view.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 4.8 — Open PR

- [ ] **Push and open a draft PR**

```bash
git push -u origin feat/phase-7/sub-task-4-readonly-mode
gh pr create --draft --base qa --title "feat(phase-7): readOnly mode for FamilyTree" --body "$(cat <<'EOF'
## Summary

- New `readOnly?: boolean` prop on `FamilyTree`, threaded to `personNodeHtml` and `PersonDetailSheet`
- When true: no FAB, no action menu, no three-dot trigger, no Edit button
- Pan/zoom/tap-to-detail-sheet still work — viewers get the read content

## Test plan

- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] Owner regression check (FAB / action menu / Edit still work)
- [ ] Share viewer check (none of the above visible)

## Related

- Phase 7 plan: `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`
EOF
)"
```

---

## Task 5 — Tests + Phase 7 close-out + v0.3.0 release

**Branch:** `feat/phase-7/sub-task-5-tests-and-closeout` (cut from `qa` AFTER sub-task 4 is squash-merged).

**Files:**
- Create: `src/__tests__/actions/shareLink.test.ts`
- Create: `src/__tests__/rls/share_token.test.ts`
- Create: `src/__tests__/share/share-page.test.ts`
- Modify: `docs/qa/smoke-flows.md` — append `phase-7-share-link` flow
- Modify: `docs/tasks/current-phase.md` — tick all close-out boxes; flip to Phase 8 stub
- Modify: `docs/tasks/phase-backlog.md` — tick Phase 7 backlog items as relevant
- Modify: `package.json` + `pnpm-lock.yaml` (version bump only — happens during release-branch step)

### Step 5.1 — Cut the branch

- [ ] **Cut from updated qa**

```bash
git checkout qa
git pull --ff-only
git checkout -b feat/phase-7/sub-task-5-tests-and-closeout
```

### Step 5.2 — Write `src/__tests__/actions/shareLink.test.ts`

- [ ] **Create the action-tests file**

```ts
/**
 * Integration tests for the Phase 7 share-link Server Actions.
 *
 * Pattern mirrors `inviteEditor.test.ts`:
 *   - vi.mock('next/cache'), vi.mock('next/headers'), vi.mock('@/lib/supabase/server')
 *   - clientHolder.current swapped per-test for the desired role's client
 *   - ground-truth reads via the service-role admin client
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  addMember,
} from '../_helpers'

const clientHolder: { current: SupabaseClient | null } = { current: null }

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op */
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'origin' ? 'http://localhost:3000' : null),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!clientHolder.current) {
      throw new Error('Test setup bug: clientHolder.current not initialised')
    }
    return clientHolder.current
  },
}))

import {
  enableShareLink,
  regenerateShareToken,
  disableShareLink,
} from '@/app/tree/[id]/share/actions'

const OWNER_EMAIL = 'action-share-owner@test.local'
const EDITOR_EMAIL = 'action-share-editor@test.local'

const admin = adminClient()
let ownerId: string
let editorId: string
let treeId: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  editorId = await createTestUser(admin, EDITOR_EMAIL)

  const ownerClient = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(ownerClient, ownerId, 'shareLink Action Tree')

  // Pre-seed editor membership for the non-owner test.
  await addMember(admin, treeId, editorId, 'editor')
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  if (editorId) await admin.auth.admin.deleteUser(editorId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
  await deleteUserByEmail(admin, EDITOR_EMAIL)
})

beforeEach(async () => {
  // Reset share_token each test.
  await admin
    .from('trees')
    .update({ share_token: null })
    .eq('id', treeId)
  clientHolder.current = await signedInClient(OWNER_EMAIL)
})

describe('enableShareLink', () => {
  it('happy path — owner enables → token written, shareUrl returned', async () => {
    const res = await enableShareLink(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.shareToken).toBeTruthy()
    expect(res.shareToken!.length).toBeGreaterThanOrEqual(40) // base64url(32) = 43
    expect(res.shareUrl).toBe(`http://localhost:3000/share/${res.shareToken}`)

    // Ground-truth: token written to DB.
    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(res.shareToken)
  })

  it('already-enabled — second call rotates the token in place', async () => {
    const first = await enableShareLink(treeId)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await enableShareLink(treeId)
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(second.shareToken).not.toBe(first.shareToken)
    // DB row matches the second token (the first is dead).
    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(second.shareToken)
  })

  it('non-owner editor — returns forbidden, share_token stays null', async () => {
    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await enableShareLink(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(data?.share_token).toBeNull()
  })
})

describe('regenerateShareToken', () => {
  it('happy path — rotates token; old value is replaced', async () => {
    const first = await enableShareLink(treeId)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const rotated = await regenerateShareToken(treeId)
    expect(rotated.ok).toBe(true)
    if (!rotated.ok) return
    expect(rotated.shareToken).not.toBe(first.shareToken)

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string }>()
    expect(data?.share_token).toBe(rotated.shareToken)
  })

  it('non-owner editor — returns forbidden', async () => {
    await enableShareLink(treeId)
    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await regenerateShareToken(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')
  })

  it('regenerate from disabled state — works, mints fresh token', async () => {
    // share_token is null after beforeEach.
    const res = await regenerateShareToken(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.shareToken).toBeTruthy()
  })
})

describe('disableShareLink', () => {
  it('happy path — owner disables → share_token nulled', async () => {
    await enableShareLink(treeId)
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.shareToken).toBeNull()
    expect(res.shareUrl).toBeNull()

    const { data } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(data?.share_token).toBeNull()
  })

  it('idempotent — disabling an already-disabled tree returns ok', async () => {
    // beforeEach already set it to null. Disable again — still ok.
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(true)
  })

  it('non-owner editor — returns forbidden, share_token unchanged', async () => {
    await enableShareLink(treeId)
    const { data: before } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()

    clientHolder.current = await signedInClient(EDITOR_EMAIL)
    const res = await disableShareLink(treeId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')

    const { data: after } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeId)
      .single<{ share_token: string | null }>()
    expect(after?.share_token).toBe(before?.share_token)
  })
})
```

### Step 5.3 — Write `src/__tests__/rls/share_token.test.ts`

- [ ] **Create the RLS-matrix file**

```ts
/**
 * RLS coverage for `trees.share_token` writes.
 *
 * Only the tree's owner should be able to UPDATE share_token via the
 * existing `trees_update_owner` policy. This file proves the matrix:
 * ownerA, ownerB (different tree), editorA (member of treeA), anon.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  adminClient,
  anonClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
  addMember,
} from '../_helpers'

const OWNER_A_EMAIL = 'rls-share-owner-a@test.local'
const OWNER_B_EMAIL = 'rls-share-owner-b@test.local'
const EDITOR_A_EMAIL = 'rls-share-editor-a@test.local'

const admin = adminClient()

let ownerAId: string
let ownerBId: string
let editorAId: string
let treeAId: string

beforeAll(async () => {
  ownerAId = await createTestUser(admin, OWNER_A_EMAIL)
  ownerBId = await createTestUser(admin, OWNER_B_EMAIL)
  editorAId = await createTestUser(admin, EDITOR_A_EMAIL)

  const clientA = await signedInClient(OWNER_A_EMAIL)
  treeAId = await createTree(clientA, ownerAId, 'share RLS Tree A')

  const clientB = await signedInClient(OWNER_B_EMAIL)
  await createTree(clientB, ownerBId, 'share RLS Tree B') // unused but ensures B has a tree

  await addMember(admin, treeAId, editorAId, 'editor')
})

afterAll(async () => {
  if (ownerAId) await admin.auth.admin.deleteUser(ownerAId)
  if (ownerBId) await admin.auth.admin.deleteUser(ownerBId)
  if (editorAId) await admin.auth.admin.deleteUser(editorAId)
  await deleteUserByEmail(admin, OWNER_A_EMAIL)
  await deleteUserByEmail(admin, OWNER_B_EMAIL)
  await deleteUserByEmail(admin, EDITOR_A_EMAIL)
})

describe('trees.share_token RLS — UPDATE', () => {
  it('ownerA can UPDATE share_token on their own tree', async () => {
    const c = await signedInClient(OWNER_A_EMAIL)
    const { error, data } = await c
      .from('trees')
      .update({ share_token: 'token-from-owner-a' })
      .eq('id', treeAId)
      .select('id')
    expect(error).toBeNull()
    expect(data).not.toHaveLength(0)

    // Verify ground truth.
    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string }>()
    expect(row?.share_token).toBe('token-from-owner-a')

    // Cleanup.
    await admin.from('trees').update({ share_token: null }).eq('id', treeAId)
  })

  it('ownerB (cross-tree) UPDATE on tree A affects 0 rows', async () => {
    const c = await signedInClient(OWNER_B_EMAIL)
    const { error, data } = await c
      .from('trees')
      .update({ share_token: 'token-from-owner-b' })
      .eq('id', treeAId)
      .select('id')

    // Either error is non-null or no rows came back.
    expect(error == null && (data?.length ?? 0) === 0).toBe(true)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })

  it('editorA (member, not owner) UPDATE on tree A affects 0 rows', async () => {
    const c = await signedInClient(EDITOR_A_EMAIL)
    const { data } = await c
      .from('trees')
      .update({ share_token: 'token-from-editor-a' })
      .eq('id', treeAId)
      .select('id')
    expect(data?.length ?? 0).toBe(0)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })

  it('anon UPDATE on tree A affects 0 rows', async () => {
    const c = anonClient()
    const { data } = await c
      .from('trees')
      .update({ share_token: 'token-from-anon' })
      .eq('id', treeAId)
      .select('id')
    expect(data?.length ?? 0).toBe(0)

    const { data: row } = await admin
      .from('trees')
      .select('share_token')
      .eq('id', treeAId)
      .single<{ share_token: string | null }>()
    expect(row?.share_token).toBeNull()
  })
})
```

### Step 5.4 — Write `src/__tests__/share/share-page.test.ts`

- [ ] **Create the page-data tests**

```ts
/**
 * Phase 7 — share-page data path.
 *
 * Direct DB-level service-role reads that mirror the logic in
 * `src/app/share/[token]/page.tsx`. We don't render the React component
 * here; the value we want to lock in is the contract that:
 *   - a valid token returns the tree row
 *   - an invalid token returns null
 *   - a regenerated tree's OLD token returns null
 *   - a disabled tree (share_token = null) cannot be reached even by
 *     someone who knows the value was previously null
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  adminClient,
  signedInClient,
  createTestUser,
  deleteUserByEmail,
  createTree,
} from '../_helpers'

const OWNER_EMAIL = 'share-page-owner@test.local'
const admin = adminClient()
let ownerId: string
let treeId: string
let validToken: string

beforeAll(async () => {
  ownerId = await createTestUser(admin, OWNER_EMAIL)
  const c = await signedInClient(OWNER_EMAIL)
  treeId = await createTree(c, ownerId, 'share-page tests tree')

  // Seed a share_token directly via admin.
  validToken = 'test-share-token-' + Math.random().toString(36).slice(2)
  await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
})

afterAll(async () => {
  if (ownerId) await admin.auth.admin.deleteUser(ownerId)
  await deleteUserByEmail(admin, OWNER_EMAIL)
})

describe('share-page data lookup (service-role)', () => {
  it('valid token → returns the tree row', async () => {
    const { data } = await admin
      .from('trees')
      .select('id, name, description, share_token')
      .eq('share_token', validToken)
      .maybeSingle()
    expect(data).not.toBeNull()
    expect((data as { id: string }).id).toBe(treeId)
  })

  it('invalid token → returns null', async () => {
    const { data } = await admin
      .from('trees')
      .select('id, name')
      .eq('share_token', 'totally-not-a-real-token')
      .maybeSingle()
    expect(data).toBeNull()
  })

  it('rotated tree: looking up by the OLD token returns null', async () => {
    const newToken = 'rotated-token-' + Math.random().toString(36).slice(2)
    await admin.from('trees').update({ share_token: newToken }).eq('id', treeId)

    const { data: lookupOld } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', validToken)
      .maybeSingle()
    expect(lookupOld).toBeNull()

    const { data: lookupNew } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', newToken)
      .maybeSingle()
    expect((lookupNew as { id: string } | null)?.id).toBe(treeId)

    // Restore for the next test.
    await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
  })

  it('disabled tree (share_token = null) cannot be reached by lookup', async () => {
    await admin.from('trees').update({ share_token: null }).eq('id', treeId)

    // No row should match share_token = null because we always query with .eq()
    // — the share-page calls `.eq('share_token', token)` and never passes null.
    // Sanity-check the negative: an empty-string lookup also returns null.
    const { data } = await admin
      .from('trees')
      .select('id')
      .eq('share_token', '')
      .maybeSingle()
    expect(data).toBeNull()

    // Restore.
    await admin.from('trees').update({ share_token: validToken }).eq('id', treeId)
  })
})
```

### Step 5.5 — Run the test suite

- [ ] **Start the local Supabase stack if not already running**

```bash
pnpm exec supabase status || pnpm exec supabase start
```

- [ ] **Run the new tests in isolation first**

```bash
pnpm test --run src/__tests__/actions/shareLink.test.ts src/__tests__/rls/share_token.test.ts src/__tests__/share/share-page.test.ts
```

Expected: all 3 suites green, ~16 tests passing.

- [ ] **Run the full suite to verify no regressions**

```bash
pnpm test --run
```

Expected: 147 (Phase 6 baseline) + ~16 = ~163 tests passing.

### Step 5.6 — Append the `phase-7-share-link` smoke flow

- [ ] **Append to `docs/qa/smoke-flows.md`**

Add after the Phase 6 section (currently ends at "no orphan data left after cleanup" + the Skip rules block), and BEFORE the "Adding a new flow" section that starts around line 260:

```markdown
### Phase 7 — share link flows

All Phase 7 flows assume local dev server (`pnpm dev`) running at `http://localhost:3000` and local Supabase stack (`pnpm exec supabase start`). An incognito / private-browsing window is used to simulate the anonymous viewer.

#### `phase-7-share-link` *(env: local)*

Tests the Phase 7 ship gate — owner enables share link → copy URL → anon viewer in incognito sees read-only tree → owner regenerates → old URL 404s → owner disables → URL 404s.

1. **Pre-condition** — local dev server + Supabase running. Owner A is signed in (normal browser). An incognito window is open and not signed in. The Smith Family demo tree (or any owned tree with people) exists.
2. As A: open the tree (`/tree/<id>`). In the top bar, click the new `Share2` icon button (next to Members). Assert: the ShareLinkSheet opens with an "Enable read-only share link" button.
3. As A: click **Enable read-only share link**. Assert: a read-only URL input appears with a Copy button. The URL matches the pattern `http://localhost:3000/share/<43-char-token>`.
4. Copy the URL. In the incognito window, paste into the address bar and load. Assert: the page renders with a sticky banner ("You're viewing a shared family tree. Sign up to create your own ↗"), the tree-name heading, and the family-tree canvas below. NO FAB visible. NO three-dot button on cards. NO top-nav with Logo or profile menu.
5. As incognito viewer: tap any person. Assert: the PersonDetailSheet opens showing avatar, name, bio, dates, location, occupation, relations. NO "Edit" button visible at the bottom. Pan + pinch-zoom on the canvas: works.
6. As incognito viewer: click "Sign up to create your own" in the banner. Assert: lands at `/login`.
7. As A: go back to the tree's ShareLinkSheet. Click **Regenerate** → **Confirm regenerate**. Assert: the URL changes (token differs). The "Cancel regenerate" affordance dismisses correctly if clicked before Confirm.
8. As incognito viewer: reload the original (pre-regenerate) URL. Assert: 404 page renders ("Tree not found. This share link is no longer active.").
9. As A: copy the NEW URL. Paste into the incognito tab. Assert: tree loads again with all chrome from step 4.
10. As A: click **Disable sharing** → **Confirm disable**. Assert: the URL input disappears and the "Enable read-only share link" button reappears.
11. As incognito viewer: reload the (just-disabled) URL. Assert: 404 page renders.

**Pass:** all 11 steps complete; step 4 + 5 prove read-only lockdown; step 8 proves the regenerate kills the old URL; step 11 proves disable kills all URLs; no console errors; no orphan rows left after cleanup.

**Skip rules:**
- Running on `local` without `supabase start` → SKIP with reason "needs-local-supabase".
- `e2e-smoke-tester` agent tools-grant fix still unresolved → SKIP with reason "needs-tools-grant-fix"; manual QA on the local preview stands in.

---
```

### Step 5.7 — Final close-out edits to `docs/tasks/current-phase.md`

- [ ] **Tick sub-task 5 in `docs/tasks/current-phase.md`** — describe the 3 new test files, ~16 new tests, the smoke flow append, and the running suite total. Tick all phase close-out boxes:
  - All five sub-tasks ticked.
  - Per-sub-task docs ticks landed in the same commits.
  - Vitest suite passing.
  - Smoke flow walked manually (or `e2e-smoke-tester` ran it if the tools-grant blocker is finally fixed by the time this lands).
  - Manual QA pass on QA preview (left unchecked — done at release-PR review time).
  - Release version `v0.3.0`.
  - Phase 7 migration applied to QA — **n/a, no migration this phase**.
  - Phase 7 migration applied to prod — **deferred per pre-v1 policy; also n/a**.

(Dispatch `task-doc-keeper` to ALSO flip the document at phase close-out per its standing rule: mark the current Phase 7 section as ✅ closed and open a Phase 8 stub. The keeper agent knows the format.)

### Step 5.8 — Run typecheck + lint + full test suite one more time

- [ ] **Final verification**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: typecheck clean, lint shows only the pre-existing PersonForm warning, test suite ~163 passing.

### Step 5.9 — Commit the tests + close-out doc updates

- [ ] **Diff summary + ask user**

```bash
git status
git diff src/__tests__ docs/qa/smoke-flows.md docs/tasks/current-phase.md docs/tasks/phase-backlog.md
```

- [ ] **Commit**

```bash
git add src/__tests__ docs/qa/smoke-flows.md docs/tasks/current-phase.md docs/tasks/phase-backlog.md
git commit -m "$(cat <<'EOF'
test(phase-7): share-link tests + close-out + smoke flow

- src/__tests__/actions/shareLink.test.ts (9 tests)
- src/__tests__/rls/share_token.test.ts (4 tests)
- src/__tests__/share/share-page.test.ts (4 tests)
- docs/qa/smoke-flows.md: append phase-7-share-link (11 steps)
- docs/tasks/current-phase.md: tick all close-out boxes; flip to Phase 8

Phase 7 ship gate met:
  - Anon viewer hits /share/<token> → reads tree via service_role
  - Owner toggles enable / regenerate / disable from the tree-page Share sheet
  - Old tokens 404 after regenerate; URL 404s after disable
  - readOnly mode threaded through FamilyTree + DetailSheet
  - 17 new tests; suite total 164

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 5.10 — Dispatch supabase-validator

- [ ] **Dispatch the validator one final time**

The test suite touches DB. Per the standing rule: dispatch `supabase-validator` after this commit. Brief prompt: "Validate the Phase 7 RLS tests + the share-link Server Actions against the existing trees_update_owner policy. Confirm no advisor drift on local + QA. Verify the share-page service-role data-path tests don't accidentally leak data."

### Step 5.11 — Push, open PR

- [ ] **Push and open a draft PR**

```bash
git push -u origin feat/phase-7/sub-task-5-tests-and-closeout
gh pr create --draft --base qa --title "test(phase-7): share-link tests + close-out" --body "$(cat <<'EOF'
## Summary

- 17 new Vitest tests (actions + RLS + share-page data path)
- `phase-7-share-link` smoke flow appended
- `current-phase.md` flipped to Phase 8 stub

## Test plan

- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] `pnpm test --run` — full suite green (~163 tests)
- [ ] supabase-validator pass

## Phase 7 ship gate

- [x] Owner can enable / copy / regenerate / disable the share link
- [x] /share/<token> renders read-only tree without auth
- [x] Anonymous viewer sees banner + tree name + canvas (no FAB / action menu / Edit)
- [x] Old / disabled tokens 404

## Related

- Phase 7 plan: `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`
EOF
)"
```

### Step 5.12 — `release/v0.3.0` cut (after sub-task 5 squash-merged into qa)

- [ ] **Wait for the sub-task 5 PR to be marked ready by the user, then squash-merged into qa**

(Per memory rule: PRs open as drafts; user marks ready. Don't merge a draft.)

- [ ] **Cut the release branch**

```bash
git checkout qa
git pull --ff-only  # picks up sub-task 5
git checkout -b release/v0.3.0
pnpm version minor --no-git-tag-version  # 0.2.0 → 0.3.0
```

- [ ] **Verify package.json bumped, then commit + push**

```bash
git status  # should show package.json + pnpm-lock.yaml
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(release): v0.3.0 — Phase 7 share link

Closes the v0.3.0 milestone. Anonymous read-only share link wired
end-to-end with owner toggle/rotate/disable surface on the tree-page.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push -u origin release/v0.3.0
```

- [ ] **Open release PR into main with a merge commit**

```bash
gh pr create --base main --title "chore(release): v0.3.0 — Phase 7 share link" --body "$(cat <<'EOF'
## Release v0.3.0 — Phase 7 share link

Closes the third minor bump after v0.1.0 / v0.2.0.

## Ship gate met
- Owner can enable / copy / regenerate / disable read-only share link
- `/share/<token>` renders read-only family tree via `service_role`
- Anonymous viewer sees banner + tree name + canvas, no edit affordances
- Old / regenerated / disabled tokens 404

## Per pre-v1 policy
- No production DB or production-Vercel-config changes this release.
- No migrations this phase anyway (share_token + RLS already existed from Phase 0).

## Test plan
- [ ] Merge with **Create a merge commit** (NOT squash)
- [ ] After merge: `gh release create v0.3.0 --target main --prerelease`
- [ ] Forward-PR from release/v0.3.0 → qa to return the version bump
EOF
)"
```

- [ ] **Ask user to merge with Create a merge commit (NOT squash)**

The release recipe in `docs/dev/releases.md` requires a real merge commit. After the user merges:

- [ ] **Tag the release**

```bash
gh release create v0.3.0 --target main --prerelease --title "v0.3.0 — Phase 7 share link" --notes "$(cat <<'EOF'
## What's new

- **Anonymous read-only share link.** Owners enable a share toggle from the tree-page top bar, copy a URL like `/share/<token>`, and anyone with the link sees the family tree without signing in.
- **Read-only canvas mode.** Share viewers see the full tree + person detail (bio, dates, location, occupation, relations) with no edit affordances.
- **Rotate / disable.** Owners can regenerate the token (old URL dies immediately) or disable sharing entirely from the same sheet.

## Implementation
- New Server Actions at `src/app/tree/[id]/share/actions.ts`
- New `ShareLinkSheet` + Share button in the tree-page top bar
- New public route at `src/app/share/[token]/page.tsx` using `createServiceRoleClient()`
- `<FamilyTree readOnly>` mode threading through `personNodeHtml` + `<PersonDetailSheet>`

## Tests
- 17 new Vitest tests (action + RLS + share-page data path); suite total ~163

## What's NOT in this release
- Custom SMTP provider (Phase 9)
- `'use cache'` adoption (post-v0.1)
- Unified Tree Settings sheet (Phase 8)

See [`docs/superpowers/plans/2026-05-15-phase-7-share-link.md`](https://github.com/SanchitB23/meetthefam/blob/v0.3.0/docs/superpowers/plans/2026-05-15-phase-7-share-link.md) for the full plan and rationale.
EOF
)"
```

- [ ] **Forward-PR release/v0.3.0 → qa to return the version bump**

```bash
gh pr create --base qa --head release/v0.3.0 --title "chore(release): forward v0.3.0 bump to qa" --body "Forward-PR returning the 0.3.0 version bump to qa per the release recipe."
```

(User squash-merges this once it's green.)

---

## Verification

End-to-end checklist before declaring Phase 7 done:

1. **Owner flow (manual on local + QA preview):**
   - Open a tree → click Share icon → Enable → URL appears → Copy → Regenerate (Confirm) → URL changes → Disable (Confirm) → URL row disappears.

2. **Anon viewer flow (manual via incognito):**
   - Open `/share/<valid-token>` → see banner + heading + canvas → tap person → detail sheet shows content with NO Edit button → close → no FAB, no three-dot, no long-press menu → click banner CTA → land at `/login`.

3. **Negative flows (manual):**
   - `/share/<old-rotated-token>` → 404 page (heirloom-styled).
   - `/share/<token-of-disabled-tree>` → 404.
   - `/share/totally-not-real` → 404.

4. **Authenticated non-owner (manual):**
   - Editor account opens the Share sheet → sees a "Only the owner can manage…" read-only banner; no toggle buttons.

5. **RLS (automated):**

   ```bash
   pnpm test --run src/__tests__/rls/share_token.test.ts
   ```

   Expected: 4 tests pass; only `ownerA can UPDATE share_token` writes; the other three roles' UPDATEs affect 0 rows.

6. **Server Actions (automated):**

   ```bash
   pnpm test --run src/__tests__/actions/shareLink.test.ts
   ```

   Expected: 9 tests pass.

7. **Share-page data path (automated):**

   ```bash
   pnpm test --run src/__tests__/share/share-page.test.ts
   ```

   Expected: 4 tests pass.

8. **Full suite + lint + typecheck:**

   ```bash
   pnpm typecheck && pnpm lint && pnpm test --run
   ```

   Expected: all green; ~163 tests; the only lint warning is the pre-existing `PersonForm.tsx` `react-hooks/incompatible-library` one.

9. **Build:**

   ```bash
   pnpm build
   ```

   Expected: clean build (Vercel will run this on every PR push anyway).

10. **QA preview manual click-through** at release-PR review time — same scenarios as steps 1–4 above, on the actual QA Vercel deployment against the QA Supabase project.

---

## Notes from the brainstorm worth carrying into execution

- **No migration this phase.** `share_token text unique` + `trees_update_owner` RLS already exist. Don't author a defensive "drop and recreate" migration; nothing to do.
- **No `updateTag('share:<treeId>')`** — backlog item explicitly deferred to the `'use cache'` adoption window per ADR 0007. Stay on `revalidatePath`.
- **No `/signup` alias** — magic-link at `/login` IS our signup. Don't add cosmetic aliases.
- **No `'use cache'` / `cacheLife` profile** — share page is uncached by default; the optional cache item in the backlog is also deferred.
- **No phase-branch escape hatch** — per-sub-task → qa works fine; Phase 7 is sequential.
- **`/share` is already excluded from `proxy.ts`** — line 62 of `src/proxy.ts`. Don't edit it.
- **Token format is base64url** — matches Phase 6 invite tokens; don't reinvent.
- **`createServiceRoleClient()` is already extracted** — `src/lib/supabase/service.ts`. Reuse as-is; do NOT inline a fresh client.
- **`pnpm.onlyBuiltDependencies`** isn't touched this phase — no new dependencies.
- **Pre-v1 policy:** the release recipe SKIPS the prod-apply step. Skip it without comment; ADR 0009's amendment + `docs/dev/prod-readiness.md` document the policy.

---

## Plan complete

Plan saved to `docs/superpowers/plans/2026-05-15-phase-7-share-link.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session, batch with checkpoints. Uses `superpowers:executing-plans`.

Which approach?
