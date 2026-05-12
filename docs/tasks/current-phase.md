# Current phase: 3 — People CRUD + linking

## Goal

Add / edit / delete people; set spouse / parents / add child; bidirectional spouse sync works; cycle detection works. No visualization yet — Phase 4 owns rendering.

Per the spec ([`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing" → Phase 3 row): *"Add / edit / delete people; set spouse / parents / add child; bidirectional spouse sync works; cycle detection works. **No visualization yet** — verify via DB rows."*

Plan brainstormed 2026-05-12 (saved at `~/.claude/plans/let-s-start-with-phase-glowing-thacker.md`). The 6-sub-task breakdown below is the implementation slicing — `/tree/[id]` ships as a person-list page (option B), each sub-task is independently demoable + committable, atomic multi-row operations live in Postgres RPC functions (matches Phase 2's `create_tree_with_owner` precedent). Phase 3 backlog items in [`phase-backlog.md`](phase-backlog.md) are ticked as their owning sub-task lands.

## Ship gate

- Navigating `/dashboard` → tapping a tree card → lands on `/tree/[id]` showing the tree name + a person list (or empty state). Non-members get a 404 via RLS.
- Add a person via "+" FAB → row appears immediately (`revalidatePath`); tone auto-assigned by the DB trigger.
- Edit a person from the card menu → form prefills, save updates the row + the list; tone-override swatch works.
- Delete a person → confirmation modal → row removed, any inbound FKs (other rows pointing at it as spouse / father / mother) nulled atomically via RPC.
- Set spouse from the card menu → both `A.spouse_id` and `B.spouse_id` are set (bidirectional sync); clearing spouse nulls both sides.
- Set parents → ancestor-cycle detection rejects "make grandpa my son" with a clear error toast; the person-picker UI also guards obvious cases (self, descendants).
- Add child → opens the create form with parents prefilled (focus person + their spouse if any).
- Vitest RLS suite for `people` passes: non-members blocked on SELECT / INSERT / UPDATE / DELETE; editors can read + write; anon has no access. Spouse-symmetry + cycle-detection integration tests pass.

## Sub-tasks

- [x] **Sub-task 1** — Page shell + `<Avatar>` + read-only person-list at `/tree/[id]`. Server Component using `PageProps<'/tree/[id]'>`; RLS-gated `trees` + `people` fetches; `notFound()` on missing tree; back-arrow + tree-name header; empty state with disabled "+ Add the first person" CTA (wired in sub-task 2). `<Avatar>` component per [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md) (photo fallback → tone-tinted initials in Cormorant Garamond). `PersonList` grid + `PersonCard` (avatar + name + italic nickname + relations summary + birth/death years). Dashboard `<TreeCard>` switched from `#` to `/tree/${id}` using the stretched-link pattern.
- [ ] **Sub-task 2** — Add person (no linking). Install shadcn `Sheet`; `PersonForm.tsx` (`react-hook-form`, Sheet on mobile / Dialog on desktop) — fields per [`../ux/add-edit-person.md`](../ux/add-edit-person.md) minus photo (deferred to Phase 5). `AddPersonFab` floating "+" bottom-right; `createPerson(treeId, data)` Server Action with `revalidatePath`. Empty-state CTA wired up.
- [ ] **Sub-task 3** — Edit + delete person. `PersonForm` extended with `mode="edit"` (prefill + destructive Delete CTA) + 5-swatch tone-override radio. `DeletePersonDialog` mirroring `DeleteTreeDialog`. `updatePerson` (direct `.update()`) + `deletePerson` (RPC `delete_person_atomic` — nulls inbound FKs then deletes, all in one transaction) Server Actions.
- [ ] **Sub-task 4** — Linking after creation. Install shadcn `Command`; `PersonPicker` (searchable list filtered by name + nickname); `PersonCardMenu` ("Set spouse" / "Set parents" / "Add child" / "Clear spouse" / "Edit" / "Delete"). Three new RPCs in one migration: `set_spouse_atomic` (clears prior bond on either side, sets both directions), `set_parents_atomic` (ancestor-cycle check via recursive CTE, rejects with a clear error), `clear_spouse_atomic` (nulls both ends). UI guards in `PersonPicker` exclude self / ancestors / descendants as appropriate.
- [ ] **Sub-task 5** — Linking at creation. `PersonForm` extended with optional `linkSpec` and a "How is this person related?" radio (Spouse / Parent / Child of `<focus>`). `PersonCardMenu` adds "+ Add relative" submenu. `createPerson` accepts `linkSpec` and composes the relevant RPC from sub-task 4 — no new SQL.
- [ ] **Sub-task 6** — Tests + close-out. Vitest RLS suite at `src/__tests__/rls/people.test.ts` (mirrors the Phase 2 `trees.test.ts` pattern). Integration tests for spouse-symmetry + cycle-detection. Append the Phase 3 flow to [`../qa/smoke-flows.md`](../qa/smoke-flows.md) and run `e2e-smoke-tester` against the QA preview once sub-tasks 1–5 land. Tick the remaining backlog items + close out this phase.

## Close-out gates

- [ ] All six sub-tasks ticked above.
- [ ] Per-sub-task docs ticks landed in `current-phase.md` + `phase-backlog.md` in the same commit as each feature commit (per the standing memory rule).
- [ ] RLS + spouse-symmetry + cycle-detection Vitest tests passing locally (`pnpm test`). CI gating not enforced yet — see Tooling backlog "GitHub Action: pnpm test on PR".
- [ ] `e2e-smoke-tester` PASSes the new Phase 3 flow against the QA preview.
- [ ] Release version decided (likely `v0.0.4`, or fold into a Phase 4 bundled release).

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
