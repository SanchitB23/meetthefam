# Phase 8 — Bundle 8b (Person + tree canvas polish) execution plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Companion to the canonical plan** [`2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md) — that file has the code-level walkthroughs for all 14 Phase 8 sub-tasks; this file is a focused session-execution overlay for Bundle 8b only, with three ground-truth corrections from a 2026-05-17 codebase recon.

**Goal:** Land Bundle 8b (3 sub-tasks: gender-shape avatar + deceased treatment + Memoriam; tree-overview + floating "+" hover affordance; duplicate-card visual marker) on the existing `feat/phase-8-visual-polish-landing` branch, ticking each sub-task in the running draft PR #55, ending with the 8b-done internal milestone smoke.

**Architecture:** Three coordinated visual changes to the family-chart canvas.

1. `<Avatar>` gains `gender` + `deceased` props; `personNodeHtml` mirrors the treatment in its raw HTML; new `<Memoriam>` component for serif-name surfaces (`PersonPicker`, `PersonDetailSheet`).
2. Two floating overlays on the chart canvas — a `TreeOverviewButton` (top-right, calls `chart.updateMainId(null)` + zoom-to-fit) and a `PersonHoverPlus` (per-node "+" affordance) — both gated by `!readOnly`.
3. Duplicate-card branch added to `personNodeHtml` (dashed border + `↑` badge + tooltip + tap-to-jump), composing cleanly with the deceased treatment from 8b-1. Locked decision #13 demands an explicit user QA-gate on 8b-3 before commit.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19.2, Tailwind v4, family-chart 0.9.0 (D3), Vitest (JSDOM env for HTML tests), Lucide icons 1.x.

---

## Context

Phase 8 ("Visual polish + landing") is in flight. Bundle 8a (brand foundations, 4 sub-tasks + polish + handoff docs) has landed on `feat/phase-8-visual-polish-landing` (HEAD `f5d2b75` at the time of writing, 6 commits ahead of `qa`). Tests `178 / 178` pass; `pnpm typecheck` + `pnpm lint` clean (only the pre-existing `PersonForm` `react-hooks/incompatible-library` warning).

This plan covers Bundle 8b only — the next three sub-tasks. Bundle 8c (7 sub-tasks: route group, landing screen, skeletons, Suspense, `<ViewTransition>`, copy audit, app-version footer) and phase close-out + the `v0.4.0` release recipe are out of scope here and will be planned separately once 8b-done lands.

**Why a new plan instead of just executing the canonical one?** The canonical plan at [`./2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md) (3237 lines, written 2026-05-16) is the source of truth for code-level detail — every code block, test, and commit message draft below defers to it. But three corrections need calling out before implementer subagents start:

1. **`gender` lives at `data.gender_raw`, not `data.gender`.** The canonical plan's test fixtures + helper signatures use `data.gender: 'm' | 'f' | 'other' | 'unknown'`. Ground truth in [`src/app/tree/[id]/_lib/family-chart-data.ts:69,82-83`](../../../src/app/tree/[id]/_lib/family-chart-data.ts): the `FamilyChartDatum.data` has BOTH `gender: 'M' | 'F'` (layout-only, mapped for the library's spouse positioning) AND `gender_raw: PersonRow['gender']` (the truthful 4-value field). The avatar-shape helper must read `gender_raw`.
2. **`<PersonCard>` does not exist.** Canonical plan lists `src/app/tree/[id]/_components/PersonCard.tsx` as a Memoriam target. Real Memoriam-thread targets are [`PersonPicker.tsx`](../../../src/app/tree/[id]/_components/PersonPicker.tsx) (line 92 — `<Avatar>` usage needs `gender` + `deceased` passed) and [`PersonDetailSheet.tsx`](../../../src/app/tree/[id]/_components/PersonDetailSheet.tsx) (already handles deceased dates at line 48-50; needs the † name prefix when applicable).
3. **`usePressActions` exposes only `onLongPress` — no hover state.** Canonical plan's 8b-2 says PersonHoverPlus "piggybacks on the existing `usePressActions` hook." That hook has no hover branch ([`src/app/tree/[id]/_lib/usePressActions.ts`](../../../src/app/tree/[id]/_lib/usePressActions.ts)). The desktop hover wiring needs a separate `pointerover` / `pointerout` listener attached to the chart container, scoped to `.mtf-node` via event delegation. Mobile parity is achieved by also setting the hover id from the existing long-press handler so the "+" can be tapped after long-press surfaces it.

Branch, PR, and milestone smoke posture for the session were chosen by the user during plan creation:

- **Scope:** Bundle 8b only (8b-1 → 8b-2 → 8b-3 → 8b-done milestone smoke).
- **Commit cadence:** Per-commit approval (default CLAUDE.md rule). Implementer subagents draft the commit + diff summary; the controller asks the user before staging.
- **8b-done smoke:** Dispatched in background; expect BLOCKED on Vercel preview SSO + Playwright MCP subagent attachment (both documented in [`docs/tasks/current-phase.md`](../../tasks/current-phase.md) "Infrastructure blockers" section).

---

## Canonical references — load these in every implementer dispatch

- **Plan source of truth:** [`./2026-05-16-phase-8-visual-polish-landing.md`](./2026-05-16-phase-8-visual-polish-landing.md) lines **875 – 1876** cover Bundle 8b verbatim. Implementer subagents should read those lines + the three corrections above.
- **Brand decisions:** [`../../architecture/brand-decisions.md`](../../architecture/brand-decisions.md). Tone tokens (`--tone-sage-bg`, `--tone-rose-bg`, …) defined in [`src/app/globals.css:88-102`](../../../src/app/globals.css).
- **Locked decision #13** (the QA gate that fires on 8b-3): canonical plan lines 113-126.
- **Conventions:** [`CLAUDE.md`](../../../CLAUDE.md) + [`AGENTS.md`](../../../AGENTS.md).
- **Resume prompt (the original handoff brief):** [`../../tasks/phase-8-resume-prompt.md`](../../tasks/phase-8-resume-prompt.md).

---

## Pre-flight: verify starting state

- [ ] **Step 0.1: Confirm branch + working tree.**

```bash
git fetch origin feat/phase-8-visual-polish-landing
git status                  # expect: clean
git log --oneline -3        # expect HEAD: f5d2b75 docs(phase-8): next-session resume prompt…
git rev-parse --abbrev-ref HEAD   # expect: feat/phase-8-visual-polish-landing
```

If not clean or wrong branch — STOP and surface to the user.

- [ ] **Step 0.2: Confirm baseline gates.**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: typecheck clean, 1 pre-existing lint warning in `PersonForm.tsx` (`react-hooks/incompatible-library` on `watch()` — Phase 4 baseline, unchanged), `178 / 178` tests pass.

If baseline drift — STOP, diagnose, and surface to the user. Do not proceed until gates are green.

---

## File structure (what 8b changes)

```
src/components/ui/
  avatar.tsx                                  MODIFY (8b-1: gender + deceased props)
  memoriam.tsx                                CREATE (8b-1)

src/__tests__/lib/
  person-node-html.test.ts                    MODIFY (8b-1 + 8b-3: extend)
src/__tests__/components/
  memoriam.test.tsx                           CREATE (8b-1)

src/app/tree/[id]/_lib/
  person-node-html.ts                         MODIFY (8b-1: gender shape, † badge,
                                                       deceased class; 8b-3: duplicate
                                                       branch, ↑ badge, dashed border)

src/app/tree/[id]/_components/
  FamilyTree.tsx                              MODIFY (8b-2: TreeOverviewButton +
                                                       PersonHoverPlus mount, hover
                                                       wiring, zoomToFit callback;
                                                       8b-3: duplicate-tap → re-center
                                                       on primary via #p=<id>)
  PersonPicker.tsx                            MODIFY (8b-1: thread gender + deceased
                                                       into <Avatar>, wrap name with
                                                       <Memoriam> when deceased)
  PersonDetailSheet.tsx                       MODIFY (8b-1: name → <Memoriam> when
                                                       deceased; existing date branch
                                                       already covers deceased)
  TreeOverviewButton.tsx                      CREATE (8b-2)
  PersonHoverPlus.tsx                         CREATE (8b-2)

src/app/
  globals.css                                 MODIFY (8b-1: .f3 .mtf-node--deceased
                                                       chrome softening; 8b-3:
                                                       comment-only — connector lines
                                                       stay solid for now per locked
                                                       decision #4)

docs/tasks/
  current-phase.md                            MODIFY (tick 8b-1, 8b-2, 8b-3 in the
                                                       SAME commit as the feature work
                                                       per `feedback_update_tasks_…`)
  phase-backlog.md                            MODIFY (mirror)
```

Per-sub-task commit boundaries are 1:1 with the file groups above — three commits land, one per sub-task. No file is touched by more than one sub-task without a deliberate hand-off (8b-1 and 8b-3 both edit `person-node-html.ts` + its test + `globals.css`; the second touch builds on the first — implementer subagents see the 8b-1 commit as their baseline).

---

## Sub-task 8b-1: Gender-shape avatar + deceased treatment + Memoriam

Implements all three coordinated visual changes in ONE commit per the locked decision in the canonical plan ("Three coordinated changes ship together per the 2026-05-12 Claude Design brainstorm").

**Canonical reference:** plan lines **877 – 1380**.

- [ ] **Step 1: Implementer subagent dispatch.**

Use `superpowers:subagent-driven-development` — dispatch a fresh `frontend-engineer` subagent with the brief below. Foreground (need result before review). The subagent MUST:

1. Read canonical plan lines 877-1380 AND the three corrections in the "Context" section of this file.
2. Read [`src/components/ui/avatar.tsx`](../../../src/components/ui/avatar.tsx) (currently 109 lines — no gender/deceased props), [`src/app/tree/[id]/_lib/person-node-html.ts`](../../../src/app/tree/[id]/_lib/person-node-html.ts) (225 lines — `mtf-node` class only, no `--deceased` variant, `avatarHtml` hardcodes `border-radius:50%`), [`src/app/tree/[id]/_lib/family-chart-data.ts:66-90`](../../../src/app/tree/[id]/_lib/family-chart-data.ts) (verify `data.deceased` + `data.gender_raw` shape), [`src/app/tree/[id]/_components/PersonPicker.tsx`](../../../src/app/tree/[id]/_components/PersonPicker.tsx) line 92 (existing `<Avatar>` usage), [`src/app/tree/[id]/_components/PersonDetailSheet.tsx:48-50`](../../../src/app/tree/[id]/_components/PersonDetailSheet.tsx) (existing deceased-date handling).
3. Apply the three corrections:
   - Helper `borderRadiusForGender(gender, px)` accepts the 4-value gender union (`'m' | 'f' | 'other' | 'unknown' | undefined`). In `personNodeHtml`'s `avatarHtml(data)`, the gender arg is **`data.gender_raw`**, NOT `data.gender` (the layout-only field).
   - In Vitest fixtures (`baseDatum.data`), set BOTH `gender_raw: 'm' as const` AND `gender: 'M' as const` so the fixture matches the real `FamilyChartDatum` shape. Test assertions on border-radius are unchanged.
   - Memoriam targets are `PersonPicker.tsx` + `PersonDetailSheet.tsx` only (no `PersonCard.tsx`). In `PersonPicker.tsx` thread `gender={p.gender}` + `deceased={p.deceased}` into `<Avatar>` (the props live on `PersonRow` per [`src/app/tree/[id]/_lib/types.ts:16,22`](../../../src/app/tree/[id]/_lib/types.ts)). In `PersonDetailSheet.tsx`, wrap the displayed `person.full_name` with `<Memoriam name={person.full_name} />` when `person.deceased` (existing date branch stays put).
4. TDD discipline — write the failing tests first (canonical plan lines 888-977), run, watch them fail, implement, watch them pass.

- [ ] **Step 2: Run gates inside the subagent.**

The subagent runs (and the controller verifies the output is in the subagent's report):

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts src/__tests__/components/memoriam.test.tsx --run
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: new tests pass; full suite `>= 178 + N` where N is the count of new tests (target: 7-9 new — 4 gender + 3 deceased + 2 Memoriam).

- [ ] **Step 3: Spec compliance review (subagent dispatch).**

Use `superpowers:requesting-code-review`. Dispatch a `claude` subagent with the prompt:

> "Review the implementer's diff for 8b-1 against the canonical plan lines 877-1380 + the three corrections in `docs/superpowers/plans/2026-05-17-phase-8b-execution.md`. Verify:
> (a) Avatar gains `gender` + `deceased` props with `borderRadiusForGender` helper matching the 18% / 34% / 50% mapping;
> (b) `<Memoriam>` component shipped + tested;
> (c) `personNodeHtml` reads `data.gender_raw` (NOT `data.gender`); emits `mtf-node` / `mtf-node--deceased` class; emits † badge at size>=36; emits † name prefix;
> (d) PersonPicker + PersonDetailSheet thread the new props / wrap Memoriam;
> (e) `.f3 .mtf-node--deceased` CSS rule added to globals.css;
> (f) `docs/tasks/current-phase.md` + `docs/tasks/phase-backlog.md` tick 8b-1 in the SAME commit.
> Report PASS / specific issues."

- [ ] **Step 4: Code quality review (subagent dispatch, can run in parallel with Step 3).**

Dispatch a second review subagent (general-purpose):

> "Code quality review of the 8b-1 diff. Check: TypeScript strict-mode compliance (no `any`), exhaustive switch / discriminated-union coverage on the gender union, accessibility (`aria-hidden` on the † badge + Memoriam glyph, `aria-label` on the avatar `role=img`), composes-cleanly invariants (the † badge must use `position:absolute; top:0; right:0` so 8b-3's `↑` duplicate badge can sit at `top:-6px; left:-6px` without collision — verify the corner choices line up). Report PASS / specific issues."

- [ ] **Step 5: If either review surfaces issues — re-dispatch the implementer subagent with the punch list, then re-review.** Repeat until both reviewers report PASS.

- [ ] **Step 6: Visual verification (browser walk).**

```bash
pnpm dev
```

Open the Smith Family Demo seed tree. The controller (NOT a subagent — `mcp__plugin_playwright_playwright__*` attaches to the controller session) navigates via Playwright MCP or asks the user to walk it manually. Confirm:

- Living male: rounded-square avatar (border-radius ~18% of 48px = 9px)
- Living female: circle avatar (border-radius 50%)
- Living "other" / unknown: squircle (border-radius ~34% of 48px = 16px) / circle
- Deceased grandparent: desaturated avatar (filter:saturate(0.55) + opacity:0.82) + † corner badge + † name prefix + softened card chrome

If a treatment reads wrong on a real seed → re-dispatch implementer with the specific punch list.

- [ ] **Step 7: Ask the user before committing.**

Present the diff summary (`git diff --stat`) + the drafted commit message (canonical plan lines 1353-1376). On approval, the implementer subagent stages exactly the affected files (no `git add -A`) and commits with the Conventional Commit prefix:

```bash
git add src/components/ui/avatar.tsx src/components/ui/memoriam.tsx \
  src/__tests__/components/memoriam.test.tsx \
  src/__tests__/lib/person-node-html.test.ts \
  src/app/tree/[id]/_lib/person-node-html.ts \
  src/app/tree/[id]/_components/PersonPicker.tsx \
  src/app/tree/[id]/_components/PersonDetailSheet.tsx \
  src/app/globals.css \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "feat(phase-8): 8b-1 — gender-shape avatar + deceased treatment + Memoriam …"
# Full message body at canonical plan lines 1353-1376 (the "NOT in scope: …" note about
# the declined 'IN LOVING MEMORY' line stays in the commit body).
git push
```

- [ ] **Step 8: Update PR #55's progress checklist.**

```bash
gh pr view 55 --json body --jq .body > /tmp/pr55-body.md
# Tick 8b-1's checkbox in the body, save, then:
gh pr edit 55 --body-file /tmp/pr55-body.md
```

The PR-body checklist is the human-visible "how far have we gotten" on the draft.

---

## Sub-task 8b-2: Tree-overview button + floating "+" hover affordance

**Canonical reference:** plan lines **1382 – 1577**.

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 1382-1577 + the third correction in this plan's Context section (no hover state in `usePressActions` — needs a separate `pointerover` / `pointerout` delegated listener). Also read [`src/app/tree/[id]/_components/FamilyTree.tsx:97-217`](../../../src/app/tree/[id]/_components/FamilyTree.tsx) (chart-init effect; `setOnCardClick` at line 173) + [`src/app/tree/[id]/_components/AddRelativeFab.tsx`](../../../src/app/tree/[id]/_components/AddRelativeFab.tsx) (mount pattern reference) + [`src/app/tree/[id]/_lib/usePressActions.ts`](../../../src/app/tree/[id]/_lib/usePressActions.ts) (long-press path that needs to also `setHoverPersonId(id)` for mobile parity).

Implementation notes the subagent should produce:

1. **`TreeOverviewButton.tsx`** — straight from the canonical plan (lines 1397-1422). `aria-label="View whole tree"`, `<Maximize2 size={16} />` from lucide, positioned `absolute top-3 right-3`. `onActivate` callback prop.
2. **`PersonHoverPlus.tsx`** — presentational only. Props: `position: { top: number; left: number } | null` and `onActivate: () => void`. Returns null when position is null. The position math is computed in `FamilyTree.tsx` (DOM-rect lookup) and passed as a prop — not local state — so the controller has one source of truth.
3. **`FamilyTree.tsx` mount** — add `useState<{ personId: string; position: { top, left } } | null>` for `hoverState`. Wire two event delegations on the chart container ref:
   - `pointerover` (`event.target.closest('.mtf-node')`) → read `data-person-id`, compute the bottom-right offset of the rect, `setHoverState({ personId, position: { top, left } })`.
   - `pointerout` (`event.target.closest('.mtf-node')`) → `setHoverState(null)` ONLY if the related target is outside the same `.mtf-node` (avoid flicker on inner-child transitions).
   - Inside the existing `usePressActions` long-press callback (line 124-138), ALSO set hover state to give mobile users the "+" after long-press surfaces it.
   - Add a `zoomToFit` callback: `history.replaceState(null, '', window.location.pathname); chartRef.current?.updateMainId(null); chartRef.current?.updateTree({ initial: true });`. (Per locked decision in canonical plan line 1499.)
   - Mount `<TreeOverviewButton onActivate={zoomToFit} />` and `<PersonHoverPlus position={hoverState?.position ?? null} onActivate={() => /* open AddRelativeFab pre-seeded as child of hoverState.personId */} />` BOTH inside the existing `{!readOnly && (<>…</>)}` block (FamilyTree.tsx lines 279-291), as siblings of `<AddRelativeFab>`.
4. **Re-uses, no new Server Action surface.** The "+" click path pre-seeds the same `<AddRelativeFab>` open state (or directly calls into the same `addPerson` Server Action / `<PersonForm>` mount via a `linkSpec={{ personId, defaultRelation: 'child' }}`). Verify by reading `AddRelativeFab.tsx` how the FAB currently opens the form so the hover-+ takes the same path.

No new Vitest tests for this sub-task per the canonical plan ("the new components are presentational; integration is exercised by the smoke flow"). The chart-init effect's eslint-disable comment (line 216) may need updating if `hoverState` or `zoomToFit` is added to the dependency array — keep `people` + `shouldSuppressNextClickRef` + `readOnly` as the only deps; hover handlers should be attached in a SEPARATE effect with stable deps (e.g. `[]` + a ref pattern) so chart teardown isn't triggered on every hover.

- [ ] **Step 2: Run gates.**

```bash
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: clean. No new tests required.

- [ ] **Step 3: Browser walk.**

```bash
pnpm dev
```

Confirm against the Smith Family Demo seed:

- Top-right overview button: click → canvas zooms out to fit ALL nodes; URL hash clears
- Desktop hover (mouse): "+" floats bottom-right of the hovered node; click opens add-relative form pre-seeded
- Mobile long-press: action menu still surfaces (no regression) AND "+" becomes visible — confirm both can fire without colliding
- `readOnly` mode (open `/share/[token]` for a tree with a share link enabled): neither the button NOR the "+" renders

- [ ] **Step 4: Spec compliance review + code quality review (parallel subagent dispatches).**

Same pattern as 8b-1 Steps 3-4. Code-quality review specifically checks: (a) hover-listener cleanup on unmount, (b) `pointerout`'s `relatedTarget` check (avoiding inner-child flicker), (c) no chart-init effect re-deps that would tear down + rebuild the d3 tree on every hover.

- [ ] **Step 5: Ask the user before committing.**

Diff summary + commit message (canonical plan lines 1557-1573). On approval:

```bash
git add src/app/tree/[id]/_components/TreeOverviewButton.tsx \
  src/app/tree/[id]/_components/PersonHoverPlus.tsx \
  src/app/tree/[id]/_components/FamilyTree.tsx \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "feat(phase-8): 8b-2 — tree-overview button + floating \"+\" hover affordance …"
git push
```

- [ ] **Step 6: Tick PR #55's checklist.** Same `gh pr edit` pattern as 8b-1 Step 8.

---

## Sub-task 8b-3: Duplicate-card visual marker (option 2) — has explicit QA gate

**Canonical reference:** plan lines **1579 – 1862**.

Per locked decision #13 (canonical plan lines 113-126): option 2 (dashed border + `↑` badge + tooltip + tap-to-jump) is the default; if the user rejects it during the QA gate, the fallback is option 1 — a single-line `chart.setDuplicateBranchToggle(true)` config in `FamilyTree.tsx` that folds duplicates into a togglable branch (verified at `node_modules/family-chart/dist/family-chart.esm.js:5395`).

- [ ] **Step 1: Implementer subagent dispatch.**

`frontend-engineer`. Brief: read canonical plan lines 1579-1862. Read [`src/app/tree/[id]/_lib/person-node-html.ts`](../../../src/app/tree/[id]/_lib/person-node-html.ts) AS UPDATED BY 8b-1 (the deceased branch is now landed; the duplicate branch must compose without collision). Read the existing `setOnCardClick` handler in FamilyTree.tsx lines 173-195.

Implementation notes:

1. **`personNodeHtml`** — extend with the `isDuplicate` branch (canonical plan lines 1646-1755). Read `duplicate` defensively off BOTH `d.data.duplicate` (data-level — older family-chart shape) and `d.duplicate` (node-level — current shape per the grep at `family-chart.esm.js:272`). The duplicate `↑` badge sits at `top:-6px; left:-6px` so it doesn't collide with the 8b-1 deceased `†` badge at `top:0; right:0`. The avatar stays full-color (no opacity/saturate change on the wrapper from the duplicate path) so deceased+duplicate composes cleanly (per canonical plan test at line 1620).
2. **Duplicate cards SKIP the ellipsis action button** — they're not the canonical card; tapping should re-center, not open a menu. Implementation: `${options.readOnly || isDuplicate ? '' : ellipsisButton}`.
3. **Tests** — extend `src/__tests__/lib/person-node-html.test.ts` with the four duplicate-branch tests (canonical plan lines 1591-1635). The `deceased + duplicate compose without collision` test is the critical guard — keep it.
4. **CSS** — add only the comment block from canonical plan lines 1762-1769 (connectors stay solid per the pragmatic compromise; locked decision #4 said dashed connectors would be tried, but the canonical plan body itself documented the tradeoff and shipped solid + a "revisit on QA feedback" comment).
5. **FamilyTree `setOnCardClick`** — extend the existing handler at lines 173-195. New branch BEFORE the action-trigger branch: `if (targetEl.closest('[data-duplicate="true"]')) { window.location.hash = '#p=' + encodeURIComponent(d.data.id); return }`. This reuses the existing hash-driven re-center wiring (lines 117-122, 220-235) — no new state, no new effect.

- [ ] **Step 2: Run gates.**

```bash
pnpm test src/__tests__/lib/person-node-html.test.ts --run
pnpm typecheck && pnpm lint && pnpm test --run
```

Expected: 4 new tests pass; full suite clean.

- [ ] **Step 3: Push, wait for the Vercel preview deploy.**

```bash
git push
```

Wait for the Vercel preview comment to land on PR #55 (typically 2-3 min). Confirm preview URL is reachable. (If the Vercel SSO gate is still up, the preview returns HTTP/2 401 — the user can still walk it logged in via the Vercel UI; ask them.)

- [ ] **Step 4: Explicit QA gate — STOP and ask the user.**

Per locked decision #13, do NOT commit until the user has walked the preview and confirmed. Surface this prompt verbatim:

> "Phase 8b-3 implementation is staged on `feat/phase-8-visual-polish-landing` and the Vercel preview is updating. Per locked decision #13, the duplicate-card treatment (dashed border + `↑` corner badge + 'Already shown above' tooltip + tap-to-jump) ships only if you confirm it reads correctly on a real tree with duplicates. Please open the preview, navigate to a tree that has a multi-branch reachable person (Smith Family Demo's George Smith), and look at the duplicate instance. Does the dashed-border + `↑` badge combination read as 'this is an echo of another card'? Or does it feel cluttered? If cluttered, we fall back to option 1 — a one-line `chart.setDuplicateBranchToggle(true)` config that folds duplicates into a togglable branch (no card-level visual marker at all)."

Wait for explicit user response. Two paths:

**Path A — user confirms option 2.** Proceed to Step 5 (commit).

**Path B — user prefers fallback option 1.** Re-dispatch the implementer subagent with the punch list:

- Revert `personNodeHtml` duplicate-branch changes (also revert the four new tests)
- Revert `globals.css` comment changes
- In `FamilyTree.tsx`, add `.setDuplicateBranchToggle(true)` to the chart-init effect's chain (between `.setSingleParentEmptyCard(false)` and the link-rewriter attach)
- Update commit message to `feat(phase-8): 8b-3 fallback — fold duplicates via setDuplicateBranchToggle` + body explaining the QA-driven reroute
- Re-run gates, re-push, then commit per Step 5.

- [ ] **Step 5: Spec compliance + code-quality reviews (subagent dispatches).**

Same pattern as previous sub-tasks. Code-quality review specifically verifies: (a) 8b-1 deceased treatment is undisturbed (no regression in the existing `mtf-node--deceased` class emission); (b) the `↑` badge at `top:-6px; left:-6px` and `†` badge at `top:0; right:0` don't overlap (compute the bounding boxes — both are 14-18px wide); (c) defensive duplicate read works for both d3-node and data shapes.

- [ ] **Step 6: Ask the user before committing.**

Diff summary + commit message (canonical plan lines 1839-1858 for option 2, OR the fallback message draft if Path B). On approval, stage + commit + push:

```bash
git add src/app/tree/[id]/_lib/person-node-html.ts \
  src/app/tree/[id]/_components/FamilyTree.tsx \
  src/app/globals.css \
  src/__tests__/lib/person-node-html.test.ts \
  docs/tasks/current-phase.md docs/tasks/phase-backlog.md

git commit -m "feat(phase-8): 8b-3 — duplicate-card visual marker (option 2) …"
git push
```

- [ ] **Step 7: Tick PR #55's checklist.**

---

## Milestone 8b-done — internal smoke (background dispatch)

- [ ] **Step 1: Append `phase-8b-tree-polish` flow to [`../../qa/smoke-flows.md`](../../qa/smoke-flows.md).**

The 8b-3 commit body says this flow lands in 8b-3; if the implementer skipped it, do it now. Use the canonical plan's milestone walk (lines 1869-1875) as the flow steps. Skip rules: `needs-local-supabase`, `needs-tools-grant-fix`, `needs-vercel-sso-bypass`.

- [ ] **Step 2: Dispatch `e2e-smoke-tester` IN BACKGROUND.**

```
Agent({
  description: "Phase 8b-done smoke",
  subagent_type: "e2e-smoke-tester",
  prompt: "Run smoke flows phase-3, phase-4, phase-5, phase-6, phase-7-share-link, and phase-8b-tree-polish against the `qa` Vercel preview. Report PASS / FAIL / SKIPPED per flow. Expect BLOCKED on the Playwright MCP subagent attachment + Vercel SSO gate — that's fine, report BLOCKED quickly so the controller can continue. Don't retry, don't sleep, don't poll.",
  run_in_background: true
})
```

The controller continues without waiting. When the agent reports back (it'll arrive as a notification), surface the verdict to the user. Expected: BLOCKED on infra (matches the documented blockers in `current-phase.md`); the user fixes either Vercel preview-protection or the Playwright MCP subagent attachment when they're ready, and the same smoke re-runs at the 8c-done milestone.

- [ ] **Step 3: Manual walk fallback.**

If the user wants pre-8c manual confirmation while the background agent is BLOCKED, the controller (NOT a subagent — `mcp__plugin_playwright_playwright__*` attaches to the controller session) walks the canonical plan's 5-bullet milestone checklist (lines 1869-1875) via Playwright MCP against the preview. Report PASS / specific issues.

---

## Phase 8b close-out posture (NOT phase close-out — just the bundle handoff)

- [ ] After 8b-3 lands (whichever path), STOP and tell the user:

> "Bundle 8b landed on `feat/phase-8-visual-polish-landing` — three commits added to PR #55. The 8b-done smoke is dispatched in background (expecting BLOCKED on infra). Bundle 8c (7 sub-tasks: route group, landing screen, skeletons, Suspense, `<ViewTransition>`, copy audit, app-version footer) is the next planned chunk; phase close-out + the `v0.4.0` release recipe ride after 8c-7. Want me to plan 8c next, or pause here?"

This plan does NOT cover 8c or phase close-out — those will be a separate plan once 8b-done's verdict is in.

---

## Verification — how to confirm 8b is shippable

End-to-end checks before the user un-drafts PR #55 (which they'll do after 8c-7 + phase close-out, not now):

1. **Gates clean at each commit:** `pnpm typecheck && pnpm lint && pnpm test --run` reports clean (only the pre-existing `PersonForm` warning) and `>= 178 + new test count` passing tests at every commit on `feat/phase-8-visual-polish-landing`.
2. **Tests confirm composition:** The `deceased + duplicate compose without collision` test in `person-node-html.test.ts` (canonical plan lines 1620-1635) is the single critical assertion that 8b-1 and 8b-3 don't fight each other. It must pass.
3. **Visual walks against the Vercel preview** (matrix):
   - Living male, female, "other", unknown → 4 different avatar shapes (rounded-square / circle / squircle / circle).
   - Deceased ancestor → desaturated avatar + † corner badge + † name prefix + softened card chrome.
   - Tree-overview button (top-right) → click zooms to fit; URL hash clears.
   - Desktop hover on any node → "+" appears bottom-right; click opens add-relative form pre-seeded as `child`.
   - Mobile long-press on any node → action menu surfaces (no regression) AND "+" appears.
   - Duplicate-instance card (Smith Family Demo's George Smith on a different branch) → dashed border + `↑` corner badge at `top-left` + "Already shown above" tooltip on hover; tap re-centers the canvas on the primary instance; URL hash updates to `#p=<uuid>`.
   - Share view (`/share/<token>`) → none of the 8b-2 affordances render; deceased treatment + duplicate marker still render (they're read-only-safe by design).
4. **PR #55 progress checklist** — three new green checkboxes (8b-1 / 8b-2 / 8b-3) visible in the PR body.
5. **Background 8b-done smoke** — reported (PASS or BLOCKED with documented reason).

---

## Self-review notes

Walked the canonical plan's "Ship gate" bullets in [`../../tasks/current-phase.md`](../../tasks/current-phase.md) against this plan:

- ✅ gender-shape avatar variation — 8b-1
- ✅ deceased treatment — 8b-1
- ✅ `<Memoriam>` component — 8b-1
- ✅ ship together — single commit per the canonical plan's locked decision
- ✅ tree-overview / zoom-to-fit control — 8b-2
- ✅ floating "+" hover affordance — 8b-2
- ✅ duplicate-card visual marker (option 2 — dashed border + `↑` badge + tooltip + tap-to-jump) — 8b-3
- ✅ NOT opacity-based; composes cleanly with deceased treatment — 8b-3 verification covered by the `deceased + duplicate compose` test
- ✅ QA feedback gate before phase close — 8b-3 Step 4 (the explicit user-ask before commit)

Placeholder scan: no "TBD" / "implement later" / "similar to Task N" — every sub-task points at canonical plan line ranges + lists the three corrections it depends on.

Type consistency: `gender_raw` (truthful `'m' | 'f' | 'other' | 'unknown'`) vs `gender` (layout-only `'M' | 'F'`) is the single name-collision risk the canonical plan got wrong; this plan flags it in three places (Context correction #1, 8b-1 Step 1 subagent brief, 8b-1 Step 3 spec-compliance review).

No spec-gap detected. Plan ends at 8b-done milestone — Bundle 8c + phase close-out are explicitly out of scope and noted as such.

---

## How to use this doc in a fresh chat

1. Open a new Claude Code session in the meetthefam repo root.
2. Paste this prompt verbatim:

> Resume Phase 8 Bundle 8b execution per [`docs/superpowers/plans/2026-05-17-phase-8b-execution.md`](docs/superpowers/plans/2026-05-17-phase-8b-execution.md). The canonical 14-sub-task plan is at [`docs/superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md`](docs/superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md). Begin with the Pre-flight checks (Step 0.1 + 0.2). Per-commit approval; 8b-done smoke dispatched in background; STOP after 8b-3 lands. Use the `superpowers:subagent-driven-development` skill for per-sub-task implementer + reviewer dispatches.
