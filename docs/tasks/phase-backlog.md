# Phase backlog

Per-phase TODOs that don't belong in the spec's "Done when…" gate but must be picked up at the right phase. Loaded by the active phase's session — keep it short, link out for detail.

For Next.js 16 idiom rationale, see [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md). For the spec phase rows, see [`../specs/2026-05-10-family-tree-design.md`](../specs/2026-05-10-family-tree-design.md) → "Build phasing."

---

## Standing rules

Not phase-specific TODOs — discipline reminders for every session. These never get a `[x]` because they apply to all new code that crosses the relevant boundary.

- **`await cookies()` and `await headers()`** in every server-side `@supabase/ssr` client. In Next.js 16, `cookies()` and `headers()` from `next/headers` are async — every new Supabase server client must `await` them when wiring the cookie adapter. Pull the current snippet via Context7 MCP (`/supabase/supabase`) before writing one from memory; older guides have the synchronous form. Current code is in compliance (audit `src/lib/supabase/server.ts`, `src/app/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/proxy.ts`).

---

## Phase 0 — Foundation (close-out)

- [x] **Wire Vercel Analytics + Speed Insights** — `@vercel/analytics@2` + `@vercel/speed-insights@2` installed; `<Analytics />` and `<SpeedInsights />` mounted inside `<body>` in [`src/app/layout.tsx`](../../src/app/layout.tsx). Both packages are zero-config on Vercel and capture data from first deploy. Verify in the Vercel dashboard → Analytics tab after the next deploy.
- [x] **Drop `--turbopack` flag** from `package.json` scripts — Turbopack is the default in Next.js 16; the flag is a no-op. *(never added — landed clean in `34d1aa4`)*
- [x] **Add `engines.node`** to `package.json` (`>=24.15.0` matching `.nvmrc`). *(landed in `34d1aa4`)*
- [x] **Add Next.js Devtools MCP** to project `.mcp.json` once `pnpm dev` is wired — see [Next.js MCP docs](https://nextjs.org/docs/app/guides/mcp). Bumps Tier 1 MCPs from 4 → 5; update [`CLAUDE.md`](../../CLAUDE.md) and [`docs/setup/mcp-servers.md`](../setup/mcp-servers.md) when added. *(landed in `f107e7b`)*
- [x] **Palette refinement to match Kintree** (per [ADR 0008](../adrs/0008-design-system.md)) — `globals.css` migrated to two-tone + 5 TONES CSS vars. *(landed in `472df7b`)*
- [x] **Sub-task 3 follow-up — `.gitignore`**: `supabase/seed.local.sql` added to root `.gitignore` so the maintainer's personal-tree seed never gets committed (see [ADR 0008](../adrs/0008-design-system.md) → "Seed data"). *(landing in the sub-task 3 commit)*
- [x] **Sub-task 4 follow-up — Smith Family Demo seed**: ship `supabase/seed.sql` with the [`docs/ux/inspiration/kintree/project/data.jsx`](../ux/inspiration/kintree/project/data.jsx) shape (sanitized Smith / Anderson, 4 generations, 13 people). Production: do NOT run this seed (`supabase/seed.sql` is local-only by Supabase convention). *(landed in sub-task 4 commit)*
- [x] **Sub-task 4 follow-up — `tone` column + trigger**: add the `tone` column on `people` per [`../architecture/data-model.md`](../architecture/data-model.md) and a `BEFORE INSERT` trigger that auto-assigns via `hash(full_name) % 5` when null. See [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md) for the algorithm. *(landed in sub-task 4 commit, uses `abs(hashtext(full_name)) % 5`)*

## Phase 1 — Auth

- [x] **Use `proxy.ts`, not `middleware.ts`**, for the auth boundary. Export `proxy`, run on Node runtime. See [`../architecture/auth-and-rls.md`](../architecture/auth-and-rls.md) → "Auth boundary." *(landed in sub-task 2, commit `3f1cee8` — lives at `src/proxy.ts` per Next.js 16 location convention)*
- [x] Add Supabase magic-link + Google OAuth callback as a Route Handler at `/auth/callback/route.ts` — single PKCE `exchangeCodeForSession` path serves both providers.
- [x] Protect `/dashboard`, `/tree/*` via `proxy.ts` matcher; explicitly skip `/share/[token]`. *(landed in sub-task 2, commit `3f1cee8` — `/tree/*` is covered by the matcher once the route lands)*

> The `await cookies()` / `await headers()` discipline has moved to the **Standing rules** section at the top of this file — it's an ongoing rule, not a one-shot.

## Phase 2 — Tree CRUD + dashboard

- [ ] **`PageProps<'/dashboard'>`** type helper on the dashboard page; `await props.searchParams` if we add a sort/filter query string. *(Phase 2 did not add search params — helper not yet needed; revisit when sort / filter UI lands.)*
- [ ] ~~On tree create / rename / delete Server Actions, call `updateTag('user-trees:<userId>')` for read-your-writes on the dashboard list.~~ **Deferred** — Phase 2 ships with `revalidatePath('/dashboard')` per the approved plan. `updateTag` only pays off once we adopt `"use cache"` cache-component segments (post-v0.1). See [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md).
- [x] **Mobile pattern (per [ADR 0008](../adrs/0008-design-system.md))** — dashboard at mobile breakpoint uses stacked card grid (1-col), desktop uses multi-col. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screen "Dashboard". *(landed in sub-task 1, commit `9794295` — `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` in `src/app/dashboard/page.tsx`)*. **Bottom-tab-bar decision still deferred** — top-nav-only for now; revisit after Phase 3 if mobile feels cramped.

## Phase 3 — People CRUD + linking

- [x] **`PageProps<'/tree/[id]'>`** on the tree page; `await props.params` to read `id`. *(landed in sub-task 1 — `src/app/tree/[id]/page.tsx` uses `PageProps<'/tree/[id]'>` and `await props.params`)*
- [ ] On every people-mutation Server Action (add / edit / delete person, link spouse, set parent, add child), call `updateTag('tree:<treeId>')`. Avoid `revalidatePath` — `updateTag` gives read-your-writes without re-rendering unaffected segments. *(Plan-of-record: stays on `revalidatePath('/tree/[id]')` for Phase 3 per [ADR 0007](../adrs/0007-nextjs-16-and-async-idioms.md); `updateTag` deferred until `"use cache"` adoption post-v0.1.)*
- [x] Cycle-detection + spouse-symmetry edge cases per [`../architecture/data-model.md`](../architecture/data-model.md) → "Edge cases." *(Sub-task 4 landed the RPC layer — ancestor-cycle check via recursive CTE inside `set_parents_atomic` (uses `UNION` so pre-existing data cycles still terminate), spouse-symmetry + cross-tree rejection inside `set_spouse_atomic`, idempotent unbind in `clear_spouse_atomic`. All exceptions surface user-facing `P0001` strings (e.g. 'This would create a circular ancestry.'). Manual matrix passes against the Smith Family Demo seed; Vitest integration coverage asserting the rejection behaviour lands in sub-task 6.)*
- [x] **Build `<Avatar>` component** at `src/components/ui/avatar.tsx` per [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md). Photo-fallback to tinted-circle initials in Cormorant Garamond. Source shape: [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Avatar`. *(landed in sub-task 1)*
- [x] **Tone override UI** — person-edit form exposes a 5-swatch tone picker; defaults to the auto-assigned value from the DB trigger. *(landed in sub-task 3 — edit-mode only; create mode lets the DB trigger pick deterministically from `full_name` hash. Radio implemented as `role="radiogroup"` with `aria-checked` swatches and an `outline` ring on the selected tone so layout doesn't shift.)*
- [ ] **Mobile pattern** — add-relative + edit-person forms render in a bottom-sheet (`<Sheet side="bottom">` from shadcn) on mobile, side-drawer on desktop. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screen "Add Relative". *(Sub-task 2 landed the mobile-bottom-sheet half via `PersonForm.tsx` — commit `1b01a1c`. Sub-task 3 extended the same `PersonForm` to edit-mode so the edit-person flow ALSO goes through Sheet on mobile / Dialog on desktop. Sub-task 4 broadened the pattern further: `PersonPicker` and `SetParentsDialog` both flow through Sheet on mobile / Dialog on desktop too, with the media-query hook now extracted to the shared `useIsDesktop` (`src/components/ui/use-is-desktop.ts`) so all four surfaces — PersonForm, PersonPicker, SetParentsDialog, DeletePersonDialog — share one source of truth. Still left `[ ]` because the spec wording asks for *side-drawer on desktop* and we deliberately use a centered `Dialog` to match Phase 2's `CreateTreeModal` chrome for visual consistency. Deviation stands; the centered-Dialog choice is the only blocker to ticking this.)*

## Phase 4 — Tree visualization

- [ ] **`PageProps<'/tree/[id]'>`** carries focus-person hash via `searchParams` → `await`.
- [ ] **(Defer-or-promote decision)** **React 19.2 [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition)** for tree-navigation animations when re-centering on a tapped node. Lightweight wrapper around the family-chart re-render. Decision point: if family-chart's built-in animation is acceptable, defer to Phase 8 polish; otherwise adopt here. Track via a quick spike at start of Phase 4.
- [ ] Memoize the family-chart wrapper component manually (defer React Compiler).
- [x] **PersonNode go/no-go spike (per [ADR 0008](../adrs/0008-design-system.md))** — **Outcome: GO.** family-chart 0.9.0 exposes `setCardInnerHtmlCreator((d) => string)` + `setCardDim({ w, h })` as first-class APIs on the `CardHtml` wrapper (`node_modules/family-chart/dist/types/core/cards/card-html.d.ts:46`); fixed 158×110 HTML nodes render cleanly without breaking auto-layout. Sub-task 2 shipped the prototype's PersonNode pattern in pared-back form — round tone-tinted avatar (photo or serif initials) + serif name (2-line clamp) + `b. YYYY` / `b. YYYY – d. YYYY` date line. Chart spacing tuned to `setCardXSpacing(220) / setCardYSpacing(130)`. The planned fallback ADR `docs/adrs/0011-family-chart-default-node-fallback.md` is NOT created (not needed). Deceased † badge, gender-shape avatar variation, floating terracotta "+" hover affordance, uppercase role label, and branch / leaf / sparkle decorations explicitly deferred to Phase 8 polish per ADR 0008. *(sub-task 2 commit — SHA backfill pending)*
- [ ] **Floating "+" hover affordance** wires to the same Server Action used by Phase 3's add-relative form (don't duplicate the create logic).
- [ ] **Mobile pattern** — full-screen tree canvas on mobile with a single FAB ("Add person") in the bottom-right; tree nodes are tappable to open the profile bottom-sheet from Phase 3. Reference: [`../ux/inspiration/kintree/`](../ux/inspiration/kintree/) → screens "Tree" + "Mobile variants".

## Phase 5 — Photo upload

- [ ] On upload Server Action, call `refresh()` to update the avatar without busting cached tree shells. See [`../architecture/photo-upload.md`](../architecture/photo-upload.md) → "End-to-end flow."
- [ ] Set `images.remotePatterns`, `images.qualities: [75]`, `images.minimumCacheTTL: 14400` in `next.config.ts`. See `photo-upload.md` → "next/image config."
- [ ] Test: upload a photo, verify the avatar URL updates without a full page reload.

## Phase 6 — Collaboration

- [ ] On invite-accept / role-change / revoke Server Actions, call `updateTag('tree:<treeId>')` AND `updateTag('user-trees:<invitedUserId>')`.
- [ ] No `middleware.ts` workarounds for permission checks — RLS + the existing `proxy.ts` auth gate are sufficient.

## Phase 7 — Share link

- [ ] On share-token toggle / regenerate, call `updateTag('share:<treeId>')` so the dashboard's "share status" reflects immediately.
- [ ] `/share/[token]/route.ts` is a Route Handler using `service_role`. Read `params.token` via `await context.params` (Next.js 16 async).
- [ ] **(Optional)** If we cache the public share-tree response, use `revalidateTag('share:<treeId>', 'max')` with the explicit `cacheLife` profile (the single-arg form is deprecated in v16). Default: don't cache yet — re-evaluate at v1.0 ship.

## Phase 8 — Visual polish + landing

- [ ] **React 19.2 `<ViewTransition>`** for cross-page animations — landing → dashboard, dashboard → tree page. Keep transitions snappy (≤200ms). Reference: [React docs](https://react.dev/reference/react/ViewTransition).
- [ ] If tree navigation animations weren't done in Phase 4, do them here.
- [ ] **(Optional)** Try `useEffectEvent` for any "non-reactive" effect logic (theme listeners, focus trapping in the bottom sheet) — only if existing code is awkward.
- [ ] **Brand icon set (per [ADR 0008](../adrs/0008-design-system.md) → Hybrid icon set)** — extract `Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart` SVG paths from [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Icon` and re-implement as React components at `src/components/icons/` (one component per icon). Lucide stays for everything else.
- [ ] **Decorative motifs** — branch-SVG section dividers between major page sections (landing especially), leaf icons in section headings, sparkle icon for "new" indicators. Reference: [`../ux/inspiration/kintree/project/shared.jsx`](../ux/inspiration/kintree/project/shared.jsx) → `Branch` component.
- [ ] **Italic Cormorant whitelist enforcement (per [ADR 0008](../adrs/0008-design-system.md))** — italic only on: landing-hero kicker, section taglines, empty-state hero copy, share-link footer pull-quotes, person-bio nicknames. Audit all copy after Phase 8 components land; flag any italic Cormorant outside the whitelist.
- [ ] **Visual gender hint via avatar SHAPE** — concrete design landed via a Claude Design brainstorm on 2026-05-12 (handoff bundle re-fetchable from `https://api.anthropic.com/v1/design/h/T1xQD0K10waKCBAu_dHEkw`; primary file `meetmyfamily/project/shared.jsx` — see the `radiusForGender()` helper at lines 65-70 and the `<Avatar>` deceased treatment at lines 75-119). Tones stay NON-demographic per [`../ux/avatars-and-tones.md`](../ux/avatars-and-tones.md); the gender signal is carried by avatar **shape**, classical genealogy convention softened to fit the heirloom-journal aesthetic:
  - `gender === 'm'` → rounded-square, `border-radius: Math.round(size * 0.18)px`
  - `gender === 'other'` → squircle, `border-radius: Math.round(size * 0.34)px` (design uses `'n'`; map our `'other'` here)
  - `gender === 'f'` or `'unknown'` → circle, `border-radius: 50%` (current behavior; `'unknown'` is the design's default)
  
  Files affected: extend `src/components/ui/avatar.tsx` with a `gender?` prop; PersonCard + PersonPicker pass `person.gender` through.
- [ ] **Deceased treatment (†)** — paired with the gender-shape work above (same Claude Design brainstorm); both ship together in the Phase 8 polish pass:
  - **Avatar** desaturates (`filter: saturate(0.55); opacity: 0.82`) and gains a small `†` badge in the top-right corner when `size >= 36` (badge is always a circle regardless of avatar shape; `paper`-on-`mid` colors; ~26% of avatar size; Cormorant Garamond). Spec: `shared.jsx` lines 100-115.
  - **Name prefix `†`** before the person's full name on PersonCard (and any future surface that displays a name in serif). The design extracts this as a reusable `<Memoriam>` component (`shared.jsx` lines 121-134) — port it to `src/components/ui/memoriam.tsx`. Glyph in `text-foreground/60`, `font-weight: 400`, `marginRight: 0.32em`.
  - **Card chrome** softens for deceased rows: lighter border (`border-foreground/10` or equivalent) + subtle vertical gradient on the background (`linear-gradient(180deg, var(--paper), rgba(60,40,20,.025))` in the design's terms — approximate via Tailwind utilities).
  - **NOT in scope**: the design also proposes a `"† IN LOVING MEMORY · YYYY–YYYY"` letterspaced uppercase line replacing the dates strip. **User declined this aspect** during the brainstorm review — keep the existing `b. YYYY – YYYY` line as-is; the avatar badge + name prefix + softened chrome already carry the signal.
  - Files affected: `src/components/ui/avatar.tsx`, new `src/components/ui/memoriam.tsx`, `src/app/tree/[id]/_components/PersonCard.tsx`, `src/app/tree/[id]/_components/PersonPicker.tsx`.
  - **Tweaks panel deferred** — the design exposed both conventions as user-togglable A/B switches; we ship them on by default. If we later want toggles, that's a separate v1.1+ conversation.
- [ ] **Replace create-next-app `src/app/page.tsx`** with the actual landing screen, modeled on the Kintree landing screen in the original prototype bundle (not vendored — see [`../ux/inspiration/README.md`](../ux/inspiration/README.md) for re-fetch URL).
- [ ] **Empty / loading / error states per screen** — apply heirloom palette + Cormorant for hero copy.

## Phase 9 — QA + edge cases + launch

- [ ] **(Optional)** Evaluate `cacheComponents: true` for the share-link page and any landing page — only if perf data justifies it. Default: don't enable.
- [ ] **(Optional)** Evaluate `reactCompiler: true` if profiler shows wasted renders. Default: don't enable.
- [ ] Verify no `--turbopack` flags lurking in `package.json` (cleanup if any survived).
- [ ] Verify Next.js Devtools MCP still works against the production deployment (or document that it's dev-only).

## Tooling / Agents

- [x] **Create an `e2e-smoke-tester` agent** at `.claude/agents/e2e-smoke-tester.md`. Runs named QA smoke flows via the Playwright MCP and reports PASS / FAIL / SKIPPED. Reads its flow catalog from [`docs/qa/smoke-flows.md`](../qa/smoke-flows.md) (also new). Designed for `run_in_background: true` dispatch so phase close-outs no longer block on manual clicking. Seeded with Phase 1 (auth) + Phase 2 (tree CRUD) flows. *(landed 2026-05-12 with the post-v0.0.3 housekeeping pass)*
- [ ] **Fix `e2e-smoke-tester` agent's `tools:` grant** — the agent's frontmatter at `.claude/agents/e2e-smoke-tester.md:4` declares `tools: Read, Bash, Grep, Glob`, but its body (line 45) and the agent's whole purpose require the Playwright MCP browser tools (`mcp__plugin_playwright_playwright__browser_*`). First real dispatch on 2026-05-12 (Phase 3 close-out attempt) returned BLOCKED with "Playwright MCP browser tools are not connected." Fix: add the `mcp__plugin_playwright_playwright__*` prefix to the `tools:` line, and confirm `Bash` has `curl` permission so the Mailpit magic-link extraction step works (the sandbox denied `curl -sI http://localhost:54324` in that same dispatch). ~10-line frontmatter edit. Land before the next phase close-out so e2e returns as a viable gating signal.
- [ ] **Add an `editor-card-no-menu` fixture loader** that uses Supabase admin API to seed a `tree_members` row with role=editor for a second test account, so the e2e agent can verify non-owners don't see the `…` menu. Currently the flow SKIPs with `needs-service-role-admin` reason. Land alongside Phase 6 (collaboration) where editor accounts become a real thing. *(Vitest-side equivalent now exists — Phase 3 sub-task 6 landed `src/__tests__/_helpers.ts` with `signUpUserViaAdmin` + direct admin-client `tree_members` inserts, used by `src/__tests__/rls/people.test.ts` to seed editor-role rows for cross-role RLS coverage. Not a substitute for this item — the e2e agent runs in a different runtime (Playwright MCP against a deployed preview) and needs its own fixture loader — but the technique is now proven and the helper code can be referenced when the Playwright-side loader is built.)*

## CI / Repo settings

> Per [ADR 0009](../adrs/0009-versioning-and-releases.md) "CI automation deferred to v1.0." Vercel's build already runs `next build` (which gates on TypeScript errors) and deploys a preview on every PR push, so the gap is narrower than it looks. The `e2e-smoke-tester` agent now covers the manual click-around portion.

- [x] **Enable `main` branch protection** — repository ruleset `main protection` active (id `16283379`, created 2026-05-12, updated same-day to add `required_status_checks: [Vercel]`). Requires PR before merging on `main`, 0 approving reviews (solo-dev gate), blocks non-fast-forward pushes and branch deletion, allowed merge methods restricted to "merge" (no squash, no rebase — matches the qa→main release flow), AND now blocks merges when the Vercel deploy fails (converts the existing Vercel build into a real hard gate, no extra workflow needed). Unblocked by flipping the repo to public on the same day (rulesets and classic branch protection both require GitHub Pro on private repos — pay-for-Pro and stay-public were the trade-off; user chose public until paywall launch, will go private again before live).
- [x] **Tier-1 security baseline** (enabled 2026-05-12 via `PATCH /repos/.../security_and_analysis`): GitHub secret scanning ✅, secret-scanning push protection ✅ (blocks `git push` if the diff contains a known token pattern — protects against the SUPABASE_ACCESS_TOKEN-in-transcript class of leak going forward), Dependabot security updates ✅ (auto-PRs for CVE-affected deps). `secret_scanning_non_provider_patterns` and `secret_scanning_validity_checks` deferred — they need GitHub Advanced Security (paid).
- [x] **Dependabot config** ([`.github/dependabot.yml`](../../.github/dependabot.yml)) — weekly npm version PRs (Monday 06:00 IST) targeting `qa`, grouped by ecosystem family (next, react, supabase, shadcn-base-ui, tailwind, typescript-tooling, testing, vercel). Plus a github-actions ecosystem update so any CI workflows we add later stay current. 5 open-PRs/week cap to keep noise in check.
- [x] **Release flow vs. `main` branch protection** — Resolved 2026-05-12 (post-v0.0.4) via [ADR 0010](../adrs/0010-feature-branch-workflow.md) (feature-branch workflow on `qa`) plus the third Amendment on [ADR 0009](../adrs/0009-versioning-and-releases.md). Path chosen is a refined option (b): the `release/vX.Y.Z` branch is now the codified release flow, not a workaround. Concretely — version bump runs on the release branch with `pnpm version <bump> --no-git-tag-version` so no local tag is ever created; the tag is created on GitHub via `gh release create --target main` after the release PR merges; the release branch is then PR'd back into `qa` (squash) to keep `qa` and `main` from diverging on `package.json`. Combined with the feature-branch flow into `qa`, the overall path is now `feat/* → qa → release/vX.Y.Z → main`. CLAUDE.md → "Git workflow" and "Releases" sections rewritten in the same change.
- [ ] **GitHub Action: `pnpm lint` + `pnpm typecheck` on PR** — ~30s/PR, ~20 lines of yaml. Catches the small gap where `next build` may not gate on ESLint warnings/errors. Low value while solo (you run them locally before commits), real value if a collaborator joins.
- [ ] **GitHub Action: `pnpm test` on PR with a Supabase service container** — ~2 min/PR, ~50 lines of yaml. Spins up a Postgres container, applies migrations, runs the Vitest RLS suite. Catches RLS regressions automatically. Pairs with — does NOT replace — the `e2e-smoke-tester` agent: RLS tests cover DB-layer cross-tenant isolation; the agent covers UI golden paths. Both have a place at v1.0.
