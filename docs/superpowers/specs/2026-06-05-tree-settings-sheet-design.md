# Tree settings unified sheet — design

> Spec for [#119](https://github.com/SanchitB23/meetthefam/issues/119) — fold Rename + Members + Delete + Share into one role-aware "Tree settings" sheet.
> Brainstormed 2026-06-05. This ticket *is* the deferred Phase 8 locked-decision #9 brainstorm.

## Problem

Tree-level write operations are scattered across two surfaces, each built in isolation during Phases 5–7:

- **Dashboard tree card 3-dots** (`TreeCardMenu`, owner-only): Rename → `RenameTreeModal`, Manage members → `MembersSheet`, Delete → `DeleteTreeDialog`.
- **Tree page top bar** (`TreeContent`): Share → `ShareLinkSheet`, Members → `MembersSheet`.

`MembersSheet` is dual-mounted (both surfaces); Rename + Delete are dashboard-only; Share is tree-page-only. Four separate components, two separate open-state models, no single "tree settings" home. Note: the Phase 7 share link **has already shipped** as `ShareLinkSheet` — so this is a 4-concern consolidation, not the 3 the issue originally framed.

## Goal

A single role-aware **Tree settings** affordance that owns every tree-level write (rename / members / delete / read-only share link), with consistent chrome and a single open/close state per mount.

## Locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Seam = Option C**: one `<TreeSettingsSheet>` component, mounted on **both** the dashboard 3-dots and the tree-page top bar, each owning its own open-state. | Preserves the Phase 6 "manage members where the tree lives" decision *and* the dashboard-card flow. Mirrors how `MembersSheet` already dual-mounts (controlled on dashboard, uncontrolled on tree page) — proven pattern, no Phase-6 reversal. |
| 2 | **Layout = Tabbed** (segmented control), not stacked or accordion. | The Members section alone (list + pending invites + invite form) is tall; stacking all four concerns buries the Danger zone behind a long scroll on a 375px phone. Tabs keep each panel short. |
| 3 | **Tabs = General · Members · Visitors**, filtered by role. | See role table below. |
| 4 | **Delete = "Danger zone" subsection at the bottom of the General tab**, not its own tab. | Keeps Delete one tap from an owner's default view; avoids an owner-only single-action tab that editors would never see. |
| 5 | **"Visitors" replaces "Share" as the tab name.** | Parallels "Members": Members = people who *edit*, Visitors = people who *view* via the public read-only link. Clearer than "Share", which conceptually overlaps with Members. Only the label changes — the `Share2` icon and underlying actions stay. |

## Architecture

New client component: `src/app/(app)/tree/[id]/_components/TreeSettingsSheet.tsx`.

It follows the **exact responsive + controlled/uncontrolled pattern `MembersSheet` already uses**:

- `useIsDesktop()` → centered **Dialog** on desktop, bottom **Sheet** on mobile.
- **Controlled mode** (`open` + `onOpenChange`) for the dashboard; **uncontrolled mode** (`trigger` + internal state) for the tree page.
- `key={treeId}` remount to reset active-tab + form state per tree.
- shadcn / Base UI `Tabs` primitive for the segmented control.

**Composition, not rewrite.** The existing primitives' *bodies* are extracted into tab-panel sub-components and the standalone wrappers retired:

| Existing component | Becomes |
|--------------------|---------|
| `RenameTreeModal` (Dialog wrapper + form) | `GeneralPanel` — rename form + Danger-zone Delete. Wrapper deleted. |
| `DeleteTreeDialog` (Dialog wrapper + confirm form) | Danger-zone subsection inside `GeneralPanel`. Wrapper deleted. |
| `MembersSheet` (Dialog/Sheet wrapper + member list + invites + invite form) | `MembersPanel` — the section bodies move here (`MemberListRow`, `PendingInviteListRow`, `InviteForm` reused as-is). Wrapper retired. |
| `ShareLinkSheet` (Dialog/Sheet wrapper + share toggle/URL) | `VisitorsPanel` — section body moves here. Wrapper retired. |

**No DB / RLS / Server Action changes.** The Server Actions (`renameTree`, `deleteTree`, `inviteEditor`, `revokeInvite`, `resendInvite`, `revokeMember`, and the share-link actions) are untouched — this is a UI-composition change only. One small read-path extension is needed (see Data flow).

## Tab structure & role-awareness

Tabs are filtered by `currentUserRole`:

| Tab | Owner | Editor | Contents |
|-----|-------|--------|----------|
| **General** | ✓ | — | Rename field + "Danger zone" subsection (Delete, keeps the existing confirm flow). |
| **Members** | ✓ | ✓ | Member list. Invite form + revoke controls are owner-only (unchanged from today). |
| **Visitors** | ✓ | ✓ (read-only status) | Read-only share-link toggle / URL. Editor sees the existing "only the owner can manage the link" message. |

- **Owner** opens to **General**. **Editor** opens to **Members** — the General tab does not exist for editors, so there is no empty/awkward tab and no path to Rename/Delete.

## Data flow & state

Two mount contexts, mirroring `MembersSheet`'s existing handling:

- **Tree page** (`TreeContent.tsx`, Server Component): members, pending invites, and `share_token` are *already fetched server-side* and passed as props today → the gear-triggered sheet receives them directly; instant open, no client fetch.
- **Dashboard card** (`TreeCardMenu.tsx`): the card only has the `TreeRow` (id, name). On open, the sheet **lazy-fetches** via the existing `getMembersAndInvites(treeId)` Server Action (pattern already in `TreeCardMenu`), showing a loading skeleton until data lands.
  - **Read-path extension**: `share_token` is not on the dashboard `TreeRow` today. Extend `getMembersAndInvites` to also return `share_token` (or add a sibling field to its result) so the Visitors tab works from the dashboard. This is the *only* server-side change — a read, no schema/RLS change.

State owned by the sheet: the **active tab** (one piece of UI state). Each mount owns its own `open` state (per Option C — drift is acceptable; only one surface is visible at a time). Mutations continue to rely on the actions' existing `revalidatePath` to refresh server data.

## Entry points

- **Dashboard 3-dots** (`TreeCardMenu`): three menu items collapse to **one — "Tree settings"** — opening the sheet in controlled mode. Menu stays owner-only-gated, so the dashboard sheet always opens as owner (all three tabs).
- **Tree-page top bar** (`TreeContent`): the two icon buttons (Share + Members) collapse to **one gear icon** (`Settings` from `lucide-react`) opening the same sheet uncontrolled. Editors see the gear too — their sheet shows Members + Visitors only.

## Error handling

Unchanged from today:

- Each panel keeps its existing `ErrorAlert` + `mapErrorCode` inline error surfacing.
- Delete keeps its confirm step; member/invite revoke keeps its two-tap confirm.
- Dashboard lazy-fetch failure closes the sheet (current behavior). **Optional** nice-to-have: render an inline error card instead — flagged as optional, not required for DoD.

## Testing

- **Existing tests must stay green**: RLS + action tests (`renameTree`, `deleteTree`, `inviteEditor`, `revokeMember`, share actions) are untouched.
- **New coverage**:
  - Role-filtered tab set: owner sees General / Members / Visitors; editor sees Members / Visitors only; editor never sees General or any Delete control.
  - Open/close + active-tab state machine (controlled and uncontrolled mounts).
- **Manual**: mobile viewport 375 × 667 renders cleanly — no excessive scrolling within a tab, no clipped controls (DoD requirement).

## Definition of done (from the issue)

- ✅ A unified "Tree settings" affordance owns Rename / Members / Delete / Visitors, replacing the four current entries.
- ✅ Phase 6's tree-vs-dashboard seam is **preserved** (Option C keeps in-context member management on the tree page) — no reversal, so no ADR needed; this spec documents the rationale.
- ✅ Mobile 375 × 667 renders cleanly (tabbed layout chosen specifically for this).
- ✅ All existing tests pass; new tests cover the role-filtered tab set + open/close state machine.

## Out of scope

- New tree-level operations (archive, transfer ownership). Only folding what exists.
- Visual rework of the underlying primitives (rename input, member rows, delete confirm, share toggle) — these got their Phase 8 polish already.
- Any DB / RLS / Server Action *write* changes. The only server-side change is extending one read action to return `share_token`.
