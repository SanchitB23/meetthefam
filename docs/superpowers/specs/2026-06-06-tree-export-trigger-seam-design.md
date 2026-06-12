# Tree-export trigger seam — design

> Spec for **#217** (`refactor/217-lift-container-ref`). Sub-issue of epic **#60 — Export tree as image / PDF**, milestone **v1.2 — Export & archival**.
> Branch stacked on the epic branch `feat/60-tree-export`.

## Problem

The export feature (#218) needs the DOM node that holds the rendered family-chart tree so a client-side rasteriser (`html-to-image`) can snapshot it. That node — the `.f3` container `<div>` filled with `svg.main_svg` — is owned by a `useRef` **inside** `FamilyTree` (`_components/FamilyTree.tsx:112`, attached at `:477`) and never escapes the component.

Product decision: the **Export button lives in the tree page's top bar**, next to the Settings gear. But that header is rendered by `TreeContent` — an `async` **Server Component** (`_components/TreeContent.tsx:33`) — which cannot hold a ref to a client child's DOM node. So a header button cannot reach `FamilyTree`'s `containerRef` directly.

This ticket establishes the **trigger seam** that bridges the header button to the in-`FamilyTree` capture logic, with a **stubbed capture** (no rasterise libs yet). #218 fills the stub with real capture.

## Chosen approach — CustomEvent bridge

The header button is a dumb trigger that dispatches a `CustomEvent`; `FamilyTree` (which owns `containerRef`) listens and performs the work. This mirrors the codebase's existing event patterns — `mtf-add-pending` and `mtf-add-relative` (see `FamilyTree.tsx:121-128`, `:300-307`) — so it is the idiomatic seam here. No `forwardRef`, no `useImperativeHandle`, no new client wrapper straddling the Server-Component header, no lifting of the DOM ref out of `FamilyTree`.

### Alternatives considered

- **`forwardRef` + client wrapper** — a new client component wraps the header button + `FamilyTree`, holds a ref, `FamilyTree` exposes its container via `useImperativeHandle` composed through the existing `memo()`. Typed and "classic React", but introduces a client boundary spanning header + body and pulls header layout client-side. Rejected: heavier than the problem warrants and against the grain of the existing event-driven patterns.
- **Context-provided ref** — a client `TreeExportProvider` wraps header + body; `FamilyTree` registers its `containerRef` into context; the button reads it. Decouples without events but still needs a provider around both regions and a register-ref-in-context pattern that is unusual to maintain. Rejected for the same reason.

## Architecture & data flow

```
TreeContent (Server Component)
 └─ header row
     └─ <ExportTreeButton>  (NEW client island)
          click  → dispatchExportTree({ format: 'png' })
          listens  onExportPending → disable button + spinner

FamilyTree (client; owns containerRef + the work; gated behind !readOnly)
     onExportTree:
       → setExporting(true) → emitExportPending({ pending: true })
       → withOverflowVisible(containerRef.current, () => captureStub(format))
       → emitExportPending({ pending: false }) → setExporting(false)
     renders <ExportProgressDialog open={exporting} />   ("Preparing export…")
```

- The header button is a pure trigger; it never touches the DOM node.
- `FamilyTree` owns: container access, the `overflow` toggle, the progress dialog, and the capture function.
- In #217 `captureStub(format)` resolves after a tick — **no file, no `html-to-image`, no `jspdf`**. #218 replaces the stub body and adds the PNG/PDF chooser UI.
- `emitExportPending` travels back to the header button so it can disable + show a spinner while a capture is in flight.

## Components & files

| Action | File | Purpose |
|---|---|---|
| NEW | `_lib/export-events.ts` | Typed event names, payloads, and thin dispatch/subscribe helpers (single source of truth for the contract) |
| NEW | `_components/ExportTreeButton.tsx` | Header client island — `Download` icon button; dispatches `mtf-export-tree`; reflects `mtf-export-pending` (disabled + spinner) |
| NEW | `_components/ExportProgressDialog.tsx` | Minimal base-nova `<Dialog>` showing "Preparing export…" while a capture runs |
| EDIT | `_components/TreeContent.tsx` | Render `<ExportTreeButton>` in the header row, only when `people.length > 0` |
| EDIT | `_components/FamilyTree.tsx` | Add the `onExportTree` listener effect (gated `!readOnly`), `exporting` state, `withOverflowVisible` helper, stub capture, and mount `<ExportProgressDialog>` |

## Event contract (`_lib/export-events.ts`)

```ts
export const EXPORT_TREE_EVENT = 'mtf-export-tree' as const
export const EXPORT_PENDING_EVENT = 'mtf-export-pending' as const

export type ExportFormat = 'png' | 'pdf'
export type ExportTreeDetail = { format: ExportFormat }
export type ExportPendingDetail = { pending: boolean }

export function dispatchExportTree(detail: ExportTreeDetail): void
export function onExportTree(cb: (d: ExportTreeDetail) => void): () => void
export function emitExportPending(detail: ExportPendingDetail): void
export function onExportPending(cb: (d: ExportPendingDetail) => void): () => void
```

- `format` is part of the contract from day one even though the stub ignores it; #218 reads it without a contract change.
- In #217 the button dispatches a default `format: 'png'`. The PNG/PDF chooser UI is #218.
- `on*` helpers return an unsubscribe function for clean `useEffect` teardown.

## readOnly / share-page gating

- The button lives in `TreeContent`, which renders **only** the authed tree page. The share page (`src/app/share/[token]/page.tsx`) has its own chrome and is **not touched** → the share view gets no export button. This satisfies #60's "share-link export out of scope for the first cut" automatically, with no feature flag.
- Defensively gate the `FamilyTree` `onExportTree` listener behind `!readOnly`, so the share-page `FamilyTree` instance ignores any stray `mtf-export-tree` event.
- Both **owner and editor** get the button — export produces read-only output, so there is no reason to restrict editors. No role gate.

## Testing (Vitest + Testing Library)

The seam is fully verifiable without any capture libraries:

- **`export-events` helpers** — `dispatch* ↔ on*` round-trip fires the callback with the correct payload; unsubscribe stops further callbacks.
- **`ExportTreeButton`** — click dispatches `mtf-export-tree` with `{ format: 'png' }`; on `mtf-export-pending { pending: true }` the button is disabled and shows a spinner; on `{ pending: false }` it re-enables.
- **`FamilyTree` listener** — receiving `mtf-export-tree` emits pending `true` then `false`, opens then closes the progress dialog, and the stub runs through `withOverflowVisible` (assert the container's `overflow` is restored to its original value afterward). A `readOnly` instance ignores the event (no pending emitted, no dialog).

## #217 vs #218 boundary

| #217 (this branch) | #218 (next) |
|---|---|
| Header button island + typed event contract + pending round-trip | Real `html-to-image` capture inside the stub |
| Progress dialog shell ("Preparing export…") | Progress detail / cancel |
| `withOverflowVisible` helper | PNG/PDF format chooser UI |
| Stub capture (resolves after a tick, no file) | `crossOrigin` already handled by #216 |
| Full test coverage of the seam | Capture / CORS / Safari testing |

(PDF + watermark is #219; full-tree-vs-current-view is gated by the #215 spike.)

## Notes

- **Icon:** lucide `Download`. Verify the exact export name against `lucide-react@1.x` via Context7 (`/lucide-icons/lucide`) before importing — the 0.x→1.0 rename has bitten this repo before.
- **No DB / RLS / migration / Server Action surface.** Strictly a client-side plumbing change.
- **`overflow` toggle:** the `.f3` container carries `overflow-hidden` (`FamilyTree.tsx:478`). `withOverflowVisible` temporarily sets the container's inline `overflow` to `visible`, runs the capture callback, then restores the prior inline value. In #217 this proves the seam reaches and mutates the correct node; #218 relies on it so the full tree extent (not just the visible window) is captured.
