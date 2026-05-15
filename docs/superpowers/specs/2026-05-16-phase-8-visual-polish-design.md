# Phase 8 — Visual polish + landing — design spec

> Brainstorm output for `/superpowers:brainstorming` on the Phase 8 scope. Replaces the placeholder ship gate in [`../../tasks/current-phase.md`](../../tasks/current-phase.md) with concrete sub-task composition + ship gates. Feeds the follow-on `/superpowers:writing-plans` invocation.

## Context

Phase 8 is the "visual polish + landing" phase per [the spec's build phasing table](../../specs/2026-05-10-family-tree-design.md). When the phase was opened (commit `f2fc83a`, post-v0.3.0), the current-phase doc carried a placeholder ship gate and `Sub-task 1 — TBD at planning` — explicit ack that Phase 8 had not yet been brainstormed.

Three things made brainstorming non-trivial:

1. **Scope is large** — [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) Phase 8 section carries 19 task items spanning brand foundations (Knot pull-review, logo, dark-mode tokens, brand icon set), in-canvas tree polish (gender shapes + deceased treatment + duplicate handling + tree-overview control), page chrome refactors (`(app)` route group, landing-page replacement), and cross-route animations (`<Suspense>`, `useLinkStatus()`, `<ViewTransition>`).
2. **Open GitHub issues that fit the phase** — [#44](https://github.com/SanchitB23/meetthefam/issues/44) (post-Google-SSO `/` landing), [#45](https://github.com/SanchitB23/meetthefam/issues/45) (Sign Out reachable everywhere), [#49](https://github.com/SanchitB23/meetthefam/issues/49) (logged-in `/login` redirect), [#50](https://github.com/SanchitB23/meetthefam/issues/50) (dashboard → tree transition).
3. **Release-flow change just landed in `qa`** — [ADR 0009 Amendment 4](../../adrs/0009-versioning-and-releases.md) (commit `dacd462`, merged via [PR #54](https://github.com/SanchitB23/meetthefam/pull/54)) restructured the release recipe. v0.4.0 (the Phase 8 release) is the **first release to use the new zero-commit-release-branch + fast-forward-push-into-qa** mechanic. The brainstorm needs to acknowledge that.

## Locked decisions

| # | Decision | Locked value |
|---|---|---|
| 1 | Phase 8 structure | **Three sub-phases (8a / 8b / 8c) inside a single `v0.4.0` release.** Sequential on one phase branch. Internal milestones, not separate releases. |
| 2 | Branch shape | **One phase branch** `feat/phase-8-visual-polish-landing` per the phase-branch-as-default workflow (`feedback_feature_branch_workflow.md`). Each sub-task lands as a separate commit; per-sub-task branches **NOT** used. |
| 3 | Knot brand-guide pull-review | **Sub-task 8a-1**, dedicated. Produces `docs/architecture/brand-decisions.md` (or new ADR if Knot supersedes ADR 0008's identity). No code in this sub-task. |
| 4 | Duplicate-card handling (option 2 from backlog) | **Visual marker, NOT opacity-based.** Dashed border + top-left `↑` corner badge + tooltip + tap-to-jump-to-primary. Full avatar saturation preserved — duplicate cards stay recognizable. Composes cleanly with the deceased treatment (different visual lanes). |
| 5 | Tree-nav within-canvas animations | **Stay on family-chart's built-in `setTransitionTime(800)`.** No layering of React 19.2 `<ViewTransition>` inside the canvas. Revisit only if 8c-5 reveals a jarring cross-page/within-canvas boundary. |
| 6 | `<ViewTransition>` scope | **Cross-page only** — landing → dashboard, dashboard → tree. Keep transitions ≤ 200 ms. |
| 7 | `APP_VERSION` first consumer | **Footer micro-version** on the landing page + `(app)` chrome. Muted-text, visible to all users. Renders `APP_VERSION` from [`src/lib/generated/version.ts`](../../../src/lib/generated/version.ts) (populated by Amendment 4's `prebuild` script). Debug overlay deferred to v0.5+. |
| 8 | Dropped from Phase 8 | Task 14 (`useEffectEvent` optional polish). Revisit at v0.5+ only if anything actually feels awkward post-Phase 8. |
| 9 | Deferred out of Phase 8 | Task 18 (Tree-settings unified sheet refactor) — needs its own brainstorm at v0.5+ per the backlog's "don't ship without re-brainstorming" caveat. Carrier note added to phase-backlog "Phase 9+ / v0.5" section. |
| 10 | Hotfixed outside Phase 8 | Issue [#49](https://github.com/SanchitB23/meetthefam/issues/49) — handled as a standalone `fix/login-redirect-authed-user` branch off `qa`, can ship anytime, not coupled to Phase 8 release. |
| 11 | Release recipe | **First execution of [ADR 0009 Amendment 4](../../adrs/0009-versioning-and-releases.md).** Zero-unique-commit `release/v0.4.0` branch. No `pnpm version`. Fast-forward push `release/v0.4.0:qa` instead of forward-PR. Full recipe: [`../../dev/releases.md`](../../dev/releases.md). |
| 12 | Pre-v1 no-prod-changes policy | **Unchanged.** Phase 8 is pure frontend, no migrations. Per-phase migrations (if any) apply to local + QA only. All accumulated migrations batch-apply at v1.0. |
| 13 | QA feedback gate | **8b-3 duplicate marker** gets a user review against the QA preview before phase close-out. If the dashed-border + `↑` badge + tooltip combination reads cluttered/unclear, fall back to option 1 (`setDuplicateBranchToggle`) or iterate the visual treatment. |
| 14 | Total sub-task count | **14**: 8a (4) + 8b (3) + 8c (7). |

## Phase 8 structure

### Bundle 8a — Brand foundations (4 sub-tasks)

Lays the groundwork everything downstream uses. No user-visible regressions during 8a; this is design-system plumbing.

| # | Title | Notes |
|---|---|---|
| **8a-1** | Knot brand-guide pull-review + decisions doc | Read [`../../ux/inspiration/knot/`](../../ux/inspiration/knot/) bundle (`theme.css`, `tokens.json`, `logo.svg`, brand notes). Produce `docs/architecture/brand-decisions.md` capturing each cherry-pick (adopt / decline + rationale). Open a **new ADR** only if Knot supersedes ADR 0008's identity (e.g., brand name change). **No code in this sub-task.** |
| **8a-2** | Warm-shifted dark-mode tokens | Map Knot bundle's `.dark` block into [`../../../src/app/globals.css`](../../../src/app/globals.css). Replace shadcn-default `.dark` placeholders. Re-verify WCAG contrast against Knot's a11y matrix in `tokens.json`. The five `--tone-*` variables stay as-is unless Knot's matrix says otherwise. |
| **8a-3** | Logo / logomark adoption | Wire [`../../ux/inspiration/knot/project/logo.svg`](../../ux/inspiration/knot/project/logo.svg) into `src/components/icons/Logo.tsx` (`currentColor`-friendly so it renders on cream + dark). Swap into existing surfaces only: dashboard top-nav, `src/app/layout.tsx` metadata (title/OG/Twitter), favicon. Landing-page swap defers to 8c-2. |
| **8a-4** | Brand icon set | Extract `Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart` SVG paths from [`../../ux/inspiration/kintree/project/shared.jsx`](../../ux/inspiration/kintree/project/shared.jsx) → `Icon`. Re-implement at `src/components/icons/<Name>.tsx`, one component per icon. Lucide stays for everything else (per [ADR 0008](../../adrs/0008-design-system.md)'s hybrid-icon-set decision). |

**8a ship gate** (internal milestone, not a release):
- `docs/architecture/brand-decisions.md` exists (or new ADR if Knot supersedes anything)
- `globals.css` `.dark` block reflects Knot tokens; manual dark-mode walk of dashboard + tree page confirms no contrast regressions
- Logo renders correctly on both light + dark in top-nav and as favicon
- All six brand icons exist as React components and import cleanly
- `pnpm typecheck && pnpm lint && pnpm test` clean

### Bundle 8b — Person + tree canvas polish (3 sub-tasks)

| # | Title | Notes |
|---|---|---|
| **8b-1** | Gender-shape avatar variation + deceased treatment | Ships together per the 2026-05-12 Claude Design brainstorm. Extend [`../../../src/components/ui/avatar.tsx`](../../../src/components/ui/avatar.tsx) with `gender?` (`'m' → rounded-square @ 0.18`, `'other' → squircle @ 0.34`, `'f' / 'unknown' → circle`) and `deceased?` (`filter: saturate(0.55); opacity: 0.82`; `†` badge for `size >= 36`). New `src/components/ui/memoriam.tsx` for the † name-prefix. Update `PersonCard.tsx`, `PersonPicker.tsx`, and [`../../../src/app/tree/[id]/_lib/person-node-html.ts`](../../../src/app/tree/[id]/_lib/person-node-html.ts) to thread `gender` + `deceased`. Card chrome softens for deceased rows (`border-foreground/10` + subtle gradient). **NOT in scope**: the "IN LOVING MEMORY" letterspaced uppercase line — user declined during the original brainstorm. |
| **8b-2** | Tree-overview / zoom-to-fit control + floating "+" hover affordance | Two floating canvas controls; ship together for visual consistency. **Overview button** (top-right, icon-only ghost button + tooltip "View whole tree"): zooms out to fit all nodes via family-chart's d3 zoom + bounding-box transform, clears `#p=<uuid>` from URL, optionally re-picks the earliest-generation ancestor as focus. **"+" hover affordance** (Phase 4 backlog carrier): floats over a node on hover/long-press, wires to the existing Phase 3 `addPerson` Server Action (no duplicate create logic). Pre-seeds `linkSpec` with `defaultRelation: 'child'`. |
| **8b-3** | Duplicate-card visual marker (option 2) | Per locked decision #4. `personNodeHtml` adds a `duplicate?: boolean` branch: dashed border + top-left `↑` corner badge + "Already shown above" tooltip. Click handler in [`../../../src/app/tree/[id]/_components/FamilyTree.tsx`](../../../src/app/tree/[id]/_components/FamilyTree.tsx) gains a "tap a duplicate → set `#p=<primary-uuid>` and re-center" branch. **Do NOT call `setDuplicateBranchToggle(true)`** — that's option 1. Avatar / name / dates stay full-color (no opacity drop — would collide with the deceased treatment from 8b-1). |

**Compositional check (deceased × duplicate)**: a person who is BOTH deceased AND a duplicate occurrence (e.g., a deceased grandparent reachable through two grandchildren's ancestry) renders with — desaturated avatar + `†` top-right + `<Memoriam>` `†` name prefix + dashed border + `↑` top-left + "Already shown above" tooltip. Six layered signals in distinct visual lanes.

**8b ship gate**:
- Smith Family Demo seed renders with avatars in correct shape-per-gender on both desktop + mobile
- A deceased person in the seed shows the † badge + Memoriam name prefix + softened card chrome on PersonCard and PersonNode
- "View whole tree" returns the canvas to a fitted overview from any focused state; URL hash clears
- Hovering a node on desktop / long-pressing on mobile surfaces a floating "+" that opens the add-relative form pre-seeded to the focus
- Duplicate occurrences render with dashed border + `↑` badge + tooltip; tapping a duplicate jumps to the primary
- **QA feedback gate** (locked decision #13): owner walks the QA preview, confirms the duplicate marker reads correctly; falls back to option 1 if visually noisy
- `pnpm typecheck && pnpm lint && pnpm test` clean; Vitest covers `personNodeHtml` duplicate + deceased branches

### Bundle 8c — Landing + nav + animations (7 sub-tasks)

This is the largest bundle — closes three GitHub issues + introduces the first `APP_VERSION` consumer.

| # | Title | Resolves | Notes |
|---|---|---|---|
| **8c-1** | Shared `(app)` route group for chrome | [#45](https://github.com/SanchitB23/meetthefam/issues/45) | Hoist top nav (logo from 8a-3 + Sign Out) into new `src/app/(app)/layout.tsx`. Move `dashboard`, `tree/[id]`, `invite/[token]` under `(app)`. Public routes (`login`, `auth/*`, `share/*`, the new landing) stay outside. Move [`../../../src/app/dashboard/SignOutButton.tsx`](../../../src/app/dashboard/SignOutButton.tsx) + its action to `src/app/(app)/_components/`. Verify [`../../../src/proxy.ts`](../../../src/proxy.ts) matcher still gates correctly. |
| **8c-2** | Replace `src/app/page.tsx` with real landing screen | [#44](https://github.com/SanchitB23/meetthefam/issues/44) | Heirloom palette, Cormorant hero copy (italic kicker per [ADR 0008](../../adrs/0008-design-system.md) whitelist), `Branch` divider between sections (from 8a-4 icons), `Leaf` in section headings, `Sparkle` for "new" hints. Top of the Server Component: `getUser()` → if authed, `redirect('/dashboard')`. Reference: original Kintree landing screen in the un-vendored prototype bundle (re-fetch URL in [`../../ux/inspiration/README.md`](../../ux/inspiration/README.md)). |
| **8c-3** | Heirloom palette pass on empty / loading / error states | [#50](https://github.com/SanchitB23/meetthefam/issues/50) (1/3) | Audit every existing `loading.tsx` / empty state / error boundary. Replace gray `bg-muted/50` shimmer with heirloom skeletons (cream `bg-background` outer + tone-tinted placeholders). Specifically fixes #50's black flash by adding `bg-background` to the outer `<main>` in [`../../../src/app/tree/[id]/loading.tsx`](../../../src/app/tree/[id]/loading.tsx) and [`../../../src/app/dashboard/loading.tsx`](../../../src/app/dashboard/loading.tsx). |
| **8c-4** | Slow-nav loading affordance | [#50](https://github.com/SanchitB23/meetthefam/issues/50) (2/3) | (a) Wrap data-fetching parts of `/dashboard` + `/tree/[id]` Server Components in `<Suspense>` with the 8c-3 heirloom skeletons as `fallback`. (b) Apply Next 16's [`useLinkStatus()`](https://nextjs.org/docs/app/api-reference/functions/use-link-status) to the most-traversed links — dashboard tree cards, Members icon button, "Back to dashboard" — render a thin top-edge progress bar or inline spinner while navigation is in flight. Precedent: Phase 5 photo-upload optimistic-blob preview pattern. |
| **8c-5** | React 19.2 `<ViewTransition>` for cross-page animations | [#50](https://github.com/SanchitB23/meetthefam/issues/50) (3/3) | Wrap top-level route transitions: landing → dashboard, dashboard → tree page. Keep transitions ≤ 200 ms. Per locked decision #6, cross-page only — within-canvas tree-nav stays on family-chart's built-in (locked decision #5). |
| **8c-6** | Revoke-member confirm copy + italic-Cormorant whitelist audit | — | Final visual cleanup. (a) MembersSheet revoke flow: inline `<p>` next to Confirm: "X will lose access. The people they added stay in your tree." (Phase 6 follow-up). (b) Audit all italic Cormorant usage via grep; flag any outside the whitelist (landing-hero kicker, section taglines, empty-state hero copy, share-link footer pull-quotes, person-bio nicknames). Fix violations or document the deviation. |
| **8c-7** | `APP_VERSION` footer micro-version | — | Per locked decision #7. New `src/components/ui/version-footer.tsx` reads `APP_VERSION` from [`../../../src/lib/generated/version.ts`](../../../src/lib/generated/version.ts) (populated by Amendment 4's `prebuild` script). Renders as `v0.4.0-dev.<sha>` / `v0.4.0` muted-text in the global footer. Mounted in `src/app/layout.tsx` so both landing + `(app)` chrome surface it. No new build steps — the `prebuild` script already runs. First consumer of `APP_VERSION`. |

**8c ship gate** (also the **Phase 8 ship gate**):
- `/` renders the real landing screen; authed users redirect to `/dashboard`; #44 closed
- Sign Out reachable from `/dashboard`, `/tree/[id]`, `/invite/[token]`; public routes have no nav; #45 closed
- Dashboard → tree navigation: no black flash, heirloom skeleton paints immediately, soft view-transition between routes; #50 closed
- Revoke-member confirm shows the explanatory copy
- Italic-Cormorant audit complete; violations resolved or documented
- Footer shows `APP_VERSION` on landing + every `(app)` page; verifies the new `prebuild` script's output across the four format cases (tagged, release-branch, dev, fallback)
- `pnpm typecheck && pnpm lint && pnpm test` clean
- e2e-smoke-tester passes the Phase 1–7 flows against the QA deploy (no regressions in the `(app)` route group refactor)

### Issue closure map

| Issue | Closed by | Comment posted at close |
|---|---|---|
| [#44](https://github.com/SanchitB23/meetthefam/issues/44) | 8c-2 | "Closed by Phase 8 landing-page replacement (`v0.4.0`)." |
| [#45](https://github.com/SanchitB23/meetthefam/issues/45) | 8c-1 | "Closed by Phase 8 shared `(app)` route group (`v0.4.0`)." |
| [#50](https://github.com/SanchitB23/meetthefam/issues/50) | 8c-3 + 8c-4 + 8c-5 | "Closed by Phase 8 polish (heirloom skeletons + `<Suspense>` + `useLinkStatus()` + `<ViewTransition>`) — `v0.4.0`." |
| [#49](https://github.com/SanchitB23/meetthefam/issues/49) | **Out of Phase 8 scope** (locked decision #10) — standalone hotfix on `qa` | n/a |
| [#25](https://github.com/SanchitB23/meetthefam/issues/25) | **Not in scope** — labeled `post-v1.0`, deferred to Phase 9 / pre-launch checklist | n/a |

## Cross-cutting concerns

### Branch strategy

Per `feedback_feature_branch_workflow.md` (inverted 2026-05-15 to phase-branch-as-default):

- **One phase branch** off `qa`: `feat/phase-8-visual-polish-landing`
- **All 14 sub-tasks land as separate commits on that one branch.** Each sub-task is one commit with its `docs/tasks/current-phase.md` tick + supporting docs in the same commit (per `feedback_update_tasks_before_commit.md`).
- **Internal milestones (8a-done, 8b-done, 8c-done)** are commit checkpoints that trigger e2e-smoke-tester runs against the phase branch's Vercel preview. Not separate PRs.
- **Per-sub-task branches NOT used.** None of these sub-tasks meet both criteria in the memory's "When to fall back" section (independently deployable AND landing in pieces materially helps review).
- **One PR at phase end**: `feat/phase-8-visual-polish-landing → qa`, squash-merged (one squashed commit on `qa` summarizing the phase; per-sub-task history stays in the branch's reflog).

### Release strategy — first run of ADR 0009 Amendment 4

v0.4.0 is the **first release using the zero-commit release-branch + fast-forward-push recipe**. Full recipe in [`../../dev/releases.md`](../../dev/releases.md). Phase-8-specific summary:

```bash
# After the Phase 8 PR squash-merges into qa:

# 1. Cut release branch — pure snapshot, ZERO unique commits.
git checkout qa && git pull --ff-only
git checkout -b release/v0.4.0
git push -u origin release/v0.4.0

# 2. Open release PR into main, merge with real merge commit.
gh pr create --repo SanchitB23/meetthefam \
  --base main --head release/v0.4.0 \
  --title "v0.4.0 — Visual polish + landing" \
  --body-file /tmp/v0.4.0-notes.md
gh pr merge --merge --delete-branch=false <pr-number>

# 3. Create tag on GitHub against the main merge commit.
git fetch origin main
gh release create v0.4.0 --target main \
  --title "v0.4.0 — Visual polish + landing" \
  --notes-file /tmp/v0.4.0-notes.md \
  --prerelease

# 4. Fast-forward push release branch into qa.
git push origin release/v0.4.0:qa
git push origin --delete release/v0.4.0
```

**Differences from prior releases (v0.0.0–v0.3.0)**:

- **NO `pnpm version` step.** `package.json` `version` stays at the sentinel `"0.0.0-dev"`. Real version derived at build time by [`../../../scripts/derive-version.mjs`](../../../scripts/derive-version.mjs) → [`../../../src/lib/generated/version.ts`](../../../src/lib/generated/version.ts).
- **Release branch carries zero unique commits.** Pure snapshot pointer.
- **No forward-PR back into qa.** Fast-forward push (`release/v0.4.0:qa`) lands the same SHA on qa as one of main's merge-commit parents — eliminates the ghost-commit divergence that hit v0.1.0 and v0.3.0.
- **Rare-case fallback** documented in `releases.md` if qa moves during the release window.

### Pre-prod policy

**Unchanged.** No `mcp__supabase__apply_migration` against `family-tree-prod`; no production-Vercel-config changes. Phase 8 is pure frontend — no migrations expected — but the discipline still applies if any sub-task ends up touching `supabase/migrations/`.

### Testing strategy per bundle

| Bundle | Vitest coverage | Smoke flow |
|---|---|---|
| **8a** | Snapshot test for `<Logo>` component (renders SVG without crash); type-test for new ADR-0008-adjacent token names if any are added | Manual: dark-mode walk of dashboard + tree page (no automated dark-mode coverage exists yet) |
| **8b** | Extend `src/__tests__/lib/family-chart-data.test.ts` with duplicate-flagged + deceased + gender-mapped fixtures; new `personNodeHtml` test cases for `gender` × `deceased` × `duplicate` × `tone` combinations; new `<Memoriam>` component test | Append `phase-8b-tree-polish` smoke flow to [`../../qa/smoke-flows.md`](../../qa/smoke-flows.md): seed tree with deceased + duplicate occurrences, walk overview button + "+" hover + duplicate tap-to-jump |
| **8c** | `(app)` route group resolves correctly; landing-page authed-redirect behavior; `useLinkStatus()` integration if testable in jsdom; `<VersionFooter>` snapshot test | Append `phase-8c-landing-and-nav` smoke flow: unauthenticated `/` → landing → sign in → land on `/dashboard`; tree page → Sign Out works; dashboard → tree transition shows heirloom skeleton + soft fade; footer shows version |

### Carrier items pointing to future work

These don't ship in v0.4.0 but must be explicitly carried so they don't get lost:

- **Task 14** (`useEffectEvent` polish) — dropped per locked decision #8. Revisit at v0.5+ only if anything actually feels awkward.
- **Task 18** (Tree-settings unified sheet refactor) — deferred per locked decision #9. Carrier note added to [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) Phase 9+ / v0.5 section.
- **Tree-nav within-canvas animations** — defer-with-condition per locked decision #5. Revisit only if 8c-5 reveals a jarring boundary.
- **Issue [#49](https://github.com/SanchitB23/meetthefam/issues/49)** — handled as standalone `fix/login-redirect-authed-user` hotfix per locked decision #10.
- **`APP_VERSION` debug overlay** — v0.5+ if a debugging need surfaces (footer micro-version ships in 8c-7 instead).
- **8b-3 QA feedback gate** — duplicate-marker visual reviewed against QA preview before phase close-out per locked decision #13.

## Risks

1. **First-run of Amendment 4 release recipe**: v0.4.0 is the very first release using the zero-commit release-branch + fast-forward-push recipe. The [release-flow spec](2026-05-15-release-flow-divergence-fix-design.md) covers the design, but real-world friction shows up only at execution. **Mitigation**: dry-run `scripts/derive-version.mjs` against the phase-branch Vercel preview before phase close to confirm `APP_VERSION` derives correctly across all four format cases (tagged commit, release branch, dev branch with latest tag, no-tags fallback). 8c-7's footer is also a free integration test — if the footer renders the wrong string, the script is broken.
2. **`<ViewTransition>` + token-swap visual collisions**: dark-mode token swap (8a-2), heirloom skeleton refactor (8c-3), and `<ViewTransition>` wiring (8c-5) all touch the same perceptual surface. **Mitigation**: e2e-smoke-tester run at each internal milestone; manual dark-mode walk before phase close.
3. **`(app)` route group regression risk**: hoisting nav into a route group restructures URLs internally. Phase 1's auth proxy matcher and Phase 6's invite-accept round-trip both touch nearby code. **Mitigation**: re-run Phase 1 + Phase 6 smoke flows post-8c-1.
4. **Sub-task count drift**: 14 sub-tasks is the plan. Under pressure the temptation will be to bundle (e.g., 8c-3 + 8c-4). **Mitigation**: the spec calls out which sub-tasks may compose vs. must stay separate. `<Suspense>` (8c-4) and `useLinkStatus()` (8c-4) solve different parts of #50 — keep as one sub-task. Heirloom skeleton refactor (8c-3) is the surface they paint into — separate sub-task because it's a prerequisite, not a co-effort.
5. **Italic-Cormorant audit timing**: 8c-6's audit runs after all copy is on screen. If 8c-2's landing copy uses italic outside the whitelist, the fix lands in the same audit pass — no blocking dependency, just a final sweep.
6. **Duplicate-marker visual not landing well**: locked decision #4 + #13's QA feedback gate is the explicit hedge. Fallback path documented (option 1 — `setDuplicateBranchToggle`).

## Out of scope

Explicitly deferred or dropped from Phase 8:

- Task 14 (`useEffectEvent`) — dropped (locked decision #8)
- Task 18 (Tree-settings unified sheet refactor) — deferred to v0.5 brainstorm (locked decision #9)
- Tree-nav within-canvas animations — deferred unless 8c-5 reveals a boundary issue (locked decision #5)
- Issue [#49](https://github.com/SanchitB23/meetthefam/issues/49) — standalone hotfix outside Phase 8 (locked decision #10)
- Issue [#25](https://github.com/SanchitB23/meetthefam/issues/25) (custom SMTP) — `post-v1.0` labeled; Phase 9 / pre-launch
- `APP_VERSION` debug overlay — v0.5+ if needed
- Production DB changes / production-Vercel-config changes — pre-v1 policy stands

## Open questions for the writing-plans phase

Items the `/superpowers:writing-plans` follow-on should resolve concretely:

1. **8a-1 output format** — pure markdown decisions doc, or a formal ADR? Default: decisions doc unless Knot supersedes the meetthefam brand identity (then ADR).
2. **8a-2 contrast verification approach** — manual screenshot diff, or programmatic via `@axe-core/playwright`? Backlog doesn't say; pick at plan time.
3. **8a-4 icon stroke widths** — Kintree's `Branch` / `Leaf` SVG paths use specific stroke widths. Match exactly or tune to feel consistent with Lucide's `2px` default?
4. **8b-3 duplicate marker — connector-line visual** — family-chart's `d.duplicate` flag may interact with how connector lines render. Spike during 8b-3 to confirm dashed border + connector composition reads cleanly.
5. **8c-1 dashboard layout rebase** — moving `dashboard/layout.tsx` into `(app)/layout.tsx` collapses two layers. Confirm no consumer relies on the dashboard-specific layout being separate.
6. **8c-5 `<ViewTransition>` scope** — wrap at root layout, per-segment, or per-link? React docs lean per-link for fine-grained control; verify before committing.
7. **8c-7 footer placement** — global footer (always visible) or only on landing + dashboard (not on tree page where canvas is full-screen)? Spec says "global"; revisit if tree-page-canvas-area conflicts.

## See also

- [`../../tasks/current-phase.md`](../../tasks/current-phase.md) — Phase 8 stub; will be updated to point at this spec
- [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) Phase 8 section — original 19 task items
- [`../../adrs/0008-design-system.md`](../../adrs/0008-design-system.md) — heirloom-journal identity + hybrid icon set + italic Cormorant whitelist
- [`../../adrs/0009-versioning-and-releases.md`](../../adrs/0009-versioning-and-releases.md) Amendment 4 — first execution at v0.4.0
- [`../../adrs/0010-feature-branch-workflow.md`](../../adrs/0010-feature-branch-workflow.md) — phase-branch-as-default
- [`../../dev/releases.md`](../../dev/releases.md) — release recipe
- [`2026-05-15-release-flow-divergence-fix-design.md`](2026-05-15-release-flow-divergence-fix-design.md) — Amendment 4 design spec
- Open GitHub issues: [#44](https://github.com/SanchitB23/meetthefam/issues/44), [#45](https://github.com/SanchitB23/meetthefam/issues/45), [#50](https://github.com/SanchitB23/meetthefam/issues/50) (closed by Phase 8); [#49](https://github.com/SanchitB23/meetthefam/issues/49) (standalone hotfix); [#25](https://github.com/SanchitB23/meetthefam/issues/25) (post-v1.0)
