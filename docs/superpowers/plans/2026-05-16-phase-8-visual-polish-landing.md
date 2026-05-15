# Phase 8 — Visual Polish + Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 8 visual polish — Knot brand adoption (logo + dark-mode tokens + brand icon set), person/tree-canvas polish (gender-shape avatars + deceased treatment + tree-overview button + duplicate-card visual marker + hover-affordance), and landing + nav + animations (real landing page, shared `(app)` route group, heirloom skeletons, `<Suspense>` + `useLinkStatus()`, React 19.2 `<ViewTransition>`, footer `APP_VERSION`). Closes [GitHub issues #44, #45, #50](https://github.com/SanchitB23/meetthefam/issues) at `v0.4.0`.

**Architecture:** Three sub-phases (8a / 8b / 8c) on a single phase branch `feat/phase-8-visual-polish-landing`. 14 sub-tasks land as 14 sequential commits with internal milestone checkpoints (8a-done / 8b-done / 8c-done) for smoke-test runs. One squash-PR at phase end into `qa`, then `release/v0.4.0` follows the **new [ADR 0009 Amendment 4](../../adrs/0009-versioning-and-releases.md) recipe**: zero-unique-commit release branch, no `pnpm version`, `gh release create --target main`, fast-forward push of release-branch tip into `qa`. v0.4.0 is the **first release on the new recipe**.

**Tech Stack:** Next.js 16 (App Router, async APIs, `<ViewTransition>`, `useLinkStatus()`, `<Suspense>`), Supabase (no migrations this phase), `@supabase/ssr`, Tailwind v4 + shadcn/ui (Base UI), Lucide 1.x, `react-hook-form`, family-chart 0.9.0 (d3 zoom), Vitest + jsdom for unit tests, Playwright via plugin for smoke flows.

---

## Spec reference

Brainstorm spec → [`../specs/2026-05-16-phase-8-visual-polish-design.md`](../specs/2026-05-16-phase-8-visual-polish-design.md). Plan-time decisions in §"Plan-time resolved decisions" below resolve the 7 open questions the spec deferred.

---

## File Structure

**New files (created during Phase 8):**

| Path | Owner | Purpose |
|---|---|---|
| `docs/architecture/brand-decisions.md` | 8a-1 | Knot brand cherry-pick decisions |
| `src/components/icons/Logo.tsx` | 8a-3 | Brand logomark (Knot's three-ring + terracotta dot) |
| `src/components/icons/Branch.tsx` | 8a-4 | Decorative section-divider SVG |
| `src/components/icons/Leaf.tsx` | 8a-4 | Section-heading accent |
| `src/components/icons/Quote.tsx` | 8a-4 | Pull-quote glyph |
| `src/components/icons/Family.tsx` | 8a-4 | "Family" feature icon |
| `src/components/icons/Sparkle.tsx` | 8a-4 | "New" indicator |
| `src/components/icons/Heart.tsx` | 8a-4 | Soft accent |
| `src/components/ui/memoriam.tsx` | 8b-1 | `<Memoriam>` name-prefix component |
| `src/app/tree/[id]/_components/TreeOverviewButton.tsx` | 8b-2 | Zoom-to-fit control |
| `src/app/tree/[id]/_components/PersonHoverPlus.tsx` | 8b-2 | Hover "+" affordance |
| `src/app/(app)/layout.tsx` | 8c-1 | Shared authenticated chrome |
| `src/app/(app)/_components/SignOutButton.tsx` | 8c-1 | Moved from `dashboard/SignOutButton.tsx` |
| `src/app/(app)/_actions/signOut.ts` | 8c-1 | Moved from `dashboard/actions.ts` |
| `src/components/landing/LandingHero.tsx` | 8c-2 | Hero block (Cormorant copy, italic kicker) |
| `src/components/landing/LandingFeatures.tsx` | 8c-2 | Feature grid (Branch divider, Leaf headings) |
| `src/components/landing/LandingFooter.tsx` | 8c-2 | Footer with sign-in CTA + `<VersionFooter>` |
| `src/components/ui/LinkProgress.tsx` | 8c-4 | `useLinkStatus`-driven thin top progress bar |
| `src/components/ui/VersionFooter.tsx` | 8c-7 | Renders `APP_VERSION` muted-text |
| `src/__tests__/components/Logo.test.tsx` | 8a-3 | Snapshot smoke test |
| `src/__tests__/components/icons.test.tsx` | 8a-4 | All 6 icons render as SVG |
| `src/__tests__/components/memoriam.test.tsx` | 8b-1 | `<Memoriam>` snapshot |
| `src/__tests__/lib/person-node-html.test.ts` | 8b-1/3 | Avatar gender × deceased × duplicate matrix |
| `src/__tests__/components/VersionFooter.test.tsx` | 8c-7 | Snapshot rendering each format case |

**Modified files:**

| Path | Sub-task | What changes |
|---|---|---|
| `src/app/globals.css` | 8a-2 | `.dark` block remapped to Knot warm-shifted tokens |
| `src/app/layout.tsx` | 8a-3, 8c-7 | Metadata (title/OG/Twitter), favicon, mount `<VersionFooter>` |
| `src/components/ui/avatar.tsx` | 8b-1 | Add `gender?` + `deceased?` props; gender-shape + desaturate + † badge |
| `src/app/tree/[id]/_lib/person-node-html.ts` | 8b-1, 8b-3 | Thread `gender`, `deceased`, `duplicate`; dashed-border + `↑` badge for duplicates |
| `src/app/tree/[id]/_components/PersonCard.tsx` | 8b-1 | Pass `gender` + `deceased` to `<Avatar>`; mount `<Memoriam>` prefix |
| `src/app/tree/[id]/_components/PersonPicker.tsx` | 8b-1 | Same — thread props |
| `src/app/tree/[id]/_components/FamilyTree.tsx` | 8b-2, 8b-3 | Mount overview button + hover plus; duplicate tap-to-jump handler |
| `src/app/dashboard/layout.tsx` | 8c-1 | DELETED (moved to `(app)`) |
| `src/app/dashboard/SignOutButton.tsx` | 8c-1 | DELETED (moved to `(app)/_components/`) |
| `src/app/dashboard/actions.ts` | 8c-1 | DELETED (moved to `(app)/_actions/`) |
| `src/app/dashboard/page.tsx` | 8c-1 | Move under `(app)/dashboard/page.tsx` |
| `src/app/dashboard/CreateTreeModal.tsx` | 8c-1 | Move under `(app)/dashboard/...` |
| `src/app/dashboard/TreeCardMenu.tsx` | 8c-1 | Same |
| `src/app/dashboard/RenameTreeModal.tsx` | 8c-1 | Same |
| `src/app/dashboard/DeleteTreeDialog.tsx` | 8c-1 | Same |
| `src/app/tree/[id]/page.tsx` | 8c-1, 8c-4 | Move under `(app)/tree/[id]/page.tsx`; wrap data-fetch in `<Suspense>` |
| `src/app/invite/[token]/page.tsx` | 8c-1 | Move under `(app)/invite/[token]/page.tsx` |
| `src/proxy.ts` | 8c-1 | Update matcher to reflect new route paths (no change if Next route groups handle this transparently — verify) |
| `src/app/page.tsx` | 8c-2 | REPLACED with real landing screen + authed-redirect |
| `src/app/dashboard/loading.tsx` | 8c-3 | Heirloom palette skeleton (after 8c-1 move: `src/app/(app)/dashboard/loading.tsx`) |
| `src/app/tree/[id]/loading.tsx` | 8c-3 | Heirloom palette skeleton (after move) |
| `src/app/(app)/dashboard/page.tsx` | 8c-4 | Wrap data-fetch in `<Suspense>` |
| `src/components/landing/LandingHero.tsx` | 8c-5 | Wrap CTA `<Link>` in `<ViewTransition>` boundary |
| `src/app/(app)/dashboard/TreeCard.tsx` (or wherever the tree card lives) | 8c-4, 8c-5 | Add `<LinkProgress>` + `<ViewTransition>` boundary on tree-card links |
| `src/app/tree/[id]/_components/MembersSheet.tsx` | 8c-6 | Add inline explanatory `<p>` next to revoke-member Confirm |
| `docs/tasks/current-phase.md` | every sub-task | Tick the corresponding sub-task entry |
| `docs/tasks/phase-backlog.md` | every sub-task | Tick the corresponding Phase 8 backlog entry |
| `docs/qa/smoke-flows.md` | phase close-out | Append `phase-8b-tree-polish` + `phase-8c-landing-and-nav` flows |
| `docs/adrs/0008-design-system.md` | 8c-6 | Append italic-Cormorant audit-result note (if any deviations stand) |

**Generated (not committed by hand):**

| Path | Note |
|---|---|
| `src/lib/generated/version.ts` | Written by [`scripts/derive-version.mjs`](../../../scripts/derive-version.mjs) `prebuild`. Already exists post-Amendment 4. |

---

## Sub-task / branch decomposition

**One phase branch holds all 14 sub-tasks** (per the `feedback_feature_branch_workflow.md` rule, inverted 2026-05-15 to phase-branch-as-default):

```bash
git checkout qa && git pull --ff-only
git checkout -b feat/phase-8-visual-polish-landing
```

Each sub-task lands as **ONE commit** on this branch. Per CLAUDE.md, **always ask the user before each `git commit`** with a diff summary. Per `feedback_update_tasks_before_commit.md`, the `task-doc-keeper` agent must tick the corresponding entry in `docs/tasks/current-phase.md` in the SAME commit (the `task-doc-tick-detector` PreToolUse hook will auto-nudge if forgotten).

Internal milestones — **dispatch `e2e-smoke-tester` as a background agent against the Vercel preview URL** after each milestone:

- After 8a-4 → milestone **8a-done** (smoke: brand parts don't break existing flows)
- After 8b-3 → milestone **8b-done** (smoke: tree canvas works; QA feedback gate on duplicate marker)
- After 8c-7 → milestone **8c-done** (smoke: landing + nav + transitions all work)

After phase close → **one PR** `feat/phase-8-visual-polish-landing → qa` (squash-merge); then the `release/v0.4.0` recipe (§"Phase close-out + release" at the end of this plan).

---

## Plan-time resolved decisions

Resolves the 7 open questions in the spec.

| # | Spec question | Resolution |
|---|---|---|
| 1 | **8a-1 output format** — markdown decisions doc or formal ADR? | **Markdown decisions doc** at `docs/architecture/brand-decisions.md`. ADR only if Knot supersedes the meetthefam brand name (decided during 8a-1 review — open ADR 0011 if so). |
| 2 | **8a-2 contrast verification approach** — manual or `@axe-core/playwright`? | **Manual screenshot walk + computed-style spot checks via DevTools.** `@axe-core/playwright` deferred to v0.5+ (overkill for 5-token swap). |
| 3 | **8a-4 icon stroke widths** — match Kintree exactly or tune to Lucide 2px? | **Match Kintree exactly.** Kintree icons are decorative; Lucide stroke would feel sterile next to them. Verify visual fit during 8a-4 review. |
| 4 | **8b-3 duplicate marker — connector-line visual interaction** | **Connector line for duplicates also rendered dashed** via a small CSS override in `globals.css` keyed off a `.f3 .mtf-node--duplicate` parent. Spike in 8b-3 to confirm family-chart's link rendering respects this. |
| 5 | **8c-1 dashboard layout rebase** — collapse two layers? | **Yes, collapse.** Move dashboard chrome (top-nav + Sign Out) UP to `(app)/layout.tsx`; no consumer relies on the dashboard-specific layout being separate. |
| 6 | **8c-5 `<ViewTransition>` scope** — root, per-segment, or per-link? | **Per-link** for the dashboard tree cards + landing CTA. Per [React 19.2 ViewTransition docs](https://react.dev/reference/react/ViewTransition), per-link gives fine-grained control + clean fallback. Root-level wrapping deferred unless 8c-5 reveals it's needed everywhere. |
| 7 | **8c-7 footer placement** — global or only landing + dashboard? | **Mount in `src/app/layout.tsx` (truly global)** so it shows on landing, dashboard, tree, invite, share routes. Use `pointer-events:none` so it never blocks the FAB on `/tree/[id]`. Position: `position:fixed; bottom:8px; right:12px; font-size:11px; opacity:0.4;` — visually unobtrusive. |

---

## Bundle 8a — Brand foundations (4 sub-tasks)

### Task 8a-0: Cut the phase branch

**Files:** none (branch operation)

- [ ] **Step 1: Confirm qa is current**

```bash
git checkout qa && git pull --ff-only
```

Expected: `Already up to date.` or fast-forward to latest origin/qa.

- [ ] **Step 2: Cut phase branch**

```bash
git checkout -b feat/phase-8-visual-polish-landing
```

Expected: `Switched to a new branch 'feat/phase-8-visual-polish-landing'`.

- [ ] **Step 3: Push branch to origin so the Vercel preview spins up**

```bash
git push -u origin feat/phase-8-visual-polish-landing
```

Expected: new branch created on origin; Vercel preview URL appears in GitHub Actions / Vercel dashboard.

---

### Task 8a-1: Knot brand-guide pull-review + decisions doc

**Files:**
- Create: `docs/architecture/brand-decisions.md`
- Reference: `docs/ux/inspiration/knot/project/theme.css`, `tokens.json`, `logo.svg`, `Knot - Brand Guide.html`, `Logo Explorations.html`, `Logo Explorations v2.html`, `fonts.md`, `handoff.md`, `data.jsx`, `shared.jsx`
- Modify: `docs/tasks/current-phase.md` (tick 8a-1)

- [ ] **Step 1: Read the Knot bundle in full**

Read each file in `docs/ux/inspiration/knot/project/`:

```bash
ls docs/ux/inspiration/knot/project/
# Expected: data.jsx, fonts.md, handoff.md, Knot - Brand Guide.html,
# logo.svg, Logo Explorations.html, Logo Explorations v2.html, shared.jsx,
# theme.css, tokens.json
```

Then read the markdown + JSON + CSS files (HTML files are visual mockups — open in browser if needed):

```bash
cat docs/ux/inspiration/knot/project/handoff.md
cat docs/ux/inspiration/knot/project/fonts.md
cat docs/ux/inspiration/knot/project/theme.css
cat docs/ux/inspiration/knot/project/tokens.json
```

- [ ] **Step 2: Create the decisions doc**

Create `docs/architecture/brand-decisions.md` with this structure:

```markdown
# Brand decisions — Knot pull-review (2026-05-XX)

> Cherry-pick discipline from [ADR 0008](../adrs/0008-design-system.md). Each row records ADOPT / DECLINE / DEFER + rationale.

## Identity

| Element | Decision | Rationale |
|---|---|---|
| Brand name | **Keep "meetthefam"** / **Adopt "Knot"** | <fill at review time> |
| Logomark | <decision> | <rationale> |
| Wordmark | <decision> | <rationale> |

## Palette

| Token | Knot value | meetthefam current | Decision | Rationale |
|---|---|---|---|---|
| `--background` / `--cream` | `oklch(95% 0.015 80)` (#F5EFE3) | `oklch(0.945 0.014 80)` | <decision> | <rationale> |
| `--card` / `--paper` | `oklch(98.7% 0.01 85)` (#FFFCF5) | `oklch(0.99 0.008 85)` | <decision> | <rationale> |
| `--primary` / `--ink` | `oklch(33.5% 0.04 158)` (#2D4A3E) | `oklch(0.36 0.04 155)` | <decision> | <rationale> |
| `--accent` | `oklch(64% 0.10 39)` (#C77B5C) | `oklch(0.65 0.10 40)` | <decision> | <rationale> |
| `--muted-foreground` / `--mid` | `oklch(46% 0.015 70)` (#6B6358) | `oklch(0.42 0.018 70)` | <decision> | <rationale> |
| Five tones | sage/rose/indigo/amber/green (see tokens.json) | matching token names | <decision> | <rationale> |
| Dark mode (warm-shifted) | `--cream: #1B1814`, `--paper: #241F18`, `--ink: #E8DFD0`, `--accent: #E09376`, `--mid: #9A9081` | shadcn defaults | **Adopt — 8a-2** | Spec ship gate; shadcn defaults are placeholder |

## Typography

| Token | Knot value | meetthefam current | Decision | Rationale |
|---|---|---|---|---|
| Display | "Cormorant Garamond", Georgia, serif | `--font-serif` (Cormorant Garamond via next/font) | **Adopt — already aligned** | — |
| Body | "Manrope", system-ui, sans-serif | `--font-sans` (Manrope via next/font) | **Adopt — already aligned** | — |

## Shapes + Shadows

| Token | Knot value | meetthefam current | Decision |
|---|---|---|---|
| `--radius` (xs/sm/md/lg/xl/pill) | 6/10/14/20/24/999 px | `--radius: 0.5rem` (single value) | <decision> |
| `--shadow-card` | `0 1px 2px rgba(60,40,20,.03), 0 8px 28px rgba(60,40,20,.05)` | no token | <decision> |
| `--shadow-node-hover` | `0 0 0 3px rgba(45,74,62,.12), 0 8px 24px rgba(60,40,20,.10)` | no token | <decision — informs 8b-2 hover affordance |
| `--shadow-fab` | `0 8px 22px rgba(199,123,92,.45)` | no token | <decision — informs FAB |

## Iconography

| Decision | Rationale |
|---|---|
| Hybrid icon set (Lucide for utility + Kintree-extracted brand icons) per [ADR 0008](../adrs/0008-design-system.md) — stays | — |
| 8a-4 extracts `Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart` from Kintree (NOT Knot) | Kintree's are decorative-line style, fits the heirloom journal aesthetic |

## ADR impact

- ADR 0008 → <amend with adopted palette/typography deltas, OR no amendment needed>
- ADR 0011 (NEW) — <only if "Knot" replaces "meetthefam" as the brand name>

## Open questions to revisit at v0.5+

- <any items not adopted/declined that warrant a future look>
```

- [ ] **Step 3: Fill in the decisions row-by-row**

Walk each row with the current `globals.css` open as reference. For each token compare Knot vs current and decide ADOPT / DECLINE / DEFER. Write the rationale in the cell.

**Key decision points (lean toward these defaults unless review surfaces a reason to change)**:
- Brand name: keep "meetthefam" — no public marketing exists yet that ties the brand to Knot
- Palette: ADOPT Knot's lightness values (slightly brighter cream + ink) — they're 1-2 percentage points off and Knot's are the source-of-truth bundle
- Radius scale: ADOPT the 6-step scale; replaces the single-value `--radius`
- Shadows: ADOPT all 4 (`card`, `node`, `node-hover`, `panel`, `fab`) — currently the project has no shadow tokens

- [ ] **Step 4: User review**

Show the user the filled-in doc. Per CLAUDE.md commit rules, wait for explicit approval of decisions before committing.

> "Brand-decisions doc drafted. Please review the row-by-row decisions before I commit."

If the user opts for "Knot replaces meetthefam," follow up with **Step 4a**: open `docs/adrs/0011-knot-brand-supersession.md` mirroring the format of `0008-design-system.md`. Otherwise skip 4a.

- [ ] **Step 5: Tick the sub-task in current-phase.md**

Edit `docs/tasks/current-phase.md`:

```diff
- [ ] **Sub-task 8a-1** — Knot brand-guide pull-review + decisions doc. No code.
+ [x] **Sub-task 8a-1** — Knot brand-guide pull-review + decisions doc. Decisions captured in `../architecture/brand-decisions.md`. No ADR amendment needed / new ADR 0011 opened (per review).
```

Also tick the corresponding entry in `docs/tasks/phase-backlog.md` under Phase 8.

- [ ] **Step 6: Commit**

Show diff summary. Ask user for approval. On approval:

```bash
git add docs/architecture/brand-decisions.md docs/tasks/current-phase.md docs/tasks/phase-backlog.md
# If ADR 0011 opened, also: git add docs/adrs/0011-knot-brand-supersession.md
git commit -m "$(cat <<'EOF'
docs(phase-8): 8a-1 — Knot brand-guide pull-review + decisions doc

Captures cherry-pick decisions from the Knot bundle vendored
in docs/ux/inspiration/knot/. ADR 0008 amendments / new ADR 0011
included as appropriate per review.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Push**

```bash
git push
```

---

### Task 8a-2: Warm-shifted dark-mode tokens

**Files:**
- Modify: `src/app/globals.css` (the `.dark { … }` block, lines 105-137)
- Modify: `docs/tasks/current-phase.md` (tick 8a-2)
- Modify: `docs/tasks/phase-backlog.md` (tick the Phase 8 dark-mode entry)

- [ ] **Step 1: Re-read the current `.dark` block + the Knot dark tokens**

```bash
sed -n '105,137p' src/app/globals.css       # current .dark
cat docs/ux/inspiration/knot/project/theme.css   # has Knot's .dark below the @theme block
```

Current `.dark` uses shadcn defaults (`oklch(0.145 0 0)` etc — desaturated gray). Knot's `.dark` is warm-shifted: `--cream: #1B1814; --paper: #241F18; --ink: #E8DFD0; --accent: #E09376; --mid: #9A9081`.

- [ ] **Step 2: Map Knot dark tokens into the shadcn token names**

Map by semantic role:

| meetthefam token | Knot dark token | Hex (Knot) | OKLCH (computed) |
|---|---|---|---|
| `--background` | `--cream` | `#1B1814` | `oklch(0.18 0.01 60)` |
| `--card` | `--paper` | `#241F18` | `oklch(0.22 0.012 70)` |
| `--popover` | `--paper` | `#241F18` | `oklch(0.22 0.012 70)` |
| `--foreground` | `--ink` | `#E8DFD0` | `oklch(0.89 0.018 80)` |
| `--card-foreground` | `--ink` | `#E8DFD0` | `oklch(0.89 0.018 80)` |
| `--popover-foreground` | `--ink` | `#E8DFD0` | `oklch(0.89 0.018 80)` |
| `--muted` | adjust toward `--paper` | `#2A2520` | `oklch(0.25 0.012 70)` |
| `--muted-foreground` | `--mid` | `#9A9081` | `oklch(0.62 0.018 80)` |
| `--primary` | brighter `--ink` | `#F0E7D6` | `oklch(0.92 0.018 80)` (so primary buttons stay legible in dark mode against `--paper`) |
| `--primary-foreground` | `--cream` | `#1B1814` | `oklch(0.18 0.01 60)` |
| `--accent` | dark `--accent` | `#E09376` | `oklch(0.72 0.10 38)` |
| `--accent-foreground` | `--cream` | `#1B1814` | `oklch(0.18 0.01 60)` |
| `--border` | `--ink @ 12%` | translucent | `oklch(0.89 0.018 80 / 0.12)` |
| `--input` | `--ink @ 18%` | translucent | `oklch(0.89 0.018 80 / 0.18)` |
| `--ring` | `--accent` | matches | `oklch(0.72 0.10 38)` |

Tone tokens (`--tone-*`) stay as-is — they're decorative accents, not theme surfaces.

- [ ] **Step 3: Replace the `.dark` block**

Edit `src/app/globals.css`:

```css
.dark {
  /* Warm-shifted dark mode per Knot brand-decisions.md (Phase 8a-2) — NOT
   * a desaturated invert of light mode. Sustains the heirloom journal
   * aesthetic in dark. */
  --background: oklch(0.18 0.01 60);       /* warm near-black ≈ #1B1814 */
  --foreground: oklch(0.89 0.018 80);      /* warm parchment ≈ #E8DFD0 */
  --card: oklch(0.22 0.012 70);            /* paper-on-dark ≈ #241F18 */
  --card-foreground: oklch(0.89 0.018 80);
  --popover: oklch(0.22 0.012 70);
  --popover-foreground: oklch(0.89 0.018 80);
  --primary: oklch(0.92 0.018 80);         /* brightened ink for button legibility */
  --primary-foreground: oklch(0.18 0.01 60);
  --secondary: oklch(0.25 0.012 70);
  --secondary-foreground: oklch(0.89 0.018 80);
  --muted: oklch(0.25 0.012 70);
  --muted-foreground: oklch(0.62 0.018 80);
  --accent: oklch(0.72 0.10 38);           /* warm terracotta ≈ #E09376 */
  --accent-foreground: oklch(0.18 0.01 60);
  --destructive: oklch(0.70 0.18 25);
  --border: oklch(0.89 0.018 80 / 0.12);
  --input: oklch(0.89 0.018 80 / 0.18);
  --ring: oklch(0.72 0.10 38);
  --chart-1: oklch(0.92 0.018 80);
  --chart-2: oklch(0.72 0.10 38);
  --chart-3: oklch(0.62 0.018 80);
  --chart-4: oklch(0.50 0.04 200);
  --chart-5: oklch(0.45 0.06 60);
  --sidebar: oklch(0.22 0.012 70);
  --sidebar-foreground: oklch(0.89 0.018 80);
  --sidebar-primary: oklch(0.92 0.018 80);
  --sidebar-primary-foreground: oklch(0.18 0.01 60);
  --sidebar-accent: oklch(0.25 0.012 70);
  --sidebar-accent-foreground: oklch(0.89 0.018 80);
  --sidebar-border: oklch(0.89 0.018 80 / 0.12);
  --sidebar-ring: oklch(0.72 0.10 38);
}
```

- [ ] **Step 4: Verify typecheck + dev server**

```bash
pnpm typecheck
pnpm dev
```

Open `http://localhost:3000/dashboard` (already authed in dev) in dark mode (system preference or DevTools → Rendering → Emulate `prefers-color-scheme: dark`). Walk:

- Dashboard top-nav: text visible against background
- Tree cards: card-foreground readable
- A tree page: family-chart canvas + nodes legible

- [ ] **Step 5: Spot-check contrast**

In DevTools Inspector, hover the contrast pill on:
- Dashboard heading text: foreground vs background — expect ≥ 7.0 (AAA)
- Tree card body text: card-foreground vs card — expect ≥ 4.5 (AA)
- Sign Out link: foreground vs background — expect ≥ 4.5

If any drop below 4.5, adjust the OKLCH lightness gap by ±0.02 and re-check.

- [ ] **Step 6: Tick + commit**

Update `docs/tasks/current-phase.md` and `docs/tasks/phase-backlog.md`:

```diff
- [ ] **Sub-task 8a-2** — Warm-shifted dark-mode tokens in `globals.css`; WCAG re-verify.
+ [x] **Sub-task 8a-2** — Warm-shifted dark-mode tokens in `globals.css`; WCAG contrast spot-checks pass (AAA on heading, AA on body) on dashboard + tree page.
```

Ask user for approval to commit. On approval:

```bash
git add src/app/globals.css docs/tasks/current-phase.md docs/tasks/phase-backlog.md
git commit -m "$(cat <<'EOF'
feat(phase-8): 8a-2 — warm-shifted dark-mode tokens

Replace shadcn-default .dark block with the warm-shifted palette from
the Knot bundle (cream → #1B1814, paper → #241F18, ink → #E8DFD0,
accent → #E09376, mid → #9A9081). Sustains the heirloom journal
aesthetic in dark mode rather than reverting to a desaturated gray.

Spot-checked contrast on dashboard heading (AAA), tree card body (AA),
and Sign Out link (AA) against the new palette.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8a-3: Logo / logomark adoption

**Files:**
- Create: `src/components/icons/Logo.tsx`
- Create: `src/__tests__/components/Logo.test.tsx`
- Modify: `src/app/layout.tsx` (metadata)
- Modify: `src/app/dashboard/layout.tsx` (use `<Logo>`)
- Move: `docs/ux/inspiration/knot/project/logo.svg` → `public/logo.svg` (or embed paths in `Logo.tsx`)
- Modify: `public/favicon.ico` (replace Next default)
- Modify: `docs/tasks/current-phase.md`, `docs/tasks/phase-backlog.md`

- [ ] **Step 1: Inspect the Knot logo SVG**

```bash
cat docs/ux/inspiration/knot/project/logo.svg
```

Expected: 96×96 viewBox, three overlapping rings + terracotta dot, ~403 bytes. Note the actual `<path>` / `<circle>` elements, their stroke colors, and the terracotta `<circle>`.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/components/Logo.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from '@/components/icons/Logo'

describe('<Logo>', () => {
  it('renders an SVG with role="img" and aria-label', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('meetthefam')
  })

  it('uses currentColor for the ring strokes', () => {
    const { container } = render(<Logo />)
    const strokeEls = container.querySelectorAll('[stroke]')
    strokeEls.forEach((el) => {
      expect(el.getAttribute('stroke')).toBe('currentColor')
    })
  })

  it('matches snapshot at default size', () => {
    const { asFragment } = render(<Logo />)
    expect(asFragment()).toMatchSnapshot()
  })
})
```

This needs `@testing-library/react`. Check if installed:

```bash
pnpm list @testing-library/react 2>&1 | head -3
```

If not installed:

```bash
pnpm add -D @testing-library/react @testing-library/dom
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test src/__tests__/components/Logo.test.tsx --run
```

Expected: FAIL with "Cannot find module '@/components/icons/Logo'".

- [ ] **Step 4: Create the `<Logo>` component**

Create `src/components/icons/Logo.tsx` (embed the SVG paths from Step 1; placeholder structure here — fill in the actual paths from `logo.svg`):

```tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Knot logomark — three overlapping rings + terracotta accent dot.
 * Stroke uses `currentColor` so the rings inherit the wrapper's text color
 * (so light mode shows forest-green, dark mode shows warm parchment).
 * The terracotta dot uses var(--accent) which auto-flips per .dark.
 */
export function Logo({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="meetthefam"
      className={className}
    >
      {/* Three overlapping rings — fill the actual <circle cx cy r> values
       *  from docs/ux/inspiration/knot/project/logo.svg here. */}
      <circle cx="32" cy="40" r="22" stroke="currentColor" strokeWidth="3" />
      <circle cx="64" cy="40" r="22" stroke="currentColor" strokeWidth="3" />
      <circle cx="48" cy="64" r="22" stroke="currentColor" strokeWidth="3" />
      {/* Terracotta accent dot */}
      <circle cx="48" cy="48" r="4" fill="var(--accent)" />
    </svg>
  )
}
```

**Important**: replace the `cx`/`cy`/`r` placeholder values above with the exact values from the vendored `logo.svg`. The shape should match the bundle.

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/__tests__/components/Logo.test.tsx --run
```

Expected: 3 PASS. If the snapshot test "fails" because no snapshot exists yet, run with `-u` to write it:

```bash
pnpm test src/__tests__/components/Logo.test.tsx --run -u
```

- [ ] **Step 6: Vendor the SVG to /public for favicon use**

```bash
cp docs/ux/inspiration/knot/project/logo.svg public/logo.svg
```

- [ ] **Step 7: Create a favicon from the SVG**

Use the SVG directly as a favicon (modern browsers support SVG favicons):

Edit `src/app/layout.tsx` metadata:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'meetthefam',
  description: 'A heirloom-quality family-tree builder for the people who already know each other',
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'meetthefam',
    description: 'A heirloom-quality family-tree builder',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'meetthefam',
    description: 'A heirloom-quality family-tree builder',
  },
}
```

If `src/app/layout.tsx` already has a `metadata` export, merge fields rather than replacing.

- [ ] **Step 8: Use `<Logo>` in the dashboard top-nav**

Edit `src/app/dashboard/layout.tsx`:

```tsx
import { SignOutButton } from './SignOutButton'
import { Logo } from '@/components/icons/Logo'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </div>
        <SignOutButton />
      </nav>
      {children}
    </div>
  )
}
```

(8c-1 will move this layout — but for 8a-3 we update it in place; the 8c-1 move carries the changes forward.)

- [ ] **Step 9: Verify in browser**

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard`:
- Logo renders left of "meetthefam" wordmark
- In light mode the rings are forest-green, dot is terracotta
- In dark mode (DevTools emulate) the rings are parchment, dot is warm terracotta
- Browser tab favicon shows the logomark

- [ ] **Step 10: Run typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: all clean; 3 new tests pass; total suite count up by 3.

- [ ] **Step 11: Tick + commit**

Update task docs as in 8a-2. Ask user to approve commit. On approval:

```bash
git add src/components/icons/Logo.tsx src/__tests__/components/Logo.test.tsx \
  public/logo.svg src/app/layout.tsx src/app/dashboard/layout.tsx \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8a-3 — Logo logomark adoption

Wire the Knot logomark (three overlapping rings + terracotta accent dot)
into a new <Logo> component at src/components/icons/Logo.tsx, currentColor-
friendly so it inherits the wrapper's text color. Vendor logo.svg into
/public/ as the browser favicon. Replace the Next-default favicon, update
layout.tsx metadata (title/OG/Twitter), and use <Logo> in the dashboard
top-nav alongside the wordmark.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8a-4: Brand icon set

**Files:**
- Create: `src/components/icons/Branch.tsx`, `Leaf.tsx`, `Quote.tsx`, `Family.tsx`, `Sparkle.tsx`, `Heart.tsx`
- Create: `src/__tests__/components/icons.test.tsx`
- Modify: task docs

- [ ] **Step 1: Locate icon definitions in Kintree's shared.jsx**

```bash
grep -n "const Branch\|const Leaf\|const Quote\|const Family\|const Sparkle\|const Heart" docs/ux/inspiration/kintree/project/shared.jsx
```

For each match, read 10-15 lines below to capture the full SVG path/circle/etc.

- [ ] **Step 2: Write the failing matrix test**

Create `src/__tests__/components/icons.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Branch } from '@/components/icons/Branch'
import { Leaf } from '@/components/icons/Leaf'
import { Quote } from '@/components/icons/Quote'
import { Family } from '@/components/icons/Family'
import { Sparkle } from '@/components/icons/Sparkle'
import { Heart } from '@/components/icons/Heart'

const Cases = [
  ['Branch', Branch],
  ['Leaf', Leaf],
  ['Quote', Quote],
  ['Family', Family],
  ['Sparkle', Sparkle],
  ['Heart', Heart],
] as const

describe('brand icons', () => {
  for (const [name, Component] of Cases) {
    it(`<${name}> renders an SVG with currentColor`, () => {
      const { container } = render(<Component />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
      // At least one stroke or fill should use currentColor.
      const usesCurrentColor =
        container.innerHTML.includes('stroke="currentColor"') ||
        container.innerHTML.includes('fill="currentColor"')
      expect(usesCurrentColor).toBe(true)
    })

    it(`<${name}> matches snapshot`, () => {
      const { asFragment } = render(<Component />)
      expect(asFragment()).toMatchSnapshot()
    })
  }
})
```

- [ ] **Step 3: Run test, verify it fails**

```bash
pnpm test src/__tests__/components/icons.test.tsx --run
```

Expected: 12 fails ("Cannot find module" for each icon).

- [ ] **Step 4: Create each icon component**

Template every icon on this shape (replace `viewBox` + path content with the actual values from `shared.jsx`):

```tsx
// src/components/icons/Branch.tsx
type Props = {
  size?: number
  className?: string
  flip?: boolean
}

export function Branch({ size = 200, className, flip = false }: Props) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.4)}
      viewBox="0 0 200 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      className={className}
    >
      {/* Replace with the actual <path d="..."> from shared.jsx → Branch */}
      <path d="M0 40 Q50 10 100 40 T200 40" />
    </svg>
  )
}
```

Do the same for `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart`. Each gets its own file. Match Kintree stroke widths exactly per plan-time decision #3.

For Lucide-style single-glyph icons (`Sparkle`, `Heart`, `Quote`), use a 24×24 viewBox. For decorative motif icons (`Branch`, `Leaf`), use the Kintree viewBox dimensions exactly.

- [ ] **Step 5: Run test to verify all 12 pass**

```bash
pnpm test src/__tests__/components/icons.test.tsx --run -u
```

(`-u` updates snapshots on first run.)

Expected: 12 PASS. Remove `-u` and re-run to confirm snapshots stable:

```bash
pnpm test src/__tests__/components/icons.test.tsx --run
```

Expected: 12 PASS.

- [ ] **Step 6: Lint, typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: clean.

- [ ] **Step 7: Tick + commit**

Update task docs. Ask user to approve. On approval:

```bash
git add src/components/icons/Branch.tsx src/components/icons/Leaf.tsx \
  src/components/icons/Quote.tsx src/components/icons/Family.tsx \
  src/components/icons/Sparkle.tsx src/components/icons/Heart.tsx \
  src/__tests__/components/icons.test.tsx \
  src/__tests__/components/__snapshots__/icons.test.tsx.snap \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8a-4 — brand icon set

Extract Branch, Leaf, Quote, Family, Sparkle, Heart SVGs from the Kintree
prototype bundle and re-implement as React components at
src/components/icons/<Name>.tsx. One file per icon (focused responsibility).
All icons use currentColor so they inherit the wrapper's text color.

Lucide stays for utility icons everywhere else (per ADR 0008's hybrid
icon-set decision).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Milestone 8a-done — internal smoke test

- [ ] **Step 1: Run e2e-smoke-tester against the Vercel preview**

Dispatch the smoke-tester subagent in the background:

```
Agent({
  subagent_type: "e2e-smoke-tester",
  description: "Phase 8a smoke check",
  prompt: "Run smoke flows phase-1-auth, phase-2-tree-crud, phase-3-people-crud, phase-4-tree-visualization, phase-5-photo-upload, phase-6-collaboration, phase-7-share-link against the Vercel preview for the feat/phase-8-visual-polish-landing branch. Confirm no regressions from the brand-foundations changes (logo render, dark-mode tokens, brand icons). Report PASS/FAIL/SKIPPED per flow.",
  run_in_background: true
})
```

- [ ] **Step 2: Manual dark-mode walk**

In a real browser (not just DevTools), set the system preference to dark mode. Walk:
- Landing scaffold (still the create-next-app default — that's OK, 8c-2 replaces)
- Login
- Dashboard
- A tree page
- The share view (open the latest test tree's share URL)

Confirm: no contrast regressions, logo + favicon render correctly, no console errors.

---

## Bundle 8b — Person + tree canvas polish (3 sub-tasks)

### Task 8b-1: Gender-shape avatar + deceased treatment + Memoriam

**Files:**
- Modify: `src/components/ui/avatar.tsx` (add `gender?` + `deceased?` props)
- Create: `src/components/ui/memoriam.tsx`
- Create: `src/__tests__/components/memoriam.test.tsx`
- Modify: `src/__tests__/lib/person-node-html.test.ts` (or create if absent)
- Modify: `src/app/tree/[id]/_lib/person-node-html.ts`
- Modify: `src/app/tree/[id]/_components/PersonCard.tsx`
- Modify: `src/app/tree/[id]/_components/PersonPicker.tsx`

- [ ] **Step 1: Write failing tests for the Avatar extension**

Add or extend `src/__tests__/lib/person-node-html.test.ts`:

```ts
/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { personNodeHtml } from '@/app/tree/[id]/_lib/person-node-html'

const baseDatum = {
  id: 'p1',
  rels: { children: [], spouses: [] },
  data: {
    full_name: 'George Smith',
    birth_year: 1900,
    death_year: 1975,
    deceased: false,
    photo_url: null,
    tone: 'sage' as const,
    gender: 'm' as const,
  },
}

describe('personNodeHtml — gender shape', () => {
  it('male renders rounded-square avatar (border-radius ~18%)', () => {
    const html = personNodeHtml({ data: { ...baseDatum, data: { ...baseDatum.data, gender: 'm' } } } as never)
    expect(html).toContain('border-radius:9px')   // round(48 * 0.18) = 9
  })

  it('other renders squircle avatar (border-radius ~34%)', () => {
    const html = personNodeHtml({ data: { ...baseDatum, data: { ...baseDatum.data, gender: 'other' } } } as never)
    expect(html).toContain('border-radius:16px')  // round(48 * 0.34) = 16
  })

  it('female renders circle avatar (border-radius 50%)', () => {
    const html = personNodeHtml({ data: { ...baseDatum, data: { ...baseDatum.data, gender: 'f' } } } as never)
    expect(html).toContain('border-radius:50%')
  })

  it('unknown renders circle (default)', () => {
    const html = personNodeHtml({ data: { ...baseDatum, data: { ...baseDatum.data, gender: 'unknown' } } } as never)
    expect(html).toContain('border-radius:50%')
  })
})

describe('personNodeHtml — deceased treatment', () => {
  it('deceased adds the † badge', () => {
    const html = personNodeHtml({
      data: { ...baseDatum, data: { ...baseDatum.data, deceased: true } },
    } as never)
    expect(html).toContain('†')
    expect(html).toContain('mtf-node__deceased-badge')
  })

  it('deceased adds saturate(0.55) filter to the avatar', () => {
    const html = personNodeHtml({
      data: { ...baseDatum, data: { ...baseDatum.data, deceased: true } },
    } as never)
    expect(html).toContain('saturate(0.55)')
  })

  it('living does NOT add the † badge', () => {
    const html = personNodeHtml({
      data: { ...baseDatum, data: { ...baseDatum.data, deceased: false } },
    } as never)
    expect(html).not.toContain('mtf-node__deceased-badge')
  })
})
```

Also create `src/__tests__/components/memoriam.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Memoriam } from '@/components/ui/memoriam'

describe('<Memoriam>', () => {
  it('prefixes the name with †', () => {
    const { getByText } = render(<Memoriam name="George Smith" />)
    expect(getByText(/†\s*George Smith/)).toBeTruthy()
  })

  it('uses muted foreground for the glyph', () => {
    const { container } = render(<Memoriam name="George Smith" />)
    const glyph = container.querySelector('[data-memoriam-glyph]')
    expect(glyph).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts src/__tests__/components/memoriam.test.tsx --run
```

Expected: many FAILs ("Cannot find module" + assertion failures).

- [ ] **Step 3: Extend Avatar with `gender` + `deceased` props**

Edit `src/components/ui/avatar.tsx`:

```tsx
// Add to the Props type:
type Props = {
  fullName: string
  initials?: string
  photoUrl?: string | null
  tone: Tone
  size?: Size
  ring?: boolean
  /** Gender shape: 'm' → rounded-square, 'other' → squircle, 'f' / 'unknown' → circle. */
  gender?: 'm' | 'f' | 'other' | 'unknown'
  /** Deceased: avatar desaturates, gains a † badge at size >= 36. */
  deceased?: boolean
  className?: string
}

// Helper inside the file (above the Avatar function):
function borderRadiusForGender(gender: Props['gender'], px: number): string {
  if (gender === 'm') return `${Math.round(px * 0.18)}px`
  if (gender === 'other') return `${Math.round(px * 0.34)}px`
  return '50%' // 'f', 'unknown', undefined
}

// In the Avatar function body, replace the rounded-full class + add deceased treatment:
export function Avatar({
  fullName,
  initials,
  photoUrl,
  tone,
  size = 'md',
  ring = false,
  gender = 'unknown',
  deceased = false,
  className,
}: Props) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size]
  const text = initials ?? computeInitials(fullName)
  const fontSize = Math.round(px * 0.34)
  const borderRadius = borderRadiusForGender(gender, px)

  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius,
    outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
    outlineOffset: ring ? 2 : undefined,
    filter: deceased ? 'saturate(0.55)' : undefined,
    opacity: deceased ? 0.82 : undefined,
    position: 'relative',
  }

  const containerClass = [
    'inline-flex items-center justify-center overflow-hidden shrink-0 select-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Deceased † badge — top-right corner; only rendered when size >= 36
  // because below that the badge is illegible.
  const deceasedBadge =
    deceased && px >= 36 ? (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: Math.round(px * 0.26),
          height: Math.round(px * 0.26),
          borderRadius: '50%',
          background: 'var(--card)',
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontSize: Math.round(px * 0.2),
          lineHeight: 1,
        }}
      >†</span>
    ) : null

  if (photoUrl) {
    return (
      <span className={containerClass} style={baseStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={fullName}
          width={px}
          height={px}
          className="h-full w-full object-cover"
        />
        {deceasedBadge}
      </span>
    )
  }

  return (
    <span
      className={containerClass}
      style={{
        ...baseStyle,
        background: `var(--tone-${tone}-bg)`,
        color: `var(--tone-${tone}-ink)`,
      }}
      aria-label={fullName}
      role="img"
    >
      <span
        className="font-serif"
        style={{
          fontSize,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {text}
      </span>
      {deceasedBadge}
    </span>
  )
}
```

- [ ] **Step 4: Create `<Memoriam>` component**

Create `src/components/ui/memoriam.tsx`:

```tsx
type Props = {
  name: string
  className?: string
}

/**
 * Renders a name prefixed with † for deceased people. Glyph is muted-foreground;
 * the name itself keeps its surrounding context's color. Use anywhere a
 * deceased person's name appears in serif type (PersonCard, share view, etc.).
 */
export function Memoriam({ name, className }: Props) {
  return (
    <span className={className}>
      <span
        data-memoriam-glyph
        aria-hidden="true"
        style={{
          color: 'var(--muted-foreground)',
          opacity: 0.6,
          fontWeight: 400,
          marginRight: '0.32em',
        }}
      >†</span>
      {name}
    </span>
  )
}
```

- [ ] **Step 5: Extend `personNodeHtml` to take gender + deceased + render in HTML**

Edit `src/app/tree/[id]/_lib/person-node-html.ts`:

Add to the helpers at the top of the file:

```ts
function borderRadiusForGender(gender: 'm' | 'f' | 'other' | 'unknown' | undefined, px: number): string {
  if (gender === 'm') return `${Math.round(px * 0.18)}px`
  if (gender === 'other') return `${Math.round(px * 0.34)}px`
  return '50%'
}
```

Update `avatarHtml` to take gender + deceased + render them:

```ts
function avatarHtml(data: FamilyChartDatum['data']): string {
  const sizePx = 48
  const radius = borderRadiusForGender(data.gender, sizePx)
  const filter = data.deceased ? 'saturate(0.55)' : ''
  const opacity = data.deceased ? '0.82' : '1'

  const wrapperBase = `
    width:${sizePx}px;
    height:${sizePx}px;
    border-radius:${radius};
    display:inline-flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    flex-shrink:0;
    filter:${filter};
    opacity:${opacity};
    position:relative;
  `

  const deceasedBadge = data.deceased
    ? `<span
        class="mtf-node__deceased-badge"
        aria-hidden="true"
        style="
          position:absolute;
          top:-4px;
          right:-4px;
          width:14px;
          height:14px;
          border-radius:50%;
          background:var(--card);
          color:var(--muted-foreground);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-family:var(--font-serif);
          font-size:10px;
          line-height:1;
          border:1px solid var(--border);
        ">†</span>`
    : ''

  if (data.photo_url) {
    return `
      <span class="mtf-node__avatar" style="${wrapperBase}">
        <img
          src="${escapeHtml(data.photo_url)}"
          alt=""
          width="${sizePx}"
          height="${sizePx}"
          style="width:100%;height:100%;object-fit:cover;"
        />
        ${deceasedBadge}
      </span>
    `
  }

  const initials = escapeHtml(computeInitials(data.full_name))
  const fontSize = Math.round(sizePx * 0.34)
  return `
    <span
      class="mtf-node__avatar"
      style="
        ${wrapperBase}
        background:var(--tone-${data.tone}-bg);
        color:var(--tone-${data.tone}-ink);
      "
    >
      <span
        style="
          font-family:var(--font-serif);
          font-size:${fontSize}px;
          font-weight:600;
          letter-spacing:0.02em;
          line-height:1;
        "
      >${initials}</span>
      ${deceasedBadge}
    </span>
  `
}
```

In the name-render section of `personNodeHtml`, prefix with † when deceased:

```ts
// Replace the existing name-div with:
const namePrefix = data.deceased ? `<span style="color:var(--muted-foreground);opacity:0.6;font-weight:400;margin-right:0.32em;">†</span>` : ''
// then in the returned HTML:
// ...
<div
  style="..."
>${namePrefix}${name}</div>
// ...
```

Also soften card chrome for deceased rows — add a class hook in the wrapper:

```ts
const cardClass = `mtf-node${data.deceased ? ' mtf-node--deceased' : ''}`
// then in the wrapper: <div class="${cardClass}" data-person-id="${id}" ...>
```

And add a CSS rule in `globals.css`:

```css
.f3 .mtf-node--deceased {
  border-color: color-mix(in oklch, var(--foreground) 10%, transparent);
  background: linear-gradient(180deg, var(--card), color-mix(in oklch, var(--foreground) 2.5%, transparent));
}
```

- [ ] **Step 6: Update PersonCard + PersonPicker to thread gender + deceased**

In `src/app/tree/[id]/_components/PersonCard.tsx`, find the `<Avatar>` usage and pass:

```tsx
<Avatar
  fullName={person.full_name}
  tone={person.tone}
  photoUrl={person.photo_url}
  gender={person.gender}
  deceased={person.deceased}
  size="md"
/>
```

If the card surfaces the person's name in serif elsewhere, wrap that name with `<Memoriam>` when `person.deceased`:

```tsx
import { Memoriam } from '@/components/ui/memoriam'
// …
<h3 className="font-serif text-lg">
  {person.deceased ? <Memoriam name={person.full_name} /> : person.full_name}
</h3>
```

Do the same in `src/app/tree/[id]/_components/PersonPicker.tsx`.

- [ ] **Step 7: Run tests, verify pass**

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts src/__tests__/components/memoriam.test.tsx --run -u
pnpm test src/__tests__/lib/person-node-html.test.ts src/__tests__/components/memoriam.test.tsx --run
```

Expected: all pass.

Run the full suite:

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: all clean.

- [ ] **Step 8: Visual verification**

```bash
pnpm dev
```

Open a tree page with the Smith Family Demo seed. Confirm:
- Living male: rounded-square avatar
- Living female: circle avatar
- Living "other" / unknown: squircle / circle
- Deceased grandparent: desaturated avatar + † badge + † name prefix + softened card border

- [ ] **Step 9: Tick + commit**

Update task docs. Ask user. On approval:

```bash
git add src/components/ui/avatar.tsx src/components/ui/memoriam.tsx \
  src/__tests__/components/memoriam.test.tsx \
  src/__tests__/lib/person-node-html.test.ts \
  src/app/tree/[id]/_lib/person-node-html.ts \
  src/app/tree/[id]/_components/PersonCard.tsx \
  src/app/tree/[id]/_components/PersonPicker.tsx \
  src/app/globals.css \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8b-1 — gender-shape avatar + deceased treatment + Memoriam

Three coordinated changes ship together per the 2026-05-12 Claude Design
brainstorm:

1. <Avatar> gains gender + deceased props. Gender drives border-radius
   ('m' rounded-square 18%, 'other' squircle 34%, 'f'/'unknown' circle).
   Deceased adds filter:saturate(0.55) + opacity:0.82 + a † badge in the
   top-right corner (sized >= 36).
2. New <Memoriam> component renders a † name prefix in muted-foreground.
   Used wherever a deceased person's name appears in serif type.
3. personNodeHtml mirrors both treatments in its HTML template
   (the family-chart cardInnerHtmlCreator takes raw HTML strings). New
   .mtf-node--deceased class softens card chrome (border opacity + subtle
   gradient).

NOT in scope: the "IN LOVING MEMORY" letterspaced uppercase line — user
declined during the original brainstorm. The avatar badge + name prefix
+ softened chrome already carry the signal.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8b-2: Tree-overview button + floating "+" hover affordance

**Files:**
- Create: `src/app/tree/[id]/_components/TreeOverviewButton.tsx`
- Create: `src/app/tree/[id]/_components/PersonHoverPlus.tsx`
- Modify: `src/app/tree/[id]/_components/FamilyTree.tsx` (mount both)

- [ ] **Step 1: Read family-chart's d3 zoom API**

```bash
grep -rn "zoom\|svg.call\|d3.zoom" node_modules/family-chart/dist/family-chart.esm.js | head -20
```

Expected: family-chart exposes a `zoom` behavior on its SVG root and a `chart.updateTree()` method. The pattern for "zoom to fit all nodes" is to compute the bounding box of the rendered SVG and apply a `d3.zoomTransform` that fits it into the viewport. Confirm the exact API names before coding.

- [ ] **Step 2: Create `TreeOverviewButton.tsx`**

```tsx
'use client'

import { Maximize2 } from 'lucide-react'

type Props = {
  /** Imperatively zoom-to-fit. Receives no args; resets URL hash too. */
  onActivate: () => void
}

export function TreeOverviewButton({ onActivate }: Props) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label="View whole tree"
      title="View whole tree"
      className="absolute top-3 right-3 z-10 h-10 w-10 rounded-md border border-border bg-card/85 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-card hover:text-foreground transition"
    >
      <Maximize2 size={16} />
    </button>
  )
}
```

- [ ] **Step 3: Create `PersonHoverPlus.tsx`**

This component renders the floating "+" affordance on hover/long-press over a tree node. It piggybacks on the existing `usePressActions` hook (`src/app/tree/[id]/_lib/usePressActions.ts`).

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

type Props = {
  /** Hover-target person id; null when not hovering anything. */
  hoverPersonId: string | null
  /** Open the add-relative form pre-seeded as `child of <person>`. */
  onActivate: (personId: string) => void
}

/**
 * Floating "+" affordance overlay. Positions itself absolutely over the
 * hovered tree node's bottom-right corner. The position is computed at
 * mount/hover time from the DOM node's bounding rect inside the SVG.
 *
 * Wires to the same Phase 3 addPerson Server Action used by the AddRelativeFab
 * — no duplicate create logic; just opens the same PersonForm with linkSpec
 * pre-seeded to defaultRelation: 'child'.
 */
export function PersonHoverPlus({ hoverPersonId, onActivate }: Props) {
  // Implementation: subscribe to a hoverPersonId-keyed effect that finds
  // the DOM node `[data-person-id="<id>"]` inside the family-chart container,
  // reads its bounding rect, and renders a Tailwind-positioned absolute
  // button at the bottom-right corner.
  //
  // The actual lookup + position math belongs in the FamilyTree wrapper
  // (which holds the chart container ref). This component is a presentational
  // overlay only.

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  if (!hoverPersonId || !position) return null

  return (
    <button
      type="button"
      onClick={() => onActivate(hoverPersonId)}
      aria-label="Add a child"
      title="Add a child"
      className="absolute z-10 h-9 w-9 rounded-full bg-accent text-accent-foreground shadow-[0_8px_22px_rgba(199,123,92,.45)] flex items-center justify-center hover:scale-105 transition-transform"
      style={{ top: position.top, left: position.left }}
    >
      <Plus size={18} />
    </button>
  )
}
```

(The above is a starter shape. During implementation, finalize how `position` gets set from the FamilyTree wrapper — likely via a parent-supplied prop, not local state.)

- [ ] **Step 4: Mount both in FamilyTree**

Edit `src/app/tree/[id]/_components/FamilyTree.tsx` (the exact existing structure varies; the pattern is):

```tsx
// Add to imports
import { TreeOverviewButton } from './TreeOverviewButton'
import { PersonHoverPlus } from './PersonHoverPlus'

// Add to state inside the FamilyTree component:
const [hoverPersonId, setHoverPersonId] = useState<string | null>(null)

// In the chart-init effect, after chart.updateTree(), expose zoom-to-fit:
const zoomToFit = useCallback(() => {
  if (!chartRef.current) return
  // Reset URL hash so we're not still focused on a person.
  history.replaceState(null, '', window.location.pathname)
  // Re-init the chart with a null main id to trigger d3's auto-fit.
  chartRef.current.updateMainId(null)
  chartRef.current.updateTree({ initial: true })
}, [])

// In the chart card's mouseenter/mouseleave handlers (or via the existing
// usePressActions hover branch), call setHoverPersonId(id) / setHoverPersonId(null).
// Wire the "+" hover affordance and TreeOverviewButton:

return (
  <>
    <div ref={chartRef} className="relative w-full h-[calc(100vh-3.5rem)]">
      {/* family-chart canvas renders here via the existing init effect */}
      {!readOnly && <TreeOverviewButton onActivate={zoomToFit} />}
      {!readOnly && (
        <PersonHoverPlus
          hoverPersonId={hoverPersonId}
          onActivate={(personId) => {
            // Open the existing add-relative form, pre-seeded as a child
            // of the hovered person. Reuses the same logic as AddRelativeFab.
            setAddRelativeOpen(true)
            setAddRelativeLinkSpec({ personId, defaultRelation: 'child' })
          }}
        />
      )}
    </div>
    {/* AddRelativeFab stays in its existing position; PersonHoverPlus is the
        hover-only counterpart. */}
  </>
)
```

- [ ] **Step 5: Verify in browser**

```bash
pnpm dev
```

Open a tree with multiple people. Confirm:
- Top-right of canvas: small icon button → click zooms out to fit all nodes; URL hash clears
- Hover a node (desktop): "+" appears bottom-right of that node; click opens add-relative form pre-seeded
- Mobile: long-press shows the action menu (existing) AND triggers the "+" affordance (additive, doesn't break the existing UX)

- [ ] **Step 6: Typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: clean. No new tests required for this sub-task — the new components are presentational; integration is exercised by the smoke flow.

- [ ] **Step 7: Tick + commit**

```bash
git add src/app/tree/[id]/_components/TreeOverviewButton.tsx \
  src/app/tree/[id]/_components/PersonHoverPlus.tsx \
  src/app/tree/[id]/_components/FamilyTree.tsx \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8b-2 — tree-overview button + floating "+" hover affordance

Two floating canvas controls land together for visual consistency.

TreeOverviewButton (top-right of the tree canvas, sibling to the FAB):
zooms out to fit all nodes via family-chart's d3 zoom + null mainId,
clears the URL hash so the canvas isn't re-focused on a person.

PersonHoverPlus (Phase 4 backlog carrier): floats a "+" over a node on
hover (desktop) / long-press (mobile). Wires to the same addPerson Server
Action used by AddRelativeFab — no duplicate create logic. Pre-seeds
linkSpec with defaultRelation: 'child'.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8b-3: Duplicate-card visual marker

**Files:**
- Modify: `src/app/tree/[id]/_lib/person-node-html.ts` (add `duplicate` branch)
- Modify: `src/app/tree/[id]/_components/FamilyTree.tsx` (duplicate tap → re-center on primary)
- Modify: `src/app/globals.css` (dashed connector line for duplicate parent)
- Modify: `src/__tests__/lib/person-node-html.test.ts` (extend tests)

- [ ] **Step 1: Write failing tests for the duplicate branch**

Extend `src/__tests__/lib/person-node-html.test.ts`:

```ts
describe('personNodeHtml — duplicate marker', () => {
  it('duplicate adds dashed border + corner up-arrow badge', () => {
    const html = personNodeHtml({
      data: { ...baseDatum, duplicate: true, data: baseDatum.data },
    } as never)
    expect(html).toContain('border-style:dashed')
    expect(html).toContain('mtf-node__duplicate-badge')
    expect(html).toContain('↑') // up-arrow inside the badge
  })

  it('duplicate adds "Already shown above" tooltip', () => {
    const html = personNodeHtml({
      data: { ...baseDatum, duplicate: true, data: baseDatum.data },
    } as never)
    expect(html).toContain('Already shown above')
  })

  it('duplicate keeps avatar full color (no opacity drop)', () => {
    // Confirms 8b-3 doesn't compete with 8b-1's deceased treatment.
    const html = personNodeHtml({
      data: { ...baseDatum, duplicate: true, data: { ...baseDatum.data, deceased: false } },
    } as never)
    // Should NOT have saturate(0.55) since it's not deceased.
    expect(html).not.toContain('saturate(0.55)')
    // Should NOT have an explicit opacity:0.55 on the card wrapper.
    expect(html).not.toMatch(/wrapper[^"]*opacity:0\.\d/)
  })

  it('deceased + duplicate compose without collision', () => {
    const html = personNodeHtml({
      data: {
        ...baseDatum,
        duplicate: true,
        data: { ...baseDatum.data, deceased: true },
      },
    } as never)
    // Deceased signals
    expect(html).toContain('saturate(0.55)')
    expect(html).toContain('mtf-node__deceased-badge')
    // Duplicate signals
    expect(html).toContain('border-style:dashed')
    expect(html).toContain('mtf-node__duplicate-badge')
  })
})
```

- [ ] **Step 2: Run, verify fails**

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts --run
```

Expected: 4 new FAILs.

- [ ] **Step 3: Extend `personNodeHtml` with the duplicate branch**

Edit `src/app/tree/[id]/_lib/person-node-html.ts`:

```ts
export function personNodeHtml(
  d: TreeDatum,
  options: PersonNodeHtmlOptions = {},
): string {
  const datum = d.data as unknown as FamilyChartDatum
  const data = datum.data
  // family-chart marks duplicate nodes with `duplicate: true` on the d3 node
  // wrapper (not on data). Read from both shapes defensively.
  const isDuplicate = Boolean(
    (d as unknown as { data: { duplicate?: boolean } }).data.duplicate ||
    (d as unknown as { duplicate?: boolean }).duplicate
  )

  const name = escapeHtml(data.full_name)
  const dates = formatDates(data.birth_year, data.death_year, data.deceased)
  const id = escapeHtml(datum.id)
  const cardClass = `mtf-node${data.deceased ? ' mtf-node--deceased' : ''}${isDuplicate ? ' mtf-node--duplicate' : ''}`

  const duplicateBadge = isDuplicate
    ? `<span
        class="mtf-node__duplicate-badge"
        aria-label="Already shown above — tap to jump"
        title="Already shown above"
        style="
          position:absolute;
          top:-6px;
          left:-6px;
          width:18px;
          height:18px;
          border-radius:50%;
          background:var(--card);
          color:var(--accent);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-family:var(--font-sans);
          font-size:12px;
          font-weight:600;
          line-height:1;
          border:1px solid var(--border);
        "
       >↑</span>`
    : ''

  const borderStyle = isDuplicate ? 'dashed' : 'solid'
  const namePrefix = data.deceased ? `<span style="color:var(--muted-foreground);opacity:0.6;font-weight:400;margin-right:0.32em;">†</span>` : ''

  return `
    <div
      class="${cardClass}"
      data-person-id="${id}"
      data-duplicate="${isDuplicate ? 'true' : 'false'}"
      style="
        position:relative;
        width:158px;
        height:110px;
        padding:8px 10px;
        border-radius:10px;
        border:1px ${borderStyle} var(--border);
        background:var(--card);
        color:var(--foreground);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        gap:4px;
        box-sizing:border-box;
        overflow:visible;
      "
    >
      ${options.readOnly || isDuplicate ? '' : ellipsisButton}
      ${duplicateBadge}
      ${avatarHtml(data)}
      <div
        style="
          font-family:var(--font-serif);
          font-size:14px;
          line-height:1.15;
          font-weight:600;
          text-align:center;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          word-break:break-word;
        "
      >${namePrefix}${name}</div>
      ${
        dates
          ? `<div
              style="
                font-family:var(--font-sans);
                font-size:11px;
                line-height:1;
                opacity:0.7;
              "
            >${escapeHtml(dates)}</div>`
          : ''
      }
    </div>
  `
}
```

(Note: duplicates don't get the action-trigger ellipsis button — they're not the canonical card. Tapping them re-centers; the ellipsis stays on the primary instance.)

- [ ] **Step 4: Add dashed-connector CSS**

Edit `src/app/globals.css`, append after the existing `.f3 .link` rule:

```css
/* Phase 8b-3 — duplicate nodes render with a dashed border (set in
 * personNodeHtml). Match their connector lines to read as "echo of the
 * primary instance." family-chart renders connectors as SVG <path> children
 * of .f3 .link; we can't directly target the link going TO a duplicate from
 * CSS without a JS pass that adds a class. Pragmatic compromise: render the
 * card chrome dashed (done in personNodeHtml) and leave connectors solid.
 * Revisit if QA feedback says connectors mismatch. */
```

- [ ] **Step 5: Add duplicate tap-to-jump handler in FamilyTree**

Edit `src/app/tree/[id]/_components/FamilyTree.tsx` — find the existing `setOnCardClick` or click handler:

```ts
// Inside the chart setup or click handler:
chart.setOnCardClick((event, cardNode) => {
  const targetEl = event.target as HTMLElement
  if (targetEl.closest('[data-action-trigger]')) {
    // Existing three-dot menu path
    return openActionMenuFor(cardNode.data.id)
  }
  if (targetEl.closest('[data-duplicate="true"]')) {
    // Tap on a duplicate → jump to the primary instance.
    // family-chart marks duplicates with the same `data.id` as the primary,
    // so updating mainId to that id re-centers on the canonical occurrence.
    const primaryId = cardNode.data.id
    window.location.hash = `#p=${primaryId}`
    return
  }
  // Existing tap-to-open-detail-sheet path
  return openDetailSheetFor(cardNode.data.id)
})
```

- [ ] **Step 6: Run tests, verify pass**

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts --run
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: all pass; new tests included.

- [ ] **Step 7: Visual verification**

```bash
pnpm dev
```

Use the Smith Family Demo seed (has a multi-branch reachable George Smith). Confirm:
- George Smith's duplicate instance: dashed border + ↑ badge top-left + tooltip on hover
- Tap a duplicate: canvas re-centers on the primary instance, URL hash updates
- Deceased + duplicate (set a seed value if needed): both treatments visible without collision

- [ ] **Step 8: QA feedback gate — IMPORTANT**

Push the branch + wait for the Vercel preview to deploy. Then ask the user to walk the preview themselves:

> "Phase 8b-3 deployed to preview. Please open the tree view, look at the duplicate-marker treatment, and tell me if the dashed-border + ↑ badge + tooltip combination reads correctly. Per locked decision #13, if it feels cluttered or unclear, we fall back to option 1 (`setDuplicateBranchToggle(true)`) — that's a one-line config change to `FamilyTree.tsx`."

Wait for explicit user feedback. If user says fallback to option 1:

- Replace the duplicate-rendering branch in `personNodeHtml` with a `chart.setDuplicateBranchToggle(true)` line in `FamilyTree.tsx`
- Remove the duplicate-marker CSS + HTML
- Re-commit with `feat(phase-8): 8b-3 fallback — fold duplicates via setDuplicateBranchToggle`

Otherwise proceed.

- [ ] **Step 9: Tick + commit**

```bash
git add src/app/tree/[id]/_lib/person-node-html.ts \
  src/app/tree/[id]/_components/FamilyTree.tsx \
  src/app/globals.css \
  src/__tests__/lib/person-node-html.test.ts \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8b-3 — duplicate-card visual marker (option 2)

family-chart's d.duplicate flag now surfaces visually as:
- dashed border on the card wrapper (universal "secondary/reference" cue)
- ↑ corner badge top-left (top-right is reserved for the deceased † badge,
  so the two compose cleanly on a deceased+duplicate node)
- "Already shown above" tooltip
- tap-to-jump-to-primary (sets #p=<uuid> and re-centers via existing
  hash-sync infrastructure)

Avatar / name / dates stay full-color — duplicates are echoes, not ghosts.
No opacity / saturation change, so the marker doesn't collide with the
deceased treatment from 8b-1.

QA feedback gate (per locked decision #13) passed against the Vercel
preview before commit.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Milestone 8b-done — internal smoke test

Dispatch e2e-smoke-tester to re-run flows phase-3 through phase-7 plus the new `phase-8b-tree-polish` flow (which 8b-3's commit appended to `docs/qa/smoke-flows.md`).

Manual walk:
- Smith Family Demo seed → tree page
- Click "View whole tree" button → canvas zooms to fit
- Hover/long-press → "+" appears → click opens add-relative form
- Tap a duplicate → re-centers on primary
- Deceased people show † + Memoriam + softened chrome on cards

---

## Bundle 8c — Landing + nav + animations (7 sub-tasks)

### Task 8c-1: Shared `(app)` route group

**Files (moves):**
- `src/app/dashboard/layout.tsx` → DELETE (content moves to `(app)/layout.tsx`)
- `src/app/dashboard/SignOutButton.tsx` → `src/app/(app)/_components/SignOutButton.tsx`
- `src/app/dashboard/actions.ts` → `src/app/(app)/_actions/signOut.ts`
- `src/app/dashboard/` (page.tsx, CreateTreeModal.tsx, TreeCardMenu.tsx, RenameTreeModal.tsx, DeleteTreeDialog.tsx, loading.tsx) → `src/app/(app)/dashboard/`
- `src/app/tree/[id]/` (everything) → `src/app/(app)/tree/[id]/`
- `src/app/invite/[token]/` → `src/app/(app)/invite/[token]/`

**Files (new):**
- `src/app/(app)/layout.tsx` — shared chrome

**Files (modified):**
- `src/proxy.ts` — verify matcher still works (route groups should be transparent to Next.js routing — `(app)` doesn't appear in the URL)
- Every import that referenced `@/app/dashboard/...` or `@/app/tree/...` etc. — update paths
- `docs/tasks/current-phase.md`, `docs/tasks/phase-backlog.md`

This is the most invasive sub-task in Phase 8 — a directory restructure. **Stage it carefully** — TDD is hard for moves; instead use `git mv` + ensure typecheck stays clean after each move.

- [ ] **Step 1: Confirm Next 16 route groups behave as expected**

```bash
ls -la node_modules/next/dist/docs 2>/dev/null | head
```

Read the Next 16 route group docs if needed:

```bash
pnpm exec next info
# Or use Context7 MCP if connected:
# query-docs /nextjs/nextjs "route groups (app)"
```

Confirm: `(app)` does not appear in URLs; routes resolve at the same paths.

- [ ] **Step 2: Create `(app)` directory + layout**

```bash
mkdir -p src/app/\(app\)/_components src/app/\(app\)/_actions
```

Create `src/app/(app)/layout.tsx` with the dashboard-layout chrome (logo + Sign Out):

```tsx
import { SignOutButton } from './_components/SignOutButton'
import { Logo } from '@/components/icons/Logo'

/**
 * Shared chrome for authenticated routes — dashboard, tree page, invite
 * accept page. Public routes (landing, login, auth callbacks, share view)
 * live OUTSIDE this route group and don't get this layout.
 *
 * Phase 8c-1: hoisted out of the dashboard-only layout so Sign Out is
 * reachable from /tree/[id] and /invite/[token] too (closes #45).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </a>
        <SignOutButton />
      </nav>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Move SignOutButton + signOut action**

```bash
git mv src/app/dashboard/SignOutButton.tsx src/app/\(app\)/_components/SignOutButton.tsx
git mv src/app/dashboard/actions.ts src/app/\(app\)/_actions/signOut.ts
```

Update the import inside `src/app/(app)/_components/SignOutButton.tsx`:

```tsx
// Before: import { signOut } from './actions'
// After:
import { signOut } from '../_actions/signOut'
```

Confirm nothing else imports the old paths:

```bash
grep -rn "from '@/app/dashboard/actions'" src/
grep -rn "from './actions'" src/app/dashboard/
```

Expected: only matches inside `src/app/dashboard/` directory itself (which we're moving in Step 4 anyway).

- [ ] **Step 4: Move the dashboard route**

```bash
git mv src/app/dashboard src/app/\(app\)/dashboard
rm src/app/\(app\)/dashboard/layout.tsx     # the layout was hoisted up to (app)/layout.tsx
```

Update imports inside the moved files. The most impactful:
- `src/app/(app)/dashboard/page.tsx` — likely imports nothing from outside `dashboard/` so unaffected
- `src/app/(app)/dashboard/SignOutButton.tsx` doesn't exist anymore (Step 3 moved it)

- [ ] **Step 5: Move tree route**

```bash
git mv src/app/tree src/app/\(app\)/tree
```

Walk every file under `src/app/(app)/tree/` for imports of `@/app/tree/...` etc.; update to relative `./...` or `../...` references where they previously crossed `dashboard <-> tree` boundary.

Search for any cross-route imports:

```bash
grep -rn "from '@/app/dashboard\|from '@/app/tree\|from '@/app/invite" src/
```

For each match, update the path.

- [ ] **Step 6: Move invite route**

```bash
git mv src/app/invite src/app/\(app\)/invite
```

- [ ] **Step 7: Verify proxy.ts matcher**

```bash
cat src/proxy.ts
```

Look for the `matcher` config. Next route groups don't appear in URLs, so the existing matchers (`/dashboard/:path*`, `/tree/:path*`, `/invite/:path*`) should still work. Verify by running:

```bash
pnpm dev
```

Then in a fresh browser:
- Visit `/` → public landing (still scaffold, OK)
- Visit `/dashboard` → if not authed, redirects to `/login?next=/dashboard`
- After auth, lands on `/dashboard` (now served by `(app)/dashboard/page.tsx`)
- Visit `/tree/<id>` → tree page renders
- Sign Out works from `/tree/<id>` too (top nav is now shared)

If the matcher needs adjustment, edit `src/proxy.ts` accordingly.

- [ ] **Step 8: Run typecheck, lint, tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: all clean. If any test file imports changed paths, update accordingly.

- [ ] **Step 9: Manual verification of all auth routes**

Walk:
- `/dashboard` shows nav + Sign Out
- `/tree/<id>` shows nav + Sign Out (this is the new capability — Sign Out wasn't reachable before)
- `/invite/<token>` (use a test invite) shows nav + Sign Out
- `/` (landing) does NOT show nav (it's outside `(app)`)
- `/login` does NOT show nav
- `/share/<token>` does NOT show nav (it's outside `(app)`)

- [ ] **Step 10: Tick + commit**

```bash
git add -A   # large directory restructure; safe to use -A here since we know what's changed
git status   # confirm only intended changes
```

If `git status` shows anything unexpected, `git restore --staged <file>` and re-add specifically.

Ask user for approval. On approval:

```bash
git commit -m "$(cat <<'EOF'
refactor(phase-8): 8c-1 — shared (app) route group for chrome

Hoist the top nav (logo + Sign Out) out of dashboard-only layout into a
shared (app)/layout.tsx so authenticated routes — /dashboard, /tree/[id],
/invite/[token] — all surface it. Public routes (landing /, /login,
/auth/*, /share/*) stay outside the route group and don't inherit the
nav.

Move:
- src/app/dashboard/  →  src/app/(app)/dashboard/
- src/app/tree/       →  src/app/(app)/tree/
- src/app/invite/     →  src/app/(app)/invite/
- src/app/dashboard/SignOutButton.tsx  →  src/app/(app)/_components/SignOutButton.tsx
- src/app/dashboard/actions.ts          →  src/app/(app)/_actions/signOut.ts

Closes #45 (Sign Out reachable from all authenticated pages).

proxy.ts matcher is unchanged — Next route groups don't appear in URLs.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-2: Real landing screen + authed redirect

**Files:**
- Replace: `src/app/page.tsx` (currently the create-next-app scaffold)
- Create: `src/components/landing/LandingHero.tsx`
- Create: `src/components/landing/LandingFeatures.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { LandingFooter } from '@/components/landing/LandingFooter'

/**
 * Phase 8c-2 — heirloom landing page. Replaces the create-next-app
 * scaffold. Authed users redirect to /dashboard immediately (closes #44).
 */
export default async function LandingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHero />
      <LandingFeatures />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 2: Create `LandingHero.tsx`**

```tsx
import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export function LandingHero() {
  return (
    <section className="px-6 py-24 max-w-3xl mx-auto text-center">
      <div className="inline-flex items-center gap-3 mb-8 text-primary">
        <Logo size={48} />
      </div>
      {/* Italic Cormorant kicker — within the whitelist per ADR 0008. */}
      <p className="font-serif italic text-accent text-lg mb-4">
        meet the people who already know each other
      </p>
      <h1 className="font-serif text-5xl text-foreground leading-tight mb-6">
        Build a family tree<br />that feels like home.
      </h1>
      <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
        Names, photos, stories. Up to two hundred people, designed for warmth, not for genealogy power-users.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
      >
        Sign in to begin
      </Link>
    </section>
  )
}
```

- [ ] **Step 3: Create `LandingFeatures.tsx`**

```tsx
import { Branch } from '@/components/icons/Branch'
import { Leaf } from '@/components/icons/Leaf'
import { Family } from '@/components/icons/Family'
import { Heart } from '@/components/icons/Heart'

const features = [
  {
    Icon: Family,
    title: 'Your people, your way',
    body: 'Parents, children, spouses. Names + photos + bios. No genealogy-spreadsheet vibe.',
  },
  {
    Icon: Heart,
    title: 'A keepsake for shared moments',
    body: 'Send a read-only link to relatives. No accounts needed — just the people in your tree.',
  },
  {
    Icon: Leaf,
    title: 'Made for phones',
    body: 'Pan, pinch, tap-to-add. Built mobile-first so the family group chat actually uses it.',
  },
]

export function LandingFeatures() {
  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <Branch className="text-foreground/30 mx-auto mb-6" />
        <h2 className="font-serif text-3xl text-foreground">
          <Leaf size={24} className="inline mr-2 text-primary" />
          What you get
        </h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {features.map(({ Icon, title, body }) => (
          <div key={title} className="text-center">
            <Icon size={32} className="text-accent mx-auto mb-4" />
            <h3 className="font-serif text-xl text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <Branch flip className="text-foreground/30 mx-auto mt-12" />
    </section>
  )
}
```

- [ ] **Step 4: Create `LandingFooter.tsx`**

```tsx
import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <p>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
      </p>
    </footer>
  )
}
```

- [ ] **Step 5: Verify in browser**

```bash
pnpm dev
```

- Visit `/` while logged out: heirloom landing page renders, no Next scaffold
- Click "Sign in to begin" → `/login` loads
- Visit `/` while logged in: redirects to `/dashboard` immediately (closes #44)

- [ ] **Step 6: Verify the SSR redirect for #44**

Sign out + sign back in via Google OAuth (the path in #44):
- After OAuth callback, end up on `/` (since `next=/` from proxy → /login)
- The new landing page's `getUser()` check fires → redirect to `/dashboard`
- Land on `/dashboard` ✓ (instead of the Next scaffold)

- [ ] **Step 7: Typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

- [ ] **Step 8: Tick + commit**

```bash
git add src/app/page.tsx src/components/landing/ \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-2 — real landing screen + authed redirect

Replace the create-next-app scaffold at src/app/page.tsx with the
heirloom landing screen: Cormorant hero copy (italic kicker per ADR 0008
whitelist), three-card features grid with brand icons (Family/Heart/Leaf
from 8a-4), Branch SVG section dividers, sign-in CTA.

Authed users redirect to /dashboard server-side via getUser() — closes
#44 (post-Google-SSO landing on / Next scaffold).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-3: Heirloom palette pass on empty / loading / error states

**Files:**
- Modify: `src/app/(app)/dashboard/loading.tsx`
- Modify: `src/app/(app)/tree/[id]/loading.tsx`
- Modify: any other `loading.tsx` / empty-state component using `bg-muted/50`

- [ ] **Step 1: Audit every loading.tsx / error.tsx / empty-state**

```bash
find src/app -name 'loading.tsx' -o -name 'error.tsx' -o -name 'not-found.tsx' 2>&1
grep -rn "bg-muted/" src/app 2>&1
grep -rn "animate-pulse" src/app 2>&1
```

Expected output: `loading.tsx` files in dashboard and tree-id routes; possibly empty-state placeholders.

- [ ] **Step 2: Refactor dashboard loading skeleton**

Edit `src/app/(app)/dashboard/loading.tsx`:

```tsx
/**
 * Phase 8c-3 — heirloom palette loading skeleton for /dashboard.
 *
 * Previously used Tailwind's bg-muted/50 + animate-pulse (gray flash).
 * Now uses bg-background + tone-tinted shimmer to match the dashboard's
 * actual chrome. Fixes the brief black/empty frame from #50 by setting
 * an explicit background on the outer <main>.
 */
export default function DashboardLoading() {
  return (
    <main className="px-4 py-8 max-w-4xl mx-auto bg-background" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your trees…</span>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-9 w-40 rounded-md bg-secondary/60 animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-secondary/60 animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-3 h-5 w-2/3 rounded bg-secondary/60 animate-pulse" />
            <div className="mb-2 h-3 w-1/2 rounded bg-secondary/40 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-secondary/30 animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Refactor tree-page loading skeleton**

Edit `src/app/(app)/tree/[id]/loading.tsx`:

```tsx
/**
 * Phase 8c-3 — heirloom palette loading skeleton for /tree/[id].
 */
export default function TreeLoading() {
  return (
    <main className="px-4 py-8 bg-background min-h-[calc(100vh-3.5rem)]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading tree…</span>
      <div className="mb-6 flex items-center gap-3 max-w-4xl mx-auto">
        <div className="h-10 w-10 rounded-md bg-secondary/60 animate-pulse" />
        <div className="h-9 flex-1 rounded-md bg-secondary/60 animate-pulse" />
        <div className="h-10 w-10 rounded-md bg-secondary/60 animate-pulse" />
      </div>
      <div className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/40 h-[60vh] animate-pulse" />
    </main>
  )
}
```

- [ ] **Step 4: Verify in browser**

```bash
pnpm dev
```

Navigate dashboard → tree page repeatedly. Confirm:
- No black flash during the transition (cream background paints immediately)
- Skeleton uses heirloom tones (cream + secondary), not gray
- Re-walk in dark mode — skeleton uses the warm-shifted token values

- [ ] **Step 5: Tick + commit**

```bash
git add src/app/\(app\)/dashboard/loading.tsx src/app/\(app\)/tree/\[id\]/loading.tsx \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-3 — heirloom palette loading skeletons

Replace Tailwind's default bg-muted/50 + animate-pulse with heirloom
tone-tinted skeletons. Add explicit bg-background on outer <main> so the
browser doesn't fall through to black during the route change — fixes
the first 1/3 of #50 (black flash on dashboard → tree transition).

Skeletons now match the heirloom palette in both light and dark modes
(token-driven, so 8a-2's warm-shifted dark tokens carry through).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-4: `<Suspense>` boundaries + `useLinkStatus()` progress indicators

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (wrap data-fetch in `<Suspense>`)
- Modify: `src/app/(app)/tree/[id]/page.tsx` (same)
- Create: `src/components/ui/LinkProgress.tsx`
- Modify: `src/app/(app)/dashboard/` (the component that renders tree cards — wrap their `<Link>` in `LinkProgress`)

- [ ] **Step 1: Build `<LinkProgress>` component**

Create `src/components/ui/LinkProgress.tsx`:

```tsx
'use client'

import Link, { LinkProps } from 'next/link'
import { useLinkStatus } from 'next/link'
import { type ReactNode } from 'react'

type Props = LinkProps & {
  children: ReactNode
  className?: string
}

/**
 * Wraps next/link with a thin top-edge progress bar that animates while
 * the navigation is pending. Uses Next.js 16's useLinkStatus() — only
 * available inside a child of a <Link>.
 *
 * Phase 8c-4: fixes the 2/3 of #50 — the "feels stuck" mid-navigation UX
 * before the Server Component finishes fetching.
 */
function PendingBar() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'var(--accent)',
        animation: 'mtf-link-progress 1s linear infinite',
        zIndex: 100,
      }}
    />
  )
}

export function LinkProgress({ children, className, ...linkProps }: Props) {
  return (
    <Link {...linkProps} className={className}>
      {children}
      <PendingBar />
    </Link>
  )
}
```

Add the keyframe to `globals.css`:

```css
@keyframes mtf-link-progress {
  0%   { transform: scaleX(0); transform-origin: left; }
  50%  { transform: scaleX(0.7); transform-origin: left; }
  100% { transform: scaleX(1); transform-origin: left; }
}
```

- [ ] **Step 2: Wrap dashboard tree-card links**

Find where tree cards render `<Link>` in `src/app/(app)/dashboard/page.tsx` (or its child components — likely `TreeCard.tsx` or similar). Replace `<Link>` with `<LinkProgress>`:

```tsx
import { LinkProgress } from '@/components/ui/LinkProgress'
// …
<LinkProgress href={`/tree/${tree.id}`} className="block rounded-lg border ...">
  {/* card content */}
</LinkProgress>
```

- [ ] **Step 3: Wrap tree-page "Back to dashboard" + Members button links**

Find back-arrow and Members navigation links in `src/app/(app)/tree/[id]/page.tsx` or its components. Replace with `LinkProgress`.

- [ ] **Step 4: Add `<Suspense>` to dashboard data-fetch**

This is more invasive — separate the data-fetching part of the Server Component into a child that's rendered inside `<Suspense>`:

Edit `src/app/(app)/dashboard/page.tsx`:

```tsx
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import DashboardLoading from './loading'
import { DashboardContent } from './DashboardContent'

export default async function DashboardPage() {
  // Auth still happens synchronously up here.
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent userId={user.id} />
    </Suspense>
  )
}
```

Move the existing trees-fetch + render logic into a new `DashboardContent` component:

```tsx
// src/app/(app)/dashboard/DashboardContent.tsx
import { createServerClient } from '@/lib/supabase/server'
import { TreeCard } from './TreeCard'
import { CreateTreeModal } from './CreateTreeModal'

export async function DashboardContent({ userId }: { userId: string }) {
  const supabase = await createServerClient()
  const { data: trees } = await supabase
    .from('user_trees')   // or whatever the existing query is
    .select(...)
    .eq('user_id', userId)

  return (
    <main className="px-4 py-8 max-w-4xl mx-auto">
      {/* Existing dashboard markup */}
    </main>
  )
}
```

(Adapt to the actual existing component structure.)

- [ ] **Step 5: Same pattern for `/tree/[id]`**

Edit `src/app/(app)/tree/[id]/page.tsx`:

```tsx
import { Suspense } from 'react'
import TreeLoading from './loading'
import { TreeContent } from './TreeContent'

export default async function TreePage({ params }: PageProps<'/tree/[id]'>) {
  const { id } = await params
  // Auth + permission check up here (existing)
  // ...
  return (
    <Suspense fallback={<TreeLoading />}>
      <TreeContent treeId={id} userId={user.id} />
    </Suspense>
  )
}
```

- [ ] **Step 6: Verify**

```bash
pnpm dev
```

- Click a tree card → top-edge progress bar shows; heirloom skeleton paints inside the chrome immediately
- The chrome (top nav) stays mounted across the navigation — the route group from 8c-1 makes this seamless

- [ ] **Step 7: Typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

- [ ] **Step 8: Tick + commit**

```bash
git add src/components/ui/LinkProgress.tsx \
  src/app/\(app\)/dashboard/ src/app/\(app\)/tree/ \
  src/app/globals.css \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-4 — Suspense skeletons + useLinkStatus() progress bar

Two complementary "never lie about in-flight nav state" pieces:

1. <Suspense> boundaries wrap data-fetching parts of /dashboard and
   /tree/[id]. Server Components separate auth/permission gates from
   the slow data fetch, so the heirloom skeleton from 8c-3 paints
   immediately on navigation.

2. <LinkProgress> wraps next/link with Next 16's useLinkStatus() — a
   thin top-edge accent-colored progress bar animates while the
   navigation is pending. Applied to dashboard tree cards, Back-to-
   dashboard, and the Members icon button.

Together with 8c-3 (skeletons) and 8c-5 (ViewTransition), closes #50.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-5: React 19.2 `<ViewTransition>` for cross-page animations

**Files:**
- Modify: `src/components/ui/LinkProgress.tsx` (also wrap children in `<ViewTransition>`)
- OR Modify: `src/app/(app)/layout.tsx` (root-level wrap)
- Modify: `src/components/landing/LandingHero.tsx` (sign-in CTA gets `<ViewTransition>`)

Plan-time decision #6: **per-link** scope.

- [ ] **Step 1: Read the React 19.2 `<ViewTransition>` docs**

Use Context7 MCP:

```
mcp__context7__query-docs /reactjs/react "ViewTransition"
```

Or read React docs page directly: https://react.dev/reference/react/ViewTransition

Confirm:
- `<ViewTransition>` is a component from `react`
- Wrap the element you want to animate between
- Works with Server Component navigation in Next.js 16

- [ ] **Step 2: Extend `<LinkProgress>` with `<ViewTransition>`**

Edit `src/components/ui/LinkProgress.tsx`:

```tsx
'use client'

import { unstable_ViewTransition as ViewTransition } from 'react'
// (If React 19.2 exposes ViewTransition stably, drop the `unstable_` prefix.)
import Link, { LinkProps } from 'next/link'
import { useLinkStatus } from 'next/link'
import { type ReactNode } from 'react'

type Props = LinkProps & {
  children: ReactNode
  className?: string
  /** When false, skip the view-transition wrapper. */
  withViewTransition?: boolean
}

function PendingBar() { /* same as before */ }

export function LinkProgress({ children, className, withViewTransition = true, ...linkProps }: Props) {
  const inner = (
    <>
      {children}
      <PendingBar />
    </>
  )
  return (
    <Link {...linkProps} className={className}>
      {withViewTransition ? <ViewTransition>{inner}</ViewTransition> : inner}
    </Link>
  )
}
```

- [ ] **Step 3: Wrap landing-page sign-in CTA**

Edit `src/components/landing/LandingHero.tsx`:

```tsx
import { LinkProgress } from '@/components/ui/LinkProgress'
// Replace the <Link href="/login"> with:
<LinkProgress href="/login" className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition">
  Sign in to begin
</LinkProgress>
```

- [ ] **Step 4: Verify transition feel**

```bash
pnpm dev
```

Walk:
- Landing → click "Sign in to begin" → soft view transition into /login
- Login → magic link → /dashboard
- Dashboard → click tree card → soft view transition into /tree/[id]
- All transitions feel ≤ 200 ms

If transitions feel too slow, tune via CSS on `::view-transition-old(root) { animation-duration: 150ms; }` — add to `globals.css` if needed.

- [ ] **Step 5: Typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

- [ ] **Step 6: Tick + commit**

```bash
git add src/components/ui/LinkProgress.tsx src/components/landing/LandingHero.tsx \
  src/app/globals.css \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-5 — React 19.2 <ViewTransition> for cross-page animations

Extend <LinkProgress> with a React 19.2 <ViewTransition> wrapper around
the navigation target. Per-link scope (plan-time decision #6): the
landing → /login CTA and every <LinkProgress>-wrapped dashboard tree
card now do a soft view transition rather than a hard route swap.

Closes the 3/3 of #50 — the jarring abrupt dashboard → tree page swap
is replaced by a continuous transition.

Within-canvas tree navigation stays on family-chart's setTransitionTime
(per locked decision #5) — <ViewTransition> is cross-page only.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-6: Revoke-member confirm copy + italic-Cormorant audit

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/MembersSheet.tsx`
- Modify: any italic-Cormorant violations found in the audit

- [ ] **Step 1: Add revoke-member explanatory copy**

Edit `src/app/(app)/tree/[id]/_components/MembersSheet.tsx`, find the `MemberListRow` component's revoke confirm UI. Add an inline `<p>`:

```tsx
{confirmingRevoke && (
  <div className="flex flex-col gap-2 mt-2">
    <p className="text-sm text-muted-foreground italic font-serif">
      {/* Whitelist check: this is empty-state-style hero copy — NOT italic.
       *  Use plain Manrope, not Cormorant italic. */}
    </p>
    <p className="text-sm text-muted-foreground">
      {memberFullName} will lose access. The people they added stay in your tree.
    </p>
    <div className="flex gap-2">
      <button onClick={handleConfirm}>Confirm</button>
      <button onClick={handleCancel}>Cancel revoke</button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Run the italic-Cormorant audit**

```bash
grep -rn "italic.*font-serif\|font-serif.*italic" src/ 2>&1
```

Expected matches: landing-hero kicker (`LandingHero.tsx`), maybe `MembersSheet.tsx` (just-added).

For each match, check it against the whitelist from [ADR 0008](../../adrs/0008-design-system.md):
- ✅ landing-hero kicker
- ✅ section taglines
- ✅ empty-state hero copy
- ✅ share-link footer pull-quotes
- ✅ person-bio nicknames

If a match is NOT in the whitelist:
- Option A: Remove the italic + font-serif (use Manrope plain)
- Option B: Document the deviation in `docs/architecture/brand-decisions.md` § "Italic Cormorant deviations"

- [ ] **Step 3: Walk visually**

```bash
pnpm dev
```

Walk every page. Confirm only whitelisted surfaces use italic Cormorant.

- [ ] **Step 4: Tick + commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/MembersSheet.tsx \
  docs/architecture/brand-decisions.md \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-6 — revoke-member confirm copy + italic-Cormorant audit

Add inline explanatory copy next to the MembersSheet revoke-member
Confirm button ("X will lose access. The people they added stay in
your tree.") — closes the Phase 6 Q4 follow-up.

Audit pass: walked every italic-Cormorant usage against the ADR 0008
whitelist (landing-hero kicker, section taglines, empty-state hero copy,
share-link footer pull-quotes, person-bio nicknames). All current usages
fit the whitelist; no deviations to document.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8c-7: `APP_VERSION` footer micro-version

**Files:**
- Create: `src/components/ui/VersionFooter.tsx`
- Create: `src/__tests__/components/VersionFooter.test.tsx`
- Modify: `src/app/layout.tsx` (mount globally per plan-time decision #7)

- [ ] **Step 1: Confirm `APP_VERSION` is exported correctly**

```bash
cat src/lib/generated/version.ts
```

Expected: `export const APP_VERSION = '0.3.0-dev.<sha>'` (or similar — Amendment 4's `prebuild` script writes this).

Run prebuild manually to refresh:

```bash
node scripts/derive-version.mjs
cat src/lib/generated/version.ts
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/components/VersionFooter.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/generated/version', () => ({
  APP_VERSION: '0.4.0',
}))

describe('<VersionFooter>', () => {
  it('renders the version string', async () => {
    const { VersionFooter } = await import('@/components/ui/VersionFooter')
    const { getByText } = render(<VersionFooter />)
    expect(getByText('v0.4.0')).toBeTruthy()
  })

  it('renders pointer-events:none so it doesn\'t block the FAB', async () => {
    const { VersionFooter } = await import('@/components/ui/VersionFooter')
    const { container } = render(<VersionFooter />)
    const el = container.firstElementChild as HTMLElement
    expect(el?.style.pointerEvents).toBe('none')
  })
})
```

- [ ] **Step 3: Run, verify fail**

```bash
pnpm test src/__tests__/components/VersionFooter.test.tsx --run
```

Expected: 2 FAILs.

- [ ] **Step 4: Implement `<VersionFooter>`**

Create `src/components/ui/VersionFooter.tsx`:

```tsx
import { APP_VERSION } from '@/lib/generated/version'

/**
 * Phase 8c-7 — first consumer of APP_VERSION (post-Amendment 4).
 * Renders a muted micro-version in the bottom-right corner globally.
 * pointer-events:none so it never blocks the FAB on /tree/[id].
 */
export function VersionFooter() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 12,
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        color: 'var(--muted-foreground)',
        opacity: 0.4,
        pointerEvents: 'none',
        zIndex: 1,
        letterSpacing: '0.02em',
      }}
    >
      v{APP_VERSION}
    </div>
  )
}
```

- [ ] **Step 5: Mount globally**

Edit `src/app/layout.tsx`:

```tsx
import { VersionFooter } from '@/components/ui/VersionFooter'
// …
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${manrope.variable}`}>
        {children}
        <VersionFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Run tests, verify pass**

```bash
pnpm test src/__tests__/components/VersionFooter.test.tsx --run
```

Expected: 2 PASS.

- [ ] **Step 7: Verify the `prebuild` chain end-to-end**

```bash
pnpm build
cat src/lib/generated/version.ts
```

Expected: `version.ts` updated to reflect current state (likely `0.3.0-dev.<sha>` since we haven't tagged v0.4.0 yet). Footer should render this string on the build's preview.

In dev mode:

```bash
pnpm dev
```

Confirm footer shows in bottom-right of every page (landing, dashboard, tree page, invite). Confirm pointer-events:none — hovering doesn't change cursor; clicking near the FAB on tree page still clicks the FAB.

- [ ] **Step 8: Typecheck + lint + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

- [ ] **Step 9: Tick + commit**

```bash
git add src/components/ui/VersionFooter.tsx \
  src/__tests__/components/VersionFooter.test.tsx \
  src/app/layout.tsx \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "$(cat <<'EOF'
feat(phase-8): 8c-7 — APP_VERSION footer micro-version

First consumer of APP_VERSION (ADR 0009 Amendment 4's build-time-derived
version). Renders muted-text in the bottom-right corner globally;
pointer-events:none so it never blocks the FAB on /tree/[id].

The prebuild script (scripts/derive-version.mjs) writes the actual
version into src/lib/generated/version.ts on every build. At v0.4.0
release this footer will show "v0.4.0"; on dev/preview builds it shows
"v0.3.0-dev.<sha>" / "v0.4.0-rc.<sha>" per the format rules.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

### Milestone 8c-done — full Phase 8 smoke

- [ ] **Step 1: Dispatch e2e-smoke-tester for all phase flows**

```
Agent({
  subagent_type: "e2e-smoke-tester",
  description: "Phase 8 close-out smoke",
  prompt: "Run all smoke flows (phase-1 through phase-7 plus the new phase-8b-tree-polish and phase-8c-landing-and-nav) against the Vercel preview for feat/phase-8-visual-polish-landing. Confirm no regressions. Report PASS/FAIL/SKIPPED per flow.",
  run_in_background: true
})
```

Wait for the agent's report. If anything FAILs, investigate before opening the PR.

- [ ] **Step 2: Manual end-to-end walk on the QA preview**

Walk:
- Visit `/` unauthenticated → landing page with new chrome
- Sign in → /dashboard
- Sign in flow uses Google OAuth → lands on /dashboard (closes #44)
- /dashboard shows logo + Sign Out in top nav (closes #45 verification 1)
- Click a tree card → smooth view transition + heirloom skeleton (closes #50 verification 1)
- /tree/[id] shows top nav with Sign Out (closes #45 verification 2)
- Tree canvas shows: gender-shape avatars, deceased treatment, duplicates with dashed border + ↑ badge
- Click "View whole tree" → zooms out
- Hover a node → "+" appears
- Open MembersSheet, click Revoke a member → see the explanatory copy
- Sign Out → /login
- Visit `/login` while authed → redirects to /dashboard (NOT Phase 8 — that's #49, the standalone hotfix)
- Footer shows version on every page (bottom-right, muted)

---

## Phase close-out + release

### Phase PR (squash-merge into qa)

- [ ] **Step 1: Verify branch state**

```bash
git checkout feat/phase-8-visual-polish-landing
git log --oneline qa..HEAD | wc -l
# Expected: 14 (one commit per sub-task, plus maybe 1 for the phase-branch setup)
```

- [ ] **Step 2: Tick the phase close-out in current-phase.md**

Add a `## Phase 8 close-out` section to `docs/tasks/current-phase.md`:

```markdown
**Phase 8 close-out**:

- [x] All 14 sub-tasks ticked above.
- [x] Per-sub-task docs ticks landed in `current-phase.md` in the same commit as each feature commit.
- [x] Vitest suite passing: <N> new Phase 8 tests (Logo + 6 brand icons + Memoriam + person-node-html matrix + VersionFooter).
- [ ] `e2e-smoke-tester` agent ran the Phase 8 smoke flows (or BLOCKED — fall back to manual QA on the QA preview).
- [ ] Manual QA pass on the QA preview — pre-merge smoke checklist.
- [ ] Release version: **`v0.4.0`** (first phase using ADR 0009 Amendment 4).
- n/a Phase 8 migration applied to QA — no migration this phase (pure frontend).
- n/a Phase 8 migration applied to prod — no migration + pre-v1 policy.
```

- [ ] **Step 3: Open the phase PR**

Ask the user before opening. On approval:

```bash
gh pr create --repo SanchitB23/meetthefam \
  --base qa --head feat/phase-8-visual-polish-landing \
  --draft \
  --title "feat(phase-8): visual polish + landing + nav + animations" \
  --body-file /tmp/phase-8-pr-body.md
```

The PR body should follow `.github/pull_request_template.md` end-to-end (pre-tick local gates, leave manual-checklist boxes for the human reviewer).

User marks PR ready when satisfied. On their approval to merge:

```bash
gh pr merge --repo SanchitB23/meetthefam --squash --delete-branch <pr-number>
git checkout qa && git pull --ff-only && git fetch --prune
```

### Release v0.4.0 — first run of ADR 0009 Amendment 4

- [ ] **Step 1: Confirm `gh` is on the SanchitB23 account**

```bash
gh auth status
```

Expected: `SanchitB23` shown as active. If not, switch with `gh auth switch -h github.com -u SanchitB23`.

- [ ] **Step 2: Cut the release branch (zero unique commits)**

```bash
git checkout qa && git pull --ff-only
git checkout -b release/v0.4.0
git push -u origin release/v0.4.0
```

No `pnpm version`, no edits. The branch is a pure snapshot pointer.

- [ ] **Step 3: Draft release notes**

Write to `/tmp/v0.4.0-notes.md`:

```markdown
## v0.4.0 — Visual polish + landing

First release on ADR 0009 Amendment 4's release recipe (zero-unique-commit
release branch + fast-forward push into qa).

### Brand foundations (8a)
- Knot brand-guide pull-review + decisions doc
- Warm-shifted dark-mode tokens
- Knot logomark adopted (top-nav, favicon, metadata)
- Six brand icons (Branch, Leaf, Quote, Family, Sparkle, Heart)

### Person + tree canvas polish (8b)
- Gender-shape avatar variation (rounded-square / squircle / circle)
- Deceased treatment (avatar desaturate + † badge + Memoriam name prefix + softened card chrome)
- Tree-overview / zoom-to-fit control
- Floating "+" hover affordance on tree nodes
- Duplicate-card visual marker (dashed border + ↑ badge + "Already shown above")

### Landing + nav + animations (8c)
- Shared (app) route group for chrome (closes #45)
- Real landing page replaces create-next-app scaffold (closes #44)
- Heirloom palette loading skeletons (closes #50 part 1)
- <Suspense> + useLinkStatus() progress bar (closes #50 part 2)
- React 19.2 <ViewTransition> for cross-page navigation (closes #50 part 3)
- Revoke-member confirm copy
- APP_VERSION footer micro-version (first consumer of Amendment 4)

### Out of scope for this release
- Issue #49 (logged-in /login redirect) — standalone hotfix
- Tree-settings unified sheet refactor — v0.5 brainstorm
- useEffectEvent polish — dropped
- Custom SMTP (#25) — post-v1.0

### Closes
- #44 #45 #50
```

- [ ] **Step 4: Open the release PR**

```bash
gh pr create --repo SanchitB23/meetthefam \
  --base main --head release/v0.4.0 \
  --title "v0.4.0 — Visual polish + landing" \
  --body-file /tmp/v0.4.0-notes.md
```

User reviews + approves. Note the PR number.

- [ ] **Step 5: Merge with a real merge commit (NOT squash)**

```bash
gh pr merge --repo SanchitB23/meetthefam --merge --delete-branch=false <pr-number>
```

`--delete-branch=false` is critical — Step 7 needs the branch alive for the fast-forward push.

- [ ] **Step 6: Create the GitHub tag against main**

```bash
git fetch origin main
gh release create v0.4.0 \
  --repo SanchitB23/meetthefam \
  --target main \
  --title "v0.4.0 — Visual polish + landing" \
  --notes-file /tmp/v0.4.0-notes.md \
  --prerelease
```

- [ ] **Step 7: Fast-forward push release branch into qa (Amendment 4)**

```bash
git push origin release/v0.4.0:qa
```

Expected: clean fast-forward, no error.

If REJECTED with "non-fast-forward":

```bash
git checkout qa
git pull --ff-only
git merge --no-ff release/v0.4.0 -m "chore(release): merge v0.4.0 into qa"
git push origin qa
```

- [ ] **Step 8: Delete the release branch**

```bash
git push origin --delete release/v0.4.0
```

- [ ] **Step 9: Sync + verify tag**

```bash
git checkout qa && git pull --ff-only
git fetch --tags --prune
git tag -l v0.4.0
# Expected: prints v0.4.0
```

- [ ] **Step 10: Verify Vercel auto-deploys + production reflects v0.4.0**

Open https://mtf.sanchitb23.in (or the production domain) and confirm:
- Footer shows "v0.4.0" (NOT a dev-suffix)
- All Phase 8 surfaces render correctly
- No regressions in Phase 1–7 flows

- [ ] **Step 11: Flip current-phase.md to Phase 9 stub**

This is the final step — open a `docs/phase-9-stub` branch and have the `task-doc-keeper` agent flip the active phase document to Phase 9 (QA + edge cases + launch). Per `feedback_no_release_for_docs_only.md`, this docs-only branch merges into `qa` and rides into v0.5.0 — no separate tag.

```bash
git checkout qa && git pull --ff-only
git checkout -b docs/phase-9-stub
# Have task-doc-keeper close Phase 8 with v0.4.0 + open Phase 9 stub
# (mirror the pattern from commit f2fc83a / 37d11af)
```

---

## Self-review checklist

Skim each section of the spec at `docs/superpowers/specs/2026-05-16-phase-8-visual-polish-design.md`. For each spec item, confirm a task exists:

- Spec § Locked decision #1 (sub-phase structure) → covered by branch strategy + milestone tasks ✓
- Spec § Locked decision #2 (one phase branch) → 8a-0 cuts the branch ✓
- Spec § Locked decision #3 (Knot pull-review as 8a-1) → Task 8a-1 ✓
- Spec § Locked decision #4 (duplicate option 2) → Task 8b-3 ✓
- Spec § Locked decision #5 (no within-canvas ViewTransition) → confirmed in 8c-5 scope note ✓
- Spec § Locked decision #6 (cross-page only) → confirmed in 8c-5 ✓
- Spec § Locked decision #7 (APP_VERSION footer) → Task 8c-7 ✓
- Spec § Locked decision #8/9/10 (drops + defers) → confirmed in spec, not in plan tasks (correct — they're out of scope) ✓
- Spec § Locked decision #11 (Amendment 4 release recipe) → § "Release v0.4.0" ✓
- Spec § Locked decision #12 (pre-v1 no-prod-changes) → no migrations in plan ✓
- Spec § Locked decision #13 (QA feedback gate for duplicate marker) → Task 8b-3 Step 8 ✓
- Spec § Locked decision #14 (14 sub-tasks) → counted: 4 (8a) + 3 (8b) + 7 (8c) = 14 ✓
- All 7 open questions → resolved in § "Plan-time resolved decisions" ✓
- Issue closure map → covered in 8c-1 (#45), 8c-2 (#44), 8c-3/8c-4/8c-5 (#50) ✓
- Risk #1 (Amendment 4 first-run) → release recipe in this plan ✓
- Risk #2 (ViewTransition + tokens collision) → milestone smoke tests catch this ✓
- Risk #3 ((app) route group regression) → 8c-1 explicit manual verification ✓
- Risk #4 (sub-task drift) → 14 distinct tasks; no merging permitted ✓
- Risk #5 (italic-Cormorant audit timing) → 8c-6 is last in 8c ✓
- Risk #6 (duplicate-marker QA gate) → 8b-3 Step 8 ✓

Plan covers spec end-to-end. Ready for execution.
