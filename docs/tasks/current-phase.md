# Current phase: 4 — Tree visualization (planning)

## Goal

family-chart renders a real tree from real data; tap → bottom sheet; long-press / "…" → action menu; pan + zoom; URL hash carries focus person.

Per the spec ([`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → Phase 4 row).

## Sub-tasks

_To be scoped in a future brainstorm/plan session before sub-task 1 starts._ See the Phase 4 backlog items in [`phase-backlog.md`](phase-backlog.md) for the standing TODOs that will fold into the sub-task slicing (PersonNode go/no-go spike, `<ViewTransition>` defer-or-promote, mobile FAB pattern, etc.).

> **Workflow note** — Phase 4 is the first phase shipped under the feature-branch workflow ([ADR 0010](../adrs/0010-feature-branch-workflow.md)). Each sub-task and incidental fix lands on its own Conventional-Commit-prefixed branch (`feat/phase-4/sub-task-N-<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, etc.), PR'd into `qa` with squash-merge. The release at the end of the phase rides a `release/v0.0.5` branch from `qa` into `main` (merge commit), then back into `qa` (squash) per [ADR 0009 §4](../adrs/0009-versioning-and-releases.md) — see CLAUDE.md → "Releases" for the full recipe.

---

## Previous phase: 3 — People CRUD + linking (✅ closed)

Closed with **`v0.0.4`**. See [release notes](https://github.com/SanchitB23/meetthefam/releases/tag/v0.0.4).

**Ship gate (met)**:

- Navigating `/dashboard` → tapping a tree card → lands on `/tree/[id]` showing the tree name + a person list (or empty state). Non-members get a 404 via RLS.
- Add a person via "+" FAB → row appears immediately (`revalidatePath`); tone auto-assigned by the DB trigger.
- Edit a person from the card menu → form prefills, save updates the row + the list; tone-override swatch works.
- Delete a person → confirmation modal → row removed, any inbound FKs (other rows pointing at it as spouse / father / mother) nulled atomically via RPC.
- Set spouse from the card menu → both `A.spouse_id` and `B.spouse_id` are set (bidirectional sync); clearing spouse nulls both sides.
- Set parents → ancestor-cycle detection rejects "make grandpa my son" with a clear error toast; the person-picker UI also guards obvious cases (self, descendants).
- Add child → opens the create form with parents prefilled (focus person + their spouse if any).
- Vitest RLS suite for `people` passes: non-members blocked on SELECT / INSERT / UPDATE / DELETE; editors can read + write; anon has no access. Spouse-symmetry + cycle-detection integration tests pass.

**Sub-tasks (all closed)**:

- [x] **Sub-task 1** — Page shell + `<Avatar>` + read-only person-list at `/tree/[id]`. Server Component using `PageProps<'/tree/[id]'>`; RLS-gated `trees` + `people` fetches; `notFound()` on missing tree; back-arrow + tree-name header; empty state with disabled "+ Add the first person" CTA (wired in sub-task 2). `<Avatar>` component per [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md) (photo fallback → tone-tinted initials in Cormorant Garamond). `PersonList` grid + `PersonCard` (avatar + name + italic nickname + relations summary + birth/death years). Dashboard `<TreeCard>` switched from `#` to `/tree/${id}` using the stretched-link pattern. *(commit `c6552a6`)*
- [x] **Sub-task 2** — Add person (no linking). Installed shadcn `Sheet` (`src/components/ui/sheet.tsx`, hand-ported from the base-nova registry since `cn` + `Button` already existed locally). `PersonForm.tsx` (`react-hook-form`, Sheet on mobile / Dialog on desktop via a `useSyncExternalStore` media-query hook) — all 10 fields per [`../ux/add-edit-person.md`](../ux/add-edit-person.md) minus photo (deferred to Phase 5); conditional `death_year` via `watch('deceased')`. `AddPersonFab` floating "+" bottom-right (48×48, Lucide `Plus`); `AddPersonControls` owns shared `open` state for FAB + empty-state CTA. `createPerson(treeId, data)` Server Action trims strings → null, validates `full_name` (≤80), inserts with `tone: null` (DB trigger fills it), `revalidatePath('/tree/${treeId}')`; RLS gates via `people_insert_editor`. `react-hook-form` added to `package.json`. *(commit `1b01a1c`)*
- [x] **Sub-task 3** — Edit + delete person. `PersonForm` extended with `mode: 'create' | 'edit'` + optional `person` / `onSaved` props (edit-mode prefills via `valuesFromPerson()`, renders the 5-swatch tone-override radio with `role="radiogroup"` + `aria-checked` semantics, and renders a destructive Delete CTA that opens `<DeletePersonDialog>` inline). `PersonList` flipped to `'use client'` and owns shared `editId` state so a single edit-form instance services the whole grid — `PersonCard` stays presentational (option (c) from the plan, leaves room for `PersonCardMenu` in sub-task 4). `birth_date` is omitted from the submit patch when blank (the sub-task-1 `PersonRow` SELECT doesn't include it). `DeletePersonDialog` mirrors `DeleteTreeDialog` but uses `useTransition` to match the `{ ok, error }` shape of `deletePerson`. Migration `20260512111009_delete_person_rpc.sql` adds `delete_person_atomic(p_person_id)` — a `SECURITY INVOKER` single-statement `DELETE`; the schema's existing `ON DELETE SET NULL` on `father_id` / `mother_id` / `spouse_id` cleanly handles inbound-pointer nullification without firing the `people_touch_updated_at` trigger on partner rows. `updatePerson(personId, treeId, data)` Server Action writes a sparse patch (no-op early return when empty, `tone` validated at runtime against the 5-tone enum, `deceased` + `death_year` move together); `deletePerson(personId, treeId)` calls the RPC. *(commit `4fbb06d`)*
- [x] **Sub-task 4** — Linking after creation. Migration `20260512112332_people_link_rpcs.sql` adds three `SECURITY INVOKER` plpgsql functions: `set_spouse_atomic` (bidirectional symmetric bond, clears prior bond on either side, rejects self-spouse + cross-tree), `set_parents_atomic` (nullable args, ancestor-cycle check via recursive CTE walking `father_id` + `mother_id` from both new parents with `UNION` for termination on pre-existing cycles, rejects self-as-parent + cross-tree), `clear_spouse_atomic` (idempotent nulls both ends). All exceptions use `errcode = 'P0001'` with user-facing strings surfaced verbatim to the UI. Hand-ported shadcn `Command` primitive (`src/components/ui/command.tsx`) backed by new `cmdk@^1.1.1` dep (Base UI doesn't ship Command; cmdk is the shadcn-default across presets). Shared `useIsDesktop` hook extracted out of `PersonForm` to `src/components/ui/use-is-desktop.ts` for `PersonPicker` + `SetParentsDialog`. New components: `PersonPicker` (Sheet on mobile / Dialog on desktop, cmdk-powered search on `${full_name} ${nickname}` lowercased, exposes a `footer` slot for inline errors), `SetParentsDialog` (joint Father + Mother flow with dynamic exclusion sets so the same person can't fill both roles; state-reset via the render-phase "session key" pattern to satisfy `react-hooks/set-state-in-effect`), `PersonCardMenu` (per-card `...` dropdown — Set spouse / Set parents / Add child *(soon — sub-task 5)* / Clear spouse / Edit / Delete, computes exclusion sets via the new helpers). `_lib/relations.ts` adds `collectAncestors` + `collectDescendants` helpers with visited-set termination. `PersonList` refactored to the stretched-button pattern (relative wrapper, z-0 absolute `<button>` for tap-to-edit, z-10 card content with `pointer-events-none`, z-10 menu in top-right with `pointer-events-auto`) — avoids the button-inside-button invalid HTML the sub-task 3 pattern would have produced once the menu landed. `actions.ts` adds `setSpouse`, `setParents`, `clearSpouse` Server Actions calling the new RPCs by name. Manual matrix test against the seeded Smith Family Demo data passes (cycle / self-spouse / cross-tree / 4-gen cases); Vitest coverage of the rejection paths lands in sub-task 6. *(commit `9e51c12`)*
- [x] **Sub-task 5** — Linking at creation. `createPerson(treeId, data, linkSpec?)` extended with an optional `LinkSpecInput` discriminated union (`spouse | father | mother | child` + `focusPersonId`); after the row insert succeeds, a private `applyLinkSpec` helper composes the sub-task-4 RPCs by name — `set_spouse_atomic` for spouse, `set_parents_atomic` (preserving the focus's existing other parent slot via a pre-read) for father/mother, and `set_parents_atomic` again for child (reading focus `gender` + `spouse_id` to decide slots; `f` → mother slot, otherwise father slot — `other` / `unknown` deterministically default to father, documented as a single-rule choice; focus's spouse, if any, fills the opposite slot). If the linking RPC errors, the action returns `{ ok: false, error }` and the orphan row is intentionally left in place (silent DELETE judged worse UX — user can fix manually). `revalidatePath('/tree/${treeId}')` fires once at the end regardless of link success/failure. `PersonForm` extended with new exported `LinkRelation` + `LinkSpec` types and an optional `linkSpec` prop; when present, a "How is this person related?" radiogroup renders above the name field as a flat 4-option control (Spouse / Father / Mother / Child of `<focusPersonName>`) — flattened from the plan's 3-option-with-sub-question pattern so the user doesn't have to enter gender before relation. Controller-driven, `role="radiogroup"` + `role="radio"` + `aria-checked` semantics, heirloom-palette styling; form title + description swap to "Add a relative" in linked-create mode and the relation is passed through to `createPerson`'s `linkSpec` arg on submit. `PersonCardMenu` swaps the disabled "Add child *(soon)*" item for an enabled "Add relative…" item that owns its own `<PersonForm mode="create" linkSpec={{ focusPersonId, focusPersonName, defaultRelation: 'child' }} />` instance (state pattern mirrors the existing `spousePickerOpen` / `parentsDialogOpen` flags). No new SQL, no new components. `pnpm typecheck` + `pnpm lint` clean. *(commit `613c5dd`)*
- [x] **Sub-task 6** — Tests + close-out. **44 new tests across 6 files**, suite total 49 passing locally against `supabase start`. `src/__tests__/_helpers.ts` — shared fixtures (admin/anon Supabase clients, `signUpUserViaAdmin`, tree + person seeding helpers, direct `tree_members` inserts for editor-role fixtures). `src/__tests__/rls/people.test.ts` — **10 tests** covering owner / editor / non-member / anon × SELECT / INSERT / UPDATE / DELETE plus a "no auth header at all" case (mirrors the Phase 2 `trees.test.ts` pattern). `src/__tests__/rpc/delete_person_atomic.test.ts` — **6 tests** (spouse / father / mother / all-three inbound-FK cleanup; no-spouse no-op; non-existent uuid). `src/__tests__/rpc/set_spouse_atomic.test.ts` — **7 tests** (bidirectional symmetry / clear-A-prior / clear-B-prior / both-priors / re-affirm idempotency / self-spouse rejected / cross-tree rejected). `src/__tests__/rpc/set_parents_atomic.test.ts` — **10 tests** (both / father-only / mother-only / clear-both / self-father / self-mother / 2-gen cycle / 4-gen cycle / cross-tree / missing-target early-return). `src/__tests__/rpc/clear_spouse_atomic.test.ts` — **3 tests** (from-A / from-B symmetric idempotent / no-spouse no-op). `src/__tests__/actions/createPerson-linkSpec.test.ts` — **8 tests** (spouse-clears-prior / father-preserves-mother / mother-preserves-father / child-no-spouse / child-with-spouse / child-other-gender slot assignment / orphan-on-link-failure / cross-tree-spouse-rejected). `vitest.config.ts` gains a `resolve.alias` for `@/*` → `src/*` so the action test can import via the app's alias. Phase 3 `people-crud-and-link` flow (11 steps) appended to [`../qa/smoke-flows.md`](../qa/smoke-flows.md), mirroring the existing Phase 1/2 entry shape. *(commit `7f5f168`)*

**Phase 3 close-out**:

- [x] All six sub-tasks ticked above. *(see commits above)*
- [x] Per-sub-task docs ticks landed in `current-phase.md` + `phase-backlog.md` in the same commit as each feature commit (per the standing memory rule).
- [x] RLS + spouse-symmetry + cycle-detection Vitest tests passing locally (`pnpm test`) — 49 tests green. CI gating not enforced yet — see Tooling backlog "GitHub Action: pnpm test on PR" item.
- [x] Post-sub-task polish: card heights / menu padding / future-date validation in `24f0dea`; gender filter on parent pickers in `e47598d`; intermediate `h-full` wrapper fix in `4e9fef8`. QA Supabase migrations (`delete_person_rpc` + `people_link_rpcs`) applied directly to the QA project `ljjvwtpifmoshfknlbaj` via the Supabase MCP; local repo migrations match.
- [x] `e2e-smoke-tester` flow — **skipped** because the agent's `tools:` grant in `.claude/agents/e2e-smoke-tester.md:4` is missing the Playwright MCP prefix. First real dispatch (2026-05-12) returned BLOCKED. Captured as a Tooling backlog item (commit `852527f`); not a product defect. Manual QA on the qa preview stood in.
- [x] Manual QA pass on the qa preview (`meetthefam-git-qa-sanchit-bhatnagars-projects.vercel.app`) confirmed by user 2026-05-12 — all Phase 3 surfaces (people CRUD, set spouse, set parents with cycle rejection, set parents with new gender filter, tone override, even card heights) verified working post-fix.
- [x] Release version: **`v0.0.4`** standalone (Phase 3 alone — followed pre-Phase-5 `0.0.x` patch-per-deploy convention from [CLAUDE.md](../../CLAUDE.md) "Releases" + [ADR 0009](../adrs/0009-versioning-and-releases.md)).

---

## Previous phase: 2 — Tree CRUD + dashboard (✅ closed)

Closed with **`v0.0.3`**. See [release notes](https://github.com/SanchitB23/meetthefam/releases/tag/v0.0.3).

**Ship gate (met)**:

- Logged-in user on `/dashboard` sees every tree they own or are a member of, plus a role badge (owner / editor) and a "+ New tree" CTA. Empty state when none.
- "+ New tree" → modal (Sheet on mobile, Dialog on desktop) → create works end-to-end. New tree appears immediately on the list — no hard reload (per [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md); currently via `revalidatePath('/dashboard')`, `updateTag` deferred — see Phase 2 backlog).
- "…" menu on an owner-card → Rename works. Updated name appears immediately.
- "…" menu → Delete with a destructive-styled confirmation works. Tree disappears from list immediately. FK `ON DELETE CASCADE` on `tree_members` (and on `people` once Phase 3 lands rows) means the rest cleans up automatically.
- "…" menu is **hidden on editor-cards** — non-owners can't see Rename / Delete.
- **RLS holds**: a non-owner attempting `UPDATE` / `DELETE` on a tree row is blocked at the database, even if the UI is bypassed. Cross-tenant isolation proven by Vitest (`src/__tests__/rls/trees.test.ts`, 4 tests passing).
- Mobile breakpoint = 1-col card grid; desktop = multi-col (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → "Dashboard" screen.

**Sub-tasks (all closed)**:

- [x] **Sub-task 1** — Dashboard list page (read-only). Server Component reading `trees` joined to `tree_members` filtered to the current user's memberships; card per tree with name, description, role badge; empty state with disabled CTA. Sign-out moved into a top-nav slot under the new `/dashboard` layout. *(commit `9794295`)*
- [x] **Sub-task 2** — Create tree. "+ New tree" CTA → `Sheet` on mobile / `Dialog` on desktop. `createTree(formData)` Server Action calls `create_tree_with_owner` RPC (atomic insert into `trees` + owner row in `tree_members`). Dashboard list refreshes via `revalidatePath('/dashboard')`. *(commit `1a87c84`)*
- [x] **Sub-task 3** — Owner rename + delete. "…" menu on owner-cards only; `renameTree(treeId, newName)` + `deleteTree(treeId)` Server Actions, both gated by RLS `UPDATE` / `DELETE` policies. First Vitest RLS test landed at `src/__tests__/rls/trees.test.ts` — non-owner session blocked on `SELECT`, `UPDATE`, and `DELETE`. *(commit `46441ba`)*

**Phase 2 close-out**:

- [x] RLS Vitest test for `trees` / `tree_members` — user A cannot `SELECT` / `UPDATE` / `DELETE` user B's rows. *(commit `46441ba` — 4 tests in `src/__tests__/rls/trees.test.ts`)*
- [x] Per-sub-task docs ticks landed in `current-phase.md` + `phase-backlog.md` in the same commit as each feature commit.
- [x] Confirm `revalidatePath` cache-invalidation works on QA (not just local). Smoke: open `/dashboard` in two tabs, create a tree in tab 1, refresh tab 2 — verified by user 2026-05-12 against `meetthefam-git-qa-sanchit-bhatnagars-projects.vercel.app`.
- [x] Confirm mobile layout (1-col card grid) on QA via Chrome devtools mobile emulator — verified by user 2026-05-12.

See [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md) for the async-idioms baseline (currently using `revalidatePath`; `updateTag` deferred until `"use cache"` adoption post-v0.1).

---

## Previous phase: 1 — Auth (✅ closed)

Closed with **`v0.0.2`**. See [release notes](https://github.com/SanchitB23/meetthefam/releases/tag/v0.0.2).

**Ship gate (met)**:

- Magic-link sign-in (from Phase 0) still works end-to-end on local + QA.
- Google OAuth one-click sign-in works end-to-end on local + QA.
- Hitting `/dashboard` while unauthenticated triggers an **edge-side** 307 from `proxy.ts` (not an in-page redirect).
- Hitting `/share/<random-token>` does NOT trigger the auth boundary (matcher skips it).
- "Sign out" button on `/dashboard` clears the session and returns to `/login`.

**Sub-tasks (all closed)**:

- [x] **Sub-task 1** — Google OAuth secondary sign-in. "Continue with Google" button + `signInWithGoogle` server action; `[auth.external.google]` block in `supabase/config.toml` with explicit `redirect_uri` (the empty default broke local with "missing redirect URI"); reuses the existing PKCE `/auth/callback` route. Verified local + QA. *(commit `fad1bb7`)*
- [x] **Sub-task 2** — `proxy.ts` auth boundary at `src/proxy.ts` (Node runtime, refreshes session via `@supabase/ssr`, 307s unauthenticated traffic to `/login`, matcher skips `/share/[token]`). Retired the in-page redirect from the dashboard. *(commit `3f1cee8`)*
- [x] **Sub-task 3** — Sign-out. `signOut()` server action + `<SignOutButton />` client component with `useFormStatus` pending state. *(commit `9c8e4e9`)*

**Phase 1 close-out** (all done):

- [x] Per-sub-task docs ticks landed in `current-phase.md` + `phase-backlog.md` in the same commit as each feature commit.
- [x] QA verification of all three sub-tasks via Chrome (`Sanchit Personal` profile) — Google OAuth → `/dashboard`, sign-out → `/login`, magic-link confirmation card.
- [x] Backlog reconciliation + "Standing rules" section added in `phase-backlog.md`. *(commit `68af64c`)*

See [ADR 0004](../adrs/0004-magic-link-only-no-passwords.md) for the passwordless-only auth stance and [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md) for the `proxy.ts` over `middleware.ts` rationale.

---

## Previous phase: 0 — Foundation (✅ closed)

Closed with **`v0.0.0`** — the project's conventions baseline tag. See [release notes](https://github.com/SanchitB23/meetthefam/releases/tag/v0.0.0).

**Ship gate (met)**:

- `pnpm install && pnpm dev` boots Next.js at `http://localhost:3000`.
- `supabase start` brings up the local Postgres + Auth + Storage stack.
- Migration applied locally has all four tables (`profiles`, `trees`, `tree_members`, `people`) + RLS policies.
- QA Supabase project exists on the free tier; Vercel preview off `qa` reads from it.
- Logged-in placeholder page (`/dashboard`) shows a real authenticated user from the DB.
- All 5 Tier 1 MCPs (`supabase`, `context7`, `github-meetthefam`, `vercel`, `nextjs-devtools`) connect from a fresh `claude` session.

**Sub-tasks (all closed)**:

- [x] **Sub-task 1** — Next.js 16 scaffold (App Router + TS + Tailwind v4 + ESLint + `src/`; Node pinned to 24.15.0). *(commit `34d1aa4`)*
- [x] **Sub-task 2** — shadcn/ui init (`base-nova` preset on Base UI); heirloom-journal OKLCH palette + Cormorant Garamond / Manrope fonts. *(commit `0dd1ae6`)*
- [x] **Sub-task 3** — Local Supabase stack via `supabase init` + `supabase start`; CLI 2.98.2 installed as dev-dep with `pnpm.onlyBuiltDependencies` whitelist. *(landed in `846cdfb`)*
- [x] **Sub-task 4** — First migration via the **`supabase-engineer`** subagent: `profiles`, `trees`, `tree_members`, `people` + RLS policies + `tone` trigger + profile-on-signup trigger + Smith Family Demo seed (13 people). RLS smoke-checked. *(commit `846cdfb`)*
- [x] **Sub-task 5** — QA Supabase project `meetthefam-qa` (`ljjvwtpifmoshfknlbaj`, `ap-south-1`); single Vercel project with branch-targeted env vars. QA preview READY at `meetthefam-git-qa-sanchit-bhatnagars-projects.vercel.app`, production at `meetthefam.vercel.app` + `mtf.sanchitb23.in`. *(commit `ce72df9`)*
- [x] **Sub-task 6** — Magic-link login → `/dashboard` showing user's email; PKCE flow via `/login` → `/auth/callback` → cookie set → server-side `getUser()`. UX polish: `useFormStatus` spinner + email in confirmation card. *(commits `7e5346b`, `d48d395`)*

**Phase 0 close-out** (all done):

- [x] Drop `--turbopack` flag from scripts (never added — `34d1aa4`).
- [x] Add `engines.node` ≥ 24.15.0 to `package.json` (`34d1aa4`).
- [x] Add Next.js Devtools MCP to `.mcp.json`; bump Tier 1 MCP table from 4 → 5 (`f107e7b`).
- [x] Update `docs/setup/mcp-servers.md` with the Devtools MCP install command (`f107e7b`).
- [x] Verify `claude mcp list` shows all 5 Tier 1 MCPs connected from a fresh session (user-confirmed).
- [x] Wire `@vercel/analytics` + `@vercel/speed-insights` in `src/app/layout.tsx` (`f107e7b`).
- [x] Palette refinement to match Kintree per [ADR 0008](../adrs/0008-design-system.md) — `globals.css` migrated to two-tone + 5 TONES CSS vars.
- [x] Conventions baseline: `qa → main` workflow + phase-anchored SemVer + release process pinned. *(commit `dd1c3e1`, tagged `v0.0.0`)*

See [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md) for the Next.js 16 idioms baseline and [ADR 0009](../adrs/0009-versioning-and-releases.md) for the release process Phase 0 established.

---

## Previous phase: −1 — Project AI infrastructure (✅ closed)

Set up Claude Code to be productive in this repo before any feature work — no app code, just docs, MCPs, agents, direnv. Ship gate verified in a fresh session.

- [x] Confirmation gates 1–3: work dir, GitHub repo, SSH alias.
- [x] Memories: "always ask before commit" + "strict work/personal GitHub separation."
- [x] **Mini-task 1** — repo skeleton (`0ffeebc`).
- [x] **Mini-task 2** — knowledge base: `CLAUDE.md` + `docs/` tree (`8dd64eb`).
- [x] **Mini-task 3 + 4** — project subagents + initial `.mcp.json` (Tier 1) + `docs/setup/mcp-servers.md` (`0765c5f`).
- [x] **Mini-task 5** — GitHub setup (repo created, SSH remote, push, direnv, `.mcp.json` cleanup).
- [x] Phase −1 ship-gate verification — fresh `claude` session: CLAUDE.md auto-loads, `claude mcp list` shows `supabase`, `context7`, `github` connected, agents visible, schema doc readable. `/doctor` env-var warnings confirmed cosmetic.
- ~~PAT rotation~~ — not needed; existing fine-grained PAT is already scoped only to `SanchitB23/meetthefam`.
