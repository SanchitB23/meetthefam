# Tree-export Trigger Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a top-bar "Export" button to a CustomEvent seam that `FamilyTree` listens on, owning container access + a stubbed capture, so #218 can drop in real rasterisation with zero plumbing work.

**Architecture:** A header client island (`ExportTreeButton`) dispatches `mtf-export-tree`; a `useExportTrigger` hook inside `FamilyTree` listens, manages `exporting` state, wraps a stub `captureTree` in `withOverflowVisible`, and round-trips `mtf-export-pending` back to the button (disable + spinner). All logic lives in small, independently-testable units; `FamilyTree` only consumes the hook + mounts a progress dialog. No `forwardRef`, no DOM ref lifted out of `FamilyTree`.

**Tech Stack:** Next.js 16 client components, React 19 hooks, `CustomEvent` on `window`, base-nova shadcn `<Dialog>`, lucide-react 1.x `Download`, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-06-tree-export-trigger-seam-design.md`

> **Note on file decomposition (refines the spec's file list):** the spec listed `withOverflowVisible` + capture + listener as edits inside `FamilyTree`. To keep the seam unit-testable *without* mounting `family-chart` (which needs d3 + heavy DOM), this plan extracts them into `_lib/with-overflow-visible.ts`, `_lib/capture-tree.ts`, and a `_lib/useExportTrigger.ts` hook. Same design, decomposed for testability — exactly the spec's stated goal of "units that can be tested independently."

---

## File structure

| Action | File | Responsibility |
|---|---|---|
| Create | `src/app/(app)/tree/[id]/_lib/export-events.ts` | Typed event names, payload types, dispatch/subscribe helpers — the contract |
| Create | `src/app/(app)/tree/[id]/_lib/with-overflow-visible.ts` | Pure DOM util: run a fn with an element's `overflow` forced visible, then restore |
| Create | `src/app/(app)/tree/[id]/_lib/capture-tree.ts` | Stub capture fn (`async`, no-op) — #218 fills the body |
| Create | `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts` | Hook: listens for `mtf-export-tree`, manages `exporting`, emits pending, wraps capture |
| Create | `src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx` | Presentational base-nova `<Dialog>` — "Preparing export…" |
| Create | `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx` | Header client island — `Download` button, dispatches event, reflects pending |
| Modify | `src/app/(app)/tree/[id]/_components/FamilyTree.tsx` | Consume `useExportTrigger`, mount `<ExportProgressDialog>` |
| Modify | `src/app/(app)/tree/[id]/_components/TreeContent.tsx` | Render `<ExportTreeButton>` in the header (only when `people.length > 0`) |
| Create | `src/__tests__/lib/export-events.test.ts` | Round-trip + payload tests for the contract |
| Create | `src/__tests__/lib/with-overflow-visible.test.ts` | Visible-during / restore-after tests |
| Create | `src/__tests__/lib/capture-tree.test.ts` | Stub resolves |
| Create | `src/__tests__/lib/useExportTrigger.test.ts` | Listener: pending round-trip, readOnly gating, overflow restore |
| Create | `src/__tests__/components/ExportTreeButton.test.tsx` | Click dispatches; pending disables + spinner |
| Create | `src/__tests__/components/ExportProgressDialog.test.tsx` | Open renders title; closed hides it |

All paths below use the literal directory `src/app/(app)/tree/[id]/` — the `(app)` and `[id]` segments are real folder names (route group + dynamic segment), not placeholders.

---

## Task 1: Event contract (`export-events.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/export-events.ts`
- Test: `src/__tests__/lib/export-events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/export-events.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchExportTree,
  emitExportPending,
  onExportPending,
  onExportTree,
} from '@/app/(app)/tree/[id]/_lib/export-events'

describe('export-events', () => {
  it('round-trips an export-tree event with its format payload', () => {
    const cb = vi.fn()
    const off = onExportTree(cb)
    dispatchExportTree({ format: 'png' })
    expect(cb).toHaveBeenCalledWith({ format: 'png' })
    off()
    dispatchExportTree({ format: 'pdf' })
    expect(cb).toHaveBeenCalledTimes(1) // unsubscribed → no second call
  })

  it('round-trips an export-pending event', () => {
    const cb = vi.fn()
    const off = onExportPending(cb)
    emitExportPending({ pending: true })
    emitExportPending({ pending: false })
    expect(cb).toHaveBeenNthCalledWith(1, { pending: true })
    expect(cb).toHaveBeenNthCalledWith(2, { pending: false })
    off()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/export-events.test.ts`
Expected: FAIL — cannot resolve `@/app/(app)/tree/[id]/_lib/export-events`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/export-events.ts
// Trigger-seam event contract for tree export (#217). Mirrors the existing
// `mtf-add-pending` / `mtf-add-relative` CustomEvent patterns in this folder.
// The capture work lives in FamilyTree (via useExportTrigger); the header
// button is a dumb trigger. `format` rides the contract from day one even
// though #217's stub ignores it — #218 reads it without a contract change.

export const EXPORT_TREE_EVENT = 'mtf-export-tree' as const
export const EXPORT_PENDING_EVENT = 'mtf-export-pending' as const

export type ExportFormat = 'png' | 'pdf'
export type ExportTreeDetail = { format: ExportFormat }
export type ExportPendingDetail = { pending: boolean }

export function dispatchExportTree(detail: ExportTreeDetail): void {
  window.dispatchEvent(new CustomEvent(EXPORT_TREE_EVENT, { detail }))
}

export function onExportTree(cb: (detail: ExportTreeDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ExportTreeDetail>).detail)
  window.addEventListener(EXPORT_TREE_EVENT, handler)
  return () => window.removeEventListener(EXPORT_TREE_EVENT, handler)
}

export function emitExportPending(detail: ExportPendingDetail): void {
  window.dispatchEvent(new CustomEvent(EXPORT_PENDING_EVENT, { detail }))
}

export function onExportPending(cb: (detail: ExportPendingDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ExportPendingDetail>).detail)
  window.addEventListener(EXPORT_PENDING_EVENT, handler)
  return () => window.removeEventListener(EXPORT_PENDING_EVENT, handler)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/export-events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-events.ts src/__tests__/lib/export-events.test.ts
git commit -m "feat(#217): typed CustomEvent contract for tree-export seam"
```

---

## Task 2: Overflow helper (`with-overflow-visible.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/with-overflow-visible.ts`
- Test: `src/__tests__/lib/with-overflow-visible.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/with-overflow-visible.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { withOverflowVisible } from '@/app/(app)/tree/[id]/_lib/with-overflow-visible'

describe('withOverflowVisible', () => {
  it('forces overflow visible during the callback and restores it after', async () => {
    const el = document.createElement('div')
    el.style.overflow = 'hidden'

    let seenDuring = ''
    const result = await withOverflowVisible(el, () => {
      seenDuring = el.style.overflow
      return 42
    })

    expect(seenDuring).toBe('visible')
    expect(el.style.overflow).toBe('hidden') // restored
    expect(result).toBe(42)
  })

  it('restores overflow even if the callback throws', async () => {
    const el = document.createElement('div')
    el.style.overflow = 'hidden'
    await expect(
      withOverflowVisible(el, () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(el.style.overflow).toBe('hidden')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/with-overflow-visible.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/with-overflow-visible.ts
// The .f3 tree container carries `overflow-hidden` (FamilyTree.tsx) so
// family-chart's own pan/zoom chrome clips cleanly. To capture the FULL
// rendered tree (not just the visible window) the capture step temporarily
// lifts that clip. This util sets inline `overflow: visible`, runs the
// callback, then restores whatever inline value was there before.

export async function withOverflowVisible<T>(
  el: HTMLElement,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev = el.style.overflow
  el.style.overflow = 'visible'
  try {
    return await fn()
  } finally {
    el.style.overflow = prev
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/with-overflow-visible.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/with-overflow-visible.ts src/__tests__/lib/with-overflow-visible.test.ts
git commit -m "feat(#217): withOverflowVisible DOM helper for tree capture"
```

---

## Task 3: Stub capture (`capture-tree.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/capture-tree.ts`
- Test: `src/__tests__/lib/capture-tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/capture-tree.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

describe('captureTree (stub)', () => {
  it('resolves without producing a file (placeholder for #218)', async () => {
    const el = document.createElement('div')
    await expect(captureTree(el, 'png')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/capture-tree.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/capture-tree.ts
// STUB for #217. The trigger seam (button → event → FamilyTree → this fn)
// is fully wired and tested, but the actual rasterisation is deferred to
// #218, which will dynamic-import `html-to-image`, embed photos as data
// URLs (CORS handled by #216), and trigger the download. Until then this
// resolves immediately so the seam is observable end-to-end.
import type { ExportFormat } from './export-events'

export async function captureTree(
  _container: HTMLElement,
  _format: ExportFormat,
): Promise<void> {
  // #218: replace with real html-to-image capture + download.
  await Promise.resolve()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/capture-tree.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/capture-tree.ts src/__tests__/lib/capture-tree.test.ts
git commit -m "feat(#217): stub captureTree (real capture deferred to #218)"
```

---

## Task 4: Trigger hook (`useExportTrigger.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts`
- Test: `src/__tests__/lib/useExportTrigger.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/useExportTrigger.test.ts
/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RefObject } from 'react'
import {
  dispatchExportTree,
  onExportPending,
  type ExportPendingDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { useExportTrigger } from '@/app/(app)/tree/[id]/_lib/useExportTrigger'

function makeContainer(): { el: HTMLDivElement; ref: RefObject<HTMLElement | null> } {
  const el = document.createElement('div')
  el.style.overflow = 'hidden'
  return { el, ref: { current: el } }
}

describe('useExportTrigger', () => {
  it('round-trips pending true→false and restores overflow on export', async () => {
    const { el, ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    renderHook(() => useExportTrigger(ref, { readOnly: false }))
    dispatchExportTree({ format: 'png' })

    await waitFor(() => expect(pending).toContain(false))
    expect(pending[0]).toBe(true)
    expect(pending[pending.length - 1]).toBe(false)
    expect(el.style.overflow).toBe('hidden') // restored after capture
    off()
  })

  it('ignores the event when readOnly (share page)', async () => {
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    renderHook(() => useExportTrigger(ref, { readOnly: true }))
    dispatchExportTree({ format: 'png' })

    // Give any (incorrect) async handler a chance to run.
    await new Promise((r) => setTimeout(r, 20))
    expect(pending).toEqual([])
    off()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/useExportTrigger.test.ts`
Expected: FAIL — cannot resolve `useExportTrigger`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/useExportTrigger.ts
'use client'
// Owns the FamilyTree side of the export seam (#217): listens for
// `mtf-export-tree`, flips `exporting` state, round-trips `mtf-export-pending`
// so the header button can disable itself, and runs the (stubbed) capture
// wrapped in withOverflowVisible so the full tree extent is reachable.
// Gated behind `readOnly` so the share-page FamilyTree ignores stray events.
import { useEffect, useState, type RefObject } from 'react'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
import { withOverflowVisible } from './with-overflow-visible'
import { captureTree } from './capture-tree'

export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly }: { readOnly: boolean },
): { exporting: boolean } {
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (readOnly) return
    return onExportTree(async ({ format }) => {
      const el = containerRef.current
      if (!el) return
      setExporting(true)
      emitExportPending({ pending: true })
      try {
        await withOverflowVisible(el, () => captureTree(el, format))
      } finally {
        emitExportPending({ pending: false })
        setExporting(false)
      }
    })
  }, [containerRef, readOnly])

  return { exporting }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/useExportTrigger.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/useExportTrigger.ts src/__tests__/lib/useExportTrigger.test.ts
git commit -m "feat(#217): useExportTrigger hook — FamilyTree side of export seam"
```

---

## Task 5: Progress dialog (`ExportProgressDialog.tsx`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx`
- Test: `src/__tests__/components/ExportProgressDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ExportProgressDialog.test.tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExportProgressDialog } from '@/app/(app)/tree/[id]/_components/ExportProgressDialog'

describe('ExportProgressDialog', () => {
  it('shows the preparing message when open', () => {
    render(<ExportProgressDialog open />)
    expect(screen.getByText('Preparing export…')).toBeInTheDocument()
  })

  it('renders nothing visible when closed', () => {
    render(<ExportProgressDialog open={false} />)
    expect(screen.queryByText('Preparing export…')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/ExportProgressDialog.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx
'use client'
// Minimal progress shell for the export seam (#217). Modal, no close affordance
// while a capture runs. #218 may extend it with progress detail / cancel.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ExportProgressDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={() => { /* locked while exporting */ }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Preparing export…</DialogTitle>
          <DialogDescription>
            Capturing your family tree. This can take a few seconds.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/ExportProgressDialog.test.tsx`
Expected: PASS (2 tests).

> If the base-nova `<DialogContent>` requires a visually-hidden title for a11y and warns, the explicit `<DialogTitle>` above already satisfies it. If a test fails because the portal renders outside the container, use `screen` (document-level queries) as written — not `container`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/ExportProgressDialog.tsx src/__tests__/components/ExportProgressDialog.test.tsx
git commit -m "feat(#217): ExportProgressDialog progress shell"
```

---

## Task 6: Header button (`ExportTreeButton.tsx`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx`
- Test: `src/__tests__/components/ExportTreeButton.test.tsx`

- [ ] **Step 1: Verify the lucide icon name**

Before writing the component, confirm `Download` is the correct export in `lucide-react@1.x` (the 0.x→1.0 rename has bitten this repo). Quick check:

Run: `pnpm exec node -e "import('lucide-react').then(m => console.log(typeof m.Download))"`
Expected: `function`. If it prints `undefined`, resolve the correct name via Context7 (`/lucide-icons/lucide`) and substitute it everywhere below.

- [ ] **Step 2: Write the failing test**

```tsx
// src/__tests__/components/ExportTreeButton.test.tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EXPORT_TREE_EVENT,
  emitExportPending,
  type ExportTreeDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { ExportTreeButton } from '@/app/(app)/tree/[id]/_components/ExportTreeButton'

describe('ExportTreeButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dispatches mtf-export-tree with png format on click', () => {
    const seen: ExportTreeDetail[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent<ExportTreeDetail>).detail)
    window.addEventListener(EXPORT_TREE_EVENT, handler)

    render(<ExportTreeButton />)
    fireEvent.click(screen.getByRole('button', { name: /export tree/i }))

    expect(seen).toEqual([{ format: 'png' }])
    window.removeEventListener(EXPORT_TREE_EVENT, handler)
  })

  it('disables while a capture is pending and re-enables after', async () => {
    render(<ExportTreeButton />)
    const btn = screen.getByRole('button', { name: /export tree/i })
    expect(btn).toBeEnabled()

    emitExportPending({ pending: true })
    await screen.findByRole('button', { name: /exporting/i })
    expect(screen.getByRole('button')).toBeDisabled()

    emitExportPending({ pending: false })
    await screen.findByRole('button', { name: /export tree/i })
    expect(screen.getByRole('button')).toBeEnabled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/ExportTreeButton.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 4: Write minimal implementation**

```tsx
// src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx
'use client'
// Header trigger for tree export (#217). A dumb dispatcher: it never touches
// the tree DOM. Clicking fires `mtf-export-tree`; FamilyTree (via
// useExportTrigger) does the work and round-trips `mtf-export-pending` so this
// button can disable + spinner while a capture runs. #218 adds a PNG/PDF
// chooser; for now it dispatches a default png.
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dispatchExportTree, onExportPending } from '../_lib/export-events'

export function ExportTreeButton() {
  const [pending, setPending] = useState(false)

  useEffect(() => onExportPending(({ pending }) => setPending(pending)), [])

  return (
    <button
      type="button"
      aria-label={pending ? 'Exporting tree…' : 'Export tree'}
      title={pending ? 'Exporting tree…' : 'Export tree'}
      disabled={pending}
      onClick={() => dispatchExportTree({ format: 'png' })}
      className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <svg
          className="animate-spin h-5 w-5 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <Download className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/ExportTreeButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/ExportTreeButton.tsx src/__tests__/components/ExportTreeButton.test.tsx
git commit -m "feat(#217): ExportTreeButton header island"
```

---

## Task 7: Wire the hook + dialog into FamilyTree

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/FamilyTree.tsx`

No new behaviour-test here — `family-chart` needs d3 + heavy DOM that jsdom can't host, and the seam logic is already covered by Task 4 (hook) + Task 5 (dialog). This task is verified by `pnpm typecheck` + the existing suite staying green + a manual smoke at the end.

- [ ] **Step 1: Add the imports**

In `FamilyTree.tsx`, after the existing local imports (the block ending with `import { ZoomControls } from './ZoomControls'`), add:

```ts
import { ExportProgressDialog } from './ExportProgressDialog'
import { useExportTrigger } from '../_lib/useExportTrigger'
```

- [ ] **Step 2: Consume the hook**

Inside `FamilyTreeImpl`, immediately after the existing `const currentFocusId = hashFocus ?? initialFocusId ?? null` line (~line 161), add:

```ts
  // #217 — export trigger seam. Listens for the top-bar Export button's
  // `mtf-export-tree` event, drives the progress dialog, and (in #218) runs
  // the real capture. Gated behind readOnly so the share-page instance is inert.
  const { exporting } = useExportTrigger(containerRef, { readOnly })
```

- [ ] **Step 3: Mount the dialog**

In the returned JSX, immediately after the closing `</div>` of the `relative` wrapper that contains `<ZoomControls ... />` (i.e. right after the line `</div>` that closes the `<div className="relative">` block, before `<PersonDetailSheet ... />`), add:

```tsx
      <ExportProgressDialog open={exporting} />
```

- [ ] **Step 4: Verify typecheck + full suite**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm exec vitest run`
Expected: all tests pass (new + pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/FamilyTree.tsx
git commit -m "feat(#217): wire useExportTrigger + progress dialog into FamilyTree"
```

---

## Task 8: Render the button in the header

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/TreeContent.tsx`

- [ ] **Step 1: Add the import**

At the top of `TreeContent.tsx`, with the other `_components` imports (near `import { FamilyTree } from './FamilyTree'`), add:

```ts
import { ExportTreeButton } from './ExportTreeButton'
```

- [ ] **Step 2: Render the button in the header row**

In the header `<div className="flex items-center gap-3 mb-6 max-w-4xl mx-auto">`, insert the button between the `<h1>…</h1>` title and the `<TreeSettingsSheet … />`. It must only appear when there are people to export. Add immediately before `<TreeSettingsSheet`:

```tsx
        {people.length > 0 && <ExportTreeButton />}
```

(`people` is already in scope — it's computed above as `const people = peopleRows ?? []`.)

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors. (If lint reports phantom errors from a stale worktree under `.claude/worktrees/`, run `git worktree list` and remove any unexpected ones — see project memory.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/TreeContent.tsx
git commit -m "feat(#217): render Export button in tree-page header (#60)"
```

---

## Task 9: Final verification gates

- [ ] **Step 1: Full quality gate**

Run: `pnpm typecheck && pnpm lint && pnpm exec vitest run`
Expected: all green. The 6 new test files (export-events, with-overflow-visible, capture-tree, useExportTrigger, ExportProgressDialog, ExportTreeButton) pass, and no pre-existing test regressed.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `pnpm dev` and open a tree with ≥1 person.
Expected:
- A Download icon button appears in the header next to the Settings gear.
- Clicking it briefly shows the "Preparing export…" dialog, the button shows a spinner + is disabled, then both clear within a tick (stub capture — no file downloads yet; that's #218).
- Open a `/share/[token]` link: **no** Export button in the share chrome, and dispatching is inert there.
- An empty tree (0 people): **no** Export button.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin refactor/217-lift-container-ref
```

> Note: the worktree branch tracks the epic branch `feat/60-tree-export`; `-u origin refactor/217-lift-container-ref` repoints upstream to its own remote branch so the PR can target the epic branch (or `qa`, per the team's stacking decision for #60).

---

## Self-review checklist (completed during authoring)

- **Spec coverage:** CustomEvent bridge (Tasks 1, 4, 6) ✓ · stub capture (Task 3) ✓ · button in header (Task 8) ✓ · progress dialog (Task 5) ✓ · `withOverflowVisible` (Task 2) ✓ · readOnly/share gating (Task 4 hook gate + Task 8 lives only in TreeContent) ✓ · pending round-trip (Tasks 4 + 6) ✓ · full seam test coverage (Tasks 1–6) ✓ · lucide `Download` verify (Task 6 Step 1) ✓.
- **Type consistency:** `ExportFormat`/`ExportTreeDetail`/`ExportPendingDetail` defined once in Task 1 and reused unchanged in Tasks 3, 4, 6. `dispatchExportTree` / `onExportTree` / `emitExportPending` / `onExportPending` / `withOverflowVisible` / `captureTree` / `useExportTrigger` signatures match across definition and call sites.
- **No placeholders:** every code step is complete; the only intentional stub (`captureTree`) is the spec-mandated #217 boundary and is documented as such.
